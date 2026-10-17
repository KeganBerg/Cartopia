// The Crate Depot inside the Cars menu, on phone and desktop, once its scene has settled.
// node scripts/polish/crates.mjs <outDir>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'polish-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(3000)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 25, panel: 'garage' }))
  await p.waitForSelector('.panel', { timeout: 30000 })
  await p.waitForTimeout(2000)
  await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.includes('Crates')).click())
  // The camera glides into the depot: wait for it to land (WAIT=40000 for desktop under swiftshader).
  await p.waitForTimeout(Number(process.env.WAIT ?? 14000))
  await p.screenshot({ path: `${out}/${form}-crates.png` })
  await p.close()
}
await b.close()
