#!/usr/bin/env node
// scripts/shoot.mjs — capture stills (or motion clips) of our site or the Axiom reference for a gauntlet wave.
//
//   node scripts/shoot.mjs --wave 01 --target ours                       # every page/locale/viewport/section
//   node scripts/shoot.mjs --wave 01 --target ref --pages home --viewports desktop --sections section_hero,section_statement
//   node scripts/shoot.mjs --wave 01 --target ours --motion              # preloader/hero/statement/team/offer/clients recordings
//   node scripts/shoot.mjs --wave 07 --target ours --pages home --sections hero        # + hero@00..hero@100 frames + strip
//   node scripts/shoot.mjs --wave 07 --target ours --pages home --sections offer --state hover   # offer.hover
//
// Output: workbench/shots/<wave>/<target>/<page>.<locale>.<viewport>.<capture>.png and manifest.json.
// The manifest is merged on rerun (same page/locale/viewport/capture replaces the old row).

import { chromium, devices } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, statSync, rmSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg';
const FFPROBE = process.env.FFPROBE || FFMPEG.replace(/ffmpeg$/, 'ffprobe');

const PAGES = {
  home: { ours: '/', ref: '/' },
  consulting: { ours: '/consulting', ref: '/platform' },
  team: { ours: '/team', ref: '/company' },
};
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent,
  },
};
const DEFAULT_BASE = { ours: 'http://127.0.0.1:5173', ref: 'https://axiom-power-template.webflow.io' };

const FREEZE_CSS =
  '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;scroll-behavior:auto!important}';
const REF_CSS = [
  // Webflow re-declares the whole variable set on element "modes" (.footer, .statement_bg, buttons …),
  // so a :root-only override loses — apply to every element with !important (verified 2026-09-15).
  ':root,:root *{--_theme---brand-colors--brand-200:#c9d6ff!important;--_theme---brand-colors--brand-400:#6B8CFF!important;--_theme---brand-colors--brand-500:#1d5be0!important;--_theme---brand-colors--brand-600:#2B4FD6!important;--_theme---brand-colors--brand-700:#123fa8!important;--_theme---brand-colors--brand-800:#0a1f5c!important}',
  'img,video,[style*="background-image"]{filter:hue-rotate(200deg)}',
  '.ctm-box,#awwwards,.w-webflow-badge,.section_news{display:none!important}',
].join('\n');

const MOTION_NAMES = ['preloader', 'hero', 'statement', 'team', 'offer', 'clients'];
const HERO_DEFAULT = [0, 0.2, 0.5, 0.8, 1];
const STRIP_CELL = { desktop: 576, mobile: 390 }; // px per strip cell → a 5-cell desktop strip is 2880 wide, like one 2x still
// headless Chromium has no GPU: route WebGL through SwiftShader so the three.js hero renders instead of the SVG fallback
const OURS_LAUNCH_ARGS = ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];

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
const list = (v, dflt) => (v === undefined || v === true ? dflt : String(v).split(',').map((s) => s.trim()).filter(Boolean));

function help() {
  console.log(`shoot.mjs — capture gauntlet stills / motion clips

  node scripts/shoot.mjs --wave 01 --target ours|ref [options]

options
  --wave <id>           wave id, used as the output folder (required)
  --target ours|ref     our dev build or the Axiom reference (required)
  --pages a,b           ${Object.keys(PAGES).join(',')} (default: all)
  --locales a,b         uz,ru,en (default: all for ours; ref is always "en")
  --viewports a,b       desktop,mobile (default: both)
  --sections a,b        only these section ids (ours: data-section; ref: section_* class or footer)
  --hero p,p,…          ours+home: hero frames at these progress values via ?motion=off&hero=<p> (default ${HERO_DEFAULT.join(',')}
                        whenever the hero is among the sections shot; --hero none disables) → hero@00…hero@100 + hero.strip
  --state hover         ours: hover the first [data-section="offer"] [data-row] (fallback: its first li) 700ms
                        and shoot the section as "offer.hover" instead of "offer"
  --query k=v,k2=v2     extra query parameters appended to every ours URL (after ?motion=off)
  --base <url>          default ours=${DEFAULT_BASE.ours}  ref=${DEFAULT_BASE.ref}
  --motion              ours only: record ${MOTION_NAMES.join('/')} with recordVideo instead of stills
                        (--sections narrows the list; hero wheels 2.5×vh in 20 steps over ~6s, team scrolls its section)
  --headed              show the browser
  --help

output
  workbench/shots/<wave>/<target>/<page>.<locale>.<viewport>.<capture>.png   capture = full | top | <section id> | hero@<pp> | hero.strip | offer.hover
  workbench/shots/<wave>/<target>/motion/<name>.webm + <name>.strip.png, motion/loader/f000..f050.png (10 fps)
  workbench/shots/<wave>/<target>/manifest.json   (each row carries mode: page | viewport | element | element-clip | strip)
  THREE./WebGL console messages from our page go to stderr during ours captures`);
}

