#!/usr/bin/env node
// compile-study.js — concat a lemma study's chapter files into a single versioned manuscript
// AND write per-chapter versioned copies to studies/<slug>/versions/vN.N/*.md (design §7.1).
//
// Usage:
//   node scripts/compile-study.js --study what-is-the-perfect --version v5.4
//   node scripts/compile-study.js --study "What Is the Perfect" --version v5.4     (Vault fallback for legacy)
//   node scripts/compile-study.js --study-dir "/path/to/Study Name" --version v5.4  (explicit path)
//
// Source resolution order:
//   1. --study-dir <abs>   use that dir as-is
//   2. --study <value>     try ./studies/<value>/ in the current repo (in-repo path — Phase 3+)
//   3. --study <value>     fall back to VAULT_ROOTS search (legacy Vault-canonical)
//
// Chapters are discovered as `[0-9]*.md` and `Appendix-*.md` at the study root, sorted by filename,
// with prior-compile artifacts (files matching /-v\d/) and packages (Package-*, Review-*) excluded.
//
// Outputs:
//   - Composite: <slug>-<version>.md at the STUDY DIR (legacy Vault behavior; Release-only per §7.1
//     when source is in-repo — do NOT commit the composite from the studies/<slug>/ root itself)
//   - Per-chapter versioned: studies/<slug>/versions/<version>/<original-chapter-name>.md
//     (in-repo only — for stable frozen URLs per R7 fix)
//   - --out <file>: override composite path
//
// Refuses to overwrite existing files unless --force.
//
// Design: the compiled `.md` is a derived artifact. Fold reviewer findings into chapter files, then
// rerun this script — never edit the compiled file directly. See:
//   ~/.claude/projects/-mnt-c-Users-timuy-Dropbox-personal-Vault-Projects-lemma/memory/canonical-chapters.md

import {
  readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync, copyFileSync,
} from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '..');
const IN_REPO_STUDIES_ROOT = join(REPO_ROOT, 'studies');

const VAULT_ROOTS = [
  '/mnt/c/Users/timuy/Dropbox/personal/Vault/Projects/lemma',
  '/mnt/c/Users/timuy/Dropbox/personal/Vault/Archives/lemma',
];

const { values: args } = parseArgs({
  options: {
    'study-dir': { type: 'string' },
    study:       { type: 'string' },
    version:     { type: 'string' },
    out:         { type: 'string' },
    force:       { type: 'boolean', default: false },
    'skip-versioned': { type: 'boolean', default: false },   // dev/test escape hatch
    'skip-corpus':    { type: 'boolean', default: false },   // dev/test escape hatch
    'skip-xrefs':     { type: 'boolean', default: false },   // dev/test escape hatch
    'rag-out':        { type: 'string' },                    // Release-only breadcrumbed variant path
  },
});

// Returns { dir, source: 'in-repo' | 'vault' | 'explicit', slug }.
// slug is the in-repo dir name when source is in-repo; else the sanitized basename.
function resolveStudySource() {
  if (args['study-dir']) {
    const dir = resolve(args['study-dir']);
    return { dir, source: 'explicit', slug: basename(dir).replace(/\s+/g, '-') };
  }
  if (!args.study) return null;

  // 1. Try in-repo studies/<value>/ (slug convention).
  const inRepo = join(IN_REPO_STUDIES_ROOT, args.study);
  if (existsSync(inRepo) && statSync(inRepo).isDirectory()) {
    return { dir: inRepo, source: 'in-repo', slug: args.study };
  }

  // 2. Fall back to VAULT_ROOTS (Vault name convention with spaces).
  for (const root of VAULT_ROOTS) {
    const candidate = join(root, args.study);
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return { dir: candidate, source: 'vault', slug: basename(candidate).replace(/\s+/g, '-') };
    }
  }

  return null;
}

const source = resolveStudySource();
if (!source || !args.version) {
  console.error('usage: compile-study.js --study <slug-or-name> --version vN.N [--force] [--out <file>]');
  console.error('   or: compile-study.js --study-dir <abs-dir> --version vN.N');
  console.error('');
  console.error('Source resolution: in-repo ./studies/<slug>/ > Vault Projects > Vault Archives');
  process.exit(1);
}
const { dir: studyDir, source: sourceKind, slug } = source;

if (!existsSync(studyDir)) {
  console.error(`compile-study: study dir does not exist: ${studyDir}`);
  process.exit(1);
}

export function findChapterFiles(dir) {
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .filter(f => /^([0-9]|Appendix-)/.test(f))
    // exclude anything that looks like a compiled or package artifact
    .filter(f => !/-v\d/i.test(f))
    .filter(f => !/^Package-|Review-/i.test(f))
    .sort();
}

