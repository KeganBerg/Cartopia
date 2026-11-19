import { createContext, useContext, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Euler, Vector3 } from 'three'
import type { Group, Mesh } from 'three'
import { bake, bakedMaterial, type Finish } from './bake'
import { liveTraffic as sim } from './traffic/live'
import { onNight } from './dayNight'
import { Upright } from './mergeScale'
import { PEOPLE_SIZED } from './keepShape'

// Vehicles that belong to buildings rather than the player's garage: the
// helicopters at the heliport and on the hospital roof, and the hospital's
// ambulance out in town traffic. Each body is baked into one mesh (bake.ts)
// so a whole helicopter or ambulance is a couple of draws, and Batch leaves
// them alone (noBatch) because they move.

type V3 = [number, number, number]
type Part = [BufferGeometry, Finish, V3, V3?, V3?] // geometry, finish, position, rotation, scale

const NO_RAY = () => null
const LIVE = { noBatch: true }
// A craft that takes off is meant to be off the ground (see floating.ts).
const FLYING = { ...LIVE, air: true }
const at = (p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) =>
  new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(...r)), new Vector3(...s))
const bakeParts = (parts: Part[]) => bake(parts.map(([g, f, p, r, s]) => [g, f, at(p, r, s)]))

const mat = bakedMaterial()
// Beacons and light bars blink with the clock, so one material per colour does every vehicle.
const flash = {
  red: new MeshStandardMaterial({ color: '#b71c1c', emissive: new Color('#ff1744'), emissiveIntensity: 0, toneMapped: false }),
  white: new MeshStandardMaterial({ color: '#cfd8dc', emissive: new Color('#ffffff'), emissiveIntensity: 0, toneMapped: false }),
  blue: new MeshStandardMaterial({ color: '#0d47a1', emissive: new Color('#2979ff'), emissiveIntensity: 0, toneMapped: false }),
  beacon: new MeshStandardMaterial({ color: '#7f0000', emissive: new Color('#ff1744'), emissiveIntensity: 0, toneMapped: false }),
}
let flashedAt = -1
let night = 0
onNight((n) => (night = n))
function tickFlash(t: number) {
  if (t === flashedAt) return
  flashedAt = t
  const on = Math.floor(t * 6) % 2 === 0
  flash.red.emissiveIntensity = on ? 2.4 : 0.1
  flash.white.emissiveIntensity = on ? 0.1 : 2.4
  flash.blue.emissiveIntensity = on ? 0.1 : 2.4
  // Anti-collision beacon: a quick double blink every second and a half, brighter after dark.
  const b = t % 1.5
  flash.beacon.emissiveIntensity = b < 0.08 || (b > 0.22 && b < 0.3) ? 1.5 + night * 2 : 0
}

// ---- Helicopter ----

