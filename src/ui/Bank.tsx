import { useState } from 'react'
import { useGame } from '../game/store'
import { BUCKS_PACKS, type BucksPack } from '../game/bucksPacks'
import { purchase } from '../lib/payments'
import { Panel } from './Menus'

const NOTICE = {
  'not-connected': ['Coming soon', "Gem packs aren't on sale yet. You weren't charged."],
  'sign-in': ['Sign in first', 'Gems go to your account. Sign in from the Menu.'],
  blocked: ['Purchases paused', 'Contact support@cartopia.com'],
  failed: ["Couldn't open checkout", "You weren't charged. Try again."],
} as const

// The Bank: buy bucks in tiers on Stripe Checkout (src/lib/payments.ts). Until the Stripe keys
// are set on Netlify, a tap says purchases are coming soon and nothing is charged.
export function BankPanel() {
  const bucks = useGame((s) => s.bucks)
  const showNeed = useGame((s) => s.showNeed)
  const [pending, setPending] = useState<string | null>(null)
  const [notice, setNotice] = useState<'not-connected' | 'sign-in' | 'blocked' | 'failed' | null>(null)

  const buy = async (p: BucksPack) => {
    setPending(p.id)
    const res = await purchase(p)
    setPending(null)
    if (!res.ok) setNotice(res.reason)
  }

  return (
    <Panel title="Bank" wide>
      <div className="bank-head">
        <span className="ico buck-ico bank-ico">💎</span>
        <div>
          <b>You have {bucks} gems</b>
          <p className="bank-uses" title="Gems finish restores, refill fuel, fix the tow truck, and buy premium cars and paint">🔧 ⛽ 🚚 🚗 🎨</p>
        </div>
      </div>
      <div className="bank-packs">
        {BUCKS_PACKS.map((p) => {
          const total = p.bucks + p.bonus
          const pct = Math.round((p.bonus / p.bucks) * 100)
          return (
            <div key={p.id} className={`bank-pack${p.tag ? ' featured' : ''}`}>
              {p.tag && <span className="ribbon">{p.tag}</span>}
              <div className="pack-art">{p.art}</div>
              <div className="pack-name">{p.name}</div>
              <div className="pack-bucks">💎 {total}</div>
              {p.bonus > 0 ? <div className="pack-bonus">{p.bucks} + {p.bonus} bonus ({pct}% more)</div> : <div className="pack-bonus plain">{p.bucks} gems</div>}
              {(p.coins || p.parts) && (
                <div className="pack-extras">
                  {p.coins ? <span>+ ${p.coins.toLocaleString()}</span> : null}
                  {p.parts ? <span>+ {p.parts}⚙</span> : null}
                </div>
              )}
              <button className="buy" disabled={pending === p.id} onClick={() => buy(p)}>{pending === p.id ? '...' : `$${p.price.toFixed(2)}`}</button>
            </div>
          )
        })}
      </div>
      <div className="source bank-free">
        <span className="source-icon">⭐</span>
        <div>
          <b>Free gems</b>
          <div className="card-stat">⬆ Levels · 🎯 Goals · 🔥 Streaks</div>
        </div>
        <button className="buy small alt" onClick={() => showNeed('bucks', 0)}>How</button>
      </div>
      <p className="hint">Prices in USD · 🔒 Stripe</p>
      {notice && (
        <div className="overlay bank-notice" onClick={() => setNotice(null)}>
          <div className="prize" onClick={(e) => e.stopPropagation()}>
            <h2>{NOTICE[notice][0]}</h2>
            <p>{NOTICE[notice][1]}</p>
            <button className="buy" onClick={() => setNotice(null)}>OK</button>
          </div>
        </div>
      )}
    </Panel>
  )
}

