import { useEffect, useRef, useState } from 'react'
import { useGame, hasRusty } from '../game/store'
import { BUILDINGS, CARS, SKILLS, UPGRADE_SLOTS, MAX_UPGRADE, PAINTS, STRIPES, PAINT_COST, STRIPE_COST, carDef, performance, upgradeCost, type BuildingDef } from '../game/data'
import { CarPreview } from '../scene/CarPreview'
import { CollectAllButton } from './CollectAll'
import { rotatePlacement } from '../game/placement'
import { preloadBuildings, BuildingThumb, CarThumb } from '../scene/BuildingPreview'

export function BottomBar() {
  const openPanel = useGame((s) => s.openPanel)
  const setMode = useGame((s) => s.setMode)
  const mode = useGame((s) => s.mode)
  const visiting = useGame((s) => !!s.visiting)
  if (visiting) return null
  if (mode !== 'play') return <EditBar />
  return (
    <>
      <div className="bottom-bar">
        <button className="big-btn menu-btn" onClick={() => openPanel('account')}><span>CARTOPIA</span>MENU</button>
        <button className="icon-btn" onClick={() => openPanel('shop')}><span className="i">🏪</span>SHOP</button>
        <button className="icon-btn" onClick={() => openPanel('showroom')}><span className="i">🚘</span>SHOWROOM</button>
        <button className="icon-btn" onClick={() => openPanel('garage')}><span className="i">🔧</span>GARAGE</button>
        <button className="icon-btn" onClick={() => openPanel('friends')}><span className="i">👫</span>FRIENDS</button>
        <button className="icon-btn" onClick={() => setMode('road')}><span className="i">🚧</span>EDIT</button>
        <button className="big-btn race-btn" onClick={() => openPanel('race')}><span className="i">🏆</span>RACE</button>
      </div>
      <CollectAllButton />
    </>
  )
}

function EditBar() {
  const mode = useGame((s) => s.mode)
  const placing = useGame((s) => s.placing)
  const setMode = useGame((s) => s.setMode)
  const openPanel = useGame((s) => s.openPanel)
  const hint =
    mode === 'expand' ? 'Tap a For Sale sign to buy the land next to your town'
    : mode === 'road' ? 'Click or drag to lay road (10 coins per tile)'
    : mode === 'bulldoze' ? 'Click or drag to remove (buildings refund half)'
    : `Click to place ${placing ? BUILDINGS.find((b) => b.id === placing)?.name : ''}. Rotate turns it.`
  return (
    <div className="edit-bar">
      <div className="edit-hint">{hint}</div>
      <div className="edit-tools">
        <button className={mode === 'road' ? 'tool active' : 'tool'} onClick={() => setMode('road')}>🛣️ Road</button>
        <button className={mode === 'bulldoze' ? 'tool active' : 'tool'} onClick={() => setMode('bulldoze')}>🚜 Bulldoze</button>
        <button className={mode === 'expand' ? 'tool active' : 'tool'} onClick={() => setMode('expand')}>🗺 Land</button>
        {mode === 'place' && placing && <button className="tool" onClick={rotatePlacement} title="Rotate (R)">🔄 Rotate</button>}
        <button className="tool" onClick={() => openPanel('shop')}>🏪 Shop</button>
        <button className="tool done" onClick={() => setMode('play')}>✔ Done</button>
      </div>
    </div>
  )
}

export function Panel({ title, children, wide, onClose }: { title: string; children: React.ReactNode; wide?: boolean; onClose?: () => void }) {
  const openPanel = useGame((s) => s.openPanel)
  const close = (_: null) => (onClose ? onClose() : openPanel(null))
  return (
    <div className="overlay" onClick={() => close(null)}>
      <div className={wide ? 'panel wide' : 'panel'} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{title}</h2>
          <button className="close" onClick={() => close(null)}>✕</button>
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  )
}

function price(def: { price: number; bucks?: number }) {
  if (def.bucks) return <span className="price bucks">B {def.bucks}</span>
  return <span className="price">$ {def.price.toLocaleString()}</span>
}

const SHOP_GROUPS: { title: string; filter: (b: BuildingDef) => boolean }[] = [
  { title: 'Cars and parts makers', filter: (b) => b.id === 'rescue' || b.kind === 'parts' },
  { title: 'Businesses', filter: (b) => b.kind === 'business' && b.id !== 'rescue' },
  { title: 'Services', filter: (b) => b.kind === 'gas' },
  { title: 'Homes and decor', filter: (b) => b.kind === 'house' || b.kind === 'decor' },
]

