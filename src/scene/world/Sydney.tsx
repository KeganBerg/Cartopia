import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, IcosahedronGeometry, Shape, ShapeGeometry, SphereGeometry, type Group } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Batch } from '../Batch'
import { EDGE, Gulls, Horizon, Many, PropMesh, Scatter, Sparkles, Water, archTop, frustum, gable, person, prop, rand, useProp, type Dress, type Look, type PropKit, type Spot, type V3 } from './kit'
import type { WorldProps } from './WorldVenue'

// Australia, Sails Harbour: the strip runs round the harbour foreshore. Right: a lawn and the
// sea wall, a surf beach with its club and lifeguards, green-and-gold ferries crossing to the
// wooded north shore and its lighthouse headland, a ferry wharf, the opera house's white sails
// on their point by the finish, and the great steel arch bridge ahead. Left: sandstone terrace
// houses with iron lace verandahs, a milk bar or two, the sandstone post office and its clock
// tower, the corner hotel, a gum tree park with kangaroos and koalas, and behind them wool
// stores, deco flats, villas and church spires climbing the ridge to the city towers.

const SAND: Look = { c: '#d9b98a', r: 0.95 }
const SAND_D: Look = { c: '#c2a074', r: 0.95 }
const LACE: Look = { c: '#f4f4f0', r: 0.6 }
const DARK: Look = { c: '#2a2a2e', r: 1 }
const TILE: Look = { c: '#9e8f86', r: 0.7, m: 0.2 }
const GLASS: Look = { c: '#3a4650', r: 0.3, m: 0.2 }
const TERRA: Look = { c: '#b5532f', r: 0.85 }
const CREAM: Look = { c: '#efe2c4', r: 0.85 }
const BRICK: Look = { c: '#9c4a32', r: 0.95 }

// The same PropKit, moved (dx, dz), turned ry, scaled sc and lifted dy, so a piece built at its
// own origin can be dropped into a bigger prop (a run of terraces, a park's trees).
const sphGeos = new Map<string, SphereGeometry>()
const icoGeos = new Map<number, IcosahedronGeometry>()
function xf(k: PropKit, dx: number, dz: number, ry = 0, sc = 1, dy = 0): PropKit {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const P = (p: V3): V3 => [dx + (p[0] * c + p[2] * s) * sc, dy + p[1] * sc, dz + (-p[0] * s + p[2] * c) * sc]
  const R = (r?: V3): V3 => (r ? [r[0], r[1] + ry, r[2]] : [0, ry, 0])
  const S = (v: V3): V3 => [v[0] * sc, v[1] * sc, v[2] * sc]
  const o = {
    add: (l: Look, g: BufferGeometry, p: V3, r?: V3, sz: V3 = [1, 1, 1]) => (k.add(l, g, P(p), R(r), S(sz)), o),
    box: (l: Look, sz: V3, p: V3, r?: V3) => (k.box(l, S(sz), P(p), R(r)), o),
    cyl: (l: Look, rt: number, rb: number, h: number, p: V3, r?: V3, n = 10) => (k.cyl(l, rt * sc, rb * sc, h * sc, P(p), R(r), n), o),
    rod: (l: Look, a: V3, b: V3, rad: number, n = 6) => (k.rod(l, P(a), P(b), rad * sc, n), o),
    sphere: (l: Look, rad: number, p: V3, sz: V3 = [1, 1, 1], w = 10, h = 6, cap = Math.PI) => {
      const key = `${w}|${h}|${cap}`
      let g = sphGeos.get(key)
      if (!g) sphGeos.set(key, (g = new SphereGeometry(1, w, h, 0, Math.PI * 2, 0, cap)))
      k.add(l, g, P(p), [0, ry, 0], [rad * sz[0] * sc, rad * sz[1] * sc, rad * sz[2] * sc])
      return o
    },
    ico: (l: Look, rad: number, p: V3, sz: V3 = [1, 1, 1], detail = 1) => {
      let g = icoGeos.get(detail)
      if (!g) {
        icoGeos.set(detail, (g = new IcosahedronGeometry(1, detail)))
        g.computeVertexNormals()
      }
      k.add(l, g, P(p), [0, ry, 0], [rad * sz[0] * sc, rad * sz[1] * sc, rad * sz[2] * sc])
      return o
    },
    cone: (l: Look, rad: number, h: number, p: V3, r?: V3, n = 10) => (k.cone(l, rad * sc, h * sc, P(p), R(r), n), o),
    torus: (l: Look, R0: number, t: number, p: V3, r?: V3, arc?: number, seg?: number, tube?: number) => (k.torus(l, R0 * sc, t * sc, P(p), R(r), arc, seg, tube), o),
  }
  return o as unknown as PropKit
}

// Shop and building names in a little blocky type, each pixel row merged into one bar. Reads
// along +x (turned by ry), facing +z, centred on p.
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
  W: '101101111111101', Y: '101101010010010', '2': '110001010100111', '3': '110001010001110',
}
function text(k: PropKit, look: Look, str: string, p: V3, px: number, ry = 0, d = 0.02) {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const W = str.length * 4 - 1
  for (let i = 0; i < str.length; i++) {
    const g = FONT[str[i]]
    if (!g) continue
    for (let row = 0; row < 5; row++) {
      let col = 0
      while (col < 3) {
        if (g[row * 3 + col] !== '1') {
          col++
          continue
        }
        let e = col
        while (e < 3 && g[row * 3 + e] === '1') e++
        const u = (i * 4 + (col + e) / 2 - W / 2) * px
        k.box(look, [(e - col) * px, px, d], [p[0] + u * c, p[1] + (2 - row) * px, p[2] - u * s], [0, ry, 0])
        col = e
      }
    }
  }
}

// People: the townspeople's true size, dressed for an Australian summer. A wide sun hat goes on
// over the hair when asked for.
const PS = 1.3
const SKIN = ['#f3cfb0', '#e8b48e', '#c98e66', '#8a5a3c', '#f6dcc4', '#b07850']
const HAIR = ['#3b2a1e', '#8a5a2b', '#d8b46a', '#1c1c1c', '#a0522d', '#e6cf8f']
type Folk = Dress & { sunhat?: string }
function folk(k: PropKit, d: Folk, x: number, z: number, ry: number) {
  person(k, d, x, z, ry)
  if (d.sunhat) {
    const h: Look = { c: d.sunhat, r: 0.9 }
    k.cyl(h, 0.17, 0.17, 0.012, [x, 0.655 * PS, z], undefined, 10)
    k.cyl(h, 0.075 * PS, 0.088 * PS, 0.07 * PS, [x, 0.69 * PS, z], undefined, 8)
    k.cyl({ c: '#5d4037', r: 0.9 }, 0.0885 * PS, 0.0885 * PS, 0.016 * PS, [x, 0.664 * PS, z], undefined, 8)
  }
}
const BOARD = new SphereGeometry(1, 10, 4)
const SPH = new SphereGeometry(1, 8, 6)

// Local frame helper: (u across, y, w forward) turned by ry about (x, z).
const frame = (x: number, z: number, ry: number) => {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  return (u: number, y: number, w: number): V3 => [x + u * c + w * s, y, z - u * s + w * c]
}

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
  k.box({ c: t.door, r: 0.6 }, [0.42, 0.85, 0.04], [-0.45, 0.62, f + 0.01])
  k.box({ c: '#9fc3d1', r: 0.2, m: 0.2 }, [0.42, 0.14, 0.03], [-0.45, 1.13, f + 0.01])
  k.box({ c: '#30404a', r: 0.3, m: 0.2 }, [0.5, 0.8, 0.03], [0.35, 0.68, f + 0.01])
  k.box(trim, [0.62, 0.08, 0.06], [0.35, 1.1, f + 0.02])
  k.box({ c: '#b9b3a8', r: 0.8 }, [W - 0.2, 0.08, 0.5], [0, 0.24, f + 0.25])
  // A house number plate and a brass knocker by the door.
  k.box(LACE, [0.1, 0.07, 0.01], [-0.45, 1.27, f + 0.006])
  k.box({ c: '#c9a24a', r: 0.4 }, [0.04, 0.05, 0.02], [-0.45, 0.8, f + 0.035])
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
  // A pot plant and a hanging fern on the balcony.
  k.cyl({ c: '#b5532f', r: 0.9 }, 0.07, 0.05, 0.12, [0.62, 1.56, f + 0.3], undefined, 6)
  k.ico({ c: '#4f7a3e', r: 1 }, 0.11, [0.62, 1.7, f + 0.3], [1, 0.8, 1], 0)
  k.ico({ c: '#5d8a46', r: 1 }, 0.1, [-0.62, 2.0, f + 0.3], [1, 0.7, 1], 0)
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

// A corner milk bar facing +z, 3.6 wide: cream parapet with its name, a red awning over the
// footpath, a window of sweets, an ice cream sign and a drinks fridge out front.
function milkbar(k: PropKit, name: string, aw: string) {
  const wall: Look = { c: '#f0e6d2', r: 0.9 }
  const awn: Look = { c: aw, r: 0.8 }
  const f = 1.3
  k.box(wall, [3.6, 2.2, 2.6], [0, 1.1, 0])
  k.box(CREAM, [3.6, 0.75, 0.15], [0, 2.55, f - 0.075])
  k.box(CREAM, [1.4, 0.25, 0.15], [0, 3.05, f - 0.075])
  k.box(SAND_D, [3.66, 0.06, 0.2], [0, 2.93, f - 0.075])
  text(k, awn, name, [0, 2.55, f + 0.012], 0.065)
  k.box({ c: '#a9adb0', r: 0.6 }, [3.5, 0.06, 2.45], [0, 2.24, -0.08])
  // Shopfront: a big window over green tiles, the door, posters on the glass.
  k.box(GLASS, [1.8, 1.0, 0.03], [-0.65, 1.0, f + 0.01])
  k.box({ c: '#2f5a46', r: 0.4 }, [1.9, 0.4, 0.05], [-0.65, 0.2, f + 0.02])
  k.box({ c: '#5a2a1e', r: 0.6 }, [0.62, 1.3, 0.04], [0.95, 0.65, f + 0.01])
  k.box(GLASS, [0.4, 0.5, 0.02], [0.95, 0.92, f + 0.035])
  for (const [x, y, c] of [[-1.2, 1.2, '#fdd835'], [-0.75, 0.85, '#e53935'], [-0.25, 1.15, '#42a5f5']] as const) k.box({ c, r: 0.8 }, [0.28, 0.32, 0.01], [x, y, f + 0.03])
  // The awning, its striped valance, and the tie rods back to the wall.
  k.box(awn, [3.7, 0.07, 1.1], [0, 1.78, f + 0.55], [-0.08, 0, 0])
  for (let i = 0; i < 9; i++) k.box(i % 2 ? awn : LACE, [0.41, 0.18, 0.03], [-1.64 + i * 0.41, 1.66, f + 1.1])
  for (const x of [-1.5, 1.5]) k.rod(DARK, [x, 2.3, f], [x, 1.82, f + 1.05], 0.012, 4)
  // Ice cream A-frame and a drinks fridge.
  for (const s of [-1, 1]) k.box(LACE, [0.36, 0.55, 0.02], [-1.35, 0.27, f + 0.62 + s * 0.08], [s * 0.15, 0, 0])
  k.cone({ c: '#d9a35a', r: 0.8 }, 0.06, 0.16, [-1.35, 0.26, f + 0.715], [Math.PI, 0, 0], 6)
  k.sphere({ c: '#f48fb1', r: 0.8 }, 0.07, [-1.35, 0.38, f + 0.715], [1, 1, 0.3], 8, 5)
  k.box({ c: '#d32f2f', r: 0.6 }, [0.45, 0.85, 0.4], [1.5, 0.425, f + 0.3])
  k.box(GLASS, [0.36, 0.55, 0.02], [1.5, 0.5, f + 0.505])
  k.box(LACE, [0.36, 0.1, 0.02], [1.5, 0.75, f + 0.505])
  // A bench by the door, a bike against the wall.
  k.box({ c: '#7a5a3c', r: 0.9 }, [0.7, 0.04, 0.22], [0.2, 0.25, f + 0.3])
  for (const x of [-0.1, 0.5]) k.box(DARK, [0.04, 0.25, 0.2], [x, 0.125, f + 0.3])
  for (const x of [-1.95, -1.45]) k.torus(DARK, 0.15, 0.012, [x, 0.16, f + 0.15], [0, 0, 0], Math.PI * 2, 10, 3)
  k.rod({ c: '#1e88e5', r: 0.6 }, [-1.95, 0.16, f + 0.15], [-1.7, 0.36, f + 0.15], 0.015, 4)
  k.rod({ c: '#1e88e5', r: 0.6 }, [-1.7, 0.36, f + 0.15], [-1.45, 0.16, f + 0.15], 0.015, 4)
  k.rod({ c: '#1e88e5', r: 0.6 }, [-1.7, 0.36, f + 0.15], [-1.75, 0.45, f + 0.15], 0.015, 4)
}

