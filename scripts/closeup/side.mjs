// node side.mjs out ids mods [az,el,d;...]  -> out/<id>__<mods>__<n>.png
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const [, , out, ids, mods = '', views = '90,4,3.4'] = process.argv
mkdirSync(out, { recursive: true })
const V = views.split(';').map((v) => { const [az, el, d, ax, ay, az2] = v.split(',').map(Number); return ax === undefined ? { az, el, d } : { az, el, d, at: [ax, ay, az2] } })
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: Number(process.env.W ?? 480), height: Number(process.env.H ?? 320) } })
for (const id of ids.split(',')) for (const m of mods.split('|')) {
  const p = await ctx.newPage()
  try {
    await p.goto(`http://localhost:5173/scripts/closeup/index.html?kind=car&id=${id}&mods=${m}&color=${encodeURIComponent(process.env.COLOR ?? '')}`.replace(/&color=$/, ''))
    await p.waitForFunction(() => window.ready, null, { timeout: 90000 })
    await p.waitForTimeout(800)
    const shots = await p.evaluate((v) => window.shoot(v), V)
    shots.forEach((s, i) => writeFileSync(`${out}/${id}__${m || 'stock'}__${i}.png`, Buffer.from(s.split(',')[1], 'base64')))
  } catch (e) { console.log('fail', id, m, e.message.slice(0, 80)) }
  await p.close()
}
await b.close()
