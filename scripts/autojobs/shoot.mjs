// node scripts/autojobs/shoot.mjs <outDir>   (needs vite on :5173). My Cars' Auto jobs button, its preview, and after.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'autojobs-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const up = (n) => ({ engine: n, turbo: n, tires: n, weight: n })
const cars = [
  { uid: 'g1', model: 'stallion', color: '#c62828', upgrades: up(3) },
  { uid: 'g2', model: 'miata', color: '#1e88e5', upgrades: up(1) },
  { uid: 'g3', model: 'trail', color: '#fdd835', upgrades: up(2) },
  { uid: 'g4', model: 'civic', color: '#43a047', upgrades: up(0) },
  { uid: 'g5', model: 'pip', color: '#c62828', upgrades: up(0), flat: true },
  { uid: 'g6', model: 'rally', color: '#0d47a1', upgrades: up(2) },
]
const jobs = [['pizza', 3, 'g6'], ['diner', 2], ['cinema', 1, 'g2'], ['tires', 2], ['icecream', 1], ['coffee', 1]]
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2000)
  await p.evaluate(({ cars, jobs }) => {
    const g = window.__game
    const kept = g.getState().buildings.filter((o) => !['pizza', 'diner', 'cinema', 'tires', 'icecream', 'coffee'].includes(o.def)).map((o) => ({ ...o, car: undefined }))
    const add = jobs.map(([def, level, car], i) => ({ uid: `aj${i}`, def, x: 60 + i * 4, z: 60, jobEndsAt: null, level, car }))
    g.setState({ tutorial: 99, level: 20, cars, buildings: [...kept, ...add], selectedCar: 'g1', panel: null })
    g.getState().openPanel('garage')
  }, { cars, jobs })
  await p.waitForSelector('.stage-slot[data-ready="1"]', { timeout: 60000 }).catch(() => console.log('thumbs not ready'))
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}-1-garage.png` })
  await p.locator('.auto-jobs-btn').click()
  await p.waitForTimeout(4000)
  await p.screenshot({ path: `${out}/${form}-2-preview.png` })
  await p.locator('.aj-go').click()
  await p.waitForTimeout(1000)
  console.log(form, await p.evaluate(() => window.__game.getState().buildings.filter((o) => o.uid.startsWith('aj')).map((o) => `${o.def}:${o.car ?? '-'}`).join(' ')))
  await p.locator('.auto-jobs-btn').click()
  await p.waitForTimeout(4000)
  await p.screenshot({ path: `${out}/${form}-3-after.png` })
  await p.close()
}
await b.close()
