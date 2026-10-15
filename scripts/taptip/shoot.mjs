// node scripts/taptip/shoot.mjs <outDir>   (needs vite on :5173). Tap-to-explain bubbles on phone and desktop:
// the Garage car card's skill and loves pills, and a rival's skill icon in the Race menu.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'taptip-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const up = (n) => ({ engine: n, turbo: n, tires: n, weight: n })
const cars = [{ uid: 't1', model: 'trail', color: '#0d47a1', upgrades: up(2) }, { uid: 'z1', model: 'miata', color: '#d32f2f', upgrades: up(1) }]
for (const [form, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.addStyleTag({ content: '*{animation-duration:0s!important;transition:none!important}' })
  await p.evaluate((cars) => {
    const g = window.__game
    g.setState({ tutorial: 99, level: 20, cars, raceCar: 't1', selectedCar: 't1', panel: null })
    g.getState().openPanel('garage')
  }, cars)
  await p.waitForTimeout(4000)
  // Screenshots under swiftshader take longer than the bubble's 6 s auto-hide: pin a copy of it first.
  const pin = () => p.evaluate(() => {
    document.querySelectorAll('.tt-pinned').forEach((e) => e.remove())
    const t = document.querySelector('.tap-tip:not(.tt-pinned)')
    if (t) { const c = t.cloneNode(true); c.classList.add('tt-pinned'); document.body.append(c) }
  })
  const tap = (q) => (form === 'phone' ? p.locator(q).first().tap() : p.locator(q).first().click())
  await p.screenshot({ path: `${out}/${form}-1-card.png`, timeout: 90000 })
  await tap('.car-traits .skill-tag')
  await p.waitForTimeout(400)
  await pin()
  await p.screenshot({ path: `${out}/${form}-2-skill.png`, timeout: 90000 })
  await tap('.car-traits .loves-tag')
  await p.waitForTimeout(400)
  await pin()
  await p.screenshot({ path: `${out}/${form}-3-loves.png`, timeout: 90000 })
  await p.evaluate(async () => { document.querySelectorAll('.tt-pinned').forEach((e) => e.remove()); (await import('/src/ui/raceNav.ts')).openRaceTab('campaign') })
  await p.waitForSelector('.rm-row [data-skill]', { timeout: 60000 }).catch(() => {})
  await p.waitForTimeout(1500)
  const icon = p.locator('.rm-row [data-skill]').first()
  if (await icon.count()) {
    await icon.scrollIntoViewIfNeeded().catch(() => {})
    await (form === 'phone' ? icon.tap() : icon.click())
    await p.waitForTimeout(400)
    await pin()
    await p.screenshot({ path: `${out}/${form}-4-rival.png`, timeout: 90000 })
  } else console.log(form, 'no rival skill icon visible', await p.evaluate(() => [window.__game.getState().panel, document.querySelectorAll('[data-skill]').length]))
  await p.close()
}
await b.close()
