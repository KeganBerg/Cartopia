import { useMemo } from 'react'
import { CylinderGeometry, SphereGeometry } from 'three'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Scatter, archTop, frustum, gable, prop, rand, useProp, type Look, type PropKit, type Spot } from './kit'
import type { WorldProps } from './WorldVenue'

// Italy, Ancient Arena Way: the strip runs past the ruins of the old city. Left: ochre and
// terracotta houses with green shutters and flower boxes, scooters at the kerb, then the great
// arena by the finish, its outer ring broken away on the far side. Right: the forum ruins, a
// temple's eight columns, three lone columns under their cornice, fallen drums, umbrella pines
// and cypresses. Halfway the racers drive through the triumphal arch; the great dome rises ahead.

const TRAV: Look = { c: '#e3d5b8', r: 0.95 }
const TRAV_D: Look = { c: '#c9b894', r: 0.95 }
const TRAV_L: Look = { c: '#efe5cf', r: 0.9 }
const DARK: Look = { c: '#3a2f28', r: 1 }
const ROOF: Look = { c: '#b65a38', r: 0.85 }
const SHUTTER: Look = { c: '#3f6b4a', r: 0.8 }

// A column with base and capital, standing on p, h tall.
function column(k: PropKit, x: number, y: number, z: number, r: number, h: number, look = TRAV_L) {
  k.box(look, [r * 2.6, r * 0.5, r * 2.6], [x, y + r * 0.25, z])
  k.cyl(look, r * 1.15, r * 1.2, r * 0.35, [x, y + r * 0.65, z], undefined, 12)
  k.cyl(look, r * 0.85, r, h - r * 1.6, [x, y + r * 0.8 + (h - r * 1.6) / 2, z], undefined, 12)
  k.cyl(look, r * 1.25, r * 0.9, r * 0.4, [x, y + h - r * 0.6, z], undefined, 12)
  k.box(look, [r * 2.6, r * 0.35, r * 2.6], [x, y + h - r * 0.2, z])
}

// A Roman townhouse facing +z.
// shop: what stands at the shop door on the pavement (café tables or a fruit stall).
type House = { w: number; floors: number; wall: string; shop: 'cafe' | 'fruit' | 'none'; laundry: boolean; umbrella: string }
const HOUSES: House[] = [
  { w: 3.0, floors: 4, wall: '#d99a52', shop: 'cafe', laundry: true, umbrella: '#f3ead8' },
  { w: 2.6, floors: 3, wall: '#c76f45', shop: 'fruit', laundry: false, umbrella: '' },
  { w: 3.4, floors: 4, wall: '#e6c27a', shop: 'cafe', laundry: false, umbrella: '#9b2f2a' },
  { w: 2.8, floors: 3, wall: '#d4845a', shop: 'none', laundry: false, umbrella: '' },
  { w: 3.2, floors: 5, wall: '#e0b070', shop: 'cafe', laundry: true, umbrella: '#2f5a3e' },
  { w: 2.4, floors: 4, wall: '#b9593a', shop: 'fruit', laundry: true, umbrella: '' },
]

// A four-sided pyramid of unit height and base half-diagonal 1, base at y 0.
const PYR = new CylinderGeometry(0, 1, 1, 4, 1).translate(0, 0.5, 0)

// A café table on the pavement, x across the front, z out from the wall: a marble top on an
// iron stand, bistro chairs round it and, over the first, a square canvas umbrella.
const IRON: Look = { c: '#2b2b2b', r: 0.6 }
function cafe(k: PropKit, x: number, z: number, canvas: string) {
  const top: Look = { c: '#eee8dc', r: 0.5 }
  const cane: Look = { c: '#8a5a34', r: 0.8 }
  for (const [tx, tz, t] of [[x - 0.36, z, 0]]) {
    k.cyl(IRON, 0.1, 0.11, 0.03, [tx, 0.015, tz], undefined, 8)
    k.cyl(IRON, 0.025, 0.025, 0.42, [tx, 0.23, tz], undefined, 6)
    k.cyl(top, 0.17, 0.17, 0.03, [tx, 0.455, tz], undefined, 10)
    for (const a0 of [0.6, 2.7, 4.6]) {
      const a = a0 + t
      const cx = tx + Math.cos(a) * 0.27
      const cz = tz + Math.sin(a) * 0.27
      const ry = -a - Math.PI / 2
      k.box(cane, [0.17, 0.03, 0.16], [cx, 0.27, cz], [0, ry, 0])
      k.box(cane, [0.17, 0.48, 0.025], [cx + Math.cos(a) * 0.08, 0.24, cz + Math.sin(a) * 0.08], [0, ry, 0])
      for (const [lx, lz] of [[-0.07, 0.06], [0.07, 0.06]]) {
        const c = Math.cos(-ry)
        const s = Math.sin(-ry)
        k.rod(IRON, [cx + lx * c - lz * s, 0, cz + lx * s + lz * c], [cx + lx * c - lz * s, 0.26, cz + lx * s + lz * c], 0.01, 4)
      }
    }
  }
  const cloth: Look = { c: canvas, r: 0.9 }
  k.cyl({ c: '#d9d2c2', r: 0.6 }, 0.022, 0.022, 1.3, [x - 0.36, 0.65, z], undefined, 6)
  k.cyl(IRON, 0.12, 0.14, 0.06, [x - 0.36, 0.03, z], undefined, 8)
  k.add(cloth, PYR, [x - 0.36, 1.12, z], [0, Math.PI / 4, 0], [0.62, 0.2, 0.62])
  k.box(cloth, [0.88, 0.07, 0.88], [x - 0.36, 1.085, z])
}

