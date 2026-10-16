import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, ShapeGeometry, SphereGeometry, type Group } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Batch } from '../Batch'
import { EDGE, Gulls, Horizon, Many, PropMesh, Scatter, Sparkles, Water, archTop, frustum, prop, rand, useProp, type Look, type PropKit, type Spot } from './kit'
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
  // Sandstone sill under the front window, a little front garden behind a sandstone dwarf wall
  // with an iron palisade, and a gate before the door.
  k.box(SAND_D, [0.6, 0.05, 0.08], [0.35, 0.27, f + 0.04])
  const fz = f + 0.8
  for (const [x0, x1] of [[-W / 2 + 0.06, -0.72], [-0.18, W / 2 - 0.06]]) {
    const w = x1 - x0
    k.box(SAND_D, [w, 0.14, 0.12], [(x0 + x1) / 2, 0.07, fz])
    k.box(SAND, [w + 0.02, 0.03, 0.14], [(x0 + x1) / 2, 0.155, fz])
    k.box(trim, [w, 0.025, 0.025], [(x0 + x1) / 2, 0.44, fz])
    for (let x = x0 + 0.06; x < x1 - 0.03; x += 0.12) k.rod(trim, [x, 0.17, fz], [x, 0.5, fz], 0.009, 4)
  }
  for (const x of [-0.72, -0.18]) k.box(SAND, [0.1, 0.5, 0.12], [x, 0.25, fz])
  k.box({ c: '#9a9488', r: 0.9 }, [0.5, 0.012, 0.46], [-0.45, 0.012, f + 0.53])
  for (const [x, c] of [[0.0, '#4f7a3e'], [0.55, '#5d8a46']] as const) k.ico({ c, r: 1 }, 0.17, [x, 0.2, f + 0.6], [1.2, 0.8, 1], 0)
  k.ico({ c: '#d94a7a', r: 1 }, 0.08, [0.25, 0.3, f + 0.62], [1, 1, 1], 0)
  // A ridge capping and a terracotta finial on the main roof.
  k.box({ c: '#8a7b72', r: 0.7 }, [0.4, 0.04, 0.52], [0, H + 0.715, -0.1])
  k.cone({ c: '#a15b3c', r: 0.9 }, 0.05, 0.18, [0, H + 0.825, -0.1], undefined, 6)
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

const PEL_BODY = new SphereGeometry(1, 8, 6)

