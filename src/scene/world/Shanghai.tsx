import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { glowMats } from '../dayNight'
import { Batch } from '../Batch'
import { ExtrudeGeometry, Shape, type Group } from 'three'
import { EDGE, Horizon, Many, PropMesh, Scatter, Sparkles, Water, archTop, frustum, glow, prop, rand, useProp, type Look, type PropKit, type Spot, type V3 } from './kit'
import type { WorldProps } from './WorldVenue'

// China, Lantern Harbour: a night race along the river embankment. Right: the promenade rail and
// the river, cruise boats strung with lights, and across the water the skyline: the tower with
// the pink pearls, the bottle-opener tower, the twisting tower and a wall of lit glass. Left:
// the old stone bank buildings with domes and the customs clock tower, lit warm. Red lanterns
// hang across the road, the racers pass under a red ceremonial gate halfway, and a seven-storey
// pagoda stands by the finish.

const STONE: Look = { c: '#d6cdbd', r: 0.85 }
const STONE_D: Look = { c: '#b3a891', r: 0.9 }
const GRANITE: Look = { c: '#8f8a82', r: 0.9 }
const WIN: Look = { c: '#ffffff', use: glowMats.window }
const RED: Look = { c: '#b71c1c', r: 0.7 }
const TILE: Look = { c: '#2f4f46', r: 0.6 }
const GOLD: Look = { c: '#e5b53c', r: 0.3, m: 0.7 }
const DARK: Look = { c: '#1e2328', r: 1 }
const LANTERN = glow('#ff3a2a', 0.35, 1.8)
const WARM = glow('#ffcf7a', 0.1, 1.6)

// A tier of tiled roof with upswept corners, w by d at the eaves, rising h, sitting on p.
function eaves(k: PropKit, w: number, d: number, h: number, p: V3, tile = TILE) {
  frustum(k, tile, w, d, h, 0.45, p)
  k.box(tile, [w * 0.5, 0.08, d * 0.12], [p[0], p[1] + h + 0.02, p[2]])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.cone(tile, 0.09, 0.45, [p[0] + sx * w / 2, p[1] + 0.12, p[2] + sz * d / 2], [sz * 0.9, 0, -sx * 0.9], 5)
  }
  k.box(RED, [w * 0.9, 0.12, d * 0.9], [p[0], p[1] - 0.06, p[2]])
}

