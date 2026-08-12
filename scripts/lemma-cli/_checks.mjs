// Shared check implementations for health-check.mjs (corpus-wide) and
// verify-release.mjs (per-tag scoped). Each check function returns
//   { status: 'clean'|'warn'|'fail'|'pending', message: string,
//     evidence?: any, next_step?: string }
// Callers apply phase gating + study_lifecycle gating to translate returned
// status into effective severity per data/health-checks.yaml.
//
// Design principles:
//   - Network failure ≠ fail — return 'pending' or 'warn' with actionable
//     next_step. `fail` is reserved for outright integrity violations
//     (schema drift, test slug on main, CI-skip regression) that block
//     release.
//   - Every check has documented `phase_gated_by` behavior handled by the
//     caller; check functions themselves are phase-agnostic.
//   - Fast: 10s fetch timeout so a hung upstream doesn't hang CI.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { load as yamlLoad } from 'js-yaml';
import { REPO_ROOT } from './_common.mjs';

// ------------- HTTP helper -------------

const FETCH_TIMEOUT_MS = 10_000;

async function headOk(url, opts = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ac.signal, ...opts });
    return { ok: res.ok, status: res.status, headers: Object.fromEntries(res.headers) };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url, opts = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ac.signal, ...opts });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

// ------------- URL-200 checks -------------

export async function checkUrlReachable(url) {
  const r = await headOk(url);
  if (r.ok) return { status: 'clean', message: `${url} → ${r.status}` };
  if (r.error) return { status: 'warn', message: `${url}: ${r.error}`, next_step: 'confirm CF Pages project is deployed + reachable' };
  return { status: 'fail', message: `${url} → ${r.status}`, next_step: 'check CF Pages build logs' };
}

export async function checkStudyCanonical(baseUrl, slug) {
  return checkUrlReachable(`${baseUrl}/${slug}/`);
}

export async function checkPdfUrl(baseUrl, slug, version) {
  return checkUrlReachable(`${baseUrl}/studies/${slug}/versions/${version}/${slug}-${version}.pdf`);
}

export async function checkLlmsTxt(baseUrl) {
  return checkUrlReachable(`${baseUrl}/llms.txt`);
}

export async function checkLlmsFullTxt(baseUrl) {
  return checkUrlReachable(`${baseUrl}/llms-full.txt`);
}

// AI-bot UA fetch: assert every UA gets non-403/non-blocked response.
// During Phase 2b/3 (.pages.dev not behind zone WAF), all should be 200.
// Post-Phase-4 exit, this is the authoritative gate check.
export async function checkAiBotUAs(baseUrl, slug, uas) {
  const results = [];
  for (const ua of uas) {
    const r = await headOk(`${baseUrl}/${slug ?? ''}`, { headers: { 'User-Agent': `${ua}/1.0` } });
    results.push({ ua, status: r.status, ok: r.ok });
  }
  const blocked = results.filter(r => r.status === 403 || r.status === 429);
  if (blocked.length === 0) return { status: 'clean', message: `${results.length} UAs OK`, evidence: results };
  return {
    status: 'fail',
    message: `${blocked.length}/${results.length} UAs blocked`,
    evidence: blocked,
    next_step: 'check CF zone WAF + robots.txt + any UA-blocking middleware; ensure permissive per §7.6',
  };
}

// ------------- DOI resolution -------------

export async function checkDoiResolves(doi) {
  if (!doi) return { status: 'pending', message: 'no DOI assigned yet' };
  const r = await headOk(`https://doi.org/${doi}`);
  if (r.status === 200 || r.status === 302 || r.status === 303) {
    return { status: 'clean', message: `${doi} → ${r.status}` };
  }
  if (r.status === 404) return { status: 'fail', message: `${doi} → 404 (not registered)`, next_step: 'ensure Zenodo publish step 3d completed for this record' };
  return { status: 'warn', message: `${doi} → ${r.status || r.error}`, next_step: 'may be eventually consistent; recheck in 24h' };
}

