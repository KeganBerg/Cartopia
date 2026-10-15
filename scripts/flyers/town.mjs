// node scripts/flyers/town.mjs <outDir> <kinds,comma> [time] [tag]   (needs vite on :5173)
// A fly-by held halfway across the town, phone and desktop, from the bird's-eye view.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'flyers-out', kinds = 'planes', time = '0.3', tag = ''] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const kind of kinds.split(',')) for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => {
    localStorage.setItem('cartopia-flash-warning-hide', '1')
    localStorage.setItem('cartopia.tips', JSON.stringify(['gems', 'goals', 'garage', 'taptip', 'fuel', 'tires', 'crates', 'crew', 'arcade']))
  })
  await p.goto(`http://localhost:5173/?time=${time}&season=fall&weather=clear&sky=${kind}`)
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.evaluate(() => window.__game.setState({ tutorial: 99, panel: null }))
  await p.waitForFunction(() => window.__sky?.flight?.kind, null, { timeout: 60000 })
  // Hold it halfway across.
  await p.evaluate(() => { const s = window.__sky.flight; s.dur = 1e6; s.at = window.__sky.clock.elapsedTime - 5e5 })
  // Daily Spin and other popups open a little after load.
  await p.waitForTimeout(4000)
  await p.evaluate(() => window.__game.setState({ panel: null }))
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}-${kind}${tag}.png` })
  console.log(form, kind)
  await p.close()
}
await b.close()
