import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, type OwnedCar } from '../game/store'
import {
  DASH_TIME, STUNT_JUMPS, WASH_SPOTS, WASH_TIME, targetX,
  dashStars, pitStars, recordStars, starReward, stuntStars, washStars, type StarGameId,
} from '../game/arcadeMore'
import { PitScene, type PitEnd, type PitHud, type PitInput } from '../scene/PitScene'
import { WashScene, type WashEnd, type WashHud, type WashInput, type WashPop } from '../scene/WashScene'
import { DeliveryScene, type DashEnd, type DashHud, type DashPop } from '../scene/DeliveryScene'
import { StuntScene, type StuntEnd, type StuntHud, type StuntInput } from '../scene/StuntScene'
import { KeyHints, TouchDrive, newDriveInput, useDriveKeys, useTall, useTouchDevice } from './DriveControls'
import { Cost, Countdown, Result, look, payFuel, useStable } from './ArcadeBits'
import { sfx } from '../lib/sound'
import { LoadingScene } from './Loading'
import { StageSlot, useStageReady } from '../scene/Stage'
import { startArcadeRun, submitArcadeRun } from '../lib/arcadeBoard'
import { WeekPlace } from './ArcadeBoards'

// The second wave of arcade games. Each runs inside one shell that handles the
// fuel, the countdown, star pay and the result card.

export const STAR_GAMES: { id: StarGameId; name: string; art: string; tip: string }[] = [
  { id: 'pit', name: 'Pit Stop', art: '🔧🏎️', tip: 'Brake, remember, go' },
  { id: 'wash', name: 'Car Wash', art: '🧽🫧', tip: 'Wash the whole line' },
  { id: 'delivery', name: 'Delivery Dash', art: '🍕🚗', tip: 'Hot pizza, dodge traffic' },
  { id: 'stunt', name: 'Stunt Ramp', art: '🔥🚙', tip: 'Flip, roll, hit the target' },
]

type Done = (stars: number, result: number, line: string) => void
type GameProps = { car: OwnedCar; running: boolean; onDone: Done }

// Each game draws in the shared full-screen canvas (scene/Stage.tsx), so a retry or the
// next game doesn't make a new WebGL context and compile every shader again.
type Cam = { position: [number, number, number]; fov: number; near: number; far: number }
const PIT_CAM: Cam = { fov: 45, near: 0.3, far: 140, position: [0, 8, 7] }
const WASH_CAM: Cam = { fov: 45, near: 0.2, far: 80, position: [0, 2, 6] }
const DASH_CAM: Cam = { fov: 50, near: 0.3, far: 120, position: [0, 14, 10] }
const STUNT_CAM: Cam = { fov: 50, near: 0.3, far: 160, position: [-10, 4, 14] }

