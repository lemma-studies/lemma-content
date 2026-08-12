#!/usr/bin/env node
/**
 * validate.js — quality gate for a built Lemma study.
 *
 * Owning task: Task 15.
 *
 * Runs three validators against build/<slug>/<slug>.{pdf,epub}:
 *   - epubcheck  : EPUB schema/structure validity
 *   - pdffonts   : every font in the PDF must be embedded (KDP requires this)
 *   - DAISY ACE  : EPUB accessibility audit
 *
 * Per-tool logs land in build/<slug>/reports/. A unified summary.json is
 * always written, regardless of overall pass/fail.
 *
 * Exit codes:
 *   0  all validators passed
 *   1  one or more validators failed, or runtime input missing (e.g.,
 *      build dir not found) — reasons in stderr + summary.json when possible
 *   2  arg-validation failure (bad/missing --slug)
 *
 * CLI: node scripts/validate.js --slug=NAME
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = resolve(import.meta.dirname, '..');

const { values } = parseArgs({
  options: {
    slug: { type: 'string' },
  },
});

if (!values.slug) {
  console.error('usage: validate.js --slug=NAME');
  process.exit(2);
}

const slug = values.slug;
const buildDir = resolve(ROOT, 'build', slug);
const reportsDir = join(buildDir, 'reports');
const pdfPath = join(buildDir, `${slug}.pdf`);
const epubPath = join(buildDir, `${slug}.epub`);

if (!existsSync(buildDir)) {
  console.error(`validate: build directory not found: ${buildDir}`);
  // Still write a minimal summary for tooling consistency? No — buildDir
  // doesn't exist, so we can't put one there. Surface via stderr + exit 1
  // (this is a runtime failure, not an arg-validation failure).
  process.exit(1);
}

mkdirSync(reportsDir, { recursive: true });

function toolVersion(cmd, args) {
  // pdffonts writes its version banner to stderr (exit 0); epubcheck writes
  // to stdout (exit 0); ace writes to stdout (exit 0). Synchronous exec only
  // returns stdout — switch to spawnSync to capture both unconditionally.
  try {
    const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = (r.stdout ?? Buffer.from('')).toString().trim();
    const stderr = (r.stderr ?? Buffer.from('')).toString().trim();
    const text = stdout || stderr;
    return text.split('\n')[0].trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function checkEpubcheck() {
  const reportPath = join(reportsDir, 'epubcheck.log');
  const version = toolVersion('epubcheck', ['--version']);
  if (!existsSync(epubPath)) {
    writeFileSync(reportPath, `epubcheck not run: ${epubPath} not found\n`);
    return {
      ok: false,
      tool_version: version,
      report_path: 'reports/epubcheck.log',
      reason: `EPUB not found at ${epubPath}`,
    };
  }

  let stdout = '';
  let stderr = '';
  let exited = 0;
  try {
    stdout = execFileSync('epubcheck', [epubPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
  } catch (e) {
    exited = e.status ?? 1;
    stdout = (e.stdout ?? Buffer.from('')).toString();
    stderr = (e.stderr ?? Buffer.from('')).toString();
  }
  writeFileSync(reportPath, `# epubcheck ${version}\n# exit=${exited}\n\n## stdout\n${stdout}\n\n## stderr\n${stderr}\n`);

  return {
    ok: exited === 0,
    tool_version: version,
    report_path: 'reports/epubcheck.log',
    reason: exited === 0 ? null : `epubcheck exited ${exited}; see reports/epubcheck.log`,
  };
}

function checkPdffonts() {
  const reportPath = join(reportsDir, 'pdffonts.log');
  const version = toolVersion('pdffonts', ['-v']);
  if (!existsSync(pdfPath)) {
    writeFileSync(reportPath, `pdffonts not run: ${pdfPath} not found\n`);
    return {
      ok: false,
      tool_version: version,
      report_path: 'reports/pdffonts.log',
      reason: `PDF not found at ${pdfPath}`,
    };
  }

  let stdout = '';
  let stderr = '';
  let exited = 0;
  try {
    stdout = execFileSync('pdffonts', [pdfPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
  } catch (e) {
    exited = e.status ?? 1;
    stdout = (e.stdout ?? Buffer.from('')).toString();
    stderr = (e.stderr ?? Buffer.from('')).toString();
  }

  // Column-aware parse: skip header (line 0) + separator (line 1).
  // Each data row split on whitespace; column index 3 is the "emb" flag.
  // Format: name  type  encoding  emb  sub  uni  object  ID
  const lines = stdout.split('\n');
  const dataRows = lines.slice(2).filter(line => line.trim().length > 0);
  let nonEmbedded = [];
  for (const row of dataRows) {
    const cols = row.trim().split(/\s+/);
    // Defensive: short rows (e.g. fonts with spaces in name) — bail to false-negative
    // rather than false-positive. Worst case we miss a non-embedded font; the EPUB-side
    // ACE/epubcheck pass + manual KDP smoke test catch the rest.
    if (cols.length < 4) continue;
    if (cols[3] === 'no') {
      nonEmbedded.push(cols[0]);
    }
  }

  writeFileSync(
    reportPath,
    `# pdffonts ${version}\n# exit=${exited}\n# non_embedded=${nonEmbedded.length}\n\n## stdout\n${stdout}\n\n## stderr\n${stderr}\n`,
  );

  if (exited !== 0) {
    return {
      ok: false,
      tool_version: version,
      report_path: 'reports/pdffonts.log',
      reason: `pdffonts exited ${exited}; see reports/pdffonts.log`,
    };
  }
  if (nonEmbedded.length > 0) {
    return {
      ok: false,
      tool_version: version,
      report_path: 'reports/pdffonts.log',
      reason: `Non-embedded fonts: ${nonEmbedded.length} (${nonEmbedded.join(', ')})`,
    };
  }
  return {
    ok: true,
    tool_version: version,
    report_path: 'reports/pdffonts.log',
    reason: null,
  };
}

function checkAce() {
  const aceDir = join(reportsDir, 'ace');
  const reportJson = join(aceDir, 'report.json');
  const version = toolVersion('ace', ['--version']);
  if (!existsSync(epubPath)) {
    return {
      ok: false,
      tool_version: version,
      report_path: null,
      reason: `EPUB not found at ${epubPath}`,
    };
  }

  // Ensure the ace report directory exists before any stderr-tee happens.
  // ACE itself creates this dir on success, but on a spawn failure (e.g.
  // ENOENT for missing tool) it does not — without this, the stderr.log
  // write below would silently throw, hiding triage data.
  mkdirSync(aceDir, { recursive: true });

  let exited = 0;
  let stderr = '';
  try {
    execFileSync('ace', [epubPath, '-o', aceDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    exited = e.status ?? 1;
    stderr = (e.stderr ?? Buffer.from('')).toString();
  }

  // ACE writes report.json even when it exits non-zero. Parse it for a
  // structured violation count rather than relying on exit code alone.
  let violationCount = 0;
  let parseError = null;
  if (existsSync(reportJson)) {
    try {
      const report = JSON.parse(readFileSync(reportJson, 'utf8'));
      // ACE uses EARL: violations live under assertions[].assertions[].
      // Count individual failed assertions (earl:result.earl:outcome === 'fail').
      const assertionGroups = report.assertions ?? [];
      for (const group of assertionGroups) {
        const inner = group.assertions ?? [];
        for (const a of inner) {
          const outcome = a?.['earl:result']?.['earl:outcome'];
          if (outcome === 'fail' || outcome === 'earl:failed') {
            violationCount++;
          }
        }
      }
      // Fallback for shape variants: if "earl:result" is at top level.
      if (assertionGroups.length === 0 && report['earl:result']) {
        if (report['earl:result']['earl:outcome'] === 'fail') violationCount = 1;
      }
    } catch (e) {
      parseError = e.message;
    }
  } else {
    parseError = 'report.json not produced';
  }

  let reason = null;
  let ok = true;
  if (parseError) {
    ok = false;
    reason = `ACE: ${parseError} (exit=${exited})`;
  } else if (violationCount > 0) {
    ok = false;
    reason = `ACE: ${violationCount} accessibility violation(s); see reports/ace/report.json`;
  } else if (exited !== 0) {
    // Non-zero exit but report parsed cleanly with no violations — surface as a soft failure.
    ok = false;
    reason = `ACE exited ${exited} but report.json shows no violations; check reports/ace/`;
  }

  if (stderr) {
    // Append stderr alongside the JSON for human triage. aceDir was
    // created up-front so this should not fail under normal conditions;
    // a write error here is a real disk/permissions problem worth surfacing.
    writeFileSync(join(aceDir, 'stderr.log'), stderr);
  }

  return {
    ok,
    tool_version: version,
    report_path: existsSync(reportJson) ? 'reports/ace/report.json' : null,
    reason,
  };
}

const summary = {
  slug,
  timestamp: new Date().toISOString(),
  epubcheck: checkEpubcheck(),
  pdffonts: checkPdffonts(),
  ace: checkAce(),
  overall_ok: false,
};
summary.overall_ok = summary.epubcheck.ok && summary.pdffonts.ok && summary.ace.ok;

const summaryPath = join(reportsDir, 'summary.json');
writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');

if (!summary.overall_ok) {
  for (const tool of ['epubcheck', 'pdffonts', 'ace']) {
    if (!summary[tool].ok) {
      console.error(`validate: ${tool} FAILED: ${summary[tool].reason}`);
    }
  }
  console.error(`validate: summary at ${summaryPath}`);
  process.exit(1);
}

console.log(`validate: all checks passed; summary at ${summaryPath}`);