// The second row behind the terraces, front at z = 2: a sandstone wool store, red brick deco
// flats, a Federation villa and a sandstone church with its spire.
function woolStore(k: PropKit) {
  const st: Look = { c: '#cfa877', r: 0.95 }
  k.box(st, [5, 4.8, 4], [0, 2.4, 0])
  k.box(SAND_D, [5.04, 0.5, 4.04], [0, 0.25, 0])
  for (const y of [1.25, 2.45, 3.65]) k.box(SAND_D, [5.06, 0.08, 4.06], [0, y, 0])
  for (let i = 0; i < 4; i++) {
    const x = -1.8 + i * 1.2
    k.box(GLASS, [0.6, 0.55, 0.03], [x, 0.78, 2.01])
    archTop(k, GLASS, 0.6, 0.03, [x, 1.05, 2.01])
    for (const y of [1.85, 3.05, 4.15]) {
      k.box(GLASS, [0.5, 0.7, 0.03], [x, y, 2.01])
      k.box(SAND_D, [0.62, 0.06, 0.07], [x, y - 0.38, 2.03])
    }
  }
  k.box(SAND_D, [5.2, 0.16, 4.2], [0, 4.85, 0])
  k.box(st, [5, 0.42, 0.12], [0, 5.12, 1.94])
  text(k, { c: '#5a4632', r: 0.9 }, 'WOOL STORE', [0, 5.12, 2.013], 0.075)
  // A loading door and its hoist beam.
  k.box({ c: '#5a3e2a', r: 0.9 }, [0.7, 1.0, 0.03], [0, 3.05, 2.025])
  k.box({ c: '#5a3e2a', r: 0.9 }, [0.1, 0.1, 0.6], [0, 4.45, 2.2])
}
function decoFlats(k: PropKit) {
  const brick: Look = { c: '#a65a3e', r: 0.95 }
  k.box(brick, [6, 5.8, 4], [0, 2.9, 0])
  for (let r = 0; r < 5; r++) {
    const y = 0.6 + r * 1.12
    for (const x of [-2.2, -1.2, 1.2, 2.2]) k.box(GLASS, [0.7, 0.6, 0.03], [x, y + 0.1, 2.01])
    k.box(CREAM, [6.04, 0.1, 4.04], [0, y + 0.48, 0])
    if (r > 0) {
      for (const s of [-1, 1]) {
        k.box(CREAM, [1.7, 0.06, 0.42], [s * 1.7, y - 0.2, 2.21])
        k.box(CREAM, [1.7, 0.26, 0.04], [s * 1.7, y - 0.05, 2.4])
      }
    }
  }
  k.box(CREAM, [0.8, 6.8, 0.3], [0, 3.4, 2.1])
  k.box(GLASS, [0.3, 4.4, 0.03], [0, 3.4, 2.265])
  k.box({ c: '#3a2a20', r: 0.7 }, [0.5, 0.85, 0.03], [0, 0.43, 2.265])
  k.box(CREAM, [6.08, 0.3, 4.08], [0, 5.75, 0])
  for (const s of [-1, 1]) k.box(CREAM, [0.15, 0.6, 0.15], [s * 0.35, 7.05, 2.1])
}
function villa(k: PropKit) {
  k.box(BRICK, [4.4, 2.6, 4], [0, 1.3, 0])
  k.box(CREAM, [4.44, 0.1, 4.04], [0, 1.3, 0])
  for (const y of [0.75, 1.95]) for (const x of [-1.5, -0.6]) {
    k.box(GLASS, [0.45, 0.65, 0.03], [x, y, 2.01])
    k.box(CREAM, [0.55, 0.07, 0.06], [x, y + 0.37, 2.02])
  }
  // The front bay under its own gable, a turned finial on top.
  k.box(BRICK, [1.8, 2.6, 0.6], [1.1, 1.3, 2.3])
  for (const y of [0.75, 1.95]) k.box(GLASS, [1.1, 0.65, 0.03], [1.1, y, 2.61])
  gable(k, TERRA, 1.3, 2.0, 1.1, [1.1, 2.6, 2.05], Math.PI / 2)
  k.cone(TERRA, 0.05, 0.25, [1.1, 3.82, 2.6], undefined, 6)
  frustum(k, TERRA, 4.6, 4.2, 1.6, 0.25, [0, 2.6, 0])
  for (const x of [-1.6, 0.9]) {
    k.box(BRICK, [0.38, 1.6, 0.38], [x, 4.0, -0.8])
    k.box(CREAM, [0.45, 0.07, 0.45], [x, 4.8, -0.8])
  }
  // A timber verandah with fretwork across the rest of the front.
  for (const x of [-2.05, -0.3]) k.box(LACE, [0.07, 1.25, 0.07], [x, 0.63, 2.65])
  k.box({ c: '#9e8f86', r: 0.7 }, [1.95, 0.05, 0.75], [-1.15, 1.3, 2.35], [0.12, 0, 0])
  for (let i = 0; i < 8; i++) k.box(LACE, [0.06, 0.06, 0.012], [-1.98 + i * 0.23, 1.15, 2.66], [0, 0, Math.PI / 4])
}
function church(k: PropKit) {
  const st: Look = { c: '#d2ad7c', r: 0.95 }
  const slate: Look = { c: '#5b5e66', r: 0.8 }
  k.box(st, [3.2, 3.2, 4], [-0.8, 1.6, 0])
  gable(k, slate, 4.1, 3.5, 1.8, [-0.8, 3.2, 0], Math.PI / 2)
  gable(k, st, 0.2, 3.2, 1.75, [-0.8, 3.2, 1.92], Math.PI / 2)
  k.box(GLASS, [0.7, 1.3, 0.03], [-0.8, 1.55, 2.01])
  archTop(k, GLASS, 0.7, 0.03, [-0.8, 2.2, 2.01], 0, 1.7)
  k.cyl(GLASS, 0.32, 0.32, 0.03, [-0.8, 3.75, 2.035], [Math.PI / 2, 0, 0], 10)
  for (const s of [-1, 1]) k.box(SAND_D, [0.3, 3.4, 0.4], [-0.8 + s * 1.55, 1.7, 1.9])
  // The tower: buttressed, louvred belfry, pinnacles, a slate spire and a cross.
  k.box(st, [1.6, 6.4, 1.6], [1.6, 3.2, 1.1])
  for (const sx of [-1, 1]) k.box(SAND_D, [0.25, 6.4, 0.25], [1.6 + sx * 0.8, 3.2, 1.9])
  for (const [dx, dz, ry] of [[0, 0.81, 0], [0, -0.81, 0], [0.81, 0, Math.PI / 2], [-0.81, 0, Math.PI / 2]] as const) {
    k.box(DARK, [0.5, 0.9, 0.03], [1.6 + dx, 5.4, 1.1 + dz], [0, ry, 0])
    archTop(k, DARK, 0.5, 0.03, [1.6 + dx, 5.85, 1.1 + dz], ry)
  }
  k.box({ c: '#3a2a20', r: 0.8 }, [0.6, 1.0, 0.03], [1.6, 0.5, 1.91])
  archTop(k, { c: '#3a2a20', r: 0.8 }, 0.6, 0.03, [1.6, 1.0, 1.91])
  k.box(SAND_D, [1.8, 0.2, 1.8], [1.6, 6.5, 1.1])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cone(st, 0.1, 0.6, [1.6 + sx * 0.8, 6.9, 1.1 + sz * 0.8], undefined, 4)
  k.cone(slate, 0.95, 4.2, [1.6, 8.7, 1.1], [0, Math.PI / 4, 0], 4)
  k.box({ c: '#c9a24a', r: 0.5 }, [0.05, 0.5, 0.05], [1.6, 11.0, 1.1])
  k.box({ c: '#c9a24a', r: 0.5 }, [0.3, 0.05, 0.05], [1.6, 11.1, 1.1])
}
// Each with its width along the street; the church comes round now and then.
const BACKS: [(k: PropKit) => void, number, number][] = [[woolStore, 5, 3], [decoFlats, 6, 3], [villa, 4.4, 3.5], [church, 5, 0.8]]

// A 48-long stretch of hillside running along z, rising away from the road on `side`: green
// hills of red-roofed houses and dark trees; across the harbour, sandstone cliffs at the water.
function hills(k: PropKit, seed: number, side: number, cliff: boolean) {
  const r = rand(seed)
  const green = ['#5f7f45', '#6b8a4c', '#56763f']
  const bumps: [number, number, number, number][] = []
  for (let i = 0; i < 7; i++) bumps.push([7 + r() * 6, -24 + i * 8 + r() * 2, 6.5 + r() * 3, (cliff ? 3.5 : 6) + r() * 3])
  const hAt = (u: number, z: number) => {
    let h = 0
    for (const [bu, bz, R, H] of bumps) {
      const d = ((u - bu) ** 2 + (z - bz) ** 2) / (R * R)
      if (d < 1) h = Math.max(h, H * Math.sqrt(1 - d))
    }
    return h
  }
  bumps.forEach(([bu, bz, R, H], i) => k.sphere({ c: green[i % 3], r: 1 }, 1, [side * bu, 0, bz], [R, H, R], 10, 4, Math.PI / 2))
  if (cliff) {
    const rock = ['#c9a273', '#b98f62', '#d8b585']
    for (let z = -24; z < 24; z += 1.8 + r() * 1.2) {
      const h = 1.0 + r() * 1.5
      k.box({ c: rock[Math.floor(r() * 3)], r: 1 }, [1.8 + r() * 0.8, h, 2.2 + r() * 0.8], [side * (1 + r() * 0.6), h / 2, z], [0, r() * 0.5 - 0.25, 0])
      const h2 = 2.0 + r() * 1.4
      k.box({ c: rock[Math.floor(r() * 3)], r: 1 }, [2.2, h2, 2.6], [side * (3 + r() * 0.8), h2 / 2, z + 0.6], [0, r() * 0.4 - 0.2, 0])
    }
  }
  const walls = ['#f2ede2', '#e8dcc4', '#d9c7a4', '#f6f1ea', '#e7c9a0']
  for (let i = 0; i < (cliff ? 22 : 30); i++) {
    const u = 3.5 + r() * 11
    const z = -23 + r() * 46
    const y = hAt(u, z)
    if (y < (cliff ? 2.6 : 0.8)) continue
    const turn = r() < 0.5
    const wall: Look = { c: walls[Math.floor(r() * walls.length)], r: 0.9 }
    k.box(wall, [1.2, 1.4, 1.0], [side * u, y + 0.1, z], [0, turn ? Math.PI / 2 : 0, 0])
    gable(k, r() < 0.8 ? TERRA : { c: '#6d6e70', r: 0.8 }, 1.35, 1.15, 0.55, [side * u, y + 0.8, z], turn ? Math.PI / 2 : 0)
    const face = side * u - side * (turn ? 0.51 : 0.61)
    for (const dz of [-0.25, 0.25]) k.box(GLASS, [0.02, 0.3, 0.26], [face, y + 0.35, z + dz])
  }
  const leaf = ['#2f5a34', '#3d6b3a', '#4a7a40']
  for (let i = 0; i < 34; i++) {
    const u = 1 + r() * 15
    const z = -24 + r() * 48
    const y = hAt(u, z)
    if (cliff && y < 2.2) continue
    const rad = 0.6 + r() * 0.7
    k.ico({ c: leaf[i % 3], r: 1 }, rad, [side * u, y + rad * 0.45, z], [1, 0.85, 1], 0)
  }
}

