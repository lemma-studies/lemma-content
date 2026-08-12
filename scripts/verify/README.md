# lemma verify — quote-verification tool

Codifies the discipline that emerged from the Parents-and-Adult-Children study (v2.9 → v2.12): every block quote in a lemma study routes to a track, gets verified against a named checkable source, and is either verbatim-pinned, relabeled as summary, or removed. See `~/.claude/skills/lemma-verify-quotes/SKILL.md` for the operational protocol.

## Quick start

```bash
npm run verify:study -- --study "wine-and-jesus"
npm run verify:study -- --study "wine-and-jesus" --tracks scripture
npm run verify:study -- --study-path /abs/path/to/study
npm run verify:study -- --study "wine-and-jesus" --dry-run
```

Output: `<study>/Research-Findings/YYYY-MM-DD-quote-verification.md` in the same format as the parents-study.

## Environment

| Var | Default | What |
|-----|---------|------|
| `LEMMA_VAULT_ROOT` | `/mnt/c/Users/timuy/Dropbox/personal/Vault` | Vault root that holds `Projects/lemma/` and `Archives/lemma/` |
| `LEMMA_KJV_JSON` | `/home/tim/Projects/gig8/swordkey/data/kjv-bible.json` | KJV JSON (swordkey format: array of `{id,name,chapters:[{chapter,verses:[{verse,text}]}]}`) |
| `LEMMA_KJV_PG10` | `data/kjv/pg10.txt` (repo-relative) | Optional Gutenberg pg10 cross-check corpus |

## Track status

| Track | Verifier | Status |
|-------|----------|--------|
| Scripture | `verify-scripture.js` | ✅ Session 1 |
| Modern (worklist only) | `verify-modern.js` | ✅ Session 1 — emits Playwright worklist |
| Patristic | `verify-patristic.js` | 🚧 Session 2 |
| Rabbinic | `verify-sefaria.js` | 🚧 Session 2 |

The **Modern** track deliberately does not automate archive.org — that step is interactive (Tim logs in) and lives in the skill's Playwright recipe.

## Files

```
scripts/verify/
  config.js            paths, standing rule, corpus lookups
  extract-quotes.js    parses .md → { block, inline } quotes with track routing
  verify-scripture.js  KJV compare (swordkey corpus)
  verify-modern.js     distinctive-phrase extraction for the Playwright worklist
  verify-patristic.js  (session 2)
  verify-sefaria.js    (session 2)
  report.js            emits Research-Findings/YYYY-MM-DD-quote-verification.md
  index.js             CLI

tests/verify/
  extract-quotes.test.js
  verify-scripture.test.js

tests/fixtures/verify/
  wine-scripture-clean.md   verbatim-clean KJV quotes (should pass)
  wine-scripture-flawed.md  wording variance + bogus reference (should flag)
  mixed-tracks.md           one quote per track (routing test)
```

## Regression coverage from the parents study

Session 3 will land regression tests for the six confirmed fabrications (Hermas Visions blocks, Tertullian Veiling ch. 11, Elliot ×3, Piper "special calling / cannot be borne"). The tool must flag all of them; verifying against verified-clean quotes must not false-positive.
