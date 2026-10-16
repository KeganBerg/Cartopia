import { useMemo } from 'react'
import { CapsuleGeometry, CircleGeometry, PlaneGeometry, SphereGeometry, type BufferGeometry } from 'three'
import { PERSON } from '../peopleGeo'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Scatter, archTop, frustum, gable, glow, person, prop, rand, useProp, type Look, type PropKit, type Spot, type V3 } from './kit'
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
const PAPER: Look = { c: '#fbf8ef', r: 0.7 }
// Flat details laid on a face (window glass, frames, lettering): a rectangle or an upper
// half-disc facing +z, two triangles where a box would be twelve.
const PLANE = new PlaneGeometry(1, 1)
const HALF = new CircleGeometry(1, 8, 0, Math.PI)
function pane(k: PropKit, look: Look, w: number, h: number, p: V3, ry = 0, rz = 0) {
  k.add(look, PLANE, p, [0, ry, rz], [w, h, 1])
}
function half(k: PropKit, look: Look, w: number, p: V3, ry = 0, sy = 1) {
  k.add(look, HALF, p, [0, ry, 0], [w / 2, (w / 2) * sy, 1])
}
// Height of the trolleybus wires over the kerb lanes (under the gate's arch, over the banners).
const WIRE_Y = 3.55

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
function wallRun(k: PropKit, len: number, firs = true) {
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
  if (firs) FIRS.forEach(([z, sc], i) => fir(k, 1.45, z, sc, i * 1.7))
}

// A pastel classical building facing +z: rusticated ground floor, columns and a pediment,
// tall windows, a green roof with snow on it.
const PASTELS = ['#ead27a', '#e9b8a8', '#cfe0d0', '#f0e2c6', '#d9c3e8', '#f2c48a']
// lamp: a street lamp and bench out on the pavement in front (part of the block's own prop, so
// the lamps cost no draws of their own).
// sign: the shop's lettering over its ground-floor windows, on a board of signC.
type Block = { w: number; d: number; floors: number; tint: number; portico: boolean; lamp: boolean; sign: string; signC: string }
const BLOCKS: Block[] = [
  { w: 4.2, d: 3, floors: 4, tint: 0, portico: true, lamp: false, sign: 'ТЕАТР', signC: '#7a1f2b' },
  { w: 3.2, d: 3, floors: 3, tint: 1, portico: false, lamp: true, sign: 'ХЛЕБ', signC: '#2f5d8a' },
  { w: 3.8, d: 3, floors: 4, tint: 2, portico: false, lamp: false, sign: 'АПТЕКА', signC: '#2e7d4f' },
  { w: 4.6, d: 3, floors: 3, tint: 3, portico: true, lamp: false, sign: 'КНИГИ', signC: '#8a2a2a' },
  { w: 3.0, d: 3, floors: 4, tint: 4, portico: false, lamp: true, sign: 'ЦВЕТЫ', signC: '#b0457a' },
  { w: 3.6, d: 3, floors: 3, tint: 5, portico: false, lamp: false, sign: 'МОЛОКО', signC: '#1f5f8f' },
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
      // The shop door in the second bay: panelled double doors under a fanlight, a step.
      if (i === Math.min(1, n - 1)) {
        k.box({ c: '#5a3626', r: 0.8 }, [0.5, 0.82, 0.04], [x, 0.41, f + 0.035])
        k.box({ c: '#3a4652', r: 0.3, m: 0.2 }, [0.4, 0.14, 0.02], [x, 0.9, f + 0.05])
        for (const s of [-1, 1]) k.box({ c: '#6e4632', r: 0.8 }, [0.17, 0.5, 0.012], [x + s * 0.11, 0.4, f + 0.06])
        k.box({ c: '#e8c45a', r: 0.5 }, [0.02, 0.1, 0.02], [x + 0.03, 0.45, f + 0.07])
        k.box(STONE, [0.62, 0.06, 0.24], [x, 0.03, f + 0.12])
        continue
      }
      pane(k, { c: '#3a4652', r: 0.3, m: 0.2 }, 0.5, 0.75, [x, 0.6, f + 0.035])
      // Goods on a shelf behind the glass.
      for (let j = 0; j < 3; j++) pane(k, { c: ['#e6b04a', '#c94a3a', '#f1ece0', '#6aa05a'][(i + j + b.tint) % 4], r: 0.8 }, 0.11, 0.12, [x - 0.14 + j * 0.14, 0.44, f + 0.04])
      continue
    }
    const y = 1.3 + (fl - 1) * 1.2 + 0.55
    pane(k, STONE, 0.46, 0.78, [x, y, f + 0.004])
    pane(k, { c: '#33404d', r: 0.25, m: 0.2 }, 0.34, 0.66, [x, y, f + 0.008])
    pane(k, STONE, 0.03, 0.66, [x, y, f + 0.012])
    pane(k, STONE, 0.34, 0.03, [x, y + 0.12, f + 0.012])
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
  // The shop's sign board over the ground floor, its name in white letters.
  const sw = Math.min(b.w - 0.5, b.sign.length * 0.17 + 0.5)
  k.box({ c: b.signC, r: 0.7 }, [sw, 0.24, 0.04], [0, 1.1, f + 0.065])
  k.box(STONE, [sw + 0.06, 0.03, 0.05], [0, 1.235, f + 0.065])
  word(k, PAPER, b.sign, 0, 1.1, f + 0.09, 0.15)
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

// Shop and street lettering in Cyrillic, drawn as strokes (each letter a few thin boxes on a
// 0.6 wide, 1 tall grid), facing +z, centred on (cx, cy) in the plane z, h tall. ry turns the
// line of text to face another way.
type Seg = [number, number, number, number]
const GLYPHS: Record<string, Seg[]> = {
  А: [[0, 0, 0.3, 1], [0.3, 1, 0.6, 0], [0.13, 0.38, 0.47, 0.38]],
  Б: [[0, 0, 0, 1], [0, 1, 0.58, 1], [0, 0.55, 0.6, 0.55], [0.6, 0.55, 0.6, 0], [0, 0, 0.6, 0]],
  В: [[0, 0, 0, 1], [0, 1, 0.5, 1], [0.5, 1, 0.5, 0.55], [0, 0.55, 0.6, 0.55], [0.6, 0.55, 0.6, 0], [0, 0, 0.6, 0]],
  Г: [[0, 0, 0, 1], [0, 1, 0.6, 1]],
  Д: [[0.12, 0.12, 0.2, 1], [0.2, 1, 0.52, 1], [0.52, 1, 0.52, 0.12], [0, 0.12, 0.64, 0.12], [0, 0.12, 0, -0.12], [0.64, 0.12, 0.64, -0.12]],
  Е: [[0, 0, 0, 1], [0, 1, 0.6, 1], [0, 0.5, 0.45, 0.5], [0, 0, 0.6, 0]],
  З: [[0, 1, 0.6, 1], [0.6, 1, 0.6, 0], [0, 0, 0.6, 0], [0.15, 0.52, 0.6, 0.52]],
  И: [[0, 0, 0, 1], [0.6, 0, 0.6, 1], [0, 0, 0.6, 1]],
  К: [[0, 0, 0, 1], [0, 0.5, 0.6, 1], [0.1, 0.55, 0.6, 0]],
  Л: [[0, 0, 0.2, 1], [0.2, 1, 0.6, 1], [0.6, 1, 0.6, 0]],
  М: [[0, 0, 0, 1], [0, 1, 0.33, 0.45], [0.33, 0.45, 0.66, 1], [0.66, 1, 0.66, 0]],
  Н: [[0, 0, 0, 1], [0.6, 0, 0.6, 1], [0, 0.5, 0.6, 0.5]],
  О: [[0, 0, 0, 1], [0.6, 0, 0.6, 1], [0, 1, 0.6, 1], [0, 0, 0.6, 0]],
  П: [[0, 0, 0, 1], [0.6, 0, 0.6, 1], [0, 1, 0.6, 1]],
  Р: [[0, 0, 0, 1], [0, 1, 0.6, 1], [0.6, 1, 0.6, 0.48], [0, 0.48, 0.6, 0.48]],
  С: [[0, 0, 0, 1], [0, 1, 0.6, 1], [0, 0, 0.6, 0]],
  Т: [[0.3, 0, 0.3, 1], [0, 1, 0.6, 1]],
  У: [[0, 1, 0.32, 0.42], [0.62, 1, 0.12, 0]],
  Ф: [[0.33, 0, 0.33, 1], [0, 0.3, 0, 0.8], [0.66, 0.3, 0.66, 0.8], [0, 0.8, 0.66, 0.8], [0, 0.3, 0.66, 0.3]],
  Х: [[0, 0, 0.6, 1], [0, 1, 0.6, 0]],
  Ц: [[0, 0.1, 0, 1], [0.52, 0.1, 0.52, 1], [0, 0.1, 0.64, 0.1], [0.64, 0.1, 0.64, -0.14]],
  Ч: [[0, 1, 0, 0.5], [0, 0.5, 0.6, 0.5], [0.6, 0, 0.6, 1]],
  Ш: [[0, 0, 0, 1], [0.33, 0, 0.33, 1], [0.66, 0, 0.66, 1], [0, 0, 0.66, 0]],
  Ы: [[0, 0, 0, 1], [0, 0.5, 0.36, 0.5], [0.36, 0.5, 0.36, 0], [0, 0, 0.36, 0], [0.62, 0, 0.62, 1]],
  Я: [[0.6, 0, 0.6, 1], [0.6, 1, 0, 1], [0, 1, 0, 0.5], [0, 0.5, 0.6, 0.5], [0.3, 0.5, 0, 0]],
  '1': [[0.3, 0, 0.3, 1], [0.3, 1, 0.08, 0.78]],
  '5': [[0.6, 1, 0, 1], [0, 1, 0, 0.55], [0, 0.55, 0.6, 0.55], [0.6, 0.55, 0.6, 0], [0.6, 0, 0, 0]],
}
function word(k: PropKit, look: Look, text: string, cx: number, cy: number, z: number, h: number, ry = 0) {
  const t = h * 0.15
  const adv = (ch: string) => (ch === ' ' ? 0.5 : 0.86) * h
  const total = [...text].reduce((n, ch) => n + adv(ch), 0) - 0.26 * h
  const cs = Math.cos(ry)
  const sn = Math.sin(ry)
  let x0 = -total / 2
  for (const ch of text) {
    for (const [a, b, c, d] of GLYPHS[ch] ?? []) {
      const mx = x0 + ((a + c) / 2) * h
      const my = cy + ((b + d) / 2 - 0.5) * h
      const l = Math.hypot(c - a, d - b) * h + t
      pane(k, look, l, t, [cx + mx * cs, my, z - mx * sn], ry, Math.atan2(d - b, c - a))
    }
    x0 += adv(ch)
  }
}