// A stone bank building facing +z, lit windows in rows, a dome or a clock tower on some.
type Bank = { w: number; floors: number; top: 'dome' | 'clock' | 'flat' | 'mansard'; stone: Look; bikes?: boolean }
const BANKS: Bank[] = [
  { w: 5.0, floors: 5, top: 'dome', stone: STONE },
  { w: 4.0, floors: 6, top: 'flat', stone: { c: '#c9bda8', r: 0.85 }, bikes: true },
  { w: 4.6, floors: 5, top: 'mansard', stone: { c: '#ddd3c2', r: 0.85 } },
  { w: 3.6, floors: 6, top: 'flat', stone: { c: '#bfb5a2', r: 0.85 } },
  { w: 5.4, floors: 4, top: 'mansard', stone: STONE, bikes: true },
]
const D = 4
// Tall enough that the top row of windows sits under the cornice with a dentil course above.
const bankH = (floors: number) => floors * 1.15 + 1.5
function bank(k: PropKit, b: Bank) {
  const H = bankH(b.floors)
  const f = D / 2
  k.box(b.stone, [b.w, H, D], [0, H / 2, 0])
  k.box(GRANITE, [b.w + 0.06, 1.4, D + 0.06], [0, 0.7, 0])
  for (let i = 0; i < 3; i++) k.box({ c: '#7d7871', r: 0.9 }, [b.w + 0.08, 0.04, D + 0.08], [0, 0.35 + i * 0.4, 0])
  k.box(STONE_D, [b.w + 0.16, 0.2, D + 0.16], [0, H, 0])
  k.box(STONE_D, [b.w + 0.08, 0.1, D + 0.08], [0, 1.45, 0])
  // Arched doorway with bronze doors and a lamp each side.
  k.box(GRANITE, [1.1, 1.3, 0.08], [0, 0.65, f + 0.03])
  archTop(k, GRANITE, 1.1, 0.08, [0, 1.3, f + 0.03])
  k.box({ c: '#5d4a2c', r: 0.4, m: 0.6 }, [0.8, 1.15, 0.06], [0, 0.58, f + 0.06])
  for (const s of [-1, 1]) k.box(WARM, [0.12, 0.2, 0.12], [s * 0.75, 1.2, f + 0.15])
  // A pediment over the door on brackets, and granite steps up to it.
  frustum(k, STONE_D, 1.0, 0.22, 0.3, 0.05, [0, 1.92, f + 0.11])
  k.box(STONE_D, [1.0, 0.06, 0.22], [0, 1.89, f + 0.11])
  for (const s of [-1, 1]) k.box(STONE_D, [0.08, 0.2, 0.18], [s * 0.42, 1.76, f + 0.09])
  for (let i = 0; i < 2; i++) k.box(GRANITE, [1.5 - i * 0.2, 0.1, 0.5 - i * 0.2], [0, 0.05 + i * 0.1, f + 0.25 - i * 0.1])
  // A dentil course under the cornice.
  for (let x = -b.w / 2 + 0.15; x < b.w / 2 - 0.05; x += 0.36) k.box(STONE_D, [0.14, 0.09, 0.06], [x, H - 0.14, f + 0.03])
  // Rows of lit windows between engaged columns.
  const n = Math.round(b.w / 0.75)
  for (let fl = 1; fl < b.floors + 1; fl++) for (let i = 0; i < n; i++) {
    const x = -b.w / 2 + (b.w / n) * (i + 0.5)
    const y = 1.5 + (fl - 1) * 1.15 + 0.5
    if (fl === 1 && Math.abs(x) < 0.7) continue
    k.box(WIN, [0.36, 0.62, 0.02], [x, y, f + 0.006])
    k.box(STONE_D, [0.44, 0.06, 0.08], [x, y - 0.35, f + 0.03])
    if (fl === b.floors) archTop(k, STONE_D, 0.4, 0.05, [x, y + 0.32, f + 0.02])
    else k.box(STONE_D, [0.44, 0.06, 0.08], [x, y + 0.35, f + 0.03])
  }
  for (let i = 0; i <= n; i++) {
    const x = -b.w / 2 + (b.w / n) * i
    k.cyl(b.stone, 0.07, 0.07, H - 1.7, [x, 1.5 + (H - 1.7) / 2, f + 0.06], undefined, 8)
  }
  if (b.bikes) bikeRow(k, -b.w / 2 + 0.7, f + 0.75, 4)
  if (b.top !== 'flat') {
    // A balustrade round the roof.
    for (let x = -b.w / 2 + 0.15; x < b.w / 2 - 0.1; x += 0.3) k.box(STONE_D, [0.09, 0.3, 0.09], [x, H + 0.25, f - 0.08])
    k.box(STONE_D, [b.w, 0.08, 0.16], [0, H + 0.43, f - 0.08])
  }
  if (b.top === 'dome') {
    k.cyl(b.stone, 1.4, 1.5, 1.2, [0, H + 0.7, 0], undefined, 16)
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.5) / 12) * Math.PI * 2
      if (Math.cos(a) > -0.3) k.box(WIN, [0.22, 0.5, 0.02], [Math.sin(a) * 1.46, H + 0.75, Math.cos(a) * 1.46], [0, a, 0])
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      k.cyl(STONE_D, 0.06, 0.06, 1.1, [Math.sin(a) * 1.5, H + 0.7, Math.cos(a) * 1.5], undefined, 6)
    }
    k.sphere({ c: '#5f7f78', r: 0.5, m: 0.3 }, 1.45, [0, H + 1.3, 0], [1, 0.95, 1], 18, 8, Math.PI / 2)
    k.cyl(STONE_D, 0.25, 0.3, 0.6, [0, H + 2.9, 0], undefined, 8)
    k.sphere(GOLD, 0.18, [0, H + 3.35, 0])
  } else if (b.top === 'mansard') {
    frustum(k, { c: '#4c5a5e', r: 0.6, m: 0.2 }, b.w, D, 1.2, 0.75, [0, H + 0.1, 0])
    for (let i = 0; i < n; i += 2) k.box(WIN, [0.3, 0.4, 0.02], [-b.w / 2 + (b.w / n) * (i + 0.5), H + 0.6, f - 0.18])
  } else {
    for (let i = 0; i < Math.round(b.w / 0.4); i++) k.box(b.stone, [0.12, 0.3, 0.12], [-b.w / 2 + 0.2 + i * 0.4, H + 0.25, f - 0.06])
    // A flagpole on the roof with a red flag.
    k.cyl(DARK, 0.03, 0.04, 2.2, [0, H + 1.2, f - 0.8], undefined, 5)
    k.sphere(GOLD, 0.06, [0, H + 2.33, f - 0.8], [1, 1, 1], 6, 4)
    k.box(RED, [0.02, 0.5, 0.8], [0, H + 1.98, f - 0.38])
  }
}

// Shared bicycles in a row on the pavement, side on to the kerb.
function bikeRow(k: PropKit, x0: number, z: number, n: number) {
  const frame: Look = { c: '#f2b134', r: 0.6 }
  const tyre: Look = { c: '#1b1b1b', r: 0.9 }
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 0.32
    for (const dz of [-0.26, 0.26]) k.torus(tyre, 0.14, 0.02, [x, 0.16, z + dz], [0, Math.PI / 2, 0], Math.PI * 2, 10, 3)
    k.rod(frame, [x, 0.16, z - 0.26], [x, 0.36, z + 0.02], 0.018, 4)
    k.rod(frame, [x, 0.36, z + 0.02], [x, 0.16, z + 0.26], 0.018, 4)
    k.rod(frame, [x, 0.16, z - 0.26], [x, 0.4, z - 0.08], 0.018, 4)
    k.rod(frame, [x, 0.4, z - 0.08], [x, 0.36, z + 0.02], 0.018, 4)
    k.rod(frame, [x, 0.16, z + 0.26], [x, 0.48, z + 0.2], 0.018, 4)
    k.box(DARK, [0.06, 0.03, 0.12], [x, 0.42, z - 0.1])
    k.box(DARK, [0.26, 0.02, 0.02], [x, 0.49, z + 0.2])
    k.box(frame, [0.14, 0.08, 0.1], [x, 0.42, z + 0.28])
  }
  // The rack they're locked to.
  k.box({ c: '#3b3f44', r: 0.6 }, [n * 0.32, 0.03, 0.03], [x0 + (n - 1) * 0.16, 0.3, z + 0.36])
  for (const s of [-1, 1]) k.box({ c: '#3b3f44', r: 0.6 }, [0.03, 0.3, 0.03], [x0 + (n - 1) * 0.16 + s * n * 0.15, 0.15, z + 0.36])
}

