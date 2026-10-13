// Real game screenshots of resto-mod pieces: the Diamond crate's piece odds, a piece reveal, a
// fourth piece building its car, and the Collection's Resto Garage set, on a phone and a desktop.
// node scripts/resto/shots.mjs outDir [port]   (needs `npm run dev`)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const { chromium } = createRequire(process.env.PW_FROM ?? '/opt/node-tools/node_modules/')('playwright')
const [, , out = 'resto-shots', port = '5173'] = process.argv
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

const up = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const save = (restoParts, cars = []) => ({
  version: 1, townName: 'Sunny Hollow', level: 20, xp: 0, coins: 99999, bucks: 500, parts: 500, fuel: 99, fuelUpdatedAt: Date.now(), trophies: 300, racesWon: 50, tutorial: 99,
  buildings: [{ uid: 'b0', def: 'rescue', x: 9, z: 9, jobEndsAt: null, level: 2 }, { uid: 'b1', def: 'garage', x: 11, z: 9, jobEndsAt: null, level: 1 }],
  roads: ['8,8', '9,8', '10,8', '11,8', '12,8'],
  cars: [{ uid: 'c0', model: 'civic', color: '#1e88e5', upgrades: up }, ...cars],
  restoParts, updatedAt: Date.now(),
})
const shots = [
  { name: 'odds', parts: ['sprint:0', 'sprint:2', 'revenant:1', 'pontone:0', 'pontone:1'], odds: true },
  { name: 'piece', parts: ['sprint:0', 'revenant:1', 'pontone:0', 'pontone:1'], open: true },
  { name: 'built', parts: ['pontone:0', 'pontone:1', 'pontone:2'], open: true },
  { name: 'book', parts: ['sprint:0', 'sprint:2', 'revenant:1', 'revenant:2', 'revenant:3'], book: true, cars: [{ uid: 'c9', model: 'pontone', color: '#b71c1c', upgrades: up }] },
]
const sizes = [{ tag: 'phone', w: 390, h: 844 }, { tag: 'desktop', w: 1440, h: 900 }]
const click = (p, re) => p.evaluate((src) => {
  const r = new RegExp(src)
  const el = [...document.querySelectorAll('button')].find((e) => e.offsetParent && r.test(e.textContent ?? ''))
  el?.click()
  return !!el
}, re.source)

for (const s of shots) for (const z of sizes) {
  const ctx = await b.newContext({ viewport: { width: z.w, height: z.h }, deviceScaleFactor: z.w < 500 ? 2 : 1, isMobile: z.w < 500, hasTouch: z.w < 500 })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(([st]) => {
    localStorage.setItem('cartopia-save', JSON.stringify({ state: st, version: 0 }))
    localStorage.setItem('cartopia-crate', 'diamond')
  }, [save(s.parts, s.cars)])
  await p.goto(`http://localhost:${port}/?nosplash&time=0.08&season=summer&weather=clear`)
  await p.waitForSelector('canvas', { timeout: 90000 })
  await p.waitForTimeout(7000)
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => {
      const ok = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^\s*Got it\s*$/.test(e.textContent ?? ''))
      if (ok) return ok.click()
      ;[...document.querySelectorAll('button[aria-label="Close"]')].forEach((e) => e.offsetParent && e.click())
    })
    await p.waitForTimeout(700)
  }
  await click(p, /^\s*CARS\s*$/i)
  await p.waitForTimeout(1200)
  await click(p, s.book ? /Collection/ : /Crates/)
  await p.waitForTimeout(12000)
  if (s.odds) {
    await click(p, /🧩/)
    await p.waitForTimeout(3000)
  }
  if (s.open) {
    // Pick the last slice (a piece), the last car in reach (Pontone) and its last piece.
    await p.evaluate(() => {
      const real = Math.random
      Math.random = () => 0.9999
      setTimeout(() => { Math.random = real }, 400)
      ;[...document.querySelectorAll('button')].find((e) => e.offsetParent && e.classList.contains('crate-open'))?.click()
    })
    await p.waitForTimeout(9000)
  }
  if (s.book) {
    await p.evaluate(() => [...document.querySelectorAll('.book-set')].find((e) => /Resto Garage/.test(e.textContent ?? ''))?.scrollIntoView({ block: 'center' }))
    await p.waitForTimeout(4000)
  }
  await p.screenshot({ path: `${out}/${s.name}-${z.tag}.png`, timeout: 120000 })
  console.log(s.name, z.tag)
  await ctx.close()
}
await b.close()
