import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, CylinderGeometry, ExtrudeGeometry, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, Shape, SphereGeometry, SRGBColorSpace, type BufferGeometry, type Mesh } from 'three'
import { glowMats } from '../dayNight'
import { Batch } from '../Batch'
import { EDGE, Horizon, PropKit, coconutPalm, gable, Many, person, PropMesh, Scatter, Sparkles, Water, frustum, glow, prop, rand, useProp, type Dress, type Look, type Spot, type V3 } from './kit'
import type { WorldProps } from './WorldVenue'

// Brazil, Carnival Coast: a night run down the beachfront avenue. Right: a red cycle lane, the
// black-and-white wave promenade with its benches and showers, the beach with its kiosks,
// lifeguard posts, volleyball and football, parasols full of sunbathers, fishing boats pulled up
// on the sand, the surf rolling in and sailing boats out in the bay. Left: taxis, beetles and
// camper vans parked in the lay-by, a patterned pavement with bus stops, newsstands, corn carts
// and hire bikes, tall white beach hotels mixed with painted colonial houses and their little
// shops, and behind them the hillside houses stacked up the green slopes, lit all night.
// Halfway, the old white aqueduct strides over the road with the yellow tram on top and the samba
// schools gather round their floats; by the finish the tiled stairway climbs the hill in every
// colour. Out in the bay the sugarloaf rocks and their cable car, the islands and the stadium on
// the far shore; inland the open-armed statue lit on its peak.

const WIN: Look = { c: '#ffffff', use: glowMats.window }
const WHITE: Look = { c: '#f1eee6', r: 0.85 }
const CREAM: Look = { c: '#e4dccb', r: 0.9 }
const DARK: Look = { c: '#26292c', r: 1 }
// Glass for the props repeated down the mile: a plain finish, so it folds into the prop's one
// painted mesh rather than costing a draw of its own in every stretch.
const GLASS_P: Look = { c: '#6f8e9a', r: 0.2, m: 0.2 }
const GLASS_D: Look = { c: '#2c3a42', r: 0.25, m: 0.2 }
const STEEL: Look = { c: '#b8bec4', r: 0.4, m: 0.2 }
const BULBS = ['#ff4f7b', '#ffd23f', '#3ddc97', '#4fc3ff'].map((c) => glow(c, 0.15, 1.8))
const FLAGS = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00', '#ffffff']
const LEAFY = ['#2f7d3b', '#3a8f45', '#4c9a3a']
const TAU = Math.PI * 2
// A carnival pennant: a flat triangle hanging point down from its top edge.
const PENNANT = (() => {
  const t = new Shape()
  t.moveTo(-0.5, 0)
  t.lineTo(0.5, 0)
  t.lineTo(0, -1)
  t.closePath()
  return new ExtrudeGeometry(t, { depth: 0.01, bevelEnabled: false })
})()
// Two-triangle panels (windows, lettering, tiles, paving) facing +z.
const PLANE = new PlaneGeometry(1, 1)
const plane = (k: PropKit, look: Look, w: number, h: number, p: V3, ry = 0, rx = 0) => k.add(look, PLANE, p, [rx, ry, 0], [w, h, 1])
// A sail: a right triangle, luff up the mast (+y), foot along +x.
const SAIL = (() => {
  const t = new Shape()
  t.moveTo(0, 0)
  t.lineTo(1, 0)
  t.lineTo(0, 1)
  t.closePath()
  return new ExtrudeGeometry(t, { depth: 0.01, bevelEnabled: false })
})()
// The public phone's hood, an open egg.
const HOOD = new SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI * 0.62)
const FEATHER = new SphereGeometry(1, 6, 4)
// A boat's hull: half an egg, turned keel-down where it's placed.
const HULL = new SphereGeometry(1, 10, 4, 0, TAU, 0, Math.PI / 2)

// Builds `make` in a kit of its own and adds it to k moved to p and turned (a whole house in a
// row, a sunbather lying down). Plain colours still fold into k's one painted mesh.
function sub(k: PropKit, make: (t: PropKit) => void, p: V3, ry = 0, rx = 0) {
  const t = new PropKit()
  make(t)
  for (const part of t.build()) k.add({ c: '#ffffff', use: part.mat }, part.geo, p, [rx, ry, 0])
}

// Shop-sign lettering: word-like runs of strokes across a board, w wide and h tall, centred on p.
function letters(k: PropKit, look: Look, p: V3, w: number, h: number, seed: number, ry = 0) {
  const r = rand(seed * 977 + 13)
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const put = (u: number, v: number, sw: number, sh: number) => plane(k, look, sw, sh, [p[0] + u * c, p[1] + v, p[2] - u * s], ry)
  const st = h * 0.16
  let u = -w / 2
  while (u < w / 2 - h * 0.4) {
    if (r() < 0.16 && u > -w / 2 + h) {
      u += h * 0.45
      continue
    }
    const cw = h * (0.32 + r() * 0.3)
    if (u + cw > w / 2) break
    const kind = Math.floor(r() * 5)
    put(u + st / 2, 0, st, h)
    if (kind !== 1) put(u + cw / 2, kind === 2 ? -h / 2 + st / 2 : h / 2 - st / 2, cw, st)
    if (kind === 0 || kind === 3) put(u + cw - st / 2, 0, st, h)
    if (kind === 3 || kind === 4) put(u + cw / 2, 0, cw, st)
    u += cw + h * 0.22
  }
}

// ---------------------------------------------------------------------------------------------
// The street front (left): tall beach hotels and painted colonial houses, built facing +z with
// their fronts at z = depth / 2, then set side by side in 24-unit frontages with the hillside
// houses behind.

const HOTELS = [
  { w: 4.2, n: 9, wall: '#f1eee6', band: '#ffffff' },
  { w: 3.6, n: 7, wall: '#e9dcc6', band: '#f6efe2' },
  { w: 4.8, n: 11, wall: '#eef1f2', band: '#cfd8dc' },
  { w: 3.4, n: 6, wall: '#f3d9c9', band: '#fbeee6' },
  { w: 4.4, n: 8, wall: '#dfe8ea', band: '#ffffff' },
]
const HD = 4
// A beach hotel: a tall slab with a balcony band on every floor and lit rooms, a glass lobby
// under an awning, and a lit sign on the roof.
function hotel(k: PropKit, h: (typeof HOTELS)[number], sign: Look, seed: number) {
  const wall: Look = { c: h.wall, r: 0.85 }
  const band: Look = { c: h.band, r: 0.7 }
  const f = HD / 2
  const fl = 1.15
  const H = 1.5 + h.n * fl
  k.box(wall, [h.w, H, HD], [0, H / 2, 0])
  // Lobby: glass front, door, a canopy with the hotel's name lit along its edge.
  plane(k, WIN, h.w - 0.6, 0.95, [0, 0.58, f + 0.004])
  for (let i = 0; i < 4; i++) plane(k, band, 0.06, 0.95, [-h.w / 2 + 0.3 + ((h.w - 0.6) / 3) * i, 0.58, f + 0.007])
  plane(k, DARK, 0.5, 0.88, [0, 0.46, f + 0.01])
  k.box(band, [h.w + 0.1, 0.12, 0.9], [0, 1.25, f + 0.45])
  k.box(sign, [h.w - 0.4, 0.08, 0.02], [0, 1.25, f + 0.91])
  for (const s of [-1, 1]) k.box(band, [0.07, 1.2, 0.07], [s * (h.w / 2 - 0.15), 0.62, f + 0.85])
  letters(k, DARK, [0, 1.42, f + 0.004], h.w * 0.5, 0.12, seed)
  // Floors: a balcony slab with a glass rail running the full width, rooms behind it.
  const bays = Math.round(h.w / 0.85)
  for (let i = 0; i < h.n; i++) {
    const y = 1.5 + i * fl
    k.box(band, [h.w + 0.04, 0.1, 0.5], [0, y, f + 0.24])
    plane(k, GLASS_P, h.w, 0.32, [0, y + 0.21, f + 0.49])
    plane(k, band, h.w + 0.04, 0.05, [0, y + 0.39, f + 0.495])
    for (let b = 0; b < bays; b++) {
      const x = -h.w / 2 + (h.w / bays) * (b + 0.5)
      // Most rooms lit, a few dark with the curtains drawn.
      plane(k, (i * 5 + b * 3 + seed) % 7 === 0 ? { c: '#3e4a52', r: 0.6 } : WIN, h.w / bays - 0.2, 0.7, [x, y + 0.48, f + 0.004])
    }
    for (let b = 1; b < bays; b += 2) k.box(band, [0.05, 0.4, 0.48], [-h.w / 2 + (h.w / bays) * b, y + 0.25, f + 0.24])
    for (let b = 0; b < bays; b++) {
      const x = -h.w / 2 + (h.w / bays) * (b + 0.5)
      if ((i * 7 + b * 3 + h.n) % 5 === 0 && i % 2 === 0) k.ico({ c: LEAFY[(i + b) % 3], r: 1 }, 0.17, [x - 0.18, y + 0.3, f + 0.34], [1, (i + b) % 2 ? 1.8 : 1.3, 1], 0)
      // Towels hung over the rail.
      if ((i * 3 + b * 5 + seed) % 6 === 0) plane(k, { c: FLAGS[(i + b) % FLAGS.length], r: 0.9 }, 0.2, 0.3, [x + 0.1, y + 0.27, f + 0.495])
    }
  }
  // Roof: parapet, plant room, water tanks, the sign on its frame.
  k.box(band, [h.w + 0.08, 0.3, HD + 0.08], [0, H + 0.15, 0])
  k.box(CREAM, [1.6, 0.8, 1.4], [h.w / 4, H + 0.4, -0.6])
  k.cyl({ c: '#4a7fb5', r: 0.6 }, 0.25, 0.25, 0.5, [h.w / 4 - 0.4, H + 1.05, -0.6], undefined, 8)
  k.box(DARK, [0.05, 0.6, 0.05], [-h.w / 4 - 0.8, H + 0.6, f - 0.4])
  k.box(DARK, [0.05, 0.6, 0.05], [-h.w / 4 + 0.8, H + 0.6, f - 0.4])
  k.box(sign, [1.8, 0.5, 0.06], [-h.w / 4, H + 1.05, f - 0.4])
  k.box(DARK, [1.9, 0.6, 0.04], [-h.w / 4, H + 1.05, f - 0.45])
}

