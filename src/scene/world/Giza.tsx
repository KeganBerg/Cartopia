import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, type Group } from 'three'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Scatter, Water, archTop, frustum, prop, rand, useProp, type Look, type PropKit, type Spot } from './kit'
import type { WorldProps } from './WorldVenue'

// Egypt, Pyramid Road: the strip runs out of an old mud-brick quarter towards the pyramids.
// Left: flat-roofed houses with carved wooden window screens, a domed mosque and its minaret,
// then palms and the river with feluccas under sail. Right: a spice market at the start, date
// palms and resting camels, two obelisks and a temple gateway the racers drive through halfway,
// and the great lion statue watching the finish. The three pyramids stand on the horizon ahead.

const SAND = '#d9b27a'
const STONE: Look = { c: '#d6b47e', r: 0.95 }
const STONE_D: Look = { c: '#bd975f', r: 0.95 }
const STONE_L: Look = { c: '#e6cc98', r: 0.9 }
const WOOD: Look = { c: '#6d4c35', r: 0.9 }
const WOOD_L: Look = { c: '#8a6343', r: 0.9 }
const DARK: Look = { c: '#3b2a20', r: 1 }
const GOLD: Look = { c: '#e3b23c', r: 0.35, m: 0.6 }

// Mud-brick houses facing +z (their street side), built once each.
const WALLS = ['#d8b98c', '#c9a274', '#e5cfa6', '#e8dcc4', '#cf9f6f', '#dcc29a']
const shade = (c: string, k: number) => {
  const n = parseInt(c.slice(1), 16)
  const ch = (s: number) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0')
  return ch(16) + ch(8) + ch(0)
}

const DOORS = ['#2f6f8f', '#6d4c35', '#1f5f6f', '#8a3b2b']
type HouseDef = { w: number; d: number; floors: number; wall: number; door: number; screen: boolean; tank: boolean; shade: boolean }
const HOUSES: HouseDef[] = [
  { w: 2.6, d: 2.4, floors: 2, wall: 0, door: 0, screen: true, tank: true, shade: false },
  { w: 3.2, d: 2.6, floors: 3, wall: 1, door: 1, screen: true, tank: false, shade: true },
  { w: 2.2, d: 2.2, floors: 1, wall: 2, door: 2, screen: false, tank: true, shade: true },
  { w: 3.0, d: 2.5, floors: 2, wall: 3, door: 3, screen: false, tank: true, shade: false },
  { w: 2.4, d: 2.4, floors: 3, wall: 4, door: 1, screen: true, tank: true, shade: false },
  { w: 2.8, d: 2.3, floors: 2, wall: 5, door: 0, screen: true, tank: false, shade: true },
]
const STOREY = 1.15