// ---------------------------------------------------------------- helpers
const rel = (p) => relative(ROOT, p);

function pageUrl(target, base, page, locale, query = '') {
  const path = PAGES[page][target];
  if (target === 'ref') return base + path;
  const prefix = locale === 'uz' ? '' : `/${locale}`;
  const p = path === '/' ? prefix || '/' : prefix + path;
  return `${base}${p}?motion=off${query ? '&' + query : ''}`;
}
/** "k=v,k2=v2" → "k=v&k2=v2" (values are encoded, keys kept). */
function parseQuery(v) {
  if (!v || v === true) return '';
  return String(v).split(',').map((s) => s.trim()).filter(Boolean).map((kv) => {
    const i = kv.indexOf('=');
    return i < 0 ? encodeURIComponent(kv) : `${kv.slice(0, i)}=${encodeURIComponent(kv.slice(i + 1))}`;
  }).join('&');
}
const pp = (p) => String(Math.round(p * 100)).padStart(2, '0'); // 0 → 00, .2 → 20, 1 → 100

/** THREE./WebGL messages from our page → stderr, so a SwiftShader fallback or a lost context is visible in the run log. */
function tapConsole(page, label) {
  page.on('console', (msg) => {
    const t = msg.text();
    if (/THREE\.|WebGL/i.test(t)) console.error(`  [${label}] ${msg.type()}: ${t.slice(0, 300)}`);
  });
  page.on('pageerror', (e) => { if (/THREE\.|WebGL/i.test(String(e))) console.error(`  [${label}] pageerror: ${String(e).slice(0, 300)}`); });
}

function ffStrip(tiles, dest, cellW) {
  const args = [];
  for (const t of tiles) args.push('-i', t);
  const scaled = tiles.map((_, i) => `[${i}:v]scale=${cellW}:-2,pad=iw+4:ih:0:0:#e9e6df[s${i}]`).join(';');
  const inputs = tiles.map((_, i) => `[s${i}]`).join('');
  ff([...args, '-filter_complex', `${scaled};${inputs}hstack=inputs=${tiles.length}`, '-frames:v', '1', dest]);
}

async function reachable(url) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow' });
    clearTimeout(t);
    return r.ok || (r.status >= 300 && r.status < 400);
  } catch {
    return false;
  }
}

function loadManifest(file) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

function saveManifest(file, meta, rows) {
  const prev = loadManifest(file);
  const key = (r) => `${r.page}|${r.locale}|${r.viewport}|${r.capture}`;
  const map = new Map((prev?.files || []).map((r) => [key(r), r]));
  for (const r of rows) map.set(key(r), r);
  const files = [...map.values()].sort((a, b) => key(a).localeCompare(key(b)));
  const out = { ...meta, capturedAt: new Date().toISOString(), files };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  return out;
}

async function settle(page, target) {
  await page.addStyleTag({ content: FREEZE_CSS });
  if (target === 'ref') {
    await page.addStyleTag({ content: REF_CSS });
    await page.evaluate(() => {
      try { window.lenis?.destroy?.(); } catch {}
      // a top-level `const lenis` lives in the global lexical scope and is visible here
      try { if (typeof lenis !== 'undefined' && lenis && typeof lenis.destroy === 'function') lenis.destroy(); } catch {}
      document.querySelectorAll('video').forEach((v) => { try { v.pause(); v.autoplay = false; } catch {} });
    });
  }
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(800);
}