// A fruit and vegetable stall by the shop door under a striped awning.
function fruitStall(k: PropKit, x: number, f: number) {
  const wood: Look = { c: '#8a6440', r: 0.9 }
  k.box(wood, [0.9, 0.06, 0.42], [x, 0.5, f + 0.3])
  for (const sx of [-0.4, 0.4]) for (const sz of [0.12, 0.48]) k.box(wood, [0.04, 0.5, 0.04], [x + sx, 0.25, f + sz])
  const fruit = ['#f08a24', '#f2d43a', '#d8342a', '#5a9a3a', '#7a2f5a']
  for (let i = 0; i < 5; i++) {
    const cx = x - 0.36 + i * 0.18
    k.box({ c: '#b48a5a', r: 0.9 }, [0.16, 0.08, 0.36], [cx, 0.57, f + 0.3], [0.18, 0, 0])
    for (let j = 0; j < 2; j++) k.ico({ c: fruit[i], r: 0.7 }, 0.05, [cx + (j - 0.5) * 0.05, 0.64 - j * 0.02, f + 0.24 + j * 0.12], [1, 1, 1], 0)
  }
  // Crates stacked on the pavement in front.
  k.box({ c: '#b48a5a', r: 0.9 }, [0.3, 0.16, 0.24], [x - 0.25, 0.08, f + 0.7])
  k.box({ c: '#b48a5a', r: 0.9 }, [0.3, 0.16, 0.24], [x + 0.2, 0.08, f + 0.68])
  k.box({ c: fruit[0], r: 0.7 }, [0.26, 0.05, 0.2], [x - 0.25, 0.18, f + 0.7])
  k.box({ c: fruit[2], r: 0.7 }, [0.26, 0.05, 0.2], [x + 0.2, 0.18, f + 0.68])
  // The awning, cream and green stripes sloping out from the wall.
  for (let i = 0; i < 8; i++) k.box({ c: i % 2 ? '#3f6b4a' : '#f1e8d4', r: 0.9 }, [0.125, 0.02, 0.7], [x - 0.4375 + i * 0.125, 1.0, f + 0.34], [0.3, 0, 0])
  for (let i = 0; i < 8; i++) k.box({ c: i % 2 ? '#3f6b4a' : '#f1e8d4', r: 0.9 }, [0.125, 0.1, 0.015], [x - 0.4375 + i * 0.125, 0.85, f + 0.68])
}
function house(k: PropKit, h: House) {
  const wall: Look = { c: h.wall, r: 0.95 }
  const D = 2.6
  const H = h.floors * 1.1 + 0.3
  const f = D / 2
  k.box(wall, [h.w, H, D], [0, H / 2, 0])
  k.box(TRAV_D, [h.w + 0.04, 1.2, D + 0.04], [0, 0.6, 0])
  k.box(TRAV, [h.w + 0.06, 0.08, D + 0.06], [0, 1.22, 0])
  // Ground floor: a shop door under an arch and a café awning, or a big wooden door.
  k.box(DARK, [0.8, 0.95, 0.03], [-h.w * 0.2, 0.48, f + 0.01])
  archTop(k, DARK, 0.8, 0.03, [-h.w * 0.2, 0.95, f + 0.01])
  k.box(TRAV, [0.95, 0.06, 0.06], [-h.w * 0.2, 0.95, f + 0.02])
  k.box({ c: '#6d4a2c', r: 0.8 }, [0.55, 0.95, 0.04], [h.w * 0.25, 0.48, f + 0.012])
  k.box(TRAV, [0.7, 0.12, 0.08], [h.w * 0.25, 1.0, f + 0.03])
  k.box({ c: '#c9a24a', r: 0.4 }, [0.04, 0.04, 0.03], [h.w * 0.25 + 0.15, 0.5, f + 0.045])
  // A drainpipe down one side and an iron wall lantern between the doors.
  k.cyl({ c: '#8a5a3a', r: 0.7 }, 0.035, 0.035, H, [h.w / 2 - 0.08, H / 2, f + 0.05], undefined, 5)
  const lx = h.w * 0.025 + 0.06
  k.box(IRON, [0.04, 0.12, 0.02], [lx, 1.1, f + 0.01])
  k.rod(IRON, [lx, 1.12, f], [lx, 1.15, f + 0.24], 0.01, 4)
  k.cyl(IRON, 0.008, 0.008, 0.04, [lx, 1.13, f + 0.24], undefined, 4)
  k.cone(IRON, 0.07, 0.05, [lx, 1.085, f + 0.24], [0, Math.PI / 4, 0], 4)
  k.cyl({ c: '#f4e3a8', r: 0.4 }, 0.055, 0.04, 0.12, [lx, 1.0, f + 0.24], [0, Math.PI / 4, 0], 4)
  k.box(IRON, [0.06, 0.015, 0.06], [lx, 0.935, f + 0.24])
  if (h.shop === 'cafe') cafe(k, -h.w * 0.2, f + 0.85, h.umbrella)
  if (h.shop === 'fruit') fruitStall(k, -h.w * 0.2, f)
  // Upper floors: shuttered windows with stone sills, a balcony with flowers on the first.
  const n = Math.max(2, Math.round(h.w / 0.95))
  for (let fl = 1; fl < h.floors; fl++) for (let i = 0; i < n; i++) {
    const x = -h.w / 2 + (h.w / n) * (i + 0.5)
    const y = 1.3 + (fl - 1) * 1.1 + 0.45
    k.box(DARK, [0.34, 0.6, 0.02], [x, y, f + 0.006])
    k.box(TRAV, [0.46, 0.05, 0.1], [x, y - 0.33, f + 0.04])
    k.box(TRAV, [0.44, 0.06, 0.06], [x, y + 0.34, f + 0.02])
    const open = (i + fl) % 3 === 0
    for (const s of [-1, 1]) {
      if (open) k.box(SHUTTER, [0.17, 0.6, 0.03], [x + s * 0.27, y, f + 0.02])
      else k.box(SHUTTER, [0.17, 0.6, 0.03], [x + s * 0.085, y, f + 0.02])
      if (!open) k.box({ c: '#2f5238', r: 0.8 }, [0.15, 0.02, 0.02], [x + s * 0.085, y + 0.15, f + 0.04])
    }
    if (fl === 1 && i === 0) {
      k.box(TRAV, [h.w * 0.5, 0.06, 0.4], [x + h.w * 0.15, y - 0.36, f + 0.2])
      k.box({ c: '#2b2b2b', r: 0.5, m: 0.4 }, [h.w * 0.5, 0.03, 0.03], [x + h.w * 0.15, y - 0.05, f + 0.4])
      for (let j = 0; j < 6; j++) k.box({ c: '#2b2b2b', r: 0.5, m: 0.4 }, [0.02, 0.3, 0.02], [x + h.w * 0.15 - h.w * 0.23 + j * h.w * 0.09, y - 0.2, f + 0.4])
      for (let j = 0; j < 4; j++) k.ico({ c: j % 2 ? '#e53950' : '#f7f1e3', r: 1 }, 0.09, [x + h.w * 0.15 - h.w * 0.18 + j * h.w * 0.12, y - 0.27, f + 0.32], [1, 0.8, 1], 0)
    }
    if (h.laundry && fl === h.floors - 1 && i === 0) {
      // Washing on a line strung below the windows.
      const x1 = -h.w / 2 + (h.w / n) * 1.5
      for (const bx of [x - 0.1, x1 + 0.1]) k.box(IRON, [0.02, 0.02, 0.16], [bx, y - 0.4, f + 0.08])
      k.box({ c: '#dcdcdc', r: 0.8 }, [x1 - x + 0.2, 0.008, 0.008], [(x + x1) / 2, y - 0.4, f + 0.15])
      const wash = ['#f7f5ef', '#8fb8de', '#e8a0a8', '#f2d46a', '#f7f5ef']
      const cw = [0.16, 0.12, 0.2, 0.1, 0.14]
      let cx = x - 0.04
      for (let j = 0; j < 5 && cx + cw[j] < x1 + 0.08; j++) {
        const ch = j === 2 ? 0.16 : 0.2 - cw[j] * 0.3
        k.box({ c: wash[j], r: 0.95 }, [cw[j], ch, 0.01], [cx + cw[j] / 2, y - 0.405 - ch / 2, f + 0.15])
        if (j === 0 || j === 3) k.box({ c: wash[j], r: 0.95 }, [cw[j] + 0.1, 0.05, 0.01], [cx + cw[j] / 2, y - 0.43, f + 0.15])
        cx += cw[j] + 0.035
      }
    }
    if ((fl === 2 || fl === h.floors - 1) && i === n - 1) {
      k.box({ c: '#8a5a3a', r: 0.9 }, [0.42, 0.1, 0.12], [x, y - 0.29, f + 0.1])
      for (let j = 0; j < 3; j++) k.ico({ c: j === 1 ? '#e53950' : '#4f8a3a', r: 1 }, 0.08, [x - 0.13 + j * 0.13, y - 0.2, f + 0.12], [1, 0.8, 1], 0)
    }
  }
  // Cornice and the low terracotta roof.
  k.box(TRAV, [h.w + 0.12, 0.12, D + 0.12], [0, H + 0.02, 0])
  gable(k, ROOF, h.w + 0.2, D + 0.2, 0.6, [0, H + 0.08, 0])
  for (let i = 0; i < Math.round(h.w / 0.28); i++) k.box({ c: '#a14e30', r: 0.85 }, [0.06, 0.05, D * 0.55], [-h.w / 2 + 0.14 + i * 0.28, H + 0.38, f * 0.42], [0.43, 0, 0])
}

