// node scripts/arcadeshot/wash.mjs <outDir>   (needs vite on :5173). Car Wash: scrubbing, a car rolling out, the next one in.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'wash-out'] = process.argv
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
  await p.click('.arc-tile.wash .buy', { noWaitAfter: true, timeout: 90000 })
  await p.waitForFunction(() => window.__wash && window.__wash.t > 0.3, null, { timeout: 120000 })
  // Scrub a few strokes across the car, then (to save time in a slow headless browser) mark the
  // rest clean and finish with one more stroke so the car rolls out and the next one rolls in.
  const box = await p.locator('.arc-scrub').boundingBox()
  const stroke = async () => {
    const y = box.y + box.height * 0.5
    await p.mouse.move(box.x + box.width * 0.25, y)
    await p.mouse.down()
    // Hold on after each sweep so a (slow) frame sees the press.
    for (let i = 0; i < 4; i++) {
      await p.mouse.move(box.x + box.width * (i % 2 ? 0.25 : 0.75), y + (i % 2) * 10, { steps: 2 })
      await p.waitForTimeout(450)
    }
    await p.mouse.up()
  }
  await stroke()
  await p.screenshot({ path: `${out}/${form}-wash-1.png` })
  await p.evaluate(() => { window.__wash.dirty = 0 })
  await p.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5)
  await p.mouse.down()
  await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 2 })
  await p.waitForFunction(() => window.__wash.phase === 'out', null, { timeout: 60000, polling: 10 }).catch(() => {})
  await p.screenshot({ path: `${out}/${form}-wash-2.png` })
  await p.mouse.up()
  await p.waitForFunction(() => window.__wash.phase === 'wash' && window.__wash.cars > 0, null, { timeout: 60000 })
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${out}/${form}-wash-3.png` })
  console.log(form, await p.evaluate(() => JSON.stringify({ cars: window.__wash.cars, dirty: window.__wash.dirty, left: window.__wash.left })))
  await p.close()
}
await b.close()
