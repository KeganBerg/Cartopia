import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { useGame, type OwnedCar } from '../game/store'
import { carDef } from '../game/data'
import {
  ARCADE_FUEL, CHASE_HEARTS, PARK_LOTS, PARK_MAX_BUMPS, chaseReward, chaseScore, loadBests, lotOpen, parkReward, parkStars, saveBests,
} from '../game/arcade'
import { ChaseScene, type ChaseHud, type ChaseInput } from '../scene/ChaseScene'
import { ParkScene, type ParkEnd, type ParkHud, type ParkInput } from '../scene/ParkScene'
import { CarThumb } from '../scene/BuildingPreview'
import { Panel } from './Menus'
import { sfx } from '../lib/sound'
import { Countdown, Result, look, payFuel, pi } from './ArcadeBits'
import { STAR_GAMES, StarGame } from './ArcadeMore'
import { loadStars, type StarGameId } from '../game/arcadeMore'

type Playing = { game: 'chase' } | { game: 'park'; lot: number } | { game: 'star'; id: StarGameId }

export function ArcadePanel() {
  const cars = useGame((s) => s.cars)
  const best = useMemo(() => [...cars].sort((a, b) => pi(b) - pi(a))[0], [cars])
  const [carId, setCarId] = useState(best?.uid)
  const car = cars.find((c) => c.uid === carId) ?? best
  const [playing, setPlaying] = useState<Playing | null>(null)
  const [lots, setLots] = useState(false)
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
    <Panel title="🕹️ Arcade" wide>
      {car && cars.length > 1 && (
        <div className="arc-cars">
          {cars.slice().sort((a, b) => pi(b) - pi(a)).slice(0, 12).map((c) => (
            <button key={c.uid} className={c.uid === car.uid ? 'arc-car sel' : 'arc-car'} onClick={() => setCarId(c.uid)} title={carDef(c.model).name}>
              <CarThumb size="xs" color={c.color} finish={c.finish} body={carDef(c.model).body} model={c.model} stripe={c.stripe} mods={c.mods} />
            </button>
          ))}
        </div>
      )}
      {lots ? (
        <>
          <button className="arc-back" onClick={() => setLots(false)}>‹ Back</button>
          <div className="arc-lots">
            {PARK_LOTS.map((l, i) => {
              const open = lotOpen(stars, i)
              return (
                <button key={l.name} className={open ? 'arc-lot' : 'arc-lot locked'} disabled={!open}
                  onClick={() => { if (payFuel('a parking run')) setPlaying({ game: 'park', lot: i }) }}>
                  <b>{open ? i + 1 : '🔒'}</b>
                  <span>{l.name}</span>
                  <small>{[1, 2, 3].map((n) => (n <= (stars[i] ?? 0) ? '★' : '☆')).join('')}</small>
                </button>
              )
            })}
          </div>
          <p className="arc-fuel">Each run ⛽{ARCADE_FUEL}</p>
        </>
      ) : (
        <div className="arc-games">
          <div className="arc-tile chase">
            <div className="arc-art">🚓💨🚗</div>
            <b>Getaway Chase</b>
            <small>Swipe to dodge traffic</small>
            <span className="arc-best">🏆 {bests.chase.toLocaleString()}</span>
            <button className="buy" disabled={!car} onClick={() => { if (payFuel('a getaway')) setPlaying({ game: 'chase' }) }}>Play · ⛽{ARCADE_FUEL}</button>
          </div>
          <div className="arc-tile park">
            <div className="arc-art">🅿️🚙</div>
            <b>Parking Pro</b>
            <small>Steer into the spot</small>
            <span className="arc-best">★ {totalStars}/{PARK_LOTS.length * 3}</span>
            <button className="buy" disabled={!car} onClick={() => setLots(true)}>Pick a lot ›</button>
          </div>
          {STAR_GAMES.map((g) => {
            const b = starBests[g.id]
            const best = b.best ? (g.id === 'pit' ? `⏱ ${b.best}s` : g.id === 'delivery' ? `🍕 ${b.best}` : g.id === 'stunt' ? `🔥 ${b.best.toLocaleString()}` : '') : ''
            return (
              <div key={g.id} className={`arc-tile ${g.id}`}>
                <div className="arc-art">{g.art}</div>
                <b>{g.name}</b>
                <small>{g.tip}</small>
                <span className="arc-best">{[1, 2, 3].map((n) => (n <= b.stars ? '★' : '☆')).join('')}{best && ` ${best}`}</span>
                <button className="buy" disabled={!car} onClick={() => { if (payFuel(`a ${g.name} run`)) setPlaying({ game: 'star', id: g.id }) }}>Play · ⛽{ARCADE_FUEL}</button>
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
  const [hud, setHud] = useState<ChaseHud>({ dist: 0, coins: 0, hearts: CHASE_HEARTS, speed: 0 })
  const [end, setEnd] = useState<{ score: number; coins: number; xp: number; record: boolean } | null>(null)

  // Keys and swipes; a tap on either half of the screen moves one lane that way.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.moves.push(-1)
      if (['ArrowRight', 'd', 'D'].includes(e.key)) input.moves.push(1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [input])
  const down = useRef<{ x: number; done: boolean } | null>(null)

  const busted = (dist: number, coins: number) => {
    const score = chaseScore(dist, coins)
    const pay = chaseReward(score, level)
    const b = loadBests()
    const record = score > b.chase
    if (record) saveBests({ ...b, chase: score })
    finish(pay.coins, pay.xp)
    if (record) sfx.win()
    else sfx.lose()
    setEnd({ score, ...pay, record })
  }
  const again = () => {
    if (!payFuel('a getaway')) return
    input.moves.length = 0
    setEnd(null)
    setRunning(false)
    setHud({ dist: 0, coins: 0, hearts: CHASE_HEARTS, speed: 0 })
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
      <Canvas key={run} className="rf-canvas" camera={{ position: [0, 4.4, 8.5], fov: 55, near: 0.3, far: 160 }} dpr={[1, 1.5]} gl={{ toneMapping: NeutralToneMapping }}>
        <ChaseScene me={look(car)} input={input} running={running} onHud={setHud} onBusted={busted} />
      </Canvas>
      <div className="rf-top">
        <h2>🚓 Getaway Chase</h2>
        <button className="close" onClick={onExit} aria-label="Close">✕</button>
      </div>
      <div className="arc-hud">
        <span className="arc-hearts">{Array.from({ length: CHASE_HEARTS }, (_, i) => (i < hud.hearts ? '❤️' : '🖤')).join('')}</span>
        <span className="arc-score">{chaseScore(hud.dist, hud.coins).toLocaleString()}</span>
        <span className="arc-coins">🪙 {hud.coins}</span>
      </div>
      {!running && !end && <Countdown key={run} onGo={() => setRunning(true)} />}
      {running && hud.dist < 40 && <div className="arc-tip">👈 Swipe or tap to dodge 👉</div>}
      {end && (
        <Result win={end.record} title={end.record ? '🏆 New best!' : '🚨 Busted!'}
          actions={<>
            <button className="sell" onClick={onExit}>Back</button>
            <button className="buy" onClick={again}>Again · ⛽{ARCADE_FUEL}</button>
          </>}>
          <div className="arc-big">{end.score.toLocaleString()}</div>
          <div className="arc-pay"><span>🪙 +{end.coins}</span><span>⭐ +{end.xp} XP</span></div>
        </Result>
      )}
    </div>
  )
}

const KEYS: Record<string, [keyof ParkInput, number]> = {
  ArrowLeft: ['steer', 1], a: ['steer', 1], A: ['steer', 1], ArrowRight: ['steer', -1], d: ['steer', -1], D: ['steer', -1],
  ArrowUp: ['pedal', 1], w: ['pedal', 1], W: ['pedal', 1], ArrowDown: ['pedal', -1], s: ['pedal', -1], S: ['pedal', -1],
}

function ParkGame({ car, lot, onExit, onLot }: { car: OwnedCar; lot: number; onExit: () => void; onLot: (lot: number) => void }) {
  const level = useGame((s) => s.level)
  const finish = useGame((s) => s.finishArcade)
  const def = PARK_LOTS[lot]
  const input = useRef<ParkInput>({ steer: 0, pedal: 0 }).current
  const [run, setRun] = useState(0)
  const [running, setRunning] = useState(false)
  const [hud, setHud] = useState<ParkHud>({ time: 0, bumps: 0, inSpot: false })
  const [end, setEnd] = useState<(ParkEnd & { stars: number; coins: number; xp: number }) | null>(null)

  useEffect(() => {
    const held = new Set<string>()
    const apply = () => {
      input.steer = 0
      input.pedal = 0
      for (const k of held) {
        const [axis, v] = KEYS[k]
        input[axis] += v
      }
      input.steer = Math.max(-1, Math.min(1, input.steer))
      input.pedal = Math.max(-1, Math.min(1, input.pedal))
    }
    const kd = (e: KeyboardEvent) => { if (KEYS[e.key]) { held.add(e.key); apply(); e.preventDefault() } }
    const ku = (e: KeyboardEvent) => { if (KEYS[e.key]) { held.delete(e.key); apply() } }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [input])

  const done = (e: ParkEnd) => {
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
  }
  const restart = (next = lot) => {
    if (!payFuel('a parking run')) return
    input.steer = 0
    input.pedal = 0
    setEnd(null)
    setRunning(false)
    setHud({ time: 0, bumps: 0, inSpot: false })
    if (next !== lot) onLot(next)
    setRun((r) => r + 1)
  }
  const hold = (axis: keyof ParkInput, v: number) => ({
    onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); input[axis] = v },
    onPointerUp: () => { input[axis] = 0 },
    onPointerCancel: () => { input[axis] = 0 },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })
  const hasNext = lot + 1 < PARK_LOTS.length

  return (
    <div className="race-full arc-full park">
      <Canvas key={`${lot}-${run}`} className="rf-canvas" camera={{ fov: 40, near: 0.5, far: 120, position: [0, 20, 5] }} dpr={[1, 1.5]} gl={{ toneMapping: NeutralToneMapping }}>
        <ParkScene lot={def} me={look(car)} input={input} running={running} onHud={setHud} onEnd={done} />
      </Canvas>
      <div className="rf-top">
        <h2>🅿️ {lot + 1}. {def.name}</h2>
        <button className="close" onClick={onExit} aria-label="Close">✕</button>
      </div>
      <div className="arc-hud">
        <span className="arc-time">⏱ {hud.time.toFixed(1)}s <small>/ {def.par}s</small></span>
        <span className={hud.inSpot ? 'arc-spot in' : 'arc-spot'}>{hud.inSpot ? '✅ Hold still' : '🅿️'}</span>
        <span className="arc-bumps">💥 {hud.bumps}/{PARK_MAX_BUMPS}</span>
      </div>
      {!running && !end && <Countdown key={`${lot}-${run}`} onGo={() => setRunning(true)} />}
      <div className="arc-pads">
        <div className="arc-pad">
          <button className="arc-btn" aria-label="Steer left" {...hold('steer', 1)}>◀</button>
          <button className="arc-btn" aria-label="Steer right" {...hold('steer', -1)}>▶</button>
        </div>
        <div className="arc-pad">
          <button className="arc-btn rev" aria-label="Reverse" {...hold('pedal', -1)}>R</button>
          <button className="arc-btn gas" aria-label="Gas" {...hold('pedal', 1)}>▲</button>
        </div>
      </div>
      {end && (
        <Result win={end.parked} title={end.parked ? '🅿️ Parked!' : '💥 Too many dents'}
          actions={<>
            <button className="sell" onClick={onExit}>Back</button>
            <button className="buy alt" onClick={() => restart()}>Retry · ⛽{ARCADE_FUEL}</button>
            {end.parked && hasNext && <button className="buy" onClick={() => restart(lot + 1)}>Next · ⛽{ARCADE_FUEL}</button>}
          </>}>
          {end.parked && <div className="arc-stars">{[1, 2, 3].map((n) => <span key={n} className={n <= end.stars ? 'on' : ''}>★</span>)}</div>}
          <div className="arc-sub">⏱ {end.time.toFixed(1)}s · 💥 {end.bumps}</div>
          {end.parked && <div className="arc-pay"><span>🪙 +{end.coins}</span><span>⭐ +{end.xp} XP</span></div>}
        </Result>
      )}
    </div>
  )
}
