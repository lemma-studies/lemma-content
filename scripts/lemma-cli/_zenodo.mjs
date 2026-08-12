// _zenodo.mjs — shared helpers for Zenodo REST calls.
//
// Wraps the legacy /api/deposit/depositions endpoints (still supported on
// zenodo.org even after the InvenioRDM migration). Used by:
//   - scripts/zenodo-reserve-doi.mjs
//   - scripts/zenodo-publish.mjs
//   - scripts/zenodo-update-metadata.mjs
//
// Auth: pass ZENODO_ACCESS_TOKEN via env; scopes required are
// `deposit:write` + `deposit:actions` (matches the token generated on
// 2026-08-12 for GH secret ZENODO_ACCESS_TOKEN).
//
// Base URL: process.env.ZENODO_HOST (default https://zenodo.org).
// For sandbox testing, set ZENODO_HOST=https://sandbox.zenodo.org.

const DEFAULT_HOST = 'https://zenodo.org';

export function zenodoHost() {
  return process.env.ZENODO_HOST ?? DEFAULT_HOST;
}

// zenodo() — thin wrapper around fetch(). Throws ZenodoError with parsed
// body on non-2xx (unless {allowStatus:[…]} suppresses specific codes).
export async function zenodo(pathOrUrl, { method = 'GET', token, body, headers = {}, allowStatus = [] } = {}) {
  if (!token) throw new ZenodoError(0, 'auth', 'no token passed to zenodo()');
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${zenodoHost()}${pathOrUrl}`;
  const isJson = body && typeof body === 'object' && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: isJson ? JSON.stringify(body) : body,
  });
  if (!res.ok && !allowStatus.includes(res.status)) {
    let parsed;
    try { parsed = await res.json(); } catch { parsed = await res.text(); }
    throw new ZenodoError(res.status, method + ' ' + url, parsed);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

export class ZenodoError extends Error {
  constructor(status, where, body) {
    const msg = typeof body === 'string' ? body.slice(0, 200)
      : (body?.message || body?.errors?.[0]?.message || JSON.stringify(body).slice(0, 200));
    super(`Zenodo ${status} at ${where}: ${msg}`);
    this.status = status;
    this.where = where;
    this.body = body;
  }
}

// listMyDepositions() — list all depositions the token can see.
// The /api/deposit/depositions endpoint is implicitly scoped to the token
// owner's uploads (published + drafts). Filter client-side to find orphans.
export async function listMyDepositions({ token, q = '', size = 100, allVersions = false } = {}) {
  const params = new URLSearchParams({ size: String(size) });
  if (q) params.set('q', q);
  if (allVersions) params.set('all_versions', 'true');
  return zenodo(`/api/deposit/depositions?${params}`, { token });
}

// createFreshConceptDraft() — POST /api/deposit/depositions to create a
// brand-new deposition (no prior concept). Zenodo assigns a prereserved
// version DOI immediately; concept DOI is assigned at publish time.
// Returns the deposition object with metadata.prereserve_doi.
export async function createFreshConceptDraft({ token, metadata }) {
  return zenodo('/api/deposit/depositions', {
    method: 'POST',
    token,
    body: { metadata },
  });
}

// createNewVersionDraft() — POST /api/deposit/depositions/{parent_id}/actions/newversion
// creates a new draft linked to the concept of the parent (last published record).
// The response Location header points to the draft URL; we return the parsed
// deposition object after GETting it.
export async function createNewVersionDraft({ token, parentId }) {
  await zenodo(`/api/deposit/depositions/${parentId}/actions/newversion`, {
    method: 'POST',
    token,
  });
  // The response is the OLD deposition with `links.latest_draft` pointing to the new one.
  const refreshed = await zenodo(`/api/deposit/depositions/${parentId}`, { token });
  const draftUrl = refreshed?.links?.latest_draft;
  if (!draftUrl) throw new ZenodoError(0, 'newversion', 'no latest_draft link on refreshed parent');
  return zenodo(draftUrl, { token });
}

// updateDepositionMetadata() — PUT /api/deposit/depositions/{id}
export async function updateDepositionMetadata({ token, id, metadata }) {
  return zenodo(`/api/deposit/depositions/${id}`, {
    method: 'PUT',
    token,
    body: { metadata },
  });
}

// getDeposition() — GET a single deposition by id.
export async function getDeposition({ token, id }) {
  return zenodo(`/api/deposit/depositions/${id}`, { token });
}

// listDepositionFiles() — GET files on a draft/deposition.
export async function listDepositionFiles({ token, id }) {
  return zenodo(`/api/deposit/depositions/${id}/files`, { token });
}

// deleteDepositionFile() — DELETE a file on a draft.
export async function deleteDepositionFile({ token, id, fileId }) {
  return zenodo(`/api/deposit/depositions/${id}/files/${fileId}`, {
    method: 'DELETE',
    token,
    allowStatus: [204],
  });
}

// uploadDepositionFile() — legacy multipart POST to /files.
// For newer file bucket API, use uploadToBucket() instead.
export async function uploadDepositionFile({ token, id, filename, contentBytes }) {
  const form = new FormData();
  form.set('name', filename);
  // FormData wants a Blob; wrap the Uint8Array
  form.set('file', new Blob([contentBytes]), filename);
  const res = await fetch(`${zenodoHost()}/api/deposit/depositions/${id}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    let parsed;
    try { parsed = await res.json(); } catch { parsed = await res.text(); }
    throw new ZenodoError(res.status, `upload ${filename}`, parsed);
  }
  return res.json();
}