function house(k: PropKit, h: HouseDef) {
  const wall: Look = { c: WALLS[h.wall], r: 0.95 }
  const trim: Look = { c: '#' + shade(WALLS[h.wall], 0.86), r: 0.95 }
  const door: Look = { c: DOORS[h.door], r: 0.8 }
  const H = h.floors * STOREY
  const f = h.d / 2
  k.box(wall, [h.w, H, h.d], [0, H / 2, 0])
  // A darker plinth where the street dust splashes, and a band between the floors.
  k.box(trim, [h.w + 0.04, 0.22, h.d + 0.04], [0, 0.11, 0])
  for (let i = 1; i < h.floors; i++) k.box(trim, [h.w + 0.03, 0.07, h.d + 0.03], [0, i * STOREY, 0])
  // Parapet round the flat roof.
  k.box(trim, [h.w + 0.06, 0.2, 0.1], [0, H + 0.1, f - 0.02])
  k.box(trim, [h.w + 0.06, 0.2, 0.1], [0, H + 0.1, -f + 0.02])
  k.box(trim, [0.1, 0.2, h.d], [h.w / 2 - 0.02, H + 0.1, 0])
  k.box(trim, [0.1, 0.2, h.d], [-h.w / 2 + 0.02, H + 0.1, 0])
  // Arched front door in a lighter frame.
  const dx = h.w > 2.5 ? -h.w * 0.22 : 0
  k.box(STONE_L, [0.62, 0.92, 0.05], [dx, 0.46, f + 0.01])
  archTop(k, STONE_L, 0.62, 0.05, [dx, 0.92, f + 0.01])
  k.box(door, [0.48, 0.84, 0.06], [dx, 0.42, f + 0.02])
  archTop(k, door, 0.48, 0.06, [dx, 0.84, f + 0.02])
  k.box(GOLD, [0.04, 0.04, 0.03], [dx + 0.14, 0.45, f + 0.06])
  // Ground floor: a small barred window beside the door.
  const wx = dx === 0 ? h.w * 0.32 : h.w * 0.18
  k.box(DARK, [0.36, 0.4, 0.04], [wx, 0.72, f + 0.005])
  k.box(trim, [0.46, 0.06, 0.08], [wx, 0.95, f + 0.02])
  for (const bx of [-0.09, 0, 0.09]) k.box(WOOD, [0.025, 0.4, 0.03], [wx + bx, 0.72, f + 0.03])
  // Upper floors: deep-set windows, and on some a carved wooden screen that juts out.
  for (let fl = 1; fl < h.floors; fl++) {
    const y = fl * STOREY + 0.55
    const n = h.w > 2.7 ? 3 : 2
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (h.w / n)
      if (h.screen && i === (fl % n)) {
        k.box(WOOD, [0.62, 0.72, 0.22], [x, y, f + 0.11])
        k.box(WOOD_L, [0.7, 0.07, 0.28], [x, y + 0.39, f + 0.12])
        k.box(WOOD_L, [0.7, 0.06, 0.26], [x, y - 0.38, f + 0.11])
        // The lattice: thin bars over a dark back.
        for (const bx of [-0.2, -0.1, 0, 0.1, 0.2]) k.box(WOOD_L, [0.025, 0.6, 0.02], [x + bx, y, f + 0.23])
        for (const by of [-0.18, 0, 0.18]) k.box(WOOD_L, [0.56, 0.025, 0.02], [x, y + by, f + 0.235])
      } else {
        k.box(DARK, [0.34, 0.5, 0.04], [x, y, f + 0.005])
        k.box(trim, [0.44, 0.06, 0.08], [x, y + 0.29, f + 0.02])
        k.box(trim, [0.42, 0.05, 0.1], [x, y - 0.27, f + 0.03])
        k.box(door, [0.08, 0.5, 0.03], [x - 0.22, y, f + 0.03])
        k.box(door, [0.08, 0.5, 0.03], [x + 0.22, y, f + 0.03])
      }
    }
  }
  // Roof clutter: a water tank on legs, a stair hut, a palm-frond sun shade.
  if (h.tank) {
    const tx = h.w * 0.25
    for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) k.box(DARK, [0.04, 0.35, 0.04], [tx + lx, H + 0.18, -0.3 + lz])
    k.cyl({ c: '#9e9e9e', r: 0.5, m: 0.4 }, 0.26, 0.26, 0.45, [tx, H + 0.58, -0.3], undefined, 12)
  }
  k.box(wall, [0.8, 0.75, 0.8], [-h.w / 2 + 0.5, H + 0.37, -f + 0.5])
  k.box(door, [0.36, 0.56, 0.03], [-h.w / 2 + 0.5, H + 0.28, -f + 0.91])
  if (h.shade) {
    for (const px of [-0.5, 0.5]) for (const pz of [-0.4, 0.4]) k.box(WOOD, [0.05, 0.75, 0.05], [0.25 + px, H + 0.37, 0.1 + pz])
    k.box({ c: '#b9a16a', r: 1 }, [1.2, 0.05, 1.0], [0.25, H + 0.77, 0.1])
  }
}

