import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Object3D, type Group, type InstancedMesh, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type PerspectiveCamera } from 'three'
import type { Loot, Search } from '../game/store'
import { carDef, type Rarity } from '../game/data'
import { CarModel, wheelRig } from './CarModel'
import { TowTruck } from './TownCars'
import { Batch } from './Batch'
import { LotScenery } from './RescueLots'
import { PostFx } from './PostFx'
import { SkyEnv } from './SkyEnv'
import { holdTown } from './renderGate'
import { holdPageTint } from './pageTint'
import { dayPhase, duskAmount, nightAmount } from './dayNight'
import { lookFor } from './look'
import { PAL } from './season'
import { LAYER } from './layers'
import { glowTex } from './textures'

// Rusty's search, played out in 3D: a dirt loop with the search spots around
// it, each a tarp-covered heap under a glowing beacon. Tap one and the tow
// truck drives there, the tarp flies off and the find rises into view.
// The rolls, costs and rewards all stay in the store; the scene only decides
// when to call `onArrive` (the store's revealPin).

type Theme = { ground: string; road: string; pad: string; tarp: string[]; sky: string; edge?: string }

const THEMES: Record<string, Theme> = {
  suburbs: { ground: PAL.ground, road: '#62676c', pad: '#a08f78', tarp: ['#3f6fa8', '#6b7d4a', '#8a6d4b'], sky: '#d9f2ff' },
  farm: { ground: PAL.ground, road: '#a7845c', pad: '#b39270', tarp: ['#6b7d4a', '#8a6d4b', '#3f6fa8'], sky: '#e2f4ff' },
  downtown: { ground: '#8f969c', road: '#4b5056', pad: '#a7adb2', tarp: ['#3f6fa8', '#455a64', '#8a6d4b'], sky: '#d0dce5' },
  desert: { ground: '#d9a066', road: '#b98552', pad: '#c99566', tarp: ['#8a6d4b', '#6b7d4a', '#a1887f'], sky: '#f2dcc2' },
  track: { ground: PAL.ground, road: '#55595e', pad: '#8a8f94', tarp: ['#3f6fa8', '#b71c1c', '#455a64'], sky: '#d9f2ff', edge: '#fafafa' },
}

export const RARITY_GLOW: Record<Rarity, string> = { common: '#cfd8dc', scarce: '#42a5f5', rare: '#ffb300' }

// ---- Layout: an oval dirt loop with the spots spaced around it ----

const N = 240
const HALF = 0.62 // half the road's width

type SpotAt = { x: number; z: number; s: number; rx: number; rz: number; yaw: number }
type Layout = { rx: number; rz: number; pts: [number, number][]; cum: number[]; len: number; spots: SpotAt[] }

function makeLayout(tall: boolean, count: number): Layout {
  // Tall phone screens get the oval stood on end so it fills the view.
  const rx = tall ? 4.1 : 8.2
  const rz = tall ? 11.5 : 5.2
  const pts: [number, number][] = []
  const cum: number[] = [0]
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2
    pts.push([rx * Math.sin(t), rz * Math.cos(t)])
    if (i) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  const L = { rx, rz, pts, cum, len: cum[N], spots: [] as SpotAt[] }
  for (let k = 0; k < count; k++) {
    const s = (L.len * (k + 1)) / (count + 1)
    const p = at(L, s)
    // Alternate outside and inside the loop.
    const side = k % 2 ? -1 : 1
    const off = side > 0 ? 2.1 : 1.9
    const x = p.x - p.tz * off * side
    const z = p.z + p.tx * off * side
    L.spots.push({ x, z, s, rx: p.x, rz: p.z, yaw: Math.atan2(p.x - x, p.z - z) })
  }
  return L
}

// Point and direction a distance `s` around the loop.
function at(L: Pick<Layout, 'pts' | 'cum' | 'len'>, s: number) {
  s = ((s % L.len) + L.len) % L.len
  let lo = 0
  let hi = N
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (L.cum[m] <= s) lo = m
    else hi = m
  }
  const a = L.pts[lo]
  const b = L.pts[lo + 1]
  const seg = L.cum[lo + 1] - L.cum[lo] || 1
  const f = (s - L.cum[lo]) / seg
  return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, tx: (b[0] - a[0]) / seg, tz: (b[1] - a[1]) / seg }
}

