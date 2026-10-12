import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BoxGeometry, Color, ConeGeometry, ExtrudeGeometry, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Shape, Vector2, type BufferGeometry, type Group, type Mesh, type Texture } from 'three'
import { Box, Cyl, Pool, type Mat, type V3 } from './NewBuildings'
import { Bench, GlassBlock, Lamp, PadLights, Planter, glassMat } from './OfficeBuildings'
import { CarModel } from './CarModel'
import { Upright } from './mergeScale'
import { glowMats, onNight } from './dayNight'
import { concreteTex, curtainGlowTex, curtainTex, helipadTex, paverTex } from './textures'
import { RAINBOW } from './clubLeds'
import { clubPulse } from '../lib/clubBeat'
import { dayPhase, isNight, nightAmount } from '../game/clock'
import { PAL } from './season'
import { useGame } from '../game/store'
import { sfx } from '../lib/sound'

// Vanguard Tower: the landmark four level 10 houses become when merged into a
// 2x2 block. A heroes' headquarters skyline piece (no emblems or lettering):
// a tapering shaft of dark curtain glass whose right side leans in as it climbs,
// a lit seam running up its face that peels off into a long curved strut holding
// up a cantilevered deck with a landing pad for the Skyhopper flying car, a
// three-floor glass penthouse that juts out over the deck with a balcony, and a
// crown that sweeps up from a blade-like hook into a tall spire.
// It fills a 2x2 lot (4x4 units round the origin) facing +z. Static pieces are
// plain meshes the town's Batch merges; the glass, LED strips and pad lights use
// the shared night materials so it lights up with the rest of the town.
// Whenever the player gains coins, a pulse of light runs up the tower and the
// Skyhopper takes off for a flight round it (see the bottom of this file).

const FRAME = '#f3f5f7'
const STEEL = '#b0bec5'
const TINT = '#bfe9ff' // penthouse glass
const DARK = '#6e93ad' // the shaft's darker, reflective curtain glass
const Z = -0.35 // tower centre: the plaza takes the front of the lot
const D = 1.7 // tower depth
const LEFT = -1.0 // the tower's straight left wall
const BASE = 1.3 // top of the ribbed podium
const DECK = 9.3 // underside line of the deck at the tower
const DECK_TOP = 9.85
const CROWN = 12.55 // where the penthouse ends and the crown begins
const TIP: [number, number] = [1.45, 12.5] // the hook's blade tip
const PEAK = 15.35 // top of the spire
const DECK_END = 2.45
// The penthouse suite's three floors, deck to crown.
const SUITE: [number, number][] = [[DECK_TOP, 10.75], [10.75, 11.65], [11.65, CROWN]]
const BALCONY = 11.65

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

// The penthouse suite dances with the nightclub at night: each floor's lit
// panes take a colour of the club's rainbow, a step apart, moving on and
// flashing with every bass note (clubBeat.ts; a soft beat when the music's off).
// Glass by day like the rest of the tower.
const suiteMats = SUITE.map(() => {
  const m = new MeshStandardMaterial({ color: TINT, map: curtainTex(), emissiveMap: curtainGlowTex(), emissive: new Color('#000000'), emissiveIntensity: 1, metalness: 0.15, roughness: 0.22 })
  m.userData.live = true
  return m
})
const suiteTint = new Color()
function SuiteLights() {
  useFrame(() => {
    const p = clubPulse()
    const lit = isNight() ? nightAmount(dayPhase()) : 0
    const glow = lit * (0.8 + 1.6 * p.flash)
    suiteMats.forEach((m, i) => m.emissive.copy(suiteTint.set(RAINBOW[(i * 2 + p.step) % RAINBOW.length])).multiplyScalar(glow))
  })
  return null
}

