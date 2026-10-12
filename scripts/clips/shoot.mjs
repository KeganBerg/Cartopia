// Records the Race menu tile clips from the dev server (see main.tsx) and encodes them
// into src/assets/race-clips/ as small muted MP4s (H.264), plus a WebM (VP9) for browsers
// without H.264. VP9 is softer at the same size here, so the MP4 is the one most players get.
// node scripts/clips/shoot.mjs [only]   (needs `npm run dev` on :5173, Playwright and ffmpeg)
//   only: comma-separated name prefixes, e.g. tour-docks,ev-
// Swiftshader draws a frame every second or so, so the page's clock and animation frames
// are taken over: each tick advances virtual time exactly one frame and draws it.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [, , only] = process.argv
const OUT = 'src/assets/race-clips'
const RENDER = 720 // drawn this size, then scaled down to SIZE so edges come out smooth
const SIZE = 480
const FADE = 0.5 // seconds
const VENUES = ['main', 'docks', 'desert', 'snow', 'beach', 'farm']
// The skies each venue's races can roll besides clear (VENUE_SKIES in src/game/weather.ts).
const SKIES = { main: ['rain', 'storm', 'fog'], beach: ['rain', 'storm', 'fog'], desert: ['dust'], snow: ['snow', 'blizzard'], farm: ['rain', 'storm', 'fog'], docks: ['fog', 'rain', 'storm'] }
// The weekly events (src/game/events.ts), each at its own venue, time of day and sky.
const EVENTS = ['whiteout', 'harvestmoon', 'foghorn', 'neondownpour', 'shallows', 'mirage']
const jobs = [
  ...VENUES.map((v) => ['camp', v, 0]),
  ...VENUES.flatMap((v) => [['tour', v, 0], ['tour', v, 1]]),
  // Pro Tour legs roll their sky ahead of time, so the tile can show it: each venue's wet,
  // foggy, snowy or dusty skies, day and night (drizzle shows the rain clip, wind the clear one).
  ...Object.entries(SKIES).flatMap(([v, ks]) => ks.flatMap((k) => [['tour', v, 0, k], ['tour', v, 1, k]])),
  ...EVENTS.map((e) => ['ev', e, 0]),
  ...VENUES.map((v) => ['trial', v, 0]),
  ['gp', 'main', 0],
].filter(([s, v, n, k]) => !only || only.split(',').some((o) => `${s}-${v}${n ? '-night' : ''}${k ? `-${k}` : ''}`.startsWith(o)))

mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [shot, v, n, k] of jobs) {
  const name = `${shot}-${v}${n ? '-night' : ''}${k ? `-${k}` : ''}`
  const dir = join(process.env.FRAMES ?? tmpdir(), `clip-${name}`)
  mkdirSync(dir, { recursive: true })
  // ENCODE_ONLY=1 re-encodes frames already recorded (to try other encoder settings).
  if (!process.env.ENCODE_ONLY) await record(shot, v, n, k, dir)
  encode(name, dir)
}
await b.close()

async function record(shot, v, n, k, dir) {
  const p = await b.newPage({ viewport: { width: RENDER, height: RENDER } })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => {
    let virt = performance.now()
    const q = []
    performance.now = () => virt
    window.requestAnimationFrame = (f) => (q.push(f), q.length)
    window.cancelAnimationFrame = () => {}
    // Warm-up frames run the scene without drawing it.
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
  // Events bring their own sky, so the weather isn't pinned for them.
  const where = shot === 'gp' ? 'autopilot&weather=clear' : shot === 'ev' ? `event=${v}` : k ? `venue=${v}&night=${n}&sky=${k}` : `venue=${v}&night=${n}&weather=clear`
  await p.goto(`http://localhost:5173/scripts/clips/index.html?shot=${shot}&${where}&time=0.08&season=summer`)
  await p.waitForSelector('canvas', { timeout: 60000 })
  await p.waitForFunction(() => window.__clip, null, { timeout: 60000 })
  // Let textures and the first compile settle before the clock starts.
  await p.waitForTimeout(4000)
  const { frames, keepFrom, fps } = await p.evaluate(() => window.__clip)
  for (let i = 0; i < frames; i++) {
    // The last couple of warm-up frames are drawn so the first kept frame starts clean.
    const draw = i >= keepFrom - 2
    const png = await p.evaluate(([ms, draw, keep]) => {
      window.__tick(ms, draw)
      return keep ? document.querySelector('canvas').toDataURL('image/png') : ''
    }, [1000 / fps, draw, i >= keepFrom])
    if (i >= keepFrom) writeFileSync(join(dir, `f${String(i - keepFrom).padStart(4, '0')}.png`), Buffer.from(png.split(',')[1], 'base64'))
  }
  await p.close()
}

function encode(name, dir) {
  const fps = 30
  const frames = readdirSync(dir).filter((f) => f.endsWith('.png')).length
  // A seamless loop: the clip starts FADE in, and its last FADE crossfades into that opening,
  // so the end flows straight back into the start.
  const len = frames / fps - FADE
  const loop = `split[x][y];[x]trim=0:${FADE},setpts=PTS-STARTPTS[a];[y]trim=${FADE},setpts=PTS-STARTPTS[b];[b][a]xfade=transition=fade:duration=${FADE}:offset=${len - FADE},scale=${SIZE}:${SIZE}:flags=lanczos`
  const src = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'), '-vf', loop, '-an']
  execFileSync('ffmpeg', [...src, '-c:v', 'libx264', '-preset', 'veryslow', '-crf', process.env.CRF ?? '31', '-maxrate', '700k', '-bufsize', '1400k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${OUT}/${name}.mp4`])
  execFileSync('ffmpeg', [...src, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', process.env.VP9_CRF ?? '50', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '1', '-pix_fmt', 'yuv420p', `${OUT}/${name}.webm`])
  const kb = (f) => Math.round(statSync(f).size / 1024)
  console.log(name, `${len.toFixed(2)} s`, `mp4 ${kb(`${OUT}/${name}.mp4`)} KB`, `webm ${kb(`${OUT}/${name}.webm`)} KB`, dir)
}
