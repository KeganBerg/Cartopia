// Records the launch trailer's town shots from the real game: the staged town from the
// splash renders (scripts/splash/town.mjs), in the free camera with screenshot mode hiding
// every menu, flown along a camera move one frame at a time on the page's own clock.
// FPS=15 node scripts/trailer/town.mjs scripts/trailer/town.json <outDir>/shots   (needs `npx vite` on :5173, Playwright)
// (the full game draws a frame in ~15 s here, so the town shots are drawn at 15 fps; cut.py blends them to 30)
//   shots.json: [{ "name": "town-day", "time": 0.08, "season": "summer", "w": 1920, "h": 1080,
//                  "dur": 3.4, "from": {x,z,yaw,pitch,dist}, "to": {x,z,yaw,pitch,dist} }]
//   PROBE=1 takes one still per shot at `from` instead (for framing).
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const [, , shotsFile, out] = process.argv
const shots = JSON.parse(readFileSync(shotsFile, 'utf8'))
const probe = !!process.env.PROBE
const FPS = Number(process.env.FPS ?? 30)
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

const town = () => {
  let n = 0
  const bl = []
  const B = (def, x, z, level = 1) => bl.push({ uid: 'b' + n++, def, x, z, jobEndsAt: null, level })
  const roads = new Set()
  for (let i = 4; i <= 19; i++) for (const k of [`${i},4`, `${i},19`, `4,${i}`, `19,${i}`, `${i},11`]) roads.add(k)
  B('rescue', 5, 5, 6); B('gas', 7, 5, 8); B('diner', 9, 5, 8); B('pizza', 11, 5, 9); B('donut', 12, 5, 7); B('burger', 13, 5, 8); B('carwash', 14, 5, 7); B('club', 16, 5, 8); B('coffee', 18, 5, 7)
  B('showroom', 5, 7); B('garage', 7, 7); B('cinema', 9, 7, 8); B('pond', 11, 7); B('academy', 13, 7, 7); B('hospital', 15, 7, 8); B('tree', 17, 7); B('palm', 18, 7); B('fountain', 17, 8); B('flowers', 18, 8)
  B('lamp', 5, 9); B('tree', 6, 9); B('bench', 7, 9); B('flowers', 8, 9); B('tree', 9, 9); B('lamp', 10, 9); B('palm', 11, 9); B('hotdog', 12, 9); B('tree', 13, 9); B('busstop', 14, 9); B('flowers', 15, 9); B('tree', 16, 9); B('lamp', 17, 9); B('tree', 18, 9)
  B('hq', 5, 10, 8); B('offices', 7, 10, 8); B('bodyshop', 9, 10, 7); B('market', 11, 10, 8); B('firehouse', 13, 10, 7); B('police', 15, 10, 7); B('bowling', 17, 10, 8)
  B('glasstower', 5, 12, 9); B('helipad', 7, 12, 8); B('school', 9, 12, 7); B('parkade', 11, 12, 8); B('highschool', 13, 12, 7); B('stadium', 16, 12, 8); B('tree', 18, 12); B('pine', 18, 13)
  B('university', 5, 14, 8); B('garden', 8, 14); B('playground', 10, 14); B('koi', 12, 14); B('skatepark', 14, 14); B('dogpark', 16, 14); B('tree', 18, 14); B('clocktower', 18, 15)
  B('gazebo', 8, 16); B('tree', 9, 16); B('picnic', 10, 16); B('flagpole', 11, 16); B('tree', 12, 16); B('statue', 13, 16); B('tree', 14, 16); B('arch', 15, 16); B('tree', 16, 16); B('billboard', 17, 16); B('tree', 18, 16)
  for (let x = 5; x <= 18; x++) B(x % 5 === 0 ? 'tree' : 'house', x, 18, 1 + (x % 3))
  for (let x = 5; x <= 18; x++) B(x % 4 === 0 ? 'pine' : 'house', x, 17, 2 + (x % 2))
  for (let x = 0; x <= 23; x++) for (const z of [0, 1, 2, 3, 20, 21, 22, 23]) if ((x * 7 + z * 3) % 4 === 0) B(z % 2 ? 'pine' : 'tree', x, z); else if (z === 3 || z === 20) B('house', x, z, 1 + (x % 3))
  for (let z = 4; z <= 19; z++) for (const x of [0, 1, 2, 3, 20, 21, 22, 23]) if ((x * 5 + z) % 3 === 0) B(x % 2 ? 'tree' : 'pine', x, z); else if (x === 3 || x === 20) B('house', x, z, 1 + (z % 3))
  const models = ['vette', 'lambo', 'gtr', 'hotshot', 'bug', 'camper', 'charger', 'zenith', 'tusker', 'miata', 'woodie', 'hyper', 'kitsune', 'rally', 'salon', 'shinden']
  const colors = ['#e53935', '#fdd835', '#eceff1', '#ff7043', '#4dd0e1', '#f48fb1', '#263238', '#7e57c2', '#43a047', '#1e88e5', '#a1887f', '#ff1744', '#ffb300', '#00acc1', '#5d4037', '#c0ca33']
  const up = { engine: 0, turbo: 0, tires: 0, weight: 0 }
  return { buildings: bl, roads: [...roads], cars: models.map((m, i) => ({ uid: 'c' + i, model: m, color: colors[i], upgrades: up })) }
}

