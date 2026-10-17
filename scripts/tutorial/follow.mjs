// A new player who only ever taps where the tutorial's hand points. If the hand is right on
// every step, this reaches the end of the tutorial. Screenshots each new step or menu.
// node scripts/tutorial/follow.mjs <outDir> [phone|desktop]   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'tut-out', form = 'phone'] = process.argv
const phone = form === 'phone'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone })
p.on('pageerror', (e) => console.log('error', e.message))
let n = 0
const shot = async (name) => { const f = `${out}/${form}-${String(++n).padStart(2, '0')}-${name}.png`; try { await p.screenshot({ path: f, timeout: 90000 }); console.log('shot', f) } catch { console.log('no shot', name) } }
const st = () => p.evaluate(() => { const s = window.__game.getState(); return { t: s.tutorial, panel: s.panel, mode: s.mode, search: !!s.search, races: s.stats.races ?? 0 } })
await p.goto('http://localhost:5173/?time=0.3&season=fall')
await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
// Swiftshader is too slow for CSS animations: sheets stall mid slide-in. The hand keeps its bob.
await p.addStyleTag({ content: '*:not(.tut-hand span){animation-duration:0s!important;transition:none!important}' })
await p.waitForTimeout(2500)
await p.getByText('Got it').click({ timeout: 30000 }).catch(() => console.log('no flashing-lights warning'))
await p.waitForTimeout(1500)
let last = ''
let idle = 0
for (let i = 0; i < 160; i++) {
  const s = await st()
  if (s.t >= 9) break
  const key = `${s.t}-${s.panel}-${s.mode}-${s.search}`
  // Where the fingertip is: the hand's translate().
  const tip = await p.evaluate(() => {
    const h = document.querySelector('.tut-hand.on')
    const m = h && /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(h.style.transform)
    return m ? { x: +m[1], y: +m[2], down: h.classList.contains('down') } : null
  })
  if (key !== last) { last = key; await p.waitForTimeout(800); await shot(`t${s.t}-${s.panel ?? s.mode}${s.search ? '-search' : ''}`) }
  if (!tip) {
    idle++
    if (idle % 10 === 0) console.log('no hand', key)
    await p.waitForTimeout(1500)
    continue
  }
  idle = 0
  // The tip sits a little inside the target; tap just past it.
  const y = tip.y + (tip.down ? 4 : -4)
  if (phone) await p.touchscreen.tap(tip.x, y)
  else await p.mouse.click(tip.x, y)
  console.log('tap', key, Math.round(tip.x), Math.round(y))
  await p.waitForTimeout(1500)
}
console.log('end', await st())
await shot('end')
await b.close()