// The customs house: a tall clock tower in stages, a lit clock on each face.
function clockTower(k: PropKit) {
  bank(k, { w: 6.4, floors: 5, top: 'flat', stone: STONE })
  const H = bankH(5)
  k.box(STONE, [2.6, 4.2, 2.6], [0, H + 2.1, 0.4])
  k.box(STONE_D, [2.8, 0.2, 2.8], [0, H + 4.2, 0.4])
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    k.cyl(WARM, 0.85, 0.85, 0.04, [dx * 1.32, H + 3.0, 0.4 + dz * 1.32], [Math.PI / 2, ry, 0], 24)
    k.box(DARK, [0.05, 0.6, 0.02], [dx * 1.36, H + 3.2, 0.4 + dz * 1.36], [0, ry, 0])
    k.box(DARK, [0.45, 0.05, 0.02], [dx * 1.36 + dz * 0.15, H + 3.0, 0.4 + dz * 1.36 - dx * 0.15], [0, ry, 0])
    k.box(STONE_D, [1.9, 0.1, 0.1], [dx * 1.32, H + 2.0, 0.4 + dz * 1.32], [0, ry, 0])
  }
  k.box(STONE, [1.8, 1.4, 1.8], [0, H + 5.0, 0.4])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(STONE_D, 0.08, 0.08, 1.4, [sx * 0.9, H + 5.0, 0.4 + sz * 0.9], undefined, 6)
  frustum(k, { c: '#5f7f78', r: 0.5, m: 0.3 }, 1.6, 1.6, 1.4, 0.2, [0, H + 5.7, 0.4])
  k.cyl(GOLD, 0.03, 0.05, 1.0, [0, H + 7.6, 0.4], undefined, 6)
}

// A red ceremonial gate over the road: four pillars, beams and three tiers of roof.
function gate(k: PropKit) {
  for (const x of [-4.4, -2.9, 2.9, 4.4]) {
    k.cyl(RED, 0.22, 0.24, 5.0, [x, 2.5, 0], undefined, 12)
    k.box(GRANITE, [0.8, 0.5, 0.8], [x, 0.25, 0])
    k.box(GRANITE, [0.5, 0.9, 1.2], [x, 0.45, 0])
  }
  // Painted beams: red with blue and green bands, a gold name board in the middle.
  for (const y of [3.4, 4.4]) {
    k.box(RED, [9.4, 0.36, 0.5], [0, y, 0])
    k.box({ c: '#1f5f8b', r: 0.7 }, [9.42, 0.1, 0.52], [0, y + 0.12, 0])
    k.box({ c: '#2e7d4f', r: 0.7 }, [9.42, 0.06, 0.52], [0, y - 0.12, 0])
  }
  k.box(GOLD, [1.4, 0.8, 0.1], [0, 3.9, 0.3])
  k.box(RED, [1.2, 0.6, 0.12], [0, 3.9, 0.31])
  k.box(GOLD, [1.4, 0.8, 0.1], [0, 3.9, -0.3])
  k.box(RED, [1.2, 0.6, 0.12], [0, 3.9, -0.31])
  eaves(k, 3.8, 1.6, 0.9, [0, 5.0, 0])
  for (const s of [-1, 1]) eaves(k, 2.4, 1.4, 0.7, [s * 3.65, 4.6, 0])
  k.box(GOLD, [0.2, 0.3, 0.2], [0, 6.1, 0])
  // A pair of stone lions guarding each side of the approach, facing the oncoming road.
  for (const s of [-1, 1]) lion(k, s * 3.65, -1.1, s)
  // Lanterns hanging under each side span.
  for (const s of [-1, 1]) {
    k.cyl(DARK, 0.01, 0.01, 0.5, [s * 3.65, 3.0, 0], undefined, 4)
    k.sphere(LANTERN, 0.26, [s * 3.65, 2.6, 0], [1, 0.85, 1], 12, 8)
    k.cyl(GOLD, 0.12, 0.12, 0.06, [s * 3.65, 2.82, 0], undefined, 10)
    k.cyl(GOLD, 0.12, 0.12, 0.06, [s * 3.65, 2.38, 0], undefined, 10)
  }
}

// A guardian lion sitting on a plinth at x, z, facing -z; side s puts its raised paw on the
// inside (a ball under the male's paw on the left, a cub under the female's on the right).
function lion(k: PropKit, x: number, z: number, s: number) {
  const st: Look = { c: '#a9a399', r: 0.9 }
  const mane: Look = { c: '#97918a', r: 0.95 }
  k.box(GRANITE, [0.75, 0.5, 0.95], [x, 0.25, z])
  k.box(STONE_D, [0.8, 0.06, 1.0], [x, 0.53, z])
  k.box(st, [0.6, 0.12, 0.8], [x, 0.62, z])
  // Haunches, chest, forelegs.
  k.sphere(st, 0.27, [x, 0.85, z + 0.18], [1, 0.9, 1.1], 8, 6)
  k.sphere(st, 0.24, [x, 1.05, z - 0.08], [1, 1.25, 0.9], 8, 6)
  for (const dx of [-0.13, 0.13]) k.cyl(st, 0.07, 0.08, 0.45, [x + dx, 0.88, z - 0.2], undefined, 6)
  // Mane, head, snout and the curls on top.
  k.ico(mane, 0.26, [x, 1.38, z - 0.12], [1, 1, 0.85], 1)
  k.box(st, [0.3, 0.2, 0.18], [x, 1.36, z - 0.32])
  k.box(mane, [0.18, 0.1, 0.12], [x, 1.32, z - 0.43])
  for (const dx of [-0.09, 0.09]) k.sphere({ c: '#5a5650', r: 0.9 }, 0.035, [x + dx, 1.43, z - 0.41], [1, 1, 1], 6, 4)
  k.box({ c: '#7a3a2a', r: 0.9 }, [0.14, 0.03, 0.04], [x, 1.27, z - 0.42])
  // Ball (or cub) under the inner forepaw.
  k.sphere(st, 0.1, [x - s * 0.15, 0.78, z - 0.3], [1, 1, 1], 8, 6)
  k.cyl(st, 0.05, 0.05, 0.3, [x + s * 0.15, 0.75, z - 0.12], undefined, 6)
  k.cyl(st, 0.06, 0.06, 0.1, [x - s * 0.15, 0.9, z - 0.3], undefined, 6)
}

