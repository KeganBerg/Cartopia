// Race freeze check: plays a drag race (scripts/dragtouch) from the countdown to the finish and
// fails if any shader compiles once the lights go, or any frame takes far longer than the rest.
// A shader compile mid-race is a freeze on a real GPU (Kegan 10-17: the game froze at GO and on
// the first shift while the graphics stepped down). Under swiftshader every frame is slow, so
// compiles are the hard check and frames are judged against the race's own median.
// Start vite first (npx vite --port 5173), then: node scripts/racefreeze/check.mjs [phone|desktop]
import { chromium } from 'playwright'

const port = process.env.PORT ?? 5173
const phone = process.argv[2] === 'phone'
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone })
p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 160)))
await p.addInitScript(() => {
  localStorage.setItem('cartopia-flash-warning-hide', '1')
  const T = (window.__race = { links: [], frames: [], go: Infinity })
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
    const link = C.prototype.linkProgram
    C.prototype.linkProgram = function (...a) {
      T.links.push(performance.now())
      return link.apply(this, a)
    }
  }
  let last = performance.now()
  const loop = (t) => {
    T.frames.push([last, t - last])
    last = t
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
})
await p.goto(`http://localhost:${port}/scripts/dragtouch/index.html`)
await p.waitForSelector('.shift-btn', { timeout: 120000 })
await p.waitForTimeout(2000)
await p.keyboard.down('Space')
let launched = false
let shifts = 0
const t0 = Date.now()
while (Date.now() - t0 < 600000) {
  const st = await p.evaluate(() => ({ txt: document.querySelector('.shift-btn')?.textContent ?? '', cls: document.querySelector('svg.tach')?.getAttribute('class') ?? '', done: !!document.querySelector('.rr, .hero-skip') }))
  if (st.done) break
  if (!launched && /SHIFT/.test(st.txt)) {
    launched = true
    await p.keyboard.up('Space')
    await p.evaluate(() => (window.__race.go = performance.now()))
  }
  if (launched && / now/.test(st.cls)) {
    shifts++
    await p.keyboard.down('Space')
    await p.keyboard.up('Space')
  }
}
const T = await p.evaluate(() => window.__race)
await b.close()
const late = T.links.filter((t) => t >= T.go)
const frames = T.frames.filter(([at]) => at >= T.go).map(([, d]) => d)
const median = [...frames].sort((a, z) => a - z)[frames.length >> 1] ?? 0
const worst = Math.max(0, ...frames)
console.log(`${phone ? 'phone' : 'desktop'}: ${shifts} shifts, ${frames.length} frames, median ${Math.round(median)} ms, worst ${Math.round(worst)} ms, shaders compiled after GO: ${late.length}`)
if (!launched) {
  console.log('FAIL: the race never started')
  process.exit(1)
}
if (late.length || worst > median * 2.5 + 50) {
  console.log('FAIL: the race froze mid-race')
  process.exit(1)
}
console.log('ok')
