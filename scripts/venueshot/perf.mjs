// Draws, triangles and render CPU time of a venue from the chase camera at phone size, at a
// few points down the race: node scripts/venueshot/perf.mjs <venue,venue,...> [night] [dist]
// Swiftshader times aren't phone times; compare venues with each other, not with a budget.
import { chromium } from 'playwright'
const [, , list = 'giza', night = '0', dist = '400'] = process.argv
const port = process.env.PORT ?? 5173
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const venue of list.split(',')) {
  const rows = []
  for (const f of [0.01, 0.35, 0.7, 1]) {
    const d = Math.round(Number(dist) * f)
    const p = await b.newPage({ viewport: { width: 390, height: 844 } })
    await p.goto(`http://localhost:${port}/scripts/venueshot/index.html?venue=${venue}&d=${d}&night=${night}&dist=${dist}&season=summer&weather=clear&time=0`)
    await p.waitForFunction(() => window.ready, null, { timeout: 180000 })
    await p.waitForTimeout(Number(process.env.WAIT ?? 25000))
    rows.push({ d, ...(await p.evaluate(() => window.__perf())) })
    await p.close()
  }
  const max = (k) => Math.max(...rows.map((r) => r[k]))
  console.log(`${venue} calls ${rows.map((r) => r.calls).join('/')} (max ${max('calls')}) tris ${max('tris')} ms ${rows.map((r) => r.ms.toFixed(1)).join('/')}`)
}
await b.close()