// A seven-storey pagoda, each storey a little smaller, with a gold finial.
function pagoda(k: PropKit) {
  k.box(GRANITE, [5.2, 0.6, 5.2], [0, 0.3, 0])
  let y = 0.6
  for (let i = 0; i < 7; i++) {
    const w = 3.6 - i * 0.32
    const h = i === 0 ? 1.6 : 1.15
    k.cyl({ c: '#e9dcc4', r: 0.85 }, w / 2, w / 2 + 0.05, h, [0, y + h / 2, 0], [0, Math.PI / 8, 0], 8)
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2
      k.box(RED, [0.1, h, 0.1], [Math.sin(a) * w / 2, y + h / 2, Math.cos(a) * w / 2])
      if (j % 2 === 0) k.box(WIN, [0.35, h * 0.5, 0.02], [Math.sin(a + Math.PI / 8) * (w / 2 - 0.02), y + h * 0.5, Math.cos(a + Math.PI / 8) * (w / 2 - 0.02)], [0, a + Math.PI / 8, 0])
    }
    y += h
    eaves(k, w + 1.1, w + 1.1, 0.45, [0, y, 0])
    y += 0.3
  }
  k.cyl(GOLD, 0.08, 0.12, 2.0, [0, y + 1.0, 0], undefined, 8)
  for (let i = 0; i < 5; i++) k.torus(GOLD, 0.16, 0.04, [0, y + 0.4 + i * 0.3, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 12, 4)
}

// The promenade rail along the embankment, with a lamp post every few metres.
const IRONM: Look = { c: '#3b3f44', r: 0.4, m: 0.6 }
function rail(k: PropKit) {
  k.box(GRANITE, [0.3, 0.5, 6], [0, 0.25, 0])
  k.box(STONE_D, [0.36, 0.06, 6], [0, 0.53, 0])
  for (let z = -2.7; z <= 2.7; z += 0.6) {
    k.box(IRONM, [0.05, 0.6, 0.05], [0, 0.86, z])
    k.box(IRONM, [0.08, 0.08, 0.08], [0, 1.19, z], [0, 0, Math.PI / 4])
    // A diamond between each pair of posts.
    if (z < 2.6) k.box(IRONM, [0.02, 0.2, 0.2], [0, 0.86, z + 0.3], [Math.PI / 4, 0, 0])
  }
  k.box(IRONM, [0.08, 0.06, 6], [0, 1.1, 0])
  k.box(IRONM, [0.05, 0.04, 6], [0, 0.62, 0])
  planeTree(k, 1.05, 3)
  // A granite flower bed with low shrubs and a row of flowers.
  k.box(GRANITE, [0.7, 0.3, 1.9], [0.75, 0.15, -1.1])
  k.box({ c: '#3d2e22', r: 1 }, [0.6, 0.02, 1.8], [0.75, 0.3, -1.1])
  for (let i = 0; i < 4; i++) k.ico({ c: i % 2 ? '#3f6a34' : '#4c7a3c', r: 1 }, 0.17, [0.75, 0.38, -1.8 + i * 0.47], [1.1, 0.7, 1], 0)
  for (let i = 0; i < 7; i++) k.box({ c: ['#d9343a', '#f2c233', '#f4f0e6'][i % 3], r: 0.8 }, [0.07, 0.07, 0.07], [0.75 + (i % 2 ? 0.2 : -0.2), 0.38, -1.95 + i * 0.28])
  k.cyl({ c: '#2b2f33', r: 0.4, m: 0.6 }, 0.05, 0.07, 2.6, [0, 1.3, 0], undefined, 8)
  for (const s of [-1, 1]) {
    k.rod({ c: '#2b2f33', r: 0.4, m: 0.6 }, [0, 2.4, 0], [0, 2.55, s * 0.4], 0.025, 5)
    k.sphere(WARM, 0.13, [0, 2.45, s * 0.42])
  }
}

// A plane tree in a granite tree pit: a mottled trunk, forked limbs, a broad leafy crown.
function planeTree(k: PropKit, x: number, z: number) {
  const bark: Look = { c: '#a39a82', r: 0.9 }
  const patch: Look = { c: '#cfc7ad', r: 0.9 }
  k.box(GRANITE, [0.6, 0.06, 0.6], [x, 0.03, z])
  k.box({ c: '#3d2e22', r: 1 }, [0.48, 0.02, 0.48], [x, 0.06, z])
  k.rod(bark, [x, 0, z], [x - 0.05, 1.7, z + 0.05], 0.1, 7)
  for (const [dx, dy, dz] of [[0.04, 0.5, 0.1], [-0.06, 1.1, -0.08], [0.07, 1.4, 0.03]] as const) k.box(patch, [0.07, 0.16, 0.08], [x + dx, dy, z + dz])
  k.rod(bark, [x - 0.05, 1.7, z + 0.05], [x + 0.35, 2.6, z + 0.4], 0.07, 6)
  k.rod(bark, [x - 0.05, 1.7, z + 0.05], [x - 0.3, 2.7, z - 0.35], 0.07, 6)
  k.rod(bark, [x - 0.05, 1.7, z + 0.05], [x + 0.1, 2.8, z - 0.1], 0.06, 5)
  const leaf = ['#3c6a32', '#4a7a3a', '#35602c']
  ;[[0.35, 2.95, 0.4, 0.8], [-0.35, 3.0, -0.4, 0.8], [0.05, 3.35, -0.05, 0.85]].forEach(([dx, y, dz, r], i) => k.ico({ c: leaf[i % 3], r: 1 }, r, [x + dx, y, z + dz], [1, 0.72, 1], 1))
}