// uploadToBucket() — newer files API. bucketUrl comes from
// deposition.links.bucket. PUT /{bucketUrl}/{filename} with raw bytes.
// Preferred over uploadDepositionFile when available (larger file limit,
// resumable).
export async function uploadToBucket({ token, bucketUrl, filename, contentBytes }) {
  const res = await fetch(`${bucketUrl}/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: contentBytes,
  });
  if (!res.ok) {
    let parsed;
    try { parsed = await res.json(); } catch { parsed = await res.text(); }
    throw new ZenodoError(res.status, `upload ${filename} to bucket`, parsed);
  }
  return res.json();
}

// publishDeposition() — POST publish action. After success, the DOI is minted
// and the record becomes public. `conceptdoi` in the response is authoritative.
export async function publishDeposition({ token, id }) {
  return zenodo(`/api/deposit/depositions/${id}/actions/publish`, {
    method: 'POST',
    token,
  });
}

// findLatestPublishedByConcept() — locate the most-recent published record
// on a given concept DOI. Uses all_versions=true to include non-latest.
// Returns the newest published deposition or null if none found.
export async function findLatestPublishedByConcept({ token, conceptDoi }) {
  const list = await listMyDepositions({
    token,
    q: `conceptdoi:"${conceptDoi}"`,
    size: 100,
    allVersions: true,
  });
  const published = (list || []).filter(d => d.submitted === true || d.state === 'done');
  if (published.length === 0) return null;
  published.sort((a, b) => (b.record_id || 0) - (a.record_id || 0));
  return published[0];
}

// findOrphanDrafts() — for PATH-A orphan-draft reuse. List all my drafts,
// filter to matches on title and unpublished state, cross-check against
// study.yaml.versions[].version_doi to identify orphans.
// Returns array of orphan draft depositions (may be empty).
export async function findOrphanDraftsMatching({ token, title, knownVersionDois = [] }) {
  const list = await listMyDepositions({ token, q: `title:"${title.replace(/"/g, '\\"')}"`, size: 100 });
  const drafts = (list || []).filter(d => d.submitted === false || d.state === 'inprogress' || d.state === 'unsubmitted');
  const known = new Set(knownVersionDois.filter(Boolean));
  return drafts.filter(d => {
    const doi = d?.metadata?.prereserve_doi?.doi ?? d?.metadata?.doi ?? null;
    return doi && !known.has(doi);
  });
}
