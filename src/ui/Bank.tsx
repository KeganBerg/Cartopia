import { useState } from 'react'
import { useGame } from '../game/store'
import { BUCKS_PACKS, CAR_PACKS, packGrant, type BucksPack } from '../game/bucksPacks'
import { carDef, performance } from '../game/data'
import { CarThumb } from '../scene/BuildingPreview'
import { purchase } from '../lib/payments'
import { Panel } from './Menus'
import { CONTACT } from '../legal/legal'

const ZERO = { engine: 0, turbo: 0, tires: 0, weight: 0 }

const NOTICE = {
  'not-connected': ['Coming soon', "Gem packs aren't on sale yet. You weren't charged."],
  'sign-in': ['Sign in first', 'Gems go to your account. Sign in from the Menu.'],
  blocked: ['Purchases paused', `Contact ${CONTACT}`],
  owned: ['Already yours', 'Check your garage.'],
  failed: ["Couldn't open checkout", "You weren't charged. Try again."],
} as const

// The Bank: buy bucks in tiers on Stripe Checkout (src/lib/payments.ts). Until the Stripe keys
// are set on Netlify, a tap says purchases are coming soon and nothing is charged.
export function BankPanel() {
  const bucks = useGame((s) => s.bucks)
  const level = useGame((s) => s.level)
  const showNeed = useGame((s) => s.showNeed)
  const [pending, setPending] = useState<string | null>(null)
  const cars = useGame((s) => s.cars)
  const [notice, setNotice] = useState<keyof typeof NOTICE | null>(null)

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
      <div className="bank-packs car-packs">
        {CAR_PACKS.map((p) => {
          const car = carDef(p.car!)
          const owned = cars.some((c) => c.model === car.id)
          return (
            <div key={p.id} className={`bank-pack car-pack${p.tag ? ' featured' : ''}`}>
              {p.tag && <span className="ribbon">{p.tag}</span>}
              <CarThumb size="sm" body={car.body} model={car.id} color={car.colors[0]} />
              <div className="pack-name">{car.name}</div>
              <div className="pack-extras"><span>⚡ {performance(car, ZERO)} PI</span><span>+ {p.bucks} 💎</span></div>
              {owned ? <button className="buy" disabled>✓ Owned</button>
                : <button className="buy" disabled={pending === p.id} onClick={() => buy(p)}>{pending === p.id ? '...' : `$${p.price.toFixed(2)}`}</button>}
            </div>
          )
        })}
      </div>
      <div className="bank-packs">
        {BUCKS_PACKS.map((p) => {
          const { bucks: total, coins, parts } = packGrant(p, level)
          const pct = Math.round((p.bonus / p.bucks) * 100)
          return (
            <div key={p.id} className={`bank-pack${p.tag ? ' featured' : ''}`}>
              {p.tag && <span className="ribbon">{p.tag}</span>}
              <div className="pack-art">{p.art}</div>
              <div className="pack-name">{p.name}</div>
              <div className="pack-bucks">💎 {total.toLocaleString()}</div>
              {p.bonus > 0 ? <div className="pack-bonus">+{pct}% bonus</div> : <div className="pack-bonus plain">{p.bucks} gems</div>}
              {(coins || parts) > 0 && (
                <div className="pack-extras">
                  {coins ? <span>+ ${coins.toLocaleString()}</span> : null}
                  {parts ? <span>+ {parts}⚙</span> : null}
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

