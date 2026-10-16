import { mergeCandidates } from '../game/merge'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGame, hasRusty, buildPrice, gateLevel, type OwnedCar, type PlacedBuilding } from '../game/store'
import { raceCarOf } from '../game/raceCar'
import { stackCars, stackFace } from '../game/garageStacks'
import { reducedMotion } from '../game/fx'
import { activeEvent, garagePower, BUILDINGS, CARS, SKILLS, UPGRADE_SLOTS, MAX_UPGRADE, carDef, performance, upgradeCost, buildingDef, upgradable, loves, readySets, isBike, FEATURES, type BuildingDef } from '../game/data'
import { CarInspect, CarPreview, type DynoFeed } from '../scene/CarPreview'
import { usePauseTownUnder } from '../scene/renderGate'
import type { DynoRun } from './Dyno'
import { onDemand } from './lazy'
import { CollectAllButton } from './CollectAll'
import { GoalsButton } from './Goals'
import { rotateCurrent } from '../game/placement'
import { TRAFFIC, TRAFFIC_MIN, roadShare, roadsShort, trafficLevel } from '../game/traffic'
import { BuildingThumb, CarThumb } from '../scene/BuildingPreview'
import { ShopUpgrades } from './Upgrade'
import { ModShop, withMod } from './Mods'
import { CollectionBook, useFindCar } from './Collection'
import { PaintShop, jobOf } from './Paint'
import { TrimShop } from './Trim'
import type { Trim } from '../game/trim'
import { CustomShop } from './Custom'
import { HatShop, type HatTry } from './Hats'
import { SkinPicker } from './Skins'
import type { PaintJob, Panels, SkinnedSlot } from '../game/data'
import { CoinIcon, Icon } from './Icon'
import { useCrewGoal } from './CrewGoal'
import { useCrewBattle } from '../lib/battles'
import { useChat } from '../lib/chat'
import { useRivalWaiting } from './Rivals'
import { showTip, SkillTip, LovesTip } from './TapTip'
import { ShowcaseToggle } from './Meet'
import { tutTarget, tutorialShowing, type TutTarget } from './Tutorial'
import { buildingIcon } from './buildingIcons'
import { useTipTarget, type TipTarget } from './Tips'
import { setFreeCam, useFreeCam } from '../scene/freeCam'
import { Confirm, useAsk } from './Confirm'
import { AutoJobsButton } from './AutoJobs'
import { useUnlock, freshClass } from '../game/unlocks'
import './garage-env.css'

// The dyno run and its engine sound load the first time an upgrade shows on the dyno.
const DynoOverlay = onDemand(() => import('./Dyno'), (m) => m.DynoOverlay)

// Phones and tablets: no hover, so placing takes a preview tap first.
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export function BottomBar() {
  const openPanel = useGame((s) => s.openPanel)
  const setMode = useGame((s) => s.setMode)
  const mode = useGame((s) => s.mode)
  const visiting = useGame((s) => !!s.visiting)
  const setsReady = useGame((s) => readySets(s).length)
  // Same count as the Crew tab's dot, and the button opens that tab while a chest waits.
  const crewChests = useCrewGoal((g) => g.ready) + useCrewBattle((b) => b.ready)
  const crewChat = useChat((c) => c.unread.crew)
  const globalChat = useChat((c) => c.unread.global > 0)
  const chatPing = useChat((c) => c.pinged.global + c.pinged.crew > 0)
  const rival = useRivalWaiting()
  const tut = useGame(tutTarget)
  const tip = useTipTarget()
  const pulse = (t: TutTarget | TipTarget) => (tut === t || tip === t ? ' tut-pulse' : '')
  // New players get these one at a time (src/game/unlocks.ts).
  const shop = useUnlock('shop')
  const cars = useUnlock('cars')
  const social = useUnlock('social')
  const edit = useUnlock('edit')
  const race = useUnlock('race')
  const done = useUnlock('gems')
  if (visiting) return null
  if (mode !== 'play') return <EditBar />
  return (
    <>
      <div className="bottom-bar">
        {shop.on && <button className={`icon-btn${pulse('shop')}${freshClass(shop.fresh)}`} onClick={() => openPanel('shop')}><span className="i i-shop"><Icon name="shop" /></span>SHOP</button>}
        {cars.on && <button className={`icon-btn${pulse('cars')}${freshClass(cars.fresh)}`} onClick={() => openCars(setsReady > 0)}><span className="i i-showroom"><Icon name="car" />{setsReady > 0 && <span className="btn-dot">{setsReady}</span>}</span>CARS</button>}
        {social.on && <button className={`icon-btn${freshClass(social.fresh)}`} onClick={() => openPanel('friends')}><span className="i i-friends"><Icon name="friends" />{crewChests > 0 && <span className="btn-dot">{crewChests}</span>}</span>SOCIAL</button>}
        {social.on && <button className={`icon-btn${freshClass(social.fresh)}`} onClick={() => openPanel('chat')}><span className="i i-chat"><Icon name="chat" />{chatPing ? <span className="btn-dot" title="You were mentioned">@</span> : crewChat > 0 ? <span className="btn-dot">{crewChat > 9 ? '9+' : crewChat}</span> : globalChat && <span className="btn-dot new" />}</span>CHAT</button>}
        {edit.on && <button className={`icon-btn${freshClass(edit.fresh)}`} onClick={() => setMode(useGame.getState().tutorial >= 99 ? 'road' : 'move')}><span className="i i-edit"><Icon name="cone" /></span>EDIT</button>}
        {race.on && <button className={`big-btn race-btn${pulse('race')}${freshClass(race.fresh)}`} onClick={() => openPanel('race')}><span className="i"><Icon name="flag" />{rival && <span className="btn-dot" title="Your rival is in town">!</span>}</span>RACE</button>}
      </div>
      {social.on && <FreeCamButton />}
      {done.on && <GoalsButton />}
      {done.on && <CollectAllButton />}
    </>
  )
}

