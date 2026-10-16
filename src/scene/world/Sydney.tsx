import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Float32BufferAttribute, Shape, ShapeGeometry, SphereGeometry, type Group } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Batch } from '../Batch'
import { EDGE, Gulls, Horizon, Many, PropMesh, Scatter, Sparkles, Water, frustum, prop, rand, useProp, type Look, type PropKit, type Spot } from './kit'
import type { WorldProps } from './WorldVenue'

// Australia, Sails Harbour: the strip runs round the harbour foreshore. Right: a lawn and the
// sea wall, green-and-gold ferries crossing, the opera house's white sails on their point by the
// finish, and the great steel arch bridge ahead. Left: sandstone terrace houses with iron lace
// verandahs, gum trees and jacarandas in flower, and the city tower with its gold turret beyond.

const SAND: Look = { c: '#d9b98a', r: 0.95 }
const SAND_D: Look = { c: '#c2a074', r: 0.95 }
const LACE: Look = { c: '#f4f4f0', r: 0.6 }
const DARK: Look = { c: '#2a2a2e', r: 1 }
const TILE: Look = { c: '#9e8f86', r: 0.7, m: 0.2 }

// A two-storey terrace house facing +z: verandah below, iron lace balcony above.
const TERR = [
  { wall: '#d9b98a', trim: '#2e5d4b', door: '#7a1f2b' },
  { wall: '#e6dccb', trim: '#7a1f2b', door: '#1f3c5b' },
  { wall: '#c9a27a', trim: '#1f3c5b', door: '#2e5d4b' },
  { wall: '#ead9b5', trim: '#4b3a2e', door: '#7a1f2b' },
  { wall: '#b9876a', trim: '#2e5d4b', door: '#e0c060' },
]
// A curved verandah roof: a quarter of a stretched sphere.
const ROOF = new SphereGeometry(1, 10, 4, Math.PI / 2, Math.PI, 0, Math.PI / 2).rotateY(Math.PI / 2).scale(0.5, 1, 1)

function terrace(k: PropKit, t: (typeof TERR)[number]) {
  const wall: Look = { c: t.wall, r: 0.9 }
  const trim: Look = { c: t.trim, r: 0.6 }
  const W = 1.8
  const Dp = 2.6
  const H = 2.5
  const f = Dp / 2
  k.box(wall, [W, H, Dp], [0, H / 2, 0])
  k.box(SAND_D, [W + 0.02, 0.2, Dp + 0.02], [0, 0.1, 0])
  // Party walls jut out between houses, with a chimney on top.
  for (const s of [-1, 1]) k.box(SAND, [0.12, H + 0.3, Dp + 0.5], [s * (W / 2 - 0.02), (H + 0.3) / 2, 0.25])
  k.box(SAND, [0.4, 0.6, 0.3], [-W / 2 + 0.2, H + 0.6, -0.3])
  for (const x of [-0.08, 0.08]) k.cyl({ c: '#a15b3c', r: 0.9 }, 0.05, 0.05, 0.2, [-W / 2 + 0.2 + x, H + 1.0, -0.3], undefined, 6)
  // Ground floor: front door with fanlight, a tall window, the verandah floor.
  k.box(t.door === '#e0c060' ? { c: '#e0c060', r: 0.6 } : { c: t.door, r: 0.6 }, [0.42, 0.85, 0.04], [-0.45, 0.62, f + 0.01])
  k.box({ c: '#9fc3d1', r: 0.2, m: 0.3 }, [0.42, 0.14, 0.03], [-0.45, 1.13, f + 0.01])
  k.box({ c: '#30404a', r: 0.3, m: 0.2 }, [0.5, 0.8, 0.03], [0.35, 0.68, f + 0.01])
  k.box(trim, [0.62, 0.08, 0.06], [0.35, 1.1, f + 0.02])
  k.box({ c: '#b9b3a8', r: 0.8 }, [W - 0.2, 0.08, 0.5], [0, 0.24, f + 0.25])
  // Upstairs: French doors onto the balcony.
  for (const x of [-0.4, 0.4]) {
    k.box({ c: '#30404a', r: 0.3, m: 0.2 }, [0.4, 0.8, 0.03], [x, 1.75, f + 0.01])
    k.box(trim, [0.48, 0.07, 0.05], [x, 2.18, f + 0.02])
  }
  // The verandah roof and balcony: posts, a lace frieze, a lace railing, a curved iron roof.
  for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) {
    k.box(LACE, [0.06, 1.25, 0.06], [x, 0.85, f + 0.45])
    k.box(LACE, [0.06, 0.95, 0.06], [x, 1.8, f + 0.45])
  }
  k.box(trim, [W - 0.12, 0.1, 0.55], [0, 1.45, f + 0.25])
  for (let i = 0; i < 10; i++) {
    const x = -W / 2 + 0.24 + i * 0.148
    k.box(LACE, [0.02, 0.38, 0.02], [x, 1.7, f + 0.47])
    k.box(LACE, [0.08, 0.08, 0.015], [x, 1.9, f + 0.47], [0, 0, Math.PI / 4])
    k.box(LACE, [0.08, 0.08, 0.015], [x + 0.074, 1.33, f + 0.47], [0, 0, Math.PI / 4])
  }
  k.box(LACE, [W - 0.2, 0.04, 0.03], [0, 1.9, f + 0.47])
  k.box(LACE, [W - 0.2, 0.04, 0.03], [0, 1.52, f + 0.47])
  k.box(LACE, [W - 0.2, 0.04, 0.03], [0, 2.22, f + 0.47])
  k.add(TILE, ROOF, [0, 2.28, f + 0.22], [0, 0, 0], [W - 0.12, 0.25, 0.55])
  // Main roof behind a parapet.
  frustum(k, TILE, W, Dp - 0.2, 0.7, 0.2, [0, H, -0.1])
  k.box(wall, [W, 0.35, 0.1], [0, H + 0.17, f - 0.05])
  k.box(SAND_D, [W + 0.04, 0.06, 0.14], [0, H + 0.37, f - 0.05])
}

