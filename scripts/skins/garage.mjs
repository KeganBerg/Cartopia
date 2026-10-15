// The Garage with a skinned, kitted car, on desktop and phone.
// node scripts/skins/garage.mjs <outDir> [skin] [model]   (needs `npm run dev` on :5173)
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'garage-out', skin = 'riptide', model = ''] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=summer')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(([skin, model]) => {
    const g = window.__game
    const s = g.getState()
    const car = { ...s.cars[0], skin, color: '#fdd835', mods: ['streetkit', 'ramscoop'], ...(model ? { model } : {}) }
    g.setState({ tutorial: 99, level: 20, cars: [car, ...s.cars.slice(1)], selectedCar: car.uid, panel: 'garage' })
  }, [skin, model])
  await p.waitForTimeout(9000)
  await p.screenshot({ path: `${out}/${form}-garage-${skin}.png` })
  console.log(form)
  await p.close()
}
await b.close()
