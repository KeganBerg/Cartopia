// Opens the built game in headless Chromium and fails if it throws while starting or never
// mounts the town canvas. Catches builds that load fine in tests but die in a browser, like
// 705d811 (stuck on "Loading your town..."). Run after `vite build`: node scripts/smoke.mjs
import { preview } from 'vite'
import { chromium } from 'playwright'

const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'warn' })
const url = 'http://localhost:4179/'
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const errors = []
let failed = false
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 800 } })
  page.on('pageerror', (e) => errors.push(e.stack || e.message))
  await page.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await page.goto(url)
  await page.waitForSelector('canvas', { timeout: 30000 }).catch(() => errors.push('No canvas within 30 s: the game never started'))
  await page.waitForTimeout(3000)
} finally {
  await browser.close()
  await new Promise((done) => server.httpServer.close(done))
}
if (errors.length) {
  failed = true
  console.error(`Startup smoke test failed:\n${errors.join('\n')}`)
} else console.log('smoke: game started with no page errors')
process.exit(failed ? 1 : 0)