// A gum tree: a pale twisting trunk and loose clumps of grey-green leaves, a pair of white
// cockatoos with yellow crests perched on its branches.
function gum(k: PropKit, cockies = true) {
  const bark: Look = { c: '#e4ddd0', r: 0.9 }
  k.rod(bark, [0, 0, 0], [0.15, 1.6, 0.05], 0.13, 7)
  k.rod(bark, [0.15, 1.6, 0.05], [-0.3, 2.8, 0.1], 0.09, 6)
  k.rod(bark, [0.15, 1.6, 0.05], [0.7, 2.6, -0.2], 0.08, 6)
  k.rod(bark, [0.05, 2.2, 0.08], [0.3, 3.4, 0.4], 0.06, 5)
  // Strips of peeling bark.
  k.box({ c: '#b8a58a', r: 1 }, [0.05, 0.4, 0.2], [0.1, 0.9, 0.1], [0, 0.4, 0.08])
  const leaf = ['#7f9a74', '#6d8a66', '#8ea57f']
  ;[[-0.3, 3.0, 0.1, 0.65], [0.75, 2.85, -0.2, 0.6], [0.3, 3.6, 0.4, 0.55], [0.1, 3.3, -0.4, 0.5]].forEach(([x, y, z, r], i) => k.ico({ c: leaf[i % 3], r: 1 }, r, [x, y, z], [1, 0.75, 1], 1))
  if (cockies) {
    cocky(k, 0.42, 2.11, -0.07, 0.6)
    cocky(k, 0.52, 2.27, -0.11, -0.9)
  }
}
function cocky(k: PropKit, x: number, y: number, z: number, ry: number) {
  const at = frame(x, z, ry)
  const white: Look = { c: '#f6f6f2', r: 0.7 }
  k.add(white, SPH, at(0, y + 0.07, 0), [0.35, ry, 0], [0.045, 0.07, 0.05])
  k.add(white, SPH, at(0, y + 0.15, 0.03), [0, ry, 0], [0.036, 0.036, 0.038])
  k.cone({ c: '#f2c230', r: 0.8 }, 0.018, 0.08, at(0, y + 0.2, 0.0), [-0.6, ry, 0], 5)
  k.box({ c: '#3a3a3a', r: 0.8 }, [0.018, 0.022, 0.025], at(0, y + 0.14, 0.07), [0, ry, 0])
  k.box(white, [0.04, 0.012, 0.08], at(0, y + 0.02, -0.06), [0.5, ry, 0])
}

// A jacaranda in full purple bloom.
function jacaranda(k: PropKit) {
  const bark: Look = { c: '#5a4a3e', r: 1 }
  k.cyl(bark, 0.09, 0.13, 1.4, [0, 0.7, 0], undefined, 7)
  for (const [x, z] of [[0.6, 0.2], [-0.5, 0.3], [0.1, -0.6]]) k.rod(bark, [0, 1.2, 0], [x, 2.0, z], 0.06, 5)
  const bloom = ['#9b7fd1', '#8a6cc4', '#a98ddb']
  ;[[0, 2.3, 0, 0.9], [0.7, 2.1, 0.2, 0.65], [-0.6, 2.15, 0.3, 0.65], [0.1, 2.1, -0.65, 0.6], [0, 2.75, 0, 0.6]].forEach(([x, y, z, r], i) => k.ico({ c: bloom[i % 3], r: 1 }, r, [x, y, z], [1, 0.7, 1], 1))
}

