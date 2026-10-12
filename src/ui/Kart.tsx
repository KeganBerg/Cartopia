import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import type { OwnedCar } from '../game/store'
import { carDef } from '../game/data'
import { EMP_TIME, FLAT_TIME, ITEMS, KartRace, LAPS, SMOKE_TIME, TOW_TIME, buildTrack, type ItemId, type KartEvent, type TrackDef } from '../game/kart'
import { KartScene, kartLights, type KartHud } from '../scene/KartScene'
import type { ChaseCar } from '../scene/ChaseScene'
import { CarThumb } from '../scene/BuildingPreview'
import { KeyHints, TouchDrive, newDriveInput, useDriveKeys, useTall, useTouchDevice } from './DriveControls'
import { LoadingScene } from './Loading'
import { look as lookOf, pi } from './ArcadeBits'
import { sfx, audioContext, audioOut } from '../lib/sound'
import { airSound, buzzSound, bumpSound, crashSound, dingSound, fuelSound, landSound } from '../lib/arcadeSound'
import { EngineVoice } from '../lib/engineAudio'
import './kart.css'

// The kart race screen: the 3D circuit, the HUD (place, lap, item, minimap), the
// shared driving controls, a five-light start and a podium at the end.

export type KartRacer = { name: string; pi: number; look: ChaseCar; ai: boolean; skill?: number }
export type KartNext = { label: string; go: () => void }

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
const ORD = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`

export function KartGame({ car, title, track, reverse, field, prize, next, onFinish, onExit }: {
  car: OwnedCar; title: string; track: TrackDef; reverse: boolean
  field: KartRacer[] // the player is the one with ai: false
  prize?: number
  next?: KartNext | null
  onFinish: (place: number) => void
  onExit: () => void
}) {
  const t = useMemo(() => buildTrack(track, reverse), [track, reverse])
  const me = field.findIndex((f) => !f.ai)
  const race = useMemo(() => new KartRace(t, field.map((f) => ({ name: f.name, pi: f.pi, ai: f.ai, skill: f.skill })), Math.floor(Math.random() * 1e6)), [t, field])
  const looks = useMemo(() => field.map((f) => f.look), [field])
  const input = useRef(newDriveInput()).current
  const touch = useTouchDevice()
  const tall = useTall()
  const [drawn, setDrawn] = useState(false)
  const [running, setRunning] = useState(false)
  const [hud, setHud] = useState<KartHud | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [end, setEnd] = useState<{ place: number; order: number[] } | null>(null)
  useDriveKeys(input, { enabled: running && !end })
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

  // Five lights, one every 0.6 s, then all out: GO.
  useEffect(() => {
    if (!drawn) return
    const timers: ReturnType<typeof setTimeout>[] = []
    kartLights.n = 0
    for (let i = 1; i <= 5; i++) timers.push(setTimeout(() => { kartLights.n = i; sfx.countdown(false) }, 600 + i * 600))
    timers.push(setTimeout(() => { kartLights.n = 0; sfx.countdown(true); setRunning(true); setFlash('GO!') }, 600 + 6 * 600 + Math.random() * 400))
    return () => { timers.forEach(clearTimeout); kartLights.n = 0 }
  }, [drawn])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 1100)
    return () => clearTimeout(id)
  }, [flash])

  const onEvents = (es: KartEvent[]) => {
    for (const e of es) {
      if (e.kart !== me) {
        if (e.kind === 'hit' && race.hornets.length === 0) bumpSound()
        continue
      }
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
      else if (e.kind === 'lap') { dingSound(1); setFlash(e.value === LAPS ? 'FINAL LAP!' : `LAP ${e.value}`) }
    }
  }
  const finish = () => {
    const order = race.order().map((k) => k.id)
    const place = order.indexOf(me) + 1
    if (place === 1) sfx.win()
    else sfx.lose()
    engine.current?.setLevel(0.25)
    // Let the player coast over the line before the podium comes up.
    setTimeout(() => {
      setEnd({ place, order })
      onFinish(place)
    }, 1400)
  }

  const item = hud?.item ? ITEMS[hud.item as ItemId] : null
  const dead = !!hud && hud.fx.emp > 0 // a static storm locks the item slot
  const slot = item ? <Roulette key={hud!.item} icon={item.icon} /> : null
  return (
    <div className={`race-full kt${tall ? ' tall' : ' wide'}${dead ? ' dead' : ''}`}>
      <Canvas className="rf-canvas" camera={{ fov: 60, near: 0.3, far: 420 }} dpr={[1, 1.5]} gl={{ toneMapping: NeutralToneMapping }}>
        <KartScene race={race} looks={looks} me={me} input={input} running={running && !end} onHud={setHud} onEvents={onEvents} onFinish={finish} />
      </Canvas>
      <LoadingScene label={`Driving to ${track.name}`} onReady={() => setDrawn(true)} onClose={onExit} />
      <div className="rf-top">
        <h2>{title}</h2>
        <button className="close" onClick={onExit} aria-label="Close">✕</button>
      </div>
      {hud && !end && (
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
      {!end && running && (touch ? <TouchDrive input={input} tall={tall} item={slot} /> : <KeyHints />)}
      {end && <Podium race={race} field={field} end={end} prize={prize} next={next} onExit={onExit} />}
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
]
function Effects({ fx }: { fx: KartHud['fx'] }) {
  const on = FX.filter((f) => fx[f.key] > 0)
  return (
    <>
      {fx.smoke > 0 && <div className="kt-haze" style={{ opacity: Math.min(1, fx.smoke / SMOKE_TIME + 0.35) }} />}
      {fx.emp > 0 && <div className="kt-zap" />}
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

function Podium({ race, field, end, prize, next, onExit }: { race: KartRace; field: KartRacer[]; end: { place: number; order: number[] }; prize?: number; next?: KartNext | null; onExit: () => void }) {
  const top = end.order.slice(0, 3)
  const won = end.place === 1
  const times = end.order.map((i) => race.karts[i].done)
  return (
    <div className={won ? 'rr win kt-end' : 'rr lose kt-end'}>
      <div className="kt-podium-card">
        <h2>{won ? '🏆 You win!' : `${ORD(end.place)} place`}</h2>
        <div className="kt-podium">
          {[1, 0, 2].map((p) => {
            const i = top[p]
            if (i === undefined) return null
            const f = field[i]
            const d = carDef(f.look.model ?? '')
            return (
              <div key={p} className={`kt-step s${p + 1}${f.ai ? '' : ' me'}`}>
                <CarThumb size="sm" color={f.look.color} finish={f.look.finish} skin={f.look.skin} modSkin={f.look.modSkin} body={f.look.body as never} model={d.id} mods={f.look.mods} />
                <b>{f.ai ? f.name : 'You'}</b>
                <span className="kt-block">{p + 1}</span>
              </div>
            )
          })}
        </div>
        <ol className="kt-results">
          {end.order.map((i, n) => (
            <li key={i} className={field[i].ai ? '' : 'me'}>
              <span>{ORD(n + 1)}</span><b>{field[i].ai ? field[i].name : 'You'}</b><small>{times[n] !== null ? fmt(times[n]!) : '—'}</small>
            </li>
          ))}
        </ol>
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
