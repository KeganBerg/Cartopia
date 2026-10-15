// node scripts/arcadeshot/parkthenchase.mjs <outDir>   Play Parking Pro, quit, then start Getaway Chase in the same tab.
// The shared 3D view keeps one camera, so whatever Parking leaves on it shows up in the next game.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'arcade-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const forms = process.env.FORMS ? process.env.FORMS.split(',') : ['desktop', 'phone']
const sizes = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } }
const c = { noWaitAfter: true, timeout: 90000 }
for (const form of forms) {
  const p = await b.newPage({ viewport: sizes[form], deviceScaleFactor: form === 'phone' ? 2 : 1, hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, coins: 120000, fuel: 99, panel: null }))
  await p.evaluate(() => window.__game.getState().openPanel('arcade'))
  await p.waitForSelector('.arc-tile', { timeout: 60000 })
  await p.click('.arc-tile.park .buy', c)
  await p.click('.arc-lot >> nth=0', c)
  await p.waitForSelector('.stage-slot[data-ready="1"]', { timeout: 90000 }).catch(() => console.log('no ready park'))
  await p.waitForTimeout(5000)
  await p.screenshot({ path: `${out}/${form}-a-park.png` })
  await p.click('button.close', c)
  await p.waitForTimeout(1500)
  if (await p.locator('.arc-back').count()) await p.click('.arc-back', c)
  await p.waitForSelector('.arc-tile.chase .buy', { timeout: 60000 })
  await p.waitForTimeout(1500)
  await p.click('.arc-tile.chase .buy', c)
  await p.waitForSelector('.stage-slot[data-ready="1"]', { timeout: 90000 }).catch(() => console.log('no ready chase'))
  await p.waitForTimeout(6000)
  await p.screenshot({ path: `${out}/${form}-b-chase.png` })
  await p.close()
  console.log(form, 'done')
}
await b.close()
