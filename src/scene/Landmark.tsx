import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BoxGeometry, Color, ConeGeometry, ExtrudeGeometry, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Shape, Vector2, type BufferGeometry, type Group, type Mesh, type Texture } from 'three'
import { Box, Cyl, Pool, type Mat, type V3 } from './NewBuildings'
import { Bench, GlassBlock, Lamp, PadLights, Planter, glassMat } from './OfficeBuildings'
import { CarModel } from './CarModel'
import { Upright } from './mergeScale'
import { glowMats, onNight } from './dayNight'
import { concreteTex, helipadTex, paverTex } from './textures'
import { PAL } from './season'
import { useGame } from '../game/store'
import { sfx } from '../lib/sound'

// Vanguard Tower: the landmark four level 10 houses become when merged into a
// 2x2 block. A heroes' headquarters skyline piece (no emblems or lettering):
// a glass tower whose right side leans in as it climbs, a white arch sweeping up
// its face, a deck cantilevered out with a landing pad for the Skyhopper flying
// car, and a glass penthouse under a roof that curves up into a tall white fin.
// It fills a 2x2 lot (4x4 units round the origin) facing +z. Static pieces are
// plain meshes the town's Batch merges; the glass, LED strips and pad lights use
// the shared night materials so it lights up with the rest of the town.
// Whenever the player gains coins, a pulse of light runs up the tower and the
// Skyhopper takes off for a flight round it (see the bottom of this file).

const FRAME = '#f3f5f7'
const TINT = '#bfe9ff'
const Z = -0.35 // tower centre: the plaza takes the front of the lot
const D = 1.7 // tower depth
const BASE = 0.8 // top of the lobby podium
const DECK = 9.3 // underside line of the deck at the tower
const DECK_TOP = 9.85
const PEAK = 14.9 // top of the fin

const mat: Mat = (color: string, map?: Texture) => <meshStandardMaterial color={color} map={map ?? null} />
const bulb = <primitive object={glowMats.bulb} attach="material" dispose={null} />
const NO_RAY = () => null

// Cyan glows (the jets, the pulse's trim): hum by day, blaze at night.
let core: MeshStandardMaterial | null = null
function coreMat() {
  if (core) return core
  const c = new MeshStandardMaterial({ color: '#b3f5ff', emissive: new Color('#36d9ff'), emissiveIntensity: 0.5, toneMapped: false })
  c.userData.live = true
  onNight((n) => (c.emissiveIntensity = 0.5 + n * 2.2))
  core = c
  return c
}
const coreEl = () => <primitive object={coreMat()} attach="material" dispose={null} />

// ---- Shapes (front elevation, x across, y up), extruded front to back ----

// The tower's right edge below the deck: leans in from the podium to the deck.
const rightEdge = (y: number) => 1.05 - 0.6 * Math.pow(Math.min(1, Math.max(0, (y - BASE) / (DECK - BASE))), 1.4)
// The penthouse roof: from its right wall curving up to the fin.
const ROOF: [Vector2, Vector2, Vector2] = [new Vector2(0.85, 11.3), new Vector2(0.1, 13.2), new Vector2(-0.75, 13.9)]
const roofAt = (t: number) => {
  const [a, c, b] = ROOF
  const u = 1 - t
  return new Vector2(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y)
}

// Curtain-wall UVs: faces looking front or back get x/y, the sides run round
// with x+z, so every wall shows panes the same size as the town's other towers.
function paneUVs(g: BufferGeometry) {
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const across = Math.abs(nor.getZ(i)) > 0.5 ? x : Math.abs(nor.getY(i)) > 0.7 ? x : z + x
    uv.setXY(i, across / 0.72, y / 1.2)
  }
  return g
}

const extrude = (shape: Shape, depth: number, panes = false) => {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 })
  g.translate(0, 0, -depth / 2)
  g.computeVertexNormals()
  return panes ? paneUVs(g) : g
}

// A band of width w along a run of points (offset to the left of travel).
function band(pts: Vector2[], w: number) {
  const outer: Vector2[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const n = new Vector2(-(b.y - a.y), b.x - a.x).normalize()
    outer.push(pts[i].clone().addScaledVector(n, w))
  }
  return new Shape([...pts, ...outer.reverse()])
}
const quad = (a: Vector2, c: Vector2, b: Vector2, n = 20) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t
    return new Vector2(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y)
  })

