import { useState } from 'react'
import { useGame, hasRusty, cleanPlate, type Loot } from '../game/store'
import { RESCUE_SPOTS, RARITY, STORAGE_MAX, carDef, performance, restoreCost, rushBucks, type Rarity } from '../game/data'
import { useNow } from '../scene/useNow'
import { CarPreview } from '../scene/CarPreview'
import { Panel, CarSwatch, SkillTag } from './Menus'

// Where the pins sit on the search map, in percent.
const PIN_SPOTS: [number, number][] = [[14, 22], [40, 14], [70, 20], [86, 46], [62, 52], [30, 48], [18, 78], [52, 82]]

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

// A rusty, sheet-covered car waiting in storage.
function JunkSwatch() {
  return (
    <svg viewBox="0 0 100 50" className="car-swatch">
      <circle cx="26" cy="41" r="7" fill="#3e2723" />
      <circle cx="74" cy="41" r="7" fill="#3e2723" />
      <path d="M6 38 Q10 14 34 10 Q52 4 70 12 Q92 18 94 38 Z" fill="#8d6e63" />
      <path d="M20 36 Q24 20 36 18 M54 12 Q60 26 58 36 M76 18 Q82 28 80 37" stroke="#6d4c41" strokeWidth="2" fill="none" />
      <circle cx="44" cy="28" r="3" fill="#bf360c" opacity=".7" />
      <circle cx="68" cy="30" r="2.5" fill="#bf360c" opacity=".7" />
    </svg>
  )
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
      <CarSwatch color={done ? d.colors[0] : '#a1887f'} body={d.body} />
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
            <JunkSwatch />
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

function SearchMap() {
  const q = useGame((s) => s.search)!
  const bucks = useGame((s) => s.bucks)
  const reveal = useGame((s) => s.revealPin)
  const fix = useGame((s) => s.fixTruck)
  const abandon = useGame((s) => s.abandonSearch)
  const home = useGame((s) => s.towHome)
  const spot = RESCUE_SPOTS.find((o) => o.id === q.spot)!
  const found = q.pins.filter((l, i) => q.revealed[i] && l.kind !== 'nothing')
  const left = q.revealed.filter((r) => !r).length
  const truck = q.truckAt === null ? [50, 50] : PIN_SPOTS[q.truckAt]
  return (
    <div className="search">
      <p className="hint">{left ? `Tap the red pins to send Rusty's tow truck. ${left} left to check in the ${spot.name}.` : 'Every pin checked. Tow it all home!'}</p>
      <div className={`search-map map-${spot.id}`}>
        <svg className="map-roads" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M14 22 L40 14 L70 20 L86 46 L62 52 L30 48 L18 78 L52 82" />
          <path d="M50 50 L62 52 M50 50 L30 48" />
        </svg>
        {PIN_SPOTS.map(([x, y], i) => {
          const open = q.revealed[i]
          const l = lootLabel(q.pins[i])
          return (
            <button key={i} className={open ? `pin open ${q.pins[i].kind === 'car' ? 'pin-car' : ''}` : 'pin'} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => reveal(i)} disabled={open || q.flat}>
              {open ? l.icon : '📍'}
            </button>
          )
        })}
        <span className="truck" style={{ left: `${truck[0] + 7}%`, top: `${truck[1] + 6}%` }}>🛻</span>
        {q.flat && (
          <div className="flat-pop">
            <b>🛞 The tow truck got a flat!</b>
            <p>Fix it to keep searching, or head home empty-handed.</p>
            <div className="row">
              <button className="buy" onClick={fix}>Fix · B 1{bucks < 1 ? ' (need 1)' : ''}</button>
              <button className="sell" onClick={abandon}>Go home</button>
            </div>
          </div>
        )}
      </div>
      <div className="haul">
        <b>Haul:</b>
        {found.length ? found.map((l, i) => {
          const t = lootLabel(l)
          return <span key={i} className={l.kind === 'car' ? 'haul-item car' : 'haul-item'}>{t.icon} {t.text}{l.kind === 'car' && <> <RarityTag r={l.rarity} /></>}</span>
        }) : <span className="hint">Nothing yet</span>}
      </div>
      <button className="buy" disabled={q.flat || !q.revealed.some(Boolean)} onClick={home}>🏠 Tow it home</button>
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
      <input className="plate-input" value={plate} maxLength={7} placeholder="RUSTY1" onChange={(e) => setPlate(cleanPlate(e.target.value))} autoFocus />
      <button className="buy" onClick={() => { const id = r.uid; collect(plate); onDone(); selectCar(id); openPanel('garage') }}>Add to my garage</button>
    </div>
  )
}

export function RescuePanel() {
  const rusty = useGame((s) => hasRusty(s))
  const searching = useGame((s) => !!s.search)
  const abandon = useGame((s) => s.abandonSearch)
  const openPanel = useGame((s) => s.openPanel)
  const junkCount = useGame((s) => s.junkyard.length)
  const [tab, setTab] = useState<'find' | 'storage'>(junkCount ? 'storage' : 'find')
  const [naming, setNaming] = useState(false)

  if (!rusty) return null
  if (naming) return <Panel title="Restored!" onClose={() => setNaming(false)}><PlateScreen onDone={() => setNaming(false)} /></Panel>
  if (searching) {
    return (
      <Panel title="Searching for cars" wide onClose={() => openPanel(null)}>
        <SearchMap />
        <button className="tut-skip" onClick={abandon}>Leave without the haul</button>
      </Panel>
    )
  }
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
