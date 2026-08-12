#!/usr/bin/env node
// scripts/regenerate-corpus.mjs
//
// Walks all studies/<slug>/ that have a versions/<latest>/ directory and
// regenerates the three corpus-level surfaces per design §7.7 + Task 2a.5:
//
//   1. site/public/llms/full/<slug>/<chapter>.txt — per-chapter chunks
//      (raw chapter markdown + preamble with study/version/chapter/
//      canonical URL/license). Chunk URL scheme matches what
//      site/public/llms-full.txt indexes.
//
//   2. site/public/llms-full.txt — chunk-URL index. Rewrites the file
//      preserving header comments; body is one `- /llms/full/<slug>/
//      <chapter>.txt` line per chunk, sorted by slug then chapter name.
//
//   3. claims-index.jsonl (repo root) — aggregate of every study's
//      claims.jsonl with `study` field prepended to each row.
//
// Called by compile-study.js at end of per-study runs; also runnable
// standalone from CI or from `npm run regenerate:corpus`.
//
// Per §21A contract:
//   --check     validate only (compare current vs would-be output; exit 1
//               if drift), no write
//   --dry-run   preview without writing
//   --json      machine-readable summary (default when non-TTY)
//   --verbose
//
// Exit: 0 = regenerated (or clean drift-check), 1 = drift/failure, 2 = usage.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';
import {
  REPO_ROOT, parseArgs, isJsonMode, loadPhaseState,
} from './lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const check = args.flags.has('check');
const dryRun = args.flags.has('dry-run');

const STUDIES_ROOT = path.join(REPO_ROOT, 'studies');
const CHUNK_ROOT   = path.join(REPO_ROOT, 'site', 'public', 'llms', 'full');
const LLMS_FULL    = path.join(REPO_ROOT, 'site', 'public', 'llms-full.txt');
const CLAIMS_INDEX = path.join(REPO_ROOT, 'claims-index.jsonl');

const phase = loadPhaseState();
const baseUrl = phase.base_url;

// -------- Discovery --------

function readStudyMeta(slug) {
  const dir = path.join(STUDIES_ROOT, slug);
  const yamlPath = path.join(dir, 'study.yaml');
  if (!fs.existsSync(yamlPath)) return null;
  try {
    const study = yamlLoad(fs.readFileSync(yamlPath, 'utf8'));
    return study;
  } catch {
    return null;
  }
}

function latestVersionDir(slug, study) {
  const versionsRoot = path.join(STUDIES_ROOT, slug, 'versions');
  if (!fs.existsSync(versionsRoot)) return null;
  const versions = fs.readdirSync(versionsRoot).filter(v => /^v\d/.test(v));
  if (versions.length === 0) return null;
  // Prefer study.yaml.current_version if it exists; else last-sorted.
  const preferred = study?.current_version && versions.includes(study.current_version)
    ? study.current_version
    : versions.sort().at(-1);
  return { version: preferred, dir: path.join(versionsRoot, preferred) };
}

function chapterFilesIn(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .filter(f => /^([0-9]|Appendix-)/.test(f))
    .filter(f => !/-v\d/i.test(f))            // skip prior-compile composites
    .filter(f => !/^Package-|Review-/i.test(f))
    .sort();
}

// -------- Chunk generation --------

function chunkPreamble({ slug, version, chapter, chapterAnchor }) {
  return [
    `# study: ${slug}`,
    `# version: ${version}`,
    `# chapter: ${chapter}`,
    `# canonical: ${baseUrl}/${slug}/${chapterAnchor}/`,
    `# license: CC BY 4.0 (see https://creativecommons.org/licenses/by/4.0/)`,
    `# source: /studies/${slug}/${chapter}  (canonical chapter file — chunks regenerate per compile)`,
    ``,
    ``,
  ].join('\n');
}

function chapterAnchorFromFilename(filename) {
  // "04-Chapter-Reality.md" → "04-chapter-reality"
  return filename.replace(/\.md$/i, '').toLowerCase();
}

// -------- Main --------

const studySlugs = fs.existsSync(STUDIES_ROOT)
  ? fs.readdirSync(STUDIES_ROOT).filter(s => {
      const p = path.join(STUDIES_ROOT, s);
      return fs.statSync(p).isDirectory();
    })
  : [];

const chunksWritten = [];
const chunkIndexLines = [];
const claimsAggregated = [];