// The foreshore furniture, repeated along the lawn (x 0 at the lawn's road edge, the sea wall at
// x -6): a slatted bench facing the water, a bin, an ornate cast iron lamp, a flowering
// bottlebrush, and out by the sea wall two timber piles, a pelican standing on one.
const IRON: Look = { c: '#24392f', r: 0.6 }
const TIMBER: Look = { c: '#7a5a3c', r: 0.9 }
function foreshore(k: PropKit) {
  // Bench: iron ends, timber slats, facing -x.
  for (const z of [-0.4, 0.4]) {
    k.box(IRON, [0.36, 0.03, 0.04], [-0.65, 0.24, z])
    k.box(IRON, [0.04, 0.24, 0.04], [-0.8, 0.12, z])
    k.box(IRON, [0.04, 0.24, 0.04], [-0.52, 0.12, z])
    k.box(IRON, [0.04, 0.5, 0.04], [-0.5, 0.36, z], [0, 0, -0.2])
    k.box(IRON, [0.16, 0.03, 0.04], [-0.86, 0.32, z])
  }
  for (let i = 0; i < 4; i++) k.box(TIMBER, [0.07, 0.025, 0.96], [-0.79 + i * 0.085, 0.265, 0])
  for (let i = 0; i < 3; i++) k.box(TIMBER, [0.025, 0.07, 0.96], [-0.47 + i * 0.022, 0.42 + i * 0.1, 0], [0, 0, -0.2])
  // Bin with a domed lid.
  k.cyl({ c: '#2e5d4b', r: 0.7 }, 0.13, 0.12, 0.42, [-0.45, 0.21, 1.1], undefined, 10)
  k.sphere({ c: '#24392f', r: 0.6 }, 0.135, [-0.45, 0.42, 1.1], [1, 0.5, 1], 10, 4, Math.PI / 2)
  k.box({ c: '#3a3a3a', r: 0.9 }, [0.08, 0.04, 0.015], [-0.32, 0.36, 1.1], [0, Math.PI / 2, 0])
  // Cast iron lamp: a fluted base, a slender post, a scrolled cross arm, two globes.
  const lx = -0.35
  const lz = -1.3
  k.cyl(IRON, 0.1, 0.14, 0.32, [lx, 0.16, lz], undefined, 8)
  k.cyl(IRON, 0.12, 0.12, 0.04, [lx, 0.34, lz], undefined, 8)
  k.cyl(IRON, 0.035, 0.05, 1.1, [lx, 0.9, lz], undefined, 8)
  k.cyl(IRON, 0.06, 0.06, 0.05, [lx, 1.0, lz], undefined, 8)
  k.box(IRON, [0.04, 0.04, 0.62], [lx, 1.46, lz])
  for (const s of [-1, 1]) {
    k.torus(IRON, 0.07, 0.012, [lx, 1.39, lz + s * 0.09], [0, Math.PI / 2, 0], Math.PI * 1.5, 8, 4)
    k.cyl(IRON, 0.03, 0.05, 0.06, [lx, 1.49, lz + s * 0.3], undefined, 8)
    k.sphere({ c: '#f6f1e2', r: 0.25 }, 0.085, [lx, 1.6, lz + s * 0.3], [1, 1.15, 1], 10, 7)
    k.cone(IRON, 0.05, 0.06, [lx, 1.71, lz + s * 0.3], undefined, 8)
  }
  k.cone(IRON, 0.03, 0.14, [lx, 1.55, lz], undefined, 6)
  // Bottlebrush: a dense green shrub studded with red brushes.
  const bx = -1.0
  const bz = 2.2
  for (const [x, y, z, r] of [[0, 0.35, 0, 0.36], [0.22, 0.3, 0.2, 0.26], [-0.2, 0.32, -0.18, 0.28], [0.05, 0.58, 0.05, 0.24]] as const) k.ico({ c: '#4f6f3a', r: 1 }, r, [bx + x, y, bz + z], [1, 0.8, 1], 0)
  // Brushes poke out all over the crown, each pointing away from its centre.
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4
    const up = 0.15 + ((i * 7) % 10) / 14
    const c = Math.sqrt(1 - up * up)
    const d: [number, number, number] = [Math.cos(a) * c, up, Math.sin(a) * c]
    const p: [number, number, number] = [bx + d[0] * 0.36, 0.4 + d[1] * 0.34, bz + d[2] * 0.36]
    k.cyl({ c: '#d0232e', r: 0.9 }, 0.04, 0.045, 0.17, [p[0] + d[0] * 0.08, p[1] + d[1] * 0.08, p[2] + d[2] * 0.08], [Math.acos(up), Math.atan2(d[0], d[2]), 0], 5)
  }
  // Two timber piles in the water by the sea wall, a pelican on the taller.
  for (const [x, z, h] of [[-6.6, 0.3, 1.05], [-6.75, 0.9, 0.85]] as const) {
    k.cyl(TIMBER, 0.09, 0.1, h + 0.3, [x, (h - 0.3) / 2, z], undefined, 8)
    k.cyl({ c: '#5e452e', r: 1 }, 0.095, 0.095, 0.04, [x, h, z], undefined, 8)
  }
  pelican(k, -6.6, 1.07, 0.3, 0.6)
}

// A pelican standing on p, facing ry: white body, black wing tips, a long pale-pink bill.
function pelican(k: PropKit, x: number, y: number, z: number, ry: number) {
  const at = (dx: number, dy: number, dz: number): [number, number, number] => [x + dx * Math.cos(ry) + dz * Math.sin(ry), y + dy, z - dx * Math.sin(ry) + dz * Math.cos(ry)]
  const white: Look = { c: '#f2f0ea', r: 0.8 }
  const black: Look = { c: '#1e1e1e', r: 0.8 }
  const bill: Look = { c: '#e9b07a', r: 0.6 }
  for (const s of [-1, 1]) k.cyl({ c: '#c9b08a', r: 0.8 }, 0.012, 0.012, 0.1, at(s * 0.04, 0.05, 0), undefined, 4)
  k.add(white, PEL_BODY, at(0, 0.2, -0.02), [-0.35, ry, 0], [0.11, 0.1, 0.19])
  for (const s of [-1, 1]) k.box(black, [0.02, 0.07, 0.16], at(s * 0.095, 0.2, -0.12), [-0.35, ry, 0])
  k.box(white, [0.06, 0.06, 0.08], at(0, 0.12, -0.18), [-0.6, ry, 0])
  k.rod(white, at(0, 0.27, 0.1), at(0, 0.4, 0.13), 0.035, 6)
  k.add(white, PEL_BODY, at(0, 0.43, 0.13), [0, ry, 0], [0.045, 0.045, 0.06])
  k.box(bill, [0.035, 0.025, 0.24], at(0, 0.4, 0.26), [0.5, ry, 0])
  k.box({ c: '#d99a8a', r: 0.7 }, [0.03, 0.04, 0.15], at(0, 0.37, 0.25), [0.5, ry, 0])
  k.box(black, [0.012, 0.012, 0.012], at(0.04, 0.445, 0.15), [0, ry, 0])
  k.box(black, [0.012, 0.012, 0.012], at(-0.04, 0.445, 0.15), [0, ry, 0])
}

