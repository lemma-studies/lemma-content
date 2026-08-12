# Translation Studies as First-Class Lemma Studies

**Date:** 2026-08-12
**Status:** Accepted — companion / extension to v7.1 (`2026-08-11-lemma-content-architecture-design.md`)
**Author:** Tim Uy + Claude (Opus 4.7)
**Relationship to v7.1:** Additive only. No decisions in the v7.1 table are revised. New rows extend §3, §5.1, §7.5, §7.7, §21 with translation-specific concerns.
**Blocks / is blocked by:** Does not block WITP pilot (Phase 3). Phase 2b schema reservations enable Phase 3.5 tooling to land without re-migration.

---

## 1. Mission

Extend lemma content architecture to support **bilingual CC-BY 4.0 translations of public-domain Christian family-discipleship works** as first-class lemma studies. Purpose: unlock republication and reprint freedom in restricted and resource-limited markets (Iran, China, developing regions, underground churches, mission distribution) where every existing target-language translation of the underlying PD source is priced and all-rights-reserved on the translation itself.

Translations are structurally lemma studies — chapter files, `study.yaml`, `versions/vN.N/`, DOI per version, Giscus, CC-BY. They differ from SCAR studies in shape but not in publication machinery. The v7.1 design absorbs them with additive schema extensions, one new content-type marker, three new scripts, and one site component. No redesign.

## 2. Doctrine additions to v7.1

### 2.1 Accessibility as republication-freedom (not just price)

A target-language translation "covers" a PD source only if the translation itself is redistributable — free to reprint, adapt, translate onward, distribute non-commercially across borders, and to publish in restricted regions where all-rights-reserved editions cannot lawfully circulate. **Priced or free access is a secondary question.** The primary question is whether the license blocks the distribution channels that matter for the target audience:

- Underground reprint in restricted countries (Iran, China)
- Local-press reprint in developing regions
- Audio, braille, simplified-script, or dialect adaptation
- Non-commercial mission distribution across borders

Priced all-rights-reserved editions block all of the above regardless of price. Consequently: **a well-produced $30 print import that the target audience can neither afford nor lawfully reprint is not "covered" for our purposes** — it is a gap under this doctrine.

CC-BY 4.0 is the specific license instrument that unblocks all four distribution channels. This ADR commits translation studies to CC-BY 4.0 without exception.

### 2.2 Re-translation from PD source is a legitimate publication motivation

The audit surface is not just "titles with no translation." It is also **titles where every extant target-language translation is priced-copyrighted on the translation itself**, even though the underlying source is PD. For such titles, re-translation from the PD source and publication under CC-BY 4.0 is a legitimate — and often the strategically correct — publication choice. We do not compete with paid editions in English-speaking Reformed markets that can afford them; we complement them by unlocking distribution in markets that cannot.

Applies to entire copyrighted product lines whose underlying sources are PD: Banner of Truth *Puritan Paperbacks*, Reformation Heritage Books modernizations, Crossway *Puritan Treasures for Today*, P&R Publishing classic reprints. In each case, the modern editorial hand is copyrighted; the source is not.

### 2.3 MVP audience-first sequencing

**Ship short pilot titles first. Evaluate with a native-reader review circle in each target language. Learn. Then commit to the next title.**

Length constraint: favor titles under 100pp so one review circle can meaningfully evaluate translation quality, design, scripture anchoring, and distribution reach in a single pass. Do not pre-commit a slate of titles; sequence is decided empirically after each pilot lands.

This doctrine rules against batch-planning ("first-year lineup") and in favor of sequential learning. Each translation study is a testable hypothesis about audience fit; the second title's identity depends on what the first title's audience feedback surfaces.

## 3. Schema extensions

### 3.1 `study.yaml` — three optional fields

