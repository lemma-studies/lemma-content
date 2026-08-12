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