const BALL = new SphereGeometry(1, 10, 6)

// A scooter parked at the kerb, facing +z, x across.
function scooter(k: PropKit, c: string, x = 0, zo = 0, ry = 0) {
  const at = (p: [number, number, number]): [number, number, number] => [x + p[0] * Math.cos(ry) + p[2] * Math.sin(ry), p[1], zo - p[0] * Math.sin(ry) + p[2] * Math.cos(ry)]
  const paint: Look = { c, r: 0.35, m: 0.2 }
  const tyre: Look = { c: '#151515', r: 0.9 }
  const chrome: Look = { c: '#b8b8b8', r: 0.3, m: 0.25 }
  for (const z of [-0.38, 0.38]) {
    k.torus(tyre, 0.13, 0.05, at([0, 0.16, z]), [0, Math.PI / 2 + ry, 0], Math.PI * 2, 10, 4)
    k.cyl(chrome, 0.07, 0.07, 0.07, at([0, 0.16, z]), [0, ry, Math.PI / 2], 6)
  }
  k.add(paint, BALL, at([0, 0.36, -0.3]), [0, ry, 0], [0.2, 0.18, 0.28])
  k.box(paint, [0.24, 0.07, 0.6], at([0, 0.22, 0.05]), [0, ry, 0])
  k.box(paint, [0.3, 0.5, 0.12], at([0, 0.48, 0.38]), [0.25, ry, 0])
  k.box({ c: '#3b2a20', r: 0.7 }, [0.24, 0.07, 0.42], at([0, 0.6, -0.28]), [0, ry, 0])
  k.rod(chrome, at([0, 0.72, 0.45]), at([0, 0.95, 0.42]), 0.025, 6)
  k.rod(chrome, at([-0.24, 0.95, 0.42]), at([0.24, 0.95, 0.42]), 0.02, 6)
  k.box(paint, [0.16, 0.06, 0.16], at([0, 0.33, 0.42]), [0, ry, 0])
  k.sphere({ c: '#fff8e1', r: 0.3 }, 0.06, at([0, 0.9, 0.5]))
  k.box({ c: '#c62828', r: 0.5 }, [0.08, 0.05, 0.02], at([0, 0.38, -0.585]), [0, ry, 0])
}
// Scooters parked together at the kerb, one or two, each colour scheme its own set.
const RIDES = [['#7fc8c0'], ['#e53935', '#f2e6c8'], ['#3d6fb3', '#f0b429']]

