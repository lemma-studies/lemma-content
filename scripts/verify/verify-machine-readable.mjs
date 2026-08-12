#!/usr/bin/env node
// scripts/verify/verify-machine-readable.mjs [--study <slug>]
//
// Validates the machine-readable surfaces per R6 B9 for each study:
//   - claims.jsonl — each line valid JSON; required fields (id, claim,
//     confidence in {high, moderate, contested, speculative},
//     supporting_evidence[], counter_positions[], version)
//   - xrefs.json — extracted-per-compile shape; required top-level fields
//   - rag.md — HTML-comment breadcrumbs present on every heading + section
//     boundary (`<!-- study: <slug> chapter: <NN> anchor: <slug> -->`)
//
// Per §21A contract:
//   --study <slug>  optional; else all studies
//   --check         alias of default
//   --json          machine-readable (default when non-TTY)
//   --verbose
//
// Exit: 0 = clean, 1 = violation, 2 = usage.
//
// PHASE 2b SCAFFOLD: skeleton returns "pending" for studies with no
// claims.jsonl / xrefs.json / .rag.md yet. Real per-field bodies land
// during Phase 3 execution against real WITP artifacts.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, isJsonMode, REPO_ROOT } from '../lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const targetSlug = args.values.get('study') ?? null;

const CONFIDENCE_VALUES = new Set(['high', 'moderate', 'contested', 'speculative']);
const CLAIM_REQUIRED = ['id', 'claim', 'confidence', 'supporting_evidence', 'counter_positions', 'version'];

const studiesRoot = path.join(REPO_ROOT, 'studies');
const violations = [];

function validateClaimsJsonl(slug) {
  const p = path.join(studiesRoot, slug, 'claims.jsonl');
  if (!fs.existsSync(p)) return; // skip; expected absent in Phase 2b
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
  const seenIds = new Set();
  for (const [i, line] of lines.entries()) {
    let claim;
    try { claim = JSON.parse(line); }
    catch (e) { violations.push({ slug, file: 'claims.jsonl', line: i + 1, error: `JSON parse: ${e.message}` }); continue; }
    for (const f of CLAIM_REQUIRED) {
      if (claim[f] === undefined) violations.push({ slug, file: 'claims.jsonl', line: i + 1, error: `missing ${f}` });
    }
    if (claim.confidence && !CONFIDENCE_VALUES.has(claim.confidence)) {
      violations.push({ slug, file: 'claims.jsonl', line: i + 1, error: `confidence=${claim.confidence} not in {${[...CONFIDENCE_VALUES].join('|')}}` });
    }
    if (claim.id) {
      if (seenIds.has(claim.id)) violations.push({ slug, file: 'claims.jsonl', line: i + 1, error: `duplicate id=${claim.id}` });
      seenIds.add(claim.id);
    }
    for (const f of ['supporting_evidence', 'counter_positions']) {
      if (claim[f] !== undefined && !Array.isArray(claim[f])) {
        violations.push({ slug, file: 'claims.jsonl', line: i + 1, error: `${f} must be array` });
      }
    }
  }
}

function validateXrefsJson(slug) {
  const p = path.join(studiesRoot, slug, 'xrefs.json');
  if (!fs.existsSync(p)) return;
  let xrefs;
  try { xrefs = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { violations.push({ slug, file: 'xrefs.json', error: `JSON parse: ${e.message}` }); return; }
  for (const f of ['study', 'version', 'extracted_at']) {
    if (xrefs[f] === undefined) violations.push({ slug, file: 'xrefs.json', error: `missing ${f}` });
  }
  if (xrefs.study && xrefs.study !== slug) {
    violations.push({ slug, file: 'xrefs.json', error: `xrefs.study=${xrefs.study} != directory ${slug}` });
  }
}

function validateRagMdBreadcrumbs(slug) {
  const versionsRoot = path.join(studiesRoot, slug, 'versions');
  if (!fs.existsSync(versionsRoot)) return;
  for (const v of fs.readdirSync(versionsRoot)) {
    const ragPath = path.join(versionsRoot, v, `${slug}-${v}.rag.md`);
    if (!fs.existsSync(ragPath)) continue;
    const content = fs.readFileSync(ragPath, 'utf8');
    // Every heading line should be preceded (within 3 lines) by an HTML-comment
    // breadcrumb like <!-- study: <slug> chapter: NN anchor: slug -->.
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/^#{1,6}\s/.test(lines[i])) continue;
      const preceding = lines.slice(Math.max(0, i - 3), i).join('\n');
      if (!/<!--\s*study:\s*[^\s]+\s+chapter:\s*[^\s]+\s+anchor:\s*[^\s]+\s*-->/.test(preceding)) {
        violations.push({ slug, file: `versions/${v}/${slug}-${v}.rag.md`, line: i + 1, error: 'heading missing preceding breadcrumb' });
      }
    }
  }
}

const slugs = targetSlug
  ? [targetSlug]
  : (fs.existsSync(studiesRoot)
      ? fs.readdirSync(studiesRoot).filter(s => fs.statSync(path.join(studiesRoot, s)).isDirectory())
      : []);

for (const s of slugs) {
  validateClaimsJsonl(s);
  validateXrefsJson(s);
  validateRagMdBreadcrumbs(s);
}

const report = {
  timestamp: new Date().toISOString(),
  status: violations.length === 0 ? 'clean' : 'fail',
  studies_checked: slugs,
  violations,
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`verify-machine-readable: ${report.status} (${slugs.length} studies, ${violations.length} violations)`);
  if (verbose || violations.length) {
    for (const v of violations) console.log(`  [${v.slug}] ${v.file}${v.line ? `:${v.line}` : ''} — ${v.error}`);
  }
}

process.exit(violations.length === 0 ? 0 : 1);
