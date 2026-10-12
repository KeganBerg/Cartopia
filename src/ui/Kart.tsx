import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StageSlot, useStageReady } from '../scene/Stage'
import type { OwnedCar } from '../game/store'
import { carDef } from '../game/data'
import { EMP_TIME, FLAT_TIME, GHOST_TIME, ITEMS, KartRace, LAPS, ROCKET_TIME, SMOKE_TIME, SPLAT_TIME, SHARP_ASSIST, TOUCH_ASSIST, TOW_TIME, buildTrack, type ItemId, type KartEvent, type KartRules, type TrackDef } from '../game/kart'
import { KartScene, kartLights, type KartHud } from '../scene/KartScene'
import type { ChaseCar } from '../scene/ChaseScene'
import { CarThumb } from '../scene/BuildingPreview'
import { KART_FEEL, KART_SHARP, KeyHints, TouchDrive, newDriveInput, useDriveKeys, useTall, useTouchDevice } from './DriveControls'
import { LoadingScene } from './Loading'
import { look as lookOf, pi } from './ArcadeBits'
import { sfx, audioContext, audioOut } from '../lib/sound'
import { airSound, buzzSound, bumpSound, crashSound, dingSound, fuelSound, landSound, revSound, splashSound } from '../lib/arcadeSound'
import { EngineVoice } from '../lib/engineAudio'
import { SnapshotButton } from './Snapshot'
import { buzz } from '../lib/haptics'
import { usePrefs } from '../lib/prefs'
import './kart.css'

// The kart race screen: the 3D circuit, the HUD (place, lap, item, minimap), the
// shared driving controls, a five-light start and a podium at the end.