// A music bandstand on the foreshore lawn: a sandstone base, eight iron posts with lace
// brackets, and an ogee roof of green copper with a finial.
function bandstand(k: PropKit) {
  const copper: Look = { c: '#5f9a84', r: 0.6 }
  k.cyl(SAND, 1.5, 1.6, 0.45, [0, 0.225, 0], [0, Math.PI / 8, 0], 8)
  k.cyl(SAND_D, 1.62, 1.62, 0.06, [0, 0.48, 0], [0, Math.PI / 8, 0], 8)
  // Steps up on the +x side, where the railing is left open.
  for (let i = 0; i < 3; i++) {
    const h = 0.45 - i * 0.15
    k.box(SAND_D, [0.22, h, 0.8], [1.45 + (i + 0.5) * 0.22, h / 2, 0])
  }
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    k.cyl(LACE, 0.04, 0.05, 1.6, [c * 1.4, 1.31, s * 1.4], undefined, 6)
    // Lace frieze between the posts, and a low railing (left open at the steps).
    const b = (i / 8) * Math.PI * 2
    const ex = Math.cos(b) * 1.29
    const ez = Math.sin(b) * 1.29
    const ry = -b + Math.PI / 2
    k.box(LACE, [1.05, 0.05, 0.03], [ex, 2.05, ez], [0, ry, 0])
    k.box(LACE, [1.05, 0.03, 0.02], [ex, 1.85, ez], [0, ry, 0])
    for (let j = 0; j < 5; j++) k.box(LACE, [0.08, 0.08, 0.012], [ex + Math.cos(ry) * (j - 2) * 0.2, 1.95, ez - Math.sin(ry) * (j - 2) * 0.2], [0, ry, Math.PI / 4])
    if (i !== 0) {
      k.box(LACE, [1.05, 0.03, 0.03], [ex, 0.95, ez], [0, ry, 0])
      for (let j = 0; j < 7; j++) k.box(LACE, [0.015, 0.42, 0.015], [ex + Math.cos(ry) * (j - 3) * 0.13, 0.72, ez - Math.sin(ry) * (j - 3) * 0.13], [0, ry, 0])
    }
  }
  k.cyl(IRON, 1.6, 1.6, 0.12, [0, 2.16, 0], [0, Math.PI / 8, 0], 8)
  k.cyl(copper, 1.0, 1.75, 0.5, [0, 2.47, 0], [0, Math.PI / 8, 0], 8)
  k.cyl(copper, 0.35, 1.0, 0.7, [0, 3.07, 0], [0, Math.PI / 8, 0], 8)
  k.cyl(copper, 0.06, 0.35, 0.5, [0, 3.67, 0], [0, Math.PI / 8, 0], 8)
  k.sphere({ c: '#d9a63a', r: 0.4 }, 0.08, [0, 3.98, 0])
  k.cyl({ c: '#d9a63a', r: 0.4 }, 0.01, 0.025, 0.35, [0, 4.2, 0], undefined, 5)
}

