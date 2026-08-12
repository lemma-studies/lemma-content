#!/usr/bin/env node
// compile-study.js — concat a lemma study's chapter files into a single versioned manuscript.
//
// Usage:
//   node scripts/compile-study.js --study-dir "/path/to/Study Name" --version v5.0 [--force] [--out <file>]
//   node scripts/compile-study.js --study "What Is the Perfect" --version v5.0
//
// Chapters are discovered as `[0-9]*.md` and `Appendix-*.md` at the study root, sorted by filename.
// Output filename defaults to `<slug>-<version>.md` (spaces → hyphens) in the study dir.
// Refuses to overwrite an existing file unless --force is set.
//
// Design: the compiled `.md` is a *derived artifact*. Fold reviewer findings into chapter files,
// then rerun this script — never edit the compiled file directly. See:
//   ~/.claude/projects/-mnt-c-Users-timuy-Dropbox-personal-Vault-Projects-lemma/memory/canonical-chapters.md

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { parseArgs } from 'node:util';

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
  },
});

function resolveStudyDir() {
  if (args['study-dir']) return resolve(args['study-dir']);
  if (!args.study) return null;
  for (const root of VAULT_ROOTS) {
    const candidate = join(root, args.study);
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
  }
  return null;
}

const studyDir = resolveStudyDir();
if (!studyDir || !args.version) {
  console.error('usage: compile-study.js --study-dir <dir> --version vN [--force] [--out <file>]');
  console.error('   or: compile-study.js --study "<name>" --version vN   (searches Vault Projects/Archives)');
  process.exit(1);
}
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

const compiled = compileChapters(studyDir, chapters);
const slug = basename(studyDir).replace(/\s+/g, '-');
const outPath = args.out ? resolve(args.out) : join(studyDir, `${slug}-${args.version}.md`);

if (existsSync(outPath) && !args.force) {
  console.error(`compile-study: refusing to overwrite existing ${outPath} — pass --force to replace`);
  process.exit(2);
}

writeFileSync(outPath, compiled);
console.log(`compiled ${chapters.length} chapters (${compiled.length} chars, ${compiled.split('\n').length} lines) → ${outPath}`);
console.log(`chapters (in order):`);
for (const f of chapters) console.log(`  ${f}`);
