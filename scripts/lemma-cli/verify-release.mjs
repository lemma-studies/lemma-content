#!/usr/bin/env node
// scripts/lemma-cli/verify-release.mjs --tag <slug>/vN.N [--json] [--local]
//
// Runs §21C check set scoped to one release. Opens/updates a
// `verify-release-failure`-labeled Issue per failing check (create-or-update by check-id
// per §21I anti-drift).
//
// Per-study-lifecycle-gated: checks marked `study_lifecycle_gated: true` in
// health-checks.yaml return `pending` when study.yaml.versions is empty; blocking
// only after first release lands.
//
// Per §21A contract:
//   --tag <tag>   required, form: <slug>/vN.N
//   --check       read-only validation (this is default; script does not mutate)
//   --dry-run     do not open Issues on failure; report what would open
//   --json        machine-readable output (default when non-TTY)
//   --verbose     per-check human output
//   --local       runtime_context=local
//
// Exit: 0 = pass (all `clean`/`warn`/`pending`), 1 = at least one `fail`, 2 = usage.

import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import {
  REPO_ROOT, parseArgs, isJsonMode, loadPhaseState, loadHealthChecks,
  effectiveSeverity, worstStatus,
} from './_common.mjs';

const args = parseArgs(process.argv.slice(2));
const tag = args.values.get('tag');
if (!tag || !/^[a-z0-9-]+\/v\d+(\.\d+)*$/.test(tag)) {
  console.error('usage: verify-release --tag <slug>/vN.N [--json] [--local] [--dry-run] [--verbose]');
  console.error('  example: verify-release --tag what-is-the-perfect/v5.4');
  process.exit(2);
}
const [slug, version] = tag.split('/');
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const dryRun = args.flags.has('dry-run');
const runtimeContext = args.flags.has('local') ? 'local' : 'ci';

const phaseState = loadPhaseState();
const contract = loadHealthChecks();

// Load study.yaml at HEAD; verify-release in CI targets the tagged commit, but that
// checkout happens in the workflow — this script trusts its cwd is at the tagged sha.
const studyYamlPath = path.join(REPO_ROOT, 'studies', slug, 'study.yaml');
let study = null;
if (fs.existsSync(studyYamlPath)) {
  study = yamlLoad(fs.readFileSync(studyYamlPath, 'utf8'));
}

const hasReleases = !!(study && Array.isArray(study.versions) && study.versions.length > 0);

const results = [];

for (const [checkId, spec] of Object.entries(contract.checks)) {
  if (!spec.runtime_context.includes(runtimeContext)) continue;

  let severity = effectiveSeverity(spec, phaseState);
  if (spec.study_lifecycle_gated && !hasReleases) {
    severity = 'pending';
  }

  // Real implementations will land as each surface comes online.
  results.push({
    check: checkId,
    status: 'pending',
    severity,
    tag,
    slug,
    version,
    message: 'not yet implemented (Phase 2b scaffold)',
    next_step: `implement check body when surface is live; failing checks open Issue "verify-release-failure: ${checkId}" on ${slug}/${version}`,
  });
}

const overall = worstStatus(results);

const report = {
  timestamp: new Date().toISOString(),
  tag, slug, version,
  phase: phaseState.current_phase,
  runtime_context: runtimeContext,
  study_has_releases: hasReleases,
  overall_status: overall,
  counts: {
    clean:   results.filter(r => r.status === 'clean').length,
    warn:    results.filter(r => r.status === 'warn').length,
    pending: results.filter(r => r.status === 'pending').length,
    fail:    results.filter(r => r.status === 'fail').length,
  },
  checks: results,
  dry_run: dryRun,
};

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`verify-release ${tag} @ ${phaseState.current_phase}: ${overall}`);
  const c = report.counts;
  console.log(`  clean=${c.clean}  warn=${c.warn}  pending=${c.pending}  fail=${c.fail}`);
  if (verbose) {
    for (const r of results) {
      console.log(`  [${r.severity}] ${r.check}: ${r.status} — ${r.message}`);
    }
  }
}

process.exit(overall === 'fail' ? 1 : 0);
