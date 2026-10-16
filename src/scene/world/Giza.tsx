import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, PlaneGeometry, type Group } from 'three'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Scatter, Water, archTop, frustum, person, prop, rand, useProp, type Dress, type Look, type PropKit, type Spot, type V3 } from './kit'
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
// Brass that stays plain (low metalness), so it folds into a prop's one painted mesh.
const GLYPH: Look = { c: '#a37a4b', r: 1 }
const BRASS: Look = { c: '#c99a3e', r: 0.45, m: 0.25 }

// Mud-brick houses facing +z (their street side), built once each.
const WALLS = ['#d8b98c', '#c9a274', '#e5cfa6', '#e8dcc4', '#cf9f6f', '#dcc29a']
const shade = (c: string, k: number) => {
  const n = parseInt(c.slice(1), 16)
  const ch = (s: number) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0')
  return ch(16) + ch(8) + ch(0)
}

const DOORS = ['#2f6f8f', '#6d4c35', '#1f5f6f', '#8a3b2b']
// Roof life: a satellite dish, a washing line, a wooden pigeon loft, or bare rebar where the
// next storey is still to come.
type HouseDef = { w: number; d: number; floors: number; wall: number; door: number; screen: boolean; tank: boolean; shade: boolean; dish: boolean; wash: boolean; pigeons: boolean; rebar: boolean }
const HOUSES: HouseDef[] = [
  { w: 2.6, d: 2.4, floors: 2, wall: 0, door: 0, screen: true, tank: true, shade: false, dish: true, wash: true, pigeons: false, rebar: false },
  { w: 3.2, d: 2.6, floors: 3, wall: 1, door: 1, screen: true, tank: false, shade: true, dish: true, wash: false, pigeons: true, rebar: false },
  { w: 2.2, d: 2.2, floors: 1, wall: 2, door: 2, screen: false, tank: true, shade: true, dish: true, wash: false, pigeons: false, rebar: true },
  { w: 3.0, d: 2.5, floors: 2, wall: 3, door: 3, screen: false, tank: true, shade: false, dish: false, wash: true, pigeons: false, rebar: true },
  { w: 2.4, d: 2.4, floors: 3, wall: 4, door: 1, screen: true, tank: true, shade: false, dish: true, wash: true, pigeons: false, rebar: false },
  { w: 2.8, d: 2.3, floors: 2, wall: 5, door: 0, screen: true, tank: false, shade: true, dish: false, wash: false, pigeons: true, rebar: false },
]
const DISH: Look = { c: '#dcdcd8', r: 0.6 }
const AC: Look = { c: '#e9e7e1', r: 0.7 }
const RUST: Look = { c: '#7a4a32', r: 1 }
const WASH = ['#e53935', '#fafafa', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#ff7043']

// A dish on a short pole, tipped up towards the street, with its feed arm.
function dish(k: PropKit, x: number, y: number, z: number) {
  k.cyl(DARK, 0.02, 0.02, 0.36, [x, y + 0.18, z], undefined, 5)
  const n = [0, Math.cos(0.85), Math.sin(0.85)] as const
  const c: [number, number, number] = [x, y + 0.38, z + 0.02]
  k.cyl(DISH, 0.21, 0.05, 0.05, c, [0.85, 0, 0], 10)
  k.rod(DARK, [c[0], c[1] + n[1] * 0.03, c[2] + n[2] * 0.03], [c[0], c[1] + n[1] * 0.24, c[2] + n[2] * 0.24], 0.008, 4)
  k.box(DARK, [0.05, 0.05, 0.07], [c[0], c[1] + n[1] * 0.26, c[2] + n[2] * 0.26], [0.85, 0, 0])
}

// A washing line between two poles, a row of shirts and sheets pegged on it.
function washLine(k: PropKit, x0: number, x1: number, y: number, z: number, seed: number) {
  for (const x of [x0, x1]) k.cyl(WOOD, 0.022, 0.022, 0.9, [x, y + 0.45, z], undefined, 5)
  k.rod(DARK, [x0, y + 0.86, z], [x1, y + 0.86, z], 0.006, 3)
  const n = Math.floor((x1 - x0) / 0.32)
  for (let i = 0; i < n; i++) {
    const w = 0.18 + ((i + seed) % 3) * 0.05
    const h = 0.26 + ((i * 2 + seed) % 3) * 0.08
    k.box({ c: WASH[(i * 3 + seed) % WASH.length], r: 1 }, [w, h, 0.015], [x0 + 0.2 + i * ((x1 - x0 - 0.4) / Math.max(1, n - 1)), y + 0.85 - h / 2, z])
  }
}

// A pigeon loft: a tall timber frame, a slatted coop on top, perches poking out all round and
// a few birds sitting on them.
function pigeonLoft(k: PropKit, x: number, y: number, z: number) {
  const t = 0.26
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(WOOD, [0.05, 1.5, 0.05], [x + sx * t, y + 0.75, z + sz * t])
  for (const sz of [-1, 1]) k.rod(WOOD_L, [x - t, y + 0.1, z + sz * t], [x + t, y + 1.0, z + sz * t], 0.015, 4)
  for (const sx of [-1, 1]) k.rod(WOOD_L, [x + sx * t, y + 0.1, z - t], [x + sx * t, y + 1.0, z + t], 0.015, 4)
  k.box(DARK, [0.5, 0.5, 0.5], [x, y + 1.35, z])
  for (const i of [-1, 0, 1]) {
    k.box(WOOD_L, [0.03, 0.5, 0.02], [x + i * 0.14, y + 1.35, z + 0.265])
    k.box(WOOD_L, [0.02, 0.5, 0.03], [x + 0.265, y + 1.35, z + i * 0.14])
    k.box(WOOD_L, [0.02, 0.5, 0.03], [x - 0.265, y + 1.35, z + i * 0.14])
  }
  k.box(WOOD, [0.66, 0.05, 0.66], [x, y + 1.62, z])
  k.box(WOOD, [0.62, 0.05, 0.62], [x, y + 1.1, z])
  // Long perch sticks crossing through the coop, and a flag pole for calling the flock.
  k.rod(WOOD, [x - 0.5, y + 1.2, z], [x + 0.5, y + 1.24, z], 0.012, 4)
  k.rod(WOOD, [x, y + 1.46, z - 0.5], [x, y + 1.5, z + 0.5], 0.012, 4)
  k.cyl(WOOD, 0.015, 0.015, 0.9, [x + 0.22, y + 2.05, z - 0.22], undefined, 4)
  k.box({ c: '#c62828', r: 1 }, [0.015, 0.16, 0.26], [x + 0.22, y + 2.4, z - 0.08])
  const bird: Look = { c: '#8d9096', r: 0.9 }
  for (const [bx, by, bz] of [[0.42, 1.27, 0], [-0.4, 1.25, 0], [0, 1.53, 0.42], [0, 1.67, 0.1]]) {
    k.ico(bird, 0.045, [x + bx, y + by, z + bz], [0.8, 0.8, 1.3], 0)
    k.box(bird, [0.035, 0.035, 0.035], [x + bx, y + by + 0.04, z + bz + 0.05])
  }
}
const STOREY = 1.15

// far: the back row, seen only over the front row's roofs, keeps its outline and roof life but
// drops the street-level detail.
function house(k: PropKit, h: HouseDef, far = false) {
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
  if (!far) {
  k.box(STONE_L, [0.62, 0.92, 0.05], [dx, 0.46, f + 0.01])
  archTop(k, STONE_L, 0.62, 0.05, [dx, 0.92, f + 0.01])
  k.box(door, [0.48, 0.84, 0.06], [dx, 0.42, f + 0.02])
  archTop(k, door, 0.48, 0.06, [dx, 0.84, f + 0.02])
  k.box(BRASS, [0.04, 0.04, 0.03], [dx + 0.14, 0.45, f + 0.06])
  // Ground floor: a small barred window beside the door.
  const wx = dx === 0 ? h.w * 0.32 : h.w * 0.18
  k.box(DARK, [0.36, 0.4, 0.04], [wx, 0.72, f + 0.005])
  k.box(trim, [0.46, 0.06, 0.08], [wx, 0.95, f + 0.02])
  for (const bx of [-0.09, 0, 0.09]) k.box(WOOD, [0.025, 0.4, 0.03], [wx + bx, 0.72, f + 0.03])
  }
  // Upper floors: deep-set windows, and on some a carved wooden screen that juts out.
  for (let fl = 1; fl < h.floors; fl++) {
    const y = fl * STOREY + 0.55
    const n = h.w > 2.7 ? 3 : 2
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (h.w / n)
      if (h.screen && i === (fl % n) && far) {
        k.box(WOOD, [0.62, 0.72, 0.22], [x, y, f + 0.11])
        k.box(WOOD_L, [0.7, 0.07, 0.28], [x, y + 0.39, f + 0.12])
      } else if (far) {
        k.box(DARK, [0.34, 0.5, 0.04], [x, y, f + 0.005])
        k.box(trim, [0.44, 0.06, 0.08], [x, y + 0.29, f + 0.02])
      } else if (h.screen && i === (fl % n)) {
        k.box(WOOD, [0.62, 0.72, 0.22], [x, y, f + 0.11])
        k.box(WOOD_L, [0.7, 0.07, 0.28], [x, y + 0.39, f + 0.12])
        k.box(WOOD_L, [0.7, 0.06, 0.26], [x, y - 0.38, f + 0.11])
        // The lattice: thin bars over a dark back.
        for (const bx of [-0.16, 0, 0.16]) k.box(WOOD_L, [0.03, 0.6, 0.02], [x + bx, y, f + 0.23])
        for (const by of [-0.12, 0.12]) k.box(WOOD_L, [0.56, 0.03, 0.02], [x, y + by, f + 0.235])
      } else {
        k.box(DARK, [0.34, 0.5, 0.04], [x, y, f + 0.005])
        k.box(trim, [0.44, 0.06, 0.08], [x, y + 0.29, f + 0.02])
        k.box(trim, [0.42, 0.05, 0.1], [x, y - 0.27, f + 0.03])
        k.box(door, [0.08, 0.5, 0.03], [x - 0.22, y, f + 0.03])
        k.box(door, [0.08, 0.5, 0.03], [x + 0.22, y, f + 0.03])
        // An air-conditioner box under the first-floor window, dripping a dark stain.
        if (fl === 1 && i === (h.screen ? (fl + 1) % n : 0)) {
          k.box(AC, [0.42, 0.24, 0.24], [x, fl * STOREY + 0.15, f + 0.12])
          k.box(DARK, [0.36, 0.17, 0.01], [x, fl * STOREY + 0.15, f + 0.245])
          k.box(AC, [0.36, 0.014, 0.014], [x, fl * STOREY + 0.15, f + 0.252])
          k.box(trim, [0.05, 0.36, 0.004], [x + 0.12, fl * STOREY - 0.15, f + 0.003])
        }
      }
    }
  }
  // Roof clutter: a water tank on legs, a stair hut, a palm-frond sun shade.
  if (h.tank) {
    const tx = h.w * 0.25
    for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) k.box(DARK, [0.04, 0.35, 0.04], [tx + lx, H + 0.18, -0.3 + lz])
    k.cyl({ c: '#a3a3a3', r: 0.45, m: 0.25 }, 0.26, 0.26, 0.45, [tx, H + 0.58, -0.3], undefined, 10)
  }
  k.box(wall, [0.8, 0.75, 0.8], [-h.w / 2 + 0.5, H + 0.37, -f + 0.5])
  k.box(door, [0.36, 0.56, 0.03], [-h.w / 2 + 0.5, H + 0.28, -f + 0.91])
  if (h.shade) {
    // Clear of the water tank where the house has both.
    const sz = h.tank ? 0.5 : 0.1
    for (const px of [-0.5, 0.5]) for (const pz of [-0.4, 0.4]) k.box(WOOD, [0.05, 0.75, 0.05], [0.25 + px, H + 0.37, sz + pz])
    k.box({ c: '#b9a16a', r: 1 }, [1.2, 0.05, 1.0], [0.25, H + 0.77, sz])
  }
  if (h.dish) dish(k, -h.w / 2 + 0.35, H, h.shade ? f - 0.4 : 0.1)
  if (h.wash) washLine(k, -h.w / 2 + 0.25, h.w / 2 - 0.25, H, f - 0.32, h.wall)
  if (h.pigeons) pigeonLoft(k, h.w / 2 - 0.55, H, -f + 0.45)
  if (h.rebar && !far) {
    // Column stubs at the front corners with rusty rods, waiting for the next floor.
    for (const s of [-1, 1]) {
      const cx = s * (h.w / 2 - 0.12)
      k.box(trim, [0.2, 0.32, 0.2], [cx, H + 0.16, f - 0.12])
      for (const rx of [-0.05, 0.05]) for (const rz of [-0.05, 0.05]) k.rod(RUST, [cx + rx, H + 0.3, f - 0.12 + rz], [cx + rx * 1.4, H + 0.62, f - 0.12 + rz * 1.4], 0.008, 3)
    }
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
  k.box(WOOD_L, [1.52, 0.06, 0.8], [0, 0.6, 0.15])
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
  // A patterned carpet hung down the open side: a border, a field and a diamond medallion.
  const rug = [a, '#8e2431', '#1f3f6f', '#e0c27a']
  k.box({ c: rug[1], r: 1 }, [0.02, 0.9, 0.84], [-0.79, 0.86, 0])
  k.box({ c: rug[2], r: 1 }, [0.02, 0.74, 0.68], [-0.797, 0.86, 0])
  k.box({ c: rug[3], r: 1 }, [0.02, 0.26, 0.26], [-0.804, 0.86, 0], [Math.PI / 4, 0, 0])
  k.box({ c: rug[0], r: 1 }, [0.02, 0.11, 0.11], [-0.81, 0.86, 0], [Math.PI / 4, 0, 0])
  for (const y of [0.56, 1.16]) k.box({ c: rug[3], r: 1 }, [0.02, 0.04, 0.6], [-0.804, y, 0])
  k.rod(WOOD, [-0.8, 1.33, -0.5], [-0.8, 1.33, 0.5], 0.015, 4)
  // Pierced brass lanterns hanging from the awning's front edge.
  for (const x of [-0.38, 0.38]) {
    k.rod(DARK, [x, 1.43, 0.6], [x, 1.18, 0.6], 0.006, 3)
    k.cone(BRASS, 0.05, 0.08, [x, 1.14, 0.6], undefined, 8)
    k.cyl(BRASS, 0.07, 0.05, 0.16, [x, 1.02, 0.6], undefined, 8)
    k.cyl(DARK, 0.072, 0.072, 0.03, [x, 1.02, 0.6], undefined, 8)
    k.cone(BRASS, 0.05, 0.06, [x, 0.91, 0.6], [Math.PI, 0, 0], 8)
  }
}