// A flat strip following the loop, `off` out from its centre line.
function ribbon(L: Layout, off: number, half: number, y: number) {
  const g = new BufferGeometry()
  const pos = new Float32Array((N + 1) * 6)
  const nor = new Float32Array((N + 1) * 6)
  const uv = new Float32Array((N + 1) * 4)
  const idx: number[] = []
  for (let i = 0; i <= N; i++) {
    const p = at(L, L.cum[i])
    const nx = -p.tz
    const nz = p.tx
    pos.set([p.x + nx * (off - half), y, p.z + nz * (off - half), p.x + nx * (off + half), y, p.z + nz * (off + half)], i * 6)
    nor.set([0, 1, 0, 0, 1, 0], i * 6)
    uv.set([L.cum[i] / 2, 0, L.cum[i] / 2, 1], i * 4)
    if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('normal', new BufferAttribute(nor, 3))
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

// ---- Effects ----

// Dev builds only: `?slowmo=8` runs the search at an eighth of the speed, for screenshots.
const SLOW = import.meta.env.DEV && typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('slowmo')) || 1 : 1


const tmp = new Object3D()

// A burst of dust (or, with `loop`, a steady trickle of smoke).
function Puffs({ color, count = 12, loop, dur = 1.1, spread = 1.5, y = 0.15 }: { color: string; count?: number; loop?: boolean; dur?: number; spread?: number; y?: number }) {
  const ref = useRef<InstancedMesh>(null)
  const mat = useRef<MeshStandardMaterial>(null)
  const t0 = useRef(-1)
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ a: (i / count) * Math.PI * 2 + i, r: 0.6 + ((i * 37) % 10) / 20, up: 0.3 + ((i * 13) % 10) / 14, off: i / count })), [count])
  const [done, setDone] = useState(false)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    if (t0.current < 0) t0.current = clock.elapsedTime
    const age = (clock.elapsedTime - t0.current) / SLOW
    if (!loop && age > dur) return setDone(true)
    seeds.forEach((p, i) => {
      const t = loop ? ((age / dur + p.off) % 1) : age / dur
      const ease = 1 - (1 - t) ** 2
      const r = loop ? 0.15 + t * 0.3 : 0.3 + ease * spread * p.r
      tmp.position.set(Math.cos(p.a) * r, y + ease * p.up * (loop ? 2.2 : 1), Math.sin(p.a) * r)
      tmp.scale.setScalar((0.35 + ease * 0.9) * (loop ? 0.6 : 1) * (1 - t * 0.35))
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    if (mat.current) mat.current.opacity = loop ? 0.55 : 0.85 * (1 - age / dur)
  })
  if (done) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} raycast={() => null}>
      <icosahedronGeometry args={[0.22, 0]} />
      <meshStandardMaterial ref={mat} color={color} transparent depthWrite={false} flatShading />
    </instancedMesh>
  )
}

// ---- What a spot turns out to hold ----

function Gear() {
  return (
    <group rotation-x={Math.PI / 2}>
      <mesh>
        <cylinderGeometry args={[0.26, 0.26, 0.1, 16]} />
        <meshStandardMaterial color="#90a4ae" metalness={0.6} roughness={0.35} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * 0.3, 0, Math.sin((i / 8) * Math.PI * 2) * 0.3]} rotation-y={-(i / 8) * Math.PI * 2}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color="#90a4ae" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 0.12, 10]} />
        <meshStandardMaterial color="#455a64" />
      </mesh>
    </group>
  )
}

function SmallLoot({ kind }: { kind: Loot['kind'] }) {
  if (kind === 'coins')
    return (
      <group>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[0, -0.2 + k * 0.08, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.07, 18]} />
            <meshStandardMaterial color="#ffc107" metalness={0.7} roughness={0.25} emissive="#ff8f00" emissiveIntensity={0.25} />
          </mesh>
        ))}
        <mesh position={[0.08, 0.2, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 18]} />
          <meshStandardMaterial color="#ffd54f" metalness={0.7} roughness={0.25} emissive="#ff8f00" emissiveIntensity={0.3} />
        </mesh>
      </group>
    )
  if (kind === 'parts') return <Gear />
  if (kind === 'fuel')
    return (
      <group>
        <mesh>
          <boxGeometry args={[0.34, 0.44, 0.18]} />
          <meshStandardMaterial color="#e53935" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <boxGeometry args={[0.22, 0.06, 0.06]} />
          <meshStandardMaterial color="#b71c1c" />
        </mesh>
        <mesh position={[0.12, 0.27, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.1, 8]} />
          <meshStandardMaterial color="#ffd54f" />
        </mesh>
      </group>
    )
  if (kind === 'trophy')
    return (
      <group>
        <mesh position={[0, -0.24, 0]}>
          <boxGeometry args={[0.26, 0.08, 0.26]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.03, 0.05, 0.22, 8]} />
          <meshStandardMaterial color="#ffc107" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.2, 0.06, 0.26, 14]} />
          <meshStandardMaterial color="#ffc107" metalness={0.8} roughness={0.2} emissive="#ff8f00" emissiveIntensity={0.25} />
        </mesh>
      </group>
    )
  // Nothing but a tumbleweed.
  return (
    <mesh>
      <icosahedronGeometry args={[0.24, 1]} />
      <meshStandardMaterial color="#a1887f" wireframe />
    </mesh>
  )
}

const backOut = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

type SpotProps = { i: number; at: SpotAt; loot: Loot; open: boolean; gone: boolean; tarp: string; pad: string; speed: number; onPick: (i: number) => void; onFound: (i: number) => void }

