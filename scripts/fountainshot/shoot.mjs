// Night close-up of a level 5 fountain in town (shine check).
// node scripts/fountainshot/shoot.mjs <outDir> [phone|desktop] [tag]
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
await p.evaluate(() => {
  const g = window.__game
  const keep = g.getState().buildings.filter((b) => b.x > 14 || b.z > 8)
  g.setState({ buildings: [...keep, { uid: 'wf', def: 'fountain', x: 7, z: 1, jobEndsAt: null, level: 5 }] })
})
await p.evaluate((phone) => {
  const s = window.__town
  const c = s.controls, cam = s.camera
  const off = cam.position.clone().sub(c.target)
  // Centre on the fountain: the mesh holding its pool water (the town merges meshes, so
  // take the middle of the merged pool's bounds when there are several pools).
  let at = null
  s.scene.traverse((o) => { if (!at && o.isMesh && o.geometry?.type === 'CircleGeometry' && Math.abs(o.geometry.parameters.radius - 0.72) < 1e-3) at = o.getWorldPosition(o.position.clone()) })
  if (at) c.target.set(at.x, 0.4, at.z); else c.target.set(-10, 0, -19)
  console.log('fountain at', at && at.toArray())
  cam.position.copy(c.target).add(off)
  cam.zoom = phone ? 90 : 140
  cam.updateProjectionMatrix()
  c.update()
}, form === 'phone')
await step(4)
await shot('fountain')
await b.close()
