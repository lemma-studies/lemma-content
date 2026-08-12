#!/usr/bin/env node
// scripts/phase4-exit.mjs
//
// Phase 4 exit domain cutover per design §11 Phase 4 + §5.4 (retired
// gig8/lemma-legacy). Single script performs the atomic cutover so partial
// states are visible + recoverable via phase4-exit-partial failure mode
// (autonomy: human-gate).
//
// Sequence (each step idempotent on repeat run):
//
//   1. Snapshot pre-cutover state to workroom chore-log.
//   2. Attach custom domain `lemma.gig8.com` to the CF Pages project
//      (was on lemma-content.pages.dev throughout Phases 2b-3).
//   3. Verify DNS + TLS cert issue.
//   4. Update data/phase-state.yaml.base_url from
//      https://lemma-content.pages.dev → https://lemma.gig8.com
//      + current_phase = phase-4-exit.
//   5. Commit + push data/phase-state.yaml (this triggers CF Pages rebuild
//      which regenerates canonical <link> + JSON-LD + Highwire meta with
//      the new base_url).
//   6. Run zenodo-update-metadata.mjs --from <old> --to <new> across all
//      published records. Zenodo permits post-publish metadata edits.
//   7. Delete the paused old CF Pages project attached to legacy repo
//      (Task 1.4 paused it; §5.4 step 4). Free the project name for reuse
//      if ever needed.
//   8. Purge the old-URL cache (CF cache purge everything on the new
//      project so preview.pages.dev cached responses referencing old URL
//      don't confuse crawlers).
//   9. Emit final phase-state.yaml with current_phase = steady-state.
//
// Per §21A contract:
//   --check              validate credentials + inspect current state, no mutation
//   --dry-run            print each step's action, no mutation
//   --json               machine-readable (default when non-TTY)
//   --verbose
//
// Env: CF_API_TOKEN (Pages:Edit + Cache:Purge), ZENODO_ACCESS_TOKEN
// Exit: 0 = cutover complete (or would-be), 1 = fail (opens
// phase4-exit-partial Issue for human review), 2 = usage.
//
// Human-gate autonomy per §21F: this script REQUIRES --confirm on the
// mutation path (interactive). AI never runs this unattended.

import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { parseArgs, isJsonMode, REPO_ROOT, loadPhaseState } from './lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const check = args.flags.has('check');
const dryRun = args.flags.has('dry-run');
const confirm = args.flags.has('confirm');

const CUTOVER_FROM = 'https://lemma-content.pages.dev';
const CUTOVER_TO = 'https://lemma.gig8.com';

const phase = loadPhaseState();

if (!check && !dryRun && !confirm) {
  const msg = 'phase4-exit is human-gate (§21F autonomy). Pass --confirm to execute mutations, or --check/--dry-run for read-only preview.';
  if (jsonMode) console.log(JSON.stringify({ status: 'refused', reason: msg }));
  else console.error(msg);
  process.exit(1);
}

const cfToken = process.env.CF_API_TOKEN;
const zenodoToken = process.env.ZENODO_ACCESS_TOKEN;
if (!cfToken || !zenodoToken) {
  const msg = 'CF_API_TOKEN + ZENODO_ACCESS_TOKEN both required';
  if (jsonMode) console.log(JSON.stringify({ status: 'fail', reason: msg }));
  else console.error(msg);
  process.exit(1);
}

const currentBase = phase.base_url;
const already = currentBase === CUTOVER_TO;

// Step plan — enumerated for --dry-run visibility.
const steps = [
  { id: 1, name: 'snapshot workroom chore-log', can_skip_if_done: false },
  { id: 2, name: `attach ${CUTOVER_TO} to CF Pages lemma-content project`, can_skip_if_done: true },
  { id: 3, name: 'verify DNS + TLS cert issued', can_skip_if_done: false },
  { id: 4, name: `bump data/phase-state.yaml base_url ${CUTOVER_FROM} → ${CUTOVER_TO}`, can_skip_if_done: already },
  { id: 5, name: 'commit + push phase-state.yaml (triggers CF rebuild)', can_skip_if_done: already },
  { id: 6, name: `zenodo-update-metadata --from ${CUTOVER_FROM} --to ${CUTOVER_TO}`, can_skip_if_done: false },
  { id: 7, name: 'delete paused old CF Pages project on lemma-legacy', can_skip_if_done: false },
  { id: 8, name: 'CF cache purge everything on lemma-content', can_skip_if_done: false },
  { id: 9, name: `bump current_phase to steady-state`, can_skip_if_done: phase.current_phase === 'steady-state' },
];

// TODO(Phase 4 exit): implement each step. Each mutation appends to workroom
// chore-log so a partial-cutover recovery has a chronological trail per
// phase4-exit-partial failure mode.

const report = {
  timestamp: new Date().toISOString(),
  phase: phase.current_phase,
  base_url_current: currentBase,
  cutover_from: CUTOVER_FROM,
  cutover_to: CUTOVER_TO,
  already_on_target: already,
  steps,
  status: check ? 'check-ok' : (dryRun ? 'dry-run' : 'scaffold'),
  next_step: 'implement each mutation step in the actual Phase 4 exit run (never AI-unattended)',
};

// Explicitly bring yamlDump into scope so future impl uses it without warning.
void yamlDump;

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`phase4-exit: ${report.status}`);
  console.log(`  base_url: ${currentBase} → ${CUTOVER_TO}${already ? ' (already at target)' : ''}`);
  if (verbose || dryRun) {
    for (const s of steps) console.log(`  step ${s.id}: ${s.name}${s.can_skip_if_done ? ' (skip if already done)' : ''}`);
  }
}

process.exit(0);
