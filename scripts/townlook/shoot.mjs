// Renders the Menu > Town option pictures into src/assets/town-look/.
// node scripts/townlook/shoot.mjs [only]   (needs `npx vite` on :5173 and Playwright)
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const [, , only] = process.argv
const out = new URL('../../src/assets/town-look/', import.meta.url)
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const base = 'http://localhost:5173/scripts/townlook/render.html'
const TONES = ['warm', 'white', 'amber', 'ice', 'mint', 'violet', 'rose']
const jobs = []
for (const t of ['own', 'white', 'pastel', 'sand', 'mint', 'rose', 'noir']) jobs.push([`theme-${t}`, 720, 440, `what=theme&theme=${t}`])
for (const post of ['auto', 'cobra', 'lantern', 'globe']) for (const tone of TONES) jobs.push([`lamp-${post}-${tone}`, 480, 480, `what=lamp&post=${post}&tone=${tone}`])
for (const [name, W, H, query] of jobs.filter(([n]) => !only || n.startsWith(only))) {
  const p = await b.newPage({ viewport: { width: W, height: H } })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto(`${base}?${query}&season=summer&weather=clear`)
  const r = await (await p.waitForFunction(() => window.__out, null, { timeout: 120000 })).jsonValue()
  writeFileSync(new URL(`${name}.webp`, out), Buffer.from(r.data.split(',')[1], 'base64'))
  console.log(name)
  await p.close()
}
await b.close()