// ------------- Sitemap -------------

export async function checkSitemapExcludesVersions(baseUrl) {
  const r = await getText(`${baseUrl}/sitemap-index.xml`);
  if (!r.ok) return { status: 'warn', message: `sitemap-index.xml unreachable: ${r.status || r.error}` };
  // Follow to child sitemap urls, aggregate.
  const childUrls = [...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const allUrls = [];
  for (const child of childUrls) {
    const cr = await getText(child);
    if (!cr.ok) continue;
    for (const m of cr.text.matchAll(/<loc>([^<]+)<\/loc>/g)) allUrls.push(m[1]);
  }
  const violations = allUrls.filter(u => u.includes('/versions/'));
  if (violations.length === 0) return { status: 'clean', message: `sitemap OK; 0 /versions/ URLs in ${allUrls.length} entries` };
  return {
    status: 'fail',
    message: `sitemap contains ${violations.length} /versions/ URLs (should be excluded)`,
    evidence: violations.slice(0, 5),
    next_step: 'check site/astro.config.mjs sitemap filter — must skip /versions/**',
  };
}

// ------------- Static file / repo-state checks -------------

export function checkHeartbeatFresh() {
  const p = path.join(REPO_ROOT, 'data', 'last-heartbeat.txt');
  if (!fs.existsSync(p)) {
    return { status: 'warn', message: 'data/last-heartbeat.txt missing (keep-alive workflow has never run)', next_step: 'trigger keep-alive.yml manually via gh workflow run' };
  }
  const timestamp = fs.readFileSync(p, 'utf8').trim();
  const ts = Date.parse(timestamp);
  if (isNaN(ts)) return { status: 'fail', message: `data/last-heartbeat.txt content unparseable: ${timestamp}` };
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  if (ageDays > 14) {
    return { status: 'fail', message: `heartbeat ${ageDays.toFixed(1)}d old > 14d`, next_step: 'investigate keep-alive.yml — cron may be disabled per gh-cron-auto-disabled failure mode' };
  }
  return { status: 'clean', message: `heartbeat ${ageDays.toFixed(1)}d old` };
}

export function checkNoTestSlugsOnMain() {
  const studiesRoot = path.join(REPO_ROOT, 'studies');
  if (!fs.existsSync(studiesRoot)) return { status: 'clean', message: 'studies/ empty' };
  const slugs = fs.readdirSync(studiesRoot);
  const testish = slugs.filter(s => /^(test-|synthetic-|__|_syn|_test)/i.test(s));
  if (testish.length === 0) return { status: 'clean', message: `${slugs.length} studies; no test-slug patterns` };
  return {
    status: 'fail',
    message: `test-slug on main: ${testish.join(', ')}`,
    next_step: 'remove test slug and re-tag; test slugs violate no_test_slugs_on_main blocking check',
  };
}

export function checkNoSkipCiInJob2d(lookbackCommits = 50) {
  // Job 2d commits match "release(pdf): <slug>/<version> [autogen]".
  // Grep for any of these that also contain the banned skip-ci phrases.
  const gitLog = spawnSync('git', ['log', `-${lookbackCommits}`, '--format=%H %s'], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  if (gitLog.status !== 0) return { status: 'warn', message: `git log failed: ${gitLog.stderr}` };
  const lines = gitLog.stdout.split('\n').filter(Boolean);
  const releaseLines = lines.filter(l => /release\(pdf\):.*\[autogen\]/i.test(l));
  const bad = releaseLines.filter(l => /\[skip ci\]|\[ci skip\]|\[cf-pages-skip\]|no ci/i.test(l));
  if (bad.length === 0) return { status: 'clean', message: `${releaseLines.length} Job 2d release commits scanned; no skip-ci phrases` };
  return {
    status: 'fail',
    message: `${bad.length} Job 2d commit(s) contain skip-ci phrase — CF Pages PDF deploy suppressed`,
    evidence: bad,
    next_step: 'revert offending commits + audit the on-tag-release.yml Job 2d guard',
  };
}

// ------------- Schema checks (delegate to verify/*.mjs) -------------

function runNodeScript(scriptRelPath, args) {
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, scriptRelPath), ...args, '--json'], {
    encoding: 'utf8',
  });
  try {
    return { code: r.status ?? 0, out: JSON.parse(r.stdout) };
  } catch {
    return { code: r.status ?? 1, out: null, raw: r.stdout, err: r.stderr };
  }
}

