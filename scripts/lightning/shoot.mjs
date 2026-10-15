// node scripts/lightning/shoot.mjs <outDir>   (needs vite on :5173). The lightning button doing every chore, then skipping what it can't afford.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'lightning-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => {
    localStorage.setItem('cartopia-flash-warning-hide', '1')
    localStorage.setItem('cartopia.tips', JSON.stringify(['gems', 'goals', 'garage', 'taptip', 'fuel', 'tires', 'crates', 'crew', 'arcade']))
  })
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99 }))
  await p.waitForTimeout(2500)
  const setup = (rich) => p.evaluate((rich) => {
    localStorage.removeItem('cartopia-collect-all')
    const g = window.__game
    const s = g.getState()
    const keep = s.buildings.filter((o) => !['pizza', 'donut', 'tires', 'gas'].includes(o.def))
    const cars = s.cars.map((c, i) => ({ ...c, flat: i === 0, lowFuel: i === 1 }))
    g.setState({ level: 12, coins: rich ? 5000 : 0, fuel: rich ? 60 : 0, panel: null, cars, buildings: [...keep,
      { uid: 'z1', def: 'pizza', x: 5, z: 12, jobEndsAt: 1, level: 2 }, { uid: 'z2', def: 'pizza', x: 6, z: 12, jobEndsAt: rich ? 1 : null, level: 2 },
      { uid: 'z3', def: 'donut', x: 8, z: 12, jobEndsAt: null, level: 2 }] })
  }, rich)
  // A DOM click: under software GL a real press runs long enough to count as a press-and-hold tip.
  const tap = () => p.evaluate(() => document.querySelector('.collect-all').click())
  await setup(true)
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-1-before.png` })
  const t0 = Date.now()
  await tap()
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  console.log(form, 'tap to painted frame ms', Date.now() - t0)
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${out}/${form}-2-after.png` })
  console.log(form, JSON.stringify(await p.evaluate(() => { const s = window.__game.getState(); return { coins: s.coins, fuel: s.fuel, cars: s.cars.slice(0, 2).map((c) => [c.flat, c.lowFuel]), jobs: s.buildings.filter((o) => o.uid.startsWith('z')).map((o) => o.jobEndsAt !== null) } })))
  await setup(false)
  await p.waitForTimeout(1500)
  await p.waitForTimeout(500)
  await tap()
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${out}/${form}-3-skipped.png` })
  await p.close()
}
await b.close()
