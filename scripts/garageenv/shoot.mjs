// node scripts/garageenv/shoot.mjs <outDir>   (needs vite on :5173). My Cars as a full-screen garage: phone and desktop.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'garageenv-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const up = (n) => ({ engine: n, turbo: n, tires: n, weight: n })
const cars = [
  { uid: 's1', model: 'stallion', color: '#c62828', upgrades: up(1) },
  { uid: 's2', model: 'miata', color: '#1e88e5', upgrades: up(2) },
  { uid: 's3', model: 'rally', color: '#fdd835', upgrades: up(3) },
]
const sizes = [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]].filter(([f]) => !process.env.ONLY || process.env.ONLY === f)
for (const [form, size] of sizes) {
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
    g.setState({ tutorial: 99, level: 20, coins: 1e7, parts: 999, cars, selectedCar: 's1', panel: null })
    g.getState().openPanel('garage')
  }, cars)
  await p.waitForSelector('.garage-scene .stage-slot[data-ready="1"]', { timeout: 90000 }).catch(() => console.log('not ready'))
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}-1-garage.png` })
  console.log(form, 'garage')
  if (form === 'phone') {
    await p.evaluate(() => document.querySelector('.garage').scrollTo(0, 400))
    await p.waitForTimeout(1200)
    await p.screenshot({ path: `${out}/${form}-2-scrolled.png` })
    await p.evaluate(() => document.querySelector('.garage').scrollTo(0, 0))
    await p.evaluate(() => document.querySelector('.car-switch-name').click())
    await p.waitForTimeout(2000)
    await p.screenshot({ path: `${out}/${form}-3-picking.png` })
    await p.evaluate(() => document.querySelector('.car-switch-name').click())
    await p.waitForTimeout(800)
  } else {
    await p.evaluate(() => [...document.querySelectorAll('.garage-tabs button')][2].click())
    await p.waitForTimeout(2000)
    await p.screenshot({ path: `${out}/${form}-2-paint.png` })
    await p.evaluate(() => [...document.querySelectorAll('.garage-tabs button')][0].click())
    await p.waitForTimeout(800)
  }
  await p.evaluate(() => [...document.querySelectorAll('.garage-detail .upgrade-row button')][0]?.click())
  await p.waitForTimeout(2200)
  await p.screenshot({ path: `${out}/${form}-4-dyno.png` })
  console.log(form, 'dyno')
  await p.close()
}
await b.close()
