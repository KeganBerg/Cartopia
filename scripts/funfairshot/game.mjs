// node scripts/funfairshot/game.mjs <outDir> [level]   (vite dev on :5173). The real game by day:
// a funfair and a junkyard in the start town at `level`, on desktop and phone.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'funfair-out', level = '10'] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto(`http://localhost:5173/?time=0.1&season=summer&weather=clear`)
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(4000)
  const at = await p.evaluate((lvl) => {
    const g = window.__game
    g.setState({ tutorial: 99, level: 30, coins: 1e9, bucks: 1e6, panel: null })
    let fair = null
    for (let z = 8; z < 16 && !fair; z++) for (let x = 4; x < 18 && !fair; x++) if (g.getState().placeBuilding('funfair', x, z, 0)) fair = { x, z }
    for (let z = 8; z < 16; z++) for (let x = (fair?.x ?? 4) + 2; x < 20; x++) if (g.getState().placeBuilding('junkyard', x, z, 0)) { z = 99; break }
    const s = g.getState()
    g.setState({ mode: 'view', placing: null, panel: null, buildings: s.buildings.map((o) => (o.def === 'funfair' || o.def === 'junkyard' ? { ...o, level: lvl } : o)) })
    return fair
  }, Number(level))
  console.log(form, 'funfair at', JSON.stringify(at))
  await p.evaluate(async (at) => {
    const { VIEW } = await import('/src/scene/freeCam.ts')
    const { toWorld } = await import('/src/scene/grid.ts')
    const a = toWorld(at.x + 0.5, at.z + 0.5)
    VIEW.set(a[0], VIEW.y, a[1])
  }, at)
  // Close whatever greets the player (daily spin, offers) so the town shows.
  for (let i = 0; i < 4; i++) {
    await p.waitForTimeout(2500)
    await p.keyboard.press('Escape')
    await p.locator('button:has-text("×"), button[aria-label="Close"]').first().click({ timeout: 1500 }).catch(() => {})
    await p.evaluate(() => window.__game.setState({ panel: null }))
  }
  await p.waitForTimeout(2000)
  await p.screenshot({ path: `${out}/${form}-L${level}.png` })
  await p.close()
}
await b.close()