// ---- People ---------------------------------------------------------------------------------
// Muscovites at the townspeople's own size and build (peopleGeo: PERSON scale, torso, head with
// a face, legs with boots), dressed for winter: long coats, fur hats with ear flaps, headscarves,
// knitted hats with bobbles, scarves and mittens. Built into props in small groups, so a street
// full of them is a few instanced draws.
const caps = new Map<string, BufferGeometry>()
const capsule = (r: number, l: number) => {
  const key = `${r}|${l}`
  let g = caps.get(key)
  if (!g) caps.set(key, (g = new CapsuleGeometry(r, l, 2, 8)))
  return g
}
const DOME = new SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2)
type Hat = 'ushanka' | 'scarf' | 'beanie' | 'papakha' | 'bare'
type Folk = { coat: string; legs: string; skin: string; hat: Hat; hatC: string; scarf: string; long: boolean }
function figure(k: PropKit, x: number, z: number, ry: number, f: Folk) {
  // The kit's true-size person, dressed for a Moscow winter: a long coat to the ankles (or a
  // short jacket over trousers), a fur hat, headscarf or knitted hat, then the extras.
  const fur = f.hat === 'ushanka' || f.hat === 'papakha'
  person(k, { top: f.coat, low: f.long ? f.coat : f.legs, skin: f.skin, hair: f.hat === 'bare' ? f.hatC : '#4a3426', robe: f.long, hat: fur ? 'fur' : f.hat === 'scarf' ? 'scarf' : undefined, hatC: f.hatC }, x, z, ry)
  const S = PERSON.scale
  const cs = Math.cos(ry)
  const sn = Math.sin(ry)
  const P = (lx: number, ly: number, lz: number): V3 => [x + (lx * cs + lz * sn) * S, ly * S, z + (-lx * sn + lz * cs) * S]
  const hat: Look = { c: f.hatC, r: 1 }
  const scarf: Look = { c: f.scarf, r: 1 }
  // Coat buttons down the front, a scarf wound round the neck with its end hanging.
  k.box({ c: '#1d1b1a', r: 0.6 }, [0.014 * S, 0.17 * S, 0.01 * S], P(0, 0.39, 0.086), [0, ry, 0])
  k.cyl(scarf, 0.062 * S, 0.074 * S, 0.045 * S, P(0, 0.525, 0), [0, ry, 0], 7)
  k.box(scarf, [0.04 * S, 0.11 * S, 0.016 * S], P(0.035, 0.45, 0.088), [0, ry, 0])
  if (f.hat === 'ushanka') {
    // Ear flaps down over the ears, the front flap turned up.
    k.box(hat, [0.17 * S, 0.05 * S, 0.03 * S], P(0, 0.655, 0.097), [-0.25, ry, 0])
    for (const sd of [-1, 1]) k.box(hat, [0.026 * S, 0.1 * S, 0.075 * S], P(sd * 0.094, 0.6, -0.008), [0, ry, 0])
  } else if (f.hat === 'beanie') {
    k.add(hat, DOME, P(0, 0.612, 0), [0, ry, 0], [0.088 * S, 0.095 * S, 0.088 * S])
    k.cyl(scarf, 0.09 * S, 0.09 * S, 0.03 * S, P(0, 0.62, 0), [0, ry, 0], 8)
    k.sphere(scarf, 0.026 * S, P(0, 0.71, 0), [1, 1, 1], 5, 3)
  }
}

const COATS = ['#2e3440', '#5a3b2e', '#7a2430', '#2f4a6b', '#5d6236', '#4a2f4f', '#8a6a4a', '#1f2a33', '#a33a3a', '#cfc4b0', '#3e5a52', '#6b4a6e']
const LEGS = ['#2b2b30', '#3a3a44', '#1f2430', '#4a4038']
const FURS = ['#5b4030', '#3a2e28', '#8a8178', '#2b2b2b', '#a07a55', '#6b5444']
const SCARVES = ['#c62828', '#f9a825', '#1565c0', '#2e7d32', '#ad1457', '#fafafa', '#ef6c00', '#6a1b9a']
const SKINS = ['#f1c9a5', '#e8b996', '#d9a582', '#f6d7bf']
function folkOf(r: () => number): Folk {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const woman = r() < 0.5
  const hat: Hat = woman ? (r() < 0.55 ? 'scarf' : r() < 0.5 ? 'ushanka' : 'beanie') : r() < 0.6 ? 'ushanka' : r() < 0.5 ? 'papakha' : r() < 0.6 ? 'beanie' : 'bare'
  const scarfHat = hat === 'scarf'
  return {
    coat: pick(COATS),
    legs: pick(LEGS),
    skin: pick(SKINS),
    hat,
    hatC: scarfHat ? pick(['#b71c1c', '#c2185b', '#1e3a8a', '#e8d9b5', '#2e7d32']) : hat === 'beanie' ? pick(SCARVES) : hat === 'bare' ? pick(['#3a2a20', '#6b4a2e', '#8a8a8a']) : pick(FURS),
    scarf: pick(SCARVES),
    long: woman || r() < 0.5,
  }
}
// A group of n people spread along local x, facing +z (the road, once placed), a few chatting
// to each other and some walking along the pavement.
function crowd(k: PropKit, seed: number, n: number, spread: number) {
  const r = rand(seed * 977 + 13)
  for (let i = 0; i < n; i++) {
    const x = -spread / 2 + (spread / Math.max(1, n - 1)) * i + (r() - 0.5) * 0.12
    const z = (r() - 0.5) * 0.24
    // Most face the street; some turn to talk, some are on their way along the pavement.
    const ry = r() < 0.3 ? (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (r() - 0.5) * 1.6
    figure(k, x, z, ry, folkOf(r))
  }
}

// ---- Street furniture and vehicles -----------------------------------------------------------
// A boxy old saloon facing +z, centred at oz along it, snow on its roof and bonnet.
function sedan(k: PropKit, col: string, oz = 0) {
  const body: Look = { c: col, r: 0.45 }
  const chrome: Look = { c: '#c9ccd0', r: 0.35 }
  const glass: Look = { c: '#2b3540', r: 0.2 }
  const tyre: Look = { c: '#1b1b1b', r: 0.9 }
  const P = (x: number, y: number, z: number): V3 => [x, y, z + oz]
  k.box(body, [1.0, 0.36, 2.25], P(0, 0.42, 0))
  k.box(body, [0.9, 0.34, 1.15], P(0, 0.77, -0.12))
  for (const sd of [-1, 1]) {
    const ry = sd * Math.PI / 2
    pane(k, glass, 1.02, 0.24, P(sd * 0.454, 0.78, -0.12), ry)
    pane(k, body, 0.07, 0.24, P(sd * 0.457, 0.78, -0.1), ry)
    pane(k, chrome, 2.0, 0.025, P(sd * 0.503, 0.47, 0), ry)
    pane(k, chrome, 0.1, 0.022, P(sd * 0.503, 0.54, 0.12), ry)
    pane(k, chrome, 0.1, 0.022, P(sd * 0.503, 0.54, -0.5), ry)
    k.box(DARK, [0.06, 0.05, 0.03], P(sd * 0.48, 0.66, 0.5))
    // Doors: a panel line round each.
    pane(k, { c: '#1d1d1d', r: 1 }, 0.012, 0.34, P(sd * 0.503, 0.6, -0.12), ry)
    pane(k, { c: '#1d1d1d', r: 1 }, 0.012, 0.34, P(sd * 0.503, 0.6, 0.47), ry)
    for (const z of [-0.72, 0.72]) {
      k.cyl(tyre, 0.19, 0.19, 0.16, P(sd * 0.45, 0.19, z), [0, 0, Math.PI / 2], 8)
      k.cyl(chrome, 0.09, 0.09, 0.02, P(sd * 0.535, 0.19, z), [0, 0, Math.PI / 2], 6)
    }
  }
  pane(k, glass, 0.8, 0.26, P(0, 0.78, 0.458))
  pane(k, glass, 0.8, 0.24, P(0, 0.78, -0.699), Math.PI)
  for (const z of [-1, 1]) k.box(chrome, [1.04, 0.08, 0.09], P(0, 0.29, z * 1.14))
  pane(k, DARK, 0.56, 0.13, P(0, 0.47, 1.128))
  for (let i = 0; i < 4; i++) pane(k, chrome, 0.56, 0.012, P(0, 0.42 + i * 0.033, 1.131))
  for (const sd of [-1, 1]) {
    k.cyl({ c: '#f3f0dc', r: 0.3 }, 0.065, 0.065, 0.03, P(sd * 0.36, 0.47, 1.13), [Math.PI / 2, 0, 0], 8)
    k.cyl(chrome, 0.08, 0.08, 0.02, P(sd * 0.36, 0.47, 1.122), [Math.PI / 2, 0, 0], 8)
    pane(k, { c: '#c62828', r: 0.4 }, 0.2, 0.1, P(sd * 0.33, 0.5, -1.128), Math.PI)
    pane(k, { c: '#f2a33a', r: 0.4 }, 0.06, 0.1, P(sd * 0.2, 0.5, -1.131), Math.PI)
  }
  for (const z of [-1, 1]) {
    pane(k, PAPER, 0.3, 0.07, P(0, 0.31, z * 1.19), z > 0 ? 0 : Math.PI)
    for (let i = 0; i < 5; i++) pane(k, DARK, 0.02, 0.045, P(-0.1 + i * 0.05, 0.31, z * 1.193), z > 0 ? 0 : Math.PI)
  }
  k.box(SNOW, [0.84, 0.06, 1.05], P(0, 0.97, -0.12))
  k.box(SNOW, [0.88, 0.035, 0.55], P(0, 0.615, 0.78))
  k.box(SNOW, [0.88, 0.035, 0.32], P(0, 0.615, -0.95))
  k.ico(SNOW, 0.18, P(0.15, 1.0, -0.3), [1.4, 0.35, 1.6], 0)
}

// A trolleybus at its stop, facing +z: cream with a red band, its two poles reaching up to the
// wires above the kerb lane (which run 1.25 and 1.55 to its +x side, at WIRE_Y).
function trolleybus(k: PropKit) {
  const cream: Look = { c: '#f0e7c9', r: 0.5 }
  const red: Look = { c: '#c0392b', r: 0.5 }
  const glass: Look = { c: '#2c3a47', r: 0.2 }
  const tyre: Look = { c: '#1b1b1b', r: 0.9 }
  k.box(cream, [1.1, 0.55, 5.4], [0, 0.52, 0])
  k.box(cream, [1.1, 0.72, 5.4], [0, 1.14, 0])
  k.box(red, [1.114, 0.13, 5.414], [0, 0.78, 0])
  k.box({ c: '#7a7f86', r: 0.6 }, [1.112, 0.08, 5.412], [0, 0.27, 0])
  k.box(cream, [1.0, 0.06, 5.3], [0, 1.53, 0])
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = -2.2 + i * 0.88
      // Doors on the kerb side (-x) instead of windows.
      if (sd < 0 && (i === 1 || i === 4)) {
        k.box(glass, [0.012, 1.0, 0.6], [sd * 0.556, 0.82, z])
        k.box(cream, [0.014, 1.0, 0.03], [sd * 0.558, 0.82, z])
        continue
      }
      k.box(glass, [0.012, 0.42, 0.74], [sd * 0.556, 1.13, z])
    }
  }
  // Front: windscreen, destination board, headlights, a number.
  k.box(glass, [0.98, 0.56, 0.012], [0, 1.06, 2.706])
  k.box(DARK, [0.8, 0.14, 0.012], [0, 1.44, 2.708])
  word(k, { c: '#ffd54f', r: 0.6 }, 'ЦЕНТР', 0, 1.44, 2.718, 0.08)
  for (const sd of [-1, 1]) k.cyl({ c: '#f3f0dc', r: 0.3 }, 0.07, 0.07, 0.02, [sd * 0.38, 0.5, 2.71], [Math.PI / 2, 0, 0], 10)
  k.box(red, [0.4, 0.2, 0.01], [0, 0.5, 2.708])
  word(k, PAPER, '15', 0, 0.5, 2.716, 0.12)
  k.box(glass, [0.9, 0.4, 0.012], [0, 1.15, -2.706])
  for (const sd of [-1, 1]) k.box({ c: '#c62828', r: 0.4 }, [0.14, 0.12, 0.02], [sd * 0.42, 0.5, -2.708])
  for (const sd of [-1, 1]) for (const z of [-1.7, 1.8]) k.cyl(tyre, 0.26, 0.26, 0.16, [sd * 0.5, 0.26, z], [0, 0, Math.PI / 2], 10)
  // Roof gear, snow on the front of the roof, the poles and their shoes on the wires.
  k.box({ c: '#8a9096', r: 0.6 }, [0.8, 0.14, 1.8], [0, 1.63, -1.1])
  k.box(SNOW, [0.96, 0.04, 2.2], [0, 1.58, 1.4])
  for (const [bx, wx] of [[0.15, 1.25], [0.35, 1.55]]) {
    k.rod(DARK, [bx, 1.72, -1.8], [wx, WIRE_Y - 0.02, 1.4], 0.025, 5)
    k.box(DARK, [0.05, 0.05, 0.16], [wx, WIRE_Y - 0.02, 1.42])
  }
}

