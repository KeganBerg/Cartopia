// Townspeople using a building's front door: one walks up, the door swings open,
// they go in, and come back out carrying what they bought.
// node scripts/doorshot/shoot.mjs <outDir> [phone|desktop] [def] [kind]   (vite dev on :5173)
//   env: TIME (town day fraction), SECS (how long to film), EVERY (seconds between frames), NIGHT=1
import { chromium } from 'playwright'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
const [, , out = 'door-out', form = 'desktop', def = 'pizza', kind = 'shop'] = process.argv
mkdirSync(out, { recursive: true })
// Progress goes to <outDir>/log.txt as well, for runs left in the background.
writeFileSync(`${out}/log.txt`, `${process.pid}\n`)
const log = (...a) => { console.log(...a); appendFileSync(`${out}/log.txt`, a.join(' ') + '\n') }
const size = form === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
p.on('pageerror', (e) => log('error', e.message))
await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
await p.goto(`http://localhost:5173/?time=${process.env.TIME ?? 0.1}&season=summer&weather=clear`)
await p.waitForFunction(() => window.__game, null, { timeout: 180000 })
log('loaded')
await p.waitForTimeout(3000)
await p.addStyleTag({ content: '*{animation-duration:0s!important;transition:none!important} .tutorial{display:none!important}' })
await p.evaluate(() => { const d = new Date(); window.__game.setState({ tutorial: 99, level: 20, panel: null, lastDaily: d.toISOString().slice(0, 10) }) })
await p.waitForTimeout(1500)
await p.evaluate(() => window.__game.setState({ panel: null }))
// Put the building on show: swap one of the start town's pizza shops for it (level via LEVEL).
const uid = await p.evaluate(([def, lvl]) => {
  const g = window.__game
  const s = g.getState()
  const shop = s.buildings.find((o) => o.def === 'pizza' && o.x === 10)
  g.setState({ buildings: s.buildings.map((o) => (o === shop ? { ...o, def, level: lvl } : o)) })
  return shop.uid
}, [def, Number(process.env.LEVEL ?? 1)])
await p.waitForTimeout(3000)
// Virtual clock: each tick advances time and runs one frame.
await p.evaluate(() => {
  let virt = performance.now()
  const q = []
  const realNow = Date.now
  const t0 = realNow()
  const v0 = virt
  performance.now = () => virt
  Date.now = () => t0 + (virt - v0)
  window.requestAnimationFrame = (f) => (q.push(f), q.length)
  window.cancelAnimationFrame = () => {}
  window.__tick = (ms) => {
    virt += ms
    for (const f of q.splice(0)) f(virt)
  }
})
log('clock')
const step = async (sec) => { for (let t = 0; t < sec - 0.001; t += 0.1) await p.evaluate(() => window.__tick(100)) }
const fiber = await p.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('@react-three_fiber.js')))
await p.evaluate(async (url) => {
  const { _roots } = await import(url)
  const roots = [..._roots.values()].map((r) => r.store.getState())
  window.__town = roots.find((s) => s.controls) ?? roots[0]
}, fiber)
await step(2)
const door = await p.evaluate(async (uid) => {
  const { lotDoors } = await import('/src/scene/doors.ts')
  return lotDoors(uid)[0] ?? null
}, uid)
log('door', JSON.stringify(door))
if (!door) process.exit(1)
// The resident nearest the shop heads over.
const who = await p.evaluate(([uid, door, kind]) => {
  const list = window.__people.current
  let best = 0, bd = Infinity
  list.forEach((q, i) => { const d = Math.hypot(q.pos[0] - door.x, q.pos[1] - door.z); if (q.type === 'walker' && d < bd) { bd = d; best = i } })
  // Start them a few steps down the street, so the film is all door.
  const q = list[best]
  q.state = 'linger'
  q.at = 'here'
  q.pos = [door.x + door.nx * 1.3 + door.nz * 2.2, door.z + door.nz * 1.3 - door.nx * 2.2]
  q.dogPos = [...q.pos]
  return [best, window.__visit(best, uid, kind)]
}, [uid, door, kind])
log('walker', JSON.stringify(who))
// The town camera as the player has it, zoomed right in on the door.
await p.evaluate(([door, zoom, side]) => {
  const s = window.__town
  const c = s.controls, cam = s.camera
  const off = cam.position.clone().sub(c.target)
  // Swing round to look at the door's face, a little from one side.
  const h = Math.hypot(off.x, off.z), a = Math.atan2(door.nx, door.nz) + side
  off.x = h * Math.sin(a)
  off.z = h * Math.cos(a)
  c.target.set(door.x, 0.3, door.z)
  cam.position.copy(c.target).add(off)
  cam.zoom = zoom
  cam.updateProjectionMatrix()
  c.update()
}, [door, Number(process.env.ZOOM ?? (form === 'phone' ? 110 : 170)), Number(process.env.SIDE ?? -0.6)])
await step(1)
const secs = Number(process.env.SECS ?? 40), every = Number(process.env.EVERY ?? 0.5)
let n = 0
for (let t = 0; t < secs; t += every) {
  await step(every)
  const [st, near] = await p.evaluate(([i, door]) => { const q = window.__people.current[i]; return [`${q.state} ${q.item ?? ''} ${q.pos.map((v) => v.toFixed(2))}`, Math.hypot(q.pos[0] - door.x, q.pos[1] - door.z) < 2.4] }, [who[0], door])
  if (!near) log(t.toFixed(1), st)
  if (process.env.ALL || (near && !st.startsWith('inside'))) {
    await p.screenshot({ path: `${out}/${form}-${def}-${String(n++).padStart(3, '0')}.png` })
    log(t.toFixed(1), st)
  }
}
await b.close()
