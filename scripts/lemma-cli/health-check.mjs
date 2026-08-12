#!/usr/bin/env node
// scripts/lemma-cli/health-check.mjs
// Emits a report of check results per data/health-checks.yaml + data/phase-state.yaml.
// Public aggregate goes to data/last-health-check.json (counts only; no per-check detail per R6 B2).
//
// Per §21A contract:
//   --check     alias of default (this script is read-only by nature)
//   --json      machine-readable output (default when non-TTY)
//   --verbose   include per-check detail on the TTY path
//   --local     runtime_context=local (default: ci)
//
// Exit: 0 = clean/warn/pending, 1 = fail.
//
// PHASE 2b scope: real per-check implementations layer in progressively as the
// surfaces they measure come online. Every check registered in health-checks.yaml
// resolves to a status here; unimplemented checks emit `pending` with a stub note
// so the aggregate stays honest.

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, parseArgs, isJsonMode, loadPhaseState, loadHealthChecks,
  effectiveSeverity, worstStatus,
} from './_common.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const runtimeContext = args.flags.has('local') ? 'local' : 'ci';

const phaseState = loadPhaseState();
const contract = loadHealthChecks();

const results = [];

for (const [checkId, spec] of Object.entries(contract.checks)) {
  if (!spec.runtime_context.includes(runtimeContext)) continue;

  const severity = effectiveSeverity(spec, phaseState);

  // Real implementations get added as their surfaces come online.
  // For now emit a `pending` stub with the next-step per §21A.
  results.push({
    check: checkId,
    status: 'pending',
    severity,
    message: 'not yet implemented (Phase 2b scaffold)',
    next_step: `implement check body in scripts/lemma-cli/health-check.mjs when surface is live`,
  });
}

const overall = worstStatus(results);

const publicReport = {
  timestamp: new Date().toISOString(),
  phase: phaseState.current_phase,
  runtime_context: runtimeContext,
  overall_status: overall,
  counts: {
    clean:   results.filter(r => r.status === 'clean').length,
    warn:    results.filter(r => r.status === 'warn').length,
    pending: results.filter(r => r.status === 'pending').length,
    fail:    results.filter(r => r.status === 'fail').length,
  },
  schema_version: '1.0',
};

fs.writeFileSync(
  path.join(REPO_ROOT, 'data', 'last-health-check.json'),
  JSON.stringify(publicReport, null, 2) + '\n',
);

if (jsonMode) {
  const fullReport = { ...publicReport, checks: results };
  console.log(JSON.stringify(fullReport, null, 2));
} else {
  console.log(`Health check @ phase ${phaseState.current_phase}: ${overall}`);
  const counts = publicReport.counts;
  console.log(`  clean=${counts.clean}  warn=${counts.warn}  pending=${counts.pending}  fail=${counts.fail}`);
  if (verbose) {
    for (const r of results) {
      console.log(`  [${r.severity}] ${r.check}: ${r.status} — ${r.message}`);
      if (r.next_step) console.log(`      → ${r.next_step}`);
    }
  }
}

process.exit(overall === 'fail' ? 1 : 0);