function SearchSpot({ i, at: p, loot, open, gone, tarp, pad, speed, onPick, onFound }: SpotProps) {
  // Already open when the scene came up (the panel was reopened): no show.
  const born = useRef(open)
  const t0 = useRef(-1)
  const told = useRef(born.current)
  const tarpRef = useRef<Group>(null)
  const beacon = useRef<Group>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const column = useRef<MeshBasicMaterial>(null)
  const item = useRef<Group>(null)
  const flash = useRef<MeshBasicMaterial>(null)
  const [stage, setStage] = useState<'shut' | 'opening' | 'open'>(open ? 'open' : 'shut')
  if (open && stage === 'shut') setStage('opening')
  const car = loot.kind === 'car'
  const glow = car ? RARITY_GLOW[loot.rarity] : '#ffe082'

  useFrame(({ clock }) => {
    const now = clock.elapsedTime / SLOW
    if (stage === 'opening' && t0.current < 0) t0.current = now
    const t = stage === 'opening' ? (now - t0.current) * speed : stage === 'open' ? 9 : -1
    // Beacon: a pulsing ring and a soft light column while unopened, fading out as it opens.
    const fade = t < 0 ? 1 : clamp01(1 - t / 0.3)
    const pulse = 0.5 + Math.sin(now * 3.2 + i) * 0.5
    if (ring.current) ring.current.opacity = fade * (0.45 + pulse * 0.45)
    if (column.current) column.current.opacity = fade * (0.12 + pulse * 0.1)
    if (beacon.current) {
      beacon.current.visible = fade > 0.01
      beacon.current.children[2]?.position.set(0, 2.1 + Math.sin(now * 2.4 + i) * 0.18, 0)
      beacon.current.children[2]?.rotation.set(0, now * 1.6, 0)
      beacon.current.scale.setScalar(1 + pulse * 0.04)
    }
    // Tarp lifts, spins away and shrinks.
    const g = tarpRef.current
    if (g) {
      g.visible = t < 0.75
      if (t >= 0) {
        const k = clamp01(t / 0.75)
        g.position.y = k * k * 2.6
        g.rotation.set(k * 1.2, k * 2.4, k * 0.6)
        g.scale.setScalar(Math.max(0.001, 1 - k))
      }
    }
    // The find rises into view, then idles.
    const it = item.current
    if (it) {
      const k = t < 0 ? 0 : clamp01((t - 0.25) / 0.55)
      it.visible = k > 0 && !gone
      const e = backOut(k)
      if (car) {
        it.position.y = -0.5 + e * 0.5
        it.scale.setScalar(Math.max(0.001, 0.6 + e * 0.4))
      } else {
        it.position.y = e * 0.62 + (k >= 1 ? Math.sin(now * 2 + i) * 0.06 : 0)
        it.scale.setScalar(Math.max(0.001, e * 1.4))
        it.rotation.y = now * 1.4 + i
      }
    }
    if (flash.current) flash.current.opacity = t < 0.25 || gone ? 0 : car ? 0.25 + 0.6 * clamp01(1 - (t - 0.25) / 1.2) : 0.35 * clamp01(1 - (t - 0.25) / 1.2)
    if (stage === 'opening' && t > 0.6 && !told.current) {
      told.current = true
      onFound(i)
    }
    if (stage === 'opening' && t > 1.6) setStage('open')
  })

  return (
    <group position={[p.x, 0, p.z]}>
      {/* Generous tap target, so a thumb on a phone always finds it. */}
      <mesh
        visible={false}
        position-y={0.9}
        onClick={(e) => {
          e.stopPropagation()
          onPick(i)
        }}
        onPointerOver={() => !open && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <cylinderGeometry args={[1.3, 1.3, 2.2, 10]} />
        <meshBasicMaterial />
      </mesh>
      {stage !== 'open' && (
        <group ref={tarpRef}>
          <mesh position-y={0.1} scale={[0.78, 0.48, 1.08]} rotation-y={p.yaw}>
            <sphereGeometry args={[1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={tarp} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 0.3, 0]} rotation-y={p.yaw} scale={[0.82, 0.36, 0.1]}>
            <torusGeometry args={[1, 0.05, 4, 16, Math.PI]} />
            <meshStandardMaterial color="#d7ccc8" />
          </mesh>
        </group>
      )}
      {stage !== 'open' && (
        <group ref={beacon}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.05} raycast={() => null}>
            <ringGeometry args={[1.0, 1.22, 36]} />
            <meshBasicMaterial ref={ring} color="#ffd54f" transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position-y={1.8} raycast={() => null}>
            <cylinderGeometry args={[0.95, 1.05, 3.6, 20, 1, true]} />
            <meshBasicMaterial ref={column} color="#ffe082" transparent depthWrite={false} blending={AdditiveBlending} side={2} toneMapped={false} />
          </mesh>
          <group>
            <mesh rotation-x={Math.PI} raycast={() => null}>
              <coneGeometry args={[0.2, 0.42, 4]} />
              <meshStandardMaterial color="#ffca28" emissive="#ffb300" emissiveIntensity={0.9} flatShading />
            </mesh>
          </group>
        </group>
      )}
      {stage !== 'shut' && (
        <>
          <mesh rotation-x={-Math.PI / 2} position-y={0.06} raycast={() => null}>
            <circleGeometry args={[car ? 1.5 : 0.9, 24]} />
            <meshBasicMaterial ref={flash} map={glowTex()} color={glow} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
          {car && !gone && (
            <mesh rotation-x={-Math.PI / 2} position-y={0.07} raycast={() => null}>
              <ringGeometry args={[1.12, 1.3, 36]} />
              <meshBasicMaterial color={glow} toneMapped={false} />
            </mesh>
          )}
          <group ref={item} visible={born.current}>
            {car ? (
              <group rotation-y={p.yaw}>
                <CarModel body={carDef(loot.model).body} color={carDef(loot.model).colors[0]} rusty />
              </group>
            ) : (
              <SmallLoot kind={loot.kind} />
            )}
          </group>
          {stage === 'opening' && <Puffs color={pad} />}
        </>
      )}
    </group>
  )
}

