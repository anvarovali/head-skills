#!/usr/bin/env node
/**
 * scripts/capture-refs.mjs — reference capture for the head-uz redesign gauntlet.
 *
 * Reference 1: https://axiom-power-template.webflow.io/  (7 pages × desktop/mobile × raw/blue tiers,
 *              motion recordings, the two background videos, a computed-style census)
 * Reference 2: https://www.cominvi.com.mx/                (motion reference: preloader, hero reveal,
 *              tr="1" text reveal, the pinned cylinder, the route transition)
 * Reference 3 (phase `k3`, wave 07): https://kott.studio/ (loader + pinned WebGL hero + nav + "Work that works." head),
 *              https://www.lesgmstudios.com/ (clients wheel at three scroll offsets + stats band),
 *              https://lircle.co/ (services list rest/hover, collaborators, about, footer — green recoloured to HEAD blue)
 *
 * Run with this repo's Playwright (node 22+):
 *   node scripts/capture-refs.mjs                # every phase
 *   ONLY=k3 node scripts/capture-refs.mjs        # just the wave-07 references → refs/k3/
 *
 * Everything lands under refs/ (gitignored). refs/MANIFEST.json lists every expected file with ok/failed.
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';

const execFileP = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REFS = path.join(ROOT, 'refs');
const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg';
const FFPROBE = process.env.FFPROBE || '/opt/homebrew/bin/ffprobe';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);   // phases: media,motion,axiom,cominvi,k3
const STEPS = (process.env.STEPS || '').split(',').filter(Boolean); // axiom steps: full,sections,mid,states,census
const PAGE_FILTER = (process.env.PAGES || '').split(',').filter(Boolean);
const VP_FILTER = (process.env.VPS || '').split(',').filter(Boolean);
const TIER_FILTER = (process.env.TIERS || '').split(',').filter(Boolean);
const step = (k) => !STEPS.length || STEPS.includes(k);
const PARTIAL = !!(ONLY.length || STEPS.length || PAGE_FILTER.length || VP_FILTER.length || TIER_FILTER.length || (process.env.SITES || '').length);

const BASE = 'https://axiom-power-template.webflow.io';
const COMINVI = 'https://www.cominvi.com.mx/';
const KOTT = 'https://kott.studio/';
const GM = 'https://www.lesgmstudios.com/';
const LIRCLE = 'https://lircle.co/';
// lircle's accent is one custom property (--g:#00CD58); the two extra rules are belt and braces for anything that
// hard-codes the green. Critics then judge craft, not hue.
// Verified against lircle's own rules (refs/k3/meta/lircle.css.json): everything else reads var(--g); the two
// hard-coded greens are the row tint (.svc-row::before rgba(0,205,88,.05)) and the footer wordmark, which is a
// .webp raster (assets/brand/lircle-logo-white-wordmark.webp) — hue-rotate(84deg) turns its leaf 146° → 230° (blue)
// and leaves the white glyphs white.
export const LIRCLE_BLUE_CSS = [
  ':root{--g:#0029FF} .sec-lbl, .svc-row:hover .svc-name { color:#0029FF }',
  '.svc-row::before{background:rgba(0,41,255,.05)!important}',
  'img[src*="lircle-logo"]{filter:hue-rotate(84deg)}',
].join(' ');
// site chrome that is not part of the craft being judged: lircle's custom cursors, awwwards badge and WhatsApp fab, kott's grain
export const K3_HIDE_CSS = '#cur,#cur2,#awwwards,.wa-fab,.grain-overlay{display:none!important}';
const SITE_FILTER = (process.env.SITES || '').split(',').filter(Boolean); // k3 sites: kott,gm,lircle
let prevK3 = [];
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const PAGES = [
  ['home', '/'], ['platform', '/platform'], ['technology', '/technology'], ['cases', '/case-studies'],
  ['company', '/company'], ['contact', '/contact'], ['careers', '/careers'],
];
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, userAgent: CHROME_UA },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: IPHONE_UA, isMobile: true, hasTouch: true },
};

export const HIDE_CSS = '.ctm-box,#awwwards,.w-webflow-badge,.section_news{display:none!important}';
// Webflow "variable modes" re-declare the whole palette (brand-500:#ff4d00 …) on .section_statement, .footer,
// .button_arrow-box, .section_measurement and .section_footprint themselves, so a :root rule alone leaves those
// surfaces orange. `:root *` + !important reaches every element.
export const BLUE_CSS = [
  ':root,:root *{--_theme---brand-colors--brand-200:#c9d6ff!important;--_theme---brand-colors--brand-400:#6B8CFF!important;--_theme---brand-colors--brand-500:#1d5be0!important;--_theme---brand-colors--brand-600:#2B4FD6!important;--_theme---brand-colors--brand-700:#123fa8!important;--_theme---brand-colors--brand-800:#0a1f5c!important}',
  'img,video,[style*="background-image"]{filter:hue-rotate(200deg)}',
].join(' ');
const TIERS = { raw: HIDE_CSS, blue: HIDE_CSS + '\n' + BLUE_CSS };

const CENSUS_SELECTORS = [
  'h1', 'h2', 'h3', '.heading-style-h0', '.heading-style-h1', '.heading-style-h2', '.text-style-eyebrow', '.eyebrow_text',
  '.button_component', '.nav_bar', 'section[class*="section_"]', 'footer.footer', '.stat_card', '.cpb_card', '.spec-card', '.tst_quote',
];

// Page-side helpers, installed as an init script so they survive reloads.
// `lenis` on axiom is a top-level const in an inline script (reachable through the global lexical scope);
// cominvi exposes window.lenis and scrolls a wrapper element, so lenis.scroll is the truth there.
const HELPERS = `window.__h = {
  lenis() {
    if (window.__noLenis) return null;
    try { const l = (typeof lenis !== 'undefined' && lenis) || window.lenis || null; return (l && typeof l.scrollTo === 'function') ? l : null; } catch (e) { return null; }
  },
  scroll() { const l = this.lenis(); return (l && typeof l.scroll === 'number') ? l.scroll : window.scrollY; },
  limit() {
    const l = this.lenis();
    if (l && typeof l.limit === 'number' && l.limit > 0) return l.limit + innerHeight;
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  },
  to(y) {
    y = Math.max(0, Math.round(y));
    const l = this.lenis();
    if (l) { try { l.scrollTo(y, { immediate: true, force: true }); return this.scroll(); } catch (e) {} }
    window.scrollTo(0, y); return window.scrollY;
  },
  top(el) { return el.getBoundingClientRect().top + this.scroll(); },
  visible(el) {
    if (!el) return false; const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  },
  leaf(el) { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return {
    tag: el.tagName.toLowerCase(), className: el.className && String(el.className).slice(0, 140),
    text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 90),
    rect: { x: Math.round(r.x), y: Math.round(r.y + this.scroll()), w: Math.round(r.width), h: Math.round(r.height) },
    fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight,
    textTransform: cs.textTransform, color: cs.color, backgroundColor: cs.backgroundColor, opacity: cs.opacity, mixBlendMode: cs.mixBlendMode,
  }; },
};`;

// ---------------------------------------------------------------- manifest + fs helpers
const manifest = { capturedAt: new Date().toISOString(), pages: {}, motion: [], media: [], cominvi: [], k3: [], failed: [] };
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
const short = (e) => String((e && e.message) || e).split('\n')[0].slice(0, 220);

function bucketFor(pageName, vp) {
  manifest.pages[pageName] ??= {};
  manifest.pages[pageName][vp] ??= { files: [] };
  return manifest.pages[pageName][vp].files;
}
/** Run fn(absPath); on success stat the file, on any error record a failed entry. Never throws. */
async function record(list, rel, fn, note = '', extra = {}) {
  const abs = path.join(REFS, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  try {
    const more = await fn(abs); // a string note, or { note, ...fields } to merge into the entry
    const st = await fs.stat(abs);
    if (!st.size) throw new Error('empty file');
    // page.screenshot() resolves to a Buffer — only a plain object carries fields for the entry
    const isPlain = more && typeof more === 'object' && Object.getPrototypeOf(more) === Object.prototype;
    const { note: moreNote, ...moreExtra } = isPlain ? more : { note: typeof more === 'string' ? more : '' };
    const entry = { name: rel, ok: true, bytes: st.size, note: [note, moreNote].filter(Boolean).join('; '), ...extra, ...moreExtra };
    list.push(entry);
    return entry;
  } catch (e) {
    const entry = { name: rel, ok: false, bytes: 0, note: [note, short(e)].filter(Boolean).join('; '), ...extra };
    list.push(entry);
    await fs.rm(abs, { force: true }).catch(() => {});
    return entry;
  }
}
const phaseFailures = []; // failures that are not a file (a whole page or phase aborted)
const processed = new Set(); // "<tier>/<page>.<vp>" keys this run went through
function fail(name, e, note = '') {
  const entry = { name, ok: false, bytes: 0, note: [note, short(e)].filter(Boolean).join('; ') };
  phaseFailures.push(entry);
  log('FAILED', name, '—', entry.note);
}
const phaseOf = (name) => (/^media\//.test(name) ? 'media' : /^motion\//.test(name) ? 'motion' : /^cominvi/.test(name) ? 'cominvi' : /^k3/.test(name) ? 'k3' : 'axiom');
let prevFailed = [];
/** failed[] = every entry with ok:false across the buckets + phase-level failures (this run's, and earlier ones not re-run). */
function rebuildFailed(rerun) {
  const names = new Set(); const bad = [];
  const walk = (arr) => arr.forEach((f) => { names.add(f.name); if (!f.ok) bad.push(f); });
  for (const p of Object.values(manifest.pages)) for (const v of Object.values(p)) walk(v.files);
  walk(manifest.motion); walk(manifest.media); walk(manifest.cominvi); walk(manifest.k3);
  const carried = prevFailed.filter((e) => !names.has(e.name) && !rerun(phaseOf(e.name)));
  manifest.failed = [...carried, ...phaseFailures, ...bad];
}
async function saveManifest() {
  await fs.writeFile(path.join(REFS, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
}

// ---------------------------------------------------------------- ffmpeg helpers
async function ff(args) {
  await execFileP(FFMPEG, ['-y', '-v', 'error', ...args], { maxBuffer: 1 << 26 });
}
async function probe(file) {
  const { stdout } = await execFileP(FFPROBE, ['-v', 'error', '-show_entries',
    'format=duration,size,bit_rate:stream=codec_type,codec_name,width,height,r_frame_rate,bit_rate,nb_frames', '-of', 'json', file], { maxBuffer: 1 << 24 });
  const j = JSON.parse(stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video') || {};
  const f = j.format || {};
  const fps = v.r_frame_rate ? (() => { const [n, d] = v.r_frame_rate.split('/').map(Number); return d ? n / d : n; })() : null;
  return {
    codec: v.codec_name || null, width: v.width || null, height: v.height || null, fps,
    duration: f.duration ? +(+f.duration).toFixed(3) : null, bytes: f.size ? +f.size : null,
    bitrate: f.bit_rate ? +f.bit_rate : (v.bit_rate ? +v.bit_rate : null),
  };
}
/** Luma spread over the lower part of a PNG: a uniform (blank) region reads ymax ≈ ymin. */
async function lumaSpread(file, fromFrac = 0.4) {
  const { stdout } = await execFileP(FFMPEG, ['-v', 'error', '-i', file, '-vf',
    `crop=iw:trunc(ih*${1 - fromFrac}/2)*2:0:trunc(ih*${fromFrac}/2)*2,signalstats,metadata=print:file=/dev/stdout`,
    '-frames:v', '1', '-f', 'null', '-'], { maxBuffer: 1 << 24 });
  const g = (k) => { const m = stdout.match(new RegExp(`lavfi\\.signalstats\\.${k}=([\\d.]+)`)); return m ? +m[1] : NaN; };
  return { ymin: g('YMIN'), ymax: g('YMAX'), yavg: g('YAVG') };
}
async function pngSize(file) {
  const fh = await fs.open(file);
  try { const b = Buffer.alloc(24); await fh.read(b, 0, 24, 0); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }
  finally { await fh.close(); }
}
async function filmstrip(src, dest, fps, spacing, frames, tile) {
  const every = Math.max(1, Math.round(fps * spacing));
  await ff(['-i', src, '-vf', `select='not(mod(n,${every}))',scale=360:-1,tile=${tile}`, '-frames:v', '1', dest]);
  return `${frames} frames ${spacing}s apart (every ${every}th frame @ ${fps}fps), tile ${tile}`;
}
async function cutWebm(src, dest, start, dur) {
  await ff(['-ss', String(start), '-t', String(dur), '-i', src, '-c:v', 'libvpx', '-b:v', '3M', '-deadline', 'realtime', '-cpu-used', '8', '-an', dest]);
}
async function vstack(tiles, dest) {
  const args = [];
  for (const t of tiles) args.push('-i', t);
  const inputs = tiles.map((_, i) => `[${i}:v]`).join('');
  await ff([...args, '-filter_complex', `${inputs}vstack=inputs=${tiles.length}`, '-frames:v', '1', dest]);
}
/** Side-by-side strip of stills, each scaled to `cellW` px wide (heights follow), a 4px paper gutter between cells. */
async function hstack(tiles, dest, cellW) {
  const args = [];
  for (const t of tiles) args.push('-i', t);
  const scaled = tiles.map((_, i) => `[${i}:v]scale=${cellW}:-2,pad=iw+4:ih:0:0:#e9e6df[s${i}]`).join(';');
  const inputs = tiles.map((_, i) => `[s${i}]`).join('');
  await ff([...args, '-filter_complex', `${scaled};${inputs}hstack=inputs=${tiles.length}`, '-frames:v', '1', dest]);
  return `${tiles.length} cells ${cellW}px wide`;
}

// ---------------------------------------------------------------- axiom: page procedure
async function gotoSettled(page, url, css) {
  let note = '';
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { note = 'networkidle not reached within 20s, continued'; });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(1500);
  return note;
}
/** Step through the document one viewport at a time so every ScrollTrigger has fired, then back to top. */
async function prime(page) {
  const vh = await page.evaluate(() => innerHeight);
  let limit = await page.evaluate(() => __h.limit());
  for (let y = 0; y <= limit; y += vh) {
    await page.evaluate((y) => __h.to(y), y);
    await page.waitForTimeout(150);
    if (y + vh > limit) { const nl = await page.evaluate(() => __h.limit()); if (nl > limit) limit = nl; }
  }
  await page.evaluate(() => { if (window.ScrollTrigger && window.ScrollTrigger.refresh) window.ScrollTrigger.refresh(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => __h.to(0));
  await page.waitForTimeout(500);
  return limit;
}
async function fullPage(page, abs) {
  const notes = [];
  const shoot = async (opts = {}) => page.screenshot({ path: abs, fullPage: true, timeout: 90000, ...opts });
  try { await shoot(); }
  catch (e) { notes.push(`2x full-page failed (${short(e)}), retried at 1x`); await shoot({ scale: 'css' }); }
  const s = await lumaSpread(abs).catch(() => null);
  if (s && (s.ymax - s.ymin) < 12) {
    await page.evaluate(() => { try { const l = __h.lenis(); l && l.destroy(); } catch (e) {} window.__noLenis = true; });
    await page.waitForTimeout(500);
    try { await shoot(); } catch (e) { await shoot({ scale: 'css' }); }
    notes.push('blank below the fold → retried after lenis.destroy()');
  }
  const d = await pngSize(abs);
  return [`${d.w}x${d.h}`, ...notes].join('; ');
}
async function listSections(page) {
  return page.evaluate(() => {
    const out = []; const seen = {};
    for (const el of document.querySelectorAll('section[class*="section_"], footer.footer')) {
      let name = [...el.classList].find((c) => /^section_/.test(c));
      name = name ? name.replace(/^section_/, '') : (el.tagName === 'FOOTER' ? 'footer' : 'section');
      seen[name] = (seen[name] || 0) + 1;
      if (seen[name] > 1) name += '-' + seen[name];
      out.push({ name, index: out.length, visible: __h.visible(el), top: __h.top(el), height: el.getBoundingClientRect().height });
    }
    return out;
  });
}
async function captureSections(page, list, prefix) {
  const secs = await listSections(page);
  const loc = page.locator('section[class*="section_"], footer.footer');
  for (const s of secs) {
    if (!s.visible) continue; // .section_news is hidden by the injected CSS
    const top = await loc.nth(s.index).evaluate((el) => __h.top(el)); // re-measure: earlier crops may have moved things
    await page.evaluate((y) => __h.to(y), top - 80);
    await page.waitForTimeout(1200);
    await record(list, `${prefix}.${s.name}.vp.png`, (abs) => page.screenshot({ path: abs }), `viewport at ${s.name} (top − 80px)`);
    await record(list, `${prefix}.${s.name}.png`, (abs) => loc.nth(s.index).screenshot({ path: abs, timeout: 30000 }), `section crop, ${Math.round(s.height)}px tall`);
  }
  return secs;
}
async function captureMidScroll(page, list, prefix, vh) {
  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const hero = q('.section_hero'), st = q('.section_statement');
    const cards = [...document.querySelectorAll('.cpb_card')];
    const rail = q('.page_nav-list');
    let railTop = 120;
    if (rail) { const t = parseFloat(getComputedStyle(rail).top); if (!Number.isNaN(t)) railTop = t; }
    return { hero: hero ? __h.top(hero) : null, st: st ? __h.top(st) : null, card2: cards[1] ? __h.top(cards[1]) : null, railTop };
  });
  const shots = [];
  if (info.hero != null) shots.push(['hero.mid1', info.hero + 0.45 * vh, 'hero scrolled by 45% of the viewport']);
  if (info.st != null) {
    shots.push(['statement.mid1', info.st - 0.7 * vh, 'statement top at 70% of the viewport']);
    shots.push(['statement.mid2', info.st - 0.4 * vh, 'statement top at 40% of the viewport']);
    shots.push(['statement.mid3', info.st - 0.1 * vh, 'statement top at 10% of the viewport']);
  }
  if (info.card2 != null) shots.push(['cpb.mid1', info.card2 - info.railTop, `capabilities: card 2 aligned with the sticky rail (top ${info.railTop}px)`]);
  for (const [name, y, note] of shots) {
    await record(list, `${prefix}.${name}.png`, async (abs) => {
      await page.evaluate((y) => __h.to(y), y);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: abs });
      return `scroll ${Math.round(y)}`;
    }, note);
  }
}
async function captureStates(page, list, prefix, vpName, vh) {
  await page.evaluate(() => __h.to(0));
  await page.waitForTimeout(600);
  const park = async () => { await page.mouse.move(vpName === 'desktop' ? 720 : 195, vh - 40); await page.waitForTimeout(600); };
  if (vpName === 'desktop') {
    await record(list, `${prefix}.state.mega.png`, async (abs) => {
      await page.locator('.nav_dropdown-toggle').first().hover({ timeout: 8000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: abs });
    }, 'hover .nav_dropdown-toggle, 600ms');
    await park();
    await record(list, `${prefix}.state.nav-roll.png`, async (abs) => {
      await page.locator('.nav_link').nth(1).hover({ timeout: 8000 });
      await page.waitForTimeout(150);
      await page.screenshot({ path: abs });
    }, 'hover the second .nav_link, 150ms (text roll mid-flight)');
    await park();
    await record(list, `${prefix}.state.btn-roll.png`, async (abs) => {
      const b = page.locator('.button_component:visible').first();
      await b.scrollIntoViewIfNeeded({ timeout: 8000 });
      await page.waitForTimeout(400);
      await b.hover({ timeout: 8000 });
      await page.waitForTimeout(150);
      await page.screenshot({ path: abs });
    }, 'hover the first visible .button_component, 150ms');
    await park();
    if (await page.locator('.image_card:visible').count()) {
      await record(list, `${prefix}.state.card-hover.png`, async (abs) => {
        const c = page.locator('.image_card:visible').first();
        const top = await c.evaluate((el) => __h.top(el));
        await page.evaluate((y) => __h.to(y), top - 0.15 * vh);
        await page.waitForTimeout(900);
        const box = await c.boundingBox();
        if (!box) throw new Error('card has no box after scrolling');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: abs });
        return `mouse at ${Math.round(box.x + box.width / 2)},${Math.round(box.y + box.height / 2)}`;
      }, 'hover the first laid-out .image_card (the menus hold 0×0 ones), 800ms');
      await park();
    }
  } else {
    await record(list, `${prefix}.state.menu-open.png`, async (abs) => {
      await page.locator('.menu_button').first().click({ timeout: 8000 });
      await page.waitForTimeout(700);
      await page.screenshot({ path: abs });
    }, 'tap .menu_button, 700ms');
  }
}
async function census(page, sels) {
  return page.evaluate((sels) => {
    const out = { url: location.href, viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio }, docHeight: __h.limit(), scrollAt: __h.scroll(), items: [] };
    for (const sel of sels) {
      [...document.querySelectorAll(sel)].slice(0, 3).forEach((el, i) => {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        out.items.push({
          selector: sel, index: i, tag: el.tagName.toLowerCase(), className: el.className && String(el.className).slice(0, 120),
          rect: { x: Math.round(r.x), y: Math.round(r.y + __h.scroll()), w: Math.round(r.width), h: Math.round(r.height) },
          fontSize: cs.fontSize, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, fontWeight: cs.fontWeight, fontFamily: cs.fontFamily,
          padding: cs.padding, gap: cs.gap, filter: cs.filter, backdropFilter: cs.backdropFilter, borderRadius: cs.borderRadius,
          backgroundColor: cs.backgroundColor, color: cs.color,
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        });
      });
    }
    return out;
  }, sels);
}

