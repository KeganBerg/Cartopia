import { useMemo } from 'react'
import { CylinderGeometry, PlaneGeometry, SphereGeometry } from 'three'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Scatter, archTop, frustum, gable, person, prop, rand, useProp, type Dress, type Look, type PropKit, type Spot, type V3 } from './kit'
import type { WorldProps } from './WorldVenue'

// Italy, Ancient Arena Way: the strip runs past the ruins of the old city. Left: ochre and
// terracotta houses with green shutters, flower boxes and painted shop signs, cafés, fruit
// stalls, scooters and little city cars at the kerb, taller palazzi, church domes and bell
// towers behind; a cobbled piazza with an obelisk beside the arch, the great stairway with its
// twin-towered church near the finish, then the arena with carriages and gladiators. Right: the
// forum behind its railing, the old paved way, columns, a round temple, brick arcades, lamps,
// benches, newsstands and gelato carts at the kerb, and the green hill of palace ruins and
// umbrella pines behind. Halfway the racers drive through the triumphal arch; domes, a white
// marble monument and a castle drum stand on the skyline ahead.

const TRAV: Look = { c: '#e3d5b8', r: 0.95 }
const TRAV_D: Look = { c: '#c9b894', r: 0.95 }
const TRAV_L: Look = { c: '#efe5cf', r: 0.9 }
const DARK: Look = { c: '#3a2f28', r: 1 }
const ROOF: Look = { c: '#b65a38', r: 0.85 }
const SHUTTER: Look = { c: '#3f6b4a', r: 0.8 }
const LEAD: Look = { c: '#8e9b9b', r: 0.6 }
const GILT: Look = { c: '#c9a24a', r: 0.45 }

// A local frame: (u across, y up, w forward) from a spot at (ox, oz) turned ry, matching how
// the scene turns a group (x' = x cos + z sin, z' = -x sin + z cos).
type At = (u: number, y: number, w: number) => V3
const frame = (ox: number, oz: number, ry = 0, oy = 0): At => {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  return (u, y, w) => [ox + u * c + w * s, oy + y, oz - u * s + w * c]
}
const ID = frame(0, 0)

// A flat w by h panel facing +z turned ry (lettering, window recesses, paving): two triangles
// where a box would be twelve. tilt -PI/2 lays it face up.
const PLANE = new PlaneGeometry(1, 1)
const flat = (k: PropKit, look: Look, w: number, h: number, p: V3, ry = 0, tilt = 0) => k.add(look, PLANE, p, [tilt, ry, 0], [w, h, 1])

// A painted name in strokes, like shop lettering: wid wide and h tall, centred on (u0, y0) on
// the plane facing +w at w0 in frame `at` (turned ry). Abstract letters, nothing readable.
function lettering(k: PropKit, look: Look, at: At, ry: number, u0: number, y0: number, w0: number, wid: number, h: number, seed: number) {
  const r = rand(seed)
  const n = Math.max(3, Math.round(wid / (h * 0.8)))
  const cw = wid / n
  const sw = h * 0.2
  const bar = (u: number, y: number, bw: number, bh: number) => flat(k, look, bw, bh, at(u, y, w0), ry)
  for (let i = 0; i < n; i++) {
    const cu = u0 - wid / 2 + cw * (i + 0.5)
    const l = cu - cw * 0.24
    const rr = cu + cw * 0.24
    const top = y0 + h / 2 - sw / 2
    const bot = y0 - h / 2 + sw / 2
    const kind = Math.floor(r() * 5)
    bar(l, y0, sw, h)
    if (kind === 0) {
      bar(cu, top, cw * 0.48 + sw, sw)
      bar(cu - cw * 0.05, y0, cw * 0.38, sw)
      if (r() < 0.5) bar(cu, bot, cw * 0.48 + sw, sw)
    } else if (kind === 1) {
      bar(rr, y0, sw, h)
      bar(cu, y0, cw * 0.48, sw)
    } else if (kind === 2) {
      bar(cu, bot, cw * 0.48 + sw, sw)
    } else if (kind === 3) {
      bar(rr, y0, sw, h)
      bar(cu, top, cw * 0.48 + sw, sw)
    } else {
      bar(rr, y0, sw, h)
      bar(cu, top, cw * 0.48 + sw, sw)
      bar(cu, bot, cw * 0.48 + sw, sw)
    }
  }
}

// A column with base and capital, standing on p, h tall.
function column(k: PropKit, x: number, y: number, z: number, r: number, h: number, look = TRAV_L, seg = 12) {
  k.box(look, [r * 2.6, r * 0.5, r * 2.6], [x, y + r * 0.25, z])
  k.cyl(look, r * 1.15, r * 1.2, r * 0.35, [x, y + r * 0.65, z], undefined, seg)
  k.cyl(look, r * 0.85, r, h - r * 1.6, [x, y + r * 0.8 + (h - r * 1.6) / 2, z], undefined, seg)
  k.cyl(look, r * 1.25, r * 0.9, r * 0.4, [x, y + h - r * 0.6, z], undefined, seg)
  k.box(look, [r * 2.6, r * 0.35, r * 2.6], [x, y + h - r * 0.2, z])
}

// A column snapped off at height h, a jagged stump of drum left on top.
function stump(k: PropKit, x: number, y: number, z: number, r: number, h: number, look = TRAV_L) {
  k.box(look, [r * 2.6, r * 0.5, r * 2.6], [x, y + r * 0.25, z])
  k.cyl(look, r * 1.15, r * 1.2, r * 0.35, [x, y + r * 0.65, z], undefined, 10)
  k.cyl(look, r * 0.92, r, h - r * 0.8, [x, y + r * 0.8 + (h - r * 0.8) / 2, z], undefined, 10)
  k.cyl(look, r * 0.4, r * 0.85, r * 0.6, [x + r * 0.15, y + h + r * 0.25, z], [0.25, 0.4, 0.2], 6)
}

