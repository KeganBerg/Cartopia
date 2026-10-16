import { useMemo } from 'react'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Scatter, archTop, frustum, gable, glow, prop, rand, useProp, type Look, type PropKit, type Spot, type V3 } from './kit'
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
// Gilt that stays plain, for the instanced wall towers (one painted mesh, no extra draw).
const GILT: Look = { c: '#e5b53c', r: 0.3, m: 0.25 }
const DARK: Look = { c: '#27303a', r: 1 }
const ICE: Look = { c: '#dcecf6', r: 0.3 }
const IRON: Look = { c: '#23292d', r: 0.6 }

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
  k.cyl(clock ? GOLD : GILT, 0.03, 0.04, 0.8, [x, yu + uh + rh + 0.4, z], undefined, 6)
  const sy = yu + uh + rh + 0.95
  const ruby = glow('#ff1a2e', 0.5, 1.4)
  for (let i = 0; i < 5; i++) k.box(ruby, [0.09, 0.36, 0.07], [x, sy, z], [0, 0, (i / 5) * Math.PI * 2])
  k.box(ruby, [0.09, 0.36, 0.07], [x, sy, z], [0, Math.PI / 2, 0])
}

// Firs along each length of wall: where (z) and how big.
const FIRS = [[-8.5, 0.9], [0, 1.0], [8.8, 0.85]] as const

// One length of fortress wall (along z) with its walkway, merlons and a cap of snow.
function wallRun(k: PropKit, len: number) {
  k.box(BRICK, [1.2, 3.2, len], [0, 1.6, 0])
  k.box(BRICK_D, [1.3, 0.3, len], [0, 0.15, 0])
  k.box(STONE, [1.26, 0.08, len], [0, 3.2, 0])
  for (let z = -len / 2 + 0.35; z < len / 2; z += 0.7) {
    for (const s of [-1, 1]) {
      k.box(BRICK, [0.18, 0.55, 0.12], [0.5, 3.5, z + s * 0.08])
    }
    k.box(SNOW, [0.2, 0.05, 0.3], [0.5, 3.8, z])
    k.box(DARK, [0.03, 0.18, 0.06], [0.6, 3.5, z])
  }
  k.box(SNOW, [0.9, 0.04, len], [-0.1, 3.26, 0])
  // Snowy firs planted along its foot on the road side, clear of the towers at each end.
  FIRS.forEach(([z, sc], i) => fir(k, 1.45, z, sc, i * 1.7))
}