async function scrollThrough(page, vh) {
  let y = 0;
  for (let guard = 0; guard < 400; guard++) {
    const total = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
    if (y >= total) break;
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(150);
    y += vh;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}

async function tagSections(page, target) {
  return page.evaluate((target) => {
    const els = target === 'ours'
      ? document.querySelectorAll('[data-section]')
      : document.querySelectorAll('section[class*="section_"], footer.footer');
    const seen = new Map();
    const out = [];
    els.forEach((el, i) => {
      let id;
      if (target === 'ours') id = el.getAttribute('data-section') || `section-${i}`;
      else if (el.tagName === 'FOOTER') id = 'footer';
      else id = [...el.classList].find((c) => /^section_[\w-]+$/.test(c)) || `section-${i}`;
      const n = (seen.get(id) || 0) + 1;
      seen.set(id, n);
      if (n > 1) id = `${id}-${n}`;
      el.setAttribute('data-shoot-id', id);
      out.push(id);
    });
    return out;
  }, target);
}

async function screenshotWithFallback(page, opts) {
  try {
    await page.screenshot(opts);
    return '';
  } catch (e) {
    await page.screenshot({ ...opts, scale: 'css' });
    return '1x fallback (2x capture failed: ' + String(e.message).split('\n')[0].slice(0, 80) + ')';
  }
}

// ---------------------------------------------------------------- stills
async function shootPage({ browser, target, base, page: pageName, locale, viewport, sections, outDir, query = '', state = null }) {
  const rows = [];
  const vp = VIEWPORTS[viewport];
  const ctx = await browser.newContext({ ...vp, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  if (target === 'ours') tapConsole(page, `${pageName}.${locale}.${viewport}`);
  const url = pageUrl(target, base, pageName, locale, query);
  const file = (capture) => join(outDir, `${pageName}.${locale}.${viewport}.${capture}.png`);
  let order = 0; // document order of the section on the page (full = -1, top = 0)
  // mode: how the pixels were taken — page (full page), viewport (the 1440×900 / 390×844 window), element (the whole
  // data-section element, however tall — locator.screenshot() scrolls it into view and stitches), element-clip (a very
  // tall element cut at the cap)
  const row = (capture, extra = {}) => {
    const path = file(capture);
    const ok = extra.ok ?? existsSync(path);
    const r = { page: pageName, locale, viewport, capture, order: extra.order ?? order, mode: extra.mode || 'element', path: rel(path), ok, bytes: ok && existsSync(path) ? statSync(path).size : 0, note: extra.note || '' };
    rows.push(r);
    return r;
  };

  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await settle(page, target);
    if (target === 'ours') {
      // a fresh Vite server fires one HMR full reload shortly after load: give it ≥1 s, and if the page came back
      // without its sections (mid-reload), load once more before reading anything
      await page.waitForTimeout(1000);
      const n = await page.evaluate(() => document.querySelectorAll('[data-section]').length).catch(() => 0);
      if (!n) {
        console.warn(`  ! ${url}: no [data-section] after load (HMR reload?) — loading once more`);
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await settle(page, target);
        await page.waitForTimeout(1000);
      }
    }
    await scrollThrough(page, vp.viewport.height);
    if (target === 'ours') {
      const off = await page.evaluate(() => document.documentElement.classList.contains('motion-off'));
      if (!off) console.warn(`  ! ${url}: html.motion-off is not set — reveals may not be at their end state`);
    }

    // full page — at 1x (scale: 'css') for ours: a 2x full-page capture of the WebGL canvas under SwiftShader loses the
    // context and blocks WebGL for the origin for the rest of the browser process (verified by the hero builder)
    {
      const p = file('full');
      const note = target === 'ours'
        ? (await page.screenshot({ path: p, fullPage: true, scale: 'css' }), '1x (scale: css) so the WebGL context survives')
        : await screenshotWithFallback(page, { path: p, fullPage: true });
      row('full', { note, order: -1, mode: 'page' });
    }
    // top of page at scrollY 0
    {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      const p = file('top');
      const note = await screenshotWithFallback(page, { path: p, fullPage: false });
      row('top', { note, mode: 'viewport' });
    }
    // sections
    const found = await tagSections(page, target);
    const wanted = sections
      ? found.filter((id) => sections.some((s) => id === s || id === `section_${s}` || id.replace(/^section_/, '') === s))
      : found;
    if (sections) for (const s of sections) if (!wanted.some((id) => id === s || id === `section_${s}` || id.replace(/^section_/, '') === s)) {
      rows.push({ page: pageName, locale, viewport, capture: s, order: 999, path: rel(file(s)), ok: false, bytes: 0, note: `section not found on page (have: ${found.join(', ') || 'none'})` });
    }
    const vh = vp.viewport.height;
    for (const id of wanted) {
      order = found.indexOf(id) + 1;
      const loc = page.locator(`[data-shoot-id="${id}"]`).first();
      const hover = state === 'hover' && target === 'ours' && id === 'offer';
      const capture = hover ? 'offer.hover' : id;
      const p = file(capture);
      try {
        const visible = await loc.isVisible();
        if (!visible) { row(capture, { ok: false, note: 'hidden' }); continue; }
        await loc.evaluate((el) => el.scrollIntoView({ block: 'start' }));
        if (target === 'ours') {
          // a jump fires no wheel/scrollend for the scroll-sampled chrome (the nav's ground band): nudge it, let two
          // frames run, then settle — so the nav is themed for the section under it before the shot
          await page.evaluate(() => new Promise((res) => {
            window.dispatchEvent(new Event('scroll'));
            requestAnimationFrame(() => requestAnimationFrame(res));
          }));
          await page.waitForTimeout(900);
        } else await page.waitForTimeout(700);
        const box = await loc.boundingBox();
        if (!box || box.width < 2 || box.height < 2) { row(capture, { ok: false, note: 'zero-size box' }); continue; }
        let hoverNote = '';
        if (hover) {
          const rowLoc = loc.locator('[data-row]').first();
          const target_ = (await rowLoc.count()) ? rowLoc : loc.locator('li').first();
          const which = (await rowLoc.count()) ? '[data-row]' : 'li';
          if (await target_.count()) {
            const b = await target_.boundingBox();
            if (b) {
              await page.mouse.move(b.x + b.width * 0.35, b.y + b.height / 2, { steps: 6 });
              await page.waitForTimeout(700);
              hoverNote = `hovered first ${which} at ${Math.round(b.x + b.width * 0.35)},${Math.round(b.y + b.height / 2)}, 700ms`;
            } else hoverNote = `first ${which} has no box — shot without hover`;
          } else hoverNote = 'no [data-row] or li inside the offer section — shot without hover';
          if (!hoverNote.startsWith('hovered')) console.warn(`  ! ${capture}: ${hoverNote}`);
        }
        // a section taller than the viewport is still shot whole (element screenshot); only a freakishly tall one is
        // clipped — ours up to 8 viewport-heights, the reference keeps its old 3
        const cap = (target === 'ours' ? 8 : 3) * vh;
        if (box.height > cap) {
          const abs = await loc.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { x: Math.max(0, r.left + window.scrollX), y: Math.max(0, r.top + window.scrollY), w: r.width };
          });
          const note = await screenshotWithFallback(page, {
            path: p, fullPage: true, clip: { x: abs.x, y: abs.y, width: Math.max(1, abs.w), height: cap },
          });
          row(capture, { mode: 'element-clip', note: [`tall section (${Math.round(box.height)}px): first ${cap / vh} viewport-heights only`, note, hoverNote].filter(Boolean).join('; ') });
        } else {
          let note = box.height > vh ? `element ${Math.round(box.height)}px tall (> ${vh}px viewport), shot whole` : '';
          try { await loc.screenshot({ path: p }); } catch (e) {
            await loc.screenshot({ path: p, scale: 'css' });
            note = [note, '1x fallback (' + String(e.message).split('\n')[0].slice(0, 80) + ')'].filter(Boolean).join('; ');
          }
          row(capture, { mode: 'element', note: [note, hoverNote].filter(Boolean).join('; ') });
        }
        if (hover) await page.mouse.move(2, 2);
      } catch (e) {
        row(capture, { ok: false, note: 'error: ' + String(e.message).split('\n')[0].slice(0, 160) });
      }
    }

  } catch (e) {
    const note = 'page failed: ' + String(e.message).split('\n')[0].slice(0, 160);
    for (const c of ['full', 'top', ...(sections || [])]) rows.push({ page: pageName, locale, viewport, capture: c, order: 999, path: rel(file(c)), ok: false, bytes: 0, note });
  } finally {
    await ctx.close();
  }
  return rows;
}


