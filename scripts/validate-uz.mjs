#!/usr/bin/env node
// scripts/validate-uz.mjs — lint the Uzbek (Latin) copy for the wrong apostrophes, em dashes and emoji.
//
//   node scripts/validate-uz.mjs            # scan src/content/*.uz.ts + the uz: {...} block of src/content/chrome.ts
//   node scripts/validate-uz.mjs --fix      # rewrite o'→oʻ g'→gʻ, other in-word '/’ → ʼ, — → -, then re-scan
//   node scripts/validate-uz.mjs --files a.ts,b.ts [--all]   # scan these files instead (--all: whole file, not just uz:{})
//
// Rules (only inside string literals — keys, code and comments are not touched):
//   o' g' O' G' (straight ', U+2019 ’ or U+2018 ‘) after o/g      → must be ʻ  U+02BB  (oʻzbek, gʻoya)
//   ' or ’ inside any other word (letter on both sides)  → must be ʼ  U+02BC  (taʼlim, maʼno)
//   — U+2014                                             → use -
//   emoji U+1F300–1FAFF, U+2600–27BF                     → none in copy (reported, not auto-fixed)
// Exit 1 on findings, 0 when clean.

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src', 'content');

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
  console.log(`validate-uz.mjs — Uzbek copy lint

  node scripts/validate-uz.mjs [--fix] [--files a.ts,b.ts] [--all]

  default files: src/content/*.uz.ts (whole file) and src/content/chrome.ts (only the uz: { … } block)
  --fix    rewrite o'/g' → oʻ/gʻ, other in-word '/’ → ʼ, — → -, then re-scan (emoji are only reported)
  --files  comma-separated list instead of the defaults (relative to the cwd)
  --all    with --files: scan the whole file even if it is named chrome.ts
  exit 1 when findings remain`);
}

// ---------------------------------------------------------------- regions to scan
/** [start, end) offsets of the `uz: {` … matching `}` block(s) in a chrome.ts-style file */
function uzBlocks(src) {
  const blocks = [];
  const re = /\buz\s*[:=]\s*\{/g; // `uz: {` in a record, or `const uz = {`
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let i = open;
    let inStr = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) i = src.length; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; if (i < 1) i = src.length; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    blocks.push([m.index, i]);
    re.lastIndex = i;
  }
  return blocks;
}

/** string literals in src[start,end): {start,end} of the *content* (delimiters excluded) */
function stringLiterals(src, start = 0, end = src.length) {
  const out = [];
  let i = start;
  while (i < end) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i); if (i < 0) break; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      const s = i + 1;
      let j = s;
      for (; j < end; j++) {
        const d = src[j];
        if (d === '\\') { j++; continue; }
        if (d === q) break;
        if (q !== '`' && d === '\n') break; // unterminated — bail at the line end
      }
      out.push({ start: s, end: j, quote: q });
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

// ---------------------------------------------------------------- rules
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const L = '\\p{L}';
const RULES = [
  { id: 'og-apostrophe', re: new RegExp(`(?<=[oOgG])\\\\?['’‘]`, 'gu'), msg: "' after o/g → ʻ (U+02BB)", fix: 'ʻ' },
  { id: 'in-word-apostrophe', re: new RegExp(`(?<=${L})(?<![oOgG])\\\\?['’‘](?=${L})`, 'gu'), msg: "in-word ' → ʼ (U+02BC)", fix: 'ʼ' },
  { id: 'em-dash', re: /—/gu, msg: '— (U+2014) → -', fix: '-' },
  { id: 'emoji', re: new RegExp(EMOJI.source, 'gu'), msg: 'emoji in copy', fix: null },
];

function lineCol(src, offset) {
  let line = 1, last = 0;
  for (let i = 0; i < offset; i++) if (src.charCodeAt(i) === 10) { line++; last = i + 1; }
  return { line, col: offset - last + 1 };
}