// A Federation corner hotel facing +z: red brick with cream bands, a green tiled dado, a
// two-storey verandah over the footpath with iron lace, a corner turret under a copper dome
// and a curved gable on the parapet. 6 wide, front at z = 2.
function pub(k: PropKit) {
  const brick: Look = { c: '#9c4a32', r: 0.95 }
  const cream: Look = { c: '#efe2c4', r: 0.85 }
  const tile: Look = { c: '#2f5a46', r: 0.4 }
  const glass: Look = { c: '#30404a', r: 0.3, m: 0.2 }
  const copper: Look = { c: '#5f9a84', r: 0.6 }
  const roof: Look = { c: '#a8553a', r: 0.85 }
  const W = 6
  const f = 2
  k.box(brick, [W, 3.2, 4], [0, 1.6, 0])
  k.box(tile, [W + 0.04, 0.7, 4.04], [0, 0.35, 0])
  for (const y of [0.72, 1.72, 3.0]) k.box(cream, [W + 0.06, 0.1, 4.06], [0, y, 0])
  // Ground floor: arched windows and a corner door; upstairs: sash windows in pairs.
  for (const x of [-2.2, -1.1, 0.6, 1.7]) {
    k.box(glass, [0.6, 0.5, 0.03], [x, 1.03, f + 0.01])
    archTop(k, glass, 0.6, 0.03, [x, 1.28, f + 0.01])
    archTop(k, cream, 0.72, 0.03, [x, 1.28, f + 0.005])
  }
  for (const x of [-2.4, -1.7, -0.6, 0.1, 1.0, 1.7]) {
    k.box(glass, [0.42, 0.72, 0.03], [x, 2.3, f + 0.01])
    k.box(cream, [0.42, 0.03, 0.04], [x, 2.3, f + 0.02])
    k.box(cream, [0.52, 0.06, 0.08], [x, 1.92, f + 0.03])
    k.box(cream, [0.52, 0.08, 0.06], [x, 2.7, f + 0.02])
  }
  // Parapet with a curved gable in the middle, a blank name panel, chimneys behind.
  k.box(brick, [W, 0.6, 0.18], [0, 3.5, f - 0.09])
  k.box(cream, [W + 0.08, 0.08, 0.24], [0, 3.82, f - 0.09])
  k.box(brick, [1.8, 0.7, 0.18], [-0.5, 4.15, f - 0.09])
  archTop(k, brick, 1.8, 0.18, [-0.5, 4.5, f - 0.09], 0, 0.5)
  k.box(cream, [1.3, 0.4, 0.04], [-0.5, 4.2, f + 0.01])
  k.sphere(cream, 0.08, [-0.5, 5.0, f - 0.09])
  frustum(k, roof, W - 0.2, 3.6, 1.0, 0.3, [0, 3.2, -0.2])
  for (const x of [-2.2, 1.4]) {
    k.box(brick, [0.4, 1.4, 0.4], [x, 4.0, -0.6])
    k.box(cream, [0.48, 0.08, 0.48], [x, 4.7, -0.6])
    k.cyl({ c: '#a15b3c', r: 0.9 }, 0.06, 0.06, 0.2, [x, 4.84, -0.6], undefined, 6)
  }
  // The corner turret: round, rising above the parapet under an ogee copper dome.
  const tx = W / 2 - 0.1
  const tz = f - 0.2
  k.cyl(brick, 0.6, 0.6, 4.2, [tx, 2.1, tz], undefined, 12)
  for (const y of [0.72, 1.55, 3.0, 3.85]) k.cyl(cream, 0.64, 0.64, 0.1, [tx, y, tz], undefined, 12)
  for (const a of [0.4, 1.2, 2.0]) k.box(glass, [0.24, 0.5, 0.03], [tx + Math.sin(a) * 0.61, 3.4, tz + Math.cos(a) * 0.61], [0, a, 0])
  // The corner door, in the turret's foot.
  k.box({ c: '#5a2a1e', r: 0.6 }, [0.46, 1.0, 0.08], [tx, 0.55, tz + 0.58])
  k.box(cream, [0.56, 0.1, 0.1], [tx, 1.1, tz + 0.6])
  k.sphere(copper, 0.66, [tx, 4.2, tz], [1, 1.1, 1], 12, 6, Math.PI / 2)
  k.cone(copper, 0.2, 0.6, [tx, 5.2, tz], undefined, 8)
  k.cyl({ c: '#d9a63a', r: 0.4 }, 0.01, 0.025, 0.5, [tx, 5.7, tz], undefined, 5)
  // The verandah over the footpath: posts at the kerb, a lace frieze, a balcony with a lace
  // railing, a bullnose iron roof.
  const vz = f + 1.4
  for (const x of [-2.8, -1.4, 0, 1.4, 2.4]) {
    k.box(LACE, [0.07, 2.6, 0.07], [x, 1.3, vz])
    k.box(LACE, [0.07, 0.04, 1.4], [x, 1.64, f + 0.7])
  }
  k.box({ c: '#7a1f2b', r: 0.6 }, [5.4, 0.1, 1.45], [-0.2, 1.72, f + 0.72])
  for (const y of [1.6, 2.5]) {
    k.box(LACE, [5.3, 0.04, 0.03], [-0.2, y, vz])
    for (let i = 0; i < 26; i++) k.box(LACE, [0.1, 0.1, 0.012], [-2.8 + 0.1 + i * 0.205, y - 0.1, vz], [0, 0, Math.PI / 4])
  }
  k.box(LACE, [5.3, 0.04, 0.03], [-0.2, 2.15, vz])
  for (let i = 0; i < 40; i++) k.box(LACE, [0.015, 0.36, 0.015], [-2.75 + i * 0.133, 1.96, vz])
  k.box({ c: '#9e8f86', r: 0.7, m: 0.2 }, [5.6, 0.04, 1.6], [-0.2, 2.77, f + 0.74], [0.2, 0, 0])
  k.box({ c: '#7a1f2b', r: 0.6 }, [5.6, 0.12, 0.04], [-0.2, 2.62, vz + 0.06])
}

