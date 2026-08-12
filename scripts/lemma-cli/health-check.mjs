#!/usr/bin/env node
// scripts/lemma-cli/health-check.mjs
// Emits a report of check results per data/health-checks.yaml + data/phase-state.yaml.
// Public aggregate goes to data/last-health-check.json (counts only; no per-check detail per R6 B2).
//
// Per §21A contract:
//   --check     alias of default (this script is read-only by nature)
//   --json      machine-readable (default when non-TTY)
//   --verbose   include per-check detail on the TTY path
//   --local     runtime_context=local (default: ci)
//
// Exit: 0 = clean/warn/pending, 1 = fail.

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, parseArgs, isJsonMode, loadPhaseState, loadHealthChecks,
  effectiveSeverity, worstStatus,
} from './_common.mjs';
import { CHECK_REGISTRY } from './_checks.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const runtimeContext = args.flags.has('local') ? 'local' : 'ci';

const phaseState = loadPhaseState();
const contract = loadHealthChecks();

// Corpus-wide health-check: no per-study or per-version scoping — those
// checks (study_lifecycle_gated) come out as `pending` when the caller has
// no study/version context. Study-scoped health probing happens via
// verify-release --tag <slug>/<vN.N>.

const context = {
  baseUrl: phaseState.base_url,
  slug: null,
  version: null,
  study: null,
};

const results = [];

for (const [checkId, spec] of Object.entries(contract.checks)) {
  if (!spec.runtime_context.includes(runtimeContext)) continue;

  let severity = effectiveSeverity(spec, phaseState);
  const fn = CHECK_REGISTRY[checkId];

  let result;
  if (!fn) {
    result = { status: 'pending', message: `no implementation registered for check '${checkId}'`, next_step: 'add to CHECK_REGISTRY in scripts/lemma-cli/_checks.mjs' };
  } else {
    try {
      result = await fn({ ...context, spec });
    } catch (e) {
      result = { status: 'fail', message: `check threw: ${e.message}`, next_step: 'fix check implementation' };
    }
  }

  // study_lifecycle_gated: when the check needs a study and we have none
  // in corpus scope, downgrade to `pending` rather than `fail`.
  if (spec.study_lifecycle_gated && !context.slug) {
    result = { status: 'pending', message: 'study_lifecycle_gated: no study in scope for corpus health-check', ...result, status: 'pending' };
  }

  results.push({
    check: checkId,
    status: result.status,
    severity,
    message: result.message,
    next_step: result.next_step,
    evidence: verbose ? result.evidence : undefined,
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
