// Free camera gestures on a phone (real touch events) and smoothness beside a building.
import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
p.on('pageerror', (e) => console.log('error', e.message))
await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1') })
await p.goto('http://localhost:5173/?time=0.5')
await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
await p.waitForTimeout(2500)
await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, panel: null }))
await p.waitForTimeout(1000)
await p.evaluate(() => document.querySelector('[aria-label="Free camera"]').click())
await p.waitForTimeout(5000)
const cdp = await p.context().newCDPSession(p)
const goal = () => p.evaluate(() => { const r = window.__freeRig.current; if (!r) throw new Error('free view closed: ' + JSON.stringify({ mode: window.__game.getState().mode, panel: window.__game.getState().panel, url: location.href, canvases: document.querySelectorAll('canvas').length })); return { ...r.goal } })
const set = (pose) => p.evaluate((pose) => { window.__game.setState({ panel: null }); const r = window.__freeRig.current; r.swoop = null; r.vel.x = r.vel.z = r.vel.yaw = 0; Object.assign(r.goal, pose); Object.assign(r.cur, r.goal) }, pose)
const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
async function gesture(from, to, steps = 12) {
  await touch('touchStart', from)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    await touch('touchMove', from.map(([x, y], k) => [x + (to[k][0] - x) * t, y + (to[k][1] - y) * t]))
  }
  await p.waitForTimeout(150)
  await touch('touchEnd', [])
  await p.waitForTimeout(400)
}
const fmt = (g) => Object.entries(g).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ')
const start = { x: 0, z: 0, yaw: 0, pitch: 1.0, dist: 30 }
const checks = []
const ok = (name, pass, info) => { checks.push(pass); console.log(pass ? 'PASS' : 'FAIL', name, info) }
// One finger: drag right then the ground follows the finger (spot in view moves left on screen).
await set(start); let g0 = await goal(); await gesture([[150, 450]], [[260, 450]]); console.log(await p.evaluate(() => { const g = window.__game.getState(); return JSON.stringify({ mode: g.mode, panel: g.panel, visiting: !!g.visiting, rig: !!window.__freeRig.current, btn: !!document.querySelector('[aria-label="Free camera"]') }) })); let g1 = await goal()
ok('one-finger drag pans', Math.hypot(g1.x - g0.x, g1.z - g0.z) > 1 && Math.abs(g1.dist - g0.dist) < 0.01, fmt(g1))
// Pinch out zooms in, pinch in zooms out.
await set(start); g0 = await goal(); await gesture([[150, 450], [240, 450]], [[90, 450], [300, 450]]); g1 = await goal()
ok('pinch out zooms in', g1.dist < g0.dist * 0.75, fmt(g1))
await set(start); g0 = await goal(); await gesture([[90, 450], [300, 450]], [[150, 450], [240, 450]]); g1 = await goal()
ok('pinch in zooms out', g1.dist > g0.dist * 1.3, fmt(g1))
// Twist turns, two fingers dragged together tilt.
await set(start); g0 = await goal(); await gesture([[150, 450], [240, 450]], [[160, 400], [230, 500]]); g1 = await goal()
ok('twist turns', Math.abs(g1.yaw - g0.yaw) > 0.3, fmt(g1))
await set(start); g0 = await goal(); await gesture([[150, 450], [240, 450]], [[150, 330], [240, 330]]); g1 = await goal()
ok('two-finger drag tilts', Math.abs(g1.pitch - g0.pitch) > 0.15 && Math.abs(g1.dist - g0.dist) < 0.5, fmt(g1))
// Limits: pinch in far past the closest and furthest zoom.
await set({ ...start, dist: 6 }); for (let i = 0; i < 3; i++) await gesture([[170, 450], [220, 450]], [[40, 450], [350, 450]]); g1 = await goal()
ok('closest zoom holds at 5', g1.dist >= 5 - 1e-6, fmt(g1))
await set({ ...start, dist: 150 }); for (let i = 0; i < 3; i++) await gesture([[40, 450], [350, 450]], [[170, 450], [220, 450]]); g1 = await goal()
ok('furthest zoom holds at 170', g1.dist <= 170 + 1e-6, fmt(g1))
// Flinging far off: the spot in view stays near the town.
await set({ ...start, dist: 120 }); for (let i = 0; i < 6; i++) await gesture([[100, 300]], [[300, 800]], 6)
await p.waitForTimeout(2500); g1 = await goal()
ok('fling stays near the town', Math.abs(g1.x) < 60 && Math.abs(g1.z) < 60, fmt(g1))
// Circling a building at street level: the camera never jumps and never ends up inside it.
const path = await p.evaluate(async () => {
  const r = window.__freeRig.current
  const out = []
  for (let i = 0; i <= 24; i++) {
    r.swoop = null
    Object.assign(r.goal, { x: -4, z: -4, pitch: 1.4, dist: 7, yaw: (i / 24) * Math.PI * 2 })
    Object.assign(r.cur, r.goal)
    await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)))
    const s = window.__freeCamState
    out.push(s())
  }
  return out
})
let jump = 0, inside = 0
for (let i = 1; i < path.length; i++) jump = Math.max(jump, Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y, path[i].z - path[i - 1].z))
for (const s of path) if (s.inLot) inside++
ok('circling the showroom: no jumps', jump < 3, `largest step ${jump.toFixed(2)} (orbit step ${(7 * Math.sin(1.4) * Math.PI * 2 / 24).toFixed(2)})`)
ok('circling the showroom: never inside', inside === 0, `${inside} frames inside a lot under its roof`)
await b.close()
process.exit(checks.every(Boolean) ? 0 : 1)
