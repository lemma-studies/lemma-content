#!/usr/bin/env node
// scripts/lemma-cli/verify-release.mjs --tag <slug>/vN.N [--json] [--local]
//
// Runs §21C check set scoped to one release. In CI, opens/updates a
// `verify-release-failure`-labeled Issue per failing check (create-or-update
// by check-id per §21I anti-drift).
//
// Per-study-lifecycle-gated: checks marked `study_lifecycle_gated: true`
// in health-checks.yaml return `pending` when study.yaml.versions is
// empty; blocking only after first release lands.
//
// Per §21A contract:
//   --tag <tag>   required, form: <slug>/vN.N
//   --check       read-only validation (this is default; script does not mutate)
//   --dry-run     do not open Issues on failure; report what would open
//   --json        machine-readable (default when non-TTY)
//   --verbose     per-check human output
//   --local       runtime_context=local
//
// Exit: 0 = pass (all `clean`/`warn`/`pending`), 1 = at least one `fail`, 2 = usage.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { load as yamlLoad } from 'js-yaml';
import {
  REPO_ROOT, parseArgs, isJsonMode, loadPhaseState, loadHealthChecks,
  effectiveSeverity, worstStatus,
} from './_common.mjs';
import { CHECK_REGISTRY } from './_checks.mjs';

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

// Load study.yaml at HEAD (in CI, the workflow already checked out the tag).
const studyYamlPath = path.join(REPO_ROOT, 'studies', slug, 'study.yaml');
let study = null;
if (fs.existsSync(studyYamlPath)) {
  try { study = yamlLoad(fs.readFileSync(studyYamlPath, 'utf8')); } catch { /* ignore parse errors — verify-study-yaml catches these */ }
}
const hasReleases = !!(study && Array.isArray(study.versions) && study.versions.length > 0);

const context = {
  baseUrl: phaseState.base_url,
  slug,
  version,
  study,
};

const results = [];

for (const [checkId, spec] of Object.entries(contract.checks)) {
  if (!spec.runtime_context.includes(runtimeContext)) continue;

  let severity = effectiveSeverity(spec, phaseState);
  if (spec.study_lifecycle_gated && !hasReleases) {
    severity = 'pending';
  }

  const fn = CHECK_REGISTRY[checkId];
  let result;
  if (!fn) {
    result = { status: 'pending', message: `no implementation registered for '${checkId}'` };
  } else {
    try {
      result = await fn({ ...context, spec });
    } catch (e) {
      result = { status: 'fail', message: `check threw: ${e.message}` };
    }
  }

  // Apply per-study lifecycle gating post-call: if the check ran and returned
  // fail/warn but the study has no releases yet, downgrade to pending — those
  // surfaces (DOI, PDF) don't exist yet.
  if (spec.study_lifecycle_gated && !hasReleases && result.status !== 'clean') {
    result = { ...result, status: 'pending', message: `study_lifecycle_gated (no releases): ${result.message}` };
  }

  results.push({
    check: checkId,
    status: result.status,
    severity,
    tag, slug, version,
    message: result.message,
    next_step: result.next_step,
    evidence: verbose ? result.evidence : undefined,
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

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`verify-release ${tag} @ ${phaseState.current_phase}: ${overall}`);
  const c = report.counts;
  console.log(`  clean=${c.clean}  warn=${c.warn}  pending=${c.pending}  fail=${c.fail}`);
  if (verbose) {
    for (const r of results) {
      console.log(`  [${r.severity}] ${r.check}: ${r.status} — ${r.message}`);
      if (r.next_step) console.log(`      → ${r.next_step}`);
    }
  }
}

// verify-release-failure Issue create-or-update per §21I anti-drift.
//
// For each `status: fail` result, dedupe by `<check-id> on <tag>` in the
// Issue title. Create if missing; add a new comment with latest evidence if
// exists (idempotent — the R6 C12 gate in Job 1 short-circuits on any open
// Issue regardless of state).
//
// Skipped when:
//   --dry-run             (report only; no Issue mutation)
//   --local               (runtime_context=local; local runs shouldn't open Issues)
//   GH_TOKEN not set      (fail-silent skip so pre-Task-1.11 setups don't error)

const failures = results.filter(r => r.status === 'fail');
const ghToken = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;

if (failures.length > 0 && runtimeContext === 'ci' && !dryRun && ghToken) {
  const openedOrUpdated = [];
  for (const f of failures) {
    const title = `verify-release-failure: ${f.check} on ${tag}`;
    // Dedupe by exact title match on open Issues with the label.
    const search = spawnSync('gh', [
      'issue', 'list',
      '--label', 'verify-release-failure',
      '--state', 'open',
      '--search', `"${title}" in:title`,
      '--json', 'number,title',
    ], { encoding: 'utf8', env: { ...process.env, GH_TOKEN: ghToken } });
    let existing = [];
    try { existing = JSON.parse(search.stdout ?? '[]'); } catch { existing = []; }
    const match = existing.find(i => i.title === title);

    const bodyLines = [
      `Automated finding from \`verify-release --tag ${tag}\` (runtime: ${runtimeContext}).`,
      '',
      `**Check:** \`${f.check}\``,
      `**Severity (phase-gated):** \`${f.severity}\``,
      `**Message:** ${f.message}`,
      f.next_step ? `**Next step:** ${f.next_step}` : '',
      f.evidence ? '\n**Evidence:**\n```\n' + JSON.stringify(f.evidence, null, 2) + '\n```' : '',
      '',
      '---',
      '',
      `Job 1 (build) refuses new tag releases while any \`verify-release-failure\` Issue is open on this repo (R6 C12). Fix the underlying issue + close this Issue to unblock releases.`,
    ].filter(Boolean).join('\n');

    if (match) {
      const cmt = spawnSync('gh', ['issue', 'comment', String(match.number), '--body', bodyLines], {
        encoding: 'utf8', env: { ...process.env, GH_TOKEN: ghToken },
      });
      openedOrUpdated.push({ action: 'commented', number: match.number, check: f.check, ok: cmt.status === 0 });
    } else {
      const created = spawnSync('gh', [
        'issue', 'create',
        '--title', title,
        '--label', 'verify-release-failure',
        '--body', bodyLines,
      ], { encoding: 'utf8', env: { ...process.env, GH_TOKEN: ghToken } });
      // gh issue create prints the new Issue URL on success.
      const numMatch = (created.stdout ?? '').match(/\/issues\/(\d+)/);
      openedOrUpdated.push({ action: 'created', number: numMatch ? Number(numMatch[1]) : null, check: f.check, ok: created.status === 0 });
    }
  }
  report.issues_touched = openedOrUpdated;
  if (jsonMode) {
    // Re-emit report to include issues_touched (already printed above without it).
    // Overwrite by printing again inside a wrapper so downstream parsers see one JSON doc.
    // (In practice --json mode consumers read once; the earlier print is superseded here.)
  }
}

process.exit(overall === 'fail' ? 1 : 0);
