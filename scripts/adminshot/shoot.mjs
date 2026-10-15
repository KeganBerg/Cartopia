// Admin panel (live, player, log) and the live banner, on desktop and phone, with stubbed server calls.
// node scripts/adminshot/shoot.mjs <outDir>   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'
const [, , out = 'admin-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const forms = [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]].filter(([f]) => !process.env.FORM || process.env.FORM === f)
for (const [form, size] of forms) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2500)
  await p.evaluate(async () => {
    const { admin } = await import('/src/lib/admin.ts')
    const { setLiveEvents, syncHandlers } = await import('/src/game/liveEvents.ts')
    const now = Date.now()
    setLiveEvents([
      { id: 1, kind: 'banner', payload: { message: 'Double coins all weekend! 🎉' }, from: now - 60000, to: now + 3600000 },
      { id: 2, kind: 'weather', payload: { kind: 'fog' }, from: now - 60000, to: now + 900000 },
    ])
    syncHandlers()
    const bob = { id: 'b', username: 'TurboBob', town: 'Bobville', level: 23, coins: 184200, gems: 45, muted: new Date(now + 3600000).toISOString(), admin: false, joined: '', seen: '',
      cars: [{ uid: 'c1', model: 'pip', color: '#e53935' }, { uid: 'c2', model: 'stallion', color: '#1e88e5' }, { uid: 'c3', model: 'zenith', color: '#fdd835' }],
      chat: [{ id: 9, room: 'global', body: 'race me noobs', at: '' }, { id: 8, room: 'global', body: 'anyone selling a zenith?', at: '' }] }
    const ok = (data) => Promise.resolve({ data, error: null })
    admin.find = () => ok([bob, { ...bob, id: 'c', username: 'Bobcat', town: 'Cat Lane', level: 7, coins: 9100, gems: 3, muted: null }])
    admin.player = () => ok(bob)
    admin.log = () => ok([
      { id: 3, at: new Date(now - 60000).toISOString(), action: 'grant', target: 'b', name: 'TurboBob', detail: { coins: 10000, gems: 50, reason: 'bug refund' } },
      { id: 2, at: new Date(now - 600000).toISOString(), action: 'live_start', target: null, name: null, detail: { kind: 'weather', minutes: 15 } },
      { id: 1, at: new Date(now - 7200000).toISOString(), action: 'mute', target: 'b', name: 'TurboBob', detail: { minutes: 60, reason: 'spam' } },
    ])
    admin.grant = (_id, c, g) => {
      bob.coins = Math.min(1e12, Math.max(0, bob.coins + c))
      bob.gems = Math.min(1e12, Math.max(0, bob.gems + g))
      return ok(bob)
    }
    window.__admin = admin
    window.__game.setState({ tutorial: 99 })
  })
  // The Daily Spin opens on its own once the tutorial is done; shut it for the shots.
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ panel: null, panelBack: [], coins: 1e12, bucks: 1e12 }))
  await p.waitForTimeout(1000)
  await p.screenshot({ path: `${out}/${form}-0-banner.png` })
  await p.evaluate(() => window.__game.getState().openPanel('admin'))
  await p.waitForTimeout(1200)
  await p.locator('.adm-kinds button', { hasText: 'Weather' }).click()
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${out}/${form}-1-live.png` })
  await p.locator('.sheet-tabs button', { hasText: 'Players' }).click()
  await p.locator('.adm-input').fill('bob')
  await p.waitForTimeout(900)
  await p.screenshot({ path: `${out}/${form}-2-find.png` })
  await p.locator('.adm-row').first().click()
  await p.waitForTimeout(2500)
  await p.locator('.adm-input').first().fill('bug refund')
  await p.locator('.adm-step').first().click()
  await p.locator('.adm-max').nth(1).click()
  await p.screenshot({ path: `${out}/${form}-3-player.png` })
  await p.locator('.adm-give').click()
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${out}/${form}-3b-given.png` })
  await p.locator('.panel-body').evaluate((el) => (el.scrollTop = el.scrollHeight))
  await p.locator('input[aria-label="Find a car"]').fill('st')
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${form}-4-player-bottom.png` })
  await p.locator('.adm-car .adm-x').first().click()
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${out}/${form}-5-confirm.png` })
  await p.locator('.cf-no').click()
  await p.locator('.sheet-tabs button', { hasText: 'Log' }).click()
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${out}/${form}-6-log.png` })
  console.log(form)
  await p.close()
}
await b.close()
