import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { useGame, openCrate } from '../game/store'
import { carDef, modDef } from '../game/data'
import { CRATES, carOdds, crateCost, crateDef, crateOddsShown, dropTier, type CrateDef, type CrateId, type CrateOpen } from '../game/crates'
import { CrateScene, TIER_GLOW, prizeLook, type CratePhase } from '../scene/CrateScene'
import { CarThumb } from '../scene/BuildingPreview'
import { BuckIcon, CoinIcon, Icon } from './Icon'
import { compact } from './format'
import { openGarageTab } from './Menus'
import './crates.css'

const CRATE_KEY = 'cartopia-crate'
const price = (c: CrateDef, level: number) => {
  const p = crateCost(c, level)
  return p.coins ? <><CoinIcon size={16} />{compact(p.coins)}</> : <><BuckIcon size={16} />{p.bucks}</>
}

// HUD button into the Crate Depot.
export function CratesButton() {
  return (
    <button className="goals-btn crates-btn" onClick={() => useGame.getState().openPanel('crates')} title="Crates" aria-label="Crates">
      <Icon name="crate" />
    </button>
  )
}

// A little crate drawn in CSS for the picker, in the crate's own colours.
function CrateIcon({ c }: { c: CrateDef }) {
  return (
    <span className={`crate-ico ${c.id}`} style={{ '--wood': c.look.wood, '--band': c.look.band, '--glow': c.look.glow } as React.CSSProperties} aria-hidden>
      <i /><i /><i />
    </span>
  )
}

// The odds a crate shows: coins, parts and cars, and on a tap the cars it can hold.
function Odds({ c, level }: { c: CrateDef; level: number }) {
  const [cars, setCars] = useState(false)
  const o = crateOddsShown(c)
  const list = useMemo(() => carOdds(c, level).sort((a, b) => b.p - a.p), [c, level])
  return (
    <div className="crate-odds">
      <div className="crate-odds-row">
        <span className="odd coins" style={{ flex: o.coins }}><b>🪙</b>{o.coins}%</span>
        <span className="odd mod" style={{ flex: o.mod }}><b>🔧</b>{o.mod}%</span>
        <button className="odd car" style={{ flex: Math.max(o.car, 14) }} onClick={() => setCars(!cars)} aria-expanded={cars}><b>🚗</b>{o.car}%<small>{cars ? '▴' : '▾'}</small></button>
      </div>
      {cars && (
        <div className="crate-cars">
          {list.length ? list.map((x) => {
            const d = carDef(x.model)
            return (
              <span key={x.model} className="crate-car" title={d.name}>
                <CarThumb size="xs" body={d.body} model={d.id} color={d.colors[0]} />
                <small>{(x.p * o.car).toFixed(x.p * o.car < 1 ? 1 : 0)}%</small>
              </span>
            )
          }) : <span className="crate-none">No cars at your level yet</span>}
        </div>
      )}
    </div>
  )
}

// What came out, under the reveal.
function Prize({ open, onAgain, onDone, again }: { open: CrateOpen; onAgain: () => void; onDone: () => void; again: React.ReactNode }) {
  const cars = useGame((s) => s.cars)
  const modCar = useGame((s) => s.modCar)
  const [fitted, setFitted] = useState(false)
  const d = open.drop
  const tier = dropTier(d)
  let title = ''
  let sub = ''
  let icon: React.ReactNode = <CoinIcon size={36} />
  if (d.kind === 'coins') {
    title = `+${d.coins.toLocaleString()} coins`
    sub = d.jackpot ? 'Jackpot!' : 'Coins'
  } else if (d.kind === 'dupe') {
    icon = '🔁'
    title = `+${d.coins.toLocaleString()} coins`
    sub = `${carDef(d.model).name} · already yours`
  } else if (d.kind === 'car') {
    icon = '🚗'
    title = carDef(d.model).name
    sub = 'New car!'
  } else {
    const car = cars.find((c) => c.uid === d.car)
    icon = '🔧'
    title = modDef(d.mod)?.name ?? 'Part'
    sub = car ? `For your ${carDef(car.model).name}` : 'New part'
  }
  return (
    <div className={`crate-prize tier${tier}`} style={{ '--glow': TIER_GLOW[tier] } as React.CSSProperties}>
      <span className="cp-icon">{icon}</span>
      <div className="cp-text"><small>{sub}</small><b>{title}</b></div>
      <div className="cp-actions">
        {d.kind === 'mod' && !fitted && <button className="buy small" onClick={() => { if (modCar(d.car, d.mod)) setFitted(true) }}>Fit it</button>}
        {d.kind === 'car' && <button className="buy small alt" onClick={() => { onDone(); openGarageTab('tune'); useGame.getState().openPanel('garage') }}>Garage</button>}
        <button className="buy small" onClick={onAgain}>{again}</button>
        <button className="sell small" onClick={onDone}>Done</button>
      </div>
    </div>
  )
}

