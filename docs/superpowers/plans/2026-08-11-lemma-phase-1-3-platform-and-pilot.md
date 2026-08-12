# Lemma Phase 1-3 Implementation Plan: Platform Setup + WITP Pilot

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the lemma platform from Vault-canonical + gig8/lemma monorepo to a git-canonical two-repo model (public `lemma-studies/lemma-content` + private `lemma-studies/lemma-workroom`), stand up the AI-first publishing pipeline, and publish the first study ("What Is the Perfect" v5.4) end-to-end as pilot validation. Later phases (bulk migration, PubPub cross-post, Wikidata) get their own plans after pilot succeeds.

**Architecture:** Git-native canonical content with Astro Starlight static site rendering to CF Pages. Job-staged tag-triggered pipeline (compile → verify → release → Zenodo publish → Software Heritage → HuggingFace) with phase-aware verification via `data/phase-state.yaml`. Public/private split: `lemma-content` for canonical text + release artifacts; `lemma-workroom` for work product, restricted primary sources, chore logs, benchmark canaries. AI-maintenance surface: `scripts/lemma-cli/{health-check,verify-release,dry-run-erasure,self-test}` with structured JSON output.

**Tech Stack:** Node.js 20+ / Astro 5 / Astro Starlight / GitHub Actions / Cloudflare Pages / Zenodo REST API / HuggingFace Datasets / Software Heritage save-code-now / hypothes.is + Giscus / Git LFS (workroom) / Scarlight MCP (existing) / Zoho + Gmail (existing).

## Global Constraints

Every task's requirements implicitly include these constraints from design v7.1:

