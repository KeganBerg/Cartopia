import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StageSlot, useStageReady } from '../scene/Stage'
import { useGame, openCrate } from '../game/store'
import { CUSTOM_PAINT, CUSTOM_PAINT_SHOW, MOD_SLOTS, SKINNED_SLOTS, carDef, fittedMods, modDef, ownedModSkins, type ModDef } from '../game/data'
import { crateHats, hatDef } from '../game/hats'
import { CRATES, carOdds, crateCost, crateOwnedSkins, crateDef, crateOddsShown, dropTier, homeCars, homeMods, modChoices, pityLeft, revealOrder, skinOdds, skinOf, type CrateDef, type CrateDrop, type CrateId, type CrateOpen } from '../game/crates'
import { SKIN_TIERS } from '../game/data'
import { CrateScene, TIER_GLOW, prizeLook, type CratePace, type CratePhase } from '../scene/CrateScene'
import { CarThumb } from '../scene/BuildingPreview'
import { BuckIcon, CoinIcon, Icon } from './Icon'
import { compact } from './format'
import { openGarageTab } from './Menus'
import { openModSlot } from './Mods'
import { raceCarOf } from '../game/raceCar'
import { freeCrateOf } from '../game/cups'
import './crates.css'
import { LoadingScene } from './Loading'
import { BuildArt } from './Resto'
import { PIECE_COUNT, RESTO_PIECES, piecesOf, restoCars } from '../game/resto'

const CRATE_KEY = 'cartopia-crate'
const CRATE_CAM = { position: [0, 4, 9] as [number, number, number], fov: 42, near: 0.3, far: 60, shadows: true }
const price = (c: CrateDef, level: number, n = 1) => {
  const p = crateCost(c, level)
  return p.coins ? <><CoinIcon size={16} />{compact(p.coins * n)}</> : <><BuckIcon size={16} />{compact(p.bucks * n)}</>
}

// A little crate drawn in CSS for the picker, in the crate's own colours.
function CrateIcon({ c }: { c: CrateDef }) {
  return (
    <span className={`crate-ico ${c.id}`} style={{ '--wood': c.look.wood, '--band': c.look.band, '--glow': c.look.glow } as React.CSSProperties} aria-hidden>
      <i /><i /><i />
    </span>
  )
}