async function capturePage(ctx, tier, vpName, pageName, pathname) {
  const list = bucketFor(pageName, vpName);
  const prefix = `${tier}/${pageName}.${vpName}`;
  const vh = VIEWPORTS[vpName].viewport.height;
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  try {
    const loadNote = await gotoSettled(page, BASE + pathname, TIERS[tier]);
    await prime(page);
    if (step('full')) await record(list, `${prefix}.full.png`, (abs) => fullPage(page, abs), ['untouched full page', loadNote].filter(Boolean).join('; '), { tier });
    const secs = step('sections') ? await captureSections(page, list, prefix) : await listSections(page);
    if (step('mid')) await captureMidScroll(page, list, prefix, vh);
    if (step('states')) await captureStates(page, list, prefix, vpName, vh);
    if (step('census') && tier === 'raw') {
      await page.evaluate(() => __h.to(0));
      await page.waitForTimeout(500);
      await record(list, `meta/${pageName}.${vpName}.census.json`, async (abs) => {
        const data = await census(page, CENSUS_SELECTORS);
        data.sections = secs.map((s) => ({ name: s.name, top: Math.round(s.top), height: Math.round(s.height), visible: s.visible }));
        await fs.writeFile(abs, JSON.stringify(data, null, 2));
        return `${data.items.length} elements`;
      }, 'computed styles + boxes, measured at scroll 0 after priming');
    }
  } finally {
    await page.close().catch(() => {});
  }
}
async function axiomWorker(browser, tier, vpName) {
  const ctx = await browser.newContext(VIEWPORTS[vpName]);
  await ctx.addInitScript(HELPERS);
  try {
    for (const [name, p] of PAGES) {
      if (PAGE_FILTER.length && !PAGE_FILTER.includes(name)) continue;
      const t = Date.now();
      try { await capturePage(ctx, tier, vpName, name, p); processed.add(`${tier}/${name}.${vpName}`); }
      catch (e) { fail(`${tier}/${name}.${vpName}`, e, 'page procedure aborted'); }
      log(`${tier}/${name}.${vpName} — ${((Date.now() - t) / 1000).toFixed(0)}s`);
    }
  } finally { await ctx.close().catch(() => {}); }
}

