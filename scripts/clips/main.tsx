// Renders the looping race clips that play on the Race menu's tiles (src/assets/race-clips/).
// Every clip is a real race: both cars run on the race's own physics (stepRacer, shifts,
// launch and boost from src/game/race.ts) in the real race scene, filmed by a shot camera
// or the race's own chase camera.
// Dev only: `npm run dev`, then `node scripts/clips/shoot.mjs` captures and encodes them.
// A clip is picked by URL: ?shot=camp|tour|trial&venue=<id>&night=1, ?shot=gp&autopilot for the
// Grand Prix (a kart race on Main Street, every kart on the race's own AI), or ?shot=ev&event=<id> for
// a weekly event at its own venue, time of day and forced sky. &sky=<kind> races under that sky.
// The capture script drives the page's clock; window.__clip says how many frames to keep.
import { createRoot } from 'react-dom/client'
import { useRef, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { NeutralToneMapping, type PerspectiveCamera } from 'three'
import { RaceScene, startLights, type RacerView } from '../../src/scene/RaceScene'
import { venue as venueById } from '../../src/scene/venues'
import { raceWeather, type WeatherKind } from '../../src/game/weather'
import { carDef } from '../../src/game/data'
import { WEEKLY_EVENTS } from '../../src/game/events'
import { KartRace, TRACKS, buildTrack, gpField, idleInput } from '../../src/game/kart'
import { KartScene } from '../../src/scene/KartScene'
import { TRACK, RACE_DT, TOP_GEAR, AI_BOOST_GEAR, freshRacer, stepRacer, shiftBand, shiftQuality, shiftRacer, fireBoost, launchRacer, revLaunch, type Racer } from '../../src/game/race'

const q = new URLSearchParams(location.search)
const ev = q.get('shot') === 'ev' ? WEEKLY_EVENTS.find((e) => e.id === q.get('event')) : undefined
const shot = ev ? 'ev' : q.get('shot') ?? 'camp'
const v = venueById(ev?.venue ?? q.get('venue') ?? 'main')
const night = ev ? ev.night : q.get('night') === '1'
const sky = (ev?.sky ?? q.get('sky') ?? undefined) as WeatherKind | undefined
const SCALE = 0.25
const LANE = 0.75
const FPS = 30

type Car = { model: string; color: string; finish?: 'gloss' | 'metallic' | 'pearl' | 'matte' | 'chrome' }
const car = (c: Car) => ({ body: carDef(c.model).body, model: c.model, color: c.color, finish: c.finish })
// The player's car (right lane) and the rival (left lane), as on the tiles' stills.
const CARS: Record<string, [Car, Car]> = {
  camp: [{ model: 'vette', color: '#e53935', finish: 'metallic' }, { model: 'charger', color: '#263238' }],
  tour: [{ model: 'gtr', color: '#eceff1', finish: 'pearl' }, { model: 'lambo', color: '#fdd835', finish: 'metallic' }],
  trial: [{ model: 'rally', color: '#1e88e5', finish: 'metallic' }, { model: 'rally', color: '#1e88e5' }],
  // Weekly events get their own pair and shot, so the event card never plays the Pro Tour clip.
  ev: [{ model: 'hellcat', color: '#7e57c2', finish: 'pearl' }, { model: 'kitsune', color: '#ff7043', finish: 'metallic' }],
}

// One race, run ahead of time at the race screen's own fixed step. Each driver launches,
// shifts near the top of the perfect band and fires the boost the way the AI rivals do.
type Driver = { pi: number; launch: number; late: number }
type Trace = { d: Float32Array; burn: Uint8Array; finish: number }
function run(dr: Driver): Trace {
  const r: Racer = freshRacer(false)
  const n = Math.ceil(20 / RACE_DT)
  const d = new Float32Array(n)
  const burn = new Uint8Array(n)
  let t = 0
  for (let i = 0; i < n; i++) {
    t += RACE_DT
    if (!r.launched && t >= dr.launch) {
      if (dr.launch <= 0.05) revLaunch(r, 0.66)
      else launchRacer(r, dr.launch)
    }
    if (r.launched && r.gear < TOP_GEAR) {
      const band = shiftBand(r.gear)
      if (r.rpm >= band.hi - dr.late) shiftRacer(r, shiftQuality(r.rpm, band.lo, band.hi).q)
    }
    if (r.gear >= AI_BOOST_GEAR) fireBoost(r)
    stepRacer(r, dr.pi, RACE_DT, t)
    d[i] = r.dist
    burn[i] = r.burning ? 1 : 0
  }
  return { d, burn, finish: r.finished ?? Infinity }
}
const at = (tr: Trace, t: number) => {
  if (t <= 0) return { dist: 0, burning: false }
  const i = Math.min(tr.d.length - 1, Math.floor(t / RACE_DT))
  return { dist: tr.d[i], burning: !!tr.burn[i] }
}
// The rival's PI that has it cross the line `gap` seconds behind the leader.
function rivalFor(lead: Trace, base: Driver, gap: number) {
  let lo = 1
  let hi = base.pi * 2
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2
    if (run({ ...base, pi: mid }).finish > lead.finish + gap) lo = mid
    else hi = mid
  }
  return run({ ...base, pi: lo })
}