export function checkClaimsJsonlSchema(slug = null) {
  const args = slug ? ['--study', slug] : [];
  const r = runNodeScript('scripts/verify/verify-machine-readable.mjs', args);
  if (r.code === 0) return { status: 'clean', message: 'claims.jsonl + xrefs.json + rag.md schemas OK' };
  return { status: 'fail', message: `verify-machine-readable violations: ${r.out?.violations?.length ?? '?'}`, evidence: r.out?.violations?.slice(0, 3) };
}

export function checkXrefsJsonSchema(slug = null) {
  // verify-machine-readable covers both; call once and short-circuit for the caller.
  return checkClaimsJsonlSchema(slug);
}

export function checkRagBreadcrumbsPresent(slug = null) {
  return checkClaimsJsonlSchema(slug);
}

export function checkStudyYamlSchema(slug = null) {
  const args = slug ? ['--study', slug] : [];
  const r = runNodeScript('scripts/verify/verify-study-yaml.mjs', args);
  if (r.code === 0) return { status: 'clean', message: 'study.yaml schema OK' };
  return { status: 'fail', message: `verify-study-yaml violations: ${r.out?.violations?.length ?? '?'}`, evidence: r.out?.violations?.slice(0, 3) };
}

export function checkAnchorsUnique(slug = null) {
  const args = slug ? ['--study', slug] : [];
  const r = runNodeScript('scripts/verify/verify-anchors.mjs', args);
  if (r.code === 0) return { status: 'clean', message: 'anchor uniqueness OK' };
  return { status: 'fail', message: `verify-anchors collisions: ${r.out?.collisions?.length ?? '?'}`, evidence: r.out?.collisions?.slice(0, 3) };
}

// ------------- Design-version drift -------------

export function checkDesignVersionHeaderMatches() {
  const claudeMdPath = path.join(REPO_ROOT, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath)) return { status: 'warn', message: 'CLAUDE.md missing' };
  const claudeMd = fs.readFileSync(claudeMdPath, 'utf8');
  const claudeVer = claudeMd.match(/^design-version:\s*(\S+)\s*$/m)?.[1];
  if (!claudeVer) return { status: 'warn', message: 'CLAUDE.md has no design-version frontmatter' };

  // Find current design doc + parse its own version marker (search for the
  // latest 2026-*-lemma-content-architecture-design.md).
  const specsDir = path.join(REPO_ROOT, 'docs', 'superpowers', 'specs');
  if (!fs.existsSync(specsDir)) return { status: 'warn', message: 'docs/superpowers/specs/ missing (design doc not migrated to this repo yet)' };
  const designs = fs.readdirSync(specsDir).filter(f => /-lemma-content-architecture-design\.md$/.test(f)).sort();
  if (designs.length === 0) return { status: 'warn', message: 'no lemma-content-architecture-design.md found' };
  const designPath = path.join(specsDir, designs.at(-1));
  const designMd = fs.readFileSync(designPath, 'utf8');
  // Design version markers typically appear as "**Design v7.1**" or "v7.1 (dated 2026-XX-XX)" or in a version line.
  const designVer = designMd.match(/^\*\*Design (v[\d.]+)\*\*/m)?.[1]
                 ?? designMd.match(/^# .*?(v[\d.]+)/m)?.[1]
                 ?? designMd.match(/^Version:\s*(v[\d.]+)/m)?.[1];
  if (!designVer) return { status: 'warn', message: `could not extract design version from ${path.basename(designPath)}` };

  if (claudeVer === designVer) return { status: 'clean', message: `CLAUDE.md=${claudeVer} matches design=${designVer}` };
  return {
    status: 'warn',
    message: `CLAUDE.md=${claudeVer} != design=${designVer}`,
    next_step: 'design-doc-claude-md-header-auto-sync (auto) or design-doc-claude-md-content-drift (propose) per §21F',
  };
}

