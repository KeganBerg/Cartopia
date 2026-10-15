import { useEffect } from 'react'
import type { Purchase } from '../game/store'
import { BUCKS_PACKS } from '../game/bucksPacks'
import { useBought } from '../lib/payments'
import { rescueSfx } from '../lib/sound'
import './purchase.css'

// Back from Stripe with a paid pack: a "purchase successful" splash, then the pack itself and
// what it paid: gems, coins and parts, each the same size. It reuses the level-up splash (.lvl) with a check badge.
export function PurchaseSplash() {
  const rows = useBought((s) => s.rows)
  if (!rows?.length) return null
  return <Splash key={rows[rows.length - 1].seq} rows={rows} />
}

function Splash({ rows }: { rows: Purchase[] }) {
  const close = useBought((s) => s.close)

  useEffect(() => {
    const t = setTimeout(() => rescueSfx.fanfare(true), 250)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [close])

  const packs = rows.slice(-3)
  const title = rows.length > 1 ? `${rows.length} packs` : (BUCKS_PACKS.find((p) => p.id === rows[0].pack)?.name ?? 'Gem pack')

  return (
    <div className="overlay lvl-overlay buy-overlay" onClick={close}>
      <div className="lvl-rays" aria-hidden />
      <div className="lvl buy-done" role="dialog" aria-label="Purchase successful" onClick={(e) => e.stopPropagation()}>
        <div className="lvl-badge buy-badge" aria-hidden>
          <div className="lvl-badge-ring" />
          <svg className="buy-check" viewBox="0 0 52 52"><path d="M14 27 l8 8 l16 -18" /></svg>
          {Array.from({ length: 8 }, (_, i) => <i key={i} className="lvl-spark" style={{ '--a': `${i * 45}deg` } as React.CSSProperties} />)}
        </div>
        <h2 className="lvl-title">Purchase successful!</h2>
        <p className="lvl-sub">{title}</p>

        <div className="buy-packs">
          {packs.map((row, i) => (
            <div key={row.seq} className="buy-pack" style={{ '--i': i } as React.CSSProperties}>
              <div className="buy-item"><span className="ico buck-ico">💎</span><b>{row.bucks.toLocaleString()}</b></div>
              {row.coins > 0 && <div className="buy-item"><span className="ico coin-ico">$</span><b>{row.coins.toLocaleString()}</b></div>}
              {row.parts > 0 && <div className="buy-item"><span className="ico parts-ico">⚙</span><b>{row.parts.toLocaleString()}</b></div>}
              {Array.from({ length: 7 }, (_, k) => <i key={k} className="buy-fly" style={{ '--k': k } as React.CSSProperties} aria-hidden>💎</i>)}
            </div>
          ))}
        </div>

        <button className="buy lvl-continue" onClick={close}>Continue</button>
      </div>
    </div>
  )
}
