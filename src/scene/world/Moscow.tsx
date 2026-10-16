import { useMemo } from 'react'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Scatter, archTop, frustum, glow, prop, rand, useProp, type Look, type PropKit, type Spot, type V3 } from './kit'
import type { WorldProps } from './WorldVenue'

// Russia, Onion Dome Square: a snowy strip along the red fortress wall. Right: the crenellated
// brick wall with its green-roofed towers and ruby stars, and the great clock tower. Left: pastel
// classical buildings with snow on their roofs and birches between them. Halfway the racers pass
// under the red double gate; the many-domed cathedral watches the finish, and a tiered tower
// with a spire rises far ahead.

const BRICK: Look = { c: '#a9342b', r: 0.95 }
const BRICK_D: Look = { c: '#8e2a23', r: 0.95 }
const STONE: Look = { c: '#efe7da', r: 0.85 }
const ROOF: Look = { c: '#2f6b4f', r: 0.7 }
const SNOW: Look = { c: '#f6f9fc', r: 0.9 }
const GOLD: Look = { c: '#e5b53c', r: 0.3, m: 0.7 }
const DARK: Look = { c: '#27303a', r: 1 }

// An onion dome in horizontal bands (alternating two colours for the striped ones), with a
// slim neck, a gold tip and a cross-bar finial. Sits on p.
const ONION = [[0.55, 0.08], [0.85, 0.14], [1.0, 0.16], [0.95, 0.16], [0.75, 0.16], [0.45, 0.14], [0.18, 0.14]] as const
function onion(k: PropKit, a: Look, b: Look, r: number, p: V3) {
  let y = p[1]
  let prev = 0.45
  ONION.forEach(([rad, h], i) => {
    k.cyl(i % 2 ? b : a, rad * r, prev * r, h * r * 2, [p[0], y + h * r, p[2]], undefined, 14)
    y += h * r * 2
    prev = rad
  })
  k.cone(GOLD, 0.16 * r, 0.6 * r, [p[0], y + 0.3 * r, p[2]], undefined, 8)
  k.cyl(GOLD, 0.025 * r, 0.025 * r, 0.7 * r, [p[0], y + 0.9 * r, p[2]], undefined, 5)
  k.box(GOLD, [0.36 * r, 0.04 * r, 0.04 * r], [p[0], y + 1.05 * r, p[2]])
  return y
}

