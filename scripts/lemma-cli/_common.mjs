// Shared helpers for scripts/lemma-cli/*.mjs — §21A script contract.
//
// Every lemma-cli script accepts:
//   --check     validate state only; no mutation; exit 0=ok, 1=drift, 2=usage
//   --dry-run   preview mutation without applying; exit 0=would-succeed, 1=would-fail, 2=usage
//   --verbose   human-readable extra output
//   --json      emit machine-readable JSON (default when stdout is not a TTY)
//   --local     runtime_context=local (default: ci)
//   -h, --help  usage
//
// Exit codes (uniform):
//   0  ok (or would-be-ok in --dry-run)
//   1  fail / drift / would-fail
//   2  usage error / bad arguments

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, '..', '..');

export function parseArgs(argv) {
  const args = { flags: new Set(), values: new Map(), positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--') && !a.startsWith('-')) {
      args.positional.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq !== -1) {
      args.values.set(a.slice(2, eq), a.slice(eq + 1));
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
      args.values.set(a.replace(/^-+/, ''), argv[i + 1]);
      i++;
    } else {
      args.flags.add(a.replace(/^-+/, ''));
    }
  }
  return args;
}

export function isJsonMode(args) {
  return args.flags.has('json') || !process.stdout.isTTY;
}

// js-yaml v5.x is pure ESM with named exports; DEFAULT_SCHEMA is safe (no !!js/function).
// Per plan Global Constraint (line 30) we do NOT pass a custom schema option, so
// this uses the safe default.
export function loadPhaseState() {
  const p = path.join(REPO_ROOT, 'data', 'phase-state.yaml');
  return yamlLoad(fs.readFileSync(p, 'utf8'));
}

export function loadHealthChecks() {
  const p = path.join(REPO_ROOT, 'data', 'health-checks.yaml');
  return yamlLoad(fs.readFileSync(p, 'utf8'));
}

export function loadFailureModes() {
  const p = path.join(REPO_ROOT, 'data', 'failure-modes.yaml');
  return yamlLoad(fs.readFileSync(p, 'utf8'));
}

export function effectiveSeverity(contract, phaseState) {
  let severity = contract.severity ?? 'pending';
  if (contract.phase_gates && contract.phase_gates[phaseState.current_phase]) {
    severity = contract.phase_gates[phaseState.current_phase];
  }
  return severity;
}

export function worstStatus(results) {
  if (results.some(r => r.status === 'fail')) return 'fail';
  if (results.some(r => r.status === 'warn')) return 'warn';
  if (results.some(r => r.status === 'pending')) return 'pending';
  return 'clean';
}

// A finding is actionable when it carries a next-step string per §21A.
export function actionable(next_step, ...rest) {
  return { next_step, ...Object.assign({}, ...rest) };
}