const GEO = (() => {
  const edge = Array.from({ length: 13 }, (_, i) => new Vector2(rightEdge(BASE + ((DECK - BASE) * i) / 12), BASE + ((DECK - BASE) * i) / 12))
  const body = new Shape([new Vector2(-1.05, BASE), ...edge, new Vector2(-1.05, DECK)])
  const deck = new Shape()
  deck.moveTo(-1.1, DECK)
  deck.lineTo(rightEdge(DECK) + 0.02, DECK)
  deck.lineTo(rightEdge(8.6) + 0.02, 8.6)
  deck.quadraticCurveTo(1.3, 9.45, 2.1, 9.68)
  deck.lineTo(2.1, DECK_TOP)
  deck.lineTo(-1.1, DECK_TOP)
  deck.closePath()
  const roof = quad(ROOF[0], ROOF[1], ROOF[2])
  const pent = new Shape([new Vector2(-1.05, DECK_TOP), new Vector2(0.85, DECK_TOP), ...roof, new Vector2(-1.05, 13.9)])
  // The fin: a white band along the roof that rises into a peak over the left wall.
  const finLine = [...quad(new Vector2(1.08, 11.15), new Vector2(0.15, 13.25), new Vector2(-0.82, 14.05)), new Vector2(-1.0, PEAK - 0.2), new Vector2(-1.05, PEAK)]
  const fin = band(finLine, -0.22)
  // White cladding up the leaning right edge, and the arch sweeping up the face.
  const clad = band(edge.map((p) => p.clone()), -0.12)
  const archLine = quad(new Vector2(0.62, BASE), new Vector2(0.5, 7.4), new Vector2(-1.05, 8.95), 24)
  return {
    body: extrude(body, D, true),
    deck: extrude(deck, 1.9),
    pent: extrude(pent, D - 0.2, true),
    fin: extrude(fin, D - 0.1),
    clad: extrude(clad, 0.14),
    arch: extrude(band(archLine, 0.17), 0.08),
    archLed: extrude(band(archLine.map((p) => p.clone().add(new Vector2(0.17, 0))), 0.035), 0.09),
    finLed: extrude(band(finLine.slice(0, 21), 0.035), 0.02),
  }
})()

// How wide the tower is at a height (left and right x), for the pulse of light.
function spanAt(y: number): [number, number] {
  if (y < DECK) return [-1.05, rightEdge(y)]
  if (y < DECK_TOP) return [-1.1, 2.1]
  if (y < ROOF[0].y) return [-1.05, 0.85]
  // On the roof curve: find where it reaches this height.
  let t = 0
  for (let i = 0; i <= 20; i++) if (roofAt(i / 20).y <= y) t = i / 20
  return [-1.05, Math.max(-0.9, roofAt(t).x)]
}