// A wall tower: a square brick shaft with white trim, an open lantern stage and a green tent
// roof under a glowing ruby star. Sits on p.
function tower(k: PropKit, p: V3, w: number, h: number, clock = false) {
  const [x, y0, z] = p
  k.box(BRICK, [w, h, w], [x, y0 + h / 2, z])
  k.box(STONE, [w + 0.12, 0.14, w + 0.12], [x, y0 + h, z])
  for (let i = 1; i < 4; i++) k.box(STONE, [w + 0.04, 0.06, w + 0.04], [x, y0 + (h * i) / 4, z])
  // Narrow arrow-slit windows, one on each face per stage.
  for (let i = 0; i < 3; i++) for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    k.box(DARK, [dz ? 0.2 : 0.03, 0.45, dz ? 0.03 : 0.2], [x + dx * (w / 2 + 0.005), y0 + h * (0.25 + i * 0.25) - 0.35, z + dz * (w / 2 + 0.005)])
  }
  // Swallowtail merlons round the top.
  const n = Math.max(3, Math.round(w / 0.55))
  for (let i = 0; i < n; i++) for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const t = -w / 2 + (w / n) * (i + 0.5)
    for (const s of [-1, 1]) k.box(BRICK, [dz ? 0.1 : 0.12, 0.42, dz ? 0.12 : 0.1], [x + (dz ? t + s * 0.07 : dx * w / 2), y0 + h + 0.28 + 0.06, z + (dz ? dz * w / 2 : t + s * 0.07)])
  }
  // Upper stage, smaller, with white columns at its corners and a clock if asked for.
  const u = w * 0.68
  const uh = h * 0.42
  const yu = y0 + h + 0.14
  k.box(BRICK, [u, uh, u], [x, yu + uh / 2, z])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(STONE, 0.06, 0.06, uh, [x + sx * u / 2, yu + uh / 2, z + sz * u / 2], undefined, 6)
  if (clock) {
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
      const cx = x + dx * (u / 2 + 0.02)
      const cz = z + dz * (u / 2 + 0.02)
      k.cyl(GOLD, u * 0.36, u * 0.36, 0.03, [cx, yu + uh * 0.5, cz], [Math.PI / 2, ry, 0], 20)
      k.cyl(DARK, u * 0.31, u * 0.31, 0.03, [cx + dx * 0.01, yu + uh * 0.5, cz + dz * 0.01], [Math.PI / 2, ry, 0], 20)
      k.box(GOLD, [0.04, u * 0.24, 0.02], [cx + dx * 0.025, yu + uh * 0.5 + u * 0.1, cz + dz * 0.025], [0, ry, 0])
      k.box(GOLD, [u * 0.18, 0.04, 0.02], [cx + dx * 0.025 + (dz ? u * 0.08 : 0), yu + uh * 0.5, cz + dz * 0.025 + (dx ? u * 0.08 : 0)], [0, ry, 0])
    }
  } else {
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) k.box(DARK, [dz ? u * 0.35 : 0.03, uh * 0.55, dz ? 0.03 : u * 0.35], [x + dx * (u / 2 + 0.005), yu + uh * 0.5, z + dz * (u / 2 + 0.005)])
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) archTop(k, DARK, u * 0.35, 0.03, [x + dx * (u / 2 + 0.005), yu + uh * 0.775, z + dz * (u / 2 + 0.005)], dx ? Math.PI / 2 : 0)
  }
  k.box(STONE, [u + 0.14, 0.12, u + 0.14], [x, yu + uh + 0.06, z])
  // The green tent roof with a snow dusting, the spire and the star.
  const rh = u * 2.3
  frustum(k, ROOF, u + 0.1, u + 0.1, rh, 0, [x, yu + uh + 0.12, z])
  frustum(k, SNOW, u * 0.5, u * 0.5, rh * 0.06, 0.6, [x, yu + uh + 0.12 + rh * 0.5, z])
  k.cyl(GOLD, 0.03, 0.04, 0.8, [x, yu + uh + rh + 0.4, z], undefined, 6)
  const sy = yu + uh + rh + 0.95
  const ruby = glow('#ff1a2e', 0.5, 1.4)
  for (let i = 0; i < 5; i++) k.box(ruby, [0.09, 0.36, 0.07], [x, sy, z], [0, 0, (i / 5) * Math.PI * 2])
  k.box(ruby, [0.09, 0.36, 0.07], [x, sy, z], [0, Math.PI / 2, 0])
}

// One length of fortress wall (along z) with its walkway, merlons and a cap of snow.
function wallRun(k: PropKit, len: number) {
  k.box(BRICK, [1.2, 3.2, len], [0, 1.6, 0])
  k.box(BRICK_D, [1.3, 0.3, len], [0, 0.15, 0])
  k.box(STONE, [1.26, 0.08, len], [0, 3.2, 0])
  for (let z = -len / 2 + 0.35; z < len / 2; z += 0.7) {
    for (const s of [-1, 1]) {
      k.box(BRICK, [0.18, 0.55, 0.12], [0.5, 3.5, z + s * 0.08])
      k.box(SNOW, [0.2, 0.05, 0.14], [0.5, 3.8, z + s * 0.08])
    }
    k.box(DARK, [0.03, 0.18, 0.06], [0.6, 3.5, z])
  }
  k.box(SNOW, [0.9, 0.04, len], [-0.1, 3.26, 0])
}