// A Norfolk Island pine, the beachfront tree: a tall straight trunk and flat tiers of branches.
function norfolk(k: PropKit) {
  k.cyl({ c: '#6d5440', r: 1 }, 0.06, 0.14, 5.4, [0, 2.7, 0], undefined, 7)
  const leaf = ['#2f5a3a', '#376643']
  for (let i = 0; i < 8; i++) {
    const y = 1.5 + i * 0.55
    const rad = 0.25 + 1.15 * (1 - i / 8)
    k.cone({ c: leaf[i % 2], r: 1 }, rad, 0.32, [0, y, 0], [0, i * 0.4, 0], 7)
  }
  k.cone({ c: '#2f5a3a', r: 1 }, 0.18, 0.7, [0, 5.95, 0], undefined, 6)
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
  // The podium's granite cladding bands and a promenade railing round its edge.
  for (const y of [0.4, 1.0]) k.box({ c: '#b9997a', r: 0.9 }, [14.04, 0.08, 26.04], [0, y, 0])
  for (const s of [-1, 1]) {
    k.box(LACE, [0.04, 0.04, 25.6], [s * 6.95, 1.95, -0.2])
    for (let z = -12.8; z < 12.5; z += 0.9) k.box(LACE, [0.03, 0.35, 0.03], [s * 6.95, 1.78, z])
  }
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
// Visitors on the opera house promenade, standing on the podium (placed at its top).
function operaFolk(k: PropKit) {
  const dress: Folk[] = [
    { top: '#ffffff', low: '#1f2a44', skin: SKIN[0], hair: HAIR[2], sunhat: '#f1e3c0' },
    { top: '#e53935', low: '#e53935', robe: true, skin: SKIN[2], hair: HAIR[0] },
    { top: '#26a69a', low: '#37474f', skin: SKIN[3], hair: HAIR[3], hat: 'cap', hatC: '#1e88e5' },
    { top: '#fdd835', low: '#455a64', skin: SKIN[1], hair: HAIR[1], wave: true },
    { top: '#7e57c2', low: '#7e57c2', robe: true, skin: SKIN[4], hair: HAIR[5], sunhat: '#ffffff' },
  ]
  const spots: [number, number, number][] = [[6.4, 9, 1.6], [6.3, 4.2, 1.4], [6.45, 3.6, -1.6], [-6.4, 6, -1.5], [-6.3, -2, -1.6], [6.4, -4.5, 1.7], [-6.45, 10.5, -1.2], [0.5, 12.6, 0.2], [-1.1, 12.9, 0.4]]
  spots.forEach(([x, z, ry], i) => folk(k, dress[i % dress.length], x, z, ry))
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
  // Rubbing strake, wheelhouses at both ends, life rings on the rails.
  k.box({ c: '#3a2a20', r: 0.8 }, [1.64, 0.08, 5.24], [0, 0.6, 0])
  for (const s of [-1, 1]) {
    k.box(LACE, [0.9, 0.35, 0.5], [0, 2.1, s * 1.3])
    k.box(DARK, [0.92, 0.14, 0.3], [0, 2.15, s * 1.3])
    k.torus({ c: '#ff7043', r: 0.7 }, 0.1, 0.025, [s * 0.77, 1.05, 1.4], [0, Math.PI / 2, 0], Math.PI * 2, 8, 4)
  }
}

const PEL_BODY = SPH

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
  // An ibis on the bin's lid, as ever.
  ibis(k, -0.45, 1.1, 2.4, false, 0.48)
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

// An Australian white ibis: white body, black bare head and neck, a long down-curved bill.
function ibis(k: PropKit, x: number, z: number, ry: number, peck: boolean, y = 0) {
  const at = frame(x, z, ry)
  const white: Look = { c: '#ecebe6', r: 0.8 }
  const black: Look = { c: '#1a1a1a', r: 0.8 }
  for (const s of [-1, 1]) k.rod(black, at(s * 0.025, y, 0), at(s * 0.025, y + 0.16, 0), 0.008, 3)
  k.add(white, SPH, at(0, y + 0.21, 0), [peck ? 0.3 : -0.1, ry, 0], [0.065, 0.06, 0.11])
  k.box(black, [0.07, 0.035, 0.06], at(0, y + 0.22, -0.11), [-0.2, ry, 0])
  const neck = peck ? [at(0, y + 0.24, 0.08), at(0, y + 0.12, 0.17), at(0, y + 0.03, 0.24)] : [at(0, y + 0.24, 0.08), at(0, y + 0.34, 0.12), at(0, y + 0.27, 0.24)]
  k.rod(black, neck[0], neck[1], 0.016, 4)
  k.sphere(black, 0.024, neck[1], [1, 1, 1], 6, 4)
  const mid: V3 = peck ? at(0, y + 0.07, 0.21) : at(0, y + 0.33, 0.18)
  k.rod(black, neck[1], mid, 0.007, 3)
  k.rod(black, mid, neck[2], 0.006, 3)
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
  // A brass band of three on the stand (its floor at 0.51).
  const band = xf(k, 0, 0, 0, 1, 0.51)
  const red: Folk = { top: '#b71c1c', low: '#1f2a44', skin: SKIN[0], hair: HAIR[0], hat: 'cap', hatC: '#1f2a44' }
  folk(band, red, -0.5, -0.4, Math.PI / 2)
  folk(band, { ...red, skin: SKIN[2] }, -0.4, 0.5, Math.PI / 2)
  folk(band, { ...red, skin: SKIN[4], hair: HAIR[2] }, 0.3, 0, Math.PI / 2)
  k.torus({ c: '#d9a63a', r: 0.4 }, 0.09, 0.02, [-0.32, 0.95, -0.4], [0, Math.PI / 2, 0], Math.PI * 2, 10, 4)
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
  // Parapet with a curved gable in the middle and the hotel's name, chimneys behind.
  k.box(brick, [W, 0.6, 0.18], [0, 3.5, f - 0.09])
  k.box(cream, [W + 0.08, 0.08, 0.24], [0, 3.82, f - 0.09])
  k.box(brick, [1.8, 0.7, 0.18], [-0.5, 4.15, f - 0.09])
  archTop(k, brick, 1.8, 0.18, [-0.5, 4.5, f - 0.09], 0, 0.5)
  k.box(cream, [1.5, 0.4, 0.04], [-0.5, 4.2, f + 0.01])
  text(k, { c: '#2f5a46', r: 0.6 }, 'WATTLE', [-0.5, 4.2, f + 0.04], 0.05)
  text(k, cream, 'HOTEL', [-0.5, 3.48, f + 0.012], 0.07)
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
  // Drinkers under the verandah: tall tables, a keg by the door, three mates with schooners.
  for (const x of [-1.9, 0.9]) {
    k.cyl(DARK, 0.03, 0.05, 0.5, [x, 0.25, f + 0.75], undefined, 6)
    k.cyl({ c: '#7a5a3c', r: 0.8 }, 0.2, 0.2, 0.03, [x, 0.51, f + 0.75], undefined, 10)
    for (const dx of [-0.07, 0.08]) k.cyl({ c: '#e0a83a', r: 0.3 }, 0.022, 0.02, 0.07, [x + dx, 0.56, f + 0.75], undefined, 6)
  }
  k.cyl({ c: '#9aa0a6', r: 0.4 }, 0.12, 0.12, 0.3, [2.0, 0.15, f + 0.4], undefined, 8)
  folk(k, { top: '#1565c0', low: '#455a64', skin: SKIN[1], hair: HAIR[0], hat: 'cap', hatC: '#fdd835' }, -2.25, f + 0.85, 0.9)
  folk(k, { top: '#f5f5f5', low: '#b49a6a', skin: SKIN[4], hair: HAIR[5] }, -1.55, f + 0.9, -1.2)
  folk(k, { top: '#2e7d32', low: '#37474f', skin: SKIN[2], hair: HAIR[3], sunhat: '#c8a96a' }, 0.55, f + 0.9, 1.1)
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

// Footpath furniture by the terraces (x 0 at the kerb, road at -x): a street lamp leaning out
// over the road, a red pillar post box, and a pair of wheelie bins out for collection.
function street(k: PropKit) {
  const pole: Look = { c: '#3d4a44', r: 0.6 }
  k.cyl(pole, 0.05, 0.07, 0.35, [0, 0.175, 0], undefined, 8)
  k.cyl(pole, 0.035, 0.05, 2.5, [0, 1.6, 0], undefined, 7)
  k.rod(pole, [0, 2.75, 0], [-0.25, 2.88, 0], 0.025, 5)
  k.rod(pole, [-0.25, 2.88, 0], [-0.55, 2.86, 0], 0.025, 5)
  k.box({ c: '#59605c', r: 0.6 }, [0.34, 0.07, 0.15], [-0.62, 2.83, 0])
  k.box({ c: '#f6f1e2', r: 0.3 }, [0.28, 0.02, 0.11], [-0.62, 2.79, 0])
  // A blue street name blade.
  k.box({ c: '#1f3c7a', r: 0.6 }, [0.02, 0.1, 0.5], [0.04, 2.0, 0.2])
  for (let i = 0; i < 5; i++) k.box(LACE, [0.01, 0.03, 0.05], [0.055, 2.0, 0.04 + i * 0.075])
  // Post box: red pillar, domed cap, slot, a white collection plate.
  const red: Look = { c: '#c62828', r: 0.6 }
  k.cyl(red, 0.12, 0.13, 0.55, [0.2, 0.275, 1.3], undefined, 10)
  k.sphere(red, 0.13, [0.2, 0.55, 1.3], [1, 0.6, 1], 10, 4, Math.PI / 2)
  k.box(DARK, [0.02, 0.025, 0.12], [0.075, 0.45, 1.3])
  k.box(LACE, [0.015, 0.08, 0.08], [0.075, 0.33, 1.3])
  // Wheelie bins: green bodies, one red lid and one yellow.
  for (const [z, lid] of [[-1.3, '#d32f2f'], [-1.66, '#f9c623']] as const) {
    k.box({ c: '#2e6b3a', r: 0.7 }, [0.26, 0.44, 0.3], [0.3, 0.25, z])
    k.box({ c: lid, r: 0.6 }, [0.29, 0.04, 0.32], [0.29, 0.49, z])
    for (const s of [-1, 1]) k.cyl(DARK, 0.05, 0.05, 0.03, [0.42, 0.05, z + s * 0.12], [0, 0, Math.PI / 2], 8)
  }
}

// A dog on a walk.
function dog(k: PropKit, x: number, z: number, ry: number, c: string) {
  const at = frame(x, z, ry)
  const fur: Look = { c, r: 1 }
  k.box(fur, [0.11, 0.1, 0.26], at(0, 0.19, 0), [0, ry, 0])
  k.box(fur, [0.1, 0.1, 0.11], at(0, 0.27, 0.17), [0, ry, 0])
  k.box(fur, [0.06, 0.05, 0.07], at(0, 0.245, 0.25), [0, ry, 0])
  k.box(DARK, [0.025, 0.02, 0.02], at(0, 0.26, 0.29), [0, ry, 0])
  for (const s of [-1, 1]) {
    k.box(fur, [0.03, 0.06, 0.03], at(s * 0.04, 0.33, 0.15), [0, ry, s * 0.3])
    for (const w of [-0.09, 0.09]) k.box(fur, [0.035, 0.15, 0.035], at(s * 0.035, 0.075, w), [0, ry, 0])
  }
  k.rod(fur, at(0, 0.22, -0.13), at(0, 0.32, -0.22), 0.015, 4)
}

// Folk on the footpath, each cluster one prop.
function folkWalk(k: PropKit) {
  folk(k, { top: '#e57373', low: '#e57373', robe: true, skin: SKIN[0], hair: HAIR[2], sunhat: '#f1e3c0' }, 0, -0.4, 0)
  folk(k, { top: '#1e88e5', low: '#455a64', skin: SKIN[1], hair: HAIR[0], hat: 'cap', hatC: '#fdd835' }, 0.08, 0.05, 0.1)
  folk(k, { top: '#f5f5f5', low: '#b49a6a', skin: SKIN[4], hair: '#cfcfcf', sunhat: '#c8a96a' }, -0.04, 0.75, Math.PI)
}
function folkDog(k: PropKit) {
  folk(k, { top: '#26a69a', low: '#283593', skin: SKIN[3], hair: HAIR[3] }, 0.1, 0, 0)
  folk(k, { top: '#ffca28', low: '#ffca28', robe: true, skin: SKIN[5], hair: HAIR[1], sunhat: '#ffffff' }, -0.08, 0.3, 0)
  dog(k, 0.02, 0.85, 0.1, '#c58b4a')
  k.rod({ c: '#d32f2f', r: 0.7 }, [0.1 - 0.12 * PS, 0.36, 0.02], [0.03, 0.27, 0.92], 0.006, 3)
}
function folkCheer(k: PropKit) {
  // Locals out on the footpath to watch the race go by, facing the road (-x).
  folk(k, { top: '#fbc02d', low: '#1b5e20', skin: SKIN[0], hair: HAIR[4], wave: true }, 0, -0.35, -Math.PI / 2)
  folk(k, { top: '#0d47a1', low: '#f5f5f5', skin: SKIN[2], hair: HAIR[0], sash: '#fbc02d', hat: 'cap', hatC: '#0d47a1' }, 0.05, 0.1, -Math.PI / 2)
  folk(k, { top: '#f06292', low: '#f06292', robe: true, skin: SKIN[4], hair: HAIR[2], sunhat: '#fff3c4', wave: true }, 0, 0.55, -Math.PI / 2 + 0.3)
}

// A picnic on the foreshore lawn (sea at -x): a red check rug, a basket, an esky, people
// standing about, and the ibis who has come for the sandwiches.
function picnic(k: PropKit) {
  k.box({ c: '#c62828', r: 1 }, [0.9, 0.012, 0.7], [0, 0.008, 0])
  for (const dz of [-0.2, 0.2]) k.box(LACE, [0.9, 0.006, 0.06], [0, 0.017, dz])
  for (const dx of [-0.25, 0.25]) k.box(LACE, [0.06, 0.006, 0.7], [dx, 0.018, 0])
  k.box({ c: '#b8894a', r: 1 }, [0.25, 0.16, 0.18], [0.25, 0.09, 0.2])
  k.torus({ c: '#8a6436', r: 1 }, 0.09, 0.012, [0.25, 0.17, 0.2], [0, 0, 0], Math.PI, 8, 3)
  k.box({ c: '#f5f5f5', r: 0.6 }, [0.34, 0.24, 0.24], [-0.3, 0.12, -0.25])
  k.box({ c: '#1565c0', r: 0.6 }, [0.36, 0.05, 0.26], [-0.3, 0.26, -0.25])
  for (const [x, z, c] of [[0.05, -0.05, '#fdd835'], [-0.1, 0.15, '#ff7043']] as const) k.cyl({ c, r: 0.8 }, 0.08, 0.08, 0.02, [x, 0.03, z], undefined, 8)
  folk(k, { top: '#42a5f5', low: '#f5f5f5', skin: SKIN[1], hair: HAIR[0], sunhat: '#f1e3c0' }, 0.6, -0.35, -Math.PI / 2 + 0.4)
  folk(k, { top: '#ab47bc', low: '#ab47bc', robe: true, skin: SKIN[3], hair: HAIR[3] }, -0.65, 0.35, Math.PI / 2 + 0.6)
  folk(k, { top: '#ef6c00', low: '#37474f', skin: SKIN[4], hair: HAIR[2], hat: 'cap', hatC: '#c62828', wave: true }, 0.75, 0.55, Math.PI / 2)
  ibis(k, 1.3, -0.65, -2.4, true)
  ibis(k, 1.55, -0.15, -1.9, false)
}

// A spread on the sand (sea at -x): towels, a beach umbrella, an esky, a sunbather lying on her
// towel, two swimmers standing, one with a boogie board.
function beachSpread(k: PropKit, um: string) {
  k.box({ c: '#ff7043', r: 1 }, [0.36, 0.012, 0.8], [0, 0.008, 0])
  k.box({ c: '#26c6da', r: 1 }, [0.36, 0.012, 0.8], [0.5, 0.008, 0.1])
  for (const dz of [-0.25, 0.25]) k.box(LACE, [0.36, 0.006, 0.06], [0.5, 0.017, 0.1 + dz])
  const pole: V3 = [0.28, 0, -0.5]
  k.rod(LACE, pole, [0.22, 1.2, -0.45], 0.018, 4)
  k.cone({ c: um, r: 0.8 }, 0.62, 0.28, [0.22, 1.28, -0.45], [0, 0, -0.12], 8)
  k.cone(LACE, 0.64, 0.05, [0.22, 1.13, -0.45], [0, 0, -0.12], 8)
  k.box({ c: '#f5f5f5', r: 0.6 }, [0.3, 0.22, 0.2], [0.85, 0.11, -0.5])
  k.box({ c: '#c62828', r: 0.6 }, [0.32, 0.05, 0.22], [0.85, 0.24, -0.5])
  // The sunbather, face down on the towel with sunglasses pushed up.
  const skin: Look = { c: SKIN[0], r: 0.8 }
  k.box({ c: '#e91e63', r: 0.8 }, [0.2, 0.09, 0.3], [0, 0.06, 0.06])
  for (const s of [-1, 1]) k.box(skin, [0.08, 0.07, 0.36], [s * 0.05, 0.05, -0.26])
  k.sphere(skin, 0.09, [0, 0.09, 0.32], [1, 0.95, 1.05], 8, 5)
  k.sphere({ c: HAIR[2], r: 0.9 }, 0.095, [0, 0.11, 0.33], [1, 0.9, 1], 8, 4, Math.PI / 2)
  for (const s of [-1, 1]) k.rod(skin, [s * 0.13, 0.05, 0.15], [s * 0.15, 0.04, 0.42], 0.03, 4)
  k.box(DARK, [0.14, 0.025, 0.03], [0, 0.18, 0.36])
  // Swimmers in boardshorts and togs.
  folk(k, { top: SKIN[2], low: '#1565c0', skin: SKIN[2], hair: HAIR[0] }, 1.0, 0.45, -Math.PI / 2)
  folk(k, { top: '#00897b', low: '#00897b', skin: SKIN[4], hair: HAIR[5], sunhat: '#fff3c4' }, 1.05, 0.95, -Math.PI / 2 - 0.5)
  k.box({ c: '#fdd835', r: 0.6 }, [0.04, 0.42, 0.24], [1.0, 0.3, 0.27])
  // A sandcastle with a little flag, and a bucket and spade.
  k.cyl({ c: '#e3c891', r: 1 }, 0.14, 0.17, 0.14, [0.6, 0.07, 0.75], undefined, 8)
  k.cyl({ c: '#e3c891', r: 1 }, 0.08, 0.1, 0.12, [0.6, 0.2, 0.75], undefined, 8)
  k.box({ c: '#d32f2f', r: 0.8 }, [0.01, 0.05, 0.07], [0.6, 0.36, 0.78])
  k.cyl({ c: '#1e88e5', r: 0.6 }, 0.06, 0.045, 0.1, [0.85, 0.05, 0.8], undefined, 8)
}

// Surfers out the back waiting for a set: standing chest deep with their boards, one paddling.
// Placed 0.3 below the water so their legs are under it.
function surfers(k: PropKit) {
  const wet: Look = { c: '#212121', r: 0.6 }
  folk(k, { top: wet.c, low: wet.c, skin: SKIN[1], hair: HAIR[2] }, 0, 0, Math.PI / 2)
  k.add({ c: '#f5f5f5', r: 0.5 }, BOARD, [0.05, 0.33, 0.4], [0, 0.1, 0], [0.13, 0.015, 0.46])
  folk(k, { top: SKIN[3], low: '#ef6c00', skin: SKIN[3], hair: HAIR[3] }, 0.3, 1.4, Math.PI / 2 + 0.4)
  k.add({ c: '#4fc3f7', r: 0.5 }, BOARD, [0.4, 0.33, 1.85], [0, -0.3, 0], [0.13, 0.015, 0.46])
  // The paddler, lying on the board, arms in the water.
  const px = -0.9
  const pz = -1.2
  k.add({ c: '#ffeb3b', r: 0.5 }, BOARD, [px, 0.33, pz], [0, 0.2, 0], [0.13, 0.015, 0.46])
  k.box(wet, [0.17, 0.08, 0.34], [px + 0.02, 0.38, pz + 0.05], [0, 0.2, 0])
  for (const s of [-1, 1]) k.box(wet, [0.06, 0.06, 0.3], [px - 0.05 + s * 0.05, 0.37, pz - 0.27], [0, 0.2, 0])
  k.sphere({ c: SKIN[0], r: 0.8 }, 0.07, [px + 0.07, 0.45, pz + 0.27])
  k.sphere({ c: HAIR[1], r: 0.9 }, 0.074, [px + 0.06, 0.47, pz + 0.26], [1, 1, 1], 8, 4, Math.PI / 2)
  for (const s of [-1, 1]) k.rod({ c: SKIN[0], r: 0.8 }, [px + s * 0.1, 0.38, pz + 0.2], [px + s * 0.16, 0.26, pz + 0.38], 0.025, 4)
}
// A surfer riding a breaking wave in towards the beach (+x): a green-blue face, white water
// along the lip, the rider low on the board, one arm out.
function rider(k: PropKit) {
  k.sphere({ c: '#5a86bd', r: 0.3 }, 1, [-0.5, -0.04, 0], [0.75, 0.42, 2.4], 10, 4, Math.PI / 2)
  for (const [x, y, z, r] of [[-0.55, 0.34, -1.2, 0.2], [-0.6, 0.36, -0.4, 0.22], [-0.55, 0.35, 0.5, 0.21], [-0.6, 0.3, 1.3, 0.18], [-0.3, 0.2, -1.8, 0.16]] as const) k.ico({ c: '#f4fbff', r: 0.6 }, r, [x, y, z], [1, 0.6, 1.6], 0)
  k.box({ c: '#f4fbff', r: 0.6 }, [0.5, 0.02, 3.6], [0.35, 0.015, 0])
  k.add({ c: '#e53935', r: 0.5 }, BOARD, [0.35, 0.04, 0.6], [0, 0.6, 0], [0.12, 0.015, 0.44])
  folk(k, { top: '#212121', low: '#212121', skin: SKIN[2], hair: HAIR[2], wave: true }, 0.35, 0.6, 0.6 + Math.PI / 2)
}

// The surf life saving club on the beach, facing +z (the road), the sea behind: boat shed doors,
// a glassed clubroom upstairs with a balcony over the sand, red and yellow trim, its name.
function surfClub(k: PropKit) {
  const wall: Look = { c: '#f3ead6', r: 0.9 }
  const red: Look = { c: '#d32f2f', r: 0.7 }
  const yel: Look = { c: '#fbc02d', r: 0.7 }
  k.box(wall, [7, 1.25, 3], [0, 0.625, 0])
  k.box(red, [7.05, 0.1, 3.05], [0, 1.3, 0])
  k.box(yel, [7.05, 0.08, 3.05], [0, 1.39, 0])
  k.box(wall, [7, 1.15, 2.3], [0, 2.0, 0.35])
  for (const z of [1.51, -0.81]) k.box(GLASS, [6.2, 0.5, 0.03], [0, 1.98, z])
  k.box(red, [7.2, 0.12, 3.1], [0, 2.63, 0.05])
  text(k, red, 'SURF CLUB', [0, 2.33, 1.512], 0.065)
  text(k, red, 'SURF CLUB', [0, 2.33, -0.812], 0.065, Math.PI)
  // Roller doors onto the sand, the entrance and windows on the road side.
  for (const x of [-2.2, 0, 2.2]) {
    k.box({ c: '#b71c1c', r: 0.7 }, [1.5, 0.95, 0.03], [x, 0.48, -1.51])
    for (let i = 1; i < 6; i++) k.box({ c: '#8e1515', r: 0.7 }, [1.5, 0.015, 0.035], [x, i * 0.16, -1.515])
  }
  k.box({ c: '#1f3c5b', r: 0.6 }, [0.6, 0.95, 0.03], [2.5, 0.48, 1.51])
  for (const x of [-2.4, -1.0, 0.6]) k.box(GLASS, [0.9, 0.5, 0.03], [x, 0.7, 1.51])
  // The balcony on the sea side with a white railing.
  k.box({ c: '#d8d2c4', r: 0.9 }, [7, 0.1, 0.72], [0, 1.47, -1.16])
  k.box(LACE, [7, 0.04, 0.04], [0, 1.78, -1.5])
  for (let x = -3.4; x <= 3.4; x += 0.34) k.box(LACE, [0.025, 0.3, 0.025], [x, 1.63, -1.5])
  // Flagpole on the roof with the patrol flag, boards racked against the end wall.
  k.cyl(LACE, 0.025, 0.03, 1.6, [3.2, 3.5, 0.5], undefined, 5)
  k.box(red, [0.02, 0.18, 0.5], [3.2, 4.15, 0.75])
  k.box(yel, [0.02, 0.18, 0.5], [3.2, 3.97, 0.75])
  for (let i = 0; i < 4; i++) k.add({ c: i % 2 ? '#fbc02d' : '#d32f2f', r: 0.5 }, BOARD, [3.62, 0.62, -1.0 + i * 0.32], [0, 0, 0.12], [0.03, 0.6, 0.12])
  // The rescue boat on its trailer, out on the sand behind.
  const bz = -2.7
  for (const s of [-1, 1]) k.rod({ c: '#ff6f00', r: 0.6 }, [-2.6, 0.32, bz + s * 0.32], [-1.0, 0.32, bz + s * 0.32], 0.13, 8)
  k.cone({ c: '#ff6f00', r: 0.6 }, 0.42, 0.5, [-0.8, 0.32, bz], [0, 0, -Math.PI / 2], 8)
  k.box({ c: '#37474f', r: 0.6 }, [1.6, 0.06, 0.5], [-1.8, 0.24, bz])
  k.box(DARK, [0.2, 0.45, 0.16], [-2.75, 0.4, bz])
  for (const s of [-1, 1]) k.cyl(DARK, 0.1, 0.1, 0.06, [-1.8, 0.1, bz + s * 0.45], [Math.PI / 2, 0, 0], 8)
}
// The lifeguard tower on its stilts, its lifeguard placed in it separately.
function lifeTower(k: PropKit) {
  const red: Look = { c: '#d32f2f', r: 0.7 }
  const yel: Look = { c: '#fbc02d', r: 0.7 }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.rod(LACE, [sx * 0.55, 0, sz * 0.55], [sx * 0.42, 1.6, sz * 0.42], 0.04, 5)
  k.box({ c: '#d8d2c4', r: 0.9 }, [1.1, 0.08, 1.1], [0, 1.62, 0])
  k.box(yel, [1.0, 0.3, 1.0], [0, 1.81, 0])
  for (const [x, z] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]] as const) k.box(yel, [0.05, 0.75, 0.05], [x, 2.25, z])
  frustum(k, red, 1.3, 1.3, 0.3, 0.2, [0, 2.6, 0])
  text(k, red, 'SURF', [0, 1.8, 0.512], 0.045)
  for (let i = 0; i < 6; i++) k.box(TIMBER, [0.4, 0.03, 0.08], [0, 0.15 + i * 0.25, 0.72 + i * 0.06])
  for (const s of [-1, 1]) k.rod(TIMBER, [s * 0.22, 0, 0.7], [s * 0.22, 1.62, 1.1], 0.025, 4)
  k.cyl(LACE, 0.02, 0.02, 1.0, [0.5, 3.2, 0.5], undefined, 5)
  k.box(red, [0.02, 0.15, 0.35], [0.5, 3.6, 0.68])
  k.box(yel, [0.02, 0.15, 0.35], [0.5, 3.45, 0.68])
}
// A red-over-yellow patrol flag on the sand: swim between the flags.
function patrolFlag(k: PropKit) {
  k.cyl({ c: '#d0d0d0', r: 0.5 }, 0.02, 0.025, 1.7, [0, 0.85, 0], undefined, 5)
  k.box({ c: '#d32f2f', r: 0.8 }, [0.02, 0.2, 0.55], [0, 1.55, 0.29])
  k.box({ c: '#fbc02d', r: 0.8 }, [0.02, 0.2, 0.55], [0, 1.35, 0.29])
}

