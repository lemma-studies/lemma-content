#!/usr/bin/env node
// scripts/export-comments.mjs
//
// Nightly export from GitHub Discussions (Giscus source of truth) →
// comments/<slug>.jsonl (public export). Slug bucketing from
// discussion.mapping (Giscus pathname mapping).
//
// Per §21A contract:
//   --since <ISO>   incremental cursor
//   --check         validate token + Discussions API access, no write
//   --dry-run       preview without writing
//   --json          machine-readable (default when non-TTY)
//   --verbose
//
// Env:
//   GH_TOKEN or GITHUB_TOKEN   Bearer with `discussions:read` scope
//
// Exit: 0 = clean sync, 1 = API fail, 2 = usage.
//
// PHASE 2b SCAFFOLD: contract + arg parsing exercised; live GraphQL call
// TODO until Discussions is enabled on lemma-studies/lemma-content (per
// site/astro.config.mjs Giscus TODO) and giscus repo/category IDs
// re-captured.

import { parseArgs, isJsonMode } from './lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const check = args.flags.has('check');

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
if (!token) {
  const msg = 'GH_TOKEN / GITHUB_TOKEN not set';
  if (jsonMode) console.log(JSON.stringify({ status: 'skipped', reason: msg }));
  else console.error(msg);
  process.exit(check ? 1 : 0);
}

// TODO: GraphQL query on repository(owner:"lemma-studies", name:"lemma-content").discussions
// paginate with `first: 100, after: <cursor>, orderBy: {field: UPDATED_AT, direction: DESC}`
// bucket by discussion.title → slug (Giscus uses pathname mapping so title has form /<slug>/<chapter>/)
// emit JSONL {id, url, author, body, created_at, updated_at, category, upvotes, replies_count}

const report = {
  timestamp: new Date().toISOString(),
  status: 'scaffold',
  synced: 0,
  next_step: 'implement Discussions GraphQL export after Giscus re-attach in astro.config.mjs',
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else console.log(`export-comments: ${report.status}`);

process.exit(0);