// A pastel classical building facing +z: rusticated ground floor, columns and a pediment,
// tall windows, a green roof with snow on it.
const PASTELS = ['#ead27a', '#e9b8a8', '#cfe0d0', '#f0e2c6', '#d9c3e8', '#f2c48a']
type Block = { w: number; d: number; floors: number; tint: number; portico: boolean }
const BLOCKS: Block[] = [
  { w: 4.2, d: 3, floors: 4, tint: 0, portico: true },
  { w: 3.2, d: 3, floors: 3, tint: 1, portico: false },
  { w: 3.8, d: 3, floors: 4, tint: 2, portico: false },
  { w: 4.6, d: 3, floors: 3, tint: 3, portico: true },
  { w: 3.0, d: 3, floors: 4, tint: 4, portico: false },
  { w: 3.6, d: 3, floors: 3, tint: 5, portico: false },
]
function block(k: PropKit, b: Block) {
  const wall: Look = { c: PASTELS[b.tint], r: 0.9 }
  const H = b.floors * 1.2 + 0.3
  const f = b.d / 2
  k.box(wall, [b.w, H, b.d], [0, H / 2, 0])
  k.box(STONE, [b.w + 0.06, 1.25, b.d + 0.06], [0, 0.62, 0])
  for (let i = 0; i < 4; i++) k.box({ c: '#d8cfc0', r: 0.9 }, [b.w + 0.08, 0.04, b.d + 0.08], [0, 0.2 + i * 0.3, 0])
  k.box(STONE, [b.w + 0.1, 0.14, b.d + 0.1], [0, H - 0.05, 0])
  k.box(STONE, [b.w + 0.06, 0.08, b.d + 0.06], [0, 1.28, 0])
  // Windows: tall, white-framed, each with a little cornice; shop windows below.
  const n = Math.round(b.w / 0.8)
  for (let fl = 0; fl < b.floors; fl++) for (let i = 0; i < n; i++) {
    const x = -b.w / 2 + (b.w / n) * (i + 0.5)
    if (fl === 0) {
      k.box({ c: '#3a4652', r: 0.3, m: 0.2 }, [0.5, 0.75, 0.03], [x, 0.6, f + 0.035])
      continue
    }
    const y = 1.3 + (fl - 1) * 1.2 + 0.55
    k.box(STONE, [0.46, 0.78, 0.04], [x, y, f + 0.006])
    k.box({ c: '#33404d', r: 0.25, m: 0.2 }, [0.34, 0.66, 0.03], [x, y, f + 0.012])
    k.box(STONE, [0.03, 0.66, 0.03], [x, y, f + 0.03])
    k.box(STONE, [0.54, 0.07, 0.12], [x, y + 0.45, f + 0.05])
    k.box(SNOW, [0.54, 0.03, 0.12], [x, y + 0.5, f + 0.05])
  }
  if (b.portico) {
    for (let i = 0; i < 4; i++) {
      const x = -0.9 + i * 0.6
      k.cyl(STONE, 0.1, 0.11, H - 1.6, [x, 1.3 + (H - 1.6) / 2, f + 0.25], undefined, 10)
      k.box(STONE, [0.26, 0.08, 0.26], [x, H - 0.28, f + 0.25])
    }
    k.box(STONE, [2.2, 0.2, 0.5], [0, H - 0.15, f + 0.25])
    frustum(k, STONE, 2.3, 0.5, 0.6, 0.05, [0, H, f + 0.25])
  }
  // The roof: a low hip in green sheet metal, snow lying on it, a chimney or two.
  frustum(k, ROOF, b.w + 0.1, b.d + 0.1, 0.8, 0.55, [0, H, 0])
  frustum(k, SNOW, b.w * 0.8, b.d * 0.8, 0.12, 0.7, [0, H + 0.62, 0])
  for (const s of [-1, 1]) {
    k.box(wall, [0.25, 0.6, 0.25], [s * b.w * 0.3, H + 0.8, -0.3])
    k.box(SNOW, [0.3, 0.05, 0.3], [s * b.w * 0.3, H + 1.12, -0.3])
  }
}

