// node scripts/timetrial/shoot.mjs <outDir> [port]   (needs vite running). The Weekly Time Trial
// screen (podium, board), a player's profile opened from their name, and Visit, on phone and desktop.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'timetrial-out', port = '5173'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const up = (n) => ({ engine: n, turbo: n, tires: n, weight: n })
const cars = [{ uid: 't1', model: 'trail', color: '#0d47a1', upgrades: up(3) }, { uid: 'z1', model: 'miata', color: '#d32f2f', upgrades: up(1) }]
const monday = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10) }
for (const [form, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]].filter(([f]) => !process.env.ONLY || f === process.env.ONLY)) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript((w) => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-trial-best', JSON.stringify({ week: w, t: 7.312 })) }, monday())
  await p.goto(`http://localhost:${port}/?time=0.3&season=fall`)
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.addStyleTag({ content: '*{animation-duration:0s!important;transition:none!important}' })
  await p.evaluate((cars) => {
    const g = window.__game
    g.setState({ tutorial: 99, level: 30, cars, raceCar: 't1', selectedCar: 't1', panel: null })
    g.getState().openPanel('race')
  }, cars)
  // A DOM click: swiftshader frames are slow enough that playwright's own click waits out its timeout.
  const tap = (l) => l.evaluate((e) => e.click())
  await p.waitForSelector('.rm-tile.rm-trial', { timeout: 60000 })
  await tap(p.locator('.rm-tile.rm-trial'))
  await p.waitForTimeout(12000)
  await p.screenshot({ path: `${out}/${form}-1-trial.png`, timeout: 90000 })
  if (process.env.BEFORE) { await p.close(); continue }
  // The #1 car on the podium opens its owner's profile too.
  const box = await p.locator('.ttr-stage').boundingBox()
  await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * (form === 'phone' ? 0.52 : 0.5), { noWaitAfter: true, timeout: 60000 }).catch((e) => console.log('podium click', e.message.split('\n')[0]))
  await p.waitForTimeout(4000)
  console.log(form, 'podium tap opens', await p.evaluate(() => document.querySelector('.pc-card h2')?.textContent ?? 'nothing'))
  if (await p.locator('.pc-card').count()) await tap(p.locator('.pc-card .close'))
  await tap(p.locator('.ttr-row').nth(1))
  await p.waitForSelector('.pc-card .pc-stats', { timeout: 30000 })
  await p.waitForTimeout(5000)
  await p.screenshot({ path: `${out}/${form}-2-profile.png`, timeout: 90000 })
  await tap(p.locator('.pc-visit'))
  await p.waitForTimeout(6000)
  await p.screenshot({ path: `${out}/${form}-3-visit.png`, timeout: 90000 })
  console.log(form, await p.evaluate(() => [window.__game.getState().panel, window.__game.getState().visiting?.townName]))
  await p.close()
}
await b.close()