// A colonial town house: painted walls with white trim, tall shuttered windows, an iron balcony,
// a little shop on the ground floor with its striped awning and painted sign.
type Sob = { wall: string; trim: string; shut: string; n: number; roof: 'tile' | 'parapet'; awn: [string, string]; tiles?: string }
const SOB_WALLS = ['#f2c14e', '#e86a92', '#3fb6a8', '#5b8bd6', '#f08a4b', '#9ccc65', '#f5e6c8', '#c77dba', '#ef5350']
const SOB_SHUT = ['#2e7d32', '#1565c0', '#6d4c41', '#00796b', '#283593']
const TERRA: Look = { c: '#b5533b', r: 0.9 }
const SD = 3.2
function sobrado(k: PropKit, w: number, s: Sob, seed: number) {
  const f = SD / 2
  const G = 1.4
  const fl = 1.15
  const H = G + s.n * fl
  const wall: Look = { c: s.wall, r: 0.9 }
  const trim: Look = { c: s.trim, r: 0.8 }
  const shut: Look = { c: s.shut, r: 0.8 }
  k.box(wall, [w, H, SD], [0, H / 2, 0])
  for (const x of [-1, 1]) k.box(trim, [0.14, H, 0.06], [x * (w / 2 - 0.07), H / 2, f + 0.03])
  for (let i = 0; i < s.n; i++) k.box(trim, [w + 0.04, 0.08, 0.1], [0, G + i * fl - 0.04, f + 0.05])
  // Shop: lit inside, shelves of goods, the shutter half up, a striped awning, the sign.
  const ow = w - 0.5
  plane(k, WIN, ow, 0.95, [0, 0.55, f + 0.004])
  for (const y of [0.42, 0.72]) plane(k, DARK, ow, 0.035, [0, y, f + 0.006])
  const r = rand(seed * 31 + 7)
  for (let j = 0; j < 7; j++) plane(k, { c: FLAGS[Math.floor(r() * FLAGS.length)], r: 0.8 }, 0.12, 0.13 + r() * 0.08, [-ow / 2 + 0.15 + (ow - 0.3) * (j / 6), j % 2 ? 0.52 : 0.82, f + 0.008])
  k.box({ c: '#8f969c', r: 0.7 }, [ow, 0.2, 0.04], [0, 0.93, f + 0.02])
  for (const x of [-1, 1]) k.box(trim, [0.08, 1.05, 0.05], [x * (ow / 2 + 0.04), 0.52, f + 0.025])
  const m = Math.max(4, Math.round(ow / 0.3))
  for (let t = 0; t < m; t++) plane(k, { c: s.awn[t % 2], r: 0.85 }, ow / m + 0.002, 0.64, [-ow / 2 + (ow / m) * (t + 0.5), 1.1, f + 0.3], 0, -Math.PI / 2 + 0.38)
  k.box({ c: s.awn[0], r: 0.85 }, [ow, 0.1, 0.02], [0, 0.95, f + 0.6])
  k.box({ c: '#fbf6ea', r: 0.8 }, [ow * 0.8, 0.16, 0.03], [0, 1.28, f + 0.12])
  letters(k, { c: s.shut, r: 0.8 }, [0, 1.28, f + 0.14], ow * 0.6, 0.12, seed)
  // Upper floors: tall French windows, open shutters or closed, a moulded head over each.
  const nb = Math.max(2, Math.round(w / 1.05))
  for (let i = 0; i < s.n; i++) {
    const y0 = G + i * fl
    for (let b = 0; b < nb; b++) {
      const x = -w / 2 + (w / nb) * (b + 0.5)
      plane(k, trim, 0.56, 0.92, [x, y0 + 0.5, f + 0.002])
      if ((b * 3 + i * 5 + seed) % 4 === 0) plane(k, shut, 0.42, 0.8, [x, y0 + 0.48, f + 0.004])
      else {
        plane(k, WIN, 0.4, 0.78, [x, y0 + 0.48, f + 0.004])
        for (const sx of [-1, 1]) plane(k, shut, 0.2, 0.78, [x + sx * 0.33, y0 + 0.48, f + 0.03], sx * 0.5)
      }
      k.box(trim, [0.62, 0.07, 0.07], [x, y0 + 0.98, f + 0.035])
      if (i === 0) {
        // The balcony: a stone slab on its brackets and an iron rail.
        k.box(trim, [0.64, 0.05, 0.3], [x, y0 + 0.08, f + 0.15])
        k.box(DARK, [0.64, 0.03, 0.03], [x, y0 + 0.42, f + 0.29])
        for (let q = 0; q < 4; q++) plane(k, DARK, 0.025, 0.32, [x - 0.3 + q * 0.2, y0 + 0.26, f + 0.29])
        if ((b + seed) % 2 === 0) k.ico({ c: LEAFY[b % 3], r: 1 }, 0.1, [x + 0.2, y0 + 0.18, f + 0.18], [1, 1.2, 1], 0)
      } else k.box(trim, [0.5, 0.05, 0.1], [x, y0 + 0.07, f + 0.05])
    }
    // Azulejo fronts: a field of small blue and white tiles between the windows.
    if (s.tiles) for (let b = 1; b < nb; b++) {
      const x = -w / 2 + (w / nb) * b
      for (let q = 0; q < 4; q++) for (let p = 0; p < 2; p++) plane(k, { c: (q + p) % 2 ? s.tiles : '#f5f5f5', r: 0.4 }, 0.09, 0.09, [x + (p - 0.5) * 0.1, y0 + 0.2 + q * 0.18, f + 0.003])
    }
  }
  // The roof: clay tiles with a deep eave, or a parapet with urns and a little pediment.
  k.box(trim, [w + 0.12, 0.14, 0.22], [0, H, f + 0.03])
  if (s.roof === 'tile') {
    gable(k, TERRA, w + 0.16, SD + 0.4, 0.8, [0, H, 0])
    k.box({ c: '#8e3b28', r: 0.9 }, [w + 0.18, 0.06, 0.12], [0, H + 0.05, f + 0.2])
  } else {
    k.box(wall, [w, 0.4, 0.14], [0, H + 0.27, f - 0.05])
    k.box(trim, [w + 0.06, 0.06, 0.18], [0, H + 0.5, f - 0.05])
    for (const x of [-1, 1]) {
      k.box(trim, [0.16, 0.12, 0.16], [x * (w / 2 - 0.12), H + 0.59, f - 0.05])
      k.sphere(trim, 0.08, [x * (w / 2 - 0.12), H + 0.72, f - 0.05], [1, 1.3, 1], 6, 4)
    }
    gable(k, trim, w * 0.4, 0.12, 0.3, [0, H + 0.53, f - 0.05])
    k.box(TERRA, [w - 0.3, 0.1, SD - 0.5], [0, H + 0.05, -0.2])
  }
}

// The hillside behind the street: green humps with houses stacked up their faces, bare brick and
// painted, flat roofs with blue water tanks, lit windows, the odd tree and a chapel on top.
const FAV = ['#c8693f', '#b5603a', '#e8b04a', '#e57373', '#4fc3f7', '#81c784', '#f5f0e6', '#9e9e9e', '#ba68c8', '#ffb74d']
function hillside(k: PropKit, seed: number, bumps: [number, number, number][], x0 = -12, x1 = 12) {
  const green: Look = { c: '#3b6b35', r: 1 }
  const zc = -17
  for (const [bx, h, rx] of bumps) k.sphere(green, 1, [bx, 0, zc], [rx, h, 11], 12, 6, Math.PI / 2)
  const hy = (x: number, z: number) => Math.max(0, ...bumps.map(([bx, h, rx]) => h * Math.sqrt(Math.max(0, 1 - ((x - bx) / rx) ** 2 - ((z - zc) / 11) ** 2))))
  const r = rand(seed)
  const roof: Look = { c: '#8d8d86', r: 1 }
  const tank: Look = { c: '#2f7fd1', r: 0.7 }
  for (let z = -7.4; z > -23; z -= 1.1) {
    for (let x = x0 + r() * 0.5; x < x1; x += 0.95 + r() * 0.45) {
      if (r() < 0.5) continue
      const y = hy(x, z)
      if (y < 0.5) continue
      const bw = 0.75 + r() * 0.55
      const bh = 0.7 + r() * 0.45
      const base = y - 0.4
      const c = FAV[Math.floor(r() * FAV.length)]
      k.box({ c, r: 1 }, [bw, bh, 0.95], [x, base + bh / 2, z])
      if (r() < 0.3) k.box(roof, [bw + 0.08, 0.05, 1.03], [x, base + bh + 0.025, z])
      const lit = r()
      if (lit < 0.6) plane(k, WIN, 0.22, 0.24, [x - bw * 0.2, base + bh * 0.58, z + 0.479])
      else plane(k, DARK, 0.2, 0.42, [x + bw * 0.2, base + 0.3, z + 0.479])
      if (r() < 0.14) k.cyl(tank, 0.15, 0.15, 0.22, [x + bw * 0.2, base + bh + 0.13, z], undefined, 6)
      else if (r() < 0.2) k.box({ c: FAV[Math.floor(r() * FAV.length)], r: 1 }, [bw * 0.6, 0.55, 0.7], [x - bw * 0.1, base + bh + 0.27, z - 0.1])
      else if (r() < 0.06) k.ico({ c: LEAFY[Math.floor(r() * 3)], r: 1 }, 0.5, [x, base + bh + 0.3, z - 0.2], [1, 1.2, 1], 0)
    }
  }
  // A white chapel with its bell tower on the highest hump.
  const top = bumps.reduce((a, b) => (b[1] > a[1] ? b : a))
  const cy = top[1] - 0.5
  k.box(WHITE, [1.6, 1.2, 2.2], [top[0], cy + 0.6, zc])
  gable(k, TERRA, 1.7, 2.3, 0.5, [top[0], cy + 1.2, zc])
  k.box(WHITE, [0.6, 2.2, 0.6], [top[0] + 0.6, cy + 1.1, zc + 0.9])
  k.cone(TERRA, 0.45, 0.5, [top[0] + 0.6, cy + 2.45, zc + 0.9], undefined, 4)
  plane(k, WIN, 0.3, 0.5, [top[0], cy + 0.6, zc + 1.104])
}

// A frontage: buildings flush along the street (local x = down the road, fronts on z = 0) and the
// hillside behind; placed turned -90 degrees so the fronts face the road.
type Item = { kind: 'h'; i: number } | { kind: 's'; s: Sob; w?: number }
const FL = 24
const SOBS = (seed: number) => {
  const r = rand(seed)
  return (): Sob => ({
    wall: SOB_WALLS[Math.floor(r() * SOB_WALLS.length)],
    trim: r() < 0.8 ? '#fbf6ea' : '#f2d27a',
    shut: SOB_SHUT[Math.floor(r() * SOB_SHUT.length)],
    n: r() < 0.5 ? 2 : 3,
    roof: r() < 0.55 ? 'tile' : 'parapet',
    awn: [FLAGS[Math.floor(r() * 6)], '#ffffff'],
    tiles: r() < 0.25 ? '#2a5db0' : undefined,
  })
}
function row(k: PropKit, items: Item[], from: number, to: number, sign: Look, seed: number) {
  const gap = 0.04
  const fixed = items.reduce((a, it) => a + (it.kind === 'h' ? HOTELS[it.i].w : it.w ?? 0), 0)
  const free = items.filter((it) => it.kind === 's' && !it.w).length
  const sw = (to - from - fixed - gap * (items.length - 1)) / Math.max(1, free)
  let x = from
  items.forEach((it, j) => {
    const w = it.kind === 'h' ? HOTELS[it.i].w : it.w ?? sw
    const cx = x + w / 2
    if (it.kind === 'h') sub(k, (t) => hotel(t, HOTELS[it.i], sign, seed + j), [cx, 0, -HD / 2])
    else sub(k, (t) => sobrado(t, w, it.s, seed * 7 + j), [cx, 0, -SD / 2])
    x += w + gap
  })
}
const FRONTS: { items: (next: () => Sob) => Item[]; sign: string; bumps: [number, number, number][] }[] = [
  { items: (n) => [{ kind: 'h', i: 0 }, { kind: 's', s: n() }, { kind: 's', s: n() }, { kind: 's', s: n() }, { kind: 'h', i: 2 }, { kind: 's', s: n() }, { kind: 's', s: n() }], sign: '#4fc3ff', bumps: [[-7, 10, 8], [3, 13, 9], [10, 8, 6]] },
  { items: (n) => [{ kind: 's', s: n() }, { kind: 's', s: n() }, { kind: 'h', i: 1 }, { kind: 's', s: n() }, { kind: 's', s: n() }, { kind: 's', s: n() }, { kind: 'h', i: 3 }], sign: '#ff4f7b', bumps: [[-8, 12, 7], [0, 9, 7], [8, 14, 8]] },
  { items: (n) => [{ kind: 'h', i: 4 }, { kind: 's', s: n() }, { kind: 's', s: n() }, { kind: 's', s: n() }, { kind: 'h', i: 0 }, { kind: 's', s: n() }, { kind: 's', s: n() }], sign: '#ffd23f', bumps: [[-6, 14, 9], [5, 10, 7], [11, 12, 6]] },
]
function frontage(k: PropKit, v: number) {
  const F = FRONTS[v]
  row(k, F.items(SOBS(50 + v * 11)), -FL / 2, FL / 2, glow(F.sign, 0.2, 1.5), v * 5)
  hillside(k, 300 + v, F.bumps)
}

// The people's skin, hair and street clothes.
const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#5c3a21', '#a86b3c', '#d9a066']
const HAIR = ['#1b1b1b', '#3b2314', '#5a3a1a', '#111111', '#7a4a20']
const STREET: Dress[] = [
  { top: '#fdd835', low: '#1e3a5f', skin: SKIN[1], hair: HAIR[0] },
  { top: '#2e7d32', low: '#f5f5f5', skin: SKIN[4], hair: HAIR[3], hat: 'cap', hatC: '#fdd835' },
  { top: '#e91e63', low: '#263238', skin: SKIN[2], hair: HAIR[2], robe: true },
  { top: '#ffffff', low: '#5d4037', skin: SKIN[0], hair: HAIR[1] },
  { top: '#ff7043', low: '#37474f', skin: SKIN[3], hair: HAIR[4], robe: true },
  { top: '#29b6f6', low: '#eceff1', skin: SKIN[5], hair: HAIR[0], hat: 'cap', hatC: '#1565c0' },
  { top: '#8e24aa', low: '#fdd835', skin: SKIN[6], hair: HAIR[3], robe: true },
]