```yaml
# Existing fields unchanged. Three additions:

language: he                            # BCP-47; default 'en' if omitted
translation_of:                         # presence flags this study as a translation
  source_slug: bunyan-christian-behaviour-en    # or {external: {citation, url, license}}
  source_edition: "1663, London"
  source_license: PD
  translation_method: llm-with-back-translation-verify
  scripture_anchor: canonical-per-language      # references data/bible-sources.yaml
sibling_editions:                       # auto-populated by verify:sibling-lookup
  - {language: en, slug: bunyan-christian-behaviour-en}
  - {language: ar, slug: bunyan-christian-behaviour-ar}
  - {language: fa, slug: bunyan-christian-behaviour-fa}
  - {language: zh-Hans, slug: bunyan-christian-behaviour-zh-hans}
```

All three fields OPTIONAL. Absence = English SCAR study, unchanged from v7.1. Presence of `translation_of` flags translation study; enables translation-specific verify variants and RTL/font handling.

**Reserve in Phase 2b** so pilot WITP `study.yaml` is forward-compatible.

### 3.2 `content-sources.yaml` — `type: translation`

Add `translation` as a subtype of `book` in the type enum. Behavior:
- Inherits all `type: book` handling (file_map, order, sync)
- Enables RTL/font stack for the resulting site pages
- Enables translation-verify variants during `verify:study`
- Requires `study.yaml.language` be set (validator error otherwise)

### 3.3 `primary-sources.json` — `role: source_work`

Add `role` field to the primary-source schema:
- `role: citation` (default; existing behavior — scripture, patristic, rabbinic, modern sources cited in the study)
- `role: source_work` — the PD original being translated (Ryle 1888, Bunyan 1663, Henry 1704, etc.)

Distinguishes the translation source (one per translation study) from citation sources (many per study). Job 1c verify enforces exactly-one `role: source_work` for `type: translation` studies.

## 4. Slug convention

**One study per language edition.** Suffix convention:

| Suffix | Language | Notes |
|---|---|---|
| `<work-slug>-en` | English (modernized) | See §5 |
| `<work-slug>-he` | Hebrew (modern Israeli) | Frank Rühl Libre; Delitzsch/Masoretic scripture anchor |
| `<work-slug>-ar` | Arabic (Modern Standard) | Amiri or Cairo; Van Dyck scripture anchor |
| `<work-slug>-fa` | Farsi/Persian | Vazirmatn; Henry Martyn NT / Old Persian scripture anchor |
| `<work-slug>-zh-hans` | Chinese Simplified | Noto Sans SC; CUV scripture anchor |
| `<work-slug>-zh-hant` | Chinese Traditional | Noto Sans TC; CUV scripture anchor |

Each edition is fully independent: own DOI, own Giscus discussion, own hypothes.is annotation surface, own version cadence, own tag namespace (`bunyan-christian-behaviour-he/v1.0`).

**Rationale for slug-per-language rather than language-as-version:**
- Matches existing v7.1 "one study = one DOI = one Giscus discussion" model — no design change
- Independent versioning (Hebrew v1.2 while Farsi still at v0.8) is the natural rhythm of translation work
- Native reviewers per language don't collide in one comment thread
- Language-as-version compresses 4-6 studies into 1 slug but requires refactoring the entire DOI, Giscus, and version-cut logic

## 5. Modern English translation (required, not just typography modernization)

For each work translated, **publish a CC-BY 4.0 modern English translation** as its own study slug `<work-slug>-en`. This is an **intra-lingual translation** — a real re-rendering of the 17th- or 18th-century source into contemporary English, not just typography cleanup.

**Rationale:**
1. Gives target-language translators a contemporary-English bridge to translate from, rather than forcing them to modernize + translate in a single pass (two changes at once → higher error rate)
2. Reduces LLM error on the source-language input: modern LLMs handle 17th-c. English but noisily; contemporary English is the base case
3. Gives the bilingual PDF a lemma-hosted anchor rather than an external CCEL link that could vanish or reformat
4. Contributes a genuinely useful CC-BY 4.0 modern English edition to the PD-derived commons (a distinct product from the translations — many readers want modern-English Bunyan but can't afford Banner of Truth's *Puritan Paperback* modernization)
5. Ensures every target-language translation pins to a canonical, versioned English target we control

