# Primary Source Registry

Central manifest of primary sources cited across all lemma studies. One record per source; per-study `primary-sources.json` files reference records here by ID. Fixes the multi-study-shared-source problem (previously a single Irenaeus citation would drift between studies with subtly different translator attributions).

## Three-tier redistribution policy (per design §7.5)

| Tier | Redistribution | PDF cache location | Metadata location |
|---|---|---|---|
| `PD` | Public domain | `primary-sources/PD/<id>.pdf` (public — this repo) | `primary-sources/manifest.json` (public) |
| `CC` | Creative Commons | `primary-sources/CC/<id>.pdf` (public — this repo) | `primary-sources/manifest.json` (public) |
| `OA-hosted-unclear` | Open-access at source; local redistribution rights unclear | `lemma-workroom/primary-sources/OA-hosted-unclear/<id>.pdf` (private) | metadata public with `canonical_url` at source |
| `restricted` | Explicitly restricted redistribution | `lemma-workroom/primary-sources/restricted/<id>.pdf` (private) | metadata public with `canonical_url` at source; Scarlight `library` corpus with `visibility: private` |

## ID convention

Format: `<author-slug>-<work-slug>-<reference>` — lowercase kebab-case throughout.

Reference format uses dashes for dots (`2.22.5` → `2-22-5`) and slashes (`14:9-10` → `14-9-10`).

### Patristic examples

- `irenaeus-ah-2-22-5` — Irenaeus, Against Heresies 2.22.5
- `justin-1apol-66` — Justin Martyr, First Apology 66
- `didache-9-4` — Didache 9.4
- `ignatius-eph-14-2` — Ignatius, To the Ephesians 14.2
- `clement-alex-strom-6-15` — Clement of Alexandria, Stromata 6.15
- `augustine-conf-1-1-1` — Augustine, Confessions 1.1.1
- `chrysostom-hom-mt-19` — John Chrysostom, Homily on Matthew 19
- `theodoret-comm-amos-7-1` — Theodoret of Cyrus, Commentary on Amos 7:1
- `cyril-alex-comm-amos-7-1` — Cyril of Alexandria, Commentary on Amos 7:1

### Rabbinic examples

- `makkot-24a` — Bavli Makkot 24a
- `lev-rabbah-10-2` — Leviticus Rabbah 10:2
- `targum-jonathan-amos-7-1` — Targum Jonathan on Amos 7:1
- `rashi-amos-7-1` — Rashi on Amos 7:1
- `ibn-ezra-amos-7-1` — Ibn Ezra on Amos 7:1

### Modern examples

- `stamp-1970-face-to-face` — Stamp, "Face to Face" (1970 MDiv thesis)
- `witherington-2001-corinthians-13` — Witherington on 1 Corinthians 13 (2001)

### Translation-class primary sources (ADR-018)

For bilingual translation studies (Phase 3.5+), the source-language public-domain edition is itself a primary source:

- `ryle-1888-duties-of-parents-en` — J.C. Ryle, Duties of Parents (1888 first edition)
- `henry-1706-commentary-genesis-en` — Matthew Henry, Commentary on Genesis (1706 posthumous compilation)
- `mather-1699-family-well-ordered-en` — Cotton Mather, A Family Well-Ordered (1699)
- `murray-1885-children-for-christ-en` — Andrew Murray, The Children for Christ (1885)

Each translation edition (`-he`, `-ar`, `-fa`, `-zh-Hans`, `-zh-Hant`) is a separate lemma study with its own DOI, cross-referencing the source edition here via its own `primary-sources.json`.

## Per-entry schema

```json
{
  "id": "irenaeus-ah-2-22-5",
  "citation": "Irenaeus, Against Heresies 2.22.5",
  "translator": "Roberts-Donaldson",
  "edition": "ANF v1, ed. Schaff",
  "canonical_url": "https://newadvent.org/fathers/0103224.htm",
  "scarlight_ref": "anf:irenaeus/haer/2.22.5",
  "local_cache": null,
  "redistribution": "PD",
  "license": "PD (Roberts-Donaldson translation)",
  "retrieved": "2026-08-11",
  "status": "active",
  "superseded_by": null,
  "replaces": null,
  "language": "en",
  "sha256": null,
  "version": "1"
}
```

**Required fields:** `id`, `citation`, `canonical_url`, `redistribution`, `retrieved`, `status`, `language`, `version`.

**Field semantics:**

- `translator` — real translator name, NOT "Schaff" (Schaff was the NPNF *series editor*, not the translator of any specific volume). See `~/.claude/projects/-home-tim-Projects-gig8-lemma/memory/MEMORY.md` for verified ANF/NPNF translator attributions.
- `edition` — human-readable edition string ("ANF v1, ed. Schaff", "PL 25", "TLG 4089.025")
- `canonical_url` — authoritative online copy (newadvent.org, tertullian.org, sefaria.org, ccel.org, documentacatholicaomnia.eu, First1KGreek, etc.)
- `scarlight_ref` — internal Scarlight corpus reference for fast retrieval
- `local_cache` — path to PDF/text file in this repo or lemma-workroom (null when `canonical_url` is authoritative and stable)
- `redistribution` — one of `PD | CC | OA-hosted-unclear | restricted`
- `license` — plain-text license summary; empty for `restricted`
- `retrieved` — ISO date of last verification
- `status` — `active | superseded | retired`
- `superseded_by` — id of the record that replaces this one (chains as translations improve)
- `replaces` — id of the record this one supersedes (inverse of above)
- `language` — BCP-47 tag (`en`, `el`, `la`, `he`, `ar`, …)
- `sha256` — hash of the `local_cache` file when present; verify integrity across git operations
- `version` — string tag for the manifest record itself (bump on non-trivial edit like translator change or canonical URL update)

## Adding a new source

1. Add manifest.json entry with all required fields per the schema above.
2. `npm run verify:study` — verify-manifest.mjs flags duplicate IDs and schema violations.
3. Reference from a study's `studies/<slug>/primary-sources.json` by ID only.

## Verification against ground truth

The `~/.claude/skills/lemma-verify-quotes/` skill checks patristic + scripture + rabbinic + modern quotes against ground-truth corpora (Scarlight ANF/NPNF/Lightfoot, KJV Project Gutenberg, Sefaria, archive.org). Run per-study via `npm run verify:study -- --study "<Name>"` — see the skill for the full protocol.

Known ANF/NPNF translator attributions correct as of 2026-08:

- **ANF Vol. 1** (Apostolic Fathers): Roberts-Donaldson
- **ANF Vol. 3** (Tertullian, multi-volume): S. Thelwall for *De Corona*, *De Idololatria*, *De Patientia*; Peter Holmes for *Adversus Marcionem*
- **ANF Vol. 7** (Didache): M.B. Riddle (NOT Roberts-Donaldson)
- **NPNF series**: Philip Schaff is the SERIES EDITOR, never a translator; each volume has its own translator listed in the front matter
