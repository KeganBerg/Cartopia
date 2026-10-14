// Screenshots of every menu panel and Race tab on desktop and phone, for layout audits.
// node scripts/menuaudit/shoot.mjs <outDir> [names...]   (needs `npx vite` on :5173)
// Names are panel ids (shop, garage...) or race:<tab> (race:daily...).
import { chromium } from 'playwright'
const [, , out = 'menuaudit-out', ...want] = process.argv
const PANELS = ['shop', 'garage', 'showroom', 'account', 'goals', 'friends', 'rescue', 'bank', 'leaders', 'clan', 'gifts', 'season', 'deals', 'chat', 'inventory', 'taunts']
const TABS = ['hub', 'quick', 'campaign', 'tour', 'gp', 'trial', 'event', 'rivals', 'tuner', 'cups', 'road', 'flair', 'daily', 'world']
const names = want.length ? want : [...PANELS, ...TABS.map((t) => `race:${t}`)]
const forms = (process.env.FORMS ?? 'desktop,phone').split(',')
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]].filter(([f]) => forms.includes(f))) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(3000)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 25, coins: 250000, panel: null }))
  const ready = async () => {
    await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
    await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 25, coins: 250000, panel: null }))
  }
  for (const n of names) for (let tries = 0; tries < 2; tries++) try {
    await p.evaluate(() => window.__game.setState({ panel: null }))
    await p.waitForTimeout(300)
    if (n.startsWith('race:')) {
      await p.evaluate(async (t) => { (await import('/src/ui/raceNav.ts')).openRaceTab(t) }, n.slice(5))
    } else {
      await p.evaluate((n) => window.__game.setState({ panel: n }), n)
    }
    // Menus load lazily: wait for the panel itself, then let thumbnails render.
    await p.waitForSelector('.panel', { timeout: 30000 }).catch(() => console.log('no panel', n))
    await p.waitForTimeout(2000)
    await p.screenshot({ path: `${out}/${form}-${n.replace(/\W/g, '-')}.png` })
    console.log(form, n)
    break
  } catch (e) {
    // Vite can reload the page when it first loads a lazy chunk: wait and try again.
    console.log('retry', n, e.message.split('\n')[0])
    await p.waitForTimeout(4000)
    await ready()
  }
  await p.close()
}
await b.close()
