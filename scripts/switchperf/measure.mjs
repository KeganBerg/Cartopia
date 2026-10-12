// Main-thread stall when a different account's town is swapped in before the reload.
// Builds town A, then runs what sign-in did with town B and reports the longest frame gap.
// [MODE=old|new] [N=10] node scripts/switchperf/measure.mjs   (needs `npm run dev`)
import { chromium } from 'playwright'
const N = Number(process.env.N ?? 10)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 240, height: 160 } })
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto('http://localhost:5173/?time=0.2&season=summer&fx=low')
await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
const town = (N, defs, prefix) => {
  const roads = [], buildings = []
  let i = 0
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
    if (z % 3 === 0) roads.push(`${x},${z}`)
    else buildings.push({ uid: `${prefix}${i}`, def: defs[i++ % defs.length], x, z, rot: z % 3 === 1 ? 2 : 0 })
  }
  return { roads, buildings }
}
const A = town(N, ['pizza', 'donut', 'burger', 'icecream', 'coffee'], 'a')
const B = town(N, ['tacos', 'lube', 'arcade', 'tires', 'coffee'], 'b')
await p.evaluate((A) => window.__game.setState({ tutorial: 99, level: 30, ...A, panel: null, updatedAt: Date.now() }), A)
await p.waitForTimeout(Number(process.env.SETTLE ?? 15000))
const r = await p.evaluate(({ B, mode }) => new Promise((done) => {
  const g = window.__game
  const tasks = []
  new PerformanceObserver((l) => tasks.push(...l.getEntries().map((e) => e.duration))).observe({ type: 'longtask' })
  setTimeout(() => {
    const save = { ...g.getState(), ...B, townName: 'Other Account', updatedAt: Date.now() }
    if (mode === 'old') g.getState().loadSave(save)
    else if (mode === 'new') localStorage.setItem('cartopia-save', JSON.stringify({ state: save, version: 0 }))
    tasks.length = 0
    setTimeout(() => done({ busyMs: Math.round(tasks.reduce((a, b) => a + b, 0)), longest: Math.round(Math.max(0, ...tasks)) }), 8000)
  }, 500)
}), { B, mode: process.env.MODE ?? 'old' })
console.log(process.env.MODE ?? 'old', JSON.stringify(r))
await b.close()
