// node scripts/clubshot/game.mjs <outDir> [tag]   (vite dev on :5173). The real game at night:
// a club in the start town, people queueing, the bouncer and dancers, on desktop and phone.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'clubgame-out', tag = 'after'] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto(`http://localhost:5173/?time=0.5&season=summer&weather=clear`)
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(5000)
  const at = await p.evaluate(() => {
    const g = window.__game
    g.setState({ tutorial: 99, level: 30, coins: 1e9, bucks: 1e6, panel: null })
    // On the cross street (road row z = 11), its door facing the road, with homes across it.
    for (let x = 12; x < 17; x++) g.getState().placeBuilding('house', x, 12, 2)
    for (let x = 5; x < 9; x++) g.getState().placeBuilding('house', x, 12, 2)
    for (let x = 8; x < 16; x++) {
      if (g.getState().placeBuilding('club', x, 10, 0)) return { x, z: 10, rot: 0, uid: g.getState().buildings.find((o) => o.def === 'club').uid }
    }
    return null
  })
  console.log(form, 'club at', JSON.stringify(at))
  await p.evaluate(() => window.__game.setState({ mode: 'view', placing: null, panel: null }))
  // Level it up so the roof has a full dance floor.
  await p.evaluate((uid) => {
    const s = window.__game.getState()
    window.__game.setState({ buildings: s.buildings.map((o) => (o.uid === uid ? { ...o, level: 7 } : o)) })
  }, at.uid)
  await p.evaluate(async (at) => {
    const { VIEW } = await import('/src/scene/freeCam.ts')
    const { toWorld } = await import('/src/scene/grid.ts')
    const [a] = [toWorld(at.x, at.z)]
    const [b] = [toWorld(at.x + 1, at.z)]
    VIEW.set((a[0] + b[0]) / 2, VIEW.y, a[1] + 0.6)
  }, at)
  // Give the townspeople time to walk over and queue.
  // Send everyone out now rather than after their evening in, until a few are queueing.
  for (let i = 0; i < 90; i++) {
    const n = await p.evaluate(() => {
      const all = window.__people?.current ?? []
      for (const q of all) if (q.state === 'inside' && q.dest?.kind !== 'door' && q.timer > 0.6 && q.type === 'walker') q.timer = 0.3
      // Headless frames are slow: skip anyone heading for the club to the last stretch of their walk.
      for (const q of all) {
        if (q.state !== 'walk' || q.dest?.kind !== 'club' || q.crossing || q.si >= q.steps.length - 2) continue
        q.si = q.steps.length - 2
        q.pos[0] = q.steps[q.si].p[0]
        q.pos[1] = q.steps[q.si].p[1]
      }
      return all.filter((q) => q.state === 'queue' && q.face !== null).length
    })
    if (n >= 3) break
    await p.waitForTimeout(2000)
  }
  console.log(form, JSON.stringify(await p.evaluate(() => (window.__people?.current ?? []).filter((q) => q.state !== 'inside').map((q) => q.state + ':' + (q.dest?.kind ?? '')))))
  await p.evaluate(() => window.__game.setState({ panel: null }))
  await p.screenshot({ path: `${out}/${tag}-${form}-1-town.png` })
  // Street-level free camera on the door, then on the roof.
  await p.evaluate(async () => {
    const { setFreeCam } = await import('/src/scene/freeCam.ts')
    setFreeCam(true)
  })
  await p.waitForTimeout(2500)
  const pose = async (dx, dz, yaw, pitch, dist) => {
    await p.evaluate(async ([at, dx, dz, yaw, pitch, dist]) => {
      const { toWorld } = await import('/src/scene/grid.ts')
      const a = toWorld(at.x, at.z)
      const b = toWorld(at.x + 1, at.z)
      const r = window.__freeRig.current
      const to = { x: (a[0] + b[0]) / 2 + dx, z: a[1] + dz, yaw, pitch, dist }
      r.swoop = null
      Object.assign(r.goal, to)
      Object.assign(r.cur, to)
    }, [at, dx, dz, yaw, pitch, dist])
    await p.waitForTimeout(1500)
  }
  await pose(-0.9, 0.6, 0.35, 1.2, 5)
  await p.screenshot({ path: `${out}/${tag}-${form}-2-door.png` })
  await p.evaluate(async () => {
    const { clubDoors } = await import('/src/scene/clubDoor.ts')
    for (const d of clubDoors.values()) d.admitted = performance.now() / 1000
  }).catch(() => {})
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${out}/${tag}-${form}-3-wave.png` })
  await pose(0, -0.3, 0.5, 0.55, 9)
  await p.screenshot({ path: `${out}/${tag}-${form}-4-roof.png` })
  console.log(form, JSON.stringify(await p.evaluate(async () => {
    const { clubDoors } = await import('/src/scene/clubDoor.ts').catch(() => ({ clubDoors: new Map() }))
    return [...clubDoors.values()]
  })))
  await p.close()
}
await b.close()
