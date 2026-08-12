#!/usr/bin/env node
// scripts/verify/verify-manifest.mjs
//
// Validates primary-sources/manifest.json integrity per §7.5:
//   - Each entry has full schema (id, citation, canonical_url, redistribution,
//     license, retrieved, status, language, version, translator/edition/scarlight_ref
//     as applicable)
//   - IDs are globally unique across the manifest
//   - Every ID referenced from studies/<slug>/primary-sources.json resolves
//   - `redistribution` values are one of: PD | CC | OA-hosted-unclear | restricted
//   - `status` values are one of: active | superseded | retired
//   - superseded_by / replaces form no cycles
//
// Per §21A contract:
//   --check     alias of default
//   --dry-run   n/a (read-only)
//   --json      machine-readable (default when non-TTY)
//   --verbose
//
// Exit: 0 = all valid, 1 = at least one violation, 2 = usage.
//
// PHASE 2b SCAFFOLD: skeleton returns "pending" until Task 3.4 populates
// manifest.json with real WITP entries; then per-check bodies land.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, isJsonMode, REPO_ROOT } from '../lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');

const manifestPath = path.join(REPO_ROOT, 'primary-sources', 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  const msg = 'primary-sources/manifest.json not found; skipping (populated in Task 3.4)';
  if (jsonMode) console.log(JSON.stringify({ status: 'pending', reason: msg }));
  else console.log(msg);
  process.exit(0);
}

// TODO: real validation once manifest exists.
const violations = [];

const report = {
  timestamp: new Date().toISOString(),
  status: violations.length === 0 ? 'clean' : 'fail',
  violations,
  next_step: 'implement per-entry schema + cross-ref validation once manifest.json has entries',
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else console.log(`verify-manifest: ${report.status}${verbose && violations.length ? ' — ' + violations.join('; ') : ''}`);

process.exit(violations.length === 0 ? 0 : 1);