// The odds a crate shows: coins, hats, parts, paints, cars and resto-mod pieces (rarest last),
// and on a tap what each can hold. Cars and skins you already have are dimmed with a coin, since
// they pay coins instead; the crate's own cars your level hasn't reached yet show a lock. The parts slice turns to coins
// once no part in it fits a car of yours.
function Odds({ c, level }: { c: CrateDef; level: number }) {
  const [open, setOpen] = useState<'mod' | 'car' | 'skin' | 'piece' | 'hat' | null>(null)
  const restoParts = useGame((s) => s.restoParts)
  const hatIds = useGame((s) => s.hats)
  // The crate's hats you don't have yet: only those drop, so with none left the slice is coins.
  const hats = useMemo(() => crateHats(c.id).map((h) => ({ h, have: (hatIds ?? []).includes(h.id) })), [c.id, hatIds])
  const o = crateOddsShown(c, level, hats.some((x) => !x.have))
  const cars = useGame((s) => s.cars)
  const skinIds = useGame((s) => s.skins)
  const modSkinIds = useGame((s) => s.modSkins)
  const claimedSets = useGame((s) => s.claimedSets)
  const left = pityLeft(c, useGame((s) => s.cratePity?.[c.id] ?? 0))
  const have = useMemo(() => new Set(cars.map((x) => x.model)), [cars])
  const haveSkin = useMemo(() => {
    const st = { level, claimedSets, skins: skinIds, modSkins: modSkinIds }
    return new Set([...crateOwnedSkins(st).map((id) => 'b:' + id), ...ownedModSkins(st).map((id) => 'p:' + id)])
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
  const toggle = (k: 'mod' | 'car' | 'skin' | 'piece' | 'hat') => setOpen(open === k ? null : k)
  const slot = (m: ModDef) => MOD_SLOTS.find((x) => x.id === m.slot)?.icon
  return (
    <div className="crate-odds">
      <div className="crate-odds-row">
        <span className="odd coins" style={{ flex: o.coins }}><b>🪙</b>{o.coins}%</span>
        {o.hat > 0 && <button className="odd hat" style={{ flex: Math.max(o.hat, 14) }} onClick={() => toggle('hat')} aria-expanded={open === 'hat'}><b>🎩</b>{o.hat}%<small>{open === 'hat' ? '▴' : '▾'}</small></button>}
        <button className={`odd mod${noParts ? ' spent' : ''}`} style={{ flex: Math.max(o.mod, 14) }} onClick={() => toggle('mod')} aria-expanded={open === 'mod'} title={noParts ? 'No parts left to fit your cars: pays coins' : undefined}><b>{noParts ? '🔧🪙' : '🔧'}</b>{o.mod}%<small>{open === 'mod' ? '▴' : '▾'}</small></button>
        {o.skin > 0 && <button className="odd skin" style={{ flex: Math.max(o.skin, 14) }} onClick={() => toggle('skin')} aria-expanded={open === 'skin'}><b>✨</b>{o.skin}%<small>{open === 'skin' ? '▴' : '▾'}</small></button>}
        <button className="odd car" style={{ flex: Math.max(o.car, 14) }} onClick={() => toggle('car')} aria-expanded={open === 'car'}><b>🚗</b>{o.car}%<small>{open === 'car' ? '▴' : '▾'}</small></button>
        {o.piece > 0 && <button className="odd piece" style={{ flex: Math.max(o.piece, 14) }} onClick={() => toggle('piece')} aria-expanded={open === 'piece'}><b>🧩</b>{o.piece}%<small>{open === 'piece' ? '▴' : '▾'}</small></button>}
      </div>
      {left != null && (
        <div className="crate-pity" title={`A ${c.pity?.tier ?? ''} skin is guaranteed within ${left} ${left === 1 ? 'open' : 'opens'}`.replace('  ', ' ')}>
          <b>{c.pity?.tier === 'legendary' ? '🌟' : '✨'}</b>{left === 1 ? 'Next one' : `≤ ${left}`}
        </div>
      )}
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
      {open === 'hat' && (
        <div className="crate-cars">
          {hats.map(({ h, have }) => (
            <span key={h.id} className={`crate-car hat${have ? ' owned' : ''}`} title={have ? `${h.name} (owned)` : h.name}>
              <i>{h.icon}</i>
              <small>{have ? '✔' : `${pct((o.hat / hats.filter((x) => !x.have).length))}%`}</small>
            </span>
          ))}
        </div>
      )}
      {open === 'piece' && (
        <div className="crate-cars">
          {restoCars().map((d) => {
            const have = piecesOf(restoParts, d.id)
            const done = cars.some((x) => x.model === d.id)
            const lock = d.unlockLevel > level
            return (
              <span key={d.id} className={`crate-car resto${lock ? ' locked' : ''}`} title={d.name}>
                <BuildArt model={d.id} have={have} done={done} />
                <small>{lock ? `🔒${d.unlockLevel}` : done ? '✔' : `${have.length}/${PIECE_COUNT}`}</small>
              </span>
            )
          })}
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

// What a prize is, in words and a picture: its name, one short line under it and an icon.
function usePrizeInfo(d: CrateDrop) {
  const cars = useGame((s) => s.cars)
  const restoParts = useGame((s) => s.restoParts)
  let title = ''
  let sub = ''
  let icon: React.ReactNode = <CoinIcon size={36} />
  if (d.kind === 'coins') {
    title = `${d.coins.toLocaleString()} coins`
    sub = d.jackpot ? 'Jackpot!' : 'Coins'
  } else if (d.kind === 'dupe') {
    icon = '🔁'
    title = `${d.coins.toLocaleString()} coins`
    sub = `${carDef(d.model).name} · already yours`
  } else if (d.kind === 'skin' || d.kind === 'skindupe') {
    const def = skinOf(d.skin, d.part)
    // Mod paints go on parts, car paints on the whole body: say which in the name.
    const kind = d.part ? 'Mod Paint' : d.skin === CUSTOM_PAINT.id ? 'Unlock' : 'Car Paint'
    icon = <span className={`cp-swatch ${d.part ? 'mod' : 'car'}`} style={{ background: def?.swatch }}>{d.part ? '⚙️' : '🚗'}</span>
    if (d.kind === 'skindupe') {
      title = `${d.coins.toLocaleString()} coins`
      sub = `${def?.name ?? ''} ${kind} · already yours`
    } else {
      title = `${def?.name ?? ''} ${kind}`
      sub = `New ${def ? SKIN_TIERS[def.tier].name.toLowerCase() : ''} ${kind.toLowerCase()}!`
    }
  } else if (d.kind === 'car') {
    icon = '🚗'
    title = carDef(d.model).name
    sub = 'New car!'
  } else if (d.kind === 'piece' || d.kind === 'piecedupe') {
    const have = piecesOf(restoParts, d.model)
    icon = <BuildArt model={d.model} have={have} fresh={d.kind === 'piece' ? d.piece : undefined} done={d.kind === 'piece' && !!d.uid} />
    if (d.kind === 'piecedupe') {
      title = `${d.coins.toLocaleString()} coins`
      sub = `${RESTO_PIECES[d.piece].name} · already yours`
    } else if (d.uid) {
      title = carDef(d.model).name
      sub = 'Built! Secret car'
    } else {
      title = `${RESTO_PIECES[d.piece].icon} ${RESTO_PIECES[d.piece].name} piece`
      sub = `${carDef(d.model).name} · ${have.length}/${PIECE_COUNT}`
    }
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
  return { title, sub, icon }
}

// The prize's own buttons: they leave the crates for the Garage with the prize on try-on there,
// on the car it's for (a paint: `paintCar`); the Garage's own buttons fit it.
function PrizeActions({ d, paintCar, onDone, small }: { d: CrateDrop; paintCar: string | null; onDone: () => void; small?: boolean }) {
  const cars = useGame((s) => s.cars)
  // A car paint goes on try-on in the Paint tab; a mod paint on a part slot in the Mods tab,
  // the first paintable slot the car has a part in.
  const wearSkin = (skin: string, part: boolean) => {
    if (!paintCar) return
    onDone()
    if (!part && skin === CUSTOM_PAINT.id) return openGarageTab('paint', { car: paintCar, color: CUSTOM_PAINT_SHOW })
    if (!part) return openGarageTab('paint', { car: paintCar, skin })
    const car = cars.find((c) => c.uid === paintCar)
    const fit = car ? fittedMods(car.mods, carDef(car.model).body) : {}
    const slot = SKINNED_SLOTS.find((sl) => fit[sl]) ?? 'spoiler'
    openModSlot(slot)
    openGarageTab('mods', { car: paintCar, modSkin: { slot, skin } })
  }
  const cls = small ? 'buy tiny' : 'buy small'
  return (
    <>
      {d.kind === 'mod' && <button className={cls} onClick={() => { onDone(); openModSlot(modDef(d.mod)?.slot ?? 'spoiler'); openGarageTab('mods', { car: d.car, mod: d.mod }) }}>Fit it</button>}
      {d.kind === 'skin' && paintCar && <button className={`${cls} alt`} onClick={() => wearSkin(d.skin, d.part)}>Use it</button>}
      {d.kind === 'hat' && paintCar && <button className={`${cls} alt`} onClick={() => { onDone(); openGarageTab('hats', { car: paintCar, hat: d.hat }) }}>Wear it</button>}
      {d.kind === 'car' && <button className={`${cls} alt`} onClick={() => { onDone(); useGame.getState().selectCar(d.uid); openGarageTab('tune') }}>Garage</button>}
      {d.kind === 'piece' && d.uid && <button className={`${cls} alt`} onClick={() => { onDone(); useGame.getState().selectCar(d.uid!); openGarageTab('tune') }}>Garage</button>}
    </>
  )
}

// What came out, under the reveal.
function Prize({ open, onAgain, onDone, again, paintCar }: { open: CrateOpen; onAgain: () => void; onDone: () => void; again: React.ReactNode; paintCar: string | null }) {
  const d = open.drop
  const tier = dropTier(d)
  const { title, sub, icon } = usePrizeInfo(d)
  return (
    <div className={`crate-prize tier${tier}`} style={{ '--glow': TIER_GLOW[tier] } as React.CSSProperties}>
      <span className="cp-icon">{icon}</span>
      <div className="cp-text"><small>{sub}</small><b>{title}</b></div>
      <div className="cp-actions">
        <PrizeActions d={d} paintCar={paintCar} onDone={onDone} />
        <button className="buy small" onClick={onAgain}>{again}</button>
        <button className="sell small" onClick={onDone}>Done</button>
      </div>
    </div>
  )
}

// Each kind of prize as an icon, for the ×10 progress strip.
const DROP_ICON: Record<CrateDrop['kind'], string> = { coins: '🪙', dupe: '🪙', skindupe: '🪙', piecedupe: '🪙', mod: '⚙️', skin: '🎨', car: '🚗', hat: '🎩', piece: '🧩' }

// A ×10 open's progress strip: a slot per crate, lit with its prize's icon once it's shown.
function TenStrip({ opens, at }: { opens: CrateOpen[]; at: number }) {
  return (
    <div className="crate-ten-strip">
      {opens.map((o, i) => {
        const tier = dropTier(o.drop)
        return <i key={i} className={i < at ? `got tier${tier}` : i === at ? 'now' : ''} style={{ '--glow': TIER_GLOW[tier] } as React.CSSProperties}>{i < at ? DROP_ICON[o.drop.kind] : ''}</i>
      })}
    </div>
  )
}

// The name of the prize just shown in a ×10 run, for a moment, under the crate.
function TenFlash({ open }: { open: CrateOpen }) {
  const tier = dropTier(open.drop)
  const { title, icon } = usePrizeInfo(open.drop)
  return (
    <div className={`crate-ten-flash tier${tier}`} style={{ '--glow': TIER_GLOW[tier] } as React.CSSProperties}>
      <span className="cp-icon">{icon}</span><b>{title}</b>
    </div>
  )
}

// One prize of a ×10 open in the summary: its render, one line, and its own button.
function SumTile({ open, sel, paintCar, onPick, onDone }: { open: CrateOpen; sel: boolean; paintCar: string | null; onPick: () => void; onDone: () => void }) {
  const cars = useGame((s) => s.cars)
  const restoParts = useGame((s) => s.restoParts)
  const d = open.drop
  const tier = dropTier(d)
  const look = useMemo(() => prizeLook(d, cars, paintCar), [d, cars, paintCar])
  const { title } = usePrizeInfo(d)
  const coins = 'coins' in d ? d.coins : 0
  const art = d.kind === 'piece' || d.kind === 'piecedupe'
    ? <BuildArt model={d.model} have={piecesOf(restoParts, d.model)} done={d.kind === 'piece' && !!d.uid} size="xs" />
    : look ? <CarThumb size="sm" {...look} />
    : <span className={`cs-coin${d.kind === 'coins' && d.jackpot ? ' jackpot' : ''}`}><CoinIcon size={34} /></span>
  // Coins and coins back show the amount; the rest their name.
  // (A paint's tile shows just its name: the badge says it's a paint.)
  const line = d.kind === 'coins' || d.kind === 'dupe' || d.kind === 'skindupe' || d.kind === 'piecedupe'
    ? <><CoinIcon size={13} />{compact(coins)}</>
    : d.kind === 'skin' ? skinOf(d.skin, d.part)?.name ?? title : title
  return (
    <div className={`crate-sum-tile tier${tier}${sel ? ' sel' : ''}`} style={{ '--glow': TIER_GLOW[tier] } as React.CSSProperties} onClick={onPick} title={title}>
      <span className="cs-art">{art}{d.kind === 'mod' && <em className="cs-badge">⚙️</em>}{(d.kind === 'skin' || d.kind === 'skindupe') && <em className="cs-badge">🎨</em>}{d.kind === 'hat' && <em className="cs-badge">🎩</em>}{(d.kind === 'dupe' || d.kind === 'skindupe') && <em className="cs-badge left">🔁</em>}</span>
      <small>{line}</small>
      <span className="cs-act" onClick={(e) => e.stopPropagation()}><PrizeActions d={d} paintCar={paintCar} onDone={onDone} small /></span>
    </div>
  )
}

export function CratesPanel() {
  const level = useGame((s) => s.level)
  const coins = useGame((s) => s.coins)
  const bucks = useGame((s) => s.bucks)
  const cars = useGame((s) => s.cars)
  // Free crates waiting (Class Cup and weekly arcade prizes, see game/cups.ts), each of its own crate.
  const freeCrates = useGame((s) => s.freeCrates) ?? []
  const close = () => useGame.getState().closePanel()
  const [pick, setPick] = useState<CrateId>(() => {
    if (freeCrates.length) return freeCrateOf(freeCrates[0])
    try {
      const saved = localStorage.getItem(CRATE_KEY) as CrateId | null
      if (saved && crateDef(saved) && level >= crateDef(saved)!.unlockLevel) return saved
    } catch {
      // A remembered pick is a nicety.
    }
    return 'street'
  })
  const def = crateDef(pick)!
  const freeHere = freeCrates.filter((f) => freeCrateOf(f) === pick)
  const free = freeHere[0]
  const [phase, setPhase] = useState<CratePhase>('idle')
  // Opens still to show (more than one when earlier ones are handed over late), the one showing, and whether it's up.
  const [queue, setQueue] = useState<CrateOpen[]>([])
  const [shown, setShown] = useState(false)
  const [run, setRun] = useState(0)
  const [skip, setSkip] = useState(0)
  // A ×10 open: its prizes in the order they're shown (rarest last), how far it's got, and once
  // it's done the summary with the prize picked to look at on the lift.
  const [ten, setTen] = useState<CrateOpen[] | null>(null)
  const [tenAt, setTenAt] = useState(0)
  const [summary, setSummary] = useState<number | null>(null)
  // How the crate on the lift opens: the first nine quickly, the last in full, and a prize picked
  // in the summary goes back on the lift without a crate.
  const [tenPace, setTenPace] = useState<CratePace>('quick')
  // A part prize shows the car as it was before the part was added, so keep that car.
  const [carsAt, setCarsAt] = useState(cars)
  const open = ten ? ten[summary ?? tenAt] ?? null : queue[0] ?? null
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
  const go = async (count = 1) => {
    if (phaseNow.current !== 'idle') return
    phaseNow.current = 'wait'
    const before = useGame.getState().cars
    setPhase('wait')
    const got = await openCrate(pick, count > 1 ? undefined : free, count)
    if (!got?.length) {
      setPhase('idle')
      return
    }
    setShown(false)
    if (count > 1 && got.length > 1) {
      // The ten were added in the order they were rolled; they're shown rarest last, on the cars as they are now.
      setCarsAt(useGame.getState().cars)
      setTen(revealOrder(got))
      setTenAt(0)
      setSummary(null)
      setTenPace(got.length > 1 ? 'quick' : 'full')
      setRun((r) => r + 1)
    } else {
      setCarsAt(before)
      setQueue(got)
    }
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
    setTen(null)
    setSummary(null)
    setPhase('idle')
  }
  const again = (count = 1) => {
    next()
    if (queue.length <= 1) setTimeout(() => go(count), 650)
  }
  // ×10: the next crate, or after the last one the summary, with the rarest prize on the lift.
  const tenNext = useCallback(() => {
    if (!ten || summary != null) return
    setShown(false)
    if (tenAt < ten.length - 1) {
      setTenAt(tenAt + 1)
      setTenPace(tenAt + 1 === ten.length - 1 ? 'full' : 'quick')
      setRun((r) => r + 1)
    } else setSummary(ten.length - 1)
  }, [ten, tenAt, summary])
  const tenSkip = () => {
    if (!ten) return
    setShown(false)
    setSummary(ten.length - 1)
    setTenPace('show')
    setRun((r) => r + 1)
  }
  const inspect = (i: number) => {
    if (i === summary) return
    setSummary(i)
    setTenPace('show')
    setRun((r) => r + 1)
  }
  // A quick crate's prize stays up a moment, then the next one drops in. The last one stays
  // up a little longer before the summary comes up under it.
  const lastTen = !!ten && tenAt === ten.length - 1
  useEffect(() => {
    if (!ten || summary != null || !shown) return
    const t = setTimeout(tenNext, lastTen ? 1600 : 480)
    return () => clearTimeout(t)
  }, [ten, summary, shown, lastTen, tenNext])

  // The depot draws in the shared race canvas (scene/Stage.tsx): a canvas of its own
  // meant a new WebGL context and ~20 shaders compiled on every visit.
  const drop = open?.drop ?? null
  const prizeCar = useMemo(() => prizeLook(drop, carsAt, paintCar), [drop, carsAt, paintCar])
  const onReveal = useCallback(() => setShown(true), [])
  const pace: CratePace = ten ? tenPace : 'full'
  const scene = useMemo(
    () => <CrateScene run={run} def={shownDef} phase={phase} drop={drop} prizeCar={prizeCar} onReveal={onReveal} skip={skip} pace={pace} />,
    [run, shownDef, phase, drop, prizeCar, onReveal, skip, pace],
  )
  const stageReady = useStageReady()

  const locked = !free && level < def.unlockLevel
  const tenLocked = level < def.unlockLevel
  const tap = () => {
    if (phase !== 'open') return
    if (ten && summary == null) {
      // A tap moves a ×10 run along: the crate opening jumps to its prize, a prize shown goes on to the next.
      if (shown) tenNext()
      else setSkip((k) => k + 1)
    } else if (!ten && !shown) setSkip((k) => k + 1)
  }
  return (
    <div className="race-full crate-full" onClick={tap}>
      {/* Taps go through the canvas to the screen behind it: "Tap to skip". */}
      <StageSlot cam={CRATE_CAM} through>{scene}</StageSlot>
      <LoadingScene ready={stageReady} label="Opening the Crate Depot" onClose={close} />
      <div className="rf-top">
        <h2>📦 Crate Depot</h2>
        <span className="crate-wallet"><span><CoinIcon size={16} />{compact(coins)}</span><span><BuckIcon size={16} />{compact(bucks)}</span></span>
        <button className="close" onClick={close} aria-label="Close"><Icon name="close" size={16} /></button>
      </div>
      {phase === 'open' && !shown && !ten && <div className="crate-skip">Tap to skip</div>}
      {phase === 'open' && shown && open && !ten && (
        <Prize open={open} paintCar={paintCar} onDone={queue.length > 1 ? next : () => { next() }} onAgain={() => again()}
          again={queue.length > 1 ? 'Next' : free ? `🎁 Free · ${freeHere.length}` : <>Again · {price(crateDef(open.crate) ?? def, level)}</>} />
      )}
      {ten && summary == null && (
        <>
          <TenStrip opens={ten} at={shown ? tenAt + 1 : tenAt} />
          {shown && open && <TenFlash key={tenAt} open={open} />}
          <button className="crate-ten-skip" onClick={(e) => { e.stopPropagation(); tenSkip() }} aria-label="Skip to all prizes">⏭</button>
        </>
      )}
      {ten && summary != null && (
        <div className="crate-sum" onClick={(e) => e.stopPropagation()}>
          <div className="crate-sum-grid">
            {ten.map((o, i) => <SumTile key={i} open={o} sel={i === summary} paintCar={paintCar} onPick={() => inspect(i)} onDone={next} />)}
          </div>
          <div className="cp-actions">
            {!tenLocked && <button className="buy small" onClick={() => again(10)}>Again ×10 · {price(def, level, 10)}</button>}
            <button className="sell small" onClick={next}>Done</button>
          </div>
        </div>
      )}
      {phase !== 'open' && (
        <div className="crate-dock" onClick={(e) => e.stopPropagation()}>
          <div className="crate-pick">
            {CRATES.map((c) => (
              <button key={c.id} className={`crate-tab${c.id === pick ? ' sel' : ''}${level < c.unlockLevel ? ' locked' : ''}`} onClick={() => choose(c.id)} disabled={phase !== 'idle'}>
                <CrateIcon c={c} />
                <b>{c.name.replace(' Crate', '')}</b>
                <span className={c.pay === 'bucks' ? 'ct-price gem' : 'ct-price'}>{freeCrates.some((f) => freeCrateOf(f) === c.id) ? `🎁 ${freeCrates.filter((f) => freeCrateOf(f) === c.id).length}` : level < c.unlockLevel ? `🔒 Lv ${c.unlockLevel}` : price(c, level)}</span>
              </button>
            ))}
          </div>
          <Odds key={pick} c={def} level={level} />
          <div className="crate-buttons">
            <button className={`crate-open${def.pay === 'bucks' ? ' gem' : ''}`} disabled={phase !== 'idle'} onClick={() => go()}>
              {phase === 'wait' ? 'Opening…' : free ? `🎁 Free · ${freeHere.length}` : locked ? `🔒 Level ${def.unlockLevel}` : <>Open · {price(def, level)}</>}
            </button>
            {!tenLocked && (
              <button className={`crate-open ten${def.pay === 'bucks' ? ' gem' : ''}`} disabled={phase !== 'idle'} onClick={() => go(10)}>
                <span className="ct-x">×10</span>{price(def, level, 10)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