// A trolleybus stop shelter facing +z: glass back and sides, a roof with snow, a bench, a
// timetable, and the stop's sign on its own post: a white plate with a blue letter T.
function shelter(k: PropKit) {
  const frame: Look = { c: '#4b5a66', r: 0.5 }
  const pane: Look = { c: '#b9d3e0', r: 0.15 }
  for (const x of [-1, 1]) for (const z of [-0.35, 0.35]) k.box(frame, [0.05, 1.3, 0.05], [x, 0.65, z])
  k.box(pane, [2.0, 1.0, 0.02], [0, 0.75, -0.36])
  for (const x of [-1, 1]) k.box(pane, [0.02, 1.0, 0.68], [x, 0.75, 0])
  k.box(frame, [2.2, 0.08, 0.9], [0, 1.34, 0])
  k.box(SNOW, [2.1, 0.06, 0.82], [0, 1.41, 0])
  k.box({ c: '#7b5a3a', r: 0.9 }, [1.6, 0.04, 0.26], [0, 0.34, -0.2])
  for (const x of [-0.7, 0.7]) k.box(frame, [0.04, 0.32, 0.2], [x, 0.17, -0.2])
  k.box(PAPER, [0.4, 0.5, 0.012], [0.6, 0.85, -0.34])
  for (let i = 0; i < 5; i++) k.box(DARK, [0.3, 0.02, 0.004], [0.6, 1.02 - i * 0.07, -0.333])
  k.box({ c: '#1f5f8f', r: 0.6 }, [1.6, 0.18, 0.02], [0, 1.2, -0.34])
  word(k, PAPER, 'ОСТАНОВКА', 0, 1.2, -0.326, 0.1)
  k.cyl(IRON, 0.035, 0.035, 2.0, [1.35, 1.0, 0.3], undefined, 6)
  k.box(PAPER, [0.36, 0.36, 0.03], [1.35, 1.95, 0.3])
  word(k, { c: '#1f5f8f', r: 0.6 }, 'Т', 1.35, 1.95, 0.32, 0.24)
  word(k, { c: '#1f5f8f', r: 0.6 }, 'Т', 1.35, 1.95, 0.28, 0.24, Math.PI)
}

// A trolley-wire pole on the -x kerb (its own origin), its arm reaching out over the kerb lane
// with the two wires hanging under it, each 16 long, so poles 9 to 15 apart join up.
function trolleyPole(k: PropKit) {
  const pole: Look = { c: '#3f4b52', r: 0.6 }
  k.cyl(pole, 0.05, 0.075, WIRE_Y + 0.35, [0, (WIRE_Y + 0.35) / 2, 0], undefined, 6)
  k.cyl(pole, 0.1, 0.12, 0.25, [0, 0.125, 0], undefined, 6)
  k.cyl(SNOW, 0.09, 0.09, 0.03, [0, 0.265, 0], undefined, 6)
  k.box(pole, [1.35, 0.05, 0.05], [0.62, WIRE_Y + 0.15, 0])
  k.rod(pole, [0, WIRE_Y - 0.3, 0], [0.6, WIRE_Y + 0.13, 0], 0.02, 4)
  for (const x of [0.8, 1.1]) {
    k.box(DARK, [0.02, 0.15, 0.02], [x, WIRE_Y + 0.06, 0])
    k.box(DARK, [0.012, 0.012, 16], [x, WIRE_Y, 0])
  }
  k.cone(pole, 0.06, 0.12, [0, WIRE_Y + 0.41, 0], undefined, 6)
}

// A courtyard gateway in a gap between two buildings, facing +z: brick posts with snow caps,
// a wrought-iron gate with a scrolled top, and a little fir in the yard behind.
function yardGate(k: PropKit) {
  for (const s of [-1, 1]) {
    k.box(BRICK, [0.22, 1.4, 0.22], [s * 0.66, 0.7, 0])
    k.box(STONE, [0.28, 0.06, 0.28], [s * 0.66, 1.43, 0])
    k.box(SNOW, [0.26, 0.06, 0.26], [s * 0.66, 1.49, 0])
  }
  for (let i = 0; i < 11; i++) k.box(IRON, [0.02, 1.0, 0.02], [-0.5 + i * 0.1, 0.62, 0])
  for (const y of [0.15, 1.1]) k.box(IRON, [1.1, 0.03, 0.025], [0, y, 0])
  k.torus(IRON, 0.5, 0.014, [0, 1.1, 0], undefined, Math.PI, 12, 3)
  k.torus(IRON, 0.25, 0.012, [0, 1.1, 0], undefined, Math.PI, 10, 3)
  k.box(SNOW, [1.1, 0.03, 0.06], [0, 1.13, 0])
  fir(k, 0, -1.4, 0.75, 0.5)
  k.ico(SNOW, 0.35, [0.4, 0.05, -0.6], [1.4, 0.4, 1], 0)
}

// ---- Buildings --------------------------------------------------------------------------------
// A postwar apartment house facing +z, the grand kind: a granite ground floor with a shop,
// cream walls, balconies with balustrades, pilasters, a heavy cornice with icicles and either a
// little spired tower or a balustraded attic with obelisks on the roof.
type Stal = { w: number; d: number; floors: number; wall: string; trim: string; sign: string; signC: string; spire: boolean }
const STALS: Stal[] = [
  { w: 5.2, d: 4, floors: 6, wall: '#e7dcc3', trim: '#f6f0e2', sign: 'ПРОДУКТЫ', signC: '#8a1f1f', spire: true },
  { w: 4.6, d: 4, floors: 6, wall: '#e5c98a', trim: '#f4ead2', sign: 'КАФЕ СНЕГ', signC: '#1d4e6e', spire: false },
]
function stalinka(k: PropKit, b: Stal) {
  const W: Look = { c: b.wall, r: 0.9 }
  const T: Look = { c: b.trim, r: 0.85 }
  const G: Look = { c: '#7d5548', r: 0.8 }
  const glass: Look = { c: '#34414e', r: 0.25, m: 0.2 }
  const f = b.d / 2
  const H = 1.4 + b.floors * 1.15
  k.box(W, [b.w, H, b.d], [0, H / 2, 0])
  k.box(G, [b.w + 0.08, 1.4, b.d + 0.08], [0, 0.7, 0])
  for (let i = 1; i < 4; i++) k.box({ c: '#5e3f35', r: 0.9 }, [b.w + 0.1, 0.03, b.d + 0.1], [0, i * 0.35, 0])
  k.box(T, [b.w + 0.16, 0.12, b.d + 0.16], [0, 1.46, 0])
  const n = Math.max(4, Math.round(b.w / 0.85))
  const cw = b.w / n
  // The shop: big display windows, a door with a canopy, the sign along the top.
  for (let i = 0; i < n; i++) {
    const x = -b.w / 2 + cw * (i + 0.5)
    if (i === Math.floor(n / 2)) {
      k.box({ c: '#4a2e22', r: 0.8 }, [cw * 0.6, 0.95, 0.04], [x, 0.48, f + 0.045])
      k.box(glass, [cw * 0.4, 0.5, 0.02], [x, 0.55, f + 0.07])
      k.box(G, [cw * 0.9, 0.06, 0.4], [x, 1.08, f + 0.22])
      k.box(SNOW, [cw * 0.86, 0.04, 0.38], [x, 1.13, f + 0.22])
      continue
    }
    pane(k, glass, cw * 0.78, 0.82, [x, 0.58, f + 0.044])
    k.box(T, [cw * 0.78, 0.04, 0.05], [x, 0.17, f + 0.05])
    for (let j = 0; j < 3; j++) pane(k, { c: ['#e6b04a', '#c94a3a', '#f1ece0', '#6aa05a', '#4a7ab0'][(i * 2 + j) % 5], r: 0.8 }, 0.12, 0.16, [x - 0.16 + j * 0.16, 0.36, f + 0.048])
  }
  k.box({ c: b.signC, r: 0.7 }, [Math.min(b.w - 0.4, b.sign.length * 0.2 + 0.6), 0.28, 0.04], [0, 1.2, f + 0.07])
  word(k, PAPER, b.sign, 0, 1.2, f + 0.095, 0.17)
  // Upper floors.
  for (let fl = 0; fl < b.floors; fl++) {
    const y = 1.52 + fl * 1.15 + 0.5
    for (let i = 0; i < n; i++) {
      const x = -b.w / 2 + cw * (i + 0.5)
      pane(k, T, cw * 0.56, 0.78, [x, y, f + 0.004])
      pane(k, glass, cw * 0.42, 0.64, [x, y, f + 0.008])
      pane(k, T, 0.025, 0.64, [x, y, f + 0.012])
      pane(k, T, cw * 0.42, 0.025, [x, y + 0.12, f + 0.012])
      k.box(SNOW, [cw * 0.6, 0.05, 0.1], [x, y - 0.42, f + 0.05])
      if (fl === 0 || fl === b.floors - 1) {
        k.box(T, [cw * 0.66, 0.07, 0.12], [x, y + 0.45, f + 0.05])
        gable(k, T, cw * 0.7, 0.1, 0.14, [x, y + 0.485, f + 0.05])
        gable(k, SNOW, cw * 0.7, 0.08, 0.15, [x, y + 0.495, f + 0.045])
      }
    }
    // Balconies on the central bays: a slab, turned balusters, a rail with snow along it.
    if (fl === 1 || fl === 4) {
      const bw = cw * 2
      k.box(T, [bw, 0.08, 0.45], [0, y - 0.46, f + 0.225])
      for (let j = 0; j <= 10; j++) k.cyl(T, 0.022, 0.03, 0.3, [-bw / 2 + 0.05 + (j * (bw - 0.1)) / 10, y - 0.27, f + 0.42], undefined, 5)
      for (const s of [-1, 1]) k.box(T, [0.05, 0.3, 0.42], [s * (bw / 2 - 0.03), y - 0.27, f + 0.22])
      k.box(T, [bw, 0.05, 0.08], [0, y - 0.1, f + 0.42])
      k.box(SNOW, [bw - 0.04, 0.04, 0.08], [0, y - 0.055, f + 0.42])
      k.box(SNOW, [bw - 0.1, 0.04, 0.3], [0, y - 0.4, f + 0.2])
    }
  }
  // Pilasters framing the facade and its centre.
  for (const x of [-b.w / 2 + 0.07, b.w / 2 - 0.07, -cw, cw]) k.box(T, [0.14, H - 1.55, 0.06], [x, 1.52 + (H - 1.55) / 2, f + 0.03])
  // Cornice, a row of brackets under it, icicles, the attic.
  k.box(T, [b.w + 0.34, 0.24, b.d + 0.34], [0, H + 0.04, 0])
  for (let i = 0, m = Math.round(b.w / 0.25); i < m; i++) {
    const x = -b.w / 2 + (b.w / m) * (i + 0.5)
    if (i % 2 === 0) k.box(T, [0.07, 0.1, 0.12], [x, H - 0.13, f + 0.06])
    const l = 0.07 + ((i * 7) % 5) * 0.04
    k.cone(ICE, 0.02, l, [x, H - 0.08 - l / 2, f + 0.15], [Math.PI, 0, 0], 5)
  }
  k.box(SNOW, [b.w + 0.24, 0.06, b.d + 0.24], [0, H + 0.19, 0])
  k.box(W, [b.w, 0.5, 0.14], [0, H + 0.41, f - 0.05])
  for (let i = 0, m = Math.round(b.w / 0.26); i < m; i++) k.cyl(T, 0.028, 0.038, 0.36, [-b.w / 2 + 0.13 + i * 0.26, H + 0.4, f + 0.06], undefined, 4)
  k.box(T, [b.w + 0.04, 0.06, 0.2], [0, H + 0.6, f + 0.02])
  k.box(SNOW, [b.w, 0.05, 0.18], [0, H + 0.655, f + 0.02])
  frustum(k, { c: '#5d6b74', r: 0.7 }, b.w, b.d - 0.3, 1.0, 0.45, [0, H + 0.16, -0.1])
  frustum(k, SNOW, b.w * 0.8, b.d * 0.7, 0.16, 0.6, [0, H + 0.92, -0.1])
  if (b.spire) {
    // A small tower over the centre: a square stage, a columned octagon, a spire and a star.
    k.box(W, [1.4, 1.6, 1.4], [0, H + 1.0, 0.2])
    k.box(T, [1.5, 0.1, 1.5], [0, H + 1.85, 0.2])
    for (const s of [-1, 1]) pane(k, glass, 0.3, 0.8, [s * 0.35, H + 1.05, 0.904])
    k.cyl(W, 0.5, 0.55, 1.1, [0, H + 2.45, 0.2], undefined, 8)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      k.cyl(T, 0.04, 0.04, 1.1, [Math.sin(a) * 0.56, H + 2.45, 0.2 + Math.cos(a) * 0.56], undefined, 5)
    }
    k.cyl(T, 0.62, 0.62, 0.1, [0, H + 3.05, 0.2], undefined, 8)
    k.cone(W, 0.42, 2.2, [0, H + 4.2, 0.2], undefined, 8)
    k.cyl(GILT, 0.03, 0.04, 0.6, [0, H + 5.55, 0.2], undefined, 5)
    k.box({ c: '#d32f2f', r: 0.5 }, [0.06, 0.32, 0.06], [0, H + 5.95, 0.2])
    k.box({ c: '#d32f2f', r: 0.5 }, [0.3, 0.07, 0.06], [0, H + 5.98, 0.2])
  } else {
    for (const s of [-1, 1]) for (const x of [0.45, b.w / 2 - 0.2]) {
      k.box(T, [0.2, 0.2, 0.2], [s * x, H + 0.75, f])
      k.cone(T, 0.1, 0.7, [s * x, H + 1.2, f], undefined, 4)
      k.sphere(GILT, 0.06, [s * x, H + 1.58, f], [1, 1, 1], 6, 4)
    }
    // A crest over the centre: a wreath round a star.
    k.box(T, [1.4, 0.7, 0.16], [0, H + 0.95, f - 0.02])
    k.torus({ c: '#e2c25a', r: 0.5 }, 0.22, 0.04, [0, H + 0.95, f + 0.07], undefined, Math.PI * 2, 12, 4)
    k.box({ c: '#c62828', r: 0.5 }, [0.08, 0.2, 0.02], [0, H + 0.95, f + 0.07])
    k.box({ c: '#c62828', r: 0.5 }, [0.2, 0.08, 0.02], [0, H + 0.95, f + 0.07])
  }
}

