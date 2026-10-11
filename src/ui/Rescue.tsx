import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { useGame, hasRusty, type Loot } from '../game/store'
import { RESCUE_SPOTS, RARITY, STORAGE_MAX, carDef, performance, restoreCost, rushBucks, type Rarity } from '../game/data'
import { useNow } from '../scene/useNow'
import { CarPreview } from '../scene/CarPreview'
import { Panel, SheetTabs, SkillTag } from './Menus'
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

const RARITY_ORDER: Record<Rarity, number> = { common: 0, scarce: 1, rare: 2 }

function RarityTag({ r }: { r: Rarity }) {
  return <span className={`rarity rarity-${r}`}>{RARITY[r].name}</span>
}

// The restore bay: the car up on Rusty's lift, a progress bar and its timer.
function RestoreBay({ onCollect, onPick }: { onCollect: () => void; onPick: () => void }) {
  const now = useNow()
  const r = useGame((s) => s.restoring)
  const rush = useGame((s) => s.rushRestore)
  if (!r)
    return (
      <button className="bay empty" onClick={onPick}>
        <span className="bay-lift"><span className="bay-wrench">🔧</span></span>
        <span className="bay-info"><b>Bay is free</b><small>Pick a car to fix up</small></span>
        <span className="bay-go">›</span>
      </button>
    )
  const d = carDef(r.model)
  const left = r.endsAt - now
  const done = left <= 0
  const pct = done ? 100 : 100 - (left / (r.minutes * 60000)) * 100
  return (
    <div className={done ? 'bay done' : 'bay'}>
      <span className="bay-lift">
        <CarThumb size="sm" color={d.colors[0]} body={d.body} model={d.id} rusty={!done} />
        {!done && <span className="bay-spark" />}
      </span>
      <div className="bay-info">
        <b>{d.name}</b>
        {done ? (
          <small className="bay-ready"><RarityTag r={r.rarity} /> ✨ Good as new!</small>
        ) : (
          <>
            <div className="bay-bar"><span style={{ width: `${pct}%` }} /></div>
            <small><RarityTag r={r.rarity} /> 🔧 {fmt(left)}</small>
          </>
        )}
      </div>
      {done
        ? <button className="buy bay-btn" onClick={onCollect}>Collect</button>
        : <button className="buy alt small bay-btn" onClick={rush}>Finish · <span className="ico buck-ico rs-ico">B</span>{rushBucks(left)}</button>}
    </div>
  )
}

function restoreTime(minutes: number) {
  return minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`
}

function Storage({ onFind }: { onFind: () => void }) {
  const junk = useGame((s) => s.junkyard)
  const busy = useGame((s) => !!s.restoring)
  const coins = useGame((s) => s.coins)
  const restore = useGame((s) => s.restoreCar)
  const scrap = useGame((s) => s.scrapCar)
  if (!junk.length)
    return (
      <button className="rs-empty-card" onClick={onFind}>
        <span>🔍</span>
        <b>Storage is empty</b>
        <small>Search a lot to find old cars</small>
      </button>
    )
  return (
    <div className="cards rows junk-rows">
      {junk.map((c) => {
        const d = carDef(c.model)
        const cost = restoreCost(d)
        return (
          <div key={c.uid} className={`card junk-card rr-${c.rarity}`}>
            <CarThumb color={d.colors[0]} body={d.body} model={d.id} rusty />
            <div className="card-text">
              <div className="card-name">{d.name}</div>
              <div className="junk-tags"><RarityTag r={c.rarity} /><SkillTag model={c.model} />{d.rescueOnly && <span className="classic-tag">Classic</span>}</div>
              <div className="junk-meta">
                <span>PI {performance(d, { engine: 0, turbo: 0, tires: 0, weight: 0 })}</span>
                <span>⏱ {restoreTime(RARITY[c.rarity].minutes)}</span>
                <button className="scrap" onClick={() => scrap(c.uid)} title="Scrap for parts">♻ +{RARITY[c.rarity].scrapParts}<span className="ico parts-ico rs-ico">⚙</span></button>
              </div>
            </div>
            <button className={`buy junk-go${coins < cost ? ' broke' : ''}`} disabled={busy} onClick={() => restore(c.uid)}>
              {busy ? <>🔧<small>Bay busy</small></> : <>Restore<small><span className="ico coin-ico rs-ico">$</span>{cost.toLocaleString()}</small></>}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Theme colours for each lot's tile, matching the 3D search lots.
const SPOT_TINT: Record<string, string> = { suburbs: '#7cc36b', farm: '#e0b04a', downtown: '#7f93a8', desert: '#e3965a', track: '#e25b4f' }

function SpotList() {
  const level = useGame((s) => s.level)
  const coins = useGame((s) => s.coins)
  const full = useGame((s) => s.junkyard.length >= STORAGE_MAX)
  const start = useGame((s) => s.startSearch)
  return (
    <div className="cards rows spot-rows">
      {RESCUE_SPOTS.map((sp) => {
        const locked = level < sp.unlockLevel
        // Best finds first: the rare cars, then a scarce one.
        const best = [...sp.cars].sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]).slice(0, 3)
        return (
          <button key={sp.id} className={`card spot-card ${locked ? 'locked' : ''} ${!locked && coins < sp.cost ? 'broke' : ''}`} onClick={() => start(sp.id)} disabled={full && !locked} style={{ '--spot': SPOT_TINT[sp.id] ?? '#90a4ae' } as React.CSSProperties}>
            <span className="spot-icon">{sp.icon}</span>
            <div className="card-text">
              <div className="card-name">{sp.name}</div>
              <div className="spot-finds">
                {best.map((c) => {
                  const d = carDef(c.model)
                  return <span key={c.model} className={`spot-find rr-${c.rarity}`} title={`${d.name} (${RARITY[c.rarity].name})`}><CarThumb size="xs" body={d.body} model={d.id} color={d.colors[0]} /></span>
                })}
              </div>
            </div>
            {locked ? <span className="price">🔒 Lv {sp.unlockLevel}</span> : <span className="price"><span className="ico coin-ico rs-ico">$</span>{sp.cost.toLocaleString()}</span>}
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
          {pop.kind === 'car' ? <CarThumb size="xs" body={carDef(pop.model).body} model={pop.model} color={carDef(pop.model).colors[0]} rusty /> : <span className="rs-found-icon">{popLabel.icon}</span>}
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
      <CarPreview body={d.body} model={d.id} color={d.colors[0]} />
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
  const tabs = [
    { id: 'find' as const, label: '🔍 Find cars' },
    { id: 'storage' as const, label: <>📦 Storage <span className={junkCount >= STORAGE_MAX ? 'tab-count full' : 'tab-count'}>{junkCount}/{STORAGE_MAX}</span></> },
  ]
  return (
    <Panel title="Rusty's Rescue" wide>
      <SheetTabs items={tabs} value={tab} onChange={setTab} />
      <RestoreBay onCollect={() => setNaming(true)} onPick={() => setTab(junkCount ? 'storage' : 'find')} />
      {tab === 'find' ? (
        <>
          {junkCount >= STORAGE_MAX && <button className="rs-full" onClick={() => setTab('storage')}>📦 Storage full · restore or scrap a car</button>}
          <SpotList />
        </>
      ) : <Storage onFind={() => setTab('find')} />}
    </Panel>
  )
}