// A Roman townhouse facing +z.
// shop: what stands at the shop door on the pavement (café tables or a fruit stall).
// sign: a painted blade sign over the door (board, letters); houses without one have a balcony.
type House = { w: number; floors: number; wall: string; shop: 'cafe' | 'fruit' | 'none'; laundry: boolean; umbrella: string; sign?: [string, string]; ivy?: boolean }
const HOUSES: House[] = [
  { w: 3.0, floors: 4, wall: '#d99a52', shop: 'cafe', laundry: true, umbrella: '#f3ead8', sign: ['#2f5a3e', '#f1e2b0'] },
  { w: 2.6, floors: 3, wall: '#c76f45', shop: 'fruit', laundry: false, umbrella: '' },
  { w: 3.4, floors: 4, wall: '#e6c27a', shop: 'cafe', laundry: false, umbrella: '#9b2f2a', sign: ['#7a1f1f', '#f3e3c0'] },
  { w: 2.8, floors: 3, wall: '#d4845a', shop: 'none', laundry: false, umbrella: '' },
  { w: 3.2, floors: 5, wall: '#e0b070', shop: 'cafe', laundry: true, umbrella: '#2f5a3e' },
  { w: 2.4, floors: 4, wall: '#b9593a', shop: 'fruit', laundry: true, umbrella: '', sign: ['#1f3550', '#e8d8a8'] },
  { w: 3.0, floors: 4, wall: '#e3a596', shop: 'none', laundry: false, umbrella: '', sign: ['#3b2a20', '#e9c46a'], ivy: true },
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
  // The café's name along the valance.
  lettering(k, { c: canvas === '#f3ead8' ? '#7a1f1f' : '#f3ead8', r: 0.9 }, ID, 0, x - 0.36, 1.085, z + 0.445, 0.56, 0.04, Math.round(x * 100) + 7)
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
  // A painted blade sign on an iron bracket above the lantern, lettered on both faces.
  if (h.sign) {
    const [board, ink] = h.sign
    const sx = -h.w / 2 + h.w / Math.max(2, Math.round(h.w / 0.95))
    k.rod(IRON, [sx, 1.76, f], [sx, 1.76, f + 0.66], 0.012, 4)
    k.rod(IRON, [sx, 1.5, f], [sx, 1.74, f + 0.3], 0.008, 4)
    k.box({ c: board, r: 0.8 }, [0.03, 0.3, 0.5], [sx, 1.56, f + 0.38])
    k.box(GILT, [0.036, 0.02, 0.52], [sx, 1.715, f + 0.38])
    for (const s of [-1, 1]) lettering(k, { c: ink, r: 0.8 }, frame(sx, f + 0.38, (s * Math.PI) / 2), (s * Math.PI) / 2, 0, 1.56, 0.019, 0.38, 0.1, h.w * 31 + s)
  }
  // The marble street plaque by the corner, its name cut in dark strokes.
  k.box({ c: '#f2efe8', r: 0.6 }, [0.32, 0.11, 0.012], [h.w / 2 - 0.36, 1.33, f + 0.006])
  lettering(k, { c: '#3a3a3a', r: 0.9 }, ID, 0, h.w / 2 - 0.36, 1.345, f + 0.014, 0.24, 0.035, h.w * 13)
  k.box({ c: '#3a3a3a', r: 0.9 }, [0.12, 0.012, 0.006], [h.w / 2 - 0.36, 1.302, f + 0.014])
  // Ivy climbing the left of the front.
  if (h.ivy) {
    const ivy = ['#3f6a34', '#4f7d3c', '#365c2e']
    for (let y = 0.25, i = 0; y < H - 0.2; y += 0.32, i++) {
      const sx = -h.w / 2 + 0.18 + ((i * 37) % 5) * 0.05
      k.ico({ c: ivy[i % 3], r: 1 }, 0.2 - (y / H) * 0.06, [sx, y, f + 0.03], [1.1, 1, 0.3], 0)
      if (i % 2) k.ico({ c: ivy[(i + 1) % 3], r: 1 }, 0.13, [sx + 0.24, y + 0.12, f + 0.025], [1, 1, 0.3], 0)
    }
  }
  // Upper floors: shuttered windows with stone sills, a balcony with flowers on the first.
  const n = Math.max(2, Math.round(h.w / 0.95))
  for (let fl = 1; fl < h.floors; fl++) for (let i = 0; i < n; i++) {
    const x = -h.w / 2 + (h.w / n) * (i + 0.5)
    const y = 1.3 + (fl - 1) * 1.1 + 0.45
    flat(k, DARK, 0.34, 0.6, [x, y, f + 0.004])
    k.box(TRAV, [0.46, 0.05, 0.1], [x, y - 0.33, f + 0.04])
    k.box(TRAV, [0.44, 0.06, 0.06], [x, y + 0.34, f + 0.02])
    const open = (i + fl) % 3 === 0
    for (const s of [-1, 1]) {
      if (open) k.box(SHUTTER, [0.17, 0.6, 0.03], [x + s * 0.27, y, f + 0.02])
      else k.box(SHUTTER, [0.17, 0.6, 0.03], [x + s * 0.085, y, f + 0.02])
      if (!open) k.box({ c: '#2f5238', r: 0.8 }, [0.15, 0.02, 0.02], [x + s * 0.085, y + 0.15, f + 0.04])
    }
    if (fl === 1 && i === 0 && !h.sign) {
      k.box(TRAV, [h.w * 0.5, 0.06, 0.4], [x + h.w * 0.15, y - 0.36, f + 0.2])
      k.box(IRON, [h.w * 0.5, 0.03, 0.03], [x + h.w * 0.15, y - 0.05, f + 0.4])
      for (let j = 0; j < 6; j++) k.box(IRON, [0.02, 0.3, 0.02], [x + h.w * 0.15 - h.w * 0.23 + j * h.w * 0.09, y - 0.2, f + 0.4])
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
  // A chimney pot or two on the back slope, and a television aerial.
  for (const cx of h.floors > 3 ? [h.w * 0.3, -h.w * 0.32] : [h.w * 0.28]) {
    k.box({ c: h.wall, r: 0.95 }, [0.2, 0.62, 0.2], [cx, H + 0.62, -0.55])
    k.box(TRAV, [0.26, 0.05, 0.26], [cx, H + 0.95, -0.55])
    k.box(ROOF, [0.24, 0.04, 0.12], [cx, H + 1.0, -0.55])
  }
  k.rod(IRON, [-h.w * 0.12, H + 0.6, -0.1], [-h.w * 0.12, H + 1.35, -0.1], 0.012, 4)
  for (const [y, l] of [[1.3, 0.42], [1.18, 0.32], [1.06, 0.22]]) k.box(IRON, [l, 0.012, 0.012], [-h.w * 0.12, H + y, -0.1], [0, 0.5, 0])
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
// A six-sided half-round arch top facing +z, for the arena's hundreds of arches.
const ARCH6 = new CylinderGeometry(1, 1, 1, 6, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2)

// The arena: an elliptical outer wall of arches in four storeys (only two still stand on the
// far side), an inner ring and the seating bowl within. Centred on the origin, long axis along z.
function arena(k: PropKit) {
  const A = 16
  const B = 13
  const N = 44
  const pt = (t: number, s: number): [number, number] => [Math.cos(t) * B * s, Math.sin(t) * A * s]
  const piece = (t0: number, t1: number, s: number, y: number, h: number, look: Look, open: boolean, deco = true) => {
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
      flat(k, DARK, len * 0.55, h * 0.5, [fx, y + h * 0.36, fz], face)
      k.add(DARK, ARCH6, [fx, y + h * 0.61, fz], [0, face, 0], [len * 0.275, len * 0.275, 0.02])
      // Half-columns between the arches.
      k.cyl(TRAV_L, 0.13, 0.13, h * 0.86, [fx + (x1 - x0) * 0.5, y + h * 0.45, fz + (z1 - z0) * 0.5], undefined, 8)
    } else if (deco) {
      flat(k, DARK, 0.25, 0.35, [fx, y + h * 0.55, fz], face)
    }
    if (deco) k.box(TRAV_L, [len + 0.1, 0.16, 1.0], [mx, y + h - 0.02, mz], [0, ry, 0])
  }
  for (let i = 0; i < N; i++) {
    const t0 = (i / N) * Math.PI * 2
    const t1 = ((i + 1) / N) * Math.PI * 2
    const near = Math.cos((t0 + t1) / 2) < 0.15
    const storeys = near ? 4 : 2
    const ruin = !near && Math.cos((t0 + t1) / 2) < 0.4
    // Only the arches that face the road are cut; the far side and the inner ring are seen
    // from nowhere but the sky.
    for (let s = 0; s < storeys; s++) piece(t0, t1, 1, s * 3, 3, TRAV, near && s < 3, near || s === storeys - 1)
    if (ruin) piece(t0, t1, 1, 6, 1.4 + ((i * 7) % 5) * 0.35, TRAV_D, false)
    for (let s = 0; s < 3; s++) piece(t0, t1, 0.84, s * 2.6, 2.6, TRAV_D, !near && s === 2, s === 2)
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

// People at true size, in clusters of two or three built into one prop each.
const P = 1.3
const pAt = (x: number, z: number, ry: number) => {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  return (u: number, y: number, w: number): V3 => [x + (u * c + w * s) * P, y * P, z + (-u * s + w * c) * P]
}
type Who = { d: Dress; x: number; z: number; ry: number }
const SKIN = { a: '#f0c8a8', b: '#e3b28e', c: '#c99a74', d: '#a8724e' }
function crowd(k: PropKit, who: Who[], extra?: (w: Who, a: ReturnType<typeof pAt>, i: number) => void) {
  who.forEach((w, i) => {
    person(k, w.d, w.x, w.z, w.ry)
    extra?.(w, pAt(w.x, w.z, w.ry), i)
  })
}
const INK: Look = { c: '#1a1a1a', r: 0.9 }
const WHITE: Look = { c: '#f6f4ee', r: 0.8 }
type Cluster = (k: PropKit) => void
const CLUSTERS: Record<string, Cluster> = {
  // Tourists: a man in a cap with his camera up, a woman in a summer skirt, a friend waving.
  tourists: (k) => crowd(k, [
    { d: { top: '#f2efe6', low: '#3d5a80', skin: SKIN.a, hair: '#c9a46a', hat: 'cap', hatC: '#d64545' }, x: -0.26, z: 0.08, ry: 0.5 },
    { d: { top: '#e0607e', low: '#f2e8d2', skin: SKIN.b, hair: '#4a2e1e', robe: true }, x: 0.06, z: -0.2, ry: -0.3 },
    { d: { top: '#5aa0d8', low: '#4b4b4b', skin: SKIN.c, hair: '#1e1a16', wave: true }, x: 0.3, z: 0.16, ry: -0.6 },
  ], (w, a, i) => {
    if (i === 0) k.box(INK, [0.09, 0.06, 0.05], a(0, 0.47, 0.1), [0, w.ry, 0])
    if (i === 1) k.box({ c: '#c9a46a', r: 0.9 }, [0.06, 0.09, 0.03], a(-0.13, 0.24, 0), [0, w.ry, 0])
  }),
  // A priest in his wide black hat, and two sisters, one in black, one in white.
  clergy: (k) => crowd(k, [
    { d: { top: '#16161a', low: '#16161a', skin: SKIN.b, hair: '#9a9a9a', robe: true }, x: -0.22, z: 0, ry: 0.4 },
    { d: { top: '#1c1c22', low: '#1c1c22', skin: SKIN.a, hair: '#1c1c22', robe: true, hat: 'scarf', hatC: '#1c1c22' }, x: 0.12, z: 0.22, ry: -0.5 },
    { d: { top: '#f2efe6', low: '#f2efe6', skin: SKIN.c, hair: '#1c1c22', robe: true, hat: 'scarf', hatC: '#24242a' }, x: 0.3, z: -0.16, ry: -0.9 },
  ], (w, a, i) => {
    if (i === 0) {
      k.box(WHITE, [0.03 * P, 0.018 * P, 0.01 * P], a(0, 0.53, 0.036), [0, w.ry, 0])
      k.cyl(INK, 0.14 * P, 0.14 * P, 0.012 * P, a(0, 0.665, -0.005), [0, w.ry, 0], 10)
      k.sphere(INK, 0.075 * P, a(0, 0.67, -0.005), [1, 0.8, 1], 8, 3, Math.PI / 2)
    } else {
      k.box(WHITE, [0.13 * P, 0.022 * P, 0.012 * P], a(0, 0.665, 0.066), [0, w.ry, 0])
      k.box(WHITE, [0.12 * P, 0.05 * P, 0.03 * P], a(0, 0.53, 0.05), [0, w.ry, 0])
    }
  }),
  // Locals: an old man in a flat cap, a signora with her shopping, a man in a suit.
  locals: (k) => crowd(k, [
    { d: { top: '#8a7a62', low: '#3f3f46', skin: SKIN.c, hair: '#d0d0d0', hat: 'cap', hatC: '#5b5248' }, x: -0.24, z: -0.05, ry: 0.7 },
    { d: { top: '#7a2f4a', low: '#2e2e3a', skin: SKIN.a, hair: '#d8d8d8', robe: true }, x: 0.1, z: 0.2, ry: -0.8 },
    { d: { top: '#2e3a4e', low: '#2e3a4e', skin: SKIN.b, hair: '#1e1a16' }, x: 0.22, z: -0.22, ry: -1.6 },
  ], (w, a, i) => {
    if (i === 1) k.box({ c: '#e9e1cf', r: 0.9 }, [0.08 * P, 0.1 * P, 0.04 * P], a(-0.13, 0.22, 0), [0, w.ry, 0])
    if (i === 1) k.ico({ c: '#5a9a3a', r: 1 }, 0.035 * P, a(-0.13, 0.29, 0), [1, 1, 1], 0)
    if (i === 2) k.box({ c: '#f2efe6', r: 0.8 }, [0.05 * P, 0.1 * P, 0.01 * P], a(0, 0.45, 0.076), [0, w.ry, 0])
  }),
  // A young couple with gelato cones.
  gelato: (k) => crowd(k, [
    { d: { top: '#f2d46a', low: '#3d5a80', skin: SKIN.b, hair: '#3a2a1e' }, x: -0.14, z: 0, ry: 0.9 },
    { d: { top: '#9fd3c7', low: '#ece3cf', skin: SKIN.a, hair: '#7a4a2a', robe: true }, x: 0.16, z: 0.05, ry: -0.9 },
  ], (_w, a, i) => {
    const h = a(0.12, 0.29, 0.01)
    k.cone({ c: '#d8a85a', r: 0.9 }, 0.024 * P, 0.08 * P, [h[0], h[1] + 0.06, h[2]], [Math.PI, 0, 0], 6)
    k.sphere({ c: i ? '#f3a6c0' : '#f5e9c8', r: 0.8 }, 0.032 * P, [h[0], h[1] + 0.12, h[2]], [1, 1, 1], 6, 4)
  }),
  // A waiter in his white shirt and long apron, a tray held high, and a customer.
  cafe: (k) => crowd(k, [
    { d: { top: '#f7f5ef', low: '#1a1a1a', skin: SKIN.c, hair: '#1a1410', wave: true }, x: -0.1, z: 0, ry: 0.3 },
    { d: { top: '#c96a3a', low: '#5a5a62', skin: SKIN.a, hair: '#6a4a2a' }, x: 0.22, z: 0.12, ry: -1.3 },
  ], (w, a, i) => {
    if (i) return
    k.box(WHITE, [0.16 * P, 0.22 * P, 0.012 * P], a(0, 0.19, 0.07), [0, w.ry, 0])
    k.box(INK, [0.05 * P, 0.02 * P, 0.012 * P], a(0, 0.525, 0.04), [0, w.ry, 0])
    k.cyl({ c: '#c8c8c8', r: 0.4 }, 0.1 * P, 0.1 * P, 0.008 * P, a(0.16, 0.765, 0.02), undefined, 10)
    for (const [u, c] of [[0.13, '#7a1f2a'], [0.2, '#f2d46a']] as const) k.cyl({ c, r: 0.3 }, 0.014 * P, 0.012 * P, 0.05 * P, a(u, 0.795, 0.02 + (u - 0.16)), undefined, 6)
  }),
  // A man dressed as a legionary for the tourists: red tunic, gilt helmet and crest, shield and
  // sword; a tourist poses with him.
  gladiator: (k) => crowd(k, [
    { d: { top: '#a82222', low: SKIN.c, skin: SKIN.c, hair: '#2a1e16', hat: 'cap', hatC: '#c9a24a', sash: '#6b4a2a' }, x: -0.12, z: 0, ry: 0.4 },
    { d: { top: '#f2a03a', low: '#3d5a80', skin: SKIN.a, hair: '#d8b06a', wave: true }, x: 0.2, z: 0.05, ry: -0.2 },
  ], (w, a, i) => {
    if (i) return
    k.box({ c: '#c62828', r: 0.9 }, [0.025 * P, 0.07 * P, 0.17 * P], a(0, 0.735, -0.01), [0, w.ry, 0])
    k.box({ c: '#a82222', r: 0.8 }, [0.2 * P, 0.3 * P, 0.025 * P], a(-0.13, 0.36, 0.1), [0, w.ry - 0.4, 0])
    k.box(GILT, [0.05 * P, 0.05 * P, 0.012 * P], a(-0.13, 0.36, 0.115), [0, w.ry - 0.4, 0])
    k.rod({ c: '#d0d0d0', r: 0.4 }, a(0.12, 0.29, 0.01), a(0.12, 0.33, 0.24), 0.008 * P, 4)
    k.box({ c: '#a82222', r: 0.9 }, [0.17 * P, 0.1 * P, 0.15 * P], a(0, 0.24, 0), [0, w.ry, 0])
  }),
}

// A little city car parked at the kerb, rounded and boxy, facing +z. 0.84 wide, 1.75 long.
function cityCar(k: PropKit, c: string, taxi = false) {
  const paint: Look = { c, r: 0.4, m: 0.2 }
  const glass: Look = { c: '#2c3e4c', r: 0.2 }
  const tyre: Look = { c: '#161616', r: 0.9 }
  const chrome: Look = { c: '#cfcfcf', r: 0.3, m: 0.25 }
  const W = 0.84
  const L = 1.75
  k.box(paint, [W, 0.32, L], [0, 0.36, 0])
  k.add(paint, BALL, [0, 0.44, 0.62], [0, 0, 0], [W / 2 - 0.01, 0.12, 0.28])
  k.add(paint, BALL, [0, 0.44, -0.66], [0, 0, 0], [W / 2 - 0.01, 0.12, 0.22])
  k.box(paint, [W - 0.1, 0.3, 0.9], [0, 0.66, -0.1])
  k.box(glass, [W - 0.14, 0.22, 0.92], [0, 0.66, -0.1])
  k.box(glass, [W - 0.08, 0.2, 0.8], [0, 0.665, -0.1])
  k.box(paint, [W - 0.07, 0.22, 0.06], [0, 0.66, -0.08])
  k.box(paint, [W - 0.08, 0.05, 0.94], [0, 0.825, -0.1])
  k.box({ c: '#3a3530', r: 0.9 }, [0.46, 0.015, 0.5], [0, 0.855, -0.12])
  for (const sx of [-1, 1]) {
    for (const sz of [-0.56, 0.56]) {
      k.cyl(tyre, 0.16, 0.16, 0.12, [sx * (W / 2 - 0.04), 0.16, sz], [0, 0, Math.PI / 2], 9)
      k.cyl(chrome, 0.08, 0.08, 0.125, [sx * (W / 2 - 0.04), 0.16, sz], [0, 0, Math.PI / 2], 7)
    }
    k.cyl({ c: '#fff6d8', r: 0.3 }, 0.055, 0.055, 0.03, [sx * 0.26, 0.45, L / 2 + 0.005], [Math.PI / 2, 0, 0], 8)
    k.box({ c: '#c62828', r: 0.5 }, [0.1, 0.07, 0.02], [sx * 0.3, 0.42, -L / 2 - 0.005])
    k.box(paint, [0.02, 0.012, 0.08], [sx * (W / 2 + 0.005), 0.5, 0.05])
  }
  for (const sz of [-1, 1]) k.box(chrome, [W + 0.02, 0.05, 0.06], [0, 0.22, sz * (L / 2 + 0.01)])
  k.box({ c: '#f2f2f2', r: 0.6 }, [0.26, 0.07, 0.01], [0, 0.32, L / 2 + 0.035])
  k.box({ c: '#f2f2f2', r: 0.6 }, [0.26, 0.07, 0.01], [0, 0.32, -L / 2 - 0.035])
  k.box({ c: '#2a2a2a', r: 0.8 }, [0.3, 0.06, 0.012], [0, 0.4, L / 2 + 0.006])
  if (taxi) {
    k.box({ c: '#f7f7f2', r: 0.6 }, [0.3, 0.1, 0.12], [0, 0.9, -0.1])
    for (const s of [-1, 1]) lettering(k, INK, frame(0, -0.1, s > 0 ? 0 : Math.PI), s > 0 ? 0 : Math.PI, 0, 0.9, 0.064, 0.22, 0.05, 41)
  }
}

// A horse and its open carriage for tourists, facing +z, the coachman standing at its head.
function carriage(k: PropKit) {
  const coat: Look = { c: '#6b4a32', r: 0.9 }
  const mane: Look = { c: '#241a12', r: 1 }
  const black: Look = { c: '#1d1d1f', r: 0.5 }
  const wood: Look = { c: '#7a1f1f', r: 0.6 }
  k.add(coat, BALL, [0, 0.66, 1.0], [0, 0, 0], [0.16, 0.17, 0.4])
  for (const sx of [-1, 1]) for (const sz of [0.74, 1.24]) {
    k.rod(coat, [sx * 0.08, 0.62, sz], [sx * 0.08, 0.04, sz + 0.02], 0.035, 5)
    k.cyl(mane, 0.04, 0.045, 0.05, [sx * 0.08, 0.025, sz + 0.02], undefined, 6)
  }
  k.rod(coat, [0, 0.72, 1.3], [0, 1.0, 1.46], 0.075, 6)
  k.box(coat, [0.11, 0.12, 0.3], [0, 1.0, 1.58], [0.55, 0, 0])
  k.box(mane, [0.04, 0.08, 0.3], [0, 0.95, 1.38], [-1.05, 0, 0])
  for (const sx of [-1, 1]) k.cone(coat, 0.022, 0.07, [sx * 0.035, 1.12, 1.5], undefined, 4)
  k.rod(mane, [0, 0.72, 0.62], [0, 0.36, 0.56], 0.03, 5)
  k.box({ c: '#3a2416', r: 0.8 }, [0.34, 0.05, 0.08], [0, 0.82, 0.86])
  for (const sx of [-1, 1]) k.rod({ c: '#3a2416', r: 0.8 }, [sx * 0.22, 0.56, 0.3], [sx * 0.19, 0.66, 1.15], 0.015, 4)
  // The carriage: a lacquered body, folded hood, red seat, the driver's box in front.
  k.box(black, [0.66, 0.32, 0.78], [0, 0.6, -0.2])
  k.box(wood, [0.56, 0.08, 0.5], [0, 0.8, -0.28])
  k.box(wood, [0.56, 0.3, 0.06], [0, 0.94, -0.52])
  k.sphere(black, 0.36, [0, 0.82, -0.56], [0.95, 1, 0.75], 9, 4, Math.PI / 2)
  k.box(black, [0.5, 0.22, 0.22], [0, 0.9, 0.3])
  k.box(wood, [0.44, 0.05, 0.18], [0, 1.03, 0.3])
  for (const sx of [-1, 1]) {
    k.torus(black, 0.33, 0.025, [sx * 0.4, 0.34, -0.36], [0, Math.PI / 2, 0], Math.PI * 2, 14, 4)
    k.torus(black, 0.22, 0.022, [sx * 0.38, 0.23, 0.26], [0, Math.PI / 2, 0], Math.PI * 2, 12, 4)
    for (let i = 0; i < 3; i++) k.box({ c: '#b8341f', r: 0.7 }, [0.012, 0.62, 0.02], [sx * 0.4, 0.34, -0.36], [(i * Math.PI) / 3, 0, 0])
    for (let i = 0; i < 2; i++) k.box({ c: '#b8341f', r: 0.7 }, [0.012, 0.42, 0.02], [sx * 0.38, 0.23, 0.26], [(i * Math.PI) / 2, 0, 0])
    k.cyl({ c: '#e9d9a0', r: 0.4 }, 0.03, 0.03, 0.08, [sx * 0.3, 1.06, 0.42], undefined, 6)
  }
  person(k, { top: '#2b2b30', low: '#2b2b30', skin: SKIN.c, hair: '#5a5a5a', hat: 'cap', hatC: '#1a1a1a' }, 0.5, 1.25, -0.5)
}

// A Roman street lamp, a bench, a litter bin and the iron drinking fountain that never stops
// running, facing +w (the road), along u.
function lampPost(k: PropKit, at: At, ry: number) {
  k.cyl(IRON, 0.1, 0.12, 0.3, at(0, 0.15, 0), [0, ry, 0], 8)
  k.cyl(IRON, 0.05, 0.07, 0.3, at(0, 0.45, 0), [0, ry, 0], 8)
  k.cyl(IRON, 0.032, 0.04, 1.9, at(0, 1.5, 0), [0, ry, 0], 6)
  k.cyl(IRON, 0.06, 0.04, 0.08, at(0, 2.45, 0), [0, ry, 0], 6)
  frustum(k, { c: '#f3e6b4', r: 0.4 }, 0.17, 0.17, 0.3, 1.5, at(0, 2.49, 0), ry)
  frustum(k, IRON, 0.32, 0.32, 0.14, 0.1, at(0, 2.79, 0), ry)
  k.sphere(IRON, 0.035, at(0, 2.95, 0))
}
function kerbSet(k: PropKit) {
  lampPost(k, ID, 0)
  const slat: Look = { c: '#7a5434', r: 0.9 }
  for (let i = 0; i < 3; i++) k.box(slat, [1.1, 0.035, 0.09], [1.4, 0.36, -0.12 + i * 0.11])
  for (let i = 0; i < 2; i++) k.box(slat, [1.1, 0.08, 0.03], [1.4, 0.5 + i * 0.13, -0.2], [-0.15, 0, 0])
  for (const sx of [0.9, 1.9]) {
    k.box(IRON, [0.05, 0.36, 0.04], [sx, 0.18, 0.13])
    k.box(IRON, [0.05, 0.72, 0.04], [sx, 0.36, -0.19], [-0.12, 0, 0])
    k.box(IRON, [0.05, 0.04, 0.36], [sx, 0.34, -0.03])
  }
  k.cyl({ c: '#2f4a3a', r: 0.7 }, 0.13, 0.12, 0.5, [-0.7, 0.25, -0.05], undefined, 8)
  k.cyl(IRON, 0.14, 0.14, 0.04, [-0.7, 0.52, -0.05], undefined, 8)
  // The drinking fountain: an iron drum, a curved spout, a thread of water into the grate.
  const iron: Look = { c: '#40464a', r: 0.6 }
  k.cyl(iron, 0.12, 0.13, 0.72, [2.8, 0.36, -0.1], undefined, 8)
  k.sphere(iron, 0.12, [2.8, 0.72, -0.1], [1, 0.6, 1], 8, 3, Math.PI / 2)
  k.box(TRAV, [0.3, 0.06, 0.3], [2.8, 0.03, -0.1])
  k.rod(iron, [2.8, 0.5, 0.02], [2.8, 0.47, 0.13], 0.018, 4)
  k.cyl({ c: '#9ad2e4', r: 0.2 }, 0.009, 0.009, 0.4, [2.8, 0.26, 0.135], undefined, 4)
  k.box({ c: '#3a3a3a', r: 0.8 }, [0.24, 0.02, 0.2], [2.8, 0.012, 0.16])
  tufts(k, [[-1.2, -0.2], [3.2, -0.3]])
}

// The newsstand: a green kiosk with its shutters open and magazines pegged all over the front.
function newsstand(k: PropKit) {
  const green: Look = { c: '#2f5a3e', r: 0.7 }
  k.box(green, [1.2, 1.1, 0.8], [0, 0.55, 0])
  k.box(green, [1.45, 0.06, 1.05], [0, 1.16, 0.05])
  k.box({ c: '#24452f', r: 0.7 }, [1.25, 0.18, 0.85], [0, 1.28, 0])
  lettering(k, { c: '#f0e2b0', r: 0.8 }, ID, 0, 0, 1.28, 0.428, 0.9, 0.1, 61)
  const cols = ['#e84a5a', '#f2d43a', '#4a8ad8', '#f7f5ef', '#e8883a', '#7ac06a', '#c25ad8']
  let n = 0
  for (const [face, ry] of [[0, 0], [1, Math.PI / 2], [-1, -Math.PI / 2]] as const) {
    const cols2 = face === 0 ? 5 : 3
    for (let row = 0; row < 3; row++) for (let i = 0; i < cols2; i++) {
      const u = (i - (cols2 - 1) / 2) * 0.2
      const y = 0.45 + row * 0.22
      const p: V3 = face === 0 ? [u, y, 0.405] : [face * 0.605, y, u]
      k.box({ c: cols[n++ % cols.length], r: 0.8 }, [0.15, 0.19, 0.01], p, [0, ry, 0])
    }
  }
  // A rack of papers on the pavement.
  k.box(IRON, [0.5, 0.02, 0.2], [0.2, 0.55, 0.62])
  for (const sx of [-0.04, 0.44]) k.box(IRON, [0.02, 0.55, 0.02], [sx, 0.275, 0.62])
  for (let i = 0; i < 3; i++) k.box({ c: i % 2 ? '#e8e2d0' : '#f2f0e8', r: 0.9 }, [0.13, 0.17, 0.02], [0.04 + i * 0.16, 0.65, 0.66], [-0.3, 0, 0])
}

// The gelato cart: a cream cart with its tubs of colours under the lid, a striped sunshade, and
// the vendor behind it.
function gelatoCart(k: PropKit) {
  const cream: Look = { c: '#f4ead2', r: 0.6 }
  k.box(cream, [0.9, 0.5, 0.48], [0, 0.55, 0])
  k.box({ c: '#7ec8c0', r: 0.6 }, [0.92, 0.08, 0.5], [0, 0.34, 0])
  k.box({ c: '#7ec8c0', r: 0.6 }, [0.92, 0.06, 0.5], [0, 0.78, 0])
  lettering(k, { c: '#c2475a', r: 0.8 }, ID, 0, 0, 0.58, 0.243, 0.6, 0.1, 71)
  const flav = ['#f3a6c0', '#f5e9c8', '#7a4a2a', '#a8d86a', '#f2d46a', '#e84a5a']
  flav.forEach((c, i) => k.box({ c, r: 0.8 }, [0.12, 0.05, 0.16], [-0.32 + (i % 3) * 0.32 / 1.0, 0.83, i < 3 ? -0.1 : 0.1]))
  k.box({ c: '#cfe3ea', r: 0.15 }, [0.86, 0.01, 0.44], [0, 0.9, 0])
  for (const sx of [-1, 1]) {
    k.cyl({ c: '#1a1a1a', r: 0.9 }, 0.14, 0.14, 0.05, [sx * 0.47, 0.14, 0], [0, 0, Math.PI / 2], 9)
  }
  k.box(IRON, [0.04, 0.3, 0.04], [0, 0.15, 0.15])
  k.cyl({ c: '#d9d2c2', r: 0.6 }, 0.018, 0.018, 1.3, [0.3, 1.1, -0.15], undefined, 5)
  k.cone({ c: '#e84a6a', r: 0.9 }, 0.62, 0.22, [0.3, 1.82, -0.15], undefined, 8)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    k.box({ c: i % 2 ? '#f7f5ef' : '#e84a6a', r: 0.9 }, [0.46, 0.07, 0.01], [0.3 + Math.sin(a) * 0.57, 1.68, -0.15 + Math.cos(a) * 0.57], [0, a, 0])
  }
  person(k, { top: '#f7f5ef', low: '#3a3a42', skin: SKIN.b, hair: '#2a1e16', hat: 'cap', hatC: '#e84a6a' }, -0.1, -0.5, 0)
}

// The forum: a run of columns on their stylobate, some still under a piece of architrave,
// others snapped off, the drums lying in the grass. Faces +z, 8 long along x.
function colonnade(k: PropKit) {
  const marble: Look = { c: '#ece2cc', r: 0.85 }
  k.box(TRAV_D, [8.4, 0.3, 2.4], [0, 0.15, 0])
  k.box(TRAV, [8.0, 0.3, 2.0], [0, 0.45, 0])
  const hs = [5.6, 5.6, 5.6, 2.4, 0, 1.3]
  hs.forEach((h, i) => {
    const x = -3.4 + i * 1.36
    if (h > 5) column(k, x, 0.6, 0, 0.3, h, marble)
    else if (h > 0) stump(k, x, 0.6, 0, 0.3, h, marble)
    else k.box(marble, [0.78, 0.15, 0.78], [x, 0.675, 0])
  })
  k.box(TRAV_L, [3.4, 0.55, 0.85], [-2.04, 6.48, 0])
  k.box(TRAV, [3.6, 0.3, 1.0], [-2.04, 6.9, 0])
  for (let i = 0; i < 14; i++) k.box(TRAV_L, [0.08, 0.08, 0.08], [-3.66 + i * 0.25, 6.72, 0.46])
  k.box({ c: '#d8ccb0', r: 0.9 }, [3.4, 0.18, 0.02], [-2.04, 6.4, 0.43])
  // Fallen drums and a capital in front.
  k.cyl(marble, 0.27, 0.27, 0.8, [1.0, 0.27, 1.9], [0, 0.4, Math.PI / 2], 10)
  k.cyl(marble, 0.27, 0.27, 0.6, [2.0, 0.27, 2.2], [0, -0.3, Math.PI / 2], 10)
  k.box(marble, [0.78, 0.2, 0.78], [3.2, 0.1, 1.8], [0, 0.6, 0])
  k.cyl(marble, 0.38, 0.28, 0.25, [3.2, 0.32, 1.8], [0, 0.6, 0], 10)
  k.box(TRAV_L, [1.5, 0.45, 0.7], [2.8, 0.225, -1.9], [0, 0.2, 0])
  tufts(k, [[-3.8, 1.5], [-1.2, 1.7], [0.2, 2.1], [2.6, 1.3], [3.9, -0.9], [-3.0, -1.6]])
}

// A two-storey brick arcade of the old markets, its arches as dark recesses ringed in
// travertine, the upper storey broken away towards one end. Faces +z, 9 long.
function arcade(k: PropKit) {
  const brick: Look = { c: '#ad6a4c', r: 1 }
  const brick2: Look = { c: '#9c5c40', r: 1 }
  k.box(brick, [9, 3.6, 1.4], [0, 1.8, 0])
  k.box(TRAV, [9.1, 0.2, 1.5], [0, 3.7, 0])
  for (let i = 0; i < 5; i++) {
    const x = -3.6 + i * 1.8
    k.box(DARK, [1.0, 1.9, 0.02], [x, 0.95, 0.71])
    archTop(k, TRAV, 1.24, 0.02, [x, 1.9, 0.705])
    archTop(k, DARK, 1.0, 0.02, [x, 1.9, 0.715])
    k.box(TRAV, [0.22, 0.14, 0.1], [x - 0.6, 1.9, 0.73])
    k.box(TRAV, [0.22, 0.14, 0.1], [x + 0.6, 1.9, 0.73])
  }
  // The upper storey: three bays left, then a jagged broken edge.
  k.box(brick2, [5.4, 2.6, 1.2], [-1.8, 5.1, 0])
  for (let i = 0; i < 3; i++) {
    const x = -3.6 + i * 1.8
    k.box(DARK, [0.8, 1.2, 0.02], [x, 4.6, 0.61])
    archTop(k, TRAV, 1.0, 0.02, [x, 5.2, 0.605])
    archTop(k, DARK, 0.8, 0.02, [x, 5.2, 0.615])
  }
  const tops = [0.7, 0.4, 0.9, 0.3, 0.6, 0.2]
  tops.forEach((h, i) => k.box(brick2, [0.9, h, 1.2], [-4.05 + i * 0.9, 6.4 + h / 2, 0]))
  for (let i = 0; i < 4; i++) k.box(brick2, [0.8, 1.4 - i * 0.32, 1.2], [1.3 + i * 0.75, 3.8 + (1.4 - i * 0.32) / 2, 0])
  k.cone({ c: WEED[1], r: 1 }, 0.12, 0.3, [-3.2, 6.95, 0.2], undefined, 5)
  k.cone({ c: WEED[0], r: 1 }, 0.1, 0.26, [1.6, 5.3, 0.1], undefined, 5)
  k.box(TRAV_D, [1.0, 0.4, 0.6], [2.4, 0.2, 1.4], [0, 0.3, 0])
  tufts(k, [[-4.2, 1.0], [-1.4, 1.1], [1.0, 1.2], [3.8, 0.9]])
}

// The round temple: a ring of slim columns round a drum, a conical tiled roof.
function tholos(k: PropKit) {
  const marble: Look = { c: '#f0e7d4', r: 0.8 }
  k.cyl(TRAV_D, 2.8, 2.9, 0.3, [0, 0.15, 0], undefined, 16)
  k.cyl(TRAV, 2.5, 2.6, 0.3, [0, 0.45, 0], undefined, 16)
  k.cyl(TRAV, 2.3, 2.35, 0.4, [0, 0.8, 0], undefined, 16)
  k.cyl({ c: '#e6dac0', r: 0.9 }, 1.5, 1.5, 4.2, [0, 3.1, 0], undefined, 14)
  k.box(DARK, [0.8, 1.8, 0.04], [0, 1.9, 1.5])
  archTop(k, DARK, 0.8, 0.04, [0, 2.8, 1.5])
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    column(k, Math.sin(a) * 2.0, 1.0, Math.cos(a) * 2.0, 0.17, 4.2, marble, 8)
  }
  k.cyl(TRAV_L, 2.3, 2.3, 0.45, [0, 5.42, 0], undefined, 16)
  k.cyl(TRAV, 2.42, 2.42, 0.14, [0, 5.7, 0], undefined, 16)
  k.cone(ROOF, 2.5, 1.5, [0, 6.52, 0], undefined, 16)
  k.cyl(TRAV_L, 0.18, 0.22, 0.25, [0, 7.35, 0], undefined, 8)
  tufts(k, [[2.6, 1.4], [-2.4, 1.8], [1.0, 2.9], [-3.0, -0.6]])
}

// A forty-long stretch of the forum floor beside the road, centred on its spot: dust and grass,
// the old way paved in grey basalt along the railing, foundation walls of vanished buildings,
// blocks and weeds. Spans x -10..10 (the road side at +x, the railing at 9.05), z -20..20. gap: leave the middle
// clear where the arch stands over the paved way.
function forumFloor(k: PropKit, seed: number, gap = false) {
  const r = rand(seed)
  k.box({ c: '#c4ae86', r: 1 }, [20, 0.01, 40], [0, 0.008, 0])
  // Grass patches over the dust.
  const g = ['#8f9c58', '#9aa463', '#7f8f4e']
  for (let i = 0; i < 9; i++) {
    const w = 2 + r() * 4
    const d = 3 + r() * 6
    flat(k, { c: g[i % 3], r: 1 }, w, d, [-9 + w / 2 + r() * (16 - w), 0.016 + i * 0.003, -19 + d / 2 + r() * (38 - d)], 0, -Math.PI / 2)
  }
  // The paved way: basalt slabs set in a dark bed, travertine kerbs either side.
  const VX = 8.0
  const clear = (z: number) => gap && Math.abs(z) < 2.2
  for (let z = -20; z < 20; z += 2) {
    if (clear(z + 1) || clear(z) || clear(z + 2)) continue
    k.box({ c: '#46423d', r: 1 }, [1.6, 0.03, 2], [VX, 0.02, z + 1])
    for (const s of [-1, 1]) k.box(TRAV_D, [0.16, 0.08, 2], [VX + s * 0.88, 0.04, z + 1])
  }
  const basalt = ['#66615a', '#716c65', '#5c5853']
  for (let z = -19.8; z < 20; z += 0.44) {
    if (clear(z)) continue
    for (let i = 0; i < 3; i++) {
      const x = VX - 0.5 + i * 0.5 + (r() - 0.5) * 0.08
      flat(k, { c: basalt[(i + Math.round(z * 3) + 300) % 3], r: 0.9 }, 0.42, 0.38, [x, 0.038, z + (r() - 0.5) * 0.06], (r() - 0.5) * 0.5, -Math.PI / 2)
    }
  }
  // The railing between the pavement and the dig.
  const RX = 9.05
  for (let z = -20; z < 20; z += 1.0) {
    if (gap && Math.abs(z + 0.5) < 3) continue
    k.box(IRON, [0.04, 0.62, 0.04], [RX, 0.31, z + 0.5])
    k.cone(IRON, 0.025, 0.06, [RX, 0.65, z + 0.5], undefined, 4)
  }
  for (const [z0, z1] of gap ? [[-20, -3.5], [3.5, 20]] : [[-20, 20]]) for (const y of [0.18, 0.6]) k.box(IRON, [0.03, 0.03, z1 - z0], [RX, y, (z0 + z1) / 2])
  // Foundation walls: low brick outlines of rooms, a threshold of travertine.
  for (let i = 0; i < 3; i++) {
    const cx = -8 + r() * 2.5
    const cz = -14 + i * 12 + r() * 4
    const w = 2.5 + r() * 2
    const d = 2.5 + r() * 3
    const h = 0.25 + r() * 0.3
    for (const s of [-1, 1]) {
      k.box(BRICK, [0.3, h + r() * 0.2, d], [cx + (s * w) / 2, h / 2, cz])
      k.box(BRICK, [w * (0.5 + r() * 0.5), h, 0.3], [cx, h / 2, cz + (s * d) / 2])
    }
    k.box(TRAV, [0.9, 0.06, 0.32], [cx + w / 2 + 0.05, 0.03, cz])
    k.box(TRAV_D, [0.7, 0.35, 0.5], [cx - 0.3, 0.175, cz + 0.4], [0, r(), 0])
  }
  // Loose blocks and weeds.
  for (let i = 0; i < 6; i++) k.box(i % 2 ? TRAV : TRAV_D, [0.5 + r() * 0.5, 0.3 + r() * 0.2, 0.4 + r() * 0.4], [-9 + r() * 6, 0.18, -19 + r() * 38], [0, r() * 3, 0])
  const pts: [number, number][] = []
  for (let i = 0; i < 40; i++) pts.push([-9.5 + r() * 15.5, -19.5 + r() * 39])
  tufts(k, pts)
}

// An umbrella pine standing on o, s times the usual size: a tall leaning trunk, a broad flat crown.
function pineAt(k: PropKit, o: V3, s: number, ry = 0) {
  const at = frame(o[0], o[2], ry, o[1])
  const sc = (p: V3): V3 => at(p[0] * s, p[1] * s, p[2] * s)
  const bark: Look = { c: '#6b4f3a', r: 1 }
  k.rod(bark, sc([0, -0.3, 0]), sc([0.4, 3.2, 0.1]), 0.12 * s, 7)
  k.rod(bark, sc([0.4, 3.2, 0.1]), sc([-0.4, 4.0, 0]), 0.07 * s, 6)
  k.rod(bark, sc([0.4, 3.2, 0.1]), sc([1.1, 3.9, 0.3]), 0.07 * s, 6)
  const leaf = ['#3f6b35', '#4a7a3c', '#36602f']
  ;[[0.3, 4.3, 0.1, 1.6], [-0.8, 4.15, -0.2, 1.1], [1.4, 4.1, 0.3, 1.1], [0.3, 4.15, -1.1, 1.0], [0.2, 4.1, 1.1, 1.0]].forEach(([x, y, z, r], i) => k.sphere({ c: leaf[i % 3], r: 1 }, r * s, sc([x, y, z]), [1, 0.32, 1], 9, 4))
}
function cypressAt(k: PropKit, o: V3, s: number) {
  k.cyl({ c: '#5d4636', r: 1 }, 0.06 * s, 0.08 * s, 0.8 * s, [o[0], o[1] + 0.1 * s, o[2]], undefined, 6)
  k.sphere({ c: '#2f4a2b', r: 1 }, 0.42 * s, [o[0], o[1] + 2.0 * s, o[2]], [1, 4.2, 1], 8, 6)
  k.sphere({ c: '#36552f', r: 1 }, 0.3 * s, [o[0] + 0.06 * s, o[1] + 2.6 * s, o[2] + 0.05 * s], [1, 4.0, 1], 8, 6)
}

// A forty-long stretch of the hill of palace ruins behind the forum: green mounds, the brick
// substructures of the old palaces with their great arches, umbrella pines and cypresses on top.
// Centred on its spot, the road side at +x. aqueduct: a line of arches instead of the palace.
type Mound = [number, number, number, number, number]
const MOUNDS: Mound[][] = [
  [[0, -9, 10, 7.4, 12.5], [1.5, 9, 9.5, 6.8, 12.5]],
  [[-1, -10, 9.5, 6.8, 12], [1, 6, 10, 7.8, 13.5]],
]
function hill(k: PropKit, v: number) {
  const ms = MOUNDS[v]
  const surf = (x: number, z: number) => {
    let y = 0
    for (const [cx, cz, rx, ry, rz] of ms) {
      const t = 1 - ((x - cx) / rx) ** 2 - ((z - cz) / rz) ** 2
      if (t > 0) y = Math.max(y, -3 + ry * Math.sqrt(t))
    }
    return y
  }
  ms.forEach(([cx, cz, rx, ry, rz], i) => k.sphere({ c: i ? '#869a55' : '#7f9450', r: 1 }, 1, [cx, -3, cz], [rx, ry, rz], 12, 5, Math.PI / 2))
  const brick: Look = { c: '#a8664a', r: 1 }
  const brick2: Look = { c: '#93573e', r: 1 }
  if (v === 0) {
    // The palace substructures: a tall brick wall of arches facing the road, broken at the top.
    const x0 = 3.5
    const y0 = surf(x0, -2) - 1.2
    k.box(brick, [1.4, 7.2, 12], [x0, y0 + 3.6, -2])
    for (let i = 0; i < 4; i++) {
      const z = -6.5 + i * 3
      k.box(DARK, [0.02, 3.2, 1.8], [x0 + 0.71, y0 + 2.8, z])
      archTop(k, DARK, 1.8, 0.02, [x0 + 0.71, y0 + 4.4, z], Math.PI / 2)
      archTop(k, TRAV, 2.1, 0.02, [x0 + 0.705, y0 + 4.4, z], Math.PI / 2)
    }
    for (let i = 0; i < 6; i++) k.box(brick2, [1.4, 0.4 + ((i * 5) % 7) * 0.2, 2], [x0, y0 + 7.4 + ((i * 5) % 7) * 0.1, -7 + i * 2])
    k.box(brick2, [5, 5.5, 1.2], [x0 - 2.5, y0 + 3.5, 4.4])
    k.box(DARK, [1.6, 2.2, 0.02], [x0 - 2.2, y0 + 3.9, 5.01])
    archTop(k, DARK, 1.6, 0.02, [x0 - 2.2, y0 + 5.0, 5.01])
  } else {
    // A run of the aqueduct along the hill: tall piers, open arches, the water channel on top.
    const x0 = 2.5
    const top = 8.5
    const ys = 5.8
    for (let i = 0; i < 6; i++) {
      const z = -14 + i * 3.6
      const y0 = surf(x0, z) - 1.0
      k.box(brick, [1.2, top - y0, 1.0], [x0, (top + y0) / 2, z])
      k.box(TRAV, [1.3, 0.14, 1.1], [x0, ys, z])
      if (i === 5) continue
      const zc = z + 1.8
      for (let j = 0; j <= 6; j++) {
        const a = (j * Math.PI) / 6
        k.box(brick2, [1.2, 0.3, 0.72], [x0, ys + 1.3 * Math.sin(a), zc + 1.3 * Math.cos(a)], [a + Math.PI / 2, 0, 0])
      }
      for (const sd of [-1, 1]) k.box(brick, [1.2, 0.6, 0.5], [x0, ys + 1.0, zc + sd * 1.05])
      k.box(brick, [1.2, 1.4, 2.6], [x0, top - 0.7, zc])
    }
    k.box(TRAV, [1.3, 0.25, 19], [x0, 8.62, -5])
    k.box(brick2, [1.2, 0.5, 19], [x0, 9.0, -5])
    k.box(brick2, [1.2, 1.2, 0.8], [x0, 9.0, 4.8])
  }
  // Pines and cypresses on the slopes.
  const trees: [number, number, number, boolean][] = v === 0
    ? [[-2, -12, 1.3, true], [5, 10, 1.2, true], [-5, 2, 1.4, true], [6, -14, 1.0, false], [7, -11, 1.0, false], [0, 14, 1.1, false], [-6, -4, 1.2, false], [4.5, 2.5, 1.1, true]]
    : [[-3, -6, 1.4, true], [4, 8, 1.3, true], [-4, 12, 1.2, true], [7, 0, 1.0, false], [6.5, 3, 1.1, false], [-1, -16, 1.0, false], [-6, 4, 1.2, false]]
  trees.forEach(([x, z, s, isPine], i) => {
    const y = surf(x, z) - 0.15
    if (isPine) pineAt(k, [x, y, z], s, i * 1.3)
    else cypressAt(k, [x, y, z], s)
  })
}

// Behind the houses: taller palazzi whose top floors, roof terraces and loggias show over the
// front row, facing +z, 4 deep.
type Back = { w: number; floors: number; wall: string; shutter: string; top: 'gable' | 'terrace' | 'altana' }
const BACKS: Back[] = [
  { w: 5.0, floors: 6, wall: '#e1b57a', shutter: '#3f6b4a', top: 'terrace' },
  { w: 4.4, floors: 7, wall: '#c98a5a', shutter: '#6b4a32', top: 'gable' },
  { w: 5.6, floors: 6, wall: '#dca46c', shutter: '#3f6b4a', top: 'altana' },
  { w: 4.8, floors: 7, wall: '#e8c48e', shutter: '#4a6a5a', top: 'gable' },
]
function palazzo(k: PropKit, B: Back, at: At = ID, ry = 0) {
  const wall: Look = { c: B.wall, r: 0.95 }
  const sh: Look = { c: B.shutter, r: 0.8 }
  const D = 4
  const H = B.floors * 1.1 + 0.4
  const f = D / 2
  const bx = (look: Look, s: V3, u: number, y: number, w: number) => k.box(look, s, at(u, y, w), [0, ry, 0])
  bx(wall, [B.w, H, D], 0, H / 2, 0)
  bx(TRAV_D, [B.w + 0.04, 1.3, D + 0.04], 0, 0.65, 0)
  bx(TRAV, [B.w + 0.06, 0.1, D + 0.06], 0, 1.32, 0)
  const n = Math.max(3, Math.round(B.w / 1.0))
  for (let i = 0; i < n; i++) {
    const u = -B.w / 2 + (B.w / n) * (i + 0.5)
    // Ground floor: arched shop openings.
    flat(k, DARK, 0.62, 0.8, at(u, 0.42, f + 0.024), ry)
    archTop(k, DARK, 0.62, 0.02, at(u, 0.82, f + 0.03), ry)
    for (let fl = 1; fl < B.floors; fl++) {
      const y = 1.3 + (fl - 1) * 1.1 + 0.5
      flat(k, DARK, 0.36, 0.62, at(u, y, f + 0.004), ry)
      bx(TRAV, [0.48, 0.05, 0.1], u, y - 0.34, f + 0.04)
      if (fl === 1) bx(TRAV, [0.5, 0.08, 0.06], u, y + 0.38, f + 0.025)
      const open = (i * 3 + fl) % 4 === 0
      for (const s of [-1, 1]) flat(k, sh, 0.18, 0.62, at(u + s * (open ? 0.28 : 0.09), y, f + 0.012), ry)
      if (fl === 2 && i % 2 === 1) {
        bx(TRAV, [0.6, 0.05, 0.3], u, y - 0.36, f + 0.15)
        bx(IRON, [0.6, 0.025, 0.025], u, y - 0.1, f + 0.3)
        for (let j = 0; j < 3; j++) k.ico({ c: j === 1 ? '#e05a7a' : '#4f8a3a', r: 1 }, 0.08, at(u - 0.18 + j * 0.18, y - 0.26, f + 0.22), [1, 0.8, 1], 0)
      }
    }
  }
  bx(TRAV_L, [B.w + 0.16, 0.16, D + 0.16], 0, H + 0.05, 0)
  if (B.top === 'gable') {
    gable(k, ROOF, B.w + 0.24, D + 0.24, 0.9, at(0, H + 0.12, 0), ry)
    for (const u of [-B.w * 0.3, B.w * 0.25]) {
      bx(wall, [0.24, 0.8, 0.24], u, H + 0.8, -0.8)
      bx(TRAV, [0.3, 0.06, 0.3], u, H + 1.22, -0.8)
    }
    k.rod(IRON, at(B.w * 0.05, H + 0.9, 0), at(B.w * 0.05, H + 1.8, 0), 0.015, 4)
    bx(IRON, [0.5, 0.015, 0.015], B.w * 0.05, H + 1.7, 0)
    bx(IRON, [0.36, 0.015, 0.015], B.w * 0.05, H + 1.55, 0)
  } else if (B.top === 'terrace') {
    // A roof terrace: parapet, a pergola of vines, lemon trees in pots, a stair hut.
    for (const s of [-1, 1]) bx(wall, [B.w, 0.45, 0.12], 0, H + 0.35, s * (f - 0.06))
    for (const s of [-1, 1]) bx(wall, [0.12, 0.45, D], s * (B.w / 2 - 0.06), H + 0.35, 0)
    bx(wall, [1.4, 1.3, 1.4], B.w / 2 - 0.9, H + 0.75, -f + 0.9)
    gable(k, ROOF, 1.55, 1.55, 0.4, at(B.w / 2 - 0.9, H + 1.4, -f + 0.9), ry)
    for (const [u, w] of [[-1.6, 0.4], [0.2, 0.4], [-1.6, 1.6], [0.2, 1.6]] as const) bx({ c: '#6b4a32', r: 0.9 }, [0.07, 1.2, 0.07], u, H + 0.7, w)
    for (let j = 0; j < 5; j++) bx({ c: '#6b4a32', r: 0.9 }, [2.0, 0.05, 0.06], -0.7, H + 1.32, 0.4 + j * 0.3)
    for (let j = 0; j < 5; j++) k.ico({ c: j % 2 ? '#5a8a3c' : '#4a7a34', r: 1 }, 0.35, at(-1.5 + j * 0.42, H + 1.42, 0.7 + (j % 2) * 0.6), [1, 0.35, 1], 0)
    for (const u of [1.0, 1.8]) {
      k.cyl(ROOF, 0.16, 0.12, 0.3, at(u, H + 0.28, 1.4), undefined, 7)
      k.ico({ c: '#3f6b35', r: 1 }, 0.28, at(u, H + 0.72, 1.4), [1, 1, 1], 0)
      for (let j = 0; j < 3; j++) k.ico({ c: '#f2d43a', r: 0.8 }, 0.045, at(u - 0.15 + j * 0.15, H + 0.7 + (j % 2) * 0.12, 1.66), [1, 1, 1], 0)
    }
    k.cyl({ c: '#f3ead8', r: 0.9 }, 0.02, 0.02, 1.2, at(-0.4, H + 0.7, -1.0), undefined, 5)
    k.cone({ c: '#9b2f2a', r: 0.9 }, 0.8, 0.3, at(-0.4, H + 1.35, -1.0), undefined, 8)
  } else {
    // A loggia on the roof, three arches open to the view, behind a low tiled roof.
    gable(k, ROOF, B.w + 0.24, D + 0.24, 0.7, at(0, H + 0.12, 0), ry)
    bx(wall, [2.4, 1.5, 1.6], 0, H + 1.0, 0.4)
    for (let j = 0; j < 3; j++) {
      bx(DARK, [0.5, 0.75, 0.02], -0.75 + j * 0.75, H + 0.95, 1.21)
      archTop(k, DARK, 0.5, 0.02, at(-0.75 + j * 0.75, H + 1.32, 1.21), ry)
    }
    bx(TRAV, [2.5, 0.1, 1.7], 0, H + 1.78, 0.4)
    gable(k, ROOF, 2.6, 1.8, 0.45, at(0, H + 1.82, 0.4), ry)
    k.ico({ c: '#4f8a3a', r: 1 }, 0.25, at(-1.4, H + 0.9, 1.6), [1, 1.2, 1], 0)
  }
}

// A church behind the houses: a baroque front in two orders, the dome on its drum behind.
function church(k: PropKit) {
  const stone: Look = { c: '#ece0c6', r: 0.9 }
  const stone2: Look = { c: '#e2d3b2', r: 0.9 }
  k.box(stone2, [6, 7.4, 9], [0, 3.7, -2.5])
  gable(k, ROOF, 9.2, 6.2, 1.4, [0, 7.4, -2.5], Math.PI / 2)
  // The front, lower order: pilasters, a pedimented door, niches.
  k.box(stone, [6.4, 4.4, 0.5], [0, 2.2, 2.2])
  for (const u of [-2.9, -1.45, 1.45, 2.9]) k.box(TRAV_L, [0.4, 4.4, 0.12], [u, 2.2, 2.5])
  k.box(TRAV_L, [6.6, 0.35, 0.7], [0, 4.55, 2.25])
  k.box(DARK, [1.0, 1.9, 0.03], [0, 0.95, 2.46])
  archTop(k, DARK, 1.0, 0.03, [0, 1.9, 2.46])
  gable(k, TRAV_L, 0.25, 1.7, 0.45, [0, 2.55, 2.5], Math.PI / 2)
  for (const s of [-1, 1]) {
    k.box({ c: '#d8c8a6', r: 0.9 }, [0.6, 1.4, 0.03], [s * 2.18, 2.3, 2.46])
    archTop(k, { c: '#d8c8a6', r: 0.9 }, 0.6, 0.03, [s * 2.18, 3.0, 2.46])
    k.cyl({ c: '#f2ede2', r: 0.8 }, 0.12, 0.17, 0.8, [s * 2.18, 2.0, 2.38], undefined, 8)
    k.sphere({ c: '#f2ede2', r: 0.8 }, 0.1, [s * 2.18, 2.5, 2.38])
  }
  // Upper order with its round window, scroll wings and pediment.
  k.box(stone, [3.6, 2.6, 0.45], [0, 6.0, 2.2])
  for (const u of [-1.6, 1.6]) k.box(TRAV_L, [0.35, 2.6, 0.12], [u, 6.0, 2.48])
  k.cyl(DARK, 0.5, 0.5, 0.04, [0, 6.0, 2.44], [Math.PI / 2, 0, 0], 12)
  k.cyl(TRAV_L, 0.62, 0.62, 0.03, [0, 6.0, 2.43], [Math.PI / 2, 0, 0], 12)
  for (const s of [-1, 1]) {
    k.box(stone, [1.6, 0.3, 0.4], [s * 2.5, 5.0, 2.2], [0, 0, -s * 0.55])
    k.cyl(TRAV_L, 0.25, 0.25, 0.45, [s * 3.1, 4.85, 2.2], [Math.PI / 2, 0, 0], 8)
  }
  k.box(TRAV_L, [3.9, 0.3, 0.6], [0, 7.4, 2.2])
  gable(k, TRAV_L, 0.6, 4.0, 1.0, [0, 7.55, 2.2], Math.PI / 2)
  k.box(GILT, [0.06, 0.5, 0.06], [0, 8.85, 2.2])
  k.box(GILT, [0.3, 0.06, 0.06], [0, 8.95, 2.2])
  // The dome over the crossing.
  k.cyl(stone, 2.1, 2.1, 1.8, [0, 8.3, -4.5], undefined, 14)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    k.box(DARK, [0.4, 0.8, 0.04], [Math.sin(a) * 2.1, 8.3, -4.5 + Math.cos(a) * 2.1], [0, a, 0])
  }
  k.cyl(TRAV_L, 2.25, 2.25, 0.2, [0, 9.25, -4.5], undefined, 14)
  k.sphere(LEAD, 2.1, [0, 9.3, -4.5], [1, 1.2, 1], 14, 6, Math.PI / 2)
  k.cyl(stone, 0.42, 0.45, 0.9, [0, 12.1, -4.5], undefined, 8)
  k.cone(LEAD, 0.5, 0.5, [0, 12.8, -4.5], undefined, 8)
  k.sphere(GILT, 0.12, [0, 13.1, -4.5])
  k.box(GILT, [0.05, 0.5, 0.05], [0, 13.4, -4.5])
}

// A brick bell tower in the old style, white bands at each storey, paired arches on every face.
function campanile(k: PropKit) {
  const brick: Look = { c: '#b06e4e', r: 1 }
  const S = 2.0
  k.box(brick, [S, 13, S], [0, 6.5, 0])
  for (let l = 0; l < 6; l++) {
    const y = 4.4 + l * 1.6
    k.box(TRAV_L, [S + 0.16, 0.14, S + 0.16], [0, y, 0])
    if (l === 5) continue
    for (const [ry, nx, nz] of [[0, 0, 1], [Math.PI / 2, 1, 0], [-Math.PI / 2, -1, 0]] as const) {
      for (const o of [-0.42, 0.42]) {
        const ox = nz * o + nx * (S / 2 + 0.01)
        const oz = nz * (S / 2 + 0.01) - nx * o
        flat(k, DARK, 0.5, 0.75, [ox, y + 0.55, oz], ry)
        k.add(DARK, ARCH6, [ox, y + 0.93, oz], [0, ry, 0], [0.25, 0.25, 0.02])
      }
      k.box(TRAV_L, [0.08, 0.8, 0.08], [nx * (S / 2 + 0.03), y + 0.55, nz * (S / 2 + 0.03)])
    }
  }
  k.cyl(WHITE, 0.4, 0.4, 0.04, [0, 3.4, S / 2 + 0.02], [Math.PI / 2, 0, 0], 12)
  k.box(INK, [0.04, 0.3, 0.02], [0, 3.48, S / 2 + 0.05])
  k.box(INK, [0.22, 0.04, 0.02], [0.08, 3.4, S / 2 + 0.05])
  frustum(k, brick, S + 0.1, S + 0.1, 1.8, 0, [0, 13.1, 0])
  k.box(GILT, [0.05, 0.5, 0.05], [0, 15.1, 0])
}

// An obelisk on its pedestal, standing on p, h tall.
function obelisk(k: PropKit, p: V3, h: number) {
  const red: Look = { c: '#c9a88a', r: 0.85 }
  k.box(TRAV_D, [1.5, 0.3, 1.5], [p[0], p[1] + 0.15, p[2]])
  k.box(TRAV, [1.1, 1.3, 1.1], [p[0], p[1] + 0.95, p[2]])
  k.box(TRAV_L, [1.3, 0.2, 1.3], [p[0], p[1] + 1.7, p[2]])
  k.box(TRAV_L, [0.9, 0.2, 0.9], [p[0], p[1] + 1.9, p[2]])
  frustum(k, red, 0.62, 0.62, h, 0.62, [p[0], p[1] + 2.0, p[2]])
  frustum(k, red, 0.385, 0.385, 0.45, 0, [p[0], p[1] + 2.0 + h, p[2]])
  // Carved signs down each face.
  for (const [nx, nz] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
    for (let i = 0; i < 7; i++) {
      const y = p[1] + 2.5 + i * h * 0.12
      const half = 0.31 - (0.31 - 0.19) * ((y - p[1] - 2) / h) + 0.004
      flat(k, { c: '#a8876a', r: 0.9 }, 0.12, 0.16, [p[0] + nx * half, y, p[2] + nz * half], Math.atan2(nx, nz))
    }
  }
  k.sphere(GILT, 0.1, [p[0], p[1] + 2.5 + h, p[2]])
  k.box(GILT, [0.04, 0.35, 0.04], [p[0], p[1] + 2.75 + h, p[2]])
  k.box(GILT, [0.2, 0.04, 0.04], [p[0], p[1] + 2.8 + h, p[2]])
}

// The great stairway: three flights up the hill, banks of pink azaleas, the leaking-boat
// fountain at its foot, an obelisk and the twin-towered church at the top, palazzi either side.
// The foot is at the origin; it rises towards -z, the road is at +z.
const AZ = ['#e86aa0', '#f39bc4', '#d94a8a']
function stairway(k: PropKit) {
  const stone: Look = { c: '#ebe1cc', r: 0.9 }
  const stone2: Look = { c: '#ddd0b4', r: 0.9 }
  const flight = (w0: number, y0: number, half: number) => {
    for (let i = 0; i < 8; i++) {
      const y = y0 + (i + 1) * 0.15
      k.box(i % 2 ? stone : stone2, [half * 2, y, 0.3], [0, y / 2, w0 - i * 0.3 - 0.15])
    }
    // Parapet walls up both sides, stepped down to the ground, a sloping coping on top.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const y = y0 + (i + 1) * 0.15 + 0.45
        k.box(TRAV_L, [0.2, y, 0.3], [s * (half + 0.1), y / 2, w0 - i * 0.3 - 0.15])
      }
      k.box(TRAV, [0.26, 0.08, 2.75], [s * (half + 0.1), y0 + 0.6 + 0.58, w0 - 1.2], [0.4636, 0, 0])
    }
  }
  const pots = (u: number, y: number, w: number) => {
    k.cyl(ROOF, 0.17, 0.13, 0.24, [u, y + 0.12, w], undefined, 7)
    k.ico({ c: AZ[Math.abs(Math.round(u * 3 + w)) % 3], r: 1 }, 0.24, [u, y + 0.38, w], [1.1, 0.8, 1.1], 0)
  }
  flight(0, 0, 4.5)
  k.box(stone, [9.4, 1.2, 1.2], [0, 0.6, -3.0])
  flight(-3.6, 1.2, 3.4)
  for (const s of [-1, 1]) {
    k.box(stone2, [1.0, 2.4, 2.4], [s * 4.0, 1.2, -4.8])
    for (let i = 0; i < 4; i++) pots(s * 4.0, 2.4, -3.9 - i * 0.6)
  }
  k.box(stone, [9.4, 2.4, 1.2], [0, 1.2, -6.6])
  flight(-7.2, 2.4, 3.0)
  for (const s of [-1, 1]) {
    k.box(stone2, [1.6, 3.6, 2.4], [s * 3.9, 1.8, -8.4])
    for (let i = 0; i < 4; i++) pots(s * 3.7, 3.6, -7.5 - i * 0.6)
  }
  // Azaleas along the landings' front edges.
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    pots(s * (4.3 - i * 0.45), 1.2, -2.55)
    pots(s * (4.3 - i * 0.45), 2.4, -6.15)
  }
  // The top terrace with its balustrade, the obelisk, the church.
  k.box(stone2, [13, 3.6, 6.6], [0, 1.8, -12.9])
  for (const s of [-1, 1]) {
    k.box(TRAV_L, [3.5, 0.5, 0.2], [s * 4.75, 3.85, -9.7])
    k.box(TRAV, [3.6, 0.07, 0.26], [s * 4.75, 4.13, -9.7])
  }
  obelisk(k, [0, 3.6, -10.9], 5.2)
  const ochre: Look = { c: '#eadab4', r: 0.9 }
  k.box(ochre, [7.2, 6.4, 3.2], [0, 6.8, -14.6])
  k.box(TRAV_L, [7.4, 0.3, 3.4], [0, 7.2, -14.6])
  k.box(TRAV_L, [7.4, 0.35, 3.4], [0, 10.1, -14.6])
  for (const u of [-1.4, 1.4]) k.box(TRAV_L, [0.35, 6.4, 0.1], [u, 6.8, -12.96])
  k.box(DARK, [1.0, 1.9, 0.03], [0, 4.55, -12.98])
  archTop(k, DARK, 1.0, 0.03, [0, 5.5, -12.98])
  gable(k, TRAV_L, 0.3, 1.6, 0.4, [0, 5.9, -12.92], Math.PI / 2)
  k.cyl(DARK, 0.45, 0.45, 0.04, [0, 8.5, -12.98], [Math.PI / 2, 0, 0], 12)
  gable(k, TRAV_L, 0.5, 3.0, 0.9, [0, 10.25, -13.2], Math.PI / 2)
  for (const s of [-1, 1]) {
    const u = s * 2.85
    k.box(ochre, [1.7, 4.4, 1.7], [u, 12.3, -13.9])
    k.box(TRAV_L, [1.85, 0.2, 1.85], [u, 12.0, -13.9])
    for (const f of [0, 1]) {
      k.box(DARK, [0.5, 1.0, 0.03], [u, 11.0 + f * 2.0, -13.03])
      archTop(k, DARK, 0.5, 0.03, [u, 11.5 + f * 2.0, -13.03])
    }
    k.box(TRAV_L, [1.85, 0.2, 1.85], [u, 14.55, -13.9])
    k.cyl(ochre, 0.62, 0.7, 0.5, [u, 14.9, -13.9], undefined, 10)
    k.sphere(LEAD, 0.62, [u, 15.15, -13.9], [1, 1.1, 1], 10, 5, Math.PI / 2)
    k.box(GILT, [0.05, 0.5, 0.05], [u, 16.05, -13.9])
    k.box(GILT, [0.22, 0.05, 0.05], [u, 16.15, -13.9])
  }
  k.cyl(WHITE, 0.45, 0.45, 0.04, [-2.85, 9.4, -13.04], [Math.PI / 2, 0, 0], 12)
  k.box(INK, [0.04, 0.32, 0.02], [-2.85, 9.48, -13.01])
  k.box(INK, [0.26, 0.04, 0.02], [-2.76, 9.4, -13.01])
  // Gardens on the terrace either side of the church.
  pineAt(k, [5.2, 3.6, -14.2], 1.0, 0.8)
  pineAt(k, [-5.4, 3.6, -14.6], 1.1, 2.6)
  cypressAt(k, [4.8, 3.6, -11.2], 0.9)
  cypressAt(k, [-4.8, 3.6, -11.2], 0.9)
  // The palazzi either side of the stairs, windows to the street and onto the steps.
  for (const s of [-1, 1]) {
    const wall: Look = { c: s > 0 ? '#e0a46a' : '#d58a5a', r: 0.95 }
    const u0 = s * 5.75
    k.box(wall, [2.4, 6.2, 9.2], [u0, 3.1, -5.0])
    k.box(TRAV_D, [2.44, 1.2, 9.24], [u0, 0.6, -5.0])
    k.box(TRAV_L, [2.56, 0.16, 9.36], [u0, 6.25, -5.0])
    gable(k, ROOF, 9.5, 2.7, 0.7, [u0, 6.33, -5.0], Math.PI / 2)
    k.box(DARK, [0.7, 0.95, 0.02], [u0, 0.5, -0.39])
    archTop(k, DARK, 0.7, 0.02, [u0, 0.97, -0.39])
    for (let fl = 1; fl < 5; fl++) {
      const y = 1.75 + (fl - 1) * 1.1
      for (const du of [-0.6, 0.6]) {
        flat(k, DARK, 0.36, 0.6, [u0 + du, y, -0.395])
        k.box(TRAV, [0.46, 0.05, 0.08], [u0 + du, y - 0.33, -0.36])
        for (const sd of [-1, 1]) flat(k, SHUTTER, 0.17, 0.6, [u0 + du + sd * 0.27, y, -0.39])
      }
      for (let j = 0; j < 5; j++) {
        if (y < 3.8 && j > 0) continue
        const w = -1.6 - j * 1.8
        flat(k, DARK, 0.36, 0.6, [s * 4.545, y, w], -s * Math.PI / 2)
        for (const sd of [-1, 1]) flat(k, SHUTTER, 0.17, 0.6, [s * 4.54, y, w + sd * 0.27], -s * Math.PI / 2)
      }
    }
  }
  // The leaking-boat fountain at the foot.
  const water: Look = { c: '#4aa6b8', r: 0.15 }
  k.add(TRAV_D, CAP, [0, 0.12, 1.3], [0, 0, 0], [1.35, 0.24, 0.7])
  k.add(water, CAP, [0, 0.25, 1.3], [0, 0, 0], [1.2, 0.02, 0.6])
  k.add(TRAV_L, BALL, [0, 0.3, 1.3], [0, 0, 0], [0.9, 0.22, 0.36])
  k.add(water, BALL, [0, 0.42, 1.3], [0, 0, 0], [0.72, 0.03, 0.26])
  for (const s of [-1, 1]) {
    k.box(TRAV_L, [0.24, 0.32, 0.4], [s * 0.82, 0.48, 1.3])
    k.cyl(TRAV_L, 0.06, 0.06, 0.12, [s * 0.82, 0.6, 1.5], [Math.PI / 2, 0, 0], 6)
  }
  k.cyl(TRAV_L, 0.08, 0.1, 0.35, [0, 0.6, 1.3], undefined, 8)
  k.cyl({ c: '#d9f0f4', r: 0.3 }, 0.03, 0.08, 0.25, [0, 0.88, 1.3], undefined, 6)
}

