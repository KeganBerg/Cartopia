// A short clip of one building's moving parts, for reviewing motion (see main.tsx ?live=1).
// node scripts/closeup/clip.mjs out.mp4 building level [pair] [az,el,d] [seconds] [size] [night]
// Swiftshader draws slowly, so the page's clock is taken over: each tick moves virtual
// time one frame and draws it (same trick as scripts/clips/shoot.mjs).
import { chromium } from 'playwright'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const [, , out = 'clip.mp4', id = 'academy', level = '1', pair = '0', view = '35,30,2.4', secs = '8', size = '540', night = '0'] = process.argv
const [az, el, d, fx = 0.5, fy = 0.2, fz = 0.5] = view.split(',').map(Number)
const fps = 30
const port = process.env.PORT ?? 5173
const dir = mkdtempSync(join(tmpdir(), 'clip-'))
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const [w, h] = size.split('x').map(Number)
const p = await b.newPage({ viewport: { width: w, height: h || w } })
p.on('pageerror', (e) => console.log('error', e.message))
await p.addInitScript(() => {
  let virt = performance.now()
  const q = []
  performance.now = () => virt
  window.requestAnimationFrame = (f) => (q.push(f), q.length)
  window.cancelAnimationFrame = () => {}
  window.__tick = (ms) => {
    virt += ms
    for (const f of q.splice(0)) f(virt)
  }
})
await p.goto(`http://localhost:${port}/scripts/closeup/index.html?kind=building&id=${id}&level=${level}&pair=${pair}&night=${night}&season=summer&weather=clear&live=1`)
// The page only mounts once frames run, so tick until it is ready.
for (let t = 0; !(await p.evaluate(() => (window.__tick(1000 / 30), !!window.ready))); t++) {
  if (t > 600) throw new Error('page never got ready')
  await p.waitForTimeout(200)
}
await p.evaluate((v) => window.aim(v), { az, el, d, at: [fx, fy, fz] })
for (let i = 0; i < 6; i++) await p.evaluate(() => window.__tick(1000 / 30))
const n = Math.round(Number(secs) * fps)
for (let i = 0; i < n; i++) {
  const png = await p.evaluate((ms) => (window.__tick(ms), document.querySelector('canvas').toDataURL('image/png')), 1000 / fps)
  writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.png`), Buffer.from(png.split(',')[1], 'base64'))
}
await b.close()
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'), '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out])
console.log(out, dir)