// The tiled stairway, facing +z: steps climbing away between tiled walls, every riser a row of
// coloured tiles, pot plants and a lamp at the top, people on their way up.
const TILES = ['#d32f2f', '#f9a825', '#2e7d32', '#1565c0', '#ffffff', '#00838f']
const STN = 26
const RUN = 0.42
const RISE = 0.2
function stairway(k: PropKit) {
  const W = 2.2
  for (let i = 0; i < STN; i++) {
    const z = -i * RUN
    const y = i * RISE
    k.box({ c: '#c94a3a', r: 0.8 }, [W, 0.06, RUN], [0, y + RISE, z])
    k.box({ c: '#9e9e9e', r: 1 }, [W, y + RISE - 0.03, RUN], [0, (y + RISE - 0.03) / 2, z])
    for (let t = 0; t < 8; t++) plane(k, { c: TILES[(i * 3 + t * 5) % TILES.length], r: 0.4 }, W / 8 - 0.02, RISE - 0.03, [-W / 2 + (W / 8) * (t + 0.5), y + RISE / 2, z + RUN / 2 + 0.004])
  }
  // Side walls tiled in a patchwork, stepping up with the stairs, a handrail along each.
  for (const s of [-1, 1]) {
    for (let i = 0; i < STN; i += 2) {
      const z = -i * RUN - RUN / 2
      const y = i * RISE
      k.box(CREAM, [0.3, y + 1.6, RUN * 2], [s * (W / 2 + 0.15), (y + 1.6) / 2, z])
      for (let j = 0; j < 3; j++) for (let q = 0; q < 2; q++) plane(k, { c: TILES[(i + j * 2 + q + (s > 0 ? 1 : 3)) % TILES.length], r: 0.4 }, RUN - 0.04, 0.36, [s * (W / 2 - 0.004), y + 0.45 + j * 0.42, z - RUN / 2 + q * RUN], -s * Math.PI / 2)
      // The outer faces too, seen from the street.
      for (let j = 0; j < 2; j++) plane(k, { c: TILES[(i + j + 2) % TILES.length], r: 0.4 }, RUN * 2 - 0.08, 0.5, [s * (W / 2 + 0.304), y + 0.5 + j * 0.6, z], s * Math.PI / 2)
    }
    k.rod(DARK, [s * (W / 2 - 0.08), 0.9, RUN / 2], [s * (W / 2 - 0.08), 0.9 + (STN - 1) * RISE, -(STN - 1) * RUN], 0.025, 4)
  }
  for (const s of [-1, 1]) {
    k.cyl({ c: '#b85c38', r: 0.9 }, 0.2, 0.15, 0.35, [s * 1.6, 0.18, 0.5], undefined, 8)
    k.ico({ c: '#3a8f45', r: 1 }, 0.35, [s * 1.6, 0.55, 0.5], [1, 0.8, 1])
  }
  const topY = STN * RISE
  k.box({ c: '#c94a3a', r: 0.8 }, [W + 0.6, 0.1, 1.6], [0, topY + 0.05, -STN * RUN - 0.6])
  k.cyl(DARK, 0.04, 0.05, 2, [0.9, topY + 1, -STN * RUN - 0.6], undefined, 6)
  k.sphere({ c: '#fff', use: glowMats.lamp }, 0.15, [0.9, topY + 2.05, -STN * RUN - 0.6])
  // The platform and the houses at the top stand on stone walls, windows lit down their faces.
  k.box({ c: '#a39a8a', r: 1 }, [W + 0.6, topY, 1.6], [0, topY / 2, -STN * RUN - 0.6])
  for (const [s, c] of [[-1, '#f9a825'], [1, '#1e88e5']] as const) {
    k.box({ c, r: 0.9 }, [2.4, topY + 2.4, 2.4], [s * 2.5, (topY + 2.4) / 2, -STN * RUN - 1.0])
    for (let y = 0; y < 3; y++) plane(k, WIN, 0.5, 0.6, [s * 2.5 + (y % 2 ? 0.4 : -0.4), topY + 1.4 - y * 1.7, -STN * RUN + 0.204])
    k.box(TERRA, [2.6, 0.2, 2.6], [s * 2.5, topY + 2.5, -STN * RUN - 1.0])
  }
  // Visitors: a couple posing halfway up, a man near the top, a girl coming down.
  ;[[2, -0.4, Math.PI], [9, 0.45, 0.4], [10, -0.2, 0.2], [19, 0.3, Math.PI]].forEach(([i, x, ry], j) => sub(k, (t) => person(t, STREET[(j * 3 + 1) % STREET.length], 0, 0, ry), [x, (i + 1) * RISE + 0.03, -i * RUN]))
}

// The slot with the stairway in it: the houses close in on both sides, the hill behind.
function stairSlot(k: PropKit, off: number) {
  const next = SOBS(77)
  const sign = glow('#3ddc97', 0.2, 1.5)
  const a = off - 1.62
  const b = off + 1.62
  if (a - -FL / 2 > 1.5) row(k, a - -FL / 2 > 11 ? [{ kind: 'h', i: 3 }, { kind: 's', s: next() }, { kind: 's', s: next() }, { kind: 's', s: next() }] : a - -FL / 2 > 7 ? [{ kind: 's', s: next() }, { kind: 's', s: next() }, { kind: 's', s: next() }] : [{ kind: 's', s: next() }, { kind: 's', s: next() }], -FL / 2, a, sign, 21)
  if (FL / 2 - b > 1.5) row(k, FL / 2 - b > 11 ? [{ kind: 's', s: next() }, { kind: 's', s: next() }, { kind: 's', s: next() }, { kind: 'h', i: 1 }] : FL / 2 - b > 7 ? [{ kind: 's', s: next() }, { kind: 's', s: next() }, { kind: 's', s: next() }] : [{ kind: 's', s: next() }, { kind: 's', s: next() }], b, FL / 2, sign, 23)
  sub(k, stairway, [off, 0, -0.3])
  hillside(k, 333, [[off - 9, 11, 7], [off + 9, 12, 7]], -FL / 2, FL / 2)
  // The hill the stairs climb into.
  k.sphere({ c: '#3b6b35', r: 1 }, 1, [off, 0, -19], [6, 8, 7], 12, 6, Math.PI / 2)
}

// ---------------------------------------------------------------------------------------------
// People, at the townspeople's size, with faces.
const P = 1.3
// A local-to-prop mapper matching person()'s.
const mapper = (x: number, z: number, ry: number) => {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  return (u: number, y: number, w: number): V3 => [x + (u * c + w * s) * P, y * P, z + (-u * s + w * c) * P]
}
// Beachwear: bare legs and board shorts, or a bikini.
function bather(k: PropKit, skin: string, hair: string, cloth: string, x: number, z: number, ry: number, bikini: boolean, wave = false) {
  person(k, { top: skin, low: skin, skin, hair, wave }, x, z, ry)
  const at = mapper(x, z, ry)
  const c: Look = { c: cloth, r: 0.8 }
  k.box(c, [0.165 * P, bikini ? 0.06 * P : 0.12 * P, 0.09 * P], at(0, bikini ? 0.25 : 0.215, 0), [0, ry, 0])
  if (bikini) k.box(c, [0.17 * P, 0.045 * P, 0.15 * P], at(0, 0.44, 0.012), [0, ry, 0])
}
// A samba dancer: sequins, a crown of feathers and a great fan of plumes at her back.
function dancer(k: PropKit, x: number, z: number, ry: number, c1: string, c2: string, skin: string) {
  bather(k, skin, HAIR[0], '#f2c230', x, z, ry, true, true)
  const at = mapper(x, z, ry)
  const gold: Look = { c: '#f2c230', r: 0.5 }
  k.box(gold, [0.18 * P, 0.03 * P, 0.11 * P], at(0, 0.21, 0), [0, ry, 0])
  for (let i = 0; i < 7; i++) {
    const a = -1.0 + (i / 6) * 2.0
    k.add({ c: i % 2 ? c1 : c2, r: 0.8 }, FEATHER, at(Math.sin(a) * 0.1, 0.68 + Math.cos(a) * 0.1, -0.03), [0, ry, -a], [0.025 * P, 0.09 * P, 0.008 * P])
  }
  for (let i = 0; i < 9; i++) {
    const a = -1.25 + (i / 8) * 2.5
    k.add({ c: i % 2 ? c1 : c2, r: 0.8 }, FEATHER, at(Math.sin(a) * 0.26, 0.42 + Math.cos(a) * 0.26, -0.11), [0, ry, -a], [0.045 * P, 0.2 * P, 0.01 * P])
  }
  k.box(gold, [0.2 * P, 0.035 * P, 0.02 * P], at(0, 0.66, 0.02), [0, ry, 0])
}
// A drummer of the samba school in white, a big drum slung at his waist.
function drummer(k: PropKit, x: number, z: number, ry: number, skin: string, band: string) {
  person(k, { top: '#ffffff', low: '#ffffff', skin, hair: HAIR[0], hat: 'cap', hatC: band, sash: band }, x, z, ry)
  const at = mapper(x, z, ry)
  k.cyl(STEEL, 0.1 * P, 0.1 * P, 0.16 * P, at(0, 0.34, 0.15), [0, ry, 0], 10)
  k.cyl(WHITE, 0.102 * P, 0.102 * P, 0.01 * P, at(0, 0.425, 0.15), [0, ry, 0], 10)
  k.cyl({ c: band, r: 0.8 }, 0.103 * P, 0.103 * P, 0.03 * P, at(0, 0.27, 0.15), [0, ry, 0], 10)
  k.rod({ c: '#6d4c41', r: 0.8 }, at(0.12, 0.29, 0.01), at(0.06, 0.45, 0.13), 0.008 * P, 3)
  k.rod({ c: '#6d4c41', r: 0.8 }, at(-0.12, 0.29, 0.01), at(-0.05, 0.44, 0.15), 0.008 * P, 3)
}
// People lying down (sunbathers): built standing, then laid on their backs, head towards -z.
const lying = (k: PropKit, make: (t: PropKit) => void, x: number, y: number, z: number, ry: number) => sub(k, make, [x, y, z], ry, -Math.PI / 2)

// Street clusters along the hotel-side pavement.
function strollers(k: PropKit, v: number) {
  const D = STREET
  if (v === 0) {
    person(k, D[0], 0, 0, 0.2)
    person(k, D[2], 0.42, 0.1, -0.3)
    person(k, D[5], -0.2, 1.4, Math.PI)
  } else if (v === 1) {
    person(k, D[3], 0, 0, Math.PI / 2)
    person(k, D[4], 0.5, 0.15, -Math.PI / 2)
    // A dog on a lead.
    const dog: Look = { c: '#c9a06a', r: 0.9 }
    k.box(dog, [0.12, 0.12, 0.3], [0.3, 0.17, 0.7])
    k.sphere(dog, 0.08, [0.3, 0.27, 0.88], [1, 1, 1.2], 6, 4)
    for (const [dx, dz] of [[-0.04, -0.1], [0.04, -0.1], [-0.04, 0.1], [0.04, 0.1]]) k.box(dog, [0.03, 0.12, 0.03], [0.3 + dx, 0.06, 0.7 + dz])
    k.rod(DARK, [0.06, 0.4, 0.05], [0.3, 0.25, 0.8], 0.006, 3)
  } else {
    person(k, D[6], 0, 0, Math.PI)
    person(k, D[1], 0.3, -0.5, 0.1)
    person(k, D[0], -0.35, -0.3, 0.5)
  }
}
// Promenade clusters: beachgoers in swimwear, a jogger, a man with a surfboard.
function beachgoers(k: PropKit, v: number) {
  if (v === 0) {
    bather(k, SKIN[2], HAIR[2], '#e53935', 0, 0, 0.1, true)
    bather(k, SKIN[1], HAIR[0], '#1e88e5', 0.45, 0.1, -0.2, false)
    bather(k, SKIN[4], HAIR[3], '#fdd835', 0.2, -1.2, Math.PI, false)
  } else if (v === 1) {
    bather(k, SKIN[0], HAIR[0], '#43a047', 0, 0, Math.PI, false)
    // His surfboard under his arm.
    k.sphere({ c: '#ff8a3d', r: 0.5 }, 1, [0.2, 0.4, 0], [0.03, 0.12, 0.55], 8, 5)
    bather(k, SKIN[3], HAIR[4], '#ec407a', -0.6, 1.0, 0, true)
  } else {
    bather(k, SKIN[5], HAIR[1], '#ffffff', 0, 0, 0, false)
    bather(k, SKIN[6], HAIR[0], '#8e24aa', 0.42, 0.05, 0, true)
    // Their child with a bucket and spade.
    person(k, { top: '#fdd835', low: '#1e88e5', skin: SKIN[6], hair: HAIR[0] }, 0.2, 0.55, 0.3)
  }
}
// A small wing of a samba school: two dancers and two drummers.
function sambaGroup(k: PropKit, v: number) {
  const [c1, c2] = v ? ['#26c6da', '#ffffff'] : ['#e91e63', '#fdd835']
  dancer(k, 0, 0, 0.3, c1, c2, SKIN[v ? 1 : 4])
  dancer(k, 0.9, 0.5, -0.4, c2, c1, SKIN[v ? 2 : 0])
  drummer(k, -0.3, -1.3, 0.1, SKIN[v ? 0 : 5], v ? '#1e88e5' : '#2e7d32')
  drummer(k, 0.5, -1.4, -0.1, SKIN[v ? 4 : 2], v ? '#1e88e5' : '#2e7d32')
}
// Beach sellers: the sarong seller with his pole of cloths, the iced-tea man with his two tanks.
function sellers(k: PropKit) {
  person(k, { top: '#ffffff', low: '#ffffff', skin: SKIN[0], hair: HAIR[0], hat: 'cap', hatC: '#ffffff' }, 0, 0, Math.PI / 2)
  const at = mapper(0, 0, Math.PI / 2)
  k.rod({ c: '#8d6e63', r: 0.9 }, at(0.12, 0, 0.05), at(0.12, 1.6, 0.05), 0.012, 4)
  const top = at(0.12, 1.55, 0.05)
  k.rod({ c: '#8d6e63', r: 0.9 }, [top[0], top[1], top[2] - 0.45], [top[0], top[1], top[2] + 0.45], 0.01, 4)
  ;['#e53935', '#fdd835', '#43a047', '#1e88e5', '#ff7043'].forEach((c, i) => k.box({ c, r: 0.9 }, [0.01, 0.6 - (i % 2) * 0.1, 0.17], [top[0] + 0.012, top[1] - 0.33 + (i % 2) * 0.05, top[2] - 0.38 + i * 0.19]))
  person(k, { top: '#ff7043', low: '#ff7043', skin: SKIN[1], hair: HAIR[0], hat: 'cap', hatC: '#ff7043' }, 1.4, 0.6, -Math.PI / 2)
  const b = mapper(1.4, 0.6, -Math.PI / 2)
  for (const u of [-1, 1]) {
    k.cyl(STEEL, 0.06 * P, 0.06 * P, 0.26 * P, b(u * 0.15, 0.34, 0), undefined, 8)
    k.cyl({ c: '#ff7043', r: 0.8 }, 0.062 * P, 0.062 * P, 0.03 * P, b(u * 0.15, 0.47, 0), undefined, 8)
  }
}