// A small domed mosque with its minaret, facing +z.
function mosque(k: PropKit) {
  const wall: Look = { c: '#ece2cf', r: 0.9 }
  const trim: Look = { c: '#c9b28d', r: 0.9 }
  const dome: Look = { c: '#f4efe6', r: 0.6 }
  k.box(wall, [4.2, 2.6, 3.8], [0, 1.3, 0])
  k.box(trim, [4.3, 0.22, 3.9], [0, 0.11, 0])
  // Crenellated parapet.
  for (let i = 0; i < 9; i++) {
    k.box(trim, [0.26, 0.26, 0.12], [-2 + i * 0.5, 2.73, 1.86])
    k.box(trim, [0.26, 0.26, 0.12], [-2 + i * 0.5, 2.73, -1.86])
  }
  k.box(trim, [4.3, 0.1, 3.9], [0, 2.62, 0])
  // Drum and dome, with a crescent finial.
  k.cyl(wall, 1.15, 1.15, 0.6, [0, 2.95, 0], undefined, 16)
  k.sphere(dome, 1.2, [0, 3.25, 0], [1, 1.05, 1], 16, 8, Math.PI / 2)
  k.cyl(GOLD, 0.03, 0.03, 0.5, [0, 4.75, 0], undefined, 6)
  k.sphere(GOLD, 0.08, [0, 4.55, 0])
  k.torus(GOLD, 0.11, 0.025, [0, 5.05, 0], [0, 0, 0], Math.PI * 1.3, 12, 4)
  // Three tall arched windows and a great arched door.
  for (const x of [-1.4, 1.4]) {
    k.box(DARK, [0.5, 0.9, 0.04], [x, 1.45, 1.905])
    archTop(k, DARK, 0.5, 0.04, [x, 1.9, 1.905])
    k.box(trim, [0.62, 0.07, 0.1], [x, 0.98, 1.92])
  }
  k.box(trim, [1.2, 1.9, 0.08], [0, 0.95, 1.92])
  archTop(k, trim, 1.2, 0.08, [0, 1.9, 1.92])
  k.box({ c: '#2e6b4f', r: 0.8 }, [0.9, 1.7, 0.1], [0, 0.85, 1.94])
  archTop(k, { c: '#2e6b4f', r: 0.8 }, 0.9, 0.1, [0, 1.7, 1.94])
  // Minaret: square base, then a round shaft with two balconies, and a little dome.
  const mx = 2.7
  const mz = -1.2
  k.box(wall, [1.1, 3.2, 1.1], [mx, 1.6, mz])
  k.box(trim, [1.2, 0.14, 1.2], [mx, 3.25, mz])
  k.cyl(wall, 0.42, 0.48, 3.0, [mx, 4.8, mz], undefined, 12)
  k.cyl(trim, 0.68, 0.6, 0.2, [mx, 6.35, mz], undefined, 12)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    k.box(trim, [0.04, 0.3, 0.04], [mx + Math.cos(a) * 0.62, 6.6, mz + Math.sin(a) * 0.62])
  }
  k.cyl(trim, 0.66, 0.66, 0.05, [mx, 6.75, mz], undefined, 12)
  k.cyl(wall, 0.34, 0.38, 1.4, [mx, 7.45, mz], undefined, 12)
  k.cyl(trim, 0.52, 0.46, 0.14, [mx, 8.2, mz], undefined, 12)
  k.cyl(wall, 0.28, 0.3, 0.6, [mx, 8.55, mz], undefined, 12)
  k.sphere(dome, 0.32, [mx, 8.85, mz], [1, 1.4, 1], 12, 6, Math.PI / 2)
  k.cyl(GOLD, 0.02, 0.02, 0.35, [mx, 9.4, mz], undefined, 6)
  for (const y of [4.2, 5.4, 7.3]) k.box(DARK, [0.14, 0.3, 0.04], [mx, y, mz + 0.45])
}

// A spice and pottery stall under a striped cloth, facing +z.
function stall(k: PropKit, a: string, b: string) {
  for (const x of [-0.75, 0.75]) for (const z of [-0.5, 0.5]) k.box(WOOD, [0.06, 1.35, 0.06], [x, 0.67, z])
  for (let i = 0; i < 6; i++) k.box({ c: i % 2 ? a : b, r: 1 }, [0.28, 0.04, 1.3], [-0.7 + i * 0.28, 1.38 + (i % 2) * 0.005, 0.05], [-0.12, 0, 0])
  k.box(WOOD_L, [1.6, 0.06, 0.8], [0, 0.6, 0.15])
  k.box(WOOD, [1.5, 0.55, 0.06], [0, 0.3, 0.52])
  // Heaps of spice, baskets and clay jars.
  const heaps = ['#d84315', '#f9a825', '#8d3a1a', '#c0ca33', '#6d4c41']
  heaps.forEach((c, i) => {
    const x = -0.6 + i * 0.3
    k.cyl({ c: '#a1887f', r: 1 }, 0.13, 0.11, 0.12, [x, 0.69, 0.25], undefined, 10)
    k.cone({ c, r: 1 }, 0.12, 0.14, [x, 0.82, 0.25], undefined, 10)
  })
  for (const x of [-0.45, 0, 0.45]) {
    k.sphere({ c: '#b5653b', r: 0.9 }, 0.12, [x, 0.75, -0.08], [1, 1.2, 1], 10, 6)
    k.cyl({ c: '#a0522d', r: 0.9 }, 0.05, 0.07, 0.08, [x, 0.92, -0.08], undefined, 8)
  }
  k.sphere({ c: '#b5653b', r: 0.9 }, 0.2, [0.95, 0.24, 0.55], [1, 1.25, 1], 10, 6)
  k.sphere({ c: '#c97b4e', r: 0.9 }, 0.16, [1.2, 0.2, 0.3], [1, 1.2, 1], 10, 6)
  // A rolled rug leaning on a post.
  k.cyl({ c: '#8e2431', r: 1 }, 0.09, 0.09, 1.0, [-0.95, 0.5, 0.45], [0, 0, 0.15], 10)
}