// The cobbled piazza beside the arch: sampietrini in grey tones, an obelisk on a fountain,
// benches, two lamps and a pine. Origin on the road edge, the piazza at +x, z -7.5..7.5.
function piazza(k: PropKit) {
  k.box({ c: '#7d756a', r: 1 }, [8, 0.01, 22], [4, 0.008, 0])
  const tones = ['#9c9488', '#a8a093', '#918a7e', '#b0a89a']
  const r = rand(55)
  for (let x = 0.25; x < 8; x += 0.5) for (let z = -7.35; z < 7.6; z += 0.5) {
    flat(k, { c: tones[Math.floor(r() * 4)], r: 1 }, 0.44, 0.44, [x, 0.016, z], 0, -Math.PI / 2)
  }
  // The fountain basin round the obelisk, lions spouting at the corners.
  const water: Look = { c: '#4aa6b8', r: 0.15 }
  const fx = 3.0
  const fz = 4.7
  k.cyl(TRAV_D, 1.45, 1.5, 0.12, [fx, 0.06, fz], undefined, 8)
  k.cyl(TRAV_L, 1.3, 1.3, 0.5, [fx, 0.3, fz], [0, Math.PI / 8, 0], 8)
  k.cyl(water, 1.18, 1.18, 0.02, [fx, 0.5, fz], [0, Math.PI / 8, 0], 8)
  k.box(TRAV, [1.3, 0.7, 1.3], [fx, 0.35, fz])
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const lx = fx + sx * 0.72
    const lz = fz + sz * 0.72
    k.box(TRAV_L, [0.3, 0.25, 0.3], [lx, 0.82, lz])
    k.sphere(TRAV_L, 0.13, [lx, 1.02, lz], [1, 1.1, 1], 7, 5)
    k.rod({ c: '#bfe6ee', r: 0.2 }, [lx + sx * 0.14, 0.95, lz + sz * 0.14], [lx + sx * 0.42, 0.52, lz + sz * 0.42], 0.025, 4)
  }
  obelisk(k, [fx, 0.7, fz], 6.0)
  // Stone benches and two lamps at the kerb.
  for (const z of [-3.2, -6.0]) {
    k.box(TRAV_L, [0.42, 0.08, 1.4], [5.8, 0.42, z])
    for (const dz of [-0.5, 0.5]) k.box(TRAV_D, [0.34, 0.38, 0.2], [5.8, 0.19, z + dz])
  }
  lampPost(k, frame(0.45, -7.1, -Math.PI / 2), -Math.PI / 2)
  lampPost(k, frame(0.45, 7.1, -Math.PI / 2), -Math.PI / 2)
  pineAt(k, [4.6, 0, -5.2], 0.95, 2.2)
}

