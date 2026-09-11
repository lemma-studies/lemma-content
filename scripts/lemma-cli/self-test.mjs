#!/usr/bin/env node
// scripts/lemma-cli/self-test.mjs
//
// Sanity-checks the lemma-cli scaffold itself. Not a substitute for verify-release
// or health-check — this exercises the contract layer (arg parsing, YAML load,
// data-file shape) so a broken scaffold surfaces before it silently returns
// misleading `clean` from downstream scripts.
//
// Per §21A contract:
//   --json     machine-readable
//   --verbose  per-assertion output
//
// Exit: 0 = all assertions pass, 1 = at least one fails, 2 = usage.

import fs from 'node:fs';
import path from 'node:path';
// (js-yaml imported transitively via _common.mjs; no direct import needed here.)
import {
  REPO_ROOT, parseArgs, isJsonMode,
  loadPhaseState, loadHealthChecks, loadFailureModes,
} from './_common.mjs';
import {
  licenceInfo, loadBibleSources, upgradeCandidates,
  editionLicenceViolations, rightsTierPublishable,
} from './_licence.mjs';
import { CHECK_REGISTRY } from './_checks.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');

const assertions = [];

function assert(name, cond, detail = '') {
  assertions.push({ name, passed: !!cond, detail });
}

// 1. phase-state.yaml loads and has required keys.
let phase = null;
try {
  phase = loadPhaseState();
  assert('phase-state.yaml loads', true);
  assert('phase-state.current_phase is a known value',
    ['phase-1','phase-2a','phase-2b','phase-3-pilot','phase-3-complete','phase-4-bulk','phase-4-exit','steady-state'].includes(phase.current_phase),
    `got: ${phase.current_phase}`);
  assert('phase-state.release_publish_unlocked is boolean',
    typeof phase.release_publish_unlocked === 'boolean');
  assert('phase-state.base_url is https URL',
    typeof phase.base_url === 'string' && phase.base_url.startsWith('https://'));
} catch (e) {
  assert('phase-state.yaml loads', false, e.message);
}

// 2. health-checks.yaml loads and every check has runtime_context + severity.
try {
  const hc = loadHealthChecks();
  assert('health-checks.yaml loads', true);
  const badChecks = [];
  for (const [id, spec] of Object.entries(hc.checks)) {
    if (!spec.severity || !['blocking','warn','pending'].includes(spec.severity)) {
      badChecks.push(`${id}: severity missing or invalid`);
    }
    if (!Array.isArray(spec.runtime_context) || spec.runtime_context.length === 0) {
      badChecks.push(`${id}: runtime_context missing`);
    }
  }
  assert('every check has severity + runtime_context', badChecks.length === 0, badChecks.join('; '));
} catch (e) {
  assert('health-checks.yaml loads', false, e.message);
}

// 3. failure-modes.yaml loads and every mode has autonomy + required fields.
try {
  const fm = loadFailureModes();
  assert('failure-modes.yaml loads', true);
  const badModes = [];
  const requiredFields = ['id','detection','recovery','autonomy','auto_detectable','introduced_in','last_verified','owner'];
  for (const mode of fm.modes) {
    for (const f of requiredFields) {
      if (mode[f] === undefined) badModes.push(`${mode.id ?? '(no id)'}: missing ${f}`);
    }
    if (mode.autonomy && !['auto','propose','human-gate'].includes(mode.autonomy)) {
      badModes.push(`${mode.id}: invalid autonomy=${mode.autonomy}`);
    }
    if (mode.autonomy === 'auto') {
      if (!Number.isInteger(mode.max_auto_attempts)) badModes.push(`${mode.id}: auto mode needs max_auto_attempts`);
      if (!Number.isInteger(mode.auto_cooldown_hours)) badModes.push(`${mode.id}: auto mode needs auto_cooldown_hours`);
    }
  }
  assert('every failure mode has required fields + valid autonomy', badModes.length === 0, badModes.join('; '));
} catch (e) {
  assert('failure-modes.yaml loads', false, e.message);
}

