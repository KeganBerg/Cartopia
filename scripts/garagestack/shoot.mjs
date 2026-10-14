// node scripts/garagestack/shoot.mjs <outDir>   (needs vite on :5173). My Garage with three copies of one car stacked.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'garagestack-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const up = (n) => ({ engine: n, turbo: n, tires: n, weight: n })
const cars = [
  { uid: 'g1', model: 'stallion', color: '#c62828', upgrades: up(1) },
  { uid: 'g2', model: 'stallion', color: '#1e88e5', upgrades: up(4), stripe: '#ffffff' },
  { uid: 'g3', model: 'stallion', color: '#fdd835', upgrades: up(2) },
  { uid: 'g4', model: 'miata', color: '#d32f2f', upgrades: up(0) },
  { uid: 'g5', model: 'miata', color: '#43a047', upgrades: up(3) },
  { uid: 'g6', model: 'rally', color: '#0d47a1', upgrades: up(2) },
  { uid: 'g7', model: 'pip', color: '#c62828', upgrades: up(0) },
]
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2000)
  await p.evaluate((cars) => {
    const g = window.__game
    g.setState({ tutorial: 99, level: 20, cars, selectedCar: null, panel: null })
    g.getState().openPanel('garage')
  }, cars)
  await p.waitForSelector('.stage-slot[data-ready="1"]', { timeout: 60000 }).catch(() => console.log('thumbs not ready'))
  await p.waitForTimeout(3000)
  if (form === 'phone') {
    await p.screenshot({ path: `${out}/${form}-1-garage.png` })
    await p.locator('.car-switch-name').click()
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${form}-2-picker.png` })
    await p.locator('.garage-list .copy-bubble').nth(2).click()
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${form}-3-copy.png` })
  } else {
    await p.screenshot({ path: `${out}/${form}-1-garage.png` })
    await p.locator('.garage-list .copy-bubble').nth(2).click()
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${form}-2-copy.png` })
  }
  console.log(form, await p.evaluate(() => window.__game.getState().selectedCar))
  await p.close()
}
await b.close()
