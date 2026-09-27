#!/usr/bin/env node
// scripts/progress.mjs — one self-contained dashboard of the gauntlet: workbench/progress.html
//
//   node scripts/progress.mjs [--out workbench/progress.html] [--no-history] [--thumb 480]
//
// Reads  workbench/verdicts.jsonl, workbench/shots/*/*/manifest.json, refs/MANIFEST.json (if present),
//        workbench/assets.jsonl, workbench/blocked.json, workbench/pieces.json (optional piece→section overrides)
// Writes workbench/progress.html — dark, portable, thumbnails inlined as 480 px webp. Target < 8 MB: when larger the
//        history thumbnails are dropped first, then the thumbnail width shrinks.
// The won/stalled/open rule comes from critic-inbox.mjs so both tools always agree.

import sharp from 'sharp';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVerdicts, allStatuses } from './critic-inbox.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WB = join(ROOT, 'workbench');
const REFS = join(ROOT, 'refs');
const SIZE_TARGET = 8 * 1024 * 1024;

// ---------------------------------------------------------------- piece table (override/extend in workbench/pieces.json)
// { "IT03": { "page": "it", "section": "offer", "ref": "section_platform-grid", "title": "Offer grid" } }
const GROUPS = [
  { prefix: 'IT', page: 'it', label: 'IT' },
  { prefix: 'AC', page: 'academy', label: 'Academy' },
  { prefix: 'PR', page: 'praktikum', label: 'Praktikum' },
  { prefix: 'CO', page: 'company', label: 'Company' },
  { prefix: 'CT', page: 'contact', label: 'Contact' },
  { prefix: 'K', page: 'home', label: 'Kott (hero)' },
  { prefix: 'L', page: 'home', label: 'Lircle' },
  { prefix: 'G', page: 'home', label: 'GM Studios' },
  { prefix: 'S', page: 'home', label: 'System sections' },
  { prefix: 'H', page: 'home', label: 'Home (legacy)' },
  { prefix: 'M', page: 'home', label: 'Motion' },
  { prefix: 'X', page: 'home', label: 'Cross-cutting' },
];
const PIECES = {
  // wave 07: the kott / lircle / GM bar (refs/k3). Older H/M ids stay readable in verdicts.jsonl.
  K00: { motion: 'preloader', ref: 'k3/kott.loader.strip.png', title: 'Preloader (kott)' },
  K01: { section: 'hero', capture: 'hero@00', ref: 'k3/kott.desktop.hero@00.png', title: 'Hero at rest (kott)' },
  K02: { motion: 'hero', ref: 'k3/kott.desktop.hero.strip.png', title: 'Hero scroll (kott)' },
  K03: { section: 'nav', ref: 'k3/kott.desktop.top.png', title: 'Nav (kott)' },
  S01: { section: 'statement', ref: 'k3/kott.desktop.work.png', title: 'Statement (kott work head)' },
  L01: { section: 'offer', ref: 'k3/lircle.desktop.services.png', title: 'Offer list (lircle)' },
  L02: { section: 'offer', capture: 'offer.hover', ref: 'k3/lircle.desktop.services.hover.png', title: 'Offer hover (lircle)' },
  S02: { section: 'marquee', ref: 'k3/lircle.desktop.collab.png', title: 'Marquee (lircle collaborators)', note: 'owner-locked 2026-09-22: stays the moving logo marquee; no further rounds' },
  S03: { section: 'stats', ref: 'k3/gm.desktop.stats.png', title: 'Stats (GM band)' },
  G01: { section: 'team', ref: 'k3/gm.desktop.clients.png', title: 'Team fan (GM)' },
  G02: { motion: 'team', ref: 'k3/gm.desktop.clients.strip.png', title: 'Team fan scroll (GM)' },
  S04: { section: 'testimonials', ref: 'k3/lircle.desktop.about.png', title: 'Testimonials (lircle about)' },
  L03: { section: 'footer', ref: 'k3/lircle.desktop.footer.png', title: 'Footer (lircle)' },
  X01: { section: 'full', ref: 'k3/kott.desktop.full.png', title: 'Full page (smoothing)' },
  H01: { section: 'nav', ref: 'top', title: 'Nav', legacy: true },
  H02: { section: 'hero', ref: 'section_hero', title: 'Hero', legacy: true },
  H03: { section: 'statement', ref: 'section_statement', title: 'Statement', legacy: true },
  H04: { section: 'specs', ref: 'section_why', title: 'Specs', legacy: true },
  H05: { section: 'testimonials', ref: 'section_tst', title: 'Testimonials', legacy: true },
  H06: { section: 'marquee', ref: 'section_tst', title: 'Marquee', legacy: true },
  H07: { section: 'capabilities', ref: 'section_cpb', title: 'Capabilities', legacy: true },
  H08: { section: 'video-band', ref: 'section_performance', title: 'Video band', legacy: true },
  H09: { section: 'stats', ref: 'section_stat', title: 'Stats', legacy: true },
  H10: { section: 'clients', ref: null, title: 'Clients cylinder', legacy: true },
  H11: { section: 'footer', ref: 'footer', title: 'Footer', legacy: true },
  M01: { motion: 'preloader', title: 'Preloader', legacy: true },
  M02: { motion: 'hero', title: 'Hero reveal', legacy: true },
  M03: { motion: 'statement', title: 'Statement reveal', legacy: true },
  M04: { motion: 'clients', title: 'Clients cylinder', legacy: true },
};

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

