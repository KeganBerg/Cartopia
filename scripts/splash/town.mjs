// Renders the loading screen's town backdrops from the real game into public/splash/.
// node scripts/splash/town.mjs [only]   (needs `npm run dev` on :5173 and Playwright)
// `node scripts/splash/town.mjs lqip` only remakes the inline thumbnails (lqip.json).
// The same staged town as the link-preview cards: a full Main Street, parks and
// suburbs, seen from the game camera, one picture per season and time of day.
import { chromium } from 'playwright'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const [, , only] = process.argv
const W = 1600, H = 1200
const out = new URL('../../public/splash/', import.meta.url)
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

const times = { day: 0.08, dusk: 0.3, night: 0.5 }
for (const season of ['spring', 'summer', 'fall', 'winter'])
  for (const [tod, time] of Object.entries(times)) {
    const name = `town-${season}-${tod}`
    if (only && !name.startsWith(only)) continue
    const ctx = await b.newContext({ viewport: { width: W, height: H } })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => console.log('error', e.message))
    await p.addInitScript(([t]) => {
      localStorage.setItem('cartopia-save', JSON.stringify({ state: { version: 1, townName: 'Sunny Hollow', level: 40, xp: 0, coins: 99999, bucks: 500, parts: 500, fuel: 99, fuelUpdatedAt: Date.now(), trophies: 300, racesWon: 50, tutorial: 99, ...t, updatedAt: Date.now() }, version: 0 }))
    }, [town()])
    await p.goto(`http://localhost:5173/?nosplash&time=${time}&season=${season}&weather=clear`)
    await p.waitForSelector('canvas', { timeout: 90000 })
    await p.addStyleTag({ content: 'body > #root > *:not(:has(canvas)), #root [class]:not(:has(canvas)):not(canvas) { visibility: hidden !important }' })
    // A little closer than the default camera, like the share cards.
    await p.mouse.move(W / 2, H / 2)
    for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(80) }
    await p.waitForTimeout(14000)
    const png = await p.screenshot({ timeout: 180000 })
    // Re-encode as WebP in the page; Playwright only writes PNG and JPEG.
    const data = await p.evaluate(async (src) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      c.getContext('2d').drawImage(img, 0, 0)
      return c.toDataURL('image/webp', 0.72)
    }, 'data:image/png;base64,' + png.toString('base64'))
    writeFileSync(new URL(`${name}.webp`, out), Buffer.from(data.split(',')[1], 'base64'))
    console.log(name, Math.round((data.length * 3) / 4 / 1024), 'KB')
    await ctx.close()
  }

// A 40px-wide blurred thumbnail of each, inlined into the splash by build.mjs.
const lp = await b.newPage()
const lqip = {}
for (const f of readdirSync(out).filter((f) => /^town-.*\.webp$/.test(f)).sort()) {
  lqip[f.slice(5, -5)] = await lp.evaluate(async (src) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 40
    c.height = 30
    c.getContext('2d').drawImage(img, 0, 0, 40, 30)
    return c.toDataURL('image/webp', 0.5)
  }, 'data:image/webp;base64,' + readFileSync(new URL(f, out)).toString('base64'))
}
writeFileSync(new URL('lqip.json', import.meta.url), JSON.stringify(lqip, null, 1) + '\n')
console.log('lqip', Object.keys(lqip).length)
await b.close()
