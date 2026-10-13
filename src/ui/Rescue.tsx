import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { StageSlot, useStageReady } from '../scene/Stage'
import { useGame, hasRusty, type Loot } from '../game/store'
import { RESCUE_SPOTS, RARITY, STORAGE_MAX, carDef, performance, restoreCost, rushBucks, type Rarity, RUSTY_SETS, rustySetId, hotSpot, HOT_RARE, TRUCK, truckOf, BAY2_LEVEL } from '../game/data'
import { flushSave } from '../lib/cloud'
import { useNow } from '../scene/useNow'
import { dayPhase, nightAmount } from '../game/clock'
import { CoinIcon } from './Icon'
import { CarPreview } from '../scene/CarPreview'
import { Panel, SheetTabs, SkillTag } from './Menus'
import { CarThumb } from '../scene/BuildingPreview'
import { RescueScene, type ScreenAt } from '../scene/RescueScene'
import { rescueSfx } from '../lib/sound'
import { buzz } from '../lib/haptics'
import { LoadingScene } from './Loading'
import { Confirm, useAsk } from './Confirm'

function lootLabel(l: Loot) {
  switch (l.kind) {
    case 'car': return { icon: '🚗', text: carDef(l.model).name }
    case 'coins': return { icon: '💰', text: `$${l.n}` }
    case 'parts': return { icon: '⚙', text: `${l.n} parts` }
    case 'fuel': return { icon: '⛽', text: `${l.n} fuel` }
    case 'trophy': return { icon: '🏆', text: 'Trophy' }
    default: return { icon: '💨', text: 'Nothing' }
  }
}

const RARITY_ORDER: Record<Rarity, number> = { common: 0, scarce: 1, rare: 2 }

function RarityTag({ r }: { r: Rarity }) {
  return <span className={`rarity rarity-${r}`}>{RARITY[r].name}</span>
}

// The restore bay, the hero of Rusty's: a lit garage with the car up on the
// lift, a ring timer and one button. Empty, it waits for a car from the lot.
function Ring({ pct, children }: { pct: number; children: React.ReactNode }) {
  const c = 2 * Math.PI * 25
  return (
    <span className="bay-ring">
      <svg viewBox="0 0 62 62" aria-hidden="true">
        <circle cx="31" cy="31" r="25" className="track" />
        <circle cx="31" cy="31" r="25" className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 31 31)" />
      </svg>
      <span>{children}</span>
    </span>
  )
}

type Bay = 0 | 1
const bayKey = (bay: Bay) => (bay ? 'restoring2' : 'restoring') as 'restoring' | 'restoring2'
// A car can go into a bay: the first is free, or the second is open and free.
const bayFree = (s: { restoring: unknown; restoring2: unknown; level: number }) => !s.restoring || (!s.restoring2 && s.level >= BAY2_LEVEL)

function BayHero({ bay = 0, onCollect, compact }: { bay?: Bay; onCollect: () => void; compact?: boolean }) {
  const now = useNow()
  const r = useGame((s) => s[bayKey(bay)])
  const rush = useGame((s) => s.rushRestore)
  if (!r)
    return compact ? null : (
      <div className="bayhero empty">
        <div className="bay-stage"><span className="bay-wrench">🔧</span></div>
        <div className="bay-side">
          <b>{bay ? 'Bay 2 is free' : 'Bay is free'}</b>
          <small>Pick a car from your lot ↓</small>
        </div>
      </div>
    )
  const d = carDef(r.model)
  const left = r.endsAt - now
  const done = left <= 0
  const pct = done ? 100 : Math.max(0, 100 - (left / (r.minutes * 60000)) * 100)
  return (
    <div className={`bayhero${done ? ' done' : ''}${compact ? ' compact' : ''}`}>
      <div className="bay-stage">
        <CarThumb size={compact ? 'sm' : undefined} color={d.colors[0]} body={d.body} model={d.id} rusty={!done} />
        {!done && <><span className="bay-spark" /><span className="bay-spark b" /></>}
      </div>
      <div className="bay-side">
        <b>{d.name}</b>
        <div className="bay-row">
          <Ring pct={pct}>{done ? '✨' : clock(left)}</Ring>
          <small><RarityTag r={r.rarity} />{done ? ' Good as new!' : " Rusty's on it"}</small>
        </div>
        {done
          ? <button className="buy bay-btn collect" onClick={onCollect}>✨ Collect</button>
          : <button className="buy alt bay-btn" onClick={() => rush(bay)}>Finish now · <span className="ico buck-ico rs-ico">💎</span>{rushBucks(left)}</button>}
      </div>
    </div>
  )
}

