// node scripts/mergebonus/shoot.mjs <outDir>   (needs vite on :5173). Merge tool, job badges and the upgrade panel with the merge bonus.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'mergebonus-out'] = process.argv
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
  // Finishing the tutorial opens the daily prize; let it open, then close it.
  await p.evaluate(() => window.__game.setState({ tutorial: 99 }))
  await p.waitForTimeout(2500)
  // A loose square of pizza places, a merged square of donut shops and a merged pair of houses.
  await p.evaluate(() => {
    const g = window.__game
    const keep = g.getState().buildings.filter((o) => ['rescue', 'showroom', 'garage'].includes(o.def))
    const sq = (def, x, z, extra = {}) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j], k) => ({ uid: `${def}${k}`, def, x: x + i, z: z + j, jobEndsAt: null, level: 3, ...(k === 0 ? extra : {}) }))
    g.setState({ level: 20, coins: 120000, parts: 500, panel: null, stored: [], buildings: [...keep,
      ...sq('pizza', 5, 12), ...sq('donut', 8, 12, { merge: 2 }),
      { uid: 'h1', def: 'house', x: 11, z: 12, jobEndsAt: null, level: 4, merge: 21 }, { uid: 'h2', def: 'house', x: 12, z: 12, jobEndsAt: null, level: 4 }] })
    g.getState().setMode('merge')
  })
  await p.waitForTimeout(3500)
  await p.screenshot({ path: `${out}/${form}-1-merge-tool.png` })
  await p.evaluate(() => { const g = window.__game; g.getState().setMode('play'); g.setState({ buildings: g.getState().buildings.map((o) => (o.def === 'donut' ? { ...o, jobEndsAt: 1 } : o)) }) })
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-2-badges.png` })
  await p.evaluate(() => window.__game.getState().openUpgrade('donut0'))
  await p.waitForTimeout(3500)
  await p.screenshot({ path: `${out}/${form}-3-upgrade.png` })
  await p.evaluate(() => { const g = window.__game; g.setState({ panel: null, upgrading: null }); g.getState().setMode('merge') })
  await p.waitForTimeout(1500)
  await p.evaluate(() => window.__game.getState().mergeBlock('pizza0', 2))
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${out}/${form}-4-merged-toast.png` })
  await p.close()
}
await b.close()