// A camel, standing or resting with its legs folded, facing +z.
function camel(k: PropKit, down: boolean) {
  const hide: Look = { c: '#c49a63', r: 1 }
  const dark: Look = { c: '#9a7448', r: 1 }
  const y = down ? 0.42 : 0.95
  k.sphere(hide, 0.5, [0, y, 0], [0.62, 0.62, 1], 10, 6)
  k.sphere(hide, 0.3, [0, y + 0.3, -0.05], [1, 0.95, 1.2], 8, 4, Math.PI / 2)
  // Saddle blanket with a fringe.
  k.box({ c: '#b71c1c', r: 1 }, [0.66, 0.04, 0.5], [0, y + 0.18, 0.28], [0.25, 0, 0])
  k.box({ c: '#fbc02d', r: 1 }, [0.68, 0.05, 0.05], [0, y + 0.1, 0.5])
  // Neck curving up and forward, then the head with its long muzzle.
  k.rod(hide, [0, y + 0.1, 0.4], [0, y + 0.45, 0.72], 0.12, 6)
  k.rod(hide, [0, y + 0.45, 0.72], [0, y + 0.82, 0.78], 0.1, 6)
  k.sphere(hide, 0.13, [0, y + 0.88, 0.82], [0.9, 0.9, 1.1], 8, 5)
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
      k.sphere(dark, 0.055, [s * 0.17, 0.5, z + 0.02], [1, 1, 1], 6, 4)
      k.box(dark, [0.12, 0.05, 0.15], [s * 0.17, 0.025, z + 0.02])
    }
  }
}