// A string of red lanterns across the road.
function lanterns(k: PropKit) {
  const span = EDGE * 2 + 3.4
  k.rod(DARK, [-span / 2, 4.8, 0], [0, 4.3, 0], 0.012, 4)
  k.rod(DARK, [0, 4.3, 0], [span / 2, 4.8, 0], 0.012, 4)
  for (let i = 1; i < 9; i++) {
    const x = -span / 2 + (span / 9) * i
    const y = 4.8 - Math.sin((i / 9) * Math.PI) * 0.5 - 0.35
    k.sphere(LANTERN, 0.18, [x, y, 0], [1, 0.85, 1], 10, 7)
    k.cyl(GOLD, 0.08, 0.08, 0.05, [x, y + 0.16, 0], undefined, 8)
    k.cyl(GOLD, 0.08, 0.08, 0.05, [x, y - 0.16, 0], undefined, 8)
    k.box({ c: '#fdd835', r: 0.8 }, [0.03, 0.18, 0.03], [x, y - 0.27, 0])
  }
}

// A lane (lilong) running back between two banks, facing +z like a bank, 2.6 wide: a carved
// stone gate at its mouth with a lit name board, grey brick walls with lit windows, a red
// door at the far end, lanterns overhead, bikes and a cycle rickshaw, and vertical shop signs
// hung out from the bank fronts either side, lit after dark.
const LANE_W = 2.6
const GATE: Look = { c: '#bdb3a2', r: 0.9 }
const BRICKG: Look = { c: '#5f5a55', r: 0.95 }
const BRICKR: Look = { c: '#8a4a3a', r: 0.95 }
function lane(k: PropKit) {
  const f = D / 2
  k.box({ c: '#77736c', r: 0.95 }, [LANE_W + 0.1, 0.02, 9.2], [0, 0.01, -2.4])
  // The gate: pillars, a lintel, a curved pediment with the name board and finials.
  for (const s of [-1, 1]) {
    k.box(GATE, [0.35, 2.8, 0.4], [s * 1.08, 1.4, f - 0.3])
    k.box(GATE, [0.45, 0.12, 0.5], [s * 1.08, 0.06, f - 0.3])
    k.box(GATE, [0.2, 0.25, 0.2], [s * 1.08, 3.27, f - 0.3])
    k.sphere(GATE, 0.12, [s * 1.08, 3.5, f - 0.3], [1, 1, 1], 8, 6)
  }
  k.box(GATE, [LANE_W - 0.1, 0.35, 0.45], [0, 2.97, f - 0.3])
  k.box(GATE, [1.9, 0.5, 0.3], [0, 3.38, f - 0.3])
  archTop(k, GATE, 1.9, 0.3, [0, 3.63, f - 0.3], 0, 0.45)
  k.box(WARM, [1.1, 0.28, 0.02], [0, 3.4, f - 0.14])
  k.box(BRICKR, [1.3, 0.04, 0.06], [0, 3.22, f - 0.12])
  // The lane walls beyond the banks, with lit windows facing in, and the far end.
  for (const s of [-1, 1]) {
    k.box(BRICKG, [0.2, 3.4, 5.2], [s * 1.2, 1.7, -4.6])
    for (const y of [1.15, 2.3]) k.box(BRICKR, [0.22, 0.08, 5.2], [s * 1.2, y, -4.6])
    for (const z of [-3.2, -5.4]) {
      k.box(WARM, [0.02, 0.45, 0.32], [s * 1.09, 1.7, z])
      k.box(GATE, [0.06, 0.05, 0.42], [s * 1.08, 1.45, z])
    }
  }
  k.box(BRICKG, [LANE_W, 3.4, 0.3], [0, 1.7, -7.1])
  k.box(BRICKR, [LANE_W, 0.08, 0.32], [0, 2.3, -7.1])
  k.box(GATE, [0.9, 1.6, 0.06], [0, 0.8, -6.93])
  k.box({ c: '#6a1a16', r: 0.6 }, [0.7, 1.4, 0.06], [0, 0.7, -6.91])
  k.box(WARM, [0.5, 0.35, 0.02], [0, 2.8, -6.94])
  // Lanterns strung across the lane.
  for (const [z, span] of [[0.2, LANE_W + 0.3], [-3.8, 2.2]]) {
    k.box(DARK, [span, 0.015, 0.015], [0, 3.15, z])
    for (const x of [-0.6, 0, 0.6]) {
      k.sphere(LANTERN, 0.15, [x, 2.85, z], [1, 0.85, 1], 8, 6)
      k.cyl(GOLD, 0.07, 0.07, 0.04, [x, 2.99, z], undefined, 6)
      k.box(DARK, [0.01, 0.15, 0.01], [x, 3.08, z])
    }
  }
  bikeRow(k, -0.95, -1.2, 3)
  rickshaw(k, 0.55, f - 1.0)
  // Vertical shop signs on the bank fronts each side of the lane mouth.
  sign(k, -1.75, 2.3, 2.2, LANTERN, DARK, 1)
  sign(k, -1.75, 4.8, 1.4, WARM, RED, 2)
  sign(k, 1.75, 2.6, 1.8, WARM, RED, 3)
}

