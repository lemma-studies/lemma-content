#!/usr/bin/env node
// scripts/zenodo-reserve-doi.mjs --study <slug> --version vN.N
//
// Reserves DOIs on Zenodo for a study/version pair pre-tag. Two-path logic
// per design §6.3 + R7 A1:
//
//   PATH A — fresh concept: study.yaml.concept_doi is null. Create a new
//     Zenodo deposition (unpublished draft) with metadata referencing
//     base_url from data/phase-state.yaml. Reserve DOI. Write both
//     concept_doi and versions[first].version_doi to study.yaml.
//
//   PATH B — new version on existing concept: study.yaml.concept_doi
//     resolves. Query Zenodo for the latest published version on this
//     concept. Call POST /records/{id}/versions to create a new draft
//     linked to the concept. Reserve DOI. Write versions[N].version_doi
//     to study.yaml.
//
//   ORPHAN DRAFT REUSE: before creating a new draft, list drafts on the
//     concept. If exactly one orphan (unpublished) draft exists with no
//     matching study.yaml.versions entry, adopt it and skip creation.
//     If > 1 orphan exists → refuse (zenodo-draft-collision failure mode,
//     autonomy: human-gate).
//
// Env:
//   ZENODO_ACCESS_TOKEN   PAT with deposit:write + deposit:actions scopes
//   ZENODO_HOST           default https://zenodo.org; override for sandbox
//
// Exit: 0 = reserved, 1 = fail, 2 = usage, 3 = human-gate (draft collision).

import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { parseArgs, isJsonMode, REPO_ROOT, loadPhaseState } from './lemma-cli/_common.mjs';
import {
  createFreshConceptDraft, createNewVersionDraft, updateDepositionMetadata,
  findLatestPublishedByConcept, findOrphanDraftsMatching, listMyDepositions,
  getDeposition, ZenodoError,
} from './lemma-cli/_zenodo.mjs';

const args = parseArgs(process.argv.slice(2));
const slug = args.values.get('study');
const version = args.values.get('version');
const jsonMode = isJsonMode(args);
const verbose = args.flags.has('verbose');
const check = args.flags.has('check');
const dryRun = args.flags.has('dry-run');

function report(obj, extra = {}) {
  const full = { timestamp: new Date().toISOString(), slug, version, ...obj, ...extra };
  if (jsonMode) console.log(JSON.stringify(full, null, 2));
  else {
    const summary = `zenodo-reserve-doi ${slug}/${version}: ${obj.status}`;
    console.log(summary);
    if (verbose) console.log(JSON.stringify(full, null, 2));
    else if (obj.reason) console.log(`  ${obj.reason}`);
    else if (obj.version_doi) console.log(`  version_doi=${obj.version_doi}  concept_doi=${obj.concept_doi ?? '(assigned at publish)'}`);
  }
  return full;
}

if (!slug || !version) {
  console.error('usage: zenodo-reserve-doi --study <slug> --version vN.N [--check|--dry-run] [--json] [--verbose]');
  process.exit(2);
}

const phase = loadPhaseState();
const baseUrl = phase.base_url;

const studyYamlPath = path.join(REPO_ROOT, 'studies', slug, 'study.yaml');
if (!fs.existsSync(studyYamlPath)) {
  report({ status: 'fail', reason: `study.yaml not found at ${studyYamlPath}` });
  process.exit(1);
}
const study = yamlLoad(fs.readFileSync(studyYamlPath, 'utf8'));

const token = process.env.ZENODO_ACCESS_TOKEN;
if (!token) {
  report({ status: 'skipped', reason: 'ZENODO_ACCESS_TOKEN not set' });
  process.exit(check ? 1 : 0);
}

const pathTaken = study.concept_doi ? 'PATH-B-newversion' : 'PATH-A-fresh-concept';

// Metadata that would be sent to Zenodo. Built up-front so --dry-run can
// print it without any network activity.
const proposedMetadata = {
  title: study.title,
  creators: [{ name: formatCreatorName(study.author), orcid: study.orcid ?? undefined }],
  description: buildDescription(study, slug, version, baseUrl),
  version,
  upload_type: 'publication',
  publication_type: 'article',
  license: 'cc-by-4.0',
  publication_date: (study.versions?.find(v => v.version === version)?.date) ?? study.current_version_date ?? new Date().toISOString().slice(0, 10),
  related_identifiers: [
    { relation: 'isVersionOf', identifier: `${baseUrl}/${slug}/`, resource_type: 'publication-article' },
    { relation: 'isDocumentedBy', identifier: `https://github.com/lemma-studies/lemma-content/tree/${slug}/${version}`, resource_type: 'software' },
  ],
  access_right: 'open',
};

function formatCreatorName(displayName) {
  // Zenodo prefers "Family, Given" for creator names. Convert "E. Timothy Uy" → "Uy, E. Timothy".
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return displayName;
  const family = parts.pop();
  const given = parts.join(' ');
  return `${family}, ${given}`;
}

