// Screenshots of the Goals tab with the story done and endless goals on the board: fresh, one collected, and capped.
// node scripts/goalsshot/shoot.mjs <outDir> <claimedGoals JSON>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out, claimedJson] = process.argv
const claimed = JSON.parse(claimedJson)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(3000)
  await p.evaluate((claimed) => window.__game.setState({ tutorial: 99, level: 24, xp: 0, coins: 250000, panel: null, claimedGoals: claimed, endless: { n: 9, day: '', today: 0, goals: [] } }), claimed)
  await p.waitForTimeout(2500)
  console.log(form, JSON.stringify(await p.evaluate(() => window.__game.getState().endless)))
  // Finish the counter goals so one row shows Collect.
  await p.evaluate(() => { const s = window.__game.getState(); const st = { ...s.stats }; for (const k of Object.keys(st)) st[k] += 1000; window.__game.setState({ stats: st }) })
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${out}/${form}-hud.png` })
  await p.evaluate(() => window.__game.setState({ panel: 'goals' }))
  await p.waitForSelector('.panel', { timeout: 30000 })
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}-goals.png` })
  // Collect one, then hit the daily cap.
  await p.evaluate(() => [...document.querySelectorAll('.goal button.buy')].find((b) => b.textContent.includes('Collect'))?.click())
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-collected.png` })
  console.log(form, 'after', JSON.stringify(await p.evaluate(() => { const s = window.__game.getState(); return { e: s.endless, coins: s.coins, parts: s.parts } })))
  await p.evaluate(() => { const s = window.__game.getState(); window.__game.setState({ endless: { ...s.endless, day: new Date().toISOString().slice(0, 10), today: 12 } }) })
  await p.evaluate(() => { const s = window.__game.getState(); const st = { ...s.stats }; for (const k of Object.keys(st)) st[k] += 1000; window.__game.setState({ stats: st }) })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-capped.png` })
  await p.close()
}
await b.close()
