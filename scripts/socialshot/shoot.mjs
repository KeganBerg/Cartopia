// Every Social tab (Friends, Crew, Meet, Leaderboards) on phone and desktop, signed out with the
// demo crew (?crew=demo&battle=demo). Crew also gets a shot of each of its sections.
// node scripts/socialshot/shoot.mjs <outDir> [prefix]   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'socialshot-out', prefix = ''] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('pageerror', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall&crew=demo&battle=demo')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(3000)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 25, panel: 'friends' }))
  for (const tab of ['friends', 'clan', 'meet', 'leaders']) {
    await p.evaluate((t) => window.__game.getState().swapPanel(t), tab)
    await p.waitForTimeout(tab === 'clan' ? 6000 : 3000)
    await p.screenshot({ path: `${out}/${prefix}${form}-${tab}.png` })
    if (tab === 'clan') {
      const subs = await p.locator('.cr-tabs button').count()
      for (let i = 1; i < subs; i++) {
        await p.locator('.cr-tabs button').nth(i).dispatchEvent('click')
        await p.waitForTimeout(2500)
        await p.screenshot({ path: `${out}/${prefix}${form}-clan-${i}.png` })
      }
      if (!subs) {
        await p.evaluate(() => { const s = document.querySelector('.panel-body') || document.querySelector('.panel'); s && s.querySelectorAll('*').forEach((e) => { if (e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== 'visible') e.scrollTop = 99999 }) })
        await p.waitForTimeout(800)
        await p.screenshot({ path: `${out}/${prefix}${form}-clan-bottom.png` })
      }
    }
    const wide = await p.evaluate(() => [...document.querySelectorAll('.panel *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.clientWidth > 0).length)
    console.log(form, tab, 'overflowing', wide)
  }
  await p.close()
}
await b.close()
