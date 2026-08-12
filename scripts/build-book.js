#!/usr/bin/env node
/**
 * build-book.js — orchestrate Pandoc PDF + EPUB for a single Lemma study.
 *
 * Owning task: Task 14 (+ Amendment 001 --style-override forwarding).
 *
 * Responsibilities:
 *   - Optionally regenerate build/style/lemma-style.{tex,scss} via style-codegen.
 *   - Compile templates/epub.scss → build/epub.css via npx sass.
 *   - Run Pandoc against <input-dir>/main.md to emit:
 *       build/<slug>/<slug>.pdf  (LuaLaTeX + memoir template per --variant)
 *       build/<slug>/<slug>.epub (EPUB3 with the compiled CSS)
 *   - Wire the full Lua filter chain in the order locked by playbook 08.
 *
 * Out of scope: validation (Task 15), publishing (Task 16).
 *
 * CLI:
 *   node scripts/build-book.js --slug=NAME --variant=book|pamphlet|omnibus \
 *        --in=PATH [--refs=PATH] [--style-override=PATH]
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = resolve(import.meta.dirname, '..');

const { values } = parseArgs({
  options: {
    slug:             { type: 'string' },
    variant:          { type: 'string', default: 'book' },
    in:               { type: 'string' },
    refs:             { type: 'string' },
    'style-override': { type: 'string' },
  },
});

if (!values.slug || !values.in) {
  console.error('usage: build-book.js --slug=NAME --variant=book|pamphlet|omnibus --in=PATH [--refs=PATH] [--style-override=PATH]');
  process.exit(2);
}

const VALID_VARIANTS = new Set(['book', 'pamphlet', 'omnibus']);
if (!VALID_VARIANTS.has(values.variant)) {
  console.error(`build-book: invalid --variant=${values.variant}; expected one of book|pamphlet|omnibus`);
  process.exit(2);
}

const inputDir = resolve(values.in);
const mainMd = join(inputDir, 'main.md');
if (!existsSync(mainMd)) {
  console.error(`build-book: ${mainMd} not found`);
  process.exit(2);
}

// References path resolution (refinement #3):
//   --refs flag wins; else <input-dir>/references.yaml; else null (filter
//   will emit MISSING-CITATION:<key>, loud-on-purpose).
//   The repo-root references.yaml is NOT a fallback (schema delta, see
//   playbook 08 §citation-link.lua specifics).
let refsPath = null;
if (values.refs) {
  refsPath = resolve(values.refs);
  if (!existsSync(refsPath)) {
    console.error(`build-book: --refs=${refsPath} does not exist`);
    process.exit(2);
  }
} else {
  const local = join(inputDir, 'references.yaml');
  if (existsSync(local)) refsPath = local;
}

const STYLE_TEX = resolve(ROOT, 'build/style/lemma-style.tex');

// 1. (Re)generate build/style via style-codegen, with optional override.
const codegenArgs = ['scripts/style-codegen.js'];
if (values['style-override']) {
  codegenArgs.push(`--override=${resolve(values['style-override'])}`);
}
execFileSync('node', codegenArgs, { cwd: ROOT, stdio: 'inherit' });

// 2. Snapshot the codegen-emitted style file into the per-slug build dir as
// a provenance record of the typography that produced this build. Also gives
// downstream tooling (and tests) a stable, slug-isolated path to read,
// independent of races against the global build/style/ directory.
// Snapshot immediately after codegen, before any other process can race.
// Note: the LuaLaTeX run still consumes the global STYLE_TEX path (memoir
// expects it where codegen emitted it). Parallel build-book invocations
// with conflicting --style-override values are unsafe at the LuaLaTeX read
// step — the snapshot is for after-the-fact provenance and test isolation,
// not for build-time concurrency.
const outDir = resolve(ROOT, 'build', values.slug);
mkdirSync(outDir, { recursive: true });
copyFileSync(STYLE_TEX, join(outDir, 'lemma-style.tex'));

// 3. Compile EPUB SCSS → CSS.
const epubCss = resolve(ROOT, 'build/epub.css');
execFileSync('npx', [
  'sass',
  '--no-source-map',
  `--load-path=${resolve(ROOT, 'build/style')}`,
  `${resolve(ROOT, 'templates/epub.scss')}:${epubCss}`,
], { cwd: ROOT, stdio: 'inherit' });

// Filter chain order locked at Task 12 (see playbook 08 §Filter chain order).
// Do NOT reorder without updating both this file and the playbook in lockstep —
// Tasks 9–12 each wrote tests against the AST shape produced by the prior
// filter at this position.
const FILTER_CHAIN = [
  'filters/lang-tag.lua',
  'filters/starlight-link.lua',
  'filters/smart-punct.lua',
  'filters/ornament-break.lua',
  'filters/footnote-format.lua',
  'filters/citation-link.lua',
  'filters/verse-numbering.lua',
  'filters/manifest-stamp.lua',
];

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT })
      .toString().trim();
  } catch { return 'unknown'; }
}

function deriveTitle(mainMdPath, fallback) {
  try {
    const text = readFileSync(mainMdPath, 'utf8');
    const m = text.match(/^#\s+(.+?)\s*$/m);
    if (m) return m[1].trim();
  } catch { /* fall through */ }
  return fallback;
}