// ---------------------------------------------------------------- hero frames (ours, home)
// Own fresh browser context, run BEFORE the page's full/top/section captures: a 2x full-page screenshot of the WebGL
// canvas loses the context for the whole browser process, and every later ?hero= frame would fall back to the SVG.
async function shootHeroFrames({ browser, target, base, page: pageName, locale, viewport, outDir, query = '', heroFrames }) {
  const rows = [];
  const vp = VIEWPORTS[viewport];
  const ctx = await browser.newContext({ ...vp, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  tapConsole(page, `${pageName}.${locale}.${viewport}.hero`);
  const url = pageUrl(target, base, pageName, locale, query);
  const file = (capture) => join(outDir, `${pageName}.${locale}.${viewport}.${capture}.png`);
  const row = (capture, extra = {}) => {
    const path = file(capture);
    const ok = extra.ok ?? existsSync(path);
    const r = { page: pageName, locale, viewport, capture, order: 1, mode: capture === 'hero.strip' ? 'strip' : 'viewport', path: rel(path), ok, bytes: ok && existsSync(path) ? statSync(path).size : 0, note: extra.note || '' };
    rows.push(r);
    return r;
  };
  const tiles = [];
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const pr of heroFrames) {
      const capture = `hero@${pp(pr)}`;
      const p = file(capture);
      try {
        await page.goto(`${url}&hero=${pr}`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForSelector('html:not(.preload)', { state: 'attached', timeout: 15000 }).catch(() => console.warn(`  ! ${capture}: html.preload did not clear within 15s`));
        let note = `?hero=${pr}`;
        const seen = await page.waitForFunction(() => document.documentElement.dataset.heroProgress !== undefined, null, { timeout: 6000 }).then(() => true, () => false);
        if (!seen) { note += '; data-hero-progress never appeared (6s) — shot anyway'; console.warn(`  ! ${capture}: ${note}`); }
        else {
          const got = await page.evaluate(() => document.documentElement.dataset.heroProgress);
          note += `; data-hero-progress=${got}`;
          if (Math.abs(Number(got) - pr) > 0.02) { note += ` (expected ${pr})`; console.warn(`  ! ${capture}: data-hero-progress=${got}, expected ${pr}`); }
        }
        const webgl = await page.evaluate(() => document.documentElement.dataset.webgl || '');
        if (webgl === 'no') { note += '; html[data-webgl="no"] — SVG fallback'; console.warn(`  ! ${capture}: WebGL fallback in use`); }
        await page.addStyleTag({ content: FREEZE_CSS });
        await page.evaluate(() => document.fonts.ready).catch(() => {});
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(600);
        const fb = await screenshotWithFallback(page, { path: p, fullPage: false });
        const r = row(capture, { note: [note, fb].filter(Boolean).join('; ') });
        if (r.ok) tiles.push(p);
      } catch (e) {
        row(capture, { ok: false, note: 'error: ' + String(e.message).split('\n')[0].slice(0, 160) });
      }
    }
  } finally {
    await ctx.close();
  }
  const strip = file('hero.strip');
  try {
    if (!tiles.length) throw new Error('no hero frames to stitch');
    ffStrip(tiles, strip, STRIP_CELL[viewport] || 576);
    row('hero.strip', { note: `${tiles.length} frames (${heroFrames.map(pp).join(',')}) side by side, ${STRIP_CELL[viewport] || 576}px cells` });
  } catch (e) {
    row('hero.strip', { ok: false, note: 'strip failed: ' + String(e.message).split('\n')[0].slice(0, 160) });
  }
  return rows;
}

// ---------------------------------------------------------------- motion
function ff(args, { quiet = true } = {}) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').toString().trim().split('\n').pop()}`);
}
function videoFps(file) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', file]);
  const m = (r.stdout || '').toString().trim().match(/^(\d+)(?:\/(\d+))?/);
  if (!m) return 25;
  return Math.max(1, Math.round(Number(m[1]) / Number(m[2] || 1)));
}
function videoDuration(file) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = Number((r.stdout || '').toString().trim());
  return Number.isFinite(d) && d > 0 ? d : 0;
}
/** Wait for the preloader to leave (html.preload cleared) instead of a fixed 5s; warns and continues after `timeout`. */
async function waitPreloadGone(page, timeout = 15000) {
  const ok = await page.waitForFunction(() => !document.documentElement.classList.contains('preload'), null, { timeout }).then(() => true, () => false);
  if (!ok) console.warn(`  ! html.preload still set after ${timeout / 1000}s — recording continues`);
  await page.waitForTimeout(600);
  return ok;
}
/** Wheel the section [data-section=name] from its top through its own height in `steps` steps over `ms`. */
/** travel: 'height' scrolls the whole section through (clients); 'framed' caps it at min(height − innerHeight, 800px)
 *  so the section stays in frame like the GM reference's 0/+400/+800 stills (team). 'through' scrolls height − viewport,
 *  so a sticky-stage section is run from its first frame to its last (team). */
