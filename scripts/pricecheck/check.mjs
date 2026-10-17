// Every price shows whole (Kegan 10-17: "Buy · $1,5…" on the car parts shop). Opens each shop at
// phone and desktop width in a mid-game town and fails if any price is cut off: a button, pill or
// label holding a $ / 💎 / ⚙ amount whose text is wider than its box, or that spills outside it.
// node scripts/pricecheck/check.mjs [outDir]   (needs `npx vite` on :5173; outDir keeps screenshots)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const [, , out] = process.argv
if (out) mkdirSync(out, { recursive: true })
const SCREENS = [
  ['shop', 'Car shops'], ['shop', 'Businesses'], ['shop', 'Homes'], ['shop', 'Services'], ['shop', 'Rec'], ['shop', 'Upgrades'],
  ['garage', null, 'Upgrades'], ['garage', null, 'Mods'], ['garage', null, 'Paint'], ['garage', null, 'Custom'], ['garage', null, 'Trim'], ['garage', null, 'Hats'],
  ['showroom', 'For Sale'], ['showroom', 'Call Cards'], ['crates'], ['carpacks'], ['bank'],
]
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const bad = []
for (const [form, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.5&season=summer')
  await p.waitForFunction(() => window.__game, null, { timeout: 180000 })
  await p.waitForTimeout(3000)
  // A level 30 town with a few cars, so most prices are big ones.
  await p.evaluate(async () => {
    const d = await import('/src/game/data.ts')
    const z = { engine: 1, turbo: 0, tires: 0, weight: 0 }
    const cars = d.CARS.filter((c) => !c.parked).slice(5, 10).map((c, i) => ({ uid: `pc${i}`, model: c.id, color: c.colors[0], upgrades: z }))
    window.__game.setState({ tutorial: 99, level: 30, coins: 9000, parts: 5, bucks: 20, panel: null, cars: [...cars, ...window.__game.getState().cars] })
  })
  for (const [panel, tab, sub] of SCREENS) {
    await p.evaluate(() => window.__game.setState({ panel: null }))
    await p.waitForTimeout(300)
    await p.evaluate((id) => window.__game.getState().openPanel(id), panel)
    await p.waitForSelector('.panel', { timeout: 30000 }).catch(() => {})
    await p.waitForTimeout(1500)
    const click = (sel, t) => p.evaluate(([sel, t]) => [...document.querySelectorAll(sel)].find((el) => el.textContent.includes(t))?.click(), [sel, t])
    if (tab) await click('[role=tab], .sheet-tabs button', tab)
    if (sub) await click('.garage-tabs button', sub)
    await p.waitForTimeout(1500)
    const name = [form, panel, tab, sub].filter(Boolean).join(' ')
    const found = await p.evaluate(() => {
      const money = /[$💎⚙]\s?[\d,.]+[KMB]?|[\d,.]+[KMB]?\s?[⚙💎]/
      const hits = []
      for (const el of document.querySelectorAll('.panel button, .panel .price, .panel [class*="price"], .panel [class*="cost"]')) {
        const text = el.textContent.trim()
        if (!money.test(text) || !el.getClientRects().length) continue
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        // Wider than its own box (clipped or "..."), or its inline text runs past the box.
        const over = el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible'
        const range = document.createRange()
        range.selectNodeContents(el)
        const tr = range.getBoundingClientRect()
        const spill = tr.width > 0 && (tr.right > r.right + 1 || tr.left < r.left - 1)
        if (over || spill || (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1)) hits.push(`${text} (${Math.round(r.width)}px box, ${Math.round(Math.max(el.scrollWidth, tr.width))}px text)`)
      }
      return hits
    })
    for (const f of found) bad.push(`${name}: ${f}`)
    console.log(`${found.length ? '✗' : '✓'} ${name}${found.length ? `: ${found.length} cut off` : ''}`)
    if (out) await p.screenshot({ path: `${out}/${name.replace(/\W+/g, '-')}.png` })
  }
  await p.close()
}
await b.close()
if (bad.length) {
  console.log(`\n${bad.length} prices cut off:\n${bad.join('\n')}`)
  process.exit(1)
}
console.log('\nEvery price shows whole.')