export function compileChapters(dir, chapterFiles = null) {
  const files = chapterFiles ?? findChapterFiles(dir);
  return files.map(f => readFileSync(join(dir, f), 'utf8')).join('');
}

// Slugify a heading text to a github-slugger-style anchor id (matches Astro/
// Starlight's default). Lowercase, strip non-word chars, collapse whitespace.
function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Extract xrefs from chapter files. Returns { anchors, internal_links,
// external_study_links, footnotes }.
export function extractXrefs(studyDir, chapterFiles, slug) {
  const anchors = [];
  const internal_links = [];
  const external_study_links = [];
  const footnotes = [];

  const chapterSet = new Set(chapterFiles);

  for (const chapter of chapterFiles) {
    const content = readFileSync(join(studyDir, chapter), 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Headings: capture anchor.
      const hmatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (hmatch) {
        const level = hmatch[1].length;
        const text = hmatch[2].replace(/^\d+\.\s*/, '');   // strip leading numeric prefix
        anchors.push({ chapter, line: i + 1, level, text, slug: slugifyHeading(text) });
        continue;
      }

      // Footnote definitions.
      const fmatch = line.match(/^\[\^([^\]]+)\]:\s*(.+)$/);
      if (fmatch) {
        footnotes.push({ chapter, line: i + 1, id: fmatch[1], text: fmatch[2] });
      }

      // Links: [text](url) — one or more per line, extract each.
      const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
      let m;
      while ((m = linkRe.exec(line)) !== null) {
        const url = m[2];

        // Skip external URLs (http/https, mailto, tel, etc.).
        if (/^([a-z]+:)/i.test(url)) continue;

        // Anchor-only: #foo → same-chapter internal link
        if (url.startsWith('#')) {
          internal_links.push({
            from: { chapter, line: i + 1 },
            to_chapter: chapter,
            anchor: url.slice(1),
          });
          continue;
        }

        // Path forms.
        const [pathPart, anchorPart] = url.split('#');
        const target = pathPart.replace(/^\.\//, '');

        // Same-study cross-chapter link (target is a known chapter filename or bare basename).
        if (chapterSet.has(target)) {
          internal_links.push({
            from: { chapter, line: i + 1 },
            to_chapter: target,
            anchor: anchorPart ?? null,
          });
          continue;
        }

        // Absolute /<other-slug>/... → external study link.
        const absMatch = target.match(/^\/([a-z0-9-]+)(?:\/(.*))?$/);
        if (absMatch) {
          external_study_links.push({
            from: { chapter, line: i + 1 },
            to_study: absMatch[1],
            to_path: absMatch[2] ?? null,
            anchor: anchorPart ?? null,
          });
          continue;
        }

        // Relative ../other-slug/... → external study link.
        const relMatch = target.match(/^\.\.\/([a-z0-9-]+)(?:\/(.*))?$/);
        if (relMatch) {
          external_study_links.push({
            from: { chapter, line: i + 1 },
            to_study: relMatch[1],
            to_path: relMatch[2] ?? null,
            anchor: anchorPart ?? null,
          });
        }
      }
    }
  }

  return {
    study: slug,
    version: null,   // caller fills
    extracted_at: new Date().toISOString(),
    anchors,
    internal_links,
    external_study_links,
    footnotes,
  };
}

// Produce a breadcrumbed composite (.rag.md) from chapter files. Each heading
// line gets a preceding HTML comment: <!-- study: X chapter: Y anchor: Z -->.
// Per R6 B9 requirement + verify-machine-readable.mjs check.
export function renderRagMd(studyDir, chapterFiles, slug) {
  const parts = [];
  for (const chapter of chapterFiles) {
    const content = readFileSync(join(studyDir, chapter), 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const hmatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (hmatch) {
        const text = hmatch[2].replace(/^\d+\.\s*/, '');
        const anchor = slugifyHeading(text);
        parts.push(`<!-- study: ${slug} chapter: ${chapter} anchor: ${anchor} -->`);
      }
      parts.push(line);
    }
  }
  return parts.join('\n');
}

const chapters = findChapterFiles(studyDir);
if (chapters.length === 0) {
  console.error(`compile-study: no chapter files found in ${studyDir} (expected files matching /^([0-9]|Appendix-)/)`);
  process.exit(1);
}

// --- Composite output (legacy behavior; Release-only when source is in-repo) ---
const compiled = compileChapters(studyDir, chapters);
const compositePath = args.out
  ? resolve(args.out)
  : join(studyDir, `${slug}-${args.version}.md`);

if (existsSync(compositePath) && !args.force) {
  console.error(`compile-study: refusing to overwrite existing ${compositePath} — pass --force to replace`);
  process.exit(2);
}
writeFileSync(compositePath, compiled);

// --- Per-chapter versioned output (in-repo only) ---
// When source is in-repo (studies/<slug>/), write per-chapter copies to
// studies/<slug>/versions/<version>/<original-chapter-name>.md so URLs like
// /<slug>/versions/vN.N/<chapter>/ render stable frozen historical pages.
// Vault/explicit sources SKIP this — Vault-based studies aren't part of the
// canonical URL scheme and don't need frozen versioned chapters.
let versionedCount = 0;
if (sourceKind === 'in-repo' && !args['skip-versioned']) {
  const versionedDir = join(studyDir, 'versions', args.version);
  if (existsSync(versionedDir) && !args.force) {
    console.error(`compile-study: refusing to overwrite existing versioned dir ${versionedDir} — pass --force to replace`);
    process.exit(2);
  }
  mkdirSync(versionedDir, { recursive: true });
  for (const f of chapters) {
    copyFileSync(join(studyDir, f), join(versionedDir, f));
    versionedCount++;
  }
}

// --- xrefs.json extraction (in-repo only) ---
// Extract anchors + internal_links + external_study_links + footnotes per §7.1.
// Committed at studies/<slug>/xrefs.json (design line 452 "extracted per compile, committed").
let xrefsWritten = 0;
if (sourceKind === 'in-repo' && !args['skip-xrefs']) {
  const xrefs = extractXrefs(studyDir, chapters, slug);
  xrefs.version = args.version;
  const xrefsPath = join(studyDir, 'xrefs.json');
  writeFileSync(xrefsPath, JSON.stringify(xrefs, null, 2) + '\n');
  xrefsWritten = xrefs.anchors.length;
}

// --- .rag.md breadcrumbed variant (Release-only; only if --rag-out passed) ---
// Not committed by default per design §7.1 "Release only, referenced from
// llms.txt". CI Job 1b passes --rag-out to emit at a workflow-artifacts path.
// Skipped locally unless --rag-out is explicit.
let ragWritten = false;
if (args['rag-out']) {
  const ragPath = resolve(args['rag-out']);
  mkdirSync(dirname(ragPath), { recursive: true });
  writeFileSync(ragPath, renderRagMd(studyDir, chapters, slug));
  ragWritten = true;
}

// --- Corpus regeneration (in-repo only) ---
// llms-full.txt chunk index + claims-index.jsonl + per-chapter chunks under
// site/public/llms/full/<slug>/. Cross-study; walks all studies with versions/.
// Only fires when source is in-repo (Vault-side legacy studies don't touch corpus).
let corpusRegenerated = false;
if (sourceKind === 'in-repo' && !args['skip-corpus']) {
  const regen = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', 'regenerate-corpus.mjs')], {
    stdio: 'inherit',
  });
  if (regen.status !== 0) {
    console.error(`compile-study: regenerate-corpus.mjs exited ${regen.status}`);
    process.exit(regen.status ?? 1);
  }
  corpusRegenerated = true;
}