function buildDescription(study, slug, version, baseUrl) {
  return `<p>Version ${version} of "${escapeHtml(study.title)}" — a lemma-studies exegetical work published under the Lemma Press imprint.</p>` +
    `<p>Canonical URL: <a href="${baseUrl}/${slug}/">${baseUrl}/${slug}/</a></p>` +
    `<p>This version: <a href="${baseUrl}/${slug}/versions/${version}/">${baseUrl}/${slug}/versions/${version}/</a></p>` +
    `<p>Source repository: <a href="https://github.com/lemma-studies/lemma-content">github.com/lemma-studies/lemma-content</a> (tag <code>${slug}/${version}</code>)</p>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  // --check: verify token + inspect state; no mutation.
  if (check) {
    try {
      const mine = await listMyDepositions({ token, size: 1 });
      const orphans = pathTaken === 'PATH-A-fresh-concept'
        ? await findOrphanDraftsMatching({ token, title: study.title, knownVersionDois: (study.versions || []).map(v => v.version_doi) })
        : [];
      const latestPublished = pathTaken === 'PATH-B-newversion' && study.concept_doi
        ? await findLatestPublishedByConcept({ token, conceptDoi: study.concept_doi })
        : null;
      return report({
        status: 'ok',
        path: pathTaken,
        base_url: baseUrl,
        token_valid: Array.isArray(mine),
        orphans_matching_title: orphans.length,
        latest_published_id: latestPublished?.id ?? null,
        proposed_metadata: proposedMetadata,
      });
    } catch (e) {
      return report({ status: 'fail', reason: e.message, path: pathTaken });
    }
  }

  // --dry-run: print the payload, no mutation.
  if (dryRun) {
    return report({
      status: 'dry-run',
      path: pathTaken,
      base_url: baseUrl,
      proposed_metadata: proposedMetadata,
    });
  }

  // Real mutation path.
  try {
    let created;
    if (pathTaken === 'PATH-A-fresh-concept') {
      const orphans = await findOrphanDraftsMatching({
        token,
        title: study.title,
        knownVersionDois: (study.versions || []).map(v => v.version_doi),
      });
      if (orphans.length > 1) {
        return report({ status: 'human-gate', reason: `${orphans.length} orphan drafts match title — refusing (zenodo-draft-collision)`, orphan_ids: orphans.map(o => o.id) })
          && process.exit(3);
      }
      if (orphans.length === 1) {
        created = orphans[0];
        // Refresh metadata to be sure we have the latest published_date + description.
        created = await updateDepositionMetadata({ token, id: created.id, metadata: proposedMetadata });
      } else {
        created = await createFreshConceptDraft({ token, metadata: proposedMetadata });
      }
    } else {
      // PATH-B
      const parent = await findLatestPublishedByConcept({ token, conceptDoi: study.concept_doi });
      if (!parent) {
        return report({ status: 'fail', reason: `concept_doi ${study.concept_doi} has no published records on Zenodo — orphan concept in study.yaml`, path: pathTaken });
      }
      created = await createNewVersionDraft({ token, parentId: parent.id });
      // Update metadata for the new version.
      created = await updateDepositionMetadata({ token, id: created.id, metadata: proposedMetadata });
    }

    const versionDoi = created?.metadata?.prereserve_doi?.doi ?? created?.metadata?.doi ?? null;
    const conceptDoi = created?.conceptdoi ?? created?.metadata?.conceptdoi ?? null;
    if (!versionDoi) {
      return report({ status: 'fail', reason: 'no prereserve_doi on created draft', deposition_id: created?.id });
    }

    // Write back to study.yaml (idempotent — only sets fields that were null).
    const changed = writeBackToStudyYaml({ studyYamlPath, version, versionDoi, conceptDoi });

    return report({
      status: 'reserved',
      path: pathTaken,
      deposition_id: created.id,
      version_doi: versionDoi,
      concept_doi: conceptDoi,
      study_yaml_changed: changed,
    });
  } catch (e) {
    return report({ status: 'fail', reason: e.message, path: pathTaken, error_body: e instanceof ZenodoError ? e.body : undefined });
  }
}

function writeBackToStudyYaml({ studyYamlPath, version, versionDoi, conceptDoi }) {
  const doc = yamlLoad(fs.readFileSync(studyYamlPath, 'utf8'));
  let changed = false;
  if (conceptDoi && !doc.concept_doi) {
    doc.concept_doi = conceptDoi;
    changed = true;
  }
  const versions = doc.versions || (doc.versions = []);
  let entry = versions.find(v => v.version === version);
  if (!entry) {
    entry = { version, date: (doc.current_version_date ?? new Date().toISOString().slice(0, 10)) };
    versions.push(entry);
    changed = true;
  }
  if (!entry.version_doi) {
    entry.version_doi = versionDoi;
    changed = true;
  }
  if (!changed) return false;
  // Atomic write.
  const tmp = studyYamlPath + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, yamlDump(doc, { lineWidth: -1 }));
  fs.renameSync(tmp, studyYamlPath);
  return true;
}

main().then(r => process.exit(r.status === 'fail' ? 1 : 0));