function scanFile(file, src, { whole }) {
  const regions = whole ? [[0, src.length]] : uzBlocks(src);
  const findings = [];
  for (const [a, b] of regions) {
    for (const lit of stringLiterals(src, a, b)) {
      const text = src.slice(lit.start, lit.end);
      for (const rule of RULES) {
        rule.re.lastIndex = 0;
        let m;
        while ((m = rule.re.exec(text))) {
          const off = lit.start + m.index;
          const { line, col } = lineCol(src, off);
          const ctxA = Math.max(0, m.index - 18), ctxB = Math.min(text.length, m.index + m[0].length + 18);
          findings.push({ file, line, col, rule: rule.id, msg: rule.msg, context: text.slice(ctxA, ctxB).replace(/\s+/g, ' ') });
          if (m[0].length === 0) rule.re.lastIndex++;
        }
      }
    }
  }
  return findings;
}

function fixFile(src, { whole }) {
  const regions = whole ? [[0, src.length]] : uzBlocks(src);
  const edits = [];
  for (const [a, b] of regions) for (const lit of stringLiterals(src, a, b)) {
    const text = src.slice(lit.start, lit.end);
    let out = text;
    for (const rule of RULES) if (rule.fix !== null) out = out.replace(rule.re, rule.fix);
    if (out !== text) edits.push({ start: lit.start, end: lit.end, out });
  }
  if (!edits.length) return src;
  let res = '';
  let cur = 0;
  for (const e of edits) { res += src.slice(cur, e.start) + e.out; cur = e.end; }
  return res + src.slice(cur);
}

// ---------------------------------------------------------------- main
function defaultFiles() {
  if (!existsSync(CONTENT_DIR)) return [];
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.uz.ts')).map((f) => ({ file: join(CONTENT_DIR, f), whole: true }));
  const chrome = join(CONTENT_DIR, 'chrome.ts');
  if (existsSync(chrome)) files.push({ file: chrome, whole: false });
  return files;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { help(); return 0; }
  let targets;
  if (args.files && args.files !== true) {
    targets = String(args.files).split(',').map((s) => s.trim()).filter(Boolean).map((f) => {
      const file = isAbsolute(f) ? f : resolve(process.cwd(), f);
      return { file, whole: args.all ? true : !/(^|\/)chrome\.ts$/.test(file) };
    });
    const missing = targets.filter((t) => !existsSync(t.file));
    if (missing.length) { for (const t of missing) console.error(`not found: ${t.file}`); return 2; }
  } else targets = defaultFiles();
  if (!targets.length) { console.log('nothing to scan (no src/content/*.uz.ts or src/content/chrome.ts yet)'); return 0; }

  const show = (p) => { const r = relative(ROOT, p); return r.startsWith('..') ? p : r; };
  const run = () => {
    const all = [];
    for (const t of targets) all.push(...scanFile(t.file, readFileSync(t.file, 'utf8'), t));
    return all;
  };

  let findings = run();
  if (args.fix && findings.length) {
    let changed = 0;
    for (const t of targets) {
      const src = readFileSync(t.file, 'utf8');
      const out = fixFile(src, t);
      if (out !== src) { writeFileSync(t.file, out); changed++; console.log(`fixed ${show(t.file)}`); }
    }
    console.log(`--fix rewrote ${changed} file(s); re-scanning`);
    findings = run();
  }

  if (!findings.length) {
    console.log(`clean: ${targets.map((t) => show(t.file) + (t.whole ? '' : ' (uz block)')).join(', ')}`);
    return 0;
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col);
  for (const f of findings) console.log(`${show(f.file)}:${f.line}:${f.col}  ${f.msg}  …${f.context}…`);
  const byRule = {};
  for (const f of findings) byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  console.log(`\n${findings.length} finding(s): ${Object.entries(byRule).map(([k, v]) => `${k} ${v}`).join(', ')}${args.fix ? '' : '  (run with --fix to rewrite apostrophes and dashes)'}`);
  return 1;
}

process.exit(main());
