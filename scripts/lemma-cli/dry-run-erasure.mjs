#!/usr/bin/env node
// scripts/lemma-cli/dry-run-erasure.mjs --subject <id> [--json] [--verify-credentials]
//
// Simulates GDPR Article 17 erasure per design §16. NEVER auto-executes (§21E
// hard-gate). Generates an executable runbook in workroom that Tim reviews
// before he runs it manually.
//
// Per §21A contract:
//   --subject <id>          required — minimized reference; must be resolvable via workroom mapping
//   --dry-run               alias of default (this script never mutates public artifacts)
//   --verify-credentials    probe API tokens for write/delete scope across CF/Zenodo/HF/GitHub
//                           per R6 B7; runbook not generated if credentials are missing
//   --json                  machine-readable output (default when non-TTY)
//   --verbose               human-readable extra detail
//
// Exit: 0 = simulation complete, 1 = credentials insufficient, 2 = usage.
//
// Enumerable vs blanket-purge surfaces (R6 S2.6):
//   enumerable      workroom entries, HF rows, GitHub Discussions — counted + listed
//   blanket-purge   CF deployments by date range, cache purge-everything — no per-record list

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, isJsonMode, REPO_ROOT } from './_common.mjs';

const args = parseArgs(process.argv.slice(2));
const subject = args.values.get('subject');
if (!subject) {
  console.error('usage: dry-run-erasure --subject <id> [--json] [--verify-credentials] [--verbose]');
  console.error('  <id> is a minimized reference (no PII) into workroom subject-map.');
  process.exit(2);
}
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const verifyCreds = args.flags.has('verify-credentials');

// Phase 2b scaffold: real enumeration will land once workroom subject-map + intake
// pipeline exist. For now emit a valid-shape report with zero findings so the
// script contract is exercised end-to-end.

const credentialsOk = verifyCreds
  ? { cf: null, zenodo: null, hf: null, github: null } // null until real probe
  : { note: 'skipped; pass --verify-credentials to probe' };

const report = {
  timestamp: new Date().toISOString(),
  subject,
  status: 'scaffold',
  artifacts_affected: {
    workroom_entries: 0,
    hf_rows: 0,
    github_discussions: 0,
    cf_deployments_in_range: 0,
    zenodo_records: 0,
    swh_snapshots: 0,
    wayback_captures: 0,
  },
  commits_to_rewrite: [],
  external_takedowns_required: [],
  estimated_completion_hours: null,
  credentials_ok: credentialsOk,
  runbook_path: null,
  next_step: 'enumeration + runbook generation implemented when workroom subject-map exists',
};

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`dry-run-erasure ${subject}: ${report.status}`);
  if (verbose) console.log(JSON.stringify(report.artifacts_affected, null, 2));
  console.log(`  → ${report.next_step}`);
}

process.exit(0);
