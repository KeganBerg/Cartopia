// Car Meet like button before and after a tap, on desktop and phone.
// node scripts/likeshot/shoot.mjs <outDir>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'likeshot-out'] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(3000)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 25, panel: 'meet' }))
  await p.waitForSelector('.meet-like', { timeout: 120000 })
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-before.png` })
  // Two quick taps: the second must not add another like.
  await p.evaluate(() => { const b = document.querySelector('.meet-like'); b.click(); b.click() })
  await p.waitForTimeout(800)
  console.log(form, await p.locator('.meet-like').first().textContent(), await p.locator('.meet-like').first().getAttribute('title'))
  await p.screenshot({ path: `${out}/${form}-after.png` })
  await p.close()
}
await b.close()
