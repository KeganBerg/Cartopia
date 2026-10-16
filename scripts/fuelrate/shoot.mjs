// node scripts/fuelrate/shoot.mjs <outDir>   (needs vite on :5173). Fuel refill rate on level-up, the HUD and the fuel help.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'fuelrate-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => {
    localStorage.setItem('cartopia-flash-warning-hide', '1')
    localStorage.setItem('cartopia.tips', JSON.stringify(['gems', 'goals', 'garage', 'taptip', 'fuel', 'tires', 'crates', 'crew', 'arcade']))
  })
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99 }))
  const lvl = async (from, to, name) => {
    await p.evaluate(([from, to]) => window.__game.setState({ level: to, xp: 0, panel: null, need: null, levelUp: { from, to, coins: 1500, bucks: 1 } }), [from, to])
    await p.waitForTimeout(3000)
    await p.screenshot({ path: `${out}/${form}-${name}.png`, timeout: 90000 })
  }
  await lvl(14, 15, '1-levelup-step')
  await lvl(15, 16, '2-levelup-teaser')
  await p.evaluate(() => window.__game.setState({ levelUp: null, level: 30, fuel: 20, fuelUpdatedAt: Date.now() - 5000 }))
  await p.waitForTimeout(2000)
  await p.screenshot({ path: `${out}/${form}-3-hud.png`, timeout: 90000 })
  await p.evaluate(() => window.__game.getState().showNeed('fuel', 0))
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-4-fuel-help.png`, timeout: 90000 })
  await p.close()
}
await b.close()