// An umbrella pine: a tall bare trunk leaning a little, then a broad flat crown.
function pine(k: PropKit) {
  const bark: Look = { c: '#6b4f3a', r: 1 }
  k.rod(bark, [0, 0, 0], [0.4, 3.2, 0.1], 0.12, 7)
  k.rod(bark, [0.4, 3.2, 0.1], [-0.4, 4.0, 0], 0.07, 6)
  k.rod(bark, [0.4, 3.2, 0.1], [1.1, 3.9, 0.3], 0.07, 6)
  const leaf = ['#3f6b35', '#4a7a3c', '#36602f']
  ;[[0.3, 4.3, 0.1, 1.6], [-0.8, 4.15, -0.2, 1.1], [1.4, 4.1, 0.3, 1.1], [0.3, 4.15, -1.1, 1.0], [0.2, 4.1, 1.1, 1.0]].forEach(([x, y, z, r], i) => k.sphere({ c: leaf[i % 3], r: 1 }, r, [x, y, z], [1, 0.32, 1], 9, 4))
}

// A cypress: a tall, dark green flame.
function cypress(k: PropKit) {
  k.cyl({ c: '#5d4636', r: 1 }, 0.06, 0.08, 0.5, [0, 0.25, 0], undefined, 6)
  k.sphere({ c: '#2f4a2b', r: 1 }, 0.42, [0, 2.0, 0], [1, 4.2, 1], 8, 6)
  k.sphere({ c: '#36552f', r: 1 }, 0.3, [0.06, 2.6, 0.05], [1, 4.0, 1], 8, 6)
}

const CAP = new CylinderGeometry(1, 1, 1, 24)

// The arena: an elliptical outer wall of arches in four storeys (only two still stand on the
// far side), an inner ring and the seating bowl within. Centred on the origin, long axis along z.
function arena(k: PropKit) {
  const A = 16
  const B = 13
  const N = 44
  const pt = (t: number, s: number): [number, number] => [Math.cos(t) * B * s, Math.sin(t) * A * s]
  const piece = (t0: number, t1: number, s: number, y: number, h: number, look: Look, open: boolean) => {
    const [x0, z0] = pt(t0, s)
    const [x1, z1] = pt(t1, s)
    const mx = (x0 + x1) / 2
    const mz = (z0 + z1) / 2
    const len = Math.hypot(x1 - x0, z1 - z0)
    const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2
    k.box(look, [len + 0.06, h, 0.9], [mx, y + h / 2, mz], [0, ry, 0])
    // The outward normal points away from the centre.
    const nx = Math.sin(ry)
    const nz = Math.cos(ry)
    const out = mx * nx + mz * nz > 0 ? 1 : -1
    const fx = mx + nx * out * 0.46
    const fz = mz + nz * out * 0.46
    const face = out > 0 ? ry : ry + Math.PI
    if (open) {
      k.box(DARK, [len * 0.55, h * 0.5, 0.02], [fx, y + h * 0.36, fz], [0, face, 0])
      archTop(k, DARK, len * 0.55, 0.02, [fx, y + h * 0.61, fz], face)
      // Half-columns between the arches.
      k.cyl(TRAV_L, 0.13, 0.13, h * 0.86, [fx + (x1 - x0) * 0.5, y + h * 0.45, fz + (z1 - z0) * 0.5], undefined, 8)
    } else {
      k.box(DARK, [0.25, 0.35, 0.02], [fx, y + h * 0.55, fz], [0, face, 0])
    }
    k.box(TRAV_L, [len + 0.1, 0.16, 1.0], [mx, y + h - 0.02, mz], [0, ry, 0])
  }
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * Math.PI * 2
    const t1 = ((i + 1) / N) * Math.PI * 2
    const near = Math.cos((t0 + t1) / 2) < 0.15
    const storeys = near ? 4 : 2
    const ruin = !near && Math.cos((t0 + t1) / 2) < 0.4
    for (let s = 0; s < storeys; s++) piece(t0, t1, 1, s * 3, 3, TRAV, s < 3)
    if (ruin) piece(t0, t1, 1, 6, 1.4 + ((i * 7) % 5) * 0.35, TRAV_D, false)
    for (let s = 0; s < 3; s++) piece(t0, t1, 0.84, s * 2.6, 2.6, TRAV_D, true)
  }
  // The seating bowl and the arena floor.
  frustum(k, { c: '#b8a37c', r: 1 }, B * 1.6, A * 1.6, 6.5, 0.55, [0, 0, 0])
  k.add({ c: '#d8c79f', r: 1 }, CAP, [0, 6.52, 0], [0, 0, 0], [B * 0.88, 0.02, A * 0.88])
  // The flagpole masts round the very top of the standing side.
  for (let i = 0; i < N; i += 2) {
    const t = (i / N) * Math.PI * 2
    if (Math.cos(t) > 0.1) continue
    const [x, z] = pt(t, 1.03)
    k.box(TRAV_L, [0.12, 0.6, 0.12], [x, 12.3, z])
  }
}