// ---------------------------------------------------------------- axiom: motion
async function motion(browser) {
  const tmp = path.join(REFS, 'motion', 'tmp');
  await fs.mkdir(tmp, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: CHROME_UA,
    recordVideo: { dir: tmp, size: { width: 1440, height: 900 } } });
  await ctx.addInitScript(HELPERS);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const at = () => (Date.now() - t0) / 1000;
  const marks = {};
  await gotoSettled(page, BASE + '/', HIDE_CSS);
  marks.hero = at(); await page.waitForTimeout(4000);
  // .section_tst is taller than the viewport and the logo marquee (.client_row) is its last row: keep that row fully in frame
  const tstY = await page.evaluate(() => {
    const el = document.querySelector('.section_tst'); if (!el) return 0;
    const row = el.querySelector('.client_row');
    const top = __h.top(el);
    if (!row) return top - 80;
    const r = row.getBoundingClientRect(); const rowBottom = __h.top(row) + r.height;
    return Math.max(top - 80, rowBottom + 24 - innerHeight);
  });
  await page.evaluate((y) => __h.to(y), tstY);
  marks.marquee = at(); await page.waitForTimeout(6000);
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.addStyleTag({ content: HIDE_CSS });
  await page.waitForTimeout(500);
  const cpbTop = await page.evaluate(() => { const el = document.querySelector('.section_cpb'); return el ? __h.top(el) : 0; });
  await page.evaluate((y) => __h.to(y), cpbTop - 80);
  marks.cpb = at(); await page.waitForTimeout(3000);
  const video = page.video();
  await ctx.close();
  const rec = await video.path();
  const full = path.join(REFS, 'motion', 'home.recording.webm');
  await fs.rename(rec, full);
  await fs.rm(tmp, { recursive: true, force: true });
  const info = await probe(full);
  manifest.motion.push({ name: 'motion/home.recording.webm', ok: true, bytes: info.bytes, note: `whole recording: hero at ${marks.hero.toFixed(2)}s, tst at ${marks.marquee.toFixed(2)}s, cpb (after reload) at ${marks.cpb.toFixed(2)}s`, probe: info });
  const fps = info.fps || 25;
  for (const [name, start, dur] of [['hero', marks.hero, 4], ['marquee', marks.marquee, 6], ['cpb', marks.cpb, 3]]) {
    const clip = await record(manifest.motion, `motion/${name}.webm`, async (abs) => {
      await cutWebm(full, abs, start, dur);
      const p = await probe(abs);
      return `cut ${start.toFixed(2)}s +${dur}s from home.recording.webm; ${p.width}x${p.height} ${p.duration}s`;
    });
    if (!clip.ok) continue;
    const spacing = Math.min(0.5, dur / 8);
    await record(manifest.motion, `motion/${name}.strip.png`, (abs) => filmstrip(path.join(REFS, clip.name), abs, fps, spacing, 8, '8x1'));
  }
}

// ---------------------------------------------------------------- axiom: media
async function media(browser) {
  const ctx = await browser.newContext({ userAgent: CHROME_UA });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const vids = await page.evaluate(() => [...document.querySelectorAll('[data-video-urls]')].map((e) => ({
    className: e.className, urls: (e.getAttribute('data-video-urls') || '').split(',').map((s) => s.trim()).filter(Boolean), poster: e.getAttribute('data-poster-url'),
  })));
  await ctx.close();
  const picks = [['hero-bg', (v) => /hero/i.test(v.className)], ['perf', (v) => /perf/i.test(v.className)]];
  for (const [name, pick] of picks) {
    const v = vids.find(pick);
    if (!v) { fail(`media/${name}.*`, new Error('no data-video-urls element for it'), `elements seen: ${vids.map((x) => x.className).join(' | ')}`); continue; }
    const jobs = v.urls.map((u) => [u, /\.webm(\?|$)/i.test(u) ? `${name}.webm` : `${name}.mp4`]);
    if (v.poster) jobs.push([v.poster, `${name}_poster.jpg`]);
    for (const [url, file] of jobs) {
      await record(manifest.media, `media/${file}`, async (abs) => {
        await execFileP('curl', ['-sSL', '--fail', '--max-time', '180', '-A', CHROME_UA, '-o', abs, url]);
        const p = await probe(abs);
        const note = [p.width && `${p.width}x${p.height}`, p.duration != null && `${p.duration}s`, p.bitrate && `${Math.round(p.bitrate / 1000)} kb/s`, p.codec].filter(Boolean).join(', ');
        return { note, url, source: v.className.split(' ')[0], probe: p };
      }, `from ${v.className.split(' ')[0]}`);
    }
  }
}

