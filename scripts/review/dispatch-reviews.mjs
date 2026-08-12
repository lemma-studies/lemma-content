#!/usr/bin/env node
// dispatch-reviews.mjs — send a lemma review package to the external AI review panel in parallel.
//
// Usage:
//   node scripts/review/dispatch-reviews.mjs --package "/path/to/Review-Package-vN.md" --round 6 \
//        [--out "/path/to/External Reviews"] [--reviewers fable] [--dry-run]
//
// DEFAULT is --reviewers fable (Fable only). Tim hand-carries the Grok and Gemini legs via their
// chat web UIs (using his personal subscriptions) rather than the paid API routes. See
// ~/.claude/projects/-mnt-c-Users-timuy-Dropbox-personal-Vault-Projects-lemma/memory/hand-carry-grok-gemini.md
// for the full workflow. Only opt into --reviewers grok or gemini if Tim explicitly asks to route
// them via OpenRouter/xAI for this round (e.g. for a smoke test or when the chat UIs are unavailable).
//
// Reviewers (each call is a fresh conversation by construction):
//   gemini — via OpenRouter by default (model id with '/'); Google-direct if a bare model name is given.
//            NOTE: the googleai key is free-tier (pro models have 0 free quota); OpenRouter needs credit.
//   grok   — native xAI API if api_keys.xai present (bare model name, e.g. grok-4.3, ~$0.10/review);
//            otherwise OpenRouter (model id gets x-ai/ prefix; needs OpenRouter credit)
//   fable  — local `claude -p` headless (uses existing Claude Code auth; zero marginal cost)
//
// The package must be self-contained (preamble with the ask + full manuscript). This script is the
// COURIER ONLY. Verification-before-adoption and folding remain agent work — see
// ~/.claude/skills/lemma-verify-quotes/references/external-review-gauntlet.md

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { checkDrift } from './check-drift.mjs';

const { values: args } = parseArgs({
  options: {
    package: { type: 'string' },
    round: { type: 'string' },
    out: { type: 'string' },
    reviewers: { type: 'string', default: 'fable' },
    'gemini-model': { type: 'string', default: 'google/gemini-3.1-pro-preview' },
    'grok-model': { type: 'string', default: 'grok-4.3' },
    'fable-model': { type: 'string', default: 'claude-fable-5' },
    // Large review packages (>80k tokens) can exceed Fable's single-turn output budget
    // and exit with "Reached max turns (1)". Round 9 (~89k tokens) hit this on WITP v5.0.
    // Bump default to 3 so Fable can continue writing across a turn boundary.
    'fable-max-turns': { type: 'string', default: '3' },
    'study-dir': { type: 'string' },
    'skip-drift-check': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

if (!args.package || !args.round) {
  console.error('usage: dispatch-reviews.mjs --package <file> --round <N> [--out <dir>] [--reviewers grok,gemini,fable]');
  process.exit(1);
}

const pkgPath = resolve(args.package);
const pkg = readFileSync(pkgPath, 'utf8');
const outDir = args.out ? resolve(args.out) : join(dirname(pkgPath), 'External Reviews');
mkdirSync(outDir, { recursive: true });
const round = args.round;
const today = new Date().toISOString().slice(0, 10);

// Drift check: verify the package embeds the current chapter files. Prevents dispatching
// stale manuscript text to external reviewers (the failure mode that produced the
// What Is the Perfect v4.2→v4.9 drift). Study dir defaults to the package's parent dir.
if (!args['skip-drift-check']) {
  const studyDir = args['study-dir'] ? resolve(args['study-dir']) : dirname(pkgPath);
  const drift = checkDrift(studyDir, pkg);
  if (drift.drift) {
    console.error(`\nDRIFT DETECTED — refusing to dispatch stale manuscript to external reviewers.`);
    console.error(`Study dir: ${studyDir}`);
    console.error(`Package:   ${pkgPath}`);
    console.error(`Reason:    ${drift.reason}`);
    console.error(`\nFix: fold your review findings into the chapter files, then rebuild the package with:`);
    console.error(`  node scripts/compile-study.js --study-dir "${studyDir}" --version <vN> --force`);
    console.error(`  (then rebuild the package preamble around the new compiled manuscript)`);
    console.error(`\nIf you really do want to dispatch the current package as-is, re-run with --skip-drift-check.`);
    process.exit(3);
  }
  if (drift.reason) console.log(`drift check: ${drift.reason}`);
  else console.log(`drift check: OK (${drift.chapterCount} chapters, ${drift.chaptersLength} chars embedded in package)`);
}

const keys = JSON.parse(readFileSync(join(homedir(), '.model-radar/config.json'), 'utf8')).api_keys || {};

const SYSTEM = 'You are an independent external manuscript reviewer. The document below is a self-contained review package: it begins with instructions ("What we want from you", "Review discipline") followed by the full manuscript. Follow the package instructions exactly. Produce your findings in the requested format, most severe first, then the overall assessment. Quote the manuscript verbatim when flagging anything; never fabricate sources.';

async function callGemini(model, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys.googleai}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { maxOutputTokens: 16384, temperature: 0.4 },
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`gemini ${res.status}: ${JSON.stringify(j).slice(0, 400)}`);
  const out = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? '';
  if (!out.trim()) throw new Error(`gemini returned empty: ${JSON.stringify(j).slice(0, 400)}`);
  return out;
}

async function callXai(model, text) {
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${keys.xai}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [ { role: 'system', content: SYSTEM }, { role: 'user', content: text } ],
      max_tokens: 16384, temperature: 0.4,
    }),
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(`xai ${res.status}: ${JSON.stringify(j.error || j).slice(0, 400)}`);
  const out = j.choices?.[0]?.message?.content ?? '';
  if (!out.trim()) throw new Error('xai returned empty');
  return out;
}

