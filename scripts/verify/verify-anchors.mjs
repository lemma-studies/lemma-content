#!/usr/bin/env node
// scripts/verify/verify-anchors.mjs [--study <slug>]
//
// Verifies anchor uniqueness within each study — no two headings in the same
// study generate the same slug/anchor, or intra-study links break.
//
// Astro/Starlight anchors are derived from heading text via slugification.
// Two headings that slug to the same anchor will collide silently at
// render time; the second occurrence overwrites the first in the TOC and
// breaks any # links to that anchor.
//
// Per §21A contract:
//   --study <slug>  optional; if given, check only that study; else check all
//   --check         alias of default
//   --json          machine-readable (default when non-TTY)
//   --verbose
//
// Exit: 0 = all unique, 1 = duplicate anchor found, 2 = usage.
//
// PHASE 2b SCAFFOLD: skeleton returns "pending" when studies/ is empty;
// real per-file anchor extraction lands once chapters are in-repo (Task 3.1+).

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, isJsonMode, REPO_ROOT } from '../lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const targetSlug = args.values.get('study') ?? null;

const studiesRoot = path.join(REPO_ROOT, 'studies');
const collisions = [];

if (!fs.existsSync(studiesRoot) || fs.readdirSync(studiesRoot).length === 0) {
  const msg = 'studies/ empty; skipping (populated in Phase 3)';
  if (jsonMode) console.log(JSON.stringify({ status: 'pending', reason: msg }));
  else console.log(msg);
  process.exit(0);
}

// Simple slugifier matching Astro/Starlight default (github-slugger conventions).
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function checkStudy(slug) {
  const dir = path.join(studiesRoot, slug);
  if (!fs.statSync(dir).isDirectory()) return;
  const seen = new Map(); // anchor → first-seen-in file
  const files = fs.readdirSync(dir).filter(f => /^([0-9]|Appendix-)/.test(f) && f.endsWith('.md'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (!m) continue;
      const anchor = slugify(m[2]);
      if (seen.has(anchor)) {
        collisions.push({ study: slug, anchor, files: [seen.get(anchor), f], text: m[2] });
      } else {
        seen.set(anchor, f);
      }
    }
  }
}

const slugs = targetSlug
  ? [targetSlug]
  : fs.readdirSync(studiesRoot).filter(s => fs.statSync(path.join(studiesRoot, s)).isDirectory());

for (const s of slugs) checkStudy(s);

const report = {
  timestamp: new Date().toISOString(),
  status: collisions.length === 0 ? 'clean' : 'fail',
  studies_checked: slugs,
  collisions,
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`verify-anchors: ${report.status} (${slugs.length} studies, ${collisions.length} collisions)`);
  if (verbose || collisions.length) {
    for (const c of collisions) {
      console.log(`  [${c.study}] "${c.text}" → #${c.anchor} appears in ${c.files.join(' + ')}`);
    }
  }
}

process.exit(collisions.length === 0 ? 0 : 1);