// ---------------------------------------------------------------- cominvi
async function waitForLoaderGone(page, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const gone = await page.evaluate(() => {
      const el = document.querySelector('.loader'); if (!el) return true;
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.98 || r.width === 0 || r.bottom <= innerHeight * 0.5 || r.top >= innerHeight * 0.5;
    }).catch(() => false);
    if (gone) return Date.now() - t0;
    await page.waitForTimeout(50);
  }
  return null;
}
async function frames(page, list, dir, ms, every, t0, note) {
  for (let i = 0; Date.now() - t0 < ms; i++) {
    const at = Date.now() - t0;
    await record(list, `cominvi/${dir}/f${String(i).padStart(3, '0')}.png`, (abs) => page.screenshot({ path: abs, timeout: 4000 }), `${note} t=${at}ms`);
    await page.waitForTimeout(every);
  }
}
async function cominvi(browser) {
  const list = manifest.cominvi;
  const opts = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: CHROME_UA };
  const vh = 900;
  const tmp = path.join(REFS, 'cominvi', 'tmp');
  await fs.mkdir(tmp, { recursive: true });

  // 1b. the first 5s as video (its own fresh context, so the preloader really runs)
  try {
    const ctx = await browser.newContext({ ...opts, recordVideo: { dir: tmp, size: { width: 1440, height: 900 } } });
    const page = await ctx.newPage();
    await page.goto(COMINVI, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(8300);
    const video = page.video();
    await ctx.close();
    const rec = await video.path();
    const fps = (await probe(rec)).fps || 25;
    const clip = await record(list, 'cominvi/loader.webm', async (abs) => { await cutWebm(rec, abs, 0, 5); const p = await probe(abs); return `first 5s from a fresh context; ${p.width}x${p.height} ${p.duration}s`; });
    if (clip.ok) await record(list, 'cominvi/loader.strip.png', (abs) => filmstrip(path.join(REFS, clip.name), abs, fps, 0.25, 16, '8x2'));
    const exit = await record(list, 'cominvi/loader-exit.webm', async (abs) => { await cutWebm(rec, abs, 0, 8); const p = await probe(abs); return `first 8s — .loader only leaves at ~5.9s, so this one holds the exit and the hero underneath; ${p.width}x${p.height} ${p.duration}s`; });
    if (exit.ok) await record(list, 'cominvi/loader-exit.strip.png', (abs) => filmstrip(path.join(REFS, exit.name), abs, fps, 0.5, 16, '8x2'));
  } catch (e) { fail('cominvi/loader.webm', e); }
  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});

  // 1a + 2 + 3 + 4 + 5 on one fresh page
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(HELPERS);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  try {
    await page.goto(COMINVI, { waitUntil: 'commit', timeout: 60000 }).catch((e) => fail('cominvi goto', e));
    const t0 = Date.now();
    await frames(page, list, 'loader', 4000, 100, t0, 'preloader');                       // 1a
    const gone = await waitForLoaderGone(page, 15000);
    if (gone == null) fail('cominvi/hero-reveal', new Error('.loader still covering the page after 15s'), 'frames taken anyway');
    await frames(page, list, 'hero-reveal', 2000, 100, Date.now(), `hero reveal (loader left ${gone == null ? '?' : Math.round((gone + 4000 + (Date.now() - t0 - gone - 4000)) / 100) / 10 + 's after load'})`); // 2
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    // 3. tr="1" text reveal — the page is NOT primed yet, so the reveal is still to come
    const tr = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[tr="1"]')) { const t = __h.top(el); if (t > innerHeight) return { top: t, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70) }; }
      return null;
    });
    if (tr) {
      for (const pct of [90, 70, 50]) {
        await record(list, `cominvi/tr-${pct}.png`, async (abs) => {
          await page.evaluate((y) => __h.to(y), tr.top - vh * pct / 100);
          await page.waitForTimeout(400);
          await page.screenshot({ path: abs });
          return `“${tr.text}”`;
        }, `first [tr="1"] below the fold with its top at ${pct}% of the viewport, 400ms`);
      }
    } else fail('cominvi/tr-*.png', new Error('no [tr="1"] below the fold'));

    // 4. prime the whole page by lenis steps, keeping every viewport as a tile for the stitched full page
    const limit = await page.evaluate(() => __h.limit());
    const tiles = [];
    const tileDir = path.join(REFS, 'cominvi', 'tmp-tiles');
    await fs.mkdir(tileDir, { recursive: true });
    for (let y = 0, i = 0; y < limit; y += vh, i++) {
      await page.evaluate((y) => __h.to(y), y);
      await page.waitForTimeout(150);
      const f = path.join(tileDir, `s${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path: f }).catch(() => {});
      tiles.push(f);
    }
    await record(list, 'cominvi/full.desktop.stitched.png', (abs) => vstack(tiles, abs), `stitched from ${tiles.length} viewport tiles at ${vh}px steps (Lenis scrolls a wrapper; fixed nav and pinned sections repeat)`);

    const cyl = await page.evaluate(() => {
      const w = [...document.querySelectorAll('.cylindar__wrapper')].find((e) => e.getBoundingClientRect().height > 0);
      if (!w) return null;
      const sp = w.closest('.pin-spacer');
      const ref = sp || w;
      return { top: __h.top(ref), dist: sp ? Math.max(0, sp.getBoundingClientRect().height - w.getBoundingClientRect().height) : 2000, spacer: !!sp };
    });
    if (cyl) {
      for (const pct of [0, 25, 50, 75]) {
        await record(list, `cominvi/cylinder-${pct}.png`, async (abs) => {
          await page.evaluate((y) => __h.to(y), cyl.top + cyl.dist * pct / 100);
          await page.waitForTimeout(500);
          await page.screenshot({ path: abs });
        }, `.cylindar__wrapper pinned: start ${Math.round(cyl.top)} + ${pct}% of the ${Math.round(cyl.dist)}px pinned distance (${cyl.spacer ? 'measured from .pin-spacer' : 'no pin-spacer found, assumed 2000px'})`);
      }
    } else fail('cominvi/cylinder-*.png', new Error('.cylindar__wrapper not found'));

    // 5. route transition — the "Our services" card
    const card = await page.evaluate(() => {
      const a = document.querySelector('a.card[href="/our-services"]') || document.querySelector('a[href="/our-services"]');
      return a ? { top: __h.top(a), cls: a.className } : null;
    });
    if (card) {
      await page.evaluate((y) => __h.to(y), card.top - 300);
      await page.waitForTimeout(900);
      const box = await page.evaluate(() => {
        const a = document.querySelector('a.card[href="/our-services"]') || document.querySelector('a[href="/our-services"]');
        const r = a.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      let clicked = 'a.card[href="/our-services"] at ' + Math.round(box.x) + ',' + Math.round(box.y);
      if (box.y > 0 && box.y < vh && box.x > 0 && box.x < 1440) {
        await page.mouse.move(box.x, box.y); await page.waitForTimeout(300);
        page.mouse.click(box.x, box.y).catch(() => {});
      } else {
        clicked = 'first visible a[href="/our-services"] (card centre was off-screen)';
        page.locator('a[href="/our-services"]:visible').first().click({ timeout: 8000 }).catch((e) => fail('cominvi/transition click', e));
      }
      const tc = Date.now();
      await frames(page, list, 'transition', 1500, 100, tc, `route transition after clicking ${clicked}`);
      await page.waitForTimeout(1500);
      const url = await page.evaluate(() => location.href).catch(() => '?');
      list.push({ name: 'cominvi/transition/', ok: true, bytes: 0, note: `clicked ${clicked}; url after 3s: ${url}` });
    } else fail('cominvi/transition', new Error('no a[href="/our-services"] on the home page'));
    await page.close().catch(() => {});

    // full page: fresh load, primed, then unwrap the Lenis wrapper so the document is tall and Playwright can capture it
    const p2 = await ctx.newPage();
    p2.setDefaultTimeout(20000);
    await p2.goto(COMINVI, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await waitForLoaderGone(p2, 15000);
    await p2.waitForTimeout(800);
    await prime(p2);
    await record(list, 'cominvi/full.desktop.png', async (abs) => {
      await p2.addStyleTag({ content: '.page-wrap,.lenis{position:static!important;height:auto!important;overflow:visible!important}html,body{height:auto!important;overflow:visible!important}' });
      await p2.evaluate(() => { try { window.lenis && window.lenis.destroy(); } catch (e) {} window.__noLenis = true; window.scrollTo(0, 0); });
      await p2.waitForTimeout(800);
      const h = await p2.evaluate(() => document.documentElement.scrollHeight);
      if (h >= 3000) {
        await p2.screenshot({ path: abs, fullPage: true, timeout: 90000 });
        const d = await pngSize(abs);
        return `true full-page after unwrapping the Lenis wrapper (document ${h}px → ${d.w}x${d.h}); pinned sections show one state`;
      }
      await fs.copyFile(path.join(REFS, 'cominvi', 'full.desktop.stitched.png'), abs);
      return `unwrapping left the document at ${h}px, so this is a copy of full.desktop.stitched.png`;
    }, 'everything primed');
    await p2.close().catch(() => {});
    await fs.rm(tileDir, { recursive: true, force: true }).catch(() => {});
  } finally { await ctx.close().catch(() => {}); }
}

// ---------------------------------------------------------------- k3: kott / GM / lircle (wave 07)
const K3_VPS = () => Object.keys(VIEWPORTS).filter((v) => !VP_FILTER.length || VP_FILTER.includes(v));
const STRIP_CELL = { desktop: 576, mobile: 390 }; // px per cell → a 5-cell desktop strip is 2880 wide, like one 2x still
const pct = (p) => String(Math.round(p * 100)).padStart(2, '0');

/** record() with one retry: a flaky still (font swap mid-shot, a late lazy image) gets a second chance before it is failed. */
async function record2(list, rel, fn, note = '', extra = {}) {
  const first = await record(list, rel, fn, note, extra);
  if (first.ok) return first;
  list.splice(list.indexOf(first), 1);
  log('retry', rel, '—', first.note);
  return record(list, rel, fn, note, { ...extra, retried: true });
}
/** Hide cookie / consent chrome: any fixed element whose text talks about cookies and that is not the whole viewport. */
async function hideConsent(page) {
  return page.evaluate(() => {
    const hidden = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.width * r.height > innerWidth * innerHeight * 0.6) continue;
      if (!/cookie|témoin|consent|accepter|accept all|tout accepter/i.test(el.innerText || '')) continue;
      el.style.setProperty('display', 'none', 'important');
      hidden.push((el.className && String(el.className).slice(0, 60)) || el.tagName);
    }
    return hidden;
  });
}
/** A full-viewport fixed overlay that is still opaque = a loader (or a menu) is up. Resolves with the ms waited, or null. */
async function waitOverlayGone(page, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const covered = await page.evaluate(() => {
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.5) continue;
        if (cs.pointerEvents === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9 && r.top <= 0 + 1 && r.left <= 1) return true;
      }
      return false;
    }).catch(() => false);
    if (!covered) return Date.now() - t0;
    await page.waitForTimeout(100);
  }
  return null;
}
async function k3Context(browser, vpName, extra = {}) {
  const ctx = await browser.newContext({ ...VIEWPORTS[vpName], ...extra });
  await ctx.addInitScript(HELPERS);
  return ctx;
}
/** Scroll to y, settle, viewport screenshot. Notes the real scroll position so a Lenis fight shows up in the manifest. */
async function shotAt(page, list, rel, y, wait, note) {
  return record2(list, rel, async (abs) => {
    const got = await page.evaluate((y) => __h.to(y), y);
    await page.waitForTimeout(wait);
    const now = await page.evaluate(() => __h.scroll());
    await page.screenshot({ path: abs });
    const drift = Math.abs(now - Math.max(0, Math.round(y)));
    return `scroll ${Math.round(y)}${drift > 40 ? ` (landed at ${Math.round(now)} after ${Math.round(got)} — smooth scroll fought back)` : ''}`;
  }, note);
}

async function k3Kott(browser, vpName, censusOut) {
  const list = manifest.k3;
  const vh = VIEWPORTS[vpName].viewport.height;
  const pre = `k3/kott.${vpName}`;
  const ctx = await k3Context(browser, vpName);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  try {
    const loadNote = await gotoSettled(page, KOTT, K3_HIDE_CSS);
    const gone = await waitOverlayGone(page, 12000);
    await page.waitForTimeout(gone == null ? 0 : 800);
    const hidden = await hideConsent(page);
    await prime(page);
    const loaderNote = gone == null ? 'a full-viewport overlay was still up after 12s, shot anyway' : `loader gone ${((gone + 1500) / 1000).toFixed(1)}s after load`;
    await record2(list, `${pre}.full.png`, (abs) => fullPage(page, abs), ['full page, primed', loadNote, loaderNote, hidden.length && `hid ${hidden.join(', ')}`].filter(Boolean).join('; '));
    await shotAt(page, list, `${pre}.top.png`, 0, 900, 'viewport at scroll 0: nav + hero at rest');

    // the pinned hero: the first section ≈ 2.5 × innerHeight (h-[250vh])
    const hero = await page.evaluate(() => {
      const secs = [...document.querySelectorAll('section')];
      const s = secs.find((el) => Math.abs(el.getBoundingClientRect().height / innerHeight - 2.5) < 0.15) || secs[0];
      if (!s) return null;
      const i = secs.indexOf(s);
      const next = secs[i + 1] || null;
      return { top: __h.top(s), height: s.getBoundingClientRect().height, ratio: +(s.getBoundingClientRect().height / innerHeight).toFixed(2), cls: s.className.slice(0, 80), nextTop: next ? __h.top(next) : null, nextText: next ? (next.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40) : '' };
    });
    if (!hero) fail(`${pre}.hero@*.png`, new Error('no <section> on the page'));
    else {
      if (hero.ratio < 2.3 || hero.ratio > 2.7) log(`kott.${vpName}: first section is ${hero.ratio}×vh, not 2.5 — hero frames may be off`);
      const tiles = [];
      for (const p of [0, 0.2, 0.5, 0.8, 1]) {
        const y = hero.top + p * (hero.height - vh);
        const e = await shotAt(page, list, `${pre}.hero@${pct(p)}.png`, y, 900, `pinned hero at progress ${p} (section ${hero.ratio}×vh, top ${Math.round(hero.top)}); 900ms`);
        if (e.ok) tiles.push(path.join(REFS, e.name));
      }
      if (tiles.length) await record2(list, `${pre}.hero.strip.png`, (abs) => hstack(tiles, abs, STRIP_CELL[vpName]), 'hero@00 … hero@100 side by side');
      if (hero.nextTop != null) await shotAt(page, list, `${pre}.work.png`, hero.nextTop - 80, 900, `first section after the hero (“${hero.nextText}”), top − 80px`);
      else fail(`${pre}.work.png`, new Error('no section after the hero'));
    }

    // census
    await page.evaluate(() => __h.to(0));
    await page.waitForTimeout(600);
    censusOut[vpName] = await page.evaluate(() => {
      const leaf = (el) => __h.leaf(el);
      const secs = [...document.querySelectorAll('section')];
      const hero = secs.find((el) => Math.abs(el.getBoundingClientRect().height / innerHeight - 2.5) < 0.15) || secs[0];
      const inHero = (sel) => (hero ? [...hero.querySelectorAll(sel)] : [...document.querySelectorAll(sel)]);
      const vis = (el) => __h.visible(el);
      const display = inHero('[class*="font-display"]').filter(vis).sort((a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize));
      const accent = inHero('.text-accent').filter(vis);
      const copyWrap = inHero('[class*="bottom-28"]')[0] || null;
      const copyLines = copyWrap ? [...copyWrap.querySelectorAll('p, span, div')].filter((el) => vis(el) && el.children.length === 0 && (el.textContent || '').trim()) : [];
      // the bottom bar: the lowest absolutely-positioned block in the hero's sticky frame that is not the copy block
      const bars = inHero('[class*="bottom-"]').filter((el) => vis(el) && el !== copyWrap && !copyWrap?.contains(el));
      const bar = bars.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0] || null;
      const barItems = bar ? [...bar.querySelectorAll('*')].filter((el) => vis(el) && el.children.length === 0 && (el.textContent || '').trim()) : [];
      const nav = [...document.querySelectorAll('header a')].filter(vis);
      const header = document.querySelector('header');
      return {
        url: location.href, viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
        heroSection: hero ? { className: hero.className.slice(0, 120), height: Math.round(hero.getBoundingClientRect().height), vhRatio: +(hero.getBoundingClientRect().height / innerHeight).toFixed(2) } : null,
        giantWord: display[0] ? leaf(display[0]) : null,
        fontDisplayOthers: display.slice(1, 6).map(leaf),
        accent: accent.map(leaf),
        copyBlock: copyWrap ? { className: copyWrap.className.slice(0, 140), lines: copyLines.map(leaf) } : null,
        bottomBar: bar ? { className: bar.className.slice(0, 140), items: barItems.map(leaf) } : null,
        header: header ? { className: header.className.slice(0, 140), height: Math.round(header.getBoundingClientRect().height), mixBlendMode: getComputedStyle(header).mixBlendMode, links: nav.map(leaf) } : { links: nav.map(leaf) },
      };
    });
  } finally { await page.close().catch(() => {}); await ctx.close().catch(() => {}); }
}
async function k3KottLoader(browser) {
  const list = manifest.k3;
  const tmp = path.join(REFS, 'k3', 'tmp');
  await fs.mkdir(tmp, { recursive: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: CHROME_UA, recordVideo: { dir: tmp, size: { width: 1440, height: 900 } } });
    const page = await ctx.newPage();
    await page.goto(KOTT, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5600);
    const video = page.video();
    await ctx.close();
    const rec = await video.path();
    const fps = (await probe(rec)).fps || 25;
    const clip = await record2(list, 'k3/kott.loader.webm', async (abs) => { await cutWebm(rec, abs, 0, 5); const p = await probe(abs); return `first 5s from a fresh context (1440×900 @1x); ${p.width}x${p.height} ${p.duration}s`; });
    if (clip.ok) await record2(list, 'k3/kott.loader.strip.png', (abs) => filmstrip(path.join(REFS, clip.name), abs, fps, 0.25, 16, '8x2'));
  } catch (e) { fail('k3/kott.loader.webm', e); }
  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
}

async function k3Gm(browser, vpName, censusOut) {
  const list = manifest.k3;
  const pre = `k3/gm.${vpName}`;
  const ctx = await k3Context(browser, vpName);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  try {
    const loadNote = await gotoSettled(page, GM, K3_HIDE_CSS);
    const hidden = await hideConsent(page);
    await prime(page);
    await hideConsent(page); // the card can mount late
    const find = (re) => page.evaluate((src) => {
      const re = new RegExp(src, 'i');
      const s = [...document.querySelectorAll('section')].find((el) => re.test(el.innerText || ''));
      return s ? { top: __h.top(s), height: s.getBoundingClientRect().height, cls: s.className.slice(0, 80) } : null;
    }, re.source);
    const clients = await find(/CLIENTS\s*&\s*PARTENAIRES/);
    const note = [loadNote, hidden.length && `hid ${hidden.join(', ')}`].filter(Boolean).join('; ');
    if (!clients) fail(`${pre}.clients*.png`, new Error('no section containing "CLIENTS & PARTENAIRES"'));
    else {
      const tiles = [];
      // base = section top − 100 so the heading clears GM's fixed 128px nav; @50/@100 are +400/+800 from that base
      const base = clients.top - 100;
      for (const [name, dy, what] of [['clients', 0, 'section top − 100 (heading clear of the fixed nav)'], ['clients@50', 400, 'base +400px (the wheel turns with scroll)'], ['clients@100', 800, 'base +800px']]) {
        const e = await shotAt(page, list, `${pre}.${name}.png`, base + dy, 900, [`clients wheel: ${what}`, note].filter(Boolean).join('; '));
        if (e.ok) tiles.push(path.join(REFS, e.name));
      }
      if (tiles.length) await record2(list, `${pre}.clients.strip.png`, (abs) => hstack(tiles, abs, STRIP_CELL[vpName]), 'clients, clients@50, clients@100 side by side');
    }
    const stats = await find(/\+12K/);
    if (!stats) fail(`${pre}.stats.png`, new Error('no section containing "+12K"'));
    else await shotAt(page, list, `${pre}.stats.png`, stats.top - 80, 900, 'stats band, section top − 80px');

    // census: the clients section's h2 + p, one card (its inline style attribute) and its image's natural size
    if (clients) {
      await page.evaluate((y) => __h.to(y), clients.top);
      await page.waitForTimeout(700);
      censusOut[vpName] = await page.evaluate(() => {
        const leaf = (el) => __h.leaf(el);
        const sec = [...document.querySelectorAll('section')].find((el) => /CLIENTS\s*&\s*PARTENAIRES/i.test(el.innerText || ''));
        const h2 = sec.querySelector('h2'); const p = sec.querySelector('p');
        const cards = [...sec.querySelectorAll('div[style]')].filter((d) => d.querySelector('img') && d.getBoundingClientRect().width > 40);
        const card = cards[0] || null; const img = card ? card.querySelector('img') : null;
        const wheel = card ? card.parentElement : null;
        return {
          url: location.href, viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
          section: { className: sec.className.slice(0, 120), top: Math.round(__h.top(sec)), height: Math.round(sec.getBoundingClientRect().height) },
          h2: h2 ? leaf(h2) : null, p: p ? leaf(p) : null,
          cardCount: cards.length,
          card: card ? { style: card.getAttribute('style'), className: card.className.slice(0, 140), ...leaf(card), transform: getComputedStyle(card).transform, borderRadius: getComputedStyle(card).borderRadius, boxShadow: getComputedStyle(card).boxShadow } : null,
          wheel: wheel ? { className: wheel.className.slice(0, 140), style: wheel.getAttribute('style'), transform: getComputedStyle(wheel).transform, rect: leaf(wheel).rect } : null,
          img: img ? { src: (img.currentSrc || img.src || '').slice(0, 200), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, rect: leaf(img).rect, objectFit: getComputedStyle(img).objectFit } : null,
        };
      });
    }
  } finally { await page.close().catch(() => {}); await ctx.close().catch(() => {}); }
}

async function k3Lircle(browser, vpName, censusOut) {
  const list = manifest.k3;
  const pre = `k3/lircle.${vpName}`;
  const ctx = await k3Context(browser, vpName);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  try {
    const loadNote = await gotoSettled(page, LIRCLE, K3_HIDE_CSS + '\n' + LIRCLE_BLUE_CSS);
    const hidden = await hideConsent(page);
    // lircle runs Lenis on the document (only the class is global). A programmatic jump is honoured once
    // scroll-behavior is auto; __h.to falls back to window.scrollTo because no instance is reachable.
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    await prime(page);
    const note = [loadNote, hidden.length && `hid ${hidden.join(', ')}`, 'recoloured --g → #0029FF'].filter(Boolean).join('; ');
    const tops = await page.evaluate(() => {
      const t = (sel) => { const el = document.querySelector(sel); return el ? __h.top(el) : null; };
      return { services: t('#services'), footer: t('footer'), collab: t('#collabSec'), about: t('#about') };
    });
    for (const [name, key, dy, what] of [['services', 'services', -20, 'section#services top at −20'], ['collab', 'collab', 0, 'section#collabSec top at 0'], ['about', 'about', 0, 'section#about top at 0']]) {
      if (tops[key] == null) { fail(`${pre}.${name}.png`, new Error(`no ${key} element`)); continue; }
      await shotAt(page, list, `${pre}.${name}.png`, tops[key] + dy, 1000, [what, note].filter(Boolean).join('; '));
    }
    // the footer is shot whole when it is taller than the viewport (mobile), so the critic sees the wordmark through the
    // bottom bar — the same element-screenshot rule shoot.mjs applies to ours; a footer that fits stays a viewport shot
    if (tops.footer == null) fail(`${pre}.footer.png`, new Error('no footer element'));
    else {
      const vh = VIEWPORTS[vpName].viewport.height;
      const fh = await page.evaluate(() => document.querySelector('footer').getBoundingClientRect().height);
      if (fh > vh) {
        // not locator.screenshot(): that re-scrolls to fit the element and catches lircle's scroll-linked wordmark reveal
        // mid-way (grey). Growing the viewport to the footer's height with its top at 0 keeps the old viewport-shot
        // framing (fixed Menu pill included) and lets the reveal settle.
        await record2(list, `${pre}.footer.png`, async (abs) => {
          const vw = VIEWPORTS[vpName].viewport.width;
          const h = Math.min(Math.ceil(fh) + 2, 6000);
          await page.setViewportSize({ width: vw, height: h });
          await page.waitForTimeout(400);
          const top = await page.evaluate(() => __h.top(document.querySelector('footer')));
          await page.evaluate((y) => __h.to(y), top);
          await page.waitForTimeout(1200);
          try { await page.screenshot({ path: abs, clip: { x: 0, y: 0, width: vw, height: h } }); }
          finally { await page.setViewportSize({ width: vw, height: vh }); await page.waitForTimeout(300); }
          return `mode element: footer ${Math.round(fh)}px tall (> ${vh}px viewport), shot whole via a ${h}px-tall viewport with the footer top at 0`;
        }, ['footer element screenshot', note].filter(Boolean).join('; '));
      } else await shotAt(page, list, `${pre}.footer.png`, tops.footer, 1000, [`footer top at 0 (mode viewport: footer ${Math.round(fh)}px fits the ${vh}px viewport)`, note].filter(Boolean).join('; '));
    }
    if (vpName === 'desktop' && tops.services != null) {
      await record2(list, `${pre}.services.hover.png`, async (abs) => {
        await page.evaluate((y) => __h.to(y), tops.services - 20);
        await page.waitForTimeout(1000);
        const row = page.locator('.svc-row').nth(1);
        const box = await row.boundingBox();
        if (!box) throw new Error('second .svc-row has no box');
        await page.mouse.move(box.x + box.width * 0.35, box.y + box.height / 2, { steps: 6 });
        await page.waitForTimeout(700);
        await page.screenshot({ path: abs });
        const float = await page.evaluate(() => { const f = document.querySelector('#svcFloat, .svc-float'); if (!f) return 'no #svcFloat'; const cs = getComputedStyle(f); const r = f.getBoundingClientRect(); return `#svcFloat opacity ${cs.opacity}, ${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.x)},${Math.round(r.y)}`; });
        return `mouse at ${Math.round(box.x + box.width * 0.35)},${Math.round(box.y + box.height / 2)}; ${float}`;
      }, ['second .svc-row hovered 700ms (floating image + tinted row)', note].filter(Boolean).join('; '));
      await page.mouse.move(5, 5);
    }

    // census + the raw rules for .svc*, .ft-*, footer — the builder reads sizes and tracking from here
    await page.evaluate((y) => __h.to(y), tops.services != null ? tops.services - 20 : 0);
    await page.waitForTimeout(600);
    censusOut[vpName] = await page.evaluate(() => {
      const leaf = (el) => __h.leaf(el);
      const sels = ['.sec-lbl', '.sec-h', '.svc-name', '.svc-n', 'footer .ft-grid p', 'footer h4', 'footer a'];
      const items = [];
      for (const sel of sels) [...document.querySelectorAll(sel)].slice(0, 4).forEach((el, i) => items.push({ selector: sel, index: i, ...leaf(el) }));
      const rows = [...document.querySelectorAll('.svc-row')].map((el, i) => ({ index: i, ...leaf(el), selector: `.svc-row:nth-child(${i + 1})`, name: (el.querySelector('.svc-name')?.textContent || '').trim().slice(0, 60) }));
      return { url: location.href, viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio }, accent: getComputedStyle(document.documentElement).getPropertyValue('--g').trim(), items, svcRows: rows };
    });
    if (!censusOut.rules) {
      censusOut.rules = await page.evaluate(() => {
        const out = [];
        const walk = (rules, media) => {
          for (const r of rules) {
            if (r.cssRules && r.conditionText !== undefined) { walk(r.cssRules, r.conditionText); continue; }
            const sel = r.selectorText || '';
            if (/^(\.svc|\.ft-|footer)/.test(sel) || /,\s*(\.svc|\.ft-|footer)/.test(sel)) out.push({ selector: sel, media: media || null, cssText: r.cssText });
          }
        };
        for (const sheet of document.styleSheets) { try { walk(sheet.cssRules, null); } catch (e) { out.push({ error: `cross-origin: ${sheet.href}` }); } }
        return out;
      });
    }
  } finally { await page.close().catch(() => {}); await ctx.close().catch(() => {}); }
}

