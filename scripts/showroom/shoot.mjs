// node scripts/showroom/shoot.mjs <outDir>   (needs vite on :5173). The garage turntable and full-screen look in the Showroom.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'showroom-out', model = 'stallion', color = '#c62828'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const cars = [{ uid: 's1', model, color, upgrades: { engine: 1, turbo: 1, tires: 1, weight: 1 } }]
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]].filter(([f]) => !process.env.ONLY || process.env.ONLY === f)) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)) })
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2000)
  await p.evaluate((cars) => {
    const g = window.__game
    g.setState({ tutorial: 99, level: 20, cars, selectedCar: 's1', panel: null })
    g.getState().openPanel('garage')
  }, cars)
  await p.waitForSelector('.car-preview .stage-slot[data-ready="1"]', { timeout: 60000 }).catch(() => console.log('not ready'))
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}-1-garage.png` })
  console.log(form, 'garage')
  if (form === 'phone') {
    // Buy an engine upgrade: the dyno run plays on the turntable, which sinks into its pit.
    await p.evaluate(() => window.__game.setState({ coins: 1e7, parts: 999 }))
    await p.evaluate(() => [...document.querySelectorAll('.garage-detail button')].find((b) => /\$/.test(b.textContent))?.click())
    await p.waitForTimeout(2200)
    await p.screenshot({ path: `${out}/${form}-1b-dyno.png` })
    await p.waitForTimeout(5000)
  }
  await p.evaluate(() => document.querySelector('.car-preview .cp-btn[aria-label="Full screen"]').click())
  console.log(form, 'inspect')
  await p.waitForSelector('.car-inspect .stage-slot[data-ready="1"]', { timeout: 60000 }).catch(() => console.log('inspect not ready'))
  await p.waitForTimeout(3500)
  await p.screenshot({ path: `${out}/${form}-2-inspect.png` })
  // Drag to orbit round to the far side of the room.
  const box = await p.locator('.car-inspect .ci-view').boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + box.width * 0.45, cy - 20, { steps: 12 }); await p.mouse.up()
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-3-orbit.png` })
  if (form === 'desktop') {
    await p.evaluate(() => document.querySelector('.ci-photo').click())
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${form}-4-photo.png` })
  }
  await p.close()
}
await b.close()
