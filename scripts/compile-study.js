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
console.log(`chapters (in order):`);
for (const f of chapters) console.log(`  ${f}`);