// A yacht at her mooring, facing +z, sails up.
const HULL = (() => {
  const sh = new Shape()
  sh.moveTo(-0.26, -0.9)
  sh.lineTo(0.26, -0.9)
  sh.quadraticCurveTo(0.32, 0.2, 0, 0.95)
  sh.quadraticCurveTo(-0.32, 0.2, -0.26, -0.9)
  return new ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false, curveSegments: 5 }).rotateX(Math.PI / 2)
})()
const tri = (pts: [number, number][]) => {
  const sh = new Shape()
  sh.moveTo(...pts[0])
  pts.slice(1).forEach((p) => sh.lineTo(...p))
  sh.closePath()
  return new ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }).rotateY(-Math.PI / 2)
}
const MAIN = tri([[0, 0], [0.95, 0], [0.05, 2.1]])
const JIB = tri([[0, 0], [0.8, 0], [0, 1.85]])
function yacht(k: PropKit, hull: string) {
  const white: Look = { c: '#f7f6f0', r: 0.5 }
  const sail: Look = { c: '#fbfaf4', r: 0.9 }
  k.add({ c: hull, r: 0.5 }, HULL, [0, 0.32, 0], [0, 0, 0], [1, 0.42, 1])
  k.add({ c: '#1f2a44', r: 0.7 }, HULL, [0, 0.06, 0], [0, 0, 0], [1.02, 0.06, 1.01])
  k.add({ c: '#c9b28a', r: 0.9 }, HULL, [0, 0.34, 0], [0, 0, 0], [0.94, 0.02, 0.94])
  k.box(white, [0.32, 0.16, 0.6], [0, 0.42, -0.2])
  k.box({ c: '#30404a', r: 0.3 }, [0.33, 0.05, 0.4], [0, 0.44, -0.18])
  k.cyl({ c: '#d0d0d0', r: 0.4 }, 0.015, 0.02, 2.5, [0, 1.55, 0.15], undefined, 5)
  k.box({ c: '#d0d0d0', r: 0.4 }, [0.03, 0.03, 0.95], [0, 0.62, -0.32])
  k.add(sail, MAIN, [0, 0.64, 0.13], [0, Math.PI, 0])
  k.add(sail, JIB, [0, 0.4, 0.17], [0, 0, 0], [1, 1.08, 1])
  k.rod({ c: '#8a8a8a', r: 0.5 }, [0, 0.36, 0.95], [0, 2.4, 0.18], 0.006, 3)
}