// The triumphal arch over the road: a tall central arch and two smaller ones, columns on
// pedestals with statues above, and the attic with its inscription.
function arch(k: PropKit) {
  const W = 13
  const D = 2.8
  for (const s of [-1, 1]) {
    k.box(TRAV, [1.4, 7, D], [s * 3.0, 3.5, 0])
    k.box(TRAV, [1.4, 7, D], [s * 5.8, 3.5, 0])
    k.box(TRAV, [1.4, 2.8, D], [s * 4.4, 5.6, 0])
  }
  k.box(TRAV, [4.6, 2.2, D], [0, 5.9, 0])
  k.box(TRAV_L, [W + 0.3, 0.3, D + 0.3], [0, 7.15, 0])
  k.box(TRAV, [W, 2.4, D - 0.2], [0, 8.5, 0])
  k.box(TRAV_L, [W + 0.2, 0.25, D + 0.1], [0, 9.8, 0])
  for (const [z, ry] of [[D / 2, 0], [-D / 2, Math.PI]] as const) {
    const f = Math.sign(z)
    archTop(k, TRAV_D, 4.6, 0.03, [0, 4.8, z + f * 0.01], ry, 0.95)
    archTop(k, TRAV_D, 1.4, 0.03, [-4.4, 4.2, z + f * 0.01], ry)
    archTop(k, TRAV_D, 1.4, 0.03, [4.4, 4.2, z + f * 0.01], ry)
    k.box({ c: '#c6b38c', r: 1 }, [6, 1.6, 0.04], [0, 8.5, z + f * 0.02])
    for (let i = 0; i < 3; i++) k.box(TRAV_D, [4.8 - i * 0.6, 0.14, 0.02], [0, 8.95 - i * 0.4, z + f * 0.045])
    // Four columns on pedestals each face, a statue standing over each.
    for (const x of [-5.8, -3.0, 3.0, 5.8]) {
      k.box(TRAV_L, [0.9, 1.4, 0.7], [x, 0.7, z + f * 0.35])
      column(k, x, 1.4, z + f * 0.4, 0.28, 5.6, { c: '#e9dcc0', r: 0.8 })
      k.box(TRAV_L, [0.9, 0.3, 0.8], [x, 7.15, z + f * 0.4])
      k.box(TRAV_L, [0.6, 0.5, 0.5], [x, 7.6, z + f * 0.4])
      k.cyl({ c: '#d8ccb2', r: 0.9 }, 0.18, 0.22, 1.1, [x, 8.4, z + f * 0.4], undefined, 8)
      k.sphere({ c: '#d8ccb2', r: 0.9 }, 0.15, [x, 9.1, z + f * 0.4])
    }
    // Round carved medallions over the side arches.
    for (const x of [-4.4, 4.4]) k.cyl({ c: '#d0bf98', r: 0.9 }, 0.5, 0.5, 0.06, [x, 6.0, z + f * 0.03], [Math.PI / 2, 0, 0], 16)
  }
}

// A ruined temple front: eight columns on a high podium under a broken cornice.
function temple(k: PropKit) {
  k.box(TRAV_D, [9.6, 2.4, 5], [0, 1.2, 0])
  for (let i = 0; i < 6; i++) column(k, -4 + i * 1.6, 2.4, 1.6, 0.36, 6.2, { c: '#ece0c6', r: 0.85 })
  for (const x of [-4, 4]) column(k, x, 2.4, 0, 0.36, 6.2, { c: '#ece0c6', r: 0.85 })
  k.box(TRAV_L, [9.4, 0.8, 2.6], [0, 9.0, 0.9])
  k.box(TRAV, [9.6, 0.3, 2.8], [0, 9.55, 0.9])
  frustum(k, TRAV, 9.6, 2.8, 1.3, 0.1, [0, 9.7, 0.9])
  for (let i = 0; i < 5; i++) k.box(TRAV_D, [1.4, 0.3 + (i % 2) * 0.2, 0.8], [-3 + i * 1.6, 2.6 + (i % 2) * 0.1, -1.5], [0, i * 0.4, 0])
}

// Three tall columns standing alone under a piece of cornice.
function threeCols(k: PropKit) {
  k.box(TRAV_D, [5, 3, 2.4], [0, 1.5, 0])
  for (let i = 0; i < 3; i++) column(k, -1.6 + i * 1.6, 3, 0, 0.34, 7.6, { c: '#efe4cc', r: 0.85 })
  k.box(TRAV_L, [4.4, 0.7, 1.1], [0, 10.9, 0])
  k.box(TRAV, [4.8, 0.3, 1.3], [0, 11.4, 0])
}

// Fallen drums and blocks among the grass.
function rubble(k: PropKit) {
  k.cyl(TRAV_L, 0.4, 0.4, 0.8, [0, 0.4, 0], [0, 0, Math.PI / 2], 12)
  k.cyl(TRAV_L, 0.4, 0.4, 0.6, [1.1, 0.4, 0.4], [0, 0.6, Math.PI / 2], 12)
  k.box(TRAV, [1.2, 0.5, 0.7], [-1.0, 0.25, 0.5], [0, 0.3, 0])
  k.box(TRAV_D, [0.8, 0.4, 0.8], [0.3, 0.2, -0.9], [0, 0.9, 0])
  k.box({ c: '#b0714f', r: 1 }, [2.2, 0.9, 0.35], [-0.4, 0.45, -1.8])
}

