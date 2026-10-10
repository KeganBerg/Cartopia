import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, spendFuel, type OwnedCar } from '../game/store'
import { CARS, carDef, performance, RACE_FUEL, GP_SERIES, GP_ROUNDS, gpRivalPi, gpReward, type Body, type GpSeries } from '../game/data'
import { CarSwatch } from './Menus'
import { supabase } from '../lib/supabase'
import { Panel } from './Menus'
import { Canvas } from '@react-three/fiber'
import { RaceScene } from '../scene/RaceScene'
import { sfx, engineRpm, stopEngine } from '../lib/sound'
import { useLive, challenge, refreshPresence, raceChannel, endLiveRace, answer, type LiveRace } from '../lib/live'

type Rival = { id: string; town: string; level: number; carName: string; color: string; pi: number; online: boolean; body: Body }

const TOWNS = ['Transamsylvania', 'Gearville', 'Piston Peak', 'Nitro Bay', 'Chrome City', 'Rustbelt Row', 'Turbo Falls', 'Muffler Hills']
const TRACK = 400
const GEAR_POWER = [1, 0.85, 0.72, 0.6]

function carNear(target: number) {
  return [...CARS].sort((a, b) => Math.abs(performance(a, zero) - target) - Math.abs(performance(b, zero) - target))[0]
}