export type KartRacer = { name: string; pi: number; look: ChaseCar; ai: boolean; skill?: number }
export type KartNext = { label: string; go: () => void }

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
const ORD = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`

const KART_CAM = { position: [0, 4, -8] as [number, number, number], fov: 60, near: 0.3, far: 420 }
// A short buzz in the hand for the moments that matter (phones that can).
const BUZZ: Partial<Record<KartEvent['kind'], number | number[]>> = { wall: 25, bump: 12, hit: [40, 30, 60], boom: 80, turbo: 18, boost: 12, land: 15, crate: 8, boxes: 40, glass: 30, pothole: 20 }
function buzzFor(kind: KartEvent['kind']) {
  const p = BUZZ[kind]
  if (p) buzz(p)
}

export function KartGame({ car, title, track, reverse, field, prize, next, onFinish, onExit, live, rules }: {
  car: OwnedCar; title: string; track: TrackDef; reverse: boolean
  rules?: KartRules // road obstacles, Bumper Blast (single-player races only)
  field: KartRacer[] // the player is the one with ai: false (in a live race: live.me)
  prize?: number
  next?: KartNext | null
  onFinish: (place: number, time: number) => void
  onExit: () => void
  // A live race: the race shared with the other browser, the link that keeps it in step,
  // which kart is ours, whether both players are in (the lights wait for it), and what the
  // podium says about the server's verdict.
  // lobby: shown instead of the waiting line before the start (a kart party's roster).
  live?: { race: KartRace; tick: () => void; me: number; ready: boolean; verdict: ReactNode; loading?: string; lobby?: ReactNode }
}) {
  const t = useMemo(() => buildTrack(track, reverse), [track, reverse])
  const me = live ? live.me : field.findIndex((f) => !f.ai)
  const race = useMemo(() => live?.race ?? new KartRace(t, field.map((f) => ({ name: f.name, pi: f.pi, ai: f.ai, skill: f.skill })), Math.floor(Math.random() * 1e6), rules), [t, field, live?.race]) // eslint-disable-line react-hooks/exhaustive-deps
  const looks = useMemo(() => field.map((f) => f.look), [field])
  const touch = useTouchDevice()
  // On a phone the kart leans gently towards the racing line while the thumb is near the middle.
  // Sharp steering (Settings) is shorter travel and leans less.
  const sharp = usePrefs((p) => p.steer === 'sharp')
  const input = useRef({ ...newDriveInput(), assist: 0 }).current
  useLayoutEffect(() => { input.assist = touch ? (sharp ? SHARP_ASSIST : TOUCH_ASSIST) : 0 }, [input, touch, sharp])
  const tall = useTall()
  const [drawn, setDrawn] = useState(false)
  const [running, setRunning] = useState(false)
  const [hud, setHud] = useState<KartHud | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [end, setEnd] = useState<{ place: number; order: number[] } | null>(null)
  // Keys count from the countdown on, so gas held through the lights goes at GO.
  useDriveKeys(input, { enabled: !end })
  const engine = useRef<EngineVoice | null>(null)

  // Engine note for the player's car, from the speed through a pretend six-speed box.
  useEffect(() => {
    const a = audioContext(), out = audioOut()
    if (!a || !out) return
    const v = new EngineVoice(a, out, { model: car.model, body: carDef(car.model).body, mods: car.mods ?? undefined, level: 0.55 })
    engine.current = v
    return () => { v.stop(0.3); engine.current = null }
  }, [car])
  useEffect(() => {
    const e = engine.current
    if (!e || !hud) return
    const top = race.karts[me].stats.top * 1.3
    const k = Math.min(1, hud.speed / top)
    const gear = Math.min(5, Math.floor(k * 6))
    const rpm = 0.25 + 0.7 * ((k * 6) % 1) * (gear === 5 ? 0.6 : 1) + (gear === 5 ? (k * 6 - 5) * 0.3 : 0)
    e.drive(Math.min(1, rpm), gear + 1, running ? 1 : 0)
  }, [hud, race, me, running])

  // Five lights, one every 0.6 s, then all out: GO. A live race waits for both players and
  // drops the random hold so the two browsers go together.
  const ready = !live || live.ready
  const fixed = !!live
  useEffect(() => {
    if (!drawn || !ready) return
    const timers: ReturnType<typeof setTimeout>[] = []
    kartLights.n = 0
    for (let i = 1; i <= 5; i++) timers.push(setTimeout(() => { kartLights.n = i; sfx.countdown(false) }, 600 + i * 600))
    timers.push(setTimeout(() => { kartLights.n = 0; sfx.countdown(true); setRunning(true); setFlash('GO!') }, 600 + 6 * 600 + (fixed ? 200 : Math.random() * 400)))
    return () => { timers.forEach(clearTimeout); kartLights.n = 0 }
  }, [drawn, ready, fixed])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 1100)
    return () => clearTimeout(id)
  }, [flash])

  const onEvents = (es: KartEvent[]) => {
    for (const e of es) {
      if (e.kart !== me) {
        if (e.kind === 'hit' && race.hornets.length === 0) bumpSound()
        // A bomb going off nearby is heard by everyone close enough to see it.
        if (e.kind === 'boom' && race.bombs.some((b) => b.boom && Math.hypot(b.x - race.karts[me].x, b.z - race.karts[me].z) < 40)) crashSound()
        continue
      }
      if (touch) buzzFor(e.kind)
      if (e.kind === 'wall' || e.kind === 'bump') bumpSound()
      else if (e.kind === 'hit') crashSound()
      else if (e.kind === 'crate') dingSound(1.4)
      else if (e.kind === 'turbo') { dingSound(e.value === 2 ? 1.8 : 1.5); engine.current?.rev(0.5) }
      else if (e.kind === 'boost') engine.current?.rev(0.7)
      else if (e.kind === 'land') landSound()
      else if (e.kind === 'flat') { bumpSound(); airSound() }
      else if (e.kind === 'smoke') fuelSound()
      else if (e.kind === 'zap') buzzSound()
      else if (e.kind === 'tow') dingSound(2)
      else if (e.kind === 'block') dingSound(2.4)
      else if (e.kind === 'ghost') { dingSound(0.7); airSound() }
      else if (e.kind === 'rocket') { revSound(1.2); engine.current?.rev(1) }
      else if (e.kind === 'splat') splashSound()
      else if (e.kind === 'boom') crashSound()
      else if (e.kind === 'boxes' || e.kind === 'glass') crashSound()
      else if (e.kind === 'pothole') bumpSound()
      else if (e.kind === 'ice') airSound()
      else if (e.kind === 'lap') { dingSound(1); setFlash(e.value === LAPS ? 'FINAL LAP!' : `LAP ${e.value}`) }
    }
  }
  const podium = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(podium.current), [])
  const finish = () => {
    const order = race.order().map((k) => k.id)
    const place = order.indexOf(me) + 1
    if (place === 1) sfx.win()
    else sfx.lose()
    engine.current?.setLevel(0.25)
    // The result counts the moment the line is crossed (closing during the coast can't lose
    // it); the podium waits while the player coasts on.
    onFinish(place, race.karts[me].done ?? race.t)
    podium.current = setTimeout(() => setEnd({ place, order }), 1400)
  }

  // The scene is memoised, so it gets callbacks that never change and call the latest ones.
  const latest = useRef({ onEvents, finish, tick: live?.tick })
  useLayoutEffect(() => { latest.current = { onEvents, finish, tick: live?.tick } })
  const sceneEvents = useCallback((es: KartEvent[]) => latest.current.onEvents(es), [])
  const sceneFinish = useCallback(() => latest.current.finish(), [])
  const sceneTick = useCallback(() => latest.current.tick?.(), [])
  // Drawn in the shared race canvas (scene/Stage.tsx): a canvas of its own meant a new WebGL
  // context and every shader compiled again on each race. The element is memoised so the
  // HUD's renders don't reach the scene.
  const isLive = !!live
  const scene = useMemo(
    () => <KartScene race={race} looks={looks} me={me} input={input} running={running} onHud={setHud} onEvents={sceneEvents} onFinish={sceneFinish} afterStep={isLive ? sceneTick : undefined} lite={touch} />,
    [race, looks, me, input, running, sceneEvents, sceneFinish, sceneTick, isLive, touch],
  )
  const stageReady = useStageReady()

  const item = hud?.item ? ITEMS[hud.item as ItemId] : null
  const dead = !!hud && hud.fx.emp > 0 // a static storm locks the item slot
  // A Nitro Triple shows how many cans are left.
  const slot = item ? <span className="kt-item"><Roulette key={hud!.item} icon={item.icon} />{hud!.item === 'nitro3' && <b className="kt-uses">×{hud!.uses}</b>}</span> : null
  return (
    <div className={`race-full kt${tall ? ' tall' : ' wide'}${touch ? ' touch' : ''}${dead ? ' dead' : ''}`}>
      <StageSlot cam={KART_CAM}>{scene}</StageSlot>
      <LoadingScene ready={stageReady} label={live?.loading ?? `Driving to ${track.name}`} onReady={() => setDrawn(true)} onClose={onExit} />
      {drawn && !ready && (live?.lobby ?? <div className="kt-wait">⏳ {live?.loading}</div>)}
      <div className="rf-top">
        <h2>{title}</h2>
        <button className="close" onClick={onExit} aria-label="Close">✕</button>
      </div>
      {hud && !end && ready && (
        <>
          <div className="kt-hud">
            <span className={`kt-place p${hud.place}`}><b>{hud.place}</b><small>{ORD(hud.place).slice(-2)}</small><i>/{field.length}</i></span>
            <span className="kt-lap">LAP <b>{hud.lap}</b>/{LAPS}</span>
            <span className="kt-time">{fmt(hud.t)}</span>
          </div>
          <MiniMap race={race} hud={hud} />
          {!touch && (
            <div className={`kt-slot${item ? ' full' : ''}${dead ? ' dead' : ''}`} aria-label={item ? item.name : 'No item'}>{slot}</div>
          )}
          {hud.charge > 0 && <div className={`kt-charge${hud.charge >= 1.7 ? ' orange' : hud.charge >= 0.75 ? ' blue' : ''}`}><i style={{ width: `${Math.min(100, (hud.charge / 1.7) * 100)}%` }} /></div>}
          {hud.wrong && <div className="kt-wrong">↩ WRONG WAY</div>}
          <Effects fx={hud.fx} />
        </>
      )}
      {flash && <div key={flash} className="kt-flash">{flash}</div>}
      {!end && running && (touch ? <TouchDrive input={input} tall={tall} item={slot} feel={sharp ? KART_SHARP : KART_FEEL} /> : <KeyHints />)}
      {end && <Podium race={race} field={field} me={me} end={end} prize={prize} next={next} verdict={live?.verdict} onExit={onExit} />}
    </div>
  )
}

// A fresh item spins through the reel for a moment before it lands.
const REEL = Object.values(ITEMS).map((i) => i.icon)
function Roulette({ icon }: { icon: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (n >= 8) return
    const id = setTimeout(() => setN(n + 1), 55 + n * 12)
    return () => clearTimeout(id)
  }, [n])
  return <span className={n >= 8 ? 'kt-got' : 'kt-reel'}>{n >= 8 ? icon : REEL[(n * 3) % REEL.length]}</span>
}

// What's on the player right now: a badge per effect with a ring that runs down,
// plus the smoke haze and the static crackle across the screen.
const FX: { key: keyof KartHud['fx']; icon: string; full: number; bad: boolean }[] = [
  { key: 'flat', icon: '📌', full: FLAT_TIME, bad: true },
  { key: 'smoke', icon: '💨', full: SMOKE_TIME, bad: true },
  { key: 'emp', icon: '⚡', full: EMP_TIME, bad: true },
  { key: 'tow', icon: '🧲', full: TOW_TIME, bad: false },
  { key: 'shield', icon: '🫧', full: 8, bad: false },
  { key: 'splat', icon: '🎨', full: SPLAT_TIME, bad: true },
  { key: 'ghost', icon: '👻', full: GHOST_TIME, bad: false },
  { key: 'rocket', icon: '🚀', full: ROCKET_TIME, bad: false },
]
function Effects({ fx }: { fx: KartHud['fx'] }) {
  const on = FX.filter((f) => fx[f.key] > 0)
  return (
    <>
      {fx.smoke > 0 && <div className="kt-haze" style={{ opacity: Math.min(1, fx.smoke / SMOKE_TIME + 0.35) }} />}
      {fx.emp > 0 && <div className="kt-zap" />}
      {fx.splat > 0 && <Splats fade={Math.min(1, fx.splat / SPLAT_TIME + 0.3)} />}
      {fx.ghost > 0 && <div className="kt-ghost" />}
      {on.length > 0 && (
        <div className="kt-fx">
          {on.map((f) => (
            <span key={f.key} className={f.bad ? 'bad' : 'good'} style={{ ['--left' as string]: `${Math.min(1, fx[f.key] / f.full) * 360}deg` }}>{f.icon}</span>
          ))}
        </div>
      )}
    </>
  )
}

// Paint across the screen: bumpy blobs with flung drops, mostly round the edges so the road
// ahead still shows through the middle.
function splatPath(r: number, seed: number) {
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const n = 16
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const k = r * (0.72 + rnd() * 0.32) * (i % 5 === 0 ? 1.35 : 1)
    return [50 + Math.cos(a) * k, 50 + Math.sin(a) * k]
  })
  let d = `M${((pts[0][0] + pts[n - 1][0]) / 2).toFixed(1)},${((pts[0][1] + pts[n - 1][1]) / 2).toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n]
    d += `Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)},${((p[1] + q[1]) / 2).toFixed(1)}`
  }
  const drops = Array.from({ length: 5 }, () => {
    const a = rnd() * Math.PI * 2, dd = r * (1.4 + rnd() * 0.5)
    return { x: 50 + Math.cos(a) * dd, y: 50 + Math.sin(a) * dd, r: r * (0.08 + rnd() * 0.12) }
  })
  return { d: d + 'Z', drops }
}
// Where each blob sits (share of the screen across and down), its size (share of the
// screen's short side) and colour. Each keeps its shape whatever the screen's proportions.
const SPLAT_BLOBS = ([[20, 32, 30, '#ff4081'], [78, 26, 34, '#00e5ff'], [58, 78, 24, '#ffea00'], [90, 68, 20, '#ff4081'], [8, 80, 22, '#00e5ff']] as const)
  .map(([x, y, size, c], i) => ({ x, y, size, c, ...splatPath(24, 11 + i * 7) }))
