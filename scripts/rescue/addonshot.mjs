// Screenshots of Rusty's add-ons on desktop and phone: the Find tab (tow truck row, hot tip, set
// chips) and the lot with both bays busy (level 16) or bay 2 still locked (level 10).
// node scripts/rescue/addonshot.mjs <outDir>   (needs `npm run dev` on :5173 and Playwright)
import { chromium } from 'playwright'
const [, , out = 'rescue-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const car = (uid, model) => ({ uid, model, color: '#c62828', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  for (const state of ['find', 'bays', 'locked']) {
    const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
    p.on('pageerror', (e) => console.log('error', e.message))
    await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
    await p.goto('http://localhost:5173/?time=0.08&season=summer')
    await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
    await p.waitForTimeout(2500)
    await p.evaluate(({ state, cars }) => {
      const g = window.__game
      const s = g.getState()
      const has = s.buildings.some((x) => x.def === 'rescue')
      const now = Date.now()
      g.setState({
        tutorial: 99, coins: 50000, parts: 40, level: state === 'locked' ? 10 : 16, truck: 1,
        buildings: has ? s.buildings : [...s.buildings, { uid: 'rr', def: 'rescue', x: 4, z: 4, jobEndsAt: null, level: 3 }],
        // Every Suburbs car (set ready to claim) and every Farm car (claimed).
        cars: [...s.cars, ...cars], claimedSets: [...(s.claimedSets ?? []), 'rusty-farm'],
        junkyard: [{ uid: 'j1', model: 'miata', rarity: 'rare' }, { uid: 'j2', model: 'woodie', rarity: 'scarce' }, { uid: 'j3', model: 'cruiser', rarity: 'common' }],
        restoring: { uid: 'r1', model: 'cruiser', rarity: 'common', minutes: 5, endsAt: now + 192000 },
        restoring2: state === 'bays' ? { uid: 'r2', model: 'stallion', rarity: 'scarce', minutes: 30, endsAt: now + 1500000 } : null,
        panel: 'rescue',
      })
    }, { state, cars: ['pip', 'civic', 'bug', 'woodie', 'trail', 'miata', 'hauler', 'buggy', 'stallion'].map((m, i) => car('s' + i, m)) })
    await p.waitForSelector('[role=tab]', { timeout: 60000, state: 'attached' })
    const tab = state === 'find' ? /Find cars/ : /My lot/
    await p.evaluate((src) => [...document.querySelectorAll('[role=tab]')].find((t) => new RegExp(src).test(t.textContent))?.click(), tab.source)
    await p.waitForTimeout(3500)
    await p.screenshot({ path: `${out}/${form}-${state}.png`, timeout: 180000 })
    if (state === 'find' && form === 'phone') {
      await p.evaluate(() => document.querySelector('.rsc-truck')?.scrollIntoView())
      await p.evaluate(() => { const l = document.querySelectorAll('.rsc-spot'); l[l.length - 1]?.scrollIntoView() })
      await p.waitForTimeout(800)
      await p.screenshot({ path: `${out}/${form}-${state}-end.png`, timeout: 180000 })
    }
    console.log(form, state)
    await p.close()
  }
}
await b.close()
