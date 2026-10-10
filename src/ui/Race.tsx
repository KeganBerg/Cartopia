import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, spendFuel, type OwnedCar } from '../game/store'
import { CARS, carDef, performance, RACE_FUEL, type Body } from '../game/data'
import { supabase } from '../lib/supabase'
import { Panel } from './Menus'
import { Canvas } from '@react-three/fiber'
import { RaceScene } from '../scene/RaceScene'

type Rival = { id: string; town: string; level: number; carName: string; color: string; pi: number; online: boolean; body: Body }

const TOWNS = ['Transamsylvania', 'Gearville', 'Piston Peak', 'Nitro Bay', 'Chrome City', 'Rustbelt Row', 'Turbo Falls', 'Muffler Hills']
const TRACK = 400
const GEAR_POWER = [1, 0.85, 0.72, 0.6]

function makeRivals(myPi: number, level: number): Rival[] {
  const towns = [...TOWNS].sort(() => Math.random() - 0.5)
  return [0.8, 0.95, 1.1].map((f, i) => {
    const target = Math.max(10, Math.round(myPi * f + (Math.random() * 6 - 3)))
    const car = [...CARS].sort((a, b) => Math.abs(performance(a, zero) - target) - Math.abs(performance(b, zero) - target))[0]
    return {
      id: `ai-${i}`,
      town: towns[i],
      level: Math.max(1, level + i - 1),
      carName: car.name,
      color: car.colors[Math.floor(Math.random() * car.colors.length)],
      pi: target,
      online: false,
      body: car.body,
    }
  })
}
const zero = { engine: 0, turbo: 0, tires: 0, weight: 0 }

// Real players' best cars, from their cloud saves.
async function fetchOnlineRivals(): Promise<Rival[]> {
  if (!supabase) return []
  const { data: auth } = await supabase.auth.getUser()
  let q = supabase.from('game_saves').select('owner_id, town_name, level, best_car').order('updated_at', { ascending: false }).limit(12)
  if (auth.user) q = q.neq('owner_id', auth.user.id)
  const { data, error } = await q
  if (error || !data) return []
  return data
    .filter((r) => r.best_car)
    .map((r) => ({
      id: r.owner_id,
      town: r.town_name,
      level: r.level,
      carName: r.best_car.name,
      color: r.best_car.color,
      pi: r.best_car.pi,
      online: true,
      body: (r.best_car.body ?? 'sedan') as Body,
    }))
}

export function RacePanel() {
  const cars = useGame((s) => s.cars)
  const level = useGame((s) => s.level)
  const best = useMemo(() => [...cars].sort((a, b) => pi(b) - pi(a))[0], [cars])
  const [carId, setCarId] = useState(best?.uid)
  const car = cars.find((c) => c.uid === carId) ?? best
  const [rivals] = useState(() => makeRivals(pi(best), level))
  const [online, setOnline] = useState<Rival[]>([])
  const [race, setRace] = useState<Rival | null>(null)

  useEffect(() => {
    fetchOnlineRivals().then(setOnline)
  }, [])

  if (race && car) return <DragRace car={car} rival={race} onExit={() => setRace(null)} />

  const start = (r: Rival) => {
    if (!spendFuel(RACE_FUEL)) return useGame.getState().toast(`Racing needs ${RACE_FUEL} fuel`)
    setRace(r)
  }

  return (
    <Panel title="Drag Race" wide>
      <h3>Your car</h3>
      <div className="race-cars">
        {cars.map((c) => (
          <button key={c.uid} className={c.uid === car?.uid ? 'chip sel' : 'chip'} onClick={() => setCarId(c.uid)}>
            <i style={{ background: c.color }} /> {carDef(c.model).name} · PI {pi(c)}
          </button>
        ))}
      </div>
      <h3>Pick a rival <small>(costs ⛽{RACE_FUEL})</small></h3>
      <div className="rivals">
        {[...online, ...rivals].map((r) => (
          <div key={r.id} className="rival">
            <i style={{ background: r.color }} />
            <div>
              <b>{r.town}</b> {r.online && <span className="tag">PLAYER</span>}
              <div className="card-stat">Lvl {r.level} · {r.carName} · PI {r.pi}</div>
            </div>
            <button className="buy small" onClick={() => start(r)}>Race · win ${reward(r)}</button>
          </div>
        ))}
      </div>
      <p className="hint">Shift when the needle hits the green zone. Space bar works too.</p>
    </Panel>
  )
}

const pi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades)
const reward = (r: Rival) => 150 + r.pi * 6

type Racer = { gear: number; rpm: number; speed: number; dist: number; quality: number; finished: number | null }
const fresh = (): Racer => ({ gear: 0, rpm: 0, speed: 0, dist: 0, quality: 1, finished: null })

function step(r: Racer, piVal: number, dt: number, t: number) {
  if (r.finished !== null) return
  const climb = (1.25 - r.gear * 0.16) * (0.85 + piVal / 300)
  // Top gear just holds near the redline; lower gears bounce off the limiter.
  r.rpm = Math.min(r.gear === 3 ? 0.95 : 1.05, r.rpm + climb * dt)
  const overRev = r.rpm >= 1
  const accel = (piVal / 100) * 70 * GEAR_POWER[r.gear] * r.quality * (overRev ? 0.25 : 1) * (0.4 + r.rpm * 0.6)
  r.speed += accel * dt
  r.speed *= 1 - 0.04 * dt
  r.dist += r.speed * dt
  if (r.dist >= TRACK) r.finished = t
}