// A gum tree: a pale twisting trunk and loose clumps of grey-green leaves.
function gum(k: PropKit) {
  const bark: Look = { c: '#e4ddd0', r: 0.9 }
  k.rod(bark, [0, 0, 0], [0.15, 1.6, 0.05], 0.13, 7)
  k.rod(bark, [0.15, 1.6, 0.05], [-0.3, 2.8, 0.1], 0.09, 6)
  k.rod(bark, [0.15, 1.6, 0.05], [0.7, 2.6, -0.2], 0.08, 6)
  k.rod(bark, [0.05, 2.2, 0.08], [0.3, 3.4, 0.4], 0.06, 5)
  const leaf = ['#7f9a74', '#6d8a66', '#8ea57f']
  ;[[-0.3, 3.0, 0.1, 0.65], [0.75, 2.85, -0.2, 0.6], [0.3, 3.6, 0.4, 0.55], [0.1, 3.3, -0.4, 0.5]].forEach(([x, y, z, r], i) => k.ico({ c: leaf[i % 3], r: 1 }, r, [x, y, z], [1, 0.75, 1], 1))
}

// A jacaranda in full purple bloom.
function jacaranda(k: PropKit) {
  const bark: Look = { c: '#5a4a3e', r: 1 }
  k.cyl(bark, 0.09, 0.13, 1.4, [0, 0.7, 0], undefined, 7)
  for (const [x, z] of [[0.6, 0.2], [-0.5, 0.3], [0.1, -0.6]]) k.rod(bark, [0, 1.2, 0], [x, 2.0, z], 0.06, 5)
  const bloom = ['#9b7fd1', '#8a6cc4', '#a98ddb']
  ;[[0, 2.3, 0, 0.9], [0.7, 2.1, 0.2, 0.65], [-0.6, 2.15, 0.3, 0.65], [0.1, 2.1, -0.65, 0.6], [0, 2.75, 0, 0.6]].forEach(([x, y, z, r], i) => k.ico({ c: bloom[i % 3], r: 1 }, r, [x, y, z], [1, 0.7, 1], 1))
}