// ---------------------------------------------------------------------------------------------
// The lay-by: Rio's yellow taxis with their blue stripe, a round little beetle, an old camper van.
const WHEEL: Look = { c: '#1d1d1d', r: 0.9 }
function wheels(k: PropKit, x: number, z: number, r = 0.2) {
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    k.cyl(WHEEL, r, r, 0.14, [s * x, r, z * t], [0, 0, Math.PI / 2], 8)
    k.cyl(STEEL, r * 0.5, r * 0.5, 0.15, [s * x, r, z * t], [0, 0, Math.PI / 2], 6)
  }
}
function lights(k: PropKit, w: number, y: number, zf: number, zb: number) {
  for (const s of [-1, 1]) {
    plane(k, { c: '#fff6d8', r: 0.3 }, 0.18, 0.1, [s * (w / 2 - 0.16), y, zf + 0.003])
    plane(k, { c: '#d32f2f', r: 0.5 }, 0.16, 0.1, [s * (w / 2 - 0.16), y, zb - 0.003], Math.PI)
  }
}
function taxi(k: PropKit, z0: number) {
  const yel: Look = { c: '#f6c21c', r: 0.5 }
  const blue: Look = { c: '#1e5aa8', r: 0.6 }
  k.box(yel, [1.1, 0.38, 2.3], [0, 0.44, z0])
  k.box(yel, [0.96, 0.36, 1.2], [0, 0.81, z0 - 0.15])
  for (const s of [-1, 1]) {
    plane(k, GLASS_D, 1.05, 0.25, [s * 0.483, 0.82, z0 - 0.15], s * Math.PI / 2)
    plane(k, blue, 2.1, 0.07, [s * 0.553, 0.46, z0], s * Math.PI / 2)
  }
  plane(k, GLASS_D, 0.86, 0.28, [0, 0.82, z0 + 0.453], 0, -0.25)
  plane(k, GLASS_D, 0.86, 0.26, [0, 0.82, z0 - 0.753], Math.PI, -0.25)
  k.box(WHITE, [0.36, 0.1, 0.16], [0, 1.04, z0 - 0.15])
  for (const zz of [1.17, -1.17]) k.box({ c: '#8c8c8c', r: 0.6 }, [1.12, 0.1, 0.06], [0, 0.3, z0 + zz])
  lights(k, 1.1, 0.5, z0 + 1.15, z0 - 1.15)
  wheels(k, 0.5, 0.75)
}
function fusca(k: PropKit, z0: number, c: string) {
  const body: Look = { c, r: 0.45 }
  k.box(body, [0.92, 0.3, 2.0], [0, 0.38, z0])
  k.sphere(body, 1, [0, 0.5, z0 - 0.05], [0.48, 0.45, 0.98], 12, 6, Math.PI / 2)
  for (const s of [-1, 1]) for (const t of [-1, 1]) k.sphere(body, 1, [s * 0.44, 0.32, z0 + t * 0.68], [0.13, 0.2, 0.32], 8, 4, Math.PI / 2)
  for (const s of [-1, 1]) plane(k, GLASS_D, 0.7, 0.18, [s * 0.4, 0.78, z0 - 0.05], s * Math.PI / 2, -0.45)
  plane(k, GLASS_D, 0.56, 0.22, [0, 0.79, z0 + 0.4], 0, -0.75)
  for (const s of [-1, 1]) k.sphere({ c: '#fff6d8', r: 0.3 }, 0.07, [s * 0.4, 0.5, z0 + 0.95], [1, 1, 0.6], 6, 4)
  for (const zz of [1.02, -1.02]) k.box(STEEL, [0.96, 0.06, 0.05], [0, 0.28, z0 + zz])
  plane(k, { c: '#d32f2f', r: 0.5 }, 0.5, 0.08, [0, 0.45, z0 - 1.003], Math.PI)
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    k.cyl(WHEEL, 0.19, 0.19, 0.13, [s * 0.44, 0.19, z0 + t * 0.68], [0, 0, Math.PI / 2], 8)
    k.cyl(STEEL, 0.1, 0.1, 0.14, [s * 0.44, 0.19, z0 + t * 0.68], [0, 0, Math.PI / 2], 6)
  }
}
function kombi(k: PropKit, z0: number, c: string) {
  const low: Look = { c, r: 0.55 }
  k.box(low, [1.1, 0.55, 2.2], [0, 0.5, z0])
  k.box(WHITE, [1.1, 0.5, 2.2], [0, 1.02, z0])
  k.box(WHITE, [1.0, 0.08, 2.0], [0, 1.3, z0])
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) plane(k, GLASS_D, 0.42, 0.28, [s * 0.553, 1.04, z0 + 0.75 - i * 0.48], s * Math.PI / 2)
    // The V on the nose.
    k.box(low, [0.6, 0.1, 0.02], [s * 0.26, 0.74, z0 + 1.105], [0, 0, s * 0.55])
  }
  for (const s of [-1, 1]) plane(k, GLASS_D, 0.47, 0.3, [s * 0.26, 1.05, z0 + 1.103])
  for (const s of [-1, 1]) k.cyl({ c: '#fff6d8', r: 0.3 }, 0.07, 0.07, 0.03, [s * 0.38, 0.6, z0 + 1.11], [Math.PI / 2, 0, 0], 8)
  k.cyl(STEEL, 0.06, 0.06, 0.03, [0, 0.82, z0 + 1.11], [Math.PI / 2, 0, 0], 8)
  for (const zz of [1.13, -1.13]) k.box(STEEL, [1.12, 0.07, 0.05], [0, 0.26, z0 + zz])
  plane(k, { c: '#d32f2f', r: 0.5 }, 0.12, 0.16, [0.45, 0.62, z0 - 1.103], Math.PI)
  plane(k, { c: '#d32f2f', r: 0.5 }, 0.12, 0.16, [-0.45, 0.62, z0 - 1.103], Math.PI)
  wheels(k, 0.5, 0.75, 0.19)
}

// ---------------------------------------------------------------------------------------------
// The hotel-side pavement's furniture, built with the road on +z and placed turned -90 degrees.

// A bus stop: glass shelter and bench, the stop's sign, a public phone in its orange hood, a bin
// and two people waiting.
function busStop(k: PropKit) {
  for (const x of [-0.85, 0.85]) k.box(STEEL, [0.05, 1.32, 0.05], [x, 0.66, 0.85])
  for (const x of [-0.85, 0.85]) k.box(STEEL, [0.05, 1.32, 0.05], [x, 0.66, 0.28])
  k.box(WHITE, [1.95, 0.06, 0.78], [0, 1.35, 0.57])
  plane(k, GLASS_P, 1.7, 0.9, [0, 0.8, 0.26])
  plane(k, { c: '#ffd54f', r: 0.5 }, 0.5, 0.8, [-0.55, 0.78, 0.268])
  k.box({ c: '#6d4c41', r: 0.8 }, [1.4, 0.05, 0.26], [0, 0.32, 0.42])
  for (const x of [-0.6, 0.6]) k.box(STEEL, [0.04, 0.3, 0.2], [x, 0.16, 0.42])
  k.box(STEEL, [0.05, 1.7, 0.05], [1.25, 0.85, 0.95])
  k.box({ c: '#1565c0', r: 0.6 }, [0.04, 0.32, 0.42], [1.25, 1.55, 0.95])
  // The phone: a pole, the orange egg hood open towards the street, the handset inside.
  k.box(STEEL, [0.05, 1.05, 0.05], [-1.45, 0.52, 0.5])
  k.add({ c: '#f57c00', r: 0.5 }, HOOD, [-1.45, 1.1, 0.5], [-Math.PI / 2, 0, 0], [0.3, 0.3, 0.36])
  k.box({ c: '#5f6a72', r: 0.6 }, [0.16, 0.24, 0.08], [-1.45, 1.06, 0.4])
  k.cyl({ c: '#ef6c00', r: 0.7 }, 0.13, 0.11, 0.42, [-2.0, 0.21, 0.75], undefined, 8)
  person(k, STREET[2], -0.2, 0.55, 0)
  person(k, STREET[5], 0.45, 0.6, -0.4)
}
// A newsstand: the green kiosk hung with magazines, its seller, a bench beside it.
function banca(k: PropKit) {
  const g: Look = { c: '#2e6b3f', r: 0.7 }
  k.box(g, [1.8, 1.1, 0.8], [0, 0.55, 0.2])
  k.box(g, [2.0, 0.06, 1.1], [0, 1.14, 0.3])
  plane(k, WIN, 1.5, 0.75, [0, 0.62, 0.604])
  const r = rand(5)
  for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) plane(k, { c: FLAGS[Math.floor(r() * FLAGS.length)], r: 0.7 }, 0.15, 0.2, [-0.6 + x * 0.2, 0.37 + y * 0.25, 0.608])
  k.box({ c: '#fdd835', r: 0.7 }, [1.6, 0.14, 0.03], [0, 1.0, 0.86])
  letters(k, { c: '#1b5e20', r: 0.7 }, [0, 1.0, 0.877], 1.2, 0.08, 9)
  for (let x = 0; x < 3; x++) plane(k, { c: FLAGS[(x + 2) % 7], r: 0.7 }, 0.16, 0.22, [0.91, 0.55 + (x % 2) * 0.25, 0.25 - x * 0.2], Math.PI / 2)
  person(k, STREET[3], 1.15, 0.65, -0.3)
  k.box(WHITE, [0.9, 0.06, 0.3], [-1.6, 0.3, 0.5])
  for (const x of [-1.95, -1.25]) k.box(WHITE, [0.08, 0.3, 0.3], [x, 0.15, 0.5])
  person(k, STREET[1], -1.8, 0.85, 0.4)
}
// Street food: the corn seller's steaming cart under a parasol, the popcorn cart, a customer, and
// a dock of orange hire bikes.
function vendors(k: PropKit) {
  const grn: Look = { c: '#2e7d32', r: 0.7 }
  k.box(grn, [0.8, 0.5, 0.5], [0, 0.55, 0.5])
  for (const s of [-1, 1]) k.cyl(WHEEL, 0.17, 0.17, 0.05, [s * 0.42, 0.17, 0.5], [0, 0, Math.PI / 2], 8)
  k.cyl(STEEL, 0.18, 0.18, 0.22, [-0.15, 0.91, 0.5], undefined, 10)
  k.cyl({ c: '#f2c230', r: 0.7 }, 0.14, 0.14, 0.03, [0.22, 0.82, 0.5], undefined, 8)
  k.rod(WHITE, [0.3, 0.8, 0.35], [0.3, 1.9, 0.35], 0.015, 4)
  k.cone({ c: '#fdd835', r: 0.8 }, 0.65, 0.25, [0.3, 1.98, 0.35], undefined, 8)
  person(k, { top: '#ffffff', low: '#37474f', skin: SKIN[0], hair: HAIR[0], hat: 'cap', hatC: '#2e7d32' }, 0, 0.0, 0)
  const red: Look = { c: '#d32f2f', r: 0.6 }
  k.box(red, [0.7, 0.55, 0.45], [1.3, 0.55, 0.55])
  k.box(WHITE, [0.72, 0.08, 0.47], [1.3, 0.5, 0.55])
  plane(k, GLASS_P, 0.6, 0.4, [1.3, 1.05, 0.79])
  k.box({ c: '#ffe082', r: 0.9 }, [0.56, 0.2, 0.38], [1.3, 0.94, 0.55])
  k.box(red, [0.74, 0.05, 0.5], [1.3, 1.27, 0.55])
  for (const s of [-1, 1]) k.cyl(WHEEL, 0.15, 0.15, 0.05, [1.3 + s * 0.37, 0.15, 0.55], [0, 0, Math.PI / 2], 8)
  person(k, STREET[4], 0.75, 0.95, Math.PI + 0.3)
  // Hire bikes, in a row at their dock.
  const org: Look = { c: '#f57c00', r: 0.6 }
  k.box({ c: '#5f6a72', r: 0.7 }, [2.2, 0.06, 0.12], [-2.2, 0.03, 0.3])
  for (let i = 0; i < 5; i++) {
    const x = -3.1 + i * 0.45
    for (const z of [0.05, 0.75]) k.torus(WHEEL, 0.16, 0.015, [x, 0.17, z], [0, Math.PI / 2, 0], TAU, 10, 3)
    k.rod(org, [x, 0.17, 0.05], [x, 0.4, 0.35], 0.018, 4)
    k.rod(org, [x, 0.4, 0.35], [x, 0.17, 0.75], 0.018, 4)
    k.rod(org, [x, 0.4, 0.35], [x, 0.47, 0.68], 0.018, 4)
    k.rod(org, [x, 0.4, 0.3], [x, 0.5, 0.2], 0.015, 4)
    k.box(DARK, [0.06, 0.03, 0.14], [x, 0.51, 0.19])
    k.box(DARK, [0.3, 0.02, 0.02], [x, 0.53, 0.67])
    k.box(org, [0.16, 0.1, 0.12], [x, 0.5, 0.8])
  }
}

// ---------------------------------------------------------------------------------------------
// The beach side.

