// node scripts/wheelshot/shoot.mjs <outDir>   (needs vite on :5173). The daily wheel before, during and after a spin.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'wheel-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
// Where Math.random lands the guest's roll: inside a slice's range of the 100 weights.
const prizes = [['part', 0.38], ['jackpot', 0.995], ['gems', 0.72], ['skin', 0.9]]
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  for (const [name, r] of process.env.ONLY ? prizes.slice(0, 1) : prizes) {
    const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
    p.on('pageerror', (e) => console.log('error', e.message))
    await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
    await p.goto('http://localhost:5173/?time=0.3&season=fall')
    await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
    await p.waitForTimeout(2500)
    await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, coins: 120000, lastDaily: null, panel: null }))
    await p.evaluate(() => window.__game.getState().openPanel('daily'))
    await p.waitForSelector('.wh-go', { timeout: 60000 })
    await p.waitForSelector('.stage-slot[data-ready="1"]', { timeout: 90000 })
    await p.waitForTimeout(2500)
    if (name === 'part') await p.screenshot({ path: `${out}/${form}-1-ready.png` })
    await p.evaluate((r) => {
      const real = Math.random
      Math.random = () => r
      document.querySelector('.wh-go')?.click()
      setTimeout(() => { Math.random = real }, 50)
    }, r)
    await p.waitForTimeout(1800)
    if (name === 'part') await p.screenshot({ path: `${out}/${form}-2-spinning.png` })
    await p.waitForSelector('.wh-prize', { timeout: 30000 }).catch(() => console.log('no prize', form, name))
    await p.waitForTimeout(1500)
    await p.screenshot({ path: `${out}/${form}-3-won-${name}.png` })
    await p.close()
  }
  console.log(form)
}
await b.close()
