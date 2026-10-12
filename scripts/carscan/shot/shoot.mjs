// node scripts/carscan/shot/shoot.mjs outDir model views,comma [w] [h] [color]   (needs `npm run dev`)
// Writes <model>-<view>-old.png (procedural body) and <model>-<view>.png (restyled scan).
import { createRequire } from 'node:module'
// Playwright comes from the machine's tools, not the app's dependencies.
const { chromium } = createRequire(process.env.PW_FROM ?? '/opt/node-tools/node_modules/')('playwright')
import { mkdirSync } from 'node:fs'
const [, , out = 'scan-out', model = 'current', views = '34,side,front,rear', w = '900', h = '600', color = ''] = process.argv
mkdirSync(out, { recursive: true })
const port = process.env.PORT ?? 5173
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: Number(w), height: Number(h) } })
for (const view of views.split(',')) for (const old of ['1', '0']) {
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto(`http://localhost:${port}/scripts/carscan/shot/index.html?model=${model}&view=${view}&old=${old}${color ? `&color=${encodeURIComponent(color)}` : ''}`)
  await p.waitForSelector('canvas', { timeout: 60000 })
  await p.waitForTimeout(2500)
  const name = `${model}-${view}${old === '1' ? '-old' : ''}.png`
  await p.screenshot({ path: `${out}/${name}` })
  console.log(name)
  await p.close()
}
await b.close()
