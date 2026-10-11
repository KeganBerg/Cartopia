import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { useGame, hasRusty, type Loot } from '../game/store'
import { RESCUE_SPOTS, RARITY, STORAGE_MAX, carDef, performance, restoreCost, rushBucks, type Rarity } from '../game/data'
import { useNow } from '../scene/useNow'
import { CarPreview } from '../scene/CarPreview'
import { Panel, SkillTag } from './Menus'
import { CarThumb } from '../scene/BuildingPreview'
import { RescueScene } from '../scene/RescueScene'

function fmt(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`
}

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

function RarityTag({ r }: { r: Rarity }) {
  return <span className={`rarity rarity-${r}`}>{RARITY[r].name}</span>
}

function RestoreBay({ onCollect }: { onCollect: () => void }) {
  const now = useNow()
  const r = useGame((s) => s.restoring)
  const rush = useGame((s) => s.rushRestore)
  if (!r) return <div className="bay empty"><span className="bay-icon">🔧</span><p>The restore bay is empty. Pick a car from storage to fix it up.</p></div>
  const d = carDef(r.model)
  const left = r.endsAt - now
  const done = left <= 0
  const pct = done ? 100 : 100 - (left / (r.minutes * 60000)) * 100
  return (
    <div className={done ? 'bay done' : 'bay'}>
      <CarThumb size="sm" color={d.colors[0]} body={d.body} rusty={!done} />
      <div className="bay-info">
        <b>{d.name}</b> <RarityTag r={r.rarity} />
        {done ? (
          <p>All done! Rusty made it shine.</p>
        ) : (
          <>
            <div className="bay-bar"><span style={{ width: `${pct}%` }} /></div>
            <p>Restoring · {fmt(left)} left</p>
          </>
        )}
      </div>
      {done
        ? <button className="buy" onClick={onCollect}>Collect</button>
        : <button className="buy alt small" onClick={rush}>Finish now · B {rushBucks(left)}</button>}
    </div>
  )
}

function Storage() {
  const junk = useGame((s) => s.junkyard)
  const busy = useGame((s) => !!s.restoring)
  const restore = useGame((s) => s.restoreCar)
  const scrap = useGame((s) => s.scrapCar)
  if (!junk.length) return <p className="hint">Nothing in storage yet. Go on a search to find cars.</p>
  return (
    <div className="cards">
      {junk.map((c) => {
        const d = carDef(c.model)
        return (
          <div key={c.uid} className="card junk-card">
            <CarThumb color={d.colors[0]} body={d.body} rusty />
            <div className="card-name">{d.name}</div>
            <div className="card-stat"><RarityTag r={c.rarity} /> PI {performance(d, { engine: 0, turbo: 0, tires: 0, weight: 0 })}{d.rescueOnly ? ' · Classic' : ''}</div>
            <SkillTag model={c.model} />
            <div className="card-stat">⏱ {RARITY[c.rarity].minutes >= 60 ? `${RARITY[c.rarity].minutes / 60}h` : `${RARITY[c.rarity].minutes}m`} to restore</div>
            <button className="buy small" disabled={busy} onClick={() => restore(c.uid)}>{busy ? 'Bay busy' : `Restore · $${restoreCost(d).toLocaleString()}`}</button>
            <button className="scrap" onClick={() => scrap(c.uid)}>Scrap for {RARITY[c.rarity].scrapParts}⚙</button>
          </div>
        )
      })}
    </div>
  )
}

function SpotList() {
  const level = useGame((s) => s.level)
  const coins = useGame((s) => s.coins)
  const full = useGame((s) => s.junkyard.length >= STORAGE_MAX)
  const start = useGame((s) => s.startSearch)
  return (
    <div className="cards">
      {RESCUE_SPOTS.map((sp) => {
        const locked = level < sp.unlockLevel
        const rare = sp.cars.filter((c) => c.rarity === 'rare').map((c) => carDef(c.model).name).join(', ')
        return (
          <button key={sp.id} className={`card spot-card ${locked ? 'locked' : ''} ${!locked && coins < sp.cost ? 'broke' : ''}`} onClick={() => start(sp.id)} disabled={full && !locked}>
            <span className="spot-icon">{sp.icon}</span>
            <div className="card-name">{sp.name}</div>
            <div className="card-stat">Rare find: {rare}</div>
            {locked ? <span className="price">🔒 Level {sp.unlockLevel}</span> : <span className="price">$ {sp.cost.toLocaleString()}</span>}
          </button>
        )
      })}
    </div>
  )
}

// The search, full screen: Rusty's tow truck drives a 3D lot (RescueScene)
// and the controls float over it, like a race.
function SearchScreen() {
  const q = useGame((s) => s.search)!
  const bucks = useGame((s) => s.bucks)
  const reveal = useGame((s) => s.revealPin)
  const fix = useGame((s) => s.fixTruck)
  const abandon = useGame((s) => s.abandonSearch)
  const home = useGame((s) => s.towHome)
  const openPanel = useGame((s) => s.openPanel)
  const spot = RESCUE_SPOTS.find((o) => o.id === q.spot)!
  const [autoPicked, setAuto] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(true)
  const [found, setFound] = useState<{ i: number; n: number } | null>(null)
  const left = q.revealed.filter((r) => !r).length
  const haul = q.pins.map((l, i) => ({ l, i })).filter(({ l, i }) => q.revealed[i] && l.kind !== 'nothing')
  const started = q.revealed.some(Boolean)
  const auto = autoPicked && left > 0

  useEffect(() => {
    if (!found) return
    const id = setTimeout(() => setFound(null), 1900)
    return () => clearTimeout(id)
  }, [found])

  const pop = found ? q.pins[found.i] : null
  const popLabel = pop ? lootLabel(pop) : null
  return (
    <div className="race-full rescue-full">
      <Canvas className="rf-canvas" camera={{ position: [0, 14, 12], fov: 42, near: 0.5, far: 200 }} dpr={[1, 1.5]} gl={{ toneMapping: NeutralToneMapping }}>
        <RescueScene
          search={q}
          fast={auto}
          auto={auto}
          leaving={leaving}
          onArrive={reveal}
          onFound={(i) => setFound((f) => ({ i, n: (f?.n ?? 0) + 1 }))}
          onLeft={home}
          onBusy={setBusy}
        />
      </Canvas>
      <div className="rf-top">
        <h2>{spot.icon} {spot.name}</h2>
        <button className="close" onClick={() => openPanel(null)} aria-label="Close">✕</button>
      </div>
      <div className="rs-dots" aria-label={`${left} spots left`}>
        {q.revealed.map((r, i) => {
          const l = q.pins[i]
          return <span key={i} className={r ? (l.kind === 'car' ? `rs-dot open car rr-${l.rarity}` : 'rs-dot open') : 'rs-dot'}>{r ? lootLabel(l).icon : ''}</span>
        })}
      </div>
      {!started && !busy && !auto && <div className="rs-coach">👆 Tap a glowing spot</div>}
      {pop && popLabel && (
        <div key={found!.n} className={pop.kind === 'car' ? `rs-found car rr-${pop.rarity}` : 'rs-found'}>
          {pop.kind === 'car' ? <CarThumb size="xs" body={carDef(pop.model).body} color={carDef(pop.model).colors[0]} rusty /> : <span className="rs-found-icon">{popLabel.icon}</span>}
          <b>{popLabel.text}</b>
          {pop.kind === 'car' && <RarityTag r={pop.rarity} />}
        </div>
      )}
      {q.flat && (
        <div className="rs-flat-wrap">
          <div className="flat-pop rs-flat">
            <b>🛞 Flat tire!</b>
            <div className="row">
              <button className="buy" onClick={fix}>Fix · B 1{bucks < 1 ? ' (need 1)' : ''}</button>
              <button className="sell" onClick={abandon}>Go home</button>
            </div>
          </div>
        </div>
      )}
      <div className="rs-bottom">
        <div className="rs-haul">
          {haul.length ? haul.map(({ l, i }) => {
            const t = lootLabel(l)
            return (
              <span key={i} className={l.kind === 'car' ? 'haul-item car' : 'haul-item'}>
                {l.kind === 'car' ? <CarThumb size="xs" body={carDef(l.model).body} color={carDef(l.model).colors[0]} rusty /> : t.icon} {l.kind === 'car' ? <RarityTag r={l.rarity} /> : t.text}
              </span>
            )
          }) : <span className="rs-empty">🛻 Haul is empty</span>}
        </div>
        <div className="rs-actions">
          <button className="sell rs-leave" onClick={abandon} disabled={leaving}>Leave</button>
          {left > 0 && <button className={auto ? 'buy alt rs-auto on' : 'buy alt rs-auto'} onClick={() => setAuto((a) => !a)} disabled={q.flat || leaving}>{auto ? '⏸ Stop' : '⏩ Search all'}</button>}
          <button className={left ? 'buy rs-home' : 'buy rs-home ready'} disabled={q.flat || !started || leaving} onClick={() => { setAuto(false); setLeaving(true) }}>🏠 Tow home</button>
        </div>
      </div>
    </div>
  )
}

function PlateScreen({ onDone }: { onDone: () => void }) {
  const r = useGame((s) => s.restoring)!
  const collect = useGame((s) => s.collectRestored)
  const selectCar = useGame((s) => s.selectCar)
  const openPanel = useGame((s) => s.openPanel)
  const [plate, setPlate] = useState('')
  const d = carDef(r.model)
  return (
    <div className="plate-screen">
      <CarPreview body={d.body} color={d.colors[0]} />
      <h3>{d.name} <RarityTag r={r.rarity} /></h3>
      <p className="hint">Name your car on its license plate. You can't change it later.</p>
      <input className="plate-input" value={plate} maxLength={7} placeholder="RUSTY1" onChange={(e) => setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''))} autoFocus />
      <button className="buy" onClick={() => { const id = r.uid; collect(plate); onDone(); selectCar(id); openPanel('garage') }}>Add to my garage</button>
    </div>
  )
}

export function RescuePanel() {
  const rusty = useGame((s) => hasRusty(s))
  const searching = useGame((s) => !!s.search)
  const junkCount = useGame((s) => s.junkyard.length)
  const [tab, setTab] = useState<'find' | 'storage'>(junkCount ? 'storage' : 'find')
  const [naming, setNaming] = useState(false)

  if (!rusty) return null
  if (naming) return <Panel title="Restored!" onClose={() => setNaming(false)}><PlateScreen onDone={() => setNaming(false)} /></Panel>
  if (searching) return <SearchScreen />
  return (
    <Panel title="Rusty's Rescue" wide>
      <p className="hint">Rusty searches for old cars, then fixes them up in his bay. Rescued cars join your town, and some classics can only be found here.</p>
      <RestoreBay onCollect={() => setNaming(true)} />
      <div className="tabs">
        <button className={tab === 'find' ? 'tab sel' : 'tab'} onClick={() => setTab('find')}>🔍 Find cars</button>
        <button className={tab === 'storage' ? 'tab sel' : 'tab'} onClick={() => setTab('storage')}>📦 Storage {junkCount}/{STORAGE_MAX}</button>
      </div>
      {tab === 'find' ? (
        <>
          {junkCount >= STORAGE_MAX && <p className="hint">Storage is full. Restore or scrap a car to search again.</p>}
          <SpotList />
        </>
      ) : <Storage />}
    </Panel>
  )
}