// A souvenir stall by the arena: little arenas, flags, aprons and shirts on a rack.
function souvenirs(k: PropKit) {
  const wood: Look = { c: '#7a5434', r: 0.9 }
  k.box(wood, [1.4, 0.06, 0.6], [0, 0.72, 0])
  for (const sx of [-0.65, 0.65]) for (const sz of [-0.25, 0.25]) k.box(wood, [0.05, 0.72, 0.05], [sx, 0.36, sz])
  for (let i = 0; i < 5; i++) {
    k.cyl(TRAV, 0.1, 0.11, 0.1, [-0.5 + i * 0.25, 0.8, 0.12], undefined, 8)
    k.box({ c: ['#e84a5a', '#4a8ad8', '#f2d43a', '#7ac06a', '#f7f5ef'][i], r: 0.8 }, [0.18, 0.02, 0.14], [-0.5 + i * 0.25, 0.76, -0.14])
  }
  for (const sx of [-0.68, 0.68]) k.cyl(IRON, 0.015, 0.015, 1.7, [sx, 0.85, -0.32], undefined, 4)
  k.box(IRON, [1.4, 0.02, 0.02], [0, 1.65, -0.32])
  const shirts = ['#f7f5ef', '#a82222', '#2f5a3e', '#f2d43a', '#3d5a80']
  shirts.forEach((c, i) => k.box({ c, r: 0.9 }, [0.22, 0.3, 0.02], [-0.52 + i * 0.26, 1.45, -0.32]))
  for (const [i, c] of [[0, '#2f8a3e'], [1, '#f7f5ef'], [2, '#c62828']] as const) k.box({ c, r: 0.9 }, [0.1, 0.22, 0.01], [0.6 + i * 0.1 - 0.1, 1.95, -0.32])
  k.cyl({ c: '#d9d2c2', r: 0.6 }, 0.015, 0.015, 0.5, [0.6, 1.75, -0.33], undefined, 4)
  person(k, { top: '#3d5a80', low: '#3a3a42', skin: SKIN.c, hair: '#1a1410' }, 0.2, -0.75, 0)
}

