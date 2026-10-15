// node scripts/arcadeshot/cards.mjs <outDir>   (needs vite on :5173). The arcade panel's animated cards, a few frames apart.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'arcade-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const forms = process.env.FORMS ? process.env.FORMS.split(',') : ['phone', 'desktop']
const sizes = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } }
for (const form of forms) {
  const p = await b.newPage({ viewport: sizes[form], deviceScaleFactor: form === 'phone' ? 2 : 1, hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, coins: 120000, fuel: 99, panel: null }))
  await p.evaluate(() => window.__game.getState().openPanel('arcade'))
  await p.waitForSelector('.arc-scene', { timeout: 60000 })
  await p.waitForTimeout(Number(process.env.WAIT ?? 15000))
  for (let i = 0; i < Number(process.env.SHOTS ?? 3); i++) {
    await p.screenshot({ path: `${out}/${form}-cards-${i}.png` })
    await p.waitForTimeout(Number(process.env.GAP ?? 1200))
  }
  await p.close()
  console.log(form)
}
await b.close()
