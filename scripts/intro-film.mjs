#!/usr/bin/env node
/* Film the intro: open /?intro=1, pick a language, grab a frame every ~0.5 s at 1440×900, write a labelled contact
   sheet PNG plus the Playwright webm.
   node scripts/intro-film.mjs [--url http://127.0.0.1:5180] [--lang en] [--out workbench/intro-film/r1]
                               [--mockgrid] [--reduced] [--step 0.5] [--dur 19] [--w 1440 --h 900] */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] == null ? true : process.argv[i + 1]) }
const BASE = arg('url', 'http://127.0.0.1:5180')
const LANG = arg('lang', 'en')
const OUT = path.resolve(arg('out', 'workbench/intro-film/latest'))
const STEP = Number(arg('step', 0.5))
const DUR = Number(arg('dur', 19))
const W = Number(arg('w', 1440)), H = Number(arg('h', 900))
const NAMES = { uz: 'O‘zbekcha', ru: 'Русский', en: 'English' }

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true })

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 1,
  reducedMotion: arg('reduced', false) ? 'reduce' : 'no-preference',
  recordVideo: { dir: OUT, size: { width: W, height: H } },
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.error('pageerror:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()) })
await page.goto(`${BASE}/?intro=1`, { waitUntil: 'networkidle' })
const option = page.locator(`[data-option="${LANG}"]`)
await option.waitFor()
await page.waitForTimeout(1300)
await page.screenshot({ path: path.join(OUT, 'frames', 'picker.jpg'), quality: 80, type: 'jpeg' })
await option.hover()
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(OUT, 'frames', 'picker-hover.jpg'), quality: 80, type: 'jpeg' })

const mock = arg('mockgrid', false)
await option.click()
const t0 = Date.now()
if (mock) {
  // Market.tsx is still a stub on this branch: stand in a grid shaped like a marketplace so the finale has seats
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const ids = ['apple-design', 'gauntlet-loop', 'x-3', 'x-4', 'x-5', 'x-6']
    const g = document.createElement('section')
    g.setAttribute('data-grid', '')
    g.style.cssText = 'position:absolute;left:56px;right:56px;top:300px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;z-index:1'
    const h = document.createElement('h1')
    h.textContent = 'Skills'
    h.style.cssText = 'position:absolute;left:56px;top:150px;font-size:88px;letter-spacing:-.04em;font-weight:500;z-index:1'
    for (const id of ids) {
      const c = document.createElement('article')
      c.setAttribute('data-card-id', id)
      c.style.cssText = 'height:240px;border-radius:21px;background:#fff;padding:24px;box-shadow:0 1px 0 #dcdcd4'
      c.innerHTML = `<div style="font:500 12px Poppins;letter-spacing:.06em;text-transform:uppercase;color:#0029FF">skill</div><div style="font-size:28px;font-weight:500;margin-top:12px">${id}</div>`
      g.appendChild(c)
    }
    document.body.append(h, g)
  })
}

const frames = []
for (let i = 0; i * STEP <= DUR; i++) {
  const due = t0 + i * STEP * 1000
  const wait = due - Date.now()
  if (wait > 0) await page.waitForTimeout(wait)
  const f = path.join(OUT, 'frames', `f${String(i).padStart(3, '0')}.jpg`)
  const tl = await page.evaluate(() => window.__hsIntro?.time?.() ?? null).catch(() => null)
  await page.screenshot({ path: f, quality: 72, type: 'jpeg' })
  frames.push({ f, wall: (Date.now() - t0) / 1000, tl })
}
const video = page.video()
await ctx.close()
if (video) fs.renameSync(await video.path(), path.join(OUT, 'film.webm'))

// contact sheet
const all = [{ f: path.join(OUT, 'frames', 'picker.jpg'), label: 'picker' }, { f: path.join(OUT, 'frames', 'picker-hover.jpg'), label: 'picker · hover' },
  ...frames.map((x) => ({ f: x.f, label: `${x.tl != null ? `tl ${x.tl.toFixed(2)}s` : 'tl –'} · wall ${x.wall.toFixed(2)}s` }))]
const cols = 5
const html = `<body style="margin:0;background:#222;font:13px -apple-system,system-ui;color:#ddd">
<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px">
${all.map((x) => `<figure style="margin:0"><img style="width:100%;display:block" src="data:image/jpeg;base64,${fs.readFileSync(x.f).toString('base64')}"><figcaption style="padding:3px 2px">${x.label}</figcaption></figure>`).join('')}
</div></body>`
const b2 = await browser.newPage({ viewport: { width: 1800, height: 900 } })
await b2.setContent(html, { waitUntil: 'load' })
await b2.screenshot({ path: path.join(OUT, 'contact.png'), fullPage: true })
await browser.close()
console.log(JSON.stringify({ out: OUT, frames: frames.length, contact: path.join(OUT, 'contact.png'), video: path.join(OUT, 'film.webm'), lang: LANG, names: NAMES[LANG] }))
