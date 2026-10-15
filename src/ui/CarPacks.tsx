import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { CAR_PACKS, type BucksPack } from '../game/bucksPacks'
import { carDef, performance } from '../game/data'
import { classOf } from '../game/classes'
import { reducedMotion } from '../game/fx'
import { CarThumb } from '../scene/BuildingPreview'
import { Panel } from './Menus'
import { BankTabs, useBuy } from './Bank'
import './car-packs.css'

const ZERO = { engine: 0, turbo: 0, tires: 0, weight: 0 }

// Each pack's stage colours: a backdrop, the streaks racing past, and the car's paint.
const THEME: Record<string, { bg: string; streak: string; glow: string }> = {
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

function PackCard({ p, i, owned, pending, onBuy }: { p: BucksPack; i: number; owned: boolean; pending: boolean; onBuy: () => void }) {
  const car = carDef(p.car!)
  const pi = performance(car, ZERO)
  const shown = useCountUp(pi)
  const t = THEME[car.id] ?? THEME.vanta
  const cls = classOf(car.id)
  const stats: [string, string, number][] = [['🔥', 'Power', car.power], ['🛞', 'Grip', car.grip], ['🪶', 'Light', 100 - car.weight]]
  const style = { '--pk-bg': t.bg, '--pk-streak': t.streak, '--pk-glow': t.glow, '--pk-i': i } as React.CSSProperties
  return (
    <div className={`pk-card${p.tag ? ' featured' : ''}${owned ? ' owned' : ''}`} style={style}>
      <div className="pk-stage">
        <div className="pk-streaks" />
        <div className="pk-floor" />
        {p.tag && <span className="pk-ribbon">{p.tag}</span>}
        <span className="pk-pi"><b>{shown}</b><small>PI</small></span>
        <span className="pk-class" title={cls.name}>{cls.icon}</span>
        <div className="pk-car"><CarThumb size="lg" body={car.body} model={car.id} color={car.colors[0]} /></div>
      </div>
      <div className="pk-info">
        <div className="pk-name">{car.name}</div>
        <div className="pk-stats">
          {stats.map(([ico, name, v]) => (
            <div key={name} className="pk-stat" title={name}>
              <span>{ico}</span>
              <i><em style={{ width: `${Math.min(100, v)}%` }} /></i>
            </div>
          ))}
        </div>
        <div className="pk-extras"><span>🚗 Pack only</span><span>+ {p.bucks} 💎</span></div>
        {owned ? <button className="buy" disabled>✓ In garage</button>
          : <button className="buy" disabled={pending} onClick={onBuy}>{pending ? '...' : `$${p.price.toFixed(2)}`}</button>}
      </div>
    </div>
  )
}

// Car Packs: a menu of its own beside the gem Bank. Each pack is a car you can't get anywhere
// else plus gems, shown on an animated stage, one per account.
export function CarPacksPanel() {
  const cars = useGame((s) => s.cars)
  const { pending, buy, notice } = useBuy()
  return (
    <Panel title="Car Packs" wide>
      <BankTabs current="carpacks" />
      <div className="pk-grid">
        {CAR_PACKS.map((p, i) => (
          <PackCard key={p.id} p={p} i={i} owned={cars.some((c) => c.model === p.car)} pending={pending === p.id} onBuy={() => buy(p)} />
        ))}
      </div>
      <p className="hint">One of each per account · Prices in USD · 🔒 Stripe</p>
      {notice}
    </Panel>
  )
}
