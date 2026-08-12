import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { STANDING_RULE } from './config.js';

// Group verdicts by track.
export function summarize(results) {
  const byTrack = { scripture: [], patristic: [], rabbinic: [], modern: [], unrouted: [], 'author-maxim': [], 'inline-unattributed': [] };
  for (const r of results) {
    const t = r.track || (r.quote && r.quote.track) || 'unrouted';
    (byTrack[t] ||= []).push(r);
  }
  return byTrack;
}

function verdictSummaryRow(track, results) {
  if (!results.length) return `| ${track} | 0 | — |`;
  const counts = {};
  for (const r of results) counts[r.verdict || 'pending'] = (counts[r.verdict || 'pending'] || 0) + 1;
  const parts = Object.entries(counts).map(([v, n]) => `${v}: ${n}`);
  return `| ${track} | ${results.length} | ${parts.join(', ')} |`;
}

function fmtScriptureRow(r) {
  const loc = `${r.quote.filePath.split('/').pop()}:${r.quote.line}`;
  const head = r.quote.quote.slice(0, 60).replace(/\s+/g, ' ') + '…';
  const ref = r.reference || '?';
  const verdict = r.verdict || 'pending';
  return `| ${loc} | ${ref} | ${verdict} | ${head} |`;
}

function fmtModernRow(item) {
  return `| ${item.location} | ${item.source_line.slice(0, 60)} | \`${item.distinctive_phrase}\` | (pending) |`;
}