function shiftQuality(rpm: number) {
  if (rpm >= 0.78 && rpm <= 0.93) return { q: 1.08, label: 'PERFECT!' }
  if (rpm >= 0.65 && rpm < 0.78) return { q: 0.95, label: 'Good' }
  if (rpm > 0.93) return { q: 0.85, label: 'Late' }
  return { q: 0.75, label: 'Early' }
}

function DragRace({ car, rival, onExit }: { car: OwnedCar; rival: Rival; onExit: () => void }) {
  const myPi = pi(car)
  const me = useRef(fresh())
  const them = useRef(fresh())
  const t = useRef(0)
  const [, force] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [label, setLabel] = useState('')
  const [result, setResult] = useState<null | { won: boolean; myTime: number; theirTime: number }>(null)
  const finishRace = useGame((s) => s.finishRace)
  // The rival's shifting skill for each gear.
  const skill = useMemo(() => Array.from({ length: 4 }, () => 0.8 + Math.random() * 0.12), [])

  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 700)
    return () => clearTimeout(id)
  }, [countdown])

  useEffect(() => {
    if (countdown > 0 || result) return
    let raf = 0
    let last = performance_now()
    const loop = () => {
      const now = performance_now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      t.current += dt
      step(me.current, myPi, dt, t.current)
      const th = them.current
      if (th.gear < 3 && th.rpm >= skill[th.gear]) {
        th.quality = shiftQuality(th.rpm).q
        th.gear++
        th.rpm = 0.35
      }
      step(th, rival.pi, dt, t.current)
      force((n) => n + 1)
      if (me.current.finished !== null && th.finished !== null) {
        const won = me.current.finished <= th.finished
        setResult({ won, myTime: me.current.finished, theirTime: th.finished })
        finishRace(won, reward(rival))
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [countdown, result, myPi, rival, skill, finishRace])

  const shift = () => {
    const r = me.current
    if (countdown > 0 || r.gear >= 3 || r.finished !== null) return
    const s = shiftQuality(r.rpm)
    r.quality = s.q
    r.gear++
    r.rpm = 0.35
    setLabel(s.label)
    setTimeout(() => setLabel(''), 700)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        shift()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const def = carDef(car.model)
  const rpmAngle = -210 + Math.min(1.05, me.current.rpm) * 240
  return (
    <Panel title={`Drag Race vs ${rival.town}`} wide>
      <div className="race-3d">
        <Canvas shadows camera={{ position: [0.4, 2.2, -4], fov: 55 }} dpr={[1, 1.5]}>
          <RaceScene track={TRACK} me={me} them={them} mine={{ body: def.body, color: car.color }} theirs={{ body: rival.body, color: rival.color }} />
        </Canvas>
        {countdown > 0 && <div className="countdown big">{countdown}</div>}
        {label && <div className="shift-label big">{label}</div>}
      </div>
      <div className="strip mini">
        {[
          { name: `You · ${def.name}`, color: car.color, r: me.current },
          { name: `${rival.town} · ${rival.carName}`, color: rival.color, r: them.current },
        ].map((lane) => (
          <div key={lane.name} className="lane">
            <span className="lane-name">{lane.name}</span>
            <div className="lane-car" style={{ left: `calc(${Math.min(1, lane.r.dist / TRACK) * 92}% )`, background: lane.color }} />
            <div className="finish" />
          </div>
        ))}
      </div>
      <div className="race-controls">
        <svg viewBox="0 0 120 120" width="150" height="150" className="tach">
          <circle cx="60" cy="60" r="56" fill="#1b1f24" stroke="#cfd8dc" strokeWidth="3" />
          <path d={arcPath(60, 60, 46, -210 + 0.78 * 240, -210 + 0.93 * 240)} stroke="#76ff03" strokeWidth="10" fill="none" />
          <path d={arcPath(60, 60, 46, -210 + 0.95 * 240, 30)} stroke="#ff1744" strokeWidth="10" fill="none" />
          <line x1="60" y1="60" x2={60 + 44 * Math.cos((rpmAngle * Math.PI) / 180)} y2={60 + 44 * Math.sin((rpmAngle * Math.PI) / 180)} stroke="#ff9100" strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="60" r="6" fill="#eceff1" />
          <text x="60" y="92" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900">GEAR {me.current.gear + 1}</text>
        </svg>
        <div className="race-side">
          <div className="speed">{Math.round(me.current.speed * 0.9)} km/h</div>
          {!result ? (
            <button className="big-btn shift-btn" onPointerDown={shift} disabled={countdown > 0 || me.current.gear >= 3}>
              SHIFT ▲
            </button>
          ) : (
            <div className={result.won ? 'result win' : 'result lose'}>
              <h3>{result.won ? 'YOU WIN!' : 'You lost'}</h3>
              <p>{result.myTime.toFixed(2)}s vs {result.theirTime.toFixed(2)}s</p>
              <p>{result.won ? `+$${reward(rival)} · +1 🏆 · +30 XP` : `+$${Math.round(reward(rival) * 0.1)} · +8 XP`}</p>
              <button className="buy" onClick={onExit}>Back</button>
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}

const performance_now = () => window.performance.now()

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`
}