// ------------- Base-URL consistency (Phase 4 exit check) -------------

export function checkBaseUrlConsistency() {
  // Compares data/phase-state.yaml base_url against site canonical <link>
  // written by Head.astro. In Phase 2b/3 site is not built here; check the
  // committed astro.config.mjs `site:` value instead.
  const phaseYaml = yamlLoad(fs.readFileSync(path.join(REPO_ROOT, 'data', 'phase-state.yaml'), 'utf8'));
  const astroConfigPath = path.join(REPO_ROOT, 'site', 'astro.config.mjs');
  if (!fs.existsSync(astroConfigPath)) return { status: 'warn', message: 'site/astro.config.mjs missing' };
  const cfg = fs.readFileSync(astroConfigPath, 'utf8');
  const siteMatch = cfg.match(/site:\s*['"]([^'"]+)['"]/);
  if (!siteMatch) return { status: 'warn', message: 'astro.config.mjs has no `site:` value' };
  const canonical = siteMatch[1];
  // The design says canonical is always lemma.gig8.com even during Phase 2b
  // (so pre-baked HTML references lemma.gig8.com; Zenodo etc. reference
  // phase-state.base_url which points at .pages.dev pre-cutover). This
  // check verifies phase-state.base_url IS the running deploy target:
  // - Phase 2b/3: base_url should be .pages.dev
  // - Phase 4 exit + steady: base_url should be canonical (lemma.gig8.com)
  const phaseExpectations = {
    'phase-1': null, 'phase-2a': null, 'phase-2b': 'https://lemma-content.pages.dev',
    'phase-3-pilot': 'https://lemma-content.pages.dev',
    'phase-3-complete': 'https://lemma-content.pages.dev',
    'phase-4-bulk': 'https://lemma-content.pages.dev',
    'phase-4-exit': 'https://lemma.gig8.com',
    'steady-state': 'https://lemma.gig8.com',
  };
  const expected = phaseExpectations[phaseYaml.current_phase];
  if (!expected) return { status: 'pending', message: `no base_url expectation for phase ${phaseYaml.current_phase}` };
  if (phaseYaml.base_url === expected) return { status: 'clean', message: `base_url=${phaseYaml.base_url} matches phase ${phaseYaml.current_phase}` };
  return {
    status: 'fail',
    message: `phase-state.base_url=${phaseYaml.base_url} but phase ${phaseYaml.current_phase} expects ${expected}`,
    next_step: 'phase4-exit-partial: scripts/phase4-exit.mjs may have failed mid-flight',
  };
}

// ------------- Token validity (best-effort, does not surface secret values) -------------

export async function checkZenodoTokenValid() {
  const token = process.env.ZENODO_ACCESS_TOKEN;
  if (!token) return { status: 'pending', message: 'ZENODO_ACCESS_TOKEN not set' };
  const host = process.env.ZENODO_HOST ?? 'https://zenodo.org';
  const r = await headOk(`${host}/api/deposit/depositions?size=1`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 200 || r.status === 401) {
    return r.status === 200
      ? { status: 'clean', message: 'zenodo token accepted' }
      : { status: 'fail', message: 'zenodo token rejected (401)', next_step: 'regenerate PAT at zenodo.org/account/settings/applications; rotate + log to rotation-log.md' };
  }
  return { status: 'warn', message: `zenodo API unreachable: ${r.status || r.error}` };
}

