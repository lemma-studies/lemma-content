#!/usr/bin/env node
// scripts/zenodo-publish.mjs --study <slug> --version vN.N [--assets-dir <path>]
//
// Job 3 (doi-publish) per design §6.3. Called after Job 2 lands the Release
// with composite + rag + PDF artifacts.
//
// Steps (idempotent per §6.3 Job 3 table):
//   3a Read reserved concept + version DOIs from studies/<slug>/study.yaml
//   3b Query Zenodo: does concept have published version metadata.version == vN.N?
//      → Skip if yes (idempotent short-circuit for CI reruns).
//   3c Delete the draft's inherited files; upload composite + rag + PDF
//   3d PUBLISH the deposit. Metadata references URLs constructed from
//      data/phase-state.yaml.base_url (during Phases 2b-3 the .pages.dev
//      preview; flipped to lemma.gig8.com at Phase 4 exit by
//      zenodo-update-metadata.mjs).
//
// Refuses to publish when data/phase-state.yaml.release_publish_unlocked is
// false — reservations only pre-Phase-3.
//
// Env: ZENODO_ACCESS_TOKEN, ZENODO_HOST (optional)
// Exit: 0 = published (or already-published; idempotent), 1 = fail, 2 = usage.

import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { parseArgs, isJsonMode, REPO_ROOT, loadPhaseState } from './lemma-cli/_common.mjs';
import {
  getDeposition, listDepositionFiles, deleteDepositionFile,
  uploadToBucket, uploadDepositionFile, publishDeposition,
  findLatestPublishedByConcept, listMyDepositions, ZenodoError,
} from './lemma-cli/_zenodo.mjs';

const args = parseArgs(process.argv.slice(2));
const slug = args.values.get('study');
const version = args.values.get('version');
const assetsDir = args.values.get('assets-dir') ?? process.cwd();
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const check = args.flags.has('check');
const dryRun = args.flags.has('dry-run');

function report(obj) {
  const full = { timestamp: new Date().toISOString(), slug, version, ...obj };
  if (jsonMode) console.log(JSON.stringify(full, null, 2));
  else {
    console.log(`zenodo-publish ${slug}/${version}: ${obj.status}`);
    if (verbose) console.log(JSON.stringify(full, null, 2));
    else if (obj.reason) console.log(`  ${obj.reason}`);
    else if (obj.record_url) console.log(`  ${obj.record_url}  (concept: ${obj.concept_doi ?? '?'})`);
  }
  return full;
}

if (!slug || !version) {
  console.error('usage: zenodo-publish --study <slug> --version vN.N [--assets-dir <path>] [--check|--dry-run] [--json]');
  process.exit(2);
}

const phase = loadPhaseState();
if (!phase.release_publish_unlocked && !check && !dryRun) {
  report({ status: 'refused', reason: 'release_publish_unlocked=false in data/phase-state.yaml — refusing to publish. Pre-Phase-3 reservations only.' });
  process.exit(1);
}

const studyYamlPath = path.join(REPO_ROOT, 'studies', slug, 'study.yaml');
if (!fs.existsSync(studyYamlPath)) {
  report({ status: 'fail', reason: `study.yaml missing at ${studyYamlPath}` });
  process.exit(1);
}
const study = yamlLoad(fs.readFileSync(studyYamlPath, 'utf8'));
const versionEntry = (study.versions ?? []).find(v => v.version === version);
if (!versionEntry) {
  report({ status: 'fail', reason: `version ${version} not in study.yaml.versions[]` });
  process.exit(1);
}
if (!versionEntry.version_doi) {
  report({ status: 'fail', reason: `versions[${version}].version_doi is null — run zenodo-reserve-doi first` });
  process.exit(1);
}

const token = process.env.ZENODO_ACCESS_TOKEN;
if (!token) {
  report({ status: 'skipped', reason: 'ZENODO_ACCESS_TOKEN not set' });
  process.exit(check ? 1 : 0);
}

// Expected assets — must all exist before publish.
const composite = path.join(assetsDir, `${slug}-${version}.md`);
const rag       = path.join(assetsDir, `${slug}-${version}.rag.md`);
const pdf       = path.join(assetsDir, `${slug}-${version}.pdf`);
const assets = [
  { path: composite, filename: `${slug}-${version}.md` },
  { path: rag,       filename: `${slug}-${version}.rag.md` },
  { path: pdf,       filename: `${slug}-${version}.pdf` },
];
const missing = assets.filter(a => !fs.existsSync(a.path));

async function findDepositionByVersionDoi(versionDoi) {
  // Zenodo DOIs encode the recid in the trailing numeric segment
  // (e.g. 10.5281/zenodo.21907595 → recid 21907595). Direct GET is reliable
  // for DRAFTS whose prereserve_doi isn't in the public search index.
  const zenodoRecidMatch = versionDoi.match(/(?:^|[.\/])(\d+)$/);
  if (zenodoRecidMatch) {
    const recid = zenodoRecidMatch[1];
    try {
      return await getDeposition({ token, id: recid });
    } catch (e) {
      // Fall through to search on 404 / auth mismatch; log if verbose.
      if (verbose) console.error(`direct GET /depositions/${recid} failed: ${e.message}`);
    }
  }
  // Search fallback — only reliable for PUBLISHED records (doi: search index).
  const list = await listMyDepositions({
    token,
    q: `doi:"${versionDoi}"`,
    size: 20,
    allVersions: true,
  });
  return (list || []).find(d => {
    const doi = d?.metadata?.doi ?? d?.metadata?.prereserve_doi?.doi;
    return doi === versionDoi;
  }) || null;
}