async function k3(browser) {
  await fs.mkdir(path.join(REFS, 'k3', 'meta'), { recursive: true });
  const vps = K3_VPS();
  const wantSite = (s) => !SITE_FILTER.length || SITE_FILTER.includes(s);
  // SITES=lircle reruns one site and keeps the other sites' rows from the previous manifest
  if (SITE_FILTER.length) manifest.k3.push(...prevK3.filter((e) => !SITE_FILTER.some((s) => e.name.startsWith(`k3/${s}.`) || e.name.startsWith(`k3/meta/${s}.`))));
  const kottCensus = {}, gmCensus = {}, lircleCensus = {};
  const site = async (label, fn) => { const t = Date.now(); try { await fn(); } catch (e) { fail(label, e, 'site procedure aborted'); } log(`${label} — ${((Date.now() - t) / 1000).toFixed(0)}s`); };
  if (wantSite('kott')) {
    await site('k3/kott.loader', () => k3KottLoader(browser));
    for (const vp of vps) await site(`k3/kott.${vp}`, () => k3Kott(browser, vp, kottCensus));
    await record2(manifest.k3, 'k3/meta/kott.census.json', (abs) => fs.writeFile(abs, JSON.stringify(kottCensus, null, 2)), 'giant word, .text-accent, copy lines, bottom bar items, header links — computed styles per viewport');
  }
  if (wantSite('gm')) {
    for (const vp of vps) await site(`k3/gm.${vp}`, () => k3Gm(browser, vp, gmCensus));
    await record2(manifest.k3, 'k3/meta/gm.census.json', (abs) => fs.writeFile(abs, JSON.stringify(gmCensus, null, 2)), 'clients section h2/p, one card (style attribute, transform), its img natural size — per viewport');
  }
  if (wantSite('lircle')) {
    for (const vp of vps) await site(`k3/lircle.${vp}`, () => k3Lircle(browser, vp, lircleCensus));
    lircleCensus.injectedCss = LIRCLE_BLUE_CSS;
    await record2(manifest.k3, 'k3/meta/lircle.css.json', (abs) => fs.writeFile(abs, JSON.stringify(lircleCensus, null, 2)), '.sec-lbl/.sec-h/.svc-name/.svc-n/footer computed styles per viewport + every rule for .svc*, .ft-*, footer');
    await record2(manifest.k3, 'k3/meta/lircle.candidates.json', (abs) => fs.writeFile(abs, JSON.stringify({ svcRows: lircleCensus.desktop?.svcRows || lircleCensus.mobile?.svcRows || [], hoverSelector: '.svc-row:nth-child(2)' }, null, 2)), 'the .svc-row list (selector, name, box) so the builder can pin the hover row');
  }
}

