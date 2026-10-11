import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, CylinderGeometry, MeshStandardMaterial, type Group, type Object3D, type Texture } from 'three'
import { Box, Cyl, Pool, type Mat, type V3 } from './NewBuildings'
import { Bench, GlassBlock, Lamp, PadLights, Planter, glassMat } from './OfficeBuildings'
import { CarModel } from './CarModel'
import { Upright } from './mergeScale'
import { glowMats, onNight } from './dayNight'
import { concreteTex, helipadTex, paverTex } from './textures'
import { PAL, SEASON } from './season'

// Vanguard Tower: the landmark four level 10 houses become when merged into a
// 2x2 block. A heroes' headquarters skyline piece: a ribbed stone-and-glass
// slab below, then curved glass floors that sweep wider as they climb, a tall
// spine, a landing pad hung off one side and a glowing power-core crown.
// It fills a 2x2 lot (4x4 units round the origin) facing +z. Static pieces are
// plain meshes the town's Batch merges; the glass, crown glow and pad lights use
// the shared night materials so it lights up with the rest of the town.

const SNOW = SEASON === 'winter'
const STONE = '#ece6da'
const FRAME = '#eceff1'
const TINT = '#d2ecfa'
const Z = -0.35 // tower centre: the plaza takes the front of the lot

const mat: Mat = (color: string, map?: Texture) => <meshStandardMaterial color={color} map={map ?? null} />
const bulb = <primitive object={glowMats.bulb} attach="material" dispose={null} />

// The power core and the crown rings: a cool cyan that hums by day and blazes at night.
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

// An open glass drum whose UVs stretch with it, so every floor shares the curtain-wall
// material at the same pane size (see paneGeo in OfficeBuildings).
const rings = new Map<string, CylinderGeometry>()
function ringGeo(r: number, h: number) {
  const k = `${r.toFixed(3)}x${h.toFixed(3)}`
  let g = rings.get(k)
  if (g) return g
  g = new CylinderGeometry(r, r, h, 28, 1, true)
  const uv = g.getAttribute('uv')
  const around = Math.PI * 2 * r
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * around) / 0.72, (uv.getY(i) * h) / 1.2)
  rings.set(k, g)
  return g
}

// Upper floors: a floor's centre and half-width along x. They widen and lean
// out towards +x as they rise (the landing pad side), keeping the spine side straight.
const FLOORS = 16
const FH = 0.45
const UP0 = 6.55
const SQUASH = 0.76 // depth / width of each floor
const floorAt = (i: number) => {
  const t = i / (FLOORS - 1)
  return { y: UP0 + i * FH, r: 0.95 + 0.5 * t ** 1.8, x: -0.15 + 0.55 * t * t }
}
const TOP = UP0 + FLOORS * FH
const SPINE = -1.2

// Vertical stone piers down the long faces of a slab, the old-tower look below the glass.
function Piers({ w, d, y0, h, n }: { w: number; d: number; y0: number; h: number; n: number }) {
  const out: ReactNode[] = []
  for (const sz of [-1, 1])
    for (let i = 0; i <= n; i++) {
      const x = -w / 2 + (w * i) / n
      out.push(<Box key={`${sz}:${i}`} m={mat} at={[x, y0 + h / 2, Z + sz * (d / 2 + 0.02)]} s={[i % n === 0 ? 0.14 : 0.05, h, 0.05]} c={STONE} shadow={false} />)
    }
  // The short ends are solid stone with a slit of glass.
  for (const sx of [-1, 1]) out.push(<Box key={`end${sx}`} m={mat} at={[sx * (w / 2 + 0.02), y0 + h / 2, Z]} s={[0.05, h, d * 0.62]} c={STONE} shadow={false} />)
  return <group>{out}</group>
}

function Floor({ i }: { i: number }) {
  const { y, r, x } = floorAt(i)
  const crown = i >= FLOORS - 4
  return (
    <group position={[x, 0, Z]} scale={[1, 1, SQUASH]}>
      <mesh position={[0, y + FH / 2, 0]} geometry={ringGeo(r, FH - 0.04)} castShadow>
        <primitive object={glassMat(TINT)} attach="material" dispose={null} />
      </mesh>
      {/* Floor plate with a slim white edge; the top floors' edges glow like the core. */}
      <mesh position={[0, y + FH - 0.01, 0]} castShadow>
        <cylinderGeometry args={[r + 0.04, r + 0.04, 0.05, 28]} />
        {mat(FRAME)}
      </mesh>
      {crown && (
        <mesh position={[0, y + FH - 0.045, 0]}>
          <cylinderGeometry args={[r + 0.05, r + 0.05, 0.02, 28, 1, true]} />
          {coreEl()}
        </mesh>
      )}
    </group>
  )
}