// A beach kiosk: a round counter under a white roof, its menu board lit, two tables with folded
// umbrellas and plastic chairs, the coconut cart, surfboards; its keeper and two customers.
function kiosk(k: PropKit) {
  k.cyl({ c: '#2e7d5b', r: 0.7 }, 0.75, 0.8, 1.0, [0, 0.5, 0], undefined, 12)
  k.cyl(WHITE, 0.82, 0.82, 0.06, [0, 1.03, 0], undefined, 12)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4
    k.cyl(WHITE, 0.04, 0.04, 0.9, [Math.cos(a) * 0.68, 1.5, Math.sin(a) * 0.68], undefined, 5)
  }
  k.cone(WHITE, 1.25, 0.55, [0, 2.2, 0], undefined, 12)
  k.cyl(glow('#ffd23f', 0.2, 1.4), 1.0, 1.0, 0.14, [0, 1.88, 0], undefined, 12)
  for (const [x, z] of [[1.6, 0.6], [1.5, -1.0]]) {
    k.cyl(WHITE, 0.32, 0.32, 0.04, [x, 0.5, z], undefined, 10)
    k.cyl(WHITE, 0.04, 0.04, 0.5, [x, 0.25, z], undefined, 5)
    k.cyl({ c: '#c0392b', r: 0.7 }, 0.03, 0.03, 1.6, [x, 0.8, z], undefined, 5)
    k.cone({ c: '#ef5350', r: 0.8 }, 0.11, 0.7, [x, 1.4, z], undefined, 8)
    for (const s of [-1, 1]) {
      k.box(WHITE, [0.26, 0.04, 0.26], [x + s * 0.48, 0.28, z])
      k.box(WHITE, [0.04, 0.3, 0.26], [x + s * 0.6, 0.45, z])
    }
    // Bottles and coconuts on the table.
    k.cyl({ c: '#2e7d32', r: 0.4 }, 0.03, 0.03, 0.14, [x + 0.1, 0.59, z], undefined, 5)
    k.sphere({ c: '#5f9e3a', r: 0.8 }, 0.08, [x - 0.1, 0.6, z + 0.05], [1, 0.9, 1], 6, 4)
  }
  const cx = -1.5
  const cz = 0.9
  k.box({ c: '#1f8a4c', r: 0.7 }, [0.6, 0.45, 1.0], [cx, 0.55, cz])
  k.box(WHITE, [0.62, 0.06, 1.02], [cx, 0.8, cz])
  for (const s of [-1, 1]) k.cyl(DARK, 0.2, 0.2, 0.05, [cx + s * 0.33, 0.2, cz - 0.15], [0, 0, Math.PI / 2], 8)
  k.rod(DARK, [cx, 0.4, cz + 0.5], [cx, 0.1, cz + 0.62], 0.02, 4)
  for (const [x, y, z] of [[-0.12, 0, -0.22], [0.12, 0, -0.18], [-0.1, 0, 0.25], [0.13, 0, 0.27], [0.01, 0.13, 0.03]]) k.sphere({ c: '#5f9e3a', r: 0.8 }, 0.11, [cx + x, 0.92 + y, cz + z], [1, 0.9, 1], 6, 4)
  k.rod(WHITE, [cx + 0.25, 0.8, cz + 0.4], [cx + 0.25, 2.0, cz + 0.4], 0.02, 4)
  k.cone({ c: '#fdd835', r: 0.8 }, 0.7, 0.3, [cx + 0.25, 2.1, cz + 0.4], undefined, 8)
  for (const z of [-2.25, -0.95]) k.box(DARK, [0.05, 0.75, 0.05], [-0.5, 0.375, z])
  k.box(DARK, [0.05, 0.05, 1.35], [-0.5, 0.72, -1.6])
  k.box(DARK, [0.3, 0.05, 1.35], [-0.42, 0.06, -1.6])
  ;['#ff8a3d', '#4fc3ff', '#ffffff', '#ff4f7b'].forEach((c, i) => k.sphere({ c, r: 0.5 }, 1, [-0.42 + i * 0.1, 0.95, -1.6 + (i - 1.5) * 0.3], [0.03, 0.95, 0.2], 8, 5))
  person(k, { top: '#ffffff', low: '#2e7d5b', skin: SKIN[0], hair: HAIR[0], hat: 'cap', hatC: '#2e7d5b' }, -0.3, -0.2, -Math.PI / 2 - 0.4)
  bather(k, SKIN[2], HAIR[2], '#ec407a', 1.1, 0.1, -Math.PI / 2, true)
  bather(k, SKIN[4], HAIR[3], '#1e88e5', -1.0, 1.7, Math.PI, false)
}

// Rented beach chairs: three open parasols in the sand, each with a pair of loungers and a cool
// box, sunbathers stretched out on them and a friend standing with a drink.
const SHADES = [['#e53935', '#ffffff'], ['#1e88e5', '#fdd835'], ['#43a047', '#ffffff'], ['#fb8c00', '#1e88e5']]
function parasols(k: PropKit) {
  ;[[0, 0, 0], [0.4, 3.0, 1], [-0.3, -3.1, 2]].forEach(([x, z, i]) => {
    const [a, b] = SHADES[i % SHADES.length]
    k.rod(WHITE, [x, 0, z], [x + 0.08, 2.0, z], 0.025, 5)
    k.cone({ c: a, r: 0.8 }, 1.05, 0.36, [x + 0.08, 2.05, z], [0, 0, 0], 8)
    k.cone({ c: b, r: 0.8 }, 1.06, 0.355, [x + 0.08, 2.05, z], [0, Math.PI / 8, 0], 8)
    k.cyl({ c: a, r: 0.8 }, 1.06, 1.06, 0.12, [x + 0.08, 1.81, z], undefined, 8)
    k.cone(WHITE, 0.05, 0.1, [x + 0.08, 2.27, z], undefined, 4)
    for (const s of [-1, 1]) {
      const lx = x + 0.6
      const lz = z + s * 0.45
      k.box(WHITE, [1.3, 0.05, 0.5], [lx, 0.25, lz])
      k.box(WHITE, [0.05, 0.25, 0.5], [lx - 0.6, 0.13, lz])
      k.box(WHITE, [0.05, 0.25, 0.5], [lx + 0.6, 0.13, lz])
      k.box(WHITE, [0.5, 0.05, 0.5], [lx - 0.85, 0.45, lz], [0, 0, -0.8])
      k.box({ c: s > 0 ? a : b, r: 0.9 }, [1.1, 0.03, 0.42], [lx + 0.08, 0.29, lz])
      // A sunbather on this lounger, head to the backrest.
      if ((i + s + 3) % 3 !== 0) {
        const sk = SKIN[(i * 2 + s + 3) % SKIN.length]
        lying(k, (t) => bather(t, sk, HAIR[(i + 1) % HAIR.length], FLAGS[(i * 2 + (s > 0 ? 1 : 0)) % 6], 0, 0, 0, s > 0), lx + 0.55, 0.42, lz, Math.PI / 2)
      }
    }
    k.box({ c: '#1e88e5', r: 0.6 }, [0.4, 0.3, 0.28], [x - 0.5, 0.15, z + 0.2])
    k.box(WHITE, [0.42, 0.04, 0.3], [x - 0.5, 0.32, z + 0.2])
    if (i === 1) bather(k, SKIN[5], HAIR[0], '#fdd835', x - 0.7, z - 0.8, Math.PI / 2, false)
  })
}

// A lifeguard post on stilts, white with a blue band, its flag flying, the guard on watch.
function lifeguard(k: PropKit) {
  for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) k.cyl(WHITE, 0.05, 0.05, 1.8, [x, 0.9, z], undefined, 6)
  k.box(WHITE, [1.4, 1.0, 1.4], [0, 2.3, 0])
  k.box({ c: '#1e5aa8', r: 0.6 }, [1.42, 0.22, 1.42], [0, 2.05, 0])
  plane(k, GLASS_P, 1.0, 0.4, [0, 2.45, 0.704])
  k.box(WHITE, [1.7, 0.1, 1.7], [0, 2.85, 0])
  for (let i = 0; i < 7; i++) k.box(WHITE, [0.5, 0.04, 0.16], [0, 0.18 + i * 0.25, 0.9 + i * 0.12], [0.45, 0, 0])
  k.cyl(DARK, 0.03, 0.03, 1.4, [0.6, 3.5, -0.6], undefined, 5)
  k.box({ c: '#e53935', r: 0.8 }, [0.02, 0.32, 0.5], [0.6, 4.0, -0.35])
  k.box(glow('#fff2c0', 0.1, 1.2), [0.2, 0.12, 0.2], [0, 2.95, 0])
  // A rescue board leaning on the stilts and the guard in red at the foot of the ladder.
  k.sphere({ c: '#fdd835', r: 0.5 }, 1, [-0.7, 0.6, 0.3], [0.04, 0.6, 0.18], 8, 5)
  bather(k, SKIN[1], HAIR[0], '#e53935', 0.55, 1.5, 0, false)
}

// A volleyball net with its four players mid-rally, and beside it a beach football pitch with
// its goals, nets and corner flags, and a game on.
function volley(k: PropKit) {
  for (const z of [-2.2, 2.2]) k.cyl(WHITE, 0.05, 0.05, 1.6, [0, 0.8, z], undefined, 6)
  k.box({ c: '#1b1b1b', r: 1 }, [0.02, 0.5, 4.4], [0, 1.3, 0])
  k.box(WHITE, [0.03, 0.05, 4.4], [0, 1.56, 0])
  k.sphere({ c: '#ffd23f', r: 0.7 }, 0.1, [0.6, 1.75, 0.4], [1, 1, 1], 10, 6)
  // Court lines.
  for (const s of [-1, 1]) k.box({ c: '#1e88e5', r: 0.8 }, [3.2, 0.012, 0.04], [0, 0.006, s * 2.0])
  for (const s of [-1, 1]) k.box({ c: '#1e88e5', r: 0.8 }, [0.04, 0.012, 4.0], [s * 1.6, 0.006, 0])
  bather(k, SKIN[1], HAIR[0], '#e53935', 0.8, -0.8, -Math.PI / 2, false, true)
  bather(k, SKIN[4], HAIR[3], '#e53935', 1.2, 0.9, -Math.PI / 2, false)
  bather(k, SKIN[2], HAIR[2], '#1e88e5', -0.8, 0.6, Math.PI / 2, true, true)
  bather(k, SKIN[3], HAIR[4], '#1e88e5', -1.2, -1.0, Math.PI / 2, true)
  const gx = -4
  for (const s of [-1, 1]) {
    const z = s * 4.5
    for (const t of [-1, 1]) k.cyl(WHITE, 0.04, 0.04, 1.0, [gx + t * 0.9, 0.5, z], undefined, 6)
    k.rod(WHITE, [gx - 0.9, 1.0, z], [gx + 0.9, 1.0, z], 0.04, 6)
    for (const t of [-1, 1]) k.rod(WHITE, [gx + t * 0.9, 1.0, z], [gx + t * 0.9, 0, z + s * 0.6], 0.025, 4)
    for (let t = 1; t < 6; t++) k.rod({ c: '#e8e8e8', r: 1 }, [gx - 0.9 + t * 0.3, 1.0, z], [gx - 0.9 + t * 0.3, 0, z + s * 0.6], 0.01, 3)
    for (const u of [0.33, 0.66]) k.rod({ c: '#e8e8e8', r: 1 }, [gx - 0.9, 1.0 - u, z + s * 0.6 * u], [gx + 0.9, 1.0 - u, z + s * 0.6 * u], 0.01, 3)
    for (const t of [-1, 1]) {
      k.rod(DARK, [gx + t * 1.8, 0, z], [gx + t * 1.8, 0.6, z], 0.015, 4)
      k.box({ c: '#e53935', r: 0.8 }, [0.01, 0.14, 0.2], [gx + t * 1.8, 0.52, z - s * 0.1])
    }
  }
  k.sphere(WHITE, 0.09, [gx + 0.4, 0.09, -1.2], [1, 1, 1], 8, 6)
  bather(k, SKIN[0], HAIR[0], '#fdd835', gx + 0.6, -1.5, 0.3, false)
  bather(k, SKIN[5], HAIR[1], '#43a047', gx - 0.3, -0.3, Math.PI + 0.2, false)
  bather(k, SKIN[6], HAIR[0], '#43a047', gx, 3.8, Math.PI, false, true)
}

// A fishing boat pulled up on the sand: painted hull, a stripe, benches, oars and a net.
function boat(k: PropKit) {
  const hull: Look = { c: '#2a7fd4', r: 0.6 }
  k.add(hull, HULL, [0, 0.42, 0], [Math.PI, 0, 0], [0.6, 0.42, 1.9])
  k.box({ c: '#5d4037', r: 0.9 }, [0.9, 0.04, 2.6], [0, 0.4, 0])
  k.box({ c: '#fdd835', r: 0.7 }, [1.04, 0.07, 3.0], [0, 0.44, 0])
  for (const z of [-0.6, 0.5]) k.box({ c: '#8d6e63', r: 0.9 }, [1.0, 0.05, 0.2], [0, 0.5, z])
  k.rod({ c: '#a1887f', r: 0.9 }, [0.3, 0.48, -1.0], [0.6, 0.15, 1.2], 0.02, 4)
  k.rod({ c: '#a1887f', r: 0.9 }, [-0.3, 0.48, -1.0], [-0.55, 0.12, 1.1], 0.02, 4)
  k.sphere({ c: '#9e9d89', r: 1 }, 0.3, [0.1, 0.52, -0.1], [1, 0.4, 1.4], 6, 4)
  k.rod(WHITE, [0, 0.4, 1.8], [0, 0.95, 1.95], 0.02, 4)
  plane(k, { c: '#ffffff', r: 0.8 }, 0.5, 0.1, [0.585, 0.3, -0.1], Math.PI / 2)
  letters(k, { c: '#0d47a1', r: 0.7 }, [0.59, 0.3, -0.1], 0.44, 0.06, 3, Math.PI / 2)
}