// A birch in winter: a white trunk with dark marks, bare branches with snow lying along them.
function birch(k: PropKit) {
  const bark: Look = { c: '#ecebe6', r: 0.9 }
  k.cyl(bark, 0.07, 0.1, 3.2, [0, 1.6, 0], undefined, 7)
  for (let i = 0; i < 7; i++) k.box(DARK, [0.1, 0.035, 0.03], [Math.sin(i * 2.2) * 0.05, 0.4 + i * 0.4, 0.08], [0, i * 1.3, 0])
  const twig: Look = { c: '#5d4b40', r: 1 }
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05
    const y = 1.8 + i * 0.25
    k.rod(twig, [0, y, 0], [Math.sin(a) * 0.7, y + 0.6, Math.cos(a) * 0.7], 0.025, 4)
    k.rod(twig, [Math.sin(a) * 0.7, y + 0.6, Math.cos(a) * 0.7], [Math.sin(a + 0.4) * 0.9, y + 1.0, Math.cos(a + 0.4) * 0.9], 0.015, 4)
    k.rod(twig, [Math.sin(a) * 0.4, y + 0.35, Math.cos(a) * 0.4], [Math.sin(a - 0.5) * 0.65, y + 0.75, Math.cos(a - 0.5) * 0.65], 0.012, 4)
    k.rod(SNOW, [Math.sin(a) * 0.15, y + 0.13, Math.cos(a) * 0.15], [Math.sin(a) * 0.55, y + 0.5, Math.cos(a) * 0.55], 0.03, 4)
  }
}

// The cathedral of many domes on its brick platform, facing +z: a tall tented central tower
// and eight chapels round it, each crowned with its own patterned onion dome.
function cathedral(k: PropKit) {
  k.box(BRICK_D, [11, 1.4, 11], [0, 0.7, 0])
  for (let i = 0; i < 11; i++) {
    const x = -5 + i
    k.box(STONE, [0.5, 0.7, 0.03], [x, 0.6, 5.51])
    archTop(k, STONE, 0.5, 0.03, [x, 0.95, 5.51])
    k.box(BRICK_D, [0.38, 0.62, 0.03], [x, 0.58, 5.52])
    archTop(k, BRICK_D, 0.38, 0.03, [x, 0.89, 5.52])
  }
  k.box(STONE, [11.1, 0.1, 11.1], [0, 1.42, 0])
  // Central tower: octagonal shaft, a ring of kokoshnik gables, the tall tent and a small dome.
  k.cyl(BRICK, 1.6, 1.7, 6, [0, 4.4, 0], [0, Math.PI / 8, 0], 8)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    k.box(STONE, [0.12, 6, 0.12], [Math.sin(a) * 1.68, 4.4, Math.cos(a) * 1.68])
    archTop(k, STONE, 1.0, 0.1, [Math.sin(a + Math.PI / 8) * 1.62, 7.4, Math.cos(a + Math.PI / 8) * 1.62], a + Math.PI / 8)
    k.box(DARK, [0.3, 0.8, 0.05], [Math.sin(a + Math.PI / 8) * 1.62, 5.4, Math.cos(a + Math.PI / 8) * 1.62], [0, a + Math.PI / 8, 0])
  }
  frustum(k, { c: '#e9e1cf', r: 0.8 }, 2.6, 2.6, 5.5, 0.18, [0, 7.4, 0], Math.PI / 8)
  for (let i = 0; i < 5; i++) k.cyl(GOLD, 0.04, 0.04, 0.06, [0, 8.4 + i * 0.9, 0], undefined, 8)
  k.cyl(BRICK, 0.35, 0.35, 0.6, [0, 13.2, 0], undefined, 10)
  onion(k, GOLD, GOLD, 0.55, [0, 13.5, 0])
  // Eight chapels: four big ones on the axes, four smaller between, all different.
  const domes: [Look, Look][] = [
    [{ c: '#2e8b57', r: 0.6 }, { c: '#f3d36b', r: 0.6 }],
    [{ c: '#c62828', r: 0.6 }, { c: '#f5f5f5', r: 0.6 }],
    [{ c: '#1565c0', r: 0.6 }, { c: '#f3d36b', r: 0.6 }],
    [{ c: '#2e7d32', r: 0.6 }, { c: '#c62828', r: 0.6 }],
    [{ c: '#f9a825', r: 0.6 }, { c: '#2e7d32', r: 0.6 }],
    [{ c: '#6a1b9a', r: 0.6 }, { c: '#f5f5f5', r: 0.6 }],
    [{ c: '#00838f', r: 0.6 }, { c: '#f9a825', r: 0.6 }],
    [{ c: '#ad1457', r: 0.6 }, { c: '#f3d36b', r: 0.6 }],
  ]
  for (let i = 0; i < 8; i++) {
    const big = i % 2 === 0
    const a = (i / 8) * Math.PI * 2
    const d = big ? 3.6 : 3.4
    const x = Math.sin(a) * d
    const z = Math.cos(a) * d
    const r = big ? 1.15 : 0.8
    const h = big ? 4.4 : 3.2
    k.cyl(i % 4 === 1 ? { c: '#d9b44a', r: 0.8 } : BRICK, r, r * 1.05, h, [x, 1.45 + h / 2, z], undefined, 8)
    k.cyl(STONE, r + 0.06, r + 0.06, 0.1, [x, 1.45 + h, z], undefined, 8)
    for (let j = 0; j < 4; j++) {
      const b = a + (j / 4) * Math.PI * 2
      k.box(DARK, [0.22, 0.6, 0.04], [x + Math.sin(b) * r * 0.98, 1.45 + h * 0.6, z + Math.cos(b) * r * 0.98], [0, b, 0])
      archTop(k, STONE, r * 0.8, 0.06, [x + Math.sin(b) * r, 1.45 + h, z + Math.cos(b) * r], b)
    }
    k.cyl(BRICK, r * 0.62, r * 0.62, 0.7, [x, 1.45 + h + 0.4, z], undefined, 10)
    onion(k, domes[i][0], domes[i][1], r * 0.92, [x, 1.45 + h + 0.75, z])
  }
}