// Buildings, trees and the forum: stretches starting further ahead than this are lost in the
// haze anyway (the fog is over 80% by then), so they aren't drawn.
const FAR = 110
const CL = ['tourists', 'clergy', 'locals', 'gelato', 'cafe', 'gladiator'] as const
type Cl = (typeof CL)[number]
const CARS: [string, boolean][] = [['#c8312b', false], ['#efe3c2', false], ['#f2f2ee', true]]

export default function Rome({ len, race }: WorldProps) {
  const homes = useMemo(() => HOUSES.map((h, i) => prop(`rome-house-d3-${i}`, (k) => house(k, h))), [])
  const backs = useMemo(() => BACKS.map((b, i) => prop(`rome-back-${i}`, (k) => palazzo(k, b))), [])
  const scooters = useMemo(() => RIDES.map((cs, i) => prop(`rome-scooters-${i}`, (k) => cs.forEach((c, j) => scooter(k, c, j * 0.55, j * 0.08, j * 0.12)))), [])
  const cars = useMemo(() => CARS.map(([c, taxi], i) => prop(`rome-car-${i}`, (k) => cityCar(k, c, taxi))), [])
  const people = useMemo(() => CL.map((n) => prop(`rome-people-${n}`, CLUSTERS[n])), [])
  const floors = useMemo(() => [0, 1].map((v) => prop(`rome-floor-d3-${v}`, (k) => forumFloor(k, 300 + v, v === 1))), [])
  const hills = useMemo(() => [0, 1].map((v) => prop(`rome-hill-${v}`, (k) => hill(k, v))), [])
  const ruinP = useProp('rome-roadside-ruin', (k) => {
    brokenColumn(k)
    ruinWall(k, 2.6)
  })
  const fountainP = useProp('rome-fountain', fountain)
  const pineP = useProp('rome-pine', pine)
  const bigPineP = useProp('rome-pine-big', (k) => pineAt(k, [0, 0, 0], 1.6))
  const cypP = useProp('rome-cypress', cypress)
  const arenaP = useProp('rome-arena-d3', arena)
  const archP = useProp('rome-arch', arch)
  const templeP = useProp('rome-temple', temple)
  const colsP = useProp('rome-cols', threeCols)
  const rubbleP = useProp('rome-rubble', rubble)
  const churchP = useProp('rome-church', church)
  const towerP = useProp('rome-campanile', campanile)
  const carriageP = useProp('rome-carriage', carriage)
  const kerbP = useProp('rome-kerb', kerbSet)
  const newsP = useProp('rome-news', newsstand)
  const cartP = useProp('rome-gelato-cart', gelatoCart)
  const colonnadeP = useProp('rome-colonnade', colonnade)
  const arcadeP = useProp('rome-arcade', arcade)
  const tholosP = useProp('rome-tholos', tholos)
  const stairsP = useProp('rome-stairway', stairway)
  const piazzaP = useProp('rome-piazza', piazza)
  const souvP = useProp('rome-souvenirs', souvenirs)
  const az = race + 14
  const gz = race * 0.5
  const tz = race * 0.3
  const cz = race * 0.72
  const fz = race * 0.22
  const sz = race * 0.86

  const geo = useMemo(() => {
    const r = rand(917)
    const rows: Spot[][] = HOUSES.map(() => [])
    const rides: Spot[][] = RIDES.map(() => [])
    const carsAt: Spot[][] = CARS.map(() => [])
    const ppl = Object.fromEntries(CL.map((n) => [n, [] as Spot[]])) as Record<Cl, Spot[]>
    const crowdAt = (n: Cl, x: number, z: number, ry = r() * 6, y = 0) => ppl[n].push({ x, z, ry, y })
    // Left: the front row of houses, what stands at each door.
    for (let z = -14; z < len + 40;) {
      const i = Math.floor(r() * HOUSES.length)
      const h = HOUSES[i]
      const zc = z + h.w / 2
      const clear = (c: number, m: number) => Math.abs(zc - c) > m + h.w / 2
      if (clear(gz, 7.5) && clear(az, 20) && clear(fz, 5.2) && clear(sz, 7.2)) {
        rows[i].push({ x: EDGE + 1.5 + 1.3, z: zc, ry: -Math.PI / 2 })
        const roll = r()
        if (h.shop === 'none') {
          if (roll < 0.55) carsAt[Math.floor(r() * 2)].push({ x: EDGE + 0.55, z: zc + (r() - 0.5) * 0.4, ry: r() < 0.5 ? 0 : Math.PI })
          else if (roll < 0.9) crowdAt(r() < 0.5 ? 'clergy' : 'tourists', EDGE + 1.0, zc + h.w * 0.25)
        } else {
          // Scooters park clear of the café tables and fruit stalls at the shop door.
          const scoot = roll < 0.4
          if (scoot) rides[Math.floor(r() * RIDES.length)].push({ x: EDGE + 0.7, z: zc + h.w * 0.2, ry: Math.PI / 2 + (r() - 0.5) * 0.4 })
          if (h.shop === 'cafe' && r() < 0.75) crowdAt('cafe', EDGE + 0.95, zc - h.w * 0.2 + 0.44)
          if (h.shop === 'fruit' && r() < 0.75) crowdAt('locals', EDGE + 0.5, zc - h.w * 0.2 + 0.6)
          if (!scoot && r() < 0.45) crowdAt(r() < 0.5 ? 'gelato' : 'tourists', EDGE + 1.0, zc + h.w * 0.25)
        }
      }
      z += h.w + 0.02
    }
    // Left: the taller palazzi behind, now and then a church or a bell tower.
    const backRows: Spot[][] = BACKS.map(() => [])
    const churches: Spot[] = []
    const towers: Spot[] = []
    const BX = EDGE + 8.8
    for (let z = -14, lastC = -60, lastT = -40; z < len + 40;) {
      const roll = r()
      const kind = roll < 0.25 && z - lastC > 45 ? 'church' : roll < 0.45 && z - lastT > 28 ? 'tower' : 'block'
      const i = Math.floor(r() * BACKS.length)
      const w = kind === 'church' ? 6.6 : kind === 'tower' ? 2.4 : BACKS[i].w
      const zc = z + w / 2
      const clear = Math.abs(zc - az) > 18 + w / 2 && Math.abs(zc - fz) > 6 + w / 2 && Math.abs(zc - sz) > 8 + w / 2
      if (clear) {
        const s = { x: BX, z: zc, ry: -Math.PI / 2 }
        if (kind === 'church') {
          churches.push(s)
          lastC = z
        } else if (kind === 'tower') {
          towers.push(s)
          lastT = z
        } else backRows[i].push(s)
      }
      z += w + 0.05
    }
    const pines: Spot[] = []
    const bigPines: Spot[] = []
    const cyps: Spot[] = []
    const rubbles: Spot[] = []
    // Left: pines over the rooftops, the cypress avenue by the arena.
    for (let z = -10; z < len + 50; z += 5 + r() * 6) {
      if (Math.abs(z - az) < 20 || Math.abs(z - sz) < 9) continue
      bigPines.push({ x: EDGE + 13 + r() * 5, z, ry: r() * 6, s: 0.85 + r() * 0.3 })
    }
    for (let z = az - 22; z < az + 24; z += 4.5) cyps.push({ x: EDGE + 2.4, z, ry: 0, s: 1.05 })
    // Right, at the kerb: broken columns and ruined walls, lamps and benches, newsstands,
    // gelato carts, parked cars and people.
    const ruins: Spot[] = []
    const kerbs: Spot[] = []
    const news: Spot[] = []
    const carts: Spot[] = []
    for (let z = -12; z < len + 40;) {
      if (z > gz - 8 && z < gz + 3) {
        z = gz + 3
        continue
      }
      const k = r()
      if (k < 0.3) {
        const flip = r() < 0.5
        ruins.push({ x: -(EDGE + 0.95), z: flip ? z + 3.7 : z + 1.0, ry: flip ? Math.PI : 0, s: 0.9 + r() * 0.2 })
        z += 4.8
      } else if (k < 0.52) {
        kerbs.push({ x: -(EDGE + 1.0), z: z + 3.2, ry: Math.PI / 2 })
        z += 4.4
      } else if (k < 0.64) {
        carsAt[r() < 0.5 ? 2 : Math.floor(r() * 2)].push({ x: -(EDGE + 0.55), z: z + 1.0, ry: r() < 0.5 ? 0 : Math.PI })
        z += 2.0
      } else if (k < 0.74) {
        news.push({ x: -(EDGE + 1.0), z: z + 0.8, ry: Math.PI / 2 })
        z += 1.6
      } else if (k < 0.84) {
        carts.push({ x: -(EDGE + 0.9), z: z + 0.95, ry: Math.PI / 2 })
        z += 1.5
      } else {
        crowdAt((['tourists', 'locals', 'gelato', 'clergy'] as const)[Math.floor(r() * 4)], -(EDGE + 0.9), z + 0.6)
        z += 1.2
      }
      z += 0.4 + r() * 2.0
    }
    // Right: the forum. Trees along the old paved way, then columns, arcades and the round
    // temple, more trees and rubble behind, the hill of palace ruins at the back.
    for (let z = -12; z < len + 50; z += 5 + r() * 7) {
      if (Math.abs(z - tz) < 6.5 || Math.abs(z - cz) < 4) continue
      const x = -(EDGE + 4.6 + r() * 1.2)
      if (r() < 0.5) pines.push({ x, z, ry: r() * 6, s: 0.9 + r() * 0.3 })
      else cyps.push({ x, z, ry: r() * 6, s: 0.9 + r() * 0.35 })
    }
    const cols: Spot[] = []
    const arcs: Spot[] = []
    const thol: Spot[] = []
    for (let z = -10, last = -1; z < len + 40;) {
      let t = Math.floor(r() * 3)
      if (t === last) t = (t + 1) % 3
      const L = [8.6, 9.2, 6][t]
      const zc = z + L / 2
      if (Math.abs(zc - tz) < 5.5 + L / 2 || Math.abs(zc - cz) < 3 + L / 2 || Math.abs(zc - gz) < 2 + L / 2) {
        z += 2
        continue
      }
      last = t
      if (t === 0) cols.push({ x: -(EDGE + 8.6 + r() * 1.2), z: zc, ry: Math.PI / 2 })
      else if (t === 1) arcs.push({ x: -(EDGE + 8.8 + r() * 1.2), z: zc, ry: Math.PI / 2 })
      else thol.push({ x: -(EDGE + 9.4), z: zc, ry: r() * 6 })
      z += L + 3 + r() * 7
    }
    for (let z = -10; z < len + 50; z += 4 + r() * 4) {
      const x = -(EDGE + 13 + r() * 5)
      if (r() < 0.45) pines.push({ x, z, ry: r() * 6, s: 1 + r() * 0.35 })
      else cyps.push({ x, z, ry: r() * 6, s: 0.95 + r() * 0.4 })
    }
    for (let z = -6; z < len + 40; z += 10 + r() * 6) rubbles.push({ x: -(EDGE + 11.5 + r() * 2.5), z, ry: r() * 6 })
    // Tourists walking the old paved way.
    for (let z = 4; z < len + 30; z += 12 + r() * 12) if (Math.abs(z - gz) > 3) crowdAt(r() < 0.6 ? 'tourists' : 'clergy', -(EDGE + 3.0), z)
    const tiles: Spot[][] = [[], []]
    for (let k = -Math.ceil((gz + 20) / 40); gz + k * 40 - 20 < len + 60; k++) tiles[k === 0 ? 1 : 0].push({ x: -(EDGE + 11), z: gz + k * 40 })
    const hillAt: Spot[][] = [[], []]
    for (let k = 0; k * 40 - 20 < len + 80; k++) hillAt[k % 2].push({ x: -(EDGE + 29), z: k * 40 })
    // The piazza by the arch, the fountain, the stairway and the arena: carriages, gelato,
    // tourists, a gladiator or two.
    const carriages: Spot[] = [{ x: EDGE + 1.2, z: gz - 5.0, ry: 0 }, { x: EDGE + 1.1, z: az - 14, ry: 0 }, { x: EDGE + 1.1, z: az + 10, ry: Math.PI }]
    carts.push({ x: EDGE + 3.6, z: gz - 6.2, ry: -Math.PI / 2 })
    crowdAt('tourists', EDGE + 2.0, gz - 2.8, 1.0)
    crowdAt('clergy', EDGE + 5.0, gz + 2.0, -2.0)
    crowdAt('gelato', EDGE + 1.2, gz + 2.7)
    crowdAt('locals', EDGE + 5.4, gz - 4.6, -1.4)
    crowdAt('tourists', EDGE + 2.0, fz - 1.5, Math.PI / 2)
    crowdAt('gelato', EDGE + 2.2, fz + 2.0, Math.PI / 2 + 0.4)
    crowdAt('locals', EDGE + 1.0, fz - 4.4)
    const st = (n: Cl, u: number, w: number, y: number) => crowdAt(n, EDGE + 3.4 - w, sz + u, -Math.PI / 2 + (r() - 0.5) * 1.2, y)
    st('tourists', -2.6, 0.8, 0)
    st('clergy', 2.8, 0.9, 0)
    st('gelato', 1.6, -3.0, 1.2)
    st('tourists', -2.0, -3.0, 1.2)
    st('locals', 0.9, -6.6, 2.4)
    st('tourists', -3.6, -11.2, 3.6)
    st('gelato', 2.6, -11.6, 3.6)
    crowdAt('gladiator', EDGE + 1.3, az - 4, -1.2)
    crowdAt('gladiator', EDGE + 1.3, az + 17, -1.8)
    crowdAt('tourists', EDGE + 1.0, az + 4)
    crowdAt('tourists', EDGE + 1.2, az - 18)
    crowdAt('gelato', EDGE + 1.0, az + 13)
    const rr = rand(17)
    const grass = Array.from({ length: 360 }, () => ({ x: -(EDGE + 2.2 + rr() * 16), z: rr() * (len + 60) - 14, s: 0.7 + rr() * 0.6, ry: rr() * 6 }))
    return { rows, rides, carsAt, ppl, backRows, churches, towers, pines, bigPines, cyps, rubbles, ruins, kerbs, news, carts, cols, arcs, thol, tiles, hillAt, carriages, grass }
  }, [len, gz, az, tz, cz, fz, sz])

  return (
    <>
      <Batch version={`rome:${len}`} cell={24}>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 0.8, 0.012, len / 2 + 5]}>
          <planeGeometry args={[1.6, len + 60]} />
          <meshStandardMaterial color="#8d8378" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + 0.6), 0.016, len / 2 + 5]}>
          <planeGeometry args={[1.2, len + 60]} />
          <meshStandardMaterial color="#cdbb9c" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 16, 0.02, az]}>
          <planeGeometry args={[30, 47]} />
          <meshStandardMaterial color="#cdbb9c" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 5, 0.016, fz]}>
          <planeGeometry args={[10, 17]} />
          <meshStandardMaterial color="#c9bba0" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 2.8, 0.016, sz]}>
          <planeGeometry args={[2.4, 21]} />
          <meshStandardMaterial color="#c9bba0" />
        </mesh>
        <group position={[EDGE + 5.2, 0, fz]} rotation-y={-Math.PI / 2}><PropMesh parts={fountainP} /></group>
        <group position={[EDGE + 17, 0, az]}><PropMesh parts={arenaP} /></group>
        <group position={[0, 0, gz]}><PropMesh parts={archP} /></group>
        <group position={[-(EDGE + 7), 0, tz]} rotation-y={Math.PI / 2}><PropMesh parts={templeP} /></group>
        <group position={[-(EDGE + 5), 0, cz]} rotation-y={Math.PI / 2}><PropMesh parts={colsP} /></group>
        <group position={[EDGE, 0.012, gz]}><PropMesh parts={piazzaP} /></group>
        <group position={[EDGE + 3.4, 0, sz]} rotation-y={-Math.PI / 2}><PropMesh parts={stairsP} /></group>
        <group position={[EDGE + 3.7, 0, az - 8]} rotation-y={-Math.PI / 2}><PropMesh parts={souvP} /></group>
        <Scatter spots={geo.grass} colors={['#9aa25a', '#8a9650', '#a9ad66']}>
          <coneGeometry args={[0.06, 0.24, 3]} />
        </Scatter>
      </Batch>
      {homes.map((h, i) => <Many key={i} parts={h} at={geo.rows[i]} near={FAR} />)}
      {backs.map((h, i) => <Many key={i} parts={h} at={geo.backRows[i]} near={FAR} />)}
      <Many parts={churchP} at={geo.churches} />
      <Many parts={towerP} at={geo.towers} />
      {floors.map((f, i) => <Many key={i} parts={f} at={geo.tiles[i]} near={FAR} />)}
      {hills.map((h, i) => <Many key={i} parts={h} at={geo.hillAt[i]} />)}
      <Many parts={colonnadeP} at={geo.cols} near={FAR} />
      <Many parts={arcadeP} at={geo.arcs} near={FAR} />
      <Many parts={tholosP} at={geo.thol} near={FAR} />
      <Many parts={pineP} at={geo.pines} near={FAR} />
      <Many parts={bigPineP} at={geo.bigPines} near={FAR} />
      <Many parts={cypP} at={geo.cyps} near={FAR} />
      <Many parts={rubbleP} at={geo.rubbles} near={90} />
      <Many parts={ruinP} at={geo.ruins} near={90} />
      {scooters.map((s, i) => <Many key={i} parts={s} at={geo.rides[i]} near={80} />)}
      {cars.map((c, i) => <Many key={i} parts={c} at={geo.carsAt[i]} near={80} />)}
      <Many parts={carriageP} at={geo.carriages} near={80} />
      <Many parts={kerbP} at={geo.kerbs} near={80} />
      <Many parts={newsP} at={geo.news} near={80} />
      <Many parts={cartP} at={geo.carts} near={80} />
      {people.map((p, i) => <Many key={i} parts={p} at={geo.ppl[CL[i]]} near={70} />)}
      <FarRome />
    </>
  )
}

