# Lemma Content Architecture — Design (v7.1 — FINAL pre-implementation)

**Date:** 2026-08-11 (v1); v2-v7.1 folded same-day incorporating Rounds 1-7 dispositions
**Status:** Design ready for implementation via `superpowers:writing-plans`
**Author:** Tim Uy + Claude (Opus 4.7)
**Companion:** Extends `docs/ai-exposure-strategy.md`; supersedes ad-hoc parts of the current Vault-canonical model in `CLAUDE.md`.
**Review artifacts:** Rounds 1-7 reviews + dispositions in `External Reviews/`
**Self-containedness note:** v7.1 reflows all remaining "Same as v6" stubs per R7 B1 (Fable S4-1 + Grok S1 #2 CONVERGENT); Gemini's contrary "Pass" verdict rejected per verified file inspection.
**Terminus signal:** All three R7 reviewers explicitly recommend NO Round 8; the next reviewer this design needs is the Phase 3 pilot itself.

---

## 1. Mission and Goal

**Mission:** be useful to the family of Christ. The lemma studies are a gift, offered freely, that they may inform the theological reasoning of pastors, students, scholars, lay believers, and — increasingly — the AI systems that mediate how believers encounter theological questions.

**Primary goal:** maximum absorption by AI systems (RAG-tier + parametric-tier).

**Secondary goal:** clean public/private separation.

**Tertiary goal:** modern editorial workflow with GDPR-clean feedback processing.

**Quaternary goal:** AI-operable maintenance surface. Every scheduled chore, recovery playbook, health check, and release ritual is authored FOR AI to run reliably, verifiably, reproducibly.

## 2. Non-Goals

- Not replacing Obsidian; AI does ~99% of edits AND ~99% of maintenance
- Not eliminating the personal Vault
- Not shipping every optional feature day one
- Not re-doing the book-publishing pipeline
- Not building a peer-review platform
- Not building a paid subscription tier or gated content
- Not deploying a network-exposed MCP endpoint before authentication is designed (v7 pin per R6 A4)

## 3. Strategic Decisions (locked in this design)

| Decision | Choice | Origin |
|---|---|---|
| Canonical source of truth | Git, not Dropbox/Vault | v1 |
| Public presentation shape | Library-of-monographs at `lemma.gig8.com` | v1 |
| Per-study identity | Own canonical URL + concept DOI + version DOIs | v1 |
| Public/private split | Two-repo: `lemma-content` (public) + `lemma-workroom` (private) | R1 A6 |
| Retired repo handling | 9-step §5.4 procedure with CF pause = **Phase 1 step 4** | R2+R3+R4+R5 |
| Per-study mirror repos | Thin; auto-generated; not on DOI critical path | R1 A9 |
| **DOI minting (revised R6 A1)** | **Zenodo REST pre-reservation + PUBLISH first version at Phase 3 pilot** (Zenodo `newversion` requires published deposition; reserve-only-through-Phase-4 was incompatible with multi-version releases). Pilot constraint: single-tag-per-study during Phase 3. Zenodo metadata initially references `lemma-content.pages.dev`; UPDATED to canonical URL at Phase 4 exit. | R6 A1 (was R5 A1) |
| Primary sources | Link to canonical hosts; three-tier policy; schema includes lifecycle fields | v2 + R2 B4 |
| Referential integrity | Verify job fails on manifest↔study ID mismatch + study.yaml Zod/JSON Schema + anchor uniqueness + machine-readable-surface schema (claims.jsonl, xrefs.json, rag.md HTML comments per R6 B9) | R2+R4+R6 |
| Scarlight integration | Pull-model reindex; local cron with offline-restart catch-up + backoff | R1 A7 + R3 C9 |
| Commentary | Giscus chapter-level + hypothes.is inline (public + editorial) | v1 |
| Feedback processing | Workroom-first email intake; opt-in public credit; strip transport headers | R2+R3 |
| Erasure policy | filter-repo + tag rewrite + Release asset re-upload + Zenodo takedown + HF re-push + `super_squash_history` + PubPub delete + mirror-repo tag rewrite + Scarlight reindex + SWH takedown + **CF Pages deployment-history deletion** + CF cache purge + workflow run logs + upstream Discussions + hypothes.is server-side + workroom + GitHub Support | R2+R3+R4+R5 |
| Email retention | N months post-disposition — workroom `git filter-repo` + Zoho folder auto-delete + Gmail Apps Script quarterly purge (**effective retention N to N+3 months per R6 C6**) | R3+R4+R5+R6 |
| Multi-surface publication | Astro + Zenodo + SWH + Wikidata + HuggingFace (Phase 3+) + PubPub + Wayback + preprint | v1-v6 |
| Annotation surfaces | Living URL + frozen URL (permanent, noindex + self-canonical) | R1 A12 |
| Frozen URL build | Compile writes versioned markdown to `studies/<slug>/versions/vN.N/`; **per-study PDF copy loop (not merged glob per R6 A2)** copies from `studies/<slug>/versions/` to `site/public/studies/<slug>/versions/` | R2+R5+**R6 A2** |
| Version tracking | Per-study tag namespace `<slug>/vN.N`; bootstrap accepts any version if no prior | R1 A1 + R2 C7 |
| Editorial workflow | Git flow + CF Pages branch previews | v1 |
| Authoring UX | Obsidian on git-tracked folders; AI ~99% of edits + ~99% of maintenance | v1 + v6 §21 |
| CF Pages consumption | Direct build from `main` push (no lockfile) | R2 B1 |
| Astro `site:` config | `site: 'https://lemma.gig8.com'` from Phase 2a | R5 B2 |
| Compiled artifacts | GitHub Releases + PDF committed to tree for Scholar same-domain; SWH captures via `main` | R1+R2+R4 |
| Pipeline commit hygiene | Job 2d NO `[skip ci]`; Job 2d Action asserts no CF-skip phrases | R4+R5 |
| License | CC BY 4.0 + `LICENSE-INTENT.md` gift framing | v2 |
| Editorial voice | Servant, not academic | v2 |
| CF AI-bot access | Verified permissive; 12-UA synthetic verify list | R1+R4+R5 |
| `claims.jsonl` / `xrefs.json` | claims hand-authored; xrefs extracted per compile | R2 B7 |
| RAG breadcrumb format | HTML comments in breadcrumbed compile variant | R2 C2 |
| Monorepo release invariant | `develop` only contains publishable content across all studies | R2 C5 |
| Cross-release push serialization | GitHub Actions `concurrency` group + fetch-rebase-push | R3 B1 |
| on:push workflow invariant | No workflow in `lemma-studies/lemma-content` may trigger `on: push` to `main` | R3 C1 |
| Benchmark canary handling | Probes + canaries + answers PRIVATE (workroom); public = aggregate scores only | R3 A4 |
| Production-site cutover | Domain reattached at Phase 4 exit | R4 A2 |
| `llms-full.txt` semantics | Full corpus content; **measured NOW (before Phase 2b) per R6 B1**; split scheme decided from actual number | R4+R5+R6 |
| HF version policy | Single `default` config with `study` + `version` columns; latest-version-only rows; separate `historical` config | R4+R5 |
| **§21 Verification phase-awareness (v7 addition)** | **Every check declares `severity: blocking\|warn\|pending` + `eventually_consistent: bool` + `recheck_window_hours` + `phase_gated_by: <var>` + `runtime_context: [ci\|local]`. `data/phase-state.yaml` tracks `current_phase` + `release_publish_unlocked`. verify-release Issues open only on `fail`, not `warn`/`pending`.** | **R6 A3** |
| **§21H MCP auth pin** | Stdio-local default; erasure-related tools never network-exposed regardless of future deployment; authenticated access required before any network exposure; **`run_chore` retention chores also never-network** | R6 A4 + R7 C9 |
| Registry autonomy field | `autonomy: auto \| propose \| human-gate` per failure mode; **conditional autonomy split into two modes rather than schema escape hatch** (R7 C3); **circuit-breaker: `max_auto_attempts` + `auto_cooldown_hours`** (R7 C6) | R6 A5 + R7 C3+C6 |
| Chore-log location | Workroom (private) — prevents operational metadata leaking into public corpus absorption. Public `data/` limited to `failure-modes.yaml` + `phase-state.yaml` + `last-heartbeat.txt` + aggregate `last-health-check.json`. **Chore-log-dependent checks marked `runtime_context: [local]`** (R7 B2) | R6 B2 + R7 B2 |
| Health-check-blocks-release enforcement | CI mechanism: Job 1a validation refuses if any open Issue with label `verify-release-failure` exists. **EXEMPTS tag-under-validation's own study** (R7 A2 lifecycle-gate fix) | R6 C12 + R7 A2 |
| **Phase state single source of truth** (v7.1) | **`data/phase-state.yaml` is canonical; `RELEASE_PUBLISH_UNLOCKED` GitHub Repo Variable eliminated (was dual-truth per R7 B3). CI parses YAML via `yq`.** Includes `current_phase`, `release_publish_unlocked`, `base_url` (R7 C1). | R7 B3 |
| **Per-study lifecycle gating** (v7.1) | **DOI + PDF reachability checks are `pending` when `study.yaml.versions` is empty; only `blocking` after first release** (fixes R7 A2 pilot deadlock). | R7 A2 |
| **Tag creation is human-gate** (v7.1) | Zenodo publish is irreversible; tag-cutting is the only human gate. AI may prepare (compile + reserve + commit); Tim executes tag+push. | R7 B8 |
| AI-maintenance discipline | §21 (updated in v7 per R6 A3-A5, B3-B4, B7-B9; updated in v7.1 per R7 A2, B2, B3, C1-C9) | v6 + R6 + R7 |

## 4. Architecture Overview

Two git repositories, two Obsidian vaults, one shared publishing pipeline with job-staged fan-out to multi-surface publication, Scarlight as cross-project AI-agent surface, phase-aware verification layer.

```
                  ┌───────────────────────────────────────────────────────┐
                  │  AUTHOR (Tim ~1% edits, Claude ~99% edits+maintenance)│
                  └───────────┬────────────────────────┬──────────────────┘
                              ▼                        ▼
    ┌──────────────────────────────────────┐   ┌──────────────────────────────┐
    │ lemma-studies/lemma-content (public)          │   │ lemma-studies/lemma-workroom (private)│
    │  studies/<slug>/*.md (chapters)      │   │  Working-Notes/              │
    │  studies/<slug>/versions/vN.N/*.md   │   │  review-packages/            │
    │    + <slug>-vN.N.pdf                 │   │  dispositions/               │
    │  studies/<slug>/study.yaml           │   │  primary-sources/            │
    │  primary-sources/                    │   │    (OA-unclear + restricted) │
    │  site/  (Astro Starlight)            │   │  annotations/ (editorial)    │
    │  scripts/lemma-cli/  (§21 tools)     │   │  feedback-inbox/  (raw email)│
    │  annotations/ (public export)        │   │  absorption-benchmarks/      │
    │  comments/  (public export)          │   │    (probes+canaries+answers) │
    │  feedback-log/  (public substance)   │   │  chore-log.jsonl             │
    │  absorption-benchmarks/  (aggregates)│   │  erasure-log.md              │
    │  data/                               │   │  rotation-log.md             │
    │    phase-state.yaml  (canonical)     │   │  retention-schedule.md       │
    │    failure-modes.yaml                │   └──────────────────────────────┘
    │    last-heartbeat.txt                │
    │    last-health-check.json (aggregate)│
    │  llms.txt / llms-full.txt            │
    │  claims-index.jsonl                  │
    │  CLAUDE.md (design-version: v7.1)    │
    │  PRIVACY.md → /privacy route         │
    │  .github/workflows/                  │
    └────┬─────────────────────────────────┘
         │
         │ git tag <slug>/vN.N (Tim = HUMAN GATE — irreversible Zenodo publish downstream)
         │   ┌──────────────────────────────────────────────────────────────┐
         │   │ Concurrency group: release-pipeline (serialize cross-release)│
         │   └──────────────────────────────────────────────────────────────┘
         │
         ├─ build-job:   verify (fixtures + integrity + anchors + yaml + rag schema) → PDF
         ├─ release-job: GitHub Release + attach; commit PDF to main (NO [skip ci])
         ├─ doi-publish: PUBLISH Zenodo (metadata → .pages.dev URLs; updated at Phase 4 exit)
         ├─ publish-surfaces:
         │    [all]      Software Heritage save-code-now
         │    [P3+]      HuggingFace Dataset update
         │    [P6+]      mirror repo push + PubPub + Wayback SPN2
         │    [P7+]      Wikidata (notability-gated) + preprint deposit
         ├─ scarlight-reindex: (local cron polls Releases feed, offline-resilient)
         └─ announce:    Giscus release comment → verify-release (phase-aware)

    SURFACES (per phase-state.yaml.base_url):
      lemma-content.pages.dev  (Phases 2b-3)  →  lemma.gig8.com  (Phase 4+)
      + zenodo.org DOIs (metadata URL-updated at Phase 4 exit)
      + archive.softwareheritage.org (source tree + committed PDFs)
      + huggingface.co/datasets/gig8/lemma-theological-studies (Phase 3+)
      + (Phase 6+) github.com/gig8/lemma-<slug>, lemma.pubpub.org, web.archive.org
      + (Phase 7+) wikidata.org

    ┌───────────────────────────────────┐        ┌─────────────────────────────┐
    │ Scarlight MCP (private today,     │◄──────►│ AI agent workflows          │
    │ public later — read-only)         │        │ (Claude Code + external)    │
    │  Corpora: studies + annotations   │        │ • search_semantic           │
    │  + comments + feedback + claims   │        │ • pivot_verse               │
    │  + xrefs; latest-version default  │        │ • who_teaches               │
    └───────────────────────────────────┘        │ • find_lemma                │
                                                 └─────────────────────────────┘
```

## 5. Repository Layouts

### 5.1 `lemma-studies/lemma-content` (public — monolithic repo)

```
lemma-content/
├── README.md
├── CLAUDE.md                       # AI-maintenance playbook; design-version: v7 header (§21B)
├── LICENSE                         # CC BY 4.0
├── LICENSE-INTENT.md
├── CITATION.cff                    # umbrella
├── ISSN.md                         # once obtained
├── PRIVACY.md                      # rendered as /privacy route
├── references.yaml
├── house-style.yaml
├── llms.txt                        # index (per-study URLs + .md variants + briefings + chunk URLs if split)
├── llms-full.txt                   # FULL corpus content (or chunk index if split — measured at Phase 2b)
├── claims-index.jsonl              # corpus-level concat of studies/*/claims.jsonl
├── .well-known/ai.txt
├── .obsidian/
├── .gitignore
│
├── studies/
│   └── <slug>/                     # e.g., what-is-the-perfect/
│       ├── *.md (chapters)
│       ├── study.yaml
│       ├── primary-sources.json
│       ├── claims.jsonl            # hand-authored
│       ├── xrefs.json              # extracted per compile
│       ├── briefing.md             # hand-authored per version
│       ├── build.sh
│       ├── table-layout.tex
│       └── versions/vN.N/          # compiled per-version (static, committed)
│           ├── *.md
│           └── <slug>-vN.N.pdf     # committed for Scholar same-domain
│
├── articles/                       # non-study reference articles
├── primary-sources/                # central store
│   ├── manifest.json
│   ├── README.md                   # ID convention
│   ├── PD/
│   └── CC/
│
├── site/                           # Astro Starlight
│   ├── astro.config.mjs            # site: 'https://lemma.gig8.com' from Phase 2a (R5 B2)
│   ├── package.json                # includes copy-pdfs pre-build script (per-study loop; R6 A2)
│   ├── src/
│   │   ├── layouts/
│   │   └── pages/
│   │       ├── privacy.astro       # renders from ../../PRIVACY.md
│   │       ├── [slug]/index.astro
│   │       ├── [slug]/[chapter].astro
│   │       └── [slug]/versions/[version]/[chapter].astro  # noindex, follow
│   └── public/
│       ├── robots.txt              # AI-bot permissive
│       ├── _redirects              # 301s
│       ├── studies/                # populated by copy-pdfs script (R6 A2 corrected loop)
│       └── favicon.ico
│
├── scripts/
│   ├── lemma-cli/                  # §21 CLI (health-check, verify-release, dry-run-erasure, self-test)
│   ├── compile-study.js
│   ├── verify/                     # + verify-manifest + verify-anchors + verify-study-yaml + verify-machine-readable
│   ├── review/dispatch-reviews.mjs
│   ├── export-annotations.mjs
│   ├── export-comments.mjs
│   ├── export-feedback.mjs         # strips transport headers
│   ├── zenodo-reserve-doi.mjs
│   ├── zenodo-publish.mjs
│   ├── zenodo-update-metadata.mjs  # Phase 4 exit URL update (R6 A1)
│   ├── cross-post-pubpub.mjs
│   ├── push-wayback.mjs
│   ├── push-software-heritage.mjs
│   ├── update-huggingface-ds.mjs
│   ├── update-wikidata.mjs
│   ├── phase4-exit.mjs             # single atomic script (R6 B6)
│   └── style-codegen.js
│
├── annotations/                    # public hypothes.is export
├── comments/                       # public Giscus export
├── feedback-log/                   # public substance-only dispositions (opt-in credit)
├── absorption-benchmarks/          # public aggregate scores + methodology only
│
├── data/                           # PUBLIC data files (curated — no operational metadata per R6 B2)
│   ├── failure-modes.yaml          # §21F registry (public — transparency-safe)
│   ├── phase-state.yaml            # §21 phase-state config (public — transparency-safe)
│   ├── last-heartbeat.txt          # heartbeat only; no operational details
│   └── last-health-check.json      # aggregate pass/warn/fail counts only; details in workroom
│
├── tests/fixtures/verify/          # committed ground-truth fixtures
│
└── .github/
    ├── ISSUE_TEMPLATE/feedback.yml
    └── workflows/
        ├── on-tag-release.yml
        ├── nightly-annotations-export.yml
        ├── nightly-comments-export.yml
        ├── nightly-feedback-triage.yml
        └── keep-alive.yml
```

**No `on: push` workflow in this repo** (R3 C1 invariant).

**Per-study PDF copy loop (R6 A2 corrected):**
```json
{
  "scripts": {
    "copy-pdfs": "for d in studies/*/; do slug=$(basename \"$d\"); mkdir -p \"site/public/studies/$slug\" && cp -r \"$d\"versions \"site/public/studies/$slug/\" 2>/dev/null || true; done",
    "build": "npm run copy-pdfs && npm run version:generate && astro build"
  }
}
```
OR proper Astro Integration with `astro:build:setup` hook. **Documentation must state that Astro `public/` gets copied into `dist/` by default so the copy target `site/public/studies/…` results in URL `lemma.gig8.com/studies/<slug>/versions/vN.N/<slug>-vN.N.pdf`** (per R6 C5 clarification).

### 5.2 `lemma-studies/lemma-workroom` (private, LFS)

```
lemma-workroom/
├── README.md
├── CLAUDE.md                       # workroom-side AI-maintenance playbook (§21B)
├── .gitattributes                  # *.pdf filter=lfs
├── .gitignore
├── rotation-log.md                 # secret rotation record (§15)
├── erasure-log.md                  # REQUEST RECORDS ONLY (no backup of erased content)
├── retention-schedule.md           # documented purge cadence (workroom + Zoho + Gmail)
├── chore-log.jsonl                 # ALL operational chore entries (R6 B2 — moved from public)
│
├── studies/<slug>/
│   ├── Working-Notes/
│   ├── review-packages/
│   ├── external-reviews/
│   ├── dispositions/
│   ├── research-findings/
│   └── drafts/
│
├── primary-sources/
│   ├── OA-hosted-unclear/
│   └── restricted/
│
├── annotations/                    # editorial hypothes.is export
│
├── feedback-inbox/                 # raw emails, headers stripped, N-month retention
│
├── absorption-benchmarks/          # probes + canary phrases + expected answers + per-probe transcripts
│
├── scripts/                        # personal python utilities
│
└── ponderings/                     # PARA-style, cross-study
```

### 5.3 `gig8/lemma-<slug>` (Phase 6+, thin per-study mirror)

Thin per-study mirror repo. Not the DOI mechanism (DOIs come from Zenodo REST per §6.3). Not artifact-bearing. Purpose: GitHub-side discoverability, one canonical citation surface per study for GitHub-crawling AI training corpora.

```
lemma-<slug>/
├── README.md                        # abstract, canonical URL, concept DOI, how to cite
├── LICENSE                          # CC BY 4.0
├── CITATION.cff                     # per-version citation; updated per release
└── LATEST                           # points at latest version + DOI + release URL
```

Zero binary content. Auto-generated by Job 4 on first release per study (Phase 6+).

### 5.4 Retired `gig8/lemma` — 9-step SAFE MIGRATION procedure

Critical: the current `gig8/lemma` repo contains material assigned to workroom. Never make public. 9-step sequenced procedure to prevent stale-remote republishing:
1. Freeze all pushes through step 9 (physical lock via GitHub Ruleset per R5 C7)
2. Rename `gig8/lemma` → `gig8/lemma-legacy`
3. Repoint every reference
4. **Pause old CF Pages project deployments** (was mispinned to step 8 in v5 table; corrected in v6+)
5. Verify with grep (constrained roots per R6 C9 — drop `-type d`; targeted `.git/config` find; single SSH-aware alternative)
6. Inventory + revoke external push credentials
7. Create new empty public `gig8/lemma` with README stub
8. Archive stub immediately (Settings → Archive)
9. Un-freeze pushes to `lemma-legacy` (stub is archived; un-freeze applies to legacy only for pre-Phase-4 emergency)

Archive `lemma-legacy` in Phase 9 cleanup (R5 C6).

## 6. Publishing Flow

### 6.1 Author writing loop

1. Open `~/Projects/lemma-studies/lemma-content/` in Obsidian (Tim ~1%) or via Claude (~99%)
2. `git checkout -b <round-or-feature>` off `develop`
3. Edit chapter files; commit with rationale ("fold Fable Round N S1.2 into Ch4 §4.3")
4. Push; CF Pages builds branch preview at `<branch>.lemma-content.pages.dev`
5. Open PR against `develop`; preview URL auto-comments
6. Send preview URL to reviewers if applicable (Fable dispatch, Grok/Gemini chat, human via hypothes.is editorial group)
7. Fold dispositions on the branch; iterate
8. Merge to `develop`; `develop.lemma-content.pages.dev` reflects new state
9. When cutting a version: proceed to §6.2

### 6.2 Cutting a version (pre-tag DOI reservation)

**Invariant:** `main` at any moment reflects union of publishable content across studies.

**Version-cut procedure:**
1. `git checkout main && git merge develop`
2. `npm run compile:study --study <slug> --version vN.N` — writes `studies/<slug>/versions/vN.N/*.md` + `xrefs.json` + composite `.md` + regenerates `claims-index.jsonl` + `llms-full.txt` corpus-level
3. `node scripts/zenodo-reserve-doi.mjs --study <slug> --version vN.N` — script reads `base_url` from `data/phase-state.yaml` (per R7 A1); two-path logic (existing draft reuse; fresh concept; newversion on latest published)
4. Single commit:
   ```bash
   git add studies/<slug>/versions/vN.N/ studies/<slug>/xrefs.json studies/<slug>/study.yaml \
           claims-index.jsonl llms-full.txt
   git commit -m "release: <slug>/vN.N — compile + DOI reservation"
   git push origin main
   ```
5. **Tag: `git tag -a <slug>/vN.N -m "..." && git push origin <slug>/vN.N` — Tim executes this step; AI never delegated (per R7 B8: tag creation IS the human gate for irreversible Zenodo publish).**
6. GitHub Action fires.

**HUMAN-GATE DISCIPLINE (R7 B8):** Job 3d publishes to Zenodo, which is an irreversible public scholarly record (Zenodo has no un-publish; erasure is takedown-request-only per §16). Tag creation is therefore `human-gate` autonomy in §21F terms — never delegated to unattended AI. AI may prepare steps 1-4; Tim executes step 5.

**Abort path (v5 C5):** if steps 2-3 fail, `git reset --hard origin/main`; don't tag until clean.

**Retag playbook:** delete tag; `--force` compile if needed; re-mint. Zenodo publish is not retriable in "un-publish" sense.

### 6.3 The tag-triggered pipeline (job-staged; phase-aware)

**Repo-wide concurrency group** serializes cross-release pushes.

**Job 1 — `build`** (pure verify + PDF)
| Step | Action | Failure |
|---|---|---|
| 1a | Validate tag format + slug match + monotonicity + `study.yaml` version match; **AND refuse if any open Issue with label `verify-release-failure` exists** (R6 C12 mechanism enforcement of §21I) | Refuse |
| 1b | Re-run `compile:study --check` — verify tagged commit contains matching versioned markdown; emit composite + `.rag.md` as workflow artifacts | Fail hard |
| 1c | `verify:study` — fixtures + manifest integrity + anchor uniqueness + study.yaml schema + **claims.jsonl/xrefs.json/rag.md schema validation** (R6 B9) | Fail hard |
| 1d | `build.sh` — PDF from clean composite | Fail hard |

**Job 2 — `release`** (guarded, needs: build)
| Step | Action |
|---|---|
| 2a | Check GitHub Release exists for tag; skip if exists |
| 2b | Create Release; changelog scoped to studies/<slug>/ + shared paths |
| 2c | Download composite + rag from artifacts; attach with PDF to Release |
| 2d | Copy release PDF to `studies/<slug>/versions/vN.N/<slug>-vN.N.pdf` on main; single push; fetch-rebase-push; **NO `[skip ci]`; Action guard rejects if commit message contains any CF-skip phrase** |

**Job 3 — `doi-publish`** (REVISED per R6 A1; simpler than v6's split)
| Step | Action | Phase |
|---|---|---|
| 3a | Read concept + version DOIs from `study.yaml` (reserved pre-tag) | All |
| 3b | Query Zenodo: does concept have published version with `metadata.version == vN.N`? Skip if yes. | All |
| 3c | Delete draft's inherited files; upload composite + rag + PDF | All |
| 3d | **PUBLISH the deposit** (Phase 3 first-release publishes; subsequent releases publish; `newversion` chain works because prior versions are published). **Zenodo metadata references URLs constructed from `data/phase-state.yaml.base_url`** — during Phases 2b-3 this is `https://lemma-content.pages.dev` (pilot serving URL); after Phase 4 exit domain cutover it flips to `https://lemma.gig8.com`. `zenodo-update-metadata.mjs` at Phase 4 exit updates all published depositions' metadata (Zenodo permits metadata edits post-publish, not file content) to the canonical URL. **No dead-URL window** — Zenodo always references a currently-live host. (R7 A1 corrects v7 contradiction where §6.3 said canonical while §3/§7.9/§11 said `.pages.dev`.) | All |

**Phase 3 pilot constraint (R6 A1):** pilot cuts single tag per study — no v5.5 within Phase 3. `newversion` unnecessary in pilot.

**Phase 4 exit (R6 A1 second half):** `zenodo-update-metadata.mjs` updates Zenodo metadata to canonical `lemma.gig8.com/...` URLs after domain cutover completes. Zenodo permits metadata edits post-publish (not file content).

**Job 4 — `mirror`** (Phase 6+): unchanged.

**Job 5 — `publish-surfaces`** (needs: doi-publish)
| Step | Action | Guard | Phase |
|---|---|---|---|
| 5a | SWH save-code-now | Idempotent | All |
| 5b | HuggingFace Dataset push | Skip on failure | Phase 3+ |
| 5c | PubPub cross-post + content-hash | Skip if API unavailable | Phase 6+ |
| 5d | Wayback SPN2 | Continue on failure | Phase 6+ |
| 5e | Wikidata (notability-gated) | Skip if fails | Phase 7+ |
| 5f | Preprint deposit | Skip if API unavailable | Phase 7+ |

**Job 6 — `announce`** (needs: publish-surfaces)
| Step | Action |
|---|---|
| 6a | Ensure Giscus discussion exists; pre-create if needed |
| 6b | Post release-notes comment |
| 6c | **AFTER 6b**, invoke `lemma verify-release <slug>/vN.N` (per R6 C8 — ordering); result read by phase-aware check semantics (R6 A3); `fail`-status checks open Issues with `verify-release-failure` label |

**Frozen URL 404 window** (~2-3 min). PDF URL follows same window (Job 2d completes, CF rebuilds).

**Reindex signal:** Scarlight polls Releases feed on local cron.

### 6.4 Preview / branch deploys

CF Pages branch previews native — every push to any branch generates preview URL `<branch>.lemma-content.pages.dev`. hypothes.is annotations on preview URLs deliberately scoped to preview (feature-flagged OFF pre-launch per R1 A17). Preview URLs excluded from `sitemap.xml`. Base URL for preview equals the preview host (parameterizes per §9.3 URL discipline via phase-state).

### 6.5 Nightly exports

- `nightly-comments-export.yml` — GitHub Discussions API → `comments/<slug>.jsonl`
- `nightly-annotations-export.yml` (public) — hypothes.is public group → `annotations/<slug>.jsonl` with server-side version-stamping
- `nightly-annotations-export.yml` (editorial) — hypothes.is editorial group → `lemma-workroom/annotations/<slug>.jsonl`
- `nightly-feedback-triage.yml` — GitHub Issues + workroom feedback-inbox → daily triage digest; substance-only dispositions to `feedback-log/<slug>.md` with opt-in credit
- `keep-alive.yml` — heartbeats `data/last-heartbeat.txt` (touch-with-timestamp, never no-op skip)

`export-feedback.mjs` **strips transport headers** before writing to workroom feedback-inbox.

**Retention chores (R6 B2 + Fable S2.4 resolution):** workroom `git filter-repo` quarterly + Zoho folder auto-delete on same N-month schedule + **Gmail Apps Script quarterly purge** (arrival-time filters can't do N-month retention). Effective retention = N to N+3 months per R6 C6; state granularity in §16.

**Chore-log discipline (R6 B2):** Apps Script writes execution log to Google Apps; AI reads execution log after each quarterly cycle and writes canonical chore-log entry to `lemma-workroom/chore-log.jsonl`. No new PAT secret needed for Apps Script; AI is the single source of truth for chore-log entries.

## 7. Content and Primary Sources

### 7.1 Chapter files as canonical

Chapter files (`00-Overview.md`, `01-Chapter-*.md`, etc.) in `studies/<slug>/` are single source of truth. Derivatives:
- Compiled composite `<slug>-vN.N.md` (Release only, not committed)
- Compiled per-chapter versions in `studies/<slug>/versions/vN.N/*.md` (committed for static frozen URLs)
- Breadcrumbed variant `<slug>-vN.N.rag.md` (Release only, referenced from `llms.txt`)
- PDF (Release + committed to `versions/vN.N/`)
- `xrefs.json` (extracted per compile, committed)
- `claims.jsonl` (hand-authored, committed)
- `briefing.md` (hand-authored per version, committed)
- `primary-sources.json` (hand-authored, committed)
- `study.yaml` (hand-authored except auto-updated version table)

### 7.2 Editorial voice

Servant, not academic; extends to Giscus, hypothes.is embed, feedback templates.

### 7.3 Cross-study see-also and ecosystem posture

Every study has "See also" section linking other treatments (including disagreements). No consent required for linking publicly-published scholarship.

### 7.4 Epistemic humility in claims registry

`claims.jsonl` entries carry `confidence: high | moderate | contested | speculative` + `counter_positions` pointers.

### 7.5 Central primary-source store

Primary sources live at repo root in `primary-sources/`, NOT under each study. Studies reference by ID from their own `primary-sources.json`. One authoritative record per source across studies. Fixes multi-study-shared-source problem cleanly. Three-tier policy: PD/CC-BY (public cache in `lemma-content`), OA-hosted-unclear (metadata public, PDF in `lemma-workroom/primary-sources/OA-hosted-unclear/`), restricted (metadata public with `canonical_url` at source, PDF in `lemma-workroom/primary-sources/restricted/`, Scarlight `library` corpus with `visibility: private`).

Schema:
```json
{
  "id": "irenaeus-ah-2-22-5",
  "citation": "Irenaeus, Against Heresies 2.22.5",
  "translator": "Roberts-Donaldson",
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

Three-tier policy: PD/CC → `lemma-content/primary-sources/{PD,CC}/`; OA-hosted-unclear → `lemma-workroom/primary-sources/OA-hosted-unclear/`; restricted → `lemma-workroom/primary-sources/restricted/`.

Referential integrity in Job 1c: fail if study `primary-sources.json` contains ID absent from manifest.

### 7.6 Multi-surface publication

**Primary (all phases):** `lemma.gig8.com`, Zenodo, GitHub repos, Software Heritage (source tree + committed PDFs).

**Mirror surfaces:**
- HuggingFace Datasets (Phase 3+) — card YAML with valid keys only; `configs`: `default: {default: true, latest-version-only across all studies}` + `historical: {all versions appended}`. Card body has Citation + Homepage. Explicit `default: true` per §7.6 note (R6 C14).
- PubPub (Phase 6+), Wayback (Phase 6+), Wikidata (Phase 7+, notability-gated), preprint (Phase 7+)

**Distribution:** Semantic Scholar, ATLA (Phase 6+); Google Scholar via Highwire (day-one); OpenAlex + Crossref automatic via Zenodo DOI.

### 7.7 AI-optimization surfaces

Day-one: Highwire, JSON-LD (ScholarlyArticle for study, Chapter with `isPartOf`), Dublin Core, robots.txt permissive, `llms.txt`, `llms-full.txt`, `.well-known/ai.txt`, `<link rel="alternate">`, raw `.md`, per-study briefing/xrefs/claims, `citation_pdf_url` same-domain.

**`llms-full.txt` sizing (R7 B7 — measurement path + glob corrected):**
- **Measure NOW at Phase 2a preparation** using existing pre-migration Vault path (`studies/<slug>/versions/` doesn't exist until Phase 3):
  ```bash
  # From existing Vault (pre-migration), all study chapters including appendices
  wc -c "/mnt/c/Users/timuy/Dropbox/personal/Vault/Projects/lemma/What Is the Perfect/"{[0-9]*,Appendix*}.md \
    | awk 'END{print "chars:", $1, "  est tokens:", $1/4}'
  # Then extrapolate to 15 studies
  ```
- Extrapolate to 15 studies
- **Decision rule:** if projected total > 200K tokens OR > 25MB → implement Option 3 chunked format from day-one:
  - `llms.txt` (index) + `llms-full.txt` (index-of-chunks with clear section markers `--- STUDY: <slug> ---` `--- CHAPTER: <NN-title> ---`)
  - Individual chunk URLs `lemma.gig8.com/llms/full/<slug>/<chapter>.txt` (or `.md`)
  - Health-check verifies HTTP 200 for chunk URLs (R6 C20 / Gemini P3)
- If projected < 200K tokens: single file works; keep monitoring quarterly per §21G health check
- **Decision made + recorded in v7.1 supplement or as part of Phase 2a implementation notes.**

### 7.8 Cambridge-style scholarly conventions

Named series "Lemma Studies" (ISSN); bibliographic export (BibTeX/RIS/CSL-JSON); ATLA outreach (Phase 6+); Dublin Core; JATS-XML/OAI-PMH DEMOTED to "if ATLA requests."

### 7.9 Concept vs version DOI policy

- `study.yaml` — concept DOI + versions table
- README "How to cite" — concept DOI
- CITATION.cff on mirror — version DOI
- Highwire `citation_doi` — concept on living, version on frozen

Concept DOI first-release resolution: **published at Phase 3 first-release per R6 A1** → resolves immediately after first Zenodo publish. Broken-URL window: Zenodo metadata initially references `lemma-content.pages.dev` URLs; UPDATED to `lemma.gig8.com` at Phase 4 exit.

## 8. Scarlight Integration

Scarlight already indexes 14 studies + primary-sources corpus + patristic-cache.

**Migration changes:**
- Update `source_url` per corpus from Vault to git paths
- Add web URL binding (github.com/lemma-studies/lemma-content/tree/<tag>/...)
- Drop stray corpora (playwright-mcp, empty library)
- Add central primary-source ingest paths (public + private-tier)
- Central private-tier `visibility: private` — never surfaces on public Scarlight

**Tag-triggered reindex (pull-model):** Scarlight polls Releases feed on local cron ~15 min; catches up on missed tags with exponential backoff.

**New corpora:** `annotations_lemma`, `annotations_lemma_editorial` (private), `comments_lemma`, `feedback_lemma`, `claims_lemma`, `xrefs_lemma`.

**Default query behavior:** latest-version passages by default; historical via opt-in flag.

**Public exposure (Phase 7+):** `mcp.lemma.gig8.com` read-only MCP + `scarlight_ref` template dual-linking.

**Scarlight DR:** nightly DB backup to R2 (see §15 for creds).

## 9. Commentary and Annotation Architecture

### 9.1 Chapter-level Giscus

`mapping: 'pathname'` bound to Discussions on `lemma-studies/lemma-content`. Excluded from `/versions/**`. Pre-created on first publish per study by Job 6a. Existing discussions on `gig8/lemma-legacy` don't migrate (documented loss); screenshot high-value threads.

### 9.2 Inline annotation (hypothes.is)

Public + `lemma-editorial` private groups.

### 9.3 URL discipline

**Living URL** — self-canonical, indexed, comments/annotations evolve with text.

**Frozen URL** (`/versions/vN.N/`) — self-canonical + `noindex, follow`, excluded from sitemap. Text never changes. Annotation permanence surface.

**Preview URL** — self-canonical (branch-scoped); hypothes.is OFF pre-launch.

**Author discipline:** slug frozen at birth; chapter numbering never renumbers; explicit `{#s-4-3}` anchor IDs (uniqueness lint-enforced per R2 P8); every page emits `<link rel="canonical">`.

**Phase 3 exit additions per R5 + R6:**
- Sitemap includes canonical `lemma.gig8.com/*`, excludes `/versions/**`
- Canonical tags point to `lemma.gig8.com` (verifies §5.1 `site:` config per R5 B2)
- `citation_pdf_url` at `lemma.gig8.com/studies/<slug>/versions/vN.N/<slug>-vN.N.pdf` returns 200 (correct path per R6 A2)
- No `X-Robots-Tag: noindex` header applied path-wide on CF
- `robots.txt` does not `Disallow: /versions/` or `/studies/`
- **`llms-full.txt` size < declared threshold** (R5 C9 + R6 B1)

### 9.4 Version-tag stamp (server-side)

Nightly export stamps annotations with `version_at_creation` computed from `annotation.created` against `study.yaml` history.

### 9.5 Comments/annotations as first-class content

Nightly export → git commit → Scarlight ingest.

## 10. Editorial Workflow

### 10.1 AI-review workflow

Compile → dispatch Fable → hand-carry Grok/Gemini → verify each finding → fold via PR.

### 10.2 Human-review workflow

Invite to `lemma-editorial` hypothes.is group; annotate on preview or living URL; PR against `develop`.

### 10.3 AI-native editorial participation

hypothes.is REST API + GitHub Issues API. Day-one via WebFetch; day-two `mcp__lemma-annotations` MCP wrapper.

AI identity: `lemma-ai-editor` account. **Endorsement mechanism: batch ratification (default)** — Tim reviews digest, AI posts approved replies; per-thread endorsement for contested calls.

### 10.4 Feedback intake and processing pipeline (GDPR-clean)

**Intake channels** with explicit consent architecture per channel.

**Email pipeline:** `lemma@gig8.com` (Zoho alias) → Gmail forward → MCP poll → **workroom private Issue** with `type:email-feedback` label. Body + From + Subject + Date + Message-ID retained; **transport headers stripped**.

**Retention (three synchronized schedules per R5 A4 + R6 B5):**
- Workroom `feedback-inbox/*.jsonl` — purged N months post-disposition via periodic `git filter-repo` (quarterly chore)
- **Zoho `Lemma-Feedback` folder** — auto-delete rule on same N-month schedule
- **Gmail** — quarterly **Apps Script** iterates `lemma-feedback` label > N months + disposition-completed; permanent-delete via `Gmail.Users.Messages.remove()`. Aligned with workroom filter-repo quarterly chore. **AI writes chore-log entry after verifying Apps Script execution log** — no new PAT secret needed for Apps Script.

**Effective retention: N to N+3 months** (quarterly granularity per R6 C6); documented in §16.

**Erasure-log accountability trade-off:** reference-ID maps to nothing after mailbox purge — accepted minimization (Art. 5(2) sacrificed for Art. 5(1)(e) at solo-controller scale).

**Weekly triage cycle:** AI queries all surfaces; deduplicates; clusters; produces triage digest → Tim greenlights → AI batch-executes approved replies + folds.

**Quarterly AI-absorption benchmarking:** probes + canaries + expected answers PRIVATE (workroom); public benchmarks = aggregate scores + methodology + trends only. Set expectations: parametric signal lags training cutoffs 6-18 months. **Use no-training API endpoints where offered** (Anthropic no-train by default; OpenAI opt-out header); document limitation where flag unavailable.

## 11. Migration Plan

**Phase 1 — Repo scaffolding + safe legacy migration.**
9-step §5.4 procedure; CF pause = step 4; physical GitHub Ruleset lock for freeze; external inventory + credential revocation before stub creation. Two new repos created (`lemma-content` public + `lemma-workroom` private LFS). Nothing deleted from Vault yet.

**Phase 2a — Minimum site.**
Move Astro Starlight chrome to `lemma-content/site/`; move tooling to `lemma-content/scripts/`. Deploy new CF Pages project attached to `lemma-content` (**custom domain NOT attached; stays on `.pages.dev`**). Handle un-migrated studies with "Migration Queued" badge + `noindex` + sitemap-exclude. Set `astro.config.mjs`: `site: 'https://lemma.gig8.com'` from launch. Verify per-study PDF copy loop (single-study passes trivially).

**Phase 2b — AI-surface + intake layer.**
Highwire + JSON-LD + Dublin Core; `llms.txt`, `llms-full.txt` (per §7.7 sizing decision made from Phase 2a measurement), `claims-index.jsonl`, `.well-known/ai.txt`, `<link rel="alternate">`. Feedback template + public-consent checkbox. Nightly export workflows (comments/annotations/feedback/keep-alive). Email intake via Zoho + Gmail + workroom Issue. `lemma-editorial` group + `lemma-ai-editor` identity created. `privacy@gig8.com` alias. **§21 scaffolding:** `CLAUDE.md` at both repo roots with `design-version: v7` header; `scripts/lemma-cli/` (health-check, verify-release, dry-run-erasure, self-test); `data/failure-modes.yaml`; `data/phase-state.yaml`; workroom `chore-log.jsonl`; Zoho + Gmail Apps Script quarterly retention chore. No `on: push` workflow.

**Phase 3 — Pilot vertical slice: "What Is the Perfect."**
Copy chapters → `lemma-content/studies/what-is-the-perfect/`; drop `MIGRATED.md` in Vault. Move workroom content. Author `study.yaml`, `primary-sources.json`, `claims.jsonl`, `briefing.md`. Populate manifest. Pre-tag: compile + **reserve DOI + PUBLISH first version** (per R6 A1). Cut `what-is-the-perfect/v5.4` (single tag; no v5.5 in pilot per R6 A1 constraint).

- Zenodo metadata initially references `lemma-content.pages.dev` (custom domain not yet attached; update at Phase 4 exit)
- First HuggingFace Dataset push (Phase 3+)
- First SWH save-code-now
- Minimal Scarlight repoint (WITP `source_url` + local cron)

**Phase 3 exit criteria (updated for R6+R7):**
- Pilot site live at `lemma-content.pages.dev/what-is-the-perfect/`
- `/versions/v5.4/` renders permanent text
- **Zenodo published**; concept DOI resolves; version DOI landing page reachable
- **Synthetic-second-study test** (R7 B6 corrected — v6/v7 version would have contaminated public corpus):
  - Run in **`/tmp/lemma-synthetic-test/` OR throwaway git worktree** (`git worktree add /tmp/synthetic-worktree HEAD~0`); NEVER commit to `main` or `develop`
  - Create fake `studies/test-study-2/versions/v1.0/` with placeholder markdown + PDF in the tmp/worktree location
  - Run `copy-pdfs` script; verify BOTH studies' PDFs land under correct per-study path
  - **Health-check assertion (added to `lemma health-check`):** no `test-*` slug exists on `main`
  - Cleanup: `git worktree remove /tmp/synthetic-worktree` OR `rm -rf /tmp/lemma-synthetic-test`
  - This validates R6 A2 PDF-copy-loop fix at PILOT time (single-study passes trivially; second study is where the bug fires)
- Scarlight reindexed for WITP
- SWH archived
- HF dataset live (default config = WITP latest only; historical config with WITP v5.4)
- **`lemma health-check` (run LOCALLY per R7 D12 — where chore-log-dependent + Scarlight checks are live) returns clean:** DOI checks `blocking` and PASS because published; SWH `pending` with 48h recheck; Scarlight visible locally not skipped; chore-log-dependent checks visible
- Synthetic-fetch: HTML 200, raw `.md` 200, `llms.txt` 200, `llms-full.txt` 200 (or chunk URLs 200), PDF at `/studies/<slug>/versions/vN.N/<slug>-vN.N.pdf` returns 200
- 12-UA synthetic-fetch all return 200
- Sitemap includes living URLs + canonical `lemma.gig8.com`; excludes `/versions/**`
- No `X-Robots-Tag: noindex` on frozen path; robots.txt doesn't Disallow `/studies/` or `/versions/`
- No PII in any public artifact

**Phase 4 — Bulk migration of remaining 13 studies + PRODUCTION CUTOVER.**
- Same per-study pattern with concurrency-serialized tags; multiple versions per study OK now (WITP already published; `newversion` chain works)
- **Phase 4 exit (single atomic script `phase4-exit.mjs`, updated per R7):**
  1. Domain cutover: remove `lemma.gig8.com` from old CF project → attach to new (brief same-zone gap)
  2. **Update `data/phase-state.yaml`:** set `base_url: https://lemma.gig8.com`, `current_phase: phase-4-exit`, `release_publish_unlocked: true` — commit and push (R7 B3 + B4)
  3. `zenodo-update-metadata.mjs` — update Zenodo metadata for ALL published studies (successful ones from Phase 3+4) to reference `lemma.gig8.com/...` URLs
  4. HuggingFace `homepage` update to `lemma.gig8.com`
  5. `lemma verify-release` for each migrated study — phase-aware checks now all `blocking` at production URLs; must all pass
- **Partial-failure playbook (R7 D3 addition):** if step 3 fails on study N, continue with degraded state + open `phase4-exit-partial` Issue + retry remaining studies within 24h. **On retry, re-run `zenodo-update-metadata.mjs` ONLY for studies that succeeded initially** to avoid mixed URL state.
- Register `phase4-exit-partial` failure mode in `data/failure-modes.yaml`

**Phase 5 — Scarlight bulk retooling.** Bulk `source_url` updates for all 14 studies. Drop stray corpora (`study_playwright-mcp`, empty `library`). Add `annotations_lemma*`, `comments_lemma`, `feedback_lemma`, `claims_lemma`, `xrefs_lemma` corpora with nightly-export ingestion. Add nightly Scarlight DB backup to R2.

**Phase 6 — Per-study mirror repos + PubPub + Wayback.** Release Action Job 4 creates `gig8/lemma-<slug>` on first release per study (thin: README + CITATION.cff). PubPub cross-post via API (with content-hash drift detection). archive.org Wayback SPN2 authenticated push per release.

**Phase 7 — Distribution + higher AI-first surfaces.** Wikidata items for series + per-study (notability-gated on OpenAlex work ID). OAI-PMH feed + JATS-XML export only if ATLA specifically requests. Bibliographic export buttons (BibTeX/RIS/CSL-JSON) at study level. Semantic Scholar + ATLA source-inclusion requests. Preprint deposit (Humanities Commons or similar). Content-negotiation via CF Pages Function only if raw `.md` + `llms.txt` prove insufficient. Public MCP endpoint at `mcp.lemma.gig8.com` (stdio-only tools stay stdio; only non-erasure, non-mutation-retention-chore tools go network — per §21H).

**Phase 8 — Feedback and ecosystem maturity.** Quarterly AI-absorption benchmarking cadence established. "See also" sections populated across studies. ISSN application submitted for "Lemma Studies." Gmail full-access for AI autonomous reply to `lemma@gig8.com` (deferred roadmap; requires explicit design revisit).

**Phase 9 — Vault stub + cleanup.** Personal Vault at `Vault/Projects/lemma/` becomes README stub pointing at git locations. `Vault/Archives/lemma/` similar. Clean up `.tmp.*` orphans across old paths. **Archive `lemma-legacy` repo** (Settings → Archive) to prevent drift post-Phase-4 (per R5 C6).

## 12. What Ships Day One vs Later

**Day one (Phases 1-3):**
- Safe two-repo scaffolding + 9-step legacy migration
- Old CF Pages project paused
- Pilot site at `.pages.dev` (custom domain attached Phase 4 exit)
- WITP fully migrated + published to Zenodo
- Living + Frozen URL surfaces both active
- **PDF at same-domain frozen path with correct per-study path** (R6 A2)
- Job-staged pipeline + Zenodo publish-first-version + concurrency group
- Giscus + hypothes.is public + editorial groups
- All nightly exports + retention schedules
- Scarlight pilot repoint + resilient polling
- Highwire + JSON-LD + Dublin Core + `llms.txt` + `llms-full.txt` (single or chunked per §7.7 decision) + `claims-index.jsonl` + `<link rel="alternate">` + raw `.md`
- Per-study briefing/claims/xrefs
- Central primary-source store + integrity + anchor + study.yaml schema + machine-readable schema validation
- Structured feedback + email intake (workroom) + header stripping + mailbox retention (three schedules)
- Absorption benchmarking (probes private; aggregates public)
- PRIVACY.md as `/privacy` route + `privacy@` alias
- Software Heritage save-code-now per release
- HuggingFace Datasets push per release (Phase 3+)
- **§21 AI-maintenance scaffolding:** CLAUDE.md per repo with `design-version: v7`; `scripts/lemma-cli/`; `data/failure-modes.yaml` (with autonomy fields); `data/phase-state.yaml`; workroom `chore-log.jsonl`; phase-aware verification semantics
- **Synthetic-second-study test in Phase 3 exit** (R6 Fable overall insight)

**Phase 4 exit:**
- Production domain cutover + Zenodo metadata URL update + HF homepage update + per-study verify-release (single atomic script)

**Phase 6+:** per-study mirror repos, PubPub cross-post, archive.org Wayback SPN2, bulk Scarlight retooling + DR backup.

**Phase 7+:** Wikidata items (notability-gated), ATLA + Semantic Scholar source-inclusion, ISSN application, OAI-PMH/JATS (only on ATLA request), content-negotiation (only if needed), public MCP endpoint at `mcp.lemma.gig8.com` (stdio-tool subset).

**Phase 8+:** Quarterly AI-absorption benchmarking cadence, "See also" ecosystem population, Gmail autonomous reply roadmap.

## 13. Risks and Open Questions

All prior risks retained. R6 additions:

| Risk | Mitigation |
|---|---|
| Zenodo reserve-only across multiple pilot versions | R6 A1: publish first version at Phase 3; pilot = single tag per study |
| PDF copy merges all studies | R6 A2: per-study loop; synthetic-second-study test in Phase 3 exit |
| Verification layer phase-blind → alarm fatigue kills automation | R6 A3: phase-aware semantics via `data/phase-state.yaml` + per-check contracts |
| MCP endpoint exposes GDPR data without auth | R6 A4: stdio-local default; erasure tools never network-exposed |
| Failure-mode registry drift | R6 A5: cross-ref fix + missing modes + `autonomy` field + staleness fields |
| Public chore-log leaks operational metadata into corpus | R6 B2: chore-log → workroom; public `data/` limited to failure-modes + phase-state |
| CLAUDE.md drift from design | R6 B3: `design-version:` header + point-not-restate + drift-detection health check |
| Non-idempotent scripts + AI retry = double mutation | R6 B4: idempotency requirement in script contract |
| §15 secrets stale after v6 additions | R6 B5: reflowed in v7 (Apps Script identity handled via execution-log-verify, no new PAT) |
| Phase 4 exit partial failure | R6 B6: single atomic script + partial-failure playbook + `phase4-exit-partial` mode |
| dry-run-erasure blind to expired credentials | R6 B7: `--verify-credentials` flag |
| GH Actions 60-day cron auto-disable | R6 B8: CLAUDE.md session-start ritual + optional external heartbeat (Phase 6+) |
| Machine-readable surface schema validation missing | R6 B9: added to Job 1c |

## 14. Cost Summary

All infrastructure is free or near-free:

| Component | Cost |
|---|---|
| hypothes.is (nonprofit) | $0 |
| Giscus / GitHub Discussions | $0 |
| GitHub public repos + private `lemma-workroom` | $0 on Tim's tier |
| GitHub Actions (~50-100 min/month realistic) | $0 (unlimited public; 2000 private free) |
| Git LFS on `lemma-workroom` | $0-5/month ($0 up to 1GB storage OR bandwidth/month; bandwidth is usually the ceiling per R4 P7) |
| Cloudflare Pages (500 builds/month cap; ~1 concurrent) | $0 |
| Cloudflare DNS | $0 |
| Zenodo (DOI minting via REST) | $0 |
| Software Heritage archival | $0 (nonprofit) |
| ORCID | $0 |
| Wayback (archive.org SPN2) | $0 free tier |
| PubPub (community tier; precarious per Jan 2026 update) | $0 currently — reevaluate if pricing changes |
| HuggingFace Datasets | $0 |
| Wikidata | $0 |
| Preprint deposit (Humanities Commons or similar) | $0 |
| ISSN for "Lemma Studies" | ~$45 one-time (US) or $0 (national ISSN center) |
| Scarlight (already self-hosted) | $0 marginal |
| Zoho email alias | $0 (existing subscription) |
| Gmail Apps Script | $0 |
| **Total incremental** | **$0 today; ~$5-10/month as workroom LFS accumulates PDFs** |

**PDF accretion** in `lemma-content`: realistic ~1-2MB per PDF × ~10 versions × 15 studies over decade ≈ 150-300MB (per R6 P1 corrected — v6's "500KB" estimate was optimistic for monograph-length PDFs with Noto Serif + Hebrew/Greek subsets). Consider Git LFS on public repo if it approaches ~300MB.

## 15. Secrets and Access Model (REFLOWED for v7 — R6 B5)

Least-privilege matrix — all secrets stored in `/mnt/a/gig8/credentials.json` (local) + GitHub Actions secrets (CI):

| Secret | Scope | Storage | Rotation |
|---|---|---|---|
| **GitHub App for `gig8/lemma-*`** | contents:write on `lemma-*` only; NOT org-admin; branch-protection bypass + allow-force-push toggle | GitHub App key in Actions secrets | Key doesn't expire (installation tokens hourly); policy = quarterly key rotation |
| ~~`RELEASE_PUBLISH_UNLOCKED` repo variable~~ | **DELETED per R7 B3** — was dual source-of-truth with `data/phase-state.yaml`. Phase state now lives ONLY in `data/phase-state.yaml`; CI parses via `yq '.release_publish_unlocked' data/phase-state.yaml`. | N/A | N/A |
| **Zenodo Personal Access Token** | Deposition scope (read/write/publish) + metadata edit | `ZENODO_TOKEN` Actions secret + `/mnt/a/gig8/credentials.json` | Quarterly |
| **hypothes.is API tokens** | Separate read + write; write scoped to `lemma-editorial` + `lemma-ai-editor` | `/mnt/a/gig8/credentials.json` + Actions secrets | Quarterly |
| **PubPub API token** | Cross-post scope on `lemma` community | Actions secret `PUBPUB_TOKEN` | Quarterly |
| **HuggingFace token** | Write on `gig8/lemma-*` datasets only | `HF_TOKEN` Actions secret | Quarterly |
| **Wikidata OAuth** | Edit scope for series + study items | `WIKIDATA_TOKEN` Actions secret | Annually |
| **Wayback SPN2 keys** | S3-style access + secret | `WAYBACK_S3_ACCESS` + `WAYBACK_S3_SECRET` | Annually |
| **Cloudflare API token** | Pages:Edit scope on `lemma-content` + `lemma-legacy` projects (for §16 CF Pages deployment deletion); Cache:Purge scope | `CF_API_TOKEN` Actions secret + `/mnt/a/gig8/credentials.json` | Quarterly |
| **R2 credentials (Scarlight DB backup)** | Write to single bucket `scarlight-backup` | Local systemd creds + `/mnt/a/gig8/credentials.json` | Quarterly |
| **Gmail access for `lemma@gig8.com`** | Read + label; existing MCP OAuth per session | Existing MCP session | Existing session model |
| **Zoho** | tim@gig8.com + aliases | `/mnt/a/gig8/zoho-credentials.md` | Rotate after any transcript exposure |
| **Gmail Apps Script** | Google-side identity; no PAT needed (AI verifies execution log + writes chore-log) | Google Apps Script deployment | Per Google Apps Script lifecycle |
| **Software Heritage save-code-now** | No auth needed | N/A | N/A |
| **Scarlight reindex** | Not needed in Actions (pull model) | N/A | N/A |

**Break-glass:** revoke via provider console → mint fresh → commit rotation record to `lemma-workroom/rotation-log.md`.

## 16. Moderation and Erasure Policy (COMPLETE v7 procedure)

**Data controller:** Tim Uy. Contact: `privacy@gig8.com` (Zoho alias). Rendered as `/privacy` on `lemma.gig8.com`.

**Valid erasure request response (Art. 17):**

1. **Confirm receipt within 72 hours** (auto-responder OK per R5 C20); communicate Art. 12 completion deadline (one month, extensible 2 months for complex).

2. **Identify affected artifacts:**
   - Public exports: `lemma-content/annotations/**`, `comments/**`, `feedback-log/**`
   - Workroom: `lemma-workroom/annotations/**`, `feedback-inbox/**`, `dispositions/**`, `chore-log.jsonl` (workroom-private per R6 B2)
   - **GitHub Release assets** — composite `.md`, `.rag.md`, PDF
   - Scarlight corpora
   - Software Heritage: snapshots at every release tag
   - Wayback snapshots
   - **Zenodo deposits** — takedown request
   - **HuggingFace dataset rows** (Phase 3+) — commit history retention
   - **PubPub cross-posts + mirror repos** (Phase 6+)
   - **CF Pages deployment history** — every `<id>.<project>.pages.dev` URL
   - **CF cache** — edge-cached responses
   - **CF Pages build logs** — commit metadata/PII
   - **GitHub Actions workflow run logs + artifacts** (90d self-expiry)
   - **Upstream GitHub Discussions** on `lemma-studies/lemma-content` (Giscus source of truth)
   - **hypothes.is server-side annotations**

3. **Purge from git repos:**
   - `git filter-repo --replace-text` (subject-specific strings) or blob-level removal
   - **Rewrite affected tags too** (breaks tagged-commit-self-contained retroactively for affected study)
   - Force-push with App using `--force-with-lease` (requires allow-force-push toggle)
   - **Force-push commit message must NOT carry `[skip ci]`** (must trigger CF rebuild to purge live site — R4 D10)

4. **Re-upload GitHub Release assets** from rewritten tree.

5. **Delete prior CF Pages deployments** containing affected content via CF API (`DELETE /accounts/{account}/pages/projects/{project}/deployments/{deployment}`).

6. **CF Cache Purge Everything** via CF API/dashboard.

7. **Delete affected CF Pages build logs.**

8. **Delete affected GitHub Actions workflow run logs.**

9. **Propagate to Scarlight:** trigger reindex.

10. **Propagate to workroom:** same filter-repo procedure.

11. **HuggingFace erasure:** re-push from purged state + **`HfApi.super_squash_history()`** collapses dataset repo to single commit → actual erasure not partial.

12. **PubPub deletion + mirror-repo tag rewrite** (Phase 6+).

13. **Zenodo takedown request** via `https://zenodo.org/help/about/` contact.

14. **Software Heritage takedown request** via `https://www.softwareheritage.org/contact/`.

15. **Delete upstream GitHub Discussions** on `lemma-studies/lemma-content` for affected threads (via GraphQL API).

16. **hypothes.is server-side deletion** — verify group moderator scope; delete via hypothes.is API where permitted; note limitations for third-party annotators.

17. **Wayback:** provide subject archive.org's own removal process.

18. **GitHub Support request** for cached views/PR refs/fork objects (`https://support.github.com/contact/private-information`).

19. **Erasure log** in `lemma-workroom/erasure-log.md` — REQUEST RECORDS ONLY (no content backup):
    - Requester identity (minimized — reference ID)
    - Date received + Art. 12 deadline + date completed
    - Data categories affected
    - Commits rewritten (SHAs)
    - Release assets re-uploaded (URLs)
    - CF deployment IDs deleted
    - SWH / Zenodo / GitHub Support ticket IDs
    - PubPub / HF / mirror repo actions
    - Confirmation date

20. **Living-URL `/privacy/erasure-in-progress` notice** during rewrite window.

21. **Confirm to subject** with steps completed + acknowledged limitations.

**Email retention (three synchronized schedules per §10.4):** effective retention N to N+3 months (quarterly granularity per R6 C6).

**Erasure-log accountability trade-off (R5 C2):** reference-ID maps to nothing after mailbox purge — accepted minimization.

**Moderation** (author's discretion, distinct from data-subject rights): third-party-harming content removed at Tim's discretion; history rewrite reserved for extreme cases.

**Workroom checkout hygiene:** after any workroom `filter-repo`, re-clone or `git gc --aggressive --prune=now` on local copies.

## 17. Permanence and Stewardship

**Durability layers (most to least durable):**
1. **Zenodo deposits** — CERN preservation; covers composite `.md` + `.rag.md` + PDF attached to Releases
2. **Software Heritage** — automatic git repo archival; **covers everything committed to `main` including PDFs at `studies/<slug>/versions/vN.N/<slug>-vN.N.pdf`** (per R4 B8 scope correction). Complementary to Zenodo for composite artifacts.
3. **archive.org Wayback** — permanent web-accessible snapshots
4. **GitHub public repos** — permanent as long as GitHub exists
5. **`lemma.gig8.com`** — depends on domain renewal
6. **`lemma.pubpub.org`** — depends on PubPub

**Influence layer (not preservation):** Common Crawl / FineWeb absorption — content in AI training corpora.

Convenience surface = `lemma.gig8.com`; permanent record = Zenodo + SWH + Wayback + GitHub.

## 18. Mission Framing and Editorial Voice

- **License intent** — CC BY 4.0 framed as gift, not gatekeeping
- **Editorial voice** — servant, not academic
- **Ecosystem posture** — "See also" points to work by others
- **Epistemic humility** — claims registry with confidence markers
- **Rigor as service** — tldrSCAR steel-manning discipline
- **Sabbath posture** — automated pipelines, batch ratification, weekly-when-needed cadence
- **Attribution welcomed but not required**

## 19. Open Design Decisions

Round 6 folded. Remaining open:
- Preprint deposit target (Phase 7)
- Gmail dedicated destination for `lemma@` (Phase 2b)
- PubPub tier evolution
- Email retention N default (6 months proposed)
- **CLOSED by R6 B1:** `llms-full.txt` sizing — measured at Phase 2a preparation (before Phase 2b close); decision recorded in Phase 2a notes

## 20. Reference Documents

All Rounds 1-7 reviews + dispositions in `docs/superpowers/specs/External Reviews/`:
- Rounds 1-6 as previously enumerated
- Round 7: `v7-{grok,gemini,fable}-review.md`; dispositions: `v7-round7-dispositions.md`
- Companion strategy: `docs/ai-exposure-strategy.md`
- Book-publishing pipeline: `docs/superpowers/specs/2026-05-03-lemma-press-ai-publishing-pipeline-design.md`
- This design doc's canonical home post-migration: `lemma-content/docs/superpowers/specs/2026-08-11-lemma-content-architecture-design.md` (per R7 D1)

## 21. AI-Maintenance and Operational Discipline (v7 refined from v6)

**Premise:** AI does ~99% of maintenance. Every scheduled chore, recovery playbook, health check, release ritual is authored FOR AI to run reliably.

### 21.A Script contract standard (v7 refined)

Every script under `scripts/lemma-cli/` and `scripts/` conforms to:

- `--help` with usage examples
- `--check` — validate CURRENT state (read-only; no specific mutation contemplated); exit 0 clean / 1 dirty / 2 fatal
- `--dry-run` — preview a specific mutation without executing; requires all mutation args; shows diff
- `--verbose` / `--quiet`
- `--json` — structured output (default when stdout non-TTY)
- Exit codes documented
- **Idempotency requirement:** every mutating script is idempotent OR detects-and-refuses on partial prior state (AI retries as reflex; non-idempotent + retry = double mutation)
- Every mutation writes audit-trail entry — commit message OR chore-log entry
- Every long-running op reports progress to stderr (structured)
- Every failure emits actionable next-step recommendation

**Erasure/retention script additional flags:** `--subject`, `--request-id`, `--since`, `--confirm-token`, `--verify-credentials` (R6 B4 + B7 + Grok P3).

### 21.B `CLAUDE.md` at both repo roots (v7 refined)

**Structure:**
1. `design-version: v7` HEADER (R6 B3 — enables drift detection)
2. What this repo is
3. Where things live
4. **Playbook sections POINT into design + registry rather than restate** (R6 B3 anti-drift)
5. Standard rituals (references §6.1-6.3)
6. Recurring chores (references §21G + registry)
7. Failure recovery (references §21F registry)
8. Verification patterns (references §21C-E commands)
9. Skills references
10. Anti-patterns — including **"never silently edit CLAUDE.md or `failure-modes.yaml`"** (R6 C11 / Grok P6)

**Session-start ritual (R6 B8):** any lemma-related session begins with reading `data/last-health-check.json` timestamp; if > 14 days, AI runs `npm run health-check` immediately.

### 21.C `lemma health-check` command (v7 phase-aware per R6 A3)

`node scripts/lemma-cli/health-check.mjs --json`

Reads `data/phase-state.yaml` and per-check contract from `data/health-checks.yaml`. Each check declares:
```yaml
checks:
  <check-id>:
    severity: blocking | warn | pending
    eventually_consistent: bool
    recheck_window_hours: <N>       # if eventually_consistent
    phase_gated_by: <state-var>     # optional; e.g., release_publish_unlocked
    runtime_context: [ci, local]    # where valid; skip elsewhere
```

Runner classifies results as `pass | warn | pending | fail`; only `fail` triggers Issue creation.

**Check categories:**

*Reachability — all use `${phase_state.base_url}` (R7 C1) + per-study-lifecycle-gated (R7 A2):*
- `${base_url}` HTTPS 200 (phase-gated: warn during Phase 2b-3; blocking Phase 4+)
- Each study canonical URL 200 (`study_lifecycle_gated: true` — pending if `study.yaml.versions` empty)
- Concept + latest version DOI resolve on Zenodo (`study_lifecycle_gated: true` + blocking after first release)
- PDF URLs at `${base_url}/studies/<slug>/versions/vN.N/<slug>-vN.N.pdf` return 200 (`study_lifecycle_gated: true`)
- `llms.txt` + `llms-full.txt` (or chunk URLs per §7.7) 200 (blocking)
- 12-UA synthetic curl checks (blocking Phase 4+; warn during Phase 2b-3 since `.pages.dev` isn't subject to zone WAF per R7 C8)

*Eventually-consistent:*
- SWH archived at latest tag (pending; recheck +48h; escalate to fail after 72h)
- HF dataset current for latest release (pending; recheck +24h)
- Wayback snapshot (Phase 6+; pending recheck +48h)

*State integrity:*
- Manifest-study referential integrity
- No orphan drafts on Zenodo (per-concept)
- **`claims.jsonl` schema-valid; `xrefs.json` schema-valid; RAG breadcrumbs present in all `.rag.md`** (R6 B9)
- Working tree clean; no `.tmp` orphans
- No `[skip ci]` phrases in recent Job 2d commit messages
- **CLAUDE.md `design-version:` matches file version** (R6 B3 drift detection)

*Runtime-context local (skipped in CI):*
- Scarlight has reindexed latest release (warn if > 30d stale)

*Schedule health — chore-log-dependent checks marked `runtime_context: [local]` per R7 B2 (workroom not accessible from public CI):*
- Heartbeat `data/last-heartbeat.txt` < 30d old (`runtime_context: [ci, local]`)
- Last retention chore < N months + 1d (`runtime_context: [local]` — reads workroom chore-log)
- No open PubPub-drift hashes > 30d (`runtime_context: [local]`)
- No open erasure-log tickets > Art. 12 deadline (`runtime_context: [local]` — workroom)
- **All rotation-scheduled secrets authenticate successfully** (probe call — R6 C4; `phase_gated_by: <phase-that-introduces-secret>` per R7 C4 so Phase-6+ tokens aren't probed during earlier phases)

*Issue deduplication (R7 C5):* `verify-release-failure` Issues use create-or-update semantics keyed on check-id via `gh issue list --label verify-release-failure --search "in:title <check-id>"`. Prevents alarm-fatigue from repeated identical fails.

Emit JSON: `{name, status, message, next_step?, autonomy?}`. Exit code = worst status. Runs weekly via cron OR on-demand via `workflow_dispatch` OR at session start per §21B.

### 21.D `lemma verify-release <tag>` command (phase-aware + per-study-lifecycle)

Post-release verification for a specific version. Runs the §21C check set scoped to one release. Called by Job 6c AFTER Job 6b Giscus comment posts (R6 C8 ordering — verify runs after comment so it doesn't race itself). Phase-aware semantics per R6 A3:
- Pilot Phase 3 doesn't fail on SWH pending (48h recheck window) or Scarlight `runtime_context: [local]` skip in CI
- Per-study lifecycle-gated checks (R7 A2) return `pending` if `study.yaml.versions` is empty (staged but not yet released); only `blocking` after first release exists

Emits structured JSON; opens `verify-release-failure` Issue (create-or-update per check-id) only on `fail` status — never `warn` or `pending`. Job 1a exempts tag-under-validation's own study from the "refuse if open Issue exists" check (R7 A2 lifecycle fix — prevents pilot deadlock).

### 21.E `lemma dry-run-erasure --subject <id>`

Simulate GDPR erasure without executing. Outputs the runbook that would execute:
- Enumerate all affected artifacts across §16 step-2 inventory (public exports, workroom, Release assets, Zenodo, HF, PubPub, mirror repos, CF deployments, CF cache, Actions logs, upstream Discussions, hypothes.is)
- For each: identify subject-associated records; count + list (per enumerable-vs-blanket-purge distinction below)
- Simulate `git filter-repo --replace-text` dry-run showing which commits would be rewritten
- Generate the executable-later runbook as `erasure-runbook-<request-id>.md` in workroom
- Emit summary JSON: `{artifacts_affected, commits_to_rewrite, external_takedowns_required, estimated_completion_hours, credentials_ok}`

Human (Tim) reviews runbook, greenlights, then AI executes. **Never auto-executes** (§21E hard-gate; template for §21F autonomy field).

**`--verify-credentials` flag (R6 B7):** probes API tokens for write/delete scope across all external targets (Cloudflare, Zenodo, HF, GitHub) before generating runbook. Emits `credentials_ok: {cf, zenodo, hf, github}` in JSON. Prevents runbook generation for an executor that can't execute.

**Enumerable vs blanket-purge surfaces** (R6 S2.6): dry-run distinguishes *enumerable* (workroom, HF rows, Discussions — count + list) from *blanket-purge* (CF deployments by date range, cache purge-everything — no per-record enumeration).

**Never auto-executes** (§21E hard-gate; template for §21F autonomy field).

### 21.F Failure-mode registry (v7 corrected + expanded)

`data/failure-modes.yaml` — machine-readable + queryable. Each entry:

```yaml
- id: zoho-filter-deleted
  detection: "No new type:email-feedback issues in workroom > 7 days when Zoho INBOX matches to:lemma@gig8.com"
  recovery: "Re-run §10.4 filter setup (Zoho Settings → Filters → New)"
  # ↑ FIXED per R6 A5.1: was "§5.4" which is retired-repo, not Zoho filters
  autonomy: propose
  auto_detectable: true
  health_check_hook: checks.mailflow
  introduced_in: v6
  last_verified: 2026-08-11
  owner: tim
```

**Registry entries (v7.1 with R7 A5+C3+C6 additions):**
Each entry has schema: `id, detection, recovery, autonomy, auto_detectable, health_check_hook, introduced_in, last_verified, owner, max_auto_attempts, auto_cooldown_hours`.

- `zoho-filter-deleted` (autonomy: propose; recovery references §10.4 pipeline setup — R7 D8: setup steps need adding to §10.4 during implementation)
- `cf-skip-reintroduced` (autonomy: propose)
- `zenodo-api-expired` (autonomy: propose)
- `hf-token-revoked` (autonomy: propose)
- `swh-takedown-pending` (autonomy: auto, `max_auto_attempts: 3` per R7 C6)
- `gh-cron-auto-disabled` (autonomy: propose)
- `astro-build-broken` (autonomy: propose)
- `retention-out-of-sync` (autonomy: propose)
- `pubpub-drift` (autonomy: propose)
- `scarlight-polling-stopped` (autonomy: auto, `max_auto_attempts: 3`)
- `phase4-exit-partial` (autonomy: human-gate)
- `zenodo-draft-collision` (autonomy: human-gate)
- `apps-script-trigger-disabled` (autonomy: propose)
- **`design-doc-claude-md-header-auto-sync`** (autonomy: auto — update CLAUDE.md `design-version:` header when design file version is newer AND playbook sections unchanged; `max_auto_attempts: 1`) — R7 C3 split
- **`design-doc-claude-md-content-drift`** (autonomy: propose — playbook sections diverge from design; requires human review) — R7 C3 split
- `zenodo-draft-orphaned` (autonomy: propose)
- `verify-release-noise` meta-mode (autonomy: propose)

**Circuit-breaker (R7 C6):** any `auto` mode that fails `max_auto_attempts` times within `auto_cooldown_hours` window is dynamically downgraded to `propose` + opens Issue for human review. Prevents unmonitored retry loops.

**Staleness discipline (R6 A5 + Grok P4):** modes with `last_verified` > 18 months + zero triggers = candidates for archival to `retired/` section. Annual game-day chore exercises each recovery playbook.

### 21.G Chore-log discipline (v7 workroom-hosted per R6 B2)

`lemma-workroom/chore-log.jsonl` — ALL operational chore entries live here (R6 B2 prevents public corpus contamination per R6 S4).

Example:
```jsonl
{"chore":"quarterly-retention-workroom","run_at":"2026-11-11T08:00:00Z","status":"clean","next_due":"2027-02-11","details":"purged 47 raw-email records","commit_sha":"abc123","autonomy":"auto"}
{"chore":"quarterly-benchmark","run_at":"2026-11-15T14:00:00Z","status":"clean","next_due":"2027-02-15","details":"30 probes; 22 passed; 3 failed; 5 misrepresented","report":"absorption-benchmarks/2026-11-15.md","autonomy":"propose"}
```

**Contract: `details` field carries counts + IDs only, NEVER subject identifiers** (R6 C7 explicit).

**Drift detection (R7 B5 — corrected AGAIN; v6 and v7 examples both had bugs; this one verified against fixture data):**
```bash
# Reduce append-only log to latest entry per chore first, then filter overdue
jq -s 'group_by(.chore) | map(max_by(.run_at)) | .[] |
       select((.next_due | strptime("%Y-%m-%d") | mktime) < now)' \
   lemma-workroom/chore-log.jsonl
```
The `-s` slurp + `group_by(.chore) | map(max_by(.run_at))` step is essential — without it, the first run of any chore whose `next_due` is now in the past matches forever (v7 had this bug).

**CLAUDE.md session-start note:** if annual rotation is in effect, concatenate yearly files before querying: `cat chore-log-*.jsonl | jq -s ...` (per R7 D15 / Grok P6).

**Rotation policy (R6 C13 / Grok P5):** annual file split — `chore-log-2026.jsonl`, `chore-log-2027.jsonl`, etc. Concatenate for cross-year queries.

Public `lemma-content/data/last-health-check.json` carries aggregate pass/warn/fail counts only; per-check details in workroom.

### 21.H `lemma-ops` MCP server (Phase 7+, stdio-local default per R6 A4)

Thin MCP wrapper. **Locked constraints (v7):**
1. **Stdio-local default** — no network exposure without explicit implementation session revisiting auth
2. **Authenticated access required** before any network deployment
3. **Erasure-related tools (`list_open_erasures`, `dry_run_erasure`) NEVER network-exposed** regardless of deployment mode

Tool list:
- `run_chore(name)` — **stdio-only for mutating chores (retention purges, etc.); network mode exposes only non-mutating chores** per R7 C9
- `health_check()` — network OK (read-only aggregate)
- `verify_release(tag)` — network OK (read-only)
- `dry_run_erasure(subject)` — **stdio only** (subject enumeration oracle)
- `list_open_erasures()` — **stdio only** (subject identifiers = most sensitive data)
- `retention_status()` — network OK (aggregate counts only)
- `list_failure_modes()` — network OK (public registry)
- `chore_log(since, limit)` — network OK for aggregate view; per-entry details stdio-only

### 21.I Anti-drift principles (v7 refined)

- Never mutate chapters without commit rationale
- Every scheduled chore completes or explicitly `--defer` with justification
- **Health-check `fail` blocks release via Job 1a mechanism** (R6 C12 — CI check for open `verify-release-failure` label), not just AI-discipline
- Retention schedules locked at design level
- Erasure requests trump everything
- **Never silently edit CLAUDE.md or `failure-modes.yaml`** — every change goes through commit with rationale (R6 C11 / Grok P6)

### 21.J Grok's Phase 3 validation gates → perpetual `verify-release`

`verify-release` command IS the checklist Grok recommended for Phase 3. Phase 3 exit = `verify-release` returns all-clean (phase-aware; pending/warn are OK; only `fail` blocks). Same command becomes perpetual regression suite going forward.

### 21.K Self-test canary (v7 addition per Grok "self-test")

`lemma self-test` — regression suite for the maintenance tooling itself:
- `health-check` parses its own output cleanly
- `dry-run-erasure` produces valid runbook skeleton
- Script contract compliance across all `scripts/lemma-cli/` binaries (`--help`, `--check`, `--dry-run`, `--json` all present + emit expected shape)
- `failure-modes.yaml` schema-valid; every entry has required fields including `autonomy`
- CLAUDE.md `design-version:` header parses; matches file version
- No `[skip ci]` phrases in recent Job 2d commits (defense-in-depth beyond Action guard)

Run weekly via cron (part of health-check workflow) + on-demand.

---

**Next step:** Round 7 external review per Tim's election. Fable R6 explicitly recommended NO R7 gauntlet ("the next reviewer this design needs is the Phase 3 pilot itself") but Tim elected R7 anyway per consistent pattern.
