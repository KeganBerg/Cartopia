// node scripts/clubav/audio.mjs <set bar> <seconds> <out.wav> <cues.json>   (needs vite on :5173)
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')
const [, , bar = 0, secs = 8, wav, cues] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage()
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto('http://localhost:5173/scripts/clubav/audio.html')
await p.waitForFunction(() => window.render, null, { timeout: 60000 })
const r = await p.evaluate(([g, s]) => window.render(g, s), [Number(bar), Number(secs)])
writeFileSync(wav, Buffer.from(r.wav, 'base64'))
writeFileSync(cues, JSON.stringify(r.cues))
console.log('cues', r.cues.length)
await b.close()
