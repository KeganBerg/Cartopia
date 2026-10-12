// node scripts/wagershot/shoot.mjs <outDir>   (needs vite on :5173 with any VITE_SUPABASE_* set, so live UI shows)
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'wager-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const players = [
  { id: 'p1', uid: '11111111-1111-1111-1111-111111111111', town: 'Maple Hollow', level: 18, carName: 'Liberty Hellhound 707', color: '#1e88e5', body: 'widebody', pi: 62 },
  { id: 'p2', uid: '22222222-2222-2222-2222-222222222222', town: 'Rustbelt', level: 6, carName: 'Kazumi Zephyr', color: '#43a047', body: 'roadster', pi: 31 },
]
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, coins: 120000 }))
  const live = async (st) => p.evaluate(async (st) => (await import('/src/lib/live.ts')).useLive.setState(st), st)
  await live({ signedIn: true, players })
  await p.evaluate(() => window.__game.getState().openPanel('race'))
  await p.waitForTimeout(1500)
  await p.evaluate(() => [...document.querySelectorAll('.race-panel button')].find((b) => b.textContent.includes('Quick race'))?.click())
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${out}/${form}-1-quick.png` })
  await p.evaluate(() => document.querySelector('.rm-bet-btn')?.click())
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${out}/${form}-2-stakes.png` })
  await p.evaluate(() => window.__game.getState().openPanel(null))
  await live({ invites: [{ raceId: 'r1', from: players[0], at: Date.now(), mode: 'drag', stake: 10000 }, { raceId: 'r2', from: players[1], at: Date.now(), mode: 'drag', stake: 250000 }] })
  await p.evaluate(() => window.__game.getState().openPanel('invites'))
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${out}/${form}-3-invite.png` })
  await p.close()
  for (const r of ['', 'win', 'lose']) {
    const h = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
    h.on('pageerror', (e) => console.log('error', e.message))
    await h.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
    await h.goto(`http://localhost:5173/scripts/wagershot/index.html${r ? `?result=${r}` : ''}`)
    await h.waitForTimeout(9000)
    await h.screenshot({ path: `${out}/${form}-4-race${r ? '-' + r : ''}.png` })
    await h.close()
  }
  console.log(form)
}
await b.close()
