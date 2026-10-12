// Screenshots of the Garage's Custom tab with custom panel paint, on desktop and phone.
// node scripts/custom/shoot.mjs <outDir>   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'
const [, , out = 'custom-out'] = process.argv
const LOOKS = {
  camo: { body: { pattern: 'camo' }, hood: { color: '#212121' }, rims: { color: '#fdd835' } },
  twotone: { hood: { color: '#fafafa', pattern: 'checker' }, roof: { color: '#212121' }, doors: { color: '#fafafa' }, rims: { color: '#e53935' } },
  tiger: { body: { pattern: 'tiger' }, doors: { color: '#212121', pattern: 'carbon' } },
  digi: { body: { pattern: 'digicamo' }, roof: { color: '#fafafa' } },
}
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  for (const [name, panels] of Object.entries(LOOKS)) {
    const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
    p.on('pageerror', (e) => console.log('error', e.message))
    await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning', '1'))
    await p.goto('http://localhost:5173/?time=0.3&season=summer')
    await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
    await p.waitForTimeout(2500)
    await p.evaluate(([panels, color]) => {
      const g = window.__game
      const s = g.getState()
      const cars = s.cars.map((c, i) => (i === 0 ? { ...c, color, panels } : c))
      g.setState({ tutorial: 99, level: 12, coins: 50000, cars, selectedCar: cars[0].uid, panel: 'garage' })
    }, [panels, name === 'camo' ? '#43a047' : name === 'tiger' ? '#fb8c00' : name === 'digi' ? '#9e9e9e' : '#1e88e5'])
    await p.waitForTimeout(1500)
    await p.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.includes('Custom'))?.click())
    await p.waitForTimeout(4000)
    await p.screenshot({ path: `${out}/${form}-${name}.png` })
    console.log(form, name)
    await p.close()
  }
}
await b.close()
