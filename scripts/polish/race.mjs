// A real Quick race on phone or desktop: the race screen, the countdown, mid-race and the result.
// node scripts/polish/race.mjs <outDir> [phone|desktop]   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'polish-out', form = 'phone'] = process.argv
const size = form === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto('http://localhost:5173/?time=0.3&season=fall')
await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
await p.waitForTimeout(3000)
await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 12, coins: 50000, fuel: 40 }))
await p.evaluate(async () => { (await import('/src/ui/raceNav.ts')).openRaceTab('quick') })
await p.waitForTimeout(3000)
const shot = async (n) => { try { await p.screenshot({ path: `${out}/${form}-race-${n}.png`, timeout: 90000 }); console.log(n) } catch { console.log('no shot', n) } }
await shot('0-pick')
// The race bar's big button races the picked rival.
await p.evaluate(() => [...document.querySelectorAll('.race-panel .buy')].filter((b) => !b.disabled && /\$/.test(b.textContent)).pop()?.click())
for (const [n, ms] of [['1', 1500], ['2', 3000], ['3', 4000], ['4', 6000], ['5', 8000], ['6', 10000]]) {
  await p.waitForTimeout(ms)
  // Hold the pedal and shift whenever a shift button is there.
  await p.evaluate(() => document.querySelector('.shift, [aria-label*="Shift"], .gas')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
  await shot(n)
}
await b.close()