function Splats({ fade }: { fade: number }) {
  return (
    <div className="kt-splat" style={{ opacity: fade }} aria-hidden>
      {SPLAT_BLOBS.map((b, i) => (
        <svg key={i} viewBox="0 0 100 100" fill={b.c} style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.size}vmin`, height: `${b.size}vmin` }}>
          <path d={b.d} />
          {b.drops.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r={p.r} />)}
        </svg>
      ))}
    </div>
  )
}

// The circuit from above with a dot per kart; the player's is the big yellow one.
function MiniMap({ race, hud }: { race: KartRace; hud: KartHud }) {
  const t = race.track
  const box = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (let i = 0; i < t.n; i++) { x0 = Math.min(x0, t.x[i]); x1 = Math.max(x1, t.x[i]); z0 = Math.min(z0, t.z[i]); z1 = Math.max(z1, t.z[i]) }
    let d = ''
    for (let i = 0; i < t.n; i += 2) d += `${i ? 'L' : 'M'}${t.x[i].toFixed(1)},${t.z[i].toFixed(1)}`
    return { vb: `${x0 - 8} ${z0 - 8} ${x1 - x0 + 16} ${z1 - z0 + 16}`, d: d + 'Z' }
  }, [t])
  return (
    <svg className="kt-map" viewBox={box.vb} aria-hidden>
      <path d={box.d} className="kt-map-road" />
      <path d={box.d} className="kt-map-line" />
      <rect x={t.x[0] - 5} y={t.z[0] - 1.2} width="10" height="2.4" className="kt-map-start" transform={`rotate(${(-Math.atan2(t.tx[0], t.tz[0]) * 180) / Math.PI} ${t.x[0]} ${t.z[0]})`} />
      {hud.dots.map((d, i) => !d.me && <circle key={i} cx={d.x} cy={d.z} r="3.2" className="kt-map-dot" />)}
      {hud.dots.map((d, i) => d.me && <circle key={i} cx={d.x} cy={d.z} r="4.6" className="kt-map-me" />)}
    </svg>
  )
}

function Podium({ race, field, me, end, prize, next, verdict, onExit }: { race: KartRace; field: KartRacer[]; me: number; end: { place: number; order: number[] }; prize?: number; next?: KartNext | null; verdict?: ReactNode; onExit: () => void }) {
  // Finishers who came in after the podium went up still slot into the list.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [])
  const order = race.order().map((k) => k.id)
  const top = order.slice(0, 3)
  const won = end.place === 1
  const times = order.map((i) => race.karts[i].done)
  return (
    <div className={won ? 'rr win kt-end' : 'rr lose kt-end'}>
      <div className="kt-podium-card">
        {won && <SnapshotButton caption="🏆 1st place" />}
        <h2>{won ? '🏆 You win!' : `${ORD(end.place)} place`}</h2>
        <div className="kt-podium">
          {[1, 0, 2].map((p) => {
            const i = top[p]
            if (i === undefined) return null
            const f = field[i]
            const d = carDef(f.look.model ?? '')
            return (
              <div key={p} className={`kt-step s${p + 1}${i === me ? ' me' : ''}`}>
                <CarThumb size="sm" color={f.look.color} finish={f.look.finish} skin={f.look.skin} modSkin={f.look.modSkin} hat={f.look.hat} body={f.look.body as never} model={d.id} mods={f.look.mods} />
                <b>{i === me ? 'You' : f.name}</b>
                <span className="kt-block">{p + 1}</span>
              </div>
            )
          })}
        </div>
        <ol className="kt-results">
          {order.map((i, n) => (
            <li key={i} className={i === me ? 'me' : ''}>
              <span>{ORD(n + 1)}</span><b>{i === me ? 'You' : field[i].name}</b><small>{times[n] !== null ? fmt(times[n]!) : '—'}</small>
            </li>
          ))}
        </ol>
        {verdict}
        {prize !== undefined && <div className="arc-pay"><span>{won ? `🪙 +$${prize.toLocaleString()}` : `🪙 +$${Math.round(prize * 0.1).toLocaleString()}`}</span></div>}
        <div className="arc-actions">
          <button className="sell" onClick={onExit}>Back</button>
          {next && <button className="buy" onClick={next.go}>{next.label}</button>}
        </div>
      </div>
    </div>
  )
}

// The field for a race: the player's own car plus rivals in the cars nearest their PI.
export function kartRacer(name: string, piVal: number, look: ChaseCar, ai = true, skill?: number): KartRacer {
  return { name, pi: piVal, look, ai, skill }
}
export const playerRacer = (car: OwnedCar, name = 'You'): KartRacer => ({ name, pi: pi(car), look: lookOf(car), ai: false })