// The skyline ahead: the great dome on the right, the white marble monument with its colonnade
// and bronze chariots on the left, a brick bell tower, a smaller dome, the castle drum with its
// angel, roofs of the city between, and green hills with pines and cypresses on both sides.
function FarRome() {
  const parts = useProp('rome-far-d3', (k) => {
    const stone: Look = { c: '#e8dcc4', r: 0.9 }
    const pale: Look = { c: '#f1e7d2', r: 0.85 }
    {
      const x = -16
      const z = 80
      k.box(stone, [34, 12, 18], [x, 6, z])
      k.box(stone, [14, 4, 18.5], [x, 14, z])
      frustum(k, stone, 14, 2, 3, 0.05, [x, 16, z - 8.3])
      for (let i = 0; i < 10; i++) k.cyl(pale, 0.5, 0.55, 10, [x - 13.5 + i * 3, 6, z - 9.2], undefined, 8)
      k.cyl(stone, 8, 8, 6, [x, 19, z], undefined, 20)
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        k.cyl(pale, 0.3, 0.3, 6, [x + Math.sin(a) * 8.2, 19, z + Math.cos(a) * 8.2], undefined, 6)
      }
      k.sphere(LEAD, 8, [x, 22, z], [1, 1.2, 1], 20, 10, Math.PI / 2)
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        k.box({ c: '#d8d2c4', r: 0.8 }, [0.3, 0.3, 0.3], [x + Math.sin(a) * 6.6, 27.4, z + Math.cos(a) * 6.6])
      }
      k.cyl(stone, 1.6, 1.8, 3, [x, 32.6, z], undefined, 10)
      k.sphere(LEAD, 1.6, [x, 34, z], [1, 1.3, 1], 10, 6, Math.PI / 2)
      k.cyl(GILT, 0.12, 0.2, 2.2, [x, 37, z], undefined, 6)
    }
    // The white monument: podium and stairs, a long colonnade, chariots on the end porticoes,
    // the gilt rider in front.
    {
      const x = 15
      const z = 86
      const marble: Look = { c: '#f6f4ee', r: 0.8 }
      const bronze: Look = { c: '#56664f', r: 0.6 }
      k.box(marble, [30, 3, 11], [x, 1.5, z])
      for (let i = 0; i < 6; i++) k.box(marble, [9, 0.5 * (i + 1), 0.8], [x, 0.25 * (i + 1), z - 9.9 + i * 0.8])
      k.box(marble, [22, 6, 7], [x, 6, z + 1])
      k.box({ c: '#e6e2d8', r: 0.8 }, [21, 7, 1], [x, 12.5, z + 0.8])
      for (let i = 0; i < 16; i++) k.cyl(marble, 0.42, 0.48, 7, [x - 10.5 + i * 1.4, 12.5, z - 2.2], undefined, 8)
      k.box(marble, [23, 1.2, 2.2], [x, 16.6, z - 1.8])
      k.box(marble, [23.4, 0.3, 2.6], [x, 17.3, z - 1.8])
      for (const s of [-1, 1]) {
        k.box(marble, [4.4, 15, 5.4], [x + s * 12.6, 10.5, z - 0.6])
        for (const dx of [-1.2, 1.2]) k.cyl(marble, 0.45, 0.5, 9, [x + s * 12.6 + dx, 11.5, z - 3.4], undefined, 8)
        k.box(marble, [4.8, 1.0, 5.8], [x + s * 12.6, 18.4, z - 0.6])
        // A chariot and four horses on top, a winged figure riding.
        for (let h = 0; h < 4; h++) {
          const hx = x + s * 12.6 - 1.05 + h * 0.7
          k.box(bronze, [0.4, 0.8, 1.9], [hx, 20.2, z - 1.4])
          k.rod(bronze, [hx, 20.4, z - 2.2], [hx, 21.3, z - 2.7], 0.17, 5)
          for (const dz of [-0.7, 0.7]) k.box(bronze, [0.12, 0.9, 0.12], [hx, 19.35, z - 1.4 + dz])
        }
        k.box(bronze, [2.4, 1.0, 1.0], [x + s * 12.6, 19.5, z + 0.4])
        k.cyl(bronze, 0.25, 0.35, 1.8, [x + s * 12.6, 20.8, z + 0.3], undefined, 6)
        for (const w of [-1, 1]) k.box(bronze, [1.1, 1.4, 0.1], [x + s * 12.6 + w * 0.6, 21.6, z + 0.5], [0, 0, w * 0.5])
      }
      k.box(marble, [3, 3, 4.5], [x, 4.5, z - 4.4])
      k.box(GILT, [0.9, 1.1, 2.8], [x, 6.9, z - 4.4])
      for (const [dx, dz] of [[-0.3, -1.1], [0.3, -1.1], [-0.3, 1.1], [0.3, 1.1]]) k.box(GILT, [0.2, 1.1, 0.2], [x + dx, 5.9, z - 4.4 + dz])
      k.rod(GILT, [x, 7.3, z - 5.6], [x, 8.3, z - 6.1], 0.25, 5)
      k.cyl(GILT, 0.3, 0.35, 1.3, [x, 8.1, z - 4.2], undefined, 6)
      k.sphere(GILT, 0.3, [x, 9.0, z - 4.2])
    }
    // A brick bell tower and a smaller church dome on the left.
    {
      const brick: Look = { c: '#b06e4e', r: 1 }
      const x = 7
      const z = 64
      k.box(brick, [3, 22, 3], [x, 11, z])
      for (let l = 0; l < 5; l++) {
        const y = 8 + l * 3.2
        k.box(pale, [3.3, 0.3, 3.3], [x, y, z])
        for (const o of [-0.7, 0.7]) {
          k.box(DARK, [0.8, 1.5, 0.04], [x + o, y + 1.3, z - 1.52])
          k.box(DARK, [0.04, 1.5, 0.8], [x - 1.52, y + 1.3, z + o])
        }
      }
      frustum(k, brick, 3.2, 3.2, 3.5, 0, [x, 22, z])
      k.box(GILT, [0.1, 1, 0.1], [x, 26, z])
      const cx = 25
      const cz = 60
      k.box(stone, [9, 9, 12], [cx, 4.5, cz])
      gable(k, ROOF, 12.4, 9.4, 2, [cx, 9, cz], Math.PI / 2)
      k.cyl(stone, 3, 3, 2.6, [cx, 11.3, cz - 2], undefined, 12)
      k.sphere(LEAD, 3.1, [cx, 12.6, cz - 2], [1, 1.15, 1], 12, 5, Math.PI / 2)
      k.cyl(stone, 0.6, 0.65, 1.4, [cx, 16.8, cz - 2], undefined, 8)
      k.cone(LEAD, 0.7, 0.8, [cx, 17.9, cz - 2], undefined, 8)
    }
    // The castle drum on the right: square walls with corner bastions, the great round keep,
    // the palace on top and the bronze angel.
    {
      const wall: Look = { c: '#b89a70', r: 1 }
      const x = -36
      const z = 64
      k.box(wall, [22, 6, 22], [x, 3, z])
      for (const [dx, dz] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) k.cyl(wall, 2.6, 2.8, 7, [x + dx, 3.5, z + dz], undefined, 10)
      k.cyl({ c: '#c4a77c', r: 1 }, 9, 9.5, 10, [x, 11, z], undefined, 20)
      k.cyl(pale, 9.3, 9.3, 0.5, [x, 16.2, z], undefined, 20)
      k.box({ c: '#c79a68', r: 0.95 }, [9, 5, 9], [x, 18.8, z])
      gable(k, ROOF, 9.4, 9.4, 1.4, [x, 21.3, z])
      k.box({ c: '#56664f', r: 0.6 }, [0.6, 2.2, 0.6], [x, 23.8, z])
      for (const s of [-1, 1]) k.box({ c: '#56664f', r: 0.6 }, [1.6, 0.9, 0.15], [x + s * 0.8, 24.4, z], [0, 0, s * 0.5])
    }
    // Roofs of the city between, both sides.
    const r = rand(626)
    const walls = ['#d99a52', '#c76f45', '#e6c27a', '#d4845a', '#e3a596', '#c98a5a']
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1
      const x = side * (17 + r() * 24)
      const z = 46 + r() * 50
      if (side > 0 && x < 31 && z > 79) continue
      if (side < 0 && x < -26 && z < 78 && z > 50) continue
      if (side < 0 && x > -34 && z > 70) continue
      const w = 5 + r() * 6
      const d = 5 + r() * 6
      const h = 4 + r() * 6
      k.box({ c: walls[i % walls.length], r: 0.95 }, [w, h, d], [x, h / 2, z])
      gable(k, ROOF, w + 0.4, d + 0.4, 1.4, [x, h, z], r() < 0.5 ? 0 : Math.PI / 2)
    }
    // Hills with pines and cypress lines on both sides.
    for (const [hx, hz, s] of [[30, 90, 14], [52, 104, 20], [80, 92, 16], [-46, 92, 16], [-72, 84, 20]]) k.sphere({ c: '#7f9a5a', r: 1 }, s, [hx, -s * 0.55, hz], [1.6, 1, 1], 12, 5, Math.PI / 2)
    for (let i = 0; i < 18; i++) k.sphere({ c: '#2f4a2b', r: 1 }, 0.8, [22 + i * 2.6, 5 + Math.sin(i * 0.5) * 1.5, 86 + i * 0.6], [1, 3.6, 1], 6, 4)
    for (const [px, pz, py] of [[36, 88, 5.5], [46, 98, 8], [60, 102, 8.5], [-40, 90, 6], [-62, 86, 8], [-78, 80, 7]]) pineAt(k, [px, py, pz], 2.2, px)
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