// Ruins at the roadside on the forum side: a broken column on its plinth with a fallen drum and
// capital, or a stretch of brick wall with travertine courses and a fallen cornice block.
const BRICK: Look = { c: '#a8664a', r: 1 }
const WEED = ['#7f8f4a', '#93a058', '#6f8040']
function tufts(k: PropKit, pts: [number, number][]) {
  pts.forEach(([x, z], i) => k.cone({ c: WEED[i % 3], r: 1 }, 0.09, 0.22, [x, 0.1, z], undefined, 5))
}
function brokenColumn(k: PropKit) {
  const marble: Look = { c: '#ece2cc', r: 0.85 }
  k.box(TRAV_D, [0.8, 0.32, 0.8], [0, 0.16, 0])
  k.box(TRAV, [0.7, 0.1, 0.7], [0, 0.37, 0])
  k.cyl(marble, 0.3, 0.32, 0.12, [0, 0.48, 0], undefined, 12)
  k.cyl(marble, 0.25, 0.26, 0.7, [0, 0.89, 0], undefined, 12)
  k.cyl(marble, 0.24, 0.25, 0.42, [0, 1.45, 0], [0.05, 0.4, 0.04], 12)
  // A broken top: a jagged lump left on the drum.
  k.cyl(marble, 0.12, 0.2, 0.16, [0.06, 1.72, 0.03], [0.2, 0, 0.15], 7)
  // A fallen drum and a capital lying in the grass beside it.
  k.cyl(marble, 0.24, 0.24, 0.5, [0.15, 0.24, 0.85], [0, 0.3, Math.PI / 2], 12)
  k.box(marble, [0.5, 0.14, 0.5], [-0.1, 0.07, -0.75], [0, 0.5, 0])
  k.cyl(marble, 0.27, 0.2, 0.2, [-0.1, 0.24, -0.75], [0, 0.5, 0], 12)
  tufts(k, [[0.42, 0.1], [-0.4, 0.3], [0.38, -0.45], [-0.15, 0.55], [0.5, 1.05]])
}
function ruinWall(k: PropKit, oz = 0) {
  const at = (x: number, y: number, z: number): [number, number, number] => [x, y, z + oz]
  // Brick courses with travertine bands, an uneven broken top.
  const tops = [1.1, 1.35, 0.9, 0.6, 0.75]
  tops.forEach((h, i) => {
    const z = -0.8 + i * 0.4
    k.box(BRICK, [0.4, h, 0.4], at(0, h / 2, z))
    for (let y = 0.35; y < h - 0.1; y += 0.42) k.box(TRAV, [0.42, 0.06, 0.402], at(0, y, z))
  })
  k.box(TRAV_D, [0.5, 0.2, 2.1], at(0, 0.1, 0))
  // An arched opening once ran through it.
  k.box(DARK, [0.02, 0.4, 0.3], at(0.21, 0.42, -0.4))
  archTop(k, DARK, 0.3, 0.02, at(0.21, 0.62, -0.4), Math.PI / 2)
  // A fallen cornice block with its dentils, in front.
  k.box(TRAV_L, [0.4, 0.22, 0.8], at(0.55, 0.11, 0.35), [0, 0.25, 0])
  for (let i = 0; i < 6; i++) k.box(TRAV_L, [0.06, 0.06, 0.06], at(0.76 - i * 0.012, 0.16, 0.08 + i * 0.11), [0, 0.25, 0])
  tufts(k, [[0.3, -0.9 + oz], [-0.3, 0.2 + oz], [0.35, 0.95 + oz], [0.75, -0.3 + oz]])
  k.cone({ c: WEED[1], r: 1 }, 0.08, 0.2, at(0, 1.45, -0.4), undefined, 5)
}

// The piazza fountain: a palace front with giant columns, a sea god in the central niche, rocks
// tumbling down to a wide basin. Faces +z; the basin's straight edge is at z = -1.6.
const HALF = new CylinderGeometry(1, 1, 1, 20, 1, false, -Math.PI / 2, Math.PI)
function fountain(k: PropKit) {
  const marble: Look = { c: '#f2ede2', r: 0.7 }
  const shade: Look = { c: '#cbb995', r: 0.95 }
  const water: Look = { c: '#4aa6b8', r: 0.15 }
  const foam: Look = { c: '#e2f5f7', r: 0.3 }
  // The palace front.
  k.box(TRAV_D, [10.6, 1.0, 1.3], [0, 0.5, -4.2])
  k.box(TRAV, [10.4, 6.3, 1.0], [0, 4.15, -4.2])
  k.box(TRAV_L, [10.6, 0.5, 1.2], [0, 6.85, -4.2])
  k.box(TRAV, [10.8, 0.2, 1.35], [0, 7.2, -4.2])
  for (const x of [-3.0, -1.3, 1.3, 3.0]) column(k, x, 1.0, -3.45, 0.3, 5.6, marble)
  // The great niche and the sea god standing in it on a shell.
  k.box(shade, [2.0, 3.4, 0.04], [0, 2.7, -3.68])
  archTop(k, shade, 2.0, 0.04, [0, 4.4, -3.68])
  k.sphere(marble, 0.55, [0, 1.25, -3.3], [1.2, 0.5, 1], 12, 6, Math.PI / 2)
  k.cyl(marble, 0.22, 0.34, 1.3, [0, 1.95, -3.35], undefined, 10)
  k.sphere(marble, 0.17, [0, 2.75, -3.35], [1, 1.1, 1], 10, 8)
  k.rod(marble, [0.2, 2.45, -3.35], [0.45, 2.95, -3.2], 0.06, 6)
  k.rod(marble, [-0.2, 2.45, -3.35], [-0.35, 2.1, -3.15], 0.06, 6)
  // Side niches with statues, and windows with pediments in the outer bays.
  for (const sx of [-1, 1]) {
    k.box(shade, [0.8, 1.7, 0.04], [sx * 2.15, 2.85, -3.68])
    archTop(k, shade, 0.8, 0.04, [sx * 2.15, 3.7, -3.68])
    k.box(TRAV_L, [0.7, 0.12, 0.3], [sx * 2.15, 2.06, -3.55])
    k.cyl(marble, 0.13, 0.2, 0.9, [sx * 2.15, 2.57, -3.55], undefined, 8)
    k.sphere(marble, 0.11, [sx * 2.15, 3.11, -3.55], [1, 1.1, 1], 8, 6)
    k.box(shade, [1.6, 0.6, 0.04], [sx * 2.15, 4.9, -3.68])
    for (const y of [2.4, 5.0]) {
      k.box(DARK, [0.62, 1.05, 0.04], [sx * 4.3, y, -3.69])
      k.box(TRAV_L, [0.8, 0.08, 0.15], [sx * 4.3, y - 0.56, -3.65])
      frustum(k, TRAV_L, 0.9, 0.14, 0.3, 0.05, [sx * 4.3, y + 0.56, -3.65])
    }
    // A balustrade along the top of the outer bays.
    for (let i = 0; i < 8; i++) k.cyl(TRAV_L, 0.05, 0.07, 0.4, [sx * (3.6 + i * 0.22), 7.5, -3.95], undefined, 6)
    k.box(TRAV_L, [1.9, 0.08, 0.2], [sx * 4.37, 7.74, -3.95])
  }
  // The attic with its inscription, statues standing along it, the papal arms on top.
  k.box(TRAV, [6.2, 1.6, 0.9], [0, 8.1, -4.25])
  k.box(shade, [3.6, 0.8, 0.04], [0, 8.1, -3.79])
  for (let i = 0; i < 3; i++) k.box(TRAV_D, [3.0 - i * 0.6, 0.08, 0.02], [0, 8.35 - i * 0.22, -3.765])
  k.box(TRAV_L, [6.4, 0.16, 1.0], [0, 8.95, -4.25])
  for (const x of [-2.5, -0.95, 0.95, 2.5]) {
    k.box(TRAV_L, [0.45, 0.25, 0.45], [x, 7.42, -3.55])
    k.cyl(marble, 0.14, 0.18, 0.8, [x, 7.95, -3.55], undefined, 8)
    k.sphere(marble, 0.11, [x, 8.45, -3.55], [1, 1.1, 1], 8, 6)
  }
  k.cyl(TRAV_L, 0.55, 0.55, 0.15, [0, 9.55, -4.0], [Math.PI / 2, 0, 0], 14)
  k.box(TRAV_L, [0.3, 0.35, 0.3], [0, 10.1, -4.0])
  // The rocks, piled from the palace foot down into the water.
  k.box(TRAV_D, [10.2, 0.5, 2.2], [0, 0.25, -2.65])
  const rr = rand(404)
  for (let i = 0; i < 18; i++) {
    const x = -4.6 + (i / 17) * 9.2 + (rr() - 0.5) * 0.4
    const back = Math.abs(x) < 1.6 ? 0.3 : 1
    k.ico({ c: i % 3 ? '#d6c9a8' : '#c4b694', r: 1 }, 0.45 + rr() * 0.3, [x, 0.55 + rr() * 0.3 * back, -3.0 + rr() * 0.9], [1.3, 0.8 + rr() * 0.5, 1], 0)
  }
  // The cascade under the niche: three stepped ledges, water spilling from each.
  for (let i = 0; i < 3; i++) {
    const y = 1.0 - i * 0.24
    const z = -3.0 + i * 0.45
    k.box(TRAV_L, [2.2 - i * 0.2 + 0.6 * i, 0.12, 0.5], [0, y, z])
    k.box(water, [2.0 - i * 0.2 + 0.6 * i, 0.02, 0.44], [0, y + 0.07, z])
    k.box(foam, [1.9 - i * 0.2 + 0.6 * i, 0.24, 0.02], [0, y - 0.1, z + 0.27])
  }
  // The basin: a low half-round step, a rim of blocks and the water within.
  k.add(TRAV_D, HALF, [0, 0.075, -1.6], [0, 0, 0], [3.8, 0.15, 3.8])
  k.add(TRAV_L, HALF, [0, 0.3, -1.6], [0, 0, 0], [3.4, 0.4, 3.4])
  k.add(water, HALF, [0, 0.53, -1.6], [0, 0, 0], [3.2, 0.04, 3.2])
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / 16) * Math.PI
    k.box(TRAV_L, [0.7, 0.32, 0.26], [Math.sin(a) * 3.3, 0.66, -1.6 + Math.cos(a) * 3.3], [0, a, 0])
  }
  // Ripples where the cascade falls in, and two stone benches facing the fountain.
  for (const [x, z, r] of [[0, -2.05, 0.5], [-0.7, -1.9, 0.3], [0.8, -1.95, 0.35]] as const) k.cyl(foam, r, r, 0.01, [x, 0.556, z], undefined, 10)
  for (const sx of [-1, 1]) {
    k.box(TRAV_L, [1.4, 0.08, 0.4], [sx * 4.3, 0.42, 1.2])
    for (const dx of [-0.5, 0.5]) k.box(TRAV_D, [0.2, 0.38, 0.32], [sx * 4.3 + dx, 0.19, 1.2])
  }
}