function gpRival(series: GpSeries, round: number, clears: number): Rival {
  const target = gpRivalPi(series, round, clears)
  const car = carNear(target)
  return { id: `gp-${series.id}-${round}`, town: series.rivals[round], level: series.unlockLevel + round, carName: car.name, color: car.colors[round % car.colors.length], pi: target, online: false, body: car.body }
}

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
  const [gpRace, setGpRace] = useState<{ series: GpSeries; rival: Rival; prize: number } | null>(null)
  const [tab, setTab] = useState<'quick' | 'gp'>('quick')
  const gpResult = useGame((s) => s.gpResult)

  const livePlayers = useLive((l) => l.players)
  const outgoing = useLive((l) => l.outgoing)

  useEffect(() => {
    fetchOnlineRivals().then(setOnline)
    refreshPresence()
  }, [])

  if (race && car) return <DragRace car={car} rival={race} onExit={() => setRace(null)} />
  if (gpRace && car) {
    return (
      <DragRace
        car={car}
        rival={gpRace.rival}
        prize={gpRace.prize}
        title={`${gpRace.series.name} · Race ${Number(gpRace.rival.id.split('-').pop()) + 1} of ${GP_ROUNDS}`}
        onFinish={(won) => gpResult(gpRace.series.id, won)}
        onExit={() => { setGpRace(null); setTab('gp') }}
      />
    )
  }

  const start = (r: Rival) => {
    if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a race')
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
      <div className="tabs">
        <button className={tab === 'quick' ? 'tab sel' : 'tab'} onClick={() => setTab('quick')}>🏁 Quick race</button>
        <button className={tab === 'gp' ? 'tab sel' : 'tab'} onClick={() => setTab('gp')}>🏆 Grand Prix</button>
      </div>
      {tab === 'gp' ? (
        <GrandPrix onRace={(series, rival, prize) => {
          if (!spendFuel(RACE_FUEL)) return useGame.getState().showNeed('fuel', RACE_FUEL - useGame.getState().fuel, 'a Grand Prix race')
          setGpRace({ series, rival, prize })
        }} />
      ) : <>
      {supabase && (
        <>
          <h3>Live now <small>(players online this minute, no fuel needed)</small></h3>
          {livePlayers.length === 0 && <p className="hint">Nobody else is online right now. Open Cartopia in another browser or ask a friend to join!</p>}
          <div className="rivals">
            {livePlayers.map((p) => (
              <div key={p.id} className="rival">
                <i style={{ background: p.color }} />
                <div>
                  <b>{p.town}</b> <span className="tag live">LIVE</span>
                  <div className="card-stat">Lvl {p.level} · {p.carName} · PI {p.pi}</div>
                </div>
                <button className="buy small alt" disabled={!!outgoing} onClick={() => challenge(p.id)}>
                  {outgoing?.to === p.id ? 'Waiting...' : `Challenge · win $${liveReward(p.pi)}`}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
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
      </>}
      <p className="hint">Shift when the needle hits the green zone. Space bar works too.</p>
    </Panel>
  )
}

function GrandPrix({ onRace }: { onRace: (s: GpSeries, r: Rival, prize: number) => void }) {
  const level = useGame((s) => s.level)
  const carCount = useGame((s) => s.cars.length)
  const gp = useGame((s) => s.gp)
  const showNeed = useGame((s) => s.showNeed)
  const openPanel = useGame((s) => s.openPanel)
  return (
    <>
      <p className="hint">Win six races in a row to earn a mystery box car. Lose and you can retry that race. Every repeat of a series gets tougher.</p>
      <div className="gp-list">
        {GP_SERIES.map((s) => {
          const prog = gp[s.id] ?? { round: 0, clears: 0 }
          const locked = level < s.unlockLevel
          const short = carCount < s.minCars
          const rival = gpRival(s, prog.round, prog.clears)
          const prize = gpReward(s, prog.round)
          return (
            <div key={s.id} className={locked ? 'gp-card locked' : 'gp-card'}>
              <div className="gp-head">
                <b>{s.name}</b>
                {prog.clears > 0 && <span className="tag">Won ×{prog.clears}</span>}
                <span className="gp-box" title={`Mystery box: ${s.box.map((m) => carDef(m).name).join(', ')}`}>🎁</span>
              </div>
              <div className="gp-rounds">
                {Array.from({ length: GP_ROUNDS }, (_, i) => (
                  <i key={i} className={i < prog.round ? 'won' : i === prog.round ? 'next' : ''}>{i < prog.round ? '✔' : i + 1}</i>
                ))}
              </div>
              <div className="card-stat">Box could hold: {s.box.map((m) => carDef(m).name).join(', ')}</div>
              {locked ? (
                <button className="price locked-btn" onClick={() => showNeed('level', s.unlockLevel, s.name)}>🔒 Level {s.unlockLevel}</button>
              ) : short ? (
                <div className="gp-short">
                  <span>You need {s.minCars} cars to enter. You have {carCount}.</span>
                  <button className="buy small alt" onClick={() => openPanel('rescue')}>Get cars at Rusty's</button>
                </div>
              ) : (
                <div className="gp-next">
                  <span>Race {prog.round + 1}: <b>{rival.town}</b> · {rival.carName} · PI {rival.pi}</span>
                  <button className="buy small" onClick={() => onRace(s, rival, prize)}>Race · win ${prize}</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function PrizePopup() {
  const prize = useGame((s) => s.gpPrize)
  const close = useGame((s) => s.closePrize)
  const openPanel = useGame((s) => s.openPanel)
  const [open, setOpen] = useState(false)
  if (!prize) return null
  const series = GP_SERIES.find((s) => s.id === prize.series)!
  const def = carDef(prize.model)
  return (
    <div className="overlay prize-overlay">
      <div className="prize">
        <h2>{series.name} champion!</h2>
        {!open ? (
          <>
            <button className="mystery-box" onClick={() => { sfx.win(); setOpen(true) }}>🎁</button>
            <p>Tap the mystery box to open it</p>
          </>
        ) : (
          <>
            <CarSwatch color={prize.color} body={def.body} />
            <h3>{def.name}</h3>
            <p>PI {performance(def, zero)} · +5 🏆. It's in your garage now.</p>
            <div className="row">
              <button className="buy" onClick={() => { close(); setOpen(false); openPanel('garage') }}>See it</button>
              <button className="buy alt" onClick={() => { close(); setOpen(false) }}>Nice!</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const pi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades)
const reward = (r: Rival) => (r.id.startsWith('live:') ? liveReward(r.pi) : 150 + r.pi * 6)
const liveReward = (oppPi: number) => 300 + oppPi * 8

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

function DragRace({ car, rival, onExit, live, prize, onFinish, title }: { car: OwnedCar; rival: Rival; onExit: () => void; live?: LiveRace; prize?: number; onFinish?: (won: boolean) => void; title?: string }) {
  const payout = prize ?? reward(rival)
  const finishCb = useRef(onFinish)
  finishCb.current = onFinish
  const myPi = pi(car)
  const me = useRef(fresh())
  const them = useRef(fresh())
  const t = useRef(0)
  const [, force] = useState(0)
  // Live races wait for both players before counting down.
  const [countdown, setCountdown] = useState(live ? 99 : 3)
  const channel = useRef<ReturnType<typeof raceChannel>>(null)
  const [label, setLabel] = useState('')
  const [result, setResult] = useState<null | { won: boolean; myTime: number; theirTime: number }>(null)
  const finishRace = useGame((s) => s.finishRace)
  // The rival's shifting skill for each gear.
  const skill = useMemo(() => Array.from({ length: 4 }, () => 0.8 + Math.random() * 0.12), [])

  useEffect(() => {
    if (countdown === 99) return
    if (countdown >= 0 && countdown <= 3) sfx.countdown(countdown === 0)
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 700)
    return () => clearTimeout(id)
  }, [countdown])

  useEffect(() => {
    if (!live) return
    let started = false
    let answeredReady = false
    const go = () => {
      if (started) return
      started = true
      setCountdown(3)
    }
    const ch = raceChannel(live.raceId, {
      onPos: (d) => (them.current.dist = Math.max(them.current.dist, d)),
      onFinish: (ft) => {
        them.current.finished = ft
        them.current.dist = TRACK
      },
      onGo: go,
      onReady: () => {
        if (live.host) {
          ch?.send({ type: 'broadcast', event: 'go', payload: {} })
          go()
        } else if (!answeredReady) {
          answeredReady = true
          ch?.send({ type: 'broadcast', event: 'ready', payload: {} })
        }
      },
    })
    channel.current = ch
    // Keep pinging until the race starts in case the first message was missed.
    const ping = setInterval(() => {
      if (!started) ch?.send({ type: 'broadcast', event: 'ready', payload: {} })
    }, 1000)
    return () => {
      clearInterval(ping)
      if (ch && supabase) supabase.removeChannel(ch)
    }
  }, [live])

  useEffect(() => {
    if (countdown > 0 || result) return
    let raf = 0
    let last = performance_now()
    let lastSent = 0
    let myFinishSentAt: number | null = null
    const loop = () => {
      const now = performance_now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      t.current += dt
      const wasDone = me.current.finished !== null
      step(me.current, myPi, dt, t.current)
      const th = them.current
      if (live) {
        if (now - lastSent > 100) {
          lastSent = now
          channel.current?.send({ type: 'broadcast', event: 'pos', payload: { dist: me.current.dist } })
        }
        if (!wasDone && me.current.finished !== null) {
          myFinishSentAt = now
          channel.current?.send({ type: 'broadcast', event: 'finish', payload: { t: me.current.finished } })
        }
        // Opponent vanished: the race is yours after a grace period.
        if (myFinishSentAt !== null && th.finished === null && now - myFinishSentAt > 15000) th.finished = Infinity
      } else {
        if (th.gear < 3 && th.rpm >= skill[th.gear]) {
          th.quality = shiftQuality(th.rpm).q
          th.gear++
          th.rpm = 0.35
        }
        step(th, rival.pi, dt, t.current)
      }
      force((n) => n + 1)
      if (me.current.finished === null) engineRpm(me.current.rpm, me.current.gear)
      else stopEngine()
      if (me.current.finished !== null && th.finished !== null) {
        const won = me.current.finished <= th.finished
        stopEngine()
        if (won) sfx.win()
        else sfx.lose()
        setResult({ won, myTime: me.current.finished, theirTime: th.finished })
        if (finishCb.current) finishCb.current(won)
        else finishRace(won, reward(rival))
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      stopEngine()
    }
  }, [countdown, result, myPi, rival, skill, finishRace, live])

  const shift = () => {
    const r = me.current
    if (countdown > 0 || r.gear >= 3 || r.finished !== null) return
    const s = shiftQuality(r.rpm)
    sfx.shift(s.q >= 1)
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
    <Panel title={title ?? `Drag Race vs ${rival.town}`} wide onClose={live ? onExit : undefined}>
      <div className="race-layout">
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
          {countdown === 99 && <div className="hint">Waiting for {rival.town} to join...</div>}
          {!result ? (
            <button className="big-btn shift-btn" onPointerDown={shift} disabled={countdown > 0 || me.current.gear >= 3}>
              SHIFT ▲
            </button>
          ) : (
            <div className={result.won ? 'result win' : 'result lose'}>
              <h3>{result.won ? 'YOU WIN!' : 'You lost'}</h3>
              <p>{result.myTime.toFixed(2)}s vs {Number.isFinite(result.theirTime) ? `${result.theirTime.toFixed(2)}s` : 'did not finish'}</p>
              <p>{result.won ? `+$${payout} · +1 🏆 · +30 XP` : `+$${Math.round(payout * 0.1)} · +8 XP`}</p>
              <button className="buy" onClick={onExit}>Back</button>
            </div>
          )}
        </div>
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

// A live race started from a challenge, shown wherever the player is.
export function LiveRaceOverlay() {
  const race = useLive((l) => l.race)
  const cars = useGame((s) => s.cars)
  const best = useMemo(() => [...cars].sort((a, b) => pi(b) - pi(a))[0], [cars])
  if (!race || !best) return null
  const o = race.opponent
  const rival: Rival = { id: `live:${o.id}`, town: o.town, level: o.level, carName: o.carName, color: o.color, pi: o.pi, online: true, body: o.body }
  return <DragRace key={race.raceId} car={best} rival={rival} live={race} onExit={endLiveRace} />
}

export function ChallengePopup() {
  const inc = useLive((l) => l.incoming)
  if (!inc) return null
  return (
    <div className="challenge-pop">
      <b>{inc.from.town}</b> challenges you to a drag race!
      <div className="card-stat">{inc.from.carName} · PI {inc.from.pi}</div>
      <div className="row">
        <button className="buy small" onClick={() => answer(true)}>Race!</button>
        <button className="sell" onClick={() => answer(false)}>Decline</button>
      </div>
    </div>
  )
}