// A sailing dinghy out in the bay.
function sailboat(k: PropKit, c: string) {
  k.add({ c: '#f5f5f5', r: 0.6 }, HULL, [0, 0.12, 0], [Math.PI, 0, 0], [0.45, 0.35, 1.5])
  k.box({ c: '#c9b38a', r: 0.9 }, [0.7, 0.04, 2.2], [0, 0.12, 0])
  k.rod(WHITE, [0, 0.12, 0.3], [0, 3.4, 0.3], 0.035, 5)
  k.rod(WHITE, [0, 0.6, 0.3], [0, 0.6, -1.3], 0.025, 4)
  k.add({ c, r: 0.8 }, SAIL, [0, 0.62, 0.28], [0, Math.PI / 2, 0], [1.6, 2.7, 1])
  k.add({ c: '#ffffff', r: 0.8 }, SAIL, [0, 0.62, 0.34], [0, -Math.PI / 2, 0], [0.9, 2.4, 1])
}

// Sandcastles, bags and boogie boards on towels, a kid digging, a couple stretched out.
function sandLife(k: PropKit, v: number) {
  const sand: Look = { c: '#d9bf86', r: 1 }
  const towel = (x: number, z: number, c: string) => k.box({ c, r: 0.9 }, [0.55, 0.02, 1.1], [x, 0.012, z])
  if (v === 0) {
    towel(0, 0, '#e53935')
    towel(0.65, 0.1, '#fdd835')
    lying(k, (t) => bather(t, SKIN[3], HAIR[4], '#1e88e5', 0, 0, 0, true), 0, 0.1, 0.45, 0)
    lying(k, (t) => bather(t, SKIN[0], HAIR[0], '#43a047', 0, 0, 0, false), 0.65, 0.1, 0.55, 0)
    k.box({ c: '#8e24aa', r: 0.8 }, [0.3, 0.2, 0.14], [-0.45, 0.1, -0.3])
    k.sphere({ c: '#ff7043', r: 0.5 }, 1, [1.15, 0.03, 0], [0.22, 0.03, 0.45], 8, 4)
  } else {
    // The sandcastle: a keep and four towers, a moat dug round it.
    k.box(sand, [0.6, 0.22, 0.6], [0, 0.11, 0])
    k.cyl(sand, 0.12, 0.15, 0.4, [0, 0.42, 0], undefined, 6)
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) k.cyl(sand, 0.08, 0.1, 0.32, [x, 0.16, z], undefined, 6)
    k.torus({ c: '#bfa36a', r: 1 }, 0.55, 0.06, [0, 0.005, 0], [Math.PI / 2, 0, 0], TAU, 12, 3)
    person(k, { top: '#ff4081', low: '#ff4081', skin: SKIN[2], hair: HAIR[1] }, 0.75, 0.2, -Math.PI / 2)
    k.cyl({ c: '#fdd835', r: 0.6 }, 0.07, 0.05, 0.12, [0.6, 0.06, -0.3], undefined, 8)
    towel(-1.2, 0.4, '#1e88e5')
    lying(k, (t) => bather(t, SKIN[5], HAIR[0], '#fb8c00', 0, 0, 0, true), -1.2, 0.1, 0.85, 0)
  }
}

// The promenade's furniture: a bench facing the sea, the beach shower, a bin, a drinking fountain.
function promUnit(k: PropKit) {
  k.box(WHITE, [0.3, 0.3, 1.3], [0, 0.15, 0])
  for (let i = 0; i < 3; i++) k.box({ c: '#8d6e63', r: 0.9 }, [0.1, 0.03, 1.3], [-0.1 + i * 0.1, 0.32, 0])
  k.box({ c: '#8d6e63', r: 0.9 }, [0.03, 0.25, 1.3], [0.15, 0.5, 0])
  k.cyl(STEEL, 0.05, 0.05, 1.7, [0, 0.85, 2.0], undefined, 6)
  k.box(STEEL, [0.3, 0.04, 0.06], [-0.13, 1.7, 2.0])
  k.cyl(STEEL, 0.07, 0.03, 0.05, [-0.26, 1.66, 2.0], undefined, 6)
  k.cyl({ c: '#bdbdbd', r: 0.9 }, 0.3, 0.3, 0.03, [0, 0.015, 2.0], undefined, 8)
  k.cyl({ c: '#ef6c00', r: 0.7 }, 0.13, 0.11, 0.42, [0, 0.21, -1.0], undefined, 8)
  person(k, STREET[6], -0.15, 0.3, -Math.PI / 2)
}

// A string of coloured festoon bulbs across the avenue, sagging between two posts, and a higher
// line of carnival pennants.
function festoon(k: PropKit) {
  const span = EDGE * 2 + 1.6
  for (const s of [-1, 1]) {
    k.cyl(DARK, 0.05, 0.06, 5.2, [s * span / 2, 2.6, 0], undefined, 6)
    k.sphere(glow('#fff2c0', 0.15, 1.4), 0.14, [s * span / 2, 5.3, 0])
  }
  const N = 16
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const x = -span / 2 + span * t
    const y = 5 - Math.sin(t * Math.PI) * 0.7
    if (i < N) {
      const x2 = -span / 2 + span * ((i + 1) / N)
      const y2 = 5 - Math.sin(((i + 1) / N) * Math.PI) * 0.7
      k.rod(DARK, [x, y, 0], [x2, y2, 0], 0.012, 4)
    }
    if (i > 0 && i < N) k.sphere(BULBS[i % BULBS.length], 0.085, [x, y - 0.1, 0], [1, 1.2, 1], 6, 4)
  }
  const M = 12
  const py = (t: number) => 5.25 - Math.sin(t * Math.PI) * 0.45
  for (let i = 0; i < M; i++) {
    const t0 = i / M
    const t1 = (i + 1) / M
    k.rod(DARK, [-span / 2 + span * t0, py(t0), 0], [-span / 2 + span * t1, py(t1), 0], 0.01, 3)
    if (i > 0) k.add({ c: FLAGS[i % FLAGS.length], r: 0.9 }, PENNANT, [-span / 2 + span * t0, py(t0) - 0.01, -0.005], [0, 0, 0], [0.34, 0.38, 1])
  }
}

// The old aqueduct: two tiers of white arches striding across the avenue, a wide arch over the
// road itself, and the yellow tram on top with its passengers.
function aqueduct(k: PropKit) {
  const D = 1.6
  const W = 34
  const lower = arcade(W, 5.6, [[-15, -11.6], [-11.6, -8.2], [-8.2, -4.8], [-3.6, 3.6], [4.8, 8.2], [8.2, 11.6], [11.6, 15]], 0.9)
  const upper = arcade(W, 3.2, Array.from({ length: 15 }, (_, i) => [-15 + i * 2, -15 + i * 2 + 1.4] as [number, number]).filter(([a]) => a < 15), 1.2)
  k.add(WHITE, lower, [0, 0, -D / 2], [0, 0, 0])
  k.add(WHITE, upper, [0, 5.9, -D / 2 + 0.2], [0, 0, 0], [1, 1, (D - 0.4) / D])
  k.box(CREAM, [W + 0.2, 0.3, D + 0.2], [0, 5.75, 0])
  k.box(CREAM, [W + 0.2, 0.3, D + 0.1], [0, 9.2, 0])
  for (const s of [-1, 1]) k.box(DARK, [W, 0.05, 0.04], [0, 9.75, s * (D / 2 - 0.05)])
  for (let x = -W / 2; x <= W / 2; x += 1) for (const s of [-1, 1]) k.box(DARK, [0.04, 0.4, 0.04], [x, 9.55, s * (D / 2 - 0.05)])
  const yel: Look = { c: '#f2c230', r: 0.6 }
  k.box(yel, [3.2, 0.5, 1.0], [4, 9.65, 0])
  for (let i = 0; i < 6; i++) k.box(yel, [0.06, 0.6, 0.9], [2.5 + i * 0.6, 10.2, 0])
  k.box(yel, [3.4, 0.08, 1.1], [4, 10.55, 0])
  k.box({ c: '#2e7d32', r: 0.7 }, [3.2, 0.06, 1.02], [4, 9.95, 0])
  k.rod(DARK, [4.5, 10.6, 0], [3.3, 11.3, 0], 0.02, 4)
  k.box(glow('#fff2c0', 0.1, 1.2), [0.04, 0.16, 0.2], [2.38, 9.8, 0])
  // The overhead wire along the deck, and passengers on the tram's benches.
  for (let x = -16; x <= 16; x += 8) k.rod(DARK, [x, 9.4, 0.7], [x, 11.6, 0.7], 0.03, 4)
  k.rod(DARK, [-16, 11.35, 0], [16, 11.35, 0], 0.012, 3)
  ;[[2.8, 0], [3.4, 1], [4.6, 2], [5.2, 3]].forEach(([x, i]) => sub(k, (t) => person(t, STREET[i], 0, 0, Math.PI / 2), [x, 9.92 - 0.12, (i % 2 ? 0.2 : -0.2)]))
}

// A samba school's parade float, facing +z: a gold-skirted trailer, a tiered stage, a giant
// sun-mask with gold rays and a fan of feathers, rows of bulbs.
function samba(k: PropKit) {
  const gold: Look = { c: '#e0b23a', r: 0.5 }
  const pink: Look = { c: '#e0407a', r: 0.7 }
  k.box(gold, [1.8, 0.5, 4.6], [0, 0.35, 0])
  for (let i = 0; i < 12; i++) k.box(i % 2 ? pink : gold, [1.84, 0.2, 0.38], [0, 0.2, -2.09 + i * 0.38])
  for (const z of [-1.6, 1.6]) for (const s of [-1, 1]) k.cyl(DARK, 0.2, 0.2, 0.1, [s * 0.86, 0.2, z], [0, 0, Math.PI / 2], 10)
  k.box({ c: '#7b1fa2', r: 0.7 }, [1.6, 0.35, 3.4], [0, 0.78, -0.3])
  const mz = 1.2
  const my = 2.75
  k.cyl(pink, 0.65, 0.75, 0.5, [0, 1.2, mz - 0.3], undefined, 14)
  k.cyl(gold, 0.5, 0.55, 0.35, [0, 1.62, mz - 0.3], undefined, 14)
  k.cyl(gold, 0.08, 0.12, 0.95, [0, 2.0, mz - 0.1], undefined, 8)
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI * 0.45 + (i / 12) * Math.PI * 0.9
    k.add({ c: FLAGS[i % 6], r: 0.8 }, FEATHER, [Math.sin(a) * 1.05, my + Math.cos(a) * 1.05, mz - 0.14], [0, 0, -a], [0.17, 0.7, 0.03])
  }
  k.cyl(gold, 0.62, 0.62, 0.1, [0, my, mz], [Math.PI / 2, 0, 0], 18)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    k.cone(gold, 0.09, 0.3, [Math.sin(a) * 0.76, my + Math.cos(a) * 0.76, mz], [0, 0, -a], 4)
  }
  for (const s of [-1, 1]) k.sphere(DARK, 0.07, [s * 0.2, my + 0.12, mz + 0.06], [1, 0.6, 0.5], 8, 5)
  k.torus({ c: '#c62828', r: 0.6 }, 0.16, 0.035, [0, my - 0.12, mz + 0.06], [0, 0, Math.PI], Math.PI, 10, 4)
  for (let i = 0; i < 10; i++) for (const s of [-1, 1]) k.sphere(BULBS[1], 0.05, [s * 0.92, 0.62, -2.1 + i * 0.47], [1, 1, 1], 6, 4)
  // Dancers posing on the stage.
  sub(k, (t) => dancer(t, 0, 0, 0, '#e91e63', '#fdd835', SKIN[0]), [-0.45, 0.955, -1.4])
  sub(k, (t) => dancer(t, 0, 0, 0, '#fdd835', '#e91e63', SKIN[2]), [0.45, 0.955, -0.6])
}
// A second float: a giant toucan on a green and yellow stage, flowers round its feet.
function toucanFloat(k: PropKit) {
  const grn: Look = { c: '#1b9e4b', r: 0.6 }
  const yel: Look = { c: '#fdd835', r: 0.6 }
  k.box(grn, [1.8, 0.5, 4.6], [0, 0.35, 0])
  for (let i = 0; i < 12; i++) k.box(i % 2 ? yel : grn, [1.84, 0.2, 0.38], [0, 0.2, -2.09 + i * 0.38])
  for (const z of [-1.6, 1.6]) for (const s of [-1, 1]) k.cyl(DARK, 0.2, 0.2, 0.1, [s * 0.86, 0.2, z], [0, 0, Math.PI / 2], 10)
  k.box({ c: '#1565c0', r: 0.7 }, [1.6, 0.4, 3.6], [0, 0.8, 0])
  const blk: Look = { c: '#1a1a1a', r: 0.7 }
  k.sphere(blk, 1, [0, 2.2, -0.2], [0.7, 1.1, 0.8], 12, 8)
  k.sphere(WHITE, 1, [0, 2.6, 0.35], [0.5, 0.5, 0.3], 10, 6)
  k.sphere(blk, 0.5, [0, 3.35, 0.2], [1, 1, 1], 10, 6)
  k.cone({ c: '#ff8f00', r: 0.5 }, 0.25, 1.4, [0, 3.3, 1.1], [Math.PI / 2 + 0.25, 0, 0], 8)
  k.cone({ c: '#d32f2f', r: 0.5 }, 0.08, 0.3, [0, 3.1, 1.75], [Math.PI / 2 + 0.25, 0, 0], 6)
  for (const s of [-1, 1]) {
    k.sphere(WHITE, 0.1, [s * 0.36, 3.45, 0.42], [1, 1, 0.5], 8, 5)
    k.sphere(DARK, 0.05, [s * 0.4, 3.45, 0.46], [1, 1, 0.5], 6, 4)
    k.sphere(blk, 1, [s * 0.62, 2.3, -0.4], [0.18, 0.75, 0.6], 8, 5)
  }
  k.box(blk, [0.4, 0.06, 1.0], [0, 1.4, -1.2], [-0.5, 0, 0])
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU
    k.ico({ c: FLAGS[i % 6], r: 0.8 }, 0.16, [Math.sin(a) * 0.7, 1.12, Math.cos(a) * 1.4], [1, 0.8, 1], 0)
  }
  for (let i = 0; i < 10; i++) for (const s of [-1, 1]) k.sphere(BULBS[2], 0.05, [s * 0.92, 0.62, -2.1 + i * 0.47], [1, 1, 1], 6, 4)
}