export function ShopPanel() {
  const level = useGame((s) => s.level)
  const coins = useGame((s) => s.coins)
  const setMode = useGame((s) => s.setMode)
  const buildings = useGame((s) => s.buildings)
  const showNeed = useGame((s) => s.showNeed)
  const focus = useGame((s) => s.shopFocus)
  const focusRef = useRef<HTMLButtonElement>(null)
  const rusty = hasRusty({ buildings })
  useEffect(preloadBuildings, [])
  // A "Build" hint elsewhere opened the Shop: bring that building into view.
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focus])
  return (
    <Panel title="Shop" wide>
      {SHOP_GROUPS.map((g) => (
        <section key={g.title}>
          <h3>{g.title}</h3>
          <div className="cards">
            {BUILDINGS.filter((b) => b.unlockLevel < 99 && g.filter(b)).sort((a, b) => Number(b.id === 'rescue') - Number(a.id === 'rescue')).map((b) => {
              const locked = level < b.unlockLevel
              const broke = coins < b.price
              const owned = !!b.unique && buildings.some((o) => o.def === b.id)
              const highlight = b.id === 'rescue' && !rusty
              const focused = b.id === focus
              return (
                <button
                  key={b.id}
                  ref={focused ? focusRef : undefined}
                  className={`card ${locked ? 'locked' : ''} ${broke && !locked ? 'broke' : ''} ${highlight ? 'start-here' : ''} ${focused ? 'focus' : ''}`}
                  disabled={owned}
                  onClick={() => (locked ? showNeed('level', b.unlockLevel, b.name) : broke ? showNeed('coins', b.price - coins, b.name) : setMode('place', b.id))}
                >
                  {highlight && <span className="ribbon">START HERE</span>}
                  <BuildingThumb def={b} />
                  <div className="card-name">{b.name}</div>
                  {b.jobSeconds && (
                    <div className="card-stat">
                      ${b.payout}{b.partsPayout ? ` +${b.partsPayout}⚙` : ''} every {b.jobSeconds >= 60 ? `${b.jobSeconds / 60}m` : `${b.jobSeconds}s`} · ⛽{b.fuelCost}
                    </div>
                  )}
                  {b.id === 'rescue' && <div className="card-stat">Search for old cars and restore them</div>}
                  {b.fuelCap && <div className="card-stat">+{b.fuelCap} max fuel</div>}
                  {owned ? <span className="price">✔ Built</span> : locked ? <span className="price">🔒 Level {b.unlockLevel}</span> : price(b)}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </Panel>
  )
}

export function ShowroomPanel() {
  const level = useGame((s) => s.level)
  const buyCar = useGame((s) => s.buyCar)
  const rusty = useGame((s) => hasRusty(s))
  const openShop = useGame((s) => s.openShop)
  const [colorFor, setColorFor] = useState<Record<string, string>>({})
  return (
    <Panel title="Showroom" wide>
      {!rusty && (
        <div className="rusty-lock">
          <span className="rusty-icon">🔧</span>
          <div>
            <b>Build Rusty's Rescue first</b>
            <p>Rusty tracks down and restores cars for your town. Build his shop to start getting new cars.</p>
          </div>
          <button className="buy" onClick={() => openShop('rescue')}>Build · $1,000</button>
        </div>
      )}
      <div className={rusty ? 'cards' : 'cards dimmed'}>
        {CARS.filter((c) => !c.rescueOnly).map((c) => {
          const locked = level < c.unlockLevel
          const color = colorFor[c.id] ?? c.colors[0]
          const pi = performance(c, { engine: 0, turbo: 0, tires: 0, weight: 0 })
          return (
            <div key={c.id} className={`card car-card ${locked ? 'locked' : ''}`}>
              <CarThumb color={color} body={c.body} />
              <div className="card-name">{c.name}</div>
              <div className="card-stat">PI {pi} · {c.body}</div>
              <SkillTag model={c.id} />
              <div className="colors">
                {c.colors.map((col) => (
                  <button key={col} className={col === color ? 'dot sel' : 'dot'} style={{ background: col }} onClick={() => setColorFor({ ...colorFor, [c.id]: col })} />
                ))}
              </div>
              {locked ? (
                <button className="price locked-btn" onClick={() => buyCar(c.id, color)}>🔒 Level {c.unlockLevel}</button>
              ) : (
                <button className="buy" disabled={!rusty} onClick={() => buyCar(c.id, color)}>Buy {price(c)}</button>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

export function SkillTag({ model }: { model: string }) {
  const sk = carDef(model).skill
  if (!sk) return null
  return <span className="skill-tag" title={SKILLS[sk].text}>{SKILLS[sk].icon} {SKILLS[sk].name}</span>
}

export function GaragePanel() {
  const cars = useGame((s) => s.cars)
  const selected = useGame((s) => s.selectedCar)
  const select = useGame((s) => s.selectCar)
  const upgrade = useGame((s) => s.upgradeCar)
  const sell = useGame((s) => s.sellCar)
  const paint = useGame((s) => s.paintCar)
  const stripeCar = useGame((s) => s.stripeCar)
  const car = cars.find((c) => c.uid === selected) ?? cars[0]
  const def = car && carDef(car.model)
  return (
    <Panel title={`My Garage · ${cars.length} cars`} wide>
      <div className="garage">
        <div className="garage-list">
          {cars.map((c) => {
            const d = carDef(c.model)
            return (
              <button key={c.uid} className={c.uid === car?.uid ? 'garage-item sel' : 'garage-item'} onClick={() => select(c.uid)}>
                <CarThumb size="sm" color={c.color} body={d.body} stripe={c.stripe} />
                <span>{d.name}{c.plate && <span className="mini-plate">{c.plate}</span>}</span>
                <small>PI {performance(d, c.upgrades)}</small>
              </button>
            )
          })}
        </div>
        {car && def && (
          <div className="garage-detail">
            <CarPreview body={def.body} color={car.color} stripe={car.stripe} />
            <h3>{def.name}{car.plate && <span className="mini-plate">{car.plate}</span>}</h3>
            <div className="pi">Performance Index <b>{performance(def, car.upgrades)}</b></div>
            {def.skill && <div className="skill-row"><SkillTag model={car.model} /> <small>{SKILLS[def.skill].text}</small></div>}
            {UPGRADE_SLOTS.map((u) => {
              const lvl = car.upgrades[u.id]
              const cost = upgradeCost(def, lvl)
              return (
                <div key={u.id} className="upgrade-row">
                  <span className="up-name">{u.name}</span>
                  <span className="pips">{Array.from({ length: MAX_UPGRADE }, (_, i) => <i key={i} className={i < lvl ? 'on' : ''} />)}</span>
                  {lvl < MAX_UPGRADE ? (
                    <button className="buy small" onClick={() => upgrade(car.uid, u.id)}>${cost.coins.toLocaleString()} + {cost.parts}⚙</button>
                  ) : (
                    <span className="maxed">MAX</span>
                  )}
                </div>
              )
            })}
            <h4>Paint shop <small>${PAINT_COST} · neon and gold B1</small></h4>
            <div className="paints">
              {PAINTS.map((p) => (
                <button
                  key={p.color}
                  title={`${p.name}${p.bucks ? ' (1 buck)' : ''}`}
                  className={p.color === car.color ? 'dot big sel' : p.bucks ? 'dot big premium' : 'dot big'}
                  style={{ background: p.color }}
                  onClick={() => paint(car.uid, p.color)}
                />
              ))}
            </div>
            <h4>Racing stripes <small>${STRIPE_COST}</small></h4>
            <div className="paints">
              {STRIPES.map((st) => (
                <button
                  key={st ?? 'none'}
                  title={st ? 'Stripe' : 'No stripe'}
                  className={(car.stripe ?? null) === st ? 'dot big sel' : 'dot big'}
                  style={{ background: st ? `linear-gradient(90deg, ${car.color} 0 35%, ${st} 35% 45%, ${car.color} 45% 55%, ${st} 55% 65%, ${car.color} 65%)` : car.color }}
                  onClick={() => stripeCar(car.uid, st)}
                >{st ? '' : '∅'}</button>
              ))}
            </div>
            <button className="sell" onClick={() => sell(car.uid)}>Sell for ${Math.floor(def.price * 0.5).toLocaleString()}</button>
          </div>
        )}
      </div>
    </Panel>
  )
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">{t.text}</div>
      ))}
    </div>
  )
}
