// node scripts/clubshot/shoot.mjs outDir tag [w] [h] [level]   (vite dev on PORT)
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
import { mkdirSync } from 'node:fs'
const [, , out = 'clubshot-out', tag = 'after', w = '900', h = '700', level = '7'] = process.argv
mkdirSync(out, { recursive: true })
const port = process.env.PORT ?? 5173
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) } })
p.on('pageerror', (e) => console.log('error', e.message))
p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()) })
await p.goto(`http://localhost:${port}/scripts/clubshot/index.html?time=0.5&season=summer&weather=clear&level=${level}${process.env.BRIGHT ? '&bright=1' : ''}${process.env.SOLO ? '&solo=1' : ''}`)
await p.waitForFunction(() => window.ready && window.view, null, { timeout: 120000 })
await p.waitForTimeout(5000)
for (let i = 0; i < 8; i++) {
  await p.evaluate((i) => window.view(i), i)
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${out}/${tag}-v${i}.png` })
}
// The wave: admit, then shots through the gesture.
await p.evaluate(() => window.view(0))
await p.evaluate(() => window.admit())
for (const t of [450, 900]) {
  await p.waitForTimeout(t === 450 ? 450 : 450)
  await p.screenshot({ path: `${out}/${tag}-wave-${t}.png` })
}
await p.evaluate(() => window.view(1))
await p.evaluate(() => window.admit())
await p.waitForTimeout(700)
await p.screenshot({ path: `${out}/${tag}-wave-close.png` })
await b.close()