// A date palm: a ringed trunk, drooping fronds and hanging clusters of dates.
// far: a lighter palm for the far bank and the back of the groves (fewer fronds, no dates).
function datePalm(k: PropKit, h: number, far = false) {
  const bark: Look = { c: '#7d5f43', r: 1 }
  const ring: Look = { c: '#6a4e36', r: 1 }
  const segs = far ? 3 : 7
  for (let i = 0; i < segs; i++) {
    const y = (i + 0.5) * (h / segs)
    k.rod(i % 2 ? ring : bark, [0, y - h / segs / 2 - 0.005, 0], [0, y + h / segs / 2 + 0.005, 0], 0.115 - i * (0.028 / segs), far ? 5 : 6)
  }
  const fr = ['#4e7d34', '#5b8c3a', '#43702e']
  const n = far ? 8 : 11
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const up = i % 2 ? 0.25 : -0.35
    const c = fr[i % 3]
    // Each frond in two pieces so it arcs over and droops.
    k.box({ c, r: 0.9 }, [0.14, 0.03, 0.75], [Math.sin(a) * 0.35, h + 0.1 + up * 0.3, Math.cos(a) * 0.35], [-0.25 + up, a, 0])
    k.box({ c, r: 0.9 }, [0.11, 0.03, 0.65], [Math.sin(a) * 0.95, h - 0.08 + up * 0.25, Math.cos(a) * 0.95], [0.55 + up * 0.5, a, 0])
  }
  // Bunches of dates hanging under the crown on short stalks.
  for (let i = 0; i < (far ? 0 : 4); i++) {
    const a = i * 1.6 + 0.4
    const x = Math.sin(a) * 0.17
    const z = Math.cos(a) * 0.17
    k.rod({ c: '#b8862e', r: 0.9 }, [x * 0.6, h - 0.05, z * 0.6], [x, h - 0.22, z], 0.015, 4)
    k.ico({ c: i % 2 ? '#8a3f17' : '#a4521d', r: 0.8 }, 0.08, [x, h - 0.3, z], [1, 1.4, 1], 0)
  }
  k.sphere({ c: '#5d4630', r: 1 }, 0.16, [0, h + 0.02, 0], [1, 0.8, 1], 6, 4)
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

// Marks are flat quads just off the face: two triangles each, and a pylon has hundreds.
const QUAD = new PlaneGeometry(1, 1)

// Carved signs on a stone face: put(u, v, w, h, rz) cuts a shallow mark u along the face and v up
// it, for a face turned ry about y and leaning back by `lean` (a pylon's battered front).
function carver(k: PropKit, look: Look, o: V3, ry: number, lean = 0) {
  const t = Math.tan(lean)
  const ux = Math.cos(ry)
  const uz = -Math.sin(ry)
  const nx = Math.sin(ry) * Math.cos(lean)
  const nz = Math.cos(ry) * Math.cos(lean)
  const ny = Math.sin(lean)
  return (u: number, v: number, w: number, h: number, rz = 0) =>
    k.add(look, QUAD, [o[0] + u * ux - v * t * Math.sin(ry) + nx * 0.004, o[1] + v + ny * 0.004, o[2] + u * uz - v * t * Math.cos(ry) + nz * 0.004], [-lean, ry, rz], [w, h, 1])
}