// A camel, standing or resting with its legs folded, facing +z.
function camel(k: PropKit, down: boolean) {
  const hide: Look = { c: '#c49a63', r: 1 }
  const dark: Look = { c: '#9a7448', r: 1 }
  const y = down ? 0.42 : 0.95
  k.sphere(hide, 0.5, [0, y, 0], [0.62, 0.62, 1], 12, 8)
  k.sphere(hide, 0.3, [0, y + 0.3, -0.05], [1, 0.95, 1.2], 10, 6, Math.PI / 2)
  // Saddle blanket with a fringe.
  k.box({ c: '#b71c1c', r: 1 }, [0.66, 0.04, 0.5], [0, y + 0.18, 0.28], [0.25, 0, 0])
  k.box({ c: '#fbc02d', r: 1 }, [0.68, 0.05, 0.05], [0, y + 0.1, 0.5])
  // Neck curving up and forward, then the head with its long muzzle.
  k.rod(hide, [0, y + 0.1, 0.4], [0, y + 0.45, 0.72], 0.12, 8)
  k.rod(hide, [0, y + 0.45, 0.72], [0, y + 0.82, 0.78], 0.1, 8)
  k.sphere(hide, 0.13, [0, y + 0.88, 0.82], [0.9, 0.9, 1.1], 10, 6)
  k.box(hide, [0.13, 0.13, 0.28], [0, y + 0.84, 0.98])
  k.box(dark, [0.12, 0.05, 0.05], [0, y + 0.8, 1.11])
  for (const s of [-1, 1]) {
    k.box(DARK, [0.02, 0.03, 0.03], [s * 0.1, y + 0.92, 0.88])
    k.box(dark, [0.03, 0.08, 0.04], [s * 0.07, y + 0.99, 0.76], [0, 0, s * 0.4])
  }
  k.rod(dark, [0, y + 0.05, -0.48], [0, y - 0.3, -0.55], 0.03, 5)
  if (down) {
    for (const s of [-1, 1]) {
      k.box(hide, [0.13, 0.12, 0.5], [s * 0.28, 0.06, 0.25])
      k.box(hide, [0.13, 0.12, 0.45], [s * 0.26, 0.06, -0.3])
      k.box(dark, [0.15, 0.06, 0.15], [s * 0.28, 0.03, 0.52])
    }
  } else {
    for (const s of [-1, 1]) for (const z of [0.3, -0.32]) {
      k.rod(hide, [s * 0.16, y - 0.15, z], [s * 0.17, 0.5, z + 0.02], 0.065, 6)
      k.rod(hide, [s * 0.17, 0.5, z + 0.02], [s * 0.17, 0.05, z], 0.05, 6)
      k.sphere(dark, 0.055, [s * 0.17, 0.5, z + 0.02])
      k.box(dark, [0.12, 0.05, 0.15], [s * 0.17, 0.025, z + 0.02])
    }
  }
}

// A date palm: a ringed trunk, drooping fronds and hanging clusters of dates.
function datePalm(k: PropKit, h: number) {
  const bark: Look = { c: '#7d5f43', r: 1 }
  const ring: Look = { c: '#6a4e36', r: 1 }
  for (let i = 0; i < 7; i++) {
    const y = (i + 0.5) * (h / 7)
    k.cyl(i % 2 ? ring : bark, 0.11 - i * 0.004, 0.12 - i * 0.004, h / 7 + 0.01, [0, y, 0], undefined, 7)
  }
  const fr = ['#4e7d34', '#5b8c3a', '#43702e']
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const up = i % 2 ? 0.25 : -0.35
    const c = fr[i % 3]
    // Each frond in two pieces so it arcs over and droops.
    k.box({ c, r: 0.9 }, [0.14, 0.03, 0.75], [Math.sin(a) * 0.35, h + 0.1 + up * 0.3, Math.cos(a) * 0.35], [-0.25 + up, a, 0])
    k.box({ c, r: 0.9 }, [0.11, 0.03, 0.65], [Math.sin(a) * 0.95, h - 0.08 + up * 0.25, Math.cos(a) * 0.95], [0.55 + up * 0.5, a, 0])
  }
  // Bunches of dates hanging under the crown on short stalks.
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6 + 0.4
    const x = Math.sin(a) * 0.17
    const z = Math.cos(a) * 0.17
    k.rod({ c: '#b8862e', r: 0.9 }, [x * 0.6, h - 0.05, z * 0.6], [x, h - 0.22, z], 0.015, 4)
    for (let j = 0; j < 5; j++) k.sphere({ c: j % 2 ? '#8a3f17' : '#a4521d', r: 0.7 }, 0.045, [x + Math.sin(j * 2.4) * 0.05, h - 0.26 - (j % 3) * 0.05, z + Math.cos(j * 2.4) * 0.05], [1, 1.3, 1], 6, 4)
  }
  k.sphere({ c: '#5d4630', r: 1 }, 0.16, [0, h + 0.02, 0], [1, 0.8, 1], 8, 5)
}