// The sandstone post office with its clock tower, facing +z, 12 wide and 5.5 deep: an arcade
// of arches on the ground floor, two floors of windows, a balustraded parapet, and the tower
// at one end with four clock faces, a belfry and a copper pyramid roof.
function postOffice(k: PropKit) {
  const st: Look = { c: '#d9b886', r: 0.95 }
  const f = 2.75
  k.box(SAND_D, [12.2, 0.3, 5.7], [0, 0.15, 0])
  k.box(st, [12, 3.6, 5.5], [0, 1.8, 0])
  for (let i = 0; i < 7; i++) {
    const x = -5.1 + i * 1.6
    k.box({ c: '#5a4a3a', r: 0.9 }, [1.0, 0.95, 0.03], [x, 0.78, f + 0.01])
    archTop(k, { c: '#5a4a3a', r: 0.9 }, 1.0, 0.03, [x, 1.25, f + 0.01])
    k.box(SAND_D, [0.3, 1.7, 0.2], [x + 0.8, 0.85, f + 0.1])
  }
  k.box(SAND_D, [0.3, 1.7, 0.2], [-5.9, 0.85, f + 0.1])
  k.box(SAND_D, [12.1, 0.1, 5.6], [0, 1.75, 0])
  for (const y of [2.3, 3.05]) for (let i = 0; i < 7; i++) {
    const x = -5.1 + i * 1.6
    k.box(GLASS, [0.45, 0.55, 0.03], [x, y, f + 0.01])
    k.box(SAND_D, [0.6, 0.06, 0.08], [x, y + 0.32, f + 0.03])
    k.box(SAND_D, [0.56, 0.05, 0.08], [x, y - 0.3, f + 0.03])
  }
  k.box(SAND_D, [12.3, 0.18, 5.8], [0, 3.6, 0])
  k.box(st, [12, 0.35, 0.15], [0, 3.86, f - 0.07])
  k.box(SAND_D, [12.1, 0.06, 0.2], [0, 4.06, f - 0.05])
  frustum(k, { c: '#6d6e70', r: 0.8 }, 11.6, 5.2, 0.8, 0.4, [0, 3.69, 0])
  text(k, { c: '#4a3a28', r: 0.8 }, 'POST OFFICE', [-1.8, 3.86, f + 0.017], 0.06)
  // Steps up into the arcade, a pair of lamps and red post boxes.
  k.box(SAND_D, [3.4, 0.12, 0.5], [-1.8, 0.06, f + 0.4])
  for (const x of [-3.7, 0.1]) {
    k.cyl({ c: '#c62828', r: 0.6 }, 0.12, 0.13, 0.55, [x, 0.275, f + 0.5], undefined, 10)
    k.sphere({ c: '#c62828', r: 0.6 }, 0.13, [x, 0.55, f + 0.5], [1, 0.6, 1], 10, 4, Math.PI / 2)
  }
  // The clock tower.
  const tx = 3.6
  const tz = f - 0.9
  k.box(st, [2.2, 8.2, 2.2], [tx, 4.1, tz])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(SAND_D, [0.28, 8.2, 0.28], [tx + sx * 1.05, 4.1, tz + sz * 1.05])
  for (const [dx, dz, rx, rz] of [[0, 1.12, Math.PI / 2, 0], [0, -1.12, Math.PI / 2, 0], [1.12, 0, 0, Math.PI / 2], [-1.12, 0, 0, Math.PI / 2]] as const) {
    k.cyl({ c: '#f6f1e2', r: 0.5 }, 0.62, 0.62, 0.04, [tx + dx, 7.1, tz + dz], [rx, 0, rz], 14)
    const ox = Math.sign(dx) * 0.03
    const oz = Math.sign(dz) * 0.03
    const ry = dx !== 0 ? Math.PI / 2 : 0
    k.box(DARK, [0.05, 0.4, 0.02], [tx + dx + ox, 7.25, tz + dz + oz], [0, ry, 0])
    k.box(DARK, [0.3, 0.05, 0.02], [tx + dx + ox + (dx === 0 ? 0.13 : 0), 7.1, tz + dz + oz + (dx !== 0 ? -Math.sign(dx) * 0.13 : 0)], [0, ry, 0])
    k.torus(DARK, 0.62, 0.035, [tx + dx + ox * 0.5, 7.1, tz + dz + oz * 0.5], [0, ry, 0], Math.PI * 2, 14, 3)
  }
  k.box(SAND_D, [2.6, 0.22, 2.6], [tx, 8.3, tz])
  k.box(st, [2.0, 1.3, 2.0], [tx, 9.05, tz])
  for (const [dx, dz, ry] of [[0, 1.01, 0], [0, -1.01, 0], [1.01, 0, Math.PI / 2], [-1.01, 0, Math.PI / 2]] as const) {
    k.box(DARK, [0.6, 0.65, 0.03], [tx + dx, 8.95, tz + dz], [0, ry, 0])
    archTop(k, DARK, 0.6, 0.03, [tx + dx, 9.27, tz + dz], ry)
  }
  k.box(SAND_D, [2.3, 0.18, 2.3], [tx, 9.78, tz])
  frustum(k, { c: '#5f9a84', r: 0.6 }, 2.1, 2.1, 1.7, 0, [tx, 9.87, tz])
  k.cyl(LACE, 0.02, 0.03, 2.0, [tx, 12.4, tz], undefined, 5)
  k.box({ c: '#1f3c7a', r: 0.8 }, [0.02, 0.35, 0.6], [tx, 13.1, tz + 0.31])
  for (const [y, z] of [[13.18, 0.15], [13.02, 0.42], [13.16, 0.5]] as const) k.box(LACE, [0.025, 0.05, 0.05], [tx, y, tz + z])
}