export type HeliLook = { body: string; stripe: string }
const heliGeo = new Map<string, BufferGeometry>()
function heliBody({ body, stripe }: HeliLook) {
  const k = `${body}|${stripe}`
  const hit = heliGeo.get(k)
  if (hit) return hit
  const paint: Finish = { color: body, metal: 0.35, rough: 0.35 }
  const band: Finish = { color: stripe, metal: 0.3, rough: 0.4 }
  const glass: Finish = { color: '#253746', metal: 0.8, rough: 0.12 }
  const dark: Finish = { color: '#263238', metal: 0.5, rough: 0.5 }
  const steel: Finish = { color: '#90a4ae', metal: 0.8, rough: 0.3 }
  const parts: Part[] = [
    // Cabin pod, its glazed nose and the engine cowling behind the mast.
    [new SphereGeometry(1, 18, 12), paint, [0, 0.42, 0.05], [0, 0, 0], [0.34, 0.3, 0.56]],
    [new SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), glass, [0, 0.47, 0.3], [-1.15, 0, 0], [0.3, 0.3, 0.3]],
    [new BoxGeometry(0.5, 0.06, 0.62), band, [0, 0.36, 0.02]],
    [new BoxGeometry(0.26, 0.15, 0.42), paint, [0, 0.72, -0.1]],
    [new BoxGeometry(0.2, 0.05, 0.12), dark, [0, 0.71, -0.33]],
    [new CylinderGeometry(0.035, 0.035, 0.14, 8), steel, [0, 0.84, 0]],
    // Side windows and the cabin door line.
    ...[-1, 1].map((sd): Part => [new BoxGeometry(0.01, 0.14, 0.22), glass, [sd * 0.325, 0.5, 0.02]]),
    // Tail boom, fin, tail-rotor guard and stabiliser.
    [new CylinderGeometry(0.045, 0.085, 0.9, 10), paint, [0, 0.52, -0.72], [Math.PI / 2 - 0.06, 0, 0]],
    [new BoxGeometry(0.03, 0.34, 0.2), paint, [0, 0.7, -1.18], [0.35, 0, 0]],
    [new BoxGeometry(0.035, 0.06, 0.2), band, [0, 0.64, -1.17], [0.35, 0, 0]],
    [new BoxGeometry(0.4, 0.02, 0.09), paint, [0, 0.52, -1.0]],
    ...[-1, 1].map((sd): Part => [new BoxGeometry(0.02, 0.07, 0.09), band, [sd * 0.2, 0.55, -1.0]]),
    // Skids on struts.
    ...[-1, 1].flatMap((sd): Part[] => [
      [new CylinderGeometry(0.018, 0.018, 0.78, 6), dark, [sd * 0.25, 0.04, 0.02], [Math.PI / 2, 0, 0]],
      [new CylinderGeometry(0.018, 0.018, 0.08, 6), dark, [sd * 0.25, 0.05, 0.42], [Math.PI / 2 + 0.9, 0, 0]],
      [new BoxGeometry(0.02, 0.2, 0.025), dark, [sd * 0.22, 0.14, 0.2], [0, 0, sd * 0.35]],
      [new BoxGeometry(0.02, 0.2, 0.025), dark, [sd * 0.22, 0.14, -0.18], [0, 0, sd * 0.35]],
    ]),
  ]
  const g = bakeParts(parts)
  heliGeo.set(k, g)
  return g
}
const bladeGeo = (() => {
  const blade: Finish = { color: '#37474f', metal: 0.4, rough: 0.5 }
  const tip: Finish = { color: '#fdd835', rough: 0.6 }
  return bakeParts([
    ...[0, Math.PI / 2].flatMap((r): Part[] => [
      [new BoxGeometry(2.0, 0.014, 0.075), blade, [0, 0, 0], [0, r, 0]],
      [new BoxGeometry(0.1, 0.016, 0.077), tip, [0.95 * Math.cos(r), 0, -0.95 * Math.sin(r)], [0, r, 0]],
      [new BoxGeometry(0.1, 0.016, 0.077), tip, [-0.95 * Math.cos(r), 0, 0.95 * Math.sin(r)], [0, r, 0]],
    ]),
    [new CylinderGeometry(0.06, 0.06, 0.05, 10), { color: '#90a4ae', metal: 0.8, rough: 0.3 }, [0, 0, 0]],
  ])
})()
const tailGeo = bakeParts([
  [new BoxGeometry(0.012, 0.32, 0.04), { color: '#37474f', rough: 0.5 }, [0, 0, 0]],
  [new BoxGeometry(0.012, 0.04, 0.32), { color: '#37474f', rough: 0.5 }, [0, 0, 0]],
])
// The same helicopter for the ones that fly over town (FlyByModels.tsx).
export const heliParts = { body: heliBody, blades: bladeGeo, tail: tailGeo, mat }

