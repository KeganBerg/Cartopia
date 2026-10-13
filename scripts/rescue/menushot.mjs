// Screenshots of Rusty's panel (bay + lot) on desktop and phone.
// node scripts/rescue/menushot.mjs <outDir>   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'
const [, , out = 'rescue-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  for (const state of ['busy', 'free', 'done', 'find']) {
    const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
    p.on('pageerror', (e) => console.log('error', e.message))
await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
    await p.goto('http://localhost:5173/?time=0.08&season=summer')
    await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
    await p.waitForTimeout(2500)
    await p.evaluate((state) => {
      const g = window.__game
      const s = g.getState()
      const has = s.buildings.some((x) => x.def === 'rescue')
      const now = Date.now()
      g.setState({
        tutorial: 99, coins: 50000, level: 10,
        buildings: has ? s.buildings : [...s.buildings, { uid: 'rr', def: 'rescue', x: 4, z: 4, jobEndsAt: null, level: 3 }],
        junkyard: [{ uid: 'j1', model: 'miata', rarity: 'rare' }, { uid: 'j2', model: 'woodie', rarity: 'scarce' }, { uid: 'j3', model: 'cruiser', rarity: 'common' }],
        restoring: state === 'free' ? null : { uid: 'r1', model: 'cruiser', rarity: 'common', minutes: 5, endsAt: state === 'done' ? now - 1000 : now + 192000 },
        panel: 'rescue',
      })
    }, state)
    if (state === 'find') await p.waitForSelector('[role=tab]', { timeout: 60000 })
    if (state === 'find') await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((t) => /Find cars/.test(t.textContent))?.click())
    await p.waitForTimeout(3500)
    await p.screenshot({ path: `${out}/${form}-${state}.png` })
    console.log(form, state)
    await p.close()
  }
}
await b.close()
