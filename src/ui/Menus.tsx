import { groupOf, mergeCandidates } from '../game/merge'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, hasRusty, buildPrice, type OwnedCar } from '../game/store'
import { raceCarOf } from '../game/raceCar'
import { reducedMotion } from '../game/fx'
import { activeEvent, garagePower, BUILDINGS, CARS, SKILLS, UPGRADE_SLOTS, MAX_UPGRADE, carDef, performance, upgradeCost, buildingDef, upgradable, loves, readySets, type BuildingDef } from '../game/data'
import { CarInspect, CarPreview, type DynoFeed } from '../scene/CarPreview'
import { DynoOverlay, type DynoRun } from './Dyno'
import { CollectAllButton } from './CollectAll'
import { GoalsButton } from './Goals'
import { rotateCurrent } from '../game/placement'
import { BuildingThumb, CarThumb } from '../scene/BuildingPreview'
import { ShopUpgrades } from './Upgrade'
import { ModShop, withMod } from './Mods'
import { CollectionBook, useFindCar } from './Collection'
import { PaintShop, jobOf } from './Paint'
import { SkinPicker } from './Skins'
import type { PaintJob, SkinnedSlot } from '../game/data'
import { Icon } from './Icon'
import { useCrewGoal } from './CrewGoal'
import { useChat } from '../lib/chat'
import { useRivalWaiting } from './Rivals'
import { ShowcaseToggle } from './Meet'
import { tutTarget, type TutTarget } from './Tutorial'
import { setFreeCam, useFreeCam } from '../scene/freeCam'

// Phones and tablets: no hover, so placing takes a preview tap first.
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export function BottomBar() {
  const openPanel = useGame((s) => s.openPanel)
  const setMode = useGame((s) => s.setMode)
  const mode = useGame((s) => s.mode)
  const visiting = useGame((s) => !!s.visiting)
  const setsReady = useGame((s) => readySets(s).length)
  const crewChests = useCrewGoal((g) => g.ready)
  const crewChat = useChat((c) => c.unread.crew)
  const globalChat = useChat((c) => c.unread.global > 0)
  const rival = useRivalWaiting()
  const tut = useGame(tutTarget)
  const pulse = (t: TutTarget) => (tut === t ? ' tut-pulse' : '')
  if (visiting) return null
  if (mode !== 'play') return <EditBar />
  return (
    <>
      <div className="bottom-bar">
        <button className={`icon-btn${pulse('shop')}`} onClick={() => openPanel('shop')}><span className="i i-shop"><Icon name="shop" /></span>SHOP</button>
        <button className="icon-btn" onClick={() => openCars(setsReady > 0)}><span className="i i-showroom"><Icon name="car" />{setsReady > 0 && <span className="btn-dot">{setsReady}</span>}</span>CARS</button>
        <button className="icon-btn" onClick={() => openPanel('friends')}><span className="i i-friends"><Icon name="friends" />{crewChests > 0 && <span className="btn-dot">{crewChests}</span>}</span>FRIENDS</button>
        <button className="icon-btn" onClick={() => openPanel('chat')}><span className="i i-chat"><Icon name="chat" />{crewChat > 0 ? <span className="btn-dot">{crewChat > 9 ? '9+' : crewChat}</span> : globalChat && <span className="btn-dot new" />}</span>CHAT</button>
        <button className="icon-btn" onClick={() => setMode('road')}><span className="i i-edit"><Icon name="cone" /></span>EDIT</button>
        <button className={`big-btn race-btn${pulse('race')}`} onClick={() => openPanel('race')}><span className="i"><Icon name="flag" />{rival && <span className="btn-dot" title="Your rival is in town">!</span>}</span>RACE</button>
      </div>
      <FreeCamButton />
      <GoalsButton />
      <CollectAllButton />
    </>
  )
}

