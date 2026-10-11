// Screenshots of Rusty's Rescue search at exact moments. Swiftshader draws a
// frame every few seconds, so the page's clock and animation frames are
// taken over: each tick advances virtual time 0.1 s and runs one frame, and
// frames between shots skip their draw calls.
// node scripts/rescue/shoot.mjs <outDir> [spot] [phone|desktop] [night]
//   (needs `npm run dev` on :5173 and Playwright)
import { chromium } from 'playwright'
const [, , out = 'rescue-out', spot = 'suburbs', form = 'desktop', night] = process.argv
const size = form === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto(`http://localhost:5173/?time=${night ? 0.5 : 0.08}&season=summer&weather=${process.env.WEATHER ?? "clear"}`)
await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
await p.waitForTimeout(3000)
await p.addStyleTag({ content: '*{animation-duration:0s!important;transition:none!important} .tutorial{display:none!important}' })
await p.evaluate(() => {
  let virt = performance.now()
  const q = []
  performance.now = () => virt
  window.requestAnimationFrame = (f) => (q.push(f), q.length)
  window.cancelAnimationFrame = () => {}
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext])
    for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
      const f = C.prototype[k]
      if (f) C.prototype[k] = function (...a) { if (!window.__skipDraw) return f.apply(this, a) }
    }
  window.__draws = 0
  window.__verts = 0
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext])
    for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = C.prototype[k]
      if (f) C.prototype[k] = function (...a) { if (!window.__skipDraw) { window.__draws++; window.__verts += (k.startsWith('drawElements') ? a[1] : a[2]) * (k.endsWith('Instanced') ? a[a.length - 1] : 1) } return f.apply(this, a) }
    }
  // Timers run on the same virtual clock (the found pop-up times out on one).
  const timers = new Map()
  let tid = 1e6
  window.setTimeout = (f, ms = 0, ...a) => (timers.set(++tid, { at: virt + ms, f: () => f(...a) }), tid)
  window.clearTimeout = (id) => timers.delete(id)
  window.__tick = (ms, draw) => {
    virt += ms
    for (const [id, t] of [...timers]) if (t.at <= virt) { timers.delete(id); t.f() }
    window.__skipDraw = !draw
    const run = q.splice(0)
    for (const f of run) f(virt)
  }
})
// A fixed haul so every run shows the same finds: a rare car at spot 1, a scarce one at 4.
await p.evaluate((spot) => {
  const g = window.__game
  const s = g.getState()
  const pins = [
    { kind: 'coins', n: 60 }, { kind: 'car', model: 'miata', rarity: 'rare' }, { kind: 'parts', n: 2 }, { kind: 'nothing' },
    { kind: 'car', model: 'woodie', rarity: 'scarce' }, { kind: 'fuel', n: 2 }, { kind: 'trophy' }, { kind: 'coins', n: 40 },
  ]
  const has = s.buildings.some((x) => x.def === 'rescue')
  g.setState({
    tutorial: 99,
    buildings: has ? s.buildings : [...s.buildings, { uid: 'rr', def: 'rescue', x: 4, z: 4, jobEndsAt: null, level: 3 }],
    search: { spot, pins, revealed: pins.map(() => false), truckAt: null, flatAt: null, flat: false },
    panel: 'rescue',
  })
}, spot)
const step = async (sec) => {
  for (let t = 0; t < sec - 0.001; t += 0.1) await p.evaluate(() => window.__tick(100, false))
}
const shot = async (name) => {
  // Two drawn frames so the canvas holds a fresh picture.
  await p.evaluate(() => window.__tick(1, true))
  const [draws, verts] = await p.evaluate(() => { window.__draws = 0; window.__verts = 0; window.__tick(1, true); return [window.__draws, window.__verts] })
  console.log('draws', draws, 'verts', verts)
  await p.screenshot({ path: `${out}/${name}.png` })
  console.log(name)
}
const tag = `${form}-${spot}${night ? '-night' : ''}`
await step(4)
await shot(`${tag}-1-arrive`)
if (process.env.ONLY_ARRIVE) { await b.close(); process.exit(0) }
await p.evaluate(() => window.__rescuePick(1))
const marks = (process.env.MARKS ?? '1.2,1.0,0.8,1.0,1.2').split(',').map(Number)
const names = ['2-drive', '3-reveal', '4-found', '5-hook', '6-tow']
for (let k = 0; k < marks.length; k++) {
  await step(marks[k])
  await shot(`${tag}-${names[k] ?? k}`)
}
await b.close()
