// Phone and desktop shots of a bot-driven race: on the line (revs held in the green) and mid-race.
// Needs `npx vite` running. node scripts/campaignbot/shoot.mjs <out dir>
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')
const [, , out = 'campaignbot-out'] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [form, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: size, deviceScaleFactor: 1, isMobile: form === 'phone', hasTouch: form === 'phone' })
  p.on('pageerror', (e) => console.log('error', e.message))
  await p.goto('http://localhost:5173/scripts/campaignbot/index.html?car=crusher&up=0&pi=40&rival=stomper&shift=0.7')
  await p.waitForFunction(() => document.querySelector('.rf-hold')?.textContent?.includes('Hold') || document.querySelector('.rf-hold')?.textContent?.includes('Rev'), null, { timeout: 120000 }).catch(() => console.log('no hold call'))
  await p.screenshot({ path: `${out}/${form}-line.png` })
  await p.waitForFunction(() => document.querySelector('svg.tach')?.textContent?.includes('GEAR 3'), null, { timeout: 60000 }).catch(() => {})
  await p.screenshot({ path: `${out}/${form}-race.png` })
  await p.waitForFunction(() => window.__result, null, { timeout: 120000 }).catch(() => {})
  console.log(form, JSON.stringify(await p.evaluate(() => window.__result)))
  await p.close()
}
await b.close()