- **Slugs frozen at study birth** — never rename after publish
- **Chapter files are canonical** — never edit compiled `.md`; edit chapter files then recompile
- **`data/phase-state.yaml` is single source of truth** — no dual with GitHub repo variables; CI parses via `yq`
- **No `on: push` workflow** in `lemma-studies/lemma-content` — invariant enforced; Job 1e's App-token push would otherwise loop
- **Job 2d never carries `[skip ci]`** — CF Pages honors it; would suppress PDF deploy. Action guard rejects push if commit message contains any CF-skip phrase
- **All maintenance scripts under `scripts/lemma-cli/`** conform to §21A contract: `--check` (validate state), `--dry-run` (preview mutation), `--verbose`, `--json` (default when non-TTY), documented exit codes, mutating scripts idempotent, audit trail per mutation, actionable next-step per failure
- **Chore-log lives in workroom only** (private) — prevents operational metadata leaking into public corpus absorption
- **Per-study lifecycle gating** for verify-release checks — DOI/PDF checks are `pending` when `study.yaml.versions` empty; only `blocking` after first release
- **Tag creation is HUMAN GATE** — Tim executes `git tag && git push origin <tag>`; AI never auto-tags because Zenodo publish is irreversible
- **License:** CC BY 4.0 for all text; `LICENSE-INTENT.md` frames as gift
- **Editorial voice:** servant, not academic — every public-facing string
- **CF AI-bot access:** verified permissive (Tim selected Allow at zone setup); post-launch synthetic-fetch verifies 12 UAs
- **hypothes.is annotations disabled on preview URLs pre-launch** — annotations bind to URLs; enabling on `*.pages.dev` would bind to wrong document identity
- **Never make `gig8/lemma` (renamed to `lemma-legacy`) public** — history contains workroom material
- **Node 20+ required** (Astro 5 requirement)
- **YAML safety:** all scripts loading YAML files (phase-state.yaml, health-checks.yaml, failure-modes.yaml, study.yaml) MUST use safe loading. In `js-yaml` v4+, `yaml.load()` uses `DEFAULT_SCHEMA` which is safe by default (unlike Python's `yaml.load`). Do NOT pass a custom `schema` option that includes unsafe types. If parsing untrusted YAML (e.g., anything from user submission), explicitly use `yaml.load(str, { schema: yaml.CORE_SCHEMA })` and validate against a Zod/JSON Schema (see `verify-study-yaml.mjs` per §21A + R4 C7).

**Reference:** Full design at `docs/superpowers/specs/2026-08-11-lemma-content-architecture-design.md`. Read this before starting.

---

## File Structure Overview

**Repos created:**
- `lemma-studies/lemma-content` (public) — canonical content, site, tooling, exports (see design §5.1)
- `lemma-studies/lemma-workroom` (private, LFS) — work product, restricted primary sources, chore logs (see design §5.2)
- `gig8/lemma-legacy` (renamed private from `gig8/lemma`) — kept forever for history preservation
- `gig8/lemma` (recreated public empty stub, archived immediately) — redirect only

**Key files in `lemma-content` after Phase 2b:**
- `CLAUDE.md` — AI-maintenance playbook (design-version: v7.1)
- `LICENSE`, `LICENSE-INTENT.md`, `PRIVACY.md`, `CITATION.cff`
- `astro.config.mjs` — `site: 'https://lemma.gig8.com'`
- `package.json` — includes `copy-pdfs` pre-build script
- `data/phase-state.yaml`, `data/failure-modes.yaml`, `data/last-heartbeat.txt`, `data/last-health-check.json`
- `scripts/lemma-cli/{health-check,verify-release,dry-run-erasure,self-test}.mjs`
- `scripts/{compile-study,zenodo-reserve-doi,zenodo-publish,zenodo-update-metadata,push-software-heritage,update-huggingface-ds,phase4-exit,export-{annotations,comments,feedback}}.mjs`
- `scripts/verify/{index,verify-manifest,verify-anchors,verify-study-yaml,verify-machine-readable}.mjs`
- `.github/ISSUE_TEMPLATE/feedback.yml`
- `.github/workflows/{on-tag-release,nightly-annotations-export,nightly-comments-export,nightly-feedback-triage,keep-alive}.yml`
- `site/src/layouts/*.astro` (Highwire + JSON-LD + Dublin Core emission)
- `site/src/pages/{privacy,[slug]/index,[slug]/[chapter],[slug]/versions/[version]/[chapter]}.astro`
- `site/public/{robots.txt,_redirects,studies/}` (studies populated by `copy-pdfs`)
- `llms.txt`, `llms-full.txt`, `claims-index.jsonl` (regenerated per compile)
- `primary-sources/manifest.json` + `primary-sources/README.md` (ID convention)

**Key files in `lemma-workroom`:**
- `CLAUDE.md` — workroom-side maintenance playbook
- `.gitattributes` — `*.pdf filter=lfs`
- `rotation-log.md`, `erasure-log.md`, `retention-schedule.md`, `chore-log.jsonl`
- `feedback-inbox/` (raw emails; headers stripped; N-month retention)
- `absorption-benchmarks/` (probes + canaries + expected answers; PRIVATE)

**Key files in pilot study `lemma-content/studies/what-is-the-perfect/`:**
- Chapter files (00-Overview.md through 05-Chapter-Synthesis.md + Appendix-A + Appendix-B)
- `study.yaml`, `primary-sources.json`, `claims.jsonl`, `xrefs.json`, `briefing.md`
- `build.sh`, `table-layout.tex`
- `versions/v5.4/` (compiled markdown per chapter + PDF; committed after Task 3.7)

---

# PHASE 1 — Repo Scaffolding + Safe Legacy Migration

Design reference: §5.4 (9-step procedure), §11 Phase 1.

### Task 1.1: Freeze pushes to gig8/lemma (physical lock)

**Files:**
- GitHub Settings on `gig8/lemma` — Rulesets → "Lock branch" on `main` (no code file)

**Interfaces:**
- Consumes: nothing
- Produces: `main` branch on `gig8/lemma` physically rejects pushes (belt-and-suspenders freeze)

- [ ] **Step 1: Verify no in-flight PRs or pending pushes**

```bash
gh pr list --repo gig8/lemma
git status  # in ~/Projects/gig8/lemma
```
Expected: no open PRs; working tree clean (or note what's dirty).

- [ ] **Step 2: Create Ruleset on gig8/lemma to Lock branch**

In GitHub UI: `gig8/lemma` → Settings → Rules → Rulesets → New branch ruleset:
- Name: `phase-1-migration-freeze`
- Enforcement status: Active
- Target branches: `main` (add pattern `main`)
- Rules: check "Restrict deletions" AND "Lock branch"
- Save

- [ ] **Step 3: Verify freeze by attempting a push**

```bash
cd ~/Projects/gig8/lemma
git commit --allow-empty -m "test: freeze verify"
git push origin main  # should FAIL with "protected branch" error
git reset --hard HEAD~1  # undo test commit
```
Expected: push rejected. Reset undoes the empty commit.

- [ ] **Step 4: Record freeze start in workroom (nowhere yet — use scratch note)**

Note in `/tmp/lemma-migration-log.md`:
```
Phase 1 freeze active: <timestamp>
Ruleset name: phase-1-migration-freeze
```

### Task 1.2: Rename gig8/lemma → gig8/lemma-legacy

**Files:**
- GitHub repo rename via UI or `gh api`

**Interfaces:**
- Consumes: freeze from 1.1
- Produces: `gig8/lemma-legacy` exists; `gig8/lemma` name is now unclaimed (GitHub rename redirect active but ephemeral)

- [ ] **Step 1: Rename via gh CLI**

```bash
gh api --method PATCH /repos/gig8/lemma -f name=lemma-legacy
```
Expected: JSON response with new name. Ruleset persists on renamed repo.

- [ ] **Step 2: Verify rename**

```bash
gh repo view gig8/lemma-legacy  # should exist
gh repo view gig8/lemma 2>&1 | head -5  # redirect or 404 — GitHub redirect is time-limited
```

### Task 1.3: Repoint every local reference to gig8/lemma-legacy

**Files:**
- Local checkouts: `~/Projects/gig8/lemma/.git/config`
- Any CI or Scarlight config referencing old URL

**Interfaces:**
- Consumes: rename from 1.2
- Produces: all local + config remotes point to `lemma-legacy`

- [ ] **Step 1: Update local checkout remote**

```bash
cd ~/Projects/gig8/lemma
git remote set-url origin git@github.com:gig8/lemma-legacy.git
git remote -v
```
Expected: origin shows `lemma-legacy`.

- [ ] **Step 2: Check for other checkouts + agent worktrees**

```bash
find ~/Projects ~/.claude -name .git -type d 2>/dev/null | \
  xargs -I{} grep -l "gig8/lemma" "{}/config" 2>/dev/null
```
For each hit, repeat step 1 with `cd <dir>`.

- [ ] **Step 3: Check Scarlight ingest paths**

```bash
grep -r "gig8/lemma\|/mnt/c/Users/timuy/Dropbox/personal/Vault/.*lemma" ~/Projects/scarlight/config/ 2>/dev/null
```
Update any references. (Path updates happen more comprehensively at Phase 5; here just check for immediate breakage.)

- [ ] **Step 4: Check for CI + webhook references**

```bash
# GitHub Actions in other repos referencing gig8/lemma
gh search code "gig8/lemma" --owner gig8 --limit 20
```
Note any hits; update as needed.

### Task 1.4: Pause old CF Pages project deployments

**Files:**
- Cloudflare Dashboard (no code file)

**Interfaces:**
- Consumes: rename from 1.2 (CF Pages tracks repo by ID; the connection SURVIVES the rename, so we must explicitly pause — see design §5.4 step 4 rationale)
- Produces: old CF Pages project stops building on future pushes to `lemma-legacy` `main`

- [ ] **Step 1: Locate current CF Pages project attached to renamed repo**

Cloudflare Dashboard → Workers & Pages → find project(s) connected to `gig8/lemma-legacy` (previously `gig8/lemma`). Note project name(s).

- [ ] **Step 2: Pause automatic deployments**

For each project: Settings → Builds & deployments → Toggle "Automatic deployments" OFF.

- [ ] **Step 3: Verify by pushing test commit to lemma-legacy** (skip if lemma-legacy is locked; check UI shows paused status)

- [ ] **Step 4: Document old project name for Phase 4 exit domain cutover**

Note: `<old-project-name>` in `/tmp/lemma-migration-log.md`.

### Task 1.5: Verify no stale gig8/lemma references remain

**Files:**
- All local checkouts + config directories

**Interfaces:**
- Consumes: 1.3
- Produces: assertion that no push credentials point at old repo name

- [ ] **Step 1: Comprehensive grep for stale references**

```bash
# Constrained roots to avoid /mnt/c full-scan (hours on WSL DrvFs per R7 C3)
find ~/Projects ~/.config /mnt/c/Projects -name .git -type d 2>/dev/null | \
  xargs -I{} grep -l "gig8/lemma" "{}/config" 2>/dev/null
```
Expected output: zero lines (or only `gig8/lemma-legacy` matches).

- [ ] **Step 2: SSH-URL grep**

```bash
grep -rE "gig8/lemma($|[^-])" ~/Projects ~/.claude ~/.config 2>/dev/null
```
Expected: zero matches (single alternative; no false-positive `\b` per R7 C4).

- [ ] **Step 3: Non-git config sweep**

```bash
grep -rE "gig8/lemma($|[^-])" ~/.claude/skills/lemma-* 2>/dev/null
grep -rE "gig8/lemma($|[^-])" /home/tim/Projects/scarlight 2>/dev/null
```
Update any hits. Any remaining reference must be `lemma-legacy`, `lemma-content`, or `lemma-workroom`.

### Task 1.6: Inventory + revoke external push credentials referencing old repo

**Files:**
- GitHub Apps + Deploy Keys + secrets on `lemma-legacy` (UI)

**Interfaces:**
- Consumes: 1.5 (local repointing done)
- Produces: no external system holds a token that can push to a repo named `gig8/lemma`

- [ ] **Step 1: Review Deploy Keys on lemma-legacy**

`gh api /repos/gig8/lemma-legacy/keys | jq '.[] | {id, title, verified}'`

For each unused/stale key: revoke via `gh api --method DELETE /repos/gig8/lemma-legacy/keys/<id>`.

- [ ] **Step 2: Review GitHub Apps scoped to old repo**

GitHub Dashboard → Personal Settings → Applications → GitHub Apps → for each app installed on `gig8`, check installed-on scope. If scoped to old `gig8/lemma`, verify need; either repoint scope or uninstall.

- [ ] **Step 3: Review Actions secrets on lemma-legacy**

`gh secret list --repo gig8/lemma-legacy`
For each secret referencing "gig8/lemma" URL in usage: update or delete.

- [ ] **Step 4: Review third-party webhooks**

`gh api /repos/gig8/lemma-legacy/hooks | jq '.[] | {id, config}'`
Delete or update any pointing at `gig8/lemma` name.

- [ ] **Step 5: Confirm inventory complete**

Note in `/tmp/lemma-migration-log.md`:
```
External credentials inventory: <date>; ready for stub creation.
```

### Task 1.7: Create new empty public gig8/lemma stub + archive immediately

**Files:**
- New repo via `gh repo create` + immediate archive

**Interfaces:**
- Consumes: 1.5 + 1.6 (all local repointed + credentials revoked; no stale-remote push can succeed against the new stub)
- Produces: `gig8/lemma` exists as archived public repo with README pointer only

- [ ] **Step 1: Create stub with README**

```bash
mkdir /tmp/lemma-stub && cd /tmp/lemma-stub && git init
cat > README.md <<'EOF'
# lemma — redirected

This repo has been superseded. Canonical location:

**[lemma-studies/lemma-content](https://github.com/lemma-studies/lemma-content)** — public content + site
**[gig8/lemma-legacy](https://github.com/gig8/lemma-legacy)** — historical archive (private)
EOF
git add README.md && git commit -m "Initial stub — see lemma-content for canonical location"
gh repo create gig8/lemma --public --source=. --push --description="Redirected — see lemma-content"
```

- [ ] **Step 2: IMMEDIATELY archive the stub**

```bash
gh api --method PATCH /repos/gig8/lemma -f archived=true
```
Expected: repo now shows as archived (push-immune). Belt-and-suspenders per R3 A1.

- [ ] **Step 3: Verify archive**

```bash
gh repo view gig8/lemma --json isArchived
# expected: {"isArchived": true}
```

- [ ] **Step 4: Cleanup temp**

```bash
rm -rf /tmp/lemma-stub
```

### Task 1.8: Un-freeze lemma-legacy (Phase 4 emergency access)

**Files:**
- GitHub Ruleset on `lemma-legacy` (UI)

**Interfaces:**
- Consumes: 1.7 (stub archived means no leak vector)
- Produces: `lemma-legacy` unlocked for pre-Phase-4 emergency maintenance if needed (per Gemini R5 S5.1 clarification)

- [ ] **Step 1: Remove phase-1-migration-freeze ruleset**

`gh api /repos/gig8/lemma-legacy/rulesets` — find ruleset ID; delete via UI or API.

- [ ] **Step 2: Verify by pushing test commit**

```bash
cd ~/Projects/gig8/lemma  # now points at lemma-legacy
git commit --allow-empty -m "test: unfreeze verify"
git push origin main  # should succeed
git reset --hard HEAD~1 && git push origin main --force  # undo
```

Note: `lemma-legacy` will be re-archived in Phase 9 cleanup per R5 C6.

### Task 1.9: Create lemma-studies/lemma-content (public) with initial layout

**Files:**
- New public repo + directory scaffolding

**Interfaces:**
- Consumes: nothing (parallel to 1.10)
- Produces: `lemma-studies/lemma-content` exists with skeleton for Phase 2 to build on

- [ ] **Step 1: Create repo**

```bash
gh repo create lemma-studies/lemma-content --public \
  --description="Lemma theological studies — canonical content + site + tooling" \
  --license=cc-by-4.0
```

- [ ] **Step 2: Clone locally**

```bash
cd ~/Projects/gig8/
git clone git@github.com:lemma-studies/lemma-content.git
cd lemma-content
```

- [ ] **Step 3: Create directory skeleton**

```bash
mkdir -p studies articles primary-sources/{PD,CC} \
         site/{src/{layouts,pages,components},public} \
         scripts/{lemma-cli,verify,review} \
         annotations comments feedback-log absorption-benchmarks \
         data tests/fixtures/verify \
         .github/{ISSUE_TEMPLATE,workflows}
```

- [ ] **Step 4: Add root-level files**

```bash
cat > README.md <<'EOF'
# Lemma Theological Studies

A theological reference library: exegetical studies using the SCAR Quadrilateral framework. Offered freely to the family of Christ.

- **Live site:** https://lemma.gig8.com (attached at Phase 4 exit; preview at `lemma-content.pages.dev` before then)
- **License:** CC BY 4.0 (see LICENSE)
- **How to cite:** See individual study `study.yaml` for concept DOI
- **Contact:** privacy@gig8.com (data-subject requests)
EOF

cat > LICENSE-INTENT.md <<'EOF'
This work is offered as a gift to the family of Christ. Use it freely. Share it. Quote it. Argue with it. If you find it useful and it's practical to say so, an attribution helps others find the primary sources — but don't let the absence of an attribution stop you from using or sharing what you've received here. The technical license (CC BY 4.0) is here for legal clarity; the intent is a gift.
EOF

cat > PRIVACY.md <<'EOF'
# Privacy Notice

**Data controller:** Tim Uy. Contact: privacy@gig8.com.

Reader-generated content (public annotations via hypothes.is, discussion via Giscus, feedback via issue template or email) is subject to GDPR Article 17 (right to erasure). See design §16 for the complete erasure runbook. Aggregate feedback dispositions are published to `feedback-log/`; personal correspondence is workroom-private unless explicit opt-in credit is given.

Automated retention: 6 months post-disposition (default; see `lemma-workroom/retention-schedule.md`).

Immutable archives (Zenodo, Software Heritage, Wayback) may retain snapshots after erasure; erasure runbook enumerates the propagation procedure but cannot compel third-party archive removal (only request).
EOF

cat > .gitignore <<'EOF'
node_modules/
dist/
.astro/
.tmp.*.md
.tmp.*
*.log
site/public/studies/
EOF
```

- [ ] **Step 5: Copy CC BY 4.0 LICENSE**

```bash
# Copy from a canonical source
curl -sL https://creativecommons.org/licenses/by/4.0/legalcode.txt > LICENSE
```

- [ ] **Step 6: Initial commit + push**

```bash
git add .
git commit -m "chore(scaffold): initial layout for phase 1-3 platform setup"
git push origin main
```

### Task 1.10: Create lemma-studies/lemma-workroom (private, LFS enabled)

**Files:**
- New private repo with LFS from creation

**Interfaces:**
- Consumes: nothing (parallel to 1.9)
- Produces: `lemma-studies/lemma-workroom` exists as private, LFS-enabled, with skeleton for Phase 2 intake

- [ ] **Step 1: Create private repo**

```bash
gh repo create lemma-studies/lemma-workroom --private \
  --description="Lemma work product — dispositions, review packages, restricted primary sources, chore logs"
```

- [ ] **Step 2: Clone + enable LFS**

```bash
cd ~/Projects/gig8/
git clone git@github.com:lemma-studies/lemma-workroom.git
cd lemma-workroom
git lfs install
cat > .gitattributes <<'EOF'
*.pdf filter=lfs diff=lfs merge=lfs -text
EOF
```

- [ ] **Step 3: Create directory skeleton**

```bash
mkdir -p studies primary-sources/{OA-hosted-unclear,restricted} \
         annotations feedback-inbox absorption-benchmarks scripts ponderings
```

- [ ] **Step 4: Add root-level files**

```bash
cat > README.md <<'EOF'
# Lemma Workroom (private)

Author-side work product for lemma theological studies. Contains dispositions, review packages, restricted-redistribution primary source caches, chore logs, benchmark canaries.

**Never made public.** Companion to public [lemma-studies/lemma-content](https://github.com/lemma-studies/lemma-content).
EOF

cat > .gitignore <<'EOF'
.tmp.*.md
.tmp.*
*.log
__pycache__/
node_modules/
EOF

cat > rotation-log.md <<'EOF'
# Secret Rotation Log

Format: `YYYY-MM-DD | secret-name | reason | affected-surfaces`

## History

(none yet)
EOF

cat > erasure-log.md <<'EOF'
# GDPR Erasure Request Log

REQUEST RECORDS ONLY. No backup of erased content (per §16 discipline — retaining erased content is itself an Art. 17 failure).

Schema per entry:
- Request ID: (minimized reference — no PII)
- Date received / Art. 12 deadline / Date completed
- Data categories affected
- Commits rewritten (SHAs)
- Release assets re-uploaded
- CF deployment IDs deleted
- SWH/Zenodo/GitHub Support ticket IDs
- PubPub/HF/mirror actions
- Confirmation date

## History

(none yet)
EOF

cat > retention-schedule.md <<'EOF'
# Retention Schedule

**Raw email in `feedback-inbox/*.jsonl`:** purged N=6 months post-disposition via quarterly `git filter-repo` chore on workroom.

**Zoho `Lemma-Feedback` folder:** auto-delete rule on same 6-month schedule.

**Gmail forwarded copies:** quarterly Apps Script permanent-delete on same schedule.

**Effective retention: 6-9 months** (quarterly chore granularity).

**Substance survives** in disposition records (public `feedback-log/`). Reference IDs in `erasure-log.md` map to nothing after mailbox purge — intentional minimization (Art. 5(1)(e)) at cost of Art. 5(2) accountability. Accepted trade-off for solo controller at this scale.
EOF

cat > chore-log.jsonl <<'EOF'
{"chore":"initial","run_at":"2026-08-11T00:00:00Z","status":"clean","next_due":"2026-11-11","details":"workroom scaffolded","autonomy":"human-gate"}
EOF
```

- [ ] **Step 5: Initial commit + push**

```bash
git add .
git commit -m "chore(scaffold): initial layout"
git push origin main
```

### Task 1.11: Create GitHub App scoped to gig8/lemma-*

**Files:**
- GitHub App registration (UI + local key file)

**Interfaces:**
- Consumes: 1.9 + 1.10 (both repos exist)
- Produces: GitHub App installed with contents:write on `lemma-*` pattern; private key stored in `/mnt/a/gig8/`; ready for Actions secret + branch-protection bypass toggle

- [ ] **Step 1: Register GitHub App via UI**

GitHub Settings → Developer settings → GitHub Apps → New GitHub App:
- Name: `lemma-release-bot`
- Homepage URL: `https://lemma.gig8.com` (aspirational; can be `https://github.com/gig8`)
- Webhook: Active OFF (no webhook needed)
- Repository permissions: Contents = Read & write; Metadata = Read
- Organization permissions: (none needed at App level; scope at install time)
- Where can this app be installed: Only on this account

Save. Note App ID.

- [ ] **Step 2: Generate + download private key**

App settings → Private keys → Generate a private key → download `.pem` file.
```bash
mv ~/Downloads/lemma-release-bot.*.pem /mnt/a/gig8/lemma-release-bot-app-key.pem
chmod 600 /mnt/a/gig8/lemma-release-bot-app-key.pem
```

- [ ] **Step 3: Install App on gig8 organization scoped to lemma-***

App page → Install App → gig8 org → Only select repositories → tick `lemma-content`, `lemma-workroom` (and later, `lemma-<slug>` mirrors when created in Phase 6+). Save.

Note Installation ID.

- [ ] **Step 4: Record in credentials**

```bash
cat >> /mnt/a/gig8/credentials.json.notes <<EOF
GitHub App: lemma-release-bot
  App ID: <fill>
  Installation ID: <fill>
  Private key: /mnt/a/gig8/lemma-release-bot-app-key.pem
  Scope: gig8/lemma-* (contents:write)
  Purpose: CI push to main from Job 2d + release actions
EOF
```

- [ ] **Step 5: Add App to branch-protection bypass** (deferred until Task 2b.6 when branch protection is set)

Note in `/tmp/lemma-migration-log.md` to configure at that time.

---

# PHASE 2a — Minimum Site (no content migrated yet)

Design reference: §11 Phase 2a.

### Task 2a.1: Copy Astro Starlight chrome from current gig8/lemma-legacy to lemma-content/site/

**Files:**
- Source: `~/Projects/gig8/lemma/` (now points at `lemma-legacy`)
- Target: `~/Projects/lemma-studies/lemma-content/site/`

**Interfaces:**
- Consumes: 1.9 (`lemma-content` skeleton exists)
- Produces: Astro Starlight site chrome under `lemma-content/site/`; will not build until content migration in Phase 3, but should install and validate

- [ ] **Step 1: Copy Astro core files**

```bash
cd ~/Projects/lemma-studies/lemma-content
cp ~/Projects/gig8/lemma/astro.config.mjs site/
cp ~/Projects/gig8/lemma/tsconfig.json site/
cp ~/Projects/gig8/lemma/package.json site/
cp ~/Projects/gig8/lemma/package-lock.json site/
cp -r ~/Projects/gig8/lemma/src site/
cp -r ~/Projects/gig8/lemma/public site/
```

- [ ] **Step 2: Update astro.config.mjs to set canonical site**

Edit `site/astro.config.mjs` — add `site: 'https://lemma.gig8.com'` at top of the `defineConfig({...})` block. Also update the vite `allowedHosts` if referenced.

- [ ] **Step 3: Move tooling scripts to lemma-content/scripts/**

```bash
cp -r ~/Projects/gig8/lemma/scripts/compile-study.js scripts/
cp -r ~/Projects/gig8/lemma/scripts/verify scripts/
cp -r ~/Projects/gig8/lemma/scripts/review scripts/
cp -r ~/Projects/gig8/lemma/scripts/version.mjs scripts/
cp -r ~/Projects/gig8/lemma/scripts/style-codegen.js scripts/
cp -r ~/Projects/gig8/lemma/scripts/build-book.js scripts/
cp -r ~/Projects/gig8/lemma/scripts/publish.js scripts/
cp -r ~/Projects/gig8/lemma/scripts/validate.js scripts/
cp -r ~/Projects/gig8/lemma/scripts/sync-content.js scripts/  # will be replaced by fetch-lemma-content — kept for reference
```

- [ ] **Step 4: Move package.json top-level to lemma-content root**

```bash
# The site/package.json has Astro deps; lemma-content root needs its own for lemma-cli + scripts
cp site/package.json ./package.json.tmp
# Manually merge — root package.json includes scripts for site + top-level lemma-cli
```

Create root `package.json`:

```json
{
  "name": "lemma-content",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "copy-pdfs": "for d in studies/*/; do slug=$(basename \"$d\"); mkdir -p \"site/public/studies/$slug\" && [ -d \"${d}versions\" ] && cp -r \"${d}versions\" \"site/public/studies/$slug/\"; done",
    "compile:study": "node scripts/compile-study.js",
    "verify:study": "node scripts/verify/index.js",
    "health-check": "node scripts/lemma-cli/health-check.mjs",
    "verify-release": "node scripts/lemma-cli/verify-release.mjs",
    "dry-run-erasure": "node scripts/lemma-cli/dry-run-erasure.mjs",
    "self-test": "node scripts/lemma-cli/self-test.mjs",
    "site:build": "npm run copy-pdfs && cd site && npm run build",
    "site:dev": "cd site && npm run dev"
  },
  "dependencies": {},
  "devDependencies": {
    "yq-node": "^1.0.0"
  }
}
```

Copy `.gitignore` addition:
```
site/dist/
site/node_modules/
site/.astro/
```

- [ ] **Step 5: Install Astro deps**

```bash
cd site && npm install && cd ..
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(site): copy Astro Starlight chrome from legacy; set canonical site URL"
```

### Task 2a.2: Implement `copy-pdfs` per-study loop script

**Files:**
- Modify: `package.json` (already has script from 2a.1 step 4; verify it's correct)

**Interfaces:**
- Consumes: 2a.1
- Produces: `npm run copy-pdfs` creates `site/public/studies/<slug>/versions/vN.N/*.pdf` from `studies/<slug>/versions/vN.N/*.pdf` per study; NO merging (per R6 A2 bug fix)

- [ ] **Step 1: Verify script uses correct per-study loop**

Read `package.json`. The `copy-pdfs` script should be:
```
for d in studies/*/; do slug=$(basename "$d"); mkdir -p "site/public/studies/$slug" && [ -d "${d}versions" ] && cp -r "${d}versions" "site/public/studies/$slug/"; done
```

Confirm: uses `basename`, per-study `mkdir -p`, `[ -d "${d}versions" ]` check (not blanket `|| true`).

- [ ] **Step 2: Test with synthetic-second-study fixture (dry-run in /tmp)**

```bash
mkdir -p /tmp/lemma-copy-test/studies/{study-a,study-b}/versions/v1.0
echo "fake" > /tmp/lemma-copy-test/studies/study-a/versions/v1.0/study-a-v1.0.pdf
echo "fake" > /tmp/lemma-copy-test/studies/study-b/versions/v1.0/study-b-v1.0.pdf
cd /tmp/lemma-copy-test
bash -c 'for d in studies/*/; do slug=$(basename "$d"); mkdir -p "site/public/studies/$slug" && [ -d "${d}versions" ] && cp -r "${d}versions" "site/public/studies/$slug/"; done'
find site -type f
```

Expected output:
```
site/public/studies/study-a/versions/v1.0/study-a-v1.0.pdf
site/public/studies/study-b/versions/v1.0/study-b-v1.0.pdf
```
NOT merged into `site/public/studies/versions/…`. If merged, the loop is buggy.

- [ ] **Step 3: Cleanup test**

```bash
rm -rf /tmp/lemma-copy-test
```

### Task 2a.3: Deploy new CF Pages project attached to lemma-content

**Files:**
- Cloudflare Dashboard (no code file)

**Interfaces:**
- Consumes: 2a.1 (site skeleton committed)
- Produces: New CF Pages project deploys `lemma-studies/lemma-content` on push; preview URL at `lemma-content.pages.dev`; custom domain NOT attached (deferred to Phase 4 exit per R4 A2)

- [ ] **Step 1: Create CF Pages project**

Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git:
- Repository: `lemma-studies/lemma-content`
- Production branch: `main`
- Build command: `npm run site:build`
- Build output directory: `site/dist`
- Environment variables: none needed initially

Save. Wait for first build. Expected: build succeeds (empty site with Starlight chrome + no studies yet).

- [ ] **Step 2: Verify preview URL loads**

```bash
curl -sI https://lemma-content.pages.dev/ | head -3
```
Expected: HTTP 200. Landing page should show Starlight sidebar with no studies (all "Migration Queued").

### Task 2a.4: Handle un-migrated studies with "Migration Queued" badge + noindex

**Files:**
- Modify: `site/src/layouts/StudyLayout.astro` (or equivalent — check what exists)
- Modify: `astro.config.mjs` sidebar entries for un-migrated slugs

**Interfaces:**
- Consumes: 2a.3 (site deploys)
- Produces: crawlers won't index empty study stubs; readers see clear "not yet migrated" message

- [ ] **Step 1: Identify un-migrated study slugs**

From current `~/Projects/gig8/lemma/astro.config.mjs` sidebar (see original `astro.config.mjs`). List: `by-his-stripes`, `meeting-structure`, `name-above-every-name`, `daniel-9-24`, `pre-nicene-christianity`, `apostolic-quadrilateral`, `lords-supper-research`, `angel-of-the-lord`, `satans-throne`, `sermon-on-the-mount`, `trumpet-call`, `what-is-the-perfect`, `wine-and-jesus`, `parents-and-adult-children`, `1-corinthians-11-17-34`.

- [ ] **Step 2: For each un-migrated slug, create stub `studies/<slug>/index.md`**

Template:
```markdown
---
title: "<Study Title>"
description: "This study is queued for migration."
head:
  - tag: meta
    attrs: { name: robots, content: "noindex, follow" }
---

**Migration queued.** This study is preserved at the legacy site until the migration to canonical URLs completes (see design §11 Phase 4).

Bookmark this URL — it will populate when migration reaches this study.
```

Create for all un-migrated slugs.

- [ ] **Step 3: Configure sitemap to exclude un-migrated stubs**

Edit `site/astro.config.mjs` — Starlight has `sitemap` config. Ensure only migrated study pages appear in sitemap. Alternative: use `astro-sitemap` filter `serialize` to exclude any page whose frontmatter contains `noindex`.

- [ ] **Step 4: Commit + verify deploy**

```bash
git add site/src/content/docs/*/index.md site/astro.config.mjs
git commit -m "feat(site): stub un-migrated studies with noindex + Migration Queued badge"
git push
```

Wait for CF Pages rebuild. Verify:
```bash
curl -sI https://lemma-content.pages.dev/what-is-the-perfect/ | grep -i robots
```
Expected: `X-Robots-Tag` header OR verify HTML `<meta name="robots" content="noindex, follow">`.

- [ ] **Step 5: Verify sitemap.xml excludes stubs**

```bash
curl -s https://lemma-content.pages.dev/sitemap-index.xml
```
Expected: no `what-is-the-perfect` URL yet (will appear after Phase 3 migration).

### Task 2a.5: Measure `llms-full.txt` size + decide split scheme

**Files:**
- `docs/superpowers/plans/2026-08-11-llms-full-sizing-decision.md` (new decision record)

**Interfaces:**
- Consumes: existing Vault chapter files
- Produces: recorded decision on single-file vs Option 3 chunked scheme; feeds Task 2b design

- [ ] **Step 1: Measure existing corpus size**

```bash
cd /mnt/c/Users/timuy/Dropbox/personal/Vault/Projects/lemma
find . -name "*.md" -path "*/[0-9]*.md" -o -name "Appendix*.md" -not -path "*/historical/*" -not -path "*/External Reviews/*" -not -path "*/Working-Notes/*" -not -path "*/Primary-Sources/*" 2>/dev/null | \
  xargs wc -c | tail -1 | awk '{print "chars:", $1, "  est tokens:", $1/4}'
```

Note the number.

Also measure just What Is the Perfect specifically:
```bash
wc -c "/mnt/c/Users/timuy/Dropbox/personal/Vault/Projects/lemma/What Is the Perfect/"{[0-9]*,Appendix*}.md | awk 'END{print "WITP chars:", $1, "  est tokens:", $1/4}'
```

- [ ] **Step 2: Write decision record**

Create `docs/superpowers/plans/2026-08-11-llms-full-sizing-decision.md`:
```markdown
# llms-full.txt Sizing Decision

**Date:** 2026-08-11
**Measurement:**
- Existing Vault corpus (15 studies, all chapters + appendices): <chars>, ~<tokens> tokens
- WITP alone: <chars>, ~<tokens> tokens

**Threshold:** >200K tokens → chunked (Option 3); ≤200K → single file.

**Decision:** [single file | chunked]

**Rationale:** [note reasoning based on measurement]

**Implementation:**
- If single file: `llms-full.txt` contains all latest-version chapter markdown concatenated with `--- STUDY: <slug> ---` `--- CHAPTER: <NN-title> ---` markers
- If chunked: `llms-full.txt` becomes an index listing per-chapter chunk URLs at `lemma.gig8.com/llms/full/<slug>/<chapter>.txt`; `site/public/llms/full/<slug>/<chapter>.txt` populated by compile step
```

- [ ] **Step 3: Commit decision**

```bash
cd ~/Projects/lemma-studies/lemma-content
git add docs/superpowers/plans/2026-08-11-llms-full-sizing-decision.md
git commit -m "chore(docs): record llms-full.txt sizing decision"
```

---

# PHASE 2b — AI-Surface + Intake Layer

Design reference: §11 Phase 2b, §21 AI-maintenance discipline.

### Task 2b.1: Add Highwire + JSON-LD + Dublin Core meta emission to Astro layouts

**Files:**
- Modify: `site/src/layouts/StudyLayout.astro` and `ChapterLayout.astro` (or Starlight override components — locate the right file)

**Interfaces:**
- Consumes: 2a completion
- Produces: every study/chapter page emits `citation_title`, `citation_author`, `citation_doi`, `citation_publication_date`, `citation_pdf_url`, ScholarlyArticle/Chapter JSON-LD, Dublin Core `<meta>` tags in HTML `<head>`

- [ ] **Step 1: Locate Starlight layout override point**

Read `site/astro.config.mjs` to find Starlight `components:` override entries. Typical: create `site/src/components/Head.astro` and register in Starlight config.

- [ ] **Step 2: Implement Head component with all three metadata layers**

Create `site/src/components/Head.astro`:

```astro
---
import type { Props } from '@astrojs/starlight/props';
const { entry, hasSidebar } = Astro.props;
const studySlug = entry.slug.split('/')[0];
const isStudyRoot = entry.slug === studySlug;
const isChapter = entry.slug.includes('/') && !entry.slug.includes('/versions/');

// Load study.yaml for this slug (if migrated)
import fs from 'node:fs';
import yaml from 'js-yaml';
let study = null;
try {
  const raw = fs.readFileSync(`../studies/${studySlug}/study.yaml`, 'utf8');
  study = yaml.load(raw);
} catch { /* not migrated yet */ }
---