// The first couple of times, a one-line toast says how to steer.
function toggleFreeCam(on: boolean) {
  setFreeCam(on)
  if (!on) return
  try {
    const seen = Number(localStorage.getItem('cartopia-freecam-tips')) || 0
    if (seen >= 2) return
    localStorage.setItem('cartopia-freecam-tips', String(seen + 1))
  } catch {
    // No storage: show it every time.
  }
  useGame.getState().toast(TOUCH ? 'Pinch to zoom · two fingers to turn and tilt' : 'Right-drag to turn and tilt · scroll to zoom')
}

// Switches the town between the bird's-eye view and the free camera.
function FreeCamButton() {
  const on = useFreeCam((f) => f.on)
  const label = on ? "Back to bird's-eye view" : 'Free camera'
  return (
    <button className={`goals-btn cam-dock${on ? ' on' : ''}`} onClick={() => toggleFreeCam(!on)} title={label} aria-label={label} aria-pressed={on}>
      <Icon name={on ? 'birdseye' : 'orbit'} />
    </button>
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
  const tutDone = useGame((s) => tutTarget(s) === 'done')
  const pickedMerged = useGame((s) => !!s.selected && !!groupOf(s.buildings, s.selected))
  const canMerge = useGame((s) => (s.mode === 'merge' ? mergeCandidates(s.buildings).length > 0 || s.buildings.some((b) => b.merge) : true))
  const hint =
    mode === 'expand' ? 'Tap a For Sale sign to buy land'
    : mode === 'merge' ? (canMerge ? 'Tap a Merge badge to combine buildings' : 'Put 2 or 4 matching buildings side by side')
    : mode === 'road' ? 'Drag to lay road · $10 a tile'
    : mode === 'bulldoze' ? 'Drag to remove · buildings refund half'
    : mode === 'move' && again && selected ? 'Built! Drag or rotate it'
    : mode === 'move' ? (selected ? (pickedMerged ? 'Rotate turns the whole block. Split it to move it' : 'Drag to move, or rotate it') : 'Drag a building, or tap one to pick it')
    : `${TOUCH ? 'Tap to preview, tap again to build' : 'Click to place'} ${placing ? BUILDINGS.find((b) => b.id === placing)?.name : ''}`
  return (
    <div className="edit-bar">
      <div className="edit-hint">{hint}</div>
      <div className="edit-tools">
        <button className={mode === 'road' ? 'tool active' : 'tool'} onClick={() => setMode('road')}><Icon name="road" size={22} /><span>Road</span></button>
        <button className={mode === 'bulldoze' ? 'tool active' : 'tool'} onClick={() => setMode('bulldoze')}><Icon name="bulldoze" size={22} /><span>Bulldoze</span></button>
        <button className={mode === 'move' ? 'tool active' : 'tool'} onClick={() => setMode('move')}><Icon name="move" size={22} /><span>Move</span></button>
        <button className={mode === 'expand' ? 'tool active' : 'tool'} onClick={() => setMode('expand')}><Icon name="land" size={22} /><span>Land</span></button>
        <button className={mode === 'merge' ? 'tool active' : 'tool'} onClick={() => setMode('merge')}><Icon name="merge" size={22} /><span>Merge</span></button>
        {((mode === 'place' && placing) || (mode === 'move' && selected)) && <button className="tool" onClick={rotateCurrent} title="Rotate (R)"><Icon name="rotate" size={22} /><span>Rotate</span></button>}
        {mode === 'move' && selected && canUpgrade && <button className="tool" onClick={() => openUpgrade(selected)}><Icon name="up" size={22} /><span>Upgrade</span></button>}
        {mode === 'move' && again && <button className="tool" onClick={() => setMode('place', again)}><Icon name="plus" size={22} /><span>Again</span></button>}
        <button className="tool" onClick={() => openPanel('shop')}><Icon name="shop" size={22} /><span>Shop</span></button>
        <button className={tutDone ? 'tool done tut-pulse' : 'tool done'} onClick={() => setMode('play')}><Icon name="check" size={22} /><span>Done</span></button>
      </div>
    </div>
  )
}

// onBack: shows a back button before the title (a sub-screen of the panel).
// head: extra bits in the title bar, before the close button.
export function Panel({ title, children, wide, onClose, onBack, head, className }: { title: string; children: React.ReactNode; wide?: boolean; onClose?: () => void; onBack?: () => void; head?: React.ReactNode; className?: string }) {
  const openPanel = useGame((s) => s.openPanel)
  // Slides away before it unmounts; the timer dies with the panel, so a panel
  // swapped in meanwhile is never closed by it.
  const [closing, setClosing] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const close = (_: null) => {
    const done = () => (onClose ? onClose() : openPanel(null))
    if (reducedMotion()) return done()
    if (closing) return
    setClosing(true)
    timer.current = window.setTimeout(done, 170)
  }
  return (
    <div className={closing ? 'overlay closing' : 'overlay'} onClick={() => close(null)}>
      <div className={`${wide ? 'panel wide' : 'panel'}${className ? ` ${className}` : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          {onBack && <button className="panel-back" aria-label="Back" onClick={onBack}><Icon name="back" size={18} /></button>}
          <h2>{title}</h2>
          {head}
          <button className="close" aria-label="Close" onClick={() => close(null)}><Icon name="close" size={16} /></button>
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

function price(def: { price: number; bucks?: number }, sale?: { coins: number; bucks: number } | null) {
  if (def.bucks) return <span className="price bucks">{sale && <s>💎 {def.bucks}</s>} 💎 {sale ? sale.bucks : def.bucks}</span>
  return <span className="price">{sale && <s>$ {def.price.toLocaleString()}</s>} $ {(sale ? sale.coins : def.price).toLocaleString()}</span>
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

type ShopTab = 'cars' | 'business' | 'services' | 'homes' | 'event' | 'upgrades'
const SHOP_GROUPS: { id: Exclude<ShopTab, 'upgrades'>; label: string; filter: (b: BuildingDef) => boolean }[] = [
  { id: 'cars', label: '🔧 Cars & parts', filter: (b) => b.id === 'rescue' || b.kind === 'parts' },
  { id: 'business', label: '🍕 Businesses', filter: (b) => b.kind === 'business' && b.id !== 'rescue' && b.id !== 'crew' && !b.service },
  { id: 'services', label: '⛽ Services', filter: (b) => b.kind === 'gas' || b.id === 'crew' || !!b.service },
  { id: 'homes', label: '🏡 Homes', filter: (b) => (b.kind === 'house' || b.kind === 'decor') && !b.event },
  // Limited-time decorations for the running event (the tab only shows while it runs).
  { id: 'event', label: '🎃 Spooky', filter: (b) => !!b.event && b.event === activeEvent()?.id },
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
  const deals = useGame((s) => s.deals)
  const focusRef = useRef<HTMLButtonElement>(null)
  const rusty = hasRusty({ buildings })
  const canUpgrade = buildings.some((b) => upgradable(buildingDef(b.def)))
  const [tab, setTabState] = useState<ShopTab>(() => shopTabFor(focus) ?? (!rusty ? 'cars' : (lastShopTab === 'upgrades' && !canUpgrade) || (lastShopTab === 'event' && !activeEvent()) ? 'cars' : lastShopTab))
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
  const ev = activeEvent()
  const tabs: { id: ShopTab; label: React.ReactNode }[] = [...SHOP_GROUPS.filter((g) => g.id !== 'event' || ev), ...(canUpgrade ? [{ id: 'upgrades' as const, label: '⬆️ Upgrades' }] : [])]
  const group = SHOP_GROUPS.find((g) => g.id === tab)
  return (
    <Panel title="Shop" wide>
      <SheetTabs items={tabs} value={tab} onChange={setTab} />
      {tab === 'upgrades' && <ShopUpgrades />}
      {group && (
          <div className="cards rows">
            {BUILDINGS.filter((b) => b.unlockLevel < 99 && group.filter(b)).sort((a, b) => Number(b.id === 'rescue') - Number(a.id === 'rescue')).map((b) => {
              const locked = level < b.unlockLevel
              const sale = buildPrice({ deals, level }, b.id)
              const broke = coins < sale.coins
              const owned = !!b.unique && buildings.some((o) => o.def === b.id)
              const highlight = b.id === 'rescue' && !rusty
              const focused = b.id === focus
              return (
                <button
                  key={b.id}
                  ref={focused ? focusRef : undefined}
                  className={`card ${locked ? 'locked' : ''} ${broke && !locked ? 'broke' : ''} ${highlight ? 'start-here' : ''} ${focused ? 'focus' : ''}`}
                  disabled={owned}
                  onClick={() => (locked ? showNeed('level', b.unlockLevel, b.name) : broke ? showNeed('coins', sale.coins - coins, b.name) : setMode('place', b.id))}
                >
                  {highlight && <span className="ribbon">START HERE</span>}
                  {sale.deal && !locked && <span className="ribbon deal">DEAL</span>}
                  {b.event && <span className="ribbon spooky">LIMITED</span>}
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
                  {owned ? <span className="price">✔ Built</span> : locked ? <span className="price">🔒 Level {b.unlockLevel}</span> : price(b, sale.deal && sale)}
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
// The CARS button reopens whichever of the Garage and Showroom was used last.
let lastCars: 'garage' | 'showroom' = 'garage'

// Opens the cars window; a ready collection set jumps straight to the Collection tab.
function openCars(setsReady: boolean) {
  if (setsReady) lastShowroomTab = 'book'
  useGame.getState().openPanel(setsReady ? 'showroom' : lastCars)
}

type CarsTab = 'garage' | 'shop' | 'book' | 'crates'

// My Garage, the Showroom and the Crate Depot share one row of tabs, opened from the CARS button.
function CarsTabs({ current, onShowroom }: { current: CarsTab; onShowroom?: (t: 'shop' | 'book') => void }) {
  const openPanel = useGame((s) => s.openPanel)
  const ready = useGame((s) => readySets(s).length)
  const tabs: { id: CarsTab; label: React.ReactNode }[] = [
    { id: 'garage', label: <><span className="tab-emo">🔧 </span>My Cars</> },
    { id: 'shop', label: <><span className="tab-emo">🚘 </span>For Sale</> },
    { id: 'book', label: <><span className="tab-emo">📖 </span>Collection{ready > 0 && <span className="tab-dot">{ready}</span>}</> },
    { id: 'crates', label: <><span className="tab-emo">📦 </span>Crates</> },
  ]
  const pick = (t: CarsTab) => {
    if (t === 'garage' || t === 'crates') return openPanel(t)
    if (onShowroom) return onShowroom(t)
    lastShowroomTab = t
    openPanel('showroom')
  }
  return <SheetTabs items={tabs} value={current} onChange={pick} />
}

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
  useEffect(() => { lastCars = 'showroom' }, [])
  const pickTab = (t: 'shop' | 'book') => {
    lastShowroomTab = t
    setTab(t)
  }
  const find = useFindCar((model) => {
    pickTab('shop')
    useGame.setState({ shopFocus: model })
  })
  return (
    <Panel title="Showroom" wide>
      <CarsTabs current={tab} onShowroom={pickTab} />
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
        {CARS.filter((c) => !c.rescueOnly && !c.season).map((c) => {
          const locked = level < c.unlockLevel
          const color = colorFor[c.id] ?? c.colors[0]
          const pi = performance(c, { engine: 0, turbo: 0, tires: 0, weight: 0 })
          return (
            <div key={c.id} data-id={c.id} className={`card car-card ${locked ? 'locked' : ''} ${focus === c.id ? 'focus' : ''}`}>
              <button className="thumb-look" aria-label={`Take a closer look at the ${c.name}`} onClick={() => setInspect(c.id)}>
                <CarThumb color={color} body={c.body} model={c.id} />
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
      {look && <CarInspect title={look.name} body={look.body} model={look.id} color={colorFor[look.id] ?? look.colors[0]} onClose={() => setInspect(null)} />}
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
  return <LovesTag model={model} />
}

// A car's mod skins with one slot changed (null takes that slot's skin off).
const withSlot = (m: OwnedCar['modSkin'], slot: SkinnedSlot, skin: string | null) => {
  const next = { ...m }
  if (skin) next[slot] = skin
  else delete next[slot]
  return next
}

type GarageTab = 'tune' | 'mods' | 'paint'
let nextGarageTab: GarageTab = 'tune'
// Opens the Garage on a given tab (goals use it for paint and mods).
export function openGarageTab(tab: GarageTab) {
  nextGarageTab = tab
  useGame.getState().openPanel('garage')
}

// Makes this the car every race uses (the Race menu's car bar picks it too).
function RaceCarToggle({ car }: { car: string }) {
  const on = useGame((s) => raceCarOf(s.cars, s.raceCar)?.uid === car)
  const pick = useGame((s) => s.setRaceCar)
  return (
    <button className={on ? 'showcase-toggle race-toggle on' : 'showcase-toggle race-toggle'} onClick={() => pick(car)} disabled={on} title="The car you race with, in every race and live challenge">
      {on ? '🏁 Racing' : '🏁 Race with'}
    </button>
  )
}

export function GaragePanel() {
  const cars = useGame((s) => s.cars)
  const selected = useGame((s) => s.selectedCar)
  const select = useGame((s) => s.selectCar)
  const upgrade = useGame((s) => s.upgradeCar)
  const sell = useGame((s) => s.sellCar)
  const car = cars.find((c) => c.uid === selected) ?? cars[0]
  const def = car && carDef(car.model)
  useEffect(() => { lastCars = 'garage' }, [])
  const [tab, setTab] = useState<GarageTab>(() => {
    const t = nextGarageTab
    nextGarageTab = 'tune'
    return t
  })
  // A mod being tried on in the preview, cleared when another car is picked.
  const [trying, setTrying] = useState<{ car: string; mod: string } | null>(null)
  const tryMod = trying && trying.car === car?.uid && tab === 'mods' ? trying.mod : null
  const [inspect, setInspect] = useState(false)
  const [picking, setPicking] = useState(false)
  const idx = Math.max(0, cars.findIndex((c) => c.uid === car?.uid))
  const step = (d: number) => select(cars[(idx + d + cars.length) % cars.length].uid)
  // A paint job being tried on, cleared when another car is picked.
  const [painting, setPainting] = useState<{ car: string; job: PaintJob } | null>(null)
  const tryJob = painting && painting.car === car?.uid && tab === 'paint' ? painting.job : null
  // A skin being tried on (null: trying no skin), cleared when another car is picked.
  const [skinning, setSkinning] = useState<{ car: string; skin: string | null } | null>(null)
  const trySkin = skinning && skinning.car === car?.uid && tab === 'paint' ? skinning.skin : undefined
  // A mod skin being tried on one slot's part, cleared when another car is picked.
  const [modSkinning, setModSkinning] = useState<{ car: string; slot: SkinnedSlot; skin: string | null } | null>(null)
  const tryModSkin = modSkinning && modSkinning.car === car?.uid && tab === 'mods' ? modSkinning : null
  const modSkin = car && tryModSkin ? withSlot(car.modSkin, tryModSkin.slot, tryModSkin.skin) : car?.modSkin
  const look = car && def && { body: def.body, model: def.id, ...(tryJob ?? jobOf(car)), skin: trySkin === undefined ? car.skin : trySkin, modSkin, mods: withMod(car.mods, tryMod) }
  // After an upgrade or a part goes on, the car does a dyno pull showing the old and new time.
  const pi = car && def ? performance(def, car.upgrades, car.mods) : 0
  const [dyno, setDyno] = useState<DynoRun | null>(null)
  const feed = useMemo<DynoFeed>(() => ({ rpm: 0, speed: 0 }), [])
  const lastPi = useRef<{ car: string; pi: number } | null>(null)
  // Only a gain right after a tap here counts, not a save arriving from another device.
  const tapped = useRef(0)
  useEffect(() => {
    if (!car) return
    const was = lastPi.current
    lastPi.current = { car: car.uid, pi }
    if (!was || was.car !== car.uid) return setDyno(null)
    if (pi <= was.pi || Date.now() - tapped.current > 1500) return
    setDyno((d) => ({ id: Date.now(), car: car.uid, model: car.model, mods: car.mods, before: d && d.car === car.uid ? d.before : was.pi, after: pi }))
  }, [car?.uid, pi])
  return (
    <Panel title={`My Garage · ${cars.length} cars · ⚡${garagePower(cars)}`} wide>
      <CarsTabs current="garage" />
      <div className={picking ? 'garage picking' : 'garage'}>
        <div className="garage-list">
          {cars.map((c) => {
            const d = carDef(c.model)
            return (
              <button key={c.uid} className={c.uid === car?.uid ? 'garage-item sel' : 'garage-item'} onClick={() => { select(c.uid); setPicking(false) }}>
                <CarThumb size="sm" color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} body={d.body} model={d.id} stripe={c.stripe} mods={c.mods} />
                <span>{d.name}{c.plate && <span className="mini-plate">{c.plate}</span>}</span>
                <small>PI {performance(d, c.upgrades, c.mods)}</small>
              </button>
            )
          })}
        </div>
        {car && def && (
          <div className="garage-detail" onClickCapture={() => { tapped.current = Date.now() }}>
            {/* Phones: step through cars here, or open the grid of all of them. */}
            <div className="car-switch">
              <button aria-label="Previous car" onClick={() => step(-1)} disabled={cars.length < 2}>‹</button>
              <button className="car-switch-name" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
                <b>{def.name}</b><small>{idx + 1}/{cars.length} {picking ? '▴' : '▾'}</small>
              </button>
              <button aria-label="Next car" onClick={() => step(1)} disabled={cars.length < 2}>›</button>
            </div>
            {inspect ? (
              <>
                <div className="car-preview" />
                <CarInspect title={def.name} {...look!} onClose={() => setInspect(false)} />
              </>
            ) : (
              <div className="preview-wrap">
                <CarPreview {...look!} onExpand={() => setInspect(true)} dyno={dyno ? feed : null}>
                  {dyno && <DynoOverlay key={dyno.id} run={dyno} feed={feed} onDone={() => setDyno(null)} />}
                </CarPreview>
                {tab === 'paint' && <div className="paint-sweep" key={`${look!.color}|${look!.finish}|${look!.stripe}|${look!.skin ?? ''}`} aria-hidden />}
              </div>
            )}
            <h3 className="garage-name">{def.name}{car.plate && <span className="mini-plate">{car.plate}</span>}</h3>
            <div className="car-tags">
              <span className="pi-badge">PI <b>{pi}</b></span>
              <SkillTag model={car.model} />
              <DriverRow car={car.uid} model={car.model} />
              <ShowcaseToggle car={car.uid} />
              <RaceCarToggle car={car.uid} />
            </div>
            <div className="garage-tabs" role="tablist">
              {([['tune', '🔧 Upgrades'], ['mods', '🪽 Mods'], ['paint', '🎨 Paint']] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'sel' : ''} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            {tab === 'mods' && <ModShop car={car} trying={tryMod} setTrying={(id) => setTrying(id ? { car: car.uid, mod: id } : null)} skinTry={tryModSkin} setSkinTry={(t) => setModSkinning(t ? { car: car.uid, ...t } : null)} />}
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
            {tab === 'paint' && <SkinPicker car={car} trying={trySkin} setTrying={(skin) => setSkinning(skin === undefined ? null : { car: car.uid, skin })} />}
            {tab === 'paint' && <PaintShop car={car} job={tryJob ?? jobOf(car)} setJob={(job) => setPainting(job ? { car: car.uid, job } : null)} />}
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
