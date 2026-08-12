#!/usr/bin/env node
/**
 * publish.js — top-level CLI that wires build + validate + ISBN allocation +
 * MANIFEST stamping for a single Lemma study.
 *
 * Owning task: Task 16 (+ Amendment 001 override discovery + manifest provenance).
 *
 * Pipeline:
 *   1. Load ISBN pool YAML (errors if missing).
 *   2. Load or initialize release/<slug>/MANIFEST.json.
 *   3. Allocate one ISBN per requested format from the pool (idempotent —
 *      if MANIFEST already has format+edition, the existing ISBN is reused).
 *   4. Resolve style override (CLI --style-override wins; else auto-discover
 *      <in>/_publish/style-override.yaml; else null).
 *   5. Compute style_resolved (deep-merged with house style) and a path-level
 *      diff (style_overrides_applied) — see Amendment 001.
 *   6. Invoke scripts/build-book.js (forwarding --style-override).
 *   7. Invoke scripts/validate.js. Soft-gate by default: non-zero exit is
 *      caught; reports/summary.json is read into manifest.validation; build
 *      continues. --strict-validate re-throws (CI / pilot use).
 *   8. Copy build/<slug>/<slug>.{pdf,epub} into release/<slug>/.
 *   9. Write MANIFEST.json with deterministic key order.
 *  10. Persist updated pool back to disk.
 *
 * CLI:
 *   node scripts/publish.js --slug=NAME --variant=book|pamphlet|omnibus \
 *        --in=PATH --isbn-pool=PATH [--formats=paperback,kindle] \
 *        [--style-override=PATH] [--strict-validate]
 *
 * Exit codes:
 *   0   successful publish
 *   1   build failure (build-book.js threw) or validate failure under --strict-validate
 *   2   arg-validation failure
 *   3   ISBN pool exhausted
 *
 * Strictness is enforced in publish.js, not in validate.js itself —
 * `node scripts/validate.js --slug=foo` always uses its own pass/fail
 * semantics; `--strict-validate` is a publish-level concern.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';

/**
 * Deep-merge an override into a base config. Mirrors style-codegen.js#mergeStyle
 * exactly (objects merge, arrays + scalars replace wholesale).
 *
 * Why inlined rather than imported: scripts/style-codegen.js executes parseArgs
 * at module top level against the importer's process.argv, which makes its
 * import not side-effect-free under our CLI args (--slug etc. are unknown
 * options to that file's parser and abort the import). Refinement note #8
 * predicted the import would be safe; the runtime check failed. Keeping the
 * implementation in lockstep with the codegen one is enforced by the
 * style-override Amendment 001 regression test in tests/publish.test.js.
 *
 * TODO(Task 4 follow-up): align mergeStyle null-clearing semantics with
 * diffPaths fidelity. Both this function and diffPaths currently treat
 * `null` overrides as wholesale replacements; revisit once style-codegen.js
 * documents the canonical null-clearing contract.
 */
function mergeStyle(base, override) {
  if (override === undefined) return base;
  if (base === null || typeof base !== 'object' || Array.isArray(base)) return override;
  if (override === null || typeof override !== 'object' || Array.isArray(override)) return override;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    out[k] = mergeStyle(base[k], override[k]);
  }
  return out;
}

const ROOT = resolve(import.meta.dirname, '..');

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function loadPool(path) {
  if (!existsSync(path)) {
    console.error(`publish: ISBN pool not found at ${path}. Create it per docs/publishing/PIPELINE-TOOLCHAIN.md § ISBN pool.`);
    process.exit(2);
  }
  const data = yaml.load(readFileSync(path, 'utf8'));
  // Defensive: an empty file or minimal stub still needs the array shapes.
  if (!data || typeof data !== 'object') {
    console.error(`publish: ISBN pool at ${path} is empty or not a YAML mapping.`);
    process.exit(2);
  }
  data.assignments ??= [];
  data.unassigned ??= [];
  return data;
}

function savePool(path, pool) {
  // lineWidth: -1 disables js-yaml's default 80-col wrapping (ISBNs and other
  // long fields stay on one line); noRefs: true suppresses YAML anchors for
  // shared subtrees. Caveat: js-yaml has no comment-preservation pass, so any
  // operator-added comments in isbn-pool.yaml are erased on every publish run.
  // See docs/publishing/playbooks/11-publish.md § "Pool file maintenance".
  writeFileSync(path, yaml.dump(pool, { lineWidth: -1, noRefs: true }));
}

