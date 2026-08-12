import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

// The lemma repo root — everything resolves off this.
export const LEMMA_ROOT = resolve(import.meta.dirname, '..', '..');

// Where lemma studies live.
export const VAULT_ROOT =
  process.env.LEMMA_VAULT_ROOT || '/mnt/c/Users/timuy/Dropbox/personal/Vault';

// Study lookup paths, first hit wins (unpublished before published).
export const STUDY_ROOTS = [
  resolve(VAULT_ROOT, 'Projects/lemma'),
  resolve(VAULT_ROOT, 'Archives/lemma'),
];

// KJV corpus — swordkey ships the canonical JSON.
export const KJV_JSON_PATH =
  process.env.LEMMA_KJV_JSON ||
  '/home/tim/Projects/gig8/swordkey/data/kjv-bible.json';

// Optional cross-check corpus (Gutenberg pg10 plain text). Not required.
export const KJV_PG10_PATH =
  process.env.LEMMA_KJV_PG10 ||
  resolve(LEMMA_ROOT, 'data/kjv/pg10.txt');

// Fabrication-fingerprint patterns live in the skill directory so they update
// out-of-band with the code.
export const FABRICATION_FINGERPRINT_PATH = resolve(
  process.env.HOME || '',
  '.claude/skills/lemma-verify-quotes/references/fabrication-fingerprint.md'
);

// Minimum inline-quote length (words) to be considered a verifiable citation.
export const MIN_INLINE_QUOTE_WORDS = 7;

// Standing rule text — one source of truth.
export const STANDING_RULE = `Every block quote must match a named, checkable translation, pinned in the text or bibliography; paraphrase/summary content never wears quote formatting — it is labeled "the paper's summary — not a quotation." New quotes enter the manuscript only together with a saved source file in Primary-Sources/.`;

export function findStudyDir(slug) {
  for (const root of STUDY_ROOTS) {
    const candidate = resolve(root, slug);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