// An obelisk on its plinth.
function obelisk(k: PropKit) {
  k.box(STONE_D, [1.1, 0.35, 1.1], [0, 0.17, 0])
  k.box(STONE, [0.9, 0.4, 0.9], [0, 0.55, 0])
  frustum(k, { c: '#c99a6a', r: 0.85 }, 0.58, 0.58, 4.8, 0.66, [0, 0.75, 0])
  frustum(k, GOLD, 0.39, 0.39, 0.42, 0, [0, 5.55, 0])
  // Columns of carved signs down each face: small dark notches, set into the taper.
  const glyph: Look = { c: '#8a6440', r: 1 }
  for (let i = 0; i < 9; i++) {
    const y = 1.2 + i * 0.45
    const half = 0.29 - (y - 0.75) * (0.29 * 0.34) / 4.8
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
      k.box(glyph, [0.1 + (i % 3) * 0.03, 0.22, 0.01], [dx * (half + 0.004), y, dz * (half + 0.004)], [0, ry, 0])
    }
  }
}

// A temple gateway across the road: two tapering towers with flag masts, and a carved portal
// between them that the racers drive under. Built facing +z, centred on the road.
function pylon(k: PropKit) {
  const face: Look = { c: '#d1ad74', r: 0.95 }
  for (const s of [-1, 1]) {
    const x = s * 5.1
    frustum(k, face, 4.6, 2.4, 6.2, 0.78, [x, 0, 0])
    // The flared cornice on top, and a rolled moulding along the edges.
    k.box(STONE_D, [3.75, 0.12, 2.0], [x, 6.24, 0])
    k.box(STONE_L, [3.95, 0.4, 2.15], [x, 6.48, 0])
    // Recessed grooves for the flag masts, and the masts with their pennants.
    for (const mx of [-0.75, 0.75]) {
      const gx = x + mx
      k.box(STONE_D, [0.22, 5.4, 0.02], [gx, 2.9, 1.08])
      k.cyl(WOOD, 0.05, 0.07, 8.6, [gx, 4.3, 1.25], undefined, 6)
      k.box({ c: mx < 0 ? '#c62828' : '#1565c0', r: 1 }, [0.03, 0.42, 0.9], [gx, 8.2, 1.7])
    }
    // A great carved king on each tower: a sunk-relief figure in darker stone.
    const fx = x - s * 0.1
    k.box(STONE_D, [0.7, 2.0, 0.02], [fx, 2.2, 1.17])
    k.box(STONE_D, [0.45, 0.5, 0.02], [fx, 3.5, 1.11])
    k.box(STONE_D, [1.2, 0.18, 0.02], [fx + s * 0.4, 2.8, 1.15])
    k.box(STONE_D, [1.0, 0.3, 0.02], [fx, 0.6, 1.22])
  }
  // The portal: jambs, a lintel with the winged sun, and a cornice.
  for (const s of [-1, 1]) k.box(face, [0.8, 4.0, 1.6], [s * 2.9, 2.0, 0])
  k.box(face, [6.6, 0.9, 1.6], [0, 4.35, 0])
  k.box(STONE_L, [6.9, 0.3, 1.75], [0, 4.95, 0])
  for (const z of [0.81, -0.81]) {
    k.cyl({ c: '#c62828', r: 0.6 }, 0.26, 0.26, 0.02, [0, 4.35, z], [Math.PI / 2, 0, 0], 16)
    for (const s of [-1, 1]) {
      k.box({ c: '#1e5aa8', r: 0.7 }, [1.5, 0.16, 0.02], [s * 1.05, 4.42, z])
      k.box({ c: '#e3b23c', r: 0.6 }, [1.3, 0.1, 0.02], [s * 1.0, 4.24, z])
      k.box({ c: '#2e7d4f', r: 0.7 }, [1.0, 0.07, 0.02], [s * 0.95, 4.1, z])
    }
  }
}