// One sail shell, 1 wide, 1 tall and 1 deep: a pointed arch at its open mouth (z = 0) whose
// crown curves down to the podium at the back (z = -1), so from the side it reads as a tall
// curved triangle; the crown leans out over the mouth. Drawn from both sides.
const arch = (u: number) => 1 - Math.abs(u) ** 1.6
const SAIL = (() => {
  const NZ = 12
  const NU = 14
  const pos: number[] = []
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ
    const h = Math.cos((t * Math.PI) / 2)
    const w = 0.5 * (1 - t * 0.35)
    for (let j = 0; j <= NU; j++) {
      const u = (j / NU) * 2 - 1
      const y = h * arch(u)
      pos.push(u * w, y, -t + 0.22 * y * h)
    }
  }
  const idx: number[] = []
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NU; j++) {
    const a = i * (NU + 1) + j
    const b = a + NU + 1
    idx.push(a, b, a + 1, a + 1, b, b + 1)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  const back = g.clone()
  const bi = back.getIndex()!
  for (let i = 0; i < bi.count; i += 3) {
    const t = bi.getX(i)
    bi.setX(i, bi.getX(i + 2))
    bi.setX(i + 2, t)
  }
  const n = back.getAttribute('normal')
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i))
  return mergeGeometries([g, back])!
})()
// The glass wall filling a sail's mouth, set just inside the lip.
const MOUTH = (() => {
  const sh = new Shape()
  for (let j = 0; j <= 20; j++) {
    const u = (j / 20) * 2 - 1
    if (j === 0) sh.moveTo(u * 0.48, arch(u) * 0.97)
    else sh.lineTo(u * 0.48, arch(u) * 0.97)
  }
  sh.closePath()
  return new ShapeGeometry(sh)
})()

// The opera house on its granite podium, facing +z (the sails open towards the harbour, -z).
function opera(k: PropKit) {
  k.box({ c: '#c9a98a', r: 0.9 }, [14, 1.6, 26], [0, 0.8, 0])
  k.box({ c: '#b48f6e', r: 0.9 }, [8, 0.3, 4], [0, 1.75, 12])
  for (let i = 0; i < 10; i++) k.box({ c: '#b48f6e', r: 0.9 }, [8, 0.16, 0.4], [0, 1.6 - i * 0.16, 13.6 + i * 0.4])
  const shell: Look = { c: '#f5f3ee', r: 0.35 }
  const rib: Look = { c: '#dedad2', r: 0.5 }
  const glass: Look = { c: '#3b4a52', r: 0.15, m: 0.4 }
  // Two halls, each a run of shells leaning out towards the harbour (+z here), biggest first,
  // and a small one apart.
  for (const [hx, big] of [[-3.4, 1], [3.4, 0.82]] as const) {
    for (let i = 0; i < 4; i++) {
      const s = big * (1 - i * 0.18)
      const z = 7 - i * 4.4 * big
      k.add(shell, SAIL, [hx, 1.6, z], [0, 0, 0], [5.2 * s, 8.5 * s, 5.4 * s])
      k.add(rib, SAIL, [hx, 1.6, z - 0.15], [0, 0, 0], [4.9 * s, 8.0 * s, 5.0 * s])
      k.add(glass, MOUTH, [hx, 1.6, z - 0.1], [0, 0, 0], [5.2 * s, 8.5 * s, 1])
    }
  }
  k.add(shell, SAIL, [0, 1.6, -9], [0, 0, 0], [3, 4.6, 3])
}

// A harbour ferry, green hull and gold upper decks, facing +z.
function ferry(k: PropKit) {
  k.box({ c: '#1f6b45', r: 0.6 }, [1.6, 0.6, 5.2], [0, 0.3, 0])
  k.box({ c: '#e8c35a', r: 0.6 }, [1.5, 0.7, 4.4], [0, 0.95, 0])
  k.box({ c: '#1f6b45', r: 0.6 }, [1.3, 0.55, 3.0], [0, 1.6, 0])
  for (const s of [-1, 1]) for (const y of [0.95, 1.6]) k.box(DARK, [0.02, 0.28, y > 1.2 ? 2.6 : 4.0], [s * (y > 1.2 ? 0.66 : 0.76), y, 0])
  k.box({ c: '#f2f2f2', r: 0.6 }, [1.4, 0.06, 3.1], [0, 1.9, 0])
  k.cyl({ c: '#e8c35a', r: 0.6 }, 0.18, 0.2, 0.7, [0, 2.25, 0.4], undefined, 10)
  k.cyl(DARK, 0.19, 0.19, 0.08, [0, 2.62, 0.4], undefined, 10)
  k.box({ c: '#c62828', r: 0.7 }, [0.02, 0.3, 0.5], [0, 2.4, -1.0])
}

