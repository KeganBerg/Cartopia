import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, type OwnedCar } from '../game/store'
import { bestCar, raceCarOf } from '../game/raceCar'
import { carDef } from '../game/data'
import {
  CHASE_HEARTS, PARK_LOTS, PARK_MAX_BUMPS, chaseReward, chaseScore, loadBests, lotOpen, parkReward, parkStars, saveBests,
} from '../game/arcade'
import { ChaseScene, type ChaseHud, type ChaseInput, type ChasePop } from '../scene/ChaseScene'
import { ParkScene, type ParkEnd, type ParkHud } from '../scene/ParkScene'
import { KeyHints, TouchDrive, newDriveInput, useDriveKeys, useTall, useTouchDevice } from './DriveControls'
import { CarThumb } from '../scene/BuildingPreview'
import { Panel } from './Menus'
import { sfx } from '../lib/sound'
import { Cost, Countdown, Result, look, payFuel, pi, useStable } from './ArcadeBits'
import { STAR_GAMES, StarGame } from './ArcadeMore'
import { loadStars, type StarGameId } from '../game/arcadeMore'
import { LoadingScene } from './Loading'
import { ArcadeCardScene } from '../scene/ArcadeCards'
import { StageSlot, useStageReady } from '../scene/Stage'
import { startArcadeRun, submitArcadeRun } from '../lib/arcadeBoard'
import { ClaimPrizes, WeeklyBoards, WeekPlace, useBoardsOn } from './ArcadeBoards'

// Both games draw in the shared full-screen canvas (scene/Stage.tsx): no new WebGL
// context and shader compile on every run.
const CHASE_CAM = { position: [0, 4.4, 8.5] as [number, number, number], fov: 55, near: 0.3, far: 160 }
const PARK_CAM = { position: [0, 20, 5] as [number, number, number], fov: 40, near: 0.5, far: 120 }

const FRESH_HUD: ChaseHud = { dist: 0, coins: 0, hearts: CHASE_HEARTS, speed: 0, bonus: 0, mult: 1, nitro: 0, warn: false, pop: null }

type Playing = { game: 'chase' } | { game: 'park'; lot: number } | { game: 'star'; id: StarGameId }

