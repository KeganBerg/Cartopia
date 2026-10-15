// node scripts/arcadeshot/dash.mjs <outDir>   (needs vite on :5173). Delivery Dash with traffic, a hot order and a pop.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'dash-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const sizes = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } }
for (const form of (process.env.FORMS ?? 'phone,desktop').split(',')) {
  const p = await b.newPage({ viewport: sizes[form], deviceScaleFactor: form === 'phone' ? 2 : 1, hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, coins: 120000, fuel: 99, panel: null }))
  await p.evaluate(() => window.__game.getState().openPanel('arcade'))
  await p.waitForSelector('.arc-tile', { timeout: 60000 })
  await p.click('.arc-tile.delivery .buy', { noWaitAfter: true, timeout: 90000 })
  await p.waitForFunction(() => window.__dash && window.__dash.t > 0.3, null, { timeout: 120000 })
  // Park the car a little behind a traffic car with a hot order on board, and pop a hot drop.
  await p.evaluate(() => {
    const s = window.__dash
    const m = s.movers.find((o) => o.axis === 'z' && Math.abs(o.pos) < 8) ?? s.movers[0]
    const lane = 0.72 * m.dir
    s.pose = { x: m.line + lane, z: m.pos - m.dir * 3, h: m.dir > 0 ? 0 : Math.PI }
    s.carrying = true
    s.streak = 2
    s.hotFor = 10
    s.hotUntil = s.t + 6
    s.pop = { id: 9, text: '🔥 Hot! +3s  ×2', kind: 'hot' }
  })
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${out}/${form}-dash.png` })
  // Nearly out of time, then the clock runs out and the run ends.
  await p.evaluate(() => { window.__dash.left = 7; window.__dash.drops = 5 })
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${out}/${form}-dash-low.png` })
  await p.evaluate(() => { window.__dash.left = 0.05 })
  await p.waitForTimeout(4000)
  await p.screenshot({ path: `${out}/${form}-dash-end.png` })
  console.log(form)
  await p.close()
}
await b.close()