// The second row behind the street: taller apartment houses with windows on the faces you can
// see from the road, roofs with snow, a few with corner turrets; and now and then a parish church
// with blue domes spangled with gold stars.
type Back = { w: number; d: number; floors: number; wall: string; turrets: boolean; church?: boolean }
const BACKS: Back[] = [
  { w: 7, d: 5, floors: 8, wall: '#e3d5bd', turrets: true },
  { w: 6, d: 5, floors: 6, wall: '#d8b4a0', turrets: false },
  { w: 5.5, d: 5, floors: 7, wall: '#c9d3c0', turrets: false },
  { w: 6, d: 5, floors: 0, wall: '#f2eee6', turrets: false, church: true },
  { w: 6.5, d: 5, floors: 9, wall: '#e8d89e', turrets: true },
]
function backBlock(k: PropKit, b: Back) {
  if (b.church) return church(k)
  const W: Look = { c: b.wall, r: 0.9 }
  const T: Look = { c: '#f4efe4', r: 0.85 }
  const glass: Look = { c: '#3a4652', r: 0.4 }
  const H = 1.2 + b.floors * 1.15
  const f = b.d / 2
  k.box(W, [b.w, H, b.d], [0, H / 2, 0])
  k.box({ c: '#8c7a6a', r: 0.9 }, [b.w + 0.06, 1.2, b.d + 0.06], [0, 0.6, 0])
  const n = Math.round(b.w / 0.8)
  const m = Math.round(b.d / 0.9)
  for (let fl = 0; fl < b.floors; fl++) {
    const y = 1.2 + fl * 1.15 + 0.55
    for (let i = 0; i < n; i++) pane(k, glass, 0.36, 0.62, [-b.w / 2 + (b.w / n) * (i + 0.5), y, f + 0.004])
    k.box(SNOW, [b.w - 0.2, 0.05, 0.08], [0, y - 0.35, f + 0.04])
    // Windows down the side the road comes from (-x, once placed on the left).
    for (let i = 0; i < m; i++) pane(k, glass, 0.36, 0.62, [-b.w / 2 - 0.004, y, -b.d / 2 + (b.d / m) * (i + 0.5)], -Math.PI / 2)
    if (fl % 3 === 2) k.box(T, [b.w + 0.06, 0.06, b.d + 0.06], [0, y + 0.47, 0])
  }
  k.box(T, [b.w + 0.24, 0.2, b.d + 0.24], [0, H + 0.02, 0])
  k.box(SNOW, [b.w + 0.16, 0.06, b.d + 0.16], [0, H + 0.15, 0])
  frustum(k, { c: '#56656e', r: 0.7 }, b.w, b.d, 1.0, 0.4, [0, H + 0.12, 0])
  frustum(k, SNOW, b.w * 0.8, b.d * 0.8, 0.14, 0.55, [0, H + 0.9, 0])
  for (const s of [-1, 1]) {
    k.box(W, [0.3, 0.7, 0.3], [s * b.w * 0.25, H + 1.0, -0.6])
    k.box(SNOW, [0.34, 0.05, 0.34], [s * b.w * 0.25, H + 1.37, -0.6])
  }
  if (b.turrets) for (const s of [-1, 1]) {
    const x = s * (b.w / 2 - 0.5)
    k.box(W, [1.0, 1.4, 1.0], [x, H + 0.8, f - 0.5])
    k.box(T, [1.1, 0.1, 1.1], [x, H + 1.5, f - 0.5])
    k.cone({ c: '#56656e', r: 0.7 }, 0.68, 1.8, [x, H + 2.45, f - 0.5], [0, Math.PI / 4, 0], 4)
    k.cone(SNOW, 0.36, 0.9, [x, H + 2.95, f - 0.5], [0, Math.PI / 4, 0], 4)
    k.cyl(GILT, 0.025, 0.03, 0.5, [x, H + 3.55, f - 0.5], undefined, 5)
  }
}
// A white parish church facing +z: a cube with arched gables along its tops, a bell tower over
// the porch, five drums with blue onion domes and gold stars, gilt crosses.
function church(k: PropKit) {
  const W: Look = { c: '#f2eee6', r: 0.85 }
  const blue: Look = { c: '#2f5fa8', r: 0.6 }
  k.box(W, [4.6, 5.0, 4.0], [0, 2.5, -0.4])
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    archTop(k, W, 1.5, 0.1, [-1.5 + i * 1.5, 5.0, 1.6 * (s > 0 ? 1 : -1) - 0.4 + s * 0.05], s > 0 ? 0 : Math.PI)
    k.box(DARK, [0.28, 1.0, 0.03], [-1.5 + i * 1.5, 3.0, s * 2.01 - 0.4])
    half(k, DARK, 0.28, [-1.5 + i * 1.5, 3.5, s * 2.03 - 0.4], s > 0 ? 0 : Math.PI)
  }
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    k.box(DARK, [0.03, 1.0, 0.28], [s * 2.31, 3.0, -1.2 + i * 1.6])
  }
  k.box({ c: '#56656e', r: 0.7 }, [4.7, 0.25, 4.1], [0, 5.12, -0.4])
  k.box(SNOW, [4.5, 0.06, 3.9], [0, 5.27, -0.4])
  // The porch and its bell tower in front.
  k.box(W, [1.6, 3.2, 1.2], [0, 1.6, 2.1])
  k.box(DARK, [0.7, 1.4, 0.03], [0, 0.7, 2.71])
  half(k, DARK, 0.7, [0, 1.4, 2.73])
  k.box(W, [1.3, 3.2, 1.0], [0, 4.8, 2.1])
  for (const [dx, dz, ry] of [[0, 0.505, 0], [0.655, 0, Math.PI / 2], [-0.655, 0, -Math.PI / 2]] as const) {
    k.box(DARK, [dx ? 0.03 : 0.5, 1.0, dx ? 0.5 : 0.03], [dx, 5.2, 2.1 + dz])
    half(k, DARK, 0.5, [dx * 1.03, 5.7, 2.1 + dz * 1.04], ry)
  }
  k.cone({ c: '#56656e', r: 0.7 }, 0.95, 2.2, [0, 7.5, 2.1], [0, Math.PI / 4, 0], 4)
  k.cyl(GILT, 0.03, 0.03, 0.8, [0, 9.0, 2.1], undefined, 5)
  k.box(GILT, [0.36, 0.04, 0.04], [0, 9.15, 2.1])
  // Five domes: blue with gold stars, the middle one biggest.
  for (const [x, z, r] of [[0, -0.4, 0.9], [-1.4, -1.6, 0.55], [1.4, -1.6, 0.55], [-1.4, 0.8, 0.55], [1.4, 0.8, 0.55]] as const) {
    const h = r * 1.8
    k.cyl(W, r * 0.75, r * 0.75, h, [x, 5.25 + h / 2, z], undefined, 8)
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2
      k.box(DARK, [0.1, h * 0.5, 0.03], [x + Math.sin(a) * r * 0.75, 5.25 + h * 0.55, z + Math.cos(a) * r * 0.75], [0, a, 0])
    }
    const top = onion(k, blue, blue, r * 0.85, [x, 5.25 + h, z])
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2 + 0.3
      k.box(GILT, [0.07, 0.07, 0.02], [x + Math.sin(a) * r * 0.86, 5.25 + h + r * 0.65 + (j % 2) * r * 0.3, z + Math.cos(a) * r * 0.86], [0, a, 0.785])
    }
    k.box(SNOW, [r * 0.4, 0.02, r * 0.4], [x, top + 0.002, z])
  }
}

// Inside the fortress wall, seen over it from the road: a long yellow palace with white
// columns and a green roof, and white cathedrals crowned with gilt domes. Both face +z.
function palace(k: PropKit) {
  const W: Look = { c: '#e8c766', r: 0.9 }
  const w = 12
  const d = 4.5
  const H = 7.2
  const f = d / 2
  k.box(W, [w, H, d], [0, H / 2, 0])
  k.box(STONE, [w + 0.06, 1.2, d + 0.06], [0, 0.6, 0])
  for (let fl = 0; fl < 3; fl++) {
    const y = 1.2 + fl * 2.0 + 1.0
    for (let i = 0; i < 12; i++) {
      const x = -w / 2 + (w / 12) * (i + 0.5)
      if (Math.abs(x) < 1.6 && fl > 0) continue
      pane(k, STONE, 0.56, 1.35, [x, y, f + 0.004])
      pane(k, { c: '#3a4652', r: 0.4 }, 0.4, 1.18, [x, y, f + 0.008])
      k.box(SNOW, [0.6, 0.05, 0.1], [x, y - 0.7, f + 0.05])
    }
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) pane(k, { c: '#3a4652', r: 0.4 }, 0.4, 1.18, [s * (w / 2 + 0.004), y, -f + (d / 4) * (i + 0.5)], s * Math.PI / 2)
  }
  // The portico: six columns on the upper floors, an entablature and a pediment with snow.
  for (let i = 0; i < 6; i++) k.cyl(STONE, 0.13, 0.15, H - 1.6, [-1.5 + i * 0.6, 1.2 + (H - 1.6) / 2, f + 0.3], undefined, 8)
  k.box(STONE, [3.6, 0.35, 0.7], [0, H - 0.2, f + 0.3])
  frustum(k, STONE, 3.7, 0.7, 0.9, 0.04, [0, H, f + 0.3])
  gable(k, SNOW, 3.4, 0.5, 0.8, [0, H + 0.05, f + 0.3])
  k.box(STONE, [w + 0.2, 0.2, d + 0.2], [0, H, 0])
  frustum(k, ROOF, w + 0.1, d + 0.1, 1.3, 0.6, [0, H + 0.1, 0])
  frustum(k, SNOW, w * 0.85, d * 0.8, 0.18, 0.7, [0, H + 1.2, 0])
  // A green dome over the centre with a flagstaff and the white, blue and red flag.
  k.cyl(W, 1.1, 1.1, 1.0, [0, H + 1.5, -0.4], undefined, 12)
  k.sphere(ROOF, 1.15, [0, H + 2.0, -0.4], [1, 0.7, 1], 12, 5, Math.PI / 2)
  k.cyl(IRON, 0.03, 0.03, 2.2, [0, H + 3.8, -0.4], undefined, 5)
  for (const [c, y] of [['#fafafa', 4.6], ['#1e4fa0', 4.4], ['#d52b1e', 4.2]] as const) k.box({ c, r: 0.9 }, [0.9, 0.2, 0.02], [0.46, H + y, -0.4])
}
function sobor(k: PropKit) {
  const W: Look = { c: '#f4f0e6', r: 0.85 }
  k.box(W, [5, 5.6, 5], [0, 2.8, 0])
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    for (let i = 0; i < 3; i++) {
      const t = -1.66 + i * 1.66
      const px = dx * 2.52 + dz * t
      const pz = dz * 2.52 + dx * t
      archTop(k, W, 1.6, 0.12, [px, 5.6, pz], ry)
      k.box(DARK, [dz ? 0.26 : 0.03, 1.1, dz ? 0.03 : 0.26], [px, 3.4, pz])
      half(k, DARK, 0.26, [px + dx * 0.02, 3.95, pz + dz * 0.02], ry)
      k.box(STONE, [dz ? 0.12 : 0.04, 5.0, dz ? 0.04 : 0.12], [dx * 2.52 + dz * (t + 0.83), 2.5, dz * 2.52 + dx * (t + 0.83)])
    }
  }
  k.box({ c: '#7d8a90', r: 0.7 }, [5.1, 0.2, 5.1], [0, 5.7, 0])
  k.box(SNOW, [4.9, 0.06, 4.9], [0, 5.83, 0])
  for (const [x, z, r] of [[0, 0, 1.0], [-1.5, -1.5, 0.6], [1.5, -1.5, 0.6], [-1.5, 1.5, 0.6], [1.5, 1.5, 0.6]] as const) {
    const h = r * 2.0
    k.cyl(W, r * 0.72, r * 0.72, h, [x, 5.8 + h / 2, z], undefined, 8)
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2 + Math.PI / 4
      k.box(DARK, [0.1, h * 0.5, 0.03], [x + Math.sin(a) * r * 0.72, 5.8 + h * 0.55, z + Math.cos(a) * r * 0.72], [0, a, 0])
    }
    onion(k, GILT, GILT, r * 0.82, [x, 5.8 + h, z])
  }
}

