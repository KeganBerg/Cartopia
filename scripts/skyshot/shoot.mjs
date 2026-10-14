import { chromium } from 'playwright'
const out = process.argv[2]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
  await p.goto('http://localhost:5173/?time=0.5&weather=wind')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, panel: null }))
  await p.waitForTimeout(1000)
  await p.evaluate(() => window.__game.setState({ panel: null }))
  await p.evaluate(() => document.querySelector('[aria-label="Free camera"]').click())
  await p.waitForTimeout(6000)
  await p.evaluate(() => { const r = window.__freeRig.current; r.swoop = null; r.goal.pitch = r.cur.pitch = 1.45; r.goal.dist = r.cur.dist = 6 })
  await p.evaluate(() => window.__game.setState({ panel: null }))
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${form}.png` })
  console.log(form)
  await p.close()
}
await b.close()
