// Renders the loading screen's pictures from the real game models into public/splash/.
// node scripts/splash/shoot.mjs [only]   (needs `npm run dev` on :5173 and Playwright)
// Street strips: one per season, day and night. Cars: every model in white paint plus a
// paint mask, so the splash can show the player's own car in their colour.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const [, , only] = process.argv
const out = new URL('../../public/splash/', import.meta.url)
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const base = 'http://localhost:5173/scripts/splash/render.html'
const lp = await b.newPage()
await lp.goto(`${base}?what=list`)
const models = await (await lp.waitForFunction(() => window.__out, null, { timeout: 60000 })).jsonValue()
await lp.close()
const jobs = []
for (const season of ['spring', 'summer', 'fall', 'winter'])
  for (const night of [0, 1]) jobs.push([`street-${season}-${night ? 'night' : 'day'}`, 4400, 800, `what=street&y=3&season=${season}&night=${night}`])
for (const id of models) for (const mask of [0, 1]) jobs.push([`car-${id}${mask ? '-mask' : ''}`, 1200, 520, `what=car&y=0.5&model=${id}&mask=${mask}&season=summer`, mask])

let box = ''
for (const [name, W, H, query, mask] of jobs.filter(([n]) => !only || n.startsWith(only))) {
  const p = await b.newPage({ viewport: { width: W, height: H } })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto(`${base}?${query}${mask ? `&crop=${box}` : ''}&time=0.08&weather=clear`)
  const r = await (await p.waitForFunction(() => window.__out, null, { timeout: 120000 })).jsonValue()
  box = r.box
  writeFileSync(new URL(`${name}.webp`, out), Buffer.from(r.data.split(',')[1], 'base64'))
  console.log(name, r.w, r.h)
  await p.close()
}
await b.close()