async function wheelSection(page, name, ms = 4000, steps = 20, mark, travel = 'height') {
  const sel = `[data-section="${name}"]`;
  await page.locator(sel).first().waitFor({ state: 'attached' });
  await wheelTo(page, sel, 800, 8);
  // let Lenis finish gliding to the section before the mark, or the strip's first cell is the section above
  await page.waitForFunction((sel) => Math.abs(document.querySelector(sel).getBoundingClientRect().top) < 4, sel, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
  mark?.('scrollStart');
  const { h, vh } = await page.locator(sel).first().evaluate((el) => ({ h: el.getBoundingClientRect().height, vh: innerHeight }));
  const dist = travel === 'framed' ? Math.max(0, Math.min(h - vh, 800)) : travel === 'through' ? Math.max(0, h - vh) : h;
  await page.mouse.move(720, 450);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dist / steps); await page.waitForTimeout(ms / steps); }
  await page.waitForTimeout(500);
  mark?.('end');
  return { h, vh, dist };
}

async function wheelTo(page, selector, ms = 600, steps = 6) {
  const y = await page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().top);
  await page.mouse.move(720, 450);
  const step = y / steps;
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, step); await page.waitForTimeout(ms / steps); }
}

async function recordMotion(browser, name, base, outDir, query = '') {
  const recDir = join(outDir, 'motion', '_rec');
  mkdirSync(recDir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    recordVideo: { dir: recDir, size: { width: 1440, height: 900 } },
  });
  const t0 = Date.now();
  const marks = {};
  const mark = (k) => (marks[k] = +((Date.now() - t0) / 1000).toFixed(2));
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  tapConsole(page, `motion.${name}`);
  let note = ''; // non-empty = the recording failed
  let info = ''; // extra detail for the manifest row
  try {
    await page.goto(base + '/' + (query ? '?' + query : ''), { waitUntil: 'load', timeout: 60000 });
    mark('loaded');
    if (!(await waitPreloadGone(page))) note = 'html.preload never cleared';
    mark('afterHero');
    if (name === 'preloader') { await page.waitForTimeout(2500); mark('end'); } // the glide into the hero + the letters rising
    if (name === 'hero') {
      // scrub the pinned hero: 2.5 × innerHeight in 20 steps over ~6s from the top
      await page.waitForTimeout(600);
      mark('scrollStart');
      const vh = await page.evaluate(() => innerHeight);
      const steps = 20;
      await page.mouse.move(720, 450);
      for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, (2.5 * vh) / steps); await page.waitForTimeout(6000 / steps); }
      await page.waitForTimeout(800);
      mark('end');
    }
    if (name === 'statement') {
      await page.locator('[data-section="statement"]').first().waitFor({ state: 'attached' });
      mark('scrollStart');
      await wheelTo(page, '[data-section="statement"]', 800, 8);
      await page.waitForTimeout(3000);
      mark('end');
    }
    if (name === 'clients') await wheelSection(page, name, 4000, 20, mark, 'height');
    if (name === 'team') { const t = await wheelSection(page, name, 9000, 45, mark, 'through'); info = `travel ${Math.round(t.dist)}px = the whole section (one viewport-height per card)`; }
    if (name === 'offer') {
      // the rows tint/float on hover: bring the list in, then sweep the pointer down the rows
      const sel = '[data-section="offer"]';
      await page.locator(sel).first().waitFor({ state: 'attached' });
      await wheelTo(page, sel, 800, 8);
      await page.waitForTimeout(800);
      mark('scrollStart');
      const rowsLoc = page.locator(`${sel} [data-row]`);
      const items = (await rowsLoc.count()) ? rowsLoc : page.locator(`${sel} li`);
      const n = Math.min(await items.count(), 8);
      if (!n) note = 'no [data-row] or li in the offer section — recorded the rest state only';
      for (let i = 0; i < n; i++) {
        const b = await items.nth(i).boundingBox();
        if (!b) continue;
        await page.mouse.move(b.x + b.width * 0.35, b.y + b.height / 2, { steps: 8 });
        await page.waitForTimeout(700);
      }
      await page.mouse.move(2, 2);
      await page.waitForTimeout(600);
      mark('end');
    }
  } catch (e) {
    note = 'error: ' + String(e.message).split('\n')[0].slice(0, 160);
  }
  const video = page.video();
  await ctx.close();
  const src = await video.path();
  const webm = join(outDir, 'motion', `${name}.webm`);
  renameSync(src, webm);
  rmSync(recDir, { recursive: true, force: true });
  return { webm, marks, note, info };
}

