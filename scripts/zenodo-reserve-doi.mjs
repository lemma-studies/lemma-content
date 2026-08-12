#!/usr/bin/env node
// scripts/zenodo-reserve-doi.mjs --study <slug> --version vN.N
//
// Reserves DOIs on Zenodo for a study/version pair pre-tag. Two-path logic
// per design §6.3 + R7 A1:
//
//   PATH A — fresh concept: study.yaml.concept_doi is null. Create a new
//     Zenodo deposition (unpublished draft) with metadata referencing
//     base_url from data/phase-state.yaml. Reserve DOI. Write both
//     concept_doi and versions[first].version_doi to study.yaml.
//
//   PATH B — new version on existing concept: study.yaml.concept_doi
//     resolves. Query Zenodo for the latest published version on this
//     concept. Call POST /records/{id}/versions to create a new draft
//     linked to the concept. Reserve DOI. Write versions[N].version_doi
//     to study.yaml.
//
//   ORPHAN DRAFT REUSE: before creating a new draft, list drafts on the
//     concept. If exactly one orphan (unpublished) draft exists with no
//     matching study.yaml.versions entry, adopt it and skip creation.
//     If > 1 orphan exists → refuse (zenodo-draft-collision failure mode,
//     autonomy: human-gate).
//
// base_url comes from data/phase-state.yaml.base_url — during Phases 2b-3
// this is https://lemma-content.pages.dev; flips to https://lemma.gig8.com
// at Phase 4 exit. Zenodo permits metadata updates post-publish (not file
// content); scripts/phase4-exit.mjs walks published records at cutover.
//
// Per §21A contract:
//   --study <slug>       required
//   --version vN.N       required
//   --check              validate credentials + inspect Zenodo state, no mutation
//   --dry-run            print the payload that would be sent, no create
//   --json               machine-readable (default when non-TTY)
//   --verbose
//
// Env:
//   ZENODO_ACCESS_TOKEN   PAT with deposition:write scope
//   ZENODO_HOST           default https://zenodo.org; override for sandbox
//
// Exit: 0 = reserved, 1 = fail, 2 = usage, 3 = human-gate (draft collision).
//
// PHASE 2b SCAFFOLD: implements arg parsing, phase-state read, base_url
// resolution, credential env check. Live Zenodo API calls TODO for Task 3.5.

import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { parseArgs, isJsonMode, REPO_ROOT, loadPhaseState } from './lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const slug = args.values.get('study');
const version = args.values.get('version');
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const check = args.flags.has('check');
const dryRun = args.flags.has('dry-run');

if (!slug || !version) {
  console.error('usage: zenodo-reserve-doi --study <slug> --version vN.N [--check|--dry-run] [--json] [--verbose]');
  process.exit(2);
}

const phase = loadPhaseState();
const baseUrl = phase.base_url;

const studyYamlPath = path.join(REPO_ROOT, 'studies', slug, 'study.yaml');
if (!fs.existsSync(studyYamlPath)) {
  const msg = `study.yaml not found at ${studyYamlPath}`;
  if (jsonMode) console.log(JSON.stringify({ status: 'fail', reason: msg }));
  else console.error(msg);
  process.exit(1);
}
const study = yamlLoad(fs.readFileSync(studyYamlPath, 'utf8'));

const token = process.env.ZENODO_ACCESS_TOKEN;
if (!token) {
  const msg = 'ZENODO_ACCESS_TOKEN not set';
  if (jsonMode) console.log(JSON.stringify({ status: 'skipped', reason: msg }));
  else console.error(msg);
  process.exit(check ? 1 : 0);
}

const zenodoHost = process.env.ZENODO_HOST ?? 'https://zenodo.org';

const path_ = study.concept_doi ? 'PATH-B-newversion' : 'PATH-A-fresh-concept';

// Metadata that would be sent to Zenodo. Deriving here so --dry-run can
// print it without any network activity.
const proposedMetadata = {
  metadata: {
    title: study.title,
    creators: [{ name: study.author, orcid: study.orcid ?? undefined }],
    description: `Concept DOI + version DOI reservation for ${slug} ${version}. Canonical URL: ${baseUrl}/${slug}/`,
    version,
    upload_type: 'publication',
    publication_type: 'article',
    license: 'cc-by-4.0',
    publication_date: study.current_version_date ?? new Date().toISOString().slice(0, 10),
    related_identifiers: [
      { relation: 'isVersionOf', identifier: `${baseUrl}/${slug}/`, resource_type: 'publication-article' },
      { relation: 'isDocumentedBy', identifier: `https://github.com/lemma-studies/lemma-content/tree/${slug}/${version}`, resource_type: 'software' },
    ],
  },
};

// TODO(Task 3.5): implement PATH-A vs PATH-B against Zenodo REST + orphan-draft reuse.
const report = {
  timestamp: new Date().toISOString(),
  slug, version,
  path: path_,
  phase: phase.current_phase,
  base_url: baseUrl,
  zenodo_host: zenodoHost,
  proposed_metadata: proposedMetadata,
  concept_doi: study.concept_doi,
  status: 'scaffold',
  dry_run: dryRun,
  check_only: check,
  next_step: 'implement PATH-A/B API calls + orphan-draft reuse in Task 3.5',
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`zenodo-reserve-doi ${slug}/${version}: ${report.status} (${path_}) → base_url=${baseUrl}`);
  if (verbose) console.log(JSON.stringify(proposedMetadata, null, 2));
}

// Explicitly do NOT write back to study.yaml in scaffold mode; real impl will
// use yamlDump to update concept_doi + versions[].version_doi after successful
// API call, single atomic write. (yamlDump imported to shake out the dep now.)
void yamlDump;

process.exit(0);
