// Menu > Account two-step sign-in states (off, setup, code ask) on desktop and phone,
// against a mocked Supabase.
// VITE_SUPABASE_URL=https://fakeproj.supabase.co VITE_SUPABASE_ANON_KEY=anon npx vite --port 5174
// node scripts/twostepshot/shoot.mjs <outDir>
import { chromium } from 'playwright'
const [, , out = 'twostep-out'] = process.argv
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const uid = '00000000-0000-4000-8000-000000000001'
const jwt = (aal) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, aal, role: 'authenticated', exp: 4102444800, amr: [{ method: 'password', timestamp: 1 }] })}.sig`
// A QR-like grid for the picture (not a real code).
const qr = (() => {
  const n = 25, cells = []
  let s = 7
  const finder = (x, y) => [[x, y, 7, 7, '#000'], [x + 1, y + 1, 5, 5, '#fff'], [x + 2, y + 2, 3, 3, '#000']]
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const inF = (x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)
    if (!inF && (s >> 16) % 2) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`)
  }
  const f = [...finder(0, 0), ...finder(18, 0), ...finder(0, 18)].map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" shape-rendering="crispEdges">${cells.join('')}${f}</svg>`
})()

const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const state of ['off', 'setup', 'ask']) for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  const aal = state === 'ask' ? 'aal1' : 'aal2'
  const factors = state === 'ask' ? [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'x' }] : []
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'kberg@example.com', factors, app_metadata: {}, user_metadata: {}, created_at: '2026-10-10T00:00:00Z' }
  await p.route('https://fakeproj.supabase.co/**', (r) => {
    const u = new URL(r.request().url())
    if (u.pathname === '/auth/v1/user') return r.fulfill({ json: user })
    if (u.pathname === '/auth/v1/factors') return r.fulfill({ json: { id: 'new', type: 'totp', totp: { qr_code: qr, secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', uri: 'otpauth://totp/x' } } })
    if (u.pathname.startsWith('/rest/v1/rpc/')) return r.fulfill({ json: null })
    if (u.pathname.startsWith('/rest/v1/')) return r.fulfill({ json: [] })
    return r.fulfill({ status: 404, json: {} })
  })
  await p.addInitScript(([session]) => {
    localStorage.setItem('cartopia-flash-warning-hide', '1')
    localStorage.setItem('sb-fakeproj-auth-token', session)
  }, [JSON.stringify({ access_token: jwt(aal), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user })])
  await p.goto('http://localhost:5174/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2000)
  await p.evaluate(() => { window.__game.setState({ tutorial: 99 }); window.__game.getState().openPanel('account') })
  await p.getByRole('tab', { name: /Account/ }).click()
  await p.waitForTimeout(800)
  if (state === 'setup') { await p.getByRole('button', { name: 'Turn on' }).click(); await p.waitForTimeout(800); await p.getByLabel('6-digit code').fill('4821') }
  if (state === 'ask') await p.getByLabel('6-digit code').fill('482193')
  await p.waitForTimeout(500)
  const card = p.locator('.set-group', { hasText: /Two-step/ })
  await card.scrollIntoViewIfNeeded().catch(() => {})
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${out}/${form}-${state}.png` })
  console.log(form, state)
  await p.close()
}
await b.close()