// ---- Shapes (front elevation, x across, y up), extruded front to back ----

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
// The shaft's right edge below the deck: leans in from the podium to the deck.
const rightEdge = (y: number) => 1.0 - 0.55 * Math.pow(clamp01((y - BASE) / (DECK - BASE)), 1.3)
// The penthouse's right wall leans out as it climbs, so the top juts over the deck.
const suiteEdge = (y: number) => 0.85 + (TIP[0] - 0.12 - 0.85) * clamp01((y - DECK_TOP) / (CROWN - DECK_TOP))
// The crown's hook: from the blade tip, a hollow curve sweeping up into the spire.
const HOOK: [Vector2, Vector2, Vector2] = [new Vector2(TIP[0], TIP[1] + 0.1), new Vector2(-0.05, 12.85), new Vector2(-0.3, 15.0)]
const hookAt = (t: number) => {
  const [a, c, b] = HOOK
  const u = 1 - t
  return new Vector2(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y)
}
// The seam: up the face from the podium, then off the leaning side as the strut under the deck's end.
const SEAM: [Vector2, Vector2, Vector2] = [new Vector2(0.3, BASE), new Vector2(0.55, 6.7), new Vector2(DECK_END - 0.2, 9.62)]

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
  const body = new Shape([new Vector2(LEFT, BASE), ...edge, new Vector2(LEFT, DECK)])
  // The deck: a slab out to the pad, thickening into the tower.
  const deck = new Shape()
  deck.moveTo(LEFT - 0.05, DECK)
  deck.lineTo(rightEdge(DECK) + 0.02, DECK)
  deck.lineTo(rightEdge(8.75) + 0.02, 8.75)
  deck.quadraticCurveTo(1.0, 9.4, DECK_END, 9.6)
  deck.lineTo(DECK_END, DECK_TOP)
  deck.lineTo(LEFT - 0.05, DECK_TOP)
  deck.closePath()
  // Three penthouse floors, glazed all the way round, and the slim white floor plates between them.
  const suite = SUITE.map(([y0, y1]) => new Shape([new Vector2(LEFT, y0), new Vector2(suiteEdge(y0), y0), new Vector2(suiteEdge(y1), y1), new Vector2(LEFT, y1)]))
  const plate = (y: number, out: number) => new Shape([new Vector2(LEFT - 0.04, y - 0.035), new Vector2(suiteEdge(y) + out, y - 0.035), new Vector2(suiteEdge(y) + out, y + 0.035), new Vector2(LEFT - 0.04, y + 0.035)])
  // The crown: dark glass from the hook's blade tip, up the hollow curve, to a pointed spire.
  const hook = quad(HOOK[0], HOOK[1], HOOK[2], 24)
  const crown = new Shape([new Vector2(LEFT, CROWN), new Vector2(TIP[0] - 0.12, CROWN), new Vector2(TIP[0], TIP[1]), ...hook, new Vector2(-0.6, PEAK), new Vector2(LEFT, PEAK - 0.3)])
  // White trim: along the hook (the blade's edge), and up the spire's top.
  const blade = band([new Vector2(TIP[0] - 0.14, CROWN - 0.06), new Vector2(TIP[0] + 0.02, TIP[1] - 0.02), ...hook.slice(1)], -0.1)
  const cap = band([new Vector2(-0.3, 15.0), new Vector2(-0.6, PEAK), new Vector2(LEFT, PEAK - 0.3)], -0.08)
  const seam = quad(SEAM[0], SEAM[1], SEAM[2], 28)
  return {
    body: extrude(body, D, true),
    deck: extrude(deck, 1.9),
    suite: suite.map((f) => extrude(f, D - 0.1, true)),
    plates: [extrude(plate(SUITE[0][1], 0.05), D), extrude(plate(BALCONY, 0.32), D + 0.36)],
    crown: extrude(crown, D, true),
    blade: extrude(blade, D + 0.04),
    cap: extrude(cap, D + 0.04),
    clad: extrude(band(edge.map((p) => p.clone()), -0.08), 0.1),
    strut: extrude(band(seam, -0.13), 0.16),
    seamLed: extrude(band(seam.map((p) => p.clone().add(new Vector2(-0.13, 0))), -0.03), 0.17),
    bladeLed: extrude(band(hook.slice(0, 19), 0.03), 0.02),
  }
})()