// The great lion with a king's head, lying on its bedrock, facing +z.
function sphinx(k: PropKit) {
  const body: Look = { c: '#d2ad74', r: 1 }
  const worn: Look = { c: '#bf9862', r: 1 }
  const lite: Look = { c: '#e2c48e', r: 1 }
  const band: Look = { c: '#b48c58', r: 1 }
  // The rock-cut hollow it lies in, and its bedrock plinth.
  k.box({ c: '#b48a55', r: 1 }, [4.4, 0.5, 10.6], [0, 0.25, -0.4])
  // A long lion's body: a smooth back over a solid base, shoulders and haunches bulging.
  k.box(body, [2.3, 1.1, 6.2], [0, 1.05, -0.9])
  k.sphere(body, 1, [0, 1.55, -0.9], [1.2, 0.8, 3.2], 16, 10)
  k.sphere(lite, 1, [0, 1.75, 1.2], [1.25, 1.15, 1.1], 14, 8)
  for (const s of [-1, 1]) {
    k.sphere(worn, 1, [s * 0.75, 1.35, -3.15], [0.6, 0.95, 1.25], 12, 8)
    // Folded back leg and paw along each flank.
    k.box(worn, [0.5, 0.5, 1.9], [s * 1.2, 0.75, -2.7])
    k.box(worn, [0.55, 0.4, 0.7], [s * 1.15, 0.7, -1.5])
    // Long front legs and paws stretched out ahead.
    k.box(body, [0.66, 0.6, 2.6], [s * 0.72, 0.8, 2.85])
    k.box(lite, [0.7, 0.42, 0.55], [s * 0.72, 0.71, 4.35])
    for (const t of [-0.22, -0.07, 0.07, 0.22]) k.box(band, [0.03, 0.34, 0.04], [s * 0.72 + t, 0.71, 4.63])
  }
  // The tail curled round the right haunch.
  k.rod(worn, [0.6, 0.85, -3.9], [1.35, 0.72, -2.9], 0.12, 7)
  k.rod(worn, [1.35, 0.72, -2.9], [1.5, 0.66, -1.9], 0.1, 7)
  // Chest and neck.
  k.box(body, [1.9, 1.9, 1.2], [0, 1.65, 1.75])
  k.box(body, [1.2, 1.1, 1.0], [0, 2.9, 1.75])
  // The striped royal headcloth: a cap over the brow, broad flaps falling to the shoulders.
  const hx = 0
  const hy = 3.55
  const hz = 1.95
  frustum(k, lite, 1.75, 1.6, 0.7, 0.7, [hx, hy + 0.55, hz - 0.15])
  k.box(lite, [1.75, 0.18, 1.6], [hx, hy + 0.55, hz - 0.15])
  for (const s of [-1, 1]) {
    k.box(lite, [0.42, 1.25, 0.4], [hx + s * 0.78, hy - 0.3, hz + 0.1], [0, 0, s * 0.14])
    for (let i = 0; i < 4; i++) k.box(band, [0.44, 0.07, 0.42], [hx + s * (0.78 + (1.5 - i) * 0.04), hy - 0.75 + i * 0.3, hz + 0.1], [0, 0, s * 0.14])
  }
  k.box(band, [1.4, 0.12, 0.08], [hx, hy + 0.47, hz + 0.66])
  // The face: brows, deep-set eyes, the broken nose and a calm mouth.
  k.box(body, [1.2, 1.3, 0.9], [hx, hy - 0.05, hz + 0.25])
  for (const s of [-1, 1]) {
    k.box(worn, [0.34, 0.08, 0.1], [hx + s * 0.25, hy + 0.32, hz + 0.68])
    k.box({ c: '#5b4128', r: 1 }, [0.22, 0.08, 0.04], [hx + s * 0.25, hy + 0.2, hz + 0.68])
    k.box(worn, [0.12, 0.3, 0.2], [hx + s * 0.6, hy + 0.05, hz + 0.3])
  }
  k.box(worn, [0.2, 0.34, 0.2], [hx, hy - 0.02, hz + 0.72])
  k.box(worn, [0.4, 0.05, 0.06], [hx, hy - 0.36, hz + 0.68])
  k.box(body, [0.6, 0.25, 0.3], [hx, hy - 0.62, hz + 0.55])
}

// A felucca: a low wooden hull with a tall slanting sail.
const sailGeo = new CylinderGeometry(1, 1, 1, 3, 1)
function felucca(k: PropKit) {
  const hull: Look = { c: '#5b3f2a', r: 0.9 }
  frustum(k, hull, 0.7, 2.6, 0.35, 1.25, [0, 0, 0])
  k.box({ c: '#e8e2d0', r: 0.9 }, [0.72, 0.06, 2.0], [0, 0.4, 0])
  k.box({ c: '#2f6f8f', r: 0.8 }, [0.9, 0.05, 3.3], [0, 0.44, 0])
  k.rod(WOOD, [0, 0.4, 0.5], [0, 2.6, 0.35], 0.03, 5)
  k.rod(WOOD, [0, 0.7, 1.7], [0, 3.6, -0.6], 0.025, 5)
  k.add({ c: '#f7f3ea', r: 0.85 }, sailGeo, [0.03, 2.0, 0.4], [0, Math.PI / 2, Math.PI / 2], [1.65, 0.02, 1.1])
}

