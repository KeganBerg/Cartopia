// Close-up contact sheets for the model review (see main.tsx).
// node scripts/closeup/shoot.mjs outDir car|building ids(comma, or "all") [levels] [pair] [night]
// Writes one PNG per view: <id>[-L<level>][-p<pair>]-<n>.png; sheet.py lays them out.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const [, , out = 'closeup-out', kind = 'car', ids = 'pip', levels = '1', pair = '0', night = '0', size = '512'] = process.argv
mkdirSync(out, { recursive: true })
const port = process.env.PORT ?? 5173
// Cars: four corners low, both sides, top, then close on the nose, the tail and the cockpit.
const CAR = [
  { az: 35, el: 14, d: 3.6 }, { az: 145, el: 14, d: 3.6 }, { az: 215, el: 14, d: 3.6 }, { az: 325, el: 14, d: 3.6 },
  { az: 90, el: 4, d: 3.4 }, { az: 270, el: 4, d: 3.4 }, { az: 20, el: 62, d: 3.6 },
  { az: 20, el: 18, d: 1.7, at: [0.5, 0.45, 0.85] }, { az: 160, el: 18, d: 1.7, at: [0.5, 0.45, 0.15] },
  { az: 60, el: 45, d: 1.5, at: [0.5, 0.75, 0.5] }, { az: 0, el: 6, d: 3.2 }, { az: 180, el: 6, d: 3.2 },
]
// Buildings: four corners from above, then the street front low and close, and both sides.
const BLD = [
  { az: 35, el: 28, d: 2.5 }, { az: 145, el: 28, d: 2.5 }, { az: 215, el: 28, d: 2.5 }, { az: 325, el: 28, d: 2.5 },
  { az: 0, el: 6, d: 1.7, at: [0.5, 0.25, 0.5] }, { az: 30, el: 10, d: 1.2, at: [0.5, 0.2, 0.9] }, { az: 330, el: 10, d: 1.2, at: [0.5, 0.2, 0.9] },
  { az: 90, el: 8, d: 1.8, at: [0.5, 0.3, 0.5] }, { az: 270, el: 8, d: 1.8, at: [0.5, 0.3, 0.5] },
  { az: 10, el: 70, d: 2.2 }, { az: 0, el: 20, d: 1.0, at: [0.5, 0.75, 0.6] }, { az: 180, el: 12, d: 1.8, at: [0.5, 0.3, 0.5] },
]
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: Number(size), height: Number(size) } })
let list = ids.split(',')
if (ids === 'all') {
  const p = await ctx.newPage()
  await p.goto(`http://localhost:${port}/scripts/closeup/index.html?list=${kind}`)
  await p.waitForFunction(() => window.ids, null, { timeout: 120000 })
  list = await p.evaluate(() => window.ids)
  await p.close()
}
for (const id of list) for (const lv of levels.split(',')) {
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('error', id, e.message))
  await p.goto(`http://localhost:${port}/scripts/closeup/index.html?kind=${kind}&id=${id}&level=${lv}&pair=${pair}&night=${night}&season=summer&weather=clear`)
  try {
    await p.waitForFunction(() => window.ready, null, { timeout: 120000 })
    await p.waitForTimeout(1500)
    const shots = await p.evaluate((v) => window.shoot(v), kind === 'building' ? BLD : CAR)
    const tag = `${id}${kind === 'building' ? `-L${lv}` : ''}${pair !== '0' ? `-p${pair}` : ''}${night === '1' ? '-n' : ''}`
    shots.forEach((s, i) => writeFileSync(`${out}/${tag}-${String(i).padStart(2, '0')}.png`, Buffer.from(s.split(',')[1], 'base64')))
    console.log(tag)
  } catch (e) {
    console.log('fail', id, lv, e.message)
  }
  await p.close()
}
await b.close()
