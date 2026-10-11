import { useEffect, useState } from 'react'
import { useGame, hasRusty } from '../game/store'
import { BUILDINGS, CARS, RESCUE_SPOTS, GP_SERIES, baseFuelCap } from '../game/data'
import { BuildingThumb, CarThumb } from '../scene/BuildingPreview'

type Unlock = {
  key: string
  name: string
  level: number
  tag: string
  price: string
  art: React.ReactNode
  go: () => void
}

function unlocksBetween(from: number, to: number, rusty: boolean, focus: ReturnType<typeof useGame.getState>['focusShop']) {
  const inRange = (l: number) => l > from && l <= to
  const items: Unlock[] = [
    ...BUILDINGS.filter((b) => b.unlockLevel < 99 && !b.event && inRange(b.unlockLevel)).map((b): Unlock => ({
      key: `b-${b.id}`,
      name: b.name,
      level: b.unlockLevel,
      tag: b.kind === 'decor' || b.kind === 'house' ? 'Decor' : 'Building',
      price: b.bucks ? `B ${b.bucks}` : `$ ${b.price.toLocaleString()}`,
      art: <BuildingThumb def={b} />,
      go: () => focus('shop', b.id),
    })),
    ...CARS.filter((c) => !c.rescueOnly && inRange(c.unlockLevel)).map((c): Unlock => ({
      key: `c-${c.id}`,
      name: c.name,
      level: c.unlockLevel,
      tag: 'Car',
      price: c.bucks ? `B ${c.bucks}` : `$ ${c.price.toLocaleString()}`,
      art: <CarThumb color={c.colors[0]} body={c.body} model={c.id} />,
      go: () => focus('showroom', c.id),
    })),
    ...RESCUE_SPOTS.filter((r) => inRange(r.unlockLevel)).map((r): Unlock => ({
      key: `r-${r.id}`,
      name: r.name,
      level: r.unlockLevel,
      tag: "Rusty's search",
      price: `$ ${r.cost.toLocaleString()}`,
      art: <div className="lvl-emoji">{r.icon}</div>,
      go: () => (rusty ? focus('rescue', null) : focus('shop', 'rescue')),
    })),
    ...GP_SERIES.filter((g) => inRange(g.unlockLevel)).map((g): Unlock => ({
      key: `g-${g.id}`,
      name: g.name,
      level: g.unlockLevel,
      tag: 'Grand Prix',
      price: `${g.minCars} cars`,
      art: <div className="lvl-emoji">🏆</div>,
      go: () => focus('race', null),
    })),
  ]
  return items
}

// The next level that unlocks anything, so a quiet level-up still has something to aim for.
function nextUnlock(level: number) {
  const levels = [...BUILDINGS.filter((b) => b.unlockLevel < 99 && !b.event), ...CARS.filter((c) => !c.rescueOnly), ...RESCUE_SPOTS, ...GP_SERIES]
    .map((x) => x.unlockLevel)
    .filter((l) => l > level)
  return levels.length ? Math.min(...levels) : null
}

export function LevelUpSplash() {
  const lu = useGame((s) => s.levelUp)
  if (!lu) return null
  // Keyed so a second level-up while it's open replays the animation.
  return <Splash key={lu.to} {...lu} />
}

function Splash({ from, to, coins, bucks }: { from: number; to: number; coins: number; bucks: number }) {
  const close = useGame((s) => s.closeLevelUp)
  const focus = useGame((s) => s.focusShop)
  const rusty = useGame((s) => hasRusty(s))
  const [items] = useState(() => unlocksBetween(from, to, rusty, focus))
  const [teaser] = useState(() => {
    if (items.length) return null
    const at = nextUnlock(to)
    return at ? { at, items: unlocksBetween(at - 1, at, rusty, focus) } : null
  })
  const fuel = baseFuelCap(to) - baseFuelCap(from)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div className="overlay lvl-overlay" onClick={close}>
      <div className="lvl-rays" aria-hidden />
      <div className="lvl" role="dialog" aria-label={`Level ${to}`} onClick={(e) => e.stopPropagation()}>
        <div className="lvl-badge" aria-hidden>
          <div className="lvl-badge-ring" />
          <div className="lvl-num">
            <span className="old">{from}</span>
            <span className="new">{to}</span>
          </div>
          {Array.from({ length: 8 }, (_, i) => <i key={i} className="lvl-spark" style={{ '--a': `${i * 45}deg` } as React.CSSProperties} />)}
        </div>
        <h2 className="lvl-title">Level up!</h2>
        <p className="lvl-sub">You're now level {to}</p>
        <div className="lvl-rewards">
          {coins > 0 && <span className="lvl-chip"><span className="ico coin-ico">$</span>+{coins.toLocaleString()}</span>}
          {bucks > 0 && <span className="lvl-chip"><span className="ico buck-ico">B</span>+{bucks}</span>}
          {fuel > 0 && <span className="lvl-chip">⛽ +{fuel} max fuel</span>}
          <span className="lvl-chip">⛽ Tank filled</span>
        </div>

        {items.length > 0 ? (
          <>
            <h3 className="lvl-head">New in the shop</h3>
            <div className="lvl-items">
              {items.map((it, i) => (
                <button key={it.key} className="card lvl-item" style={{ '--i': i } as React.CSSProperties} onClick={it.go}>
                  <span className="lvl-tag">{it.tag}</span>
                  {it.art}
                  <div className="card-name">{it.name}</div>
                  <span className="price">{it.price}</span>
                  <span className="lvl-go">{it.tag === 'Car' ? 'Showroom' : it.tag === 'Grand Prix' ? 'Race' : it.tag === "Rusty's search" ? "Rusty's" : 'Shop'} ›</span>
                </button>
              ))}
            </div>
          </>
        ) : teaser ? (
          <>
            <h3 className="lvl-head">Coming at level {teaser.at}</h3>
            <div className="lvl-items">
              {teaser.items.map((it, i) => (
                <div key={it.key} className="card lvl-item locked" style={{ '--i': i } as React.CSSProperties}>
                  <span className="lvl-tag">{it.tag}</span>
                  {it.art}
                  <div className="card-name">{it.name}</div>
                  <span className="price">🔒 Level {it.level}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <button className="buy lvl-continue" onClick={close}>Continue</button>
      </div>
    </div>
  )
}
