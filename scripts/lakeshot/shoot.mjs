// Screenshots and draw counts of the outskirts lake (water, birds, fisherman).
// node scripts/lakeshot/shoot.mjs <outDir> [phone|desktop] [tag]
//   env: TIME (town day fraction, 0.08 = morning, 0.5 = night), WEATHER, SEASON,
//   FRAMES=n also saves n frames 0.1 s apart from the free view for a clip.
//   (needs `npm run dev` on :5173 and Playwright)
import { chromium } from 'playwright'
const [, , out = 'lake-out', form = 'desktop', tag = 'now'] = process.argv
const size = form === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
p.on('pageerror', (e) => console.log('error', e.message))
await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
await p.goto(`http://localhost:5173/?time=${process.env.TIME ?? 0.08}&season=${process.env.SEASON ?? 'fall'}&weather=${process.env.WEATHER ?? 'clear'}`)
console.log("loading"); await p.waitForFunction(() => window.__game, null, { timeout: 180000 }); console.log("loaded")
await p.waitForTimeout(3000)
await p.addStyleTag({ content: '*{animation-duration:0s!important;transition:none!important} .tutorial{display:none!important}' })
await p.evaluate(() => { const d = new Date(); window.__game.setState({ tutorial: 99, level: 20, panel: null, lastDaily: d.toISOString().slice(0, 10) }) })
await p.waitForTimeout(1500)
await p.evaluate(() => window.__game.setState({ panel: null }))
// Virtual clock: each tick advances 0.1 s and runs one frame; undrawn frames skip their draws.
await p.evaluate(() => {
  let virt = performance.now()
  const q = []
  const realNow = Date.now
  const t0 = realNow()
  const v0 = virt
  performance.now = () => virt
  Date.now = () => t0 + (virt - v0)
  window.requestAnimationFrame = (f) => (q.push(f), q.length)
  window.cancelAnimationFrame = () => {}
  window.__draws = 0
  window.__tris = 0
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext])
    for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
      const f = C.prototype[k]
      if (f) C.prototype[k] = function (...a) { if (window.__skipDraw) return; window.__draws++; return f.apply(this, a) }
    }
  window.__tick = (ms, draw) => {
    virt += ms
    window.__skipDraw = !draw
    const run = q.splice(0)
    const s = realNow()
    for (const f of run) f(virt)
    return realNow() - s
  }
})
const fiber = await p.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('@react-three_fiber.js')))
await p.evaluate(async (url) => {
  const { _roots } = await import(url)
  const roots = [..._roots.values()].map((r) => r.store.getState())
  window.__town = roots.find((s) => s.controls) ?? roots[0]
}, fiber)
const step = async (sec) => { for (let t = 0; t < sec - 0.001; t += 0.1) await p.evaluate(() => window.__tick(100, false)) }
const shot = async (name) => {
  // The town draws on demand: one tick asks for a frame, the next one draws it.
  await p.evaluate(() => window.__tick(20, true))
  const [draws, ms] = await p.evaluate(() => { window.__draws = 0; const ms = window.__tick(20, true); return [window.__draws, ms] })
  console.log(name, 'draws', draws, 'frameMs(swiftshader)', ms.toFixed(0))
  await p.screenshot({ path: `${out}/${form}-${tag}-${name}.png` })
}
if (process.env.POND) {
  // Water decor: a duck pond, a koi garden and a fountain side by side on open land.
  await p.evaluate(() => {
    const g = window.__game
    const keep = g.getState().buildings.filter((b) => b.x > 14 || b.z > 8)
    g.setState({ buildings: [...keep, { uid: 'wp', def: 'pond', x: 1, z: 1, jobEndsAt: null, level: 1 }, { uid: 'wk', def: 'koi', x: 4, z: 1, jobEndsAt: null, level: 1 }, { uid: 'wf', def: 'fountain', x: 7, z: 1, jobEndsAt: null, level: 1 }] })
  })
  await p.evaluate((phone) => {
    const s = window.__town
    const c = s.controls, cam = s.camera
    const off = cam.position.clone().sub(c.target)
    c.target.set(-13, 0, -19)
    cam.position.copy(c.target).add(off)
    cam.zoom = phone ? 55 : 85
    cam.updateProjectionMatrix()
    c.update()
  }, form === 'phone')
  await step(4)
  await shot('5-pond')
  await step(1.5)
  await shot('6-pond')
}
// Bird's-eye town view panned to the lake, as on the player's screen.
await p.evaluate((phone) => {
  const s = window.__town
  const c = s.controls, cam = s.camera
  const off = cam.position.clone().sub(c.target)
  c.target.set(-80, 0, -13)
  cam.position.copy(c.target).add(off)
  cam.zoom = phone ? 14 : 24
  cam.updateProjectionMatrix()
  c.update()
}, form === 'phone')
await step(6)
await shot('1-town')
await step(4)
await shot('2-town')
// Free view, low over the water by the boat.
await p.evaluate(() => document.querySelector('[aria-label="Free camera"]').click())
await step(5)
const pose = async (g) => p.evaluate((g) => { const r = window.__freeRig.current; r.swoop = null; Object.assign(r.goal, g); Object.assign(r.cur, g) }, g)
await pose({ x: -80, z: -13, yaw: 2.2, pitch: 1.0, dist: 16 })
await step(3)
await shot('3-close')
const boat = await p.evaluate(() => window.__fisher ? { x: window.__fisher.x, z: window.__fisher.z, h: window.__fisher.h } : { x: -74, z: -12, h: 0 })
await pose({ x: boat.x, z: boat.z, yaw: boat.h + 2.2, pitch: 1.05, dist: 4.5 })
await step(2)
await shot('4-closer')
if (process.env.POND) {
  await pose({ x: -20, z: -20, yaw: 0.8, pitch: 0.95, dist: 3.6 })
  await step(2)
  await shot('7-ducks')
  await pose({ x: -9, z: -21, yaw: 0.8, pitch: 0.9, dist: 2.6 })
  await step(1)
  await shot('8-fountain')
}
const frames = Number(process.env.FRAMES ?? 0)
for (let i = 0; i < frames; i++) {
  await p.evaluate(() => window.__tick(50, false))
  await p.evaluate(() => window.__tick(50, true))
  await p.screenshot({ path: `${out}/clip-${String(i).padStart(3, '0')}.png` })
}
await b.close()