// ---- The scene ----

// The crane on the back of the tow truck, in truck-local units.
const PIVOT_Y = 1.05
const PIVOT_Z = -0.62
const TILT = 0.22 // boom rise per unit of reach
const STEP = 0.05 // trail sample spacing
const TOW_GAP = 1.5 // spacing of towed cars
const BED_SCALE = 0.5

type Pose = { a: number; len: number; drop: number }

const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t
const mix = (p: Pose, q: Pose, t: number): Pose => ({ a: lerpAngle(p.a, q.a, t), len: p.len + (q.len - p.len) * t, drop: p.drop + (q.drop - p.drop) * t })
const tipOf = (px: number, py: number, pz: number, p: Pose): [number, number, number] => [px + Math.sin(p.a) * p.len, py + p.len * TILT, pz + Math.cos(p.a) * p.len]

// Where the n-th small find sits in the truck bed (truck-local).
const bedSlot = (n: number): [number, number, number] => [n % 2 ? 0.17 : -0.17, 0.66 + Math.floor(n / 4) * 0.2, -0.28 - (Math.floor(n / 2) % 2) * 0.26]

function LootModel({ loot }: { loot: Loot }) {
  if (loot.kind === 'car') return <CarModel body={carDef(loot.model).body} color={carDef(loot.model).colors[0]} rusty />
  return <SmallLoot kind={loot.kind} />
}

type Props = {
  search: Search
  fast: boolean
  auto: boolean
  leaving: boolean
  onArrive: (i: number) => void
  onFound: (i: number) => void
  onLeft: () => void
  onBusy: (busy: boolean) => void
}

type Mode = 'intro' | 'idle' | 'drive' | 'leave' | 'gone'