export default function Sydney({ len, race }: WorldProps) {
  const homes = useMemo(() => TERR.map((t, i) => prop(`sydney-terrace-${i}`, (k) => terrace(k, t))), [])
  const gumP = useProp('sydney-gum', gum)
  const jacP = useProp('sydney-jacaranda', jacaranda)
  const operaP = useProp('sydney-opera', opera)
  const oz = race + 6
  const SEA = -(EDGE + 6)

  const geo = useMemo(() => {
    const r = rand(831)
    // Terraces come in runs of five to nine, with a lane or a park between runs.
    const rows: Spot[][] = TERR.map(() => [])
    const trees: Spot[] = []
    const blooms: Spot[] = []
    for (let z = -14; z < len + 40;) {
      const n = 5 + Math.floor(r() * 5)
      for (let i = 0; i < n; i++) rows[Math.floor(r() * TERR.length)].push({ x: EDGE + 1.7 + 1.3, z: z + i * 1.8 + 0.9, ry: -Math.PI / 2 })
      z += n * 1.8
      const gap = 2.5 + r() * 3
      ;(r() < 0.5 ? blooms : trees).push({ x: EDGE + 2.6, z: z + gap / 2, ry: r() * 6, s: 0.9 + r() * 0.3 })
      z += gap
    }
    // Gums and jacarandas along the foreshore lawn.
    for (let z = -10; z < len + 40; z += 4 + r() * 5) {
      if (Math.abs(z - oz) < 16) continue
      ;(r() < 0.6 ? trees : blooms).push({ x: -(EDGE + 1.6 + r() * 2.2), z, ry: r() * 6, s: 0.85 + r() * 0.35 })
    }
    for (let z = -10; z < len + 40; z += 3 + r() * 3) trees.push({ x: EDGE + 6.6 + r() * 4, z, ry: r() * 6, s: 1 + r() * 0.4 })
    const rr = rand(21)
    const lawn = Array.from({ length: 300 }, () => ({ x: -(EDGE + 0.2 + rr() * 5), z: rr() * (len + 60) - 14, s: 0.7 + rr() * 0.6, ry: rr() * 6 }))
    return { rows, trees, blooms, lawn }
  }, [len, oz])

  return (
    <>
      <Batch version={`sydney:${len}`} cell={24}>
        {/* The foreshore lawn and the sandstone sea wall; the footpath before the terraces. */}
        <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + 3), 0.012, len / 2 + 5]}>
          <planeGeometry args={[6, len + 60]} />
          <meshStandardMaterial color="#6f9a4c" />
        </mesh>
        <mesh position={[SEA + 0.3, 0.2, len / 2 + 5]}>
          <boxGeometry args={[0.6, 0.5, len + 60]} />
          <meshStandardMaterial color="#c9a37a" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 0.85, 0.012, len / 2 + 5]}>
          <planeGeometry args={[1.7, len + 60]} />
          <meshStandardMaterial color="#b9b1a5" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 6, 0.012, len / 2 + 5]}>
          <planeGeometry args={[6, len + 60]} />
          <meshStandardMaterial color="#6a9448" />
        </mesh>
        <group position={[SEA - 9, 0, oz]} rotation-y={-Math.PI / 2 - 0.35}><PropMesh parts={operaP} /></group>
        <Scatter spots={geo.lawn} colors={['#5f8c3f', '#77a253', '#6a9648']}>
          <coneGeometry args={[0.05, 0.18, 3]} />
        </Scatter>
      </Batch>
      {homes.map((h, i) => <Many key={i} parts={h} at={geo.rows[i]} />)}
      <Many parts={gumP} at={geo.trees} />
      <Many parts={jacP} at={geo.blooms} />
      <Water x={SEA - 40} z={len / 2} w={80} d={len + 240} id="sydney" color="#5fb0d0" />
      <Sparkles edge={SEA} />
      <Gulls x={SEA - 4} />
      <Ferries len={len} x={SEA} />
      <FarSydney />
    </>
  )
}