// A column of hieroglyphs between two ruled lines, a name ring at its head: birds, eyes,
// water ripples, reeds and loaves, never the same order twice.
function glyphColumn(put: ReturnType<typeof carver>, u: number, v0: number, v1: number, seed: number) {
  const w = 0.2
  for (const s of [-1, 1]) put(u + s * (w / 2 + 0.01), (v0 + v1) / 2, 0.015, v1 - v0)
  // The name ring: an outline with a tie bar at its foot.
  const ct = v1 - 0.06
  const cb = v1 - 0.62
  for (const s of [-1, 1]) put(u + s * 0.075, (ct + cb) / 2, 0.015, ct - cb - 0.04)
  put(u, ct - 0.02, 0.12, 0.015)
  put(u, cb + 0.02, 0.12, 0.015)
  put(u, cb - 0.01, 0.17, 0.02)
  put(u, ct - 0.14, 0.05, 0.05, Math.PI / 4)
  put(u, ct - 0.27, 0.08, 0.025)
  put(u - 0.02, ct - 0.4, 0.03, 0.09)
  put(u + 0.025, ct - 0.4, 0.03, 0.06)
  for (let v = cb - 0.16, j = seed; v > v0 + 0.06; v -= 0.2, j++) {
    switch (j % 6) {
      case 0: put(u, v, 0.09, 0.09); break
      case 1: put(u - 0.04, v, 0.03, 0.15); put(u + 0.03, v - 0.02, 0.06, 0.06, Math.PI / 4); break
      case 2: put(u, v + 0.03, 0.14, 0.035); put(u, v - 0.04, 0.09, 0.03); break
      case 3: put(u + 0.005, v, 0.09, 0.06); put(u - 0.05, v + 0.04, 0.035, 0.035); put(u + 0.01, v - 0.06, 0.012, 0.05); break
      case 4: put(u, v + 0.015, 0.13, 0.035); put(u, v - 0.035, 0.035, 0.035); break
      default: for (const du of [-0.05, 0, 0.05]) put(u + du, v, 0.04, 0.04, Math.PI / 4)
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
    const groove = carver(k, STONE_D, [x, 0, 1.2], 0, Math.atan(0.264 / 6.2))
    for (const mx of [-0.75, 0.75]) {
      const gx = x + mx
      groove(mx, 2.9, 0.22, 5.4)
      k.cyl(WOOD, 0.05, 0.07, 8.6, [gx, 4.3, 1.25], undefined, 6)
      k.box({ c: mx < 0 ? '#c62828' : '#1565c0', r: 1 }, [0.03, 0.42, 0.9], [gx, 8.2, 1.7])
    }
    // A great carved king on both faces of each tower, cut into the sloping stone in a darker
    // tone: tall crown, kilt, a raised arm holding a staff, columns of his names either side.
    for (const fz of [1, -1]) {
      const ry = fz > 0 ? 0 : Math.PI
      const lean = Math.atan(0.264 / 6.2)
      const put = carver(k, STONE_D, [x, 0, 1.2 * fz], ry, lean)
      // u runs the other way on the back face; keep the king facing the road from both sides.
      const sg = s * fz
      if (fz < 0) for (const mx of [-0.75, 0.75]) put(mx, 2.9, 0.22, 5.4)
      const fu = -sg * 0.1
      put(fu, 2.15, 0.62, 1.1)
      put(fu, 1.3, 0.78, 0.55)
      for (const lu of [-0.16, 0.16]) put(fu + lu, 0.62, 0.16, 0.8)
      put(fu, 0.18, 0.9, 0.08)
      put(fu, 2.95, 0.24, 0.3)
      put(fu, 3.35, 0.34, 0.5)
      put(fu, 3.75, 0.26, 0.3)
      put(fu + sg * 0.42, 2.62, 0.36, 0.14)
      put(fu + sg * 0.6, 2.1, 0.05, 2.0)
      put(fu + sg * 0.6, 3.14, 0.16, 0.12)
      put(fu - sg * 0.36, 1.95, 0.14, 0.75)
      const glyph = carver(k, GLYPH, [x, 0, 1.2 * fz], ry, lean)
      for (const [j, gu] of [1.2, 1.45, 1.7].entries()) {
        glyphColumn(glyph, gu, 0.8, 4.9 - j * 0.35, j * 2 + (s > 0 ? 1 : 0) + (fz < 0 ? 2 : 0))
        glyphColumn(glyph, -gu, 0.8, 4.9 - j * 0.35, j * 2 + (s > 0 ? 4 : 3) + (fz < 0 ? 2 : 0))
      }
    }
  }
  // The portal: jambs, a lintel with the winged sun, and a cornice. Its jambs carved all over,
  // front and inside, where the racers flash past.
  for (const s of [-1, 1]) {
    k.box(face, [0.8, 4.0, 1.6], [s * 2.9, 2.0, 0])
    for (const fz of [1, -1]) {
      const front = carver(k, GLYPH, [s * 2.9, 0, 0.8 * fz], fz > 0 ? 0 : Math.PI)
      for (const u of [-0.16, 0.16]) glyphColumn(front, u, 0.35, 3.75, Math.round(u * 10 + s * 3 + 7 + fz))
    }
    const inside = carver(k, GLYPH, [s * 2.5, 0, 0], -s * Math.PI / 2)
    for (const u of [-0.5, -0.25, 0, 0.25, 0.5]) glyphColumn(inside, u, 0.35, 3.75, Math.round(u * 8 + s + 6))
  }
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

// A clump of papyrus at the water's edge: tall bare stems, each crowned with a green tuft.
function papyrus(k: PropKit) {
  const stem: Look = { c: '#5f8a3a', r: 0.9 }
  const head: Look = { c: '#8fb04a', r: 0.9 }
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4
    const h = 1.0 + ((i * 7) % 5) * 0.14
    const lean = 0.08 + (i % 3) * 0.06
    const tip: V3 = [Math.sin(a) * (0.06 + h * lean), h, Math.cos(a) * (0.06 + h * lean)]
    k.rod(stem, [Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06], tip, 0.014, 4)
    k.cone(head, 0.16, 0.13, [tip[0], tip[1] + 0.06, tip[2]], [Math.PI, 0, 0], 6)
  }
  k.cone({ c: '#4f7a32', r: 0.9 }, 0.14, 0.3, [0, 0.15, 0], undefined, 5)
}

// A donkey pulling a two-wheeled cart loaded with clover and sacks, facing +z.
function donkeyCart(k: PropKit) {
  const hide: Look = { c: '#8d8478', r: 1 }
  const pale: Look = { c: '#d3ccc0', r: 1 }
  const mane: Look = { c: '#3d3833', r: 1 }
  const dz = 0.75
  k.sphere(hide, 1, [0, 0.52, dz], [0.17, 0.18, 0.36], 10, 7)
  for (const sx of [-1, 1]) for (const lz of [0.22, -0.22]) {
    k.rod(hide, [sx * 0.08, 0.48, dz + lz], [sx * 0.085, 0.04, dz + lz + 0.02], 0.035, 5)
    k.box(mane, [0.06, 0.04, 0.07], [sx * 0.085, 0.02, dz + lz + 0.02])
  }
  // Neck, the big head with its pale muzzle, and the long ears.
  k.rod(hide, [0, 0.58, dz + 0.26], [0, 0.78, dz + 0.42], 0.075, 6)
  k.box(mane, [0.04, 0.05, 0.24], [0, 0.82, dz + 0.36], [0.85, 0, 0])
  k.box(hide, [0.12, 0.12, 0.2], [0, 0.8, dz + 0.5], [0.5, 0, 0])
  k.box(pale, [0.1, 0.09, 0.1], [0, 0.72, dz + 0.6], [0.5, 0, 0])
  for (const sx of [-1, 1]) {
    k.box(hide, [0.04, 0.16, 0.03], [sx * 0.04, 0.93, dz + 0.42], [0, 0, sx * 0.25])
    k.box(DARK, [0.015, 0.02, 0.02], [sx * 0.062, 0.83, dz + 0.53])
  }
  k.rod(hide, [0, 0.55, dz - 0.35], [0, 0.3, dz - 0.4], 0.015, 4)
  k.box(mane, [0.03, 0.06, 0.03], [0, 0.27, dz - 0.4])
  // Harness strap and the shafts back to the cart.
  k.box({ c: '#9c2b23', r: 1 }, [0.42, 0.05, 0.05], [0, 0.54, dz + 0.2])
  for (const sx of [-1, 1]) k.rod(WOOD, [sx * 0.2, 0.52, dz + 0.2], [sx * 0.3, 0.45, -0.3], 0.018, 4)
  // The cart: a flat bed with low rails on two spoked wheels.
  k.box(WOOD_L, [0.7, 0.06, 1.0], [0, 0.44, -0.8])
  for (const sx of [-1, 1]) k.box(WOOD, [0.04, 0.12, 1.0], [sx * 0.33, 0.53, -0.8])
  k.box(WOOD, [0.7, 0.12, 0.04], [0, 0.53, -1.28])
  for (const sx of [-1, 1]) {
    k.torus(DARK, 0.27, 0.025, [sx * 0.4, 0.28, -0.85], [0, Math.PI / 2, 0], Math.PI * 2, 14, 4)
    for (let i = 0; i < 3; i++) k.box(WOOD, [0.02, 0.52, 0.02], [sx * 0.4, 0.28, -0.85], [i * (Math.PI / 3), 0, 0])
  }
  k.rod(DARK, [-0.42, 0.28, -0.85], [0.42, 0.28, -0.85], 0.02, 5)
  // A green heap of clover and two sacks.
  k.sphere({ c: '#6f9a3a', r: 1 }, 1, [0, 0.47, -0.62], [0.3, 0.2, 0.32], 8, 5)
  k.sphere({ c: '#5f8a34', r: 1 }, 1, [0.05, 0.6, -0.68], [0.18, 0.14, 0.2], 8, 5)
  k.sphere({ c: '#cbb88e', r: 1 }, 1, [-0.14, 0.58, -1.08], [0.14, 0.13, 0.16], 8, 5)
  k.sphere({ c: '#bfa77a', r: 1 }, 1, [0.15, 0.57, -1.06], [0.13, 0.12, 0.15], 8, 5)
}

// A pavement cafe: low chairs round brass trays under a cloth awning, water pipes bubbling
// beside them. Facing +z.
function cafe(k: PropKit) {
  for (const x of [-1, 1]) for (const z of [-0.7, 0.7]) k.box(WOOD, [0.05, 1.46, 0.05], [x, 0.73, z])
  for (let i = 0; i < 8; i++) k.box({ c: i % 2 ? '#2e7d32' : '#f3ead8', r: 1 }, [0.26, 0.035, 1.56], [-0.91 + i * 0.26, 1.47 + (i % 2) * 0.004, 0])
  k.box({ c: '#2e7d32', r: 1 }, [2.1, 0.12, 0.02], [0, 1.44, 0.79])
  for (const [tx, tz] of [[-0.5, 0.1], [0.5, -0.15]]) {
    k.cyl(DARK, 0.03, 0.05, 0.36, [tx, 0.18, tz], undefined, 6)
    k.cyl(BRASS, 0.2, 0.2, 0.025, [tx, 0.37, tz], undefined, 12)
    // Two glasses of tea on the tray.
    for (const gx of [-0.06, 0.07]) k.cyl({ c: '#8a3b1a', r: 0.3 }, 0.022, 0.018, 0.06, [tx + gx, 0.415, tz + 0.03], undefined, 6)
    // A low chair either side.
    for (const s of [-1, 1]) {
      const cx = tx + s * 0.38
      k.box(WOOD_L, [0.24, 0.04, 0.24], [cx, 0.28, tz])
      for (const lx of [-0.1, 0.1]) for (const lz of [-0.1, 0.1]) k.box(WOOD, [0.03, 0.27, 0.03], [cx + lx, 0.135, tz + lz])
      for (const lz of [-0.1, 0.1]) k.box(WOOD, [0.03, 0.34, 0.03], [cx + s * 0.1, 0.45, tz + lz])
      for (const by of [0.38, 0.46, 0.56]) k.box(WOOD_L, [0.024, 0.04, 0.2], [cx + s * 0.1, by, tz])
    }
    // The water pipe: a glass bowl, a brass stem with its tray, a clay head and a hose.
    const px = tx + 0.02
    const pz = tz + 0.32
    k.sphere({ c: '#2f7a6a', r: 0.3 }, 0.09, [px, 0.09, pz], [1, 1.1, 1], 10, 6)
    k.cyl(BRASS, 0.018, 0.025, 0.42, [px, 0.39, pz], undefined, 6)
    k.cyl(BRASS, 0.07, 0.07, 0.012, [px, 0.5, pz], undefined, 10)
    k.cyl({ c: '#a0522d', r: 0.9 }, 0.04, 0.025, 0.07, [px, 0.64, pz], undefined, 8)
    k.cyl({ c: '#e64a19', r: 1 }, 0.035, 0.035, 0.01, [px, 0.68, pz], undefined, 8)
    k.rod({ c: '#6d2c4f', r: 0.9 }, [px + 0.02, 0.3, pz], [px + 0.2, 0.08, pz - 0.05], 0.012, 4)
    k.rod({ c: '#6d2c4f', r: 0.9 }, [px + 0.2, 0.08, pz - 0.05], [tx + 0.3, 0.32, tz + 0.06], 0.012, 4)
  }
  // A hanging brass lantern in the middle.
  k.rod(DARK, [0, 1.46, 0], [0, 1.28, 0], 0.006, 3)
  k.cone(BRASS, 0.06, 0.09, [0, 1.24, 0], undefined, 8)
  k.cyl(BRASS, 0.08, 0.06, 0.18, [0, 1.11, 0], undefined, 8)
  k.cone(BRASS, 0.06, 0.07, [0, 0.985, 0], [Math.PI, 0, 0], 8)
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

// The back row's house types: tall ones, with a pigeon loft and washing lines among them.
const BACK = [1, 3, 4]

// Where the donkey carts stand, as fractions of the race.
const CARTS = [0.22, 0.37, 0.66, 0.84]


// The ruins side of the road (right, +x), so it is never an empty plain: an avenue of
// ram-headed sphinxes along the kerb, a broken temple enclosure wall behind them, then temple
// colonnades, seated colossi and Bedouin camps among the palms, with dunes closing the view.

// A ram-headed sphinx crouching on its plinth, facing +z (turned to face the road).
function ramSphinx(k: PropKit) {
  const body: Look = { c: '#cfa872', r: 1 }
  const worn: Look = { c: '#b88f5c', r: 1 }
  k.box(STONE_D, [0.72, 0.34, 1.75], [0, 0.17, 0])
  k.box(STONE_L, [0.76, 0.05, 1.79], [0, 0.36, 0])
  for (let i = 0; i < 3; i++) k.box(GLYPH, [0.16, 0.14, 0.006], [-0.22 + i * 0.22, 0.18, 0.878])
  // Lion body lying along the plinth, haunches at the back, paws stretched forward.
  k.sphere(body, 1, [0, 0.62, -0.25], [0.27, 0.25, 0.62], 8, 5)
  k.sphere(worn, 1, [0, 0.58, -0.6], [0.29, 0.22, 0.3], 7, 4)
  for (const f of [-1, 1]) {
    k.box(body, [0.13, 0.14, 0.62], [f * 0.16, 0.45, 0.5])
    k.box(worn, [0.14, 0.12, 0.42], [f * 0.24, 0.45, -0.55])
  }
  // Chest, then the ram's head: long muzzle and the horns curling round its ears.
  k.box(body, [0.3, 0.36, 0.3], [0, 0.72, 0.25])
  k.sphere(body, 0.15, [0, 0.95, 0.36], [1, 1, 1.15], 7, 5)
  k.box(body, [0.14, 0.15, 0.26], [0, 0.9, 0.52], [0.2, 0, 0])
  k.box(DARK, [0.1, 0.02, 0.02], [0, 0.86, 0.645])
  for (const f of [-1, 1]) {
    k.torus(worn, 0.08, 0.03, [f * 0.15, 0.95, 0.34], [0, Math.PI / 2, 0], Math.PI * 1.6, 7, 3)
    k.box(DARK, [0.02, 0.025, 0.02], [f * 0.07, 0.98, 0.5])
    // Headcloth flaps down to the chest.
    k.box(STONE_L, [0.06, 0.26, 0.16], [f * 0.13, 0.8, 0.3])
  }
  k.box(worn, [0.1, 0.36, 0.06], [0, 0.42, -0.86], [-0.3, 0, 0])
}

// A ruined temple colonnade along the road (long side on z): two rows of fat papyrus columns
// with carved bands and bud capitals, lintels still bridging some, one column fallen.
function colonnade(k: PropKit) {
  const paint: Look = { c: '#3f6f8f', r: 0.95 }
  const ochre: Look = { c: '#b5532f', r: 0.95 }
  k.box(STONE_D, [3.6, 0.22, 8.4], [0, 0.11, 0])
  k.box(STONE_L, [3.7, 0.04, 8.5], [0, 0.23, 0])
  const H = 3.1
  const at: [number, number, number][] = []
  for (const x of [-0.95, 0.95]) for (const z of [-3.15, -1.05, 1.05, 3.15]) at.push([x, z, x > 0 && z > 3 ? 1.3 : H])
  for (const [x, z, h] of at) {
    k.cyl(STONE_D, 0.46, 0.5, 0.18, [x, 0.33, z], undefined, 10)
    k.cyl(STONE, 0.36, 0.42, h, [x, 0.42 + h / 2, z], undefined, 10)
    // Carved bands round the shaft, and painted rings near the top.
    for (const y of [0.9, 1.5, 2.1]) if (y < h) k.cyl(GLYPH, 0.4 - y * 0.012, 0.405 - y * 0.012, 0.22, [x, 0.42 + y, z], undefined, 10)
    if (h < H) {
      // The broken stump: a jagged top.
      k.cyl(STONE_L, 0.3, 0.38, 0.14, [x, 0.42 + h + 0.07, z], [0.2, 0, 0.15], 7)
      continue
    }
    k.cyl(paint, 0.372, 0.375, 0.07, [x, 0.42 + H - 0.25, z], undefined, 10)
    k.cyl(ochre, 0.372, 0.375, 0.06, [x, 0.42 + H - 0.15, z], undefined, 10)
    // The closed papyrus bud capital and its square abacus.
    k.cyl(STONE_L, 0.28, 0.4, 0.42, [x, 0.42 + H + 0.21, z], undefined, 10)
    k.cyl(STONE_L, 0.2, 0.28, 0.16, [x, 0.42 + H + 0.5, z], undefined, 10)
    k.box(STONE, [0.62, 0.16, 0.62], [x, 0.42 + H + 0.66, z])
  }
  // Lintels: across the rows at three bays, and two along the left row.
  const top = 0.42 + H + 0.74 + 0.22
  for (const z of [-3.15, -1.05, 1.05]) {
    k.box(STONE, [2.5, 0.44, 0.62], [0, top, z])
    k.box(paint, [2.3, 0.06, 0.006], [0, top + 0.05, z + 0.313])
    k.box(ochre, [2.3, 0.05, 0.006], [0, top - 0.1, z + 0.313])
  }
  for (const z of [-2.1, 0]) k.box(STONE, [0.6, 0.44, 2.7], [-0.95, top + 0.44, z])
  // The fallen column: drums lying in a row in the sand, a capital tipped beside them.
  for (let i = 0; i < 3; i++) k.cyl(STONE, 0.36, 0.38, 0.62, [1.95 + i * 0.05, 0.37, 2.4 - i * 0.66], [Math.PI / 2, 0.15, 0], 10)
  k.cyl(STONE_L, 0.28, 0.4, 0.42, [2.25, 0.38, 0.3], [Math.PI / 2, 0.9, 0], 10)
  k.box(STONE_D, [0.7, 0.32, 0.5], [-2.1, 0.16, -2.6], [0, 0.4, 0])
}

// A seated king in stone on his throne, hands on his knees, facing +z.
function colossus(k: PropKit) {
  const body: Look = { c: '#c9a06c', r: 1 }
  const worn: Look = { c: '#b28a58', r: 1 }
  k.box(STONE_D, [1.5, 0.4, 2.1], [0, 0.2, 0])
  for (let i = 0; i < 4; i++) k.box(GLYPH, [0.18, 0.2, 0.006], [-0.5 + i * 0.33, 0.2, 1.053])
  // The throne: a block with carved sides.
  k.box(STONE, [1.3, 1.3, 1.3], [0, 1.05, -0.25])
  for (const f of [-1, 1]) {
    k.box(GLYPH, [0.006, 0.8, 0.9], [f * 0.653, 1.05, -0.25])
    k.box(STONE_L, [0.007, 0.6, 0.12], [f * 0.654, 1.05, -0.25])
  }
  k.box(STONE, [1.3, 1.4, 0.3], [0, 1.6, -0.75])
  // Legs: thighs on the seat, shins straight down, big feet side by side.
  for (const f of [-1, 1]) {
    k.box(body, [0.36, 0.34, 1.0], [f * 0.22, 1.85, 0.15])
    k.box(body, [0.32, 1.25, 0.36], [f * 0.22, 1.02, 0.5])
    k.box(worn, [0.34, 0.12, 0.5], [f * 0.22, 0.46, 0.6])
    // Forearms resting along the thighs, hands flat on the knees.
    k.box(body, [0.2, 0.18, 0.8], [f * 0.42, 2.1, 0.2])
    k.box(worn, [0.22, 0.12, 0.26], [f * 0.42, 2.06, 0.6])
    k.box(body, [0.18, 0.62, 0.2], [f * 0.5, 2.38, -0.2])
  }
  // Kilt, torso, broad collar, then the headcloth and the false beard.
  k.box(STONE_L, [0.8, 0.32, 0.9], [0, 1.95, 0.05])
  k.box(body, [0.78, 0.95, 0.5], [0, 2.55, -0.25])
  k.box({ c: '#4f7f9a', r: 0.95 }, [0.72, 0.16, 0.06], [0, 2.88, 0.01])
  k.box(body, [0.3, 0.22, 0.3], [0, 3.1, -0.25])
  k.box(body, [0.46, 0.55, 0.48], [0, 3.42, -0.22])
  frustum(k, STONE_L, 0.62, 0.58, 0.3, 0.75, [0, 3.62, -0.26])
  for (const f of [-1, 1]) {
    k.box(STONE_L, [0.16, 0.6, 0.18], [f * 0.29, 3.2, -0.14], [0, 0, f * 0.12])
    for (let i = 0; i < 3; i++) k.box(GLYPH, [0.17, 0.04, 0.19], [f * (0.29 + i * 0.012), 3.0 + i * 0.16, -0.14], [0, 0, f * 0.12])
    k.box({ c: '#5b4128', r: 1 }, [0.1, 0.04, 0.02], [f * 0.1, 3.5, 0.025])
  }
  k.box(worn, [0.08, 0.14, 0.08], [0, 3.38, 0.04])
  k.box(worn, [0.12, 0.2, 0.1], [0, 3.06, -0.02])
}

// A Bedouin camp, front at +z: a low goat-hair tent open at the front on poles, carpets and
// cushions inside, a brass tray of tea, and a fire ring of stones with its kettle.
function bedouinTent(k: PropKit) {
  const hair: Look = { c: '#6b5140', r: 1 }
  const stripe: Look = { c: '#efe3c8', r: 1 }
  for (const x of [-1.6, -0.55, 0.55, 1.6]) {
    k.rod(WOOD, [x, 0, 0.75], [x, 0.85, 0.75], 0.03, 5)
    k.rod(WOOD, [x, 0, -0.6], [x, 1.05, -0.6], 0.03, 5)
  }
  // The roof sloping from the back ridge to the front poles, a woven stripe across it.
  k.box(hair, [3.5, 0.04, 1.42], [0, 0.97, 0.08], [-0.15, 0, 0])
  for (const z of [0.35, -0.2]) k.box(stripe, [3.52, 0.045, 0.1], [0, 0.95 + (0.35 - z) * 0.15, z], [-0.15, 0, 0])
  for (let i = 0; i < 4; i++) k.box(stripe, [0.1, 0.9, 0.045], [-1.3 + i * 0.86, 0.52, -0.6])
  k.box(hair, [3.5, 1.05, 0.04], [0, 0.52, -0.62])
  for (const f of [-1, 1]) wedgeSide(k, hair, f * 1.75)
  // Guy ropes and pegs out to the sides.
  for (const f of [-1, 1]) for (const z of [0.75, -0.6]) k.rod({ c: '#c8b48a', r: 1 }, [f * 1.6, 0.85, z], [f * 2.3, 0, z + 0.2], 0.008, 3)
  // Carpets, cushions and the tea tray.
  const rugs = ['#9e2a2b', '#1f3f6f', '#c4862a']
  rugs.forEach((c, i) => {
    k.box({ c, r: 1 }, [1.05, 0.02, 1.15], [-1.1 + i * 1.1, 0.012 + i * 0.003, 0.08])
    k.box({ c: '#e0c27a', r: 1 }, [0.5, 0.025, 0.5], [-1.1 + i * 1.1, 0.02 + i * 0.003, 0.08], [0, Math.PI / 4, 0])
  })
  for (let i = 0; i < 5; i++) k.box({ c: ['#c62828', '#fbc02d', '#2e7d32', '#6a1b9a', '#ef6c00'][i], r: 1 }, [0.42, 0.18, 0.26], [-1.45 + i * 0.72, 0.11, -0.42])
  k.cyl(BRASS, 0.24, 0.24, 0.03, [0.3, 0.06, 0.2], undefined, 12)
  k.sphere(BRASS, 0.07, [0.3, 0.13, 0.2], [1, 0.9, 1], 8, 5)
  k.rod(BRASS, [0.36, 0.14, 0.2], [0.44, 0.2, 0.2], 0.012, 4)
  for (const a of [0, 2, 4]) k.cyl({ c: '#e8f0f0', r: 0.3 }, 0.022, 0.018, 0.06, [0.3 + Math.cos(a) * 0.15, 0.08, 0.2 + Math.sin(a) * 0.15], undefined, 6)
  // Fire ring out front: a circle of stones, charred logs and a blackened kettle on a tripod.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    k.ico({ c: i % 2 ? '#8d7a66' : '#a18d76', r: 1 }, 0.08, [1.0 + Math.cos(a) * 0.3, 0.05, 1.35 + Math.sin(a) * 0.3], [1, 0.7, 1], 0)
  }
  for (const a of [0.3, 1.9]) k.rod({ c: '#2b211b', r: 1 }, [1.0 - Math.cos(a) * 0.2, 0.05, 1.35 - Math.sin(a) * 0.2], [1.0 + Math.cos(a) * 0.2, 0.08, 1.35 + Math.sin(a) * 0.2], 0.035, 5)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    k.rod(DARK, [1.0 + Math.cos(a) * 0.28, 0, 1.35 + Math.sin(a) * 0.28], [1.0, 0.55, 1.35], 0.012, 3)
  }
  k.sphere({ c: '#262626', r: 0.7 }, 0.09, [1.0, 0.36, 1.35], [1, 0.85, 1], 8, 5)
}
// A tent's end wall: a quarter-triangle of cloth from the front poles up to the back ridge.
function wedgeSide(k: PropKit, look: Look, x: number) {
  k.box(look, [0.04, 0.85, 1.36], [x, 0.43, 0.07])
  k.box(look, [0.04, 0.22, 1.2], [x, 0.94, 0.0], [-0.15, 0, 0])
}

