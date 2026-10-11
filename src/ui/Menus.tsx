import { useEffect, useRef, useState } from 'react'
import { useGame, hasRusty } from '../game/store'
import { garagePower, BUILDINGS, CARS, SKILLS, UPGRADE_SLOTS, MAX_UPGRADE, PAINTS, STRIPES, PAINT_COST, STRIPE_COST, carDef, performance, upgradeCost, buildingDef, upgradable, loves, readySets, type BuildingDef } from '../game/data'
import { CarInspect, CarPreview } from '../scene/CarPreview'
import { CollectAllButton } from './CollectAll'
import { rotateCurrent } from '../game/placement'
import { BuildingThumb, CarThumb } from '../scene/BuildingPreview'
import { ShopUpgrades } from './Upgrade'
import { ModShop, withMod } from './Mods'
import { CollectionBook, useFindCar } from './Collection'

// Phones and tablets: no hover, so placing takes a preview tap first.
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export function BottomBar() {
  const openPanel = useGame((s) => s.openPanel)
  const setMode = useGame((s) => s.setMode)
  const mode = useGame((s) => s.mode)
  const visiting = useGame((s) => !!s.visiting)
  const setsReady = useGame((s) => readySets(s).length)
  if (visiting) return null
  if (mode !== 'play') return <EditBar />
  return (
    <>
      <div className="bottom-bar">
        <button className="icon-btn" onClick={() => openPanel('shop')}><span className="i">🏪</span>SHOP</button>
        <button className="icon-btn" onClick={() => openPanel('showroom')}><span className="i">🚘{setsReady > 0 && <span className="btn-dot">{setsReady}</span>}</span>SHOWROOM</button>
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
  const selected = useGame((s) => s.selected)
  const again = useGame((s) => s.again)
  const setMode = useGame((s) => s.setMode)
  const openPanel = useGame((s) => s.openPanel)
  const openUpgrade = useGame((s) => s.openUpgrade)
  const canUpgrade = useGame((s) => {
    const b = s.selected ? s.buildings.find((o) => o.uid === s.selected) : undefined
    return !!b && upgradable(buildingDef(b.def))
  })
  const hint =
    mode === 'expand' ? 'Tap a For Sale sign to buy the land next to your town'
    : mode === 'road' ? 'Click or drag to lay road (10 coins per tile)'
    : mode === 'bulldoze' ? 'Click or drag to remove (buildings refund half)'
    : mode === 'move' && again && selected ? 'Built! Rotate or drag it to adjust it'
    : mode === 'move' ? (selected ? 'Drag it to move it, or Rotate to turn it' : 'Drag a building to move it, or tap one to rotate it')
    : `${TOUCH ? 'Tap a spot to preview' : 'Click to place'} ${placing ? BUILDINGS.find((b) => b.id === placing)?.name : ''}${TOUCH ? ', tap it again to build' : ''}. Rotate turns it.`
  return (
    <div className="edit-bar">
      <div className="edit-hint">{hint}</div>
      <div className="edit-tools">
        <button className={mode === 'road' ? 'tool active' : 'tool'} onClick={() => setMode('road')}>🛣️ Road</button>
        <button className={mode === 'bulldoze' ? 'tool active' : 'tool'} onClick={() => setMode('bulldoze')}>🚜 Bulldoze</button>
        <button className={mode === 'move' ? 'tool active' : 'tool'} onClick={() => setMode('move')}>✋ Move</button>
        <button className={mode === 'expand' ? 'tool active' : 'tool'} onClick={() => setMode('expand')}>🗺 Land</button>
        {((mode === 'place' && placing) || (mode === 'move' && selected)) && <button className="tool" onClick={rotateCurrent} title="Rotate (R)">🔄 Rotate</button>}
        {mode === 'move' && selected && canUpgrade && <button className="tool" onClick={() => openUpgrade(selected)}>⬆ Upgrade</button>}
        {mode === 'move' && again && <button className="tool" onClick={() => setMode('place', again)}>➕ Build another</button>}
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

// Scrolls to and flashes the card the level-up splash sent the player to.
function useShopFocus() {
  const focus = useGame((s) => s.shopFocus)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focus) return
    const el = body.current?.querySelector<HTMLElement>(`[data-id="${focus}"]`)
    // Wait a frame so the panel has laid out before scrolling.
    const raf = requestAnimationFrame(() => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    const t = setTimeout(() => useGame.setState({ shopFocus: null }), 2600)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [focus])
  return { body, focus }
}

function price(def: { price: number; bucks?: number }) {
  if (def.bucks) return <span className="price bucks">B {def.bucks}</span>
  return <span className="price">$ {def.price.toLocaleString()}</span>
}

// Tabs across the top of a menu, sticky while its body scrolls.
export function SheetTabs<T extends string>({ items, value, onChange }: { items: readonly { id: T; label: React.ReactNode }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="sheet-tabs" role="tablist">
      {items.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className={t.id === value ? 'sel' : ''} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  )
}

type ShopTab = 'cars' | 'business' | 'services' | 'homes' | 'upgrades'
const SHOP_GROUPS: { id: Exclude<ShopTab, 'upgrades'>; label: string; filter: (b: BuildingDef) => boolean }[] = [
  { id: 'cars', label: '🔧 Cars & parts', filter: (b) => b.id === 'rescue' || b.kind === 'parts' },
  { id: 'business', label: '🍕 Businesses', filter: (b) => b.kind === 'business' && b.id !== 'rescue' && b.id !== 'crew' && !b.service },
  { id: 'services', label: '⛽ Services', filter: (b) => b.kind === 'gas' || b.id === 'crew' || !!b.service },
  { id: 'homes', label: '🏡 Homes', filter: (b) => b.kind === 'house' || b.kind === 'decor' },
]
// The Shop reopens on the tab it was left on.
let lastShopTab: ShopTab = 'cars'
// Which tab a focus request (a building id, or 'upgrades') should open.
function shopTabFor(focus: string | null): ShopTab | null {
  if (!focus) return null
  if (focus === 'upgrades') return 'upgrades'
  const def = BUILDINGS.find((b) => b.id === focus)
  return (def && SHOP_GROUPS.find((g) => g.filter(def))?.id) || null
}

export function ShopPanel() {
  const level = useGame((s) => s.level)
  const coins = useGame((s) => s.coins)
  const setMode = useGame((s) => s.setMode)
  const buildings = useGame((s) => s.buildings)
  const showNeed = useGame((s) => s.showNeed)
  const focus = useGame((s) => s.shopFocus)
  const focusRef = useRef<HTMLButtonElement>(null)
  const rusty = hasRusty({ buildings })
  const canUpgrade = buildings.some((b) => upgradable(buildingDef(b.def)))
  const [tab, setTabState] = useState<ShopTab>(() => shopTabFor(focus) ?? (!rusty ? 'cars' : lastShopTab === 'upgrades' && !canUpgrade ? 'cars' : lastShopTab))
  const setTab = (t: ShopTab) => {
    lastShopTab = t
    setTabState(t)
  }
  // A "Build" hint elsewhere opened the Shop: switch to that building's tab and bring it into view.
  useEffect(() => {
    const t = shopTabFor(focus)
    if (t) setTabState(t)
    const raf = requestAnimationFrame(() => focusRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
    return () => cancelAnimationFrame(raf)
  }, [focus])
  const tabs: { id: ShopTab; label: React.ReactNode }[] = [...SHOP_GROUPS, ...(canUpgrade ? [{ id: 'upgrades' as const, label: '⬆ Upgrades' }] : [])]
  const group = SHOP_GROUPS.find((g) => g.id === tab)
  return (
    <Panel title="Shop" wide>
      <SheetTabs items={tabs} value={tab} onChange={setTab} />
      {tab === 'upgrades' && <ShopUpgrades />}
      {group && (
          <div className="cards rows">
            {BUILDINGS.filter((b) => b.unlockLevel < 99 && group.filter(b)).sort((a, b) => Number(b.id === 'rescue') - Number(a.id === 'rescue')).map((b) => {
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
                  <div className="card-text">
                    <div className="card-name">{b.name}</div>
                    {b.jobSeconds && (
                      <div className="card-stat">
                        ${b.payout}{b.partsPayout ? ` +${b.partsPayout}⚙` : ''} every {b.jobSeconds >= 60 ? `${b.jobSeconds / 60}m` : `${b.jobSeconds}s`} · ⛽{b.fuelCost}
                      </div>
                    )}
                    {b.nightOnly && <div className="card-stat">🌙 Open at night only</div>}
                    {b.id === 'rescue' && <div className="card-stat">Search for old cars and restore them</div>}
                    {b.id === 'crew' && <div className="card-stat">Your crew's clubhouse: roster, rank and crew boards</div>}
                    {b.fuelCap && <div className="card-stat">+{b.fuelCap} max fuel</div>}
                  </div>
                  {owned ? <span className="price">✔ Built</span> : locked ? <span className="price">🔒 Level {b.unlockLevel}</span> : price(b)}
                </button>
              )
            })}
          </div>
      )}
    </Panel>
  )
}

// The Showroom reopens on the tab it was left on.
let lastShowroomTab: 'shop' | 'book' = 'shop'

export function ShowroomPanel() {
  const level = useGame((s) => s.level)
  const buyCar = useGame((s) => s.buyCar)
  const rusty = useGame((s) => hasRusty(s))
  const openShop = useGame((s) => s.openShop)
  const [colorFor, setColorFor] = useState<Record<string, string>>({})
  const [inspect, setInspect] = useState<string | null>(null)
  const { body, focus } = useShopFocus()
  const look = inspect ? carDef(inspect) : null
  const [tab, setTab] = useState<'shop' | 'book'>(() => lastShowroomTab)
  const pickTab = (t: 'shop' | 'book') => {
    lastShowroomTab = t
    setTab(t)
  }
  const ready = useGame((s) => readySets(s).length)
  const owned = useGame((s) => CARS.filter((c) => s.cars.some((o) => o.model === c.id)).length)
  const find = useFindCar((model) => {
    pickTab('shop')
    useGame.setState({ shopFocus: model })
  })
  const tabs = [
    { id: 'shop' as const, label: '🚘 For sale' },
    { id: 'book' as const, label: <>📖 Collection {owned}/{CARS.length}{ready > 0 && <span className="tab-dot">{ready}</span>}</> },
  ]
  return (
    <Panel title="Showroom" wide>
      <SheetTabs items={tabs} value={tab} onChange={pickTab} />
      {tab === 'book' && <CollectionBook onFind={find} />}
      {tab === 'shop' && <>
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
      <div ref={body} className={rusty ? 'cards' : 'cards dimmed'}>
        {CARS.filter((c) => !c.rescueOnly).map((c) => {
          const locked = level < c.unlockLevel
          const color = colorFor[c.id] ?? c.colors[0]
          const pi = performance(c, { engine: 0, turbo: 0, tires: 0, weight: 0 })
          return (
            <div key={c.id} data-id={c.id} className={`card car-card ${locked ? 'locked' : ''} ${focus === c.id ? 'focus' : ''}`}>
              <button className="thumb-look" aria-label={`Take a closer look at the ${c.name}`} onClick={() => setInspect(c.id)}>
                <CarThumb color={color} body={c.body} />
                <span className="look-badge">🔍</span>
              </button>
              <div className="card-name">{c.name}{c.legendary && <> <span className="rarity rarity-legendary">Legendary</span></>}</div>
              <div className="card-stat">PI {pi} · {c.body}</div>
              <SkillTag model={c.id} />
              <LovesTag model={c.id} />
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
      </>}
      {look && <CarInspect title={look.name} body={look.body} color={colorFor[look.id] ?? look.colors[0]} onClose={() => setInspect(null)} />}
    </Panel>
  )
}

export function SkillTag({ model }: { model: string }) {
  const sk = carDef(model).skill
  if (!sk) return null
  return <span className="skill-tag" title={SKILLS[sk].text}>{SKILLS[sk].icon} {SKILLS[sk].name}</span>
}

// The businesses a car loves to drive for, e.g. "❤️ Pizza Place, Donut Shop".
export function LovesTag({ model }: { model: string }) {
  const likes = carDef(model).likes
  if (!likes.length) return null
  return <div className="loves-tag" title="Assign it to one of these for +25% coins per job">❤️ {likes.map((id) => buildingDef(id).name).join(', ')}</div>
}

// Where a car works, or which businesses it would love to.
function DriverRow({ car, model }: { car: string; model: string }) {
  const job = useGame((s) => s.buildings.find((b) => b.car === car))
  const openUpgrade = useGame((s) => s.openUpgrade)
  const def = carDef(model)
  if (job) {
    const d = buildingDef(job.def)
    return (
      <button className="driver-row" onClick={() => openUpgrade(job.uid)}>
        🧑‍🔧 Drives for your <b>{d.name}</b> · {loves(def, d.id) ? '❤️ +25%' : '+10%'} coins
      </button>
    )
  }
  return <div className="driver-row idle"><LovesTag model={model} /><small>Tap a busy business to put this car to work there.</small></div>
}

type GarageTab = 'tune' | 'mods' | 'paint'
let nextGarageTab: GarageTab = 'tune'
// Opens the Garage on a given tab (goals use it for paint and mods).
export function openGarageTab(tab: GarageTab) {
  nextGarageTab = tab
  useGame.getState().openPanel('garage')
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
  const [tab, setTab] = useState<GarageTab>(() => {
    const t = nextGarageTab
    nextGarageTab = 'tune'
    return t
  })
  // A mod being tried on in the preview, cleared when another car is picked.
  const [trying, setTrying] = useState<{ car: string; mod: string } | null>(null)
  const tryMod = trying && trying.car === car?.uid && tab === 'mods' ? trying.mod : null
  const [inspect, setInspect] = useState(false)
  return (
    <Panel title={`My Garage · ${cars.length} cars · ⚡${garagePower(cars)}`} wide>
      <div className="garage">
        <div className="garage-list">
          {cars.map((c) => {
            const d = carDef(c.model)
            return (
              <button key={c.uid} className={c.uid === car?.uid ? 'garage-item sel' : 'garage-item'} onClick={() => select(c.uid)}>
                <CarThumb size="sm" color={c.color} body={d.body} stripe={c.stripe} mods={c.mods} />
                <span>{d.name}{c.plate && <span className="mini-plate">{c.plate}</span>}</span>
                <small>PI {performance(d, c.upgrades, c.mods)}</small>
              </button>
            )
          })}
        </div>
        {car && def && (
          <div className="garage-detail">
            {inspect ? (
              <>
                <div className="car-preview" />
                <CarInspect title={def.name} body={def.body} color={car.color} stripe={car.stripe} mods={withMod(car.mods, tryMod)} onClose={() => setInspect(false)} />
              </>
            ) : (
              <CarPreview body={def.body} color={car.color} stripe={car.stripe} mods={withMod(car.mods, tryMod)} onExpand={() => setInspect(true)} />
            )}
            <h3>{def.name}{car.plate && <span className="mini-plate">{car.plate}</span>}</h3>
            <div className="pi">Performance Index <b>{performance(def, car.upgrades, car.mods)}</b></div>
            {def.skill && <div className="skill-row"><SkillTag model={car.model} /> <small>{SKILLS[def.skill].text}</small></div>}
            <DriverRow car={car.uid} model={car.model} />
            <div className="garage-tabs" role="tablist">
              {([['tune', '🔧 Upgrades'], ['mods', '🪽 Mods'], ['paint', '🎨 Paint']] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'sel' : ''} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            {tab === 'mods' && <ModShop car={car} trying={tryMod} setTrying={(id) => setTrying(id ? { car: car.uid, mod: id } : null)} />}
            {tab === 'tune' && UPGRADE_SLOTS.map((u) => {
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
            {tab === 'paint' && <>
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
            </>}
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