// A gum tree park (x away from the road, road edge at x 0): a post and rail fence along the
// footpath, a gravel path, a sign, a picnic shelter with a barbecue on the go, kangaroos
// grazing and resting, koalas asleep in the gums, cockatoos and a family picnic.
function park(k: PropKit, L: number) {
  const post: Look = { c: '#6d5440', r: 1 }
  for (let z = -L / 2; z <= L / 2; z += 1.2) {
    if (Math.abs(z) < 1.2) continue
    k.box(post, [0.08, 0.5, 0.08], [0.1, 0.25, z])
  }
  for (const s of [-1, 1]) for (const y of [0.22, 0.42]) k.box(post, [0.04, 0.06, L / 2 - 1.2], [0.1, y, s * (L / 4 + 0.6)])
  k.box({ c: '#d9c9a5', r: 1 }, [5.6, 0.008, 1.2], [2.8, 0.014, 0])
  // The sign by the gate.
  for (const z of [1.5, 2.9]) k.box(post, [0.08, 0.95, 0.08], [0.4, 0.47, z])
  k.box({ c: '#5d4037', r: 0.9 }, [0.06, 0.4, 1.5], [0.4, 0.85, 2.2])
  text(k, { c: '#f3e7c9', r: 0.8 }, 'GUM PARK', [0.365, 0.85, 2.2], 0.042, -Math.PI / 2)
  // The picnic shelter: timber posts, a corrugated iron hip roof, a brick barbecue, two
  // tables, and a family cooking.
  const sz = -L / 2 + 6
  for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) k.box(post, [0.12, 1.7, 0.12], [3.0 + sx * 1.3, 0.85, sz + sz2 * 1.0])
  frustum(k, { c: '#a9adb0', r: 0.6 }, 3.2, 2.6, 0.55, 0.35, [3.0, 1.7, sz])
  k.box({ c: '#8e9396', r: 0.6 }, [3.25, 0.08, 2.65], [3.0, 1.72, sz])
  k.box(BRICK, [0.5, 0.65, 1.0], [4.0, 0.325, sz])
  k.box({ c: '#4a4a4a', r: 0.5 }, [0.46, 0.04, 0.9], [4.0, 0.67, sz])
  for (const dz of [-0.2, 0.15]) k.cyl({ c: '#8a3a2a', r: 0.9 }, 0.025, 0.025, 0.16, [4.0, 0.7, sz + dz], [0, 0, Math.PI / 2], 6)
  for (const dz of [-0.6, 0.6]) {
    k.box(TIMBER, [0.9, 0.05, 0.5], [2.5, 0.42, sz + dz])
    for (const s of [-1, 1]) {
      k.box(TIMBER, [0.9, 0.04, 0.16], [2.5, 0.25, sz + dz + s * 0.38])
      k.box(TIMBER, [0.05, 0.42, 0.4], [2.5 + s * 0.38, 0.21, sz + dz])
    }
  }
  folk(k, { top: '#f5f5f5', low: '#37474f', skin: SKIN[0], hair: HAIR[4], hat: 'cap', hatC: '#2e7d32', sash: '#1e88e5' }, 3.55, sz - 0.1, Math.PI / 2)
  folk(k, { top: '#ec407a', low: '#ec407a', robe: true, skin: SKIN[1], hair: HAIR[0], sunhat: '#f1e3c0' }, 2.0, sz - 1.2, 0.4)
  folk(k, { top: '#ffa726', low: '#1565c0', skin: SKIN[3], hair: HAIR[3], wave: true }, 1.4, sz + 1.3, -Math.PI / 2)
  // Gums with koalas asleep in their forks, a jacaranda, a bottlebrush.
  const trees: [number, number, number, number, boolean][] = [[2.2, -L / 2 + 1.5, 0.3, 1.15, true], [4.6, -2.8, 2.1, 1.25, true], [1.8, 5.5, 4.0, 1.1, false], [4.4, L / 2 - 2.5, 1.0, 1.2, true]]
  for (const [x, z, ry, s, koala] of trees) {
    gum(xf(k, x, z, ry, s), !koala)
    if (koala) koalaAt(k, x, z, ry, s)
  }
  jacaranda(xf(k, 4.5, 4.5, 1.2, 1.1))
  // Kangaroos: some up and alert, some grazing, one lying in the shade.
  const roos: [number, number, number, boolean][] = [[1.6, -3.5, -1.9, false], [2.6, -5.2, 0.6, true], [3.4, 2.4, -2.2, true], [1.5, 8.2, -1.6, false], [2.6, 9.6, 2.6, true], [4.2, 7.4, -0.8, false], [1.2, -9.2, -1.4, false]]
  for (const [x, z, ry, graze] of roos) roo(k, x, z, ry, graze)
  // A family on a rug watching the roos.
  k.box({ c: '#1e88e5', r: 1 }, [0.8, 0.012, 0.7], [3.4, 0.016, 10.8])
  folk(k, { top: '#8d6e63', low: '#8d6e63', robe: true, skin: SKIN[2], hair: HAIR[1], sunhat: '#fff3c4' }, 3.1, 10.6, -2.2)
  folk(k, { top: '#43a047', low: '#455a64', skin: SKIN[2], hair: HAIR[0] }, 3.7, 11.0, -2.5)
}
// A koala curled in the fork of a gum built by gum() at (x, z) turned ry, scaled s.
function koalaAt(k: PropKit, x: number, z: number, ry: number, s: number) {
  const g = xf(k, x, z, ry, s)
  const grey: Look = { c: '#8e8e8e', r: 1 }
  const pale: Look = { c: '#d6d6d6', r: 1 }
  g.add(grey, SPH, [0.17, 1.74, 0.17], [0.2, 0, 0], [0.1, 0.13, 0.09])
  g.add(grey, SPH, [0.17, 1.9, 0.21], [0, 0, 0], [0.08, 0.075, 0.075])
  for (const sd of [-1, 1]) {
    g.add(grey, SPH, [0.17 + sd * 0.075, 1.95, 0.2], [0, 0, 0], [0.04, 0.045, 0.02])
    g.add(pale, SPH, [0.17 + sd * 0.075, 1.95, 0.21], [0, 0, 0], [0.025, 0.03, 0.012])
    g.rod(grey, [0.17 + sd * 0.07, 1.8, 0.2], [0.15 + sd * 0.05, 1.68, 0.1], 0.025, 4)
  }
  g.box(DARK, [0.035, 0.045, 0.03], [0.17, 1.89, 0.285])
  g.add(pale, SPH, [0.17, 1.72, 0.24], [0, 0, 0], [0.06, 0.08, 0.03])
}
// A kangaroo at (x, z) facing ry: upright and alert, or bent over grazing.
function roo(k: PropKit, x: number, z: number, ry: number, graze: boolean) {
  const at = frame(x, z, ry)
  const fur: Look = { c: '#a07e62', r: 1 }
  const pale: Look = { c: '#d8c3a5', r: 1 }
  for (const f of [-1, 1]) k.box(fur, [0.05, 0.04, 0.24], at(f * 0.07, 0.02, 0.05), [0, ry, 0])
  k.add(fur, SPH, at(0, 0.18, -0.05), [0, ry, 0], [0.14, 0.14, 0.17])
  k.rod(fur, at(0, 0.16, -0.18), at(0, 0.03, -0.62), 0.04, 5)
  k.cone(fur, 0.04, 0.12, at(0, 0.02, -0.66), [-Math.PI / 2, ry, 0], 5)
  const head: V3 = graze ? at(0, 0.13, 0.4) : at(0, 0.66, 0.1)
  if (graze) {
    k.add(fur, SPH, at(0, 0.27, 0.13), [1.15, ry, 0], [0.11, 0.2, 0.12])
    for (const f of [-1, 1]) k.rod(fur, at(f * 0.05, 0.25, 0.25), at(f * 0.05, 0.02, 0.3), 0.022, 4)
  } else {
    k.add(fur, SPH, at(0, 0.4, 0.03), [0.25, ry, 0], [0.11, 0.24, 0.12])
    k.add(pale, SPH, at(0, 0.42, 0.11), [0.25, ry, 0], [0.07, 0.16, 0.05])
    k.rod(fur, at(0, 0.55, 0.07), head, 0.045, 5)
    for (const f of [-1, 1]) k.rod(fur, at(f * 0.06, 0.5, 0.12), at(f * 0.05, 0.37, 0.19), 0.02, 4)
  }
  k.add(fur, SPH, head, [graze ? 0.6 : 0.3, ry, 0], [0.06, 0.065, 0.1])
  const hf = frame(head[0], head[2], ry)
  k.box({ c: '#2a2020', r: 1 }, [0.03, 0.025, 0.02], hf(0, head[1] - (graze ? 0.04 : 0.02), graze ? 0.08 : 0.095), [0, ry, 0])
  for (const f of [-1, 1]) {
    k.box(fur, [0.025, 0.09, 0.02], hf(f * 0.035, head[1] + 0.08, -0.03), [-0.2, ry, f * 0.25])
    k.box(DARK, [0.012, 0.012, 0.012], hf(f * 0.04, head[1] + 0.02, 0.05), [0, ry, 0])
  }
}

// The ferry wharf (road side at x 0, the harbour at -x): a timber deck on piles, a green and
// gold waiting shelter with its number, benches and a gangway.
function wharf(k: PropKit) {
  const deck: Look = { c: '#8a6a4a', r: 0.95 }
  const green: Look = { c: '#1f6b45', r: 0.6 }
  const gold: Look = { c: '#e8c35a', r: 0.6 }
  k.box(deck, [3.6, 0.12, 9], [-1.7, 0.42, 0])
  for (let x = -0.3; x > -3.6; x -= 1.0) for (const z of [-4.3, -1.4, 1.4, 4.3]) k.cyl({ c: '#5e452e', r: 1 }, 0.1, 0.1, 0.9, [x, 0.0, z], undefined, 6)
  for (const s of [-1, 1]) k.box({ c: '#6d5440', r: 0.95 }, [3.6, 0.15, 0.12], [-1.7, 0.3, s * 4.45])
  for (const x of [-0.8, -2.6]) for (const z of [-3, -1, 1, 3]) k.box(green, [0.1, 1.6, 0.1], [x, 1.28, z])
  k.box(gold, [2.2, 0.22, 7.2], [-1.7, 2.15, 0])
  frustum(k, green, 2.6, 7.6, 0.6, 0.35, [-1.7, 2.26, 0])
  text(k, green, 'WHARF 2', [-0.59, 2.15, 0], 0.045, Math.PI / 2)
  for (const z of [-2, 2]) {
    k.box(TIMBER, [0.4, 0.05, 1.4], [-2.3, 0.72, z])
    k.box(TIMBER, [0.05, 0.3, 1.4], [-2.48, 0.9, z])
    for (const dz of [-0.6, 0.6]) k.box(DARK, [0.05, 0.25, 0.05], [-2.3, 0.6, z + dz])
  }
  // Railings along the wharf's harbour end, open where the ferry ties up.
  for (const s of [-1, 1]) k.box(LACE, [0.05, 0.05, 2.6], [-3.45, 1.05, s * 3.0])
  for (const z of [-4.3, -3.0, -1.7, 1.7, 3.0, 4.3]) k.box(LACE, [0.05, 0.55, 0.05], [-3.45, 0.75, z])
  k.box({ c: '#9aa0a6', r: 0.6 }, [0.6, 0.06, 1.2], [-3.75, 0.5, 0], [0, 0, -0.15])
}
function wharfFolk(k: PropKit) {
  folk(k, { top: '#283593', low: '#283593', robe: true, skin: SKIN[0], hair: HAIR[1] }, -1.6, -1.5, -Math.PI / 2)
  folk(k, { top: '#f5f5f5', low: '#37474f', skin: SKIN[3], hair: HAIR[3], hat: 'cap', hatC: '#c62828' }, -1.9, -0.9, -Math.PI / 2 + 0.4)
  folk(k, { top: '#ff8a65', low: '#5d4037', skin: SKIN[1], hair: HAIR[2], sunhat: '#f1e3c0' }, -2.9, 1.3, -Math.PI / 2)
  folk(k, { top: '#66bb6a', low: '#455a64', skin: SKIN[5], hair: HAIR[0] }, -1.2, 2.6, Math.PI)
}