// ---------------------------------------------------------------- inputs
const readJson = (f, dflt) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : dflt; } catch { console.warn(`could not parse ${relative(ROOT, f)}`); return dflt; } };
const readJsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
const absPath = (p) => (isAbsolute(p) ? p : join(ROOT, p));
const waveSort = (a, b) => b.localeCompare(a, undefined, { numeric: true }); // newest first

function loadShots() {
  const dir = join(WB, 'shots');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const wave of readdirSync(dir).filter((w) => !w.startsWith('.')).sort(waveSort)) {
    for (const target of ['ours', 'ref']) {
      const m = readJson(join(dir, wave, target, 'manifest.json'), null);
      if (m && Array.isArray(m.files)) out.push({ wave, target, files: m.files, capturedAt: m.capturedAt });
    }
  }
  return out;
}

/** refs/MANIFEST.json is written by another agent — accept the common shapes and look only for page/vp/section/path */
function loadRefsManifest() {
  const m = readJson(join(REFS, 'MANIFEST.json'), null);
  if (!m) return null;
  let entries = Array.isArray(m) ? m : m.files || m.entries || m.items || m.shots || null;
  if (!entries && typeof m === 'object') entries = Object.entries(m).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => ({ path: v.path || v.file || k, ...v }));
  if (!Array.isArray(entries)) entries = [];
  return { raw: m, entries };
}

// ---------------------------------------------------------------- piece resolution
function groupOf(id) {
  const up = String(id).toUpperCase();
  return GROUPS.find((g) => up.startsWith(g.prefix) && /^\d/.test(up.slice(g.prefix.length))) || GROUPS.find((g) => up.startsWith(g.prefix)) || null;
}
const pieceNum = (id) => parseInt(String(id).replace(/^[A-Z]+/i, ''), 10);