// How far the main rotor turns this frame (radians), at full speed times `rpm`. Its
// four blades look the same every quarter turn, so drawn at a real rotor's speed it
// strobed: at 30 frames a second it crept backwards and near 18 (a busy phone) it
// stood still. Turned at a pace the eye can follow, and never more than a fifth of a
// quarter turn in one frame, it always reads as turning forwards.
const ROTOR_SPEED = 10
export const ROTOR_MAX_STEP = (Math.PI / 2) * 0.2
export const rotorStep = (dt: number, rpm = 1) => Math.min(ROTOR_SPEED * Math.max(0, dt), ROTOR_MAX_STEP) * rpm
// The tail rotor (also four arms) turns a little faster, still well under the strobe.
export const TAIL_RATIO = 1.4
const discGeo = new CircleGeometry(1.02, 28)
const discMat = new MeshBasicMaterial({ color: '#263238', transparent: true, opacity: 0, depthWrite: false, side: DoubleSide })
const tailDiscGeo = new CircleGeometry(0.17, 14)
const beaconGeo = new SphereGeometry(0.035, 8, 6)

// Rest on the pad, spin up, lift off, fly a lap of the town, come back and land.
// Times in seconds within one cycle.
const CYCLE = 80
const SPIN_UP = [24, 29] as const
const LIFT = [29, 33] as const
const FLY = [33, 61] as const
const DOWN = [61, 66] as const
const SPIN_DOWN = [66, 72] as const
const HOVER = 1.1
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const span = (t: number, [a, b]: readonly [number, number]) => smooth((t - a) / (b - a))

// Shop previews ground every helicopter, so a model never flies out of its card.
export const Grounded = createContext(false)

// One helicopter, parked facing +x at the origin of its pad. `fly`: does laps of
// town (radius and height in world units); off, it sits with the rotor still
// (shop previews and spares in the hangar). `seed` staggers helicopters.
export function Helicopter({ look, fly: wantsFly, seed = 0, radius = 7, height = 5.5, ghost }: { look: HeliLook; fly?: boolean; seed?: number; radius?: number; height?: number; ghost?: boolean }) {
  const grounded = useContext(Grounded)
  const fly = wantsFly && !grounded
  const body = useMemo(() => heliBody(look), [look])
  const craft = useRef<Group>(null)
  const rotor = useRef<Mesh>(null)
  const tail = useRef<Mesh>(null)
  const spin = useRef({ rpm: 0, a: 0 })
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    tickFlash(t)
    const g = craft.current
    if (!g) return
    let rpm = 0
    if (fly) {
      const c = (t + seed * 37) % CYCLE
      rpm = span(c, SPIN_UP) * (1 - span(c, SPIN_DOWN))
      let x = 0, y = 0, z = 0, yaw = 0, pitch = 0, roll = 0
      if (c >= LIFT[0] && c < FLY[0]) y = HOVER * span(c, LIFT)
      else if (c >= FLY[0] && c < FLY[1]) {
        // A lap that leaves and comes back over the pad, climbing then sinking.
        const u = (c - FLY[0]) / (FLY[1] - FLY[0])
        const th = 2 * Math.PI * smooth(u)
        const speed = Math.sin(Math.PI * u)
        x = radius * Math.sin(th)
        z = -radius * (1 - Math.cos(th))
        y = HOVER + (height - HOVER) * Math.pow(Math.sin(Math.PI * u), 0.6)
        yaw = th
        pitch = 0.22 * speed
        roll = 0.28 * speed
      } else if (c >= DOWN[0] && c < DOWN[1]) y = HOVER * (1 - span(c, DOWN))
      // Hovering: a little bob and drift.
      if (y > 0.05) {
        y += Math.sin(t * 1.7) * 0.03
        x += Math.sin(t * 0.9) * 0.02
      }
      g.position.set(x, y, z)
      g.rotation.set(pitch, Math.PI / 2 + yaw, -roll, 'YXZ')
    }
    const s = spin.current
    s.rpm += (rpm - s.rpm) * Math.min(1, dt * 3)
    s.a += rotorStep(dt, s.rpm)
    if (rotor.current) rotor.current.rotation.y = s.a
    if (tail.current) tail.current.rotation.x = s.a * TAIL_RATIO
  })
  return (
    // A helicopter is helicopter-sized however big the block it lands on.
    <Upright size={1}>
      <group ref={craft} rotation-y={Math.PI / 2} userData={fly ? FLYING : LIVE}>
        <mesh geometry={body} material={mat} castShadow={!ghost} raycast={NO_RAY} />
        <mesh ref={rotor} geometry={bladeGeo} material={mat} position-y={0.92} castShadow={!ghost} raycast={NO_RAY} />
        {fly && <RotorBlur spin={spin} />}
        <mesh ref={tail} geometry={tailGeo} material={mat} position={[0.05, 0.72, -1.22]} raycast={NO_RAY} />
        <mesh geometry={beaconGeo} material={flash.beacon} position={[0, 0.88, -1.24]} raycast={NO_RAY} />
        <mesh geometry={beaconGeo} material={flash.beacon} position={[0, 0.2, 0]} raycast={NO_RAY} />
      </group>
    </Upright>
  )
}

