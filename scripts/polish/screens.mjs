// A phone pass over screens the other polish tours miss: a Quick race driven to its result
// card (and the hero skip), then Rusty's, the bank, the garage and the shop (PANELS=a,b to pick others).
// node scripts/polish/screens.mjs <outDir>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'polish-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto('http://localhost:5173/?time=0.3&season=fall')
await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
await p.waitForTimeout(3000)
const shot = async (n) => { try { await p.screenshot({ path: `${out}/${n}.png`, timeout: 90000 }); console.log(n) } catch { console.log('no shot', n) } }
await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 25, coins: 250000, parts: 400, fuel: 60 }))
// Race: hold the pedal, shift on every press until the result card shows.
await p.evaluate(async () => { (await import('/src/ui/raceNav.ts')).openRaceTab('quick') })
await p.waitForTimeout(3000)
await p.locator('button:has-text("$"):enabled').first().click({ timeout: 30000 }).catch((e) => console.log('no race button', e.message))
for (let i = 0; i < 160; i++) {
  await p.waitForTimeout(400)
  if (await p.locator('.rr-card').count()) break
  if (await p.locator('.hero-skip').count()) { await p.locator('.hero-skip').click().catch(() => {}); continue }
  // A real tap on SHIFT (the pedal needs a live pointer to capture); later taps would skip the finish shot.
  const box = i < 30 ? await p.locator('.shift-btn:enabled').boundingBox().catch(() => null) : null
  if (box) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
}
await p.waitForTimeout(2500)
await shot('result')
await p.goto('http://localhost:5173/?time=0.3&season=fall')
await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
await p.waitForTimeout(3000)
// Build Rusty's and the bank on spare lots next to the first building.
await p.evaluate(() => {
  const g = window.__game, s = g.getState()
  const at = s.buildings[0]
  const add = ['rescue', 'bank'].map((def, i) => ({ ...at, uid: `polish-${def}`, def, level: 3, x: at.x + 6 + i * 2, z: at.z + 6 }))
  g.setState({ tutorial: 99, level: 25, coins: 250000, parts: 400, buildings: [...s.buildings, ...add] })
})
for (const id of (process.env.PANELS ?? 'rescue,garage,shop').split(',')) {
  await p.evaluate(() => window.__game.setState({ panel: null }))
  await p.waitForTimeout(400)
  await p.evaluate((id) => window.__game.setState({ panel: id }), id)
  await p.waitForSelector('.panel', { timeout: 30000 }).catch(() => console.log('no panel', id))
  await p.waitForTimeout(3000)
  await shot(id)
}
await b.close()
