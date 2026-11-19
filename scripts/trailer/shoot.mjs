// Records the launch trailer's race shots (see main.tsx) as PNG frames, one folder per shot.
// node scripts/trailer/shoot.mjs scripts/trailer/shots.json <outDir>/shots   (needs `npx vite` on :5173, Playwright)
//   jobs.json: [{ "name": "giza-side", "q": "shot=side&venue=giza", "w": 1920, "h": 1080 }, ...]
// Swiftshader draws a frame every second or so, so the page's clock and animation frames
// are taken over: each tick advances virtual time exactly one frame and draws it.
// PAR=n records n shots at once; shots whose folder already holds every frame are skipped.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const [, , jobsFile, out] = process.argv
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'))
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const queue = [...jobs]
await Promise.all(Array.from({ length: Number(process.env.PAR ?? 2) }, async () => {
  for (let j; (j = queue.shift()); ) {
    try { await record(j) } catch (e) { console.log('failed', j.name, e.message) }
  }
}))
await b.close()

async function record({ name, q, w = 1920, h = 1080 }) {
  const dir = join(out, name)
  if (existsSync(join(dir, 'done'))) return console.log('skip', name)
  mkdirSync(dir, { recursive: true })
  const t0 = Date.now()
  const p = await b.newPage({ viewport: { width: w, height: h } })
  p.on('pageerror', (e) => console.log(name, 'error', e.message))
  await p.addInitScript(() => {
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
    window.__tick = (ms, draw) => {
      virt += ms
      window.__skipDraw = !draw
      const run = q.splice(0)
      for (const f of run) f(virt)
    }
  })
  await p.goto(`http://localhost:5173/scripts/trailer/index.html?${q}&time=0.08&season=summer`)
  await p.waitForSelector('canvas', { timeout: 60000 })
  await p.waitForFunction(() => window.__clip, null, { timeout: 60000 })
  // World Tour scenery loads as its own chunk; give it and the first compile time to land.
  await p.waitForTimeout(Number(process.env.WAIT ?? 15000))
  const { frames, keepFrom, fps } = await p.evaluate(() => window.__clip)
  for (let i = 0; i < frames; i++) {
    const draw = i >= keepFrom - 2
    const png = await p.evaluate(([ms, draw, keep]) => {
      window.__tick(ms, draw)
      return keep ? document.querySelector('canvas').toDataURL('image/png') : ''
    }, [1000 / fps, draw, i >= keepFrom])
    if (i >= keepFrom) writeFileSync(join(dir, `f${String(i - keepFrom).padStart(4, '0')}.png`), Buffer.from(png.split(',')[1], 'base64'))
  }
  writeFileSync(join(dir, 'done'), '')
  await p.close()
  console.log(name, readdirSync(dir).length - 1, 'frames', Math.round((Date.now() - t0) / 1000), 's')
}