// A see-through disc where the blades blur, fading in with rotor speed.
function RotorBlur({ spin }: { spin: { current: { rpm: number } } }) {
  const main = useRef<Mesh>(null)
  const tail = useRef<Mesh>(null)
  const mats = useMemo(() => [discMat.clone(), discMat.clone()], [])
  useFrame(() => {
    const o = Math.max(0, spin.current.rpm - 0.3) * 0.32
    mats[0].opacity = o
    mats[1].opacity = o
    if (main.current) main.current.visible = o > 0.01
    if (tail.current) tail.current.visible = o > 0.01
  })
  return (
    <>
      <mesh ref={main} geometry={discGeo} material={mats[0]} position-y={0.93} rotation-x={-Math.PI / 2} raycast={NO_RAY} visible={false} />
      <mesh ref={tail} geometry={tailDiscGeo} material={mats[1]} position={[0.06, 0.72, -1.22]} rotation-y={Math.PI / 2} raycast={NO_RAY} visible={false} />
    </>
  )
}

// ---- Ambulance ----

// Box van facing +z, about the size of the town's vans.
export const AMBULANCE = { len: 1.46, wid: 0.74 }
const ambulanceGeo = (() => {
  const white: Finish = { color: '#f5f5f5', metal: 0.2, rough: 0.4 }
  const red: Finish = { color: '#d32f2f', rough: 0.45 }
  const glass: Finish = { color: '#263845', metal: 0.7, rough: 0.12 }
  const dark: Finish = { color: '#212121', rough: 0.8 }
  const chrome: Finish = { color: '#cfd8dc', metal: 0.9, rough: 0.2 }
  const lamp: Finish = { color: '#fff8e1', emissive: new Color('#fff3c4').multiplyScalar(0.6) }
  const tail: Finish = { color: '#c62828', emissive: new Color('#ff1744').multiplyScalar(0.4) }
  const cross = (x: number, y: number, z: number, side: boolean): Part[] => [
    [new BoxGeometry(side ? 0.01 : 0.18, 0.06, side ? 0.18 : 0.01), red, [x, y, z]],
    [new BoxGeometry(side ? 0.01 : 0.06, 0.18, side ? 0.06 : 0.01), red, [x, y, z]],
  ]
  return bakeParts([
    // Box body at the back, cab and bonnet at the front.
    [new BoxGeometry(0.72, 0.58, 0.92), white, [0, 0.52, -0.25]],
    [new BoxGeometry(0.7, 0.4, 0.42), white, [0, 0.42, 0.41]],
    [new BoxGeometry(0.68, 0.18, 0.2), white, [0, 0.3, 0.66]],
    [new BoxGeometry(0.62, 0.2, 0.02), glass, [0, 0.5, 0.63], [-0.35, 0, 0]],
    ...[-1, 1].map((sd): Part => [new BoxGeometry(0.01, 0.16, 0.24), glass, [sd * 0.352, 0.52, 0.43]]),
    // Red band and crosses down the sides, a stripe across the back.
    ...[-1, 1].map((sd): Part => [new BoxGeometry(0.01, 0.08, 1.32), red, [sd * 0.364, 0.36, 0]]),
    ...[-1, 1].flatMap((sd) => cross(sd * 0.366, 0.6, -0.28, true)),
    ...cross(0, 0.62, -0.715, false),
    [new BoxGeometry(0.6, 0.012, 0.6), red, [0, 0.815, -0.25]],
    ...cross(0, 0.825, -0.25, false).map(([g, f, p]): Part => [g, { ...f, color: '#fafafa' }, p, [-Math.PI / 2, 0, 0]]),
    // Bumpers, grille, lamps.
    [new BoxGeometry(0.72, 0.08, 0.06), chrome, [0, 0.2, 0.77]],
    [new BoxGeometry(0.72, 0.08, 0.06), dark, [0, 0.2, -0.72]],
    [new BoxGeometry(0.36, 0.08, 0.01), dark, [0, 0.31, 0.765]],
    ...[-1, 1].map((sd): Part => [new BoxGeometry(0.12, 0.06, 0.01), lamp, [sd * 0.26, 0.32, 0.765]]),
    ...[-1, 1].map((sd): Part => [new BoxGeometry(0.06, 0.12, 0.01), tail, [sd * 0.3, 0.42, -0.716]]),
    // Rear doors' seam and handles.
    [new BoxGeometry(0.01, 0.5, 0.012), dark, [0, 0.52, -0.716]],
    // Wheels.
    ...[[-1, 0.48], [1, 0.48], [-1, -0.45], [1, -0.45]].map(([sd, z]): Part => [new CylinderGeometry(0.15, 0.15, 0.1, 12), dark, [sd * 0.33, 0.15, z], [0, 0, Math.PI / 2]]),
    ...[[-1, 0.48], [1, 0.48], [-1, -0.45], [1, -0.45]].map(([sd, z]): Part => [new CylinderGeometry(0.08, 0.08, 0.102, 10), chrome, [sd * 0.335, 0.15, z], [0, 0, Math.PI / 2]]),
  ])
})()
const lightGeo = new BoxGeometry(0.16, 0.06, 0.08)