// A long low dune, its windward slope rippled.
function dune(k: PropKit) {
  k.sphere({ c: '#ddb67c', r: 1 }, 1, [0, -0.15, 0], [5.4, 1.7, 3.2], 14, 5, Math.PI / 2)
  k.sphere({ c: '#e6c48e', r: 1 }, 1, [1.4, -0.1, -0.6], [3.2, 1.45, 2.2], 12, 4, Math.PI / 2)
  for (let i = 0; i < 4; i++) k.box({ c: '#cfa66e', r: 1 }, [3.6 - i * 0.5, 0.03, 0.08], [-0.6, 0.55 + i * 0.28, 1.95 - i * 0.42], [-0.45, 0.05 * i, 0])
}

// A broken stretch of the temple enclosure wall: mud brick, its top worn into steps.
function enclosure(k: PropKit) {
  const mud: Look = { c: '#b48a5c', r: 1 }
  const dry: Look = { c: '#c79c6a', r: 1 }
  const tops = [0.95, 0.8, 0.62, 0.86, 0.5, 0.7]
  tops.forEach((h, i) => {
    k.box(i % 2 ? mud : dry, [0.5, h, 0.68], [0, h / 2, -1.75 + i * 0.7])
    // Brick courses showing where the plaster is gone.
    for (let y = 0.18; y < h - 0.05; y += 0.18) k.box(STONE_D, [0.505, 0.015, 0.4], [0, y, -1.75 + i * 0.7 + ((y * 10) % 2 ? 0.1 : -0.1)])
  })
  for (let i = 0; i < 4; i++) k.box(mud, [0.24, 0.16, 0.3], [0.35 + (i % 2) * 0.2, 0.08, -1.4 + i * 0.9], [0, i, 0])
}

