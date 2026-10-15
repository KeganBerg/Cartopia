// node scripts/flyers/shoot.mjs <outDir> [kinds,comma] [night] [yaw] [pitch] [look]   (needs vite on :5173)
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'flyers-out', kinds = 'plane,heli,banner,blimp,rocket', night = '0', yaw = '35', pitch = '25', look = '0'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 720, height: 480 } })
for (const kind of kinds.split(',')) {
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('error', kind, e.message))
  await p.goto(`http://localhost:5173/scripts/flyers/index.html?kind=${kind}&night=${night}&yaw=${yaw}&pitch=${pitch}&look=${look}`)
  await p.waitForSelector('canvas', { timeout: 60000 })
  await p.waitForTimeout(3000)
  const name = `${kind}-y${yaw}-p${pitch}${night === '1' ? '-n' : ''}${look !== '0' ? '-l' + look : ''}.png`
  await p.screenshot({ path: `${out}/${name}` })
  console.log(name)
  await p.close()
}
await b.close()
