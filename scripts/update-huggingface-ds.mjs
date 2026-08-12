#!/usr/bin/env node
// scripts/update-huggingface-ds.mjs --study <slug> --version vN.N
//
// Job 5b (HuggingFace dataset push) per §6.3. Phase 3+ only. Uploads a new
// row (or updates existing) for this study/version to the
// `lemma-studies/lemma-theological-studies` HF Dataset.
//
// Row schema per HF-hosted dataset config:
//   { slug, version, title, author, license, concept_doi, version_doi,
//     tag, published_date, canonical_url, text (composite markdown),
//     rag_text (breadcrumbed variant), pdf_url, chapters_count,
//     claims_count, tags[] }
//
// Idempotent on (slug, version) key — repeat pushes overwrite the row.
//
// Per §21A contract:
//   --study <slug>       required
//   --version vN.N       required
//   --assets-dir <path>  where composite/rag/PDF live (default: cwd)
//   --check              validate HF token + dataset access, no push
//   --dry-run            print row payload; no push
//   --json               machine-readable (default when non-TTY)
//   --verbose
//
// Env: HF_TOKEN (WRITE scope)
// Exit: 0 = pushed (or already-current), 1 = fail, 2 = usage.
//
// PHASE 2b SCAFFOLD: real HF hub push TODO for Task 3.6.

import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { parseArgs, isJsonMode, REPO_ROOT, loadPhaseState } from './lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const slug = args.values.get('study');
const version = args.values.get('version');
const assetsDir = args.values.get('assets-dir') ?? process.cwd();
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const check = args.flags.has('check');
const dryRun = args.flags.has('dry-run');

if (!slug || !version) {
  console.error('usage: update-huggingface-ds --study <slug> --version vN.N [--assets-dir <path>] [--check|--dry-run] [--json]');
  process.exit(2);
}

const token = process.env.HF_TOKEN;
if (!token) {
  const msg = 'HF_TOKEN not set';
  if (jsonMode) console.log(JSON.stringify({ status: 'skipped', reason: msg }));
  else console.error(msg);
  process.exit(check ? 1 : 0);
}

const studyYamlPath = path.join(REPO_ROOT, 'studies', slug, 'study.yaml');
if (!fs.existsSync(studyYamlPath)) {
  const msg = `study.yaml missing at ${studyYamlPath}`;
  if (jsonMode) console.log(JSON.stringify({ status: 'fail', reason: msg }));
  else console.error(msg);
  process.exit(1);
}
const study = yamlLoad(fs.readFileSync(studyYamlPath, 'utf8'));
const versionEntry = (study.versions ?? []).find(v => v.version === version);
if (!versionEntry) {
  const msg = `version ${version} not in study.yaml.versions[]`;
  if (jsonMode) console.log(JSON.stringify({ status: 'fail', reason: msg }));
  else console.error(msg);
  process.exit(1);
}

const phase = loadPhaseState();

// Build the row payload (deferred read of composite/rag body until real push
// to avoid slurping MB into memory unnecessarily during --check).
const composite = path.join(assetsDir, `${slug}-${version}.md`);
const rag       = path.join(assetsDir, `${slug}-${version}.rag.md`);

const row = {
  slug,
  version,
  title: study.title,
  author: study.author,
  license: study.license ?? 'CC-BY-4.0',
  language: study.language ?? 'en',
  type: study.type ?? 'study',
  concept_doi: study.concept_doi,
  version_doi: versionEntry.version_doi,
  tag: versionEntry.tag,
  published_date: versionEntry.date,
  canonical_url: `${phase.base_url}/${slug}/`,
  version_url: `${phase.base_url}/${slug}/versions/${version}/`,
  pdf_url: `${phase.base_url}/studies/${slug}/versions/${version}/${slug}-${version}.pdf`,
  tags: study.tags ?? [],
  translation_of: study.translation_of ?? null,
  sibling_editions: study.sibling_editions ?? [],
};

const report = {
  timestamp: new Date().toISOString(),
  slug, version,
  phase: phase.current_phase,
  base_url: phase.base_url,
  dataset: 'lemma-studies/lemma-theological-studies',
  row_key: `${slug}/${version}`,
  assets_composite: composite,
  assets_rag: rag,
  status: check ? 'check-ok' : (dryRun ? 'dry-run' : 'scaffold'),
  next_step: 'implement HF hub upload in Task 3.6',
};

if (jsonMode) console.log(JSON.stringify(dryRun || verbose ? { ...report, row } : report, null, 2));
else console.log(`update-huggingface-ds ${slug}/${version}: ${report.status}`);

process.exit(0);