// ---------------------------------------------------------------- README
async function writeReadme() {
  const md = `# refs/ — reference captures for the head-uz redesign gauntlet

Generated by \`scripts/capture-refs.mjs\` (first run ${manifest.capturedAt}${manifest.updatedAt ? `, last update ${manifest.updatedAt}` : ''}). Nothing in here is hand-made; rerun the script to refresh.
Partial reruns: \`ONLY=media,motion,axiom,cominvi,k3\` picks phases; \`TIERS=\`, \`VPS=\`, \`PAGES=\`, \`STEPS=full,sections,mid,states,census\` narrow the axiom phase; a partial run merges into the existing MANIFEST.
Screenshot cadence: a 1440×900 PNG takes ~100–150ms, so the \`every ~100ms\` frame folders run at ~140–220ms per frame — each entry's note carries its real \`t=\`; the \`.webm\` recordings are the true 25fps sources.
\`MANIFEST.json\` lists every expected file with \`ok\`/\`bytes\`/\`note\`, and \`failed[]\` collects everything that could not be captured.

## Reference 1 — https://axiom-power-template.webflow.io/

Pages: ${PAGES.map(([n, p]) => `\`${n}\` → \`${p}\``).join(', ')}.
Viewports: \`desktop\` 1440×900 @2x (Chrome UA), \`mobile\` 390×844 @2x (iPhone UA, touch).

| path | what |
|---|---|
| \`raw/<page>.<vp>.full.png\` | untouched full-page screenshot, after every scroll trigger was primed (stepped through the page one viewport at a time, then \`ScrollTrigger.refresh()\`, back to top) |
| \`raw/<page>.<vp>.<section>.png\` | settled crop of one \`section[class*="section_"]\` / \`footer.footer\`, named by its \`section_*\` class, taken with the section scrolled to top − 80px after 1200ms |
| \`raw/<page>.<vp>.<section>.vp.png\` | the viewport at that same scroll position (what a visitor sees) |
| \`raw/<page>.<vp>.hero.mid1.png\` | hero scrolled by 45% of the viewport height |
| \`raw/<page>.<vp>.statement.mid1..3.png\` | statement panel with its top at 70% / 40% / 10% of the viewport |
| \`raw/<page>.<vp>.cpb.mid1.png\` | capabilities with the sticky rail on card 2 |
| \`raw/<page>.desktop.state.mega.png\` | \`.nav_dropdown-toggle\` hovered 600ms — the mega menu |
| \`raw/<page>.desktop.state.nav-roll.png\` | second \`.nav_link\` hovered, shot at 150ms — the two-row text roll mid-flight |
| \`raw/<page>.desktop.state.btn-roll.png\` | first visible \`.button_component\` hovered, shot at 150ms |
| \`raw/<page>.desktop.state.card-hover.png\` | first \`.image_card\` hovered 800ms (pages that have one) |
| \`raw/<page>.mobile.state.menu-open.png\` | \`.menu_button\` tapped, 700ms |
| \`blue/…\` | the same set with the brand recoloured to blue (CSS below) |
| \`meta/<page>.<vp>.census.json\` | computed styles + boxes for the first 3 matches of each census selector, plus the section list |
| \`motion/home.recording.webm\` | the whole 1440×900 recording (hero idle 4s → \`.section_tst\` with its logo row \`.client_row\` fully in frame, idle 6s → reload → \`.section_cpb\` idle 3s) |
| \`motion/hero.webm\`, \`marquee.webm\`, \`cpb.webm\` | cut from it |
| \`motion/<name>.strip.png\` | 8-frame filmstrip of each clip (0.5s apart; cpb is 3s long so its frames are 0.375s apart) |
| \`media/hero-bg.{mp4,webm}\`, \`hero-bg_poster.jpg\` | the hero background video, downloaded from the \`data-video-urls\` on the home page |
| \`media/perf.{mp4,webm}\`, \`perf_poster.jpg\` | the performance-section background video |

### CSS injected on every page (both tiers)

\`\`\`css
${HIDE_CSS}
\`\`\`

### CSS injected additionally for the \`blue/\` tier

\`\`\`css
${BLUE_CSS}
\`\`\`

\`:root *\` with \`!important\` because Webflow's variable modes re-declare the whole brand palette on
\`.section_statement\`, \`.footer\`, \`.button_arrow-box\`, \`.section_measurement\` and \`.section_footprint\` themselves
(\`--_theme---brand-colors--brand-500:#ff4d00\` …), so a \`:root\`-only override leaves those surfaces orange.

### Census selectors

\`${CENSUS_SELECTORS.join('`, `')}\`

Fields per element: \`selector, index, tag, className, rect{x,y,w,h} (document coordinates), fontSize, lineHeight, letterSpacing, fontWeight, fontFamily, padding, gap, filter, backdropFilter, borderRadius, backgroundColor, color, text\`.

### Scrolling

On axiom \`lenis\` is a top-level \`const\` in an inline script; the script reaches it through the global lexical scope and calls
\`lenis.scrollTo(y, {immediate:true, force:true})\`, falling back to \`window.scrollTo\` where Lenis is not running (mobile).
If a full-page screenshot came out blank below the fold, the script calls \`lenis.destroy()\` and retries (noted in the manifest).

## Reference 2 — https://www.cominvi.com.mx/ (motion reference, desktop 1440×900 @1x only)

| path | what |
|---|---|
| \`cominvi/loader/f000…png\` | the preloader: one viewport screenshot every ~100ms for 4s from the navigation commit (each note carries the real t=) |
| \`cominvi/loader.webm\`, \`loader.strip.png\` | the first 5s recorded as video in a fresh context, and a 16-frame filmstrip 0.25s apart (8×2) |
| \`cominvi/loader-exit.webm\`, \`loader-exit.strip.png\` | the first 8s of the same recording — \`.loader\` only leaves at ~5.9s, so this is where the exit is; 16 frames 0.5s apart |
| \`cominvi/hero-reveal/f000…png\` | every ~100ms for 2s from the moment \`.loader\` is gone — in practice the hero is already settled by then: the reveal *is* the loader's exit (logo grows, the hero scales up inside a frame with a masked headline, 5.5–6.5s after navigation), which \`loader-exit.webm\` holds |
| \`cominvi/tr-90.png\`, \`tr-70.png\`, \`tr-50.png\` | the first \`[tr="1"]\` paragraph below the fold with its top at 90 / 70 / 50% of the viewport, 400ms after the jump, on a page that was not primed (so the reveal is live) |
| \`cominvi/cylinder-0…75.png\` | \`.cylindar__wrapper\` pinned; scroll = pin start + 0 / 25 / 50 / 75% of the pinned distance measured from its \`.pin-spacer\` |
| \`cominvi/full.desktop.png\` | full page, everything primed, after unwrapping the Lenis wrapper (\`.page-wrap\`) so the document is tall |
| \`cominvi/full.desktop.stitched.png\` | the same page stitched from viewport tiles at 900px scroll steps — the honest alternative when unwrapping changes the layout |
| \`cominvi/transition/f000…png\` | every ~100ms for 1.5s after clicking the "Our services" card (\`a.card[href="/our-services"]\`) |

cominvi scrolls a wrapper element through Lenis (\`window.lenis\`); \`window.scrollTo\` does nothing there, so every jump is
\`window.lenis.scrollTo(y, {immediate:true})\` and element positions are \`rect.top + lenis.scroll\`.

## Reference 3 — the wave-07 bar (\`k3/\`, phase \`ONLY=k3\`): kott.studio · lesgmstudios.com · lircle.co

Both viewports (\`desktop\` 1440×900 @2x, \`mobile\` 390×844 @2x) unless noted; \`SITES=kott,gm,lircle\` and \`VPS=\` narrow a rerun; the pieces in \`scripts/progress.mjs\` (K00–K03, L01–L03, G01–G02, S01–S04, X01) point at these files.
Every still is a viewport screenshot after a scroll jump through \`__h.to\` and a 900–1000ms settle; the manifest note says where the page really landed when smooth scrolling fought back.
Site chrome that is not the craft under judgement is hidden first: \`${K3_HIDE_CSS}\`, plus any fixed cookie/consent card (found by its text).

| path | from | what |
|---|---|---|
| \`k3/kott.<vp>.full.png\` | https://kott.studio/ | full page after the loader finished (a full-viewport fixed overlay is gone) and every section was primed |
| \`k3/kott.<vp>.top.png\` | kott | viewport at scroll 0: nav + hero at rest (K03 nav crop comes from here) |
| \`k3/kott.<vp>.hero@00 … @20 … @50 … @80 … @100.png\` | kott | the pinned hero (first \`section\`, height ≈ 2.5 × innerHeight) at progress p: scroll = sectionTop + p · (sectionHeight − innerHeight), 900ms |
| \`k3/kott.<vp>.hero.strip.png\` | kott | the five hero frames side by side (K02) |
| \`k3/kott.<vp>.work.png\` | kott | the first section after the hero ("Work that works."), top − 80px (S01) |
| \`k3/kott.loader.webm\`, \`kott.loader.strip.png\` | kott | the first 5s from a fresh 1440×900 @1x context with recordVideo; 16 frames 0.25s apart, 8×2 (K00) |
| \`k3/gm.<vp>.clients.png\`, \`clients@50.png\`, \`clients@100.png\` | https://www.lesgmstudios.com/ | the "CLIENTS & PARTENAIRES" section with its top at −100 (heading clear of the fixed 128px nav), then +400px and +800px from there — the wheel turns with scroll (G01/G02) |
| \`k3/gm.<vp>.clients.strip.png\` | GM | the three offsets side by side |
| \`k3/gm.<vp>.stats.png\` | GM | the "+12K" stats band, top − 80px (S03) |
| \`k3/lircle.<vp>.services.png\` | https://lircle.co/ | \`section#services\` top at −20 (L01) |
| \`k3/lircle.desktop.services.hover.png\` | lircle | desktop only: the second \`.svc-row\` hovered 700ms — the floating image (\`#svcFloat\`) and the tinted row (L02) |
| \`k3/lircle.<vp>.collab.png\` | lircle | \`section#collabSec\` top at 0 (S02 marquee) |
| \`k3/lircle.<vp>.about.png\` | lircle | \`section#about\` top at 0 (S04) |
| \`k3/lircle.<vp>.footer.png\` | lircle | \`footer\` top at 0 when it fits the viewport (desktop), the whole \`footer\` element when it is taller (mobile) — the note says which (L03) |
| \`k3/meta/kott.census.json\` | kott | per viewport: the giant \`font-display\` word, the \`.text-accent\` span, the copy lines (the \`bottom-28\` block), the bottom-bar items, \`header a\` — fontFamily/size/weight/tracking/colour + boxes |
| \`k3/meta/gm.census.json\` | GM | per viewport: the clients section's h2 + p, one card div (its \`style\` attribute + transform), its img naturalWidth/Height |
| \`k3/meta/lircle.css.json\` | lircle | per viewport: \`.sec-lbl, .sec-h, .svc-name, .svc-n, footer .ft-grid p, footer h4, footer a\` computed styles; \`rules[]\` = the cssText of every rule whose selector starts with \`.svc\`, \`.ft-\` or \`footer\` (cross-origin sheets are listed as errors) |
| \`k3/meta/lircle.candidates.json\` | lircle | the \`.svc-row\` list (nth-child selector, name, box) so the builder can pin the hover row |

### lircle recolour (injected before every lircle capture)

lircle's accent is one custom property (\`--g\`); the extra rules cover the two hard-coded greens found in its stylesheet (the \`.svc-row::before\` hover tint and the footer wordmark, a \`.webp\` raster whose leaf is turned blue with \`hue-rotate(84deg)\`), so critics judge craft, not hue.

\`\`\`css
${LIRCLE_BLUE_CSS}
\`\`\`

### Scrolling on the three sites

kott exposes \`window.lenis\`, so \`__h.to\` goes through \`lenis.scrollTo(y, {immediate:true, force:true})\`. GM has no Lenis (\`window.scrollTo\`).
lircle only exposes the \`Lenis\` class, so the script sets \`document.documentElement.style.scrollBehavior='auto'\` and uses \`window.scrollTo\`, waiting 1s; a fight shows up as "landed at …" in the manifest note.
`;
  await fs.writeFile(path.join(REFS, 'README.md'), md);
}

