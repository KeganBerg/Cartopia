// The crew war screen (?battle=demo, ?battle=won) on phone and desktop: war map (and a rival picked), crews, log.
// node scripts/warshot/shoot.mjs <outDir>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'warshot-out'] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const mode of ['demo', 'won']) {
  for (const [form, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
    const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
    p.on('pageerror', (e) => console.log('pageerror', e.message))
    await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
    await p.goto(`http://localhost:5173/?time=0.8&season=fall&battle=${mode}`)
    await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
    await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 25 }))
    await p.waitForFunction(() => document.querySelector('.cb-dock'), null, { timeout: 60000 })
    await p.waitForTimeout(9000)
    await p.screenshot({ path: `${out}/${mode}-${form}.png` })
    if (await p.locator('.wm-spot.them').count()) {
      await p.locator('.wm-spot.them').nth(1).dispatchEvent('click')
      await p.waitForTimeout(800)
      await p.screenshot({ path: `${out}/${mode}-${form}-pick.png` })
    }
    for (const [i, name] of [[1, 'crews'], [2, 'log']]) {
      await p.locator('.cb-tabs button').nth(i).dispatchEvent('click')
      await p.waitForTimeout(1200)
      await p.screenshot({ path: `${out}/${mode}-${form}-${name}.png` })
    }
    const wide = await p.evaluate(() => [...document.querySelectorAll('.cb-dock *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.clientWidth > 0).map((e) => e.className + ':' + e.scrollWidth + '/' + e.clientWidth))
    console.log(mode, form, 'overflowing', wide)
    await p.close()
  }
}
await b.close()
