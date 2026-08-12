#!/usr/bin/env node
// scripts/export-annotations.mjs
//
// Nightly export from hypothes.is → annotations/<slug>.jsonl (public) OR
// ../lemma-workroom/annotations/<slug>.jsonl (editorial group).
//
// Per §21A contract:
//   --group <id>   hypothes.is group ID (required); pick from credentials
//   --target public|editorial   public → this repo's annotations/;
//                               editorial → ../lemma-workroom/annotations/ (workroom-side)
//   --since <ISO> incremental cursor (default: read from annotations/.last-since or 1970)
//   --check       validate token + group access, no write
//   --dry-run     preview without writing
//   --json        machine-readable output (default when non-TTY)
//   --verbose
//
// Env:
//   HYPOTHESIS_TOKEN   Bearer token
//
// Exit: 0 = clean sync, 1 = API fail, 2 = usage.
//
// PHASE 2b SCAFFOLD: contract layer + arg parsing exercised; live API call
// is a TODO until Task 2b.5 (hypothes.is group creation) + secret set.

import { parseArgs, isJsonMode } from './lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const group = args.values.get('group');
const target = args.values.get('target') ?? 'public';
const jsonMode = isJsonMode(args);
const check = args.flags.has('check');

if (!group && !check) {
  console.error('usage: export-annotations --group <id> --target public|editorial [--since ISO] [--check] [--dry-run] [--json]');
  process.exit(2);
}

const token = process.env.HYPOTHESIS_TOKEN;
if (!token) {
  const msg = 'HYPOTHESIS_TOKEN not set';
  if (jsonMode) console.log(JSON.stringify({ status: 'skipped', reason: msg }));
  else console.error(msg);
  process.exit(check ? 1 : 0);  // skip is OK unless we're in --check mode
}

// TODO(Task 2b.5): hit https://hypothes.is/api/search?group=<id>&sort=updated&search_after=<since>
// pagination loop; write JSONL rows: {id, uri, target, text, user, created, updated, group, tags}
// then update annotations/.last-since with the max updated timestamp.

const report = {
  timestamp: new Date().toISOString(),
  group,
  target,
  status: 'scaffold',
  synced: 0,
  next_step: 'implement hypothes.is API pagination after Task 2b.5 group creation',
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else console.log(`export-annotations group=${group} target=${target}: ${report.status}`);

process.exit(0);
