// node scripts/exotics/shoot.mjs out.png models view [w] [h] [extra query]   (needs `npm run dev`)
import { createRequire } from 'node:module'
const { chromium } = createRequire(process.env.PW_FROM ?? '/opt/node-tools/node_modules/')('playwright')
const [, , out = 'lineup.png', models = 'lambo', view = '34', w = '1800', h = '600', extra = ''] = process.argv
const port = process.env.PORT ?? 5173
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) } })
p.on('pageerror', (e) => console.log('error', e.message))
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()))
await p.goto(`http://localhost:${port}/scripts/exotics/index.html?models=${models}&view=${view}${extra}`)
await p.waitForSelector('canvas', { timeout: 60000 })
await p.waitForTimeout(6000)
await p.screenshot({ path: out, timeout: 180000 })
console.log(out)
await b.close()