function resolvePiece(id, overrides, shots) {
  const g = groupOf(id);
  const base = { page: g?.page || 'home', section: null, ref: null, title: id, motion: null, note: '', group: g?.label || 'Other' };
  const def = { ...base, ...(PIECES[id] || {}), ...(overrides[id] || {}) };
  if (def.motion || def.section || def.ref) return def;
  // nth section of the page in document order (nav counts when it is a data-section), same for the ref
  const n = pieceNum(id);
  if (Number.isFinite(n)) {
    const ours = shots.find((s) => s.target === 'ours' && s.files.some((f) => f.page === def.page && f.order === n));
    const oursRow = ours?.files.find((f) => f.page === def.page && f.order === n);
    const ref = shots.find((s) => s.target === 'ref' && s.files.some((f) => f.page === def.page && f.order === n));
    const refRow = ref?.files.find((f) => f.page === def.page && f.order === n);
    def.section = oursRow?.capture || null;
    def.ref = refRow?.capture || null;
    if (def.section) def.title = `${def.section} (section ${n})`;
    if (!def.section) def.note = def.note || `no mapping yet — add "${id}" to workbench/pieces.json or shoot the ${def.page} page`;
  }
  return def;
}

// ---------------------------------------------------------------- shot lookup
function findOurs(shots, page, section, vp) {
  if (!section) return null;
  for (const s of shots.filter((s) => s.target === 'ours')) {
    const rows = s.files.filter((f) => f.page === page && f.viewport === vp && f.capture === section && f.ok && existsSync(absPath(f.path)));
    if (!rows.length) continue;
    const r = rows.find((f) => f.locale === 'uz') || rows[0];
    return { path: absPath(r.path), wave: s.wave, note: r.note };
  }
  return null;
}
function findRef(shots, refsManifest, page, refId, vp) {
  if (!refId) return null;
  for (const ext of ['png', 'webp', 'jpg']) {
    const p = join(REFS, 'blue', `${page}.${vp}.${refId}.${ext}`);
    if (existsSync(p)) return { path: p, wave: 'refs/blue' };
  }
  for (const e of refsManifest?.entries || []) {
    const ePage = e.page || e.slug, eVp = e.vp || e.viewport, eSec = e.section || e.capture || e.id;
    const p = e.path || e.file || e.blue;
    if (ePage === page && eVp === vp && eSec === refId && p && existsSync(absPath(p))) return { path: absPath(p), wave: 'refs/MANIFEST' };
  }
  for (const s of shots.filter((s) => s.target === 'ref')) {
    const r = s.files.find((f) => f.page === page && f.viewport === vp && f.capture === refId && f.ok && existsSync(absPath(f.path)));
    if (r) return { path: absPath(r.path), wave: s.wave, note: r.note };
  }
  return null;
}
function findMotion(shots, name) {
  for (const s of shots.filter((s) => s.target === 'ours')) {
    const p = join(WB, 'shots', s.wave, 'ours', 'motion', `${name}.strip.png`);
    if (existsSync(p)) return { path: p, wave: s.wave };
  }
  return null;
}
function findRefMotion(name) {
  for (const f of [`${name}.strip.png`, `${name}.png`, `${name}.strip.webp`]) {
    const p = join(REFS, 'motion', f);
    if (existsSync(p)) return { path: p, wave: 'refs/motion' };
  }
  return null;
}

