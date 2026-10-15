// node scripts/crate10/shoot.mjs <outDir> [single|ten|again]   (needs vite on :5173).
// The Crate Depot's reveal of a part prize, and the ×10 open: mid sequence, the last pull and the summary.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'crate-out', mode = 'single'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const forms = process.env.FORM ? [process.env.FORM] : ['desktop', 'phone']
const sizes = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } }
// Ten prizes as the server would hand them back (seq order), for the stub opener.
const TEN = (crate, cost) => [
  { kind: 'coins', coins: 900, jackpot: false },
  { kind: 'mod', car: 'me1', mod: 'attackwing' },
  { kind: 'coins', coins: 1400, jackpot: false },
  { kind: 'skin', skin: '__skin__', part: false },
  { kind: 'coins', coins: 4800, jackpot: true },
  { kind: 'hat', hat: '__hat__' },
  { kind: 'dupe', model: 'civic', coins: 700 },
  { kind: 'car', model: 'vette', uid: 'knew1', color: '#b71c1c' },
  { kind: 'coins', coins: 1100, jackpot: false },
  { kind: 'mod', car: 'me1', mod: '__mod2__' },
].map((drop, i) => ({ seq: 100 + i + 1, crate, cost, drop }))
for (const form of forms) {
  const p = await b.newPage({ viewport: sizes[form], deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto(`${process.env.URL ?? 'http://localhost:5173'}/?time=0.3&season=fall`)
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => {
    const g = window.__game
    const cars = [{ uid: 'me1', model: 'vette', color: '#eceff1', upgrades: g.getState().cars[0]?.upgrades ?? { engine: 0, tires: 0, weight: 0 } }, ...g.getState().cars]
    g.setState({ tutorial: 99, level: 30, coins: 900000, bucks: 5000, crates: 100, cars, selectedCar: 'me1', panel: null })
  })
  await p.evaluate(async ([ten]) => {
    const m = await import('/src/game/store.ts')
    const data = await import('/src/game/data.ts')
    const hats = await import('/src/game/hats.ts')
    const skin = data.SKINS.find((s) => s.tier === 'epic') ?? data.SKINS[0]
    const mod2 = data.MODS.find((x) => x.slot === 'exhaust' && x.bucks)?.id ?? data.MODS[0].id
    const hat = hats.HATS.find((h) => !h.challenge)?.id ?? hats.HATS[0].id
    const fix = (o) => JSON.parse(JSON.stringify(o).replace('__skin__', skin.id).replace('__mod2__', mod2).replace('__hat__', hat))
    window.__ten = fix(ten)
    window.__stub = () => m.setCrateOpener(async (crate, free, count) => {
      await new Promise((r) => setTimeout(r, window.__delay ?? 300))
      const cost = { coins: 0, bucks: 25 }
      return count && count > 1 ? window.__ten.map((o) => ({ ...o, crate, cost })) : [{ seq: 101, crate, cost, drop: window.__ten[1].drop }]
    })
  }, [TEN('diamond', { coins: 0, bucks: 25 })])
  await p.evaluate(() => { localStorage.setItem('cartopia-crate', 'diamond'); window.__game.getState().openPanel('crates') })
  await p.waitForSelector('.crate-open', { timeout: 60000 })
  await p.waitForSelector('.stage-slot[data-ready="1"]', { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-0-dock.png` })
  // The game's own opener (lib/crates.ts) loads with the depot; the stub goes on after it.
  await p.evaluate(() => window.__stub())
  if (mode === 'single') {
    await p.click('.crate-open')
    await p.waitForSelector('.crate-prize', { timeout: 30000 })
    await p.waitForTimeout(1500)
    await p.screenshot({ path: `${out}/${form}-1-single-part.png` })
  } else if (mode === 'again') {
    // Again ×10 from the summary goes straight into the next ten: the menu never comes back.
    await p.click('.crate-open.ten')
    await p.click('.crate-ten-skip', { timeout: 30000 })
    await p.waitForSelector('.crate-sum', { timeout: 30000 })
    await p.waitForTimeout(1500)
    await p.evaluate(() => { window.__delay = 1500 })
    await p.click('.crate-sum .cp-actions .buy')
    let dock = 0
    for (let i = 0; i < 12; i++) {
      if (await p.$('.crate-dock')) dock++
      if (i === 3) await p.screenshot({ path: `${out}/${form}-5-again-wait.png` })
      await p.waitForTimeout(150)
    }
    await p.waitForSelector('.crate-ten-strip', { timeout: 30000 })
    await p.waitForTimeout(1200)
    await p.screenshot({ path: `${out}/${form}-6-again-running.png` })
    console.log(form, 'dock seen in', dock, 'of 12 samples')
  } else {
    await p.click('.crate-open.ten')
    await p.waitForTimeout(2600)
    await p.screenshot({ path: `${out}/${form}-1-ten-early.png` })
    await p.waitForTimeout(6000)
    await p.screenshot({ path: `${out}/${form}-2-ten-mid.png` })
    await p.click('.crate-ten-skip')
    await p.waitForSelector('.crate-sum', { timeout: 30000 })
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${form}-3-summary.png` })
    await p.click('.crate-sum-tile:nth-child(2)')
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${form}-4-inspect.png` })
  }
  await p.close()
  console.log(form)
}
await b.close()