// A vertical sign hung out from a wall at x (its face along z, in the y-z plane), bottom at y,
// h tall: a red frame, a lit panel and blocky characters on both faces.
function sign(k: PropKit, x: number, y: number, h: number, lit: Look, ink: Look, seed: number) {
  const f = D / 2
  const z = f + 0.38
  k.box(RED, [0.1, h + 0.1, 0.62], [x, y + h / 2, z])
  k.box(lit, [0.12, h - 0.06, 0.5], [x, y + h / 2, z])
  for (const dy of [h + 0.02, 0.1]) k.box(DARK, [0.03, 0.03, 0.42], [x, y + dy, f + 0.2])
  const r = rand(seed)
  const n = Math.max(2, Math.floor(h / 0.5))
  for (let i = 0; i < n; i++) {
    const cy = y + h - 0.3 - i * ((h - 0.2) / n)
    for (const sx of [-1, 1]) {
      const fx = x + sx * 0.064
      k.box(ink, [0.008, 0.035, 0.3], [fx, cy + 0.1, z])
      k.box(ink, [0.008, 0.26, 0.035], [fx, cy - 0.02, z + (r() - 0.5) * 0.12])
      k.box(ink, [0.008, 0.035, 0.2], [fx, cy - 0.08, z + (r() - 0.5) * 0.1])
      k.box(ink, [0.008, 0.035, 0.13], [fx, cy - 0.01, z + 0.06], [0.7, 0, 0])
    }
  }
}

// A cycle rickshaw parked facing +z: a front wheel and saddle, a red bench seat over two rear
// wheels under a folding hood.
function rickshaw(k: PropKit, x: number, z: number) {
  const tyre: Look = { c: '#1b1b1b', r: 0.9 }
  const frame: Look = { c: '#2f4f46', r: 0.6 }
  const seat: Look = { c: '#8b1e1e', r: 0.7 }
  for (const s of [-1, 1]) k.torus(tyre, 0.18, 0.025, [x + s * 0.32, 0.2, z - 0.15], [0, Math.PI / 2, 0], Math.PI * 2, 12, 3)
  k.torus(tyre, 0.18, 0.025, [x, 0.2, z + 0.75], [0, Math.PI / 2, 0], Math.PI * 2, 12, 3)
  k.rod(frame, [x - 0.32, 0.2, z - 0.15], [x + 0.32, 0.2, z - 0.15], 0.02, 4)
  k.rod(frame, [x, 0.25, z - 0.1], [x, 0.5, z + 0.5], 0.022, 4)
  k.rod(frame, [x, 0.5, z + 0.5], [x, 0.2, z + 0.75], 0.022, 4)
  k.rod(frame, [x, 0.5, z + 0.5], [x, 0.7, z + 0.6], 0.02, 4)
  k.box(DARK, [0.3, 0.02, 0.02], [x, 0.71, z + 0.62])
  k.box(DARK, [0.07, 0.03, 0.14], [x, 0.56, z + 0.38])
  k.box(frame, [0.66, 0.06, 0.4], [x, 0.36, z - 0.12])
  k.box(seat, [0.62, 0.1, 0.34], [x, 0.44, z - 0.14])
  k.box(seat, [0.62, 0.36, 0.06], [x, 0.66, z - 0.32])
  k.box(frame, [0.5, 0.03, 0.2], [x, 0.24, z + 0.16])
  archTop(k, { c: '#5a1414', r: 0.8 }, 0.7, 0.36, [x, 0.84, z - 0.22], Math.PI / 2, 0.75)
}

// A wooden junk moored by the embankment, facing +z: a high stern, three masts with battened
// red sails, lanterns strung along her and a lit cabin.
const JUNK_SAIL = (() => {
  const sh = new Shape()
  sh.moveTo(0, 0)
  sh.lineTo(1, 0)
  sh.lineTo(1.12, 0.62)
  sh.quadraticCurveTo(1.0, 1.0, 0.55, 1.08)
  sh.lineTo(-0.1, 0.86)
  sh.closePath()
  return new ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -0.015).rotateY(-Math.PI / 2)
})()
function junk(k: PropKit) {
  const wood: Look = { c: '#5a3a22', r: 0.9 }
  const woodD: Look = { c: '#3e2816', r: 0.95 }
  const sail: Look = { c: '#a8261c', r: 0.9 }
  k.box(woodD, [1.5, 0.5, 4.6], [0, 0.15, 0])
  k.box(wood, [1.7, 0.4, 4.4], [0, 0.6, -0.1])
  frustum(k, wood, 1.7, 1.0, 0.4, 0.4, [0, 0.4, 2.6], 0)
  k.box(wood, [1.2, 0.3, 0.9], [0, 0.65, 2.55])
  k.box(wood, [1.8, 0.7, 1.2], [0, 1.1, -1.9])
  k.box(woodD, [1.9, 0.08, 1.3], [0, 1.47, -1.9])
  k.box(RED, [1.82, 0.06, 4.42], [0, 0.82, -0.1])
  k.box(WARM, [1.82, 0.22, 0.6], [0, 1.1, -1.7])
  k.box(wood, [1.0, 0.5, 1.2], [0, 1.05, 0.2])
  k.box(woodD, [1.1, 0.06, 1.3], [0, 1.32, 0.2])
  // Masts, sails and battens.
  for (const [z, h, w] of [[1.4, 2.6, 1.3], [-0.3, 3.6, 1.8], [-1.9, 2.4, 1.1]] as const) {
    k.cyl(woodD, 0.04, 0.05, h + 0.9, [0, 0.8 + (h + 0.9) / 2, z], undefined, 5)
    k.add(sail, JUNK_SAIL, [0.06, 1.1, z], [0, Math.PI, 0], [1, h, w])
    for (let i = 1; i < 6; i++) k.box(woodD, [0.05, 0.03, w * 1.05], [0.06, 1.1 + h * (i / 6) * 0.95, z - w * 0.5])
  }
  // A string of lanterns from bow to stern over the masts.
  k.rod(DARK, [0, 1.0, 3.0], [0, 4.4, -0.3], 0.008, 3)
  k.rod(DARK, [0, 4.4, -0.3], [0, 1.6, -2.5], 0.008, 3)
  for (let i = 1; i < 5; i++) {
    const t = i / 5
    k.sphere(LANTERN, 0.1, [0, 1.0 + t * 3.4 - 0.12, 3.0 - t * 3.3], [1, 0.85, 1], 8, 6)
    k.sphere(LANTERN, 0.1, [0, 4.4 - t * 2.8 - 0.12, -0.3 - t * 2.2], [1, 0.85, 1], 8, 6)
  }
}