// Emit a Research-Findings/YYYY-MM-DD-quote-verification.md report matching the
// shape used by the Parents-and-Adult-Children study.
export function writeReport({
  studyDir,
  studyName,
  version,
  byTrack,
  modernWorklist,
  fingerprintHits = [],
  extractedCount,
  todayIso,
}) {
  const findingsDir = join(studyDir, 'Research-Findings');
  mkdirSync(findingsDir, { recursive: true });
  const reportPath = join(findingsDir, `${todayIso}-quote-verification.md`);

  const scripture = byTrack.scripture || [];
  const modern = byTrack.modern || [];
  const patristic = byTrack.patristic || [];
  const rabbinic = byTrack.rabbinic || [];
  const unrouted = byTrack.unrouted || [];

  const parts = [];
  parts.push('---');
  parts.push(`report: Systematic block-quote verification of ${studyName}${version ? ' ' + version : ''}`);
  parts.push(`date: ${todayIso}`);
  parts.push(`scope: ${extractedCount} quotes extracted`);
  parts.push(`status: IN PROGRESS — automated tracks complete; modern track pending Playwright pass`);
  parts.push('---');
  parts.push('');
  parts.push(`# Quote Verification Pass — ${studyName}${version ? ' ' + version : ''}`);
  parts.push('');
  parts.push('## Summary');
  parts.push('');
  parts.push('| Track | Extracted | Verdicts |');
  parts.push('|---|---|---|');
  parts.push(verdictSummaryRow('scripture', scripture));
  parts.push(verdictSummaryRow('patristic', patristic));
  parts.push(verdictSummaryRow('rabbinic', rabbinic));
  parts.push(verdictSummaryRow('modern', modern));
  parts.push(verdictSummaryRow('unrouted', unrouted));
  parts.push('');

  if (scripture.length) {
    parts.push('## Scripture track');
    parts.push('');
    parts.push('| Location | Ref | Verdict | Quote head |');
    parts.push('|---|---|---|---|');
    for (const r of scripture) parts.push(fmtScriptureRow(r));
    parts.push('');
    const flagged = scripture.filter((r) => r.verdict !== 'verbatim_clean' && r.verdict !== 'verbatim_elided');
    if (flagged.length) {
      parts.push('### Scripture flags (needs fix)');
      for (const r of flagged) {
        parts.push('');
        parts.push(`- **${r.quote.filePath.split('/').pop()}:${r.quote.line} — ${r.reference || 'unpinnable'} — ${r.verdict}**`);
        if (r.expected) parts.push(`  - expected KJV: \`${r.expected.slice(0, 240)}\``);
        if (r.actual) parts.push(`  - manuscript: \`${r.actual.slice(0, 240)}\``);
        if (r.diff && (r.diff.missing.length || r.diff.extra.length)) {
          if (r.diff.missing.length) parts.push(`  - missing words: ${r.diff.missing.join(', ')}`);
          if (r.diff.extra.length) parts.push(`  - extra words: ${r.diff.extra.join(', ')}`);
        }
        if (r.reason) parts.push(`  - reason: ${r.reason}`);
      }
      parts.push('');
    }
  }

  if (patristic.length) {
    parts.push('## Patristic track');
    parts.push('');
    parts.push('| Location | Attribution | Verdict | Translator |');
    parts.push('|---|---|---|---|');
    for (const r of patristic) {
      const loc = `${r.quote.filePath.split('/').pop()}:${r.quote.line}`;
      const src = (r.quote.sourceLine || '').slice(0, 40);
      parts.push(`| ${loc} | ${src} | ${r.verdict} | ${r.translator || '—'} |`);
    }
    parts.push('');
    const flagged = patristic.filter((r) => r.verdict !== 'verbatim_clean');
    if (flagged.length) {
      parts.push('### Patristic flags (needs fix)');
      for (const r of flagged) {
        parts.push('');
        parts.push(`- **${r.quote.filePath.split('/').pop()}:${r.quote.line} — ${r.key || r.quote.sourceLine} — ${r.verdict}**`);
        if (r.reason) parts.push(`  - reason: ${r.reason}`);
        if (r.url) parts.push(`  - pinned URL: ${r.url}`);
        if (r.hit_phrase) parts.push(`  - fuzzy hit: \`${r.hit_phrase}\``);
      }
      parts.push('');
    }
  }

  if (rabbinic.length) {
    parts.push('## Rabbinic track');
    parts.push('');
    parts.push('| Location | Attribution | Verdict | Sefaria ref |');
    parts.push('|---|---|---|---|');
    for (const r of rabbinic) {
      const loc = `${r.quote.filePath.split('/').pop()}:${r.quote.line}`;
      const src = (r.quote.sourceLine || '').slice(0, 40);
      parts.push(`| ${loc} | ${src} | ${r.verdict} | ${r.ref || '—'} |`);
    }
    parts.push('');
    const flagged = rabbinic.filter((r) => r.verdict !== 'verbatim_clean');
    if (flagged.length) {
      parts.push('### Rabbinic flags (needs fix)');
      for (const r of flagged) {
        parts.push('');
        parts.push(`- **${r.quote.filePath.split('/').pop()}:${r.quote.line} — ${r.ref || r.quote.sourceLine} — ${r.verdict}**`);
        if (r.reason) parts.push(`  - reason: ${r.reason}`);
        if (r.sefaria_url) parts.push(`  - Sefaria: ${r.sefaria_url}`);
        if (r.hit_phrase) parts.push(`  - fuzzy hit: \`${r.hit_phrase}\``);
      }
      parts.push('');
    }
  }

  if (modernWorklist && modernWorklist.length) {
    parts.push('## Modern track — Playwright worklist');
    parts.push('');
    parts.push('_Run the archive.org Playwright dance per `~/.claude/skills/lemma-verify-quotes/references/archive-org-playwright-recipe.md`._');
    parts.push('');
    parts.push('| Location | Attribution | Distinctive phrase | Verdict |');
    parts.push('|---|---|---|---|');
    for (const item of modernWorklist) parts.push(fmtModernRow(item));
    parts.push('');
  }

  if (fingerprintHits.length) {
    parts.push('## 🚨 Fabrication-fingerprint hits');
    parts.push('');
    parts.push('_These quotes contain diction patterns that surfaced in confirmed fabrications during the Parents-and-Adult-Children study. Treat as HIGH SUSPICION — verify against the primary source before the quote stays in the manuscript._');
    parts.push('');
    for (const h of fingerprintHits) {
      parts.push(`- **${h.quote.filePath.split('/').pop()}:${h.quote.line}** — pattern \`${h.pattern}\` matched`);
      parts.push(`  - source: ${h.quote.sourceLine || '(no attribution)'}`);
      parts.push(`  - quote head: "${h.quote.quote.slice(0, 120).replace(/\s+/g, ' ')}…"`);
    }
    parts.push('');
  }

  const inlineUnattributed = byTrack['inline-unattributed'] || [];
  if (inlineUnattributed.length) {
    parts.push('## Inline spans without tight-adjacent citation (informational)');
    parts.push('');
    parts.push(`_${inlineUnattributed.length} inline quoted spans of ≥ 7 words have no citation immediately adjacent to the closing quote. These are typically the manuscript quoting its own earlier text, paraphrase fragments, or scare quotes. They are NOT counted as flags. Spot-check any that look like real citations:_`);
    parts.push('');
    for (const r of inlineUnattributed.slice(0, 40)) {
      parts.push(`- ${r.quote.filePath.split('/').pop()}:${r.quote.line} — "${r.quote.quote.slice(0, 90).replace(/\s+/g, ' ')}…"`);
    }
    if (inlineUnattributed.length > 40) parts.push(`- …and ${inlineUnattributed.length - 40} more`);
    parts.push('');
  }

  if (unrouted.length) {
    parts.push('## Unrouted (needs human review)');
    parts.push('');
    parts.push('_These quotes could not be routed to a track automatically — they may be study-authored maxims, scare quotes, or quotes needing an explicit `<!-- verify-track: X -->` override._');
    parts.push('');
    for (const r of unrouted) {
      parts.push(`- ${r.quote.filePath.split('/').pop()}:${r.quote.line} — head: "${r.quote.quote.slice(0, 100).replace(/\s+/g, ' ')}…"`);
    }
    parts.push('');
  }

  parts.push('## Standing rule');
  parts.push('');
  parts.push('> ' + STANDING_RULE);
  parts.push('');
  parts.push('_See `~/.claude/skills/lemma-verify-quotes/SKILL.md` for the full protocol._');
  parts.push('');

  writeFileSync(reportPath, parts.join('\n'));
  return reportPath;
}
