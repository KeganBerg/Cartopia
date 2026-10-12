// Captures building shots from the dev server (see main.tsx).
// node scripts/assets/shoot.mjs outDir [ids,comma] [levels,comma] [night] [pair] [side]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const [, , out = 'asset-out', ids = '', levels = '1,4,7,10', night = '1', pairs = '0,1', side = '0', mark = '0', zoom = '1'] = process.argv
mkdirSync(out, { recursive: true })
const port = process.env.PORT ?? 5173
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 640, height: 640 } })
for (const id of ids.split(',')) for (const lv of levels.split(',')) for (const pr of pairs.split(',')) {
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('error', id, e.message))
  await p.goto(`http://localhost:${port}/scripts/assets/index.html?id=${id}&level=${lv}&pair=${pr}&night=${night}&side=${side}&mark=${mark}&zoom=${zoom}&season=summer&weather=clear`)
  await p.waitForSelector('canvas', { timeout: 60000 })
  await p.waitForTimeout(2500)
  const name = `${id}-L${lv}${mark === '1' ? '-mark' : ''}${pr === '1' ? '-pair' : ''}${night === '1' ? '-n' : ''}${side !== '0' ? '-s' + side : ''}.png`
  await p.screenshot({ path: `${out}/${name}` })
  console.log(name)
  await p.close()
}
await b.close()
