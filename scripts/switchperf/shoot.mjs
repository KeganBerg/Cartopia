// Runs the new account-switch path (cloud town written to storage, persist frozen, reload) and
// screenshots the town that boots. OUT=dir node scripts/switchperf/shoot.mjs   (needs `npm run dev`)
import { chromium } from 'playwright'
const out = process.env.OUT ?? '.'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [label, viewport, mobile] of [['phone', { width: 390, height: 844 }, true], ['desktop', { width: 1440, height: 900 }, false]]) {
  const p = await b.newPage({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto('http://localhost:5173/?time=0.2&season=summer')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 12, townName: 'Kegan Town', updatedAt: Date.now() }))
  await p.waitForTimeout(3000)
  const t0 = Date.now()
  await p.evaluate(() => {
    const g = window.__game
    const roads = ['4,4', '5,4', '6,4', '7,4', '8,4', '4,5', '4,6', '4,7']
    const buildings = [{ uid: 'n1', def: 'tacos', x: 5, z: 5, rot: 0 }, { uid: 'n2', def: 'arcade', x: 6, z: 5, rot: 0 }, { uid: 'n3', def: 'lube', x: 7, z: 5, rot: 0 }, { uid: 'n4', def: 'tires', x: 5, z: 3, rot: 2 }]
    const cloud = { ...g.getState(), townName: 'Nate Town', level: 3, roads, buildings, updatedAt: 1 }
    const { name, version, storage } = g.persist.getOptions()
    storage.setItem(name, { state: cloud, version: version ?? 0 })
    g.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } })
    location.reload()
  })
  await p.waitForFunction(() => window.__game?.getState().townName === 'Nate Town', null, { timeout: 90000 })
  console.log(label, 'booted into', await p.evaluate(() => window.__game.getState().townName), 'after', Date.now() - t0, 'ms')
  await p.getByText('Got it').click({ timeout: 30000 }).catch(() => {})
  await p.getByText("Let's go").click({ timeout: 5000 }).catch(() => {})
  await p.waitForTimeout(8000)
  await p.screenshot({ path: `${out}/${label}-after-switch.png` })
  await p.close()
}
await b.close()
