// Postcards for Rusty's spot list: each search lot rendered in the real game
// (RescueScene), day and night, cropped to the band with the lot's
// surroundings and the far spots glowing. Writes public/rescue/<spot>-<day|night>.webp.
// node scripts/rescue/spotart.mjs   (needs `npm run dev` on :5173 and Playwright)
import { writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const SPOTS = (process.env.SPOTS ?? 'suburbs,farm,downtown,desert,track').split(',')
const out = new URL('../../public/rescue/', import.meta.url)
mkdirSync(out, { recursive: true })
// The band of a 1280x800 frame that becomes the card, and the card's size.
const CROP = JSON.parse(process.env.CROP ?? '{"x":0,"y":215,"width":1280,"height":530}')
// The postcard camera: low over the gate, looking across the lot to what's around it.
const CAM = JSON.parse(process.env.CAM ?? '{"p":[10,9,24],"l":[-2,0,-6]}')
const W = 720
const H = Math.round((W * CROP.height) / CROP.width)

const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const tod of (process.env.TOD ?? 'day,night').split(',')) {
  for (const spot of SPOTS) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
    p.on('pageerror', (e) => console.log('error', e.message))
    await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
    await p.goto(`http://localhost:5173/?time=${tod === 'night' ? 0.5 : 0.08}&season=summer&weather=clear`)
    await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
    await p.waitForTimeout(3000)
    // The overlays come off: only the lot shows.
    await p.addStyleTag({ content: '*{animation-duration:0s!important;transition:none!important} .tutorial,.rf-top,.rs-dots,.rs-coach,.rs-bottom,.ls{display:none!important}' })
    // Virtual clock, so the truck's drive in takes no real time (see shoot.mjs).
    await p.evaluate(() => {
      let virt = performance.now()
      const q = []
      performance.now = () => virt
      window.requestAnimationFrame = (f) => (q.push(f), q.length)
      window.cancelAnimationFrame = () => {}
      for (const C of [WebGLRenderingContext, WebGL2RenderingContext])
        for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
          const f = C.prototype[k]
          if (f) C.prototype[k] = function (...a) { if (!window.__skipDraw) return f.apply(this, a) }
        }
      const timers = new Map()
      let tid = 1e6
      window.setTimeout = (f, ms = 0, ...a) => (timers.set(++tid, { at: virt + ms, f: () => f(...a) }), tid)
      window.clearTimeout = (id) => timers.delete(id)
      window.__tick = (ms, draw) => {
        virt += ms
        for (const [id, t] of [...timers]) if (t.at <= virt) { timers.delete(id); t.f() }
        window.__skipDraw = !draw
        for (const f of q.splice(0)) f(virt)
      }
    })
    await p.evaluate((spot) => {
      const g = window.__game
      const s = g.getState()
      const pins = Array.from({ length: 8 }, () => ({ kind: 'nothing' }))
      const has = s.buildings.some((x) => x.def === 'rescue')
      g.setState({
        tutorial: 99,
        buildings: has ? s.buildings : [...s.buildings, { uid: 'rr', def: 'rescue', x: 4, z: 4, jobEndsAt: null, level: 3 }],
        search: { spot, pins, revealed: pins.map(() => false), truckAt: null, flatAt: null, flat: false },
        panel: 'rescue',
      })
    }, spot)
    for (let t = 0; t < 40; t++) await p.evaluate(() => window.__tick(100, false))
    await p.evaluate((cam) => { window.__rescueCam = cam; window.__tick(1, true); window.__tick(1, true) }, CAM)
    const png = await p.screenshot({ clip: CROP, timeout: 180000, animations: 'disabled' })
    const data = await p.evaluate(async ({ src, W, H }) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      c.getContext('2d').drawImage(img, 0, 0, W, H)
      return c.toDataURL('image/webp', 0.7)
    }, { src: 'data:image/png;base64,' + png.toString('base64'), W, H })
    const buf = Buffer.from(data.split(',')[1], 'base64')
    writeFileSync(new URL(`${spot}-${tod}.webp`, out), buf)
    console.log(spot, tod, `${Math.round(buf.length / 1024)} KB`)
    await p.close()
  }
}
await b.close()
