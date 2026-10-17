// The level-up splash on phone and desktop: a plain level and a fuel-rate milestone.
// node scripts/polish/levelup.mjs <outDir>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'polish-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(3000)
  for (const [n, lu] of [['lv3', { from: 2, to: 3, coins: 500, bucks: 2 }], ['lv15', { from: 14, to: 15, coins: 2500, bucks: 5 }]]) {
    await p.evaluate((lu) => window.__game.setState({ tutorial: 99, levelUp: lu }), lu)
    await p.waitForTimeout(3000)
    await p.screenshot({ path: `${out}/${form}-levelup-${n}.png` })
    await p.evaluate(() => window.__game.setState({ levelUp: null }))
  }
  await p.close()
}
await b.close()