// The red gate across the road between its two towers: one broad arch the racers pass through,
// a gilded icon over it.
function gate(k: PropKit) {
  for (const s of [-1, 1]) tower(k, [s * 4.6, 0, 0], 2.2, 5.6)
  for (const s of [-1, 1]) k.box(BRICK, [0.9, 3.8, 2.2], [s * 3.05, 1.9, 0])
  k.box(BRICK, [7.0, 1.6, 2.2], [0, 4.6, 0])
  for (const [z, ry] of [[1.1, 0], [-1.1, Math.PI]] as const) {
    const f = Math.sign(z)
    archTop(k, STONE, 5.4, 0.03, [0, 3.8, z + f * 0.006], ry, 0.42)
    archTop(k, BRICK_D, 5.0, 0.03, [0, 3.8, z + f * 0.012], ry, 0.4)
    for (const s of [-1, 1]) k.box(STONE, [0.12, 3.8, 0.04], [s * 2.6, 1.9, z + f * 0.01])
    k.box(STONE, [7.1, 0.12, 0.06], [0, 4.95, z])
    k.cyl({ c: '#1f3c78', r: 0.6 }, 0.38, 0.38, 0.04, [0, 4.75, z + f * 0.03], [Math.PI / 2, 0, 0], 16)
    k.cyl(GOLD, 0.28, 0.28, 0.05, [0, 4.75, z + f * 0.05], [Math.PI / 2, 0, 0], 16)
  }
  k.box(STONE, [7.2, 0.18, 2.3], [0, 5.45, 0])
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) k.box(BRICK, [0.12, 0.5, 0.18], [-3.2 + i * 0.8 + s * 0.08, 5.8, 1.0])
}

