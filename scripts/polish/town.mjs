// A phone tour of the town screens: each starter building tapped, its upgrade panel, Edit mode and the
// Rusty's job screens. node scripts/polish/town.mjs <outDir>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'polish-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
p.on('pageerror', (e) => console.log('error', e.message))
await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
await p.goto('http://localhost:5173/?time=0.3&season=fall')
await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
await p.waitForTimeout(3000)
await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, coins: 250000, panel: null }))
await p.waitForTimeout(1500)
await p.screenshot({ path: `${out}/town.png` })
const list = await p.evaluate(() => window.__game.getState().buildings.map((x) => [x.uid, x.def]))
console.log(JSON.stringify(list))
for (const [uid, def] of list.slice(0, Number(process.env.N ?? 8))) {
  await p.evaluate((uid) => window.__game.getState().select(uid), uid)
  await p.waitForTimeout(1800)
  await p.screenshot({ path: `${out}/tap-${def}.png` })
  await p.evaluate((uid) => { const s = window.__game.getState(); s.select(null); s.openUpgrade?.(uid) ?? window.__game.setState({ panel: 'upgrade', upgrading: uid }) }, uid)
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/upgrade-${def}.png` })
  await p.evaluate(() => window.__game.setState({ panel: null, selected: null }))
}
await p.evaluate(() => window.__game.setState({ mode: 'edit' }))
await p.waitForTimeout(2000)
await p.screenshot({ path: `${out}/edit.png` })
await b.close()
