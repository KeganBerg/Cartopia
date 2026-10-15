// node scripts/taptip/barn.mjs <outDir>   (needs vite on :5173). The barn-find badge over Rusty's, phone and desktop.
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'barn-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall&visitor=barn')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.addStyleTag({ content: '*{animation-duration:0s!important;transition:none!important}' })
  await p.evaluate(() => { const g = window.__game; const s = g.getState(); g.setState({ tutorial: 99, level: 10, panel: null, buildings: s.buildings.some((x) => x.def === 'rescue') ? s.buildings : [...s.buildings, { uid: 'rusty', def: 'rescue', x: 12, z: 12, jobEndsAt: null }] }) })
  await p.evaluate(async () => (await import('/src/lib/visitors.ts')).forceVisitor('barn'))
  await p.waitForSelector('.badge-visitor-barn', { timeout: 60000 }).catch(() => console.log(form, 'no barn badge'))
  await p.waitForTimeout(3000)
  console.log(form, await p.evaluate(() => { const g = window.__game; g.setState({ panel: null }); return [g.getState().buildings.some((x) => x.def === 'rescue'), !!document.querySelector('.badge-visitor-barn')] }))
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-barn.png`, timeout: 90000 })
  await p.locator('.badge-visitor-barn').screenshot({ path: `${out}/${form}-barn-badge.png`, timeout: 90000 }).catch((e) => console.log(e.message))
  await p.close()
}
await b.close()