export function VanguardTower() {
  const padX = 1.45
  const padY = DECK_TOP + 0.04
  useLaunches()
  return (
    <group>
      {/* Plaza paving and steps up to the lobby. */}
      <Box m={mat} at={[0, 0.025, 0]} s={[3.9, 0.05, 3.9]} c="#ffffff" t={paverTex(4, 4)} shadow={false} />
      {[0, 1, 2].map((k) => <Box key={k} m={mat} at={[0, 0.06 + k * 0.03, Z + 1.35 - k * 0.1]} s={[1.6 - k * 0.1, 0.03, 0.3]} c="#cfd8dc" t={concreteTex(1, 1)} shadow={false} />)}

      {/* Podium: a two-storey glass lobby with a dark frame and a lit canopy. */}
      <GlassBlock m={mat} x={0} z={Z} w={2.9} d={2.3} h={BASE} tint="#e0f7fa" frame="#263238" />
      <Box m={mat} at={[-0.2, 0.66, Z + 1.4]} s={[1.5, 0.06, 0.55]} c="#263238" />
      <mesh position={[-0.2, 0.625, Z + 1.66]}><boxGeometry args={[1.46, 0.02, 0.02]} />{bulb}</mesh>
      <mesh position={[-0.2, 0.3, Z + 1.156]}><planeGeometry args={[0.7, 0.56]} />{mat('#1c2a33')}</mesh>

      <group position={[0, 0, Z]}>
        {/* Glass shaft, white cladding up the leaning side, and the arch with its LED strip. */}
        <mesh geometry={GEO.body} castShadow receiveShadow><primitive object={glassMat(TINT)} attach="material" dispose={null} /></mesh>
        {[-1, 1].map((sz) => <mesh key={sz} geometry={GEO.clad} position-z={sz * (D / 2 - 0.05)} castShadow>{mat(FRAME)}</mesh>)}
        <group position-z={D / 2}>
          <mesh geometry={GEO.arch} castShadow>{mat(FRAME)}</mesh>
          <mesh geometry={GEO.archLed}>{bulb}</mesh>
        </group>
        {/* Corner posts up the straight side, front and back. */}
        {[-1, 1].map((sz) => <Box key={sz} m={mat} at={[-1.08, (BASE + PEAK - 0.3) / 2, sz * (D / 2 - 0.02)]} s={[0.1, PEAK - 0.3 - BASE, 0.1]} c={FRAME} />)}
        {/* The deck, cantilevered out to the landing pad, with lights along its lip. */}
        <mesh geometry={GEO.deck} castShadow receiveShadow>{mat(FRAME)}</mesh>
        <mesh position={[0.5, DECK_TOP - 0.06, 0.96]}><boxGeometry args={[3.2, 0.025, 0.02]} />{bulb}</mesh>
        {/* Penthouse glass, then the roof fin rising to the peak, lit along its edge. */}
        <mesh geometry={GEO.pent} castShadow><primitive object={glassMat(TINT)} attach="material" dispose={null} /></mesh>
        <mesh geometry={GEO.fin} castShadow>{mat(FRAME)}</mesh>
        <group position-z={(D - 0.1) / 2}><mesh geometry={GEO.finLed}>{bulb}</mesh></group>
        {/* Mast and warning light on the peak. */}
        <Cyl m={mat} at={[-1.0, PEAK + 0.45, 0]} r={0.02} r2={0.045} h={0.9} c="#cfd8dc" seg={8} />
        <mesh position={[-1.0, PEAK + 0.92, 0]}><sphereGeometry args={[0.05, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>
        {[-0.5, 0.5].map((z) => <mesh key={z} position={[-0.95, PEAK - 0.02, z]}><sphereGeometry args={[0.04, 8, 6]} />{bulb}</mesh>)}

        {/* Landing pad on the deck's end, where the Skyhopper rests. */}
        <group position={[padX, padY, 0]}>
          <Cyl m={mat} at={[0, -0.02, 0]} r={0.56} h={0.04} c="#455a64" seg={28} />
          <mesh position={[0, 0.0015, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.52, 28]} />
            {mat('#ffffff', helipadTex('#ffca28', '#6d7377'))}
          </mesh>
          <PadLights bulb={bulb} r={0.52} n={14} y={0.02} />
          <Skyhopper pad={[padX, padY, 0]} />
        </group>
        <Pulse />
      </group>

      {/* Plaza: fountain, planters, benches, lamps and a car at the kerb. */}
      <group position={[-1.2, 0, 1.4]}>
        <Cyl m={mat} at={[0, 0.1, 0]} r={0.46} h={0.12} c="#b0bec5" seg={20} />
        <mesh position={[0, 0.165, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.4, 20]} /><meshStandardMaterial color="#4fb3d9" metalness={0.6} roughness={0.08} /></mesh>
        <Cyl m={mat} at={[0, 0.3, 0]} r={0.05} r2={0.08} h={0.28} c="#cfd8dc" seg={10} />
        <mesh position={[0, 0.5, 0]}><sphereGeometry args={[0.09, 12, 8]} /><meshStandardMaterial color="#e1f5fe" transparent opacity={0.75} /></mesh>
      </group>
      <Pool r={0.8} x={-1.2} z={1.4} />
      {([[-1.7, -1.7], [1.7, -1.7], [-1.7, 0.45], [1.7, 0.45]] as [number, number][]).map(([x, z]) => <Planter key={`${x}${z}`} m={mat} at={[x, 0.05, z]} big />)}
      {!PAL.bare && ([[-0.5, 1.75], [0.5, 1.75]] as [number, number][]).map(([x, z]) => <Planter key={`f${x}`} m={mat} at={[x, 0.05, z]} />)}
      <Bench m={mat} at={[-1.2, 0.05, 0.95]} />
      <Bench m={mat} at={[-0.55, 0.05, 1.4]} ry={Math.PI / 2} />
      {([-1.75, 1.75] as number[]).map((x) => <Lamp key={x} m={mat} bulb={bulb} at={[x, 0.05, 1.75] as V3} />)}
      <Box m={mat} at={[1.2, 0.055, 1.25]} s={[1.0, 0.012, 1.3]} c="#78909c" shadow={false} />
      <group position={[1.2, 0.06, 1.3]}>
        <Upright>
          <group scale={0.85}>
            <CarModel body="super" color="#b71c1c" stripe="#ffc107" />
          </group>
        </Upright>
      </group>
    </group>
  )
}


// ---- Launches: coins in, light up, take off ----

// Every time the player's coins go up (a collect, Collect All, a bonus), each
// tower runs a pulse of light up its face and its Skyhopper takes off.
// One store subscription for every tower; each one notices the count change.
let launches = 0
let watching = false
function useLaunches() {
  useEffect(() => {
    if (watching) return
    watching = true
    return useGame.subscribe((s, prev) => {
      if (s.coins > prev.coins) launches++
    })
  }, [])
}

// The pulse: a glowing band that sweeps from the podium to the peak, hugging the tower's width.
const PULSE_S = 1.6
const pulseMat = new MeshBasicMaterial({ color: '#7ff0ff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
const pulseGeo = new BoxGeometry(1, 0.4, 1)
function Pulse() {
  const band = useRef<Mesh>(null)
  const run = useRef({ seen: launches, at: -99 })
  useFrame(({ clock }) => {
    const m = band.current
    if (!m) return
    const t = clock.elapsedTime
    const r = run.current
    if (r.seen !== launches) {
      r.seen = launches
      r.at = t
    }
    const u = (t - r.at) / PULSE_S
    m.visible = u >= 0 && u < 1
    if (!m.visible) return
    const y = BASE + (PEAK - BASE) * u
    const [l, rt] = spanAt(y)
    m.position.set((l + rt) / 2, y, 0)
    m.scale.set(rt - l + 0.12, 1, (y > DECK && y < DECK_TOP ? 1.9 : D) + 0.12)
    pulseMat.opacity = 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.1))
  })
  return <mesh ref={band} geometry={pulseGeo} material={pulseMat} visible={false} raycast={NO_RAY} userData={{ noBatch: true }} />
}

// ---- Skyhopper: the tower's flying car ----

// Rests on the pad. On a launch it jets up, climbs above the peak, spirals down
// the tower to near the ground, spirals back up, comes in over the pad, and
// sputters ("put... put": the jets cut, it drops, they catch) before it lands.
// Times in seconds from take-off. The car moves, so it stays out of Batch and ignores taps.
const HOP = 0.55
// (climb - lift) + (glide - up) must equal one lap's time, (down - climb) / 2.
export const T = { lift: 1.0, climb: 2.8, down: 8.8, up: 14.8, glide: 19.0, cut1: 19.4, catch1: 19.75, cut2: 20.5, catch2: 20.85, land: 22.4 }
const R = 2.75 // spiral radius round the tower's middle
const AXIS: [number, number] = [0, 0] // the tower's middle, in its own frame
const HIGH = PEAK + 1.0
const LOW = 1.9
const DIP = 0.28 // how far it drops each time the engine cuts
const ease = (u: number) => u * u * (3 - 2 * u)
const lin = (c: number, a: number, b: number) => Math.min(1, Math.max(0, (c - a) / (b - a)))
const span = (c: number, a: number, b: number) => ease(lin(c, a, b))
// Laps turn at a steady rate; the climb speeds up into it and the glide home slows out of it,
// so the heading never snaps. The glide's sweep is what's left to come round over the pad.
const W = (4 * Math.PI) / (T.down - T.climb)
const CLIMB_TURN = (W * (T.climb - T.lift)) / 2
const GLIDE_TURN = (W * (T.glide - T.up)) / 2
type Pose = { x: number; y: number; z: number; bank: number; thrust: number }

// One "put": the jets cut and it falls (gathering speed), then they catch and it
// sinks a touch more before rising back, with no jump in height or speed.
function dip(c: number, cut: number, back: number) {
  if (c < cut) return 0
  const fall = back - cut
  if (c < back) return DIP * ((c - cut) / fall) ** 2
  const rec = 0.55
  const s = (c - back) / rec
  if (s >= 1) return 0
  // Hermite from (DIP, still falling) to (0, at rest).
  const m0 = ((2 * DIP) / fall) * rec
  return DIP * (2 * s ** 3 - 3 * s * s + 1) + m0 * (s ** 3 - 2 * s * s + s)
}

// Where the car is `c` seconds into a flight, in the pad's frame (pad centre at the origin, height above the pad).
export function flight(c: number, pad: V3, out: Pose) {
  const [px, py, pz] = pad
  const r0 = Math.hypot(px - AXIS[0], pz - AXIS[1])
  const a0 = Math.atan2(pz - AXIS[1], px - AXIS[0])
  // Where each phase's turning starts. Climb + glide take one lap's time, so
  // their sweeps add to a full turn and the glide ends right over the pad.
  const aDown = a0 + CLIMB_TURN
  const aUp = aDown + 4 * Math.PI
  const aGlide = aUp + 4 * Math.PI
  let r = r0, a = a0, y = 0
  out.bank = 0
  out.thrust = 1
  if (c < T.lift) y = HOP * span(c, 0, T.lift)
  else if (c < T.climb) {
    const u = lin(c, T.lift, T.climb)
    r = r0 + (R - r0) * ease(u)
    a = a0 + CLIMB_TURN * u * u
    y = HOP + (HIGH - py - HOP) * ease(u)
    out.bank = 0.4 * u
  } else if (c < T.down) {
    // Two laps down, top to bottom.
    r = R
    a = aDown + W * (c - T.climb)
    y = HIGH - py - (HIGH - LOW) * span(c, T.climb, T.down)
    out.bank = 0.4
  } else if (c < T.up) {
    // Two laps back up, bottom to top.
    r = R
    a = aUp + W * (c - T.down)
    y = LOW - py + (py + 1.2 - LOW) * span(c, T.down, T.up)
    out.bank = 0.4
  } else if (c < T.glide) {
    // Slowing out of the lap and curling in over the pad.
    const u = lin(c, T.up, T.glide)
    a = aGlide + GLIDE_TURN * (2 * u - u * u)
    r = R + (r0 - R) * ease(u)
    y = 1.2 + (HOP * 1.4 - 1.2) * ease(u)
    out.bank = 0.4 * (1 - u) * (1 - u)
  } else if (c < T.land) {
    // The sputter: hovering, the jets cut out twice and the car dips, then catches.
    y = HOP * 1.4 - dip(c, T.cut1, T.catch1) - dip(c, T.cut2, T.catch2)
    if ((c >= T.cut1 && c < T.catch1) || (c >= T.cut2 && c < T.catch2)) out.thrust = 0
    else if ((c >= T.catch1 && c < T.catch1 + 0.25) || (c >= T.catch2 && c < T.catch2 + 0.25)) out.thrust = 1.6
    // Then settles softly onto the pad, jets winding down.
    const u = span(c, T.catch2 + 0.6, T.land)
    y *= 1 - u
    if (u > 0) out.thrust = 1 - u
  } else {
    y = 0
    out.thrust = 0
  }
  out.x = AXIS[0] + r * Math.cos(a) - px
  out.z = AXIS[1] + r * Math.sin(a) - pz
  out.y = y
  if (c >= T.glide || c < T.lift) out.x = out.z = 0
}

// Jet fire and the smoke it leaves: shared by every tower, one instanced draw for all the puffs.
const flameGeo = new ConeGeometry(0.06, 0.32, 8, 1, true).rotateX(Math.PI).translate(0, -0.16, 0)
const coreGeo = new ConeGeometry(0.035, 0.18, 8, 1, true).rotateX(Math.PI).translate(0, -0.09, 0)
const flameMat = new MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
const flameCore = new MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
const puffGeo = new IcosahedronGeometry(0.1, 0)
const puffMat = new MeshStandardMaterial({ color: '#eef0f2', transparent: true, opacity: 0.72, depthWrite: false, flatShading: true })
const PUFFS = 36
const PUFF_LIFE = 1.8
const JETS: [number, number][] = [[-0.2, 0.27], [0.2, 0.27], [-0.2, -0.27], [0.2, -0.27]]
const dummy = new Object3D()
// One sound per moment however many towers fly.
let heard = 0
const once = (t: number, f: () => void) => {
  if (Math.abs(t - heard) < 0.05) return
  heard = t
  f()
}

function Skyhopper({ pad }: { pad: V3 }) {
  const craft = useRef<Group>(null)
  const jets = useRef<Group>(null)
  const flames = useRef<(Mesh | null)[]>([])
  const smoke = useRef<InstancedMesh>(null)
  const puffs = useRef(Array.from({ length: PUFFS }, () => ({ x: 0, y: 0, z: 0, born: -99 })))
  const emit = useRef({ next: 0, i: 0 })
  const run = useRef({ seen: launches, at: -999, last: 999 })
  const at = useRef<Pose>({ x: 0, y: 0, z: 0, bank: 0, thrust: 0 })
  const next = useRef<Pose>({ x: 0, y: 0, z: 0, bank: 0, thrust: 0 })
  useLayoutEffect(() => {
    craft.current?.traverse((o: Object3D) => void (o.raycast = NO_RAY))
  }, [])
  useFrame(({ clock }) => {
    const g = craft.current
    if (!g) return
    const t = clock.elapsedTime
    const r = run.current
    // A new launch only takes off from the pad; mid-flight it's ignored.
    if (r.seen !== launches) {
      r.seen = launches
      if (t - r.at >= T.land) {
        r.at = t
        r.last = -1
      }
    }
    const c = t - r.at
    // Sounds as each moment passes: the jets lighting, and each "put".
    if (r.last < 0 && c >= 0) once(t, sfx.jet)
    for (const k of [T.catch1, T.catch2, T.cut1 + 0.02]) if (r.last < k && c >= k) once(t, sfx.putt)
    r.last = c
    flight(c, pad, at.current)
    flight(c + 0.05, pad, next.current)
    const p = at.current
    const q = next.current
    g.position.set(p.x, p.y, p.z)
    const vx = q.x - p.x
    const vz = q.z - p.z
    // Point along the way it's flying; hovering, it keeps its heading.
    if (vx * vx + vz * vz > 1e-6) g.rotation.set(0, Math.atan2(vx, vz), -p.bank, 'YXZ')
    const firing = p.thrust > 0.02
    if (jets.current) jets.current.visible = firing
    // Flickering jet flames, sized by thrust (a burst when the engine catches).
    flames.current.forEach((f, i) => {
      if (!f) return
      const k = 0.75 + 0.25 * Math.sin(t * 31 + i * 1.7) + 0.15 * Math.sin(t * 53 + i)
      f.scale.set(1, k * Math.max(0.3, p.thrust), 1)
    })
    // Smoke: a puff off the jets every few frames, drifting, swelling and fading out.
    const e = emit.current
    if (firing && p.y > 0.02 && t >= e.next) {
      e.next = t + (p.thrust > 1.2 ? 0.03 : 0.07)
      const pf = puffs.current[e.i]
      e.i = (e.i + 1) % PUFFS
      pf.x = p.x + (Math.random() - 0.5) * 0.12
      pf.y = p.y - 0.12
      pf.z = p.z + (Math.random() - 0.5) * 0.12
      pf.born = t
    }
    const sm = smoke.current
    if (!sm) return
    puffs.current.forEach((pf, i) => {
      const age = (t - pf.born) / PUFF_LIFE
      const live = age >= 0 && age < 1
      const sc = live ? (0.5 + age * 2.2) * Math.sin(Math.PI * Math.min(1, age * 1.15)) : 0
      dummy.position.set(pf.x, pf.y - age * 0.25 + age * age * 0.4, pf.z)
      dummy.rotation.set(i, age * 1.5, i * 0.7)
      dummy.scale.setScalar(Math.max(sc, 0.0001))
      dummy.updateMatrix()
      sm.setMatrixAt(i, dummy.matrix)
    })
    sm.instanceMatrix.needsUpdate = true
  })
  return (
    <group userData={{ noBatch: true }}>
      <instancedMesh ref={smoke} args={[puffGeo, puffMat, PUFFS]} frustumCulled={false} raycast={NO_RAY} />
      <group ref={craft}>
        <group scale={0.72}>
          <CarModel body="wedge" color="#eceff1" stripe="#00bcd4" />
        </group>
        {/* Hover jets: four cyan glows under the car, each blowing a cone of fire while it flies. */}
        <group ref={jets} visible={false}>
          {JETS.map(([x, z], i) => (
            <group key={i} position={[x, 0.03, z]}>
              <mesh rotation-x={Math.PI / 2}>
                <circleGeometry args={[0.07, 12]} />
                {coreEl()}
              </mesh>
              <mesh ref={(m) => void (flames.current[i] = m)} geometry={flameGeo} material={flameMat} raycast={NO_RAY} />
              <mesh geometry={coreGeo} material={flameCore} raycast={NO_RAY} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}
