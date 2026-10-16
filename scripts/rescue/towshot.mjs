// A flat tire fixed by Rusty's tow, in the real town: the car is hitched, dropped at Rusty's
// curb, unhooked, then drives off. Prints its state as it goes and shoots each step.
// node scripts/rescue/towshot.mjs <outDir>   (needs `npm run dev` on :5173 and Playwright)
import { chromium } from 'playwright'
const [, , out = 'rescue-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
  await p.goto('http://localhost:5173/?time=0.3&season=summer')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  // Rusty's Rescue on the main street, and the first car with a flat.
  const uid = await p.evaluate(() => {
    const g = window.__game
    const s = g.getState()
    const uid = s.cars[0].uid
    g.setState({ tutorial: 99, level: 12, buildings: [...s.buildings, { uid: 'rr', def: 'rescue', x: 12, z: 12, jobEndsAt: null, level: 1 }], cars: s.cars.map((c) => (c.uid === uid ? { ...c, flat: true } : c)), panel: null })
    return uid
  })
  const state = () => p.evaluate(async (uid) => {
    const { liveTraffic } = await import('/src/scene/traffic/live.ts')
    const a = liveTraffic.agents.get(uid)
    return a && { tow: a.tow, truck: +a.truck.toFixed(2), parked: +a.parked.toFixed(1), at: a.parkedAt?.stopKind ?? null, trip: a.trip?.stop.def ?? null, x: +a.x.toFixed(1), z: +a.z.toFixed(1), odo: +a.odo.toFixed(1) }
  }, uid)
  await p.waitForTimeout(6000)
  console.log(form, 'flat', JSON.stringify(await state()))
  await p.evaluate((uid) => window.__game.getState().fixFlat(uid, true), uid)
  const shot = { towing: false, dropped: false, away: false }
  let freeOdo = null
  // Swiftshader draws a few frames a second, so the town's own clock crawls: run its traffic
  // a couple of seconds ahead each step (same sim, same rules), then let it draw.
  for (let i = 0; i < 90; i++) {
    await p.evaluate(async () => {
      const { liveTraffic } = await import('/src/scene/traffic/live.ts')
      for (let k = 0; k < 20; k++) liveTraffic.step(0.1)
    })
    await p.waitForTimeout(400)
    const st = await state()
    if (i % 5 === 0) console.log(form, `${i * 2}s`, JSON.stringify(st))
    if (!st) continue
    if (!shot.towing && st.tow === 2 && st.truck === 1 && !st.parked) {
      shot.towing = true
      await p.screenshot({ path: `${out}/${form}-1-towing.png`, timeout: 180000 })
    }
    if (!shot.dropped && st.at === 'tow' && st.parked) {
      shot.dropped = true
      console.log(form, 'dropped at', st.trip, JSON.stringify(st))
      await p.screenshot({ path: `${out}/${form}-2-dropped.png`, timeout: 180000 })
    }
    if (shot.dropped && !st.tow && freeOdo === null) freeOdo = st.odo
    if (freeOdo !== null && st.odo > freeOdo + 1.5) {
      console.log(form, 'drove off', JSON.stringify(st))
      await p.screenshot({ path: `${out}/${form}-3-away.png`, timeout: 180000 })
      shot.away = true
      break
    }
  }
  console.log(form, JSON.stringify(shot))
  await p.close()
}
await b.close()