{study && (
  <>
    {/* Highwire */}
    <meta name="citation_title" content={study.title} />
    <meta name="citation_author" content={study.author} />
    <meta name="citation_publication_date" content={study.current_version_date} />
    <meta name="citation_doi" content={isStudyRoot ? study.concept_doi : study.versions[study.versions.length-1].version_doi} />
    {isStudyRoot && (
      <meta name="citation_pdf_url" content={`https://lemma.gig8.com/studies/${studySlug}/versions/${study.current_version}/${studySlug}-${study.current_version}.pdf`} />
    )}

    {/* JSON-LD */}
    <script type="application/ld+json" set:html={JSON.stringify({
      "@context": "https://schema.org",
      "@type": isStudyRoot ? "ScholarlyArticle" : "Chapter",
      "name": entry.data.title,
      "author": { "@type": "Person", "name": study.author, "identifier": study.orcid },
      "datePublished": study.current_version_date,
      "identifier": isStudyRoot ? study.concept_doi : null,
      "isPartOf": isChapter ? { "@type": "ScholarlyArticle", "name": study.title, "@id": `https://lemma.gig8.com/${studySlug}/` } : null,
      "license": "https://creativecommons.org/licenses/by/4.0/"
    })} />

    {/* Dublin Core */}
    <meta name="DC.title" content={study.title} />
    <meta name="DC.creator" content={study.author} />
    <meta name="DC.date" content={study.current_version_date} />
    <meta name="DC.identifier" content={study.concept_doi} />
    <meta name="DC.rights" content="https://creativecommons.org/licenses/by/4.0/" />
    <meta name="DC.language" content="en" />
  </>
)}
```

- [ ] **Step 3: Register Head component in Starlight config**

Edit `site/astro.config.mjs`:
```javascript
starlight({
  // ... existing config
  components: {
    Head: './src/components/Head.astro',
    // ... any existing overrides
  },
})
```

- [ ] **Step 4: Install js-yaml dependency**

```bash
cd site && npm install js-yaml && cd ..
```

- [ ] **Step 5: Commit**

```bash
git add site/src/components/Head.astro site/astro.config.mjs site/package.json site/package-lock.json
git commit -m "feat(site): emit Highwire + JSON-LD + Dublin Core meta per page"
```

### Task 2b.2: Add llms.txt, llms-full.txt, .well-known/ai.txt

**Files:**
- Create: `site/public/llms.txt`
- Create: `site/public/llms-full.txt` (generated per compile — for now, an initial stub)
- Create: `site/public/.well-known/ai.txt`

**Interfaces:**
- Consumes: 2a completion
- Produces: three AI-agent index/policy files served at site root

- [ ] **Step 1: Create initial llms.txt stub**

```bash
cat > site/public/llms.txt <<'EOF'
# Lemma Theological Studies