export async function checkHfTokenValid() {
  const token = process.env.HF_TOKEN;
  if (!token) return { status: 'pending', message: 'HF_TOKEN not set' };
  const r = await headOk('https://huggingface.co/api/whoami-v2', { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 200) return { status: 'clean', message: 'hf token accepted' };
  if (r.status === 401) return { status: 'fail', message: 'hf token rejected (401)', next_step: 'regenerate token (WRITE scope) at huggingface.co/settings/tokens' };
  return { status: 'warn', message: `hf API unreachable: ${r.status || r.error}` };
}

// ------------- Check dispatcher -------------
// Map from check-id (matches data/health-checks.yaml keys) to implementation.
// Some checks accept optional (baseUrl, slug, version); dispatcher passes
// what's available. Callers filter to checks relevant to their scope.

export const CHECK_REGISTRY = {
  // URL 200
  base_url_reachable: async ({ baseUrl }) => checkUrlReachable(baseUrl),
  study_canonical_url: async ({ baseUrl, slug }) => slug ? checkStudyCanonical(baseUrl, slug) : { status: 'pending', message: 'no slug in scope' },
  pdf_url_200: async ({ baseUrl, slug, version }) => (slug && version) ? checkPdfUrl(baseUrl, slug, version) : { status: 'pending', message: 'no slug/version in scope' },
  llms_txt_200: async ({ baseUrl }) => checkLlmsTxt(baseUrl),
  llms_full_txt_200: async ({ baseUrl }) => checkLlmsFullTxt(baseUrl),
  ai_bot_ua_synthetic: async ({ baseUrl, slug, spec }) => checkAiBotUAs(baseUrl, slug, spec?.uas ?? []),
  sitemap_excludes_versions: async ({ baseUrl }) => checkSitemapExcludesVersions(baseUrl),

  // DOI
  concept_doi_resolves: async ({ study }) => checkDoiResolves(study?.concept_doi),
  version_doi_resolves: async ({ study, version }) => {
    const v = (study?.versions ?? []).find(v => v.version === version);
    return checkDoiResolves(v?.version_doi);
  },

  // Static / repo-state
  heartbeat_fresh: async () => checkHeartbeatFresh(),
  no_test_slugs_on_main: async () => checkNoTestSlugsOnMain(),
  no_skip_ci_in_job_2d: async () => checkNoSkipCiInJob2d(),

  // Schema (delegate)
  claims_jsonl_schema: async ({ slug }) => checkClaimsJsonlSchema(slug),
  xrefs_json_schema: async ({ slug }) => checkXrefsJsonSchema(slug),
  rag_breadcrumbs_present: async ({ slug }) => checkRagBreadcrumbsPresent(slug),

  // Design drift
  design_version_header_matches: async () => checkDesignVersionHeaderMatches(),

  // Base-URL consistency
  base_url_consistency: async () => checkBaseUrlConsistency(),

  // Tokens
  zenodo_token_valid: async () => checkZenodoTokenValid(),
  hf_token_valid: async () => checkHfTokenValid(),

  // Not yet implemented (pending returns keep contract honest):
  scarlight_reindexed: async () => ({ status: 'pending', message: 'not yet implemented — Scarlight LAN query TBD' }),
  swh_archived: async () => ({ status: 'pending', message: 'not yet implemented — SWH origin visit query TBD' }),
  hf_dataset_current: async () => ({ status: 'pending', message: 'not yet implemented — HF dataset row lookup TBD' }),
  retention_chore_current: async () => ({ status: 'pending', message: 'not yet implemented — workroom chore-log query TBD' }),
  pubpub_hash_match: async () => ({ status: 'pending', message: 'Phase 6+ (PubPub cross-post)' }),
  mailflow: async () => ({ status: 'pending', message: 'not yet implemented — Task 2b.4 email intake pipeline TBD' }),
};