export default function Rome({ len, race }: WorldProps) {
  const homes = useMemo(() => HOUSES.map((h, i) => prop(`rome-house-${i}`, (k) => house(k, h))), [])
  const scooters = useMemo(() => RIDES.map((cs, i) => prop(`rome-scooters-${i}`, (k) => cs.forEach((c, j) => scooter(k, c, j * 0.55, j * 0.08, j * 0.12)))), [])
  const ruinP = useProp('rome-roadside-ruin', (k) => {
    brokenColumn(k)
    ruinWall(k, 2.6)
  })
  const fountainP = useProp('rome-fountain', fountain)
  const pineP = useProp('rome-pine', pine)
  const cypP = useProp('rome-cypress', cypress)
  const arenaP = useProp('rome-arena', arena)
  const archP = useProp('rome-arch', arch)
  const templeP = useProp('rome-temple', temple)
  const colsP = useProp('rome-cols', threeCols)
  const rubbleP = useProp('rome-rubble', rubble)
  const az = race + 14
  const gz = race * 0.5
  const tz = race * 0.3
  const cz = race * 0.72
  const fz = race * 0.22

  const geo = useMemo(() => {
    const r = rand(917)
    const rows: Spot[][] = HOUSES.map(() => [])
    const rides: Spot[][] = RIDES.map(() => [])
    for (let z = -14; z < len + 40;) {
      const i = Math.floor(r() * HOUSES.length)
      const h = HOUSES[i]
      const zc = z + h.w / 2
      if (Math.abs(zc - gz) > 7.5 + h.w / 2 && Math.abs(zc - az) > 20 + h.w / 2 && Math.abs(zc - fz) > 5.2 + h.w / 2) {
        rows[i].push({ x: EDGE + 1.5 + 1.3, z: zc, ry: -Math.PI / 2 })
        // Scooters park clear of the café tables and fruit stalls at the shop door.
        const dz = h.shop === 'none' ? (r() - 0.5) * h.w * 0.6 : h.w * 0.2
        if (r() < 0.4) rides[Math.floor(r() * RIDES.length)].push({ x: EDGE + 0.7, z: zc + dz, ry: Math.PI / 2 + (r() - 0.5) * 0.4 })
      }
      z += h.w + 0.02
    }
    const pines: Spot[] = []
    const cyps: Spot[] = []
    const rubbles: Spot[] = []
    for (let z = -10; z < len + 50; z += 3 + r() * 5) {
      if (Math.abs(z - gz) < 8) continue
      const x = -(EDGE + 2 + r() * 14)
      if (Math.abs(z - tz) < 7 && x > -(EDGE + 12) || Math.abs(z - cz) < 5 && x > -(EDGE + 9)) continue
      const k = r()
      if (k < 0.35) pines.push({ x, z, ry: r() * 6, s: 0.9 + r() * 0.3 })
      else if (k < 0.7) cyps.push({ x, z, ry: r() * 6, s: 0.85 + r() * 0.4 })
      else rubbles.push({ x, z, ry: r() * 6 })
    }
    for (let z = az - 22; z < az + 24; z += 4.5) cyps.push({ x: EDGE + 2.4, z, ry: 0, s: 1.05 })
    for (let z = -10; z < len + 50; z += 6 + r() * 6) {
      const x = EDGE + 8 + r() * 6
      if (Math.abs(z - fz) > 9) pines.push({ x, z, ry: r() * 6, s: 1 + r() * 0.3 })
    }
    // Broken columns and stretches of ruined wall at the roadside on the forum side.
    const ruins: Spot[] = []
    for (let z = 4; z < len + 40; z += 10 + r() * 8) {
      if (Math.abs(z - gz) < 10) continue
      ruins.push({ x: -(EDGE + 0.95), z, ry: r() < 0.5 ? 0 : Math.PI, s: 0.9 + r() * 0.2 })
    }
    const rr = rand(17)
    const grass = Array.from({ length: 360 }, () => ({ x: -(EDGE + 0.3 + rr() * 16), z: rr() * (len + 60) - 14, s: 0.7 + rr() * 0.6, ry: rr() * 6 }))
    return { rows, rides, pines, cyps, rubbles, grass, ruins }
  }, [len, gz, az, tz, cz, fz])

  return (
    <>
      <Batch version={`rome:${len}`} cell={24}>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 0.8, 0.012, len / 2 + 5]}>
          <planeGeometry args={[1.6, len + 60]} />
          <meshStandardMaterial color="#8d8378" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 16, 0.013, az]}>
          <planeGeometry args={[30, 40]} />
          <meshStandardMaterial color="#cdbb9c" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 5, 0.016, fz]}>
          <planeGeometry args={[10, 10.4]} />
          <meshStandardMaterial color="#c9bba0" />
        </mesh>
        <group position={[EDGE + 5.2, 0, fz]} rotation-y={-Math.PI / 2}><PropMesh parts={fountainP} /></group>
        <group position={[EDGE + 17, 0, az]}><PropMesh parts={arenaP} /></group>
        <group position={[0, 0, gz]}><PropMesh parts={archP} /></group>
        <group position={[-(EDGE + 7), 0, tz]} rotation-y={Math.PI / 2}><PropMesh parts={templeP} /></group>
        <group position={[-(EDGE + 5), 0, cz]} rotation-y={Math.PI / 2}><PropMesh parts={colsP} /></group>
        <Scatter spots={geo.grass} colors={['#9aa25a', '#8a9650', '#a9ad66']}>
          <coneGeometry args={[0.06, 0.24, 3]} />
        </Scatter>
      </Batch>
      {homes.map((h, i) => <Many key={i} parts={h} at={geo.rows[i]} />)}
      {scooters.map((s, i) => <Many key={i} parts={s} at={geo.rides[i]} />)}
      <Many parts={pineP} at={geo.pines} />
      <Many parts={cypP} at={geo.cyps} />
      <Many parts={rubbleP} at={geo.rubbles} />
      <Many parts={ruinP} at={geo.ruins} />
      <FarRome />
    </>
  )
}

