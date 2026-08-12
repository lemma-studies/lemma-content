#!/usr/bin/env node
// scripts/zenodo-update-metadata.mjs [--study <slug>] [--from <url>] [--to <url>]
//
// Walks all published Zenodo depositions across all studies and rewrites
// URL references in metadata (title-linked URL, description, related_identifiers)
// from --from to --to. Called at Phase 4 exit by scripts/phase4-exit.mjs to flip
// every previously-published record from https://lemma-content.pages.dev/... to
// https://lemma.gig8.com/... after the custom-domain cutover.
//
// Zenodo permits metadata edits POST-PUBLISH (not file content); this exploits
// that to preserve the "no dead URL window" property from R7 A1 — records
// always reference a currently-live host.
//
// Per §21A contract:
//   --study <slug>       optional; if given, only update that study's records
//   --from <url>         source URL to replace (default: read from
//                        data/phase-state.yaml current base_url before this
//                        script bumped it; phase4-exit.mjs passes explicitly)
//   --to <url>           target URL (default: read from data/phase-state.yaml
//                        after bump)
//   --check              read + count records that would be updated, no mutation
//   --dry-run            print each API call payload, no mutation
//   --json               machine-readable (default when non-TTY)
//   --verbose
//
// Env: ZENODO_ACCESS_TOKEN
// Exit: 0 = all updated (or would-be), 1 = at least one fail, 2 = usage.
//
// PHASE 2b SCAFFOLD: real REST calls + record enumeration TODO for Phase 4 exit.

import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { parseArgs, isJsonMode, REPO_ROOT, loadPhaseState } from './lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const targetSlug = args.values.get('study') ?? null;
const from = args.values.get('from') ?? null;
const to = args.values.get('to') ?? null;
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const check = args.flags.has('check');
const dryRun = args.flags.has('dry-run');

const phase = loadPhaseState();

if (!from || !to) {
  console.error('usage: zenodo-update-metadata --from <url> --to <url> [--study <slug>] [--check|--dry-run] [--json]');
  console.error('  --from + --to are required to prevent accidental rewrites; phase4-exit.mjs passes both explicitly.');
  process.exit(2);
}

const token = process.env.ZENODO_ACCESS_TOKEN;
if (!token) {
  const msg = 'ZENODO_ACCESS_TOKEN not set';
  if (jsonMode) console.log(JSON.stringify({ status: 'skipped', reason: msg }));
  else console.error(msg);
  process.exit(check ? 1 : 0);
}

// Enumerate every study + version with a published version_doi. Each becomes
// a metadata-update target.
const studiesRoot = path.join(REPO_ROOT, 'studies');
const targets = [];
if (fs.existsSync(studiesRoot)) {
  const slugs = targetSlug ? [targetSlug] : fs.readdirSync(studiesRoot).filter(s =>
    fs.statSync(path.join(studiesRoot, s)).isDirectory()
  );
  for (const slug of slugs) {
    const p = path.join(studiesRoot, slug, 'study.yaml');
    if (!fs.existsSync(p)) continue;
    const study = yamlLoad(fs.readFileSync(p, 'utf8'));
    for (const v of study.versions ?? []) {
      if (v.version_doi) {
        targets.push({ slug, version: v.version, version_doi: v.version_doi });
      }
    }
    if (study.concept_doi) {
      targets.push({ slug, version: 'concept', version_doi: study.concept_doi });
    }
  }
}

// TODO(Phase 4 exit):
//   for each target:
//     GET /records/{version_doi} → current metadata
//     scan metadata.title, description, related_identifiers[].identifier for `from`
//     replace with `to`
//     PUT /records/{version_doi} with updated metadata

const report = {
  timestamp: new Date().toISOString(),
  from, to,
  phase: phase.current_phase,
  target_study: targetSlug,
  records: targets.length,
  targets: verbose ? targets : undefined,
  status: check ? 'check-ok' : (dryRun ? 'dry-run' : 'scaffold'),
  next_step: 'implement Zenodo GET/PUT metadata flow in Phase 4 exit',
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else console.log(`zenodo-update-metadata: ${report.status} (${targets.length} records ${targetSlug ? `for ${targetSlug}` : 'across all studies'})`);

process.exit(0);