export function VanguardTower() {
  const top = floorAt(FLOORS - 1)
  const pad = floorAt(11)
  const padY = pad.y + 0.1
  const padX = pad.x + pad.r + 0.3
  return (
    <group>
      {/* Plaza paving and steps up to the lobby. */}
      <Box m={mat} at={[0, 0.025, 0]} s={[3.9, 0.05, 3.9]} c="#ffffff" t={paverTex(4, 4)} shadow={false} />
      {[0, 1, 2].map((k) => <Box key={k} m={mat} at={[0, 0.06 + k * 0.03, Z + 1.35 - k * 0.1]} s={[1.6 - k * 0.1, 0.03, 0.3]} c="#cfd8dc" t={concreteTex(1, 1)} shadow={false} />)}

      {/* Podium: a two-storey glass lobby with a dark frame and a lit canopy. */}
      <GlassBlock m={mat} x={0} z={Z} w={3.0} d={2.3} h={0.8} tint="#e0f7fa" frame="#263238" />
      <Box m={mat} at={[0, 0.66, Z + 1.4]} s={[1.7, 0.06, 0.55]} c="#263238" />
      <mesh position={[0, 0.625, Z + 1.66]}><boxGeometry args={[1.66, 0.02, 0.02]} />{bulb}</mesh>
      <mesh position={[0, 0.3, Z + 1.156]}><planeGeometry args={[0.7, 0.56]} />{mat('#1c2a33')}</mesh>
      {[-0.95, 0.95].map((x) => <Box key={x} m={mat} at={[x, 0.4, Z + 1.18]} s={[0.12, 0.8, 0.06]} c={STONE} shadow={false} />)}

      {/* Lower tower: a ribbed slab and a setback above it. */}
      <GlassBlock m={mat} x={0} z={Z} y0={0.84} w={2.6} d={1.6} h={3.4} tint="#c4dcea" frame={STONE} roof={STONE} />
      <Piers w={2.6} d={1.6} y0={0.84} h={3.4} n={8} />
      <GlassBlock m={mat} x={0} z={Z} y0={4.32} w={2.2} d={1.36} h={2.12} tint="#c4dcea" frame={STONE} roof={STONE} />
      <Piers w={2.2} d={1.36} y0={4.32} h={2.12} n={7} />
      {/* Transfer deck where the new glass floors start, with lights round its edge. */}
      <Box m={mat} at={[-0.1, UP0 - 0.05, Z]} s={[2.3, 0.1, 1.5]} c={FRAME} />
      <mesh position={[-0.1, UP0 - 0.09, Z + 0.755]}><boxGeometry args={[2.2, 0.02, 0.02]} />{bulb}</mesh>

      {/* Upper tower: curved glass floors sweeping out as they rise. */}
      {Array.from({ length: FLOORS }, (_, i) => <Floor key={i} i={i} />)}

      {/* Roof: a cap, then the power-core crown drum. */}
      <group position={[top.x, 0, Z]} scale={[1, 1, SQUASH]}>
        <mesh position={[0, TOP + 0.04, 0]} castShadow><cylinderGeometry args={[top.r + 0.02, top.r + 0.06, 0.08, 28]} />{mat(SNOW ? '#f4f8fb' : '#cfd8dc')}</mesh>
        <mesh position={[0.15, TOP + 0.3, 0]} castShadow><cylinderGeometry args={[0.62, 0.7, 0.45, 24]} />{mat('#37474f')}</mesh>
        <mesh position={[0.15, TOP + 0.3, 0]}><cylinderGeometry args={[0.705, 0.705, 0.12, 24, 1, true]} />{coreEl()}</mesh>
        <mesh position={[0.15, TOP + 0.56, 0]}><cylinderGeometry args={[0.5, 0.62, 0.08, 24]} />{mat(FRAME)}</mesh>
      </group>
      {/* The power core: a glowing ring set into the crown's face, over the plaza. */}
      <group position={[top.x + 0.15, TOP + 0.3, Z + 0.705 * SQUASH + 0.02]}>
        <mesh><circleGeometry args={[0.15, 20]} />{coreEl()}</mesh>
        <mesh position={[0, 0, 0.005]}><torusGeometry args={[0.19, 0.03, 8, 24]} />{mat('#cfd8dc')}</mesh>
      </group>

      {/* The spine: a tall stone fin up the straight side, with a light strip and a mast. */}
      <Box m={mat} at={[SPINE, (UP0 + TOP + 1.3) / 2, Z]} s={[0.26, TOP + 1.3 - UP0, 0.6]} c={FRAME} />
      <mesh position={[SPINE, (UP0 + 0.3 + TOP + 1.1) / 2, Z + 0.305]}><boxGeometry args={[0.07, TOP + 0.8 - UP0, 0.02]} />{coreEl()}</mesh>
      <Cyl m={mat} at={[SPINE, TOP + 1.75, Z]} r={0.02} r2={0.045} h={0.9} c="#cfd8dc" seg={8} />
      <mesh position={[SPINE, TOP + 2.22, Z]}><sphereGeometry args={[0.05, 8, 6]} /><primitive object={glowMats.taillight} attach="material" dispose={null} /></mesh>

      {/* Landing pad hung off the open side on a tapered strut. */}
      <group position={[padX, padY, Z + 0.25]}>
        <Cyl m={mat} at={[0, 0, 0]} r={0.6} h={0.08} c="#455a64" seg={28} />
        <mesh position={[0, 0.041, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.56, 28]} />
          {mat('#ffffff', helipadTex('#ffca28', '#6d7377'))}
        </mesh>
        <PadLights bulb={bulb} r={0.56} n={14} y={0.06} />
        <group position-y={0.045}><Skyhopper pad={[padX, padY + 0.075, Z + 0.25]} /></group>
        <Cyl m={mat} at={[-0.12, -0.27, 0]} r={0.48} r2={0.08} h={0.46} c="#78909c" seg={16} />
        <Box m={mat} at={[-0.62, -0.34, 0]} s={[0.6, 0.06, 0.14]} c="#78909c" rot={[0, 0, 0.7]} />
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

// ---- Skyhopper: the tower's flying car ----

// Every CYCLE seconds it lifts off the pad, flies two laps round the tower
// (climbing past the crown and back), then sets down on the pad again and rests.
// It moves, so it stays out of the town's Batch, and it never catches taps.
const CYCLE = 34
const LIFT = 1.6 // seconds to rise off the pad
const LAPS = 15 // seconds for both laps
const LAND = 2.6 // seconds to settle back down
const HOP = 0.7 // height of the hover above the pad
const AXIS: [number, number] = [0.15, Z] // what it circles: the upper tower's middle
const NO_RAY = () => null
const ease = (u: number) => u * u * (3 - 2 * u)

// Where the car is `c` seconds into its cycle, in the pad's frame (the pad centre is the origin).
function flight(c: number, pad: V3, out: { x: number; y: number; z: number; bank: number }) {
  const [px, , pz] = pad
  const dx = px - AXIS[0]
  const dz = pz - AXIS[1]
  const r0 = Math.hypot(dx, dz)
  const a0 = Math.atan2(dz, dx)
  out.bank = 0
  if (c < LIFT) {
    out.x = 0; out.z = 0; out.y = HOP * ease(c / LIFT)
  } else if (c < LIFT + LAPS) {
    const u = (c - LIFT) / LAPS
    const k = Math.sin(Math.PI * u)
    // Swings out wide of the pad and the spine, two full turns, and back over the pad.
    const a = a0 + 4 * Math.PI * ease(u)
    const r = r0 + (3.1 - r0) * Math.min(1, k * 1.6)
    out.x = AXIS[0] + r * Math.cos(a) - px
    out.z = AXIS[1] + r * Math.sin(a) - pz
    out.y = HOP + 3.2 * Math.pow(k, 0.8) + Math.sin(u * Math.PI * 6) * 0.15
    out.bank = 0.45 * Math.min(1, k * 2)
  } else if (c < LIFT + LAPS + LAND) {
    out.x = 0; out.z = 0; out.y = HOP * (1 - ease((c - LIFT - LAPS) / LAND))
  } else {
    out.x = 0; out.z = 0; out.y = 0
  }
}

function Skyhopper({ pad }: { pad: V3 }) {
  const craft = useRef<Group>(null)
  const jets = useRef<Group>(null)
  const at = useRef({ x: 0, y: 0, z: 0, bank: 0 })
  const next = useRef({ x: 0, y: 0, z: 0, bank: 0 })
  useLayoutEffect(() => {
    craft.current?.traverse((o: Object3D) => void (o.raycast = NO_RAY))
  }, [])
  useFrame(({ clock }) => {
    const g = craft.current
    if (!g) return
    const c = clock.elapsedTime % CYCLE
    flight(c, pad, at.current)
    flight((c + 0.05) % CYCLE, pad, next.current)
    const p = at.current
    const q = next.current
    g.position.set(p.x, p.y, p.z)
    const vx = q.x - p.x
    const vz = q.z - p.z
    // Point along the way it's flying; parked, it keeps facing the way it landed.
    if (vx * vx + vz * vz > 1e-6) g.rotation.set(0, Math.atan2(vx, vz), -p.bank, 'YXZ')
    if (jets.current) jets.current.visible = p.y > 0.01
  })
  return (
    <group ref={craft} userData={{ noBatch: true }}>
      <group scale={0.72}>
        <CarModel body="wedge" color="#eceff1" stripe="#00bcd4" />
      </group>
      {/* Hover jets: four cyan glows under the car, lit while it flies. */}
      <group ref={jets} visible={false}>
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.2, 0.03, sz * 0.27]} rotation-x={Math.PI / 2}>
            <circleGeometry args={[0.07, 12]} />
            {coreEl()}
          </mesh>
        )))}
      </group>
    </group>
  )
}
