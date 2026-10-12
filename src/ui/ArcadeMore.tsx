import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { useGame, type OwnedCar } from '../game/store'
import { ARCADE_FUEL } from '../game/arcade'
import {
  DASH_TIME, STUNT_JUMPS, WASH_SPOTS, WASH_TIME,
  dashStars, pitStars, recordStars, starReward, stuntStars, washStars, type StarGameId,
} from '../game/arcadeMore'
import { PitScene, type PitEnd, type PitHud, type PitInput } from '../scene/PitScene'
import { WashScene, type WashHud, type WashInput } from '../scene/WashScene'
import { DeliveryScene, type DashHud } from '../scene/DeliveryScene'
import { StuntScene, type StuntHud, type StuntInput } from '../scene/StuntScene'
import type { ParkInput } from '../scene/ParkScene'
import { Countdown, Result, look, payFuel } from './ArcadeBits'
import { sfx } from '../lib/sound'
import { LoadingScene } from './Loading'

// The second wave of arcade games. Each runs inside one shell that handles the
// fuel, the countdown, star pay and the result card.

export const STAR_GAMES: { id: StarGameId; name: string; art: string; tip: string }[] = [
  { id: 'pit', name: 'Pit Stop', art: '🔧🏎️', tip: 'Brake, swap, go' },
  { id: 'wash', name: 'Car Wash', art: '🧽🫧', tip: 'Scrub off the mud' },
  { id: 'delivery', name: 'Delivery Dash', art: '🍕🚗', tip: 'Beat the clock' },
  { id: 'stunt', name: 'Stunt Ramp', art: '🔥🚙', tip: 'Jump and flip' },
]

type Done = (stars: number, result: number, line: string) => void
type GameProps = { car: OwnedCar; running: boolean; onDone: Done }

const gl = { toneMapping: NeutralToneMapping }

