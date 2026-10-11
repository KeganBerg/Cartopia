// node scripts/rescue/yardshot.mjs <out.png> [night]
import { chromium } from 'playwright'
const [, , out, night] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto(`http://localhost:5173/scripts/rescue/yard.html?night=${night ? 1 : 0}&time=${night ? 0.5 : 0.08}`)
await p.waitForSelector('canvas')
await p.waitForTimeout(12000)
await p.screenshot({ path: out })
await b.close()
