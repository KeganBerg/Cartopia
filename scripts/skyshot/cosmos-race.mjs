// The night sky from a real Quick race: the countdown and mid-race chase camera.
// node scripts/skyshot/cosmos-race.mjs <outDir> [phone|desktop] [query]   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'cosmos-out', form = 'phone', q = 'time=0.5&season=fall'] = process.argv
const size = form === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto('http://localhost:5173/?' + q)
await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
await p.waitForTimeout(3000)
await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 12, coins: 50000, fuel: 40, panel: null }))
await p.evaluate(async () => { (await import('/src/ui/raceNav.ts')).openRaceTab('quick') })
await p.waitForTimeout(3000)
await p.locator('button', { hasText: /\$\d/ }).first().click()
await p.waitForTimeout(1500)
await p.screenshot({ path: `${out}/${form}-race-0.png` })
for (const [n, ms] of [['1', 2500], ['2', 4000], ['3', 6000]]) {
  await p.waitForTimeout(ms)
  await p.evaluate(() => document.querySelector('.shift, [aria-label*="Shift"], .gas')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
  try { await p.screenshot({ path: `${out}/${form}-race-${n}.png`, timeout: 90000 }); console.log(n) } catch { console.log('no shot', n) }
}
await b.close()