const ease = (t) => t * t * (3 - 2 * t)
const lerp = (a, b, t) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + (b[k] - a[k]) * t]))

for (const s of shots) {
  const dir = join(out, s.name)
  if (!probe && existsSync(join(dir, 'done'))) { console.log('skip', s.name); continue }
  mkdirSync(dir, { recursive: true })
  const t0 = Date.now()
  const p = await b.newPage({ viewport: { width: s.w ?? 1920, height: s.h ?? 1080 } })
  p.on('pageerror', (e) => console.log(s.name, 'error', e.message))
  await p.addInitScript(([t]) => {
    localStorage.setItem('cartopia-flash-warning-hide', '1')
    localStorage.setItem('cartopia-freecam-tips', '9')
    localStorage.setItem('cartopia.tips', JSON.stringify(['gems', 'goals', 'garage', 'taptip', 'fuel', 'tires', 'crates', 'crew', 'arcade']))
    localStorage.setItem('cartopia-save', JSON.stringify({ state: { version: 1, townName: 'Sunny Hollow', level: 40, xp: 0, coins: 99999, bucks: 500, parts: 500, fuel: 99, fuelUpdatedAt: Date.now(), trophies: 300, racesWon: 50, tutorial: 99, lastDaily: new Date().toISOString().slice(0, 10), ...t, updatedAt: Date.now() }, version: 0 }))
  }, [town()])
  await p.goto(`http://localhost:5173/?nosplash&time=${s.time ?? 0.08}&season=${s.season ?? 'summer'}&weather=${s.weather ?? 'clear'}`)
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForSelector('canvas', { timeout: 90000 })
  await p.waitForTimeout(5000)
  await p.evaluate(() => window.__game.setState({ panel: null }))
  await p.$eval('.cam-dock', (el) => el.click())
  await p.waitForFunction(() => window.__freeRig?.current, null, { timeout: 60000 })
  await p.waitForTimeout(4000)
  await p.evaluate(() => window.__game.setState({ panel: null }))
  await p.$eval('[aria-label="Screenshot mode"]', (el) => el.click())
  await p.waitForTimeout(3000)
  if (s.probe || probe) console.log(s.name, 'start pose', JSON.stringify(await p.evaluate(() => window.__freeRig.current.cur)))
  // The clock is taken over from here: each frame poses the camera, advances one frame, draws.
  await p.evaluate(() => {
    let virt = performance.now()
    const q = []
    const raf = window.requestAnimationFrame
    performance.now = () => virt
    window.requestAnimationFrame = (f) => (q.push(f), q.length)
    window.__tick = (ms, pose) => {
      virt += ms
      const r = window.__freeRig.current
      r.swoop = null
      r.vel = { x: 0, z: 0, yaw: 0 }
      Object.assign(r.cur, pose)
      Object.assign(r.goal, pose)
      const run = q.splice(0)
      for (const f of run) f(virt)
    }
    void raf
  })
  if (probe) {
    for (const [i, pose] of [s.from, ...(s.poses ?? [])].entries()) {
      for (let k = 0; k < 6; k++) await p.evaluate(([ms, pose]) => window.__tick(ms, pose), [1000 / FPS, pose])
      await p.screenshot({ path: join(dir, `probe${i}.png`), timeout: 180000 })
    }
    await p.close()
    continue
  }
  const n = Math.round((s.dur ?? 3.4) * FPS)
  // A few frames to settle the pose before keeping any.
  for (let i = -8; i < n; i++) {
    const pose = lerp(s.from, s.to ?? s.from, ease(Math.max(0, i) / Math.max(1, n - 1)))
    await p.evaluate(([ms, pose]) => window.__tick(ms, pose), [1000 / FPS, pose])
    if (i >= 0) await p.screenshot({ path: join(dir, `f${String(i).padStart(4, '0')}.png`), timeout: 180000 })
  }
  if (!probe) writeFileSync(join(dir, 'done'), '')
  await p.close()
  console.log(s.name, n, 'frames', Math.round((Date.now() - t0) / 1000), 's')
}
await b.close()
