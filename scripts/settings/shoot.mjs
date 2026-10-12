// Screenshots of the Menu tabs (Settings, Account, Help) on desktop and phone.
// node scripts/settings/shoot.mjs <outDir> [tabs...]   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'
const [, , out = 'settings-out', ...want] = process.argv
const tabs = want.length ? want : ['Town', 'Settings', 'Account', 'Help']
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto('http://localhost:5173/?time=0.3&season=fall' + (process.env.Q ?? ''))
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, panel: 'account' }))
  for (const t of tabs) {
    if (t.startsWith('/')) {
      await p.goto(`http://localhost:5173${t}`)
      await p.waitForTimeout(4000)
    } else {
      await p.evaluate((t) => [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.includes(t))?.click(), t)
      await p.waitForTimeout(800)
    }
    await p.screenshot({ path: `${out}/${form}-${t.replace(/\W/g, '')}.png` })
    console.log(form, t)
  }
  await p.close()
}
await b.close()
