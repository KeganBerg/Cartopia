// A brand-new player's first minutes, tapped for real on a phone: screenshots each screen.
// node scripts/tutorial/play.mjs <outDir> [phone|desktop]   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'tut-out', form = 'phone'] = process.argv
const phone = form === 'phone'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone })
p.on('pageerror', (e) => console.log('error', e.message))
let n = 0
const shot = async (name) => { const f = `${out}/${form}-${String(++n).padStart(2, '0')}-${name}.png`; try { await p.screenshot({ path: f, timeout: 90000 }); console.log('shot', f) } catch { console.log('no shot', name) } }
const st = () => p.evaluate(() => { const s = window.__game.getState(); return { t: s.tutorial, panel: s.panel, mode: s.mode, jobs: s.stats.jobs } })
const tap = async (sel, label) => { const el = p.locator(sel).first(); try { await el.click({ force: true, timeout: 8000 }); console.log('tapped', label ?? sel) } catch { console.log('MISSING', label ?? sel) } await p.waitForTimeout(1200) }
const wait = async (fn, ms = 60000) => { try { await p.waitForFunction(fn, null, { timeout: ms, polling: 500 }) } catch { console.log('timeout', fn.toString()) } }
await p.goto('http://localhost:5173/?time=0.3&season=fall')
await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
await p.addStyleTag({ content: '*:not(.tut-hand):not(.tut-hand *){animation-duration:0s!important;transition:none!important}' })
await p.waitForTimeout(2500)
await p.getByText('Got it').click().catch(() => {})
await p.waitForTimeout(1500)
await shot('welcome')
await tap('.tutorial .buy', 'Next'); await shot('send-job')
await tap('.badge-pulse', 'pizza bubble'); await shot('job-running')
await wait(() => document.querySelector('.badge-ready'), 60000); await shot('collect')
await tap('.badge-ready', 'collect'); await shot('build-rusty')
console.log(await st())
await tap('.tut-pulse', 'SHOP'); await shot('shop')
await tap('.start-here', 'START HERE'); await shot('placing')
// The ghost sits on Rusty's lot: tap it where the hand points, else the middle of the screen.
const hand = await p.locator('.tut-hand').first().boundingBox().catch(() => null)
console.log('hand', hand)
const vp = p.viewportSize()
const at = hand ? { x: hand.x + hand.width / 2, y: hand.y + 4 } : { x: vp.width / 2, y: vp.height / 2 }
await p.mouse.click(at.x, at.y); await p.waitForTimeout(1500)
if (!(await p.evaluate(() => window.__game.getState().buildings.some((b) => b.def === 'rescue')))) { await p.mouse.click(at.x, at.y); await p.waitForTimeout(1500) }
if (!(await p.evaluate(() => window.__game.getState().buildings.some((b) => b.def === 'rescue')))) { console.log('GHOST MISSED: building via the store'); await p.evaluate(() => window.__game.getState().placeBuilding('rescue', 12, 12)) }
await p.waitForTimeout(1500); await shot('built')
console.log(await st())
await tap('.tut-pulse', 'Done'); await shot('find-cars')
await tap('.badge-pulse', 'Rusty badge'); await shot('rusty-panel')
await tap('.rsc-spot:not(.locked)', 'first spot'); await p.waitForTimeout(4000); await shot('search')
// Tap glowing spots on the lot until the haul screen shows (centre band of the screen, a grid).
for (let i = 0; i < 30 && (await p.evaluate(() => !!window.__game.getState().search)); i++) {
  const vp = p.viewportSize()
  await p.mouse.click(vp.width * (0.25 + 0.25 * (i % 3)), vp.height * (0.35 + 0.1 * Math.floor((i / 3) % 4)))
  await p.waitForTimeout(900)
  if (i === 2) await shot('searching')
  const go = p.locator('.rs-actions button').last()
  if (i > 12 && await go.isVisible().catch(() => false)) { await go.click({ force: true }).catch(() => {}); await p.waitForTimeout(3000) }
}
await shot('haul'); console.log(await st())
await tap('.panel .buy', 'haul button'); await shot('lot')
await tap('.lot-pick button, .lot-pick', 'junk car'); await shot('picked')
await tap('.junk-go', 'Restore'); await shot('restoring'); console.log(await st())
await tap('.panel .close', 'close'); await shot('paint')
await tap('.tut-swatches .dot >> nth=2', 'paint'); await tap('.tut-swatches >> nth=1 >> .dot >> nth=3', 'rim'); await shot('painted')
await tap('.tutorial .buy', 'Done'); await shot('gas')
await tap('.tutorial .buy', 'Next'); await shot('race-step')
await tap('.tut-pulse', 'RACE'); await p.waitForTimeout(3000); await shot('race-hub')
console.log(await st())
await b.close()