const PEOPLE_EG: Dress[] = [
  { top: '#f4efe4', low: '#f4efe4', skin: '#9c6b46', hair: '#1f1a17', robe: true, hat: 'kufi', hatC: '#fafafa' },
  { top: '#5d6d7e', low: '#5d6d7e', skin: '#8a5a3c', hair: '#1f1a17', robe: true, hat: 'turban', hatC: '#efe9dc' },
  { top: '#2c3e50', low: '#2c3e50', skin: '#a8744e', hair: '#1f1a17', robe: true, hat: 'scarf', hatC: '#7b1fa2' },
  { top: '#8d6e63', low: '#8d6e63', skin: '#7a4f33', hair: '#1f1a17', robe: true, hat: 'scarf', hatC: '#1a1a1a' },
  { top: '#e57373', low: '#c8b89a', skin: '#f1c9a5', hair: '#c9a15a', hat: 'cap', hatC: '#fafafa', wave: true },
  { top: '#4fc3f7', low: '#e8dcc4', skin: '#e9b98f', hair: '#5a3a22', hat: 'cap', hatC: '#ef6c00' },
  { top: '#aed581', low: '#5d4037', skin: '#c68e63', hair: '#2b1d14' },
  { top: '#fff59d', low: '#455a64', skin: '#f3d1b5', hair: '#8d5524', wave: true },
]
// Clusters of people: a tour group round its guide and his flag, and locals at a tent.
function tourGroup(k: PropKit) {
  person(k, PEOPLE_EG[0], 0, 0.5, Math.PI)
  k.rod(DARK, [0.2, 0.3, 0.45], [0.2, 1.5, 0.45], 0.012, 4)
  k.box({ c: '#ffb300', r: 0.9 }, [0.004, 0.18, 0.28], [0.2, 1.4, 0.32])
  const spots = [[-0.5, -0.4, 0.3], [0, -0.6, 0], [0.5, -0.35, -0.3], [-0.85, 0.15, 0.9], [0.85, 0.05, -0.8]]
  spots.forEach(([x, z, ry], i) => person(k, PEOPLE_EG[4 + (i % 4)], x, z, ry))
}
function campLocals(k: PropKit) {
  person(k, PEOPLE_EG[1], 0, 0, 0.3)
  person(k, PEOPLE_EG[2], 0.5, 0.15, -0.4)
  person(k, PEOPLE_EG[3], -0.45, 0.3, 0.6)
}