**Translation scope:**
- Restructure sentences for contemporary readability
- Substitute modern vocabulary for archaisms (thee/thou → you; hath/doth → has/does; wherein → where; whereunto → to which)
- Update idioms and figures of speech; gloss where necessary
- Retain doctrinal content and every proposition of the original (no theological drift, no omission, no addition)
- Retain biblical quotations verbatim in the study's designated English Bible (default: KJV per §7.3 — Bunyan wrote post-1611 so KJV is period-appropriate)
- NOT paraphrase, NOT summarization, NOT theological reinterpretation

**Source preference:** EEBO-TCP transcripts where available (CC0 keyed-in transcription — meaningfully better than OCR on 17th-c. type). Pin to a specific EEBO-TCP version identifier for reproducibility. CCEL, Gutenberg, and Monergism as fallbacks.

**Provenance:** the original 17th/18th-c. source is NOT itself a lemma study — it lives at EEBO-TCP (or CCEL, Gutenberg) as a canonical external reference. The modern English study's `study.yaml.translation_of` field references the source externally:

```yaml
language: en
translation_of:
  external:
    citation: "Bunyan, Christian Behaviour, London 1663"
    url: "https://quod.lib.umich.edu/e/eebo/A30128.0001.001"
    eebo_tcp_id: "A30128.0001.001"
    license: PD
  translation_method: intra-lingual-modern-english
  scripture_anchor: kjv-1769  # period-appropriate for Bunyan
```

**Translation convention document:** to be drafted after first pilot lands, capturing the specific editorial choices made (which archaisms to modernize systematically; which theological terms to preserve; sentence-length norms; footnote/gloss conventions) so subsequent English editions have a consistent house style.

## 6. Sibling-study registration

`sibling_editions:` field in `study.yaml` is auto-populated by a new verify step `verify:sibling-lookup` at compile time. Convention: any study slug matching `<work-slug>-<lang>` prefix is a sibling. Ensures cross-linking works without hand-maintenance.

Living-URL rendering displays a "Also available in:" strip at the top of each translation study page, populated from `sibling_editions`.

## 7. New scripts

### 7.1 `scripts/build-bilingual.js`

Landscape parallel-column PDF renderer. **Sibling to `build-book.js`, not a replacement.** Each translation study builds two PDFs:

