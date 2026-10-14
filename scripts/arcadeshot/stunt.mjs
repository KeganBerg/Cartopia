// node scripts/arcadeshot/stunt.mjs <outDir>   (needs vite on :5173). Stunt Ramp: the needle, a flip + roll in slow motion, the landing.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'stunt-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const sizes = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } }
for (const form of (process.env.FORMS ?? 'phone,desktop').split(',')) {
  const p = await b.newPage({ viewport: sizes[form], deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, coins: 120000, fuel: 99, panel: null }))
  await p.evaluate(() => window.__game.getState().openPanel('arcade'))
  await p.waitForSelector('.arc-tile', { timeout: 60000 })
  await p.click('.arc-tile.stunt .buy', { noWaitAfter: true, timeout: 90000 })
  await p.waitForFunction(() => window.__stunt && window.__stunt.needle > 0.3, null, { timeout: 120000 })
  await p.screenshot({ path: `${out}/${form}-1-aim.png` })
  // Lock the needle near full power, then hold flip and roll in the air until the car has done one of each.
  await p.waitForFunction(() => { const n = window.__stunt.needle % 2; return n > 0.82 && n < 1.1 }, null, { timeout: 120000, polling: 10 })
  await p.keyboard.down(' ')
  await p.keyboard.up(' ')
  await p.waitForFunction(() => window.__stunt.phase === 'air', null, { timeout: 120000, polling: 10 })
  await p.keyboard.down(' ')
  await p.keyboard.down('ArrowRight')
  await p.waitForFunction(() => window.__stunt.roll >= Math.PI * 0.6 || window.__stunt.phase !== 'air', null, { timeout: 120000, polling: 10 })
  await p.screenshot({ path: `${out}/${form}-2-air.png` })
  await p.waitForFunction(() => window.__stunt.roll >= Math.PI * 2 - 0.2 || window.__stunt.phase !== 'air', null, { timeout: 120000, polling: 10 })
  await p.keyboard.up('ArrowRight')
  await p.waitForFunction(() => window.__stunt.spin >= Math.PI * 2 - 0.2 || window.__stunt.phase !== 'air', null, { timeout: 120000, polling: 10 })
  await p.keyboard.up(' ')
  await p.waitForFunction(() => window.__stunt.phase === 'roll' || window.__stunt.phase === 'crash', null, { timeout: 120000, polling: 10 })
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${out}/${form}-3-land.png` })
  console.log(form, await p.evaluate(() => JSON.stringify({ last: window.__stunt.last, x: window.__stunt.x })))
  await p.close()
}
await b.close()
