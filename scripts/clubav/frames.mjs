// node scripts/clubav/frames.mjs <cues.json> <outdir> <set bar> [seconds] [fps]   (needs vite on :5173)
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , cuesFile, out, bar = 0, secs = 8, fps = 30] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 640, height: 520 } })
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto(`http://localhost:5173/scripts/clubav/frames.html?time=0.5&bar=${bar}`)
await p.waitForSelector('canvas', { timeout: 60000 })
await p.waitForTimeout(4000)
await p.evaluate((c) => window.load(c), JSON.parse(readFileSync(cuesFile, 'utf8')))
const n = Number(secs) * Number(fps)
for (let i = 0; i < n; i++) {
  await p.evaluate((ms) => window.at(ms), (i * 1000) / Number(fps))
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await p.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.png` })
}
await b.close()