for (const slug of studySlugs) {
  const study = readStudyMeta(slug);
  const latest = latestVersionDir(slug, study);
  if (!latest) continue;   // stub studies with no versions/ dir — skip

  const chapters = chapterFilesIn(latest.dir);
  for (const chapter of chapters) {
    const source = fs.readFileSync(path.join(latest.dir, chapter), 'utf8');
    const anchor = chapterAnchorFromFilename(chapter);
    const chunkText = chunkPreamble({ slug, version: latest.version, chapter, chapterAnchor: anchor }) + source;
    const chunkPath = path.join(CHUNK_ROOT, slug, chapter.replace(/\.md$/i, '.txt'));
    chunksWritten.push({ slug, chapter, path: chunkPath, bytes: chunkText.length, contents: chunkText });
    chunkIndexLines.push(`- /llms/full/${slug}/${chapter.replace(/\.md$/i, '.txt')}`);
  }

  // Aggregate claims — always latest chapter files' claims.jsonl (not versioned).
  const claimsJsonlPath = path.join(STUDIES_ROOT, slug, 'claims.jsonl');
  if (fs.existsSync(claimsJsonlPath)) {
    const lines = fs.readFileSync(claimsJsonlPath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const claim = JSON.parse(line);
        claimsAggregated.push(JSON.stringify({ study: slug, ...claim }));
      } catch {
        // Malformed row — verify-machine-readable.mjs will flag this.
        // Don't fail the corpus regen for it.
      }
    }
  }
}

// llms-full.txt — preserve header, replace body.
const llmsFullHeader = fs.existsSync(LLMS_FULL)
  ? fs.readFileSync(LLMS_FULL, 'utf8').split('\n').filter(l => l.startsWith('#') || l === '').join('\n').replace(/\n+$/, '\n')
  : '# Lemma full-corpus chunk index\n';
const llmsFullBody = chunkIndexLines.sort().join('\n') + (chunkIndexLines.length ? '\n' : '');
// header always ends with '\n'; only insert separator + body when body is non-empty
// so an empty-corpus regen doesn't introduce a spurious trailing blank line.
const llmsFullNew = llmsFullBody
  ? llmsFullHeader + '\n' + llmsFullBody
  : llmsFullHeader;

// claims-index.jsonl — pure aggregate; deterministic ordering by study+id.
const claimsIndexNew = claimsAggregated.length
  ? claimsAggregated.sort().join('\n') + '\n'
  : '';

// -------- Drift check / write --------

function readOr(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; }

const driftItems = [];
if (readOr(LLMS_FULL) !== llmsFullNew) driftItems.push('site/public/llms-full.txt');
if (readOr(CLAIMS_INDEX) !== claimsIndexNew) driftItems.push('claims-index.jsonl');
for (const c of chunksWritten) {
  if (readOr(c.path) !== c.contents) driftItems.push(path.relative(REPO_ROOT, c.path));
}

const summary = {
  timestamp: new Date().toISOString(),
  phase: phase.current_phase,
  base_url: baseUrl,
  studies_considered: studySlugs.length,
  studies_with_versions: studySlugs.filter(s => latestVersionDir(s, readStudyMeta(s))).length,
  chunks: chunksWritten.length,
  claims_aggregated: claimsAggregated.length,
  drift: driftItems,
  status: check ? (driftItems.length ? 'drift' : 'clean') : (dryRun ? 'dry-run' : 'regenerated'),
  dry_run: dryRun,
  check_only: check,
};

if (!check && !dryRun) {
  // Write chunks (mkdir per-slug).
  for (const c of chunksWritten) {
    fs.mkdirSync(path.dirname(c.path), { recursive: true });
    fs.writeFileSync(c.path, c.contents);
  }
  // Write llms-full.txt + claims-index.jsonl.
  fs.writeFileSync(LLMS_FULL, llmsFullNew);
  fs.writeFileSync(CLAIMS_INDEX, claimsIndexNew);
}

if (jsonMode) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`regenerate-corpus: ${summary.status}`);
  console.log(`  studies: ${summary.studies_considered} (${summary.studies_with_versions} with versions/)`);
  console.log(`  chunks:  ${summary.chunks}`);
  console.log(`  claims:  ${summary.claims_aggregated}`);
  if (driftItems.length && (check || verbose)) {
    console.log(`  drift on ${driftItems.length} file(s):`);
    for (const d of driftItems) console.log(`    ${d}`);
  }
}

process.exit(check && driftItems.length ? 1 : 0);
