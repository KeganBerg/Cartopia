// CPU profile of the 4 s after a Collect All tap in a test town full of ready shops:
// tap-to-next-frame time, busy JS, top functions and shader programs linked.
// N=12 [Q=&fx=low] [BASE=http://localhost:5173] node scripts/collectperf/profile.mjs   (needs `npm run dev`)
import { chromium } from 'playwright'
const N = Number(process.env.N ?? 9)
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: Number(process.env.W ?? 480), height: Number(process.env.H ?? 320) } })
await p.addInitScript(() => {
  window.__links = []
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const ss = C.prototype.shaderSource
    C.prototype.shaderSource = function (sh, src) {
      if (window.__trace && src.includes('gl_Position')) window.__links.push(src.split('\n').filter((l) => l.startsWith('#define') && !/PRECISION|attribute|varying|texture2D| PI|RECIPROCAL|EPSILON|saturate|whiteComplement|LOG2|LN2/.test(l)).join(' '))
      return ss.call(this, sh, src)
    }
    const orig = C.prototype.linkProgram
    C.prototype.linkProgram = function (prog) {
      if (false) window.__links.push(new Error().stack.split('\n').slice(2, 40).map((l) => l.trim().replace(/\?v=\w+/, '').replace(/http:\/\/localhost:5173/, '')).join(' | '))
      return orig.call(this, prog)
    }
  }
})
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto((process.env.BASE ?? 'http://localhost:5173') + '/?time=0.2&season=summer' + (process.env.Q ?? ''))
await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
await p.waitForTimeout(3000)
await p.evaluate((N) => {
  const g = window.__game
  const defs = ['pizza', 'donut', 'burger', 'icecream', 'coffee', 'tacos', 'lube', 'arcade', 'tires']
  const roads = []
  const buildings = []
  let i = 0
  const now = Date.now()
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
    if (z % 3 === 0) roads.push(`${x},${z}`)
    else buildings.push({ uid: `p${i}`, def: defs[i++ % defs.length], x, z, rot: z % 3 === 1 ? 2 : 0, jobEndsAt: now - 1000 })
  }
  g.setState({ tutorial: 99, level: 30, fuel: 9999, roads, buildings, panel: null })
}, N)
await p.waitForTimeout(8000)
const cdp = await p.context().newCDPSession(p)
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 500 })
const idle = async (label) => {
  await cdp.send('Profiler.start')
  if (label === 'tap') {
    // The click runs the whole synchronous React update; the next frame shows when the page can paint again.
    const t = await p.evaluate(() => new Promise((done) => {
      window.__trace = true
      const t0 = performance.now()
      document.querySelector('.collect-all').click()
      const tap = performance.now() - t0
      requestAnimationFrame(() => done({ tap: Math.round(tap), toFrame: Math.round(performance.now() - t0) }))
    }))
    console.log('tap', JSON.stringify(t))
  }
  await p.waitForTimeout(4000)
  const { profile } = await cdp.send('Profiler.stop')
  const dt = profile.timeDeltas
  const self = new Map()
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  profile.samples.forEach((id, i) => {
    const n = byId.get(id)
    const f = n.callFrame
    const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}`
    self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0) / 1000)
  })
  const parent = new Map()
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n)
  const callers = new Map()
  profile.samples.forEach((id, i) => {
    const n = byId.get(id)
    if (n.callFrame.functionName !== 'exports.jsxDEV' && n.callFrame.functionName !== 'jsxDEVImpl') return
    let q = parent.get(n.id)
    while (q && /jsx/.test(q.callFrame.functionName)) q = parent.get(q.id)
    if (!q) return
    const k = `${q.callFrame.functionName} ${q.callFrame.url.split('/').pop().split('?')[0]}:${q.callFrame.lineNumber + 1}`
    callers.set(k, (callers.get(k) ?? 0) + (dt[i] ?? 0) / 1000)
  })
  const total = [...self.entries()].filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)')).reduce((a, [, v]) => a + v, 0)
  console.log(`== ${label}: busy JS ${Math.round(total)} ms`)
  for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(Math.round(v).toString().padStart(6), k)
  console.log('  jsx callers:')
  for (const [k, v] of [...callers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(Math.round(v).toString().padStart(6), k)
}
console.log('fps', await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => (++n, performance.now() - t0 < 2000 ? requestAnimationFrame(f) : r(Math.round(n / 2))); requestAnimationFrame(f) })))
await idle('idle')
await idle('tap')
console.log('state', JSON.stringify(await p.evaluate(() => { const s = window.__game.getState(); return { level: s.level, levelUp: s.levelUp, panel: s.panel, overlays: [...document.querySelectorAll('.overlay')].map((e) => e.className), canvases: document.querySelectorAll('canvas').length } })))
const links = await p.evaluate(() => window.__links)
console.log('programs linked after tap:', links.length)
for (const l of links) console.log('--', l)
await b.close()