// The great white bell tower of the fortress: octagonal tiers with open arches, a gilt dome.
function bellTower(k: PropKit) {
  const W: Look = { c: '#f4f0e6', r: 0.85 }
  k.box(W, [3.6, 3.0, 3.6], [0, 1.5, 0])
  k.box(STONE, [3.7, 0.15, 3.7], [0, 3.05, 0])
  const tiers = [[1.6, 5.0], [1.35, 4.2], [1.1, 3.4]] as const
  let y = 3.1
  tiers.forEach(([r, h]) => {
    k.cyl(W, r, r * 1.04, h, [0, y + h / 2, 0], [0, Math.PI / 8, 0], 8)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      k.box(DARK, [0.35, h * 0.42, 0.06], [Math.sin(a) * r * 0.93, y + h * 0.55, Math.cos(a) * r * 0.93], [0, a, 0])
      half(k, DARK, 0.35, [Math.sin(a) * r * 0.965, y + h * 0.76, Math.cos(a) * r * 0.965], a)
    }
    k.cyl(STONE, r + 0.12, r + 0.12, 0.18, [0, y + h, 0], [0, Math.PI / 8, 0], 8)
    k.cyl(SNOW, r + 0.04, r + 0.08, 0.05, [0, y + h + 0.11, 0], [0, Math.PI / 8, 0], 8)
    y += h + 0.18
  })
  k.cyl(W, 0.8, 0.8, 1.6, [0, y + 0.8, 0], undefined, 12)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    k.box(DARK, [0.16, 0.8, 0.04], [Math.sin(a) * 0.8, y + 0.8, Math.cos(a) * 0.8], [0, a, 0])
  }
  onion(k, GOLD, GOLD, 1.0, [0, y + 1.6, 0])
  // The belfry beside it, lower, with its own small gilt dome.
  k.box(W, [3.2, 6.5, 3.2], [3.5, 3.25, 0])
  for (const dz of [-1, 1]) for (const dy of [2.2, 4.6]) {
    k.box(DARK, [0.5, 1.2, 0.04], [3.5, dy, dz * 1.62])
    half(k, DARK, 0.5, [3.5, dy + 0.6, dz * 1.645], dz > 0 ? 0 : Math.PI)
  }
  k.box(STONE, [3.3, 0.15, 3.3], [3.5, 6.55, 0])
  k.cyl(W, 0.5, 0.5, 1.0, [3.5, 7.1, 0], undefined, 10)
  onion(k, GOLD, GOLD, 0.6, [3.5, 7.6, 0])
}

// The underground's entrance pavilion facing +z: granite steps, three tall arched doorways
// between pilasters, its name along the frieze and the big red M on top, lit after dark.
function metro(k: PropKit) {
  const C: Look = { c: '#e2d6bf', r: 0.85 }
  const G: Look = { c: '#8a6f62', r: 0.8 }
  const glass: Look = { c: '#3a2f28', r: 0.5 }
  const brass: Look = { c: '#c9a24a', r: 0.5 }
  const red: Look = { c: '#c62828', r: 0.6 }
  k.box(G, [5.6, 0.22, 3.8], [0, 0.11, 0])
  for (let i = 0; i < 2; i++) k.box(G, [5.0 - i * 0.3, 0.1, 0.25], [0, 0.05 + i * 0.1, 2.0 - i * 0.12])
  k.box(C, [5.4, 3.0, 3.6], [0, 1.72, 0])
  for (const x of [-1.6, 0, 1.6]) {
    k.box(C, [1.3, 2.3, 0.05], [x, 1.35, 1.82])
    archTop(k, C, 1.3, 0.05, [x, 2.5, 1.82])
    k.box(glass, [1.0, 1.9, 0.04], [x, 1.17, 1.85])
    half(k, glass, 1.0, [x, 2.12, 1.872])
    k.box(brass, [0.04, 1.9, 0.05], [x, 1.17, 1.86])
    k.box(brass, [1.0, 0.04, 0.05], [x, 1.5, 1.86])
  }
  for (const x of [-2.55, -0.8, 0.8, 2.55]) k.box(C, [0.3, 2.6, 0.12], [x, 1.52, 1.86])
  k.box(C, [5.5, 0.4, 0.1], [0, 2.95, 1.85])
  word(k, red, 'МЕТРО', 0, 2.95, 1.905, 0.26)
  k.box(C, [5.7, 0.18, 3.9], [0, 3.28, 0])
  k.box(SNOW, [5.6, 0.06, 3.8], [0, 3.4, 0])
  for (const s of [-1, 1]) for (const z of [-0.8, 0.8]) {
    k.box(glass, [0.04, 1.6, 0.6], [s * 2.71, 1.6, z])
    half(k, glass, 0.6, [s * 2.732, 2.4, z], s * Math.PI / 2)
  }
  // The M on its plinth.
  k.box(C, [1.8, 0.3, 0.5], [0, 3.58, 0.9])
  k.box(SNOW, [1.7, 0.05, 0.45], [0, 3.755, 0.9])
  const m = glow('#ff2a2a', 0.45, 1.4)
  const M: Seg[] = [[-0.6, 0, -0.6, 1.2], [0.6, 0, 0.6, 1.2], [-0.6, 1.2, 0, 0.45], [0, 0.45, 0.6, 1.2]]
  for (const [a, b, c, d] of M) {
    k.box(m, [Math.hypot(c - a, d - b) + 0.22, 0.22, 0.16], [(a + c) / 2, 3.78 + (b + d) / 2, 0.9], [0, 0, Math.atan2(d - b, c - a)])
  }
}
// The metro's sign post at the kerb: a tall pole and a lit red M on both faces.
function metroPost(k: PropKit) {
  k.cyl(IRON, 0.05, 0.06, 2.6, [0, 1.3, 0], undefined, 6)
  k.box(PAPER, [0.6, 0.6, 0.06], [0, 2.8, 0])
  const m = glow('#ff2a2a', 0.45, 1.4)
  for (const z of [0.035, -0.035]) word(k, m, 'М', 0, 2.8, z, 0.4, z > 0 ? 0 : Math.PI)
}

// The red-brick history museum beside the gate, facing +z: paired arched windows under white
// gables, a tall tented tower over the entrance and two more at its front corners.
function museum(k: PropKit) {
  const w = 13
  const d = 6
  const f = d / 2
  const silver: Look = { c: '#8e979c', r: 0.6 }
  k.box(BRICK, [w, 5, d], [0, 2.5, 0])
  k.box(BRICK_D, [w + 0.1, 0.6, d + 0.1], [0, 0.3, 0])
  for (const y of [0.9, 2.7, 4.9]) k.box(STONE, [w + 0.06, 0.08, d + 0.06], [0, y, 0])
  for (let i = 0; i < 9; i++) {
    const x = -5.2 + i * 1.3
    if (Math.abs(x) < 1.2) continue
    for (const y of [1.75, 3.75]) {
      for (const s of [-1, 1]) {
        pane(k, DARK, 0.28, 0.75, [x + s * 0.2, y, f + 0.012])
        half(k, DARK, 0.28, [x + s * 0.2, y + 0.375, f + 0.012])
      }
      half(k, STONE, 0.95, [x, y + 0.42, f + 0.004], 0, 1.1)
      half(k, BRICK, 0.85, [x, y + 0.42, f + 0.008], 0, 1.1)
      k.box(STONE, [0.06, 0.12, 0.05], [x, y + 0.4, f + 0.03])
      k.box(SNOW, [0.75, 0.04, 0.08], [x, y - 0.42, f + 0.04])
    }
  }
  // Kokoshnik gables along the top, the steep silver roof with snow.
  for (let i = 0; i < 10; i++) archTop(k, BRICK, 1.1, 0.12, [-5.4 + i * 1.2, 5.0, f - 0.1])
  frustum(k, silver, w, d, 1.8, 0.3, [0, 5, 0])
  frustum(k, SNOW, w * 0.7, d * 0.6, 0.2, 0.4, [0, 6.2, 0])
  // The entrance tower.
  k.box(BRICK, [2.4, 8.5, 1.6], [0, 4.25, f + 0.2])
  k.box(DARK, [1.3, 2.3, 0.03], [0, 1.15, f + 1.01])
  half(k, DARK, 1.3, [0, 2.3, f + 1.03])
  half(k, STONE, 1.7, [0, 2.3, f + 1.018])
  for (const y of [4.0, 6.0]) {
    k.box(DARK, [0.4, 1.0, 0.03], [0, y, f + 1.01])
    half(k, DARK, 0.4, [0, y + 0.5, f + 1.03])
  }
  for (const y of [3.0, 5.2, 7.3]) k.box(STONE, [2.46, 0.08, 1.66], [0, y, f + 0.2])
  k.box(STONE, [2.6, 0.18, 1.8], [0, 8.55, f + 0.2])
  frustum(k, silver, 2.2, 1.6, 3.8, 0.08, [0, 8.6, f + 0.2])
  frustum(k, SNOW, 1.1, 0.8, 0.12, 0.6, [0, 10.4, f + 0.2])
  k.cyl(GILT, 0.03, 0.04, 0.9, [0, 12.8, f + 0.2], undefined, 5)
  k.sphere(GILT, 0.12, [0, 13.3, f + 0.2], [1, 1, 1], 6, 4)
  // Corner towers with their tents, and small turrets in between.
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - 0.6)
    k.box(BRICK, [1.4, 7.6, 1.4], [x, 3.8, f - 0.5])
    for (const y of [2.7, 4.9, 6.6]) k.box(STONE, [1.46, 0.08, 1.46], [x, y, f - 0.5])
    k.box(DARK, [0.3, 0.8, 0.03], [x, 5.7, f + 0.215])
    half(k, DARK, 0.3, [x, 6.1, f + 0.232])
    k.cone(silver, 0.98, 4.2, [x, 9.7, f - 0.5], [0, Math.PI / 4, 0], 4)
    k.cone(SNOW, 0.5, 1.0, [x, 8.85, f - 0.5], [0, Math.PI / 4, 0], 4)
    k.cyl(GILT, 0.025, 0.03, 0.6, [x, 12.1, f - 0.5], undefined, 5)
    for (const t of [2.4, 4.0]) {
      const tx = s * t
      k.box(BRICK, [0.5, 1.2, 0.5], [tx, 5.6, f - 0.3])
      k.cone(silver, 0.36, 1.2, [tx, 6.8, f - 0.3], [0, Math.PI / 4, 0], 4)
    }
  }
}