// Both bays: the second opens at BAY2_LEVEL; before then a lock shows when it opens.
function Bays({ onCollect, compact }: { onCollect: (bay: Bay) => void; compact?: boolean }) {
  const open2 = useGame((s) => s.level >= BAY2_LEVEL)
  const busy1 = useGame((s) => !!s.restoring)
  return (
    <div className={compact ? 'bays compact' : 'bays'}>
      <BayHero bay={0} compact={compact} onCollect={() => onCollect(0)} />
      {open2 ? (busy1 || compact ? <BayHero bay={1} compact={compact} onCollect={() => onCollect(1)} /> : null)
        : !compact && <div className="bay-lock" title="A second restore bay">🔧🔒 <b>Bay 2</b> <span>Lv {BAY2_LEVEL}</span></div>}
    </div>
  )
}

// Short clock for the ring timer: 3:12, or 1h05 for long restores.
function clock(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(sec % 60).padStart(2, '0')}`
}

function restoreTime(minutes: number) {
  return minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`
}

// Rusty's lot: a parking spot for every car he can keep. Tap one to fix it up.
function Lot({ onFind }: { onFind: () => void }) {
  const junk = useGame((s) => s.junkyard)
  const busy = useGame((s) => !bayFree(s))
  const coins = useGame((s) => s.coins)
  const restore = useGame((s) => s.restoreCar)
  const scrap = useGame((s) => s.scrapCar)
  const [sel, setSel] = useState<string | null>(null)
  const best = [...junk].sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity])[0]
  const picked = junk.find((c) => c.uid === sel) ?? best
  const empty = Math.max(0, STORAGE_MAX - junk.length)
  const d = picked && carDef(picked.model)
  const cost = d ? restoreCost(d) : 0
  return (
    <div className="lot">
      <div className="lot-head"><b>Your lot</b><span>{junk.length ? 'Tap a car to fix it up' : 'Rusty tows finds here'}</span></div>
      <div className="lot-spots">
        {junk.map((c) => {
          const cd = carDef(c.model)
          return (
            <button key={c.uid} className={`lot-spot rr-${c.rarity}${picked?.uid === c.uid ? ' sel' : ''}`} onClick={() => setSel(c.uid)} aria-pressed={picked?.uid === c.uid}>
              <CarThumb color={cd.colors[0]} body={cd.body} model={cd.id} rusty />
              <span className="lot-name">{cd.name}</span>
              <RarityTag r={c.rarity} />
            </button>
          )
        })}
        {Array.from({ length: empty }, (_, i) => (
          <button key={`e${i}`} className="lot-spot open" onClick={onFind} aria-label="Empty spot: search for cars">
            <span>P</span>
          </button>
        ))}
      </div>
      {picked && d ? (
        <div className={`lot-pick rr-${picked.rarity}`}>
          <div className="lot-pick-info">
            <b>{d.name}</b>
            <div className="junk-tags"><RarityTag r={picked.rarity} /><SkillTag model={picked.model} />{d.rescueOnly && <span className="classic-tag">Classic</span>}</div>
            <div className="junk-meta">
              <span>PI {performance(d, { engine: 0, turbo: 0, tires: 0, weight: 0 })}</span>
              <span>⏱ {restoreTime(RARITY[picked.rarity].minutes)}</span>
            </div>
          </div>
          <div className="lot-acts">
            <button className="scrap" onClick={() => { scrap(picked.uid); setSel(null) }} title="Scrap for parts">♻ +{RARITY[picked.rarity].scrapParts}<span className="ico parts-ico rs-ico">⚙</span></button>
            <button className={`buy junk-go${coins < cost ? ' broke' : ''}`} disabled={busy} onClick={() => { restore(picked.uid); setSel(null) }}>
              {busy ? <>🔧<small>Bay busy</small></> : <>Restore<small><span className="ico coin-ico rs-ico">$</span>{cost.toLocaleString()}</small></>}
            </button>
          </div>
        </div>
      ) : (
        <button className="buy alt lot-find" onClick={onFind}>🔍 Search a lot for cars</button>
      )}
    </div>
  )
}

