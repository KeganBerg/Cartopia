// Every Call Card side by side (animated), for a detail review: two frames a second apart.
// node scripts/callcards/sheet.mjs <outDir>   (needs `npx vite` on :5173)
import { chromium } from 'playwright'
const [, , out = 'callcards-out'] = process.argv
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1500, height: 1300 } })
await p.addInitScript(() => localStorage.setItem('cartopia-flash-warning-hide', '1'))
await p.goto('http://localhost:5173/?time=0.3&season=fall')
await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
await p.waitForTimeout(2000)
const ids = await p.evaluate(async () => (await import('/src/game/callCards.ts')).CALL_CARDS.map((c) => c.id))
await p.evaluate(async () => { await import('/src/ui/CallCard.tsx') })
await p.evaluate((ids) => {
  const g = document.createElement('div')
  g.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:#222;display:grid;grid-template-columns:repeat(9,1fr);gap:8px;padding:8px;overflow:hidden'
  for (const id of ids) {
    const w = document.createElement('div')
    w.style.cssText = 'position:relative;height:300px;border-radius:14px;overflow:hidden;border:3px solid #14213d'
    w.innerHTML = `<span class="cc cc-${id}" style="--cc:#e53935"><i class="cc-c"></i><i class="cc-a"></i><i class="cc-b"></i></span><b style="position:absolute;left:6px;bottom:4px;color:#fff;font:700 13px sans-serif;text-shadow:0 1px 2px #000">${id}</b>`
    g.appendChild(w)
  }
  document.body.appendChild(g)
}, ids)
await p.waitForTimeout(1500)
await p.screenshot({ path: `${out}/sheet-a.png` })
await p.waitForTimeout(900)
await p.screenshot({ path: `${out}/sheet-b.png` })
await b.close()
