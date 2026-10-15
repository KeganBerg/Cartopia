import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')
const qs = process.argv[2] ?? ''
const n = Number(process.argv[3] ?? 3)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (let i = 0; i < n; i++) {
  const p = await b.newPage({ viewport: { width: 640, height: 400 } })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto('http://localhost:5173/scripts/campaignbot/index.html?' + qs)
  await p.waitForFunction(() => window.__result, null, { timeout: 120000 }).catch(() => {})
  const r = await p.evaluate(() => window.__result)
  const stats = await p.evaluate(() => [...document.querySelectorAll('.rr-stats span')].map((s) => s.textContent).join(' | '))
  console.log(JSON.stringify(r), stats)
  await p.close()
}
await b.close()
