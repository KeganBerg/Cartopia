// node scripts/wildland/shoot.mjs <outDir> [season]   (needs vite on :5173). Buy a plot, see its wild trees and rocks, bulldoze some.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'wildland-out', season = 'summer'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto(`http://localhost:5173/?time=0.3&season=${season}`)
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(6000)
  await p.evaluate(() => {
    const g = window.__game
    g.setState({ tutorial: 99, level: 12, coins: 120000, panel: null })
    g.getState().buyPlot(3, 1)
  })
  await p.waitForTimeout(1500)
  // Aim the camera at the new plot (east of the start town).
  await p.evaluate(async () => {
    const { VIEW } = await import('/src/scene/freeCam.ts')
    const { plotCenter } = await import('/src/scene/World.tsx')
    const [x, z] = plotCenter(3, 1)
    VIEW.set(x, VIEW.y, z)
  })
  await p.waitForTimeout(2500)
  // Close anything that popped up on load (the daily spin).
  await p.evaluate(() => window.__game.setState({ panel: null }))
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-1-new-land.png` })
  await p.evaluate(() => window.__game.getState().setMode('bulldoze'))
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-2-bulldoze-tool.png` })
  // Bulldoze half of them.
  await p.evaluate(() => {
    const s = window.__game.getState()
    const wild = s.buildings.filter((o) => o.x >= 24 && o.z >= 8 && o.z < 16)
    wild.slice(0, Math.ceil(wild.length / 2)).forEach((o) => window.__game.getState().bulldoze(o.x, o.z))
  })
  await p.waitForTimeout(250)
  await p.screenshot({ path: `${out}/${form}-3-dust.png` })
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-4-half-cleared.png` })
  console.log(form, JSON.stringify(await p.evaluate(() => { const s = window.__game.getState(); return { coins: s.coins, left: s.buildings.filter((o) => o.x >= 24).map((o) => o.def) } })))
  await p.close()
}
await b.close()