// The great dome far ahead: a drum ringed with paired columns, the ribbed dome and its lantern.
function FarRome() {
  const parts = useProp('rome-far', (k) => {
    const x = -14
    const z = 100
    const stone: Look = { c: '#e8dcc4', r: 0.9 }
    const lead: Look = { c: '#9aa7a6', r: 0.6, m: 0.3 }
    k.box(stone, [34, 12, 18], [x, 6, z])
    k.box(stone, [14, 4, 18.5], [x, 14, z])
    frustum(k, stone, 14, 2, 3, 0.05, [x, 16, z - 8.3])
    for (let i = 0; i < 10; i++) k.cyl({ c: '#f1e7d2', r: 0.85 }, 0.5, 0.55, 10, [x - 13.5 + i * 3, 6, z - 9.2], undefined, 10)
    k.cyl(stone, 8, 8, 6, [x, 19, z], undefined, 24)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      k.cyl({ c: '#f1e7d2', r: 0.85 }, 0.3, 0.3, 6, [x + Math.sin(a) * 8.2, 19, z + Math.cos(a) * 8.2], undefined, 8)
    }
    k.sphere(lead, 8, [x, 22, z], [1, 1.2, 1], 24, 12, Math.PI / 2)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      k.box({ c: '#d8d2c4', r: 0.8 }, [0.3, 0.3, 0.3], [x + Math.sin(a) * 6.6, 27.4, z + Math.cos(a) * 6.6])
    }
    k.cyl(stone, 1.6, 1.8, 3, [x, 32.6, z], undefined, 12)
    k.sphere(lead, 1.6, [x, 34, z], [1, 1.3, 1], 12, 8, Math.PI / 2)
    k.cyl({ c: '#d9a63a', r: 0.3, m: 0.7 }, 0.12, 0.2, 2.2, [x, 37, z], undefined, 6)
    // Hills with cypress lines on the other side.
    for (const [hx, hz, s] of [[30, 90, 14], [52, 104, 20], [80, 92, 16]]) k.sphere({ c: '#7f9a5a', r: 1 }, s, [hx, -s * 0.55, hz], [1.6, 1, 1], 14, 6, Math.PI / 2)
    for (let i = 0; i < 18; i++) k.sphere({ c: '#2f4a2b', r: 1 }, 0.8, [22 + i * 2.6, 5 + Math.sin(i * 0.5) * 1.5, 86 + i * 0.6], [1, 3.6, 1], 8, 6)
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
