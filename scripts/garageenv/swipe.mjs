// node scripts/garageenv/swipe.mjs <outDir>   (needs vite on :5173). Real touch swipes on My Cars at phone size: does the sheet scroll?
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'garageenv-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const up = (n) => ({ engine: n, turbo: n, tires: n, weight: n })
const cars = [
  { uid: 's1', model: 'stallion', color: '#c62828', upgrades: up(1) },
  { uid: 's2', model: 'miata', color: '#1e88e5', upgrades: up(2) },
]
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
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
const cdp = await ctx.newCDPSession(p)
const swipe = async (x, y0, y1, x1 = x) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + ((x1 - x) * i) / 12, y: y0 + ((y1 - y0) * i) / 12 }] })
    await p.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.waitForTimeout(700)
}
const info = (x, y) => p.evaluate(([x, y]) => {
  const el = document.elementFromPoint(x, y)
  const path = []
  for (let e = el; e && path.length < 6; e = e.parentElement) path.push(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : ''))
  const g = document.querySelector('.garage')
  return { hit: path.join(' < '), scrollTop: g.scrollTop, scrollH: g.scrollHeight, clientH: g.clientHeight, ta: getComputedStyle(el).touchAction }
}, [x, y])
console.log('chain', await p.evaluate(() => { const out = []; for (let e = document.elementFromPoint(195, 330); e; e = e.parentElement) out.push((e.className && typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName) + ':' + getComputedStyle(e).touchAction + (e.style.touchAction ? '(inline ' + e.style.touchAction + ')' : '')); return out.join(' < ') }))
console.log('car', JSON.stringify(await info(195, 250)))
for (const [label, y] of [['car', 330], ['sheet', 650], ['upgrades', 780]]) {
  console.log(label, 'before', JSON.stringify(await info(195, y)))
  await swipe(195, y, y - 350)
  console.log(label, 'after', JSON.stringify(await info(195, y)))
  if (label === 'car') await p.evaluate(() => document.querySelector('.garage').scrollTo(0, 0))
}
await p.evaluate(() => document.querySelector('.garage').scrollTo(0, 0))
await p.waitForTimeout(800)
await p.screenshot({ path: `${out}/spin-before.png` })
await swipe(80, 300, 300, 330)
await p.screenshot({ path: `${out}/spin-after.png` })
console.log('side swipe scrollTop', await p.evaluate(() => document.querySelector('.garage').scrollTop))
await b.close()
