import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StageSlot, useStageReady } from '../scene/Stage'
import { useGame, openCrate } from '../game/store'
import { MOD_SLOTS, SKINNED_SLOTS, carDef, fittedMods, modDef, ownedModSkins, ownedSkins, type ModDef } from '../game/data'
import { hatDef } from '../game/hats'
import { CRATES, carOdds, crateCost, crateDef, crateOddsShown, dropTier, homeCars, homeMods, modChoices, skinOdds, skinOf, type CrateDef, type CrateId, type CrateOpen } from '../game/crates'
import { SKIN_TIERS } from '../game/data'
import { CrateScene, TIER_GLOW, prizeLook, type CratePhase } from '../scene/CrateScene'
import { CarThumb } from '../scene/BuildingPreview'
import { BuckIcon, CoinIcon, Icon } from './Icon'
import { compact } from './format'
import { openGarageTab } from './Menus'
import { openModSlot } from './Mods'
import { raceCarOf } from '../game/raceCar'
import './crates.css'
import { LoadingScene } from './Loading'

const CRATE_KEY = 'cartopia-crate'
const CRATE_CAM = { position: [0, 4, 9] as [number, number, number], fov: 42, near: 0.3, far: 60, shadows: true }
const price = (c: CrateDef, level: number) => {
  const p = crateCost(c, level)
  return p.coins ? <><CoinIcon size={16} />{compact(p.coins)}</> : <><BuckIcon size={16} />{p.bucks}</>
}

// A little crate drawn in CSS for the picker, in the crate's own colours.
function CrateIcon({ c }: { c: CrateDef }) {
  return (
    <span className={`crate-ico ${c.id}`} style={{ '--wood': c.look.wood, '--band': c.look.band, '--glow': c.look.glow } as React.CSSProperties} aria-hidden>
      <i /><i /><i />
    </span>
  )
}