export default function Giza({ len, race }: WorldProps) {
  const houses = useMemo(() => HOUSES.map((h, i) => prop(`giza-house-${i}`, (k) => house(k, h))), [])
  const backs = useMemo(() => BACK.map((i) => prop(`giza-back-${i}`, (k) => house(k, HOUSES[i], true))), [])
  const mosqueP = useProp('giza-mosque', mosque)
  const stalls = useMemo(() => [['#c62828', '#fafafa'], ['#1565c0', '#fdd835'], ['#2e7d32', '#fafafa'], ['#6a1b9a', '#ffb300']].map(([a, b], i) => prop(`giza-stall-${i}`, (k) => stall(k, a, b))), [])
  const camelUp = useProp('giza-camel-up', (k) => camel(k, false))
  const camelDown = useProp('giza-camel-down', (k) => camel(k, true))
  const palms = useMemo(() => [2.4, 3.0, 3.6].map((h) => prop(`giza-palm-${h}`, (k) => datePalm(k, h))), [])
  const farPalm = useProp('giza-palm-far', (k) => datePalm(k, 3.2, true))
  const obeliskP = useProp('giza-obelisk', obelisk)
  const pylonP = useProp('giza-pylon', pylon)
  const sphinxP = useProp('giza-sphinx', sphinx)
  const papyrusP = useProp('giza-papyrus', papyrus)
  const donkeyP = useProp('giza-donkey', donkeyCart)
  const cafeP = useProp('giza-cafe', cafe)
  const ramP = useProp('giza-ram-sphinx', ramSphinx)
  const colP = useProp('giza-colonnade', colonnade)
  const kingP = useProp('giza-colossus', colossus)
  const tentP = useProp('giza-tent', bedouinTent)
  const duneP = useProp('giza-dune', dune)
  const wallP = useProp('giza-enclosure', enclosure)
  const tourP = useProp('giza-tour-group', tourGroup)
  const localsP = useProp('giza-camp-locals', campLocals)
  const gate = race * 0.5
  const mosqueZ = race * 0.28 + 4

  const geo = useMemo(() => {
    const r = rand(311)
    // The ruins side: features down the road every ~15, skipping the gateway and the big sphinx.
    const fr = rand(907)
    const feats: { kind: number; z: number }[] = []
    for (let z = 24, i = 0; z < len + 30; z += 13 + fr() * 5, i++) {
      if (Math.abs(z - gate) < 10 || (z > race - 1 && z < race + 18)) continue
      feats.push({ kind: i % 4, z })
    }
    const busy = (x: number, z: number) => (x < EDGE + 10.5 && feats.some((f) => Math.abs(f.z - z) < 5.2)) || (x < EDGE + 7 && z > race - 11 && z < race + 17)
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
    const back: Spot[][] = BACK.map(() => [])
    for (let z = -12; z < len + 40;) {
      const j = Math.floor(r() * BACK.length)
      const h = HOUSES[BACK[j]]
      const zc = z + h.w / 2
      if (Math.abs(zc - mosqueZ) > 3 + h.w / 2) back[j].push({ x: -(EDGE + 3.4 + h.d / 2), z: zc, ry: Math.PI / 2, y: 0.35 })
      z += h.w + 0.3
    }
    // Spice stalls by the start line, behind the crowd.
    const stallAt: Spot[][] = [[], [], [], []]
    for (let i = 0; i < 8; i++) stallAt[i % 4].push({ x: EDGE + 1.35, z: -6 + i * 2.1, ry: -Math.PI / 2 })
    // Date palms in groves on the right, and along the river bank on the left.
    const palmAt: Spot[][] = [[], [], []]
    const farAt: Spot[] = []
    for (let z = 12; z < len + 60; z += 2.2 + r() * 3) {
      const x = EDGE + 4 + r() * 9
      const p = { x, z, ry: r() * 6, s: 0.9 + r() * 0.3 }
      const k = Math.floor(r() * 3)
      if (busy(x, z)) continue
      if (x > EDGE + 8.5) farAt.push(p)
      else palmAt[k].push(p)
    }
    for (let z = -10; z < len + 60; z += 3 + r() * 3) palmAt[Math.floor(r() * 3)].push({ x: -(EDGE + 8.6 + r() * 1.6), z, ry: r() * 6, s: 0.85 + r() * 0.3 })
    for (let z = -6; z < len + 80; z += 4 + r() * 4) farAt.push({ x: -(EDGE + 30 + r() * 6), z, ry: r() * 6, s: 1.05 + r() * 0.4 })
    // Camels resting in the palms' shade, a few standing.
    const up: Spot[] = []
    const down: Spot[] = []
    for (let z = 16; z < len + 30; z += 5 + r() * 7) {
      const x = EDGE + 3.8 + r() * 5
      const ry = r() * 6
      if (busy(x, z)) continue
      // Keep clear of the donkey carts waiting by the road.
      if (!CARTS.some((c) => Math.abs(c * race - z) < 2.5)) (r() < 0.45 ? up : down).push({ x, z, ry })
    }
    const rr = rand(57)
    const near = (n: number, from: number, to: number) =>
      Array.from({ length: n }, () => {
        const side = rr() < 0.4 ? -1 : 1
        return { x: side * (EDGE + from + rr() ** 1.3 * (to - from)), z: rr() * (len + 60) - 14, s: 0.6 + rr() * 0.8, ry: rr() * 6 }
      })
    // Papyrus thick along the water's edge.
    const reeds: Spot[] = []
    for (let z = -12; z < len + 60; z += 1.6 + r() * 2.4) reeds.push({ x: -(EDGE + 11 + r() * 0.5), z, ry: r() * 6, s: 0.8 + r() * 0.45 })
    // The avenue of ram sphinxes along the kerb, clear of the carts, gateway and finish crowd.
    const rams: Spot[] = []
    for (let z = 18.5; z < len + 30; z += 1.55) {
      if (Math.abs(z - gate) < 7.5 || (z > race - 10 && z < race + 5) || CARTS.some((c) => Math.abs(c * race - z) < 1.6)) continue
      rams.push({ x: EDGE + 1.3, z, ry: -Math.PI / 2 })
    }
    // The enclosure wall behind them, broken here and there.
    const walls: Spot[] = []
    for (let z = 20; z < len + 30; z += 4.2) {
      if (Math.abs(z - gate) < 8 || (z > race - 11 && z < race + 5) || fr() < 0.18) continue
      walls.push({ x: EDGE + 2.75, z, ry: 0 })
    }
    const cols: Spot[] = []
    const kings: Spot[] = []
    const tents: Spot[] = []
    const tours: Spot[] = []
    const locals: Spot[] = []
    for (const f of feats) {
      if (f.kind === 0 || f.kind === 2) {
        cols.push({ x: EDGE + 6.6, z: f.z, ry: 0 })
        tours.push({ x: EDGE + 4.2, z: f.z + (f.kind ? 2 : -2), ry: -Math.PI / 2 + 0.3 })
      } else if (f.kind === 1) {
        for (const dz of [-1.4, 1.4]) kings.push({ x: EDGE + 5.4, z: f.z + dz, ry: -Math.PI / 2 })
        tours.push({ x: EDGE + 3.9, z: f.z + 3.4, ry: -Math.PI / 2 - 0.4 })
      } else {
        tents.push({ x: EDGE + 6.4, z: f.z, ry: -Math.PI / 2 })
        locals.push({ x: EDGE + 4.3, z: f.z - 1.2, ry: -Math.PI / 2 })
      }
    }
    // Behind the finish crowd: a souvenir market, and two seated kings guarding the big sphinx.
    for (let z = race - 9, i = 0; z < race + 4; z += 2.1, i++) stallAt[i % 4].push({ x: EDGE + 3.4, z, ry: -Math.PI / 2 })
    for (const dz of [5.5, 14]) kings.push({ x: EDGE + 5.3, z: race + dz, ry: -Math.PI / 2 })
    tours.push({ x: EDGE + 3.4, z: race + 9.5, ry: -Math.PI / 2 })
    // Dunes rolling away behind the groves, so the plain never runs empty to the sky.
    const dunes: Spot[] = []
    for (let z = -20; z < len + 70; z += 6 + fr() * 4) dunes.push({ x: EDGE + 17 + fr() * 14, z, ry: fr() * 0.8 - 0.4, s: 1 + fr() * 1.2 })
    return { rams, walls, cols, kings, tents, tours, locals, dunes, rows, back, stallAt, palmAt, farAt, up, down, reeds, grass: near(360, 0.2, 16).filter((p) => p.x > 0), rocks: near(200, 0.2, 18).filter((p) => p.x > 0) }
  }, [len, race, gate, mosqueZ])

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
        {/* Two pavement cafes past the spice stalls, and donkey carts waiting by the road. */}
        {[13, 15.3].map((z) => (
          <group key={z} position={[EDGE + 1.3, 0, z]} rotation-y={-Math.PI / 2}><PropMesh parts={cafeP} /></group>
        ))}
        {CARTS.map((c, i) => (
          <group key={c} position={[EDGE + 1.1 + (i % 2) * 0.4, 0, c * race]} rotation-y={i % 2 ? 0.25 : -0.2}><PropMesh parts={donkeyP} /></group>
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
      {backs.map((h, i) => <Many key={i} parts={h} at={geo.back[i]} />)}
      {stalls.map((s, i) => <Many key={i} parts={s} at={geo.stallAt[i]} />)}
      {palms.map((p, i) => <Many key={i} parts={p} at={geo.palmAt[i]} />)}
      <Many parts={farPalm} at={geo.farAt} />
      <Many parts={camelUp} at={geo.up} near={80} />
      <Many parts={camelDown} at={geo.down} near={80} />
      <Many parts={papyrusP} at={geo.reeds} />
      <Many parts={ramP} at={geo.rams} near={80} />
      <Many parts={wallP} at={geo.walls} near={80} />
      <Many parts={colP} at={geo.cols} />
      <Many parts={kingP} at={geo.kings} />
      <Many parts={tentP} at={geo.tents} near={80} />
      <Many parts={tourP} at={geo.tours} near={70} />
      <Many parts={localsP} at={geo.locals} near={70} />
      <Many parts={duneP} at={geo.dunes} />
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
