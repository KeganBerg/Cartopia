// node scripts/carcard/shoot.mjs <outDir>   (needs vite on :5173). The Garage car card on phone and desktop:
// a Kazumi Zephyr with two copies, and a car that drives for a business.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'carcard-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const up = (n) => ({ engine: n, turbo: n, tires: n, weight: n })
const cars = [
  { uid: 'z1', model: 'miata', color: '#fafafa', upgrades: up(1) },
  { uid: 'z2', model: 'miata', color: '#d32f2f', upgrades: up(0) },
  { uid: 's1', model: 'stallion', color: '#1e88e5', upgrades: up(3), stripe: '#ffffff', plate: 'KEGAN' },
  { uid: 'p1', model: 'pip', color: '#c62828', upgrades: up(0) },
]
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2000)
  for (const [name, uid] of [['zephyr', 'z1'], ['driver', 's1']]) {
    await p.evaluate(([cars, uid]) => {
      const g = window.__game
      const s = g.getState()
      // The stallion drives for the first business in town, if any.
      const biz = s.buildings.find((x) => x.car !== undefined) ?? s.buildings[0]
      const buildings = s.buildings.map((x) => (x === biz ? { ...x, car: 's1' } : x))
      g.setState({ tutorial: 99, level: 20, cars, buildings, raceCar: 'z1', showcase: ['s1'], selectedCar: uid, panel: null })
      g.getState().openPanel('garage')
    }, [cars, uid])
    await p.waitForTimeout(4000)
    await p.screenshot({ path: `${out}/${form}-${name}.png`, timeout: 90000 })
    const card = p.locator('.garage-detail')
    await card.screenshot({ path: `${out}/${form}-${name}-card.png`, timeout: 90000 }).catch((e) => console.log('card', e.message))
    await p.evaluate(() => window.__game.getState().closePanel?.())
  }
  await p.close()
}
await b.close()