1. Target-language-only PDF via `build-book.js` (existing rig, 8.5×11" portrait)
2. Bilingual side-by-side PDF via `build-bilingual.js` (11×8.5" landscape)

Both PDFs commit to `studies/<slug>/versions/vN.N/`. The bilingual PDF also lives on the English-modernized sibling's version directory so the pair is discoverable from either side.

**Input:** source-language study slug + target-language study slug + chapter-alignment file (`alignment.yaml` — outline-anchor mapping for row-level parallel display).

**Output:** landscape PDF with English and target columns per outline point, matched leading, per-row alignment, RTL/bidi native handling for Hebrew/Arabic/Farsi.

**Prior art (port ~500 LOC):** `Vault/Areas/Loqu8/Translation/PROJECT_NOTES.md` — the Jessica marriage-book pipeline. HTML+CSS+Chromium print-to-PDF (rejected LaTeX and Typst on iteration speed + Hebrew maturity grounds). Per-point row alignment with whitespace on the shorter side. Outline markers in Latin script identical in both columns (`I.B.3`, `13.c`) for unambiguous cross-reference.

### 7.2 `scripts/verify/back-translation.js`

LLM back-translation drift-check. For each prose node (not scripture, not workbook fill-ins), back-translate to the source-language rendering using a **different-family model** from the one that produced the translation, then diff for meaning drift. Runs during `verify:study` for `type: translation` studies.

**Two-stage verification for the full pipeline** (modern-English translation + target-language translation):

| Stage | Source | Target | Verifier back-translates | Diff against |
|---|---|---|---|---|
| A: intra-lingual | 17th/18th-c. English (EEBO-TCP) | Modern English | Modern English → literal-19th-c.-style English | Original source; watches for theological drift, omitted propositions, hallucinated additions |
| B: cross-lingual | Modern English | Hebrew/Arabic/Farsi/Chinese | Target → Modern English | Modern English source; watches for meaning drift per prose node |

Both stages run with different-family verifier models than the source model to keep failure modes independent.

**Model routing:** via model-radar MCP. Zero API cost. Anthropic Opus produces translation → OpenAI GPT-4 or Google Gemini back-translates → diff surfaces drift → drift over threshold opens a translator's-note comment.

**Config per study** (`translation.yaml` alongside `study.yaml`):
```yaml
source_model: anthropic/claude-opus-4-7
verify_model: openai/gpt-4o        # must be different family
drift_thresholds:
  prose_semantic_similarity_min: 0.85
  proposition_preservation_min: 1.0  # zero tolerance for omitted propositions
  scripture_verbatim: true            # zero tolerance for drift on scripture
```

Scripture nodes are never LLM-translated at either stage — they are pinned to per-language canonical Bible per §7.3. Bunyan's biblical citations in the modern-English edition are pinned to KJV (period-appropriate); in the Hebrew edition to Delitzsch NT + Masoretic Tanakh (per §7.3).

### 7.3 `scripts/verify/scripture-per-language.js`

Pluggable canonical-Bible target per translation-study language. Replaces English-KJV check for `type: translation` studies.

**Configuration** in `data/bible-sources.yaml`:
```yaml
en:
  primary: KJV
  api: local-cache
he:
  tanakh: sefaria-masoretic
  nt: delitzsch-12ed              # delitz.fr/12/{book}.{chapter}.html
ar:
  primary: van-dyck-svd-1865      # PD
  upgrade_candidate: nav-biblica  # pending Biblica licensing
fa:
  primary: henry-martyn-nt-1837   # PD
  upgrade_candidate: elam-pmv     # pending Elam licensing
zh-Hans:
  primary: cuv-1919-simplified    # PD
  upgrade_candidate: rcuv-hkbs    # pending HK Bible Society licensing
zh-Hant:
  primary: cuv-1919-traditional   # PD
  upgrade_candidate: rcuv-hkbs
```

For each scripture citation node, verify:
1. The target-language rendering is verbatim from the configured Bible source
2. The English (source-language) rendering matches the study's `translation_of.scripture_anchor` (default: KJV)
3. Cross-reference resolves consistently — if source cites Matt 19:5, both sides quote Matt 19:5

Zero tolerance for scripture drift — this is exactly the discipline that made the Jessica pipeline safe on the highest-stakes content.

## 8. Site additions

### 8.1 RTL CSS + font stack

Add to `site/src/styles/global.css`:

```css
:root {
  --font-body: 'Adobe Garamond', 'EB Garamond', Georgia, serif;
  --font-hebrew: 'Frank Ruhl Libre', 'David CLM', serif;
  --font-arabic: 'Amiri', 'Cairo', serif;
  --font-farsi: 'Vazirmatn', 'Amiri', serif;
  --font-cjk-sc: 'Noto Sans SC', 'PingFang SC', sans-serif;
  --font-cjk-tc: 'Noto Sans TC', 'PingFang TC', sans-serif;
}

[lang="he"] { font-family: var(--font-hebrew); }
[lang="ar"] { font-family: var(--font-arabic); }
[lang="fa"] { font-family: var(--font-farsi); }
[lang="zh-Hans"] { font-family: var(--font-cjk-sc); }
[lang="zh-Hant"] { font-family: var(--font-cjk-tc); }

[dir="rtl"] { direction: rtl; text-align: right; }
```

Fonts bundled as `.woff2` in `site/public/fonts/` or via `@font-face` with self-hosted assets — no third-party CDN dependency (matches v7.1 self-contained-artifact principle).

Per-page `dir` and `lang` frontmatter fields consumed by `sync-content.js`, emitted as HTML attributes on `<html>` and `<article>` elements.

### 8.2 `<BilingualSpread />` Starlight component

Custom component for bilingual pages on the living URL. Renders per-chapter parallel columns matched by outline anchor.

**Signature:**
```astro
---
import BilingualSpread from '../../components/BilingualSpread.astro';
---
<BilingualSpread
  sourceSlug="bunyan-christian-behaviour-en"
  targetSlug="bunyan-christian-behaviour-he"
  chapter="03-marriage"
  alignment="row"
/>
```

Renders as two columns (source on left, target on right for LTR pairs; source on right, target on left when target is RTL). Row-level alignment via outline anchors. Whitespace on the shorter side.

Not required on the living URL — direct-navigation to `<slug>/<chapter>` renders the target-language-only view. Bilingual view is an opt-in `?bilingual=1` query or a discrete `/bilingual/` route.

## 9. Phase gating

| Phase | Translation-related work |
|---|---|
| **2a** — minimum site | None |
| **2b** — AI-surface + intake | Reserve the three `study.yaml` fields; add `type: translation` + `role: source_work` to validators; add RTL CSS + font stack + `<BilingualSpread />` component; add `data/bible-sources.yaml` scaffold. All optional; zero effect on WITP. |
| **3** — WITP pilot | Unchanged |
| **3.5** — first translation pilot (NEW) | Ship `build-bilingual.js`, `verify/back-translation.js`, `verify/scripture-per-language.js`, `verify/sibling-lookup.js`. Pilot title lands (see §10). |
| **4+** — bulk migration | Bulk translation studies alongside bulk SCAR migration |

Phase 3.5 is inserted between v7.1's Phase 3 and Phase 4. It does not gate Phase 4 — bulk SCAR migration can proceed in parallel with translation tooling if desired.

## 10. Pilot title

**John Bunyan — *Christian Behaviour* (1663)** — surfaced as the strongest MVP fit by the 2026-08-12 widened audit.

- 4-way absent in Hebrew, Arabic, Farsi, Chinese
- Subtitle explicitly frames the whole work as household relations: *"Rules and Directions Necessary for Christians as they Bear the Relations of Husbands and Wives, Parents and Children, Masters and Servants"*
- Short (~40pp) — one native-reader review circle can meaningfully evaluate
- Bunyan's authorial equity via *Pilgrim's Progress* carries into all four target languages
- EEBO-TCP CC0 transcript at [quod.lib.umich.edu/e/eebo/A30128.0001.001](https://quod.lib.umich.edu/e/eebo/A30128.0001.001) — clean UTF-8 source, no OCR pass on 1663 type

**First ship target: `bunyan-christian-behaviour-en/v1.0`** — modern English translation, CC-BY 4.0.

This is the pilot. Not "the prerequisite for the Hebrew pilot." The pilot IS the modern English translation. It is a first-class shippable product that proves:
- The translation pipeline mechanics (extract → translate → back-translate verify → iterate → render)
- The lemma integration (`type: translation`, new schema fields, new scripts, bilingual site component when a sibling lands)
- The `verify:study` translation variants
- The Zenodo DOI + Giscus + Software Heritage + HuggingFace publication surfaces for a translation study
- The native-English review circle process (theologically-trained readers checking propositional preservation vs. Bunyan's 1663 original)

Target-language translations come AFTER `-en/v1.0` ships and audience feedback lands. Under MVP doctrine (§2.3), do NOT begin any target-language translation until the modern English audience feedback confirms the pipeline is producing publication-quality output.

**Second ship target (post-audience-feedback on `-en`): `bunyan-christian-behaviour-he/v1.0`** — Hebrew translation, sourced from `-en/v1.0`. Hebrew chosen as first target-language for reasons above.

**Pipeline order:**
1. Extract EEBO-TCP source A30128.0001.001 → chapter files in `-en` study (source reference cited as `translation_of.external`)
2. Modern English translation pass (stage A per §7.2) — produce `-en/v1.0-draft`
3. Native-English review circle — theologically-trained readers; propositional-preservation check vs. Bunyan's 1663 original
4. Fold review circle findings → `-en/v1.0`
5. **Ship `-en/v1.0`** — release, tag, Zenodo publish
6. **Audience feedback window on `-en/v1.0`** — Giscus + hypothes.is + email intake; minimum N weeks before committing to Hebrew stage
7. Only after audience feedback confirms pipeline quality: begin Hebrew translation pass (stage B per §7.2) — produce `-he/v1.0-draft` sourced from `-en/v1.0`
8. Hebrew native-reader review circle
9. Fold findings → `-he/v1.0`
10. **Ship `-he/v1.0`** — release, tag, Zenodo publish; bilingual PDF pairs `-en/v1.0` + `-he/v1.0`

**Rationale for Hebrew as first target-language:**
- HaGefen already publishes Henry commentaries in Hebrew — established evangelical Hebrew reader base
- Natural distribution partner conversation
- Hebrew has the widest overall gap in the family-discipleship corpus per 2026-08-12 initial audit (8 of 10 shortlist titles show hard Hebrew gap, and Hebrew publishing is fully cataloged — no security-suppression discount to apply)

**Under MVP doctrine (§2.3):** DO NOT pre-commit to additional titles or languages until Hebrew pilot lands with native-reader review circle feedback.

## 11. Non-goals

- Not replacing SCAR studies. Translations are a study type alongside SCAR, not instead of.
- Not building a separate lemma-translations site. Translations are a lemma study type; they live at `lemma.gig8.com/studies/<slug>` alongside every other study.
- Not extending Starlight's i18n framework. i18n is designed for UI translation; parallel content is a different problem.
- Not adding paid or gated translations. CC-BY 4.0 is the doctrine.
- Not designing the modernized-English convention document in this ADR. That happens after the first pilot lands.

## 12. Open questions

1. **Chapel Library relationship.** Mails Puritan tracts worldwide free from Pensacola; license clause unresolved on their public T&Cs. Direct email inquiry before overlap-competing with their tract catalog. If they grant redistribution rights on a case-by-case basis, they may become a distribution partner rather than a competitor.
2. **Best-in-language Bible upgrade permissions.** Day-one PD Bibles (Van Dyck, CUV, Henry Martyn, Delitzsch) are safe. Contemporary versions (NAV/Sharif, RCUV, Elam PMV) require Bible-society outreach conversations. Tracked as project task 3 in the source project.
3. **Native-reader review circle recruitment.** Technical machinery exists; recruitment channels per language TBD — Parsa Institute (Farsi), MERF (Arabic), HaGefen (Hebrew), RTF-JDC (Chinese).
4. **Loqu8 `bible` app corpora integration.** Tim's Loqu8 `bible` app may already ship some of the priority target-language Bibles as data-pack payloads. If so, they can be pulled directly rather than re-sourced. Investigation is a scarlight-side task per the paragraph sent to the scarlight agent 2026-08-12.
5. **Modernization convention document.** Draft after first English `-en` edition lands.

## 13. References

- **v7.1 design:** `docs/superpowers/specs/2026-08-11-lemma-content-architecture-design.md` — §3 (strategic decisions), §5.1 (repo layout), §7.1 (chapter files canonical), §7.5 (primary sources), §21 (§21 verification)
- **Jessica pipeline prior art:** `/mnt/c/Users/timuy/Dropbox/personal/Vault/Areas/Loqu8/Translation/PROJECT_NOTES.md` — six-stage pipeline (extract → scripture normalize → translate → back-translate verify → iterate → render), decisions 1–22, HTML+Chromium toolchain, Sefaria + Delitzsch scripture anchoring
- **Initial audit:** `/mnt/c/Users/timuy/Dropbox/personal/Vault/Projects/family-discipleship-translations/audit-2026-08-12.md`
- **Widened audit:** `/mnt/c/Users/timuy/Dropbox/personal/Vault/Projects/family-discipleship-translations/audit-widened-2026-08-12.md`
- **Project memory:** `~/.claude/projects/-home-tim/memory/project_family_discipleship_translations.md`

## 14. Companion project

Source project driving this ADR: **Family Discipleship Translations** — `Vault/Projects/family-discipleship-translations/`. That project owns the audit, publisher-outreach, native-reader review circles, and title selection. This ADR owns the technical integration into lemma.
