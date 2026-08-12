#!/usr/bin/env node
// scripts/verify/verify-study-yaml.mjs [--study <slug>]
//
// Validates studies/<slug>/study.yaml against the schema in §7.1 (author,
// slug, current_version, versions[], concept_doi, tags).
//
// Uses js-yaml DEFAULT_SCHEMA (safe per plan Global Constraint line 30 —
// js-yaml v4+/v5 DEFAULT_SCHEMA does not include unsafe types like Python
// pyyaml's Loader does).
//
// Per §21A contract:
//   --study <slug>  optional; else all studies
//   --check         alias of default
//   --json          machine-readable (default when non-TTY)
//   --verbose
//
// Exit: 0 = all valid, 1 = at least one violation, 2 = usage.

import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { parseArgs, isJsonMode, REPO_ROOT } from '../lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const targetSlug = args.values.get('study') ?? null;

const studiesRoot = path.join(REPO_ROOT, 'studies');
const violations = [];

// Minimum schema — extended when concrete fields firm up in Phase 3.
// (Zod / JSON Schema library dep deferred until it's actually load-bearing.)
const REQUIRED_TOP = ['title', 'slug', 'author', 'license', 'current_version', 'versions'];
const REQUIRED_VERSION = ['version', 'date', 'tag'];

// Optional top-level fields — presence is fine, wrong shape is a violation.
// - `type` (default 'study'): 'study' | 'article' | 'book' | 'translation'.
//   'translation' is a subtype of 'book' per ADR-018 (2026-08-12); reserved
//   in Phase 2b so Phase 3.5 translation studies validate cleanly.
// - `language` (default 'en'): BCP-47 tag ('en', 'he', 'ar', 'fa',
//   'zh-Hans', 'zh-Hant'). Used by build-bilingual + scripture-per-language.
// - `translation_of` (translation studies only): either a study slug (string
//   form — points to a sibling `<work>-en` modern-English edition) OR an
//   object per ADR §3.1: {source_slug or external: {citation, url, license,
//   eebo_tcp_id?}, source_edition, source_license, translation_method,
//   scripture_anchor}. The external-object form is used by the `-en` edition
//   itself, which points to an EEBO-TCP / CCEL / Gutenberg source outside
//   the repo. Independent DOI + versioning — cross-reference, not inheritance.
// - `sibling_editions`: array of slugs, other language editions of the same
//   work. Populated symmetrically as new editions land.
// - `rights_tier` (default 'full_public'): 'full_public' | 'pd_anchor_only' |
//   'private_pending_grant'. Reflects whether the study can be publicly
//   rendered given the license posture of all anchor layers it uses
//   (scripture Bible sources, etc.). verify-release blocks publish when
//   rights_tier == 'private_pending_grant'. See ADR-018 §7.3 upgrade_candidate
//   discussion; the tier is a study-level rollup of all anchor-layer choices.
const OPTIONAL_TOP_TYPES = {
  type: ['study', 'article', 'book', 'translation'],
  rights_tier: ['full_public', 'pd_anchor_only', 'private_pending_grant'],
};
const BCP47_RE = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|-[0-9]{3})?$/;

