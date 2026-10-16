import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { CAR_PACKS, type BucksPack } from '../game/bucksPacks'
import { carDef, performance } from '../game/data'
import { reducedMotion } from '../game/fx'
import { CarThumb } from '../scene/BuildingPreview'
import { Panel } from './Menus'
import { BankTabs, useBuy } from './Bank'
import './car-packs.css'

const ZERO = { engine: 0, turbo: 0, tires: 0, weight: 0 }

// Each pack's stage colours: a backdrop, the streaks racing past, and the car's paint.
const THEME: Record<string, { bg: string; streak: string; glow: string }> = {
  scatto: { bg: '#2a0606, #b71c1c', streak: '#ffcdd2', glow: '#ff8a80' },
  stinger: { bg: '#3e2a00, #c88a00', streak: '#fff3c4', glow: '#ffd54f' },
  thunderjet: { bg: '#0d2410, #2e7d32', streak: '#ffe0b2', glow: '#ffb74d' },
  sora: { bg: '#2a0a12, #8e1b2c', streak: '#ffcdd2', glow: '#ef9a9a' },
  hayate: { bg: '#1c0b2e, #6a1b9a', streak: '#e1bee7', glow: '#ce93d8' },
  kestrel: { bg: '#04221f, #00796b', streak: '#b2dfdb', glow: '#64ffda' },
  firebolt: { bg: '#3a0d05, #b4300c', streak: '#ffb74d', glow: '#ff7043' },
  kaze: { bg: '#061a3a, #1565c0', streak: '#e3f2fd', glow: '#4fc3f7' },
  sturm: { bg: '#14260f, #4e6b1e', streak: '#e6d39a', glow: '#c5e1a5' },
  vanta: { bg: '#4527a0, #00acc1', streak: '#e0f7fa', glow: '#00e5ff' },
}

const now = () => window.performance.now()

// Counts up to n once the card appears; with reduced motion it simply shows n.
function useCountUp(n: number, ms = 900) {
  const [v, setV] = useState(() => (reducedMotion() ? n : 0))
  useEffect(() => {
    if (reducedMotion()) return setV(n)
    let raf = 0
    const t0 = now()
    const step = () => {
      const k = Math.min(1, (now() - t0) / ms)
      setV(Math.round(n * (1 - (1 - k) ** 3)))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [n, ms])
  return v
}

const tierOf = (pi: number) => (pi >= 115 ? 'Hyper' : pi >= 100 ? 'Super' : 'New')

function Stage({ car, big }: { car: ReturnType<typeof carDef>; big?: boolean }) {
  return (
    <>
      <div className="pk-streaks" />
      <div className="pk-floor" />
      <div className={big ? 'pk-car big' : 'pk-car'}><CarThumb stand body={car.body} model={car.id} color={car.colors[0]} /></div>
    </>
  )
}

function BuyButton({ p, owned, pending, onBuy }: { p: BucksPack; owned: boolean; pending: boolean; onBuy: () => void }) {
  return owned ? <button className="buy pk-buy" disabled>✓ In garage</button>
    : <button className="buy pk-buy" disabled={pending} onClick={onBuy}>{pending ? '...' : `$${p.price.toFixed(2)}`}</button>
}

const vars = (id: string, i = 0) => {
  const t = THEME[id] ?? THEME.vanta
  return { '--pk-bg': t.bg, '--pk-streak': t.streak, '--pk-glow': t.glow, '--pk-i': i } as React.CSSProperties
}

// The showcase: the super and hyper cars take turns on a big stage, or the one the player taps.
function Showcase({ packs, owns, pending, buy }: { packs: BucksPack[]; owns: (p: BucksPack) => boolean; pending: string | null; buy: (p: BucksPack) => void }) {
  const [at, setAt] = useState(packs.length - 1)
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (held || reducedMotion()) return
    const id = window.setInterval(() => setAt((n) => (n + 1) % packs.length), 4500)
    return () => window.clearInterval(id)
  }, [held, packs.length])
  const p = packs[at]
  const car = carDef(p.car!)
  const pi = performance(car, ZERO)
  const shown = useCountUp(pi)
  return (
    <div className="pk-hero" style={vars(car.id)}>
      <div className="pk-stage">
        <div className="pk-streaks" />
        {/* Every car stays mounted, so its render is ready the moment it slides in. */}
        {packs.map((q, i) => <div key={q.id} className={i === at ? 'pk-swap on' : 'pk-swap'}><Stage car={carDef(q.car!)} big /></div>)}
      </div>
      <div key={`i${car.id}`} className="pk-hero-info">
        <span className={`pk-tiertag ${tierOf(pi).toLowerCase()}`}>{tierOf(pi)}</span>
        <div className="pk-hero-name">{car.name}</div>
        <div className="pk-hero-row">
          <span key={pi} className="pk-bignum">{shown}<small>PI</small></span>
          <span className="pk-gems">+ {p.bucks} 💎</span>
        </div>
        <BuyButton p={p} owned={owns(p)} pending={pending === p.id} onBuy={() => buy(p)} />
      </div>
      <div className="pk-dots">
        {packs.map((q, i) => <button key={q.id} aria-label={carDef(q.car!).name} className={i === at ? 'on' : ''} onClick={() => { setHeld(true); setAt(i) }} />)}
      </div>
    </div>
  )
}