function loadOrInitManifest(slug, releaseDir) {
  const f = join(releaseDir, 'MANIFEST.json');
  if (existsSync(f)) {
    const m = JSON.parse(readFileSync(f, 'utf8'));
    m.editions ??= [];
    return m;
  }
  return {
    title: slug,
    slug,
    editions: [],
  };
}

/**
 * Idempotent ISBN allocation: if the manifest already has an entry for this
 * format+edition, return the recorded ISBN; otherwise pop one off the pool
 * and append matching entries to both manifest.editions and pool.assignments.
 */
function ensureIsbn(manifest, format, pool, slug, edition = 1) {
  const existing = manifest.editions.find(
    e => e.format === format && e.edition === edition,
  );
  if (existing) return existing.isbn;

  const isbn = pool.unassigned.shift();
  if (!isbn) {
    console.error('publish: ISBN pool exhausted. Buy a new block from Bowker.');
    process.exit(3);
  }

  const today = new Date().toISOString().slice(0, 10);
  pool.assignments.push({
    isbn, title: slug, format, edition, assigned: today,
  });
  manifest.editions.push({
    format, edition, revision: '1.0', isbn, published: today,
  });
  return isbn;
}

/**
 * Path-level diff between two configs. Used to record which leaves of the
 * house style were mutated by an override (manifest.style_overrides_applied).
 *
 * Mirrors the merge contract in style-codegen.js#mergeStyle: arrays + scalars
 * are leaf replacements; only plain objects recurse. Array equality is by
 * reference (the merge replaces wholesale), so a from/to entry with array
 * values is the right answer if either side disagrees.
 */
function diffPaths(base, merged, prefix = '') {
  const out = [];
  if (base === merged) return out;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(base) || !isObj(merged)) {
    if (base !== merged) {
      out.push({ path: prefix.replace(/^\./, ''), from: base ?? null, to: merged ?? null });
    }
    return out;
  }

  const keys = new Set([...Object.keys(base), ...Object.keys(merged)]);
  for (const k of keys) {
    out.push(...diffPaths(base[k], merged[k], `${prefix}.${k}`));
  }
  return out;
}

/**
 * Pin MANIFEST.json key order so future diffs are readable (refinement #5).
 * Keys absent from the input are dropped (rather than emitted as null) — only
 * fields the pipeline has actually computed should appear.
 */
function pinManifestOrder(m) {
  const ORDER = [
    'title',
    'slug',
    'git_sha',
    'build_timestamp',
    'editions',
    'style_resolved',
    'style_overrides_applied',
    'validation',
  ];
  const out = {};
  for (const k of ORDER) {
    if (m[k] !== undefined) out[k] = m[k];
  }
  // Preserve any future-added fields after the pinned ones.
  for (const k of Object.keys(m)) {
    if (!ORDER.includes(k)) out[k] = m[k];
  }
  return out;
}

