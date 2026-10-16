// Quick Race with Call Cards, desktop 1280x800 and phone 390x844 (needs `npx vite` on :5173).
// node scripts/callcards/shoot.mjs <outDir> [cardIds...]
// Shoots the tab as it is, then with the given cards (default: six crate cards) swapped onto the
// rival cards, so every card can be seen on a real car.
import { chromium } from 'playwright'
const [, , out = 'callcards-out', ...want] = process.argv
const CARDS = want.length ? want : ['neonalley', 'ravelights', 'thunderroad', 'sunsetstrip', 'midnightgrid', 'goldrush']
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const forms = (process.env.FORMS ?? 'desktop,phone').split(',')
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]].filter(([f]) => forms.includes(f))) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(3000)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 25, coins: 250000, panel: null }))
  for (let tries = 0; tries < 3; tries++) try {
    await p.evaluate(async () => { (await import('/src/ui/raceNav.ts')).openRaceTab('quick') })
    await p.waitForSelector('.rm-qc', { timeout: 30000 })
    break
  } catch { await p.waitForTimeout(4000) }
  await p.waitForTimeout(3500)
  await p.screenshot({ path: `${out}/${form}-quick-stock.png` })
  // The Call Cards on the rivals, with their tier frames and gems.
  await p.evaluate((ids) => {
    const tiers = { neonalley: 'rare', raincheck: 'rare', sunsetstrip: 'rare', checkerrush: 'rare', ravelights: 'epic', warpspeed: 'epic', polarglow: 'epic', midnightgrid: 'epic', thunderroad: 'legendary', inferno: 'legendary', starwarp: 'legendary', goldrush: 'legendary' }
    ;[...document.querySelectorAll('.rm-qc')].forEach((card, i) => {
      const id = ids[i % ids.length]
      const cc = card.querySelector('.cc')
      if (!cc) return
      cc.className = `cc cc-${id}`
      card.classList.remove('cc-tier-rare', 'cc-tier-epic', 'cc-tier-legendary')
      if (tiers[id]) card.classList.add(`cc-tier-${tiers[id]}`)
    })
  }, CARDS)
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${out}/${form}-quick-cards.png` })
  await p.close()
}
await b.close()
