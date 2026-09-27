#!/usr/bin/env node
// scripts/critic-inbox.mjs — blind A/B inbox for the gauntlet critics.
//
//   create   node scripts/critic-inbox.mjs --wave 01 --piece H03 --vp desktop --ours <ours.png> --ref <ref.png>
//            → workbench/critic-inbox/<uuid>/{A.png,B.png,key.json}; prints the uuid and the two paths, never the mapping
//   record   node scripts/critic-inbox.mjs --record <uuid> --critic c-7f3a [--round 2] \
//                --verdict "VERDICT: A | GAP: ... | PIECE: H03 | VP: desktop | CONF: high"
//            → appends one line to workbench/verdicts.jsonl (A/B mapped back to ours|ref via key.json)
//   status   node scripts/critic-inbox.mjs --status [--piece H03]
//            → won / stalled / open per piece (rule below)
//
// won:     at every viewport that has verdicts, the last two verdicts are "ours", from two different critics,
//          with opposite A/B orders.
// stalled: at some viewport the last three gap sentences are near-identical (normalised word-set Jaccard ≥ .7).
// open:    everything else — shows the latest gap.
//
// progress.mjs imports readVerdicts() and pieceStatus() from here so the rule lives in one place.

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync } from 'node:fs';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const INBOX_DIR = join(ROOT, 'workbench', 'critic-inbox');
export const VERDICTS_FILE = join(ROOT, 'workbench', 'verdicts.jsonl');

// ---------------------------------------------------------------- cli
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { args._.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq > 0) { args[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { args[k] = next; i++; } else args[k] = true;
  }
  return args;
}

function help() {
  console.log(`critic-inbox.mjs — blind A/B inbox

create a pair for a critic (coin flip decides which side is ours):
  node scripts/critic-inbox.mjs --wave 01 --piece H03 --vp desktop --ours <path.png> --ref <path.png>

record a critic's verdict line:
  node scripts/critic-inbox.mjs --record <uuid> --critic <id> [--round <n>] \\
      --verdict "VERDICT: A | GAP: <one sentence> | PIECE: H03 | VP: desktop | CONF: high"
  VERDICT may be A, B, or neither/tie/none (recorded as "unjudged"). --round defaults to the next round for that piece+vp.

status table:
  node scripts/critic-inbox.mjs --status [--piece H03]

files: workbench/critic-inbox/<uuid>/{A.png,B.png,key.json}, workbench/verdicts.jsonl`);
}

const abs = (p) => (isAbsolute(p) ? p : resolve(process.cwd(), p));
const rel = (p) => { const r = relative(ROOT, p); return r.startsWith('..') ? p : r; };

// ---------------------------------------------------------------- verdict parsing
export function parseVerdictLine(line) {
  const text = String(line || '').replace(/\r?\n/g, ' ').trim();
  const fields = {};
  // split on pipes, then KEY : value (tolerant of spacing and case)
  for (const part of text.split('|')) {
    const m = part.match(/^\s*([A-Za-z]+)\s*[:=]\s*(.*?)\s*$/);
    if (m) fields[m[1].toUpperCase()] = m[2].trim();
  }
  // also accept the whole line without pipes: "VERDICT: A GAP: ... PIECE: H03 VP: desktop CONF: high"
  if (!fields.VERDICT) {
    const re = /(VERDICT|GAP|PIECE|VP|CONF)\s*[:=]\s*(.*?)(?=\s+(?:VERDICT|GAP|PIECE|VP|CONF)\s*[:=]|$)/gi;
    let m;
    while ((m = re.exec(text))) fields[m[1].toUpperCase()] = m[2].trim();
  }
  if (!fields.VERDICT) return null;
  const v = fields.VERDICT.replace(/[^A-Za-z]/g, '').toUpperCase();
  let side;
  if (v === 'A' || v === 'B') side = v;
  else if (/^(NEITHER|TIE|NONE|UNJUDGED|ABSTAIN|SKIP|EQUAL)$/.test(v)) side = null;
  else return null;
  return {
    side,
    gap: (fields.GAP || '').replace(/\s+/g, ' ').trim(),
    piece: (fields.PIECE || '').toUpperCase() || null,
    vp: (fields.VP || '').toLowerCase() || null,
    conf: (fields.CONF || '').toLowerCase() || null,
  };
}

