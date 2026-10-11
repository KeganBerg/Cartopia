import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, spendFuel, type OwnedCar } from '../game/store'
import { CARS, SKILLS, carDef, performance, RACE_FUEL, GP_SERIES, GP_ROUNDS, gpRivalPi, gpReward, type Body, type GpSeries } from '../game/data'
import { CarThumb } from '../scene/BuildingPreview'
import { supabase } from '../lib/supabase'
import { Panel } from './Menus'
import { Canvas } from '@react-three/fiber'
import { RaceScene } from '../scene/RaceScene'
import { sfx, engineRpm, stopEngine } from '../lib/sound'
import { useLive, challenge, refreshPresence, raceChannel, endLiveRace, answer, pruneInvites, mute, unmute, setClosed, INVITE_MS, type LiveRace } from '../lib/live'
import { displayName } from '../lib/names'

type Rival = { id: string; town: string; level: number; carName: string; color: string; pi: number; online: boolean; body: Body }

const TOWNS = ['Transamsylvania', 'Gearville', 'Piston Peak', 'Nitro Bay', 'Chrome City', 'Rustbelt Row', 'Turbo Falls', 'Muffler Hills']
const TRACK = 400
const GEAR_POWER = [1, 0.85, 0.72, 0.6]
const zero = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const pi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades)
const liveReward = (oppPi: number) => 300 + oppPi * 8
const reward = (r: Rival) => (r.id.startsWith('live:') ? liveReward(r.pi) : 150 + r.pi * 6)
const performance_now = () => window.performance.now()

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
      town: displayName(r.town_name, r.owner_id),
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
  const mutedIds = useLive((l) => l.muted)
  const cooldownTo = useLive((l) => l.cooldownTo)

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
            <CarThumb size="xs" color={c.color} body={carDef(c.model).body} stripe={c.stripe} /> {carDef(c.model).name} · PI {pi(c)}{carDef(c.model).skill ? ` ${SKILLS[carDef(c.model).skill!].icon}` : ''}
          </button>
        ))}
      </div>
      {car && carDef(car.model).skill && <p className="hint">{SKILLS[carDef(car.model).skill!].icon} <b>{SKILLS[carDef(car.model).skill!].name}:</b> {SKILLS[carDef(car.model).skill!].text}</p>}
      <div className="tabs">
        <button className={tab === 'quick' ? 'tab sel' : 'tab'} onClick={() => setTab('quick')}>🏁 Quick race</button>
        <button className={tab === 'gp' ? 'tab sel' : 'tab'} onClick={() => setTab('gp')}>🏆 Grand Prix</button>
        <button className="tab" onClick={() => useGame.getState().openPanel('leaders')}>🏅 Top racers</button>
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
            {livePlayers.filter((p) => !mutedIds[p.id]).map((p) => (
              <div key={p.id} className="rival">
                <i style={{ background: p.color }} />
                <div>
                  <b>{p.town}</b> <span className="tag live">LIVE</span>
                  <div className="card-stat">Lvl {p.level} · {p.carName} · PI {p.pi}</div>
                </div>
                <button className="buy small alt" disabled={!!outgoing || p.closed || (cooldownTo[p.id] ?? 0) > Date.now()} onClick={() => challenge(p.id)}>
                  {p.closed ? 'Not taking races' : outgoing?.to === p.id ? 'Waiting...' : (cooldownTo[p.id] ?? 0) > Date.now() ? 'Try again soon' : `Challenge · win $${liveReward(p.pi)}`}
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
            <CarThumb size="lg" color={prize.color} body={def.body} />
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


type Racer = { gear: number; rpm: number; speed: number; dist: number; quality: number; finished: number | null }
// A live opponent is replayed on our own race clock from the samples they
// send, so the strip and the result both compare the same race times.
type Sample = { dist: number; t: number; speed: number }
function sampleAt(samples: Sample[], t: number, finished: number | null) {
  if (finished !== null && t >= finished) return TRACK
  if (!samples.length) return 0
  const last = samples[samples.length - 1]
  // Not heard that far yet: extrapolate, but never past the line until they report finishing.
  if (t >= last.t) return Math.min(finished === null ? TRACK - 0.5 : TRACK, last.dist + last.speed * (t - last.t))
  let i = samples.length - 1
  while (i > 0 && samples[i - 1].t > t) i--
  const a = samples[i - 1] ?? { dist: 0, t: 0, speed: 0 }
  const b = samples[i]
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1
  return a.dist + (b.dist - a.dist) * Math.max(0, Math.min(1, f))
}

const fresh = (): Racer => ({ gear: 0, rpm: 0, speed: 0, dist: 0, quality: 1, finished: null })

function step(r: Racer, piVal: number, dt: number, t: number, mul = 1) {
  if (r.finished !== null) return
  const climb = (1.25 - r.gear * 0.16) * (0.85 + piVal / 300)
  // Top gear just holds near the redline; lower gears bounce off the limiter.
  r.rpm = Math.min(r.gear === 3 ? 0.95 : 1.05, r.rpm + climb * dt)
  const overRev = r.rpm >= 1
  const accel = (piVal / 100) * 70 * GEAR_POWER[r.gear] * r.quality * (overRev ? 0.25 : 1) * (0.4 + r.rpm * 0.6)
  r.speed += accel * mul * dt
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
  const samples = useRef<Sample[]>([])
  const def = carDef(car.model)
  const skillActive = useRef(false)
  const [skillShown, setSkillShown] = useState(false)
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
      onPos: (p) => {
        const last = samples.current[samples.current.length - 1]
        if (!last || p.t > last.t) samples.current.push(p)
      },
      onFinish: (ft) => {
        them.current.finished = ft
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
      const sk = def.skill
      const th0 = them.current
      let myMul = 1
      let skillOn = false
      if (sk === 'launch' && me.current.gear === 0) { myMul = 1.2; skillOn = true }
      else if (sk === 'nitro' && me.current.gear === 3) { myMul = 1.15; skillOn = true }
      else if (sk === 'slipstream' && me.current.dist < th0.dist && me.current.dist > 0) { myMul = 1.08; skillOn = true }
      // In a live race the rival runs on their own device, so Oil Slick boosts us instead.
      else if (sk === 'oil' && live && t.current < 2.5) { myMul = 1.1; skillOn = true }
      if (skillOn !== skillActive.current) { skillActive.current = skillOn; setSkillShown(skillOn) }
      step(me.current, myPi, dt, t.current, myMul)
      const th = them.current
      if (live) {
        if (now - lastSent > 100) {
          lastSent = now
          channel.current?.send({ type: 'broadcast', event: 'pos', payload: { dist: me.current.dist, t: t.current, speed: me.current.speed } })
        }
        if (!wasDone && me.current.finished !== null) {
          myFinishSentAt = now
          channel.current?.send({ type: 'broadcast', event: 'finish', payload: { t: me.current.finished } })
        }
        th.dist = sampleAt(samples.current, t.current, Number.isFinite(th.finished) ? th.finished : null)
        // Opponent vanished: the race is yours after a grace period.
        if (myFinishSentAt !== null && th.finished === null && now - myFinishSentAt > 15000) th.finished = Infinity
      } else {
        if (th.gear < 3 && th.rpm >= skill[th.gear]) {
          th.quality = shiftQuality(th.rpm).q
          th.gear++
          th.rpm = 0.35
        }
        step(th, rival.pi, dt, t.current, def.skill === 'oil' && t.current < 2.5 ? 0.9 : 1)
      }
      force((n) => n + 1)
      if (me.current.finished === null) engineRpm(me.current.rpm, me.current.gear)
      else stopEngine()
      if (me.current.finished !== null && th.finished !== null) {
        const won = me.current.finished < th.finished || (me.current.finished === th.finished && (!live || live.host))
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
  }, [countdown, result, myPi, rival, skill, finishRace, live, def])

  const shift = () => {
    const r = me.current
    if (countdown > 0 || r.gear >= 3 || r.finished !== null) return
    let s = shiftQuality(r.rpm)
    if (def.skill === 'smooth' && s.label === 'Good') s = { q: 1.08, label: 'SMOOTH!' }
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

  const rpmAngle = -210 + Math.min(1.05, me.current.rpm) * 240
  const close = live ? onExit : () => useGame.getState().openPanel(null)
  // One full-screen view: the street fills the screen and the controls float over it.
  return (
    <div className="race-full">
      <Canvas className="rf-canvas" camera={{ position: [0.4, 2.2, -4], fov: 55, near: 0.3, far: 150 }} dpr={[1, 1.5]}>
        <RaceScene track={TRACK} me={me} them={them} mine={{ body: def.body, color: car.color }} theirs={{ body: rival.body, color: rival.color }} />
      </Canvas>
      <div className="rf-top">
        <h2>{title ?? `Drag Race vs ${rival.town}`}</h2>
        <button className="close" onClick={close} aria-label="Leave race">✕</button>
      </div>
      <div className="rf-lanes">
        {[
          { name: `You · ${def.name}`, color: car.color, r: me.current },
          { name: `${rival.town} · ${rival.carName}`, color: rival.color, r: them.current },
        ].map((lane) => (
          <div key={lane.name} className="rf-lane">
            <span className="lane-name">{lane.name}</span>
            <div className="lane-car" style={{ left: `${Math.min(1, lane.r.dist / TRACK) * 90}%`, background: lane.color }} />
            <div className="finish" />
          </div>
        ))}
      </div>
      {countdown > 0 && countdown !== 99 && <div className="countdown big">{countdown}</div>}
      {countdown === 99 && <div className="rf-wait">Waiting for {rival.town} to join...</div>}
      {label && <div className="shift-label big">{label}</div>}
      {def.skill && skillShown && !result && <div className="skill-flash">{SKILLS[def.skill].icon} {SKILLS[def.skill].name}!</div>}
      {result ? (
        <RaceResult won={result.won} myTime={result.myTime} theirTime={result.theirTime} cash={result.won ? payout : Math.round(payout * 0.1)} xp={result.won ? 30 : 8} rival={rival.town} onExit={onExit} />
      ) : (
        <div className="rf-bottom">
          <svg viewBox="0 0 120 120" className="tach">
            <circle cx="60" cy="60" r="56" fill="#1b1f24" fillOpacity="0.85" stroke="#cfd8dc" strokeWidth="3" />
            <path d={arcPath(60, 60, 46, -210 + 0.78 * 240, -210 + 0.93 * 240)} stroke="#76ff03" strokeWidth="10" fill="none" />
            <path d={arcPath(60, 60, 46, -210 + 0.95 * 240, 30)} stroke="#ff1744" strokeWidth="10" fill="none" />
            <line x1="60" y1="60" x2={60 + 44 * Math.cos((rpmAngle * Math.PI) / 180)} y2={60 + 44 * Math.sin((rpmAngle * Math.PI) / 180)} stroke="#ff9100" strokeWidth="4" strokeLinecap="round" />
            <circle cx="60" cy="60" r="6" fill="#eceff1" />
            <text x="60" y="92" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900">GEAR {me.current.gear + 1}</text>
          </svg>
          <div className="rf-side">
            <div className="rf-speed">{Math.round(me.current.speed * 0.9)}<small> km/h</small></div>
            <button className="big-btn shift-btn" onPointerDown={shift} disabled={countdown > 0 || me.current.gear >= 3}>
              SHIFT ▲
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// Counts a number up from zero once it appears.
function useCountUp(target: number, delay: number, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance_now() + delay
    const tick = () => {
      const k = Math.min(1, Math.max(0, (performance_now() - t0) / ms))
      setV(Math.round(target * (1 - (1 - k) ** 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, delay, ms])
  return v
}

const CONFETTI = ['#ffd54f', '#ef5350', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#ffffff']

function RaceResult({ won, myTime, theirTime, cash, xp, rival, onExit }: { won: boolean; myTime: number; theirTime: number; cash: number; xp: number; rival: string; onExit: () => void }) {
  const money = useCountUp(cash, 700)
  const exp = useCountUp(xp, 900)
  const margin = Number.isFinite(theirTime) ? Math.abs(theirTime - myTime) : null
  const pieces = useMemo(() => Array.from({ length: won ? 60 : 0 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: ((i * 53) % 100) / 60,
    dur: 2.4 + ((i * 29) % 10) / 6,
    color: CONFETTI[i % CONFETTI.length],
    drift: ((i * 71) % 60) - 30,
    round: i % 3 === 0,
  })), [won])
  return (
    <div className={won ? 'rr win' : 'rr lose'}>
      {won && <div className="rr-rays" />}
      {pieces.map((c, i) => (
        <i key={i} className={c.round ? 'rr-bit round' : 'rr-bit'} style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, ['--drift' as string]: `${c.drift}vw` }} />
      ))}
      <div className="rr-card">
        <div className="rr-icon">{won ? '🏆' : '🏁'}</div>
        <h3 className="rr-title">{won ? 'YOU WIN!' : 'SO CLOSE!'}</h3>
        <p className="rr-sub">
          {won ? `You beat ${rival}` : `${rival} took it`}
          {margin !== null ? ` by ${margin.toFixed(2)}s` : ''}
        </p>
        <div className="rr-times">
          <span className={won ? 'best' : ''}><small>You</small>{myTime.toFixed(2)}s</span>
          <span className={won ? '' : 'best'}><small>{rival}</small>{Number.isFinite(theirTime) ? `${theirTime.toFixed(2)}s` : 'DNF'}</span>
        </div>
        <div className="rr-loot">
          <span style={{ animationDelay: '.6s' }}>💵 +${money.toLocaleString()}</span>
          {won && <span style={{ animationDelay: '.8s' }}>🏆 +1</span>}
          <span style={{ animationDelay: won ? '1s' : '.8s' }}>⭐ +{exp} XP</span>
        </div>
        <button className="buy rr-go" onClick={onExit}>{won ? 'Collect' : 'Back'}</button>
      </div>
    </div>
  )
}

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
  const rival: Rival = { id: `live:${o.id}`, town: displayName(o.town, o.id), level: o.level, carName: o.carName, color: o.color, pi: o.pi, online: true, body: o.body }
  return <DragRace key={race.raceId} car={best} rival={rival} live={race} onExit={endLiveRace} />
}

// Challenges land in an inbox instead of popping up over the game.
export function ChallengeBell() {
  const count = useLive((l) => l.invites.length)
  const closed = useLive((l) => l.closed)
  const openPanel = useGame((s) => s.openPanel)
  const visiting = useGame((s) => !!s.visiting)
  useEffect(() => {
    const id = setInterval(pruneInvites, 1000)
    return () => clearInterval(id)
  }, [])
  if (!supabase || visiting) return null
  return (
    <button className={`challenge-bell${count ? ' has' : ''}`} onClick={() => openPanel('invites')} title="Race challenges">
      🏁{closed && <span className="bell-off">✕</span>}
      {count > 0 && <span className="bell-count">{count}</span>}
    </button>
  )
}

export function InvitesPanel() {
  const invites = useLive((l) => l.invites)
  const muted = useLive((l) => l.muted)
  const closed = useLive((l) => l.closed)
  const openPanel = useGame((s) => s.openPanel)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const accept = (raceId: string) => {
    answer(raceId, true)
    openPanel(null)
  }
  return (
    <Panel title="Race challenges">
      <label className="toggle-row">
        <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
        <span>Don't accept challenges <small>Other players will see you're not taking races.</small></span>
      </label>
      {invites.length === 0 ? (
        <p className="hint">{closed ? 'Challenges are off.' : 'No challenges right now. When someone challenges you, it shows up here.'}</p>
      ) : (
        <div className="rivals">
          {invites.map((i) => (
            <div key={i.raceId} className="rival invite">
              <i style={{ background: i.from.color }} />
              <div>
                <b>{i.from.town}</b> <span className="tag live">LIVE</span>
                <div className="card-stat">Lvl {i.from.level} · {i.from.carName} · PI {i.from.pi} · {Math.max(0, Math.ceil((INVITE_MS - (Date.now() - i.at)) / 1000))}s left</div>
              </div>
              <div className="invite-actions">
                <button className="buy small" onClick={() => accept(i.raceId)}>Race!</button>
                <button className="sell" onClick={() => answer(i.raceId, false)}>Decline</button>
                <button className="mute-btn" onClick={() => mute(i.from)} title="Ignore all challenges from this player">🔇 Mute</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {Object.keys(muted).length > 0 && (
        <>
          <h3>Muted players</h3>
          <div className="rivals">
            {Object.entries(muted).map(([id, town]) => (
              <div key={id} className="rival muted-row">
                <span>🔇 {town}</span>
                <button className="buy small alt" onClick={() => unmute(id)}>Unmute</button>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="hint">Each player can only send you one challenge at a time, and after you decline they have to wait a minute before asking again.</p>
    </Panel>
  )
}