> A theological reference library — exegetical studies using the SCAR Quadrilateral framework. Offered freely; CC BY 4.0.

## Studies (published, index-only for now — populated as studies migrate)

(No studies migrated yet in Phase 2b; see Phase 3+ for pilot.)

## Machine-readable variants

- Full corpus text: /llms-full.txt
- Corpus claim registry: /claims-index.jsonl
- Interaction policy: /.well-known/ai.txt
EOF
```

- [ ] **Step 2: Create initial llms-full.txt stub**

```bash
echo "# Lemma Full Corpus — populated at compile time per study" > site/public/llms-full.txt
```

Note: this will be regenerated by `compile-study` per §7.7 sizing decision from Task 2a.5.

- [ ] **Step 3: Create .well-known/ai.txt**

```bash
mkdir -p site/public/.well-known
cat > site/public/.well-known/ai.txt <<'EOF'
# AI Interaction Policy for lemma.gig8.com

Content-license: CC-BY-4.0
Preferred-citation: DOI (see individual study Highwire meta or /<slug>/study.yaml)
Full-text-endpoint: /<slug>/<chapter>.md (raw markdown variant)
Corpus-summary: /llms-full.txt
Claim-registry: /claims-index.jsonl
Rate-limit: 60 requests/minute (soft; higher on request)
Contact: privacy@gig8.com

Content is a gift to the family of Christ. Use freely.
EOF
```

- [ ] **Step 4: Commit**

```bash
git add site/public/llms.txt site/public/llms-full.txt site/public/.well-known/ai.txt
git commit -m "feat(site): add AI-agent index files (llms.txt, llms-full.txt, ai.txt)"
```

### Task 2b.3: Create feedback issue template with public-consent checkbox

**Files:**
- Create: `.github/ISSUE_TEMPLATE/feedback.yml`

**Interfaces:**
- Consumes: `lemma-studies/lemma-content` repo exists
- Produces: readers submitting feedback via GitHub Issues have explicit public-consent checkbox

- [ ] **Step 1: Create issue template**

```bash
cat > .github/ISSUE_TEMPLATE/feedback.yml <<'EOF'
name: Feedback on a study
description: Suggest an improvement, correction, or raise a question about a lemma study
labels: ["type:public-feedback"]
body:
  - type: markdown
    attributes:
      value: |
        Thank you for engaging with the studies.

        **This submission is public.** Your GitHub username and comment will be visible on this repo. If you'd prefer private feedback, email `lemma@gig8.com` instead — that goes to a private workroom and we ask before crediting you publicly.
  - type: checkboxes
    id: consent
    attributes:
      label: Consent
      options:
        - label: I understand this submission is public.
          required: true
  - type: dropdown
    id: type
    attributes:
      label: Type of feedback
      options:
        - correction
        - disagreement
        - missing content
        - typo
        - question
        - other
    validations:
      required: true
  - type: input
    id: study
    attributes:
      label: Study slug (e.g., what-is-the-perfect)
    validations:
      required: true
  - type: input
    id: chapter
    attributes:
      label: Chapter or section (e.g., 04-reality/§4.3)
  - type: textarea
    id: comment
    attributes:
      label: Comment
    validations:
      required: true