// A fur-hat stall, facing +z: hats with ear flaps lined up on the counter and on the shelf
// behind, felt boots hanging at the side, the sign МЕХА ("furs") over it.
function hatStall(k: PropKit) {
  const wood: Look = { c: '#6e4a2e', r: 0.9 }
  for (const x of [-0.75, 0.75]) for (const z of [-0.35, 0.35]) k.box(wood, [0.06, 1.5, 0.06], [x, 0.75, z])
  k.box(wood, [1.54, 0.06, 0.8], [0, 0.72, 0.02])
  k.box({ c: '#2f5e3a', r: 0.9 }, [1.54, 0.66, 0.04], [0, 0.36, 0.4])
  k.box(wood, [1.5, 0.04, 0.24], [0, 1.08, -0.25])
  gable(k, { c: '#2f5e3a', r: 0.9 }, 1.9, 1.0, 0.4, [0, 1.5, 0])
  gable(k, SNOW, 1.92, 0.9, 0.44, [0, 1.52, 0])
  k.box(wood, [1.62, 0.08, 0.84], [0, 1.47, 0])
  k.box({ c: '#b71c1c', r: 0.8 }, [0.9, 0.24, 0.03], [0, 1.66, 0.5])
  word(k, PAPER, 'МЕХА', 0, 1.66, 0.52, 0.15)
  const hat = (x: number, y: number, z: number, c: string) => {
    k.cyl({ c, r: 1 }, 0.075, 0.08, 0.075, [x, y + 0.0375, z], undefined, 8)
    k.cyl({ c, r: 1 }, 0.06, 0.075, 0.02, [x, y + 0.085, z], undefined, 8)
    k.box({ c, r: 1 }, [0.14, 0.04, 0.025], [x, y + 0.06, z + 0.075], [-0.3, 0, 0])
    for (const s of [-1, 1]) k.box({ c, r: 1 }, [0.02, 0.08, 0.07], [x + s * 0.08, y + 0.02, z])
  }
  for (let i = 0; i < 7; i++) hat(-0.6 + i * 0.2, 0.75, 0.18, FURS[i % FURS.length])
  for (let i = 0; i < 6; i++) hat(-0.5 + i * 0.2, 1.1, -0.22, FURS[(i + 2) % FURS.length])
  // Felt boots on a peg, and a grey shawl.
  for (const z of [-0.1, 0.12]) {
    k.box({ c: '#8a8580', r: 1 }, [0.08, 0.3, 0.1], [0.8, 1.05, z])
    k.box({ c: '#8a8580', r: 1 }, [0.08, 0.09, 0.18], [0.8, 0.92, z + 0.05])
  }
  k.box({ c: '#5d5d66', r: 1 }, [0.02, 0.7, 0.5], [-0.79, 1.05, 0])
  for (let i = 0; i < 4; i++) k.box({ c: '#e8e2d4', r: 1 }, [0.024, 0.03, 0.5], [-0.795, 0.8 + i * 0.15, 0])
}

// A kvass barrel cart, facing +z along its side: a yellow tank on two wheels with КВАС on it,
// a tap at the end, a table with glasses and the seller in her apron by it.
function kvassCart(k: PropKit) {
  const tank: Look = { c: '#f2b632', r: 0.6 }
  const tyre: Look = { c: '#1b1b1b', r: 0.9 }
  k.cyl(tank, 0.36, 0.36, 1.2, [0, 0.8, 0], [0, 0, Math.PI / 2], 12)
  for (const x of [-0.6, 0.6]) k.cyl({ c: '#d99a22', r: 0.6 }, 0.34, 0.37, 0.04, [x, 0.8, 0], [0, 0, Math.PI / 2], 12)
  for (const x of [-0.35, 0.35]) k.cyl(DARK, 0.368, 0.368, 0.03, [x, 0.8, 0], [0, 0, Math.PI / 2], 12)
  for (const z of [1, -1]) {
    k.box({ c: '#c62828', r: 0.6 }, [0.62, 0.22, 0.02], [0, 0.8, z * 0.37])
    word(k, PAPER, 'КВАС', 0, 0.8, z * 0.383, 0.13, z > 0 ? 0 : Math.PI)
  }
  k.box(SNOW, [0.9, 0.04, 0.2], [0, 1.165, 0])
  k.cyl(DARK, 0.1, 0.1, 0.08, [0, 1.18, 0], undefined, 8)
  k.box({ c: '#6b6f73', r: 0.6 }, [1.3, 0.06, 0.5], [0, 0.42, 0])
  for (const z of [-1, 1]) {
    k.cyl(tyre, 0.26, 0.26, 0.1, [0, 0.26, z * 0.42], [Math.PI / 2, 0, 0], 10)
    k.cyl({ c: '#c9ccd0', r: 0.4 }, 0.1, 0.1, 0.02, [0, 0.26, z * 0.475], [Math.PI / 2, 0, 0], 8)
    k.box({ c: '#6b6f73', r: 0.6 }, [0.62, 0.03, 0.14], [0, 0.55, z * 0.42])
  }
  k.rod({ c: '#6b6f73', r: 0.6 }, [0.6, 0.42, 0], [1.25, 0.3, 0], 0.03, 5)
  k.box({ c: '#6b6f73', r: 0.6 }, [0.04, 0.3, 0.04], [1.15, 0.15, 0])
  for (const z of [-0.18, 0.18]) k.box({ c: '#6b6f73', r: 0.6 }, [0.04, 0.4, 0.04], [-0.55, 0.2, z])
  k.cyl({ c: '#c9ccd0', r: 0.4 }, 0.025, 0.025, 0.14, [-0.66, 0.62, 0], [0, 0, Math.PI / 2], 6)
  k.box(PAPER, [0.4, 0.03, 0.3], [-0.95, 0.55, 0])
  for (const [x, z] of [[-0.88, 0.25], [-1.08, 0.45]]) k.box(IRON, [0.03, 0.54, 0.03], [x, 0.27, z - 0.35])
  for (const [x, z] of [[-0.85, -0.05], [-0.95, 0.06], [-1.05, -0.04], [-1.0, -0.1]]) k.cyl({ c: '#c98a2e', r: 0.3 }, 0.025, 0.022, 0.07, [x, 0.6, z], undefined, 6)
  figure(k, -1.0, -0.4, 0.4, { coat: '#fafafa', legs: '#3a3a44', skin: '#f1c9a5', hat: 'scarf', hatC: '#c62828', scarf: '#f9a825', long: true })
}