export default function Shanghai({ len, race }: WorldProps) {
  const banks = useMemo(() => BANKS.map((b, i) => prop(`shanghai-bank-${i}`, (k) => bank(k, b))), [])
  const clockP = useProp('shanghai-clock', clockTower)
  const gateP = useProp('shanghai-gate', gate)
  const pagodaP = useProp('shanghai-pagoda', pagoda)
  const railP = useProp('shanghai-rail', rail)
  const lanternP = useProp('shanghai-lanterns', lanterns)
  const laneP = useProp('shanghai-lane', lane)
  const junkP = useProp('shanghai-junk', junk)
  const gz = race * 0.5
  const tz = race * 0.25
  const pz = race + 12
  const RX = -(EDGE + 2.2)

  const geo = useMemo(() => {
    const r = rand(733)
    const rows: Spot[][] = BANKS.map(() => [])
    const lanes: Spot[] = []
    const clear = (zc: number, w: number) => Math.abs(zc - gz) > 4 + w / 2 && Math.abs(zc - tz) > 3.4 + w / 2 && Math.abs(zc - pz) > 5 + w / 2
    // A lane opens between the banks every forty-odd metres.
    let nextLane = 16
    for (let z = -14; z < len + 40;) {
      if (z >= nextLane && clear(z + LANE_W / 2, LANE_W + 3)) {
        lanes.push({ x: EDGE + 1.4 + D / 2, z: z + LANE_W / 2, ry: -Math.PI / 2 })
        z += LANE_W + 0.15
        nextLane = z + 34 + r() * 14
        continue
      }
      const i = Math.floor(r() * BANKS.length)
      const b = BANKS[i]
      const zc = z + b.w / 2
      if (clear(zc, b.w)) rows[i].push({ x: EDGE + 1.4 + D / 2, z: zc, ry: -Math.PI / 2 })
      z += b.w + 0.15
    }
    const rails: Spot[] = []
    for (let z = -14; z < len + 40; z += 6) if (Math.abs(z - gz) > 4) rails.push({ x: RX, z })
    const strings: Spot[] = []
    for (let z = 10; z < len + 30; z += 11) if (Math.abs(z - gz) > 4) strings.push({ x: 0, z })
    // Paving setts along the promenade, a little glinting in the lamplight.
    const rr = rand(81)
    const setts = Array.from({ length: 160 }, () => ({ x: RX + 0.4 + rr() * 1.2, z: rr() * (len + 60) - 14, s: 0.6 + rr() * 0.5, ry: rr() * 6, y: 0.01 }))
    return { rows, rails, strings, setts, lanes }
  }, [len, gz, tz, pz, RX])

  return (
    <>
      <Batch version={`shanghai:${len}`} cell={24}>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 0.8, 0.012, len / 2 + 5]}>
          <planeGeometry args={[1.6, len + 60]} />
          <meshStandardMaterial color="#9a958d" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[RX + 1.0, 0.012, len / 2 + 5]}>
          <planeGeometry args={[2.4, len + 60]} />
          <meshStandardMaterial color="#a39d93" />
        </mesh>
        <group position={[0, 0, gz]}><PropMesh parts={gateP} /></group>
        <group position={[EDGE + 1.4 + 2, 0, tz]} rotation-y={-Math.PI / 2}><PropMesh parts={clockP} /></group>
        <group position={[EDGE + 5, 0, pz]}><PropMesh parts={pagodaP} /></group>
        {[race * 0.18, race * 0.68].map((z) => <group key={z} position={[RX - 3.2, 0, z]} rotation-y={0.04}><PropMesh parts={junkP} /></group>)}
        <Scatter spots={geo.setts} colors={['#8b867e', '#9d978e']}>
          <boxGeometry args={[0.2, 0.02, 0.2]} />
        </Scatter>
      </Batch>
      {banks.map((b, i) => <Many key={i} parts={b} at={geo.rows[i]} />)}
      <Many parts={railP} at={geo.rails} />
      <Many parts={lanternP} at={geo.strings} />
      <Many parts={laneP} at={geo.lanes} />
      <Water x={RX - 40} z={len / 2} w={78} d={len + 240} id="shanghai" color="#6f8fa3" rough={0.15} />
      <Sparkles edge={RX - 0.3} />
      <Cruisers len={len} x={RX} />
      <Skyline />
    </>
  )
}

