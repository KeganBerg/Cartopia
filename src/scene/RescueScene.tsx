import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Object3D, Vector3, type Group, type InstancedMesh, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type PerspectiveCamera, type Texture } from 'three'
import type { Loot, Search } from '../game/store'
import { carDef, type Rarity } from '../game/data'
import { CarModel, carSize, wheelRig } from './CarModel'
import { TowTruck } from './TownCars'
import { Batch } from './Batch'
import { LotScenery } from './RescueLots'
import { RescueYard, rustySpot, type YardLook } from './RescueYard'
import { CarShadow, Crowd, useArcadeLook } from './ArcadeScenery'
import { RaceWeather } from './Weather'
import { PostFx } from './PostFx'
import { SkyEnv } from './SkyEnv'
import { holdTown } from './renderGate'
import { holdPageTint } from './pageTint'
import { LAYER } from './layers'
import { rescueSfx } from '../lib/sound'
import { buzz } from '../lib/haptics'
import { beamTex, concreteTex, dirtTex, glowTex, grassTex, sandTex, trackTex } from './textures'

// Rusty's search, played out in 3D: a dirt loop with the search spots around
// it, each a tarp-covered heap under a glowing beacon. Tap one and the tow
// truck drives there, the tarp flies off and the find rises into view.
// The rolls, costs and rewards all stay in the store; the scene only decides
// when to call `onArrive` (the store's revealPin).

// `ground` is what lies beyond the lot; `road` tints the worn track round the
// loop, `pad` the dirt under each spot, `yard` the lot itself and its fence.
type Theme = { ground: 'grass' | 'sand' | 'concrete'; tint: string; road: string; pad: string; tarp: string[]; sky: string; edge?: string; yard: YardLook }

const FENCE = ['#e07b45', '#5fa8a0', '#efe2c8', '#c0533e', '#b0bec5']
const THEMES: Record<string, Theme> = {
  suburbs: { ground: 'grass', tint: '#ffffff', road: '#8a755f', pad: '#a58b70', tarp: ['#3f6fa8', '#6b7d4a', '#8a6d4b'], sky: '#d9f2ff', yard: { dirt: '#bba68c', pad: '#a58b70', fence: FENCE } },
  farm: { ground: 'grass', tint: '#ffffff', road: '#9a7b58', pad: '#ad8e68', tarp: ['#6b7d4a', '#8a6d4b', '#3f6fa8'], sky: '#e2f4ff', yard: { dirt: '#c6ab84', pad: '#ad8e68', fence: ['#c0533e', '#efe2c8', '#e07b45', '#8d9b7a'], flavour: 'hay' } },
  downtown: { ground: 'concrete', tint: '#c4c9cd', road: '#6f757b', pad: '#9aa0a5', tarp: ['#3f6fa8', '#455a64', '#8a6d4b'], sky: '#d0dce5', yard: { dirt: '#a9adb0', pad: '#9aa0a5', fence: ['#b0bec5', '#5fa8a0', '#efe2c8', '#e07b45'] } },
  desert: { ground: 'sand', tint: '#ffffff', road: '#b0835a', pad: '#c99566', tarp: ['#8a6d4b', '#6b7d4a', '#a1887f'], sky: '#f2dcc2', yard: { dirt: '#e2b98c', pad: '#c99566', fence: ['#e07b45', '#efe2c8', '#c0533e', '#b0bec5'], flavour: 'desert' } },
  track: { ground: 'grass', tint: '#ffffff', road: '#62676c', pad: '#9a9fa4', tarp: ['#3f6fa8', '#b71c1c', '#455a64'], sky: '#d9f2ff', edge: '#fafafa', yard: { dirt: '#b7ab9a', pad: '#9a9fa4', fence: FENCE, flavour: 'track' } },
}

function groundTex(kind: Theme['ground']): Texture {
  if (kind === 'sand') return sandTex(28, 28)
  if (kind === 'concrete') return concreteTex(44, 44)
  return grassTex(55, 55)
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

// A straight strip along +z from z0 to z1, its texture running lengthwise
// like the loop's (u along, v across).
function straight(z0: number, z1: number, half: number, y: number) {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array([-half, y, z0, half, y, z0, -half, y, z1, half, y, z1]), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array([z0 / 2, 1, z0 / 2, 0, z1 / 2, 1, z1 / 2, 0]), 2))
  g.setIndex([0, 2, 1, 1, 2, 3])
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