// ---------------------------------------------------------------- verdict store
export function readVerdicts(file = VERDICTS_FILE) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => { try { return JSON.parse(l); } catch { console.warn(`verdicts.jsonl line ${i + 1}: not JSON, skipped`); return null; } })
    .filter(Boolean);
}

const STOP = new Set('the a an is are was were be been and or of to in on at it its this that these those with for as by from than then there here very just still also'.split(' '));
const normWords = (s) =>
  new Set(String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)));
export function jaccard(a, b) {
  const A = normWords(a), B = normWords(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** status for one piece given all verdict rows (any order; sorted by ts inside) */
export function pieceStatus(rows) {
  const sorted = [...rows].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  if (!sorted.length) return { status: 'unjudged', gap: '', vps: {}, rounds: 0, last: null };
  const byVp = {};
  for (const r of sorted) (byVp[r.vp || '?'] ||= []).push(r);
  const vps = {};
  let allWon = true;
  let anyStalled = false;
  for (const [vp, list] of Object.entries(byVp)) {
    const last2 = list.slice(-2);
    const won =
      last2.length === 2 &&
      last2.every((r) => r.verdict === 'ours') &&
      last2[0].critic !== last2[1].critic &&
      last2[0].order !== last2[1].order;
    const last3 = list.slice(-3).map((r) => r.gap || '');
    const stalled =
      last3.length === 3 &&
      jaccard(last3[0], last3[1]) >= 0.7 &&
      jaccard(last3[1], last3[2]) >= 0.7 &&
      jaccard(last3[0], last3[2]) >= 0.7;
    vps[vp] = { won, stalled, rounds: list.length, last: list[list.length - 1] };
    if (!won) allWon = false;
    if (stalled && !won) anyStalled = true;
  }
  const last = sorted[sorted.length - 1];
  const status = allWon ? 'won' : anyStalled ? 'stalled' : 'open';
  return { status, gap: last.gap || '', vps, rounds: sorted.length, last };
}

export function allStatuses(rows) {
  const byPiece = {};
  for (const r of rows) (byPiece[r.piece || '?'] ||= []).push(r);
  const out = {};
  for (const [piece, list] of Object.entries(byPiece)) out[piece] = pieceStatus(list);
  return out;
}

// ---------------------------------------------------------------- commands
function create(args) {
  const missing = ['wave', 'piece', 'vp', 'ours', 'ref'].filter((k) => !args[k] || args[k] === true);
  if (missing.length) { console.error(`missing: ${missing.map((m) => '--' + m).join(' ')}`); help(); return 2; }
  const oursPath = abs(args.ours), refPath = abs(args.ref);
  const bad = [['--ours', oursPath], ['--ref', refPath]].filter(([, p]) => !existsSync(p));
  if (bad.length) {
    for (const [k, p] of bad) console.error(`${k} not found: ${p}`);
    console.error('nothing created — shoot the missing side first (scripts/shoot.mjs) or check the refs/ path');
    return 1;
  }
  const uuid = randomUUID();
  const dir = join(INBOX_DIR, uuid);
  mkdirSync(dir, { recursive: true });
  const oursIsA = Math.random() < 0.5;
  copyFileSync(oursIsA ? oursPath : refPath, join(dir, 'A.png'));
  copyFileSync(oursIsA ? refPath : oursPath, join(dir, 'B.png'));
  const key = {
    uuid, piece: String(args.piece).toUpperCase(), wave: String(args.wave), vp: String(args.vp).toLowerCase(),
    ours: oursIsA ? 'A' : 'B', oursPath: rel(oursPath), refPath: rel(refPath), createdAt: new Date().toISOString(),
  };
  writeFileSync(join(dir, 'key.json'), JSON.stringify(key, null, 2) + '\n');
  console.log(uuid);
  console.log(rel(join(dir, 'A.png')));
  console.log(rel(join(dir, 'B.png')));
  return 0;
}

function record(args) {
  const uuid = args.record;
  if (!uuid || uuid === true) { console.error('--record needs the inbox uuid'); return 2; }
  const keyFile = join(INBOX_DIR, uuid, 'key.json');
  if (!existsSync(keyFile)) { console.error(`no inbox ${uuid} (expected ${rel(keyFile)})`); return 1; }
  const key = JSON.parse(readFileSync(keyFile, 'utf8'));
  if (!args.critic || args.critic === true) { console.error('--critic <id> is required (the won rule needs two different critics)'); return 2; }
  if (!args.verdict || args.verdict === true) { console.error('--verdict "<line>" is required'); return 2; }
  const parsed = parseVerdictLine(args.verdict);
  if (!parsed) {
    console.error(`could not parse the verdict line: ${JSON.stringify(args.verdict)}`);
    console.error('expected: VERDICT: A|B|neither | GAP: <sentence> | PIECE: H03 | VP: desktop | CONF: high|medium|low');
    return 1;
  }
  if (parsed.piece && parsed.piece !== key.piece) console.warn(`warning: verdict says PIECE ${parsed.piece}, inbox ${uuid} is ${key.piece} — recording as ${key.piece}`);
  if (parsed.vp && parsed.vp !== key.vp) console.warn(`warning: verdict says VP ${parsed.vp}, inbox ${uuid} is ${key.vp} — recording as ${key.vp}`);
  const existing = readVerdicts();
  let round = args.round && args.round !== true ? Number(args.round) : NaN;
  if (!Number.isFinite(round)) round = existing.filter((r) => r.piece === key.piece && r.vp === key.vp).length + 1;
  const verdict = parsed.side === null ? 'unjudged' : parsed.side === key.ours ? 'ours' : 'ref';
  const row = {
    ts: new Date().toISOString(),
    piece: key.piece, wave: key.wave, round, vp: key.vp, critic: String(args.critic),
    order: `ours=${key.ours}`, verdict, gap: parsed.gap, conf: parsed.conf,
    ref: key.refPath, ours: key.oursPath, inbox: uuid,
  };
  mkdirSync(dirname(VERDICTS_FILE), { recursive: true });
  appendFileSync(VERDICTS_FILE, JSON.stringify(row) + '\n');
  console.log(`${row.piece} ${row.vp} r${round} ${row.critic}: ${verdict.toUpperCase()}${row.gap ? ' — ' + row.gap : ''}`);
  return 0;
}

function status(args) {
  const rows = readVerdicts();
  if (!rows.length) { console.log('no verdicts yet (workbench/verdicts.jsonl is empty)'); return 0; }
  const statuses = allStatuses(rows);
  const pieces = Object.keys(statuses)
    .filter((p) => !args.piece || args.piece === true || p === String(args.piece).toUpperCase())
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!pieces.length) { console.log(`no verdicts for ${args.piece}`); return 0; }
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const cols = ['piece', 'status', 'viewports', 'rounds', 'last', 'gap'];
  const lines = pieces.map((p) => {
    const s = statuses[p];
    const vps = Object.entries(s.vps).map(([vp, v]) => `${vp}:${v.won ? 'won' : v.stalled ? 'stalled' : 'open'}(${v.rounds})`).join(' ');
    const last = s.last ? `${s.last.verdict.toUpperCase()} by ${s.last.critic} ${s.last.order}` : '';
    return [p, s.status, vps, String(s.rounds), last, cut(s.status === 'won' ? '' : s.gap, 70)];
  });
  const w = cols.map((c, i) => Math.max(c.length, ...lines.map((l) => l[i].length)));
  const fmt = (l) => l.map((c, i) => c.padEnd(w[i])).join('  ').trimEnd();
  console.log(fmt(cols));
  console.log(w.map((n) => '-'.repeat(n)).join('  '));
  for (const l of lines) console.log(fmt(l));
  const tally = { won: 0, stalled: 0, open: 0 };
  for (const p of pieces) tally[statuses[p].status]++;
  console.log(`\n${pieces.length} pieces judged · won ${tally.won} · stalled ${tally.stalled} · open ${tally.open}`);
  return 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { help(); return 0; }
  if (args.record) return record(args);
  if (args.status) return status(args);
  if (args.ours || args.ref || args.piece) return create(args);
  help();
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main());
}