// A pastel classical building facing +z: rusticated ground floor, columns and a pediment,
// tall windows, a green roof with snow on it.
const PASTELS = ['#ead27a', '#e9b8a8', '#cfe0d0', '#f0e2c6', '#d9c3e8', '#f2c48a']
// lamp: a street lamp and bench out on the pavement in front (part of the block's own prop, so
// the lamps cost no draws of their own).
type Block = { w: number; d: number; floors: number; tint: number; portico: boolean; lamp: boolean }
const BLOCKS: Block[] = [
  { w: 4.2, d: 3, floors: 4, tint: 0, portico: true, lamp: false },
  { w: 3.2, d: 3, floors: 3, tint: 1, portico: false, lamp: true },
  { w: 3.8, d: 3, floors: 4, tint: 2, portico: false, lamp: false },
  { w: 4.6, d: 3, floors: 3, tint: 3, portico: true, lamp: false },
  { w: 3.0, d: 3, floors: 4, tint: 4, portico: false, lamp: true },
  { w: 3.6, d: 3, floors: 3, tint: 5, portico: false, lamp: false },
]
// Where a block's lamp stands, along its front (local x), and how far out on the pavement.
const LAMP_X = (b: Block) => -b.w / 2 + 0.25
const LAMP_OUT = 1.75
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
    // A sill under each window, snow lying along it.
    k.box(SNOW, [0.52, 0.06, 0.1], [x, y - 0.42, f + 0.05])
    if (fl === 1) {
      // The main floor: a triangular pediment over each window, snow on its slopes.
      k.box(STONE, [0.54, 0.07, 0.12], [x, y + 0.45, f + 0.05])
      gable(k, STONE, 0.58, 0.12, 0.17, [x, y + 0.485, f + 0.05])
      gable(k, SNOW, 0.58, 0.1, 0.18, [x, y + 0.495, f + 0.045])
    } else {
      k.box(STONE, [0.54, 0.07, 0.12], [x, y + 0.45, f + 0.05])
      k.box(SNOW, [0.54, 0.03, 0.12], [x, y + 0.5, f + 0.05])
    }
  }
  // A frieze band under the cornice, and icicles hanging from it, long and short (clear of
  // the portico's own entablature).
  const clear = (x: number) => !b.portico || Math.abs(x) > 1.16
  k.box(STONE, [b.w + 0.04, 0.07, 0.05], [0, H - 0.155, f + 0.02])
  for (let i = 0, n = Math.round(b.w / 0.34); i < n; i++) {
    const x = -b.w / 2 + (b.w / n) * (i + 0.5)
    const l = 0.06 + ((i * 7) % 5) * 0.035
    if (clear(x)) k.cone(ICE, 0.022, l, [x, H - 0.12 - l / 2, f + 0.03], [Math.PI, 0, 0], 5)
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
  if (b.lamp) lampBench(k, LAMP_X(b), f + LAMP_OUT)
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
  for (let i = 0; i < 5; i++) k.box(DARK, [0.1, 0.035, 0.03], [Math.sin(i * 2.2) * 0.05, 0.5 + i * 0.55, 0.08], [0, i * 1.3, 0])
  const twig: Look = { c: '#5d4b40', r: 1 }
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05
    const y = 1.8 + i * 0.25
    k.rod(twig, [0, y, 0], [Math.sin(a) * 0.7, y + 0.6, Math.cos(a) * 0.7], 0.025, 3)
    k.rod(twig, [Math.sin(a) * 0.7, y + 0.6, Math.cos(a) * 0.7], [Math.sin(a + 0.4) * 0.9, y + 1.0, Math.cos(a + 0.4) * 0.9], 0.015, 3)
    k.rod(twig, [Math.sin(a) * 0.4, y + 0.35, Math.cos(a) * 0.4], [Math.sin(a - 0.5) * 0.65, y + 0.75, Math.cos(a - 0.5) * 0.65], 0.012, 3)
    k.rod(SNOW, [Math.sin(a) * 0.15, y + 0.13, Math.cos(a) * 0.15], [Math.sin(a) * 0.55, y + 0.5, Math.cos(a) * 0.55], 0.03, 4)
  }
}

// A cast-iron double street lamp with snow on its lantern caps, and a park bench beside it
// with snow along the seat. Facing +z (the road).
function lampBench(k: PropKit, ox = 0, oz = 0) {
  const P = (x: number, y: number, z: number): V3 => [x + ox, y, z + oz]
  // Fluted post on a stepped base, a snow ring on its collar.
  k.cyl(IRON, 0.12, 0.14, 0.12, P(0, 0.06, 0), undefined, 6)
  k.cyl(IRON, 0.08, 0.11, 0.32, P(0, 0.28, 0), undefined, 6)
  k.cyl(SNOW, 0.1, 0.1, 0.03, P(0, 0.455, 0), undefined, 6)
  k.cyl(IRON, 0.035, 0.05, 2.0, P(0, 1.46, 0), undefined, 6)
  k.cyl(IRON, 0.06, 0.06, 0.05, P(0, 0.9, 0), undefined, 6)
  // Crossbar with a scroll under each arm, a lantern hanging at each end.
  k.box(IRON, [0.9, 0.04, 0.04], P(0, 2.42, 0))
  for (const s of [-1, 1]) {
    k.torus(IRON, 0.12, 0.012, P(s * 0.155, 2.3, 0), [0, 0, s > 0 ? Math.PI / 2 : 0], Math.PI / 2, 6, 3)
    // The lantern hangs under the arm's end: roof with its snow, glass in a three-bar frame.
    const x = s * 0.42
    k.cyl(IRON, 0.02, 0.02, 0.03, P(x, 2.39, 0), undefined, 4)
    k.cone(IRON, 0.13, 0.08, P(x, 2.34, 0), undefined, 6)
    k.sphere(SNOW, 0.1, P(x, 2.33, 0), [1, 0.55, 1], 6, 3, Math.PI / 2)
    k.cyl({ c: '#f2ecd9', r: 0.3 }, 0.09, 0.065, 0.23, P(x, 2.185, 0), undefined, 6)
    for (let i = 0; i < 6; i += 2) {
      const a = (i / 6) * Math.PI * 2
      k.rod(IRON, P(x + Math.sin(a) * 0.067, 2.07, Math.cos(a) * 0.067), P(x + Math.sin(a) * 0.092, 2.3, Math.cos(a) * 0.092), 0.008, 3)
    }
    k.cone(IRON, 0.07, 0.05, P(x, 2.045, 0), [Math.PI, 0, 0], 6)
  }
  k.cone(IRON, 0.04, 0.22, P(0, 2.55, 0), undefined, 6)
  // The bench: cast-iron ends, wooden slats, snow on the seat and the top rail.
  const wood: Look = { c: '#6b4a32', r: 0.9 }
  const bx = 1.05
  for (const s of [-1, 1]) {
    const ex = bx + s * 0.5
    k.box(IRON, [0.04, 0.48, 0.04], P(ex, 0.24, 0.12))
    k.box(IRON, [0.04, 0.62, 0.04], P(ex, 0.31, -0.12), [-0.12, 0, 0])
    k.box(IRON, [0.04, 0.04, 0.3], P(ex, 0.3, 0))
    k.box(IRON, [0.04, 0.04, 0.24], P(ex, 0.46, 0.04))
  }
  for (let i = 0; i < 3; i++) k.box(wood, [1.1, 0.03, 0.08], P(bx, 0.33, 0.1 - i * 0.095))
  for (let i = 0; i < 2; i++) k.box(wood, [1.1, 0.08, 0.025], P(bx, 0.46 + i * 0.12, -0.15 - i * 0.015), [-0.12, 0, 0])
  k.box(SNOW, [0.95, 0.03, 0.2], P(bx + 0.05, 0.36, 0.03))
  k.box(SNOW, [1.0, 0.025, 0.04], P(bx, 0.63, -0.167), [-0.12, 0, 0])
  k.ico(SNOW, 0.14, P(bx + 0.25, 0.4, 0.04), [1, 0.4, 0.8], 0)
}

