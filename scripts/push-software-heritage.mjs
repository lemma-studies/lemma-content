#!/usr/bin/env node
// scripts/push-software-heritage.mjs [--origin <url>]
//
// Job 5a (SWH save-code-now) per §6.3. Idempotent — SWH accepts repeat requests
// and de-duplicates.
//
// SWH indexes git origins, not tags. So the trigger is a POST to
// /api/1/origin/save/git/url/<origin>/ — SWH walks the origin and archives
// every branch + tag it finds.
//
// Per §21A contract:
//   --origin <url>   git origin to save (default:
//                    https://github.com/lemma-studies/lemma-content)
//   --check          probe SWH availability; no request
//   --dry-run        print the POST that would fire; no request
//   --json           machine-readable (default when non-TTY)
//   --verbose
//
// Env: none — SWH save-code-now is unauthenticated public endpoint
// Exit: 0 = accepted / pending / already-archived, 1 = SWH unreachable, 2 = usage.
//
// PHASE 2b SCAFFOLD: real POST TODO for Task 3.6.

import { parseArgs, isJsonMode } from './lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const origin = args.values.get('origin') ?? 'https://github.com/lemma-studies/lemma-content';
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const check = args.flags.has('check');
const dryRun = args.flags.has('dry-run');

// SWH endpoint pattern:
//   POST https://archive.softwareheritage.org/api/1/origin/save/git/url/{origin}/
// Response body has {save_task_status: "not-yet-scheduled" | "scheduled" |
//   "running" | "succeeded" | "failed"}. Success states are all exit 0 —
// swh-takedown-pending failure mode (autonomy: auto, max_auto_attempts: 3,
// auto_cooldown_hours: 24) handles the "pending > 48h" case.

const report = {
  timestamp: new Date().toISOString(),
  origin,
  status: check ? 'check-ok' : (dryRun ? 'dry-run' : 'scaffold'),
  next_step: 'implement SWH POST in Task 3.6',
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else console.log(`push-software-heritage ${origin}: ${report.status}`);

if (verbose) {
  console.log(`  would POST: https://archive.softwareheritage.org/api/1/origin/save/git/url/${encodeURIComponent(origin)}/`);
}

process.exit(0);