// A flat wall `w` wide and `h` tall with round-topped openings between the given x ranges, thick
// 1.6 along z; each opening's straight sides rise to `spring` of its width before the round top.
function arcade(w: number, h: number, holes: [number, number][], spring: number) {
  const s = new Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h)
  s.lineTo(-w / 2, h)
  s.closePath()
  for (const [a, b] of holes) {
    const r = (b - a) / 2
    const cx = (a + b) / 2
    const top = Math.min(h - 0.5 - r, r * spring * 2)
    const p = new Shape()
    p.moveTo(a, 0)
    p.lineTo(b, 0)
    p.lineTo(b, top)
    p.absarc(cx, top, r, 0, Math.PI, false)
    p.lineTo(a, 0)
    s.holes.push(p)
  }
  return new ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false, curveSegments: 10 })
}

// ---------------------------------------------------------------------------------------------
// Paving: the promenade's wave mosaic, and the hotel side's red, black and white pattern.
const mats: Record<string, MeshStandardMaterial> = {}
function mosaic(id: string, w: number, h: number, px: (x: number, y: number) => [number, number, number]) {
  if (mats[id]) return mats[id]
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const img = g.createImageData(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    const [r, gg, b] = px(x, y)
    img.data[i] = r
    img.data[i + 1] = gg
    img.data[i + 2] = b
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return (mats[id] = new MeshStandardMaterial({ map: t, roughness: 0.75 }))
}
const waveMat = () => mosaic('wave', 128, 256, (x, y) => {
  const off = Math.sin((y / 256) * TAU) * 22
  const band = Math.floor((x + off + 64) / 32) % 2
  const v = band ? 34 : 236
  return [v, v, v - (band ? 0 : 8)]
})
const walkMat = () => mosaic('walk', 128, 128, (x, y) => {
  const u = x + Math.sin((y / 128) * TAU * 2) * 10
  const v = y + Math.sin((x / 128) * TAU) * 12
  const k = (Math.floor(u / 32) + Math.floor(v / 32)) % 3
  const ring = Math.abs(((u % 32) + 32) % 32 - 16) < 3 || Math.abs(((v % 32) + 32) % 32 - 16) < 3
  if (ring) return [236, 230, 218]
  return k === 0 ? [40, 38, 36] : k === 1 ? [168, 66, 48] : [230, 224, 210]
})

export default function Rio({ len, race }: WorldProps) {
  const fronts = useMemo(() => FRONTS.map((_, i) => prop(`rio-front-d3-${i}`, (k) => frontage(k, i))), [])
  const palmP = useProp('rio-palm', coconutPalm)
  const kioskP = useProp('rio-kiosk-d3', kiosk)
  const guardP = useProp('rio-lifeguard-d3', lifeguard)
  const volleyP = useProp('rio-volley-d3', volley)
  const shadeP = useProp('rio-parasols-d3', parasols)
  const festoonP = useProp('rio-festoon-d2', festoon)
  const aqueductP = useProp('rio-aqueduct-d3', aqueduct)
  const sambaP = useProp('rio-samba-d3', samba)
  const toucanP = useProp('rio-toucan', toucanFloat)
  const carsA = useProp('rio-cars-a', (k) => { taxi(k, -1.55); kombi(k, 1.65, '#1e88e5') })
  const carsB = useProp('rio-cars-b', (k) => { fusca(k, -1.4, '#90caf9'); taxi(k, 1.6) })
  const carsC = useProp('rio-cars-c', (k) => { kombi(k, -1.6, '#e53935'); fusca(k, 1.5, '#fff59d') })
  const busP = useProp('rio-busstop', busStop)
  const bancaP = useProp('rio-banca', banca)
  const vendP = useProp('rio-vendors', vendors)
  const strollP = useMemo(() => [0, 1, 2].map((v) => prop(`rio-strollers-${v}`, (k) => strollers(k, v))), [])
  const goersP = useMemo(() => [0, 1, 2].map((v) => prop(`rio-beachgoers-${v}`, (k) => beachgoers(k, v))), [])
  const sambaG = useMemo(() => [0, 1].map((v) => prop(`rio-sambagroup-${v}`, (k) => sambaGroup(k, v))), [])
  const sellP = useProp('rio-sellers', sellers)
  const sandP = useMemo(() => [0, 1].map((v) => prop(`rio-sandlife-${v}`, (k) => sandLife(k, v))), [])
  const boatP = useProp('rio-boat', boat)
  const sailP = useProp('rio-sails', (k) => { sailboat(k, '#e53935'); sub(k, (t) => sailboat(t, '#fdd835'), [-9, 0, 14], 0.4) })
  const promP = useProp('rio-prom-unit', promUnit)
  const gz = race * 0.5
  const sz = race + 8
  const BIKE = 0.7
  const PROM = 3.2
  const SAND0 = -(EDGE + PROM)
  const SHORE = SAND0 - 14
  const LANE = 1.4
  const FRONT = EDGE + 3.4
  const WALK_X = EDGE + LANE + 0.95

  // The stairway's slot down the street, and where in that slot the stairs stand.
  const slotOf = (z: number) => {
    const k = Math.floor((z - (gz + 1)) / FL)
    return gz + 1 + FL / 2 + k * FL
  }
  const stairC = slotOf(sz)
  const stairP = useProp(`rio-stairslot-${(sz - stairC).toFixed(2)}`, (k) => stairSlot(k, sz - stairC))

  const geo = useMemo(() => {
    const r = rand(1207)
    // Frontages in 24-unit slots, either side of a two-unit gap where the aqueduct crosses.
    const rows: Spot[][] = FRONTS.map(() => [])
    for (let i = 0, c = gz + 1 + FL / 2; c - FL / 2 < len + 40; c = gz + 1 + FL / 2 + ++i * FL) if (Math.abs(c - stairC) > 1) rows[Math.floor(r() * FRONTS.length)].push({ x: FRONT, z: c, ry: -Math.PI / 2 })
    for (let c = gz - 1 - FL / 2; c + FL / 2 > -26; c -= FL) rows[Math.floor(r() * FRONTS.length)].push({ x: FRONT, z: c, ry: -Math.PI / 2 })
    // Clear ground: no kerbside clutter where the aqueduct, stairs, start and finish crowds stand.
    const busy = (z: number, w: number) => Math.abs(z - gz) < 1.4 + w || Math.abs(z - sz) < 2.2 + w || (z > -6 - w && z < 15 + w) || (z > race - 10 - w && z < race + 6 + w)
    const palms: Spot[] = []
    for (let z = -12; z < len + 40; z += 5 + r() * 3) {
      if (z > gz - 4.8 && z < gz + 2) continue
      palms.push({ x: SAND0 - 0.5, z, ry: Math.PI + (r() - 0.5) * 0.8, s: 0.9 + r() * 0.3 })
    }
    // The hotel side: palms on the pavement, cars in the lay-by, stops, stands and strollers.
    const cars: Spot[][] = [[], [], []]
    for (let z = 18; z < len + 40; z += 7.5 + r() * 9) {
      if (busy(z, 3.4)) continue
      cars[Math.floor(r() * 3)].push({ x: EDGE + LANE / 2, z, ry: r() < 0.5 ? 0 : Math.PI })
    }
    const kerb: Spot[][] = [[], [], []]
    const walkers: Spot[][] = [[], [], []]
    let z = -10
    while (z < len + 40) {
      const kind = r()
      if (kind < 0.42) {
        if (!busy(z, 2.6)) kerb[Math.floor(r() * 3)].push({ x: WALK_X + 0.1, z, ry: -Math.PI / 2 })
        z += 7 + r() * 5
      } else {
        if (!busy(z, 0.8) || (z > -6 && z < 15)) walkers[Math.floor(r() * 3)].push({ x: WALK_X + 0.15, z, ry: (r() - 0.5) * 0.6 + (r() < 0.5 ? 0 : Math.PI) })
        z += 3 + r() * 3
      }
    }
    for (let z = -6; z < len + 40; z += 9 + r() * 8) if (!busy(z, 0.6)) palms.push({ x: EDGE + LANE + 0.3, z, ry: Math.PI + (r() - 0.5) * 1.2, s: 0.85 + r() * 0.2 })
    // The beach.
    const kiosks: Spot[] = []
    const guards: Spot[] = []
    const nets: Spot[] = []
    for (let z = 6; z < len + 40; z += 18 + r() * 8) if (Math.abs(z - gz) > 7) kiosks.push({ x: SAND0 - 2.2, z, ry: r() * 6 })
    for (let z = 30; z < len + 40; z += 70) guards.push({ x: SHORE + 4, z, ry: -Math.PI / 2 })
    for (let z = 14; z < len + 40; z += 26 + r() * 12) if (Math.abs(z - gz) > 9) nets.push({ x: SAND0 - 7 - r() * 2, z, ry: 0 })
    const shades: Spot[] = []
    for (let z = -4; z < len + 40; z += 7 + r() * 4) {
      const x = SAND0 - 5.4 - r() * 2.4
      if (nets.some((n) => Math.abs(n.z - z) < 6.2) || kiosks.some((q) => Math.abs(q.z - z) < 4) || (z > gz - 9 && z < gz + 9)) continue
      shades.push({ x, z, ry: (r() - 0.5) * 0.5 })
    }
    const near = (z: number, x: number, d: number) => kiosks.some((q) => Math.hypot(q.x - x, q.z - z) < d + 2.4) || shades.some((q) => Math.hypot(q.x - x, q.z - z) < d + 2.2) || nets.some((q) => Math.abs(q.z - z) < d + 5 && x < q.x + 2 && x > q.x - 6)
    const sandAt: Spot[][] = [[], []]
    for (let z = -2; z < len + 40; z += 4 + r() * 4) {
      const x = SAND0 - 2 - r() * 9
      if (near(z, x, 1.4) || Math.abs(z - gz) < 9) continue
      sandAt[Math.floor(r() * 2)].push({ x, z, ry: (r() - 0.5) * 0.8 })
    }
    const boats: Spot[] = []
    for (let z = 10; z < len + 40; z += 22 + r() * 14) if (!guards.some((g) => Math.abs(g.z - z) < 4)) boats.push({ x: SHORE + 2.6, z, ry: Math.PI / 2 + (r() - 0.5) * 0.5 })
    const sails: Spot[] = []
    for (let z = -10; z < len + 60; z += 30 + r() * 20) sails.push({ x: SHORE - 8 - r() * 12, z, ry: r() * 6 })
    // The promenade: benches and showers on its sea edge, people walking it.
    const prom: Spot[] = []
    for (let z = 4; z < len + 40; z += 11 + r() * 6) if (Math.abs(z - gz) > 4) prom.push({ x: SAND0 + 0.35, z, ry: 0 })
    const goers: Spot[][] = [[], [], []]
    const sellAt: Spot[] = []
    const groups: Spot[][] = [[], []]
    for (let z = -8; z < len + 40; z += 3.5 + r() * 4) {
      if (Math.abs(z - gz) < 3 || prom.some((p) => Math.abs(p.z - z) < 1.6)) continue
      if (r() < 0.12) sellAt.push({ x: SAND0 - 1.6, z, ry: r() * 0.4 })
      else goers[Math.floor(r() * 3)].push({ x: -(EDGE + BIKE + 1.1 + r() * 0.6), z, ry: r() < 0.5 ? 0 : Math.PI })
    }
    // The samba schools gathered round the aqueduct and their floats, and a few more down the
    // promenade practising.
    groups[0].push({ x: -(EDGE + BIKE + 1.3), z: gz - 6, ry: 0.4 }, { x: -9.5, z: gz + 2.5, ry: -0.6 }, { x: WALK_X, z: gz + 3.5, ry: -Math.PI / 2 })
    groups[1].push({ x: -(EDGE + BIKE + 1.3), z: gz + 5, ry: Math.PI }, { x: -12.5, z: gz - 5, ry: 0.8 }, { x: WALK_X, z: gz - 4, ry: -Math.PI / 2 })
    for (let z = 60; z < len + 40; z += 80 + r() * 40) groups[Math.floor(r() * 2)].push({ x: -(EDGE + BIKE + 1.3), z, ry: r() < 0.5 ? 0.3 : Math.PI - 0.3 })
    const strings: Spot[] = []
    for (let z = 12; z < len + 30; z += 12) if (Math.abs(z - gz) > 4) strings.push({ x: 0, z })
    // Footprints, shells and towels scattered on the sand.
    const rr = rand(91)
    const sand = Array.from({ length: 260 }, () => ({ x: SAND0 - 1 - rr() * 12, z: rr() * (len + 60) - 14, s: 0.6 + rr() * 0.8, ry: rr() * 6, y: 0.01 }))
    const towels = Array.from({ length: 50 }, () => ({ x: SAND0 - 3 - rr() * 8, z: rr() * (len + 60) - 14, ry: rr() * 0.6, y: 0.02 })).filter((t) => !near(t.z, t.x, 0.2))
    // Parking-bay lines in the lay-by.
    const bays = Array.from({ length: Math.ceil((len + 60) / 2.6) }, (_, i) => ({ x: EDGE + LANE / 2, z: -14 + i * 2.6, y: 0.016 }))
    return { rows, palms, cars, kerb, walkers, kiosks, guards, nets, shades, sandAt, boats, sails, prom, goers, sellAt, groups, strings, sand, towels, bays }
  }, [len, race, gz, sz, stairC, SAND0, SHORE, FRONT, WALK_X])

  const wave = useMemo(() => {
    const m = waveMat()
    m.map!.repeat.set(1, (len + 60) / 6)
    return m
  }, [len])
  const walk = useMemo(() => {
    const m = walkMat()
    m.map!.repeat.set(1, (len + 60) / 2.2)
    return m
  }, [len])

  return (
    <>
      <Batch version={`rio-d3:${len}`} cell={24} freeze prune>
        {/* The lay-by's asphalt and its kerb, the beach's cycle lane, and the sand down to the surf. */}
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + LANE / 2, 0.011, len / 2 + 5]}>
          <planeGeometry args={[LANE, len + 60]} />
          <meshStandardMaterial color="#4a4d52" />
        </mesh>
        <mesh position={[EDGE + LANE + 0.04, 0.04, len / 2 + 5]}>
          <boxGeometry args={[0.1, 0.08, len + 60]} />
          <meshStandardMaterial color="#cfcac0" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + BIKE / 2), 0.013, len / 2 + 5]}>
          <planeGeometry args={[BIKE, len + 60]} />
          <meshStandardMaterial color="#b23a32" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[(SAND0 + SHORE) / 2 - 1, 0.008, len / 2 + 5]}>
          <planeGeometry args={[SAND0 - SHORE + 2, len + 60]} />
          <meshStandardMaterial color="#e8d3a2" />
        </mesh>
        <group position={[0, 0, gz]}><PropMesh parts={aqueductP} /></group>
        <group position={[-6.5, 0, gz - 1.6]} rotation-y={Math.PI}><PropMesh parts={sambaP} /></group>
        <group position={[-10.5, 0, gz + 6]} rotation-y={0.25}><PropMesh parts={toucanP} /></group>
        <group position={[FRONT, 0, stairC]} rotation-y={-Math.PI / 2}><PropMesh parts={stairP} /></group>
        <Scatter spots={geo.sand} colors={['#d9c08c', '#f1e2bb', '#cbb07a']}>
          <boxGeometry args={[0.14, 0.02, 0.22]} />
        </Scatter>
        <Scatter spots={geo.towels} colors={['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00']}>
          <boxGeometry args={[0.5, 0.02, 1.0]} />
        </Scatter>
        <Scatter spots={geo.bays} colors={['#e8e8e8']}>
          <boxGeometry args={[LANE - 0.2, 0.004, 0.06]} />
        </Scatter>
      </Batch>
      <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + BIKE + (PROM - BIKE) / 2), 0.013, len / 2 + 5]} material={wave}>
        <planeGeometry args={[PROM - BIKE, len + 60]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[(EDGE + LANE + FRONT) / 2 + 0.05, 0.012, len / 2 + 5]} material={walk}>
        <planeGeometry args={[FRONT - EDGE - LANE - 0.1, len + 60]} />
      </mesh>
      {fronts.map((f, i) => <Many key={i} parts={f} at={geo.rows[i]} near={120} />)}
      <Many parts={palmP} at={geo.palms} />
      <Many parts={kioskP} at={geo.kiosks} near={100} />
      <Many parts={guardP} at={geo.guards} near={100} />
      <Many parts={volleyP} at={geo.nets} near={80} />
      <Many parts={shadeP} at={geo.shades} near={90} />
      <Many parts={festoonP} at={geo.strings} />
      {[carsA, carsB, carsC].map((c, i) => <Many key={i} parts={c} at={geo.cars[i]} near={80} />)}
      {[busP, bancaP, vendP].map((c, i) => <Many key={i} parts={c} at={geo.kerb[i]} near={80} />)}
      {strollP.map((c, i) => <Many key={i} parts={c} at={geo.walkers[i]} near={70} />)}
      {goersP.map((c, i) => <Many key={i} parts={c} at={geo.goers[i]} near={70} />)}
      {sambaG.map((c, i) => <Many key={i} parts={c} at={geo.groups[i]} near={70} />)}
      <Many parts={sellP} at={geo.sellAt} near={70} />
      {sandP.map((c, i) => <Many key={i} parts={c} at={geo.sandAt[i]} near={70} />)}
      <Many parts={boatP} at={geo.boats} near={80} />
      <Many parts={sailP} at={geo.sails} />
      <Many parts={promP} at={geo.prom} near={80} />
      <Surf x={SHORE} len={len} />
      <Water x={SHORE - 40} z={len / 2} w={80} d={len + 240} id="rio" color="#3f6f86" rough={0.15} />
      <Sparkles edge={SHORE} />
      <FarRio />
    </>
  )
}