// A one-off burst of glinting chips in a find's rarity colour, thrown up and
// falling back under gravity.
function Sparkles({ color, count = 16, delay = 0 }: { color: string; count?: number; delay?: number }) {
  const ref = useRef<InstancedMesh>(null)
  const t0 = useRef(-1)
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ a: (i / count) * Math.PI * 2 + (i % 3) * 0.4, out: 1.2 + ((i * 29) % 10) / 6, up: 3 + ((i * 17) % 10) / 3, spin: 4 + (i % 5) })), [count])
  const [done, setDone] = useState(false)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    if (t0.current < 0) t0.current = clock.elapsedTime
    const age = (clock.elapsedTime - t0.current) / SLOW - delay
    if (age > 1.3) return setDone(true)
    m.visible = age > 0
    if (age <= 0) return
    seeds.forEach((p, i) => {
      const r = p.out * age
      tmp.position.set(Math.cos(p.a) * r, 0.5 + p.up * age - 4.5 * age * age, Math.sin(p.a) * r)
      tmp.rotation.set(age * p.spin, age * p.spin * 0.7, 0)
      tmp.scale.setScalar(Math.max(0.001, 1 - age / 1.3))
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  if (done) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} visible={false} frustumCulled={false} raycast={() => null}>
      <octahedronGeometry args={[0.09, 0]} />
      <meshBasicMaterial color={color} toneMapped={false} />
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

// Three tarp shapes, picked by the spot's number: a car cover, a lumpy heap
// and a draped stack of crates. Ropes, sandbags and a loose flapping corner.
function Tarp({ kind, color }: { kind: number; color: string }) {
  const mat = <meshStandardMaterial color={color} roughness={0.9} flatShading />
  const rope = <meshStandardMaterial color="#e3c98f" />
  // Merged, so each tarp costs a couple of draws however many pieces it has.
  return (
    <Batch version={`${kind}${color}`}>
      {kind === 0 && (
        <>
          <mesh position-y={0.2} scale={[0.82, 0.4, 1.5]}>
            <boxGeometry args={[1, 1, 1]} />
            {mat}
          </mesh>
          <mesh position={[0, 0.38, -0.08]} scale={[0.4, 0.26, 0.55]}>
            <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {mat}
          </mesh>
          {/* The cover's hem flaring out at the bottom. */}
          <mesh position-y={0.04} scale={[0.92, 0.08, 1.6]}>
            <boxGeometry args={[1, 1, 1]} />
            {mat}
          </mesh>
          {[-0.45, 0.42].map((z) => (
            <mesh key={z} position={[0, 0.405, z]}>
              <boxGeometry args={[0.86, 0.025, 0.04]} />
              {rope}
            </mesh>
          ))}
        </>
      )}
      {kind === 1 && (
        <>
          <mesh position-y={0.05} scale={[0.72, 0.46, 1.05]}>
            <sphereGeometry args={[1, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {mat}
          </mesh>
          <mesh position={[0.04, 0.32, -0.12]} scale={[0.5, 0.32, 0.52]} rotation-y={0.2}>
            <sphereGeometry args={[1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {mat}
          </mesh>
          <mesh position={[-0.28, 0.12, 0.42]} rotation={[0.3, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.26, 8]} />
            <meshStandardMaterial color="#6d4c41" />
          </mesh>
          {[-0.42, 0.38].map((z) => (
            <mesh key={z} position={[0, 0.06, z]} rotation-y={Math.PI / 2} scale={[1, z < 0 ? 0.62 : 0.78, 1]}>
              <torusGeometry args={[0.68 - Math.abs(z) * 0.25, 0.022, 4, 14, Math.PI]} />
              {rope}
            </mesh>
          ))}
        </>
      )}
      {kind === 2 && (
        <>
          <mesh position-y={0.26} rotation-y={0.12} scale={[1.0, 0.52, 0.95]}>
            <boxGeometry args={[1, 1, 1]} />
            {mat}
          </mesh>
          <mesh position={[0.14, 0.64, -0.08]} rotation-y={-0.2} scale={[0.55, 0.3, 0.55]}>
            <boxGeometry args={[1, 1, 1]} />
            {mat}
          </mesh>
          {/* A crate corner showing under the hem. */}
          <mesh position={[-0.44, 0.1, 0.42]}>
            <boxGeometry args={[0.2, 0.2, 0.2]} />
            <meshStandardMaterial color="#a1887f" />
          </mesh>
          <mesh position={[0.02, 0.26, 0]} rotation-y={0.12}>
            <boxGeometry args={[1.04, 0.025, 0.04]} />
            {rope}
          </mesh>
        </>
      )}
      {/* A loose corner and sandbags holding the others down. */}
      <mesh position={[0.6, 0.06, 0.7]} rotation={[-1.2, 0.5, 0]}>
        <planeGeometry args={[0.32, 0.26]} />
        <meshStandardMaterial color={color} roughness={0.9} side={2} />
      </mesh>
      {[[-0.6, -0.7], [0.55, -0.72], [-0.6, 0.66]].map(([x, z], j) => (
        <mesh key={j} position={[x, 0.07, z]} rotation={[Math.PI / 2, 0, j]}>
          <capsuleGeometry args={[0.06, 0.12, 2, 6]} />
          <meshStandardMaterial color="#c9b07a" />
        </mesh>
      ))}
    </Batch>
  )
}

const backOut = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

// How good a find is, for the build-up, the sounds and the shake.
export type Tier = 'nothing' | 'small' | Rarity
export const tierOf = (l: Loot): Tier => (l.kind === 'car' ? l.rarity : l.kind === 'nothing' ? 'nothing' : 'small')
// Seconds of drumroll under the tarp before it's yanked: the better the find, the longer the wait.
const BUILD: Record<Tier, number> = { nothing: 0.3, small: 0.3, common: 0.5, scarce: 0.85, rare: 1.15 }
// The beacon climbs this ladder of colours during the build-up.
const LADDER: Record<Tier, string[]> = { nothing: ['#ffd54f'], small: ['#ffd54f'], common: ['#ffd54f', '#ffffff'], scarce: ['#ffd54f', '#42a5f5'], rare: ['#ffd54f', '#42a5f5', '#ff6d00'] }
const SHAKE: Record<Tier, number> = { nothing: 0.02, small: 0.04, common: 0.08, scarce: 0.14, rare: 0.24 }
const PUNCH: Record<Tier, number> = { nothing: 0.02, small: 0.04, common: 0.07, scarce: 0.1, rare: 0.14 }
const BUZZ: Record<Tier, number | number[]> = { nothing: 8, small: 15, common: 25, scarce: [25, 40, 35], rare: [30, 40, 30, 40, 80] }
// The find's place on screen (0-1 from the top left), for the HUD to fly it to the tray.
export type ScreenAt = { x: number; y: number }

type SpotProps = { i: number; at: SpotAt; loot: Loot; open: boolean; gone: boolean; tarp: string; pad: string; speed: number; onPick: (i: number) => void; onFound: (i: number, at: ScreenAt) => void; onHit: (i: number, tier: Tier) => void }

const ladderColor = new Color()

function SearchSpot({ i, at: p, loot, open, gone, tarp, pad, speed, onPick, onFound, onHit }: SpotProps) {
  const { camera } = useThree()
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
  const beam = useRef<MeshBasicMaterial>(null)
  const shock = useRef<Mesh>(null)
  const shockMat = useRef<MeshBasicMaterial>(null)
  const [hit, setHit] = useState(born.current)
  const rumbled = useRef(born.current)
  // The tarp flies off away from the road.
  const away = useMemo(() => {
    const dx = p.x - p.rx
    const dz = p.z - p.rz
    const l = Math.hypot(dx, dz) || 1
    return [dx / l, dz / l] as const
  }, [p])
  const [stage, setStage] = useState<'shut' | 'opening' | 'open'>(open ? 'open' : 'shut')
  if (open && stage === 'shut') setStage('opening')
  const car = loot.kind === 'car'
  const glow = car ? RARITY_GLOW[loot.rarity] : '#ffe082'
  const tier = tierOf(loot)
  const pre = BUILD[tier]

  useFrame(({ clock }) => {
    const now = clock.elapsedTime / SLOW
    if (stage === 'opening' && t0.current < 0) t0.current = now
    const raw = stage === 'opening' ? (now - t0.current) * speed : stage === 'open' ? 99 : -1
    // The build-up runs first, then everything below times off the yank.
    const t = raw < 0 ? -1 : raw - pre
    const build = raw < 0 ? 0 : clamp01(raw / pre)
    if (stage === 'opening' && !rumbled.current) {
      rumbled.current = true
      rescueSfx.rumble(tier, pre / speed)
    }
    if (stage === 'opening' && t >= 0.12 && !hit) {
      setHit(true)
      rescueSfx.reveal(tier)
      buzz(BUZZ[tier])
      onHit(i, tier)
    }
    // Beacon: a pulsing ring and a soft light column while unopened. During the
    // build-up it pulses faster and climbs the rarity ladder, then fades as the tarp goes.
    const fade = raw < 0 ? 1 : clamp01(1 - t / 0.3)
    const rate = 3.2 + build * build * 22
    const pulse = 0.5 + Math.sin(now * rate + i) * 0.5
    const lad = LADDER[tier]
    ladderColor.set(raw < 0 ? '#ffd54f' : lad[Math.min(lad.length - 1, Math.floor(build * lad.length * 0.999))])
    if (ring.current) {
      ring.current.opacity = fade * (0.45 + pulse * 0.45 + build * 0.3)
      ring.current.color.copy(ladderColor)
    }
    if (column.current) {
      column.current.opacity = fade * (0.3 + pulse * 0.2 + build * 0.35)
      column.current.color.copy(ladderColor)
    }
    if (beacon.current) {
      beacon.current.visible = fade > 0.01
      beacon.current.children[2]?.position.set(0, 1.75 + Math.abs(Math.sin(now * 2.4 + i)) * 0.3 + build * 0.5, 0)
      beacon.current.children[2]?.rotation.set(0, now * (1.6 + build * 14), 0)
      beacon.current.scale.setScalar(1 + pulse * 0.04 + build * 0.12)
    }
    // Tarp: shivers and hops harder and harder through the build-up, then it's
    // whipped off away from the road, tumbling, and only shrinks away once it's well clear.
    const g = tarpRef.current
    if (g) {
      g.visible = t < 0.9
      if (raw >= 0 && t < 0) {
        const a = 0.02 + build * build * 0.1
        g.position.set(0, Math.abs(Math.sin(now * 23)) * a * 0.9, 0)
        g.rotation.set(Math.sin(now * 71) * a, Math.sin(now * 37) * a * 0.5, Math.cos(now * 59) * a, 'YXZ')
        g.scale.set(1 + build * 0.05, 1 - build * 0.06 + Math.sin(now * 31) * a * 0.3, 1 + build * 0.05)
      } else if (t >= 0) {
        const shake = clamp01(t / 0.15)
        const k = clamp01((t - 0.12) / 0.55)
        const e = 1 - (1 - k) ** 3
        g.position.set(away[0] * e * 2.6, Math.sin(k * Math.PI) * 1.6 + e * 0.4, away[1] * e * 2.6)
        g.rotation.set(e * 2.6 * away[1] + Math.sin(t * 90) * 0.06 * (1 - k) * shake, e * 1.4, -e * 2.6 * away[0] + Math.sin(t * 70) * 0.05 * (1 - k) * shake, 'YXZ')
        g.scale.setScalar(Math.max(0.001, 1 - clamp01((k - 0.6) / 0.4)))
      }
    }
    // A ring of light rolls out across the ground as the tarp comes off.
    if (shock.current && shockMat.current) {
      const sk = t < 0.12 || born.current ? 1 : clamp01((t - 0.12) / 0.6)
      shock.current.visible = sk < 1
      shock.current.scale.setScalar(1 + sk * (tier === 'rare' ? 4 : tier === 'scarce' ? 3 : 2))
      shockMat.current.opacity = (1 - sk) ** 2 * (car ? 0.9 : 0.5)
    }
    // A rarity beam shoots up as a car is uncovered.
    if (beam.current) {
      const b = t < 0.2 || gone ? 0 : clamp01(1 - (t - 0.2) / 1.1)
      beam.current.opacity = b * (car ? (loot.rarity === 'rare' ? 0.75 : loot.rarity === 'scarce' ? 0.5 : 0.28) : 0.18)
      beam.current.visible = b > 0.01
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
      const v = new Vector3(p.x, 0.6, p.z).project(camera)
      onFound(i, { x: (v.x + 1) / 2, y: (1 - v.y) / 2 })
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
          {/* A tarp over who-knows-what, tied down with rope. Its shape says
              nothing about what's under it. */}
          <group rotation-y={p.yaw}>
            <Tarp kind={i % 3} color={tarp} />
          </group>
        </group>
      )}
      {stage !== 'open' && (
        <group ref={beacon}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.05} raycast={() => null}>
            <ringGeometry args={[1.0, 1.22, 36]} />
            <meshBasicMaterial ref={ring} color="#ffd54f" transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
          <mesh position-y={1.5} raycast={() => null}>
            <cylinderGeometry args={[0.5, 0.95, 3, 20, 1, true]} />
            <meshBasicMaterial ref={column} map={beamTex()} color="#ffe082" transparent depthWrite={false} blending={AdditiveBlending} side={2} toneMapped={false} />
          </mesh>
          <group>
            <mesh rotation-x={Math.PI} raycast={() => null}>
              <coneGeometry args={[0.22, 0.38, 4]} />
              <meshStandardMaterial color="#ffca28" emissive="#ffb300" emissiveIntensity={0.9} flatShading />
            </mesh>
            <mesh position-y={0.3} raycast={() => null}>
              <boxGeometry args={[0.13, 0.26, 0.13]} />
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
                <CarModel body={carDef(loot.model).body} model={loot.model} color={carDef(loot.model).colors[0]} rusty />
              </group>
            ) : (
              <SmallLoot kind={loot.kind} />
            )}
          </group>
          <mesh position-y={2.4} visible={false} raycast={() => null}>
            <cylinderGeometry args={[0.32, 0.6, 4.8, 16, 1, true]} />
            <meshBasicMaterial ref={beam} map={beamTex()} color={glow} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} side={2} toneMapped={false} />
          </mesh>
          {stage === 'opening' && hit && <Puffs color={pad} count={car ? 16 : 12} />}
          {stage === 'opening' && hit && <Sparkles delay={0.12 / speed} color={car ? RARITY_GLOW[loot.rarity] : '#ffe082'} count={car ? (loot.rarity === 'rare' ? 40 : loot.rarity === 'scarce' ? 26 : 16) : 10} />}
          <mesh ref={shock} rotation-x={-Math.PI / 2} position-y={0.08} visible={false} raycast={() => null}>
            <ringGeometry args={[0.9, 1.15, 40]} />
            <meshBasicMaterial ref={shockMat} color={glow} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
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
// The truck is drawn a size up from the town's so it reads on a phone.
const TS = 1.2
const TOW_FIRST = TOW_GAP + 0.15 // the first towed car clears the longer truck
const DUST = 14

type Pose = { a: number; len: number; drop: number }

const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t
const mix = (p: Pose, q: Pose, t: number): Pose => ({ a: lerpAngle(p.a, q.a, t), len: p.len + (q.len - p.len) * t, drop: p.drop + (q.drop - p.drop) * t })
const tipOf = (px: number, py: number, pz: number, p: Pose): [number, number, number] => [px + Math.sin(p.a) * p.len, py + p.len * TILT, pz + Math.cos(p.a) * p.len]

// Where the n-th small find sits in the truck bed (truck-local).
const bedSlot = (n: number): [number, number, number] => [n % 2 ? 0.17 : -0.17, 0.66 + Math.floor(n / 4) * 0.2, -0.28 - (Math.floor(n / 2) % 2) * 0.26]

function LootModel({ loot }: { loot: Loot }) {
  if (loot.kind === 'car') return <CarModel body={carDef(loot.model).body} model={loot.model} color={carDef(loot.model).colors[0]} rusty />
  return <SmallLoot kind={loot.kind} />
}

type Props = {
  search: Search
  fast: boolean
  auto: boolean
  leaving: boolean
  onArrive: (i: number) => void
  onFound: (i: number, at: ScreenAt) => void
  onLeft: () => void
  onBusy: (busy: boolean) => void
}

type Mode = 'intro' | 'idle' | 'drive' | 'leave' | 'gone'

export function RescueScene({ search, fast, auto, leaving, onArrive, onFound, onLeft, onBusy }: Props) {
  const { camera, size } = useThree()
  const tall = size.height > size.width * 1.05
  const L = useMemo(() => makeLayout(tall, search.pins.length), [tall, search.pins.length])
  const theme = THEMES[search.spot] ?? THEMES.suburbs
  // The town's own time of day and weather, graded like the race venues.
  const town = useArcadeLook()
  const { night, look } = town
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
  const boom = useRef<Group>(null)
  const boomBase = useRef<Mesh>(null)
  const boomExt = useRef<Mesh>(null)
  const ram = useRef<Mesh>(null)
  const pulley = useRef<Mesh>(null)
  const straps = useRef<(Mesh | null)[]>([])
  const cable = useRef<Mesh>(null)
  const hook = useRef<Group>(null)
  const carried = useRef<Group>(null)
  const towed = useRef<(Group | null)[]>([])
  const body = useRef<Group>(null)
  const lamps = useRef<(MeshStandardMaterial | null)[]>([])
  const dust = useRef<InstancedMesh>(null)
  const dustAt = useRef(Array.from({ length: DUST }, () => ({ x: 0, z: 0, t: -9 })))
  const dustNext = useRef(0)
  // The hook swings on its cable: offset from under the boom tip, and its speed.
  const sway = useRef({ x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0, tvx: 0, tvz: 0, pitch: 0, lastV: 0 })
  const q = useRef(search)
  q.current = search
  const opts = useRef({ fast, auto, leaving, onArrive, onLeft, onBusy })
  opts.current = { fast, auto, leaving, onArrive, onLeft, onBusy }
  const busyShown = useRef(false)
  const speed = fast ? 2.4 : 1
  // The camera's punch-in and shake when a tarp comes off.
  const punch = useRef<{ at: number; tier: Tier } | null>(null)

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
    rescueSfx.go()
    buzz(10)
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
      // (Rounding can land a hair past the target, which reads as a whole lap to go.)
      if (remaining < 0.01 || remaining > L.len - 0.01) {
        s.s = target
        s.v = 0
        return true
      }
      if (s.v === 0) s.trip = Math.max(11, remaining / 1.5) * k
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
      s.v = 7 * k
      s.spur -= s.v * dt
      if (s.spur <= 0) {
        s.spur = 0
        s.v = 0
        s.mode = s.goal !== null ? 'drive' : 'idle'
      }
    } else if (s.mode === 'idle') {
      // A fresh find: once it has risen into view, swing the hook out for it.
      if (!grab.current && pending() && (now - seen.current[s.parked]) * k > BUILD[tierOf(sq.pins[s.parked])] + 0.85) grab.current = { i: s.parked, t0: now, held: false }
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
        s.busyUntil = wall + (BUILD[tierOf(sq.pins[i])] + 0.9) / k
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
    // Samples sit exactly STEP apart, however far the truck moved this frame,
    // so a distance back along the trail is always the same number of samples.
    const last = tr[tr.length - 1]
    const gap = Math.hypot(x - last.x, z - last.z)
    if (gap >= STEP) {
      const n = Math.floor(gap / STEP)
      for (let j = 1; j <= n; j++) {
        const f = (j * STEP) / gap
        tr.push({ x: last.x + (x - last.x) * f, z: last.z + (z - last.z) * f, yaw: lerpAngle(last.yaw, s.yaw, f) })
      }
      if (tr.length > 1200) tr.splice(0, tr.length - 1200)
    }
    const behind = (d: number) => tr[Math.max(0, tr.length - 1 - Math.round(d / STEP))]

    // Truck-local point to world.
    const cos = Math.cos(s.yaw)
    const sin = Math.sin(s.yaw)
    const local = (lx: number, ly: number, lz: number): [number, number, number] => [x + (lx * cos + lz * sin) * TS, ly * TS, z + (-lx * sin + lz * cos) * TS]

    // The crane: a post at the back of the bed with a boom that swings
    // round, lowers its hook onto a find and lifts it aboard.
    const [px, py, pz] = local(0, PIVOT_Y, PIVOT_Z)
    const rest: Pose = cars.length ? { a: s.yaw + Math.PI, len: 0.75 * TS, drop: 0.5 } : { a: s.yaw + Math.PI, len: 0.5 * TS, drop: 0.22 }
    let pose = rest
    const g = grab.current
    let carriedAt: [number, number, number] | null = null
    let carriedYaw = 0
    let carriedScale = 1
    let dangling = false
    if (g) {
      const sp = L.spots[g.i]
      const loot = sq.pins[g.i]
      const isCar = loot.kind === 'car'
      // A brisk swing: the hook doesn't dawdle.
      const u = (now - g.t0) * k * 1.3
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
      const bedReach = (slot[2] - PIVOT_Z) * TS
      const dest: Pose = isCar ? { a: s.yaw + Math.PI, len: 0.75 * TS, drop: 0.5 } : { a: s.yaw, len: bedReach, drop: PIVOT_Y * TS + bedReach * TILT - slot[1] * TS - hang * BED_SCALE * TS }
      const e = (v: number) => v * v * (3 - 2 * v)
      if (u < 0.45) pose = mix(rest, over, e(u / 0.45))
      else if (u < 0.7) pose = mix(over, down, e((u - 0.45) / 0.25))
      else if (u < 1.15) pose = mix(down, lifted, e((u - 0.7) / 0.45))
      else pose = mix(lifted, dest, e(clamp01((u - 1.15) / 0.5)))
      dangling = u < 1.15
      if (u >= 0.7 && !g.held) {
        g.held = true
        setHolding(g.i)
        rescueSfx.clunk()
        buzz(12)
      }
      if (g.held) {
        const tip = tipOf(px, py, pz, pose)
        let at3: [number, number, number] = [tip[0], tip[1] - pose.drop - hang, tip[2]]
        const back = clamp01((u - 1.15) / 0.5)
        carriedYaw = sp.yaw
        if (isCar) {
          // Ease into its place in the tow line.
          const b = behind(TOW_FIRST + cars.length * TOW_GAP)
          const w = e(back)
          at3 = [at3[0] + (b.x - at3[0]) * w, at3[1] + (0.1 - at3[1]) * w, at3[2] + (b.z - at3[2]) * w]
          carriedYaw = lerpAngle(sp.yaw, b.yaw, w)
        } else {
          // Shrink to fit and settle into its spot in the bed.
          const w = e(back)
          const b = local(...slot)
          at3 = [at3[0] + (b[0] - at3[0]) * w * w, at3[1] + (b[1] - at3[1]) * w * w, at3[2] + (b[2] - at3[2]) * w * w]
          carriedScale = 1.4 + (BED_SCALE * TS - 1.4) * w
          carriedYaw = lerpAngle(sp.yaw, s.yaw, w)
        }
        carriedAt = at3
      }
      if (u >= 1.7) {
        rescueSfx.land(isCar)
        if (isCar) buzz(20)
        grab.current = null
        setHolding(null)
        setTaken((tk) => [...tk, g.i])
      }
    }
    const tip = tipOf(px, py, pz, pose)
    // Swing: the hook lags behind the boom tip and sways back under it.
    const sw = sway.current
    if (dt > 0) {
      const tvx = (tip[0] - sw.tx) / dt
      const tvz = (tip[2] - sw.tz) / dt
      if (sw.tx || sw.tz) {
        sw.vx -= (tvx - sw.tvx) * 0.9
        sw.vz -= (tvz - sw.tvz) * 0.9
      }
      sw.tvx = tvx
      sw.tvz = tvz
      sw.tx = tip[0]
      sw.tz = tip[2]
      const kk = 9 / Math.max(0.3, pose.drop + 0.3)
      sw.vx += (-kk * kk * sw.x - 3.2 * sw.vx) * dt
      sw.vz += (-kk * kk * sw.z - 3.2 * sw.vz) * dt
      sw.x += sw.vx * dt
      sw.z += sw.vz * dt
      const cap = 0.45 * Math.max(0.2, pose.drop)
      const l = Math.hypot(sw.x, sw.z)
      if (l > cap) {
        sw.x *= cap / l
        sw.z *= cap / l
      }
    }
    const hx = tip[0] + sw.x
    const hz = tip[2] + sw.z
    const hy = tip[1] - Math.sqrt(Math.max(0.0001, pose.drop * pose.drop - sw.x * sw.x - sw.z * sw.z))
    const bm = boom.current
    if (bm) {
      // Boom: a heavy base section with a lighter one telescoping out of it,
      // a pulley at the tip and a hydraulic ram pushing it up from the post.
      const len = Math.hypot(Math.max(0.05, pose.len), pose.len * TILT)
      bm.position.set(px, py, pz)
      bm.rotation.set(-Math.atan(TILT), pose.a, 0, 'YXZ')
      bm.visible = s.mode !== 'gone'
      const base = Math.min(len, 0.55 * TS)
      boomBase.current?.position.set(0, 0, base / 2 - 0.06)
      boomBase.current?.scale.set(1, 1, base + 0.12)
      const ext = Math.max(0.01, len - base * 0.8)
      boomExt.current?.position.set(0, 0, base * 0.8 + ext / 2)
      boomExt.current?.scale.set(1, 1, ext)
      pulley.current?.position.set(0, -0.02, len)
      const r = ram.current
      if (r) {
        const al = Math.atan(TILT)
        const d = 0.32 * TS
        const fy = -d * Math.cos(al)
        const fz = -d * Math.sin(al)
        const ty = -0.05
        const tz = Math.min(len, 0.42 * TS)
        r.position.set(0, (fy + ty) / 2, (fz + tz) / 2)
        r.rotation.set(Math.atan2(tz - fz, ty - fy), 0, 0)
        r.scale.set(1, Math.hypot(tz - fz, ty - fy), 1)
      }
    }
    const cb = cable.current
    if (cb) {
      cb.position.set((tip[0] + hx) / 2, (tip[1] + hy) / 2, (tip[2] + hz) / 2)
      cb.rotation.set(-Math.atan2(sw.z, tip[1] - hy), 0, Math.atan2(sw.x, tip[1] - hy), 'XZY')
      cb.scale.set(1, Math.max(0.01, Math.hypot(sw.x, sw.z, tip[1] - hy)), 1)
      cb.visible = s.mode !== 'gone'
    }
    const hk = hook.current
    if (hk) {
      hk.position.set(hx, hy, hz)
      hk.rotation.y = pose.a
      hk.visible = s.mode !== 'gone'
    }
    if (carriedAt && dangling) {
      // Still dangling from the hook: swing with it.
      carriedAt = [carriedAt[0] + sw.x, carriedAt[1] + (hy - (tip[1] - pose.drop)), carriedAt[2] + sw.z]
    }
    const cg = carried.current
    if (cg && carriedAt) {
      cg.position.set(...carriedAt)
      cg.rotation.y = carriedYaw
      cg.scale.setScalar(carriedScale)
    }
    // Towed cars follow the truck's trail, the first one with its nose on the hook.
    cars.forEach((ci, n) => {
      const c = towed.current[n]
      if (!c) return
      const b = behind(TOW_FIRST + n * TOW_GAP)
      c.position.set(b.x, n === 0 ? 0.1 : 0, b.z)
      c.rotation.set(n === 0 ? -0.12 : 0, b.yaw, 0, 'YXZ')
      // A tow strap from this car's nose to the back of the one in front.
      const st = straps.current[n]
      if (!st) return
      st.visible = n > 0
      if (!n) return
      const loot = sq.pins[ci]
      const prev = sq.pins[cars[n - 1]]
      const half = (l: Loot) => (l.kind === 'car' ? carSize(carDef(l.model).body).len / 2 : 0.6)
      const a = behind(TOW_FIRST + (n - 1) * TOW_GAP + half(prev) - 0.05)
      const f = behind(TOW_FIRST + n * TOW_GAP - half(loot) + 0.05)
      const len = Math.max(0.02, Math.hypot(a.x - f.x, a.z - f.z))
      st.position.set((a.x + f.x) / 2, 0.2, (a.z + f.z) / 2)
      st.rotation.set(0, Math.atan2(a.x - f.x, a.z - f.z), 0)
      st.scale.set(1, 1, len)
    })

    // The truck rocks back as it pulls away and dips its nose when it brakes.
    const accel = dt > 0 ? (s.v - sw.lastV) / dt : 0
    sw.lastV = s.v
    sw.pitch += (Math.max(-0.07, Math.min(0.07, -accel * 0.006)) - sw.pitch) * Math.min(1, dt * 8)
    if (body.current) body.current.rotation.x = sw.pitch
    // Amber beacons flash while Rusty's out working.
    const flashOn = busy || s.v > 0.1
    lamps.current.forEach((l, j) => {
      if (l) l.emissiveIntensity = flashOn ? (Math.sin(now * 12 + j * Math.PI) > 0 ? 2.2 : 0.15) : 0.3
    })
    // Dust kicked up off the back wheels while driving.
    const dm = dust.current
    if (dm) {
      const da = dustAt.current
      if (s.v > 1.2 && s.mode !== 'gone' && now >= dustNext.current) {
        dustNext.current = now + 0.07
        const slot = da.reduce((o, p, j) => (p.t < da[o].t ? j : o), 0)
        const [bx, , bz] = local((Math.random() - 0.5) * 0.4, 0, -0.62)
        da[slot] = { x: bx, z: bz, t: now }
      }
      da.forEach((p, j) => {
        const age = (now - p.t) / 0.9
        if (age < 0 || age > 1) tmp.scale.setScalar(0.001)
        else tmp.scale.setScalar((0.35 + age * 0.9) * (1 - age * 0.6))
        tmp.position.set(p.x, 0.12 + age * 0.35, p.z)
        tmp.rotation.set(0, j, 0)
        tmp.updateMatrix()
        dm.setMatrixAt(j, tmp.matrix)
      })
      dm.instanceMatrix.needsUpdate = true
    }

    // Camera: frames the whole lot, drifts a little toward the truck, and
    // leans in while a find is being revealed.
    const reveal = s.focus >= 0 && ((now - s.focusAt) * k < 1.8 + BUILD[tierOf(sq.pins[s.focus])] || sq.flat || !!g)
    const f = reveal ? L.spots[s.focus] : null
    const lean = s.spur > 0 ? 0 : 0.18
    const gx = f ? (f.x + x) * 0.32 : x * lean
    const gz = f ? (f.z + z) * 0.32 : z * lean
    const gd = fitD * (f ? 0.6 : 1)
    const v = view.current
    if (!v.d) Object.assign(v, { x: gx, z: gz, d: gd })
    const ease = 1 - Math.exp(-dt * 2.6)
    v.x += (gx - v.x) * ease
    v.z += (gz - v.z) * ease
    v.d += (gd - v.d) * ease
    // The tarp comes off: the camera punches in and shakes, harder the better the find.
    const pu = punch.current
    const since = pu ? wall - pu.at : 9
    const amp = pu ? SHAKE[pu.tier] : 0
    const kick = since < 0.6 ? amp * (1 - since / 0.6) ** 2 : 0
    const jx = kick ? Math.sin(now * 61) * kick : 0
    const jz = kick ? Math.cos(now * 53) * kick : 0
    const dip = since < 0.07 ? since / 0.07 : Math.exp(-(since - 0.07) * 4)
    const d = v.d * (1 - (pu ? PUNCH[pu.tier] : 0) * dip)
    camera.position.set(v.x + jx, Math.sin(tilt) * d, v.z + Math.cos(tilt) * d + jz)
    camera.lookAt(v.x + jx, 0, v.z + jz)
    // Dev only: a fixed camera for the spot list's postcards (scripts/rescue/spotart.mjs).
    const pc = import.meta.env.DEV ? (window as { __rescueCam?: { p: [number, number, number]; l: [number, number, number] } }).__rescueCam : undefined
    if (pc) {
      camera.position.set(...pc.p)
      camera.lookAt(...pc.l)
    }
  })

  const road = useMemo(() => ribbon(L, 0, HALF, LAYER.lot), [L])
  const entry = useMemo(() => straight(L.rz - 0.2, L.rz + 32, HALF, LAYER.lot), [L])
  // A berm of loose dirt pushed up along both sides of the track.
  const berms = useMemo(() => [ribbon(L, HALF + 0.12, 0.14, LAYER.lot - 0.01), ribbon(L, -HALF - 0.12, 0.14, LAYER.lot - 0.01)], [L])
  const edges = useMemo(() => (theme.edge ? [ribbon(L, HALF - 0.08, 0.04, LAYER.paint), ribbon(L, -HALF + 0.08, 0.04, LAYER.paint)] : []), [L, theme.edge])
  useEffect(() => () => {
    road.dispose()
    entry.dispose()
    berms.forEach((g) => g.dispose())
    edges.forEach((g) => g.dispose())
  }, [road, entry, berms, edges])
  const rusty = useMemo(() => {
    const at = rustySpot(L)
    return at ? [{ x: at.x, z: at.z, h: 0, shirt: '#ff8f00' }] : []
  }, [L])

  return (
    <>
      <fog attach="fog" args={[sky, 38, 120]} />
      <color attach="background" args={[sky]} />
      <hemisphereLight args={[look.sky, look.ground, look.hemiIntensity * 1.15]} />
      <directionalLight position={[6, 12, 4]} intensity={look.sunIntensity * 0.9} color={look.sun} />
      <SkyEnv />
      <PostFx look={look} tiltShift />
      <RaceWeather w={town.weather} look={look} />
      <mesh rotation-x={-Math.PI / 2} position-y={LAYER.outer} raycast={() => null}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color={theme.tint} map={groundTex(theme.ground)} />
      </mesh>
      {/* Everything that never moves, merged into a few draws. */}
      <Batch version={`${search.spot}${tall}`}>
        <mesh geometry={road}>
          <meshStandardMaterial color={theme.road} map={trackTex()} />
        </mesh>
        {berms.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshStandardMaterial color={theme.yard.dirt} map={dirtTex(4, 1)} />
          </mesh>
        ))}
        {edges.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshBasicMaterial color={theme.edge} />
          </mesh>
        ))}
        {/* The way in, from Rusty's. */}
        <mesh geometry={entry}>
          <meshStandardMaterial color={theme.road} map={trackTex()} />
        </mesh>
        {L.spots.map((p, i) => (
          <group key={i}>
            {/* A worn dirt pad with a darker rim of churned-up ground, and the track out to it. */}
            <mesh rotation-x={-Math.PI / 2} position={[p.x, LAYER.land - 0.008, p.z]}>
              <circleGeometry args={[1.42, 24]} />
              <meshStandardMaterial color={theme.pad} map={dirtTex(0.7, 0.7)} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[p.x, LAYER.land, p.z]}>
              <circleGeometry args={[1.25, 24]} />
              <meshStandardMaterial color={theme.yard.dirt} map={dirtTex(0.6, 0.6)} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} rotation-z={-p.yaw} position={[(p.x + p.rx) / 2, LAYER.land - 0.004, (p.z + p.rz) / 2]}>
              <planeGeometry args={[0.95, Math.hypot(p.x - p.rx, p.z - p.rz)]} />
              <meshStandardMaterial color={theme.pad} map={dirtTex(0.4, 0.8)} />
            </mesh>
          </group>
        ))}
        <RescueYard L={L} spots={L.spots} look={theme.yard} />
        <LotScenery theme={search.spot} L={L} />
      </Batch>
      <Crowd people={rusty} />
      {L.spots.map((p, i) => (
        <SearchSpot key={i} i={i} at={p} loot={search.pins[i]} open={search.revealed[i]} gone={holding === i || taken.includes(i)} tarp={theme.tarp[i % theme.tarp.length]} pad={theme.pad} speed={speed} onPick={pick} onFound={onFound} onHit={(_, tier) => (punch.current = { at: performance.now() / 1000 / SLOW, tier })} />
      ))}
      <group ref={truck}>
        <group scale={TS}>
        <group ref={body}>
          <TowTruck rig={rig} crane />
          {/* Flashing beacons on the cab roof. */}
          {[-0.13, 0.13].map((lx, j) => (
            <mesh key={lx} position={[lx, 0.99, -0.15]}>
              <boxGeometry args={[0.12, 0.07, 0.12]} />
              <meshStandardMaterial ref={(m) => void (lamps.current[j] = m)} color="#ffb300" emissive="#ff8f00" emissiveIntensity={0.3} toneMapped={false} />
            </mesh>
          ))}
        </group>
        {/* Crane post with a striped base, and the small finds riding in the bed. */}
        <mesh position={[0, (PIVOT_Y + 0.5) / 2, PIVOT_Z]}>
          <boxGeometry args={[0.1, PIVOT_Y - 0.5, 0.1]} />
          <meshStandardMaterial color="#37474f" />
        </mesh>
        <mesh position={[0, 0.62, PIVOT_Z]}>
          <cylinderGeometry args={[0.1, 0.12, 0.1, 10]} />
          <meshStandardMaterial color="#ffca28" />
        </mesh>
        <mesh position={[0, PIVOT_Y, PIVOT_Z]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color="#ffca28" metalness={0.4} roughness={0.4} />
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
      </group>
      <instancedMesh ref={dust} args={[undefined, undefined, DUST]} frustumCulled={false} raycast={() => null}>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={theme.pad} transparent opacity={0.6} depthWrite={false} flatShading />
      </instancedMesh>
      <group ref={boom}>
        <mesh ref={boomBase} raycast={() => null}>
          <boxGeometry args={[0.13, 0.13, 1]} />
          <meshStandardMaterial color="#ffb300" />
        </mesh>
        <mesh ref={boomExt} raycast={() => null}>
          <boxGeometry args={[0.085, 0.085, 1]} />
          <meshStandardMaterial color="#ffd54f" metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh ref={pulley} rotation-z={Math.PI / 2} raycast={() => null}>
          <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
          <meshStandardMaterial color="#37474f" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh ref={ram} raycast={() => null}>
          <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
          <meshStandardMaterial color="#cfd8dc" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
      <mesh ref={cable} raycast={() => null}>
        <boxGeometry args={[0.02, 1, 0.02]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      <group ref={hook}>
        {/* Hook block: a weighted housing with a hazard stripe, then the hook. */}
        <mesh position-y={0.02} raycast={() => null}>
          <boxGeometry args={[0.12, 0.1, 0.07]} />
          <meshStandardMaterial color="#ffb300" />
        </mesh>
        <mesh position-y={-0.04} raycast={() => null}>
          <boxGeometry args={[0.1, 0.03, 0.06]} />
          <meshStandardMaterial color="#263238" />
        </mesh>
        <mesh position-y={-0.11} rotation-y={Math.PI / 2} raycast={() => null}>
          <torusGeometry args={[0.08, 0.026, 6, 12, Math.PI * 1.4]} />
          <meshStandardMaterial color="#cfd8dc" metalness={0.6} roughness={0.3} />
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
          <group key={i}>
            <group ref={(o) => void (towed.current[n] = o)}>
              <LootModel loot={search.pins[i]} />
              <CarShadow len={1.3} wid={0.75} />
            </group>
            <mesh ref={(o) => void (straps.current[n] = o)} visible={false} raycast={() => null}>
              <boxGeometry args={[0.05, 0.025, 1]} />
              <meshStandardMaterial color="#ffb300" />
            </mesh>
          </group>
        ))}
    </>
  )
}

