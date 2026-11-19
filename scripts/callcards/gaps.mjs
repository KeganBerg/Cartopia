// Every Call Card in every frame that shows one with a car (picker, crate prize, ×10 tile, full-size
// crate view), at phone and desktop sizes: fails if the art leaves a gap inside its frame or has a
// second rounded corner, and saves a sheet of the gold cards for a look.
// node scripts/callcards/gaps.mjs <outDir>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'callcards-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
let bad = 0
for (const [vp, width, height] of [['desktop', 1400, 1000], ['phone', 390, 844]]) {
  const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
  await p.goto('http://localhost:5173/?time=0.3&season=fall')
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(2000)
  const gaps = await p.evaluate(async () => {
    const dep = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((u) => u.includes(`/deps/${n}?`))
    const r = await import(dep('react.js'))
    const React = r.default ?? r
    const rd = await import(dep('react-dom_client.js'))
    const createRoot = rd.createRoot ?? rd.default.createRoot
    const { CallCardShowcase } = await import('/src/ui/CallCard.tsx')
    const { CALL_CARDS } = await import('/src/game/callCards.ts')
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#222;display:flex;flex-wrap:wrap;gap:6px;padding:6px;align-content:flex-start;overflow:auto'
    document.body.appendChild(el)
    const holders = ['ccp-big', 'cp-card', 'cs-card', 'crate-cc-big']
    createRoot(el).render(CALL_CARDS.flatMap((c) => holders.map((h) => React.createElement('div', { key: c.id + h, 'data-k': `${c.id} ${h}`, style: { position: 'relative', width: h === 'ccp-big' ? 240 : h === 'cs-card' ? 70 : undefined, height: h === 'cs-card' ? 84 : undefined } },
      React.createElement(CallCardShowcase, { id: c.id, still: true, className: h })))))
    await new Promise((res) => setTimeout(res, 1500))
    const found = []
    for (const art of el.querySelectorAll('.cc-show > .cc')) {
      const f = art.parentElement, cs = getComputedStyle(f), a = art.getBoundingClientRect(), r = f.getBoundingClientRect()
      const top = r.top + parseFloat(cs.borderTopWidth), left = r.left + parseFloat(cs.borderLeftWidth), right = r.right - parseFloat(cs.borderRightWidth)
      const k = f.parentElement.dataset.k
      if (a.top > top + 0.5) found.push(`${k}: ${(a.top - top).toFixed(1)}px band above the art`)
      if (a.left > left + 0.5 || a.right < right - 0.5) found.push(`${k}: art narrower than its frame`)
      if (parseFloat(getComputedStyle(art).borderTopLeftRadius) > 0) found.push(`${k}: second rounded corner inside the frame`)
      if (cs.overflow !== 'hidden') found.push(`${k}: frame doesn't clip its art`)
    }
    return found
  })
  for (const g of gaps) console.log(vp, g)
  bad += gaps.length
  // Plain CDP capture: page.screenshot waits on web fonts, which a busy 3D page can keep pending.
  const cdp = await p.context().newCDPSession(p)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  ;(await import('node:fs')).writeFileSync(`${out}/gaps-${vp}.png`, Buffer.from(data, 'base64'))
  await p.close()
}
await b.close()
console.log(bad ? `${bad} gaps` : 'no gaps')
process.exit(bad ? 1 : 0)