// The lighthouse on its sandstone headland across the harbour, the keeper's cottage beside it.
function lighthouse(k: PropKit) {
  frustum(k, { c: '#c9a273', r: 1 }, 10, 12, 3, 0.72, [0, 0, 0])
  frustum(k, { c: '#b98f62', r: 1 }, 6, 8, 1.6, 0.6, [-3.5, 0, 2.5], 0.4)
  frustum(k, { c: '#6b8a4c', r: 1 }, 7.4, 8.8, 0.25, 0.88, [0, 3, 0])
  const cream: Look = { c: '#f1ebdd', r: 0.8 }
  k.cyl(cream, 0.55, 0.75, 5.5, [1, 5.95, 0], undefined, 12)
  k.cyl(DARK, 0.85, 0.85, 0.12, [1, 8.75, 0], undefined, 12)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    k.box(DARK, [0.025, 0.4, 0.025], [1 + Math.cos(a) * 0.82, 9.0, Math.sin(a) * 0.82])
  }
  k.torus(DARK, 0.82, 0.02, [1, 9.2, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 12, 3)
  k.cyl({ c: '#2d3a40', r: 0.2 }, 0.45, 0.45, 0.85, [1, 9.25, 0], undefined, 10)
  k.box({ c: '#fff3c4', r: 0.4 }, [0.4, 0.4, 0.4], [1, 9.25, 0])
  k.sphere({ c: '#b0322a', r: 0.6 }, 0.5, [1, 9.68, 0], [1, 0.8, 1], 10, 4, Math.PI / 2)
  k.cyl(DARK, 0.02, 0.03, 0.6, [1, 10.3, 0], undefined, 5)
  for (const y of [5, 7]) k.box(GLASS, [0.03, 0.45, 0.25], [1 + 0.66 - (y - 5) * 0.04, y, 0])
  k.box(cream, [2.2, 1.0, 1.6], [-1.6, 3.75, -1.2])
  gable(k, { c: '#6d6e70', r: 0.8 }, 2.3, 1.7, 0.7, [-1.6, 4.25, -1.2])
  k.box(BRICK, [0.25, 0.6, 0.25], [-2.3, 4.9, -1.4])
  k.cyl(LACE, 0.03, 0.04, 3, [-2.8, 4.6, 1.8], undefined, 5)
  k.box({ c: '#1f3c7a', r: 0.8 }, [0.02, 0.3, 0.5], [-2.8, 5.9, 2.06])
}

export default function Sydney({ len, race }: WorldProps) {
  const homes = useMemo(() => TERR.map((t, i) => prop(`sydney-terrace-${i}-d3`, (k) => terrace(k, t))), [])
  const backs = useMemo(() => BACKS.map(([make], i) => prop(`sydney-back-${i}-d3`, make)), [])
  const bars = useMemo(() => [['MILK BAR', '#c62828'], ['DELI', '#1565c0']].map(([n, c], i) => prop(`sydney-milkbar-${i}-d3`, (k) => milkbar(k, n, c))), [])
  const northP = useProp('sydney-north-d3', (k) => hills(k, 307, -1, true))
  const ridgeP = useProp('sydney-ridge-d3', (k) => hills(k, 411, 1, false))
  const gumP = useProp('sydney-gum-d3', (k) => gum(k))
  const jacP = useProp('sydney-jacaranda', jacaranda)
  const pineP = useProp('sydney-norfolk-d3', norfolk)
  const operaP = useProp('sydney-opera-d3', opera)
  const operaFolkP = useProp('sydney-operafolk-d3', operaFolk)
  const shoreP = useProp('sydney-foreshore-d3', foreshore)
  const bandP = useProp('sydney-bandstand-d3', bandstand)
  const pubP = useProp('sydney-pub-d3', pub)
  const streetP = useProp('sydney-street-d3', street)
  const walkers = useMemo(() => [folkWalk, folkDog, folkCheer].map((f, i) => prop(`sydney-folk-${i}-d3`, f)), [])
  const picnicP = useProp('sydney-picnic-d3', picnic)
  const spreads = useMemo(() => ['#e53935', '#1e88e5'].map((c, i) => prop(`sydney-spread-${i}-d3`, (k) => beachSpread(k, c))), [])
  const surfP = useProp('sydney-surfers-d3', surfers)
  const riderP = useProp('sydney-rider-d3', rider)
  const clubP = useProp('sydney-surfclub-d3', surfClub)
  const towerP = useProp('sydney-lifetower-d3', lifeTower)
  const guardP = useProp('sydney-lifeguard-d3', (k) => folk(k, { top: '#fbc02d', low: '#d32f2f', skin: SKIN[1], hair: HAIR[0], hat: 'cap', hatC: '#d32f2f' }, 0, 0, 0))
  const flagP = useProp('sydney-patrolflag-d3', patrolFlag)
  const gpoP = useProp('sydney-gpo-d3', postOffice)
  const parkP = useProp('sydney-park-d3', (k) => park(k, 28))
  const wharfP = useProp('sydney-wharf-d3', wharf)
  const wharfFolkP = useProp('sydney-wharffolk-d3', wharfFolk)
  const lightP = useProp('sydney-lighthouse-d3', lighthouse)
  const ferryP = useProp('sydney-ferry-d3', ferry)
  const yachts = useMemo(() => ['#f7f6f0', '#1f3c5b', '#f7f6f0'].map((c, i) => prop(`sydney-yacht-${i}`, (k) => yacht(k, c))), [])
  const oz = race + 6
  const SEA = -(EDGE + 6)
  const hz = race * 0.4
  const bz = race * 0.62
  const gz = race * 0.2
  const pz = race * 0.66
  const b0 = race * 0.24
  const b1 = race * 0.52
  const cz = (b0 + b1) / 2
  const wz = race * 0.85
  const lz = race * 0.75
  const beach = (z: number) => z > b0 - 1 && z < b1 + 1

  const geo = useMemo(() => {
    const r = rand(831)
    // The left side: runs of terraces, a milk bar on some corners, a lane with a tree between,
    // clear of the post office, the hotel and the park.
    const blocked: [number, number][] = [[gz - 7, gz + 7], [hz - 3.9, hz + 3.9], [pz - 15, pz + 15]]
    const hit = (a: number, b: number) => blocked.find(([c, d]) => a < d && b > c)
    const rows: Spot[][] = TERR.map(() => [])
    const shops: Spot[][] = [[], []]
    const trees: Spot[] = []
    const blooms: Spot[] = []
    const FX = EDGE + 3
    let block = 0
    for (let z = -14; z < len + 40;) {
      const n = 4 + Math.floor(r() * 6)
      let jumped = false
      for (let i = 0; i < n; i++) {
        const h = hit(z, z + 1.8)
        if (h) {
          z = h[1] + 0.3
          jumped = true
          break
        }
        rows[Math.floor(r() * TERR.length)].push({ x: FX, z: z + 0.9, ry: -Math.PI / 2 })
        z += 1.8
      }
      if (jumped) continue
      // A milk bar or deli on every other corner.
      if ((block++ % 2 === 1 || r() < 0.2) && !hit(z, z + 3.6)) {
        shops[r() < 0.6 ? 0 : 1].push({ x: FX, z: z + 1.8, ry: -Math.PI / 2 })
        z += 3.6
      }
      const gap = 2.5 + r() * 3
      const tree = { x: EDGE + 2.6, z: z + gap / 2, ry: r() * 6, s: 0.9 + r() * 0.3 }
      if (!hit(tree.z - 1, tree.z + 1)) (r() < 0.5 ? blooms : trees).push(tree)
      z += gap
    }
    // Backyard trees between the terraces and the back row.
    for (let z = -10; z < len + 40; z += 4 + r() * 4) (r() < 0.7 ? trees : blooms).push({ x: EDGE + 5.6 + r() * 1.0, z, ry: r() * 6, s: 0.95 + r() * 0.3 })
    // The back row, unbroken.
    const back: Spot[][] = BACKS.map(() => [])
    const wsum = BACKS.reduce((n, b) => n + b[2], 0)
    for (let z = -16, last = -1; z < len + 50;) {
      let i = 0
      for (let t = r() * wsum; i < BACKS.length - 1 && (t -= BACKS[i][2]) > 0;) i++
      if (i === last) i = (i + 1) % BACKS.length
      last = i
      const L = BACKS[i][1]
      back[i].push({ x: EDGE + 9.6, z: z + L / 2, ry: -Math.PI / 2 })
      z += L + 0.5
    }
    // The hills: the ridge behind the city on the left, the north shore across the harbour.
    const ridge: Spot[] = []
    const north: Spot[] = []
    for (let z = 10; z < len + 80; z += 48) {
      ridge.push({ x: EDGE + 12.4, z })
      north.push({ x: SEA - 29.4, z: z + 20 })
    }
    // Footpath: lamps, post boxes and bins, and people between them.
    const street: Spot[] = []
    const folks: Spot[][] = [[], [], []]
    for (let z = -6; z < len + 40; z += 8 + r() * 4) {
      if (Math.abs(z - hz) < 4.5) continue
      street.push({ x: EDGE + 0.3, z })
      const fz = z + 4 + r()
      if (Math.abs(fz - hz) < 4.5) continue
      const kind = Math.floor(r() * 3)
      folks[kind].push({ x: EDGE + 0.55, z: fz, ry: kind === 2 ? 0 : r() < 0.5 ? 0 : Math.PI })
    }
    // Gums and jacarandas along the foreshore lawn (Norfolk pines along the beach).
    const pines: Spot[] = []
    for (let z = -10; z < len + 40; z += 4 + r() * 5) {
      if (Math.abs(z - oz) < 16 || Math.abs(z - bz) < 4) continue
      if (beach(z)) {
        if (Math.abs(z - cz) > 5) pines.push({ x: -(EDGE + 0.8), z, ry: r() * 6, s: 0.9 + r() * 0.2 })
        continue
      }
      ;(r() < 0.6 ? trees : blooms).push({ x: -(EDGE + 1.6 + r() * 2.2), z, ry: r() * 6, s: 0.85 + r() * 0.35 })
    }
    // Benches, lamps and bottlebrush along the lawn, pelicans on the piles by the sea wall;
    // picnics on the grass.
    const shore: Spot[] = []
    const picnics: Spot[] = []
    for (let z = 6; z < len + 40; z += 11 + r() * 4) {
      if (Math.abs(z - oz) > 14 && Math.abs(z - bz) > 4 && !beach(z)) shore.push({ x: -EDGE, z })
      const qz = z + 5.5
      if (Math.abs(qz - oz) > 15 && Math.abs(qz - bz) > 5 && !beach(qz)) picnics.push({ x: -(EDGE + 2.6 + r() * 1.2), z: qz, ry: (r() - 0.5) * 0.6 })
    }
    // The beach: spreads on the sand, surfers out the back, a couple riding in.
    const spreads: Spot[][] = [[], []]
    for (let z = b0 + 2, i = 0; z < b1 - 1; z += 4.5 + r() * 2.5, i++) {
      if (Math.abs(z - cz) < 5 || Math.abs(z - (b0 + 12)) < 2) continue
      spreads[i % 2].push({ x: -(EDGE + 2.6 + r() * 1.4), z, ry: (r() - 0.5) * 0.5 })
    }
    const surf: Spot[] = []
    for (let z = b0 + 4; z < b1 - 2; z += 8 + r() * 4) surf.push({ x: SEA - 3.6 - r() * 1.8, z, y: -0.3, ry: (r() - 0.5) * 0.4 })
    const riders: Spot[] = [{ x: SEA - 2.6, z: b0 + 18, y: 0.04 }, { x: SEA - 3.2, z: b1 - 10, y: 0.04 }]
    // Yachts at their moorings, clear of the ferry lanes, the beach, the wharf and the point.
    const boats: Spot[][] = [[], [], []]
    for (let z = 10, i = 0; z < len + 40; z += 14 + r() * 10, i++) {
      const x = SEA - [3.4, 10.6, 19.5][i % 3]
      if (Math.abs(z - oz) < 20 && x > SEA - 20) continue
      if (x > SEA - 5 && (beach(z) || Math.abs(z - wz) < 8)) continue
      if (x < SEA - 15 && Math.abs(z - lz) < 10) continue
      boats[i % 3].push({ x, z, ry: 0.5 + r() * 0.3 })
    }
    const rr = rand(21)
    const lawn = Array.from({ length: 300 }, () => ({ x: -(EDGE + 0.2 + rr() * 5), z: rr() * (len + 60) - 14, s: 0.7 + rr() * 0.6, ry: rr() * 6 })).filter((p) => !beach(p.z))
    const foam: [number, number, number, number][] = []
    for (const [x, w] of [[SEA - 0.35, 0.5], [SEA - 2.0, 0.22], [SEA - 4.6, 0.18]] as const) {
      for (let z = b0; z < b1;) {
        const l = 4 + rr() * 6
        foam.push([x + (rr() - 0.5) * 0.3, z + l / 2, w, Math.min(l, b1 - z)])
        z += l + 0.6 + rr() * 1.5
      }
    }
    return { rows, shops, trees, blooms, back, ridge, north, street, folks, pines, lawn, shore, picnics, spreads, surf, riders, boats, foam }
  }, [len, oz, hz, bz, gz, pz, b0, b1, cz, wz, lz, SEA]) // eslint-disable-line react-hooks/exhaustive-deps

  const L = len + 60
  const mid = len / 2 + 5
  const lawnA = b0 - 1 - -14
  const lawnB = len + 46 - (b1 + 1)
  return (
    <>
      <Batch version={`sydney-d3:${len}`} cell={24}>
        {/* The foreshore lawn and the sandstone sea wall either side of the beach, the beach
            promenade and wet sand; the footpath and the grass behind the terraces. */}
        {[[-14, lawnA], [b1 + 1, lawnB]].map(([z0, d]) => (
          <group key={z0}>
            <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + 3), 0.012, z0 + d / 2]}>
              <planeGeometry args={[6, d]} />
              <meshStandardMaterial color="#6f9a4c" />
            </mesh>
            <mesh position={[SEA + 0.3, 0.2, z0 + d / 2]}>
              <boxGeometry args={[0.6, 0.5, d]} />
              <meshStandardMaterial color="#c9a37a" />
            </mesh>
          </group>
        ))}
        <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + 0.55), 0.012, cz]}>
          <planeGeometry args={[1.1, b1 - b0 + 2]} />
          <meshStandardMaterial color="#d4cfc4" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[SEA + 0.3, 0.008, cz]}>
          <planeGeometry args={[0.6, b1 - b0 + 2]} />
          <meshStandardMaterial color="#cdb488" />
        </mesh>
        {geo.foam.map(([x, z, w, l], i) => (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.024, z]}>
            <planeGeometry args={[w, l]} />
            <meshStandardMaterial color="#f4fbff" />
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 0.85, 0.012, mid]}>
          <planeGeometry args={[1.7, L]} />
          <meshStandardMaterial color="#b9b1a5" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 17, 0.008, mid]}>
          <planeGeometry args={[30, L]} />
          <meshStandardMaterial color="#6f9450" />
        </mesh>
        <group position={[SEA - 9, 0, oz]} rotation-y={-Math.PI / 2 - 0.35}>
          <PropMesh parts={operaP} />
          <group position-y={1.6}><PropMesh parts={operaFolkP} /></group>
        </group>
        <group position={[EDGE + 1.7 + 2, 0, hz]} rotation-y={-Math.PI / 2}><PropMesh parts={pubP} /></group>
        <group position={[EDGE + 4.75, 0, gz]} rotation-y={-Math.PI / 2}><PropMesh parts={gpoP} /></group>
        <group position={[EDGE + 1.8, 0, pz]}><PropMesh parts={parkP} /></group>
        <group position={[-(EDGE + 3.4), 0, bz]}><PropMesh parts={bandP} /></group>
        <group position={[-(EDGE + 2.9), 0, cz]} rotation-y={Math.PI / 2}><PropMesh parts={clubP} /></group>
        <group position={[SEA + 1.2, 0, b0 + 12]} rotation-y={Math.PI / 2}>
          <PropMesh parts={towerP} />
          <group position={[0, 1.66, 0]} rotation-y={0.3}><PropMesh parts={guardP} /></group>
        </group>
        {[b0 + 16, b1 - 14].map((z) => <group key={z} position={[SEA + 0.6, 0, z]}><PropMesh parts={flagP} /></group>)}
        <group position={[SEA, 0, wz]}>
          <PropMesh parts={wharfP} />
          <group position-y={0.48}><PropMesh parts={wharfFolkP} /></group>
        </group>
        <group position={[SEA - 4.5, 0, wz]}><PropMesh parts={ferryP} /></group>
        <group position={[SEA - 24.4, 0, lz]}><PropMesh parts={lightP} /></group>
        {geo.boats.map((l, i) => l.map((b, j) => <group key={`${i}-${j}`} position={[b.x, 0, b.z]} rotation-y={b.ry}><PropMesh parts={yachts[i]} /></group>))}
        {/* Sandstone kerbs along the lawn and the footpath. */}
        <mesh position={[-(EDGE + 0.08), 0.03, mid]}>
          <boxGeometry args={[0.16, 0.06, L]} />
          <meshStandardMaterial color="#cfae80" />
        </mesh>
        <mesh position={[EDGE + 0.07, 0.03, mid]}>
          <boxGeometry args={[0.14, 0.06, L]} />
          <meshStandardMaterial color="#cfae80" />
        </mesh>
        <Scatter spots={geo.lawn} colors={['#5f8c3f', '#77a253', '#6a9648']}>
          <coneGeometry args={[0.05, 0.18, 3]} />
        </Scatter>
      </Batch>
      {homes.map((h, i) => <Many key={i} parts={h} at={geo.rows[i]} />)}
      {bars.map((h, i) => <Many key={i} parts={h} at={geo.shops[i]} near={110} />)}
      {backs.map((h, i) => <Many key={i} parts={h} at={geo.back[i]} />)}
      <Many parts={ridgeP} at={geo.ridge} />
      <Many parts={northP} at={geo.north} />
      <Many parts={gumP} at={geo.trees} />
      <Many parts={jacP} at={geo.blooms} />
      <Many parts={pineP} at={geo.pines} near={100} />
      <Many parts={shoreP} at={geo.shore} near={90} />
      <Many parts={streetP} at={geo.street} near={80} />
      {walkers.map((h, i) => <Many key={i} parts={h} at={geo.folks[i]} near={70} />)}
      <Many parts={picnicP} at={geo.picnics} near={70} />
      {spreads.map((h, i) => <Many key={i} parts={h} at={geo.spreads[i]} near={70} />)}
      <Many parts={surfP} at={geo.surf} near={80} />
      <Many parts={riderP} at={geo.riders} near={80} />
      <Water x={SEA - 40} z={len / 2} w={80} d={len + 240} id="sydney" color="#5fb0d0" />
      <Sparkles edge={SEA} />
      <Gulls x={SEA - 4} />
      <Ferries len={len} x={SEA} boat={ferryP} />
      <FarSydney />
    </>
  )
}