const PARKED = { ...LIVE, ...PEOPLE_SIZED }
export function AmbulanceModel({ lit = true }: { lit?: boolean }) {
  return (
    <group userData={PARKED}>
      <mesh geometry={ambulanceGeo} material={mat} castShadow raycast={NO_RAY} />
      {/* Light bar on the cab roof, plus corner lights on the box. */}
      <mesh geometry={lightGeo} material={lit ? flash.red : flash.beacon} position={[-0.12, 0.65, 0.4]} raycast={NO_RAY} />
      <mesh geometry={lightGeo} material={lit ? flash.blue : flash.beacon} position={[0.12, 0.65, 0.4]} raycast={NO_RAY} />
      {[-0.3, 0.3].map((x) => <mesh key={x} geometry={beaconGeo} material={lit ? flash.white : flash.beacon} position={[x, 0.84, 0.2]} raycast={NO_RAY} />)}
      {[-0.3, 0.3].map((x) => <mesh key={x} geometry={beaconGeo} material={lit ? flash.red : flash.beacon} position={[x, 0.84, -0.7]} raycast={NO_RAY} />)}
    </group>
  )
}

// The hospital's ambulance in town traffic: a sim agent like the player's cars
// (TownCars adds it); lights flashing while it rushes a patient back to the hospital.
export function TownAmbulance({ uid, home, scale }: { uid: string; home: string; scale: number }) {
  const ref = useRef<Group>(null)
  const quiet = useRef<Group>(null)
  const loud = useRef<Group>(null)
  useFrame(({ clock }) => {
    tickFlash(clock.elapsedTime)
    const g = ref.current
    const a = sim.agents.get(uid)
    if (!g) return
    g.visible = !!a
    if (!a) return
    g.position.set(a.x, 0.02, a.z)
    g.rotation.y = a.yaw
    g.scale.setScalar(Math.max(0.001, a.show) * scale)
    const call = a.trip?.stop.uid === home && a.v > 0.05
    if (quiet.current) quiet.current.visible = !call
    if (loud.current) loud.current.visible = call
  })
  return (
    <group ref={ref} visible={false}>
      <group ref={quiet}><AmbulanceModel lit={false} /></group>
      <group ref={loud} visible={false}><AmbulanceModel /></group>
    </group>
  )
}
