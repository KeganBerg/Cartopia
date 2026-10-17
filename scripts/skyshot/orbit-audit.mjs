// Orbit (free camera) audit: poses at the limits on phone and desktop.
import { chromium } from 'playwright'
const out = process.argv[2]
const only = process.argv[3]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] })
const POSES = {
  swoop: null,
  closest: { pitch: 1.2, dist: 5 },
  street: { pitch: 1.45, dist: 5 },
  far: { pitch: 0.9, dist: 170 },
  top: { pitch: 0.12, dist: 170 },
  edge: { x: 150, z: 150, pitch: 1.45, dist: 60 },
  inShowroom: { x: -8.5, z: -4, pitch: 1.45, dist: 5, yaw: Math.PI / 2 },
  inPizza: { x: -3, z: 6, pitch: 1.45, dist: 5, yaw: Math.PI },
  edgeLow: { x: -150, z: 0, pitch: 1.45, dist: 8, yaw: Math.PI / 2 },
}
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, hasTouch: form === 'phone', isMobile: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  p.on('console', (m) => m.type() === 'error' && console.log('console', m.text().slice(0, 200)))
  await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
  await p.goto('http://localhost:5173/?time=0.5')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, panel: null }))
  await p.waitForTimeout(1000)
  await p.evaluate(() => window.__game.setState({ panel: null }))
  const heap0 = await p.evaluate(() => performance.memory?.usedJSHeapSize / 1e6)
  await p.evaluate(() => document.querySelector('[aria-label="Free camera"]').click())
  await p.waitForTimeout(7000)
  for (const [name, pose] of Object.entries(POSES)) {
    if (only && !only.split(',').includes(name)) continue
    if (pose) await p.evaluate((pose) => { const r = window.__freeRig.current; r.swoop = null; Object.assign(r.goal, pose); r.goal.yaw ??= r.cur.yaw; Object.assign(r.cur, r.goal) }, pose)
    await p.evaluate(() => window.__game.setState({ panel: null }))
    await p.waitForTimeout(2500)
    const cam = await p.evaluate(() => { const r = window.__freeRig.current; return JSON.stringify(Object.fromEntries(Object.entries(r.cur).map(([k, v]) => [k, +v.toFixed(2)]))) })
    await p.screenshot({ path: `${out}/${form}-${name}.png` })
    console.log(form, name, cam)
  }
  const heap1 = await p.evaluate(() => performance.memory?.usedJSHeapSize / 1e6)
  console.log(form, 'heap MB before/after', heap0?.toFixed(0), heap1?.toFixed(0))
  await p.close()
}
await b.close()