// 4. cross-check: every health_check_hook referenced by failure-modes exists in health-checks (when non-null).
try {
  const hc = loadHealthChecks();
  const fm = loadFailureModes();
  const knownChecks = new Set(Object.keys(hc.checks));
  const missing = [];
  for (const mode of fm.modes) {
    if (mode.health_check_hook && mode.health_check_hook.startsWith('checks.')) {
      const checkId = mode.health_check_hook.slice('checks.'.length);
      if (!knownChecks.has(checkId)) missing.push(`${mode.id} → checks.${checkId}`);
    }
  }
  assert('failure-mode health_check_hooks resolve to real checks', missing.length === 0, missing.join('; '));
} catch (e) {
  assert('cross-check failure-modes ↔ health-checks', false, e.message);
}

// 5. Edition licence (ADR 2026-08-12 §2.4): a study anchored to a CC-BY-SA
//    Bible must carry that licence and tier, and nothing publishes under a
//    CC BY default.
try {
  const candidates = upgradeCandidates(loadBibleSources());
  const nav = candidates.get('nav-biblica');
  assert('bible-sources.yaml: nav-biblica carries edition_license cc-by-sa-4.0',
    nav?.edition_license === 'cc-by-sa-4.0', `got: ${nav?.edition_license}`);

  const study = (license, anchor, rights_tier) =>
    ({ license, rights_tier, translation_of: { scripture_anchor: anchor } });
  const v = (s) => editionLicenceViolations(s, candidates);

  assert('NAV-anchored study licensed cc-by-4.0 is rejected',
    v(study('cc-by-4.0', 'nav-biblica', 'private_pending_grant')).some(e => e.includes('must be cc-by-sa-4.0')));
  assert('NAV-anchored study at full_public is rejected while the candidate is held',
    v(study('cc-by-sa-4.0', 'nav-biblica', 'full_public')).some(e => e.includes('private_pending_grant')));
  const heldOk = v(study('cc-by-sa-4.0', 'nav-biblica', 'private_pending_grant'));
  assert('NAV-anchored study licensed cc-by-sa-4.0 and held private is clean',
    heldOk.length === 0, heldOk.join('; '));
  assert('a candidate inside a compound anchor is still caught',
    v(study('cc-by-4.0', 'sefaria-masoretic + heblb-biblica', 'private_pending_grant')).length > 0);
  const pdOk = v(study('cc-by-4.0', 'van-dyck-svd-1865', undefined));
  assert('PD-anchored cc-by-4.0 study is clean', pdOk.length === 0, pdOk.join('; '));
  assert('cc-by-sa-4.0 without an open-licence anchor is rejected',
    v(study('cc-by-sa-4.0', 'van-dyck-svd-1865', undefined)).length === 1);

  assert('licenceInfo keeps the published CC BY chunk-header text',
    licenceInfo('CC-BY-4.0').name === 'CC BY 4.0'
      && licenceInfo('cc-by-4.0').url === 'https://creativecommons.org/licenses/by/4.0/');
  let threw = false;
  try { licenceInfo(undefined); } catch { threw = true; }
  assert('licenceInfo refuses a missing licence (no CC BY default)', threw);

  assert('rights_tier_publishable fails private_pending_grant, passes full_public',
    rightsTierPublishable({ rights_tier: 'private_pending_grant' }).status === 'fail'
      && rightsTierPublishable({ rights_tier: 'full_public' }).status === 'clean');
  const hc = loadHealthChecks();
  const wired = ['study_yaml_schema', 'rights_tier_publishable']
    .filter(id => !hc.checks[id] || !CHECK_REGISTRY[id]);
  assert('study_yaml_schema + rights_tier_publishable are in health-checks.yaml and CHECK_REGISTRY',
    wired.length === 0, wired.join(', '));
} catch (e) {
  assert('edition licence rule', false, e.message);
}

const allPassed = assertions.every(a => a.passed);
const report = {
  timestamp: new Date().toISOString(),
  passed: allPassed,
  count: assertions.length,
  failures: assertions.filter(a => !a.passed).length,
  assertions,
};

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`self-test: ${allPassed ? 'PASS' : 'FAIL'} (${report.count - report.failures}/${report.count})`);
  if (verbose || !allPassed) {
    for (const a of assertions) {
      const mark = a.passed ? '✓' : '✗';
      console.log(`  ${mark} ${a.name}${a.detail ? ` — ${a.detail}` : ''}`);
    }
  }
}

process.exit(allPassed ? 0 : 1);