// ---------------------------------------------------------------- thumbnails
const cache = new Map();
async function thumb(path, width) {
  if (!path) return null;
  const k = `${path}@${width}`;
  if (cache.has(k)) return cache.get(k);
  let uri = null;
  try {
    const buf = await sharp(path).resize({ width, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
    uri = `data:image/webp;base64,${buf.toString('base64')}`;
  } catch (e) { console.warn(`thumb failed for ${relative(ROOT, path)}: ${e.message}`); }
  cache.set(k, uri);
  return uri;
}

// ---------------------------------------------------------------- html
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chipLetter = (v) => (v === 'ours' ? 'O' : v === 'ref' ? 'R' : 'U');
const fmtTs = (ts) => (ts ? String(ts).replace('T', ' ').replace(/\.\d+Z$/, 'Z') : '');
const rel = (p) => (p ? relative(ROOT, p) : '');

function figure(label, img, meta, placeholder) {
  return `<figure><figcaption>${esc(label)}${meta ? ` <span class="meta">${esc(meta)}</span>` : ''}</figcaption>${
    img ? `<img src="${img}" alt="${esc(label)}" loading="lazy">` : `<div class="missing">${esc(placeholder)}</div>`}</figure>`;
}

async function buildHtml(data, { history, thumbW }) {
  const { verdicts, statuses, pieces, shots, credits, assets, blocked, latestWave, refsManifest } = data;
  const tally = { won: 0, open: 0, stalled: 0, unjudged: 0 };
  for (const p of pieces) tally[p.status]++;
  const stalled = pieces.filter((p) => p.status === 'stalled');
  const blockedList = [
    ...stalled.map((p) => ({ piece: p.id, note: `stalled — ${p.gap || 'same gap three rounds running'}` })),
    ...blocked.map((b) => ({ piece: b.piece, note: b.note })),
  ];

  const groups = [];
  for (const g of GROUPS) {
    const rows = pieces.filter((p) => p.group === g.label);
    if (!rows.length) continue;
    const cards = [];
    for (const p of rows) {
      const hist = verdicts.filter((v) => v.piece === p.id).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
      const chips = hist.map((v) => `<span class="v ${v.verdict}" title="r${v.round} ${esc(v.vp)} ${esc(v.critic)} ${esc(v.order)} conf ${esc(v.conf || '?')}">${chipLetter(v.verdict)}</span>`).join('');
      let pairs = '';
      if (p.motion) {
        const o = findMotion(shots, p.motion), r = findRefMotion(p.motion);
        const oi = await thumb(o?.path, 960), ri = await thumb(r?.path, 960);
        pairs = `<div class="pair strip">${figure('ref', ri, r?.wave, 'no reference filmstrip (refs/motion/' + p.motion + '.strip.png)')}${figure('ours', oi, o ? 'wave ' + o.wave : '', 'no filmstrip yet — node scripts/shoot.mjs --wave NN --target ours --motion')}</div>`;
      } else {
        for (const vp of ['desktop', 'mobile']) {
          const o = findOurs(shots, p.page, p.section, vp), r = findRef(shots, refsManifest, p.page, p.ref, vp);
          const oi = await thumb(o?.path, thumbW), ri = await thumb(r?.path, thumbW);
          pairs += `<div class="pair ${vp}">${figure('ref', ri, r?.wave, p.ref ? `no ref shot for ${p.page}.${vp}.${p.ref}` : 'no reference counterpart')}${figure('ours', oi, o ? 'wave ' + o.wave : '', p.section ? `no shot for ${p.page}.${vp}.${p.section}` : 'unmapped section')}</div>`;
        }
      }
      let histHtml = '';
      if (hist.length) {
        const items = [];
        for (const v of [...hist].reverse()) {
          const img = history && v.ours && existsSync(absPath(v.ours)) ? await thumb(absPath(v.ours), 240) : null;
          items.push(`<li><span class="v ${v.verdict}">${chipLetter(v.verdict)}</span><span class="hmeta">r${v.round} · ${esc(v.vp)} · ${esc(v.critic)} · ${esc(v.order)} · conf ${esc(v.conf || '?')} · ${esc(fmtTs(v.ts))}</span><span class="hgap">${esc(v.gap || '')}</span>${img ? `<img src="${img}" alt="">` : ''}</li>`);
        }
        histHtml = `<details><summary>history · ${hist.length} verdict${hist.length === 1 ? '' : 's'}</summary><ul class="hist">${items.join('')}</ul></details>`;
      }
      const vpBtns = p.motion ? '' : `<span class="vp"><button data-vp="desktop" class="on">desktop</button><button data-vp="mobile">mobile</button></span>`;
      cards.push(`<article class="piece" id="${esc(p.id)}" data-status="${p.status}" data-vp="desktop">
<header><span class="pid">${esc(p.id)}</span><span class="ptitle">${esc(p.title)}</span><span class="chip ${p.status}">${p.status}</span><span class="rounds">${p.rounds ? p.rounds + ' round' + (p.rounds === 1 ? '' : 's') : 'no rounds'}</span><span class="chips">${chips}</span>${vpBtns}</header>
${p.status !== 'won' && p.gap ? `<p class="gap">${esc(p.gap)}</p>` : ''}${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
${pairs}${histHtml}</article>`);
    }
    groups.push(`<section class="group"><h2>${esc(g.label)} <span class="dim">${esc(g.prefix)}*</span></h2>${cards.join('\n')}</section>`);
  }

  const assetRows = assets.map((a) => `<tr><td>${esc(fmtTs(a.ts))}</td><td>${esc(a.id)}</td><td>${esc(a.variant ?? '')}</td><td>${esc(a.model ?? '')}</td><td>${a.file ? `<span class="${existsSync(absPath(a.file)) ? '' : 'gone'}">${esc(a.file)}</span>` : '<span class="gone">no file</span>'}</td><td>${esc(a.creditsAfter ?? a.creditsBefore ?? '')}</td><td>${esc(a.note ?? '')}</td></tr>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>head.uz gauntlet · wave ${esc(latestWave || '—')}</title>
<style>
:root{color-scheme:dark;--bg:#0b0c0d;--card:#131517;--line:#24272b;--fg:#e6e7e9;--dim:#8a8f96;--won:#2fbf71;--open:#6b8cff;--stalled:#f0a020;--unj:#5e6266;--ref:#c96b3a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:24px 28px 60px}
a{color:inherit}h1{font-size:20px;font-weight:600;margin:0 0 6px}h2{font-size:15px;font-weight:600;margin:36px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.dim{color:var(--dim);font-weight:400}.top{display:flex;flex-wrap:wrap;gap:8px 24px;align-items:baseline;color:var(--dim)}.top b{color:var(--fg);font-weight:600}
.tally span{display:inline-block;margin-right:12px}.tally i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:baseline}
.blocked{margin:14px 0 0;padding:10px 14px;border:1px solid #3a2f14;background:#171309;border-radius:6px}.blocked ul{margin:6px 0 0;padding-left:18px}.blocked li{margin:2px 0}
.piece{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0}
.piece header{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}.pid{font-weight:700;letter-spacing:.02em}.ptitle{color:var(--dim)}
.chip{font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:2px 7px;border-radius:999px;border:1px solid}
.chip.won{color:var(--won);border-color:var(--won)}.chip.open{color:var(--open);border-color:var(--open)}.chip.stalled{color:var(--stalled);border-color:var(--stalled)}.chip.unjudged{color:var(--dim);border-color:var(--unj)}
.rounds{color:var(--dim);font-size:12px}.chips{display:inline-flex;gap:3px}
.v{display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;border-radius:3px;font-size:11px;font-weight:700;background:#1d2024;color:var(--dim)}
.v.ours{background:#0f3d24;color:var(--won)}.v.ref{background:#3d1f0f;color:var(--ref)}.v.unjudged{background:#23262a;color:var(--dim)}
.vp{margin-left:auto;display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}.vp button{background:none;border:0;color:var(--dim);padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}.vp button.on{background:#1f2327;color:var(--fg)}
.gap{margin:8px 0 0;color:#d8dadd}.gap::before{content:"gap · ";color:var(--dim)}.note{margin:6px 0 0;color:var(--dim);font-size:12px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}.pair.strip{grid-template-columns:1fr}.piece[data-vp="desktop"] .pair.mobile{display:none}.piece[data-vp="mobile"] .pair.desktop{display:none}
.pair.mobile{grid-template-columns:repeat(2,minmax(0,260px))}
figure{margin:0;min-width:0}figcaption{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:5px}figcaption .meta{text-transform:none;letter-spacing:0;opacity:.8}
figure img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:4px;background:#000}
.missing{border:1px dashed var(--line);border-radius:4px;color:var(--dim);font-size:12px;padding:28px 12px;text-align:center}
details{margin-top:10px}summary{cursor:pointer;color:var(--dim);font-size:12px}.hist{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px}
.hist li{display:grid;grid-template-columns:18px 1fr;gap:4px 10px;align-items:start;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:#0f1113}
.hist .hmeta{grid-column:2;color:var(--dim);font-size:12px}.hist .hgap{grid-column:2}.hist img{grid-column:2;width:240px;border:1px solid var(--line);border-radius:3px}
table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--dim);font-weight:500}.gone{color:var(--stalled)}
footer{margin-top:40px;color:var(--dim);font-size:12px;border-top:1px solid var(--line);padding-top:12px}
@media (max-width:720px){body{padding:16px}.pair,.pair.mobile{grid-template-columns:1fr}}
</style></head><body>
<h1>head.uz gauntlet <span class="dim">· wave ${esc(latestWave || '—')}</span></h1>
<div class="top">
<span>credits left <b>${credits.left ?? '—'}</b>${credits.source ? ` <span class="dim">(${esc(credits.source)})</span>` : ''}</span>
<span class="tally"><span><i style="background:var(--won)"></i>won <b>${tally.won}</b></span><span><i style="background:var(--open)"></i>open <b>${tally.open}</b></span><span><i style="background:var(--stalled)"></i>stalled <b>${tally.stalled}</b></span><span><i style="background:var(--unj)"></i>unjudged <b>${tally.unjudged}</b></span></span>
<span>${verdicts.length} verdicts · ${shots.length} manifests · generated ${esc(fmtTs(new Date().toISOString()))}</span>
<span class="vp"><button data-vp-all="desktop" class="on">all desktop</button><button data-vp-all="mobile">all mobile</button></span>
</div>
${blockedList.length ? `<div class="blocked"><b>Blocked on human</b> · ${blockedList.length}<ul>${blockedList.map((b) => `<li><b>${esc(b.piece)}</b> — ${esc(b.note || '')}</li>`).join('')}</ul></div>` : ''}
${groups.join('\n')}
<section class="group"><h2>Assets <span class="dim">workbench/assets.jsonl</span></h2>
${assets.length ? `<table><thead><tr><th>ts</th><th>id</th><th>v</th><th>model</th><th>file</th><th>credits</th><th>note</th></tr></thead><tbody>${assetRows}</tbody></table>` : '<p class="dim">no assets logged</p>'}
</section>
<footer>unjudged means no critic has ruled; it is never a pass.${data.sizeNote ? ` · ${esc(data.sizeNote)}` : ''} · piece→section map: built-in table in scripts/progress.mjs, overridable per piece in workbench/pieces.json.</footer>
<script>
document.querySelectorAll('.piece .vp button').forEach(b=>b.addEventListener('click',()=>{const a=b.closest('.piece');a.dataset.vp=b.dataset.vp;a.querySelectorAll('.vp button').forEach(x=>x.classList.toggle('on',x===b))}));
document.querySelectorAll('[data-vp-all]').forEach(b=>b.addEventListener('click',()=>{const vp=b.dataset.vpAll;document.querySelectorAll('[data-vp-all]').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('.piece').forEach(a=>{if(!a.querySelector('.vp'))return;a.dataset.vp=vp;a.querySelectorAll('.vp button').forEach(x=>x.classList.toggle('on',x.dataset.vp===vp))})}));
</script>
</body></html>`;
}

// ---------------------------------------------------------------- main
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`progress.mjs — write workbench/progress.html from verdicts, shot manifests, refs and assets

  node scripts/progress.mjs [--out workbench/progress.html] [--no-history] [--thumb 480]

  --no-history   skip the per-round thumbnails (they are the first thing dropped when the file passes 8 MB anyway)
  --thumb <px>   thumbnail width (default 480)`);
    return 0;
  }
  const out = resolve(ROOT, args.out && args.out !== true ? args.out : 'workbench/progress.html');
  const verdicts = readVerdicts();
  const statuses = allStatuses(verdicts);
  const shots = loadShots();
  const refsManifest = loadRefsManifest();
  const overrides = readJson(join(WB, 'pieces.json'), {});
  const blockedRaw = readJson(join(WB, 'blocked.json'), []);
  const blocked = Array.isArray(blockedRaw)
    ? blockedRaw.map((b) => (typeof b === 'string' ? { piece: b, note: '' } : { piece: b.piece || b.id || '?', note: b.note || b.reason || b.why || '' }))
    : Object.entries(blockedRaw).map(([piece, v]) => ({ piece, note: typeof v === 'string' ? v : v?.note || '' }));
  const assets = readJsonl(join(WB, 'assets.jsonl'));

  const ids = new Set([...Object.keys(PIECES), ...Object.keys(overrides), ...Object.keys(statuses), ...blocked.map((b) => b.piece)]);
  const pieces = [...ids].map((id) => {
    const def = resolvePiece(id, overrides, shots);
    const st = statuses[id] || { status: 'unjudged', gap: '', rounds: 0 };
    return { id, ...def, status: st.status, gap: st.gap, rounds: st.rounds };
  }).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const latestWave = shots[0]?.wave || (verdicts.length ? [...verdicts].sort((a, b) => waveSort(String(a.wave), String(b.wave)))[0].wave : null);
  let credits = { left: null, source: '' };
  const lastAfter = [...assets].reverse().find((a) => a.creditsAfter != null);
  const lastBefore = [...assets].reverse().find((a) => a.creditsBefore != null);
  if (lastAfter) credits = { left: lastAfter.creditsAfter, source: 'last creditsAfter' };
  else if (lastBefore) credits = { left: lastBefore.creditsBefore, source: 'last creditsBefore — no creditsAfter logged' };
  else if (existsSync(join(WB, 'credits.log'))) {
    const l = readFileSync(join(WB, 'credits.log'), 'utf8').trim().split('\n').pop() || '';
    const m = l.match(/credits=([\d.]+)/);
    if (m) credits = { left: m[1], source: 'credits.log' };
  }

  const data = { verdicts, statuses, pieces, shots, credits, assets, blocked, latestWave, refsManifest, sizeNote: '' };
  let history = !args['no-history'];
  let thumbW = args.thumb && args.thumb !== true ? Number(args.thumb) : 480;
  let html = await buildHtml(data, { history, thumbW });
  let bytes = Buffer.byteLength(html);
  if (bytes > SIZE_TARGET && history) {
    history = false; data.sizeNote = 'history thumbnails dropped to stay under 8 MB';
    html = await buildHtml(data, { history, thumbW }); bytes = Buffer.byteLength(html);
  }
  while (bytes > SIZE_TARGET && thumbW > 240) {
    thumbW = Math.max(240, Math.round(thumbW * 0.7)); data.sizeNote = `history thumbnails dropped and thumbnails shrunk to ${thumbW}px to stay under 8 MB`;
    html = await buildHtml(data, { history, thumbW }); bytes = Buffer.byteLength(html);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  const t = { won: 0, open: 0, stalled: 0, unjudged: 0 };
  for (const p of pieces) t[p.status]++;
  console.log(`wrote ${relative(ROOT, out)} (${(bytes / 1024 / 1024).toFixed(2)} MB) · wave ${latestWave || '—'} · ${pieces.length} pieces: won ${t.won} open ${t.open} stalled ${t.stalled} unjudged ${t.unjudged} · ${verdicts.length} verdicts · credits ${credits.left ?? '—'}${data.sizeNote ? ' · ' + data.sizeNote : ''}`);
  return 0;
}

main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