export default function Giza({ len, race }: WorldProps) {
  const houses = useMemo(() => HOUSES.map((h, i) => prop(`giza-house-${i}`, (k) => house(k, h))), [])
  const mosqueP = useProp('giza-mosque', mosque)
  const stalls = useMemo(() => [['#c62828', '#fafafa'], ['#1565c0', '#fdd835'], ['#2e7d32', '#fafafa'], ['#6a1b9a', '#ffb300']].map(([a, b], i) => prop(`giza-stall-${i}`, (k) => stall(k, a, b))), [])
  const camelUp = useProp('giza-camel-up', (k) => camel(k, false))
  const camelDown = useProp('giza-camel-down', (k) => camel(k, true))
  const palms = useMemo(() => [2.4, 3.0, 3.6].map((h) => prop(`giza-palm-${h}`, (k) => datePalm(k, h))), [])
  const obeliskP = useProp('giza-obelisk', obelisk)
  const pylonP = useProp('giza-pylon', pylon)
  const sphinxP = useProp('giza-sphinx', sphinx)
  const gate = race * 0.5
  const mosqueZ = race * 0.28 + 4

  const geo = useMemo(() => {
    const r = rand(311)
    // The left side: an unbroken row of houses, gaps only for the mosque and the gateway.
    const rows: Spot[][] = HOUSES.map(() => [])
    for (let z = -14; z < len + 40;) {
      const i = Math.floor(r() * HOUSES.length)
      const h = HOUSES[i]
      const zc = z + h.w / 2
      const clear = Math.abs(zc - mosqueZ) > 2.1 + h.w / 2 && Math.abs(zc - gate) > 3.2 + h.w / 2
      if (clear) rows[i].push({ x: -(EDGE + 0.45 + h.d / 2), z: zc, ry: Math.PI / 2 })
      z += h.w + (r() < 0.25 ? 0.6 : 0.05)
    }
    // A second row behind, taller, peeking over the first.
    for (let z = -12; z < len + 40;) {
      const i = Math.floor(r() * HOUSES.length)
      const h = HOUSES[i]
      const zc = z + h.w / 2
      if (Math.abs(zc - mosqueZ) > 3 + h.w / 2) rows[i].push({ x: -(EDGE + 3.4 + h.d / 2), z: zc, ry: Math.PI / 2, y: 0.35 })
      z += h.w + 0.3
    }
    // Spice stalls by the start line, behind the crowd.
    const stallAt: Spot[][] = [[], [], [], []]
    for (let i = 0; i < 8; i++) stallAt[i % 4].push({ x: EDGE + 1.35, z: -6 + i * 2.1, ry: -Math.PI / 2 })
    // Date palms in groves on the right, and along the river bank on the left.
    const palmAt: Spot[][] = [[], [], []]
    for (let z = 12; z < len + 60; z += 2.2 + r() * 3) palmAt[Math.floor(r() * 3)].push({ x: EDGE + 4 + r() * 9, z, ry: r() * 6, s: 0.9 + r() * 0.3 })
    for (let z = -10; z < len + 60; z += 3 + r() * 3) palmAt[Math.floor(r() * 3)].push({ x: -(EDGE + 8.6 + r() * 1.6), z, ry: r() * 6, s: 0.85 + r() * 0.3 })
    for (let z = -6; z < len + 80; z += 4 + r() * 4) palmAt[Math.floor(r() * 3)].push({ x: -(EDGE + 30 + r() * 6), z, ry: r() * 6, s: 1.1 + r() * 0.4 })
    // Camels resting in the palms' shade, a few standing.
    const up: Spot[] = []
    const down: Spot[] = []
    for (let z = 16; z < len + 30; z += 5 + r() * 7) (r() < 0.45 ? up : down).push({ x: EDGE + 2.6 + r() * 6, z, ry: r() * 6 })
    const rr = rand(57)
    const near = (n: number, from: number, to: number) =>
      Array.from({ length: n }, () => {
        const side = rr() < 0.4 ? -1 : 1
        return { x: side * (EDGE + from + rr() ** 1.3 * (to - from)), z: rr() * (len + 60) - 14, s: 0.6 + rr() * 0.8, ry: rr() * 6 }
      })
    return { rows, stallAt, palmAt, up, down, grass: near(360, 0.2, 16).filter((p) => p.x > 0), rocks: near(200, 0.2, 18).filter((p) => p.x > 0) }
  }, [len, gate, mosqueZ])

  return (
    <>
      <Batch version={`giza:${len}`} cell={24}>
        {/* Street-side pavement on the left, in front of the houses. */}
        <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + 3), 0.012, len / 2 + 5]}>
          <planeGeometry args={[6, len + 60]} />
          <meshStandardMaterial color="#cfb48a" />
        </mesh>
        <group position={[-(EDGE + 2.6), 0, mosqueZ]} rotation-y={Math.PI / 2}>
          <PropMesh parts={mosqueP} />
        </group>
        {/* The river bank, the river and the far bank. */}
        <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + 9.6), 0.013, len / 2 + 5]}>
          <planeGeometry args={[3.2, len + 120]} />
          <meshStandardMaterial color="#8a9a4e" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + 30), 0.013, len / 2 + 5]}>
          <planeGeometry args={[8, len + 160]} />
          <meshStandardMaterial color="#7f9448" />
        </mesh>
        <group position={[0, 0, gate]}><PropMesh parts={pylonP} /></group>
        {[gate - 5.5, gate + 5.5].map((z) => [-1, 1].map((s) => (
          <group key={`${z}${s}`} position={[s * 4.4, 0, z]}><PropMesh parts={obeliskP} /></group>
        )))}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 4.2, 0, -3]}><PropMesh parts={obeliskP} /></group>
        ))}
        <group position={[EDGE + 9.5, 0, race + 9]} rotation-y={-Math.PI / 2 + 0.25}><PropMesh parts={sphinxP} /></group>
        <Scatter spots={geo.grass} colors={['#c9a85c', '#b39550', '#d8bd72', '#9c8a4a']}>
          <coneGeometry args={[0.07, 0.3, 3]} />
        </Scatter>
        <Scatter spots={geo.rocks} colors={['#b98b5a', '#a77b4c', '#c99c68']} y={0.04}>
          <dodecahedronGeometry args={[0.09, 0]} />
        </Scatter>
      </Batch>
      {houses.map((h, i) => <Many key={i} parts={h} at={geo.rows[i]} />)}
      {stalls.map((s, i) => <Many key={i} parts={s} at={geo.stallAt[i]} />)}
      {palms.map((p, i) => <Many key={i} parts={p} at={geo.palmAt[i]} />)}
      <Many parts={camelUp} at={geo.up} />
      <Many parts={camelDown} at={geo.down} />
      <Water x={-(EDGE + 19.6)} z={len / 2} w={17} d={len + 220} id="giza" color="#7fb5a8" rough={0.3} />
      <Feluccas len={len} />
      <Pyramids />
    </>
  )
}

