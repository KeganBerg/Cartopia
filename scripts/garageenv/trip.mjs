// node scripts/garageenv/trip.mjs <outDir>   (needs vite on :5173). The Cars page walking from the
// room through the roller door into the Crate Depot and back, on phone and desktop: stills along
// the way and a video of each run. Also opens Crates from outside the page (the coins popup's way).
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'garageenv-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const up = (n) => ({ engine: n, turbo: n, tires: n, weight: n })
const cars = [{ uid: 's1', model: 'stallion', color: '#c62828', upgrades: up(1) }, { uid: 's2', model: 'miata', color: '#1e88e5', upgrades: up(2) }]
const sizes = [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]].filter(([f]) => !process.env.ONLY || process.env.ONLY === f)
const tab = (p, i) => p.evaluate((i) => [...document.querySelectorAll('.cars-page .sheet-tabs button')][i].click(), i)
const state = (p) => p.evaluate(() => ({ cls: document.querySelector('.cars-page')?.className, crates: !!document.querySelector('.cars-crates'), loading: !!document.querySelector('.cars-page .loading-scene, .cars-page .ld-scene') }))
for (const [form, size] of sizes) {
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone', recordVideo: { dir: `${out}/video-${form}`, size } })
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
    g.setState({ tutorial: 99, level: 20, coins: 1e7, parts: 999, cars, selectedCar: 's1', panel: null })
    g.getState().openPanel('garage')
  }, cars)
  await p.waitForSelector('.garage-scene .stage-slot[data-ready="1"]', { timeout: 90000 }).catch(() => console.log('not ready'))
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-t0-room.png` })
  // Walk out: stills on the way to the door, then the depot.
  await tab(p, 4)
  const t0 = Date.now()
  for (const ms of [350, 750]) {
    await p.waitForTimeout(Math.max(0, ms - (Date.now() - t0)))
    await p.screenshot({ path: `${out}/${form}-t${ms}-out.png` })
    console.log(form, ms, JSON.stringify(await state(p)))
  }
  await p.waitForFunction(() => !/trip-/.test(document.querySelector('.cars-page')?.className ?? ''), null, { timeout: 30000 }).catch(() => console.log('trip never ended'))
  console.log(form, 'depot in after', Date.now() - t0, 'ms', JSON.stringify(await state(p)))
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${out}/${form}-t1-depot.png` })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-t2-depot-settled.png` })
  // And back to the room.
  await tab(p, 0)
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${out}/${form}-t3-back.png` })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-t4-room-again.png` })
  console.log(form, 'back', JSON.stringify(await state(p)))
  // From outside the page: the coins popup's Open crates (swapPanel('crates') from no Cars page).
  await p.evaluate(() => { const g = window.__game.getState(); g.closePanel(); })
  await p.waitForTimeout(800)
  await p.evaluate(() => window.__game.getState().swapPanel('crates'))
  const t1 = Date.now()
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${out}/${form}-t5-outside-walk.png` })
  console.log(form, 'outside', JSON.stringify(await state(p)))
  await p.waitForFunction(() => !/trip-/.test(document.querySelector('.cars-page')?.className ?? ''), null, { timeout: 30000 }).catch(() => console.log('outside trip never ended'))
  console.log(form, 'outside depot in after', Date.now() - t1, 'ms')
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-t6-outside-depot.png` })
  await ctx.close()
}
await b.close()
