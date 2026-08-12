#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ROOT = resolve(import.meta.dirname, '..');

const { values } = parseArgs({
  options: {
    style:    { type: 'string', default: resolve(ROOT, 'lemma-house-style.yaml') },
    override: { type: 'string' },
  },
});

/**
 * Deep-merge an override into a base config.
 * - Objects: keys from override win at the leaf, sibling base keys preserved.
 * - Arrays and scalars: replaced wholesale (no append).
 *
 * Note: house-style currently has no array fields, but the array-replace
 * contract is honored here so future schema additions don't surprise us.
 *
 * Exported so publish.js (Task 16) can reuse for MANIFEST stamping.
 */
export function mergeStyle(base, override) {
  if (override === undefined) return base;
  if (base === null || typeof base !== 'object' || Array.isArray(base)) return override;
  if (override === null || typeof override !== 'object' || Array.isArray(override)) return override;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    out[k] = mergeStyle(base[k], override[k]);
  }
  return out;
}

function loadAndValidate(path, schemaPath, label) {
  const data = yaml.load(readFileSync(path, 'utf8'));
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    console.error(`${label} (${path}) failed schema validation:`);
    for (const err of validate.errors) console.error(`  ${err.instancePath} ${err.message}`);
    process.exit(1);
  }
  return data;
}

function loadStyle() {
  const STRICT = resolve(ROOT, 'schemas/house-style.schema.json');
  const OVERRIDE_SCHEMA = resolve(ROOT, 'schemas/house-style-override.schema.json');

  const base = loadAndValidate(values.style, STRICT, 'house style');
  if (!values.override) return base;

  const override = loadAndValidate(values.override, OVERRIDE_SCHEMA, 'style override');
  const merged = mergeStyle(base, override);

  // Re-validate the merged result against the strict house schema
  const schema = JSON.parse(readFileSync(STRICT, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(merged)) {
    console.error('Merged style failed schema validation:');
    for (const err of validate.errors) console.error(`  ${err.instancePath} ${err.message}`);
    process.exit(1);
  }
  return merged;
}

// Format a number that should always be rendered as a decimal
// (preserves trailing zero so 5 → "5.0", 5.5 → "5.5", 0.875 → "0.875")
function dec(n) {
  return Number.isInteger(n) ? `${n}.0` : `${n}`;
}

function emitTex(s) {
  const w = dec(s.page.trim.width_in);
  const h = dec(s.page.trim.height_in);
  // Map CSS font-weight scale (100–900) onto LaTeX series. ≥600 → bold, else medium.
  const h2Series = s.headings.h2_weight >= 600 ? '\\bfseries' : '\\mdseries';
  const h3Series = s.headings.h3_weight >= 600 ? '\\bfseries' : '\\mdseries';
  return `% Generated from lemma-house-style.yaml v${s.version} — DO NOT EDIT.
% Page setup uses memoir-native commands. \\geometry{paperwidth=...} alone
% does NOT propagate into memoir's stock/trim — the page would render as the
% documentclass default (US Letter) regardless of geometry's settings.
\\setstocksize{${h}in}{${w}in}
\\settrimmedsize{${h}in}{${w}in}{*}
\\setlrmarginsandblock{${dec(s.page.margins.inner_in)}in}{${dec(s.page.margins.outer_in)}in}{*}
\\setulmarginsandblock{${dec(s.page.margins.top_in)}in}{${dec(s.page.margins.bottom_in)}in}{*}
\\checkandfixthelayout
\\setmainfont{${s.fonts.body}}
\\newfontfamily\\greekfont{${s.fonts.greek}}
\\newfontfamily\\hebrewfont{${s.fonts.hebrew}}
\\newfontfamily\\latinfont{${s.fonts.latin || s.fonts.body}}
\\newfontfamily\\aramaicfont{${s.fonts.aramaic || s.fonts.hebrew}}
% Body font size: \\documentclass[11pt]{memoir} sets \\normalsize to 11pt.
% Override here so house-style body_pt actually drives the print body.
\\renewcommand{\\normalsize}{\\fontsize{${dec(s.type.body_pt)}pt}{${dec(s.type.body_leading_pt)}pt}\\selectfont}
\\normalsize
\\setlength{\\parindent}{${s.spacing.paragraph_indent_em}em}
\\newcommand{\\sectionbreak}{\\par\\medskip\\centerline{${s.ornament.section_break}}\\medskip\\par}
\\renewcommand{\\footnotesize}{\\fontsize{${s.footnotes.size_pt}pt}{${(s.footnotes.size_pt + 2).toFixed(1)}pt}\\selectfont}
${s.footnotes.rule ? '' : '\\renewcommand{\\footnoterule}{}'}
% Heading weight macros — emitted for templates to consume (h2/h3 weight tunables).
% Names spell out the digits because LaTeX control sequences cannot contain digits
% (\\lemmaH2Weight would be parsed as \\lemmaH followed by literal "2Weight").
\\newcommand{\\lemmaHTwoWeight}{${h2Series}}
\\newcommand{\\lemmaHThreeWeight}{${h3Series}}
`;
}

function emitScss(s) {
  return `// Generated from lemma-house-style.yaml v${s.version} — DO NOT EDIT.
$body-font: "${s.fonts.body}";
$display-font: "${s.fonts.display}";
$greek-font: "${s.fonts.greek}";
$hebrew-font: "${s.fonts.hebrew}";
$latin-font: "${s.fonts.latin || s.fonts.body}";
$aramaic-font: "${s.fonts.aramaic || s.fonts.hebrew}";
$body-size: ${s.type.body_pt}pt;
$body-leading: ${s.type.body_leading_pt}pt;
$paragraph-indent: ${s.spacing.paragraph_indent_em}em;
$footnote-size: ${s.footnotes.size_pt}pt;
$ornament-section: "${s.ornament.section_break}";
$ornament-chapter: "${s.ornament.chapter_open}";
$chapter-size: ${s.headings.chapter_size_pt}pt;
$section-size: ${s.headings.section_size_pt}pt;
$subsection-size: ${s.headings.subsection_size_pt}pt;
$h2-weight: ${s.headings.h2_weight};
$h3-weight: ${s.headings.h3_weight};
`;
}

// Run only when executed directly (so tests can import mergeStyle without side effects)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const OUT_DIR = resolve(ROOT, 'build/style');
  const style = loadStyle();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, 'lemma-style.tex'), emitTex(style));
  writeFileSync(resolve(OUT_DIR, 'lemma-style.scss'), emitScss(style));
  console.log(`wrote ${OUT_DIR}/lemma-style.{tex,scss}`);
}
