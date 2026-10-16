// Renders the Car Packs menu in Chromium at phone and desktop sizes and fails if any car is cut
// off, runs out of its card, or covers its PI or gem badge, or the showcase's big PI number.
// It measures the car's real pixels (the thumb canvas), at a few points of its turn.
// node scripts/packs/check.mjs   (starts its own Vite dev server; CI runs it after the smoke test)
import { createServer } from 'vite'
import { chromium } from 'playwright'

const SIZES = [['phone', 390, 844], ['desktop', 1366, 900]]
const PORT = 5190
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const fails = []
const ground = []

// In the page: the box of the car's drawn pixels, in page coordinates, and whether it touches the
// canvas edge (cut off). Then each target with the boxes the car must stay inside and clear of.
const measure = (sel) => {
  const R = (el) => el && el.getBoundingClientRect().toJSON()
  const ink = (cv) => {
    if (!cv || !cv.width || !cv.height) return null
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      if (d[(y * cv.width + x) * 4 + 3] < 40) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    if (x1 < 0) return null
    const r = cv.getBoundingClientRect()
    const sx = r.width / cv.width, sy = r.height / cv.height
    return { left: r.left + x0 * sx, right: r.left + (x1 + 1) * sx, top: r.top + y0 * sy, bottom: r.top + (y1 + 1) * sy, cut: x0 <= 0 || y0 <= 0 || x1 >= cv.width - 1 || y1 >= cv.height - 1 }
  }
  const el = document.querySelector(sel)
  if (!el) return null
  if (el.classList.contains('pk-card'))
    return { name: el.querySelector('.pk-name').textContent, stage: R(el.querySelector('.pk-stage')), car: ink(el.querySelector('.pk-car canvas')),
      avoid: { 'PI badge': R(el.querySelector('.pk-pi')), 'gem badge': R(el.querySelector('.pk-gems')) } }
  const hero = el.closest('.pk-hero')
  return { name: hero.querySelector('.pk-hero-name').textContent, stage: R(hero.querySelector('.pk-stage')), car: ink(hero.querySelector('.pk-swap.on canvas')),
    avoid: { 'big PI number': R(hero.querySelector('.pk-bignum')), 'gem badge': R(hero.querySelector('.pk-hero-info .pk-gems')), 'buy button': R(hero.querySelector('.pk-buy')) } }
}

const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1

function judge(size, sel, m) {
  const where = `${size} ${sel.startsWith('.pk-hero') ? 'showcase' : 'card'} ${m.name}`
  if (!m.car) return fails.push(`${where}: the car never drew`)
  if (m.car.cut) fails.push(`${where}: the car is cut off by its preview`)
  const s = m.stage
  const px = (n) => Math.round(n)
  if (m.car.left < s.left - 1 || m.car.right > s.right + 1 || m.car.top < s.top - 1 || m.car.bottom > s.bottom + 1)
    fails.push(`${where}: the car (${px(m.car.left)},${px(m.car.top)} to ${px(m.car.right)},${px(m.car.bottom)}) runs out of its stage (${px(s.left)},${px(s.top)} to ${px(s.right)},${px(s.bottom)})`)
  for (const [what, r] of Object.entries(m.avoid)) if (r && overlap(m.car, r)) fails.push(`${where}: the car covers the ${what}`)
  if ((m.car.right - m.car.left) / (s.right - s.left) < 0.45) fails.push(`${where}: the car is drawn too small`)
}

// Waits (up to 30 s) for a car's thumb to have something drawn in it.
const drawn = (page, sel) => page.waitForFunction((s) => {
  const c = document.querySelector(`${s} canvas`)
  return c && c.width > 0 && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 40)
}, sel, { timeout: 30000 }).catch(() => {})

async function sample(page, sel, n) {
  for (let i = 0; i < n; i++) {
    if (i) await page.waitForTimeout(2600)
    const m = await page.evaluate(measure, sel)
    judge(page.size, sel, m)
    if (m?.car && sel.startsWith('.pk-card')) ground.push([page.size, sel.includes('four') ? 'top' : 'street', m.name, m.stage.bottom - m.car.bottom])
  }
}

try {
  for (const [size, width, height] of SIZES) {
    const page = await browser.newPage({ viewport: { width, height } })
    page.size = size
    page.on('pageerror', (e) => fails.push(`${size}: page error ${e.message}`))
    await page.goto(`http://localhost:${PORT}/scripts/packs/index.html`)
    await page.waitForSelector('.pk-card', { timeout: 60000 })
    const cards = await page.$$eval('.pk-grid', (gs) => gs.map((g) => [g.classList.contains('four') ? 'four' : 'three', g.children.length]))
    for (const [cls, count] of cards) for (let ci = 0; ci < count; ci++) {
      const sel = `.pk-grid.${cls} .pk-card:nth-child(${ci + 1})`
      await page.locator(sel).scrollIntoViewIfNeeded()
      await drawn(page, sel)
      await sample(page, sel, 3)
    }
    // The showcase: every car in turn, by its dot.
    await page.locator('.pk-hero').scrollIntoViewIfNeeded()
    const dots = await page.$$('.pk-dots button')
    for (const dot of dots) {
      await dot.click()
      await page.waitForTimeout(900)
      await drawn(page, '.pk-hero .pk-swap.on')
      await sample(page, '.pk-hero .pk-swap.on', 2)
    }
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}

// Every card in a row stands its car on the same ground line.
for (const size of SIZES.map(([s]) => s)) for (const row of ['top', 'street']) {
  const gaps = ground.filter((g) => g[0] === size && g[1] === row).map((g) => g[3])
  if (gaps.length && Math.max(...gaps) - Math.min(...gaps) > 14) fails.push(`${size} ${row} row: cars stand on different ground lines (${Math.min(...gaps).toFixed(0)}-${Math.max(...gaps).toFixed(0)}px)`)
}
if (fails.length) {
  console.error(`Car Packs layout check failed:\n${[...new Set(fails)].join('\n')}`)
  process.exit(1)
}
console.log(`packs: every car fits its card and clears its badges at ${SIZES.map(([s]) => s).join(' and ')} size`)