// Cruise boats outlined in lights, sliding up and down the river.
function Cruisers({ len, x }: { len: number; x: number }) {
  const boat = useProp('shanghai-cruiser', (k) => {
    const hull: Look = { c: '#f2f2f2', r: 0.6 }
    k.box({ c: '#263238', r: 0.7 }, [1.6, 0.4, 5.4], [0, 0.2, 0])
    k.box(hull, [1.5, 0.6, 4.8], [0, 0.7, 0])
    k.box(hull, [1.3, 0.5, 3.6], [0, 1.25, -0.3])
    k.box(hull, [1.0, 0.4, 2.0], [0, 1.7, -0.6])
    for (const y of [0.72, 1.27]) for (const s of [-1, 1]) k.box(WIN, [0.02, 0.24, y > 1 ? 3.2 : 4.4], [s * (y > 1 ? 0.66 : 0.76), y, y > 1 ? -0.3 : 0])
    const strip = glow('#4dd0ff', 0.2, 1.8)
    const pink = glow('#ff4fb8', 0.2, 1.8)
    for (const s of [-1, 1]) {
      k.box(strip, [0.03, 0.04, 4.8], [s * 0.77, 1.0, 0])
      k.box(pink, [0.03, 0.04, 3.6], [s * 0.67, 1.5, -0.3])
    }
    k.box(strip, [1.3, 0.04, 0.03], [0, 1.5, 1.5])
    k.box({ c: '#c62828', r: 0.7 }, [0.02, 0.35, 0.5], [0, 2.3, -1.2])
    k.cyl(DARK, 0.02, 0.02, 0.8, [0, 2.2, -1.5], undefined, 4)
  })
  const refs = useRef<(Group | null)[]>([])
  const boats = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ x: x - 7 - (i % 3) * 7, z: (i / 5) * (len + 60), v: (i % 2 ? -1 : 1) * (0.6 + (i % 3) * 0.2) })), [len, x])
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

// The far bank: the pearl tower, the bottle-opener tower, the twisting tower and a wall of glass.
function Skyline() {
  const parts = useProp('shanghai-skyline', (k) => {
    // Glass that keeps a faint blue glow after dark, so the towers stand out against the night sky.
    const glass = glow('#5b7fa6', 0.35, 0.35)
    const glass2 = glow('#6c7f93', 0.4, 0.3)
    const lit = glow('#d6f0ff', 0.1, 1.4)
    const pinkGlow = glow('#ff4fa3', 0.15, 1.5)
    // Pearl tower: three legs, a big pearl low, a smaller one high, a little one and the spire.
    const px = -38
    const pz = 72
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      k.rod({ c: '#d9d4cf', r: 0.5 }, [px + Math.sin(a) * 6, 0, pz + Math.cos(a) * 6], [px + Math.sin(a) * 1.4, 14, pz + Math.cos(a) * 1.4], 0.9, 8)
    }
    for (let i = 0; i < 3; i++) k.cyl({ c: '#d9d4cf', r: 0.5 }, 1.0, 1.0, 34, [px + Math.sin(i * 2.1) * 1.2, 22, pz + Math.cos(i * 2.1) * 1.2], undefined, 10)
    k.sphere({ c: '#c2185b', r: 0.3, m: 0.3 }, 5.2, [px, 14, pz], [1, 1, 1], 20, 14)
    k.sphere({ c: '#c2185b', r: 0.3, m: 0.3 }, 3.2, [px, 36, pz], [1, 1, 1], 18, 12)
    k.sphere({ c: '#c2185b', r: 0.3, m: 0.3 }, 1.4, [px, 46, pz], [1, 1, 1], 14, 10)
    for (const y of [12, 14, 16, 35, 37]) k.torus(pinkGlow, y < 30 ? 5.25 : 3.25, 0.12, [px, y, pz], [Math.PI / 2, 0, 0], Math.PI * 2, 32, 4)
    k.cyl({ c: '#d9d4cf', r: 0.5 }, 0.5, 0.8, 8, [px, 51, pz], undefined, 8)
    k.cyl({ c: '#bdbdbd', r: 0.4, m: 0.6 }, 0.12, 0.3, 10, [px, 60, pz], undefined, 6)
    // The bottle opener: a tall tapering slab with a trapezoid hole near its top.
    const bx = -10
    const bz = 96
    frustum(k, glass, 9, 9, 50, 0.7, [bx, 0, bz])
    k.box(DARK, [4.2, 4.6, 7], [bx, 52.5, bz])
    for (const s of [-1, 1]) k.box(glass, [1.6, 7, 6.4], [bx + s * 2.9, 53.5, bz])
    k.box(glass, [7.4, 1.4, 6.4], [bx, 56.4, bz])
    for (let y = 4; y < 50; y += 3) k.box(lit, [9 - y * 0.05, 0.25, 0.1], [bx, y, bz - 4.5 + y * 0.022])
    // The twisting tower, stacked slabs each turned a little more.
    const tx = 4
    const tz = 108
    for (let i = 0; i < 26; i++) {
      const s = 10 - i * 0.22
      k.box(i % 2 ? glass : glass2, [s, 2.6, s], [tx, 1.3 + i * 2.6, tz], [0, i * 0.06, 0])
      if (i % 2) k.box(lit, [s * 0.9, 0.2, 0.1], [tx, 1.3 + i * 2.6, tz - s / 2 - 0.02], [0, i * 0.06, 0])
    }
    // A wall of lit glass towers along the far bank.
    const rr = rand(91)
    for (let i = 0; i < 16; i++) {
      const x = -90 + i * 7 + rr() * 3
      if (Math.abs(x - px) < 9 || Math.abs(x - bx) < 7 || Math.abs(x - tx) < 7) continue
      const h = 14 + rr() * 26
      const w = 4 + rr() * 3
      const z = 80 + rr() * 30
      k.box(rr() < 0.5 ? glass : glass2, [w, h, w], [x, h / 2, z])
      for (let y = 3; y < h - 1; y += 2.4) k.box(lit, [w * 0.86, 0.22, 0.1], [x, y, z - w / 2 - 0.02])
      k.box(rr() < 0.4 ? pinkGlow : lit, [w * 0.6, 0.3, 0.1], [x, h + 0.4, z - w / 2])
    }
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
