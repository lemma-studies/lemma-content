---
title: 'السلوك المسيحي'
description: 'Christian Behaviour (Arabic edition) — Arabic edition, under the Lemma Press imprint.'
sidebar:
  order: 0
head:
  - tag: meta
    attrs:
      name: robots
      content: "noindex, follow"
banner:
  content: |
    <strong>Coming</strong> — Arabic edition of John Bunyan's <em>Christian Behaviour</em> (1663). CC-BY 4.0. See the <a href="https://github.com/lemma-studies/lemma-content/blob/master/docs/adr/2026-08-12-translation-studies.md">translation-studies ADR</a> for the design.
---

# السلوك المسيحي

*Christian Behaviour (Arabic edition)*

**Language:** Arabic
**Source:** John Bunyan, *Christian Behaviour* (London, 1663) — EEBO-TCP CC0 transcript A30128.0001.001

The Arabic edition is sourced from the modern-English pilot (`bunyan-christian-behaviour-en`). Chapter 1 draft (v0.1) exists in the FDT working repo; further chapters follow the pipeline in `~/.claude/playbooks/playbook-translation-study.md`. Ships after native-Arabic-reader review circle feedback per ADR §10 sequencing.

## Sibling editions

- [Christian Behaviour — English](/bunyan-christian-behaviour-en/)
- [התנהגות נוצרית — Hebrew](/bunyan-christian-behaviour-he/)
- [رفتار مسیحی — Farsi (Persian)](/bunyan-christian-behaviour-fa/)
- [基督徒行為 — Chinese (Simplified)](/bunyan-christian-behaviour-zh-hans/)
- [基督徒行為 — Chinese (Traditional)](/bunyan-christian-behaviour-zh-hant/)

## About the pilot title choice

Bunyan's *Christian Behaviour* was surfaced as the strongest MVP fit by the 2026-08-12 widened audit: 4-way absent in Hebrew, Arabic, Farsi, and Chinese; subtitle explicitly frames household relations; short (~40pp); Bunyan's authorial equity via *Pilgrim's Progress* carries across all target languages; and the 1663 EEBO-TCP transcript is CC0 (no OCR pass needed on 17th-c. type). See ADR §10 for full rationale.