function pandocCommon() {
  const args = [
    mainMd,
    '--from=markdown+smart',
    '--metadata', `git_sha:${gitSha()}`,
    '--metadata', `build_timestamp:${new Date().toISOString()}`,
  ];
  // refsPath has already been existence-validated up-front (lines 64 / 70).
  // No re-check here — if the file vanished mid-run, let Pandoc fail loudly
  // on the open() rather than silently dropping the metadata and emitting
  // MISSING-CITATION:* for every cite.
  if (refsPath) {
    args.push('--metadata', `references_path:${refsPath}`);
  }
  for (const f of FILTER_CHAIN) {
    args.push(`--lua-filter=${resolve(ROOT, f)}`);
  }
  return args;
}

// Derived title — used for both PDF (template's $title$ → custom Lemma Press
// title page) and EPUB (--metadata title=). Without this, PDF builds for real
// studies (whose staged main.md has no YAML frontmatter) skip the title page
// because the template's $if(title)$ guard never fires.
const docTitle = deriveTitle(mainMd, values.slug);

// 4. PDF build.
const pdfPath = join(outDir, `${values.slug}.pdf`);
const templateName = `templates/${values.variant}.tex`;
execFileSync('pandoc', [
  ...pandocCommon(),
  '--to=pdf',
  '--pdf-engine=lualatex',
  `--template=${resolve(ROOT, templateName)}`,
  `--variable=stylefile:${STYLE_TEX}`,
  '--metadata', `title=${docTitle}`,
  '-o', pdfPath,
], { cwd: ROOT, stdio: 'inherit' });

// 5. EPUB build.
const epubPath = join(outDir, `${values.slug}.epub`);

// EPUB OPF metadata fragment — Pandoc merges dc:* elements into package OPF.
// NOTE: Pandoc 3.x silently drops <meta property="..."> from --epub-metadata;
// schema:* accessibility properties are injected via post-processing (step 5b).
const epubTitle = docTitle;
const epubMetaFile = join(outDir, 'epub-metadata.xml');
const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
writeFileSync(epubMetaFile,
`<dc:title>${xmlEscape(epubTitle)}</dc:title>
<dc:language>en-US</dc:language>
<dc:publisher>Lemma Press</dc:publisher>
<dc:subject>Theology</dc:subject>
<dc:description>A Lemma Press SCAR-framework theological study.</dc:description>
<dc:rights>Copyright \u00a9 ${new Date().getFullYear()} the author. All rights reserved.</dc:rights>
`);

execFileSync('pandoc', [
  ...pandocCommon(),
  '--to=epub3',
  `--epub-metadata=${epubMetaFile}`,
  // --metadata title= sets the HTML <title> in XHTML pages (suppresses Pandoc warning).
  // dc:title in the OPF comes from the epub-metadata fragment above.
  '--metadata', `title=${epubTitle}`,
  `--css=${epubCss}`,
  '--toc',
  '--toc-depth=2',
  '--epub-title-page=true',
  '-o', epubPath,
], { cwd: ROOT, stdio: 'inherit' });

// 5b. Inject EPUB 3 schema.org accessibility metadata into the OPF.
// Pandoc 3.x strips <meta property="..."> from --epub-metadata, so we patch
// the ZIP in-place using Python's stdlib zipfile module (no extra deps).
const a11ySummary = 'Long-form textual content with table of contents and structural headings; no time-based or sensory-dependent material.';
const schemaMeta = [
  `    <meta property="schema:accessMode">textual</meta>`,
  `    <meta property="schema:accessModeSufficient">textual</meta>`,
  `    <meta property="schema:accessibilityHazard">none</meta>`,
  `    <meta property="schema:accessibilityFeature">tableOfContents</meta>`,
  `    <meta property="schema:accessibilityFeature">readingOrder</meta>`,
  `    <meta property="schema:accessibilityFeature">structuralNavigation</meta>`,
  `    <meta property="schema:accessibilitySummary">${a11ySummary}</meta>`,
].join('\n');
// Pre-check python3 availability before attempting the patch so the error
// message is actionable rather than a raw ENOENT from execFileSync.
try { execFileSync('python3', ['--version'], { stdio: 'ignore' }); }
catch {
  console.error('build-book: python3 not found — EPUB accessibility metadata cannot be injected. Install python3.');
  process.exit(1);
}

const patchScript = `
import zipfile, os, shutil, sys
epub_path = sys.argv[1]
schema_meta = sys.argv[2]
tmp_path = epub_path + '.tmp'
with zipfile.ZipFile(epub_path, 'r') as z:
    opf_name = next(n for n in z.namelist() if n.endswith('.opf'))
    opf = z.read(opf_name).decode('utf-8')
    contents = {n: z.read(n) for n in z.namelist()}
if 'schema:accessMode' not in opf:
    new_opf = opf.replace('</metadata>', schema_meta + '\\n  </metadata>', 1)
else:
    new_opf = opf
contents[opf_name] = new_opf.encode('utf-8')
with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as z:
    if 'mimetype' in contents:
        z.writestr(zipfile.ZipInfo('mimetype'), contents['mimetype'].decode('utf-8'), compress_type=zipfile.ZIP_STORED)
    for name, data in contents.items():
        if name != 'mimetype':
            z.writestr(name, data)
os.replace(tmp_path, epub_path)
`;
execFileSync('python3', ['-c', patchScript, epubPath, schemaMeta], { cwd: ROOT, stdio: 'inherit' });

console.log(`build-book: wrote ${pdfPath}`);
console.log(`build-book: wrote ${epubPath}`);
