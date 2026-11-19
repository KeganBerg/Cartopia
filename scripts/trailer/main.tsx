// Race shots for the launch trailer: real races on the race's own physics in the real race
// scene (every venue, World Tour countries included), filmed by trailer cameras.
// Dev only: `npm run dev`, then `node scripts/trailer/shoot.mjs` captures the frames.
// ?shot=launch|chase|drone|low|side|wide|pass|orbit|duel|track|flyover|gp&venue=<id>&night=1&sky=<kind>&cars=gtr,lambo&colors=%23eceff1,%23fdd835
// Any viewport works: in portrait the cameras widen so the cars still fit across the frame.
// The capture script drives the page's clock; window.__clip says how many frames to keep.
import { createRoot } from 'react-dom/client'
import { useRef, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { NeutralToneMapping, type PerspectiveCamera } from 'three'
import { RaceScene, startLights, type RacerView } from '../../src/scene/RaceScene'
import { SharedShapes } from '../../src/scene/sharedShapes'
import { venue as venueById } from '../../src/scene/venues'
import { raceWeather, type WeatherKind } from '../../src/game/weather'
import { carDef } from '../../src/game/data'
import { KartRace, TRACKS, buildTrack, gpField, idleInput } from '../../src/game/kart'
import { KartScene } from '../../src/scene/KartScene'
import { TRACK, RACE_DT, TOP_GEAR, AI_BOOST_GEAR, freshRacer, stepRacer, shiftBand, shiftQuality, shiftRacer, fireBoost, launchRacer, revLaunch, type Racer } from '../../src/game/race'

const q = new URLSearchParams(location.search)
const shot = q.get('shot') ?? 'launch'
const v = venueById(q.get('venue') ?? 'main')
const night = q.get('night') === '1'
const sky = (q.get('sky') ?? undefined) as WeatherKind | undefined
const DUR = Number(q.get('dur') ?? 4)
const SCALE = 0.25
const LANE = 0.75
const FPS = 30
const aspect = innerWidth / innerHeight
// The shots are framed for a square; portrait keeps that width by opening the lens up.
const lens = (fov: number) => (aspect >= 1 ? fov : (2 * Math.atan(Math.tan((fov * Math.PI) / 360) / aspect) * 180) / Math.PI)

const [m0, m1] = (q.get('cars') ?? 'gtr,lambo').split(',')
const [c0, c1] = (q.get('colors') ?? '#eceff1,#fdd835').split(',')
const car = (model: string, color: string) => ({ body: carDef(model).body, model, color, finish: 'metallic' as const })

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
// warm: seconds run but not drawn; start: the race's start on the shot's clock.
type Plan = { warm: number; start: number; lights?: boolean; solo?: boolean; cam?: (t: number, mz: number, tz: number) => Cam }
const A = run({ pi: 60, launch: 0, late: 0.01 })
const B = rivalFor(A, { pi: 60, launch: 0.15, late: 0.02 }, 0.12)
const mid = (mz: number, tz: number) => (Math.max(0, mz) + Math.max(0, tz)) / 2
// Where the cars are (world z) `s` seconds into the race.
const zAt = (s: number) => (at(A, s).dist * SCALE + at(B, s).dist * SCALE) / 2
const PLANS: Record<string, Plan> = {
  // Head on under the lights: red, red, amber, green on the beat, and both cars charge the camera.
  launch: {
    warm: 0.4, start: 3.2, lights: true,
    cam: (_t, mz, tz) => {
      const lead = Math.max(mz, tz, 0)
      const z = lead + Math.min(6.4, Math.max(4.2, 6.4 - Math.max(0, lead - 0.8) * 0.38))
      return { pos: [0.2, 1.05, z], at: [0, 0.6, z - 7], fov: 42 }
    },
  },
  // The run to the line from the race's own chase camera, slow motion and all.
  chase: { warm: A.finish - 3.4, start: -(A.finish - 3.4) },
  // From high on the roadside, riding along above the pair off the line.
  drone: {
    warm: 0.4, start: 0.6,
    cam: (t, mz, tz) => {
      const c = mid(mz, tz)
      return { pos: [1.6, 2.6 - t * 0.15, c + 2.6 - t * 0.25], at: [0, 0.25, c - 0.3], fov: 50 }
    },
  },
  // A lone car flat out, reeling in a low camera riding ahead of it.
  low: {
    warm: 0.4, start: -2.4, solo: true,
    cam: (t, mz) => {
      const z0 = at(A, 2.4).dist * SCALE
      const z = z0 + 10 + (mz - z0) * 0.9
      return { pos: [1.05, 0.65, z], at: [LANE * 0.85, 0.32, mz + 0.4], fov: 34 }
    },
  },
  // Tracking alongside at speed from three-quarters front, the venue's far side and what's ahead behind them.
  side: {
    warm: 0.4, start: -2.6,
    cam: (t, mz, tz) => {
      const c = mid(mz, tz)
      return { pos: [2.5, 1.1 + t * 0.05, c + 2.4 - t * 0.3], at: [-0.9, 0.9, c - 1.5], fov: 48 }
    },
  },
  // High behind the pair, looking far down the strip at the landmarks they're heading for.
  wide: {
    warm: 0.4, start: -1.6,
    cam: (t, mz, tz) => {
      const c = mid(mz, tz)
      return { pos: [0.9, 2.4 + t * 0.25, c - 5.5], at: [0, 1.6, c + 30], fov: 55 }
    },
  },
  // Low on the road just ahead of the pair, both cars charging the lens at full chat.
  duel: {
    warm: 0.4, start: -0.3,
    cam: (t, mz, tz) => {
      const lead = Math.max(mz, tz, 0)
      return { pos: [0.15, 0.42, lead + 3.4], at: [0, 0.38, lead - 0.4], fov: 52 }
    },
  },
  // Riding low beside the pair inside the kerb, the roadside streaking past behind them.
  track: {
    warm: 0.4, start: -2.2,
    cam: (t, mz, tz) => {
      const c = mid(mz, tz)
      return { pos: [1.55, 0.36, c + 2.4 - t * 0.4], at: [-0.3, 0.42, c - 0.4], fov: 46 }
    },
  },
  // Straight down from above, turning slowly as the pair tears up the strip.
  flyover: {
    warm: 0.4, start: -1.8,
    cam: (t, mz, tz) => {
      const c = mid(mz, tz)
      const a = 0.3 + t * 0.25
      return { pos: [Math.sin(a) * 1.2, 7.5 - t * 0.8, c + 0.4 + Math.cos(a) * 1.2], at: [0, 0, c + 0.5], fov: 50 }
    },
  },
  // Parked on the start line, the camera circling the car on the road side from
  // three-quarter views front (a ≈ -0.9) or back (a ≈ 3.7), so it never swings into the crowd.
  orbit: {
    warm: 0.4, start: 99, solo: true,
    cam: (t, mz) => {
      const a = Number(q.get('a') ?? -0.9) + t * 0.45
      // An oval: wide along the road, narrow across it, so the far kerb stays out of the way too.
      return { pos: [LANE + Math.sin(a) * 2.6, 1.25, mz + Math.cos(a) * 6.5], at: [LANE, 0.55, mz], fov: 34 }
    },
  },
  // Low on the kerb as they blast past, the camera panning after them.
  pass: {
    warm: 0.4, start: -1.2,
    cam: (_t, mz, tz) => {
      const z = zAt(1.2 + 2.0) + 1.5
      const c = mid(mz, tz)
      return { pos: [1.7, 0.32, z], at: [0, 0.45, Math.min(c, z + 30)], fov: 46 }
    },
  },
}

const GP_WARM = 3.2
const gp = shot === 'gp'
const plan: Plan = gp ? { warm: GP_WARM, start: 0 } : PLANS[shot]
const total = Math.round((plan.warm + DUR) * FPS)
;(window as never as { __clip: unknown }).__clip = { frames: total, keepFrom: Math.round(plan.warm * FPS), fps: FPS }

const KART_CARS = ['stallion', 'rally', 'buggy', 'bandit', 'vette', 'hotshot']
const KART_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#212121', '#43a047', '#ff7043']
function KartClip() {
  const field = gpField(['Nitro Nina', 'Torque Tony', 'Drift Dee', 'Boost Bo', 'Redline Rae', 'King Kurt'], 2, 46, { name: 'You', pi: 48 })
  const race = useRef(new KartRace(buildTrack(TRACKS[0], false), field, Number(q.get('seed') ?? 4242))).current
  const looks = useRef(field.map((_, i) => car(KART_CARS[i], KART_COLORS[i]))).current
  const input = useRef({ ...idleInput(), gas: 1 }).current
  const me = field.findIndex((f) => !f.ai)
  useFrame(({ camera }) => {
    const cam = camera as PerspectiveCamera
    const f = lens(60)
    if (cam.fov !== f) { cam.fov = f; cam.updateProjectionMatrix() }
  })
  return <KartScene race={race} looks={looks} me={me} input={input} running onHud={() => {}} onFinish={() => {}} />
}

function Driven() {
  const rt0 = -plan.warm - plan.start
  const me = useRef<RacerView>(at(A, rt0)) as RefObject<RacerView>
  const them = useRef<RacerView>(plan.solo ? { dist: -900 } : at(B, rt0)) as RefObject<RacerView>
  const clock = useRef(-plan.warm)
  useFrame(({ camera }) => {
    clock.current += 1 / FPS
    const t = clock.current
    const rt = t - plan.start
    if (plan.lights) startLights.n = rt < -1.2 ? 99 : rt < -0.8 ? 3 : rt < -0.4 ? 2 : rt < 0 ? 1 : 0
    else startLights.n = 0
    Object.assign(me.current, at(A, rt))
    if (!plan.solo) Object.assign(them.current, at(B, rt))
    const cam = camera as PerspectiveCamera
    if (plan.cam) {
      const c = plan.cam(Math.max(0, t), me.current.dist * SCALE, plan.solo ? -999 : them.current.dist * SCALE)
      const f = lens(c.fov)
      if (cam.fov !== f) { cam.fov = f; cam.updateProjectionMatrix() }
      cam.position.set(...c.pos)
      cam.lookAt(...c.at)
    } else if (aspect < 1) {
      cam.fov = lens(cam.fov)
      cam.updateProjectionMatrix()
    }
  })
  const base = v.base
  const weather = sky ? raceWeather(v.id, 'trailer', sky) : { ...raceWeather(v.id, 'trailer'), kind: 'clear', rain: 0, snow: base === 'snow' ? 0.25 : 0, cloud: 0.1, haze: 0, dust: 0, wet: 0, cover: base === 'snow' ? 0.4 : 0 } as never
  return (
    <>
      <RaceScene track={TRACK} me={me} them={them} mine={car(m0, c0)} theirs={car(m1 ?? m0, c1 ?? c0)} venue={v} weather={weather} night={night} />
      {plan.lights && <FrontLights />}
    </>
  )
}

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
    <SharedShapes />
    {gp ? <KartClip /> : <Driven />}
  </Canvas>,
)