export function StarGame({ id, car, onExit }: { id: StarGameId; car: OwnedCar; onExit: () => void }) {
  const level = useGame((s) => s.level)
  const finish = useGame((s) => s.finishArcade)
  const meta = STAR_GAMES.find((g) => g.id === id)!
  const [run, setRun] = useState(0)
  const [running, setRunning] = useState(false)
  const [drawn, setDrawn] = useState(-1)
  const [end, setEnd] = useState<{ stars: number; coins: number; xp: number; record: boolean; line: string } | null>(null)

  const done: Done = (stars, result, line) => {
    const pay = starReward(stars, level)
    const record = recordStars(id, stars, result)
    if (stars > 0) {
      finish(pay.coins, pay.xp)
      sfx.win()
    } else sfx.lose()
    setEnd({ stars, ...pay, record, line })
  }
  const again = () => {
    if (!payFuel(`a ${meta.name} run`)) return
    setEnd(null)
    setRunning(false)
    setRun((r) => r + 1)
  }
  const Game = { pit: PitGame, wash: WashGame, delivery: DeliveryGame, stunt: StuntGame }[id]

  return (
    <div className={`race-full arc-full arc-${id}`}>
      <Game key={run} car={car} running={running && !end} onDone={done} />
      <LoadingScene key={`load${run}`} label={`Opening ${meta.name}`} onReady={() => setDrawn(run)} onClose={onExit} />
      <div className="rf-top">
        <h2>{meta.art.slice(0, 2)} {meta.name}</h2>
        <button className="close" onClick={onExit} aria-label="Close">✕</button>
      </div>
      {!running && !end && drawn === run && <Countdown key={`count${run}`} onGo={() => setRunning(true)} />}
      {end && (
        <Result win={end.stars > 0} title={end.stars === 0 ? '😬 So close' : end.record ? '🏆 New best!' : end.stars === 3 ? '🌟 Perfect!' : '👏 Nice!'}
          actions={<>
            <button className="sell" onClick={onExit}>Back</button>
            <button className="buy" onClick={again}>Again · ⛽{ARCADE_FUEL}</button>
          </>}>
          <div className="arc-stars">{[1, 2, 3].map((n) => <span key={n} className={n <= end.stars ? 'on' : ''}>★</span>)}</div>
          <div className="arc-sub">{end.line}</div>
          {end.stars > 0 && <div className="arc-pay"><span>🪙 +{end.coins}</span><span>⭐ +{end.xp} XP</span></div>}
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
  const [hud, setHud] = useState<PitHud>({ phase: 'in', left: 4, time: 0, pop: null })
  const [pop, setPop] = useState<PitHud['pop']>(null)
  const onHud = (h: PitHud) => {
    setHud(h)
    if (h.pop) setPop(h.pop)
  }
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
      <Canvas className="rf-canvas" camera={{ fov: 45, near: 0.3, far: 140, position: [0, 8, 7] }} dpr={[1, 1.5]} gl={gl}>
        <PitScene me={look(car)} input={input} running={running} onHud={onHud} onEnd={(e) => onDone(pitStars(e.time), Math.round(e.time * 10) / 10, pitLine(e))} />
      </Canvas>
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
      {running && hud.phase === 'wheels' && <div className="arc-tip pit-tip">Tap each ring when it's green</div>}
    </>
  )
}

function WashGame({ car, running, onDone }: GameProps) {
  const input = useRef<WashInput>({ x: 0, y: 0, down: false, moved: 0 }).current
  const [hud, setHud] = useState<WashHud>({ left: WASH_SPOTS, time: WASH_TIME })
  const [sponge, setSponge] = useState<{ x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
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
        <Canvas className="rf-canvas" camera={{ fov: 45, near: 0.2, far: 80, position: [0, 2, 6] }} dpr={[1, 1.5]} gl={gl}>
          <WashScene me={look(car)} input={input} running={running} onHud={setHud}
            onEnd={(e) => onDone(washStars(e.cleaned, WASH_SPOTS, e.timeLeft), e.cleaned === WASH_SPOTS ? Math.round(e.timeLeft) : 0, `🧽 ${e.cleaned}/${WASH_SPOTS} · ⏱ ${Math.round(e.timeLeft)}s left`)} />
        </Canvas>
        {sponge && <div className="arc-sponge" style={{ left: sponge.x, top: sponge.y }}>🧽</div>}
      </div>
      <div className="arc-hud">
        <span className={hud.time < 6 ? 'arc-time low' : 'arc-time'}>⏱ {Math.ceil(hud.time)}s</span>
        <span>🟤 {hud.left}</span>
      </div>
      {running && hud.left === WASH_SPOTS && <div className="arc-tip">Rub the mud off 👆</div>}
    </>
  )
}

const KEYS: Record<string, [keyof ParkInput, number]> = {
  ArrowLeft: ['steer', 1], a: ['steer', 1], A: ['steer', 1], ArrowRight: ['steer', -1], d: ['steer', -1], D: ['steer', -1],
  ArrowUp: ['pedal', 1], w: ['pedal', 1], W: ['pedal', 1], ArrowDown: ['pedal', -1], s: ['pedal', -1], S: ['pedal', -1],
}

function DeliveryGame({ car, running, onDone }: GameProps) {
  const input = useRef<ParkInput>({ steer: 0, pedal: 0 }).current
  const [hud, setHud] = useState<DashHud>({ drops: 0, time: DASH_TIME, carrying: false })
  useEffect(() => {
    const held = new Set<string>()
    const apply = () => {
      input.steer = 0
      input.pedal = 0
      for (const k of held) input[KEYS[k][0]] += KEYS[k][1]
      input.steer = Math.max(-1, Math.min(1, input.steer))
      input.pedal = Math.max(-1, Math.min(1, input.pedal))
    }
    const kd = (e: KeyboardEvent) => { if (KEYS[e.key]) { held.add(e.key); apply(); e.preventDefault() } }
    const ku = (e: KeyboardEvent) => { if (KEYS[e.key]) { held.delete(e.key); apply() } }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [input])
  const pad = (axis: keyof ParkInput, v: number) => holdTo((on) => { input[axis] = on ? v : 0 })
  return (
    <>
      <Canvas className="rf-canvas" camera={{ fov: 50, near: 0.3, far: 120, position: [0, 14, 10] }} dpr={[1, 1.5]} gl={gl}>
        <DeliveryScene me={look(car)} input={input} running={running} onHud={setHud}
          onEnd={(e) => onDone(dashStars(e.drops), e.drops, `🍕 ${e.drops} delivered`)} />
      </Canvas>
      <div className="arc-hud">
        <span className={hud.time < 8 ? 'arc-time low' : 'arc-time'}>⏱ {Math.ceil(hud.time)}s</span>
        <span className={hud.carrying ? 'arc-spot in' : 'arc-spot'}>{hud.carrying ? '🏠 Deliver' : '🍕 Pick up'}</span>
        <span>✅ {hud.drops}</span>
      </div>
      <div className="arc-pads">
        <div className="arc-pad">
          <button className="arc-btn" aria-label="Steer left" {...pad('steer', 1)}>◀</button>
          <button className="arc-btn" aria-label="Steer right" {...pad('steer', -1)}>▶</button>
        </div>
        <div className="arc-pad">
          <button className="arc-btn rev" aria-label="Reverse" {...pad('pedal', -1)}>R</button>
          <button className="arc-btn gas" aria-label="Gas" {...pad('pedal', 1)}>▲</button>
        </div>
      </div>
    </>
  )
}

function StuntGame({ car, running, onDone }: GameProps) {
  const input = useRef<StuntInput>({ down: false }).current
  const [hud, setHud] = useState<StuntHud>({ jump: 1, score: 0, power: 0, phase: 'aim', last: null })
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'ArrowUp') { input.down = true; e.preventDefault() } }
    const ku = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'ArrowUp') input.down = false }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [input])
  const showLast = hud.last && (hud.phase === 'roll' || hud.phase === 'crash')
  return (
    <div className="arc-scrub"
      onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button')) input.down = true }}
      onPointerUp={() => { input.down = false }}
      onPointerCancel={() => { input.down = false }}>
      <Canvas className="rf-canvas" camera={{ fov: 50, near: 0.3, far: 160, position: [-10, 4, 14] }} dpr={[1, 1.5]} gl={gl}>
        <StuntScene me={look(car)} input={input} running={running} onHud={setHud}
          onEnd={(e) => onDone(stuntStars(e.score), e.score, `🔥 ${e.score.toLocaleString()} pts`)} />
      </Canvas>
      <div className="arc-hud">
        <span>🏁 {hud.jump}/{STUNT_JUMPS}</span>
        <span className="arc-score">{hud.score.toLocaleString()}</span>
      </div>
      {hud.phase === 'aim' && (
        <div className="arc-power">
          <div className="arc-meter"><i style={{ width: `${hud.power * 100}%` }} /></div>
          {running && <div className="arc-tip">Tap at full power</div>}
        </div>
      )}
      {hud.phase === 'air' && <div className="arc-tip">Hold to flip, let go to land</div>}
      {showLast && hud.last && (
        <div key={hud.jump} className={hud.last.ok ? 'arc-callout ok' : 'arc-callout bad'}>
          {hud.last.ok ? <>+{hud.last.pts}{hud.last.flips > 0 && <small>{hud.last.flips > 1 ? `${hud.last.flips}× flip` : 'Flip!'}</small>}</> : 'Wipeout!'}
        </div>
      )}
    </div>
  )
}
