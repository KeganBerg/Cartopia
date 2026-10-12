// Real game screenshots of one car: the garage on a phone and a desktop, and the town with
// the car parked and driving. node scripts/carscan/ingame.mjs outDir [model] [color] [port] [tag]
// (needs `npm run dev`). The save is staged: level 40, a small town, the car owned and picked.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const { chromium } = createRequire(process.env.PW_FROM ?? '/opt/node-tools/node_modules/')('playwright')
const [, , out = 'scan-ingame', model = 'current', color = '#eceff1', port = '5173', tag = ''] = process.argv
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

const town = () => {
  let n = 0
  const bl = []
  const B = (def, x, z, level = 1) => bl.push({ uid: 'b' + n++, def, x, z, jobEndsAt: null, level })
  const roads = new Set()
  for (let i = 6; i <= 17; i++) for (const k of [`${i},8`, `${i},14`, `8,${i}`, `15,${i}`]) roads.add(k)
  B('rescue', 9, 9, 6); B('gas', 11, 9, 6); B('diner', 13, 9, 6); B('showroom', 9, 12); B('garage', 11, 12); B('club', 13, 12, 6)
  B('tree', 9, 15); B('lamp', 10, 15); B('house', 11, 15, 2); B('house', 12, 15, 3); B('tree', 13, 15); B('palm', 14, 15)
  B('house', 9, 7, 2); B('tree', 10, 7); B('house', 11, 7, 1); B('flowers', 12, 7); B('house', 13, 7, 3); B('tree', 14, 7)
  const up = { engine: 0, turbo: 0, tires: 0, weight: 0 }
  const cars = [model, model, model].map((m, i) => ({ uid: 'c' + i, model: m, color: [color, '#b71c1c', '#263238'][i], finish: 'metallic', upgrades: up }))
  return { buildings: bl, roads: [...roads], cars }
}

const shots = [
  { name: 'garage-phone', w: 390, h: 844, garage: true },
  { name: 'garage-desktop', w: 1440, h: 900, garage: true },
  { name: 'town-phone', w: 390, h: 844 },
  { name: 'town-desktop', w: 1440, h: 900 },
]
for (const s of shots) {
  const ctx = await b.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.w < 500 ? 2 : 1, isMobile: s.w < 500, hasTouch: s.w < 500 })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(([t]) => {
    localStorage.setItem('cartopia-save', JSON.stringify({ state: { version: 1, townName: 'Sunny Hollow', level: 40, xp: 0, coins: 99999, bucks: 500, parts: 500, fuel: 99, fuelUpdatedAt: Date.now(), trophies: 300, racesWon: 50, tutorial: 99, ...t, updatedAt: Date.now() }, version: 0 }))
  }, [town()])
  await p.goto(`http://localhost:${port}/?nosplash&time=0.08&season=summer&weather=clear`)
  await p.waitForSelector('canvas', { timeout: 90000 })
  await p.waitForTimeout(8000)
  // Clear the first-run popups: the flashing-lights notice, then any open panel.
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => {
      const ok = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^\s*Got it\s*$/.test(e.textContent ?? ''))
      if (ok) return ok.click()
      ;[...document.querySelectorAll('button[aria-label="Close"]')].forEach((e) => e.offsetParent && e.click())
    })
    await p.waitForTimeout(800)
  }
  if (s.garage) {
    // Desktop has a My Cars button up top; phones go through the Cars tab to My Cars.
    await p.evaluate(() => {
      const vis = [...document.querySelectorAll('button')].filter((e) => e.offsetParent)
      const top = vis.find((e) => e.classList.contains('my-cars'))
      if (top) return top.click()
      vis.find((e) => /^\s*CARS\s*$/i.test(e.textContent ?? ''))?.click()
    })
    await p.waitForTimeout(1500)
    await p.evaluate(() => [...document.querySelectorAll('button')].find((e) => e.offsetParent && /My Cars/.test(e.textContent ?? ''))?.click())
    await p.waitForTimeout(6000)
  } else {
    // Zoom in on the town street.
    await p.mouse.move(s.w / 2, s.h / 2)
    for (let i = 0; i < 14; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(80) }
    await p.waitForTimeout(6000)
  }
  await p.evaluate(() => {
    for (const e of document.querySelectorAll('button')) if (e.offsetParent && /^\s*Got it\s*$/.test(e.textContent ?? '')) e.click()
  })
  await p.screenshot({ path: `${out}/${s.name}${tag}.png`, timeout: 120000 })
  console.log(s.name)
  await ctx.close()
}
await b.close()