export function StarGame({ id, car, onExit }: { id: StarGameId; car: OwnedCar; onExit: () => void }) {
  const level = useGame((s) => s.level)
  const finish = useGame((s) => s.finishArcade)
  const meta = STAR_GAMES.find((g) => g.id === id)!
  const [run, setRun] = useState(0)
  const [running, setRunning] = useState(false)
  const [drawn, setDrawn] = useState(-1)
  const [end, setEnd] = useState<{ stars: number; coins: number; xp: number; record: boolean; line: string; place?: number } | null>(null)

  const done: Done = (stars, result, line) => {
    const pay = starReward(stars, level)
    const record = recordStars(id, stars, result)
    if (stars > 0) {
      finish(pay.coins, pay.xp)
      sfx.win()
    } else sfx.lose()
    setEnd({ stars, ...pay, record, line })
    if (result > 0) void submitArcadeRun(id, result).then((b) => b?.me && setEnd((e) => e && { ...e, place: b.me!.place }))
  }
  const again = () => {
    if (!payFuel(`a ${meta.name} run`, id)) return
    setEnd(null)
    setRunning(false)
    setRun((r) => r + 1)
  }
  const stageReady = useStageReady()
  const Game = { pit: PitGame, wash: WashGame, delivery: DeliveryGame, stunt: StuntGame }[id]

  return (
    <div className={`race-full arc-full arc-${id}`}>
      <Game key={run} car={car} running={running && !end} onDone={done} />
      <LoadingScene key={`load${run}`} ready={stageReady} label={`Opening ${meta.name}`} onReady={() => setDrawn(run)} onClose={onExit} />
      <div className="rf-top">
        <h2>{meta.art.slice(0, 2)} {meta.name}</h2>
        <button className="close" onClick={onExit} aria-label="Close">✕</button>
      </div>
      {!running && !end && drawn === run && <Countdown key={`count${run}`} onGo={() => { startArcadeRun(id); setRunning(true) }} />}
      {end && (
        <Result win={end.stars > 0} title={end.stars === 0 ? '😬 So close' : end.record ? '🏆 New best!' : end.stars === 3 ? '🌟 Perfect!' : '👏 Nice!'}
          actions={<>
            <button className="sell" onClick={onExit}>Back</button>
            <button className="buy" onClick={again}>Again · <Cost game={id} /></button>
          </>}>
          <div className="arc-stars">{[1, 2, 3].map((n) => <span key={n} className={n <= end.stars ? 'on' : ''}>★</span>)}</div>
          <div className="arc-sub">{end.line}</div>
          {end.stars > 0 && <div className="arc-pay"><span>🪙 +{end.coins}</span><span>⭐ +{end.xp} XP</span></div>}
          {end.place && <WeekPlace place={end.place} />}
        </Result>
      )}
    </div>
  )
}

// Press-and-hold handlers for an on-screen button.
function holdTo(set: (on: boolean) => void) {
  return {
    onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); set(true) },
    onPointerUp: () => set(false),
    onPointerCancel: () => set(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}

// One line for the result card: the time, how the stop went, and the getaway.
const pitLine = (e: PitEnd) =>
  `⏱ ${e.time.toFixed(1)}s · ${e.grade === 'perfect' ? '🎯' : e.grade === 'good' ? '👍' : '😬'} ${e.grade === 'perfect' ? 'Perfect stop' : e.grade === 'good' ? 'Good stop' : 'Pushed'} · ⚡ ${e.react.toFixed(2)}s${e.slips ? ` · ${e.slips} slip${e.slips > 1 ? 's' : ''}` : ''}`

function PitGame({ car, running, onDone }: GameProps) {
  const input = useRef<PitInput>({ pedal: false, presses: 0, taps: [], pads: [] }).current
  const [hud, setHud] = useState<PitHud>({ phase: 'in', left: 4, time: 0, pop: null, calling: false })
  const [pop, setPop] = useState<PitHud['pop']>(null)
  const onHud = useStable((h: PitHud) => {
    setHud(h)
    if (h.pop) setPop(h.pop)
  })
  const onEnd = useStable((e: PitEnd) => onDone(pitStars(e.time), Math.round(e.time * 10) / 10, pitLine(e)))
  const scene = useMemo(() => <PitScene me={look(car)} input={input} running={running} onHud={onHud} onEnd={onEnd} />, [car, input, running, onHud, onEnd])
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key !== ' ') return
      e.preventDefault()
      if (!e.repeat) input.presses++
      input.pedal = true
    }
    const ku = (e: KeyboardEvent) => { if (e.key === ' ') input.pedal = false }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [input])
  const pedal = running && (hud.phase === 'in' || hud.phase === 'hold' || hud.phase === 'green')
  return (
    <>
      <StageSlot cam={PIT_CAM} through>{scene}</StageSlot>
      {/* Brake and go: hold or tap anywhere, with the big button as the picture of it. */}
      {pedal && <div className="pit-pedal" {...holdTo((on) => { if (on) input.presses++; input.pedal = on })} />}
      {[0, 1, 2, 3].map((i) => (
        <button key={i} ref={(el) => { input.pads[i] = el }} className="pit-pad off" aria-label={`Wheel ${i + 1}`}
          onPointerDown={(e) => { e.preventDefault(); input.taps.push(i) }} onContextMenu={(e) => e.preventDefault()}><b /></button>
      ))}
      <div className="arc-hud">
        <span className="arc-time">⏱ {hud.time.toFixed(1)}s</span>
        {hud.phase === 'wheels' && <span>🛞 {hud.left}</span>}
      </div>
      {pop && <div key={pop.id} className={`pit-pop ${pop.kind}`}>{pop.text}</div>}
      {pedal && (
        <div className={`pit-big ${hud.phase}`}>
          {hud.phase === 'in' ? <>🛑<small>Hold to brake</small></> : hud.phase === 'hold' ? <>✋<small>Wait</small></> : <>GO!<small>Tap</small></>}
        </div>
      )}
      {running && hud.phase === 'in' && <div className="arc-tip pit-tip">Stop on the white line</div>}
      {running && hud.phase === 'wheels' && <div className="arc-tip pit-tip">{hud.calling ? '🧠 Remember the order!' : 'Wheels off in that order, on green'}</div>}
    </>
  )
}