async function shootMotion({ browser, base, outDir, wanted, query = '' }) {
  const rows = [];
  const names = wanted ? MOTION_NAMES.filter((n) => wanted.includes(n)) : MOTION_NAMES;
  for (const name of names) {
    process.stdout.write(`  motion ${name} … `);
    const { webm, marks, note, info } = await recordMotion(browser, name, base, outDir, query);
    const fps = videoFps(webm);
    const strip = join(outDir, 'motion', `${name}.strip.png`);
    let stripNote = '';
    try {
      if (name === 'hero' || name === 'team' || name === 'offer') {
        // 8 frames evenly spaced over the scrub (scrollStart → end)
        const ss = Math.max(0, marks.scrollStart ?? 0);
        const end = marks.end ?? videoDuration(webm);
        const span = Math.max(0.5, end - ss);
        const step = Math.max(1, Math.floor((span * fps) / 8));
        ff(['-ss', String(ss), '-t', String(span + 0.2), '-i', webm, '-vf', `select='not(mod(n,${step}))',scale=360:-1,tile=8x1`, '-frames:v', '1', strip]);
        stripNote = `8 frames evenly over ${ss.toFixed(2)}s–${end.toFixed(2)}s (every ${step}th frame @ ${fps}fps)`;
      } else if (name === 'preloader') {
        // 8 frames evenly over the whole clip: loader beat + the glide into the hero
        const end = marks.end ?? videoDuration(webm);
        const step = Math.max(1, Math.floor((end * fps) / 8));
        ff(['-i', webm, '-vf', `select='not(mod(n,${step}))',scale=360:-1,tile=8x1`, '-frames:v', '1', strip]);
        stripNote = `8 frames evenly over 0s–${end.toFixed(2)}s (every ${step}th frame @ ${fps}fps; preload cleared at ${(marks.afterHero ?? 0).toFixed(2)}s)`;
      } else {
        // 8 frames, 2 per second, starting where the interesting part begins
        const ss = name === 'statement' || name === 'clients' ? Math.max(0, (marks.scrollStart ?? 0) - 0.5) : 0;
        const step = Math.max(1, Math.round(fps / 2));
        ff(['-ss', String(ss), '-i', webm, '-vf', `select='not(mod(n,${step}))',scale=360:-1,tile=8x1`, '-frames:v', '1', strip]);
        stripNote = `8 frames 0.5s apart from ${ss.toFixed(2)}s`;
      }
    } catch (e) { stripNote = e.message; }
    rows.push({ page: 'home', locale: 'uz', viewport: 'desktop', capture: `motion.${name}`, order: 0, path: rel(webm), ok: existsSync(webm) && !note, bytes: existsSync(webm) ? statSync(webm).size : 0, note: [note, info, `marks ${JSON.stringify(marks)}`].filter(Boolean).join('; ') });
    rows.push({ page: 'home', locale: 'uz', viewport: 'desktop', capture: `motion.${name}.strip`, order: 0, path: rel(strip), ok: existsSync(strip), bytes: existsSync(strip) ? statSync(strip).size : 0, note: stripNote });
    if (name === 'preloader') {
      const loaderDir = join(outDir, 'motion', 'loader');
      rmSync(loaderDir, { recursive: true, force: true });
      mkdirSync(loaderDir, { recursive: true });
      let n = '';
      // f000..f030 as before (the loader beat) plus f031..f050 for the glide into the hero
      try { ff(['-i', webm, '-vf', 'fps=10,scale=720:-1', '-frames:v', '51', '-start_number', '0', join(loaderDir, 'f%03d.png')]); } catch (e) { n = e.message; }
      const last = [50, 40, 30].find((i) => existsSync(join(loaderDir, `f${String(i).padStart(3, '0')}.png`)));
      rows.push({ page: 'home', locale: 'uz', viewport: 'desktop', capture: 'motion.loader', order: 0, path: rel(loaderDir), ok: existsSync(join(loaderDir, 'f030.png')), bytes: 0, note: n || `frames at 100 ms, f000..f${String(last ?? 0).padStart(3, '0')} (loader beat f000..f030, glide after)` });
    }
    console.log(note ? `!! ${note}` : `ok (${Object.entries(marks).map(([k, v]) => `${k}=${v}s`).join(' ')})`);
  }
  return rows;
}

