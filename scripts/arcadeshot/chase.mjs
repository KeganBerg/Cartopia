// node scripts/arcadeshot/chase.mjs <outDir>   (needs vite on :5173). Getaway Chase frames: near misses, nitro, the cop's lunge.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'chase-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const sizes = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844 } }
for (const form of (process.env.FORMS ?? 'phone,desktop').split(',')) {
  const p = await b.newPage({ viewport: sizes[form], deviceScaleFactor: form === 'phone' ? 2 : 1, hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, coins: 120000, fuel: 99, panel: null }))
  await p.evaluate(() => window.__game.getState().openPanel('arcade'))
  await p.waitForSelector('.arc-tile', { timeout: 60000 })
  await p.click('.arc-tile.chase .buy', { noWaitAfter: true, timeout: 90000 })
  await p.waitForFunction(() => window.__chase, null, { timeout: 90000 })
  await p.waitForFunction(() => window.__chase.t > 0.5, null, { timeout: 120000 })
  // Bot: dodge whatever is in our lane close ahead, so near misses happen.
  await p.evaluate(() => {
    setInterval(() => {
      const s = window.__chase
      const threat = (l) => s.cars.some((c) => c.on && !c.hit && c.lane === l && c.z > -7 && c.z < 1)
      if (!threat(s.lane)) return
      const opts = [s.lane - 1, s.lane + 1].filter((l) => l >= 0 && l <= 2 && !threat(l))
      if (!opts.length) return
      const key = opts[0] < s.lane ? 'ArrowLeft' : 'ArrowRight'
      window.dispatchEvent(new KeyboardEvent('keydown', { key }))
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key })), 60)
    }, 50)
  })
  const shot = async (n) => { await p.screenshot({ path: `${out}/${form}-${n}.png` }); console.log(form, n, await p.evaluate(() => JSON.stringify({ t: window.__chase.t.toFixed(1), streak: window.__chase.streak, bonus: window.__chase.bonus, hearts: window.__chase.hearts, cop: window.__chase.cop.phase }))) }
  await p.waitForFunction(() => window.__chase.streak >= 2, null, { timeout: 120000 }).catch(() => console.log('no combo'))
  await p.waitForTimeout(150)
  await shot('1-combo')
  await p.evaluate(() => { window.__chase.nitro = 3; window.__chase.pop = { id: 99, text: 'NITRO!', kind: 'nitro' } })
  await p.waitForTimeout(1200)
  await shot('2-nitro')
  await p.evaluate(() => { window.__chase.nitro = 0; window.__chase.cop.next = window.__chase.t })
  await p.waitForFunction(() => window.__chase.cop.phase === 'warn', null, { timeout: 60000 })
  await p.waitForTimeout(1500)
  await shot('3-cop-warn')
  await p.close()
}
await b.close()