function WashGame({ car, running, onDone }: GameProps) {
  const input = useRef<WashInput>({ x: 0, y: 0, down: false, moved: 0 }).current
  const [hud, setHud] = useState<WashHud>({ cars: 0, left: WASH_SPOTS, time: WASH_TIME, pop: null })
  const [pop, setPop] = useState<WashPop | null>(null)
  const onHud = useStable((h: WashHud) => {
    setHud(h)
    if (h.pop) setPop(h.pop)
  })
  const [sponge, setSponge] = useState<{ x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const onEnd = useStable((e: WashEnd) => onDone(washStars(e.cars), e.cars, `🚗 ${e.cars} washed`))
  const scene = useMemo(() => <WashScene me={look(car)} input={input} running={running} onHud={onHud} onEnd={onEnd} />, [car, input, running, onHud, onEnd])
  const at = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  return (
    <>
      <div ref={box} className="arc-scrub"
        onPointerDown={(e) => { const p = at(e); Object.assign(input, p, { down: true }); setSponge(p) }}
        onPointerMove={(e) => {
          if (!input.down) return
          const p = at(e)
          input.moved += Math.hypot(p.x - input.x, p.y - input.y)
          Object.assign(input, p)
          setSponge(p)
        }}
        onPointerUp={() => { input.down = false; setSponge(null) }}
        onPointerCancel={() => { input.down = false; setSponge(null) }}
        onPointerLeave={() => { input.down = false; setSponge(null) }}
      >
        <StageSlot cam={WASH_CAM} through>{scene}</StageSlot>
        {sponge && <div className="arc-sponge" style={{ left: sponge.x, top: sponge.y }}>🧽</div>}
      </div>
      <div className="arc-hud">
        <span className={hud.time < 6 ? 'arc-time low' : 'arc-time'}>⏱ {Math.ceil(hud.time)}s</span>
        <span>🚗 {hud.cars}</span>
        <span>🟤 {hud.left}</span>
      </div>
      {pop && <div key={pop.id} className={`chase-pop ${pop.kind === 'quick' ? 'nitro' : ''}`}>{pop.text}</div>}
      {running && hud.cars === 0 && hud.left === WASH_SPOTS && <div className="arc-tip">Rub the mud off 👆</div>}
    </>
  )
}

function DeliveryGame({ car, running, onDone }: GameProps) {
  const input = useRef(newDriveInput()).current
  const [hud, setHud] = useState<DashHud>({ drops: 0, time: DASH_TIME, carrying: false, hot: 0, streak: 0, pop: null })
  const [pop, setPop] = useState<DashPop | null>(null)
  const onHud = useStable((h: DashHud) => {
    setHud(h)
    if (h.pop) setPop(h.pop)
  })
  const touch = useTouchDevice()
  const tall = useTall()
  useDriveKeys(input)
  const onEnd = useStable((e: DashEnd) => onDone(dashStars(e.drops), e.drops, `🍕 ${e.drops} delivered`))
  const scene = useMemo(() => <DeliveryScene me={look(car)} input={input} running={running} onHud={onHud} onEnd={onEnd} />, [car, input, running, onHud, onEnd])
  return (
    <>
      <StageSlot cam={DASH_CAM}>{scene}</StageSlot>
      <div className="arc-hud">
        <span className={hud.time < 10 ? 'arc-time dash-clock low' : 'arc-time dash-clock'}>⏱ {Math.ceil(hud.time)}s</span>
        <span className={hud.carrying ? 'arc-spot in' : 'arc-spot'}>{hud.carrying ? '🏠 Deliver' : '🍕 Pick up'}</span>
        <span>✅ {hud.drops}</span>
      </div>
      {hud.carrying && hud.hot > 0 && <div className="dash-hot"><b>🔥</b><div><i style={{ width: `${hud.hot * 100}%` }} /></div></div>}
      {pop && <div key={pop.id} className={`chase-pop ${pop.kind === 'hit' ? 'warn' : pop.kind === 'hot' ? 'smash' : ''}`}>{pop.text}</div>}
      {running && (touch ? <TouchDrive input={input} tall={tall} drift={false} /> : <KeyHints drift={false} item={false} />)}
    </>
  )
}

function StuntGame({ car, running, onDone }: GameProps) {
  const input = useRef<StuntInput>({ down: false, roll: false }).current
  const [hud, setHud] = useState<StuntHud>({ jump: 1, score: 0, power: 0, phase: 'aim', slow: false, last: null })
  useEffect(() => {
    // Space or up flips, right or D rolls.
    const set = (e: KeyboardEvent, on: boolean) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') input.down = on
      else if (e.key === 'ArrowRight' || e.key === 'd') input.roll = on
      else return
      e.preventDefault()
    }
    const kd = (e: KeyboardEvent) => set(e, true)
    const ku = (e: KeyboardEvent) => set(e, false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [input])
  const onEnd = useStable((e: StuntEnd) => onDone(stuntStars(e.score), e.score, `🔥 ${e.score.toLocaleString()} pts`))
  const scene = useMemo(() => <StuntScene me={look(car)} input={input} running={running} onHud={setHud} onEnd={onEnd} />, [car, input, running, onEnd])
  const showLast = hud.last && (hud.phase === 'roll' || hud.phase === 'crash')
  const last = hud.last
  const tricks = last ? [last.flips && (last.flips > 1 ? `${last.flips}× flip` : 'Flip'), last.rolls && (last.rolls > 1 ? `${last.rolls}× roll` : 'Roll'), last.target && '🎯'].filter(Boolean).join(' + ') : ''
  // Left half of the screen flips, right half rolls; either one stops the needle.
  const release = () => { input.down = false; input.roll = false }
  return (
    <div className={hud.slow ? 'arc-scrub stunt-slow' : 'arc-scrub'}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        if (e.clientX < window.innerWidth / 2) input.down = true
        else input.roll = true
      }}
      onPointerUp={release}
      onPointerCancel={release}>
      <StageSlot cam={STUNT_CAM} through>{scene}</StageSlot>
      <div className="arc-hud">
        <span>🏁 {hud.jump}/{STUNT_JUMPS}</span>
        <span className="arc-score">{hud.score.toLocaleString()}</span>
        <span>🎯 {targetX(hud.jump - 1)}m</span>
      </div>
      {hud.phase === 'aim' && (
        <div className="arc-power">
          <div className="arc-meter"><i style={{ width: `${hud.power * 100}%` }} /></div>
          {running && <div className="arc-tip">Tap at full power</div>}
        </div>
      )}
      {(hud.phase === 'run' || hud.phase === 'air') && (
        <div className="stunt-pads">
          <span>🔄<small>Flip</small></span>
          <span>🌀<small>Roll</small></span>
        </div>
      )}
      {showLast && last && (
        <div key={hud.jump} className={last.ok ? 'arc-callout ok' : 'arc-callout bad'}>
          {last.ok ? <>+{last.pts}{tricks && <small>{tricks}</small>}</> : 'Wipeout!'}
        </div>
      )}
    </div>
  )
}