// A snowy fir standing at (x, z), sc times full size: tiers of dark needles, each with snow
// lying on its upper slope.
function fir(k: PropKit, x = 0, z = 0, sc = 1, rot = 0) {
  k.cyl({ c: '#4a3a2e', r: 1 }, 0.07 * sc, 0.09 * sc, 0.5 * sc, [x, 0.25 * sc, z], undefined, 5)
  const tiers = [[0.85, 1.0, 0.95], [0.7, 0.9, 1.55], [0.52, 0.8, 2.1], [0.34, 0.7, 2.6]]
  tiers.forEach(([r, h, y], i) => {
    k.cone({ c: i % 2 ? '#2c5446' : '#264a3e', r: 0.95 }, r * sc, h * sc, [x, y * sc, z], [0, rot + i * 0.4, 0], 8)
    // Snow cap: same slope, lifted clear of the needles.
    k.cone(SNOW, r * 0.6 * sc, h * 0.6 * sc, [x, (y + h * 0.2) * sc + 0.04, z], [0, rot + i * 0.4, 0], 8)
  })
  k.ico(SNOW, 0.09 * sc, [x, 3.0 * sc + 0.03, z], [1, 1.1, 1], 0)
}

// A street kiosk, facing +z: a booth with a glazed front full of papers, a striped awning, an
// ice-cream chest freezer and a newspaper rack outside, an ice-cream cone painted on the sign.
function kiosk(k: PropKit) {
  const body: Look = { c: '#2f6ea8', r: 0.6 }
  const trim: Look = { c: '#e9eef2', r: 0.6 }
  k.box(body, [1.4, 1.5, 0.95], [0, 0.75, 0])
  k.box(DARK, [1.4, 0.06, 0.97], [0, 0.03, 0])
  k.box({ c: '#3b4a57', r: 0.2 }, [1.2, 0.7, 0.03], [0, 0.98, 0.478])
  for (const x of [-0.3, 0, 0.3]) k.box(trim, [0.03, 0.72, 0.035], [x, 0.98, 0.49])
  k.box(trim, [1.26, 0.04, 0.05], [0, 0.6, 0.49])
  // Magazines propped up behind the glass.
  for (let i = 0; i < 8; i++) k.box({ c: ['#e53935', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#f5f5f5'][i % 6], r: 0.7 }, [0.11, 0.17, 0.006], [-0.45 + Math.floor(i / 2) * 0.3 + (i % 2 ? 0.06 : -0.06), i % 2 ? 1.06 : 0.8, 0.4985])
  // The sign band with its painted cone, and a roof with snow.
  k.box(trim, [1.46, 0.3, 1.0], [0, 1.65, 0])
  k.cone({ c: '#d9a35a', r: 0.9 }, 0.07, 0.18, [0, 1.6, 0.505], [Math.PI, 0, 0], 8)
  k.sphere({ c: '#f5c6d6', r: 0.8 }, 0.075, [0, 1.71, 0.505], [1, 1, 0.4], 8, 5)
  for (const s of [-1, 1]) k.box({ c: '#c62828', r: 0.8 }, [0.4, 0.06, 0.015], [s * 0.45, 1.65, 0.507])
  k.box(DARK, [1.56, 0.06, 1.1], [0, 1.83, 0])
  k.box(SNOW, [1.5, 0.08, 1.04], [0, 1.9, 0])
  k.ico(SNOW, 0.2, [0.4, 1.93, 0.1], [1.2, 0.35, 1], 0)
  for (let i = 0; i < 5; i++) k.box({ c: i % 2 ? '#fafafa' : '#c62828', r: 1 }, [0.28, 0.02, 0.4], [-0.56 + i * 0.28, 1.43 + (i % 2) * 0.003, 0.68], [0.35, 0, 0])
  // Chest freezer and a rack of folded newspapers.
  k.box(trim, [0.6, 0.5, 0.4], [-0.4, 0.25, 0.75])
  k.box(body, [0.62, 0.06, 0.42], [-0.4, 0.4, 0.75])
  k.box({ c: '#a7c8e0', r: 0.2 }, [0.52, 0.01, 0.32], [-0.4, 0.505, 0.75])
  k.box(IRON, [0.5, 0.04, 0.3], [0.42, 0.42, 0.72])
  for (const x of [0.22, 0.62]) k.box(IRON, [0.03, 0.42, 0.03], [x, 0.21, 0.72])
  for (let i = 0; i < 3; i++) k.box({ c: i % 2 ? '#e8e4da' : '#d9d4c8', r: 0.9 }, [0.14, 0.06, 0.24], [0.27 + i * 0.15, 0.47, 0.72])
}

// A souvenir stall, facing +z: a little gabled roof with snow, nesting dolls lined up in sets
// on the counter and on a shelf behind, a flowered shawl hanging at the side.
function dollStall(k: PropKit) {
  const wood: Look = { c: '#8a5a34', r: 0.9 }
  for (const x of [-0.75, 0.75]) for (const z of [-0.35, 0.35]) k.box(wood, [0.06, 1.5, 0.06], [x, 0.75, z])
  k.box(wood, [1.54, 0.06, 0.8], [0, 0.72, 0.02])
  k.box({ c: '#b23a2c', r: 0.9 }, [1.54, 0.66, 0.04], [0, 0.36, 0.4])
  for (let i = 0; i < 6; i++) k.cyl({ c: '#e8b84a', r: 0.8 }, 0.05, 0.05, 0.01, [-0.6 + i * 0.24, 0.42, 0.425], [Math.PI / 2, 0, 0], 8)
  k.box(wood, [1.5, 0.04, 0.24], [0, 1.08, -0.25])
  gable(k, { c: '#7a3b2a', r: 0.9 }, 1.9, 1.0, 0.4, [0, 1.5, 0])
  gable(k, SNOW, 1.92, 0.9, 0.44, [0, 1.52, 0])
  k.box(wood, [1.62, 0.08, 0.84], [0, 1.47, 0])
  // Sets of nesting dolls, biggest first.
  const sets: [string, string][] = [['#c62828', '#fdd835'], ['#1565c0', '#f5f5f5'], ['#2e7d32', '#ffca28'], ['#ad1457', '#fff3c4'], ['#ef6c00', '#fafafa']]
  sets.forEach(([body, apron], j) => {
    let x = -0.7 + j * 0.285
    for (let i = 0; i < 4; i++) {
      const r = 0.055 - i * 0.01
      doll(k, x, 0.75, 0.2, r, body, apron)
      x += r * 2
    }
  })
  for (let j = 0; j < 7; j++) doll(k, -0.6 + j * 0.2, 1.1, -0.22, 0.045, sets[j % 5][0], sets[(j + 2) % 5][1])
  // The shawl.
  k.box({ c: '#b71c1c', r: 1 }, [0.02, 0.8, 0.6], [-0.79, 1.02, 0])
  for (const [y, z] of [[1.2, -0.12], [0.95, 0.1], [0.8, -0.15], [1.25, 0.16], [0.75, 0.18]]) {
    k.cyl({ c: '#fdd835', r: 1 }, 0.05, 0.05, 0.01, [-0.802, y, z], [0, 0, Math.PI / 2], 6)
    k.cyl({ c: '#2e7d32', r: 1 }, 0.02, 0.02, 0.012, [-0.806, y, z], [0, 0, Math.PI / 2], 6)
  }
  k.box({ c: '#fdd835', r: 1 }, [0.024, 0.04, 0.6], [-0.795, 0.64, 0])
}

// A nesting doll standing on y: a round painted body, a head in its scarf, a pale face and an
// apron on the front.
function doll(k: PropKit, x: number, y: number, z: number, r: number, body: string, apron: string) {
  k.sphere({ c: body, r: 0.5 }, r, [x, y + r * 1.15, z], [1, 1.15, 1], 7, 5)
  k.sphere({ c: body, r: 0.5 }, r * 0.68, [x, y + r * 2.55, z], [1, 1, 1], 7, 4)
  k.sphere({ c: '#f6dcc4', r: 0.6 }, r * 0.42, [x, y + r * 2.55, z + r * 0.55], [1, 1.05, 0.5], 6, 3)
  k.sphere({ c: apron, r: 0.6 }, r * 0.6, [x, y + r * 1.0, z + r * 0.8], [1, 1.3, 0.5], 6, 3)
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

const KIOSK_Z = 7
const DOLLS_Z = 11.5

export default function Moscow({ len, race }: WorldProps) {
  const blocks = useMemo(() => BLOCKS.map((b, i) => prop(`moscow-block-${i}`, (k) => block(k, b))), [])
  const wallP = useProp('moscow-wall', (k) => wallRun(k, 24))
  const towerP = useProp('moscow-tower', (k) => tower(k, [0, 0, 0], 2.4, 6))
  const clockP = useProp('moscow-clock', (k) => tower(k, [0, 0, 0], 3.4, 9, true))
  const cathedralP = useProp('moscow-cathedral', cathedral)
  const gateP = useProp('moscow-gate', gate)
  const birchP = useProp('moscow-birch', birch)
  const kioskP = useProp('moscow-kiosk', kiosk)
  const dollP = useProp('moscow-dolls', dollStall)
  const gz = race * 0.5
  const cz = race + 12
  const WX = -(EDGE + 2.4)

  const geo = useMemo(() => {
    const r = rand(613)
    const rows: Spot[][] = BLOCKS.map(() => [])
    const lamps: number[] = []
    for (let z = -14; z < len + 40;) {
      let i = Math.floor(r() * BLOCKS.length)
      // No lamp where the kiosk and the doll stall stand.
      if (BLOCKS[i].lamp && z < DOLLS_Z + 2 && z + BLOCKS[i].w > KIOSK_Z - 2) i = (i + 1) % BLOCKS.length
      const b = BLOCKS[i]
      const zc = z + b.w / 2
      if (Math.abs(zc - gz) > 4 + b.w / 2 && Math.abs(zc - cz) > 8 + b.w / 2) {
        rows[i].push({ x: EDGE + 2.2 + b.d / 2, z: zc, ry: -Math.PI / 2 })
        if (b.lamp) lamps.push(zc + LAMP_X(b))
      }
      z += b.w + (r() < 0.4 ? 1.6 : 0.1)
    }
    // The wall in 24-unit lengths with a tower between each; the clock tower opposite the start.
    const walls: Spot[] = []
    const towers: Spot[] = []
    for (let z = -14; z < len + 40; z += 26) {
      if (Math.abs(z + 12 - gz) > 13) walls.push({ x: WX, z: z + 12 })
      if (Math.abs(z - gz) > 5 && Math.abs(z - 30) > 4) towers.push({ x: WX, z })
    }
    // Birches along the right-hand pavement, clear of the lamps' benches, the kiosk and the stall.
    const taken = (z: number) => lamps.some((l) => z > l - 0.7 && z < l + 2) || Math.abs(z - KIOSK_Z) < 1.5 || Math.abs(z - DOLLS_Z) < 1.6
    const birches: Spot[] = []
    for (let z = -10; z < len + 40; z += 2.8 + r() * 2.5) if (Math.abs(z - gz) > 5 && Math.abs(z - cz) > 9 && !taken(z)) birches.push({ x: EDGE + 0.9, z, ry: r() * 6, s: 0.8 + r() * 0.35 })
    for (let z = -10; z < len + 60; z += 3 + r() * 3) birches.push({ x: WX - 3 - r() * 8, z, ry: r() * 6, s: 0.9 + r() * 0.4 })
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
        <group position={[EDGE + 1.1, 0, KIOSK_Z]} rotation-y={-Math.PI / 2}><PropMesh parts={kioskP} /></group>
        <group position={[EDGE + 1.05, 0, DOLLS_Z]} rotation-y={-Math.PI / 2}><PropMesh parts={dollP} /></group>
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