// Feluccas drifting downriver, each at its own pace.
function Feluccas({ len }: { len: number }) {
  const boat = useProp('giza-felucca', felucca)
  const refs = useRef<(Group | null)[]>([])
  const boats = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ x: -(EDGE + 14 + (i % 3) * 4), z: (i / 6) * (len + 40), v: 0.25 + (i % 3) * 0.12 })), [len])
  useFrame((_, dt) => {
    boats.forEach((b, i) => {
      b.z += b.v * dt
      if (b.z > len + 60) b.z -= len + 80
      refs.current[i]?.position.set(b.x, 0, b.z)
    })
  })
  return (
    <>
      {boats.map((b, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }} position={[b.x, 0, b.z]} rotation-y={i % 2 ? 0.1 : -0.1}>
          <PropMesh parts={boat} />
        </group>
      ))}
    </>
  )
}

// The three pyramids and their little queens' pyramids, far off ahead with the dunes.
function Pyramids() {
  const parts = useProp('giza-pyramids', (k) => {
    const lit: Look = { c: '#e0bf86', r: 1 }
    const old: Look = { c: '#d2ad74', r: 1 }
    const cap: Look = { c: '#ecd7ae', r: 0.9 }
    frustum(k, lit, 44, 44, 28, 0, [20, 0, 92], 0.12)
    frustum(k, old, 38, 38, 25, 0, [58, 0, 108], 0.12)
    // The second pyramid still has its smooth casing at the top.
    frustum(k, cap, 9.5, 9.5, 6.25, 0, [58, 18.75, 108], 0.12)
    frustum(k, lit, 18, 18, 11.5, 0, [-14, 0, 84], 0.1)
    for (const [x, z] of [[-26, 82], [-31, 86], [-36, 90]]) frustum(k, old, 6, 6, 4, 0, [x, 0, z], 0.1)
    // Dunes rolling away on either side.
    const dune: Look = { c: '#e2bd84', r: 1 }
    for (const [x, z, s] of [[-62, 78, 16], [-48, 96, 22], [-80, 100, 26], [90, 86, 18], [100, 110, 26], [32, 120, 30]]) k.sphere(dune, s, [x, -s * 0.8, z], [1.6, 1, 1], 14, 6, Math.PI / 2)
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 92]}>
        <planeGeometry args={[260, 60]} />
        <meshStandardMaterial color={SAND} />
      </mesh>
    </Horizon>
  )
}