export function CratesPanel() {
  const level = useGame((s) => s.level)
  const coins = useGame((s) => s.coins)
  const bucks = useGame((s) => s.bucks)
  const cars = useGame((s) => s.cars)
  const close = () => useGame.getState().openPanel(null)
  const [pick, setPick] = useState<CrateId>(() => {
    try {
      const saved = localStorage.getItem(CRATE_KEY) as CrateId | null
      if (saved && crateDef(saved) && level >= crateDef(saved)!.unlockLevel) return saved
    } catch {
      // A remembered pick is a nicety.
    }
    return 'street'
  })
  const def = crateDef(pick)!
  const [phase, setPhase] = useState<CratePhase>('idle')
  // Opens still to show (more than one when earlier ones are handed over late), the one showing, and whether it's up.
  const [queue, setQueue] = useState<CrateOpen[]>([])
  const [shown, setShown] = useState(false)
  const [run, setRun] = useState(0)
  const [skip, setSkip] = useState(0)
  // A part prize shows the car as it was before the part was added, so keep that car.
  const [carsAt, setCarsAt] = useState(cars)
  const open = queue[0] ?? null
  const shownDef = open ? crateDef(open.crate) ?? def : def

  const choose = (id: CrateId) => {
    if (phase !== 'idle' || id === pick) return
    setPick(id)
    setRun((r) => r + 1)
    try {
      localStorage.setItem(CRATE_KEY, id)
    } catch {
      // Not remembered.
    }
  }
  const go = async () => {
    if (phase !== 'idle') return
    const before = useGame.getState().cars
    setPhase('wait')
    const got = await openCrate(pick)
    if (!got?.length) {
      setPhase('idle')
      return
    }
    setCarsAt(before)
    setQueue(got)
    setShown(false)
    setPhase('open')
  }
  const next = () => {
    setShown(false)
    setRun((r) => r + 1)
    if (queue.length > 1) {
      setQueue(queue.slice(1))
      setPhase('open')
      return
    }
    setQueue([])
    setPhase('idle')
  }
  const again = () => {
    next()
    if (queue.length <= 1) setTimeout(go, 650)
  }

  const locked = level < def.unlockLevel
  return (
    <div className="race-full crate-full" onClick={() => { if (phase === 'open' && !shown) setSkip((k) => k + 1) }}>
      <Canvas className="rf-canvas" shadows camera={{ fov: 42, near: 0.3, far: 60, position: [0, 4, 9] }} dpr={[1, 1.5]} gl={{ toneMapping: NeutralToneMapping }}>
        <CrateScene run={run} def={shownDef} phase={phase} drop={open?.drop ?? null} prizeCar={prizeLook(open?.drop ?? null, carsAt)} onReveal={() => setShown(true)} skip={skip} />
      </Canvas>
      <div className="rf-top">
        <h2>📦 Crate Depot</h2>
        <span className="crate-wallet"><span><CoinIcon size={16} />{compact(coins)}</span><span><BuckIcon size={16} />{compact(bucks)}</span></span>
        <button className="close" onClick={close} aria-label="Close"><Icon name="close" size={16} /></button>
      </div>
      {phase === 'open' && !shown && <div className="crate-skip">Tap to skip</div>}
      {phase === 'open' && shown && open && (
        <Prize open={open} onDone={queue.length > 1 ? next : () => { next() }} onAgain={again}
          again={queue.length > 1 ? 'Next' : <>Again · {price(crateDef(open.crate) ?? def, level)}</>} />
      )}
      {phase !== 'open' && (
        <div className="crate-dock" onClick={(e) => e.stopPropagation()}>
          <div className="crate-pick">
            {CRATES.map((c) => (
              <button key={c.id} className={`crate-tab${c.id === pick ? ' sel' : ''}${level < c.unlockLevel ? ' locked' : ''}`} onClick={() => choose(c.id)} disabled={phase !== 'idle'}>
                <CrateIcon c={c} />
                <b>{c.name.replace(' Crate', '')}</b>
                <span className={c.pay === 'bucks' ? 'ct-price gem' : 'ct-price'}>{level < c.unlockLevel ? `🔒 Lv ${c.unlockLevel}` : price(c, level)}</span>
              </button>
            ))}
          </div>
          <Odds key={pick} c={def} level={level} />
          <button className={`crate-open${def.pay === 'bucks' ? ' gem' : ''}`} disabled={phase !== 'idle'} onClick={go}>
            {phase === 'wait' ? 'Opening…' : locked ? `🔒 Level ${def.unlockLevel}` : <>Open · {price(def, level)}</>}
          </button>
        </div>
      )}
    </div>
  )
}