export default function Moscow({ len, race }: WorldProps) {
  const blocks = useMemo(() => BLOCKS.map((b, i) => prop(`moscow-block-${i}`, (k) => block(k, b))), [])
  const wallP = useProp('moscow-wall', (k) => wallRun(k, 24))
  const towerP = useProp('moscow-tower', (k) => tower(k, [0, 0, 0], 2.4, 6))
  const clockP = useProp('moscow-clock', (k) => tower(k, [0, 0, 0], 3.4, 9, true))
  const cathedralP = useProp('moscow-cathedral', cathedral)
  const gateP = useProp('moscow-gate', gate)
  const birchP = useProp('moscow-birch', birch)
  const gz = race * 0.5
  const cz = race + 12
  const WX = -(EDGE + 2.4)

  const geo = useMemo(() => {
    const r = rand(613)
    const rows: Spot[][] = BLOCKS.map(() => [])
    for (let z = -14; z < len + 40;) {
      const i = Math.floor(r() * BLOCKS.length)
      const b = BLOCKS[i]
      const zc = z + b.w / 2
      if (Math.abs(zc - gz) > 4 + b.w / 2 && Math.abs(zc - cz) > 8 + b.w / 2) rows[i].push({ x: EDGE + 2.2 + b.d / 2, z: zc, ry: -Math.PI / 2 })
      z += b.w + (r() < 0.4 ? 1.6 : 0.1)
    }
    // The wall in 24-unit lengths with a tower between each; the clock tower opposite the start.
    const walls: Spot[] = []
    const towers: Spot[] = []
    for (let z = -14; z < len + 40; z += 26) {
      if (Math.abs(z + 12 - gz) > 13) walls.push({ x: WX, z: z + 12 })
      if (Math.abs(z - gz) > 5 && Math.abs(z - 30) > 4) towers.push({ x: WX, z })
    }
    const birches: Spot[] = []
    for (let z = -10; z < len + 40; z += 2.8 + r() * 2.5) if (Math.abs(z - gz) > 5 && Math.abs(z - cz) > 9) birches.push({ x: EDGE + 0.9, z, ry: r() * 6, s: 0.8 + r() * 0.35 })
    for (let z = -10; z < len + 60; z += 2 + r() * 2) birches.push({ x: WX - 3 - r() * 8, z, ry: r() * 6, s: 0.9 + r() * 0.4 })
    const rr = rand(77)
    const banks = Array.from({ length: 220 }, () => {
      const side = rr() < 0.5 ? -1 : 1
      return { x: side * (EDGE + 0.15 + rr() * 0.7), z: rr() * (len + 60) - 14, s: 0.5 + rr() * 0.9, ry: rr() * 6, sy: 0.4 }
    })
    return { rows, walls, towers, birches, banks }
  }, [len, gz, cz, WX])

  return (
    <>
      <Batch version={`moscow:${len}`} cell={24}>
        <group position={[0, 0, gz]}><PropMesh parts={gateP} /></group>
        <group position={[WX, 0, 30]}><PropMesh parts={clockP} /></group>
        <group position={[EDGE + 9, 0, cz]} rotation-y={-Math.PI / 2}><PropMesh parts={cathedralP} /></group>
        {/* The square's cobbles in front of the cathedral. */}
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 6, 0.013, cz]}>
          <planeGeometry args={[12, 18]} />
          <meshStandardMaterial color="#a9a4a0" />
        </mesh>
        <Scatter spots={geo.banks} colors={['#f4f8fb', '#e8eff5', '#fbfdff']} y={0.1}>
          <icosahedronGeometry args={[0.35, 0]} />
        </Scatter>
      </Batch>
      {blocks.map((b, i) => <Many key={i} parts={b} at={geo.rows[i]} />)}
      <Many parts={wallP} at={geo.walls} />
      <Many parts={towerP} at={geo.towers} />
      <Many parts={birchP} at={geo.birches} />
      <FarMoscow />
    </>
  )
}

// A tiered tower with a spire and star far ahead, like the city's great postwar towers.
function FarMoscow() {
  const parts = useProp('moscow-far', (k) => {
    const stone: Look = { c: '#e3d6c0', r: 0.9 }
    const shade: Look = { c: '#c9b99c', r: 0.9 }
    const x = 22
    const z = 96
    k.box(stone, [26, 10, 14], [x, 5, z])
    for (const s of [-1, 1]) k.box(stone, [8, 16, 10], [x + s * 10, 8, z])
    k.box(stone, [12, 24, 12], [x, 12, z])
    k.box(shade, [12.4, 0.6, 12.4], [x, 24, z])
    k.box(stone, [9, 8, 9], [x, 28.3, z])
    k.box(shade, [9.4, 0.5, 9.4], [x, 32.4, z])
    k.box(stone, [6, 5, 6], [x, 35, z])
    k.cyl(stone, 2.2, 2.6, 4, [x, 39.5, z], undefined, 8)
    frustum(k, shade, 3.2, 3.2, 9, 0.05, [x, 41.5, z])
    k.cyl(GOLD, 0.15, 0.2, 3, [x, 51.5, z], undefined, 6)
    k.box(glow('#ff1a2e', 0.5, 1.4), [0.5, 1.2, 0.3], [x, 53.4, z])
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) k.box(DARK, [0.6, 14, 0.1], [x + s * (1.5 + i * 0.9) * (i < 3 ? 1 : 1), 12, z - 6.05])
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
