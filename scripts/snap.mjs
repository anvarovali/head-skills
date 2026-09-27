// Screenshot pages of a running dev/preview server, desktop 1440x900 and mobile 390x844 (iPhone 13), 2x, light.
// usage: node scripts/snap.mjs <outDir> <baseUrl> <name>=<path> [<name>=<path> …] [--full] [--wait=ms]
// Adds ?intro=0 so the first-visit intro never covers a capture (unless the path already has intro=).
import { chromium, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const [out, base, ...rest] = process.argv.slice(2)
const full = rest.includes('--full')
const wait = Number((rest.find((a) => a.startsWith('--wait=')) ?? '--wait=1200').split('=')[1])
const targets = rest.filter((a) => a.includes('=') && !a.startsWith('--')).map((a) => a.split('='))
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
for (const [vp, opts] of [['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }], ['mobile', devices['iPhone 13']]]) {
  const ctx = await browser.newContext({ ...opts, colorScheme: 'light' })
  for (const [name, path] of targets) {
    const page = await ctx.newPage()
    const url = new URL(path, base); if (!url.searchParams.has('intro')) url.searchParams.set('intro', '0')
    await page.goto(url.href, { waitUntil: 'networkidle' })
    await page.waitForTimeout(wait)
    const file = `${out}/${name}.${vp}.${full ? 'full' : 'viewport'}.png`
    await page.screenshot({ path: file, fullPage: full })
    console.log(file)
    await page.close()
  }
  await ctx.close()
}
await browser.close()