// ---------------------------------------------------------------- main
async function main() {
  for (const d of ['raw', 'blue', 'motion', 'media', 'meta', 'cominvi', 'k3', 'k3/meta']) await fs.mkdir(path.join(REFS, d), { recursive: true });
  const want = (k) => !ONLY.length || ONLY.includes(k);
  let prevPages = {};
  if (PARTIAL) { // a partial run keeps what it does not redo: skipped phases, and files a filtered axiom run did not touch
    const prev = await fs.readFile(path.join(REFS, 'MANIFEST.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (prev) {
      for (const k of ['media', 'motion', 'cominvi', 'k3']) if (!want(k)) manifest[k] = prev[k] || [];
      prevK3 = prev.k3 || [];
      prevPages = prev.pages || {};
      if (!want('axiom')) manifest.pages = prevPages;
      prevFailed = prev.failed || [];
      manifest.capturedAt = prev.capturedAt || manifest.capturedAt;
      manifest.updatedAt = new Date().toISOString();
    }
  }
  const stepOfName = (n) => (/\.state\./.test(n) ? 'states' : /\.mid\d+\.png$/.test(n) ? 'mid' : /\.full\.png$/.test(n) ? 'full' : /^meta\//.test(n) ? 'census' : 'sections');
  const tierOfName = (n) => (/^meta\//.test(n) ? 'raw' : n.split('/')[0]);
  const mergePages = () => {
    for (const [p, vps] of Object.entries(prevPages)) for (const [vp, x] of Object.entries(vps)) {
      const cur = bucketFor(p, vp); const names = new Set(cur.map((f) => f.name));
      const redone = (f) => processed.has(`${tierOfName(f.name)}/${p}.${vp}`) && step(stepOfName(f.name));
      manifest.pages[p][vp].files = [...(x.files || []).filter((f) => !names.has(f.name) && !redone(f)), ...cur];
    }
  };
  const browser = await chromium.launch();
  try {
    if (want('media')) { log('media: downloading the two background videos'); await media(browser).catch((e) => fail('media', e)); rebuildFailed(want); await saveManifest(); }
    if (want('motion')) { log('motion: recording home'); await motion(browser).catch((e) => fail('motion', e)); rebuildFailed(want); await saveManifest(); }
    if (want('axiom')) {
      log('axiom: 4 workers (raw/blue × desktop/mobile), 7 pages each');
      const tiers = Object.keys(TIERS).filter((t) => !TIER_FILTER.length || TIER_FILTER.includes(t));
      const vps = Object.keys(VIEWPORTS).filter((v) => !VP_FILTER.length || VP_FILTER.includes(v));
      await Promise.all(tiers.flatMap((tier) => vps.map((vp) => axiomWorker(browser, tier, vp).catch((e) => fail(`${tier}/${vp} worker`, e)))));
      mergePages();
      rebuildFailed(want);
      await saveManifest();
    }
    if (want('cominvi')) { log('cominvi'); await cominvi(browser).catch((e) => fail('cominvi', e)); rebuildFailed(want); await saveManifest(); }
    if (want('k3')) { log('k3: kott / GM / lircle'); await k3(browser).catch((e) => fail('k3', e)); rebuildFailed(want); await saveManifest(); }
  } finally {
    await browser.close().catch(() => {});
  }
  await writeReadme();
  rebuildFailed(want);
  await saveManifest();
  let ok = 0, bad = 0;
  const count = (arr) => arr.forEach((f) => (f.ok ? ok++ : bad++));
  for (const p of Object.values(manifest.pages)) for (const v of Object.values(p)) count(v.files);
  count(manifest.motion); count(manifest.media); count(manifest.cominvi); count(manifest.k3);
  log(`done — ${ok} ok, ${bad} failed (${manifest.failed.length} entries in failed[]), ${((Date.now() - T0) / 60000).toFixed(1)} min`);
}
main().catch((e) => { console.error(e); process.exit(1); });