function Ferries({ len, x }: { len: number; x: number }) {
  const boat = useProp('sydney-ferry', ferry)
  const refs = useRef<(Group | null)[]>([])
  const boats = useMemo(() => Array.from({ length: 4 }, (_, i) => ({ x: x - 6 - (i % 2) * 9, z: (i / 4) * (len + 60), v: (i % 2 ? -1 : 1) * 0.7 })), [len, x])
  useFrame((_, dt) => {
    boats.forEach((b, i) => {
      b.z += b.v * dt
      if (b.z > len + 70) b.z -= len + 90
      if (b.z < -20) b.z += len + 90
      refs.current[i]?.position.set(b.x, 0, b.z)
    })
  })
  return (
    <>
      {boats.map((b, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }} position={[b.x, 0, b.z]} rotation-y={b.v < 0 ? Math.PI : 0}>
          <PropMesh parts={boat} />
        </group>
      ))}
    </>
  )
}

// The steel arch bridge across the harbour ahead, and the city tower with its gold turret.
function FarSydney() {
  const parts = useProp('sydney-far', (k) => {
    const steel: Look = { c: '#8a9399', r: 0.6, m: 0.3 }
    const granite: Look = { c: '#cdbb9f', r: 0.9 }
    const z = 84
    const x0 = -66
    const x1 = -6
    const mid = (x0 + x1) / 2
    const half = (x1 - x0) / 2
    // The arch: an upper and lower chord with diagonal bracing, the deck hung below.
    for (let i = 0; i < 24; i++) {
      const a0 = Math.PI * (i / 24)
      const a1 = Math.PI * ((i + 1) / 24)
      const p = (a: number, r: number, h: number): [number, number, number] => [mid - Math.cos(a) * r, 6 + Math.sin(a) * h, z]
      k.rod(steel, p(a0, half - 2, 15), p(a1, half - 2, 15), 0.5, 6)
      k.rod(steel, p(a0, half - 2, 11.5), p(a1, half - 2, 11.5), 0.4, 6)
      k.rod(steel, p(a0, half - 2, 15), p(a1, half - 2, 11.5), 0.18, 4)
      const top = p(a0, half - 2, 11.5)
      if (top[1] > 9.2 && i % 2 === 0) k.rod(steel, [top[0], 9, z], top, 0.14, 4)
    }
    k.box(steel, [x1 - x0 + 18, 0.8, 4], [mid, 9, z])
    k.box({ c: '#5f676d', r: 0.6, m: 0.3 }, [x1 - x0 + 18, 0.4, 4.2], [mid, 8.5, z])
    // Granite pylons at both ends.
    for (const px of [x0 + 1, x1 - 1]) {
      k.box(granite, [3.6, 18, 5], [px, 9, z])
      k.box({ c: '#b9a586', r: 0.9 }, [4, 0.6, 5.4], [px, 18.3, z])
      for (const s of [-1, 1]) k.box({ c: '#6b5f4f', r: 1 }, [1.2, 3.4, 0.1], [px + s * 0.8, 13, z - 2.55])
    }
    // The city tower: a slim shaft with a gold drum and spire.
    const tx = 30
    const tz = 100
    k.cyl({ c: '#d8d8d8', r: 0.6 }, 0.7, 0.9, 34, [tx, 17, tz], undefined, 10)
    for (let i = 0; i < 10; i++) k.rod({ c: '#9e9e9e', r: 0.5, m: 0.5 }, [tx + Math.sin(i) * 2.5, 0, tz + Math.cos(i) * 2.5], [tx, 33, tz], 0.06, 4)
    k.cyl({ c: '#d9a63a', r: 0.3, m: 0.7 }, 3.0, 2.6, 4.0, [tx, 36, tz], undefined, 16)
    k.cyl({ c: '#3b4a52', r: 0.15, m: 0.4 }, 3.05, 3.05, 1.2, [tx, 36.5, tz], undefined, 16)
    k.cyl({ c: '#d9a63a', r: 0.3, m: 0.7 }, 0.2, 0.4, 7, [tx, 41.5, tz], undefined, 8)
    // The city's glass towers behind the terraces.
    const rr = rand(55)
    for (let i = 0; i < 12; i++) {
      const x = 8 + i * 6 + rr() * 2
      if (Math.abs(x - tx) < 4) continue
      const h = 10 + rr() * 22
      k.box(rr() < 0.5 ? { c: '#7f97a8', r: 0.3, m: 0.3 } : { c: '#b8b2a6', r: 0.7 }, [4, h, 4], [x, h / 2, 104 + rr() * 16])
    }
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
