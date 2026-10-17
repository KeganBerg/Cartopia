// Screens a new player meets, in order: first launch, each tutorial step, level up, a race.
// node scripts/polish/flow.mjs <outDir> [forms]   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'polish-out', forms = 'phone,desktop'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]].filter(([f]) => forms.includes(f))) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  const shot = async (n) => { try { await p.screenshot({ path: `${out}/${form}-${n}.png`, timeout: 90000 }); console.log(form, n) } catch { console.log('no shot', n) } }
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForTimeout(1500); await shot('00-loading')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(4000); await shot('01-first-launch')
  await p.getByText('Got it').click().catch(() => console.log('no got it'))
  await p.waitForTimeout(2500); await shot('02-after-warning')
  for (const t of [0, 1, 3, 6, 7, 8]) {
    await p.evaluate((t) => window.__game.setState({ tutorial: t, panel: null }), t)
    await p.waitForTimeout(1500); await shot(`03-tut-${t}`)
  }
  await p.evaluate(() => window.__game.setState({ tutorial: 99, levelUp: { from: 2, to: 3, coins: 500, bucks: 2 } }))
  await p.waitForTimeout(2500); await shot('04-levelup')
  await p.evaluate(() => window.__game.setState({ levelUp: null, level: 12, coins: 50000, panel: null }))
  await p.waitForTimeout(1500); await shot('05-town')
  await p.close()
}
await b.close()