// The first couple of times, a one-line toast says how to steer.
export function toggleFreeCam(on: boolean) {
  setFreeCam(on)
  if (!on) return
  try {
    const seen = Number(localStorage.getItem('cartopia-freecam-tips')) || 0
    if (seen >= 2) return
    localStorage.setItem('cartopia-freecam-tips', String(seen + 1))
  } catch {
    // No storage: show it every time.
  }
  useGame.getState().toast(TOUCH ? 'Pinch to zoom · two fingers to turn and tilt' : 'WASD to fly · Space up, Shift down · Ctrl for speed')
}

// Switches the town between the bird's-eye view and the free camera. Sits over
// Goals at home, and on the visit banner in someone else's town.
export function FreeCamButton({ className = 'goals-btn cam-dock' }: { className?: string }) {
  const on = useFreeCam((f) => f.on)
  const label = on ? "Back to bird's-eye view" : 'Free camera'
  return (
    <button className={`${className}${on ? ' on' : ''}`} onClick={() => toggleFreeCam(!on)} title={label} aria-label={label} aria-pressed={on}>
      <Icon name={on ? 'birdseye' : 'orbit'} />
    </button>
  )
}

// Edit mode: how much of the town is road. Under 15% it jams (src/game/traffic.ts).
function TrafficMeter() {
  const share = useGame((s) => roadShare(s.roads, s.land))
  const short = useGame((s) => roadsShort(s.roads, s.land))
  const t = TRAFFIC[trafficLevel(share)]
  const pct = Math.round(share * 100)
  return (
    <div className="traffic-meter" style={{ '--tc': t.c } as React.CSSProperties} title={`Roads ${pct}% of your land, aim for ${Math.round(TRAFFIC_MIN * 100)}%+`}>
      <span aria-hidden>{t.icon}</span>
      <b>{t.name}</b>
      <i className="tm-bar"><i style={{ width: `${Math.min(100, (share / (TRAFFIC_MIN * 2)) * 100)}%` }} /><i className="tm-min" /></i>
      <small>{short ? `+${short} 🛣️` : `${pct}%`}</small>
    </div>
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
  const storedCount = useGame((s) => s.stored?.length ?? 0)
  const tutDone = useGame((s) => tutTarget(s) === 'done')
  const tutCard = useGame(tutorialShowing)
  // During the tutorial the bar keeps to placing and moving; roads, land and the rest come after.
  const all = useGame((s) => s.tutorial >= 99)
  const canMerge = useGame((s) => (s.mode === 'merge' ? mergeCandidates(s.buildings).length > 0 || s.buildings.some((b) => b.merge) : true))
  const hint =
    mode === 'expand' ? 'Tap a For Sale sign to buy land'
    : mode === 'merge' ? (canMerge ? 'Tap a Merge badge to combine buildings' : 'Line up 2 or 4 matching buildings · up to +50% 💰')
    : mode === 'road' ? 'Drag to lay road · $10 a tile'
    : mode === 'bulldoze' ? 'Drag to remove · buildings go to Inventory'
    : mode === 'move' && again && selected ? 'Built! Drag or rotate it'
    : mode === 'move' ? (selected ? 'Drag to move, or rotate it' : 'Drag a building, or tap one to pick it')
    : `${TOUCH ? 'Tap to preview, tap again to build' : 'Click to place'} ${placing ? BUILDINGS.find((b) => b.id === placing)?.name : ''}`
  return (
    <div className="edit-bar">
      {!tutCard && <div className="edit-hint">{hint}</div>}
      {!tutCard && all && <TrafficMeter />}
      <div className="edit-tools">
        {all && <button className={mode === 'road' ? 'tool active' : 'tool'} onClick={() => setMode('road')}><Icon name="road" size={22} /><span>Road</span></button>}
        {all && <button className={mode === 'bulldoze' ? 'tool active' : 'tool'} onClick={() => setMode('bulldoze')}><Icon name="bulldoze" size={22} /><span>Bulldoze</span></button>}
        <button className={mode === 'move' ? 'tool active' : 'tool'} onClick={() => setMode('move')}><Icon name="move" size={22} /><span>Move</span></button>
        {all && <button className={mode === 'expand' ? 'tool active' : 'tool'} onClick={() => setMode('expand')}><Icon name="land" size={22} /><span>Land</span></button>}
        {all && <button className={mode === 'merge' ? 'tool active' : 'tool'} onClick={() => setMode('merge')}><Icon name="merge" size={22} /><span>Merge</span></button>}
        {((mode === 'place' && placing) || (mode === 'move' && selected)) && <button className="tool" onClick={rotateCurrent} title="Rotate (R)"><Icon name="rotate" size={22} /><span>Rotate</span></button>}
        {mode === 'move' && selected && canUpgrade && <button className="tool" onClick={() => openUpgrade(selected)}><Icon name="up" size={22} /><span>Upgrade</span></button>}
        {mode === 'move' && again && <button className="tool" onClick={() => setMode('place', again)}><Icon name="plus" size={22} /><span>Again</span></button>}
        {all && <button className="tool" onClick={() => openPanel('inventory')}><Icon name="box" size={22} /><span>Inventory</span>{storedCount > 0 && <b className="tool-count">{storedCount}</b>}</button>}
        {all && <button className="tool" onClick={() => openPanel('shop')}><Icon name="shop" size={22} /><span>Shop</span></button>}
        <button className={tutDone ? 'tool done tut-pulse' : 'tool done'} onClick={() => setMode('play')}><Icon name="check" size={22} /><span>Done</span></button>
      </div>
    </div>
  )
}

// A menu that takes another's place (a tab between sibling menus, or going back to the
// previous menu) appears in place: replaying the slide-in made the menu flash down and up.
let panelsUp = 0
let panelGoneAt = -Infinity

// onBack: shows a back button before the title (a sub-screen of the panel).
// head: extra bits in the title bar, before the close button.
export function Panel({ title, children, wide, onClose, onBack, head, className }: { title: string; children: React.ReactNode; wide?: boolean; onClose?: () => void; onBack?: () => void; head?: React.ReactNode; className?: string }) {
  const closePanel = useGame((s) => s.closePanel)
  // Slides away before it unmounts; the timer dies with the panel, so a panel
  // swapped in meanwhile is never closed by it.
  const [closing, setClosing] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const box = useRef<HTMLDivElement>(null)
  usePauseTownUnder(box)
  const [still] = useState(() => panelsUp > 0 || Date.now() - panelGoneAt < 250)
  useLayoutEffect(() => {
    panelsUp++
    return () => {
      panelsUp--
      panelGoneAt = Date.now()
    }
  }, [])
  const close = (_: null) => {
    const done = () => (onClose ? onClose() : closePanel())
    // Going back to the previous menu: swap straight to it rather than slide away and back.
    if (reducedMotion() || (!onClose && useGame.getState().panelBack.length > 0)) return done()
    if (closing) return
    setClosing(true)
    timer.current = window.setTimeout(done, 170)
  }
  return (
    <div className={closing ? 'overlay closing' : still ? 'overlay still' : 'overlay'} onClick={() => close(null)}>
      <div ref={box} className={`${wide ? 'panel wide' : 'panel'}${className ? ` ${className}` : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          {onBack && <button className="panel-back" aria-label="Back" onClick={onBack}><Icon name="back" size={18} /></button>}
          {/* long titles (a garage with its stats) step down a size so they don't cut off */}
          <h2 className={title.length > 14 ? 'long' : undefined} title={title}>{title}</h2>
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

// Tabs across the top of a menu, sticky while its body scrolls. When the row
// is wider than the screen, a › arrow at the edge shows there are more tabs.
export function SheetTabs<T extends string>({ items, value, onChange }: { items: readonly { id: T; label: React.ReactNode }[]; value: T; onChange: (id: T) => void }) {
  const row = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = row.current
    if (!el) return
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check)
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', check)
      ro?.disconnect()
    }
  }, [items.length])
  // Bring the picked tab into view by scrolling only the row: scrollIntoView would also
  // scroll the page while a menu slides in, pushing its header off the top.
  useEffect(() => {
    const el = row.current
    const sel = el?.querySelector<HTMLElement>('.sel')
    if (!el || !sel) return
    const r = el.getBoundingClientRect()
    const t = sel.getBoundingClientRect()
    if (t.left < r.left) el.scrollLeft -= r.left - t.left
    else if (t.right > r.right) el.scrollLeft += t.right - r.right
  }, [value])
  return (
    <div ref={row} className="sheet-tabs" role="tablist">
      {items.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className={t.id === value ? 'sel' : ''} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
      {more && <button className="sheet-more" aria-label="More tabs" onClick={() => row.current?.scrollBy({ left: row.current.clientWidth * 0.7, behavior: 'smooth' })}>›</button>}
    </div>
  )
}

// Businesses that work on cars sit with the car shops.
const CAR_CARE = new Set(['carwash', 'bodyshop'])
type ShopTab = 'cars' | 'business' | 'homes' | 'services' | 'rec' | 'event' | 'upgrades'
const SHOP_GROUPS: { id: Exclude<ShopTab, 'upgrades'>; label: React.ReactNode; filter: (b: BuildingDef) => boolean }[] = [
  { id: 'cars', label: '🔧 Car shops', filter: (b) => b.id === 'rescue' || b.kind === 'parts' || CAR_CARE.has(b.id) },
  { id: 'business', label: '🍕 Businesses', filter: (b) => b.kind === 'business' && b.id !== 'rescue' && b.id !== 'crew' && !b.service && !b.rec && !b.event && !CAR_CARE.has(b.id) },
  { id: 'homes', label: '🏠 Homes', filter: (b) => b.kind === 'house' },
  { id: 'services', label: '⛽ Services', filter: (b) => b.kind === 'gas' || b.id === 'crew' || !!b.service },
  { id: 'rec', label: <>🎡 Rec<span className="tab-long">reation</span></>, filter: (b) => (b.kind === 'decor' || !!b.rec) && !b.event },
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

const NONE: PlacedBuilding[] = []

// Rusty's first, then the other buildings that open up a feature.
const featureRank = (b: { id: string }) => (b.id === 'rescue' ? 2 : FEATURES[b.id] ? 1 : 0)

export function ShopPanel() {
  const level = useGame((s) => s.level)
  const gate = useGame(gateLevel)
  const coins = useGame((s) => s.coins)
  const bucks = useGame((s) => s.bucks)
  const setMode = useGame((s) => s.setMode)
  const buildings = useGame((s) => s.buildings)
  const stored = useGame((s) => s.stored ?? NONE)
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
  // A search looks through every tab at once.
  const [find, setFind] = useState('')
  const term = find.trim().toLowerCase()
  const group = term ? null : SHOP_GROUPS.find((g) => g.id === tab)
  const shown = term
    ? BUILDINGS.filter((b) => b.unlockLevel < 99 && b.name.toLowerCase().includes(term) && SHOP_GROUPS.some((g) => (g.id !== 'event' || ev) && g.filter(b)))
    : group ? BUILDINGS.filter((b) => b.unlockLevel < 99 && group.filter(b)) : []
  const rows = shown.map((b) => {
    const locked = gate < b.unlockLevel
    const sale = buildPrice({ deals, level }, b.id)
    // Gem decor (the statue, the arch) is short on gems, not coins.
    const brokeGems = bucks < sale.bucks
    const broke = coins < sale.coins || brokeGems
    const owned = !!b.unique && [...buildings, ...stored].some((o) => o.def === b.id)
    // Ready to build first, then short of money, then locked by level, built last.
    const rank = owned ? 3 : locked ? 2 : broke ? 1 : 0
    return { b, locked, sale, brokeGems, broke, owned, rank }
  }).sort((x, y) => (y.rank < 2 ? featureRank(y.b) : 0) - (x.rank < 2 ? featureRank(x.b) : 0) || x.rank - y.rank || x.b.unlockLevel - y.b.unlockLevel || x.b.price - y.b.price)
  return (
    <Panel title="Shop" wide>
      <SheetTabs items={tabs} value={tab} onChange={(t) => { setFind(''); setTab(t) }} />
      <label className="shop-find">
        <span aria-hidden>🔍</span>
        <input type="search" value={find} placeholder="Find a building" aria-label="Find a building" onChange={(e) => setFind(e.target.value)} />
        {find && <button aria-label="Clear" onClick={() => setFind('')}>✕</button>}
      </label>
      {!term && tab === 'upgrades' && <ShopUpgrades />}
      {term && !rows.length && <p className="shop-none">🔍 No match</p>}
      {(group || term) && (
          <div className="cards rows">
            {rows.map(({ b, locked, sale, brokeGems, broke, owned }) => {
              const highlight = b.id === 'rescue' && !rusty
              const feature = !highlight && !locked && !!FEATURES[b.id] && !buildings.some((o) => o.def === b.id)
              const focused = b.id === focus
              return (
                <button
                  key={b.id}
                  ref={focused ? focusRef : undefined}
                  className={`card ${locked ? 'locked' : ''} ${broke && !locked ? 'broke' : ''} ${highlight ? 'start-here' : ''} ${focused ? 'focus' : ''}`}
                  disabled={owned}
                  onClick={() => (locked ? showNeed('level', b.unlockLevel, b.name) : brokeGems ? showNeed('bucks', sale.bucks - bucks, b.name) : broke ? showNeed('coins', sale.coins - coins, b.name) : setMode('place', b.id))}
                >
                  {highlight && <span className="ribbon">START HERE</span>}
                  {feature && <span className="ribbon feature">★ NEW FEATURE</span>}
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
                    {FEATURES[b.id] && <div className="card-stat feature-line">✨ {FEATURES[b.id][0].toUpperCase() + FEATURES[b.id].slice(1)}</div>}
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
  // Tabs swap between sibling menus, so closing still goes back to where the player came from.
  const openPanel = useGame((s) => s.swapPanel)
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

const BODY_LABEL: Record<string, string> = { dogvan: 'Dog van', ev: 'EV', suv: 'SUV', icecream: 'Ice cream', parcel: 'Parcel van', monster: 'Monster truck' }
const bodyLabel = (b: string) => BODY_LABEL[b] ?? b[0].toUpperCase() + b.slice(1)

type SaleSort = 'level' | 'cheap' | 'dear' | 'pi' | 'name'
const SALE_SORTS: { id: SaleSort; label: string }[] = [
  { id: 'level', label: 'Level' }, { id: 'cheap', label: 'Price ↑' }, { id: 'dear', label: 'Price ↓' }, { id: 'pi', label: 'Top PI' }, { id: 'name', label: 'A–Z' },
]
// The For Sale tab reopens with the filter and order it was left on.
let saleView: { kind: string; sort: SaleSort } = { kind: 'all', sort: 'level' }
const FOR_SALE = CARS.filter((c) => !c.rescueOnly && !c.season && !c.secret && !c.pack)

export function ShowroomPanel() {
  const level = useGame(gateLevel) // only for level locks here
  const coins = useGame((s) => s.coins)
  const bucks = useGame((s) => s.bucks)
  const cars = useGame((s) => s.cars)
  const buyCar = useGame((s) => s.buyCar)
  const rusty = useGame((s) => hasRusty(s))
  const openShop = useGame((s) => s.openShop)
  const [colorFor, setColorFor] = useState<Record<string, string>>({})
  const [inspect, setInspect] = useState<string | null>(null)
  const { body, focus } = useShopFocus()
  const look = inspect ? carDef(inspect) : null
  // Opened to show a car (level-up splash, a driver's fans): the For Sale tab, where it is.
  const [tab, setTab] = useState<'shop' | 'book'>(() => (focus ? 'shop' : lastShowroomTab))
  useEffect(() => { lastCars = 'showroom' }, [])
  const pickTab = (t: 'shop' | 'book') => {
    lastShowroomTab = t
    setTab(t)
  }
  // A car being shown is never hidden by the filter.
  const [view, setViewState] = useState(() => (focus ? (saleView = { ...saleView, kind: 'all' }) : saleView))
  const setView = (v: Partial<typeof view>) => setViewState((o) => (saleView = { ...o, ...v }))
  const find = useFindCar((model) => {
    pickTab('shop')
    setView({ kind: 'all' })
    useGame.setState({ shopFocus: model })
  })
  const owned = useMemo(() => {
    const n = new Map<string, number>()
    for (const c of cars) n.set(c.model, (n.get(c.model) ?? 0) + 1)
    return n
  }, [cars])
  const afford = (c: typeof CARS[0]) => coins >= c.price && bucks >= (c.bucks ?? 0)
  const canBuy = (c: typeof CARS[0]) => rusty && level >= c.unlockLevel && afford(c)
  // Filters with counts; a body type is offered only when more than one car has it.
  const kinds = useMemo(() => {
    const n = new Map<string, number>()
    for (const c of FOR_SALE) n.set(c.body, (n.get(c.body) ?? 0) + 1)
    const out = [
      { id: 'all', label: `All (${FOR_SALE.length})` },
      { id: 'buy', label: `Can buy (${FOR_SALE.filter(canBuy).length})` },
      { id: 'new', label: `Not owned (${FOR_SALE.filter((c) => !owned.has(c.id)).length})` },
    ]
    for (const [b, k] of [...n].sort((a, z) => a[0].localeCompare(z[0]))) if (k > 1) out.push({ id: b, label: `${bodyLabel(b)} (${k})` })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned, coins, bucks, level, rusty])
  const kind = kinds.some((k) => k.id === view.kind) ? view.kind : 'all'
  const list = useMemo(() => {
    const keep = FOR_SALE.filter((c) => kind === 'all' || (kind === 'buy' ? canBuy(c) : kind === 'new' ? !owned.has(c.id) : c.body === kind))
      .map((c, i) => ({ c, i, gate: level < c.unlockLevel ? c.unlockLevel : 0, pi: performance(c, { engine: 0, turbo: 0, tires: 0, weight: 0 }), cost: c.price + (c.bucks ?? 0) * 1000 }))
    const by: Record<SaleSort, (a: typeof keep[0], b: typeof keep[0]) => number> = {
      // Cars you can buy now first, then level-locked ones by the level they open at.
      level: (a, b) => a.gate - b.gate || a.i - b.i,
      cheap: (a, b) => a.cost - b.cost,
      dear: (a, b) => b.cost - a.cost,
      pi: (a, b) => b.pi - a.pi,
      name: (a, b) => a.c.name.localeCompare(b.c.name),
    }
    return keep.sort(by[view.sort])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, view.sort, owned, level, coins, bucks, rusty])
  return (
    <Panel title="Cars" wide>
      <CarsTabs current={tab} onShowroom={pickTab} />
      {tab === 'book' && <CollectionBook onFind={find} />}
      {tab === 'shop' && <>
      {!rusty && (
        <div className="rusty-lock">
          <span className="rusty-icon">🔧</span>
          <div>
            <b>Build Rusty's Rescue first</b>
          </div>
          <button className="buy" onClick={() => openShop('rescue')}>Build · $1,000</button>
        </div>
      )}
      <div className="garage-filter sale-filter">
        <label className="gf-pick">
          <Icon name="filter" />
          <select aria-label="Show" value={kind} onChange={(e) => setView({ kind: e.target.value })}>
            {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
        <label className="gf-pick">
          <Icon name="sort" />
          <select aria-label="Sort" value={view.sort} onChange={(e) => setView({ sort: e.target.value as SaleSort })}>
            {SALE_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <div ref={body} className={rusty ? 'cards' : 'cards dimmed'}>
        {list.map(({ c, pi }) => {
          const locked = level < c.unlockLevel
          const color = colorFor[c.id] ?? c.colors[0]
          const have = owned.get(c.id) ?? 0
          return (
            <div key={c.id} data-id={c.id} className={`card car-card ${locked ? 'locked' : ''} ${focus === c.id ? 'focus' : ''}`}>
              <button className="thumb-look" aria-label={`Take a closer look at the ${c.name}`} onClick={() => setInspect(c.id)}>
                <CarThumb color={color} body={c.body} model={c.id} />
                <span className="look-badge">🔍</span>
                {have > 0 && <span className="owned-badge" title="In your garage">✔{have > 1 ? ` ×${have}` : ''}</span>}
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
                <button className={afford(c) ? 'buy' : 'buy broke'} disabled={!rusty} onClick={() => buyCar(c.id, color)}>Buy {price(c)}</button>
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
  return (
    <button type="button" className="skill-tag" aria-label={`${SKILLS[sk].name}: ${SKILLS[sk].text}`} onClick={(e) => showTip(e.currentTarget, <SkillTip sk={sk} />)}>
      {SKILLS[sk].icon} {SKILLS[sk].name}
    </button>
  )
}

// The businesses a car loves to drive for, as one row of icons: ❤️ 🍕 🍩 🎬.
export function LovesTag({ model }: { model: string }) {
  const likes = carDef(model).likes
  if (!likes.length) return null
  const names = likes.map((id) => buildingDef(id).name)
  return (
    <button type="button" className="loves-tag" aria-label={`Favorite Job: ${names.join(', ')}: +25% coins per job`} onClick={(e) => showTip(e.currentTarget, <LovesTip likes={likes} />)}>
      ❤️{likes.map((id) => <span key={id} className="loves-ico">{buildingIcon(id)}</span>)}
    </button>
  )
}

// Where a car works, or which businesses it would love to.
function DriverRow({ car, model }: { car: string; model: string }) {
  const job = useGame((s) => s.buildings.find((b) => b.car === car))
  const openUpgrade = useGame((s) => s.openUpgrade)
  const def = carDef(model)
  if (job) {
    const d = buildingDef(job.def)
    return (
      <button className="driver-row" onClick={() => openUpgrade(job.uid)} title={`Drives for your ${d.name} · ${loves(def, d.id) ? '+25%' : '+10%'} coins`} aria-label={`Drives for your ${d.name}`}>
        <span aria-hidden>{buildingIcon(d.id)}</span>{loves(def, d.id) && <span aria-hidden>❤️</span>}<b>+{loves(def, d.id) ? 25 : 10}%</b><CoinIcon size={16} />
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

type GarageTab = 'tune' | 'mods' | 'paint' | 'custom' | 'trim' | 'hats'
let nextGarageTab: GarageTab = 'tune'
// Something to try on when the Garage opens (a crate prize): a part, a paint, a colour, a mod paint
// on one slot or a hat, on this car. Nothing is fitted until the player taps the Garage's own button.
export type GarageTry = { car: string; mod?: string; skin?: string; modSkin?: { slot: SkinnedSlot; skin: string }; color?: string; hat?: string }
let nextTry: GarageTry | null = null
// Opens the Garage on a given tab (goals use it for paint and mods), optionally with that
// car picked and something on try-on.
export function openGarageTab(tab: GarageTab, tryOn?: GarageTry) {
  nextGarageTab = tab
  nextTry = tryOn ?? null
  if (tryOn) useGame.getState().selectCar(tryOn.car)
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

// My Cars list filter and sort, kept while the game is open. Default: top PI first.
type CarSort = 'pi' | 'pi-low' | 'name' | 'new'
const CAR_SORTS: { id: CarSort; label: string }[] = [
  { id: 'pi', label: 'Top PI' }, { id: 'pi-low', label: 'Low PI' }, { id: 'name', label: 'A–Z' }, { id: 'new', label: 'Newest' },
]
let garageView: { kind: string; sort: CarSort } = { kind: 'all', sort: 'pi' }

function useGarageList(cars: OwnedCar[]) {
  const [view, setViewState] = useState(garageView)
  const setView = (v: Partial<typeof view>) => setViewState((o) => (garageView = { ...o, ...v }))
  const rows = useMemo(() => cars.map((c, i) => {
    const d = carDef(c.model)
    return { c, d, i, pi: performance(d, c.upgrades, c.mods) }
  }), [cars])
  // Only offer kinds the player owns, with counts.
  const kinds = useMemo(() => {
    const n = new Map<string, number>()
    for (const r of rows) n.set(r.d.body, (n.get(r.d.body) ?? 0) + 1)
    const out = [{ id: 'all', label: `All (${rows.length})` }]
    const legend = rows.filter((r) => r.d.legendary).length
    if (legend) out.push({ id: 'legendary', label: `★ Legendary (${legend})` })
    const bikes = rows.filter((r) => isBike(r.d.body)).length
    if (bikes && bikes < rows.length) out.push({ id: 'bikes', label: `Bikes (${bikes})` })
    for (const [b, k] of [...n].sort((a, z) => a[0].localeCompare(z[0]))) out.push({ id: b, label: `${bodyLabel(b)} (${k})` })
    return out
  }, [rows])
  const kind = kinds.some((k) => k.id === view.kind) ? view.kind : 'all'
  const list = useMemo(() => {
    const keep = rows.filter((r) => kind === 'all' || (kind === 'legendary' ? r.d.legendary : kind === 'bikes' ? isBike(r.d.body) : r.d.body === kind))
    const by: Record<CarSort, (a: typeof rows[0], b: typeof rows[0]) => number> = {
      pi: (a, b) => b.pi - a.pi || a.d.name.localeCompare(b.d.name),
      'pi-low': (a, b) => a.pi - b.pi || a.d.name.localeCompare(b.d.name),
      name: (a, b) => a.d.name.localeCompare(b.d.name) || b.pi - a.pi,
      new: (a, b) => b.i - a.i,
    }
    return keep.sort(by[view.sort])
  }, [rows, kind, view.sort])
  // Copies of one model share a card, placed where its best-sorted copy would be.
  const stacks = useMemo(() => stackCars(list), [list])
  return { stacks, kinds, kind, sort: view.sort, setView }
}

type GarageRow = ReturnType<typeof useGarageList>['stacks'][0]['top']

// One round avatar per copy of a car; tapping one opens that copy.
function CopyBubbles({ copies, selected, onPick }: { copies: GarageRow[]; selected?: string; onPick: (uid: string) => void }) {
  return (
    <div className="copy-bubbles">
      {copies.map(({ c, d, pi }) => (
        <button key={c.uid} className={c.uid === selected ? 'copy-bubble sel' : 'copy-bubble'} aria-label={`${d.name} PI ${pi}`} aria-pressed={c.uid === selected} title={`PI ${pi}`} onClick={() => onPick(c.uid)}>
          <CarThumb size="xs" color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} panels={c.panels} trim={c.trim} hat={c.hat} body={d.body} model={d.id} stripe={c.stripe} mods={c.mods} />
          <small>{pi}</small>
        </button>
      ))}
    </div>
  )
}

export function GaragePanel() {
  const cars = useGame((s) => s.cars)
  const selected = useGame((s) => s.selectedCar)
  const select = useGame((s) => s.selectCar)
  const upgrade = useGame((s) => s.upgradeCar)
  const sell = useGame((s) => s.sellCar)
  const sellAsk = useAsk('askSell')
  const { stacks, kinds, kind, sort, setView } = useGarageList(cars)
  const car = cars.find((c) => c.uid === selected) ?? stacks[0]?.top.c ?? cars[0]
  const def = car && carDef(car.model)
  useEffect(() => { lastCars = 'garage' }, [])
  const [tab, setTab] = useState<GarageTab>(() => {
    const t = nextGarageTab
    nextGarageTab = 'tune'
    return t
  })
  const [pre] = useState(() => {
    const t = nextTry
    nextTry = null
    return t
  })
  // A mod being tried on in the preview, cleared when another car is picked.
  const [trying, setTrying] = useState<{ car: string; mod: string } | null>(pre?.mod ? { car: pre.car, mod: pre.mod } : null)
  const tryMod = trying && trying.car === car?.uid && tab === 'mods' ? trying.mod : null
  const [inspect, setInspect] = useState(false)
  const [picking, setPicking] = useState(false)
  const hole = useRef<HTMLDivElement>(null)
  // Arrows step through the filtered, sorted stacks, landing on each one's top-PI copy.
  const pos = stacks.findIndex((s) => s.copies.some((r) => r.c.uid === car?.uid))
  const copies = pos < 0 ? [] : stacks[pos].copies
  const step = (d: number) => {
    if (!stacks.length) return
    const at = pos < 0 ? (d > 0 ? -1 : 0) : pos
    select(stacks[(at + d + stacks.length) % stacks.length].top.c.uid)
  }
  // A paint job being tried on, cleared when another car is picked.
  const [painting, setPainting] = useState<{ car: string; job: PaintJob } | null>(() => {
    const c = pre && cars.find((x) => x.uid === pre.car)
    return c && pre.color && pre.color !== c.color ? { car: c.uid, job: { ...jobOf(c), color: pre.color } } : null
  })
  const tryJob = painting && painting.car === car?.uid && tab === 'paint' ? painting.job : null
  // A skin being tried on (null: trying no skin), cleared when another car is picked.
  const [skinning, setSkinning] = useState<{ car: string; skin: string | null } | null>(pre?.skin ? { car: pre.car, skin: pre.skin } : null)
  const trySkin = skinning && skinning.car === car?.uid && tab === 'paint' ? skinning.skin : undefined
  // A mod skin being tried on one slot's part, cleared when another car is picked.
  const [modSkinning, setModSkinning] = useState<{ car: string; slot: SkinnedSlot; skin: string | null } | null>(pre?.modSkin ? { car: pre.car, ...pre.modSkin } : null)
  const tryModSkin = modSkinning && modSkinning.car === car?.uid && tab === 'mods' ? modSkinning : null
  // Custom panel paint being tried on, cleared when another car is picked.
  const [customising, setCustomising] = useState<{ car: string; panels: Panels } | null>(null)
  const tryPanels = customising && customising.car === car?.uid && tab === 'custom' ? customising.panels : null
  // Trim being tried on, cleared when another car is picked.
  const [trimming, setTrimming] = useState<{ car: string; trim: Trim } | null>(null)
  const tryTrim = trimming && trimming.car === car?.uid && tab === 'trim' ? trimming.trim : null
  // A hat being tried on (null: trying no hat), cleared when another car is picked.
  const [hatting, setHatting] = useState<{ car: string; hat: HatTry } | null>(pre?.hat ? { car: pre.car, hat: { id: pre.hat } } : null)
  const tryHat = hatting && hatting.car === car?.uid && tab === 'hats' ? hatting.hat : undefined
  const modSkin = car && tryModSkin ? withSlot(car.modSkin, tryModSkin.slot, tryModSkin.skin) : car?.modSkin
  const look = car && def && { body: def.body, model: def.id, ...(tryJob ?? jobOf(car)), skin: trySkin === undefined ? car.skin : trySkin, modSkin, panels: tryPanels ?? car.panels, trim: tryTrim ?? car.trim, mods: withMod(car.mods, tryMod), hat: tryHat === undefined ? car.hat : tryHat }
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
    <Panel title="Cars" wide className="garage-env" head={<><span className="cars-power" title="Garage power">⚡{garagePower(cars)}</span><AutoJobsButton /></>}>
      <CarsTabs current="garage" />
      <div className={picking ? 'garage picking' : 'garage'}>
        {/* The car stands in the Showroom, which fills the whole menu; the list and the car's
            details float over it, and this hole is the part of the room the car is framed in. */}
        {car && def && look && (
          <div className="garage-scene">
            {inspect ? null : (
              <CarPreview {...look} onExpand={() => setInspect(true)} dyno={dyno ? feed : null} frameIn={hole} />
            )}
          </div>
        )}
        <div className="garage-hole" ref={hole} onClickCapture={() => { tapped.current = Date.now() }}>
          {car && def && look && !inspect && (
            <>
              {dyno && <DynoOverlay key={dyno.id} run={dyno} feed={feed} onDone={() => setDyno(null)} />}
              {tab === 'paint' && <div className="paint-sweep" key={`${look.color}|${look.finish}|${look.stripe}|${look.skin ?? ''}`} aria-hidden />}
              {tab === 'custom' && <div className="paint-sweep" key={JSON.stringify(look.panels ?? {})} aria-hidden />}
              {tab === 'trim' && <div className="paint-sweep" key={JSON.stringify(look.trim ?? {})} aria-hidden />}
              {!dyno && <div className="car-pi" title="Performance Index"><b>{pi}</b><small>PI</small></div>}
            </>
          )}
        </div>
        {inspect && car && def && <CarInspect title={def.name} {...look!} onClose={() => setInspect(false)} />}
        <div className="garage-list">
          <div className="garage-filter">
            <label className="gf-pick">
              <Icon name="filter" />
              <select aria-label="Show" value={kind} onChange={(e) => setView({ kind: e.target.value })}>
                {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </label>
            <label className="gf-pick">
              <Icon name="sort" />
              <select aria-label="Sort" value={sort} onChange={(e) => setView({ sort: e.target.value as CarSort })}>
                {CAR_SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </div>
          {stacks.map((s) => {
            const { c, d, pi: p } = stackFace(s, car?.uid)
            const on = c.uid === car?.uid
            const main = (
              <>
                <CarThumb size="sm" color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} panels={c.panels} trim={c.trim} hat={c.hat} body={d.body} model={d.id} stripe={c.stripe} mods={c.mods} />
                <span>{d.name}{c.plate && <span className="mini-plate">{c.plate}</span>}</span>
                <small>PI {p}</small>
              </>
            )
            const open = (uid: string) => { select(uid); setPicking(false) }
            if (s.copies.length < 2) return <button key={s.model} className={on ? 'garage-item sel' : 'garage-item'} onClick={() => open(c.uid)}>{main}</button>
            return (
              <div key={s.model} className={on ? 'garage-item stack sel' : 'garage-item stack'}>
                <button className="stack-main" onClick={() => open(c.uid)}>
                  {main}
                  <b className="stack-count">×{s.copies.length}</b>
                </button>
                <CopyBubbles copies={s.copies} selected={car?.uid} onPick={open} />
              </div>
            )
          })}
        </div>
        {car && def && (
          <div className="garage-detail" onClickCapture={() => { tapped.current = Date.now() }}>
            {/* Phones: step through cars here, or open the grid of all of them. */}
            <div className="car-switch">
              <button aria-label="Previous car" onClick={() => step(-1)} disabled={stacks.length < (pos < 0 ? 1 : 2)}>‹</button>
              <button className="car-switch-name" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
                <b>{def.name}</b><small>{pos < 0 ? '–' : pos + 1}/{stacks.length} {picking ? '▴' : '▾'}</small>
              </button>
              <button aria-label="Next car" onClick={() => step(1)} disabled={stacks.length < (pos < 0 ? 1 : 2)}>›</button>
            </div>
            {copies.length > 1 && <CopyBubbles copies={copies} selected={car.uid} onPick={select} />}
            <h3 className="garage-name">{def.name}{car.plate && <span className="mini-plate">{car.plate}</span>}</h3>
            {/* Under the preview (PI sits on the preview itself): the car's traits, then its two toggles. */}
            <div className="car-sum">
              <div className="car-traits">
                <SkillTag model={car.model} />
                <DriverRow car={car.uid} model={car.model} />
              </div>
              <div className="car-toggles">
                <RaceCarToggle car={car.uid} />
                <ShowcaseToggle car={car.uid} />
              </div>
            </div>
            <div className="garage-tabs" role="tablist">
              {([['tune', '🔧', 'Upgrades'], ['mods', '🪽', 'Mods'], ['paint', '🎨', 'Paint'], ['custom', '🖌️', 'Custom'], ['trim', '✨', 'Trim'], ['hats', '🎩', 'Hats']] as const).map(([id, icon, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'sel' : ''} onClick={() => setTab(id)}><i aria-hidden>{icon}</i>{label}</button>
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
            {tab === 'custom' && <CustomShop car={car} panels={tryPanels ?? car.panels} setPanels={(panels) => setCustomising(panels ? { car: car.uid, panels } : null)} />}
            {tab === 'trim' && <TrimShop car={car} trim={tryTrim ?? car.trim} setTrim={(trim) => setTrimming(trim ? { car: car.uid, trim } : null)} />}
            {tab === 'hats' && <HatShop car={car} trying={tryHat} setTrying={(hat) => setHatting(hat === undefined ? null : { car: car.uid, hat })} />}
            {tab === 'paint' && <PaintShop car={car} job={tryJob ?? jobOf(car)} setJob={(job) => setPainting(job ? { car: car.uid, job } : null)} />}
            {!def.bucks && <button className="sell" onClick={() => { const uid = car.uid; sellAsk.ask(() => sell(uid)) }}>Sell for ${Math.floor(def.price * 0.5).toLocaleString()}</button>}
            {sellAsk.open && (
              <Confirm pref="askSell" icon="💰" title="Sell this car?" ok={`Sell · $${Math.floor(def.price * 0.5).toLocaleString()}`} onOk={sellAsk.yes} onCancel={sellAsk.close}>
                <CarThumb size="sm" color={car.color} finish={car.finish} skin={car.skin} modSkin={car.modSkin} panels={car.panels} trim={car.trim} body={def.body} model={def.id} stripe={car.stripe} mods={car.mods} />
                <b>{def.name}</b>
              </Confirm>
            )}
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
