// Screenshots for the campaign difficulty pass: Desert Strip's rows at level 8 in a PI 47 car, and
// the loss card. Needs `npx vite` running. node scripts/campaignshot/shoot.mjs <out dir>
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')
const [, , out = 'campaignshot-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(3000)
  const done = Object.fromEntries(['c1', 'c2'].flatMap((c) => [0, 1, 2, 3, 4].map((i) => [`${c}-${i}`, 3])))
  await p.evaluate((campaign) => window.__game.setState({ tutorial: 99, level: 8, coins: 25000, panel: null, campaign, raceCar: null, cars: [{ uid: 'x1', model: 'crusher', color: '#e65100', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }] }), done)
  for (let tries = 0; tries < 3 && !(await p.$('.rm-rows')); tries++) {
    await p.evaluate(async () => { (await import('/src/ui/raceNav.ts')).openRaceTab('campaign') })
    await p.waitForTimeout(2500)
  }
  await p.screenshot({ path: `${out}/${form}-campaign.png` })
  await p.goto('http://localhost:5173/scripts/campaignshot/index.html')
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-loss.png` })
  await p.close()
}
await b.close()