// How wide the tower is at a height (left and right x), for the pulse of light.
function spanAt(y: number): [number, number] {
  if (y < DECK) return [LEFT, rightEdge(y)]
  if (y < DECK_TOP) return [LEFT - 0.05, DECK_END]
  if (y < CROWN) return [LEFT, suiteEdge(y)]
  if (y < HOOK[0].y) return [LEFT, TIP[0]]
  // On the hook's curve: find where it reaches this height.
  let t = 0
  for (let i = 0; i <= 24; i++) if (hookAt(i / 24).y <= y) t = i / 24
  return [LEFT, Math.max(-0.6, hookAt(t).x)]
}

// Vertical mullions down the shaft's front and back, clear of the leaning side.
const MULLIONS = [-0.72, -0.44, -0.16, 0.12]

export function VanguardTower() {
  const padX = 1.9
  const padY = DECK_TOP + 0.04
  useLaunches()
  return (
    <group>
      {/* Plaza paving and steps up to the lobby. */}
      <Box m={mat} at={[0, 0.025, 0]} s={[3.9, 0.05, 3.9]} c="#ffffff" t={paverTex(4, 4)} shadow={false} />
      {[0, 1, 2].map((k) => <Box key={k} m={mat} at={[0, 0.06 + k * 0.03, Z + 1.35 - k * 0.1]} s={[1.6 - k * 0.1, 0.03, 0.3]} c="#cfd8dc" t={concreteTex(1, 1)} shadow={false} />)}

      {/* Podium: a tall glass lobby wrapped in white ribs, a band at the mezzanine and a lit canopy. */}
      <GlassBlock m={mat} x={0} z={Z} w={2.9} d={2.3} h={BASE} tint="#e0f7fa" frame="#263238" />
      {Array.from({ length: 10 }, (_, i) => -1.3 + i * 0.289).filter((x) => Math.abs(x + 0.2) > 0.45).map((x) => (
        <Box key={`f${x}`} m={mat} at={[x, BASE / 2, Z + 1.18]} s={[0.05, BASE, 0.07]} c={FRAME} />
      ))}
      {Array.from({ length: 10 }, (_, i) => -1.3 + i * 0.289).map((x) => <Box key={`b${x}`} m={mat} at={[x, BASE / 2, Z - 1.18]} s={[0.05, BASE, 0.07]} c={FRAME} />)}
      {[-1, 1].flatMap((sx) => [-0.85, -0.42, 0, 0.42, 0.85].map((z) => <Box key={`s${sx}${z}`} m={mat} at={[sx * 1.48, BASE / 2, Z + z]} s={[0.07, BASE, 0.05]} c={FRAME} />))}
      <Box m={mat} at={[0, 0.82, Z]} s={[3.0, 0.07, 2.4]} c={FRAME} />
      <Box m={mat} at={[-0.2, 0.68, Z + 1.45]} s={[1.5, 0.06, 0.6]} c="#263238" />
      <mesh position={[-0.2, 0.645, Z + 1.765]}><boxGeometry args={[1.46, 0.02, 0.02]} />{bulb}</mesh>
      <mesh position={[-0.2, 0.3, Z + 1.156]}><planeGeometry args={[0.7, 0.56]} />{mat('#1c2a33')}</mesh>

      <group position={[0, 0, Z]}>
        {/* Dark glass shaft with mullions, white trim up the leaning side, and the lit seam that becomes the strut. */}
        <mesh geometry={GEO.body} castShadow receiveShadow><primitive object={glassMat(DARK)} attach="material" dispose={null} /></mesh>
        {[-1, 1].flatMap((sz) => MULLIONS.map((x) => <Box key={`${sz}${x}`} m={mat} at={[x, (BASE + DECK) / 2, sz * (D / 2 + 0.012)]} s={[0.035, DECK - BASE, 0.04]} c={STEEL} />))}
        {[-1, 1].map((sz) => <mesh key={sz} geometry={GEO.clad} position-z={sz * (D / 2 - 0.03)} castShadow>{mat(FRAME)}</mesh>)}
        {[-1, 1].map((sz) => (
          <group key={sz} position-z={sz * (D / 2 - 0.02)}>
            <mesh geometry={GEO.strut} castShadow>{mat(FRAME)}</mesh>
            <mesh geometry={GEO.seamLed}>{coreEl()}</mesh>
          </group>
        ))}
        {/* Corner posts up the straight side, front and back. */}
        {[-1, 1].map((sz) => <Box key={sz} m={mat} at={[LEFT - 0.03, (BASE + PEAK - 0.3) / 2, sz * (D / 2 - 0.02)]} s={[0.1, PEAK - 0.3 - BASE, 0.1]} c={FRAME} />)}
        {/* The deck, cantilevered out to the landing pad, with lights along its lip. */}
        <mesh geometry={GEO.deck} castShadow receiveShadow>{mat(FRAME)}</mesh>
        <mesh position={[(LEFT + DECK_END) / 2, DECK_TOP - 0.06, 0.96]}><boxGeometry args={[DECK_END - LEFT + 0.05, 0.025, 0.02]} />{bulb}</mesh>
        {/* Penthouse: three floors glazed all round, a floor plate and a balcony with a glass rail. */}
        {GEO.suite.map((g, i) => <mesh key={i} geometry={g} castShadow><primitive object={suiteMats[i]} attach="material" dispose={null} /></mesh>)}
        <SuiteLights />
        {GEO.plates.map((g, i) => <mesh key={i} geometry={g} castShadow>{mat(FRAME)}</mesh>)}
        <mesh position={[(LEFT + suiteEdge(BALCONY) + 0.32) / 2, BALCONY + 0.17, D / 2 + 0.17]}>
          <boxGeometry args={[suiteEdge(BALCONY) + 0.3 - LEFT, 0.26, 0.015]} />
          <meshStandardMaterial color="#d6f3ff" transparent opacity={0.45} metalness={0.3} roughness={0.1} />
        </mesh>
        <mesh position={[(LEFT + suiteEdge(BALCONY) + 0.32) / 2, BALCONY + 0.31, D / 2 + 0.17]}><boxGeometry args={[suiteEdge(BALCONY) + 0.3 - LEFT, 0.02, 0.03]} />{bulb}</mesh>
        {/* Crown: dark glass hooking out to a blade and sweeping up into the spire, trimmed and lit along its edge. */}
        <mesh geometry={GEO.crown} castShadow><primitive object={glassMat(DARK)} attach="material" dispose={null} /></mesh>
        <mesh geometry={GEO.blade} castShadow>{mat(FRAME)}</mesh>
        <mesh geometry={GEO.cap} castShadow>{mat(FRAME)}</mesh>
        <group position-z={D / 2 + 0.02}><mesh geometry={GEO.bladeLed}>{coreEl()}</mesh></group>
        {/* Mast and warning light on the spire. */}
        <Cyl m={mat} at={[-0.6, PEAK + 0.45, 0]} r={0.02} r2={0.045} h={0.9} c="#cfd8dc" seg={8} />
        <mesh position={[-0.6, PEAK + 0.92, 0]}><sphereGeometry args={[0.05, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>

        {/* Landing pad on the deck's end, where the Skyhopper rests. */}
        <group position={[padX, padY, 0]}>
          <Cyl m={mat} at={[0, -0.02, 0]} r={0.52} h={0.04} c="#455a64" seg={28} />
          <mesh position={[0, 0.0015, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.48, 28]} />
            {mat('#ffffff', helipadTex('#ffca28', '#6d7377'))}
          </mesh>
          <PadLights bulb={bulb} r={0.48} n={14} y={0.02} />
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
const R = 2.9 // spiral radius round the tower's middle
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
