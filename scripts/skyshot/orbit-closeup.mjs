// Free camera close-ups of one building at a level: CLOSE=def:level:x:z node orbit-closeup.mjs outDir
import { chromium } from 'playwright'
const out = process.argv[2]
const [def, lvl, tx, tz] = (process.env.CLOSE ?? 'rescue:7:12:12').split(':')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
p.on('pageerror', (e) => console.log('error', e.message))
await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1') })
await p.goto('http://localhost:5173/?time=0.45')
await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
await p.waitForTimeout(2500)
await p.evaluate(([def, lvl, tx, tz]) => {
  const g = window.__game
  const keep = g.getState().buildings.filter((x) => x.def !== def)
  g.setState({ tutorial: 99, level: 30, panel: null, buildings: [...keep, { uid: 'shot', def, x: +tx, z: +tz, jobEndsAt: null, level: +lvl }] })
}, [def, lvl, tx, tz])
await p.waitForTimeout(3000)
await p.evaluate(() => window.__game.setState({ panel: null }))
await p.evaluate(() => document.querySelector('[aria-label="Free camera"]').click())
await p.waitForTimeout(4000)
const poses = JSON.parse(process.env.POSES ?? '[]')
for (const [i, pose] of poses.entries()) {
  await p.evaluate((pose) => { window.__game.setState({ panel: null }); const r = window.__freeRig.current; r.swoop = null; Object.assign(r.goal, pose); Object.assign(r.cur, r.goal) }, pose)
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${out}/${def}-${lvl}-${i}.png` })
  console.log('shot', i, JSON.stringify(pose))
}
await b.close()
