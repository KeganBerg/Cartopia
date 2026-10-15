// Bay 2 with one car in the lot: level 16, bay 1 busy, bay 2 free. Shoots the lot, taps the car
// and Restore, and prints which bay the car went into.
// node scripts/rescue/bay2shot.mjs <outDir>   (needs `npm run dev` on :5173 and Playwright)
import { chromium } from 'playwright'
const [, , out = 'rescue-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
  await p.goto('http://localhost:5173/?time=0.08&season=summer')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => {
    const g = window.__game
    const s = g.getState()
    const has = s.buildings.some((x) => x.def === 'rescue')
    g.setState({
      tutorial: 99, coins: 50000, parts: 40, level: 16, truck: 1,
      buildings: has ? s.buildings : [...s.buildings, { uid: 'rr', def: 'rescue', x: 4, z: 4, jobEndsAt: null, level: 3 }],
      junkyard: [{ uid: 'j1', model: 'hauler', rarity: 'common' }],
      restoring: { uid: 'r1', model: 'cruiser', rarity: 'common', minutes: 5, endsAt: Date.now() + 192000 },
      restoring2: null,
      panel: 'rescue',
    })
  })
  await p.waitForSelector('[role=tab]', { timeout: 60000, state: 'attached' })
  await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((t) => /My lot/.test(t.textContent))?.click())
  await p.waitForTimeout(3500)
  await p.screenshot({ path: `${out}/${form}-before.png`, timeout: 180000 })
  await p.locator('.lot-spot.rr-common').first().click()
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${out}/${form}-tapped.png`, timeout: 180000 })
  const go = p.locator('.junk-go')
  console.log(form, 'restore button', await go.count() ? await go.innerText() : 'none', await go.count() ? await go.isVisible() : '', await go.count() ? await go.isDisabled() : '')
  // What a finger on the button's middle actually hits.
  console.log(form, 'hit', await p.evaluate(() => {
    const el = document.querySelector('.junk-go')
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return `${JSON.stringify(r)} ${hit?.tagName}.${hit?.className} inside=${el.contains(hit)}`
  }))
  await p.evaluate(() => document.querySelector('.junk-go').click())
  await p.waitForTimeout(1500)
  console.log(form, await p.evaluate(() => { const s = window.__game.getState(); return JSON.stringify({ lot: s.junkyard.length, bay1: s.restoring?.model, bay2: s.restoring2?.model }) }))
  await p.screenshot({ path: `${out}/${form}-after.png`, timeout: 180000 })
  await p.close()
}
await b.close()
