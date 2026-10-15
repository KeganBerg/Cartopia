// Skin contact sheet: every skin on one car, one tile each, labelled.
// node scripts/skins/shoot.mjs <outFile.png> '<query>' [car|mod] [skinIds,...]   (needs `npm run dev` on :5173)
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'sheet.png', query = '', pool = 'car', only = ''] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: Number(process.env.W ?? 360), height: Number(process.env.H ?? 260) }, deviceScaleFactor: 1 })
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto('http://localhost:5173/scripts/skins/skins.html')
const ids = only ? only.split(',') : await p.evaluate(async (pool) => {
  const d = await import('/src/game/data.ts')
  return (pool === 'mod' ? d.MOD_SKINS : d.SKINS).map((s) => s.id)
}, pool)
const dir = mkdtempSync(`${tmpdir()}/skins-`)
const tiles = []
for (const id of ['', ...ids]) {
  await p.goto(`http://localhost:5173/scripts/skins/skins.html?${query}&${pool === 'mod' ? 'modskin' : 'skin'}=${id}`)
  await p.waitForSelector('canvas')
  await p.waitForTimeout(2500)
  const f = `${dir}/${id || 'none'}.png`
  await p.screenshot({ path: f })
  tiles.push('-label', id || 'no skin', f)
}
await b.close()
execFileSync('montage', [...tiles, '-tile', '6x', '-geometry', '+2+2', '-pointsize', '14', out])
console.log(out, ids.length)