function runValidate(slug, strict) {
  const buildDir = resolve(ROOT, 'build', slug);
  const summaryPath = join(buildDir, 'reports', 'summary.json');

  // validate.js writes summary.json regardless of pass/fail (Task 15
  // contract). Wrap in try/catch so a non-zero exit doesn't abort publish.
  let exited = 0;
  try {
    execFileSync('node', [
      'scripts/validate.js',
      `--slug=${slug}`,
    ], { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    exited = e.status ?? 1;
  }

  let summary;
  if (existsSync(summaryPath)) {
    try {
      summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
    } catch (parseErr) {
      summary = {
        error: `summary.json parse failed: ${parseErr.message}`,
        exit_code: exited,
      };
    }
  } else {
    summary = {
      skipped: true,
      reason: 'validate.js did not produce reports/summary.json (toolchain likely missing)',
      exit_code: exited,
    };
  }

  if (exited !== 0) {
    if (strict) {
      console.error(`publish: validate exited ${exited} and --strict-validate is set; failing.`);
      process.exit(1);
    }
    console.error(
      `publish: validate found issues (exit=${exited}); see release/${slug}/MANIFEST.json#validation (per-tool detail in build/${slug}/reports/summary.json)`,
    );
  }

  // Defense-in-depth: validate.js may exit 0 while still recording an
  // overall_ok: false in summary.json (e.g., if the runner is changed to
  // soft-fail by default, or a future tool is added that warns rather than
  // exits). Treat overall_ok===false as a publish-level gate failure under
  // --strict-validate; in soft mode the summary is already stamped, so a
  // single-line warning is enough.
  if (exited === 0 && summary && summary.overall_ok === false) {
    if (strict) {
      console.error(`publish: validate reported overall_ok=false and --strict-validate is set; failing.`);
      process.exit(1);
    }
    console.error(
      `publish: validate reported overall_ok=false; see release/${slug}/MANIFEST.json#validation (per-tool detail in build/${slug}/reports/summary.json)`,
    );
  }

  return summary;
}

function main() {
  const { values } = parseArgs({
    options: {
      slug:              { type: 'string' },
      variant:           { type: 'string', default: 'book' },
      in:                { type: 'string' },
      'isbn-pool':       { type: 'string' },
      formats:           { type: 'string', default: 'paperback,kindle' },
      'style-override':  { type: 'string' },
      'strict-validate': { type: 'boolean', default: false },
    },
  });

  for (const k of ['slug', 'in', 'isbn-pool']) {
    if (!values[k]) {
      console.error(`publish: missing required --${k}`);
      console.error('usage: publish.js --slug=NAME --variant=book|pamphlet|omnibus --in=PATH --isbn-pool=PATH [--formats=paperback,kindle] [--style-override=PATH] [--strict-validate]');
      process.exit(2);
    }
  }

  // Slug is interpolated into release/<slug>/ and build/<slug>/ paths; reject
  // anything that could traverse out of those dirs or break filename round-trips.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(values.slug)) {
    console.error('publish: --slug must match /^[a-z0-9][a-z0-9-]*$/');
    process.exit(2);
  }

  const slug = values.slug;
  const inputDir = resolve(values.in);
  const formats = values.formats.split(',').map(s => s.trim()).filter(Boolean);

  // 1. Pool.
  const pool = loadPool(values['isbn-pool']);

  // 2. Release dir + manifest.
  const releaseDir = resolve(ROOT, 'release', slug);
  mkdirSync(releaseDir, { recursive: true });
  const manifest = loadOrInitManifest(slug, releaseDir);

  // 3. Allocate ISBNs (idempotent).
  for (const fmt of formats) ensureIsbn(manifest, fmt, pool, slug);

  // 4. Resolve style override (CLI flag > auto-discovered).
  const autoOverride = join(inputDir, '_publish', 'style-override.yaml');
  let overridePath = null;
  if (values['style-override']) {
    overridePath = resolve(values['style-override']);
    if (!existsSync(overridePath)) {
      console.error(`publish: --style-override=${overridePath} does not exist`);
      process.exit(2);
    }
  } else if (existsSync(autoOverride)) {
    overridePath = autoOverride;
  }
  if (overridePath) {
    console.error(`publish: using style override: ${overridePath}`);
  }

  // 5. Compute merged style + diff.
  const houseStyle = yaml.load(
    readFileSync(resolve(ROOT, 'lemma-house-style.yaml'), 'utf8'),
  );
  let styleResolved = houseStyle;
  let styleOverridesApplied = [];
  if (overridePath) {
    const override = yaml.load(readFileSync(overridePath, 'utf8'));
    styleResolved = mergeStyle(houseStyle, override);
    styleOverridesApplied = diffPaths(houseStyle, styleResolved);
  }

  // 6. Build.
  const buildArgs = [
    'scripts/build-book.js',
    `--slug=${slug}`,
    `--variant=${values.variant}`,
    `--in=${inputDir}`,
  ];
  if (overridePath) buildArgs.push(`--style-override=${overridePath}`);
  execFileSync('node', buildArgs, { cwd: ROOT, stdio: 'inherit' });

  // 7. Validate (soft-gate; --strict-validate re-throws).
  const validation = runValidate(slug, values['strict-validate']);

  // 8. Copy artifacts into release dir.
  const buildDir = resolve(ROOT, 'build', slug);
  copyFileSync(join(buildDir, `${slug}.pdf`),  join(releaseDir, `${slug}.pdf`));
  copyFileSync(join(buildDir, `${slug}.epub`), join(releaseDir, `${slug}.epub`));

  // 9. Final manifest with pinned key order.
  manifest.title = manifest.title ?? slug;
  manifest.slug = slug;
  manifest.git_sha = gitSha();
  manifest.build_timestamp = new Date().toISOString();
  manifest.style_resolved = styleResolved;
  manifest.style_overrides_applied = styleOverridesApplied;
  manifest.validation = validation;

  const ordered = pinManifestOrder(manifest);
  writeFileSync(
    join(releaseDir, 'MANIFEST.json'),
    JSON.stringify(ordered, null, 2) + '\n',
  );

  // 10. Persist pool.
  savePool(values['isbn-pool'], pool);

  console.log(`published to ${releaseDir}`);
}

main();