type Cam = { pos: [number, number, number]; at: [number, number, number]; fov: number }
// Each clip: its length (5 s loops; shoot.mjs folds the extra half second into a crossfade
// back to the start so the loop has no seam), when the race starts on the clip's clock
// (seconds), and the camera for clip time t given where each car is (world z). No camera: the race's own chase view.
type Plan = { dur: number; warm: number; start: number; lights?: boolean; cam?: (t: number, mz: number, tz: number) => Cam }
const A = run({ pi: 60, launch: 0, late: 0.01 })
const PLANS: Record<string, () => { plan: Plan; me: Trace; them: Trace | null }> = {
  // Staged under the lights: red, red, amber, green, and both cars charge the camera.
  camp: () => ({
    me: A,
    them: rivalFor(A, { pi: 60, launch: 0.2, late: 0.03 }, 0.25),
    plan: {
      dur: 5.5, warm: 0.4, start: 1.5, lights: true,
      cam: (_t, mz, tz) => {
        // Backs away down the road slower than the cars come, so they grow as they charge, then
        // keeps pace a few metres ahead of them.
        const lead = Math.max(mz, tz, 0)
        const z = lead + Math.min(6.4, Math.max(4.2, 6.4 - Math.max(0, lead - 0.8) * 0.38))
        return { pos: [0.2, 1.05, z], at: [0, 0.6, z - 7], fov: 42 }
      },
    },
  }),
  // The run to the line from the race's own chase camera, slow motion and all.
  tour: () => {
    const them = rivalFor(A, { pi: 60, launch: 0.15, late: 0.02 }, 0.14)
    // The race runs from the start in the warm-up (not drawn), so the scene's own camera and
    // finish replay see the whole race.
    return { me: A, them, plan: { dur: 5.5, warm: A.finish - 3.2, start: -(A.finish - 3.2) } }
  },
  // The launch seen from high on the roadside: both cars leave the line side by side and a
  // drone shot rides along above them (the Pro Tour clip is the chase-cam run to the line).
  ev: () => ({
    me: A,
    them: rivalFor(A, { pi: 60, launch: 0.12, late: 0.02 }, 0.1),
    plan: {
      dur: 5.5, warm: 0.4, start: 0.8,
      cam: (t, mz, tz) => {
        const c = (Math.max(0, mz) + Math.max(0, tz)) / 2
        return { pos: [1.25, 2.1, c + 2.4 - t * 0.2], at: [0, 0.25, c - 0.3], fov: 50 }
      },
    },
  }),
  // A lone car flat out, reeling in a low camera riding ahead of it.
  trial: () => ({
    me: A, them: null,
    plan: {
      dur: 5.5, warm: 0.4, start: -2.4,
      cam: (t, mz) => {
        const z0 = at(A, 2.4).dist * SCALE
        // Rides ahead a little slower than the car, which closes in to fill the frame by the end.
        const z = z0 + 10 + (mz - z0) * 0.9
        return { pos: [1.05, 0.65, z], at: [LANE * 0.85, 0.32, mz + 0.4], fov: 34 }
      },
    },
  }),
}
// The Grand Prix: a six-kart race on Main Street seen from the player's own chase camera,
// joining the pack a few seconds after the start as it piles into the first bends.
const GP_WARM = 3.2
const gp = shot === 'gp'
const { plan, me: meTrace, them: themTrace } = gp ? { plan: { dur: 5.5, warm: GP_WARM, start: 0 } as Plan, me: A, them: null } : PLANS[shot]()
const total = Math.round((plan.warm + plan.dur) * FPS)
;(window as never as { __clip: unknown }).__clip = { frames: total, keepFrom: Math.round(plan.warm * FPS), fps: FPS }

