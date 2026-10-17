// The trailer's logo, end card and captions as transparent PNGs, 16:9 and 9:16, in the game's
// display face with the splash's outlined wordmark. node scripts/trailer/overlays.mjs (TRAILER=<work dir>)
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const WM = readFileSync(new URL('../splash/wordmark.path', import.meta.url), 'utf8').trim()
const N = '#14213d'
const wm = (w) => `<svg style="width:${w}px;filter:drop-shadow(0 10px 22px rgba(20,33,61,.45))" viewBox="-70 170 4070 1150"><defs><linearGradient id="g" x1="0" y1="246" x2="0" y2="1195" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff8d6"/><stop offset=".45" stop-color="#ffe066"/><stop offset="1" stop-color="#ffaa1a"/></linearGradient><path id="p" d="${WM}"/></defs><use href="#p" y="60" fill="${N}" stroke="${N}" stroke-width="120" stroke-linejoin="round"/><use href="#p" fill="url(#g)" stroke="${N}" stroke-width="120" stroke-linejoin="round" paint-order="stroke"/></svg>`
// <b> marks the gold word.
const CAPS = { build: '<b>Build</b> your town', cars: '<b>65</b> cars to collect', live: 'Race your friends <b>live</b>', weather: '<b>Rain</b> or shine', world: 'Race the <b>world</b>' }
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
for (const [o, w, h] of [['L', 1920, 1080], ['P', 1080, 1920]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  const fs = o === 'L' ? 120 : 112
  const css = `<link href="https://fonts.googleapis.com/css2?family=Lilita+One&display=swap" rel="stylesheet"><style>html,body{margin:0;background:transparent;width:${w}px;height:${h}px;overflow:hidden}
  .c{position:absolute;left:0;right:0;text-align:center;font-family:'Lilita One';color:#fff;letter-spacing:1px;-webkit-text-stroke:${fs * 0.16}px ${N};paint-order:stroke fill;text-shadow:0 ${fs * 0.09}px 0 ${N},0 ${fs * 0.2}px ${fs * 0.4}px rgba(10,16,40,.45)}
  .y,b{color:#ffe066;font-weight:400}
  .slam{transform:rotate(-4deg);text-transform:uppercase;letter-spacing:2px}</style>`
  const page = async (body, file) => {
    await p.setContent(css + body)
    await p.evaluate(() => document.fonts.ready)
    await p.waitForTimeout(300)
    await p.screenshot({ path: `${process.env.TRAILER ?? '/tmp/trailer'}/ov/${o}-${file}.png`, omitBackground: true })
  }
  for (const [k, t] of Object.entries(CAPS)) {
    const top = o === 'L' ? h * 0.70 : h * 0.66
    await page(`<div class="c slam" style="top:${top}px;font-size:${fs}px">${t}</div>`, `cap-${k}`)
  }
  // Opening logo, and the end card: logo with the call to play.
  const lw = o === 'L' ? 1100 : 900
  await page(`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${wm(lw)}</div>`, 'logo')
  await page(`<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${o === 'L' ? 30 : 50}px">${wm(lw)}<div class="c" style="position:static;font-size:${fs * (o === "L" ? 0.72 : 0.62)}px">Play free at <span class="y">cartopia.lol</span></div></div>`, 'end')
}
await b.close()