// The New Year tree on the square: a tall fir hung with baubles and garlands, lights that glow
// after dark, a red star on top, a little fence round its foot.
function yolka(k: PropKit) {
  fir(k, 0, 0, 1.9, 0.3)
  const balls = ['#e53935', '#fdd835', '#1e88e5', '#fafafa', '#8e24aa']
  const tiers = [[0.85, 0.95], [0.7, 1.55], [0.52, 2.1], [0.34, 2.6]] as const
  tiers.forEach(([r, y], t) => {
    for (let i = 0; i < 9 - t * 2; i++) {
      const a = (i / (9 - t * 2)) * Math.PI * 2 + t
      const rr = r * 1.9 * 0.82
      k.sphere({ c: balls[(i + t) % 5], r: 0.3 }, 0.07, [Math.sin(a) * rr, (y - 0.25) * 1.9, Math.cos(a) * rr], [1, 1, 1], 6, 4)
      k.sphere({ glow: true, c: '#ffd54f' }, 0.035, [Math.sin(a + 0.35) * rr * 0.8, (y - 0.05) * 1.9, Math.cos(a + 0.35) * rr * 0.8], [1, 1, 1], 4, 3)
    }
    k.torus({ c: '#ffca28', r: 0.4 }, r * 1.9 * 0.7, 0.02, [0, (y - 0.12) * 1.9, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 16, 3)
  })
  const star: Look = { c: '#e53935', r: 0.4 }
  for (let i = 0; i < 5; i++) k.box(star, [0.1, 0.42, 0.08], [0, 6.05, 0], [0, 0, (i / 5) * Math.PI * 2])
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    k.box({ c: '#c62828', r: 0.8 }, [0.05, 0.4, 0.05], [Math.sin(a) * 1.9, 0.2, Math.cos(a) * 1.9])
  }
  k.torus({ c: '#fafafa', r: 0.8 }, 1.9, 0.025, [0, 0.36, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 24, 3)
}

// A horse-drawn sleigh waiting by the square, facing +z: a red sleigh with gilt scrolls on
// curled runners, a rug on the seat, the horse under a painted arch over its collar, bells,
// and the driver in his fur hat at its head.
function sleigh(k: PropKit) {
  const coat: Look = { c: '#6b4226', r: 0.8 }
  const darkc: Look = { c: '#2a1c14', r: 0.9 }
  const red: Look = { c: '#b3261e', r: 0.6 }
  const gilt: Look = { c: '#e0b24a', r: 0.5 }
  // Horse.
  k.add(coat, capsule(0.19, 0.5), [0, 0.72, 1.6], [Math.PI / 2, 0, 0], [1, 1, 1])
  for (const [x, z] of [[-0.1, 1.32], [0.1, 1.32], [-0.1, 1.88], [0.1, 1.88]]) {
    k.cyl(coat, 0.045, 0.04, 0.58, [x, 0.33, z], undefined, 6)
    k.cyl(darkc, 0.05, 0.05, 0.06, [x, 0.03, z], undefined, 6)
    k.cyl({ c: '#e8e0d0', r: 0.9 }, 0.046, 0.05, 0.06, [x, 0.09, z], undefined, 6)
  }
  k.add(coat, capsule(0.1, 0.32), [0, 1.0, 2.0], [0.7, 0, 0], [1, 1, 1])
  k.box(coat, [0.14, 0.15, 0.36], [0, 1.18, 2.22], [0.55, 0, 0])
  k.box({ c: '#e8e0d0', r: 0.9 }, [0.06, 0.12, 0.012], [0, 1.2, 2.39], [0.55, 0, 0])
  for (const s of [-1, 1]) {
    k.cone(coat, 0.03, 0.09, [s * 0.05, 1.33, 2.1], undefined, 4)
    k.sphere(DARK, 0.016, [s * 0.072, 1.24, 2.25], [1, 1, 1], 5, 3)
  }
  for (let i = 0; i < 5; i++) k.box(darkc, [0.04, 0.08, 0.06], [0, 1.03 + i * 0.05, 1.84 + i * 0.065])
  k.cyl(darkc, 0.04, 0.02, 0.45, [0, 0.58, 1.08], [0.35, 0, 0], 5)
  // Harness: collar, the painted arch with its bell, shafts back to the sleigh.
  k.torus(red, 0.12, 0.035, [0, 0.9, 1.92], [0.7, 0, 0], Math.PI * 2, 12, 4)
  k.torus(red, 0.36, 0.03, [0, 0.62, 1.82], undefined, Math.PI, 12, 4)
  for (let i = 0; i < 4; i++) {
    const a = 0.4 + i * 0.75
    k.sphere({ c: '#fdd835', r: 0.6 }, 0.025, [Math.cos(a) * 0.36, 0.62 + Math.sin(a) * 0.36, 1.85], [1, 1, 1], 5, 3)
  }
  k.sphere(gilt, 0.04, [0, 0.93, 1.82], [1, 1, 1], 6, 4)
  for (const s of [-1, 1]) k.rod(darkc, [s * 0.36, 0.62, 1.82], [s * 0.34, 0.42, 0.62], 0.02, 4)
  k.box(darkc, [0.42, 0.06, 0.3], [0, 0.93, 1.55])
  // Sleigh.
  for (const s of [-1, 1]) {
    k.box(darkc, [0.05, 0.04, 1.3], [s * 0.33, 0.04, -0.05])
    k.torus(darkc, 0.17, 0.022, [s * 0.33, 0.2, 0.6], [0, Math.PI / 2, 0], Math.PI * 1.1, 10, 3)
    for (const z of [-0.5, 0.0, 0.4]) k.box(darkc, [0.04, 0.24, 0.04], [s * 0.33, 0.17, z])
  }
  k.box(red, [0.72, 0.36, 1.1], [0, 0.47, -0.05])
  k.box(red, [0.72, 0.5, 0.1], [0, 0.88, -0.58])
  k.box(red, [0.72, 0.3, 0.1], [0, 0.72, 0.48], [-0.3, 0, 0])
  for (const s of [-1, 1]) {
    k.box(gilt, [0.012, 0.04, 1.0], [s * 0.366, 0.55, -0.05])
    k.torus(gilt, 0.1, 0.012, [s * 0.366, 0.4, -0.1], [0, Math.PI / 2, 0], Math.PI * 2, 10, 3)
  }
  k.box({ c: '#2e5e3a', r: 1 }, [0.66, 0.06, 0.55], [0, 0.68, -0.25])
  k.box({ c: '#d9c27a', r: 1 }, [0.67, 0.012, 0.06], [0, 0.71, -0.25])
  k.box(SNOW, [0.6, 0.03, 0.12], [0, 1.145, -0.58])
  figure(k, 0.42, 1.95, -1.9, { coat: '#3b2a20', legs: '#2b2b30', skin: '#e8b996', hat: 'ushanka', hatC: '#2b2b2b', scarf: '#c62828', long: true })
}

const KIOSK_Z = 7
const DOLLS_Z = 11.5
const METRO_Z = 21
const BUS_Z = 80
// Parked cars: pairs and singles in the colours of the old saloons.
const CARS = [['#d9c9a0', '#6f9fc4'], ['#9b1f2a'], ['#e9e6dc', '#4f6b3a'], ['#3d5a80'], ['#c98a3a', '#8a8f94']]
const CAR_LEN = (c: string[]) => c.length * 2.55

export default function Moscow({ len, race }: WorldProps) {
  const blocks = useMemo(() => BLOCKS.map((b, i) => prop(`moscow-block-d3-${i}`, (k) => block(k, b))), [])
  const stals = useMemo(() => STALS.map((b, i) => prop(`moscow-stal-${i}`, (k) => stalinka(k, b))), [])
  const backs = useMemo(() => BACKS.map((b, i) => prop(`moscow-back-${i}`, (k) => backBlock(k, b))), [])
  const folk = useMemo(() => [0, 1, 2].map((i) => prop(`moscow-folk-${i}`, (k) => crowd(k, i, 3 + (i % 2), 1.0 + (i % 2) * 0.3))), [])
  const cars = useMemo(() => CARS.map((c, i) => prop(`moscow-cars-${i}`, (k) => c.forEach((col, j) => sedan(k, col, (j - (c.length - 1) / 2) * 2.55)))), [])
  const wallP = useProp('moscow-wall-d3', (k) => wallRun(k, 25, false))
  const wall4P = useProp('moscow-wall4', (k) => wallRun(k, 4.02, false))
  const towerP = useProp('moscow-tower', (k) => tower(k, [0, 0, 0], 2.4, 6))
  const clockP = useProp('moscow-clock', (k) => tower(k, [0, 0, 0], 3.4, 9, true))
  const cathedralP = useProp('moscow-cathedral', cathedral)
  const gateP = useProp('moscow-gate', gate)
  const birchP = useProp('moscow-birch', birch)
  const firP = useProp('moscow-fir', (k) => fir(k))
  const kioskP = useProp('moscow-kiosk', kiosk)
  const dollP = useProp('moscow-dolls', dollStall)
  const lampP = useProp('moscow-lamp', (k) => lampBench(k))
  const poleP = useProp('moscow-trolleypole', trolleyPole)
  const yardP = useProp('moscow-yard', yardGate)
  const palaceP = useProp('moscow-palace', palace)
  const soborP = useProp('moscow-sobor', sobor)
  const bellP = useProp('moscow-bell', bellTower)
  const museumP = useProp('moscow-museum', museum)
  const metroP = useProp('moscow-metro', metro)
  const postP = useProp('moscow-metropost', metroPost)
  const busP = useProp('moscow-trolleybus', trolleybus)
  const shelterP = useProp('moscow-shelter', shelter)
  const hatsP = useProp('moscow-hats', hatStall)
  const kvassP = useProp('moscow-kvass', kvassCart)
  const yolkaP = useProp('moscow-yolka', yolka)
  const sleighP = useProp('moscow-sleigh', sleigh)
  const gz = race * 0.5
  const cz = race + 12
  const WX = -(EDGE + 2.4)

  const geo = useMemo(() => {
    const r = rand(613)
    const end = len + 40
    // Left: the street front. Blocks and grand apartment houses side by side, a courtyard gate in
    // each gap; the metro pavilion, the museum by the gate and the cathedral square have their own
    // stretches.
    const zones: [number, number][] = [[METRO_Z - 2.9, METRO_Z + 2.9], [gz - 6.6, gz + 6.6], [cz - 9.5, cz + 10.5]]
    const rows: Spot[][] = BLOCKS.map(() => [])
    const stalRows: Spot[][] = STALS.map(() => [])
    const yards: Spot[] = []
    const lamps: number[] = []
    const yard = (a: number, b: number) => {
      const n = Math.floor((b - a) / 1.5)
      for (let i = 0; i < n; i++) yards.push({ x: EDGE + 2.3, z: a + ((b - a) / n) * (i + 0.5), ry: -Math.PI / 2 })
    }
    for (let z = -14; z < end;) {
      const grand = r() < 0.26
      const gi = Math.floor(r() * STALS.length)
      let i = Math.floor(r() * BLOCKS.length)
      // No lamp where the kiosk and the doll stall stand.
      if (BLOCKS[i].lamp && z < DOLLS_Z + 2 && z + BLOCKS[i].w > KIOSK_Z - 2) i = (i + 1) % BLOCKS.length
      const w = grand ? STALS[gi].w : BLOCKS[i].w
      const zone = zones.find(([a, b]) => z < b && z + w > a)
      if (zone) {
        yard(z, zone[0])
        z = zone[1]
        continue
      }
      const zc = z + w / 2
      if (grand) stalRows[gi].push({ x: EDGE + 2.2 + STALS[gi].d / 2, z: zc, ry: -Math.PI / 2 })
      else {
        const b = BLOCKS[i]
        rows[i].push({ x: EDGE + 2.2 + b.d / 2, z: zc, ry: -Math.PI / 2 })
        if (b.lamp) lamps.push(zc + LAMP_X(b))
      }
      z += w
      if (r() < 0.35) {
        yard(z, z + 1.6)
        z += 1.6
      } else z += 0.1
    }
    // The second row behind, and behind the cathedral a row further back still.
    const backRows: Spot[][] = BACKS.map(() => [])
    for (let z = -18; z < end + 10;) {
      const i = Math.floor(r() * BACKS.length)
      const b = BACKS[i]
      const far = Math.abs(z + b.w / 2 - cz) < 13
      const skip = z < gz + 7.6 && z + b.w > gz - 7.6
      if (!skip) backRows[i].push({ x: EDGE + (far ? 16.8 : 6.8) + b.d / 2, z: z + b.w / 2, ry: -Math.PI / 2 })
      z += b.w + 0.3 + r() * 1.2
    }

    // Right: the fortress wall in lengths between its towers (short lengths through the gate, so
    // the wall meets the gate towers), the clock tower opposite the start.
    const walls: Spot[] = []
    const walls4: Spot[] = []
    const towers: Spot[] = []
    for (let z = -14; z < end; z += 26) {
      if (Math.abs(z + 13 - gz) > 13) walls.push({ x: WX, z: z + 13 })
      else for (let j = 0; j < 6; j++) walls4.push({ x: WX, z: z + 3 + j * 4 })
      if (Math.abs(z - gz) > 5 && Math.abs(z - 30) > 4) towers.push({ x: WX, z })
    }
    // The kerb strip in front of the wall: what stands where, so nothing overlaps.
    const busy: [number, number][] = [[28, 32], [gz - 1.7, gz + 1.7], [BUS_Z - 7.6, BUS_Z + 3.2]]
    for (const t of towers) busy.push([t.z - 1.35, t.z + 1.35])
    const free = (a: number, b: number) => !busy.some(([c, d]) => a < d && b > c)
    const poles: Spot[] = []
    // Trolley-wire poles about every 12 on both kerbs, nudged clear of whatever stands there.
    const lBusy: [number, number][] = [[KIOSK_Z - 0.9, KIOSK_Z + 0.9], [DOLLS_Z - 1.1, DOLLS_Z + 1.1], [gz - 1.4, gz + 1.4], [gz - 3.7, gz - 1.3], [gz + 4.5, gz + 6.9], [METRO_Z - 3.6, METRO_Z - 2.6], ...lamps.map((l): [number, number] => [l - 0.7, l + 0.7])]
    const lFree = (a: number, b: number) => !lBusy.some(([c, d]) => a < d && b > c)
    for (let z = -12; z < end; z += 12) {
      for (const dz of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, 3.2]) {
        if (free(z + dz - 0.3, z + dz + 0.3)) {
          poles.push({ x: -(EDGE + 0.25), z: z + dz })
          busy.push([z + dz - 0.4, z + dz + 0.4])
          break
        }
      }
      for (const dz of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, 3.2]) {
        if (lFree(z + dz - 0.3, z + dz + 0.3)) {
          poles.push({ x: EDGE + 0.25, z: z + dz, ry: Math.PI })
          lBusy.push([z + dz - 0.4, z + dz + 0.4])
          break
        }
      }
    }
    // Then firs, parked cars, lamps with benches and people, in turn as room allows.
    const firs: Spot[] = []
    const carAt: Spot[][] = CARS.map(() => [])
    const lampAt: Spot[] = []
    const folkAt: Spot[][] = folk.map(() => [])
    let ci = 0
    let fi = 0
    for (let z = -13; z < end;) {
      const pick = r()
      if (pick < 0.3) {
        const L = 1.6
        if (free(z, z + L)) {
          firs.push({ x: WX + 1.45, z: z + L / 2, ry: r() * 6, s: 0.8 + r() * 0.25 })
          busy.push([z, z + L])
          z += L + 0.2
          continue
        }
      } else if (pick < 0.62) {
        const c = ci % CARS.length
        const L = CAR_LEN(CARS[c]) + 0.1
        if (free(z, z + L)) {
          carAt[c].push({ x: -(EDGE + 0.82), z: z + L / 2 })
          busy.push([z, z + L])
          ci++
          z += L + 0.3
          continue
        }
      } else if (pick < 0.8) {
        if (free(z, z + 2.3)) {
          lampAt.push({ x: -(EDGE + 0.55), z: z + 1.7, ry: Math.PI / 2 })
          busy.push([z, z + 2.3])
          z += 2.5
          continue
        }
      } else if (free(z, z + 1.5)) {
        folkAt[fi % folk.length].push({ x: -(EDGE + 1.35), z: z + 0.75, ry: Math.PI / 2 })
        busy.push([z, z + 1.5])
        fi++
        z += 1.7
        continue
      }
      z += 0.5
    }
    // People along the left pavement in front of the shops, between the birches.
    for (let z = -12; z < end; z += 4.5 + r() * 5) {
      if (!lFree(z - 0.8, z + 0.8) || (z > cz - 10 && z < cz + 11) || Math.abs(z - METRO_Z) < 3.4) continue
      folkAt[fi % folk.length].push({ x: EDGE + 1.62, z, ry: -Math.PI / 2 })
      fi++
    }
    // Out on the cathedral square, browsing the stalls; at the metro doors; at the stop.
    for (const [x, z] of [[EDGE + 2.6, cz - 6.5], [EDGE + 2.7, cz - 2.5], [EDGE + 2.6, cz + 1.2], [EDGE + 2.8, cz + 5.0], [EDGE + 1.6, cz - 8.6]]) folkAt[fi++ % folk.length].push({ x, z, ry: -Math.PI / 2 + (r() - 0.5) * 0.6 })
    folkAt[fi++ % folk.length].push({ x: EDGE + 1.45, z: METRO_Z + 0.4, ry: -Math.PI / 2 })
    // The museum's forecourt by the gate: lamps with benches, people looking up at it.
    for (const z of [gz - 3.1, gz + 5.1]) lampAt.push({ x: EDGE + 0.55, z, ry: -Math.PI / 2 })
    for (const z of [gz - 4.6, gz + 3.6]) folkAt[fi++ % folk.length].push({ x: EDGE + 2.9, z, ry: -Math.PI / 2 + 0.4 })
    folkAt[fi++ % folk.length].push({ x: -(EDGE + 1.0), z: BUS_Z - 6.6, ry: Math.PI / 2 })

    // Birches along the right-hand pavement, clear of the lamps' benches, the kiosk and the stall.
    const taken = (z: number) => lamps.some((l) => z > l - 0.7 && z < l + 2) || Math.abs(z - KIOSK_Z) < 1.5 || Math.abs(z - DOLLS_Z) < 1.6 || poles.some((p) => p.x > 0 && Math.abs(p.z - z) < 0.9)
    const birches: Spot[] = []
    for (let z = -10; z < end; z += 2.8 + r() * 2.5) if (Math.abs(z - gz) > 5 && Math.abs(z - cz) > 9 && Math.abs(z - METRO_Z) > 1.5 && Math.abs(z - METRO_Z + 3.1) > 1 && !taken(z)) birches.push({ x: EDGE + 0.9, z, ry: r() * 6, s: 0.8 + r() * 0.35 })
    // Inside the wall: birches and firs just behind it, then palaces and cathedrals, then more firs.
    for (let z = -12; z < len + 60; z += 3 + r() * 3.5) {
      if (r() < 0.5) birches.push({ x: WX - 1.7 - r() * 1.4, z, ry: r() * 6, s: 1.1 + r() * 0.25 })
      else firs.push({ x: WX - 2.4 - r() * 0.8, z, ry: r() * 6, s: 1.3 + r() * 0.3 })
    }
    for (let z = -12; z < len + 60; z += 3.5 + r() * 4) firs.push({ x: WX - 13 - r() * 8, z, ry: r() * 6, s: 1.1 + r() * 0.7 })
    const palaces: Spot[] = []
    const sobors: Spot[] = []
    for (let z = -10; z < len + 50;) {
      const big = r() < 0.5
      const w = big ? 12.4 : 5.6
      const zc = z + w / 2
      if (!(z < 13 && z + w > 3) && !(z < 72 && z + w > 59)) (big ? palaces : sobors).push({ x: WX - 4.7 - (big ? 2.3 : 2.6), z: zc, ry: Math.PI / 2 })
      z += w + 1 + r() * 3
    }
    // Snow heaped along both kerbs, kept off the cars, the stalls and the stop.
    const rr = rand(77)
    const banks: { x: number; z: number; s: number; ry: number; sy: number }[] = []
    for (let i = 0; i < 260; i++) {
      const side = rr() < 0.5 ? -1 : 1
      const b = { x: side * (EDGE + 0.15 + rr() * 0.5), z: rr() * (len + 60) - 14, s: 0.5 + rr() * 0.9, ry: rr() * 6 }
      const clear = side < 0 ? !carAt.some((cs) => cs.some((c) => Math.abs(c.z - b.z) < 2.8)) && Math.abs(b.z - (BUS_Z - 2)) > 5 : lFree(b.z - 0.5, b.z + 0.5) && Math.abs(b.z - METRO_Z) > 3 && Math.abs(b.z - cz) > 10
      if (clear) banks.push({ ...b, sy: 0.4 })
    }
    return { rows, stalRows, backRows, yards, walls, walls4, towers, birches, firs, banks, poles, carAt, lampAt, folkAt, palaces, sobors }
  }, [len, gz, cz, WX, folk])

  return (
    <>
      <Batch version={`moscow:${len}`} cell={24}>
        <group position={[0, 0, gz]}><PropMesh parts={gateP} /></group>
        <group position={[WX, 0, 30]}><PropMesh parts={clockP} /></group>
        <group position={[EDGE + 9, 0, cz]} rotation-y={-Math.PI / 2}><PropMesh parts={cathedralP} /></group>
        <group position={[EDGE + 1.1, 0, KIOSK_Z]} rotation-y={-Math.PI / 2}><PropMesh parts={kioskP} /></group>
        <group position={[EDGE + 1.05, 0, DOLLS_Z]} rotation-y={-Math.PI / 2}><PropMesh parts={dollP} /></group>
        <group position={[EDGE + 4.0, 0, METRO_Z]} rotation-y={-Math.PI / 2}><PropMesh parts={metroP} /></group>
        <group position={[EDGE + 0.7, 0, METRO_Z - 3.1]} rotation-y={-Math.PI / 2}><PropMesh parts={postP} /></group>
        <group position={[EDGE + 7.8, 0, gz]} rotation-y={-Math.PI / 2}><PropMesh parts={museumP} /></group>
        <group position={[WX - 7, 0, 66]} rotation-y={Math.PI / 2}><PropMesh parts={bellP} /></group>
        <group position={[WX - 9.4, 0, 8]} rotation-y={Math.PI / 2}><PropMesh parts={palaceP} /></group>
        <group position={[-(EDGE + 0.7), 0, BUS_Z]}><PropMesh parts={busP} /></group>
        <group position={[-(EDGE + 1.15), 0, BUS_Z - 4]} rotation-y={Math.PI / 2}><PropMesh parts={shelterP} /></group>
        {/* The market on the cathedral square. */}
        <group position={[EDGE + 1.05, 0, cz - 6.6]} rotation-y={-Math.PI / 2}><PropMesh parts={dollP} /></group>
        <group position={[EDGE + 1.05, 0, cz - 4.4]} rotation-y={-Math.PI / 2}><PropMesh parts={hatsP} /></group>
        <group position={[EDGE + 1.25, 0, cz - 1.6]} rotation-y={-Math.PI / 2}><PropMesh parts={kvassP} /></group>
        <group position={[EDGE + 1.7, 0, cz + 1.6]}><PropMesh parts={sleighP} /></group>
        <group position={[EDGE + 2.1, 0, cz + 8.3]}><PropMesh parts={yolkaP} /></group>
        {/* The square's cobbles in front of the cathedral. */}
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 6, 0.013, cz + 0.5]}>
          <planeGeometry args={[12, 20]} />
          <meshStandardMaterial color="#a9a4a0" />
        </mesh>
        <Scatter spots={geo.banks} colors={['#f4f8fb', '#e8eff5', '#fbfdff']} y={0.1}>
          <icosahedronGeometry args={[0.35, 0]} />
        </Scatter>
      </Batch>
      {blocks.map((b, i) => <Many key={i} parts={b} at={geo.rows[i]} />)}
      {stals.map((b, i) => <Many key={i} parts={b} at={geo.stalRows[i]} />)}
      {backs.map((b, i) => <Many key={i} parts={b} at={geo.backRows[i]} />)}
      {folk.map((b, i) => <Many key={i} parts={b} at={geo.folkAt[i]} near={70} />)}
      {cars.map((b, i) => <Many key={i} parts={b} at={geo.carAt[i]} near={80} />)}
      <Many parts={yardP} at={geo.yards} near={80} />
      <Many parts={wallP} at={geo.walls} />
      <Many parts={wall4P} at={geo.walls4} />
      <Many parts={towerP} at={geo.towers} />
      <Many parts={birchP} at={geo.birches} />
      <Many parts={firP} at={geo.firs} />
      <Many parts={lampP} at={geo.lampAt} near={80} />
      <Many parts={poleP} at={geo.poles} />
      <Many parts={palaceP} at={geo.palaces} />
      <Many parts={soborP} at={geo.sobors} />
      <FarMoscow />
    </>
  )
}