EOF
```

- [ ] **Step 2: Commit**

```bash
git add .github/ISSUE_TEMPLATE/feedback.yml
git commit -m "feat(intake): public feedback issue template with consent checkbox"
```

### Task 2b.4: Configure Zoho + Gmail email intake pipeline

**Files:**
- Zoho web UI: alias creation + filter + forward
- Gmail: filter with label

**Interfaces:**
- Consumes: 1.11 (GitHub App exists for issue creation), existing Zoho `tim@gig8.com` alias `lemma@gig8.com` (already set up per earlier session)
- Produces: emails to `lemma@gig8.com` land in Gmail with `lemma-feedback` label; nightly workflow later polls this label

- [ ] **Step 1: Verify `lemma@gig8.com` alias exists in Zoho** (per earlier session)

Zoho Mail Settings → Email accounts — confirm alias present.

- [ ] **Step 2: Create Zoho forward rule to Gmail**

Zoho Settings → Mail → Filters → New:
- Name: `Lemma feedback forward`
- Condition: `To` `contains` `lemma@gig8.com`
- Action: `Move to Folder` → `Lemma-Feedback` AND `Forward to` `<your-gmail@gmail.com>`
- Enable

- [ ] **Step 3: Create Gmail filter to label**

Gmail Settings → Filters → Create new:
- Criteria: `To: lemma@gig8.com` OR `To: <your-gmail>+lemma@gmail.com` (depending on which route works)
- Action: Apply label `lemma-feedback`; Skip inbox (optional)

- [ ] **Step 4: Send test email**

Send from another account to `lemma@gig8.com`. Verify:
- Zoho `Lemma-Feedback` folder gets a copy
- Gmail with `lemma-feedback` label appears

- [ ] **Step 5: Create `privacy@gig8.com` alias**

Zoho Settings → Email accounts → New alias → `privacy@gig8.com`. Set forward to `tim@gig8.com`. Send test.

### Task 2b.5: Create hypothes.is `lemma-editorial` group + `lemma-ai-editor` identity

**Files:**
- hypothes.is web UI + `/mnt/a/gig8/credentials.json` update

**Interfaces:**
- Consumes: nothing
- Produces: private hypothes.is group `lemma-editorial` exists; AI reply identity created; API tokens stored

- [ ] **Step 1: Create hypothes.is account for `lemma-ai-editor`**

Register at hypothes.is with email `lemma@gig8.com` (or a dedicated `lemma-ai-editor@gig8.com` alias) and clear display name "Lemma AI Editor" and profile bio noting AI-authored responses.

- [ ] **Step 2: Create `lemma-editorial` private group**

Under Tim's account: Create Group → Private → Name: `lemma-editorial`. Invite `lemma-ai-editor@gig8.com` account.

Note group ID (from group URL).

- [ ] **Step 3: Generate API tokens**

Both accounts: `hypothes.is/account/developer` → generate API token.

Save to `/mnt/a/gig8/credentials.json` under keys:
- `hypothesis.tim_token`
- `hypothesis.ai_editor_token`
- `hypothesis.editorial_group_id`

- [ ] **Step 4: Verify token via API**

```bash
TOKEN=<lemma-ai-editor-token>
curl -sH "Authorization: Bearer $TOKEN" https://hypothes.is/api/profile | jq .userid
```
Expected: `acct:lemma-ai-editor@hypothes.is` or similar.

### Task 2b.6: Set up branch protection on lemma-content main

**Files:**
- GitHub Settings → Rules → Rulesets

**Interfaces:**
- Consumes: 1.11 (GitHub App exists for bypass)
- Produces: `main` requires PRs OR App bypass; App can force-push for §16 erasure procedures

- [ ] **Step 1: Create branch ruleset on lemma-content main**

Settings → Rules → Rulesets → New:
- Name: `main-protection`
- Enforcement: Active
- Target: `main`
- Rules:
  - Require pull request before merging (optional — depending on preference)
  - Restrict deletions
  - Do NOT restrict pushes (Job 2d needs push; solo maintainer can push directly)
- Bypass list: add `lemma-release-bot` (GitHub App)

Note: also enable `Allow force pushes` bypass for the App (needed for §16 filter-repo erasure).

### Task 2b.7: Implement scripts/lemma-cli/ (health-check, verify-release, dry-run-erasure, self-test)

**Files:**
- Create: `scripts/lemma-cli/health-check.mjs`
- Create: `scripts/lemma-cli/verify-release.mjs`
- Create: `scripts/lemma-cli/dry-run-erasure.mjs`
- Create: `scripts/lemma-cli/self-test.mjs`
- Create: `data/phase-state.yaml`
- Create: `data/failure-modes.yaml`
- Create: `data/health-checks.yaml` (per-check contract)

**Interfaces:**
- Consumes: `data/phase-state.yaml` (single source of truth for phase)
- Produces: `npm run health-check --json`, `npm run verify-release --tag <tag> --json`, `npm run dry-run-erasure --subject <id>`, `npm run self-test`. Each conforms to §21A script contract.

- [ ] **Step 1: Create data/phase-state.yaml**

```bash
cat > data/phase-state.yaml <<'EOF'
# Phase state — SINGLE SOURCE OF TRUTH per R7 B3
# Read by CI (via yq) and lemma-cli
# Updated by phase4-exit.mjs at Phase 4 exit

current_phase: phase-2b   # phase-1 | phase-2a | phase-2b | phase-3-pilot | phase-4-bulk | phase-4-exit | steady-state
release_publish_unlocked: false   # tag = human gate; Zenodo publishes on Phase 3 first release
base_url: https://lemma-content.pages.dev   # updated to https://lemma.gig8.com at Phase 4 exit
EOF
```

- [ ] **Step 2: Create data/failure-modes.yaml**

Copy the registry from design §21F (all 18 entries with autonomy field). Skip the full YAML here; verify each has: `id`, `detection`, `recovery`, `autonomy`, `auto_detectable`, `health_check_hook`, `introduced_in`, `last_verified`, `owner`, `max_auto_attempts`, `auto_cooldown_hours`.

- [ ] **Step 3: Create data/health-checks.yaml (per-check contract)**

```yaml
checks:
  base_url_reachable:
    severity: warn        # blocking after Phase 4 exit
    phase_gated_by: current_phase
    phase_gates: { phase-4-exit: blocking, steady-state: blocking }
    runtime_context: [ci, local]

  study_canonical_url:
    severity: blocking
    study_lifecycle_gated: true
    runtime_context: [ci, local]

  concept_doi_resolves:
    severity: blocking
    study_lifecycle_gated: true
    runtime_context: [ci, local]

  version_doi_resolves:
    severity: blocking
    study_lifecycle_gated: true
    runtime_context: [ci, local]

  pdf_url_200:
    severity: blocking
    study_lifecycle_gated: true
    runtime_context: [ci, local]

  llms_txt_200:
    severity: blocking
    runtime_context: [ci, local]

  llms_full_txt_200:
    severity: blocking
    runtime_context: [ci, local]

  ai_bot_ua_synthetic:
    severity: warn       # blocking Phase 4+
    phase_gated_by: current_phase
    phase_gates: { phase-4-exit: blocking, steady-state: blocking }
    runtime_context: [ci, local]
    uas: [GPTBot, ClaudeBot, CCBot, OAI-SearchBot, PerplexityBot, Meta-ExternalAgent, ChatGPT-User, Claude-SearchBot, Claude-User, Bytespider, Amazonbot, Perplexity-User]

  swh_archived:
    severity: pending
    eventually_consistent: true
    recheck_window_hours: 48
    runtime_context: [ci, local]

  hf_dataset_current:
    severity: pending
    eventually_consistent: true
    recheck_window_hours: 24
    runtime_context: [ci, local]

  scarlight_reindexed:
    severity: warn
    runtime_context: [local]   # cannot query LAN Scarlight from CI

  heartbeat_fresh:
    severity: blocking
    runtime_context: [ci, local]

  retention_chore_current:
    severity: warn
    runtime_context: [local]   # reads workroom chore-log

  claims_jsonl_schema:
    severity: blocking
    runtime_context: [ci, local]

  xrefs_json_schema:
    severity: blocking
    runtime_context: [ci, local]

  rag_breadcrumbs_present:
    severity: blocking
    runtime_context: [ci, local]

  design_version_header_matches:
    severity: warn
    runtime_context: [local]

  sitemap_excludes_versions:
    severity: blocking
    runtime_context: [ci, local]

  no_test_slugs_on_main:
    severity: blocking
    runtime_context: [ci, local]
```

- [ ] **Step 4: Implement health-check.mjs (skeleton — full impl at Phase 3 exit as we discover what actually needs checking)**

```javascript
#!/usr/bin/env node
// scripts/lemma-cli/health-check.mjs
// Emits JSON report of check results per data/health-checks.yaml + data/phase-state.yaml
// Exit code: 0 = all pass/warn/pending, 1 = at least one fail

import fs from 'node:fs';
import yaml from 'js-yaml';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const isJson = args.includes('--json') || !process.stdout.isTTY;
const isCheck = args.includes('--check');
const runtimeContext = args.includes('--local') ? 'local' : 'ci';

const phaseState = yaml.load(fs.readFileSync('data/phase-state.yaml', 'utf8'));
const checkContract = yaml.load(fs.readFileSync('data/health-checks.yaml', 'utf8'));

const results = [];

for (const [checkId, contract] of Object.entries(checkContract.checks)) {
  // Skip if runtime_context doesn't include current
  if (!contract.runtime_context.includes(runtimeContext)) continue;

  // Determine effective severity per phase gate
  let severity = contract.severity;
  if (contract.phase_gates && contract.phase_gates[phaseState.current_phase]) {
    severity = contract.phase_gates[phaseState.current_phase];
  }

  // TODO: Implement per-check logic
  // For now, mark all as 'pending' pending Phase 3 exit real implementation
  results.push({
    check: checkId,
    status: 'pending',
    severity,
    message: 'stub — implement in Phase 3 exit prep',
  });
}

const worstStatus = results.some(r => r.status === 'fail') ? 'fail' :
                    results.some(r => r.status === 'warn') ? 'warn' :
                    results.some(r => r.status === 'pending') ? 'pending' : 'clean';

const report = {
  timestamp: new Date().toISOString(),
  phase: phaseState.current_phase,
  runtime_context: runtimeContext,
  overall_status: worstStatus,
  checks: results,
};

// Write aggregate to data/last-health-check.json (public — aggregate only)
const publicReport = {
  timestamp: report.timestamp,
  phase: report.phase,
  runtime_context: report.runtime_context,
  overall_status: report.overall_status,
  counts: {
    clean: results.filter(r => r.status === 'clean').length,
    warn: results.filter(r => r.status === 'warn').length,
    pending: results.filter(r => r.status === 'pending').length,
    fail: results.filter(r => r.status === 'fail').length,
  },
  schema_version: '1.0',
};
fs.writeFileSync('data/last-health-check.json', JSON.stringify(publicReport, null, 2));