// Models in the player's garage: a spot's card shows those restored and ticked, the rest still rusty.
function useHave() {
  const cars = useGame((s) => s.cars)
  return useMemo(() => new Set(cars.map((c) => c.model)), [cars])
}

const ALL_FINDS = [...new Set(RESCUE_SPOTS.flatMap((sp) => sp.cars.map((c) => c.model)))]

// Each lot's postcard is a render of its real search scene (scripts/rescue/spotart.mjs),
// at night when the town is dark.
const spotArt = (id: string, night: boolean) => `/rescue/${id}-${night ? 'night' : 'day'}.webp`

// Rusty's tow truck: its level as pips, spots per search, and the next upgrade's parts.
function TruckRow() {
  const truck = useGame((s) => s.truck ?? 0)
  const level = useGame((s) => s.level)
  const parts = useGame((s) => s.parts)
  const up = useGame((s) => s.upgradeTruck)
  const [busy, setBusy] = useState(false)
  const t = truckOf(truck)
  const next = TRUCK[truck + 1]
  // Saved straight away (before and after), so the server sees the parts paid in the same save.
  const go = async () => {
    setBusy(true)
    try {
      await flushSave()
      up()
      await flushSave()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rsc-truck">
      <span className="rsc-truck-ico">🛻</span>
      <span className="rsc-pips" aria-label={`Truck level ${truck + 1} of ${TRUCK.length}`}>
        {TRUCK.map((_, i) => <i key={i} className={i <= truck ? 'on' : ''} />)}
      </span>
      <span className="rsc-stat" title="Spots per search">📍{t.pins}{next && <small>→{next.pins}</small>}</span>
      {t.magnet && <span className="rsc-stat" title="Magnet: shows which tarps hide a car">🧲</span>}
      {next ? (
        level < next.level
          ? <span className="rsc-up lock">🔒 Lv {next.level}</span>
          : <button className={parts < next.parts ? 'rsc-up broke' : 'rsc-up'} onClick={go} disabled={busy} title={next.magnet ? 'Adds a spot, fewer flats and a magnet' : 'Adds a spot and fewer flats'}>⬆ <span className="ico parts-ico rs-ico">⚙</span>{next.parts}</button>
      ) : <span className="rsc-up max">MAX</span>}
    </div>
  )
}

function SpotList() {
  const level = useGame((s) => s.level)
  const coins = useGame((s) => s.coins)
  const full = useGame((s) => s.junkyard.length >= STORAGE_MAX)
  const start = useGame((s) => s.startSearch)
  const claimed = useGame((s) => s.claimedSets)
  const claim = useGame((s) => s.claimSet)
  const have = useHave()
  const [night] = useState(() => nightAmount(dayPhase()) > 0.5)
  const hot = hotSpot(level)
  const got = ALL_FINDS.filter((m) => have.has(m)).length
  return (
    <>
      <div className="rsc-dex" title="Cars from Rusty's lots in your garage">
        <span className="rsc-dex-ico">🔧</span>
        <span className="rsc-dex-bar"><i style={{ width: `${(got / ALL_FINDS.length) * 100}%` }} /></span>
        <b>{got}/{ALL_FINDS.length}</b>
      </div>
      <TruckRow />
      <div className="rsc-spots">
        {RESCUE_SPOTS.map((sp) => {
          const locked = level < sp.unlockLevel
          const set = RUSTY_SETS.find((x) => x.id === rustySetId(sp.id))!
          const n = set.cars.filter((m) => have.has(m)).length
          const done = n === set.cars.length
          const paid = claimed.includes(set.id)
          return (
            <button key={sp.id} className={`rsc-spot${locked ? ' locked' : ''}${!locked && coins < sp.cost ? ' broke' : ''}${hot === sp.id && !locked ? ' hot' : ''}`} onClick={() => start(sp.id)} disabled={full && !locked}>
              <span className="rsc-art" style={{ backgroundImage: `url(${spotArt(sp.id, night)})` }}>
                <span className="rsc-name">{sp.icon} {sp.name}</span>
                {!locked && (done && !paid
                  ? <span role="button" tabIndex={0} className="rsc-got claim" onClick={(e) => { e.stopPropagation(); claim(set.id) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); claim(set.id) } }}>🎁 <span className="ico buck-ico rs-ico">💎</span>{set.bucks}</span>
                  : <span className={paid ? 'rsc-got done' : 'rsc-got'} title={`Restore all ${set.cars.length}: +${set.bucks} gems, +${set.coins.toLocaleString()} coins`}>{paid ? '👑' : '✔'} {n}/{set.cars.length}</span>)}
                {hot === sp.id && !locked && <span className="rsc-hot" title={`Rusty's hot tip: rare cars ${HOT_RARE}x as often today`}>🔥 {HOT_RARE}× <span className="rarity rarity-rare">Rare</span></span>}
                {locked
                  ? <span className="rsc-go lock">🔒 Lv {sp.unlockLevel}</span>
                  : <span className="rsc-go"><CoinIcon size={18} />{sp.cost.toLocaleString()}</span>}
              </span>
              <span className="rsc-cars">
                {sp.cars.map((c) => {
                  const d = carDef(c.model)
                  const own = have.has(c.model)
                  return (
                    <span key={c.model} className={`rsc-car rr-${c.rarity}${own ? ' have' : ''}`} title={`${d.name} (${RARITY[c.rarity].name})`}>
                      <CarThumb size="xs" body={d.body} model={d.id} color={d.colors[0]} rusty={!own} />
                      {own && <i>✔</i>}
                    </span>
                  )
                })}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// A number that rolls up to its new value, ticking as it goes, and bumps when it lands.
function Count({ n, tick }: { n: number; tick?: boolean }) {
  const [v, setV] = useState(n)
  const from = useRef(n)
  useEffect(() => {
    const a = from.current
    from.current = n
    if (a === n) return
    const t0 = window.performance.now()
    const dur = 550
    let last = -1
    let raf = 0
    const step = () => {
      const k = Math.min(1, (window.performance.now() - t0) / dur)
      setV(Math.round(a + (n - a) * (1 - (1 - k) ** 3)))
      const beat = Math.floor(k * 6)
      if (tick && beat !== last && k < 1) {
        last = beat
        rescueSfx.tick(beat)
      }
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [n, tick])
  return <span key={n} className="count-bump">{v.toLocaleString()}</span>
}

// What's aboard the tow truck: each car with its rarity, then the small
// finds added up into one chip per kind.
function Haul({ items }: { items: Loot[] }) {
  const sum = { coins: 0, parts: 0, fuel: 0, trophy: 0 }
  for (const l of items) {
    if (l.kind === 'coins' || l.kind === 'parts' || l.kind === 'fuel') sum[l.kind] += l.n
    else if (l.kind === 'trophy') sum.trophy++
  }
  return (
    <>
      {items.map((l, i) => l.kind === 'car' && (
        <span key={i} className={`haul-item car rr-${l.rarity}`} title={carDef(l.model).name}>
          <CarThumb size="xs" body={carDef(l.model).body} model={l.model} color={carDef(l.model).colors[0]} rusty />
          <RarityTag r={l.rarity} />
        </span>
      ))}
      {sum.coins > 0 && <span className="haul-item"><span className="ico coin-ico rs-ico">$</span><Count n={sum.coins} tick /></span>}
      {sum.parts > 0 && <span className="haul-item"><span className="ico parts-ico rs-ico">⚙</span><Count n={sum.parts} /></span>}
      {sum.fuel > 0 && <span className="haul-item">⛽ <Count n={sum.fuel} /></span>}
      {sum.trophy > 0 && <span className="haul-item">🏆{sum.trophy > 1 ? ` ${sum.trophy}` : ''}</span>}
    </>
  )
}

// A find flying from where it was uncovered down into the haul tray.
function Fly({ loot, from, to, onLand }: { loot: Loot; from: ScreenAt; to: () => { x: number; y: number }; onLand: () => void }) {
  const el = useRef<HTMLDivElement>(null)
  const land = useRef(onLand)
  land.current = onLand
  useLayoutEffect(() => {
    const e = el.current
    if (!e) return
    const x0 = from.x * window.innerWidth
    const y0 = from.y * window.innerHeight
    const { x, y } = to()
    const mx = (x0 + x) / 2
    const my = Math.min(y0, y) - 60
    const a = e.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0 - 30}px) scale(1.25)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${mx}px, ${my}px) scale(1)`, offset: 0.55 },
        { transform: `translate(${x}px, ${y}px) scale(.55)`, opacity: 1 },
      ],
      { duration: 750, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' },
    )
    a.onfinish = () => land.current()
    return () => a.cancel()
    // Flies once, from where it started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const l = lootLabel(loot)
  return (
    <div ref={el} className={loot.kind === 'car' ? `rs-fly car rr-${loot.rarity}` : 'rs-fly'}>
      {loot.kind === 'car' ? <CarThumb size="xs" body={carDef(loot.model).body} model={loot.model} color={carDef(loot.model).colors[0]} rusty /> : <span>{l.icon}</span>}
    </div>
  )
}

const RESCUE_CAM = { position: [0, 14, 12] as [number, number, number], fov: 42, near: 0.5, far: 200 }

// The search, full screen: Rusty's tow truck drives a 3D lot (RescueScene)
// and the controls float over it, like a race.
function SearchScreen({ onHaul }: { onHaul: (items: Loot[]) => void }) {
  const q = useGame((s) => s.search)!
  const bucks = useGame((s) => s.bucks)
  const reveal = useGame((s) => s.revealPin)
  const fix = useGame((s) => s.fixTruck)
  const abandon = useGame((s) => s.abandonSearch)
  const home = useGame((s) => s.towHome)
  const openPanel = useGame((s) => s.openPanel)
  const spot = RESCUE_SPOTS.find((o) => o.id === q.spot)!
  const magnet = useGame((s) => !!truckOf(s.truck).magnet)
  const [autoPicked, setAuto] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(true)
  const [found, setFound] = useState<{ i: number; n: number } | null>(null)
  // The store knows what a spot hid as soon as the truck parks; the dots and
  // the tray wait for the tarp to come off, so nothing is spoiled.
  const [seen, setSeen] = useState<number[]>(() => q.pins.flatMap((_, i) => (q.revealed[i] ? [i] : [])))
  const [aboard, setAboard] = useState<number[]>(seen)
  const [flies, setFlies] = useState<{ i: number; from: ScreenAt }[]>([])
  const tray = useRef<HTMLDivElement>(null)
  const left = q.revealed.filter((r) => !r).length
  const haul = q.pins.map((l, i) => ({ l, i })).filter(({ l, i }) => aboard.includes(i) && l.kind !== 'nothing')
  // Leaving throws the haul away, so it asks first (unless the player said not to).
  const leaveAsk = useAsk('askLeave')
  const leave = () => {
    if (!haul.length) return abandon()
    setAuto(false)
    leaveAsk.ask(abandon)
  }
  const trayEnd = () => {
    const r = tray.current?.getBoundingClientRect()
    const last = tray.current?.lastElementChild?.getBoundingClientRect()
    if (!r) return { x: window.innerWidth / 2, y: window.innerHeight - 60 }
    return { x: last && haul.length ? Math.min(r.right - 20, last.right + 18) : r.left + 22, y: r.top + r.height / 2 }
  }
  const onFound = (i: number, at: ScreenAt) => {
    setFound((f) => ({ i, n: (f?.n ?? 0) + 1 }))
    setSeen((s) => [...s, i])
    if (q.pins[i].kind === 'nothing') return
    setTimeout(() => setFlies((f) => [...f, { i, from: at }]), 450)
  }
  const landed = (i: number) => {
    setFlies((f) => f.filter((o) => o.i !== i))
    setAboard((a) => (a.includes(i) ? a : [...a, i]))
    rescueSfx.tick(4)
    buzz(8)
  }
  const started = q.revealed.some(Boolean)
  const auto = autoPicked && left > 0

  useEffect(() => {
    if (!found) return
    const id = setTimeout(() => setFound(null), 1900)
    return () => clearTimeout(id)
  }, [found])

  // The lot draws in the shared race canvas (scene/Stage.tsx), like the Crate Depot:
  // a canvas of its own meant a new WebGL context and every shader compiled per visit.
  // The scene is memoised, so the found pop-ups and flying finds don't re-render it.
  const cb = useRef({ onFound, onLeft: () => {} })
  cb.current = {
    onFound,
    onLeft: () => {
      onHaul(q.pins.filter((l, i) => q.revealed[i] && l.kind !== 'nothing'))
      home()
    },
  }
  const sceneFound = useCallback((i: number, at: ScreenAt) => cb.current.onFound(i, at), [])
  const sceneLeft = useCallback(() => cb.current.onLeft(), [])
  const scene = useMemo(
    () => <RescueScene search={q} magnet={magnet} fast={auto} auto={auto} leaving={leaving} onArrive={reveal} onFound={sceneFound} onLeft={sceneLeft} onBusy={setBusy} />,
    [q, magnet, auto, leaving, reveal, sceneFound, sceneLeft],
  )
  const stageReady = useStageReady()

  const pop = found ? q.pins[found.i] : null
  const popLabel = pop ? lootLabel(pop) : null
  return (
    <div className="race-full rescue-full">
      <StageSlot cam={RESCUE_CAM}>{scene}</StageSlot>
      <LoadingScene ready={stageReady} label={`Heading to ${spot.name}`} onClose={() => openPanel(null)} />
      <div className="rf-top">
        <h2>{spot.icon} {spot.name}</h2>
        <button className="close" onClick={() => openPanel(null)} aria-label="Close">✕</button>
      </div>
      <div className="rs-dots" aria-label={`${left} spots left`}>
        {q.revealed.map((r, i) => {
          const l = q.pins[i]
          const open = r && seen.includes(i)
          return <span key={i} className={open ? (l.kind === 'car' ? `rs-dot open car rr-${l.rarity}` : 'rs-dot open') : r ? 'rs-dot here' : 'rs-dot'}>{open ? lootLabel(l).icon : ''}</span>
        })}
      </div>
      {!started && !busy && !auto && <div className="rs-coach">👆 Tap a glowing spot</div>}
      {pop && popLabel && (
        <div key={found!.n} className={pop.kind === 'car' ? `rs-found car rr-${pop.rarity}` : 'rs-found'}>
          {pop.kind === 'car' ? <CarThumb size="xs" body={carDef(pop.model).body} model={pop.model} color={carDef(pop.model).colors[0]} rusty /> : <span className="rs-found-icon">{popLabel.icon}</span>}
          <b>{popLabel.text}</b>
          {pop.kind === 'car' && <RarityTag r={pop.rarity} />}
        </div>
      )}
      {flies.map((f) => <Fly key={f.i} loot={q.pins[f.i]} from={f.from} to={trayEnd} onLand={() => landed(f.i)} />)}
      {q.flat && (
        <div className="rs-flat-wrap">
          <div className="flat-pop rs-flat">
            <b>🛞 Flat tire!</b>
            <div className="row">
              <button className="buy" onClick={fix}>Fix · 💎 1{bucks < 1 ? ' (need 1)' : ''}</button>
              <button className="sell" onClick={leave}>Go home</button>
            </div>
          </div>
        </div>
      )}
      <div className="rs-bottom">
        <div className="rs-haul" ref={tray}>
          {haul.length ? <Haul items={haul.map(({ l }) => l)} /> : <span className="rs-empty">🛻 Haul is empty</span>}
        </div>
        <div className="rs-actions">
          <button className="sell rs-leave" onClick={leave} disabled={leaving}>Leave</button>
          {left > 0 && <button className={auto ? 'buy alt rs-auto on' : 'buy alt rs-auto'} onClick={() => setAuto((a) => !a)} disabled={q.flat || leaving}>{auto ? '⏸ Stop' : '⏩ Search all'}</button>}
          <button className={left ? 'buy rs-home' : 'buy rs-home ready'} disabled={q.flat || !started || leaving} onClick={() => { setAuto(false); setLeaving(true); rescueSfx.home(); buzz([15, 60, 15]) }}>🏠 Tow home</button>
        </div>
      </div>
      {leaveAsk.open && (
        <Confirm pref="askLeave" icon="🛻" title="Leave your haul?" ok="Leave" onOk={leaveAsk.yes} onCancel={leaveAsk.close}>
          <Haul items={haul.map(({ l }) => l)} />
        </Confirm>
      )}
    </div>
  )
}

// Back from a search: the haul laid out one find at a time, with a fanfare,
// before Rusty's storage. Cars first, best first, then the small finds summed.
function HaulCard({ items, onDone }: { items: Loot[]; onDone: (next: 'find' | 'storage') => void }) {
  const cars = items.flatMap((l) => (l.kind === 'car' ? [l] : [])).sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity])
  const sum = { coins: 0, parts: 0, fuel: 0, trophy: 0 }
  for (const l of items) {
    if (l.kind === 'coins' || l.kind === 'parts' || l.kind === 'fuel') sum[l.kind] += l.n
    else if (l.kind === 'trophy') sum.trophy++
  }
  const smalls = [
    sum.coins > 0 && { k: 'coins', icon: <span className="ico coin-ico rs-ico">$</span>, n: sum.coins },
    sum.parts > 0 && { k: 'parts', icon: <span className="ico parts-ico rs-ico">⚙</span>, n: sum.parts },
    sum.fuel > 0 && { k: 'fuel', icon: <span>⛽</span>, n: sum.fuel },
    sum.trophy > 0 && { k: 'trophy', icon: <span>🏆</span>, n: sum.trophy },
  ].filter((x): x is { k: string; icon: React.ReactElement; n: number } => !!x)
  const xp = 10 + cars.length * 10
  const total = cars.length + smalls.length
  // Each find lands on a beat; the counts roll up as their chip appears.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    rescueSfx.fanfare(cars.some((c) => c.rarity === 'rare'))
    buzz([20, 50, 20])
    const ids = Array.from({ length: total + 1 }, (_, n) =>
      setTimeout(() => {
        setShown(n + 1)
        if (n < total) {
          const c = cars[n]
          if (c) rescueSfx.reveal(c.rarity === 'common' ? 'small' : c.rarity)
          else rescueSfx.tick(n * 2)
        }
      }, 450 + n * 260),
    )
    return () => ids.forEach(clearTimeout)
    // Plays once when the card opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="haul-card">
      <div className="haul-hero">🛻</div>
      <div className="haul-grid">
        {cars.map((c, n) => (
          <div key={n} className={`haul-car rr-${c.rarity}${n < shown ? ' in' : ''}`}>
            <CarThumb body={carDef(c.model).body} model={c.model} color={carDef(c.model).colors[0]} rusty />
            <b>{carDef(c.model).name}</b>
            <RarityTag r={c.rarity} />
          </div>
        ))}
      </div>
      <div className="haul-sums">
        {smalls.map((x, n) => (
          <span key={x.k} className={cars.length + n < shown ? 'haul-item in' : 'haul-item'}>{x.icon}<Count n={cars.length + n < shown ? x.n : 0} /></span>
        ))}
        <span className={total < shown ? 'haul-item xp in' : 'haul-item xp'}>⭐ +{xp} XP</span>
      </div>
      <div className="row haul-go">
        {cars.length ? (
          <button className="buy" onClick={() => onDone('storage')}>🔧 Fix one up</button>
        ) : (
          <button className="buy" onClick={() => onDone('find')}>🔍 Search again</button>
        )}
      </div>
    </div>
  )
}

function PlateScreen({ bay, onDone }: { bay: Bay; onDone: () => void }) {
  const r = useGame((s) => s[bayKey(bay)])!
  const collect = useGame((s) => s.collectRestored)
  const selectCar = useGame((s) => s.selectCar)
  const openPanel = useGame((s) => s.openPanel)
  const [plate, setPlate] = useState('')
  const d = carDef(r.model)
  // Good as new: the big moment of the whole rescue.
  useEffect(() => {
    rescueSfx.fanfare(r.rarity !== 'common')
    buzz([20, 50, 20])
  }, [r.rarity])
  return (
    <div className="plate-screen">
      <CarPreview body={d.body} model={d.id} color={d.colors[0]} />
      <h3>{d.name} <RarityTag r={r.rarity} /></h3>
      <p className="hint">Name your car on its license plate. You can't change it later.</p>
      <input className="plate-input" value={plate} maxLength={7} placeholder="RUSTY1" onChange={(e) => setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''))} autoFocus />
      <button className="buy" onClick={() => { const id = r.uid; collect(plate, bay); onDone(); selectCar(id); openPanel('garage') }}>Add to my garage</button>
    </div>
  )
}

export function RescuePanel() {
  const rusty = useGame((s) => hasRusty(s))
  const searching = useGame((s) => !!s.search)
  const junkCount = useGame((s) => s.junkyard.length)
  const [tab, setTab] = useState<'find' | 'storage'>(junkCount ? 'storage' : 'find')
  const [naming, setNaming] = useState<Bay | null>(null)
  const [recap, setRecap] = useState<Loot[] | null>(null)
  // Back from a search with finds: show them, so the next step (restore one) is right there.
  const [wasSearching, setWasSearching] = useState(searching)
  if (wasSearching !== searching) {
    setWasSearching(searching)
    if (!searching && junkCount) setTab('storage')
  }

  if (!rusty) return null
  if (naming !== null) return <Panel title="Restored!" onClose={() => setNaming(null)}><PlateScreen bay={naming} onDone={() => setNaming(null)} /></Panel>
  if (searching) return <SearchScreen onHaul={setRecap} />
  if (recap)
    return (
      <Panel title="Rusty's haul" onClose={() => setRecap(null)}>
        <HaulCard items={recap} onDone={(next) => { setRecap(null); setTab(next) }} />
      </Panel>
    )
  const tabs = [
    { id: 'find' as const, label: '🔍 Find cars' },
    { id: 'storage' as const, label: <>🚗 My lot <span className={junkCount >= STORAGE_MAX ? 'tab-count full' : 'tab-count'}>{junkCount}/{STORAGE_MAX}</span></> },
  ]
  return (
    <Panel title="Rusty's Rescue" wide>
      <SheetTabs items={tabs} value={tab} onChange={setTab} />
      {tab === 'find' ? (
        <>
          <Bays compact onCollect={setNaming} />
          {junkCount >= STORAGE_MAX && <button className="rs-full" onClick={() => setTab('storage')}>🚗 Your lot is full · restore or scrap a car</button>}
          <SpotList />
        </>
      ) : (
        <div className="rusty-home">
          <Bays onCollect={setNaming} />
          <Lot onFind={() => setTab('find')} />
        </div>
      )}
    </Panel>
  )
}