// A postwar tower of the city's skyline: a broad base with wings, setbacks, a tall central
// shaft, a crowned top and a spire with a red star. At (x, z), s times full size.
function vysotka(k: PropKit, x: number, z: number, s: number, stone: Look, shade: Look) {
  const B = (w: number, h: number, d: number, y: number, dx = 0) => k.box(stone, [w * s, h * s, d * s], [x + dx * s, y * s, z])
  B(26, 10, 14, 5)
  for (const sd of [-1, 1]) {
    B(8, 16, 10, 8, sd * 10)
    k.box(shade, [8.4 * s, 0.5 * s, 10.4 * s], [x + sd * 10 * s, 16 * s, z])
    k.cone(shade, 2.6 * s, 4 * s, [x + sd * 10 * s, 18 * s, z], [0, Math.PI / 4, 0], 4)
  }
  B(12, 24, 12, 12)
  k.box(shade, [12.4 * s, 0.6 * s, 12.4 * s], [x, 24 * s, z])
  for (const sd of [-1, 1]) for (const dz of [-1, 1]) k.cone(shade, 0.8 * s, 3 * s, [x + sd * 5.5 * s, 25.8 * s, z + dz * 5.5 * s], undefined, 4)
  B(9, 8, 9, 28.3)
  k.box(shade, [9.4 * s, 0.5 * s, 9.4 * s], [x, 32.4 * s, z])
  B(6, 5, 6, 35)
  k.cyl(stone, 2.2 * s, 2.6 * s, 4 * s, [x, 39.5 * s, z], undefined, 8)
  frustum(k, shade, 3.2 * s, 3.2 * s, 9 * s, 0.05, [x, 41.5 * s, z])
  k.cyl(GOLD, 0.15 * s, 0.2 * s, 3 * s, [x, 51.5 * s, z], undefined, 6)
  k.box(glow('#ff1a2e', 0.5, 1.4), [0.5 * s, 1.2 * s, 0.3 * s], [x, 53.4 * s, z])
  for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) k.box(DARK, [0.6 * s, 14 * s, 0.1 * s], [x + sd * (1.5 + i * 0.9) * s, 12 * s, z - 6.05 * s])
}

// The far skyline, ahead and along both sides: postwar towers, a television tower, rooftops of
// the city with church domes and spires among them.
function FarMoscow() {
  const parts = useProp('moscow-far-d3', (k) => {
    const stone: Look = { c: '#e3d6c0', r: 0.9 }
    const shade: Look = { c: '#c9b99c', r: 0.9 }
    vysotka(k, 22, 80, 1, stone, shade)
    vysotka(k, -46, 70, 0.8, { c: '#ddd2c2', r: 0.9 }, { c: '#c2b5a0', r: 0.9 })
    vysotka(k, 62, 52, 0.75, { c: '#e6dccb', r: 0.9 }, { c: '#cbbda5', r: 0.9 })
    vysotka(k, -38, 78, 0.6, { c: '#d8ccb8', r: 0.9 }, { c: '#bfb19a', r: 0.9 })
    // The television tower: a tapering concrete needle with its observation rings.
    const con: Look = { c: '#e9e6df', r: 0.9 }
    const tx = 44
    const tz = 74
    frustum(k, con, 7, 7, 8, 0.4, [tx, 0, tz])
    k.cyl(con, 0.9, 1.6, 34, [tx, 25, tz], undefined, 10)
    k.cyl(con, 0.55, 0.9, 16, [tx, 50, tz], undefined, 10)
    for (const [y, rr] of [[36, 2.6], [39, 2.2], [52, 1.6]] as const) {
      k.cyl(con, rr, rr, 1.4, [tx, y, tz], undefined, 12)
      k.cyl(DARK, rr - 0.05, rr - 0.05, 0.6, [tx, y + 1.0, tz], undefined, 12)
    }
    k.cyl({ c: '#c62828', r: 0.6 }, 0.3, 0.45, 12, [tx, 64, tz], undefined, 8)
    k.cyl(con, 0.15, 0.3, 8, [tx, 74, tz], undefined, 6)
    // The city's rooftops in bands along both sides, some crowned with domes or spires.
    const r = rand(91)
    const walls = ['#d8cdbb', '#cbbfae', '#e0d6c8', '#b9b1a6', '#d6c3b0', '#c7cdc4']
    for (const side of [-1, 1]) {
      for (let z = -40; z < 150; z += 6 + r() * 4) {
        const x = side * (30 + r() * 10)
        const w = 6 + r() * 4
        const h = 6 + r() * 10
        k.box({ c: walls[Math.floor(r() * walls.length)], r: 0.95 }, [7, h, w], [x, h / 2, z])
        k.box(SNOW, [7.1, 0.3, w + 0.1], [x, h + 0.15, z])
        const t = r()
        if (t < 0.18) {
          k.cyl({ c: '#f2eee6', r: 0.9 }, 1.0, 1.0, 2.2, [x, h + 1.1, z], undefined, 8)
          k.sphere(r() < 0.5 ? GILT : { c: '#2f5fa8', r: 0.6 }, 1.3, [x, h + 2.6, z], [1, 1.25, 1], 8, 5)
          k.cone(GILT, 0.35, 1.2, [x, h + 4.4, z], undefined, 6)
        } else if (t < 0.3) {
          k.box({ c: walls[0], r: 0.95 }, [2, 3, 2], [x, h + 1.5, z])
          k.cone({ c: '#5d6b74', r: 0.8 }, 1.3, 5, [x, h + 5.5, z], [0, Math.PI / 4, 0], 4)
        }
      }
      // A second, taller band behind.
      for (let z = -30; z < 150; z += 9 + r() * 6) {
        const x = side * (46 + r() * 12)
        const h = 12 + r() * 14
        k.box({ c: walls[Math.floor(r() * walls.length)], r: 0.95 }, [9, h, 8], [x, h / 2, z])
        k.box(SNOW, [9.1, 0.3, 8.1], [x, h + 0.15, z])
      }
    }
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
