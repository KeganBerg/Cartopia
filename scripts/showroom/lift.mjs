// node scripts/showroom/lift.mjs <outDir>: close looks round the Showroom from the edge of where its camera can go.
import { chromium } from 'playwright'
const [, , out = 'showroom-out'] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const cars = [{ uid: 's1', model: 'stallion', color: '#1e88e5', upgrades: { engine: 1, turbo: 1, tires: 1, weight: 1 } }]
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('error', e.message))
await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
await p.goto('http://localhost:5173/?time=0.3')
await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
await p.waitForTimeout(2500)
await p.evaluate((cars) => { const g = window.__game; g.setState({ tutorial: 99, level: 20, cars, selectedCar: 's1', panel: null }); g.getState().openPanel('garage') }, cars)
await p.waitForSelector('.car-preview .stage-slot[data-ready="1"]', { timeout: 60000 }).catch(() => console.log('not ready'))
await p.evaluate(() => document.querySelector('.car-preview .cp-btn[aria-label="Full screen"]')?.click())
await p.waitForSelector('.car-inspect .stage-slot[data-ready="1"]', { timeout: 60000 }).catch(() => console.log('inspect not ready'))
await p.waitForTimeout(3000)
const fiber = await p.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('@react-three_fiber.js')))
// Each look: the camera at the edge of its reach, turned to face a point in the room (scene units, room turned 45°).
const looks = JSON.parse(process.env.LOOKS ?? '[[0,1.6,0,0,0.9,0]]')
for (const [i, [px, py, pz, ax, ay, az]] of looks.entries()) {
  await p.evaluate(async ([url, px, py, pz, ax, ay, az]) => {
    const { _roots } = await import(url)
    for (const r of _roots.values()) {
      const s = r.store.getState()
      if (!s.controls || !s.camera.isPerspectiveCamera) continue
      s.controls.enabled = false
      s.camera.position.set(px, py, pz)
      s.camera.lookAt(ax, ay, az)
      s.invalidate()
    }
  }, [fiber, px, py, pz, ax, ay, az])
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/look-${i}.png` })
  console.log('look', i)
}
await b.close()