// The odds a crate shows: coins, parts, cars and skins, and on a tap the parts, cars or skins it
// can hold. Cars and skins you already have are dimmed with a coin, since they pay coins instead;
// the crate's own cars your level hasn't reached yet show a lock. The parts slice turns to coins
// once no part in it fits a car of yours.
function Odds({ c, level }: { c: CrateDef; level: number }) {
  const [open, setOpen] = useState<'mod' | 'car' | 'skin' | null>(null)
  const o = crateOddsShown(c, level)
  const cars = useGame((s) => s.cars)
  const skinIds = useGame((s) => s.skins)
  const modSkinIds = useGame((s) => s.modSkins)
  const claimedSets = useGame((s) => s.claimedSets)
  const have = useMemo(() => new Set(cars.map((x) => x.model)), [cars])
  const haveSkin = useMemo(() => {
    const st = { level, claimedSets, skins: skinIds, modSkins: modSkinIds }
    return new Set([...ownedSkins(st).map((id) => 'b:' + id), ...ownedModSkins(st).map((id) => 'p:' + id)])
  }, [level, claimedSets, skinIds, modSkinIds])
  // Parts that can drop now first, then the crate's own parts that can't (locked, owned or no fit).
  const parts = useMemo(() => {
    const now = new Set(modChoices(c, level, cars).flatMap((x) => x.mods))
    const own = homeMods(c).filter((m) => !now.has(m.id))
    return [...[...now].map((id) => ({ m: modDef(id)!, live: true })), ...own.map((m) => ({ m, live: false }))]
  }, [c, level, cars])
  const noParts = !parts.some((x) => x.live)
  const list = useMemo(() => carOdds(c, level).sort((a, b) => b.p - a.p), [c, level])
  const locked = useMemo(() => homeCars(c).filter((d) => d.unlockLevel > level).sort((a, b) => a.unlockLevel - b.unlockLevel), [c, level])
  const skins = useMemo(() => skinOdds(c).sort((a, b) => b.p - a.p), [c])
  const pct = (p: number) => (p < 0.1 ? p.toFixed(2) : p.toFixed(p < 1 ? 1 : 0))
  const toggle = (k: 'mod' | 'car' | 'skin') => setOpen(open === k ? null : k)
  const slot = (m: ModDef) => MOD_SLOTS.find((x) => x.id === m.slot)?.icon
  return (
    <div className="crate-odds">
      <div className="crate-odds-row">
        <span className="odd coins" style={{ flex: o.coins }}><b>🪙</b>{o.coins}%</span>
        <button className={`odd mod${noParts ? ' spent' : ''}`} style={{ flex: Math.max(o.mod, 14) }} onClick={() => toggle('mod')} aria-expanded={open === 'mod'} title={noParts ? 'No parts left to fit your cars: pays coins' : undefined}><b>{noParts ? '🔧🪙' : '🔧'}</b>{o.mod}%<small>{open === 'mod' ? '▴' : '▾'}</small></button>
        <button className="odd car" style={{ flex: Math.max(o.car, 14) }} onClick={() => toggle('car')} aria-expanded={open === 'car'}><b>🚗</b>{o.car}%<small>{open === 'car' ? '▴' : '▾'}</small></button>
        {o.skin > 0 && <button className="odd skin" style={{ flex: Math.max(o.skin, 14) }} onClick={() => toggle('skin')} aria-expanded={open === 'skin'}><b>✨</b>{o.skin}%<small>{open === 'skin' ? '▴' : '▾'}</small></button>}
      </div>
      {open === 'mod' && (
        <div className="crate-cars">
          {parts.map(({ m, live }) => (
            <span key={m.id} className={`crate-part${live ? '' : ' off'}${m.bucks ? ' gem' : ''}`} title={live ? m.name : m.unlockLevel > level ? `${m.name} (level ${m.unlockLevel})` : `${m.name} (no car of yours needs it)`}>
              <i>{slot(m)}</i>
              <small>{m.unlockLevel > level ? `🔒${m.unlockLevel}` : m.name}</small>
            </span>
          ))}
        </div>
      )}
      {open === 'car' && (
        <div className="crate-cars">
          {list.map((x) => {
            const d = carDef(x.model)
            return (
              <span key={x.model} className={`crate-car${have.has(x.model) ? ' owned' : ''}`} title={have.has(x.model) ? `${d.name} (owned: pays coins)` : d.name}>
                <CarThumb size="xs" body={d.body} model={d.id} color={d.colors[0]} />
                <small>{pct(x.p * o.car)}%</small>
              </span>
            )
          })}
          {locked.map((d) => (
            <span key={d.id} className="crate-car locked" title={`${d.name} (level ${d.unlockLevel})`}>
              <CarThumb size="xs" body={d.body} model={d.id} color={d.colors[0]} />
              <small>🔒{d.unlockLevel}</small>
            </span>
          ))}
          {!list.length && !locked.length && <span className="crate-none">No cars at your level yet</span>}
        </div>
      )}
      {open === 'skin' && (
        <div className="crate-cars">
          {skins.map((x) => (
            <span key={(x.part ? 'p:' : 'b:') + x.id} className={`crate-skin${haveSkin.has((x.part ? 'p:' : 'b:') + x.id) ? ' owned' : ''}`} title={`${x.def.name}${x.part ? ' (part skin)' : ''}${haveSkin.has((x.part ? 'p:' : 'b:') + x.id) ? ' (owned: pays coins)' : ''}`} style={{ '--tier': SKIN_TIERS[x.def.tier].color } as React.CSSProperties}>
              <i style={{ background: x.def.swatch }}>{x.part && <em>🔧</em>}</i>
              <small>{pct(x.p * o.skin)}%</small>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// What came out, under the reveal.
// The prize buttons leave the crates for the Garage with the prize on try-on there, on the car
// it's for (a paint: `paintCar`); the Garage's own buttons fit it.
function Prize({ open, onAgain, onDone, again, paintCar }: { open: CrateOpen; onAgain: () => void; onDone: () => void; again: React.ReactNode; paintCar: string | null }) {
  const cars = useGame((s) => s.cars)
  const d = open.drop
  // A car paint goes on try-on in the Paint tab; a mod paint on a part slot in the Mods tab,
  // the first paintable slot the car has a part in.
  const wearSkin = (skin: string, part: boolean) => {
    if (!paintCar) return
    onDone()
    if (!part) return openGarageTab('paint', { car: paintCar, skin })
    const car = cars.find((c) => c.uid === paintCar)
    const fit = car ? fittedMods(car.mods, carDef(car.model).body) : {}
    const slot = SKINNED_SLOTS.find((sl) => fit[sl]) ?? 'spoiler'
    openModSlot(slot)
    openGarageTab('mods', { car: paintCar, modSkin: { slot, skin } })
  }
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
  } else if (d.kind === 'skin' || d.kind === 'skindupe') {
    const def = skinOf(d.skin, d.part)
    // Mod paints go on parts, car paints on the whole body: say which in the name.
    const kind = d.part ? 'Mod Paint' : 'Car Paint'
    icon = <span className={`cp-swatch ${d.part ? 'mod' : 'car'}`} style={{ background: def?.swatch }}>{d.part ? '⚙️' : '🚗'}</span>
    if (d.kind === 'skindupe') {
      title = `+${d.coins.toLocaleString()} coins`
      sub = `${def?.name ?? ''} ${kind} · already yours`
    } else {
      title = `${def?.name ?? ''} ${kind}`
      sub = `New ${def ? SKIN_TIERS[def.tier].name.toLowerCase() : ''} ${kind.toLowerCase()}!`
    }
  } else if (d.kind === 'car') {
    icon = '🚗'
    title = carDef(d.model).name
    sub = 'New car!'
  } else if (d.kind === 'hat') {
    const h = hatDef(d.hat)
    icon = h?.icon ?? '🎩'
    title = h?.name ?? 'Hat'
    sub = 'New hat!'
  } else {
    const car = cars.find((c) => c.uid === d.car)
    icon = '⚙️'
    title = modDef(d.mod)?.name ?? 'Part'
    sub = car ? `For your ${carDef(car.model).name}` : 'New part'
  }
  return (
    <div className={`crate-prize tier${tier}`} style={{ '--glow': TIER_GLOW[tier] } as React.CSSProperties}>
      <span className="cp-icon">{icon}</span>
      <div className="cp-text"><small>{sub}</small><b>{title}</b></div>
      <div className="cp-actions">
        {d.kind === 'mod' && <button className="buy small" onClick={() => { onDone(); openModSlot(modDef(d.mod)?.slot ?? 'spoiler'); openGarageTab('mods', { car: d.car, mod: d.mod }) }}>Fit it</button>}
        {d.kind === 'skin' && paintCar && <button className="buy small alt" onClick={() => wearSkin(d.skin, d.part)}>Use it</button>}
        {d.kind === 'hat' && paintCar && <button className="buy small alt" onClick={() => { onDone(); openGarageTab('hats', { car: paintCar, hat: d.hat }) }}>Wear it</button>}
        {d.kind === 'car' && <button className="buy small alt" onClick={() => { onDone(); useGame.getState().selectCar(d.uid); openGarageTab('tune') }}>Garage</button>}
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
  // A new paint is shown on your selected car, or else the car you race with.
  const selectedCar = useGame((s) => s.selectedCar)
  const raceCar = useGame((s) => s.raceCar)
  const paintCar = (selectedCar && carsAt.some((c) => c.uid === selectedCar) ? selectedCar : raceCarOf(carsAt, raceCar)?.uid) ?? null
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
  // The latest phase, for Again: its delayed go() comes from the render where the prize was still open.
  const phaseNow = useRef(phase)
  useEffect(() => { phaseNow.current = phase }, [phase])
  const go = async () => {
    if (phaseNow.current !== 'idle') return
    phaseNow.current = 'wait'
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

  // The depot draws in the shared race canvas (scene/Stage.tsx): a canvas of its own
  // meant a new WebGL context and ~20 shaders compiled on every visit.
  const drop = open?.drop ?? null
  const prizeCar = useMemo(() => prizeLook(drop, carsAt, paintCar), [drop, carsAt, paintCar])
  const onReveal = useCallback(() => setShown(true), [])
  const scene = useMemo(
    () => <CrateScene run={run} def={shownDef} phase={phase} drop={drop} prizeCar={prizeCar} onReveal={onReveal} skip={skip} />,
    [run, shownDef, phase, drop, prizeCar, onReveal, skip],
  )
  const stageReady = useStageReady()

  const locked = level < def.unlockLevel
  return (
    <div className="race-full crate-full" onClick={() => { if (phase === 'open' && !shown) setSkip((k) => k + 1) }}>
      <StageSlot cam={CRATE_CAM}>{scene}</StageSlot>
      <LoadingScene ready={stageReady} label="Opening the Crate Depot" onClose={close} />
      <div className="rf-top">
        <h2>📦 Crate Depot</h2>
        <span className="crate-wallet"><span><CoinIcon size={16} />{compact(coins)}</span><span><BuckIcon size={16} />{compact(bucks)}</span></span>
        <button className="close" onClick={close} aria-label="Close"><Icon name="close" size={16} /></button>
      </div>
      {phase === 'open' && !shown && <div className="crate-skip">Tap to skip</div>}
      {phase === 'open' && shown && open && (
        <Prize open={open} paintCar={paintCar} onDone={queue.length > 1 ? next : () => { next() }} onAgain={again}
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
