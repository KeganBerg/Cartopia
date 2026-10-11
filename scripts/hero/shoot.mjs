// Captures the Race menu hero shots from the dev server (see main.tsx).
// node scripts/hero/shoot.mjs [outDir] [only]   (needs `npm run dev` on :5173 and Playwright)
import { chromium } from 'playwright'
const [, , out = 'hero-out', only] = process.argv
const W = 1200, H = 1200
const VENUES = ['main', 'docks', 'desert', 'snow', 'beach', 'farm']
const jobs = [
  ...VENUES.map((v) => ['camp', v, 0]),
  ...VENUES.flatMap((v) => [['tour', v, 0], ['tour', v, 1]]),
  ['gp', 'main', 0],
  ...VENUES.map((v) => ['trial', v, 0]),
].filter(([s, v, n]) => !only || `${s}-${v}${n ? '-night' : ''}`.startsWith(only))
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [shot, v, n] of jobs) {
  const p = await b.newPage({ viewport: { width: W, height: H } })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto(`http://localhost:5173/scripts/hero/index.html?shot=${shot}&venue=${v}&night=${n}&time=0.08&weather=clear&season=summer`)
  await p.waitForSelector('canvas', { timeout: 60000 })
  await p.waitForTimeout(9000)
  const name = `${shot}-${v}${n ? '-night' : ''}.png`
  await p.screenshot({ path: `${out}/${name}` })
  console.log(name)
  await p.close()
}
await b.close()