export function RescueScene({ search, fast, auto, leaving, onArrive, onFound, onLeft, onBusy }: Props) {
  const { camera, size } = useThree()
  const tall = size.height > size.width * 1.05
  const L = useMemo(() => makeLayout(tall, search.pins.length), [tall, search.pins.length])
  const theme = THEMES[search.spot] ?? THEMES.suburbs
  const night = useMemo(() => nightAmount(dayPhase()), [])
  const look = useMemo(() => lookFor(night, duskAmount(dayPhase())), [night])
  const sky = useMemo(() => {
    const day = theme.sky
    const n = Math.min(1, night)
    const mix = (a: string, b: string) => {
      const pa = parseInt(a.slice(1), 16)
      const pb = parseInt(b.slice(1), 16)
      const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - n) + ((pb >> sh) & 255) * n)
      return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')
    }
    return mix(day, '#1d2740')
  }, [theme.sky, night])
  // Full screen: stop drawing the town underneath, and tint the phone's bars.
  useEffect(() => holdTown(), [])
  useEffect(() => holdPageTint(sky), [sky])
  useEffect(() => () => void (document.body.style.cursor = ''), [])

  // Truck state lives in refs and moves every frame.
  const truck = useRef<Group>(null)
  const rig = useMemo(() => wheelRig('truck'), [])
  const st = useRef({ mode: 'intro' as Mode, s: 0, v: 0, trip: 9, spur: 9, yaw: Math.PI, goal: null as number | null, busyUntil: 0, focus: -1, focusAt: -99, parked: -1 })
  // Finds already hauled aboard: small ones ride in the bed, cars are towed
  // in a line behind. Anything found before the scene came up starts aboard.
  const [taken, setTaken] = useState<number[]>(() => search.pins.flatMap((l, i) => (search.revealed[i] && l.kind !== 'nothing' ? [i] : [])))
  const [holding, setHolding] = useState<number | null>(null)
  const takenRef = useRef(taken)
  takenRef.current = taken
  const grab = useRef<{ i: number; t0: number; held: boolean } | null>(null)
  const seen = useRef<number[]>(search.revealed.map((r) => (r ? -1e9 : 0)))
  // Where the truck has been, so towed cars can follow its exact path.
  const trail = useRef<{ x: number; z: number; yaw: number }[]>([])
  const boom = useRef<Mesh>(null)
  const cable = useRef<Mesh>(null)
  const hook = useRef<Group>(null)
  const carried = useRef<Group>(null)
  const towed = useRef<(Group | null)[]>([])
  const q = useRef(search)
  q.current = search
  const opts = useRef({ fast, auto, leaving, onArrive, onLeft, onBusy })
  opts.current = { fast, auto, leaving, onArrive, onLeft, onBusy }
  const busyShown = useRef(false)
  const speed = fast ? 2.4 : 1

  // Camera framing: back off until the whole loop and its spots fit on screen.
  const tilt = tall ? 1.08 : 0.92
  const fitD = useMemo(() => {
    const cam = (camera as PerspectiveCamera).clone()
    cam.fov = tall ? 55 : 42
    cam.aspect = size.width / size.height
    cam.updateProjectionMatrix()
    // The loop and the edges of every spot's pad (and its beacon) must show.
    const corners: [number, number, number][] = []
    for (let i = 0; i < N; i += 8) corners.push([L.pts[i][0], 0, L.pts[i][1]])
    for (const p of L.spots) for (const [dx, dz] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]]) for (const y of [0, 1.2]) corners.push([p.x + dx, y, p.z + dz])
    for (let d = 8; d < 90; d += 0.5) {
      cam.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d)
      cam.lookAt(0, 0, 0)
      cam.updateMatrixWorld()
      const ok = corners.every(([x, y, z]) => {
        const v = cam.position.clone().set(x, y, z).project(cam)
        // Leave room for the bars at the top and bottom of the screen.
        return Math.abs(v.x) < 0.94 && v.y < 0.74 && v.y > (tall ? -0.62 : -0.66)
      })
      if (ok) return d
    }
    return 90
  }, [camera, size, L, tall, tilt])
  useEffect(() => {
    const cam = camera as PerspectiveCamera
    cam.fov = tall ? 55 : 42
    cam.updateProjectionMatrix()
  }, [camera, tall, size])
  const view = useRef({ x: 0, z: 0, d: 0 })

  // The truck is parked at a find it hasn't hooked yet.
  const pending = () => {
    const s = st.current
    const sq = q.current
    return s.parked >= 0 && sq.revealed[s.parked] && sq.pins[s.parked].kind !== 'nothing' && !takenRef.current.includes(s.parked)
  }

  const pick = (i: number) => {
    const s = st.current
    const sq = q.current
    if (sq.flat || sq.revealed[i] || s.goal !== null || s.mode === 'leave' || s.mode === 'gone' || s.mode === 'drive') return
    if (performance.now() / 1000 / SLOW < s.busyUntil || grab.current || pending()) return
    s.goal = i
    if (s.mode === 'idle') s.mode = 'drive'
  }

  // Dev builds only: lets screenshot scripts tap a spot.
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __rescuePick: pick })
  })

  useFrame(({ clock, scene }, rawDt) => {
    scene.environmentIntensity = look.env
    const dt = Math.min(rawDt, 0.1) / SLOW
    const now = clock.elapsedTime / SLOW
    const wall = performance.now() / 1000 / SLOW
    const s = st.current
    const o = opts.current
    const sq = q.current
    const k = o.fast ? 2.6 : 1

    // Drives forward round the loop to a distance; true on arrival. Long trips
    // go faster so no trip drags on.
    const driveTo = (target: number) => {
      const remaining = (((target - s.s) % L.len) + L.len) % L.len
      if (remaining < 0.01) {
        s.s = target
        s.v = 0
        return true
      }
      if (s.v === 0) s.trip = Math.max(9, remaining / 1.8) * k
      const acc = s.trip * 1.3
      s.v = Math.min(s.trip, s.v + acc * dt, Math.sqrt(2 * acc * remaining) + 0.4)
      s.s += Math.min(remaining, s.v * dt)
      return false
    }

    sq.revealed.forEach((r, i) => {
      if (r && !seen.current[i]) seen.current[i] = now
    })
    const cars = takenRef.current.filter((i) => sq.pins[i].kind === 'car')
    const smalls = takenRef.current.filter((i) => sq.pins[i].kind !== 'car')

    if (o.leaving && s.mode !== 'leave' && s.mode !== 'gone' && !sq.flat && !grab.current && !pending()) {
      s.mode = 'leave'
      s.goal = null
    }
    if (s.mode === 'intro') {
      s.v = 5 * k
      s.spur -= s.v * dt
      if (s.spur <= 0) {
        s.spur = 0
        s.v = 0
        s.mode = s.goal !== null ? 'drive' : 'idle'
      }
    } else if (s.mode === 'idle') {
      // A fresh find: once it has risen into view, swing the hook out for it.
      if (!grab.current && pending() && (now - seen.current[s.parked]) * k > 1.0) grab.current = { i: s.parked, t0: now, held: false }
      if (o.auto && !sq.flat && wall >= s.busyUntil && !grab.current && !pending()) {
        // Next unchecked spot ahead.
        let best = -1
        let bestD = Infinity
        sq.revealed.forEach((r, i) => {
          if (r) return
          const d = (((L.spots[i].s - s.s) % L.len) + L.len) % L.len
          if (d < bestD) {
            bestD = d
            best = i
          }
        })
        if (best >= 0) {
          s.goal = best
          s.mode = 'drive'
        }
      }
    } else if (s.mode === 'drive' && s.goal !== null) {
      s.parked = -1
      if (driveTo(L.spots[s.goal].s)) {
        const i = s.goal
        s.goal = null
        s.mode = 'idle'
        s.parked = i
        s.focus = i
        s.focusAt = now
        s.busyUntil = wall + 1.0 / k
        o.onArrive(i)
      }
    } else if (s.mode === 'leave') {
      s.parked = -1
      if (s.spur > 0 || driveTo(Math.ceil(s.s / L.len - 0.001) * L.len)) {
        s.v = Math.min(9 * k, s.v + 8 * k * dt)
        s.spur += s.v * dt
        if (s.spur > 10 + cars.length * 1.7) {
          s.mode = 'gone'
          o.onLeft()
        }
      }
    }
    const busy = s.mode === 'drive' || s.mode === 'intro' || wall < s.busyUntil || !!grab.current || pending()
    if (busy !== busyShown.current) {
      busyShown.current = busy
      o.onBusy(busy)
    }

    // Place the truck.
    let x: number
    let z: number
    let yaw: number
    if (s.spur > 0) {
      x = 0
      z = L.rz + s.spur
      yaw = s.mode === 'intro' ? Math.PI : 0
    } else {
      const p = at(L, s.s)
      x = p.x
      z = p.z
      yaw = Math.atan2(p.tx, p.tz)
    }
    let dy = yaw - s.yaw
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    s.yaw += dy * Math.min(1, dt * (s.v > 0.1 ? 14 : 6))
    const t = truck.current
    if (t) {
      t.position.set(x, sq.flat ? -0.04 : 0, z)
      t.rotation.set(0, s.yaw, sq.flat ? 0.09 : 0)
      t.visible = s.mode !== 'gone'
    }
    const roll = (s.v * dt) / (rig.radius * 1.1)
    for (const w of rig.spin) if (w) w.rotation.x = (w.rotation.x + roll) % (Math.PI * 2)

    // Trail of where the truck has been. Seeded with the road it came in on.
    const tr = trail.current
    if (!tr.length) for (let j = 160; j > 0; j--) tr.push({ x, z: z + j * STEP, yaw: s.yaw })
    const last = tr[tr.length - 1]
    if (Math.hypot(x - last.x, z - last.z) >= STEP) {
      tr.push({ x, z, yaw: s.yaw })
      if (tr.length > 1200) tr.splice(0, tr.length - 1200)
    }
    const behind = (d: number) => tr[Math.max(0, tr.length - 1 - Math.round(d / STEP))]

    // Truck-local point to world.
    const cos = Math.cos(s.yaw)
    const sin = Math.sin(s.yaw)
    const local = (lx: number, ly: number, lz: number): [number, number, number] => [x + lx * cos + lz * sin, ly, z - lx * sin + lz * cos]

    // The crane: a post at the back of the bed with a boom that swings
    // round, lowers its hook onto a find and lifts it aboard.
    const [px, py, pz] = local(0, PIVOT_Y, PIVOT_Z)
    const rest: Pose = cars.length ? { a: s.yaw + Math.PI, len: 0.75, drop: 0.5 } : { a: s.yaw + Math.PI, len: 0.5, drop: 0.22 }
    let pose = rest
    const g = grab.current
    let carriedAt: [number, number, number] | null = null
    let carriedYaw = 0
    let carriedScale = 1
    if (g) {
      const sp = L.spots[g.i]
      const loot = sq.pins[g.i]
      const isCar = loot.kind === 'car'
      const u = (now - g.t0) * k
      const reach = Math.hypot(sp.x - px, sp.z - pz)
      const ta = Math.atan2(sp.x - px, sp.z - pz)
      const hang = isCar ? 0.7 : 0.3
      const itemTop = isCar ? 0.72 : 0.9
      const tipY = py + reach * TILT
      const over: Pose = { a: ta, len: reach, drop: 0.3 }
      const down: Pose = { a: ta, len: reach, drop: tipY - itemTop }
      const lifted: Pose = { a: ta, len: reach, drop: Math.max(0.3, tipY - itemTop - 0.6) }
      // Small finds go into the bed; cars swing round behind to be towed.
      const slot = bedSlot(smalls.length)
      const bedReach = slot[2] - PIVOT_Z
      const dest: Pose = isCar ? { a: s.yaw + Math.PI, len: 0.75, drop: 0.5 } : { a: s.yaw, len: bedReach, drop: PIVOT_Y + bedReach * TILT - slot[1] - hang * BED_SCALE }
      const e = (v: number) => v * v * (3 - 2 * v)
      if (u < 0.45) pose = mix(rest, over, e(u / 0.45))
      else if (u < 0.7) pose = mix(over, down, e((u - 0.45) / 0.25))
      else if (u < 1.15) pose = mix(down, lifted, e((u - 0.7) / 0.45))
      else pose = mix(lifted, dest, e(clamp01((u - 1.15) / 0.5)))
      if (u >= 0.7 && !g.held) {
        g.held = true
        setHolding(g.i)
      }
      if (g.held) {
        const tip = tipOf(px, py, pz, pose)
        let at3: [number, number, number] = [tip[0], tip[1] - pose.drop - hang, tip[2]]
        const back = clamp01((u - 1.15) / 0.5)
        carriedYaw = sp.yaw
        if (isCar) {
          // Ease into its place in the tow line.
          const b = behind(TOW_GAP + cars.length * TOW_GAP)
          const w = e(back)
          at3 = [at3[0] + (b.x - at3[0]) * w, at3[1] + (0.1 - at3[1]) * w, at3[2] + (b.z - at3[2]) * w]
          carriedYaw = lerpAngle(sp.yaw, b.yaw, w)
        } else {
          // Shrink to fit and settle into its spot in the bed.
          const w = e(back)
          const b = local(...slot)
          at3 = [at3[0] + (b[0] - at3[0]) * w * w, at3[1] + (b[1] - at3[1]) * w * w, at3[2] + (b[2] - at3[2]) * w * w]
          carriedScale = 1.4 + (BED_SCALE - 1.4) * w
          carriedYaw = lerpAngle(sp.yaw, s.yaw, w)
        }
        carriedAt = at3
      }
      if (u >= 1.7) {
        grab.current = null
        setHolding(null)
        setTaken((tk) => [...tk, g.i])
      }
    }
    const tip = tipOf(px, py, pz, pose)
    const bm = boom.current
    if (bm) {
      const len = Math.max(0.05, pose.len)
      bm.position.set(px + Math.sin(pose.a) * len * 0.5, py + len * TILT * 0.5, pz + Math.cos(pose.a) * len * 0.5)
      bm.rotation.set(-Math.atan(TILT), pose.a, 0, 'YXZ')
      bm.scale.set(1, 1, Math.hypot(len, len * TILT))
      bm.visible = s.mode !== 'gone'
    }
    const cb = cable.current
    if (cb) {
      cb.position.set(tip[0], tip[1] - pose.drop / 2, tip[2])
      cb.scale.set(1, Math.max(0.01, pose.drop), 1)
      cb.visible = s.mode !== 'gone'
    }
    const hk = hook.current
    if (hk) {
      hk.position.set(tip[0], tip[1] - pose.drop, tip[2])
      hk.rotation.y = pose.a
      hk.visible = s.mode !== 'gone'
    }
    const cg = carried.current
    if (cg && carriedAt) {
      cg.position.set(...carriedAt)
      cg.rotation.y = carriedYaw
      cg.scale.setScalar(carriedScale)
    }
    // Towed cars follow the truck's trail, the first one with its nose on the hook.
    cars.forEach((_, n) => {
      const c = towed.current[n]
      if (!c) return
      const b = behind(TOW_GAP + n * TOW_GAP)
      c.position.set(b.x, n === 0 ? 0.1 : 0, b.z)
      c.rotation.set(n === 0 ? -0.12 : 0, b.yaw, 0, 'YXZ')
    })

    // Camera: frames the whole lot, drifts a little toward the truck, and
    // leans in while a find is being revealed.
    const reveal = s.focus >= 0 && ((now - s.focusAt) * k < 1.8 || sq.flat || !!g)
    const f = reveal ? L.spots[s.focus] : null
    const lean = s.spur > 0 ? 0 : 0.18
    const gx = f ? f.x * 0.45 : x * lean
    const gz = f ? f.z * 0.45 : z * lean
    const gd = fitD * (f ? 0.72 : 1)
    const v = view.current
    if (!v.d) Object.assign(v, { x: gx, z: gz, d: gd })
    const ease = 1 - Math.exp(-dt * 2.6)
    v.x += (gx - v.x) * ease
    v.z += (gz - v.z) * ease
    v.d += (gd - v.d) * ease
    camera.position.set(v.x, Math.sin(tilt) * v.d, v.z + Math.cos(tilt) * v.d)
    camera.lookAt(v.x, 0, v.z)
  })

  const road = useMemo(() => ribbon(L, 0, HALF, LAYER.lot), [L])
  const edges = useMemo(() => (theme.edge ? [ribbon(L, HALF - 0.08, 0.04, LAYER.paint), ribbon(L, -HALF + 0.08, 0.04, LAYER.paint)] : []), [L, theme.edge])
  useEffect(() => () => {
    road.dispose()
    edges.forEach((g) => g.dispose())
  }, [road, edges])

  return (
    <>
      <fog attach="fog" args={[sky, 38, 120]} />
      <color attach="background" args={[sky]} />
      <hemisphereLight args={[look.sky, look.ground, look.hemiIntensity * 1.15]} />
      <directionalLight position={[6, 12, 4]} intensity={look.sunIntensity * 0.9} color={look.sun} />
      <SkyEnv />
      <PostFx look={look} tiltShift />
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.outer} raycast={() => null}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color={theme.ground} />
      </mesh>
      {/* Everything that never moves, merged into a few draws. */}
      <Batch version={`${search.spot}${tall}`}>
        <mesh geometry={road}>
          <meshStandardMaterial color={theme.road} />
        </mesh>
        {edges.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshBasicMaterial color={theme.edge} />
          </mesh>
        ))}
        {/* The way in, from Rusty's. */}
        <mesh rotation-x={-Math.PI / 2} position={[0, LAYER.lot, L.rz + 16]}>
          <planeGeometry args={[HALF * 2, 32]} />
          <meshStandardMaterial color={theme.road} />
        </mesh>
        {L.spots.map((p, i) => (
          <group key={i}>
            <mesh rotation-x={-Math.PI / 2} position={[p.x, LAYER.land, p.z]}>
              <circleGeometry args={[1.35, 20]} />
              <meshStandardMaterial color={theme.pad} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} rotation-z={-p.yaw} position={[(p.x + p.rx) / 2, LAYER.land, (p.z + p.rz) / 2]}>
              <planeGeometry args={[0.9, Math.hypot(p.x - p.rx, p.z - p.rz)]} />
              <meshStandardMaterial color={theme.pad} />
            </mesh>
            {/* Old tyres lying about. */}
            {[0, 1].map((k) => (
              <mesh key={k} rotation-x={-Math.PI / 2} position={[p.x + Math.cos(p.yaw + 1.6 + k * 0.5) * 1.15, 0.07, p.z - Math.sin(p.yaw + 1.6 + k * 0.5) * 1.15]}>
                <torusGeometry args={[0.15, 0.07, 6, 12]} />
                <meshStandardMaterial color="#263238" />
              </mesh>
            ))}
          </group>
        ))}
        <LotScenery theme={search.spot} L={L} />
      </Batch>
      {L.spots.map((p, i) => (
        <SearchSpot key={i} i={i} at={p} loot={search.pins[i]} open={search.revealed[i]} gone={holding === i || taken.includes(i)} tarp={theme.tarp[i % theme.tarp.length]} pad={theme.pad} speed={speed} onPick={pick} onFound={onFound} />
      ))}
      <group ref={truck}>
        <TowTruck rig={rig} crane />
        {/* Crane post, and the small finds riding in the bed. */}
        <mesh position={[0, (PIVOT_Y + 0.5) / 2, PIVOT_Z]}>
          <boxGeometry args={[0.1, PIVOT_Y - 0.5, 0.1]} />
          <meshStandardMaterial color="#37474f" />
        </mesh>
        {taken
          .filter((i) => search.pins[i].kind !== 'car')
          .map((i, n) => (
            <group key={i} position={bedSlot(n)} scale={BED_SCALE}>
              <SmallLoot kind={search.pins[i].kind} />
            </group>
          ))}
        <mesh rotation-x={-Math.PI / 2} position-y={LAYER.paint} raycast={() => null}>
          <planeGeometry args={[1.3, 2.1]} />
          <meshBasicMaterial map={glowTex()} color="#000000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
        {search.flat && (
          <group position={[0.45, 0.35, 0.55]}>
            <Puffs color="#9e9e9e" count={8} loop dur={1.4} />
          </group>
        )}
      </group>
      <mesh ref={boom} raycast={() => null}>
        <boxGeometry args={[0.08, 0.08, 1]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      <mesh ref={cable} raycast={() => null}>
        <boxGeometry args={[0.02, 1, 0.02]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      <group ref={hook}>
        <mesh position-y={-0.08} rotation-y={Math.PI / 2} raycast={() => null}>
          <torusGeometry args={[0.07, 0.022, 6, 12, Math.PI * 1.4]} />
          <meshStandardMaterial color="#ffca28" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      {holding !== null && (
        <group ref={carried}>
          <LootModel loot={search.pins[holding]} />
        </group>
      )}
      {taken
        .filter((i) => search.pins[i].kind === 'car')
        .map((i, n) => (
          <group key={i} ref={(o) => void (towed.current[n] = o)}>
            <LootModel loot={search.pins[i]} />
          </group>
        ))}
    </>
  )
}

