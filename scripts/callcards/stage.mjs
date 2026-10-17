// Every Call Card with the player's race car standing on it, as Quick Race shows it (tall cards)
// and as the picker/crate prize show it (wide cards). For checking the car sits on each card's ground.
// node scripts/callcards/stage.mjs <outDir>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'callcards-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1500, height: 1700 } })
await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
p.on('pageerror', (e) => console.log('error', e.message))
await p.goto('http://localhost:5173/?time=0.3&season=fall')
await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
await p.waitForTimeout(3000)
for (const [name, w, h, vars] of [['tall', 165, 250, '--g:.56;--car-h:52cqh'], ['wide', 270, 180, '']]) {
  await p.evaluate(async ({ w, h, vars }) => {
    document.getElementById('cc-stage-sheet')?.remove()
    // The app's own copies of React (same ?v= as it loaded), so hooks share one React.
    const dep = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((u) => u.includes(`/deps/${n}?`))
    const r = await import(dep('react.js'))
    const React = r.default ?? r
    const rd = await import(dep('react-dom_client.js'))
    const createRoot = rd.createRoot ?? rd.default.createRoot
    const { CallCardShowcase } = await import('/src/ui/CallCard.tsx')
    const { CALL_CARDS } = await import('/src/game/callCards.ts')
    const el = document.createElement('div')
    el.id = 'cc-stage-sheet'
    el.style.cssText = `position:fixed;inset:0;z-index:99999;background:#222;display:flex;flex-wrap:wrap;gap:8px;padding:8px;align-content:flex-start;overflow:hidden`
    document.body.appendChild(el)
    createRoot(el).render(CALL_CARDS.map((c) => React.createElement('div', { key: c.id, style: { width: w, height: h, position: 'relative' } },
      React.createElement('div', { style: { position: 'absolute', inset: 0 } }, React.createElement(CallCardShowcase, { id: c.id, className: 'sheet-card' })),
      React.createElement('b', { style: { position: 'absolute', left: 6, bottom: 4, zIndex: 9, color: '#fff', font: '11px sans-serif', textShadow: '0 1px 2px #000' } }, c.id))))
    const st = document.createElement('style')
    st.id = 'cc-stage-css'
    st.textContent = `.sheet-card{width:100%;height:100%;${vars}}`
    document.getElementById('cc-stage-css')?.remove()
    document.head.appendChild(st)
  }, { w, h, vars })
  await p.waitForTimeout(6000)
  await p.screenshot({ path: `${out}/stage-${name}.png` })
}
await b.close()