export default function Sydney({ len, race }: WorldProps) {
  const homes = useMemo(() => TERR.map((t, i) => prop(`sydney-terrace-${i}`, (k) => terrace(k, t))), [])
  const gumP = useProp('sydney-gum', gum)
  const jacP = useProp('sydney-jacaranda', jacaranda)
  const operaP = useProp('sydney-opera', opera)
  const shoreP = useProp('sydney-foreshore', foreshore)
  const bandP = useProp('sydney-bandstand', bandstand)
  const pubP = useProp('sydney-pub', pub)
  const yachts = useMemo(() => ['#f7f6f0', '#1f3c5b', '#f7f6f0'].map((c, i) => prop(`sydney-yacht-${i}`, (k) => yacht(k, c))), [])
  const oz = race + 6
  const SEA = -(EDGE + 6)
  const hz = race * 0.4
  const bz = race * 0.62

  const geo = useMemo(() => {
    const r = rand(831)
    // Terraces come in runs of five to nine, with a lane or a park between runs.
    const rows: Spot[][] = TERR.map(() => [])
    const trees: Spot[] = []
    const blooms: Spot[] = []
    for (let z = -14; z < len + 40;) {
      const n = 5 + Math.floor(r() * 5)
      for (let i = 0; i < n; i++) {
        const t = Math.floor(r() * TERR.length)
        // The corner hotel takes the place of a few houses.
        if (Math.abs(z + i * 1.8 + 0.9 - hz) > 3.9) rows[t].push({ x: EDGE + 1.7 + 1.3, z: z + i * 1.8 + 0.9, ry: -Math.PI / 2 })
      }
      z += n * 1.8
      const gap = 2.5 + r() * 3
      const tree = { x: EDGE + 2.6, z: z + gap / 2, ry: r() * 6, s: 0.9 + r() * 0.3 }
      if (Math.abs(tree.z - hz) > 4) (r() < 0.5 ? blooms : trees).push(tree)
      z += gap
    }
    // Gums and jacarandas along the foreshore lawn.
    for (let z = -10; z < len + 40; z += 4 + r() * 5) {
      if (Math.abs(z - oz) < 16 || Math.abs(z - bz) < 4) continue
      ;(r() < 0.6 ? trees : blooms).push({ x: -(EDGE + 1.6 + r() * 2.2), z, ry: r() * 6, s: 0.85 + r() * 0.35 })
    }
    for (let z = -10; z < len + 40; z += 3 + r() * 3) trees.push({ x: EDGE + 6.6 + r() * 4, z, ry: r() * 6, s: 1 + r() * 0.4 })
    // Benches, lamps and bottlebrush along the lawn, pelicans on the piles by the sea wall.
    const shore: Spot[] = []
    for (let z = 6; z < len + 40; z += 11 + r() * 4) if (Math.abs(z - oz) > 14 && Math.abs(z - bz) > 4) shore.push({ x: -EDGE, z })
    // Yachts at their moorings, clear of the ferry lanes and the opera house's point.
    const boats: Spot[][] = [[], [], []]
    for (let z = 10, i = 0; z < len + 40; z += 14 + r() * 10, i++) {
      const x = SEA - [3.4, 10.6, 19.5][i % 3]
      if (Math.abs(z - oz) < 20 && x > SEA - 20) continue
      boats[i % 3].push({ x, z, ry: 0.5 + r() * 0.3 })
    }
    const rr = rand(21)
    const lawn = Array.from({ length: 300 }, () => ({ x: -(EDGE + 0.2 + rr() * 5), z: rr() * (len + 60) - 14, s: 0.7 + rr() * 0.6, ry: rr() * 6 }))
    return { rows, trees, blooms, lawn, shore, boats }
  }, [len, oz, hz, bz, SEA])

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
        <group position={[EDGE + 1.7 + 2, 0, hz]} rotation-y={-Math.PI / 2}><PropMesh parts={pubP} /></group>
        <group position={[-(EDGE + 3.4), 0, bz]}><PropMesh parts={bandP} /></group>
        {geo.boats.map((l, i) => l.map((b, j) => <group key={`${i}-${j}`} position={[b.x, 0, b.z]} rotation-y={b.ry}><PropMesh parts={yachts[i]} /></group>))}
        {/* Sandstone kerbs along the lawn and the footpath. */}
        <mesh position={[-(EDGE + 0.08), 0.03, len / 2 + 5]}>
          <boxGeometry args={[0.16, 0.06, len + 60]} />
          <meshStandardMaterial color="#cfae80" />
        </mesh>
        <mesh position={[EDGE + 0.07, 0.03, len / 2 + 5]}>
          <boxGeometry args={[0.14, 0.06, len + 60]} />
          <meshStandardMaterial color="#cfae80" />
        </mesh>
        <Scatter spots={geo.lawn} colors={['#5f8c3f', '#77a253', '#6a9648']}>
          <coneGeometry args={[0.05, 0.18, 3]} />
        </Scatter>
      </Batch>
      {homes.map((h, i) => <Many key={i} parts={h} at={geo.rows[i]} />)}
      <Many parts={gumP} at={geo.trees} />
      <Many parts={jacP} at={geo.blooms} />
      <Many parts={shoreP} at={geo.shore} />
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