async function callOpenRouter(model, text) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${keys.openrouter}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [ { role: 'system', content: SYSTEM }, { role: 'user', content: text } ],
      max_tokens: 16384, temperature: 0.4,
    }),
  });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(`openrouter ${res.status}: ${JSON.stringify(j.error || j).slice(0, 400)}`);
  const out = j.choices?.[0]?.message?.content ?? '';
  if (!out.trim()) throw new Error('openrouter returned empty');
  return out;
}

function callClaudeHeadless(model, text) {
  // Fresh headless session; relies on existing Claude Code login. Write prompt to a temp file to
  // avoid argv limits, and pipe via stdin.
  //
  // --disallowedTools '*' blocks WebSearch/Bash/Read/etc. Without this, Fable v9 (WITP Round 9)
  // spent all turns trying to verify a Migne PG column claim via tools instead of writing the
  // review — the review discipline says "flag unverified," so tools are not wanted here.
  //
  // --max-turns 3 (default) accommodates large packages that occasionally need a second turn
  // to complete the response even without tools.
  const tmp = join(outDir, `.dispatch-fable-prompt-${round}.tmp.md`);
  writeFileSync(tmp, `${SYSTEM}\n\n---\n\n${text}`);
  const maxTurns = args['fable-max-turns'];
  const out = execFileSync('claude', ['-p', '--model', model, '--max-turns', maxTurns, '--disallowedTools', '*'], {
    input: readFileSync(tmp),
    maxBuffer: 32 * 1024 * 1024,
    timeout: 30 * 60 * 1000,
    encoding: 'utf8',
  });
  if (!out.trim()) throw new Error('claude -p returned empty');
  return out;
}

const REVIEWERS = {
  gemini: { label: 'Gemini', run: () => args['gemini-model'].includes('/') ? callOpenRouter(args['gemini-model'], pkg) : callGemini(args['gemini-model'], pkg) },
  grok:   { label: 'Grok',   run: () => (keys.xai && !args['grok-model'].includes('/')) ? callXai(args['grok-model'], pkg) : callOpenRouter(args['grok-model'].includes('/') ? args['grok-model'] : 'x-ai/' + args['grok-model'], pkg) },
  fable:  { label: 'Fable (Claude)', run: async () => callClaudeHeadless(args['fable-model'], pkg) },
};

const wanted = args.reviewers.split(',').map(s => s.trim()).filter(Boolean);
for (const w of wanted) if (!REVIEWERS[w]) { console.error(`unknown reviewer: ${w}`); process.exit(1); }

if (args['dry-run']) {
  console.log(`DRY RUN — package ${pkgPath} (${pkg.length} chars ≈ ${Math.round(pkg.length / 4 / 1000)}k tokens)`);
  console.log(`would dispatch to: ${wanted.join(', ')}; output → ${outDir}`);
  process.exit(0);
}

console.log(`Dispatching round ${round} to ${wanted.length} reviewers in parallel (package ≈ ${Math.round(pkg.length / 4 / 1000)}k tokens)...`);
const results = await Promise.allSettled(wanted.map(async w => {
  const t0 = Date.now();
  const review = await REVIEWERS[w].run();
  const file = join(outDir, `v${round}-${w}-review.md`);
  if (existsSync(file)) throw new Error(`${file} already exists — refusing to overwrite`);
  const header = `# ${REVIEWERS[w].label} Review — Round ${round} — received ${today} (dispatched automatically via dispatch-reviews.mjs; fresh conversation)\n\n`;
  writeFileSync(file, header + review.trim() + '\n');
  return { w, file, secs: Math.round((Date.now() - t0) / 1000), chars: review.length };
}));

let failed = 0;
for (const r of results) {
  if (r.status === 'fulfilled') console.log(`OK   ${r.value.w}: ${r.value.chars} chars in ${r.value.secs}s → ${r.value.file}`);
  else { failed++; console.error(`FAIL ${r.reason.message || r.reason}`); }
}
console.log(failed ? `\n${failed} reviewer(s) failed — re-run with --reviewers <failed> after fixing.` : '\nAll reviews saved. Next: verify-before-adopt per external-review-gauntlet.md — do NOT fold unverified findings.');
process.exit(failed ? 2 : 0);
