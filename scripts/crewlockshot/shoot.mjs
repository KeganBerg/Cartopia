// The Crew tab before and after building the Crew House, phone and desktop, signed out.
// node scripts/crewlockshot/shoot.mjs <outDir>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'crewlockshot-out'] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('pageerror', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(3000)
  await p.evaluate(() => window.__game.setState((s) => ({ tutorial: 99, level: 25, coins: 50000, buildings: s.buildings.filter((x) => x.def !== 'crew'), panel: 'clan' })))
  await p.waitForTimeout(6000)
  await p.screenshot({ path: `${out}/${form}-locked.png` })
  console.log(form, 'locked shown', await p.locator('.crew-locked').count())
  await p.locator('.crew-locked button').dispatchEvent('click')
  await p.waitForTimeout(1500)
  console.log(form, 'after Build tap', await p.evaluate(() => window.__game.getState().mode))
  await p.close()
}
await b.close()