function validateStudyYaml(slug) {
  const p = path.join(studiesRoot, slug, 'study.yaml');
  if (!fs.existsSync(p)) return; // stub studies (Phase 2b) have no study.yaml yet
  let study;
  try {
    study = yamlLoad(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    violations.push({ slug, error: `YAML parse: ${e.message}` });
    return;
  }
  for (const f of REQUIRED_TOP) {
    if (study[f] === undefined) violations.push({ slug, error: `missing required top-level: ${f}` });
  }
  if (study.slug && study.slug !== slug) {
    violations.push({ slug, error: `study.yaml.slug=${study.slug} does not match directory name` });
  }
  if (Array.isArray(study.versions)) {
    for (const [i, v] of study.versions.entries()) {
      for (const f of REQUIRED_VERSION) {
        if (v[f] === undefined) violations.push({ slug, error: `versions[${i}] missing ${f}` });
      }
      if (v.tag && v.tag !== `${slug}/${v.version}`) {
        violations.push({ slug, error: `versions[${i}].tag=${v.tag} != ${slug}/${v.version}` });
      }
    }
  }
  if (study.current_version && Array.isArray(study.versions)) {
    const known = study.versions.map(v => v.version);
    if (!known.includes(study.current_version)) {
      violations.push({ slug, error: `current_version=${study.current_version} not in versions[]` });
    }
  }

  // Optional-field shape checks (presence is optional; malformed value is a violation).
  if (study.type !== undefined && !OPTIONAL_TOP_TYPES.type.includes(study.type)) {
    violations.push({ slug, error: `type=${study.type} not in {${OPTIONAL_TOP_TYPES.type.join('|')}}` });
  }
  if (study.language !== undefined) {
    if (typeof study.language !== 'string' || !BCP47_RE.test(study.language)) {
      violations.push({ slug, error: `language=${study.language} not a BCP-47 tag (e.g. en, he, ar, fa, zh-Hans, zh-Hant)` });
    }
  }
  if (study.translation_of !== undefined) {
    const to = study.translation_of;
    // Accept either: string (sibling-slug form) OR object (ADR §3.1 form with source_slug|external + metadata).
    if (typeof to === 'string') {
      if (!/^[a-z0-9-]+$/.test(to)) {
        violations.push({ slug, error: `translation_of (string form) must be a study slug (lowercase kebab-case)` });
      }
    } else if (typeof to === 'object' && to !== null && !Array.isArray(to)) {
      // Object form: exactly one of source_slug or external must be present
      const hasSlug = typeof to.source_slug === 'string';
      const hasExternal = typeof to.external === 'object' && to.external !== null;
      if (hasSlug === hasExternal) {  // both true or both false
        violations.push({ slug, error: `translation_of (object form) must set exactly one of source_slug or external` });
      }
      if (hasSlug && !/^[a-z0-9-]+$/.test(to.source_slug)) {
        violations.push({ slug, error: `translation_of.source_slug must be a study slug (lowercase kebab-case)` });
      }
      if (hasExternal) {
        if (typeof to.external.citation !== 'string') violations.push({ slug, error: `translation_of.external must have a string citation` });
        if (typeof to.external.url !== 'string') violations.push({ slug, error: `translation_of.external must have a url` });
        if (typeof to.external.license !== 'string') violations.push({ slug, error: `translation_of.external must have a license (e.g. PD, CC0, CC-BY-4.0)` });
      }
    } else {
      violations.push({ slug, error: `translation_of must be a string (sibling slug) or object (per ADR §3.1)` });
    }
    if (study.type !== 'translation') {
      violations.push({ slug, error: `translation_of set but type != translation (expected type: translation for cross-edition source pointer)` });
    }
  }
  if (study.sibling_editions !== undefined) {
    // Accept string-slug array OR array of {language, slug} objects per ADR §3.1.
    const arr = study.sibling_editions;
    if (!Array.isArray(arr)) {
      violations.push({ slug, error: `sibling_editions must be an array` });
    } else {
      for (const [i, entry] of arr.entries()) {
        if (typeof entry === 'string') {
          if (!/^[a-z0-9-]+$/.test(entry)) {
            violations.push({ slug, error: `sibling_editions[${i}] must be a study slug (lowercase kebab-case)` });
          }
          if (entry === slug) violations.push({ slug, error: `sibling_editions[${i}] must not be self (${slug})` });
        } else if (typeof entry === 'object' && entry !== null) {
          if (typeof entry.slug !== 'string' || !/^[a-z0-9-]+$/.test(entry.slug)) {
            violations.push({ slug, error: `sibling_editions[${i}].slug must be a study slug (lowercase kebab-case)` });
          }
          if (typeof entry.language !== 'string' || !BCP47_RE.test(entry.language)) {
            violations.push({ slug, error: `sibling_editions[${i}].language must be a BCP-47 tag` });
          }
          if (entry.slug === slug) violations.push({ slug, error: `sibling_editions[${i}] must not be self (${slug})` });
        } else {
          violations.push({ slug, error: `sibling_editions[${i}] must be a slug string or {language, slug} object` });
        }
      }
    }
  }
  if (study.rights_tier !== undefined && !OPTIONAL_TOP_TYPES.rights_tier.includes(study.rights_tier)) {
    violations.push({ slug, error: `rights_tier=${study.rights_tier} not in {${OPTIONAL_TOP_TYPES.rights_tier.join('|')}}` });
  }
}

const slugs = targetSlug
  ? [targetSlug]
  : (fs.existsSync(studiesRoot)
      ? fs.readdirSync(studiesRoot).filter(s => fs.statSync(path.join(studiesRoot, s)).isDirectory())
      : []);

for (const s of slugs) validateStudyYaml(s);

const report = {
  timestamp: new Date().toISOString(),
  status: violations.length === 0 ? 'clean' : 'fail',
  studies_checked: slugs,
  violations,
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`verify-study-yaml: ${report.status} (${slugs.length} studies, ${violations.length} violations)`);
  if (verbose || violations.length) {
    for (const v of violations) console.log(`  [${v.slug}] ${v.error}`);
  }
}

process.exit(violations.length === 0 ? 0 : 1);