if (isJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Health check @ phase ${report.phase}: ${report.overall_status}`);
  for (const r of results) {
    console.log(`  [${r.severity}] ${r.check}: ${r.status} — ${r.message}`);
  }
}

process.exit(worstStatus === 'fail' ? 1 : 0);
```

- [ ] **Step 5: Implement verify-release.mjs skeleton**

```javascript
#!/usr/bin/env node
// scripts/lemma-cli/verify-release.mjs --tag <tag> --json
// Runs §21C check set scoped to one release; opens Issue on fail (create-or-update by check-id)

import fs from 'node:fs';
import yaml from 'js-yaml';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const tagIdx = args.indexOf('--tag');
if (tagIdx === -1) {
  console.error('Usage: verify-release --tag <slug>/vN.N [--json] [--local]');
  process.exit(2);
}
const tag = args[tagIdx + 1];
const [slug, version] = tag.split('/');
const isJson = args.includes('--json') || !process.stdout.isTTY;
const runtimeContext = args.includes('--local') ? 'local' : 'ci';

// TODO: implement checks scoped to this study/version
// - Fetch study.yaml at tagged commit
// - Per-study-lifecycle-gated: pending if study.yaml.versions empty
// - Otherwise run URL/DOI/PDF/HF/SWH checks

console.log(JSON.stringify({ tag, slug, version, status: 'pending', note: 'stub — full impl in Phase 3 exit prep' }, null, 2));
process.exit(0);
```

- [ ] **Step 6: Implement dry-run-erasure.mjs + self-test.mjs skeletons**

Both as minimal stubs conforming to §21A script contract. Full implementations layer in during Phase 3 when we actually have content to erase-simulate.

- [ ] **Step 7: Commit all lemma-cli scaffolding**

```bash
git add scripts/lemma-cli/ data/phase-state.yaml data/failure-modes.yaml data/health-checks.yaml
git commit -m "feat(lemma-cli): scaffold health-check + verify-release + dry-run-erasure + self-test"
```

### Task 2b.8: Write CLAUDE.md at both repo roots

**Files:**
- Create: `lemma-content/CLAUDE.md`
- Create: `~/Projects/lemma-studies/lemma-workroom/CLAUDE.md`

**Interfaces:**
- Consumes: design doc + registry
- Produces: AI-maintenance playbook at both repo roots per §21B

- [ ] **Step 1: Write lemma-content/CLAUDE.md**

```markdown
---
design-version: v7.1
---

# Lemma Content — AI Maintenance Playbook

This is `lemma-studies/lemma-content`, the public canonical repo for lemma theological studies.

## What this repo is

Public canonical content, Astro Starlight site, publishing pipeline, AI-first surfaces. Companion to private `lemma-studies/lemma-workroom` (work product).

## Where things live

- **Chapters:** `studies/<slug>/*.md` (canonical; edit these, never compiled output)
- **Compiled per-version:** `studies/<slug>/versions/vN.N/` (written by compile)
- **Design + specs:** `docs/superpowers/specs/` (canonical design at `2026-08-11-lemma-content-architecture-design.md`)
- **Failure modes:** `data/failure-modes.yaml` — READ before triaging any failure
- **Phase state:** `data/phase-state.yaml` — SINGLE source of truth for phase
- **Health check contract:** `data/health-checks.yaml`

## Standard rituals

See design §6.1 (author writing loop), §6.2 (version cut — TIM HUMAN-GATES the tag), §6.3 (pipeline).

## Recurring chores

See workroom `chore-log.jsonl` (queryable via jq for drift detection). Retention chores quarterly per `retention-schedule.md`.

## Failure recovery

See `data/failure-modes.yaml` — each entry has `autonomy: auto | propose | human-gate`. **NEVER** touch `human-gate` unattended. All erasure work is `human-gate`.

## Verification patterns

Run `npm run health-check --local` at session start if `data/last-health-check.json` timestamp > 14 days.

Run `npm run verify-release --tag <slug>/vN.N` after any release to confirm all surfaces reachable.

Run `npm run dry-run-erasure --subject <id>` to simulate GDPR erasure (never auto-executes).

## Anti-patterns

- **Never** silently edit `CLAUDE.md` or `failure-modes.yaml` — every change goes through commit with rationale
- **Never** tag a version — Tim executes `git tag && git push origin <tag>` (tag = human gate for irreversible Zenodo publish)
- **Never** edit compiled files in `studies/<slug>/versions/*/*.md` — regenerated per compile
- **Never** put `[skip ci]` or CF-skip phrases in Job 2d commits (suppresses CF Pages PDF deploy)
- **Never** create test/synthetic study slugs on `main` (blocks release via `no_test_slugs_on_main` check)
- **Never** commit raw email PII to `main` — belongs in workroom `feedback-inbox/`
- **Never** publish reader canary phrases to public benchmarks — they live in workroom `absorption-benchmarks/`

## Skills references

- `~/.claude/skills/lemma-review-gauntlet/` — for review-round work
- `~/.claude/skills/lemma-verify-quotes/` — for quote verification

## Session start ritual

1. Read this file
2. Check `data/last-health-check.json` timestamp; if > 14 days: `npm run health-check --local`
3. Check for open `verify-release-failure` labeled Issues via `gh issue list --label verify-release-failure`
4. Proceed with task
```

- [ ] **Step 2: Write workroom CLAUDE.md** (similar structure with workroom-specific content — feedback-inbox handling, absorption-benchmarks discipline, erasure procedure references)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): AI-maintenance playbook (design-version: v7.1)"
```

In workroom:
```bash
cd ~/Projects/lemma-studies/lemma-workroom
git add CLAUDE.md
git commit -m "docs(claude): workroom AI-maintenance playbook"
git push
```

### Task 2b.9: Implement nightly export scripts

**Files:**
- Create: `scripts/export-annotations.mjs`
- Create: `scripts/export-comments.mjs`
- Create: `scripts/export-feedback.mjs` (strips transport headers)
- Create: `.github/workflows/nightly-annotations-export.yml`
- Create: `.github/workflows/nightly-comments-export.yml`
- Create: `.github/workflows/nightly-feedback-triage.yml`
- Create: `.github/workflows/keep-alive.yml`

**Interfaces:**
- Consumes: 2b.4 (email intake), 2b.5 (hypothes.is group)
- Produces: nightly cron writes to `annotations/`, `comments/`, `feedback-log/`, `data/last-heartbeat.txt`

- [ ] **Step 1: Implement export-annotations.mjs**

Fetches from hypothes.is API using `HYPOTHESIS_TOKEN` env; filters by group ID; writes JSONL to `annotations/<slug>.jsonl`. Public export goes to lemma-content; editorial export goes to workroom (separate script or `--group` flag).

- [ ] **Step 2: Implement export-comments.mjs**

Fetches from GitHub Discussions API for `lemma-studies/lemma-content`; writes JSONL to `comments/<slug>.jsonl`.

- [ ] **Step 3: Implement export-feedback.mjs**

Fetches from Gmail via Google API (or MCP-based); strips transport headers (only body + From + Subject + Date + Message-ID retained); writes JSONL to `../lemma-workroom/feedback-inbox/<date>.jsonl` (cross-repo push — requires GitHub App scope on workroom too).

- [ ] **Step 4: Create keep-alive workflow**

```yaml
# .github/workflows/keep-alive.yml
name: keep-alive
on:
  schedule:
    - cron: '0 6 * * 0'  # weekly Sunday 06:00 UTC
  workflow_dispatch:
jobs:
  heartbeat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update heartbeat
        run: |
          date -u +"%Y-%m-%dT%H:%M:%SZ" > data/last-heartbeat.txt
          git config user.name "lemma-release-bot"
          git config user.email "bot@gig8.com"
          git add data/last-heartbeat.txt
          # Commit with [skip ci] since this shouldn't trigger CF Pages rebuild for a timestamp
          git commit -m "chore(keepalive): $(date -u +%F) [skip ci]" || echo "no change"
          git push
