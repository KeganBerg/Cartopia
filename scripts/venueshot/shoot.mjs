// Venue stills (see main.tsx): node scripts/venueshot/shoot.mjs <venue> [outDir] [night] [views.json]
// Writes chase-camera shots at a few points down the strip (desktop and phone), then any free
// views from views.json ([{ name, pos, at, fov }]).
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
const [, , venue = 'giza', out = 'venueshot-out', night = '0', viewsFile, dist = '400'] = process.argv
mkdirSync(out, { recursive: true })
const port = process.env.PORT ?? 5173
const STOPS = (process.env.STOPS ?? '4,120,240,380').split(',').map(Number)
const SIZES = [['desk', 1280, 800], ['phone', 390, 844]].filter(([t]) => (process.env.SIZES ?? 'desk,phone').split(',').includes(t))
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
async function open(w, h, d) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto(`http://localhost:${port}/scripts/venueshot/index.html?venue=${venue}&d=${d}&night=${night}&dist=${dist}&season=summer&weather=clear&time=${process.env.TIME ?? 0}`)
  await p.waitForFunction(() => window.ready, null, { timeout: 180000 })
  await p.waitForTimeout(Number(process.env.WAIT ?? 9000))
  return p
}
for (const [tag, w, h] of SIZES) for (const d of STOPS) {
  const p = await open(w, h, d)
  await p.screenshot({ path: `${out}/${venue}${night === '1' ? '-night' : ''}-${tag}-${d}.png` })
  await p.close()
  console.log('shot', tag, d)
}
if (viewsFile) {
  const views = JSON.parse(readFileSync(viewsFile, 'utf8'))
  const p = await open(Number(process.env.VW ?? 1024), Number(process.env.VH ?? 640), Number(process.env.VD ?? 4))
  const shots = await p.evaluate((v) => window.shoot(v), views)
  shots.forEach((s, i) => writeFileSync(`${out}/${venue}${night === '1' ? '-night' : ''}-v-${views[i].name}.png`, Buffer.from(s.split(',')[1], 'base64')))
  console.log('views', shots.length)
  await p.close()
}
await b.close()
