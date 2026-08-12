#!/usr/bin/env node
// scripts/zenodo-publish.mjs --study <slug> --version vN.N [--assets-dir <path>]
//
// Job 3 (doi-publish) per design §6.3. Called after Job 2 lands the Release
// with composite + rag + PDF artifacts.
//
// Steps (idempotent per §6.3 Job 3 table):
//   3a Read reserved concept + version DOIs from studies/<slug>/study.yaml
//   3b Query Zenodo: does concept have published version metadata.version == vN.N?
//      → Skip if yes (idempotent short-circuit for CI reruns).
//   3c Delete the draft's inherited files; upload composite + rag + PDF
//   3d PUBLISH the deposit. Metadata references URLs constructed from
//      data/phase-state.yaml.base_url (during Phases 2b-3 the .pages.dev
//      preview; flipped to lemma.gig8.com at Phase 4 exit by
//      zenodo-update-metadata.mjs — Zenodo permits metadata edits post-publish
//      but NOT file edits, so this is a one-shot for content and iterative
//      for URLs).
//
// Refuses to publish when data/phase-state.yaml.release_publish_unlocked is
// false (Phase 2b + earlier) — reservations only pre-Phase-3.
//
// Per §21A contract:
//   --study <slug>       required
//   --version vN.N       required
//   --assets-dir <path>  where composite/rag/PDF live (default: current dir)
//   --check              validate credentials + reserved DOIs + assets exist
//   --dry-run            print the API calls that would run; no publish
//   --json               machine-readable (default when non-TTY)
//   --verbose
//
// Env: ZENODO_ACCESS_TOKEN
// Exit: 0 = published (or already-published; idempotent), 1 = fail, 2 = usage.
//
// PHASE 2b SCAFFOLD: real REST calls TODO for Task 3.5/3.6.

import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { parseArgs, isJsonMode, REPO_ROOT, loadPhaseState } from './lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const slug = args.values.get('study');
const version = args.values.get('version');
const assetsDir = args.values.get('assets-dir') ?? process.cwd();
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const check = args.flags.has('check');
const dryRun = args.flags.has('dry-run');

if (!slug || !version) {
  console.error('usage: zenodo-publish --study <slug> --version vN.N [--assets-dir <path>] [--check|--dry-run] [--json]');
  process.exit(2);
}

const phase = loadPhaseState();
if (!phase.release_publish_unlocked && !check && !dryRun) {
  const msg = `release_publish_unlocked=false in data/phase-state.yaml — refusing to publish. Pre-Phase-3 reservations only.`;
  if (jsonMode) console.log(JSON.stringify({ status: 'refused', reason: msg }));
  else console.error(msg);
  process.exit(1);
}

const studyYamlPath = path.join(REPO_ROOT, 'studies', slug, 'study.yaml');
if (!fs.existsSync(studyYamlPath)) {
  const msg = `study.yaml missing at ${studyYamlPath}`;
  if (jsonMode) console.log(JSON.stringify({ status: 'fail', reason: msg }));
  else console.error(msg);
  process.exit(1);
}
const study = yamlLoad(fs.readFileSync(studyYamlPath, 'utf8'));
const versionEntry = (study.versions ?? []).find(v => v.version === version);
if (!versionEntry) {
  const msg = `version ${version} not in study.yaml.versions[]`;
  if (jsonMode) console.log(JSON.stringify({ status: 'fail', reason: msg }));
  else console.error(msg);
  process.exit(1);
}

const token = process.env.ZENODO_ACCESS_TOKEN;
if (!token) {
  const msg = 'ZENODO_ACCESS_TOKEN not set';
  if (jsonMode) console.log(JSON.stringify({ status: 'skipped', reason: msg }));
  else console.error(msg);
  process.exit(check ? 1 : 0);
}

// Expected assets — must all exist before publish.
const composite = path.join(assetsDir, `${slug}-${version}.md`);
const rag       = path.join(assetsDir, `${slug}-${version}.rag.md`);
const pdf       = path.join(assetsDir, `${slug}-${version}.pdf`);
const missing = [composite, rag, pdf].filter(p => !fs.existsSync(p));

const report = {
  timestamp: new Date().toISOString(),
  slug, version,
  phase: phase.current_phase,
  base_url: phase.base_url,
  release_publish_unlocked: phase.release_publish_unlocked,
  concept_doi: study.concept_doi,
  version_doi: versionEntry.version_doi,
  assets_expected: [composite, rag, pdf],
  assets_missing: missing,
  status: missing.length ? 'fail' : (check ? 'ok' : (dryRun ? 'dry-run' : 'scaffold')),
  next_step: 'implement Zenodo REST publish flow in Task 3.5/3.6',
};

// TODO(Task 3.5/3.6):
//   3a Read study.concept_doi + versionEntry.version_doi (done above).
//   3b GET /records/{concept_doi} → check if metadata.version == version already
//      → if yes, exit 0 idempotent.
//   3c For the draft matching versionEntry.version_doi:
//      DELETE existing files (inherited from prior version via newversion).
//      POST files: composite, rag, PDF.
//   3d POST /publish. Metadata.related_identifiers should reference
//      ${phase.base_url}/${slug}/ and ${phase.base_url}/${slug}/versions/${version}/.

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`zenodo-publish ${slug}/${version}: ${report.status}`);
  if (missing.length) console.log(`  missing assets: ${missing.join(', ')}`);
  if (verbose) console.log(`  base_url=${phase.base_url} concept=${study.concept_doi} version=${versionEntry.version_doi}`);
}

process.exit(missing.length ? 1 : 0);
