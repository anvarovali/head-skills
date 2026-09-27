// Captures the bar: qoder.com marketplace (list + a skill detail), light theme, desktop 1440 and mobile 390, full page + viewport.
import { chromium, devices } from '@playwright/test'
const OUT = new URL('../refs/qoder/', import.meta.url).pathname
const PAGES = [
  ['list', 'https://qoder.com/en/marketplace'],
  ['skills', 'https://qoder.com/en/marketplace?type=skill'],
  ['detail', 'https://qoder.com/marketplace/skill?id=official79532076'],
]
const VPS = [['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }], ['mobile', { ...devices['iPhone 13'] }]]
const browser = await chromium.launch()
for (const [vpName, ctxOpts] of VPS) {
  const ctx = await browser.newContext({ ...ctxOpts, colorScheme: 'light', locale: 'en-US' })
  for (const [name, url] of PAGES) {
    const page = await ctx.newPage()
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `${OUT}${name}.${vpName}.viewport.png` })
    await page.screenshot({ path: `${OUT}${name}.${vpName}.full.png`, fullPage: true }).catch((e) => console.warn(name, vpName, e.message))
    console.log('ok', name, vpName)
    await page.close()
  }
  await ctx.close()
}
await browser.close()