function Ferries({ len, x, boat }: { len: number; x: number; boat: ReturnType<typeof prop> }) {
  const refs = useRef<(Group | null)[]>([])
  const boats = useMemo(() => Array.from({ length: 4 }, (_, i) => ({ x: x - 7.5 - (i % 2) * 9, z: (i / 4) * (len + 60), v: (i % 2 ? -1 : 1) * 0.7 })), [len, x])
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

// The steel arch bridge across the harbour ahead, and the city: the tower with its gold turret
// among glass and sandstone towers over the ridge.
function FarSydney() {
  const parts = useProp('sydney-far-d3', (k) => {
    const steel: Look = { c: '#8a9399', r: 0.6, m: 0.3 }
    const granite: Look = { c: '#cdbb9f', r: 0.9 }
    const z = 80
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
    // Flags flying from the crown of the arch.
    for (const dx of [-1.5, 1.5]) {
      k.cyl({ c: '#d0d0d0', r: 0.5 }, 0.08, 0.1, 3, [mid + dx, 22.5, z], undefined, 5)
      k.box({ c: '#1f3c7a', r: 0.8 }, [1.8, 1.0, 0.06], [mid + dx + 0.95, 23.4, z])
    }
    // Granite pylons at both ends.
    for (const px of [x0 + 1, x1 - 1]) {
      k.box(granite, [3.6, 18, 5], [px, 9, z])
      k.box({ c: '#b9a586', r: 0.9 }, [4, 0.6, 5.4], [px, 18.3, z])
      for (const s of [-1, 1]) k.box({ c: '#6b5f4f', r: 1 }, [1.2, 3.4, 0.1], [px + s * 0.8, 13, z - 2.55])
    }
    // The city tower: a slim shaft with a gold drum and spire.
    const tx = 34
    const tz = 72
    k.cyl({ c: '#d8d8d8', r: 0.6 }, 0.7, 0.9, 34, [tx, 17, tz], undefined, 10)
    for (let i = 0; i < 10; i++) k.rod({ c: '#9e9e9e', r: 0.5 }, [tx + Math.sin(i) * 2.5, 0, tz + Math.cos(i) * 2.5], [tx, 33, tz], 0.06, 4)
    k.cyl({ c: '#d9a63a', r: 0.3, m: 0.7 }, 3.0, 2.6, 4.0, [tx, 36, tz], undefined, 16)
    k.cyl({ c: '#3b4a52', r: 0.15, m: 0.4 }, 3.05, 3.05, 1.2, [tx, 36.5, tz], undefined, 16)
    k.cyl({ c: '#d9a63a', r: 0.3, m: 0.7 }, 0.2, 0.4, 7, [tx, 41.5, tz], undefined, 8)
    // The city's towers over the ridge: glass and sandstone, banded with floors, some crowned.
    const rr = rand(55)
    const glassT: Look = { c: '#7f97a8', r: 0.3, m: 0.25 }
    const stone: Look = { c: '#c9bfae', r: 0.7 }
    const band: Look = { c: '#4f6270', r: 0.4 }
    for (let i = 0; i < 16; i++) {
      const x = 22 + i * 3.2 + rr() * 1.5
      const zz = 50 + rr() * 30
      if (Math.abs(x - tx) < 4 && Math.abs(zz - tz) < 6) continue
      const h = 14 + rr() * 20
      const w = 3 + rr() * 2
      const g = rr() < 0.55
      k.box(g ? glassT : stone, [w, h, w], [x, h / 2, zz])
      for (let y = 2; y < h - 0.5; y += 1.6) k.box(g ? band : { c: '#9a8f80', r: 0.8 }, [w + 0.06, 0.18, w + 0.06], [x, y, zz])
      if (rr() < 0.4) k.box(g ? stone : glassT, [w * 0.6, 2.5, w * 0.6], [x, h + 1.25, zz])
      if (rr() < 0.3) k.cyl({ c: '#d0d0d0', r: 0.5 }, 0.05, 0.08, 4, [x, h + 2, zz], undefined, 4)
    }
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
