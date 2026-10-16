// node scripts/garageenv/sections.mjs <outDir>   (needs vite on :5173). The Cars page's four sections on phone and desktop.
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
const tab = (p, i) => p.evaluate((i) => [...document.querySelectorAll('.cars-page .sheet-tabs button')][i].click(), i)
for (const [form, size] of sizes) {
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2000)
  await p.evaluate((cars) => {
    const g = window.__game
    const s = g.getState()
    // Rusty's Rescue built somewhere out of the way, so For Sale can sell.
    g.setState({ tutorial: 99, level: 20, coins: 1e7, parts: 999, cars, selectedCar: 's1', panel: null, buildings: [...s.buildings, { ...s.buildings[0], uid: 'shot-rescue', def: 'rescue', x: 900, z: 900, car: null }] })
    g.getState().openPanel('garage')
  }, cars)
  await p.waitForSelector('.garage-scene .stage-slot[data-ready="1"]', { timeout: 90000 }).catch(() => console.log('not ready'))
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-1-mycars.png` })
  await tab(p, 1)
  await p.waitForSelector('.garage.sale .stage-slot[data-ready="1"]', { timeout: 60000 }).catch(() => console.log('sale not ready'))
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-2-forsale.png` })
  if (form === 'phone') {
    await p.evaluate(() => document.querySelector('.cars-page .garage').scrollTo(0, 700))
    await p.waitForTimeout(1000)
    await p.screenshot({ path: `${out}/${form}-2b-forsale-grid.png` })
    await p.evaluate(() => [...document.querySelectorAll('.sale-item')][6].click())
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${form}-2c-forsale-picked.png` })
  } else {
    await p.evaluate(() => [...document.querySelectorAll('.sale-item')][6].click())
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${form}-2c-forsale-picked.png` })
  }
  await tab(p, 2)
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}-3-collection.png` })
  await tab(p, 3)
  await p.waitForTimeout(9000)
  await p.screenshot({ path: `${out}/${form}-4-crates.png` })
  console.log(form, 'panel', await p.evaluate(() => window.__game.getState().panel))
  await tab(p, 0)
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-5-back-mycars.png` })
  console.log(form, 'done', await p.evaluate(() => window.__game.getState().panel))
  await ctx.close()
}
await b.close()
