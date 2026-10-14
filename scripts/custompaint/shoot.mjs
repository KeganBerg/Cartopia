// Screenshots of Custom Colour: the locked fly-out, the picker with a colour on try-on, and the
// Diamond Crate's paint odds, on desktop and phone.
// node scripts/custompaint/shoot.mjs <outDir>   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'
const [, , out = 'custompaint-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const tab = (p, name) => p.evaluate((name) => [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.includes(name))?.click(), name)
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  for (const shot of (process.env.SHOTS ?? 'locked,picker,custom,crate').split(',')) {
    const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
    p.on('pageerror', (e) => console.log('error', e.message))
    await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
    await p.goto('http://localhost:5173/?time=0.3&season=summer')
    await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
    await p.waitForTimeout(2500)
    await p.evaluate(([own, shot]) => {
      const g = window.__game
      const s = g.getState()
      g.setState({ tutorial: 99, level: 20, coins: 50000, bucks: 200, skins: own ? ['custompaint'] : [], selectedCar: s.cars[0].uid, panel: shot === 'crate' ? 'crates' : 'garage' })
    }, [shot !== 'locked', shot])
    await p.waitForTimeout(1500)
    if (shot === 'crate') {
      await p.waitForSelector('.odd.skin, .crate-card, .crate-tile', { timeout: 60000 }).catch(() => {})
      await p.waitForTimeout(4000)
      await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Diamond'))?.click())
      await p.waitForTimeout(800)
      await p.evaluate(() => document.querySelector('.odd.skin')?.click())
    } else {
      await tab(p, shot === 'custom' ? 'Custom' : 'Paint')
      await p.waitForTimeout(800)
      await p.evaluate(() => document.querySelector('.cc-dot')?.click())
      if (shot !== 'locked') {
        await p.waitForTimeout(300)
        // Synthetic taps: a real mouse click waits on the slow software-GL frame.
        const tap = (sel, x, y) => p.evaluate(([sel, x, y]) => {
          const el = document.querySelector(sel)
          const r = el.getBoundingClientRect()
          const o = { bubbles: true, pointerId: 1, clientX: r.left + r.width * x, clientY: r.top + r.height * y }
          el.dispatchEvent(new PointerEvent('pointerdown', o))
          el.dispatchEvent(new PointerEvent('pointerup', o))
        }, [sel, x, y])
        await tap('.cc-hue', 0.78, 0.5)
        await p.waitForTimeout(1500)
        await tap('.cc-sv', 0.85, 0.12)
      }
      await p.evaluate(() => document.querySelector('.cc-dot')?.scrollIntoView({ block: 'start' }))
    }
    await p.waitForTimeout(3500)
    await p.screenshot({ path: `${out}/${form}-${shot}.png` })
    // The car wearing the picked colour, with the try-on bar.
    if (shot === 'picker') {
      await p.evaluate(() => document.querySelectorAll('*').forEach((el) => { if (el.scrollTop > 0) el.scrollTop = 0 }))
      await p.waitForTimeout(2500)
      await p.screenshot({ path: `${out}/${form}-picker-car.png` })
    }
    console.log(form, shot)
    await p.close()
  }
}
await b.close()
