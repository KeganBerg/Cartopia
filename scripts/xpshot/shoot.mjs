// node scripts/xpshot/shoot.mjs <outDir>   (needs vite on :5173). Level-scaled XP: how-to-level panel,
// flat tire panel, mastery splash, upgrade panel and a boosted race toast at level 20.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'xpshot-out', lvl = '20'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99 }))
  await p.waitForTimeout(2500)
  const L = Number(lvl)
  await p.evaluate((L) => {
    const g = window.__game
    const keep = g.getState().buildings.filter((o) => ['rescue', 'showroom', 'garage'].includes(o.def))
    g.setState({ level: L, xp: 0, coins: 120000, parts: 500, panel: null, buildings: [...keep,
      { uid: 'gas1', def: 'gas', x: 5, z: 12, jobEndsAt: null }, { uid: 'tires1', def: 'tires', x: 7, z: 12, jobEndsAt: null },
      { uid: 'st1', def: 'stadium', x: 9, z: 12, jobEndsAt: null, level: 3 }] })
    g.getState().showNeed('level', L + 2, 'Glass Tower')
  }, L)
  await p.waitForTimeout(2000)
  await p.screenshot({ path: `${out}/${form}-1-need.png` })
  await p.evaluate(() => {
    const g = window.__game
    const car = g.getState().cars[0]
    g.setState({ panel: 'flat', selectedCar: car.uid, cars: g.getState().cars.map((c) => (c.uid === car.uid ? { ...c, flat: true } : c)) })
  })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-2-flat.png` })
  await p.evaluate(() => { const g = window.__game; g.setState({ panel: null }); g.getState().openUpgrade('st1') })
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}-3-upgrade.png` })
  await p.evaluate(() => {
    const g = window.__game
    g.setState({ panel: null, upgrading: null, mastery: {}, masteryPrize: null, boosts: { firstWin: {}, welcome: 0, streak: 0 } })
    const model = g.getState().cars[0].model
    for (let i = 0; i < 10; i++) g.getState().masteryRace(model, false, 'drag', false)
  })
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-4-mastery.png` })
  await p.evaluate(() => { const g = window.__game; g.getState().closeMasteryPrize(); g.getState().finishRace(true, 500) })
  await p.waitForTimeout(450)
  await p.screenshot({ path: `${out}/${form}-5-race-toast.png` })
  await p.evaluate(() => window.__game.getState().openPanel('goals'))
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-6-goals.png` })
  await p.close()
}
await b.close()
