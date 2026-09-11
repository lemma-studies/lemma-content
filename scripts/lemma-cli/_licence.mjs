// scripts/lemma-cli/_licence.mjs
//
// One table of study licences, and the rule that ties a study's licence and
// rights tier to the scripture it is anchored to (ADR 2026-08-12 §2.4).
//
// Publish paths (zenodo-reserve-doi, regenerate-corpus, update-huggingface-ds)
// take the licence from study.yaml through licenceInfo(), so an edition
// anchored to a CC-BY-SA Bible cannot be stamped CC BY 4.0. An unknown or
// missing licence throws; nothing defaults to CC BY.

import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { REPO_ROOT } from './_common.mjs';

export const LICENCES = {
  'cc-by-4.0': {
    name: 'CC BY 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    zenodo: 'cc-by-4.0',
  },
  'cc-by-sa-4.0': {
    name: 'CC BY-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    zenodo: 'cc-by-sa-4.0',
  },
};

export function normaliseLicence(id) {
  return typeof id === 'string' ? id.trim().toLowerCase() : null;
}

/** {id, name, url, zenodo} for a study licence; throws if unknown or missing. */
export function licenceInfo(id) {
  const key = normaliseLicence(id);
  const info = key ? LICENCES[key] : undefined;
  if (!info) {
    throw new Error(`unknown study licence ${JSON.stringify(id)}; known: ${Object.keys(LICENCES).join(', ')}`);
  }
  return { id: key, ...info };
}

export function loadBibleSources(root = REPO_ROOT) {
  return yamlLoad(fs.readFileSync(path.join(root, 'data', 'bible-sources.yaml'), 'utf8'));
}

/** Map of upgrade-candidate id → candidate, across every language. */
export function upgradeCandidates(sources) {
  const byId = new Map();
  for (const lang of Object.values(sources ?? {})) {
    for (const c of lang?.upgrade_candidates ?? []) {
      if (c && typeof c.id === 'string') byId.set(c.id, c);
    }
  }
  return byId;
}

/** 'sefaria-masoretic + heblb-biblica' → ['sefaria-masoretic', 'heblb-biblica']. */
export function scriptureAnchorIds(study) {
  const anchor = study?.translation_of?.scripture_anchor;
  if (typeof anchor !== 'string') return [];
  return anchor.split('+').map(s => s.trim()).filter(Boolean);
}

/**
 * Violations of ADR §2.4 for one study, as strings (empty when clean):
 *  - anchored to a candidate with edition_license → study.license must equal it;
 *  - anchored to a candidate held at private_pending_grant → so must the study be;
 *  - licensed cc-by-sa-4.0 without any such anchor → the primary edition must stay CC BY.
 */
export function editionLicenceViolations(study, candidates) {
  const out = [];
  const licence = normaliseLicence(study?.license);
  if (licence && !LICENCES[licence]) {
    out.push(`license=${study.license} is not a known study licence (${Object.keys(LICENCES).join(' | ')})`);
  }
  let shareAlikeAnchor = false;
  for (const id of scriptureAnchorIds(study)) {
    const c = candidates.get(id);
    if (!c) continue;
    if (c.edition_license) {
      shareAlikeAnchor = true;
      if (normaliseLicence(c.edition_license) !== licence) {
        out.push(`scripture_anchor ${id} is ${c.license}; study.license must be ${c.edition_license} (ADR §2.4), got ${study?.license ?? '(none)'}`);
      }
    }
    if (c.rights_tier_when_used === 'private_pending_grant' && study?.rights_tier !== 'private_pending_grant') {
      const why = c.publish_blocked_until ? `publish_blocked_until: ${c.publish_blocked_until}` : 'grant pending';
      out.push(`scripture_anchor ${id} requires rights_tier: private_pending_grant (${why}), got ${study?.rights_tier ?? 'full_public (default)'}`);
    }
  }
  if (licence === 'cc-by-sa-4.0' && !shareAlikeAnchor) {
    out.push('license cc-by-sa-4.0 is only for an edition anchored to an open-licence candidate (ADR §2.4); a primary edition stays cc-by-4.0');
  }
  return out;
}

/** verify-release gate: a study held at private_pending_grant must not publish. */
export function rightsTierPublishable(study) {
  if (study?.rights_tier === 'private_pending_grant') {
    return {
      status: 'fail',
      message: 'rights_tier is private_pending_grant: this study uses an anchor that is not cleared for publication',
      next_step: 'see the candidate in data/bible-sources.yaml (publish_blocked_until / grant status) before tagging',
    };
  }
  return { status: 'clean', message: `rights_tier ${study?.rights_tier ?? 'full_public (default)'} is publishable` };
}
