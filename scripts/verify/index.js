#!/usr/bin/env node
/**
 * verify/index.js — CLI for the lemma quote-verification tool.
 *
 * Usage:
 *   node scripts/verify/index.js --study "Wine and Jesus"
 *   node scripts/verify/index.js --study "Wine and Jesus" --tracks scripture
 *   node scripts/verify/index.js --study-path /abs/path/to/study
 *
 * Implements Session 1: Scripture track (working) + Patristic/Rabbinic (extract
 * only, stubs) + Modern worklist. Sessions 2 & 3 fill in the remaining tracks.
 *
 * Details in ~/.claude/skills/lemma-verify-quotes/SKILL.md.
 */
import { readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';

import { findStudyDir } from './config.js';
import { extractQuotesFromFile, TRACKS } from './extract-quotes.js';
import { verifyScripture } from './verify-scripture.js';
import { verifyPatristic } from './verify-patristic.js';
import { verifyRabbinic } from './verify-sefaria.js';
import { makeWorklistItem } from './verify-modern.js';
import { scanFingerprints } from './verify-fabrications.js';
import { writeReport, summarize } from './report.js';

const { values } = parseArgs({
  options: {
    study: { type: 'string' },
    'study-path': { type: 'string' },
    tracks: { type: 'string', default: 'scripture,patristic,rabbinic,modern' },
    version: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const studyDir = values['study-path']
  ? resolve(values['study-path'])
  : values.study
  ? findStudyDir(values.study)
  : null;

if (!studyDir) {
  console.error('usage: node scripts/verify/index.js --study "Study Name" [--tracks scripture,modern] [--version v1.0]');
  console.error('       node scripts/verify/index.js --study-path /abs/path/to/study');
  process.exit(2);
}

const activeTracks = new Set(values.tracks.split(',').map((t) => t.trim().toLowerCase()));

// ── Discover markdown files ────────────────────────────────────────────────

function collectMdFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    if (name === 'Research-Findings' || name === 'External Reviews' || name === 'Primary-Sources' || name === 'Working-Notes' || name === 'Rust' || name === 'node_modules' || name === 'Dwight Cover') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) collectMdFiles(p, out);
    else if (name.endsWith('.md') && !name.match(/\.tmp\.\d/) && !name.match(/-Draft-v[\d.]/) && !name.match(/-v[\d.]+\.md$/) && !name.match(/-Routing-Page-v[\d.]/) && !name.match(/Review-Package/i) && name !== '00-Project-Overview.md') out.push(p);
  }
  return out;
}

const mdFiles = collectMdFiles(studyDir);
if (mdFiles.length === 0) {
  console.error(`verify: no markdown files found under ${studyDir}`);
  process.exit(1);
}

// ── Extract quotes ─────────────────────────────────────────────────────────

const allQuotes = [];
for (const f of mdFiles) {
  const quotes = extractQuotesFromFile(f);
  allQuotes.push(...quotes);
}

console.log(`verify: extracted ${allQuotes.length} quotes from ${mdFiles.length} files`);

// ── Run per-track verification ─────────────────────────────────────────────

const results = [];
const modernWorklist = [];

for (const q of allQuotes) {
  if (q.track === TRACKS.SCRIPTURE && activeTracks.has('scripture')) {
    const r = verifyScripture(q);
    r.track = TRACKS.SCRIPTURE;
    results.push(r);
  } else if (q.track === TRACKS.MODERN && activeTracks.has('modern')) {
    modernWorklist.push(makeWorklistItem(q));
    results.push({ verdict: 'pending_playwright', quote: q, track: TRACKS.MODERN });
  } else if (q.track === TRACKS.PATRISTIC && activeTracks.has('patristic')) {
    const r = await verifyPatristic(q);
    r.track = TRACKS.PATRISTIC;
    results.push(r);
  } else if (q.track === TRACKS.RABBINIC && activeTracks.has('rabbinic')) {
    const r = await verifyRabbinic(q);
    r.track = TRACKS.RABBINIC;
    results.push(r);
  } else if (q.track === TRACKS.UNROUTED) {
    results.push({ verdict: 'unrouted', quote: q, track: TRACKS.UNROUTED });
  } else if (q.track === TRACKS.INLINE_UNATTRIBUTED) {
    results.push({ verdict: 'inline_unattributed', quote: q, track: TRACKS.INLINE_UNATTRIBUTED });
  }
}

// ── Summarize and write report ─────────────────────────────────────────────

const byTrack = summarize(results);
// subset_or_superset = an honest partial quote of a correctly-cited passage
// (words match KJV; range is wider or narrower). Listed in the report, but
// not a failure.
const OK_VERDICTS = new Set(['verbatim_clean', 'subset_or_superset', 'verbatim_elided']);
function trackCounts(list) {
  const clean = list.filter((r) => OK_VERDICTS.has(r.verdict)).length;
  const flagged = list.filter((r) => !OK_VERDICTS.has(r.verdict)).length;
  return { clean, flagged };
}
const sScripture = trackCounts(byTrack.scripture || []);
const sPatristic = trackCounts(byTrack.patristic || []);
const sRabbinic = trackCounts(byTrack.rabbinic || []);
console.log(`verify: scripture — ${sScripture.clean} verbatim-clean, ${sScripture.flagged} flagged`);
console.log(`verify: patristic — ${sPatristic.clean} verbatim-clean, ${sPatristic.flagged} flagged`);
console.log(`verify: rabbinic — ${sRabbinic.clean} verbatim-clean, ${sRabbinic.flagged} flagged`);
console.log(`verify: modern worklist — ${modernWorklist.length} items pending Playwright`);
console.log(`verify: unrouted — ${(byTrack.unrouted || []).length} needing human review (informational)`);
console.log(`verify: inline-unattributed — ${(byTrack['inline-unattributed'] || []).length} inline spans without tight-adjacent citation (informational)`);
const scriptureFlagged = sScripture.flagged + sPatristic.flagged + sRabbinic.flagged;

// Fabrication-fingerprint sweep across ALL extracted quotes (not track-scoped —
// AI drafting artifacts can appear anywhere).
const fingerprintHits = scanFingerprints(allQuotes);
if (fingerprintHits.length > 0) {
  console.log(`verify: fabrication fingerprints — ${fingerprintHits.length} HIT(S) — see report`);
} else {
  console.log('verify: fabrication fingerprints — 0 hits');
}

if (values['dry-run']) {
  console.log('verify: --dry-run — no report written');
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const reportPath = writeReport({
  studyDir,
  studyName: values.study || studyDir.split('/').pop(),
  version: values.version,
  byTrack,
  modernWorklist,
  fingerprintHits,
  extractedCount: allQuotes.length,
  todayIso: today,
});

console.log(`verify: report → ${reportPath}`);
process.exit(scriptureFlagged > 0 || fingerprintHits.length > 0 ? 1 : 0);
