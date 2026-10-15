// Chat panel with a chat mod's message (the blue check), on desktop and phone.
// node scripts/chatshot/shoot.mjs <outDir>   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'
const [, , out = 'chat-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 })
  await p.locator('#splash button.ld').click({ timeout: 60000 }).catch(() => {})
  await p.waitForSelector('#splash', { state: 'detached', timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(2500)
  await p.evaluate(async () => {
    const { useChat } = await import('/src/lib/chat.ts')
    const now = Date.now()
    const msg = (id, owner, name, body, extra = {}) => ({ id, owner, name, level: 12, crew: null, body, at: now - (10 - id) * 60000, ...extra })
    useChat.setState({
      uid: 'me',
      msgs: { global: [
        msg(1, 'a1', 'Maple Hollow', 'anyone up for a drag race?'),
        msg(2, 'kb', 'KBerg Town', 'Rave Mode in 5 minutes!', { mod: true }),
        msg(3, 'a2', '@KBerg', 'I am totally the real one'),
        msg(4, 'me', 'My Town', 'see you there'),
      ], crew: [] },
    })
    window.__game.setState({ tutorial: 99 })
    window.__game.getState().openPanel('chat')
  })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${form}-chat.png` })
  console.log(form)
  await p.close()
}
await b.close()
