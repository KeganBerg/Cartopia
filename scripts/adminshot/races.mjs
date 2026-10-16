// Admin skips race and Rusty's level locks: Grand Prix and Rusty's at level 1, as admin then as a player.
// node scripts/adminshot/races.mjs <outDir>   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'
const [, , out = 'admin-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const forms = [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]].filter(([f]) => !process.env.FORM || process.env.FORM === f)
for (const [form, size] of forms) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState((s) => ({ tutorial: 99, buildings: s.buildings.map((b, i) => (i === 0 ? { ...b, def: 'rescue' } : b)) })))
  for (const who of ['admin', 'player']) {
    await p.evaluate((a) => window.__game.setState({ panel: null, panelBack: [], level: 1, admin: a }), who === 'admin')
    await p.evaluate(() => window.__game.getState().openPanel('race'))
    await p.waitForTimeout(2500)
    await p.locator('.rm-gp').first().click()
    await p.waitForTimeout(2000)
    await p.screenshot({ path: `${out}/${form}-gp-${who}.png` })
    await p.evaluate(() => window.__game.setState({ panel: null, panelBack: [] }))
    await p.waitForTimeout(500)
    await p.evaluate(() => window.__game.getState().openPanel('rescue'))
    await p.waitForTimeout(4000)
    await p.screenshot({ path: `${out}/${form}-rusty-${who}.png` })
  }
  console.log(form)
  await p.close()
}
await b.close()