async function main() {
  // 3a — Load context.
  const versionDoi = versionEntry.version_doi;

  // 3b — Idempotency: does a published record already exist for this concept+version?
  if (study.concept_doi) {
    try {
      const latest = await findLatestPublishedByConcept({ token, conceptDoi: study.concept_doi });
      if (latest && latest.metadata?.version === version) {
        return report({
          status: 'already-published',
          record_id: latest.id,
          record_url: latest.links?.record_html ?? latest.links?.self_html,
          concept_doi: study.concept_doi,
          version_doi: latest.metadata?.doi ?? versionDoi,
        });
      }
    } catch (e) {
      // Non-fatal — proceed to attempt publish; publish itself is idempotent per-draft.
    }
  }

  // Locate the draft deposition holding our reserved DOI.
  let draft;
  try {
    draft = await findDepositionByVersionDoi(versionDoi);
  } catch (e) {
    return report({ status: 'fail', reason: e.message });
  }
  if (!draft) {
    return report({ status: 'fail', reason: `no draft found for version_doi=${versionDoi} — was reserve step run?` });
  }

  if (check) {
    return report({
      status: 'ok',
      base_url: phase.base_url,
      release_publish_unlocked: phase.release_publish_unlocked,
      concept_doi: study.concept_doi,
      version_doi: versionDoi,
      draft_id: draft.id,
      draft_state: draft.state ?? (draft.submitted ? 'submitted' : 'draft'),
      assets_expected: assets.map(a => a.path),
      assets_missing: missing.map(a => a.path),
    });
  }

  if (missing.length) {
    return report({ status: 'fail', reason: `missing assets: ${missing.map(a => a.path).join(', ')}` });
  }

  if (dryRun) {
    return report({
      status: 'dry-run',
      draft_id: draft.id,
      would_upload: assets.map(a => a.filename),
      would_publish: true,
    });
  }

  // 3c — Refresh draft state to get bucket URL + existing files.
  try {
    draft = await getDeposition({ token, id: draft.id });
  } catch (e) {
    return report({ status: 'fail', reason: `getDeposition ${draft.id}: ${e.message}` });
  }

  // If the draft is already `submitted` (published), that's the idempotent case
  // where the concept-check above didn't match (e.g., first PATH-A publish).
  if (draft.submitted === true || draft.state === 'done') {
    return report({
      status: 'already-published',
      record_id: draft.id,
      record_url: draft.links?.record_html ?? draft.links?.self_html,
      concept_doi: draft.conceptdoi ?? study.concept_doi ?? null,
      version_doi: draft.metadata?.doi ?? versionDoi,
    });
  }

  // Delete inherited files (from newversion → parent files carry over).
  try {
    const existingFiles = await listDepositionFiles({ token, id: draft.id });
    for (const f of existingFiles || []) {
      await deleteDepositionFile({ token, id: draft.id, fileId: f.id });
    }
  } catch (e) {
    // Non-fatal — proceed to upload; duplicate upload will fail loudly.
  }

  // Upload assets.
  const bucketUrl = draft.links?.bucket;
  for (const a of assets) {
    const contentBytes = fs.readFileSync(a.path);
    try {
      if (bucketUrl) {
        await uploadToBucket({ token, bucketUrl, filename: a.filename, contentBytes });
      } else {
        await uploadDepositionFile({ token, id: draft.id, filename: a.filename, contentBytes });
      }
    } catch (e) {
      return report({ status: 'fail', reason: `upload ${a.filename}: ${e.message}` });
    }
  }

  // 3d — Publish.
  let published;
  try {
    published = await publishDeposition({ token, id: draft.id });
  } catch (e) {
    return report({ status: 'fail', reason: `publish ${draft.id}: ${e.message}` });
  }

  // Write conceptdoi back to study.yaml if it wasn't set at reserve time
  // (PATH-A: concept DOI is assigned at first publish).
  const conceptDoi = published.conceptdoi ?? published.metadata?.conceptdoi ?? null;
  let studyYamlChanged = false;
  if (conceptDoi && !study.concept_doi) {
    const doc = yamlLoad(fs.readFileSync(studyYamlPath, 'utf8'));
    if (!doc.concept_doi) {
      doc.concept_doi = conceptDoi;
      const tmp = studyYamlPath + '.tmp.' + process.pid;
      fs.writeFileSync(tmp, yamlDump(doc, { lineWidth: -1 }));
      fs.renameSync(tmp, studyYamlPath);
      studyYamlChanged = true;
    }
  }

  return report({
    status: 'published',
    record_id: published.id,
    record_url: published.links?.record_html ?? `https://zenodo.org/record/${published.id}`,
    concept_doi: conceptDoi,
    version_doi: published.metadata?.doi ?? versionDoi,
    study_yaml_changed: studyYamlChanged,
  });
}

main().then(r => process.exit(r.status === 'fail' || r.status === 'refused' ? 1 : 0));