```

**IMPORTANT:** the `[skip ci]` here is DELIBERATE — per R7 P4, heartbeat commits should carry it. Job 2d guard is SCOPED to Job 2d only (not blanket ban).

- [ ] **Step 5: Create other nightly workflow YAMLs (annotations, comments, feedback)**

Each cron'd + `workflow_dispatch`; each writes to respective destinations with commit + push.

- [ ] **Step 6: Set required Actions secrets**

```bash
gh secret set HYPOTHESIS_TOKEN --repo lemma-studies/lemma-content
gh secret set GMAIL_ACCESS_TOKEN --repo lemma-studies/lemma-content  # or use OAuth flow
# GitHub App token is auto-provided as GITHUB_APP_INSTALLATION_TOKEN in Actions
```

- [ ] **Step 7: Commit + wait for first cron**

```bash
git add scripts/export-*.mjs .github/workflows/*.yml
git commit -m "feat(intake): nightly export workflows (annotations, comments, feedback, keep-alive)"
git push
```

### Task 2b.10: Verify Phase 2b exit criteria

**Files:** verification only

**Interfaces:**
- Consumes: 2b.1-2b.9
- Produces: assertion that Phase 2b done; ready for Phase 3

- [ ] **Step 1: Verify site builds and deploys**

```bash
curl -sI https://lemma-content.pages.dev/ | head -3
```
Expected: HTTP 200.

- [ ] **Step 2: Verify Highwire meta emitted on any migrated study page**

None migrated yet, so verify via a synthetic check on a stub page — confirm the Head component doesn't error even when `study.yaml` missing.

- [ ] **Step 3: Verify llms.txt + llms-full.txt + .well-known/ai.txt served**

```bash
for path in /llms.txt /llms-full.txt /.well-known/ai.txt; do
  echo "=== $path ==="
  curl -sI "https://lemma-content.pages.dev$path" | head -3
done
```

- [ ] **Step 4: Verify no `on: push` workflow**

```bash
grep -r "on:" .github/workflows/*.yml | grep -E "push:|push$"
```
Expected: zero matches (only `schedule:`, `workflow_dispatch:`, and tag-triggered workflows).

- [ ] **Step 5: Verify GitHub App can push (dry-run)**

Trigger `keep-alive.yml` manually via `gh workflow run keep-alive.yml`. Confirm it succeeds.

- [ ] **Step 6: Run health-check (will show many pending; that's fine at Phase 2b)**

```bash
npm run health-check --local
```
Expected: JSON output; most checks `pending` (no releases yet); no `fail`.

- [ ] **Step 7: Mark Phase 2b complete**

Update `data/phase-state.yaml`:
```yaml
current_phase: phase-3-pilot
```
Commit + push.

---

# PHASE 3 — Pilot Vertical Slice: What Is the Perfect

Design reference: §11 Phase 3.

### Task 3.1: Copy WITP chapters from Vault to lemma-content/studies/what-is-the-perfect/

**Files:**
- Source: `/mnt/c/Users/timuy/Dropbox/personal/Vault/Projects/lemma/What Is the Perfect/`
- Target: `~/Projects/lemma-studies/lemma-content/studies/what-is-the-perfect/`

**Interfaces:**
- Consumes: Phase 2b complete
- Produces: WITP chapters in git-canonical location

- [ ] **Step 1: Copy chapter files (chapters only, not compiled/reviews/workroom)**

```bash
cd ~/Projects/lemma-studies/lemma-content
mkdir -p studies/what-is-the-perfect
SRC="/mnt/c/Users/timuy/Dropbox/personal/Vault/Projects/lemma/What Is the Perfect"
cp "$SRC"/00-*.md "$SRC"/[0-9]*-Chapter-*.md "$SRC"/Appendix-*.md studies/what-is-the-perfect/
cp "$SRC"/build.sh "$SRC"/table-layout.tex studies/what-is-the-perfect/ 2>/dev/null
```

- [ ] **Step 2: Verify no PII / drafts / reviews accidentally copied**

```bash
ls studies/what-is-the-perfect/
```
Expected: only chapter files + appendices + build.sh + table-layout.tex. NOT working-notes, reviews, historical.

- [ ] **Step 3: Drop MIGRATED.md tombstone in Vault**

```bash
cat > "$SRC/MIGRATED.md" <<EOF
# MIGRATED

This study's canonical location is now:
\`~/Projects/lemma-studies/lemma-content/studies/what-is-the-perfect/\`

Do NOT edit files in this Vault folder — edits will be silently lost.

Migrated: $(date -u +%F)
EOF
```

### Task 3.2: Move WITP workroom content to lemma-workroom/studies/what-is-the-perfect/

**Files:**
- Source: `/mnt/c/…/Vault/Projects/lemma/What Is the Perfect/{Working-Notes,External Reviews,Research-Findings,Primary-Sources,historical,Review-*,*.pdf,*.tmp*}`
- Target: `~/Projects/lemma-studies/lemma-workroom/studies/what-is-the-perfect/`

**Interfaces:**
- Consumes: 3.1
- Produces: workroom content organized under workroom repo

- [ ] **Step 1: Copy workroom-tier content**

```bash
cd ~/Projects/lemma-studies/lemma-workroom
mkdir -p studies/what-is-the-perfect/{Working-Notes,external-reviews,dispositions,drafts,review-packages,research-findings}
SRC="/mnt/c/Users/timuy/Dropbox/personal/Vault/Projects/lemma/What Is the Perfect"
cp -r "$SRC/Working-Notes/"* studies/what-is-the-perfect/Working-Notes/ 2>/dev/null
cp -r "$SRC/External Reviews/"* studies/what-is-the-perfect/external-reviews/ 2>/dev/null
cp -r "$SRC/Research-Findings/"* studies/what-is-the-perfect/research-findings/ 2>/dev/null
cp -r "$SRC/historical/"* studies/what-is-the-perfect/drafts/historical/ 2>/dev/null
cp "$SRC/Review-Package-"*.md studies/what-is-the-perfect/review-packages/ 2>/dev/null
cp "$SRC/Review-Instructions-"*.md studies/what-is-the-perfect/review-packages/ 2>/dev/null
```

- [ ] **Step 2: Move Stamp thesis PDF to workroom OA-hosted-unclear**

```bash
mkdir -p primary-sources/OA-hosted-unclear
cp "$SRC/Primary-Sources/Stamp-1970-Grace-MDiv-FaceToFace.pdf" primary-sources/OA-hosted-unclear/
cat > primary-sources/OA-hosted-unclear/stamp-1970.meta.json <<'EOF'
{
  "id": "stamp-1970-face-to-face",
  "citation": "Stamp, Larry Wayne. \"Face to Face: A Study of 1 Corinthians 13:12.\" M.Div. thesis, Grace Theological Seminary, 1970.",
  "canonical_url": "https://grace.hykucommons.org/concern/etds/4bafdf0e-b469-4a9d-b114-48c204c599cb",
  "redistribution": "OA-hosted-unclear",
  "retrieved": "2026-08-11",
  "status": "active",
  "language": "en"
}
EOF
```

- [ ] **Step 3: Commit to workroom**

```bash
git add studies/ primary-sources/
git commit -m "feat(pilot): migrate What Is the Perfect workroom content"
git push
```

### Task 3.3: Author study.yaml, primary-sources.json, claims.jsonl, briefing.md for WITP

**Files:**
- Create: `studies/what-is-the-perfect/study.yaml`
- Create: `studies/what-is-the-perfect/primary-sources.json`
- Create: `studies/what-is-the-perfect/claims.jsonl`
- Create: `studies/what-is-the-perfect/briefing.md`

**Interfaces:**
- Consumes: 3.1 (chapters exist)
- Produces: study metadata + primary-source refs + claims registry + AI briefing document

- [ ] **Step 1: Author study.yaml**

```bash
cat > studies/what-is-the-perfect/study.yaml <<'EOF'
title: "What Is the Perfect? A Study of 1 Corinthians 13:10"
slug: what-is-the-perfect
author: "Tim Uy"
orcid: "0000-0000-0000-0000"  # TODO: register + fill
license: CC-BY-4.0
current_version: v5.4
current_version_date: 2026-08-11
concept_doi: null   # populated after first Zenodo publish (Task 3.7)
versions:
  - version: v5.4
    version_doi: null   # populated at reserve-doi step
    date: 2026-08-11
    tag: what-is-the-perfect/v5.4
    notes: "Round 11 folds applied; Stamp thesis integration"
tags:
  - biblical-studies
  - 1-corinthians-13
  - cessationism
  - teleion
  - eschatology
EOF
```

- [ ] **Step 2: Author primary-sources.json**

Enumerate the IDs referenced by WITP chapters. Populate central manifest per Task 3.4.

- [ ] **Step 3: Author claims.jsonl**

```jsonl
{"id":"wp-4-3-eschaton","claim":"τὸ τέλειον in 1 Cor 13:10 refers to the eschaton, not the closed canon","confidence":"high","supporting_evidence":["04-Chapter-Reality.md/§4.3","05-Chapter-Synthesis.md/§5.2"],"counter_positions":["Grace-tradition canon reading — steel-manned in Ch 4 §4.4"],"version":"v5.4"}
{"id":"wp-4-4-grace-tradition","claim":"The Grace tradition's canon-reading is unified through 1949-1977 with Stamp 1970 as the primary case study of that unity","confidence":"moderate","supporting_evidence":["04-Chapter-Reality.md/§4.4"],"counter_positions":["Vine 1938 partial dissent"],"version":"v5.4"}
```

(Author 5-10 top-level claims for WITP as an AI-usable summary.)

- [ ] **Step 4: Author briefing.md (500-1000 words for RAG optimization)**

Structure: TL;DR + numbered key claims + methodology (tldrSCAR) + primary conclusions + distinctive claims.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/lemma-studies/lemma-content
git add studies/what-is-the-perfect/{study.yaml,primary-sources.json,claims.jsonl,briefing.md}
git commit -m "feat(pilot): author WITP study metadata (study.yaml, primary-sources, claims, briefing)"
```

### Task 3.4: Populate primary-sources/manifest.json with WITP sources

**Files:**
- Create: `primary-sources/manifest.json`
- Create: `primary-sources/README.md` (ID convention)

**Interfaces:**
- Consumes: 3.3 (WITP primary-sources.json enumerates IDs to add)
- Produces: central primary-source registry per §7.5

- [ ] **Step 1: Write primary-sources/README.md ID convention**

```markdown
# Primary Source ID Convention

Format: `<author-slug>-<work-slug>-<reference>`

Examples:
- `irenaeus-ah-2-22-5` — Irenaeus, Against Heresies 2.22.5
- `augustine-conf-1-1-1` — Augustine, Confessions 1.1.1
- `stamp-1970-face-to-face` — Stamp, "Face to Face" 1970

Reference format uses dashes for dots (`2.22.5` → `2-22-5`). Author slug is lowercase, hyphenated.

Adding a new source: (1) add manifest.json entry with all fields per §7.5 schema; (2) run `verify-manifest.mjs` to check no duplicate ID; (3) reference from study's primary-sources.json by ID.
```

- [ ] **Step 2: Write initial manifest.json with WITP sources**

Enumerate ~30-50 patristic + biblical + contemporary sources WITP references. Each entry per §7.5 schema.

Sample:
```json
{
  "sources": [
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
    // ... more entries
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add primary-sources/
git commit -m "feat(primary-sources): initial manifest with WITP sources + ID convention"
```

### Task 3.5: Run compile:study + zenodo-reserve-doi + commit + tag (HUMAN GATE for tag)

**Files:**
- Modify: `studies/what-is-the-perfect/study.yaml` (auto-updated with reserved DOI)
- Create: `studies/what-is-the-perfect/versions/v5.4/*.md`
- Create: `studies/what-is-the-perfect/xrefs.json`
- Create: `claims-index.jsonl` (corpus-level regen)
- Create: `llms-full.txt` (corpus-level regen)

**Interfaces:**
- Consumes: 3.3 + 3.4
- Produces: tagged commit self-contains versioned markdown + DOI reservation; Tim executes tag push (HUMAN GATE)

- [ ] **Step 1: Ensure zenodo-reserve-doi.mjs and compile-study.js are ready**

- Verify `compile-study.js` writes both compiled composite AND per-chapter `versions/vN.N/*.md` (per R7 fix)
- Verify `compile-study.js` regenerates `claims-index.jsonl` and `llms-full.txt` at corpus level
- Verify `zenodo-reserve-doi.mjs` implements two-path logic (fresh concept / newversion) + orphan-draft reuse
- Verify `zenodo-reserve-doi.mjs` reads `base_url` from `data/phase-state.yaml`

- [ ] **Step 2: Run compile**

```bash
cd ~/Projects/lemma-studies/lemma-content
npm run compile:study -- --study what-is-the-perfect --version v5.4
```

Expected output: `studies/what-is-the-perfect/versions/v5.4/00-Overview.md` (etc.), `xrefs.json`, composite `.md`, `claims-index.jsonl`, `llms-full.txt`.

- [ ] **Step 3: Run reserve-doi**

```bash
node scripts/zenodo-reserve-doi.mjs --study what-is-the-perfect --version v5.4
```

Expected: `study.yaml` updated with reserved version DOI. Concept DOI slot filled (resolves after publish).

- [ ] **Step 4: Single commit**

```bash
git add studies/what-is-the-perfect/versions/v5.4/ \
        studies/what-is-the-perfect/xrefs.json \
        studies/what-is-the-perfect/study.yaml \
        claims-index.jsonl \
        llms-full.txt
git commit -m "release: what-is-the-perfect/v5.4 — compile + DOI reservation"
git push origin main
```

- [ ] **Step 5: TIM EXECUTES TAG (HUMAN GATE per §6.2)**

```bash
git tag -a what-is-the-perfect/v5.4 -m "v5.4 — Round 11 folds; Stamp thesis integration; pilot release"
git push origin what-is-the-perfect/v5.4
```

**AI DOES NOT execute steps 5 unattended** — Zenodo publish is irreversible; tag creation is the human gate for the permanent public scholarly record.

### Task 3.6: Verify Phase 3 pilot pipeline succeeds

**Files:**
- Verification only

**Interfaces:**
- Consumes: 3.5 (tag pushed → Action fires)
- Produces: assertion that all pipeline jobs succeeded; pilot is live

- [ ] **Step 1: Monitor GitHub Actions run**

```bash
gh run watch --repo lemma-studies/lemma-content
```

Expected: `on-tag-release.yml` fires and completes. Job stages: build → release → doi-publish → publish-surfaces (SWH + HF Phase 3+) → announce → verify-release.

- [ ] **Step 2: Verify release + assets**

```bash
gh release view what-is-the-perfect/v5.4 --repo lemma-studies/lemma-content
```
Expected: composite `.md` + `.rag.md` + PDF attached.

- [ ] **Step 3: Verify Zenodo publish**

Check `study.yaml` — concept DOI and version DOI should now both resolve.

```bash
CONCEPT_DOI=$(yq '.concept_doi' studies/what-is-the-perfect/study.yaml)
curl -sI "https://doi.org/$CONCEPT_DOI" | head -3
```
Expected: 302 or 200 pointing at Zenodo record.

- [ ] **Step 4: Verify HuggingFace dataset push**

Visit https://huggingface.co/datasets/gig8/lemma-theological-studies — should have `default` config with WITP v5.4 rows.

- [ ] **Step 5: Verify SWH archive**

```bash
curl -sL "https://archive.softwareheritage.org/api/1/origin/https://github.com/lemma-studies/lemma-content/" | jq '.origin_visits[-1]'
```
Expected: latest visit succeeded (may be `pending` for up to 48h per §21C recheck window).

- [ ] **Step 6: Verify site rendering**

```bash
curl -sI https://lemma-content.pages.dev/what-is-the-perfect/ | head -3
curl -sI https://lemma-content.pages.dev/what-is-the-perfect/04-chapter-reality/ | head -3
curl -sI https://lemma-content.pages.dev/what-is-the-perfect/versions/v5.4/04-chapter-reality/ | head -3
curl -sI https://lemma-content.pages.dev/studies/what-is-the-perfect/versions/v5.4/what-is-the-perfect-v5.4.pdf | head -3
```
Expected: all 200.

- [ ] **Step 7: Verify frozen version noindex**

```bash
curl -s https://lemma-content.pages.dev/what-is-the-perfect/versions/v5.4/ | grep -i 'meta.*robots'
```
Expected: `<meta name="robots" content="noindex, follow">`.

### Task 3.7: Update Scarlight source_url for WITP + start local cron polling

**Files:**
- Scarlight config: update `study_what-is-the-perfect` corpus `source_url`
- Local systemd/cron: install Scarlight-poll-releases.sh

**Interfaces:**
- Consumes: 3.6 (release live)
- Produces: Scarlight reindexes from git; local cron catches subsequent releases

- [ ] **Step 1: Update Scarlight corpus source_url**

Locate Scarlight corpus config (path per Scarlight docs). Update `study_what-is-the-perfect`:
- Old: `/mnt/c/Users/timuy/Dropbox/personal/Vault/Projects/lemma/What Is the Perfect`
- New: `/home/tim/Projects/lemma-studies/lemma-content/studies/what-is-the-perfect`

- [ ] **Step 2: Trigger reindex**

Via Scarlight MCP or CLI.

- [ ] **Step 3: Install local cron for Releases polling**

```bash
cat > ~/bin/scarlight-poll-releases.sh <<'EOF'
#!/bin/bash
# Poll lemma-studies/lemma-content Releases feed; reindex Scarlight on new tags
LAST_TAG_FILE=~/.scarlight/last-lemma-tag
LATEST=$(gh release view --repo lemma-studies/lemma-content --json tagName -q .tagName 2>/dev/null)
LAST=$(cat "$LAST_TAG_FILE" 2>/dev/null)
if [ "$LATEST" != "$LAST" ] && [ -n "$LATEST" ]; then
  # Extract slug from <slug>/vN.N
  SLUG=${LATEST%/*}
  cd ~/Projects/lemma-studies/lemma-content && git fetch --tags && git checkout "$LATEST" 2>/dev/null || true
  # Trigger Scarlight reindex for this study
  # (invocation depends on Scarlight CLI / MCP)
  echo "$LATEST" > "$LAST_TAG_FILE"
fi
EOF
chmod +x ~/bin/scarlight-poll-releases.sh
```

Install cron:
```bash
crontab -l | { cat; echo '*/15 * * * * ~/bin/scarlight-poll-releases.sh'; } | crontab -
```

- [ ] **Step 4: Verify WITP corpus in Scarlight has v5.4 passages**

Query Scarlight for WITP passages; confirm timestamps recent + passages match published tag.

### Task 3.8: Run synthetic-second-study test in isolated tmp

**Files:**
- Temporary: `/tmp/lemma-synthetic-test/`

**Interfaces:**
- Consumes: 3.6 (real pilot works)
- Produces: assertion that PDF copy loop preserves per-study structure when 2+ studies exist; catches R6 A2 class bug at PILOT time not Phase 4

- [ ] **Step 1: Create synthetic study in isolated location**

```bash
mkdir -p /tmp/lemma-synthetic-test/studies/{what-is-the-perfect,test-study-2}/versions/v1.0
cp studies/what-is-the-perfect/versions/v5.4/what-is-the-perfect-v5.4.pdf \
   /tmp/lemma-synthetic-test/studies/what-is-the-perfect/versions/v1.0/what-is-the-perfect-v1.0.pdf 2>/dev/null || \
   echo "fake-witp" > /tmp/lemma-synthetic-test/studies/what-is-the-perfect/versions/v1.0/witp.pdf
