#!/usr/bin/env node
// scripts/export-feedback.mjs
//
// Nightly export from Gmail (Lemma-feedback label) → workroom repo
// feedback-inbox/<YYYY-MM-DD>.jsonl. Transport headers stripped per
// design §16 minimization (only From + Subject + Date + Message-ID +
// Body retained).
//
// Per §21A contract:
//   --since <ISO>   incremental cursor
//   --check         validate token + label existence, no write
//   --dry-run       preview without writing
//   --json          machine-readable (default when non-TTY)
//   --verbose
//
// Env:
//   GMAIL_ACCESS_TOKEN   OAuth access token with gmail.readonly scope
//   WORKROOM_PATH        path to lemma-workroom clone (defaults to sibling ../lemma-workroom)
//
// Exit: 0 = clean sync, 1 = API/write fail, 2 = usage.
//
// PHASE 2b SCAFFOLD: contract + arg parsing exercised; live Gmail API
// call TODO until Task 2b.4 pipeline (Zoho alias → Gmail forward →
// label) is verified end-to-end.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, isJsonMode } from './lemma-cli/_common.mjs';

const args = parseArgs(process.argv.slice(2));
const jsonMode = isJsonMode(args);
const check = args.flags.has('check');
const workroomPath = process.env.WORKROOM_PATH ?? path.resolve(process.cwd(), '..', 'lemma-workroom');

const token = process.env.GMAIL_ACCESS_TOKEN;
if (!token) {
  const msg = 'GMAIL_ACCESS_TOKEN not set';
  if (jsonMode) console.log(JSON.stringify({ status: 'skipped', reason: msg }));
  else console.error(msg);
  process.exit(check ? 1 : 0);
}

if (!fs.existsSync(workroomPath)) {
  const msg = `workroom not found at ${workroomPath}; set WORKROOM_PATH`;
  if (jsonMode) console.log(JSON.stringify({ status: 'skipped', reason: msg }));
  else console.error(msg);
  process.exit(check ? 1 : 0);
}

// TODO(Task 2b.4): messages.list with q="label:lemma-feedback newer_than:1d"
// For each: messages.get with format=full. Strip everything except:
//   - internalDate, id (as message_id)
//   - headers: From, Subject, Date, Message-ID
//   - body: parts.body.data decoded from base64url, HTML→text
// Append to workroom feedback-inbox/YYYY-MM-DD.jsonl (one file per day for
// easier retention-purge granularity per design §16).

const today = new Date().toISOString().slice(0, 10);
const targetFile = path.join(workroomPath, 'feedback-inbox', `${today}.jsonl`);

const report = {
  timestamp: new Date().toISOString(),
  status: 'scaffold',
  target: targetFile,
  synced: 0,
  workroom: workroomPath,
  next_step: 'implement Gmail messages.list/get after Task 2b.4 intake verified',
};

if (jsonMode) console.log(JSON.stringify(report, null, 2));
else console.log(`export-feedback: ${report.status} → ${targetFile}`);

process.exit(0);
