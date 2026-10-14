// node scripts/arcadeshot/shoot.mjs <outDir> [game...]   (needs vite on :5173). Each arcade game a few seconds in.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'arcade-out', ...only] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const games = ['panel', 'chase', 'delivery', 'stunt', 'wash', 'pit', 'park']
const forms = process.env.FORMS ? process.env.FORMS.split(',') : ['phone', 'desktop']
const sizes = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } }
for (const form of forms) {
  for (const g of only.length ? only : games) {
    const p = await b.newPage({ viewport: sizes[form], deviceScaleFactor: form === 'phone' ? 2 : 1, hasTouch: form === 'phone' })
    p.on('pageerror', (e) => console.log('error', e.message))
    await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
    await p.goto('http://localhost:5173/?time=0.3&season=fall')
    await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
    await p.waitForTimeout(2500)
    await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, coins: 120000, fuel: 99, panel: null }))
    await p.evaluate(() => window.__game.getState().openPanel('arcade'))
    await p.waitForSelector('.arc-tile', { timeout: 60000 })
    await p.waitForTimeout(1500)
    if (g === 'panel') { await p.screenshot({ path: `${out}/${form}-panel.png` }); await p.close(); continue }
    if (g === 'park') {
      await p.click('.arc-tile.park .buy')
      await p.click('.arc-lot >> nth=0')
    } else await p.click(`.arc-tile.${g} .buy`)
    await p.waitForSelector('.stage-slot[data-ready="1"]', { timeout: 90000 }).catch(() => console.log('no ready', g))
    await p.waitForTimeout(Number(process.env.WAIT ?? 9000))
    if (g === 'chase') for (let i = 0; i < 6; i++) { await p.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight'); await p.waitForTimeout(700) }
    if (g === 'stunt') { await p.mouse.down(); await p.waitForTimeout(100); await p.mouse.up(); await p.waitForTimeout(2500) }
    await p.screenshot({ path: `${out}/${form}-${g}.png` })
    await p.close()
    console.log(form, g)
  }
}
await b.close()