const KART_CARS = ['stallion', 'rally', 'buggy', 'bandit', 'vette', 'hotshot']
const KART_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#212121', '#43a047', '#ff7043']
function KartClip() {
  const field = gpField(['Nitro Nina', 'Torque Tony', 'Drift Dee', 'Boost Bo', 'Redline Rae', 'King Kurt'], 2, 46, { name: 'You', pi: 48 })
  const race = useRef(new KartRace(buildTrack(TRACKS[0], false), field, Number(q.get('seed') ?? 4242))).current
  const looks = useRef(field.map((_, i) => car({ model: KART_CARS[i], color: KART_COLORS[i], finish: 'metallic' }))).current
  const input = useRef({ ...idleInput(), gas: 1 }).current
  const me = field.findIndex((f) => !f.ai)
  return <KartScene race={race} looks={looks} me={me} input={input} running onHud={() => {}} onFinish={() => {}} />
}

function Driven() {
  // Already where the race has them on the first frame, so the scene doesn't see them jump there.
  const rt0 = -plan.warm - plan.start
  const me = useRef<RacerView>(at(meTrace, rt0)) as RefObject<RacerView>
  const them = useRef<RacerView>(themTrace ? at(themTrace, rt0) : { dist: -900 }) as RefObject<RacerView>
  const clock = useRef(-plan.warm)
  // The capture script steps the page one frame at a time, so the clip runs on frames, not wall time.
  useFrame(({ camera }) => {
    clock.current += 1 / FPS
    const t = clock.current
    const rt = t - plan.start
    if (plan.lights) startLights.n = t < 0.6 ? 99 : t < 0.9 ? 3 : t < 1.2 ? 2 : rt < 0 ? 1 : 0
    else startLights.n = 0
    Object.assign(me.current, at(meTrace, rt))
    if (themTrace) Object.assign(them.current, at(themTrace, rt))
    if (plan.cam) {
      const c = plan.cam(Math.max(0, t), me.current.dist * SCALE, themTrace ? them.current.dist * SCALE : -999)
      const cam = camera as PerspectiveCamera
      if (cam.fov !== c.fov) { cam.fov = c.fov; cam.updateProjectionMatrix() }
      cam.position.set(...c.pos)
      cam.lookAt(...c.at)
    }
  })
  const pair = CARS[shot]
  // Under the sky asked for (events have their own), else a clear day.
  const weather = sky ? raceWeather(v.id, 'clip', sky) : { ...raceWeather(v.id, 'clip'), kind: 'clear', rain: 0, snow: v.id === 'snow' ? 0.25 : 0, cloud: 0.1, haze: 0, dust: 0, wet: 0, cover: v.id === 'snow' ? 0.4 : 0 } as never
  return (
    <>
      <RaceScene track={TRACK} me={me} them={them} mine={car(pair[0])} theirs={car(pair[1])} venue={v} weather={weather} night={night} />
      {plan.lights && <FrontLights />}
    </>
  )
}

// The start lights only face the drivers; the head-on shot gets a matching set on the front.
function FrontLights() {
  const mats = useRef<({ color: { set: (c: string) => void } } | null)[]>([])
  useFrame(() => {
    const n = startLights.n
    mats.current.forEach((m, i) => m?.color.set(n === 0 ? '#00e676' : n <= 3 && i < 4 - n ? ['#ff1744', '#ff1744', '#ffab00'][i] : '#3a1010'))
  })
  return (
    <group position={[0, 2.5, -0.77]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[(i - 1) * 0.38, 0, 0]}>
          <circleGeometry args={[0.13, 18]} />
          <meshBasicMaterial ref={(m) => void (mats.current[i] = m)} color="#3a1010" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

createRoot(document.getElementById('root')!).render(
  <Canvas camera={gp ? { position: [0, 4, -8], fov: 60, near: 0.3, far: 420 } : { position: [LANE * 0.5, 2.2, -4.2], fov: 55, near: 0.1, far: 150 }} dpr={1} gl={{ toneMapping: NeutralToneMapping, preserveDrawingBuffer: true }}>
    {gp ? <KartClip /> : <Driven />}
  </Canvas>,
)