// ---------------------------------------------------------------- main
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { help(); return 0; }
  const wave = args.wave;
  const target = args.target;
  if (!wave || !target || !['ours', 'ref'].includes(target)) { help(); console.error('\n--wave and --target ours|ref are required'); return 2; }
  const base = (args.base && args.base !== true ? args.base : DEFAULT_BASE[target]).replace(/\/+$/, '');
  const pages = list(args.pages, Object.keys(PAGES));
  for (const p of pages) if (!PAGES[p]) { console.error(`unknown page "${p}" (have ${Object.keys(PAGES).join(', ')})`); return 2; }
  const locales = target === 'ref' ? ['en'] : list(args.locales, ['uz', 'ru', 'en']);
  const viewports = list(args.viewports, ['desktop', 'mobile']);
  for (const v of viewports) if (!VIEWPORTS[v]) { console.error(`unknown viewport "${v}"`); return 2; }
  const sections = args.sections && args.sections !== true ? list(args.sections, null) : null;
  const motion = !!args.motion;
  if (motion && target !== 'ours') { console.error('--motion is for --target ours only'); return 2; }
  const query = parseQuery(args.query);
  const state = args.state && args.state !== true ? String(args.state) : null;
  if (state && state !== 'hover') { console.error(`unknown --state "${state}" (have: hover)`); return 2; }
  // hero frames: explicit --hero wins; otherwise the default list whenever the home hero is among the sections shot
  let heroFrames = null;
  if (args.hero !== undefined && args.hero !== true && String(args.hero) !== 'none') {
    heroFrames = list(args.hero, []).map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 1);
    if (!heroFrames.length) { console.error('--hero needs comma-separated progress values in 0..1 (or "none")'); return 2; }
  } else if (String(args.hero) !== 'none' && target === 'ours' && (!sections || sections.includes('hero'))) heroFrames = HERO_DEFAULT;

  const outDir = join(ROOT, 'workbench', 'shots', String(wave), target);
  mkdirSync(outDir, { recursive: true });
  const manifestFile = join(outDir, 'manifest.json');

  if (!(await reachable(base + '/'))) {
    console.error(`cannot reach ${base}/ — ${target === 'ours' ? 'is the dev server running? (npm run dev)' : 'network?'}`);
    return 1;
  }

  console.log(`wave ${wave} · ${target} · ${base} · ${motion ? 'MOTION' : `pages ${pages.join(',')} · locales ${locales.join(',')} · viewports ${viewports.join(',')}${sections ? ' · sections ' + sections.join(',') : ''}${heroFrames ? ' · hero ' + heroFrames.join(',') : ''}${state ? ' · state ' + state : ''}`}${query ? ' · ?' + query : ''}`);
  // PW_CHROMIUM: an already-installed headless shell (e.g. an older Playwright build) instead of downloading a new one
  const browser = await chromium.launch({ headless: !args.headed, args: target === 'ours' ? OURS_LAUNCH_ARGS : [],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  const rows = [];
  const started = Date.now();
  try {
    if (motion) {
      rows.push(...(await shootMotion({ browser, base, outDir, wanted: sections, query })));
    } else {
      for (const pageName of pages) for (const locale of locales) for (const viewport of viewports) {
        process.stdout.write(`  ${pageName}.${locale}.${viewport} … `);
        const t = Date.now();
        const r = [];
        if (heroFrames && pageName === 'home' && target === 'ours') r.push(...(await shootHeroFrames({ browser, target, base, page: pageName, locale, viewport, outDir, query, heroFrames })));
        r.push(...(await shootPage({ browser, target, base, page: pageName, locale, viewport, sections, outDir, query, state })));
        rows.push(...r);
        const ok = r.filter((x) => x.ok).length;
        const bad = r.filter((x) => !x.ok);
        console.log(`${ok}/${r.length} ok in ${((Date.now() - t) / 1000).toFixed(1)}s${bad.length ? '  !! ' + bad.map((b) => `${b.capture}: ${b.note}`).join(' | ') : ''}`);
      }
    }
  } finally {
    await browser.close();
  }
  const m = saveManifest(manifestFile, { wave: String(wave), target, base }, rows);
  const okCount = rows.filter((r) => r.ok).length;
  console.log(`${okCount}/${rows.length} captures ok in ${((Date.now() - started) / 1000).toFixed(1)}s → ${rel(manifestFile)} (${m.files.length} rows total)`);
  return okCount === rows.length ? 0 : 1;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