function PackCard({ p, i, owned, pending, onBuy }: { p: BucksPack; i: number; owned: boolean; pending: boolean; onBuy: () => void }) {
  const car = carDef(p.car!)
  const pi = performance(car, ZERO)
  const shown = useCountUp(pi)
  const tier = tierOf(pi)
  return (
    <div className={`pk-card ${tier.toLowerCase()}${p.tag ? ' featured' : ''}${owned ? ' owned' : ''}`} style={vars(car.id, i)}>
      {/* The badges sit in a strip of their own above the car, so the car never runs under them. */}
      <div className="pk-stage">
        <Stage car={car} />
        <span className="pk-pi"><b>{shown}</b> PI</span>
        <span className="pk-gems">+ {p.bucks} 💎</span>
      </div>
      <div className="pk-name">{car.name}</div>
      <div className="pk-foot">
        <span className={`pk-tiertag ${p.tag ? 'top' : tier.toLowerCase()}`}>{p.tag ?? (tier === 'New' ? 'Pack only' : tier)}</span>
        <BuyButton p={p} owned={owned} pending={pending} onBuy={onBuy} />
      </div>
    </div>
  )
}

// Car Packs: a menu of its own beside the gem Bank. The super and hyper cars rotate on a big
// showcase stage; every pack below is a card with its car turning on an animated stage.
export function CarPacksPanel() {
  const cars = useGame((s) => s.cars)
  const { pending, buy, notice } = useBuy()
  const owns = (p: BucksPack) => cars.some((c) => c.model === p.car)
  const top = CAR_PACKS.filter((p) => p.tier === 'super')
  const street = CAR_PACKS.filter((p) => p.tier !== 'super')
  const grid = (packs: BucksPack[], cls: string) => (
    <div className={`pk-grid ${cls}`}>
      {packs.map((p, i) => <PackCard key={p.id} p={p} i={i} owned={owns(p)} pending={pending === p.id} onBuy={() => buy(p)} />)}
    </div>
  )
  return (
    <Panel title="Car Packs" wide className="pk-panel">
      <BankTabs current="carpacks" />
      <Showcase packs={top} owns={owns} pending={pending} buy={buy} />
      <h3 className="pk-head super">🔥 Super & Hyper</h3>
      {grid(top, 'four')}
      <h3 className="pk-head">🏁 Street</h3>
      {grid(street, 'three')}
      <p className="hint">One of each per account · Prices in USD · 🔒 Stripe</p>
      {notice}
    </Panel>
  )
}
