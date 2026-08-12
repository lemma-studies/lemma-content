// check-drift.mjs — helper for the review dispatcher.
// Verifies that a review package contains the current chapters concat as a substring.
// If drift is detected, the package has stale manuscript text and dispatching would send
// out-of-date content to external reviewers.
//
// Exports checkDrift(studyDir, packageText) → { drift, reason?, firstMismatchLine? }.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function findChapterFiles(dir) {
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .filter(f => /^([0-9]|Appendix-)/.test(f))
    .filter(f => !/-v\d/i.test(f))
    .filter(f => !/^Package-|Review-/i.test(f))
    .sort();
}

export function compileChapters(studyDir) {
  const files = findChapterFiles(studyDir);
  return { files, text: files.map(f => readFileSync(join(studyDir, f), 'utf8')).join('') };
}

// Find where the first chapter starts inside packageText. Returns index or -1.
function findManuscriptStart(packageText, chaptersText) {
  const firstNL = chaptersText.indexOf('\n');
  const firstLine = firstNL < 0 ? chaptersText : chaptersText.slice(0, firstNL);
  if (!firstLine.startsWith('# ')) return packageText.indexOf(firstLine);
  return packageText.indexOf(firstLine);
}

export function checkDrift(studyDir, packageText) {
  const { files, text: chaptersText } = compileChapters(studyDir);
  if (!files.length) return { drift: false, reason: 'no chapter files found — skipping drift check' };

  const start = findManuscriptStart(packageText, chaptersText);
  if (start < 0) {
    return {
      drift: true,
      reason: `package does not contain the first chapter's opening line ("${chaptersText.slice(0, chaptersText.indexOf('\n'))}") — package appears to be from a different study or a very stale version`,
    };
  }
  const embedded = packageText.slice(start, start + chaptersText.length);
  if (embedded === chaptersText) {
    return { drift: false, chapterCount: files.length, chaptersLength: chaptersText.length };
  }

  // Locate first differing line, and center the preview window on the actual char mismatch
  // (not the line start) so users see what changed even in very long lines.
  const embLines = embedded.split('\n');
  const chLines = chaptersText.split('\n');
  let firstDiff = -1;
  for (let i = 0; i < Math.min(embLines.length, chLines.length); i++) {
    if (embLines[i] !== chLines[i]) { firstDiff = i; break; }
  }
  let preview;
  if (firstDiff >= 0) {
    const a = chLines[firstDiff], b = embLines[firstDiff];
    let col = 0;
    while (col < Math.min(a.length, b.length) && a[col] === b[col]) col++;
    const win = 100;
    const start = Math.max(0, col - 40);
    const clip = (s) => (start > 0 ? '…' : '') + s.slice(start, start + win) + (s.length > start + win ? '…' : '');
    preview = `line ${firstDiff + 1}, col ${col + 1}:\n  chapters : ${clip(a)}\n  package  : ${clip(b)}`;
  } else {
    preview = `(length differs — chapters ${chLines.length} lines, package embed ${embLines.length} lines)`;
  }

  return {
    drift: true,
    reason: `package's embedded manuscript does not match current chapter files at ${preview}`,
    chapterCount: files.length,
    chapterFiles: files,
  };
}
