// node scripts/inventoryshot/shoot.mjs <outDir>   (needs vite on :5173). Bulldoze to the inventory, then place one back.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'inventory-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  // The loading splash waits for a tap once the town is ready.
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2500)
  // Three buildings next to the start roads: an upgraded pizza place, a donut shop and a fountain.
  await p.evaluate(() => {
    const g = window.__game
    const keep = g.getState().buildings.filter((o) => ['rescue', 'showroom', 'garage'].includes(o.def))
    g.setState({ tutorial: 99, level: 20, coins: 120000, panel: null, stored: [], buildings: [...keep,
      { uid: 'iv1', def: 'pizza', x: 5, z: 5, jobEndsAt: null, level: 6 },
      { uid: 'iv2', def: 'donut', x: 8, z: 5, jobEndsAt: null },
      { uid: 'iv3', def: 'donut', x: 5, z: 8, jobEndsAt: null },
      { uid: 'iv4', def: 'fountain', x: 8, z: 8, jobEndsAt: null }] })
    g.getState().setMode('bulldoze')
  })
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}-1-bulldoze.png` })
  await p.evaluate(() => { const s = window.__game.getState(); s.bulldoze(5, 5); s.bulldoze(8, 5); s.bulldoze(5, 8); s.bulldoze(8, 8) })
  await p.waitForTimeout(2000)
  await p.screenshot({ path: `${out}/${form}-2-badge.png` })
  await p.evaluate(() => window.__game.getState().openPanel('inventory'))
  await p.waitForTimeout(500)
  await p.waitForSelector('.stage-slot[data-ready="1"]', { timeout: 60000 }).catch(() => console.log('thumbs not ready'))
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-3-inventory.png` })
  await p.evaluate(() => { const s = window.__game.getState(); s.pickStored('iv1'); window.__game.getState().placeStored('iv1', 9, 6); window.__game.setState({ mode: 'move', placing: null, placingStored: null, selected: 'iv1' }) })
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}-4-placed.png` })
  await p.evaluate(() => window.__game.getState().openPanel('inventory'))
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}-5-after.png` })
  console.log(form, JSON.stringify(await p.evaluate(() => ({ stored: window.__game.getState().stored.length, placed: window.__game.getState().buildings.find((o) => o.uid === 'iv1') }))))
  await p.close()
}
await b.close()
