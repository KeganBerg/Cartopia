// Shots of each new mod on a car: node scripts/mods/shoot.mjs <outDir>  (needs `npm run dev` on :5173)
import { createRequire } from 'node:module'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , out = 'mods-out'] = process.argv
const F = 0.22, R = 0.78, S = 0.5
const SHOTS = [
  ['swanneck', 'sports', '#fafafa', R], ['skydeck', 'super', '#ffb300', R], ['roofrack', 'suv', '#43a047', F, 1.5],
  ['quadtips', 'muscle', '#1e88e5', 0.9, 0.6], ['zoomies', 'coupe', '#fb8c00', 0.4], ['titan', 'super', '#212121', 0.9, 0.6],
  ['rallykit', 'rally', '#1e88e5', F], ['boxflares', 'muscle', '#e53935', F], ['aerokit', 'super', '#8e24aa', F], ['bullbar', 'truck', '#6d4c41', F],
  ['cowl', 'muscle', '#fdd835', F, 1.4], ['louvres', 'sports', '#e53935', F, 1.4], ['twinturbo', 'coupe', '#43a047', F, 1.4],
  ['candy', 'sedan', '#fafafa', S, 0.7], ['beadlock', 'offroad', '#6d4c41', S, 0.7], ['turbine', 'super', '#00acc1', S, 0.7], ['goldwire', 'luxury', '#212121', S, 0.7],
  ['foglamps', 'sedan', '#e53935', F, 0.8, 1], ['roofbar', 'suv', '#fafafa', F, 1.2, 1], ['underglow', 'sports', '#212121', F, 1, 1],
  ['', 'sports', '#e53935', S, 0.5], ['lowered', 'sports', '#e53935', S, 0.5], ['slammed', 'sports', '#e53935', S, 0.5], ['lifted', 'truck', '#6d4c41', S, 0.7], ['', 'truck', '#6d4c41', S, 0.7],
]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 480, height: 360 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('error', e.message))
for (const [mod, body, color, a, h = 1, night] of SHOTS) {
  const q = new URLSearchParams({ body, mods: mod, color, a: String(a), h: String(h), ...(night ? { night: '1' } : {}) })
  await p.goto(`http://localhost:5173/scripts/mods/mods.html?${q}`)
  await p.waitForSelector('canvas')
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `${out}/${mod || 'stock'}-${body}.png` })
  console.log(mod, body)
}
await b.close()