export function ArcadePanel() {
  const cars = useGame((s) => s.cars)
  // Starts on your race car; picking another here only lasts for this visit.
  const [carId, setCarId] = useState(() => raceCarOf(cars, useGame.getState().raceCar)?.uid)
  const car = cars.find((c) => c.uid === carId) ?? bestCar(cars)
  const me = useMemo(() => (car ? look(car) : null), [car])
  const [playing, setPlaying] = useState<Playing | null>(null)
  const [lots, setLots] = useState(false)
  const [boards, setBoards] = useState(false)
  const boardsOn = useBoardsOn()
  const [bests, setBests] = useState(loadBests)
  const [starBests, setStarBests] = useState(loadStars)
  const stars = bests.park
  const totalStars = stars.reduce((a, b) => a + b, 0)

  if (playing && car) {
    const exit = () => { setBests(loadBests()); setStarBests(loadStars()); setPlaying(null) }
    if (playing.game === 'star') return <StarGame id={playing.id} car={car} onExit={exit} />
    return playing.game === 'chase'
      ? <ChaseGame car={car} onExit={exit} />
      : <ParkGame car={car} lot={playing.lot} onExit={exit} onLot={(lot) => setPlaying({ game: 'park', lot })} />
  }

  return (
    <Panel title="🕹️ Arcade" wide className="arcade-panel">
      {car && cars.length > 1 && (
        <div className="arc-cars">
          {cars.slice().sort((a, b) => pi(b) - pi(a)).slice(0, 12).map((c) => (
            <button key={c.uid} className={c.uid === car.uid ? 'arc-car sel' : 'arc-car'} onClick={() => setCarId(c.uid)} title={carDef(c.model).name}>
              <CarThumb size="xs" color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} hat={c.hat} body={carDef(c.model).body} model={c.model} stripe={c.stripe} mods={c.mods} />
            </button>
          ))}
        </div>
      )}
      {boardsOn && !lots && !boards && (
        <div className="arc-top-row">
          <ClaimPrizes />
          <button className="arc-weekly" onClick={() => setBoards(true)}>🏆 Weekly</button>
        </div>
      )}
      {boards ? <WeeklyBoards onBack={() => setBoards(false)} /> : lots ? (
        <>
          <button className="arc-back" onClick={() => setLots(false)}>‹ Back</button>
          <div className="arc-lots">
            {PARK_LOTS.map((l, i) => {
              const open = lotOpen(stars, i)
              return (
                <button key={l.name} className={open ? 'arc-lot' : 'arc-lot locked'} disabled={!open}
                  onClick={() => { if (payFuel('a parking run', 'park')) setPlaying({ game: 'park', lot: i }) }}>
                  <b>{open ? i + 1 : '🔒'}</b>
                  <span>{l.name}</span>
                  <small>{[1, 2, 3].map((n) => (n <= (stars[i] ?? 0) ? '★' : '☆')).join('')}</small>
                </button>
              )
            })}
          </div>
          <p className="arc-fuel">Each run <Cost game="park" /></p>
        </>
      ) : (
        <div className="arc-games">
          <div className="arc-tile chase">
            {me && <ArcadeCardScene game="chase" me={me} />}
            <div className="arc-art">🚓💨🚗</div>
            <b>Getaway Chase</b>
            <small>Near misses, nitro, lose the cop</small>
            <span className="arc-best">🏆 {bests.chase.toLocaleString()}</span>
            <button className="buy" disabled={!car} onClick={() => { if (payFuel('a getaway', 'chase')) setPlaying({ game: 'chase' }) }}>Play · <Cost game="chase" /></button>
          </div>
          <div className="arc-tile park">
            {me && <ArcadeCardScene game="park" me={me} />}
            <div className="arc-art">🅿️🚙</div>
            <b>Parking Pro</b>
            <small>Steer into the spot</small>
            <span className="arc-best">★ {totalStars}/{PARK_LOTS.length * 3}</span>
            <button className="buy" disabled={!car} onClick={() => setLots(true)}>Pick a lot ›</button>
          </div>
          {STAR_GAMES.map((g) => {
            const b = starBests[g.id]
            const best = b.best ? (g.id === 'pit' ? `⏱ ${b.best}s` : g.id === 'delivery' ? `🍕 ${b.best}` : g.id === 'stunt' ? `🔥 ${b.best.toLocaleString()}` : `🚗 ${b.best}`) : ''
            return (
              <div key={g.id} className={`arc-tile ${g.id}`}>
                {me && <ArcadeCardScene game={g.id} me={me} />}
                <div className="arc-art">{g.art}</div>
                <b>{g.name}</b>
                <small>{g.tip}</small>
                <span className="arc-best">{[1, 2, 3].map((n) => (n <= b.stars ? '★' : '☆')).join('')}{best && ` ${best}`}</span>
                <button className="buy" disabled={!car} onClick={() => { if (payFuel(`a ${g.name} run`, g.id)) setPlaying({ game: 'star', id: g.id }) }}>Play · <Cost game={g.id} /></button>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function ChaseGame({ car, onExit }: { car: OwnedCar; onExit: () => void }) {
  const level = useGame((s) => s.level)
  const finish = useGame((s) => s.finishArcade)
  const input = useRef<ChaseInput>({ moves: [] }).current
  const [run, setRun] = useState(0)
  const [running, setRunning] = useState(false)
  const [drawn, setDrawn] = useState(-1)
  const [hud, setHud] = useState<ChaseHud>(FRESH_HUD)
  const [pop, setPop] = useState<ChasePop | null>(null)
  const onHud = useStable((h: ChaseHud) => {
    setHud(h)
    if (h.pop) setPop(h.pop)
  })
  const [end, setEnd] = useState<{ score: number; coins: number; xp: number; record: boolean; place?: number } | null>(null)

  // The shared driving keys (A/D or arrows): each press moves one lane that way.
  // On a phone, swipes and taps on either half of the screen do the same.
  const keys = useRef(newDriveInput()).current
  const touch = useTouchDevice()
  useDriveKeys(keys)
  useEffect(() => {
    let last = 0
    let raf = 0
    const tick = () => {
      const s = Math.sign(keys.steer)
      if (s !== last) {
        if (s) input.moves.push(-s)
        last = s
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [input, keys])
  const down = useRef<{ x: number; done: boolean } | null>(null)

  const busted = useStable((dist: number, coins: number, bonus: number) => {
    const score = chaseScore(dist, coins, bonus)
    const pay = chaseReward(score, level)
    const b = loadBests()
    const record = score > b.chase
    if (record) saveBests({ ...b, chase: score })
    finish(pay.coins, pay.xp)
    if (record) sfx.win()
    else sfx.lose()
    setEnd({ score, ...pay, record })
    void submitArcadeRun('chase', score).then((b) => b?.me && setEnd((e) => e && { ...e, place: b.me!.place }))
  })
  const scene = useMemo(() => <ChaseScene me={look(car)} input={input} running={running} onHud={onHud} onBusted={busted} />, [car, input, running, onHud, busted])
  const stageReady = useStageReady()
  const again = () => {
    if (!payFuel('a getaway', 'chase')) return
    input.moves.length = 0
    setEnd(null)
    setRunning(false)
    setHud(FRESH_HUD)
    setPop(null)
    setRun((r) => r + 1)
  }

  return (
    <div className="race-full arc-full"
      onPointerDown={(e) => { down.current = { x: e.clientX, done: false } }}
      onPointerMove={(e) => {
        const d = down.current
        if (!d || d.done || Math.abs(e.clientX - d.x) < 30) return
        d.done = true
        input.moves.push(e.clientX > d.x ? 1 : -1)
      }}
      onPointerUp={(e) => {
        const d = down.current
        down.current = null
        if (!d || d.done || end || (e.target as HTMLElement).closest('button')) return
        input.moves.push(e.clientX > window.innerWidth / 2 ? 1 : -1)
      }}
    >
      <StageSlot key={`scene${run}`} cam={CHASE_CAM} through>{scene}</StageSlot>
      <LoadingScene key={`load${run}`} ready={stageReady} label="Getting away" onReady={() => setDrawn(run)} onClose={onExit} />
      <div className="rf-top">
        <h2>🚓 Getaway Chase</h2>
        <button className="close" onClick={onExit} aria-label="Close">✕</button>
      </div>
      <div className="arc-hud">
        <span className="arc-hearts">{Array.from({ length: CHASE_HEARTS }, (_, i) => (i < hud.hearts ? '❤️' : '🖤')).join('')}</span>
        <span className="arc-score">{chaseScore(hud.dist, hud.coins, hud.bonus).toLocaleString()}</span>
        {hud.mult > 1 ? <span key={hud.mult} className="arc-combo">×{hud.mult}</span> : <span className="arc-coins">🪙 {hud.coins}</span>}
      </div>
      {hud.nitro > 0 && <div className="chase-nitro"><i style={{ width: `${hud.nitro * 100}%` }} /></div>}
      {hud.warn && <div className="chase-warn" />}
      {pop && <div key={pop.id} className={`chase-pop ${pop.kind}`}>{pop.text}</div>}
      {!running && !end && drawn === run && <Countdown key={`count${run}`} onGo={() => { startArcadeRun('chase'); setRunning(true) }} />}
      {running && hud.dist < 40 && <div className="arc-tip">{touch ? '👈 Swipe or tap to dodge 👉' : '👈 A / D or arrows to dodge 👉'}</div>}
      {end && (
        <Result win={end.record} title={end.record ? '🏆 New best!' : '🚨 Busted!'}
          actions={<>
            <button className="sell" onClick={onExit}>Back</button>
            <button className="buy" onClick={again}>Again · <Cost game="chase" /></button>
          </>}>
          <div className="arc-big">{end.score.toLocaleString()}</div>
          <div className="arc-pay"><span>🪙 +{end.coins}</span><span>⭐ +{end.xp} XP</span></div>
          {end.place && <WeekPlace place={end.place} />}
        </Result>
      )}
    </div>
  )
}

function ParkGame({ car, lot, onExit, onLot }: { car: OwnedCar; lot: number; onExit: () => void; onLot: (lot: number) => void }) {
  const level = useGame((s) => s.level)
  const finish = useGame((s) => s.finishArcade)
  const def = PARK_LOTS[lot]
  const input = useRef(newDriveInput()).current
  const touch = useTouchDevice()
  const tall = useTall()
  useDriveKeys(input)
  const [run, setRun] = useState(0)
  const [running, setRunning] = useState(false)
  const [drawn, setDrawn] = useState('')
  const [hud, setHud] = useState<ParkHud>({ time: 0, bumps: 0, inSpot: false })
  const [end, setEnd] = useState<(ParkEnd & { stars: number; coins: number; xp: number }) | null>(null)

  const done = useStable((e: ParkEnd) => {
    const stars = e.parked ? parkStars(e.time, e.bumps, def.par) : 0
    const pay = parkReward(lot, stars, level)
    if (stars) {
      const b = loadBests()
      const park = [...b.park]
      park[lot] = Math.max(park[lot] ?? 0, stars)
      saveBests({ ...b, park })
      finish(pay.coins, pay.xp)
      sfx.win()
    } else sfx.lose()
    setEnd({ ...e, stars, ...pay })
  })
  const scene = useMemo(() => <ParkScene lot={def} me={look(car)} input={input} running={running} onHud={setHud} onEnd={done} />, [def, car, input, running, done])
  const stageReady = useStageReady()
  const restart = (next = lot) => {
    if (!payFuel('a parking run', 'park')) return
    Object.assign(input, { steer: 0, gas: 0, brake: 0 })
    setEnd(null)
    setRunning(false)
    setHud({ time: 0, bumps: 0, inSpot: false })
    if (next !== lot) onLot(next)
    setRun((r) => r + 1)
  }
  const hasNext = lot + 1 < PARK_LOTS.length

  return (
    <div className="race-full arc-full park">
      <StageSlot key={`scene${lot}-${run}`} cam={PARK_CAM}>{scene}</StageSlot>
      <LoadingScene key={`load${lot}-${run}`} ready={stageReady} label={`Driving to ${def.name}`} onReady={() => setDrawn(`${lot}-${run}`)} onClose={onExit} />
      <div className="rf-top">
        <h2>🅿️ {lot + 1}. {def.name}</h2>
        <button className="close" onClick={onExit} aria-label="Close">✕</button>
      </div>
      <div className="arc-hud">
        <span className="arc-time">⏱ {hud.time.toFixed(1)}s <small>/ {def.par}s</small></span>
        <span className={hud.inSpot ? 'arc-spot in' : 'arc-spot'}>{hud.inSpot ? '✅ Hold still' : '🅿️'}</span>
        <span className="arc-bumps">💥 {hud.bumps}/{PARK_MAX_BUMPS}</span>
      </div>
      {!running && !end && drawn === `${lot}-${run}` && <Countdown key={`count${lot}-${run}`} onGo={() => setRunning(true)} />}
      {running && !end && (touch ? <TouchDrive input={input} tall={tall} drift={false} autoGas={false} /> : <KeyHints drift={false} item={false} />)}
      {end && (
        <Result win={end.parked} title={end.parked ? '🅿️ Parked!' : '💥 Too many dents'}
          actions={<>
            <button className="sell" onClick={onExit}>Back</button>
            <button className="buy alt" onClick={() => restart()}>Retry · <Cost game="park" /></button>
            {end.parked && hasNext && <button className="buy" onClick={() => restart(lot + 1)}>Next · <Cost game="park" /></button>}
          </>}>
          {end.parked && <div className="arc-stars">{[1, 2, 3].map((n) => <span key={n} className={n <= end.stars ? 'on' : ''}>★</span>)}</div>}
          <div className="arc-sub">⏱ {end.time.toFixed(1)}s · 💥 {end.bumps}</div>
          {end.parked && <div className="arc-pay"><span>🪙 +{end.coins}</span><span>⭐ +{end.xp} XP</span></div>}
        </Result>
      )}
    </div>
  )
}