// The surf line: a band of foam that runs up the sand and slides back.
function Surf({ x, len }: { x: number; len: number }) {
  const a = useRef<Mesh>(null)
  const b = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (a.current) a.current.position.x = x + 0.6 + Math.sin(t * 0.7) * 0.5
    if (b.current) b.current.position.x = x - 1.4 + Math.sin(t * 0.7 + 2) * 0.6
  })
  return (
    <>
      <mesh ref={a} rotation-x={-Math.PI / 2} position={[x, 0.02, len / 2 + 5]}>
        <planeGeometry args={[1.0, len + 60]} />
        <meshStandardMaterial color="#f4f8f8" roughness={0.6} />
      </mesh>
      <mesh ref={b} rotation-x={-Math.PI / 2} position={[x - 1.4, 0.03, len / 2 + 5]}>
        <planeGeometry args={[0.35, len + 60]} />
        <meshStandardMaterial color="#e6f0f2" roughness={0.6} />
      </mesh>
    </>
  )
}

// A mountain whose peak leans `lean` units towards -x of its base (the statue's sheer peak).
const peaks = new Map<number, BufferGeometry>()
function peakGeo(lean: number) {
  let g = peaks.get(lean)
  if (!g) {
    g = new CylinderGeometry(0.1, 1, 1, 10, 4).translate(0, 0.5, 0)
    const p = g.getAttribute('position')
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) - lean * p.getY(i) ** 1.3)
    g.computeVertexNormals()
    peaks.set(lean, g)
  }
  return g
}

// Out in the bay, close enough that the haze doesn't swallow them: the two sugarloaf rocks with
// the cable car between them, islands, and the stadium on the far shore with its lights. Inland,
// over the hillside houses, the sheer peak with the lit open-armed statue.
function FarRio() {
  const parts = useProp('rio-far-d3', (k) => {
    const rock: Look = { c: '#6d6a5e', r: 1 }
    const rockD: Look = { c: '#57544a', r: 1 }
    const green: Look = { c: '#2f5a33', r: 1 }
    const greenD: Look = { c: '#264a2a', r: 1 }
    // The sugarloaf and its little sister rising out of the water, forest at their feet.
    k.sphere(rock, 1, [-38, 0, 66], [8, 27, 9], 16, 12, Math.PI / 2)
    k.sphere(green, 1, [-38, 0, 66], [10.5, 6, 11], 14, 8, Math.PI / 2)
    k.sphere(rockD, 1, [-31, 0, 47], [6, 12, 6], 14, 10, Math.PI / 2)
    k.sphere(green, 1, [-31, 0, 47], [7.5, 4, 7.5], 14, 8, Math.PI / 2)
    const wire: Look = { c: '#8a8f94', r: 0.6 }
    for (const dz of [-0.3, 0.3]) {
      k.rod(wire, [-31, 12, 47 + dz], [-38, 26.6, 66 + dz], 0.08, 3)
      k.rod(wire, [-23, 4, 30 + dz], [-31, 12, 47 + dz], 0.08, 3)
    }
    // The cable car's shore station on its rocky point.
    k.sphere(rockD, 1, [-24, 0, 30], [3, 2.2, 3], 10, 5, Math.PI / 2)
    k.box(WHITE, [2.2, 1.6, 2.2], [-23.6, 2.6, 30])
    k.box(TERRA, [2.4, 0.15, 2.4], [-23.6, 3.45, 30])
    plane(k, glow('#ffe9a8', 0.1, 1.2), 1.2, 0.5, [-22.49, 2.6, 30], Math.PI / 2)
    k.box(DARK, [1.6, 1.4, 1.6], [-38, 27.4, 66])
    k.box(DARK, [1.4, 1.0, 1.4], [-31, 12.3, 47])
    const cab = glow('#ffe9a8', 0.25, 1.4)
    k.box(cab, [1.0, 0.75, 1.0], [-34.5, 18.5, 56.5])
    k.box(cab, [1.0, 0.75, 1.0], [-27, 7.5, 38.5])
    k.sphere(glow('#ff3d3d', 0.3, 1.6), 0.35, [-38, 28.4, 66])
    // Islands in the bay.
    for (const [x, z, w, h] of [[-58, 4, 8, 6], [-66, 26, 6, 4], [-52, -24, 7, 5], [-62, -50, 9, 7]] as const) {
      k.sphere(green, 1, [x, 0, z], [w, h, w * 0.8], 12, 6, Math.PI / 2)
      k.sphere(rock, 1, [x + w * 0.3, 0, z], [w * 0.4, h * 1.15, w * 0.35], 10, 6, Math.PI / 2)
    }
    // The far shore: a line of green hills, the town's lights along the water, and the stadium.
    for (let i = 0; i < 9; i++) k.sphere(greenD, 1, [-92, 0, -80 + i * 22], [14, 10 + (i % 3) * 5, 13], 12, 6, Math.PI / 2)
    const rr = rand(64)
    const tones = ['#ffc46a', '#ffe08a', '#ffb36b', '#fff2c0']
    for (let i = 0; i < 45; i++) {
      const z = -80 + rr() * 170
      plane(k, glow(tones[i % 4], 0.05, 1.3), 0.9 + rr(), 0.4 + rr() * 0.8, [-78.9, 0.6 + rr() * 2, z], Math.PI / 2)
      k.box({ c: ['#c9a27a', '#d8d4ca', '#8fb3c9', '#e0c27a'][i % 4], r: 1 }, [2, 1.5 + rr() * 3, 1.6], [-80, 1, z])
    }
    const bowl: Look = { c: '#d8d4ca', r: 0.8 }
    k.cyl(bowl, 9, 8, 4, [-74, 2, 22], undefined, 18)
    k.cyl({ c: '#3f8f45', r: 1 }, 7, 7, 0.1, [-74, 3.8, 22], undefined, 18)
    k.torus(WHITE, 8.6, 0.7, [-74, 4.6, 22], [Math.PI / 2, 0, 0], TAU, 18, 4)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4
      k.rod(DARK, [-74 + Math.cos(a) * 9.5, 0, 22 + Math.sin(a) * 9.5], [-74 + Math.cos(a) * 9.5, 8, 22 + Math.sin(a) * 9.5], 0.15, 4)
      k.box(glow('#ffffff', 0.2, 1.8), [1.2, 0.6, 1.2], [-74 + Math.cos(a) * 9.5, 8.2, 22 + Math.sin(a) * 9.5])
    }
    // Inland: the ridge and the statue's sheer peak, over the hillside houses.
    for (const [x, z, w, h] of [[44, 56, 16, 18], [52, 86, 18, 22], [40, 102, 16, 15]] as const) k.sphere(green, 1, [x, 0, z], [w, h, 14], 14, 8, Math.PI / 2)
    k.add(greenD, peakGeo(0.45), [38, 0, 76], [0, 0, 0], [12, 30, 11])
    k.add(rockD, peakGeo(0.75), [37, 12, 76], [0, 0, 0], [6, 20, 6])
    // The statue on the peak: pedestal, long robe, arms spread wide, head. Lit after dark so the
    // town sees it all night.
    const stat = glow('#f4f1e8', 0.35, 1.1)
    const sx = 38 - 0.45 * 12
    const py = 32
    k.box(stat, [1.2, 1.2, 1.2], [sx, py + 0.6, 76])
    frustum(k, stat, 1.4, 1.0, 4.2, 0.55, [sx, py + 1.2, 76])
    k.box(stat, [6.2, 0.55, 0.5], [sx, py + 4.7, 76], [0, -0.35, 0])
    k.box(stat, [0.9, 0.9, 0.7], [sx, py + 4.8, 76])
    k.sphere(stat, 0.42, [sx, py + 5.75, 76], [1, 1.15, 1], 10, 8)
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