// --- Summary ---
console.log(`compiled ${chapters.length} chapters (${compiled.length} chars, ${compiled.split('\n').length} lines) → ${compositePath}`);
console.log(`  source: ${sourceKind} (${studyDir})`);
console.log(`  slug:   ${slug}`);
if (versionedCount > 0) {
  const versionedDir = join(studyDir, 'versions', args.version);
  console.log(`  versioned: ${versionedCount} chapters → ${versionedDir}/`);
} else if (sourceKind === 'in-repo') {
  console.log(`  versioned: skipped (--skip-versioned)`);
} else {
  console.log(`  versioned: skipped (source=${sourceKind}; only in-repo writes frozen versions)`);
}
if (xrefsWritten > 0) {
  console.log(`  xrefs:     ${xrefsWritten} anchors → studies/${slug}/xrefs.json`);
} else if (sourceKind === 'in-repo') {
  console.log(`  xrefs:     skipped (--skip-xrefs)`);
}
if (ragWritten) {
  console.log(`  rag.md:    → ${resolve(args['rag-out'])}`);
}
if (corpusRegenerated) {
  console.log(`  corpus:    regenerated (llms-full.txt + chunks + claims-index.jsonl)`);
} else if (sourceKind === 'in-repo') {
  console.log(`  corpus:    skipped (--skip-corpus)`);
}
console.log(`chapters (in order):`);
for (const f of chapters) console.log(`  ${f}`);
