# llms-full.txt Sizing Decision

**Date:** 2026-08-11
**Task reference:** Phase 2a Task 2a.5 in `2026-08-11-lemma-phase-1-3-platform-and-pilot.md`
**Design reference:** §7.7 — `llms-full.txt` sizing (R7 B7 measurement path)

## Measurement (all pre-migration Vault content that would land in `llms-full.txt`)

Scope: chapter markdown (`[0-9]*.md`, `00-*.md`, `Appendix*.md`) across all study directories the
current `content-sources.yaml` maps into the site, plus the three Reference/Research single-file
articles. Excluded: `historical/`, `Working-Notes/`, `External Reviews/`, `Primary-Sources/`,
`Research-Findings/`, `Old/`, `drafts/` (workroom material per design §5.2).

| Source | Chars |
|---|---|
| By His Stripes | 16,228 |
| 1 Corinthians 11:17-34 | 139,092 |
| Meeting Structure | 275,154 |
| The Name Above Every Name | 11,825 |
| Amos 7:1 | 118,670 |
| Daniel 9:24 | 16,612 |
| Trumpet Call | 471,737 |
| **What Is the Perfect (pilot)** | **358,505** |
| Sermon on the Mount | 310,620 |
| Satan's Throne | 69,676 |
| Angel of the Lord | 387,850 |
| Parents and Adult Children | 1,859 |
| Wine and Jesus | 359,711 |
| Lord's Supper and Meetings | 461,172 |
| Pre-Nicene Christianity Overview | 11,424 |
| Apostolic Quadrilateral Framework | 11,950 |
| Apostolic Quadrilateral Application Guide | 10,306 |
| **TOTAL (15 studies + 3 reference articles)** | **3,032,391 chars** |

**Estimated tokens (chars/4):** ~758,097 tokens
**Bytes:** 2.89 MB (well under 25 MB)

**Pilot alone (WITP):** 358,505 chars ≈ 89,626 tokens (under 200K)

## Threshold from design §7.7

> if projected total > 200K tokens OR > 25 MB → implement Option 3 chunked format from day-one

## Decision: **chunked from day-one (Option 3)**

**Rationale:** 758K tokens is ~3.8× the 200K threshold. Even a two-study future
(WITP + one other typical study) already blows past 200K, so single-file is not
viable at any realistic point in the migration. Implementing chunked from day-one
avoids a mid-migration format switch that would break any downstream reference to
`llms-full.txt` URLs.

**Note on the byte threshold:** 2.89 MB is well under 25 MB — the token count is the
binding constraint. Some agents cap context by tokens, some by bytes; the design's
"OR" tests either dimension.

## Implementation

- `site/public/llms.txt` — index; per-study URLs, `.md` variants, briefings, chunk
  URLs, and pointer to `llms-full.txt` at the site root.
- `site/public/llms-full.txt` — **index of chunk URLs**, one line per chunk, with
  clear section markers `--- STUDY: <slug> ---` and `--- CHAPTER: <NN-title> ---`
  in the file so an agent can crawl the index alone if the per-chunk fetch is too
  expensive.
- `site/public/llms/full/<slug>/<chapter>.txt` — per-chapter chunk (or `.md`;
  spec §7.7 accepts either). Populated by `compile-study.js` at compile time.
- Health-check verifies HTTP 200 for a representative sample of chunk URLs
  (design R6 C20 / Gemini P3) — this hook belongs in
  `scripts/lemma-cli/health-check.mjs` (Phase 2b Task 2b.7), NOT this task.

## Follow-ups (not in this task)

- Task 2b.2 stubs the three AI-index files (`llms.txt`, `llms-full.txt` as the
  chunk-index form, `.well-known/ai.txt`).
- Task 3.x compile step for WITP emits per-chapter chunks under
  `site/public/llms/full/what-is-the-perfect/*.txt`.
- Quarterly re-measure per §21G health check (design decision to hold day-one is
  format, not a fresh count each release).
