// Screenshots for the race modes build-out: Campaign star gate, Pro Tour ranks, Grand Prix chain
// and big box cars, paint rival tiers. Needs `npx vite` running. node scripts/racemodes/shoot.mjs <out dir>
// One fresh page per screen: swiftshader can drop the WebGL context, and the game reloads on restore.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')
const [, , out = 'racemodes-out', only] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const races = (c, n) => Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`${c}-${i}`, n]))
const car = (uid, model) => ({ uid, model, color: '#e65100', upgrades: { engine: 2, turbo: 2, tires: 2, weight: 2 } })
const seed = {
  tutorial: 99, level: 8, coins: 25000, fuel: 60, panel: null, raceCar: null,
  campaign: { ...races('c1', 3), ...races('c2', 1), ...races('c3', 1) },
  tour: 23, gp: { rookie: { round: 1, clears: 1 } },
  rivalRow: { sunny: 1, penny: 1, gus: 1, moss: 1, violet: 1 },
  cars: [car('x1', 'stallion'), car('x2', 'miata'), car('x3', 'trail'), car('x4', 'civic')],
}
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  for (const tab of ['campaign', 'campaign-open', 'tour', 'gp', 'rivals']) {
    if (only && !tab.startsWith(only)) continue
    const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
    await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
    p.on('pageerror', (e) => console.log('error', e.message))
    await p.goto('http://localhost:5173/?time=0.3&season=fall')
    await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
    await p.waitForTimeout(3000)
    await p.evaluate((s) => window.__game.setState(s), seed)
    await p.addStyleTag({ content: '*{animation-duration:0s!important;transition:none!important}' })
    await p.evaluate(async (t) => { (await import('/src/ui/raceNav.ts')).openRaceTab(t) }, tab.split('-')[0])
    await p.waitForTimeout(2500)
    if (tab === 'campaign') await p.click('[aria-label="Mountain Pass"]')
    if (tab === 'campaign-open') await p.click('[aria-label="Desert Strip"]')
    await p.waitForTimeout(4000)
    await p.screenshot({ path: `${out}/${form}-${tab}.png` })
    await p.close()
  }
}
await b.close()