echo "fake-test-study-2" > /tmp/lemma-synthetic-test/studies/test-study-2/versions/v1.0/test-study-2-v1.0.pdf

cd /tmp/lemma-synthetic-test
bash -c 'for d in studies/*/; do slug=$(basename "$d"); mkdir -p "site/public/studies/$slug" && [ -d "${d}versions" ] && cp -r "${d}versions" "site/public/studies/$slug/"; done'
```

- [ ] **Step 2: Verify per-study preservation**

```bash
find site -type f | sort
```
Expected output includes BOTH:
- `site/public/studies/what-is-the-perfect/versions/v1.0/…`
- `site/public/studies/test-study-2/versions/v1.0/test-study-2-v1.0.pdf`

NOT merged into `site/public/studies/versions/…`.

- [ ] **Step 3: Verify no `test-study-2` in `main`**

```bash
cd ~/Projects/lemma-studies/lemma-content
git status  # should be clean
ls studies/  # should NOT show test-study-2
```

Confirms test stayed isolated per R7 B6.

- [ ] **Step 4: Cleanup**

```bash
rm -rf /tmp/lemma-synthetic-test
```

### Task 3.9: Run Phase 3 exit synthetic-fetch checks

**Files:**
- Verification only

**Interfaces:**
- Consumes: 3.6 + 3.7 + 3.8
- Produces: Phase 3 exit criteria met per §11

- [ ] **Step 1: All URL 200 checks**

```bash
BASE=https://lemma-content.pages.dev
for path in "/" "/what-is-the-perfect/" "/what-is-the-perfect/04-chapter-reality/" \
            "/what-is-the-perfect/versions/v5.4/04-chapter-reality/" \
            "/studies/what-is-the-perfect/versions/v5.4/what-is-the-perfect-v5.4.pdf" \
            "/llms.txt" "/llms-full.txt" "/.well-known/ai.txt" \
            "/what-is-the-perfect/04-chapter-reality.md" ; do
  CODE=$(curl -sI "$BASE$path" | head -1 | awk '{print $2}')
  echo "$CODE  $path"
done
```
Expected: all 200.

- [ ] **Step 2: 12-UA synthetic-fetch (WARN during Phase 3 since `.pages.dev` not subject to zone WAF per R7 C8)**

```bash
for UA in GPTBot ClaudeBot CCBot OAI-SearchBot PerplexityBot Meta-ExternalAgent \
          ChatGPT-User Claude-SearchBot Claude-User Bytespider Amazonbot Perplexity-User ; do
  CODE=$(curl -sI -A "$UA/1.0" "$BASE/what-is-the-perfect/" | head -1 | awk '{print $2}')
  echo "$CODE  $UA"
done
```
Expected during Phase 3: all 200 (note: Phase 4 re-run against `lemma.gig8.com` is the authoritative check).

- [ ] **Step 3: Verify sitemap includes living, excludes /versions/**

```bash
curl -s "$BASE/sitemap-index.xml"
```
Expected: `what-is-the-perfect/` URLs present; `/versions/v5.4/` URLs absent.

- [ ] **Step 4: Verify robots.txt does NOT Disallow /studies/ or /versions/**

```bash
curl -s "$BASE/robots.txt"
```
Expected: permissive; no `Disallow: /studies/` or `/versions/`.

- [ ] **Step 5: Verify canonical link points at lemma.gig8.com (not .pages.dev)**

```bash
curl -s "$BASE/what-is-the-perfect/" | grep -i "rel=.canonical"
```
Expected: `<link rel="canonical" href="https://lemma.gig8.com/what-is-the-perfect/">`.

- [ ] **Step 6: Verify no PII in public artifacts**

```bash
grep -rEi "email|@.*\.(com|org|net)" studies/ annotations/ comments/ feedback-log/ 2>/dev/null | \
  grep -v "lemma-ai-editor\|privacy@gig8\|newadvent\|ccel\|gig8.com" | head -5
```
Expected: zero unexpected email addresses in public content. Any expected refs (Tim's ORCID etc.) OK.

- [ ] **Step 7: Run lemma health-check locally**

```bash
npm run health-check --local --json | jq '.overall_status, .counts'
```
Expected: `overall_status: "clean"` or `"warn"`; NOT `"fail"`. Any `warn` items should be documented.

- [ ] **Step 8: Verify no test/synthetic slugs on main**

```bash
ls studies/ | grep -i "test-\|synthetic-" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 9: Verify no `[skip ci]` in recent Job 2d commit messages**

```bash
git log --since="1 day ago" --all --grep="skip ci\|CI Skip\|CF-Pages-Skip" -i --oneline
```
Expected: only heartbeat commits should carry `[skip ci]`; Job 2d commits must not.

- [ ] **Step 10: Mark Phase 3 pilot complete**

Update `data/phase-state.yaml`:
```yaml
current_phase: phase-3-complete
# release_publish_unlocked stays false; base_url stays .pages.dev — those flip at Phase 4 exit
```

Commit + push. Post to Giscus announcement + Substack if desired.

---

## Self-Review Notes

**Spec coverage:** Plan covers Phases 1-3 of design v7.1. Phase 4-9 deferred to follow-up plans (bulk migration, cutover, PubPub, Wikidata, cleanup) — pilot needs to succeed first per Fable R6/R7 "next reviewer is the pilot" recommendation.

**Placeholders scan:** Some stub implementations (health-check per-check logic, verify-release full impl) explicitly noted as Phase 3 exit prep work — this is intentional decomposition, not placeholder. Some ORCID placeholder in study.yaml — requires Tim to register.

**Type consistency:** `data/phase-state.yaml` schema (`current_phase`, `release_publish_unlocked`, `base_url`) referenced consistently across tasks. `study.yaml` schema (`title`, `slug`, `orcid`, `concept_doi`, `versions[].version_doi`) consistent. Script contract (`--check`, `--dry-run`, `--json`, `--verbose`) consistent across `scripts/lemma-cli/`.

**Human-gate discipline:** Task 3.5 Step 5 explicitly marks tag execution as Tim-only (never AI unattended). Task 3.6-3.9 verification only, safe for AI to run.

**File paths verified:** All source paths (Vault WITP) exist per pre-plan grep; target repos per Tasks 1.9/1.10.

---

**Plan complete.** Follow-up plans to write after Phase 3 pilot succeeds:
- `2026-XX-XX-lemma-phase-4-bulk-migration-and-cutover.md` (bulk 13 studies + production domain cutover)
- `2026-XX-XX-lemma-phase-5-scarlight-retooling.md`
- `2026-XX-XX-lemma-phase-6-mirrors-pubpub-wayback.md`
- `2026-XX-XX-lemma-phase-7-distribution.md`
- `2026-XX-XX-lemma-phase-8-9-cleanup.md`
