import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, CylinderGeometry, type Group } from 'three'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Scatter, frustum, person, prop, rand, useProp, type Dress, type Look, type PropKit, type Spot, type V3 } from './kit'
import type { WorldProps } from './WorldVenue'

// India, Pink City Bazaar: the strip runs down a bazaar street of the old pink city. Rose-pink
// havelis with white painted borders line both sides: shops in the arcades below, carved
// balcony windows above, little domed kiosks on the roofs. Rickshaws and fruit carts wait at
// the kerb, neem trees shade the pavement, marigold garlands hang across the street and kites fly
// overhead. Halfway the racers pass under the city gate; the honeycomb Palace of Winds faces
// the finish, a hill fort crowns the ridge to one side and the white marble tomb stands far ahead.

const PINKS = ['#ee9a7e', '#e68a6e', '#f2a98c', '#df7f66', '#f09c84', '#e98f74']
const WHITE: Look = { c: '#f7ede2', r: 0.85 }
const DARK: Look = { c: '#3a2420', r: 1 }
const GOLD: Look = { c: '#e0b040', r: 0.35, m: 0.6 }
// Gilt that stays plain (low metalness), so the finials fold into a haveli's one painted mesh.
const GILT: Look = { c: '#e0b040', r: 0.35, m: 0.25 }
const STOREY = 1.15
const ROUND = new CylinderGeometry(1, 1, 1, 14, 1, false, -Math.PI / 2, Math.PI)

// Street life on each front: cloth awnings over the shops (else a painted sign board), a blade
// sign, a bicycle parked by the wall.
type Haveli = { w: number; d: number; floors: number; pink: number; arches: number; balconies: number; kiosks: boolean; awning: boolean; blade: number; bike: boolean }
const HAVELIS: Haveli[] = [
  { w: 3.2, d: 2.6, floors: 3, pink: 0, arches: 3, balconies: 1, kiosks: true, awning: false, blade: 1, bike: true },
  { w: 2.6, d: 2.4, floors: 2, pink: 1, arches: 2, balconies: 1, kiosks: false, awning: true, blade: -1, bike: false },
  { w: 3.8, d: 2.6, floors: 3, pink: 2, arches: 4, balconies: 2, kiosks: true, awning: false, blade: 0, bike: false },
  { w: 2.8, d: 2.4, floors: 4, pink: 3, arches: 2, balconies: 1, kiosks: true, awning: true, blade: 1, bike: false },
  { w: 3.4, d: 2.5, floors: 2, pink: 4, arches: 3, balconies: 2, kiosks: false, awning: false, blade: -1, bike: true },
  { w: 3.0, d: 2.5, floors: 3, pink: 5, arches: 3, balconies: 1, kiosks: false, awning: true, blade: 0, bike: false },
]
const WIRE: Look = { c: '#1e1a18', r: 0.9 }
const WOOD: Look = { c: '#6d4c35', r: 0.9 }
const CLAY: Look = { c: '#b5582e', r: 0.95 }
const BRASS: Look = { c: '#c9a040', r: 0.4, m: 0.25 }
const MARIGOLD = ['#ff8f00', '#ffb300', '#f57c00']

// Cables strung along every front at the same heights, so house after house they read as one
// sagging tangle: the street's power and phone lines on their brackets.
const CABLES = [[2.05, 0.18], [2.2, 0.26], [2.33, 0.12]] as const
function cables(k: PropKit, w: number, f: number) {
  for (const s of [-1, 1]) {
    k.rod(WIRE, [s * (w / 2 - 0.1), 2.4, f], [s * (w / 2 - 0.1), 2.4, f + 0.6], 0.012, 4)
    k.rod(WIRE, [s * (w / 2 - 0.1), 2.15, f], [s * (w / 2 - 0.1), 2.4, f + 0.45], 0.008, 3)
  }
  CABLES.forEach(([y, sag], j) => {
    const z = f + 0.5 + j * 0.035
    const pts: V3[] = []
    for (let i = 0; i <= 4; i++) {
      const t = i / 4
      pts.push([-w / 2 - 0.02 + t * (w + 0.04), y - Math.sin(t * Math.PI) * sag, z])
    }
    for (let i = 0; i < 4; i++) k.rod(WIRE, pts[i], pts[i + 1], 0.009, 3)
  })
}

// A painted blade sign standing out from the wall on two arms: border, field and a row of
// lettering-like strokes.
function blade(k: PropKit, x: number, y: number, f: number, a: string, b: string) {
  for (const dy of [-0.2, 0.2]) k.rod(WIRE, [x, y + dy, f], [x, y + dy, f + 0.14], 0.01, 4)
  k.box(WHITE, [0.04, 0.54, 0.4], [x, y, f + 0.34])
  k.box({ c: a, r: 0.8 }, [0.05, 0.46, 0.32], [x, y, f + 0.34])
  for (let i = 0; i < 3; i++) k.box({ c: b, r: 0.8 }, [0.056, 0.05, 0.2 - (i % 2) * 0.06], [x, y + 0.12 - i * 0.12, f + 0.34])
}

// A terracotta pot of marigolds by the door.
function marigoldPot(k: PropKit, x: number, z: number) {
  k.cyl(CLAY, 0.08, 0.055, 0.15, [x, 0.075, z], undefined, 6)
  k.ico({ c: '#4f7f36', r: 1 }, 0.08, [x, 0.2, z], [1, 0.7, 1], 0)
  for (let i = 0; i < 3; i++) k.ico({ c: MARIGOLD[i % 3], r: 0.9 }, 0.035, [x + Math.sin(i * 1.7) * 0.05, 0.25 + (i % 2) * 0.02, z + Math.cos(i * 1.7) * 0.05], [1, 1, 1], 0)
}

// A black roadster bicycle with a rear carrier, parked along the wall (wheels in the xy plane).
function bicycle(k: PropKit, x: number, z: number) {
  const fr: Look = { c: '#1d1d1f', r: 0.5 }
  const steel: Look = { c: '#b8bcc0', r: 0.4 }
  const R = 0.17
  for (const wx of [-0.31, 0.31]) {
    k.torus(fr, R, 0.014, [x + wx, R + 0.014, z], undefined, Math.PI * 2, 12, 3)
    k.rod(steel, [x + wx - R, R + 0.014, z], [x + wx + R, R + 0.014, z], 0.004, 3)
    k.rod(steel, [x + wx, 0.014, z], [x + wx, 2 * R + 0.014, z], 0.004, 3)
  }
  const y0 = R + 0.014
  const bb: V3 = [x - 0.02, 0.2, z]
  const seat: V3 = [x - 0.12, 0.5, z]
  const head: V3 = [x + 0.2, 0.5, z]
  const rear: V3 = [x - 0.31, y0, z]
  const front: V3 = [x + 0.31, y0, z]
  k.rod(fr, bb, seat, 0.013, 4)
  k.rod(fr, seat, head, 0.013, 4)
  k.rod(fr, bb, head, 0.013, 4)
  k.rod(fr, bb, rear, 0.01, 4)
  k.rod(fr, seat, rear, 0.01, 4)
  k.rod(fr, [head[0] - 0.01, head[1] + 0.08, z], front, 0.011, 4)
  k.rod(fr, [x + 0.19, 0.6, z - 0.14], [x + 0.19, 0.6, z + 0.14], 0.009, 4)
  k.rod(fr, [x + 0.19, 0.6, z], [head[0] - 0.01, head[1] + 0.08, z], 0.01, 4)
  k.box({ c: '#5a3a28', r: 0.8 }, [0.14, 0.035, 0.07], [x - 0.13, 0.535, z])
  k.box(fr, [0.26, 0.012, 0.1], [x - 0.33, 0.39, z])
  k.rod(fr, [x - 0.2, 0.39, z], [x - 0.31, y0, z], 0.007, 3)
  k.cyl(steel, 0.05, 0.05, 0.015, bb, [Math.PI / 2, 0, 0], 10)
  k.rod(fr, bb, [x - 0.02, 0.0, z + 0.06], 0.006, 3)
}
const CLOTH = ['#d81b60', '#fdd835', '#1e88e5', '#43a047', '#ff7043', '#8e24aa', '#00897b']

// An arch top as a flat half-disc on the front of its slab: the street only ever sees that face,
// and a haveli has a couple of dozen of them. Few segments for small ones, more for the gate.
const HALF = [8, 16].map((n) => new CircleGeometry(1, n, 0, Math.PI))
function arch(k: PropKit, look: Look, w: number, d: number, p: V3, ry = 0, sy = 1) {
  const o = d / 2 + 0.001
  return k.add(look, HALF[w > 2 ? 1 : 0], [p[0] + Math.sin(ry) * o, p[1], p[2] + Math.cos(ry) * o], [0, ry, 0], [w / 2, (w / 2) * sy, 1])
}

// A small domed roof kiosk: four slim pillars, a dome and a gold finial.
function kiosk(k: PropKit, x: number, y: number, z: number, s: number, pink: Look) {
  for (const px of [-1, 1]) for (const pz of [-1, 1]) k.box(WHITE, [0.07 * s, 0.6 * s, 0.07 * s], [x + px * 0.26 * s, y + 0.3 * s, z + pz * 0.26 * s])
  k.box(pink, [0.72 * s, 0.08 * s, 0.72 * s], [x, y + 0.64 * s, z])
  k.box(WHITE, [0.78 * s, 0.04 * s, 0.78 * s], [x, y + 0.7 * s, z])
  k.sphere(pink, 0.33 * s, [x, y + 0.72 * s, z], [1, 1.15, 1], 10, 4, Math.PI / 2)
  k.cone(GILT, 0.05 * s, 0.25 * s, [x, y + 1.2 * s, z], undefined, 6)
}

// A projecting balcony window on carved brackets, with a curved roof, facing +z.
function jharokha(k: PropKit, x: number, y: number, f: number, pink: Look) {
  frustum(k, pink, 0.95, 0.4, 0.3, 1.4, [x, y - 0.32, f + 0.14])
  k.box(WHITE, [1.0, 0.05, 0.46], [x, y - 0.02, f + 0.2])
  k.box(pink, [0.92, 0.66, 0.36], [x, y + 0.33, f + 0.18])
  for (const wx of [-0.27, 0, 0.27]) {
    k.box(DARK, [0.18, 0.36, 0.03], [x + wx, y + 0.3, f + 0.365])
    arch(k, DARK, 0.18, 0.03, [x + wx, y + 0.48, f + 0.365])
    k.box(WHITE, [0.04, 0.5, 0.04], [x + wx + 0.135, y + 0.34, f + 0.37])
  }
  k.box(WHITE, [0.04, 0.5, 0.04], [x - 0.405, y + 0.34, f + 0.37])
  k.box(WHITE, [1.04, 0.06, 0.48], [x, y + 0.69, f + 0.2])
  k.cyl(pink, 0.26, 0.26, 1.0, [x, y + 0.72, f + 0.2], [0, 0, Math.PI / 2], 10)
  k.cone(GILT, 0.04, 0.16, [x, y + 1.04, f + 0.2], undefined, 6)
}

const darker = (c: string, k: number) => {
  const n = parseInt(c.slice(1), 16)
  const ch = (s: number) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0')
  return ch(16) + ch(8) + ch(0)
}

function haveli(k: PropKit, h: Haveli) {
  const pink: Look = { c: PINKS[h.pink], r: 0.9 }
  const deep: Look = { c: '#' + darker(PINKS[h.pink], 0.84), r: 0.9 }
  const H = h.floors * STOREY
  const f = h.d / 2
  k.box(pink, [h.w, H, h.d], [0, H / 2, 0])
  k.box(deep, [h.w + 0.04, 0.16, h.d + 0.04], [0, 0.08, 0])
  // White painted borders: corner pilasters and a band at each floor.
  for (const s of [-1, 1]) k.box(WHITE, [0.1, H, 0.04], [s * (h.w / 2 - 0.05), H / 2, f + 0.005])
  for (let i = 1; i < h.floors; i++) k.box(WHITE, [h.w + 0.04, 0.07, 0.06], [0, i * STOREY, f + 0.01])
  // Ground floor arcade: shops behind pointed arches, cloth hanging inside, a sign above.
  const aw = h.w / h.arches
  for (let i = 0; i < h.arches; i++) {
    const x = -h.w / 2 + aw * (i + 0.5)
    k.box(WHITE, [aw * 0.78, 0.78, 0.03], [x, 0.45, f + 0.006])
    arch(k, WHITE, aw * 0.78, 0.03, [x, 0.84, f + 0.006])
    k.box(DARK, [aw * 0.66, 0.74, 0.03], [x, 0.43, f + 0.012])
    arch(k, DARK, aw * 0.66, 0.03, [x, 0.8, f + 0.012])
    for (let j = 0; j < 3; j++) k.box({ c: CLOTH[(i * 3 + j + h.pink) % CLOTH.length], r: 1 }, [aw * 0.16, 0.42, 0.02], [x + (j - 1) * aw * 0.2, 0.62, f + 0.03])
    k.box({ c: CLOTH[(i + h.pink * 2) % CLOTH.length], r: 0.9 }, [aw * 0.6, 0.18, 0.12], [x, 0.14, f + 0.09])
  }
  if (h.awning) {
    // A striped cloth awning over each shop on two iron struts, a fringe along its edge.
    for (let i = 0; i < h.arches; i++) {
      const x = -h.w / 2 + aw * (i + 0.5)
      const ca = CLOTH[(i * 2 + h.pink) % CLOTH.length]
      const n = 4
      for (let j = 0; j < n; j++) k.box({ c: j % 2 ? '#fafafa' : ca, r: 1 }, [(aw * 0.84) / n, 0.02, 0.5], [x - aw * 0.42 + (aw * 0.84) * (j + 0.5) / n, 1.05 + (j % 2) * 0.003, f + 0.27], [0.3, 0, 0])
      k.box({ c: ca, r: 1 }, [aw * 0.84, 0.07, 0.012], [x, 0.94, f + 0.51])
      for (const sx of [-1, 1]) k.rod(WIRE, [x + sx * aw * 0.38, 0.72, f], [x + sx * aw * 0.38, 0.97, f + 0.48], 0.008, 3)
    }
  } else {
    k.box({ c: '#fff3c4', r: 0.8 }, [h.w * 0.62, 0.17, 0.04], [0, 1.0, f + 0.02])
    k.box(deep, [h.w * 0.66, 0.03, 0.06], [0, 0.9, f + 0.03])
  }
  for (const s of [-1, 1]) marigoldPot(k, s * (h.w / 2 - 0.1), f + 0.14)
  if (h.bike) bicycle(k, -h.w / 2 + 0.78, f + 0.24)
  // Upper floors: balcony windows, and pairs of small arched windows framed in white.
  for (let fl = 1; fl < h.floors; fl++) {
    const y = fl * STOREY + 0.3
    const slots = Math.max(2, Math.round(h.w / 1.25))
    for (let i = 0; i < slots; i++) {
      const x = -h.w / 2 + (h.w / slots) * (i + 0.5)
      if (fl < 3 && (i + fl) % slots < h.balconies && i !== 0 && i !== slots - 1) {
        jharokha(k, x, y, f, pink)
      } else if (fl < 3 && h.balconies > 1 && slots === 2 && i === fl % 2) {
        jharokha(k, x, y, f, pink)
      } else {
        k.box(WHITE, [0.46, 0.62, 0.03], [x, y + 0.3, f + 0.006])
        arch(k, WHITE, 0.46, 0.03, [x, y + 0.61, f + 0.006])
        k.box(DARK, [0.34, 0.52, 0.03], [x, y + 0.28, f + 0.012])
        arch(k, DARK, 0.34, 0.03, [x, y + 0.54, f + 0.012])
        k.box(WHITE, [0.5, 0.05, 0.1], [x, y, f + 0.04])
      }
    }
  }
  cables(k, h.w, f)
  if (h.blade) blade(k, h.blade * (h.w / 2 - 0.2), 1.6, f, CLOTH[(h.pink * 3 + 2) % CLOTH.length], CLOTH[(h.pink * 3 + 5) % CLOTH.length])
  // Crenellated parapet, and domed kiosks on the front corners.
  k.box(WHITE, [h.w + 0.06, 0.08, h.d + 0.06], [0, H + 0.04, 0])
  const n = Math.round(h.w / 0.32)
  for (let i = 0; i < n; i++) k.box(pink, [0.18, 0.24, 0.1], [-h.w / 2 + (h.w / n) * (i + 0.5), H + 0.2, f - 0.04])
  for (const s of [-1, 1]) k.box(pink, [0.1, 0.24, h.d], [s * (h.w / 2 - 0.05), H + 0.2, 0])
  if (h.kiosks) for (const s of [-1, 1]) kiosk(k, s * (h.w / 2 - 0.4), H + 0.08, f - 0.4, 1, pink)
  else k.box(pink, [0.9, 0.7, 0.9], [h.w * 0.2, H + 0.43, -f + 0.6])
}

// The Palace of Winds: a five-storey honeycomb of little bay windows, facing +z.
function palace(k: PropKit) {
  const pink: Look = { c: '#ef9d83', r: 0.85 }
  const deep: Look = { c: '#cf7a62', r: 0.9 }
  const W = 15
  // Ground floor: a long arcade with a tall central gateway.
  k.box(pink, [W, 2.2, 3.2], [0, 1.1, 0])
  k.box(WHITE, [W + 0.1, 0.1, 3.3], [0, 2.2, 0])
  for (let i = 0; i < 13; i++) {
    const x = -W / 2 + (W / 13) * (i + 0.5)
    if (i === 6) continue
    k.box(WHITE, [0.7, 1.1, 0.03], [x, 0.75, 1.605])
    arch(k, WHITE, 0.7, 0.03, [x, 1.3, 1.605])
    k.box(DARK, [0.56, 1.0, 0.03], [x, 0.7, 1.612])
    arch(k, DARK, 0.56, 0.03, [x, 1.2, 1.612])
  }
  k.box(WHITE, [1.7, 2.0, 0.05], [0, 1.0, 1.61])
  arch(k, WHITE, 1.7, 0.05, [0, 2.0, 1.61])
  k.box({ c: '#5a2e22', r: 0.8 }, [1.3, 1.8, 0.06], [0, 0.9, 1.63])
  arch(k, { c: '#5a2e22', r: 0.8 }, 1.3, 0.06, [0, 1.8, 1.63])
  // Four tiers of bays above, each narrower than the one below.
  const tiers = [{ n: 11, y: 2.2 }, { n: 11, y: 3.4 }, { n: 9, y: 4.6 }, { n: 7, y: 5.8 }, { n: 3, y: 7.0 }]
  const bw = 1.05
  tiers.forEach((t, ti) => {
    const tw = t.n * bw
    k.box(deep, [tw, 1.2, 1.4], [0, t.y + 0.6, -0.4 + ti * 0.05])
    for (let i = 0; i < t.n; i++) {
      const x = -tw / 2 + bw * (i + 0.5)
      // A semi-octagonal bay: a front face and two angled cheeks.
      k.box(pink, [0.6, 1.1, 0.06], [x, t.y + 0.55, 0.62])
      for (const s of [-1, 1]) k.box(pink, [0.34, 1.1, 0.06], [x + s * 0.39, t.y + 0.55, 0.45], [0, s * 0.8, 0])
      for (const wy of [0.32, 0.72]) {
        k.box(DARK, [0.14, 0.22, 0.02], [x - 0.13, t.y + wy, 0.66])
        k.box(DARK, [0.14, 0.22, 0.02], [x + 0.13, t.y + wy, 0.66])
        for (const s of [-1, 1]) k.box(DARK, [0.12, 0.22, 0.02], [x + s * 0.41, t.y + wy, 0.49], [0, s * 0.8, 0])
      }
      k.box(WHITE, [0.66, 0.05, 0.1], [x, t.y + 0.02, 0.62])
      k.box(WHITE, [0.68, 0.06, 0.1], [x, t.y + 1.1, 0.62])
      // Every bay wears a small curved hood; the top tier and every other bay below get a dome.
      if (ti === tiers.length - 1 || (ti >= 2 && i % 2 === 0)) {
        k.sphere(pink, 0.3, [x, t.y + 1.13, 0.4], [1, 1.2, 1], 10, 6, Math.PI / 2)
        k.cone(GOLD, 0.04, 0.18, [x, t.y + 1.56, 0.4], undefined, 6)
      } else {
        k.cyl(pink, 0.2, 0.2, 0.7, [x, t.y + 1.15, 0.48], [0, 0, Math.PI / 2], 8)
      }
    }
    // Pierced screen along the top of each tier.
    for (let i = 0; i < t.n * 3; i++) k.box(WHITE, [0.05, 0.14, 0.05], [-tw / 2 + (tw / (t.n * 3)) * (i + 0.5), t.y + 1.27, 0.7])
  })
  // The crowning arch and spire on top.
  k.box(pink, [1.6, 1.4, 1.0], [0, 8.9, 0.0])
  k.box(WHITE, [1.0, 0.9, 0.03], [0, 8.85, 0.515])
  arch(k, WHITE, 1.0, 0.03, [0, 9.3, 0.515])
  k.box(DARK, [0.8, 0.8, 0.03], [0, 8.8, 0.52])
  arch(k, DARK, 0.8, 0.03, [0, 9.2, 0.52])
  kiosk(k, 0, 9.6, 0, 1.4, pink)
}

// The city gate over the road: a broad pointed arch between towers, kiosks along the top.
function gate(k: PropKit) {
  const pink: Look = { c: '#df8c75', r: 0.9 }
  const deep: Look = { c: '#c37460', r: 0.9 }
  for (const s of [-1, 1]) {
    k.box(pink, [2.2, 6.0, 2.4], [s * 4.3, 3.0, 0])
    k.box(WHITE, [2.3, 0.1, 2.5], [s * 4.3, 6.05, 0])
    for (let i = 0; i < 5; i++) k.box(pink, [0.24, 0.32, 0.12], [s * 4.3 - 0.9 + i * 0.45, 6.26, 1.15])
    kiosk(k, s * 4.3, 6.1, 0, 1.6, pink)
    jharokha(k, s * 4.3, 3.3, 1.2, pink)
    for (const z of [1.2, -1.2]) {
      k.box(WHITE, [1.4, 0.06, 0.04], [s * 4.3, 2.0, z])
      k.box(WHITE, [0.05, 2.0, 0.04], [s * 4.3 - s * 1.08, 1.0, z])
    }
  }
  // The arch: two jambs and a span, a broad white-rimmed arch painted into its face.
  for (const s of [-1, 1]) k.box(pink, [0.6, 3.6, 2.0], [s * 2.95, 1.8, 0])
  k.box(pink, [6.5, 2.0, 2.0], [0, 4.6, 0])
  k.box(WHITE, [6.7, 0.12, 2.1], [0, 5.66, 0])
  for (const [z, ry] of [[1.0, 0], [-1.0, Math.PI]] as const) {
    const f = Math.sign(z)
    arch(k, WHITE, 5.9, 0.02, [0, 3.6, z + f * 0.006], ry, 0.55)
    arch(k, deep, 5.3, 0.02, [0, 3.6, z + f * 0.012], ry, 0.55)
    for (const s of [-1, 1]) k.box(WHITE, [0.1, 3.6, 0.03], [s * 2.62, 1.8, z + f * 0.01])
    for (let i = 0; i < 9; i++) k.box({ c: CLOTH[i % CLOTH.length], r: 0.9 }, [0.3, 0.3, 0.02], [-2.4 + i * 0.6, 5.3, z + f * 0.012], [0, 0, Math.PI / 4])
  }
  for (let i = 0; i < 7; i++) kiosk(k, -2.7 + i * 0.9, 5.72, 0, 0.75, pink)
}

// A fruit cart on two big wheels, heaped with oranges, bananas and melons.
function cart(k: PropKit) {
  const wood: Look = { c: '#8a5a32', r: 0.9 }
  k.box(wood, [0.9, 0.08, 1.5], [0, 0.62, 0])
  for (const s of [-1, 1]) {
    k.box(wood, [0.05, 0.12, 1.5], [s * 0.45, 0.72, 0])
    k.torus({ c: '#5d4030', r: 0.9 }, 0.3, 0.035, [s * 0.5, 0.32, 0], [0, Math.PI / 2, 0], Math.PI * 2, 16, 5)
    for (let i = 0; i < 4; i++) k.box({ c: '#5d4030', r: 0.9 }, [0.03, 0.58, 0.03], [s * 0.5, 0.32, 0], [i * (Math.PI / 4), 0, 0])
    k.rod(wood, [s * 0.4, 0.6, 0.75], [s * 0.35, 0.55, 1.25], 0.025, 5)
  }
  const fruit = ['#fb8c00', '#fdd835', '#43a047', '#e53935']
  for (let i = 0; i < 20; i++) {
    const x = -0.32 + (i % 5) * 0.16
    const z = -0.6 + Math.floor(i / 5) * 0.4
    k.ico({ c: fruit[Math.floor(i / 5)], r: 0.7 }, 0.08, [x, 0.73 + (i % 2) * 0.03, z], [1, 1, 1], 0)
  }
  for (let i = 0; i < 6; i++) k.ico({ c: fruit[i % 4], r: 0.7 }, 0.08, [-0.2 + (i % 3) * 0.2, 0.86, -0.4 + Math.floor(i / 3) * 0.6], [1, 1, 1], 0)
  k.box({ c: '#d81b60', r: 1 }, [1.0, 0.03, 1.3], [0, 1.45, 0])
  k.cyl(wood, 0.02, 0.02, 0.8, [0, 1.05, 0], undefined, 5)
}

// A roadside shrine, facing +z: a whitewashed cell on a stepped plinth with a saffron-smeared
// idol in its niche, a striped spire with a gold pot on top, a bell, garlands and two flags.
// A flat pennant, pointing +x, in the xy plane.
const FLAG = new CylinderGeometry(1, 1, 1, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 2)
function shrine(k: PropKit) {
  const lime: Look = { c: '#f4efe4', r: 0.9 }
  const red: Look = { c: '#c0392b', r: 0.85 }
  k.box({ c: '#d9c7b0', r: 0.95 }, [1.0, 0.14, 0.9], [0, 0.07, 0])
  k.box(lime, [0.84, 0.14, 0.76], [0, 0.21, 0])
  k.box(lime, [0.66, 0.72, 0.6], [0, 0.64, -0.02])
  k.box(red, [0.7, 0.05, 0.64], [0, 1.025, -0.02])
  // The niche and its idol.
  k.box(DARK, [0.3, 0.32, 0.03], [0, 0.6, 0.285])
  arch(k, DARK, 0.3, 0.03, [0, 0.76, 0.285])
  k.box(red, [0.4, 0.06, 0.06], [0, 0.42, 0.3])
  k.ico({ c: '#e8541c', r: 0.7 }, 0.08, [0, 0.55, 0.26], [0.85, 1.25, 0.8], 1)
  k.box({ c: '#fff3c4', r: 0.6 }, [0.04, 0.012, 0.012], [0, 0.6, 0.326])
  // Spire: shrinking tiers, red and white, to a gold pot.
  ;[[0.56, 0.18], [0.46, 0.16], [0.36, 0.15], [0.26, 0.14]].reduce((y, [w, h], i) => {
    frustum(k, i % 2 ? lime : red, w, w, h, 0.82, [0, y, -0.02])
    return y + h
  }, 1.05)
  frustum(k, lime, 0.2, 0.2, 0.22, 0.2, [0, 1.68, -0.02])
  k.sphere(BRASS, 0.05, [0, 1.94, -0.02], [1, 0.9, 1], 8, 5)
  k.cone(BRASS, 0.025, 0.1, [0, 2.02, -0.02], undefined, 6)
  // Garland across the front, a bell, a little oil lamp and offerings on the step.
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    k.ico({ c: MARIGOLD[i % 3], r: 0.9 }, 0.032, [-0.3 + t * 0.6, 0.98 - Math.sin(t * Math.PI) * 0.12, 0.3], [1, 1, 1], 0)
  }
  k.rod(WIRE, [0.22, 1.0, 0.3], [0.22, 0.9, 0.36], 0.005, 3)
  k.cone(BRASS, 0.04, 0.07, [0.22, 0.87, 0.36], undefined, 8)
  k.cyl(CLAY, 0.04, 0.025, 0.03, [-0.22, 0.295, 0.3], undefined, 8)
  k.cone({ c: '#ffcc33', r: 0.5 }, 0.012, 0.04, [-0.22, 0.33, 0.3], undefined, 5)
  k.sphere({ c: '#7a5230', r: 1 }, 0.05, [0.2, 0.33, 0.3], [1, 0.9, 1], 8, 5)
  // Saffron flags on two bamboo poles.
  for (const [fx, h] of [[-0.42, 2.2], [0.42, 1.9]] as const) {
    k.cyl({ c: '#c8a46a', r: 0.9 }, 0.016, 0.02, h, [fx, h / 2, -0.3], undefined, 5)
    k.add({ c: '#ff8f00', r: 1 }, FLAG, [fx, h - 0.14, -0.4], [0, Math.PI / 2, 0], [0.2, 0.12, 0.008])
  }
  // A tulsi planter beside it: a small painted pedestal with the holy basil on top.
  k.box({ c: '#e7b54a', r: 0.9 }, [0.26, 0.42, 0.26], [0.72, 0.21, 0.05])
  k.box(lime, [0.3, 0.04, 0.3], [0.72, 0.44, 0.05])
  k.box(DARK, [0.1, 0.13, 0.01], [0.72, 0.24, 0.184])
  k.ico({ c: '#3f7a35', r: 1 }, 0.12, [0.72, 0.56, 0.05], [1, 0.9, 1], 1)
}

// A chai stall facing +z: a timber counter with a big kettle on its stove, clay cups stacked in
// towers, glass jars of biscuits, brass pots piled beside, a bench in front and a cloth roof.
function chaiStall(k: PropKit) {
  const wood: Look = { c: '#7a4e2d', r: 0.9 }
  const lite: Look = { c: '#a0703f', r: 0.9 }
  const alu: Look = { c: '#c9ccd0', r: 0.35 }
  k.box(wood, [1.3, 0.72, 0.55], [0, 0.36, 0])
  k.box(lite, [1.4, 0.05, 0.62], [0, 0.745, 0])
  for (let i = 0; i < 4; i++) k.box(lite, [0.02, 0.6, 0.01], [-0.48 + i * 0.32, 0.36, 0.28])
  for (const x of [-0.66, 0.66]) for (const z of [-0.28, 0.28]) k.box(wood, [0.05, 1.5, 0.05], [x, 0.75, z])
  for (let i = 0; i < 5; i++) k.box({ c: i % 2 ? '#fdd835' : '#1e88e5', r: 1 }, [0.3, 0.03, 0.8], [-0.6 + i * 0.3, 1.52 + (i % 2) * 0.004, 0.06], [-0.1, 0, 0])
  // The stove and its battered kettle.
  k.cyl({ c: '#2b2b2b', r: 0.7 }, 0.12, 0.12, 0.12, [-0.35, 0.83, 0], undefined, 10)
  k.cyl(alu, 0.12, 0.14, 0.2, [-0.35, 0.99, 0], undefined, 10)
  k.cone(alu, 0.12, 0.08, [-0.35, 1.13, 0], undefined, 10)
  k.rod(alu, [-0.24, 0.96, 0.03], [-0.13, 1.08, 0.06], 0.015, 5)
  k.torus({ c: '#3a3a3a', r: 0.5 }, 0.09, 0.01, [-0.35, 1.12, 0], undefined, Math.PI, 10, 3)
  // Towers of little clay cups, glass jars and glasses of chai.
  for (const [cx, cz, n] of [[0, 0.12, 6], [0.1, 0.12, 4], [0.08, -0.12, 5]] as const) for (let i = 0; i < n; i++) k.cyl(CLAY, 0.035, 0.025, 0.045, [cx, 0.79 + i * 0.04, cz], undefined, 7)
  for (const jx of [0.32, 0.5]) {
    k.cyl({ c: '#d7e6ea', r: 0.15 }, 0.07, 0.07, 0.16, [jx, 0.85, -0.1], undefined, 8)
    k.cyl({ c: '#d6a24e', r: 0.9 }, 0.06, 0.06, 0.1, [jx, 0.83, -0.1], undefined, 8)
    k.cyl({ c: '#c62828', r: 0.6 }, 0.072, 0.072, 0.03, [jx, 0.945, -0.1], undefined, 8)
  }
  for (const gx of [0.3, 0.42, 0.54]) k.cyl({ c: '#b5651d', r: 0.3 }, 0.022, 0.018, 0.06, [gx, 0.8, 0.18], undefined, 6)
  // Brass water pots piled up by the counter.
  for (const [px, py, pz, r] of [[0.85, 0, 0.12, 0.12], [0.85, 0, -0.16, 0.12], [1.08, 0, -0.02, 0.11], [0.95, 0.22, -0.02, 0.1]] as const) {
    k.sphere(BRASS, r, [px, py + r * 0.95, pz], [1, 0.95, 1], 10, 6)
    k.cyl(BRASS, r * 0.45, r * 0.35, r * 0.5, [px, py + r * 1.95, pz], undefined, 8)
  }
  // The bench in front for customers.
  k.box(lite, [1.1, 0.05, 0.26], [0, 0.34, 0.75])
  for (const x of [-0.45, 0.45]) k.box(wood, [0.06, 0.32, 0.22], [x, 0.16, 0.75])
}

// A neem tree: a short trunk and a broad, layered crown.
function neem(k: PropKit) {
  k.cyl({ c: '#6d5340', r: 1 }, 0.13, 0.18, 1.6, [0, 0.8, 0], undefined, 7)
  k.rod({ c: '#6d5340', r: 1 }, [0, 1.4, 0], [0.5, 2.0, 0.1], 0.08, 6)
  k.rod({ c: '#6d5340', r: 1 }, [0, 1.4, 0], [-0.4, 2.1, -0.2], 0.08, 6)
  const leaf = ['#4f7f36', '#5c8f3e', '#476f31']
  ;[[0, 2.4, 0, 1.1], [0.6, 2.2, 0.2, 0.8], [-0.6, 2.3, -0.2, 0.8], [0.1, 2.9, -0.1, 0.8], [0, 2.2, 0.6, 0.7]].forEach(([x, y, z, r], i) => k.ico({ c: leaf[i % 3], r: 1 }, r, [x, y, z], [1, 0.7, 1], 1))
}


// India everywhere you look: three-wheeler autos in green and yellow, holy cows ambling at the
// kerb with painted horns, a painted elephant and her keeper, a decorated lorry, a temple with
// its tall spire, tricolour bunting across the street and people in saris, kurtas and turbans.

const PEOPLE_IN: Dress[] = [
  { top: '#e91e63', low: '#e91e63', skin: '#a86b45', hair: '#1a1210', robe: true, sash: '#fdd835', hat: 'scarf', hatC: '#e91e63' },
  { top: '#f5f0e6', low: '#f5f0e6', skin: '#8d5a3b', hair: '#1a1210', robe: true, hat: 'turban', hatC: '#e53935' },
  { top: '#ff9800', low: '#ff9800', skin: '#c08457', hair: '#1a1210', robe: true, sash: '#7b1fa2', hat: 'scarf', hatC: '#ff9800' },
  { top: '#e3f2fd', low: '#f5f0e6', skin: '#7a4a2e', hair: '#1a1210', hat: 'turban', hatC: '#ffb300' },
  { top: '#9c27b0', low: '#9c27b0', skin: '#a86b45', hair: '#1a1210', robe: true, sash: '#26c6da' },
  { top: '#00897b', low: '#00897b', skin: '#8d5a3b', hair: '#1a1210', robe: true, sash: '#ff7043', hat: 'scarf', hatC: '#00897b' },
  { top: '#fafafa', low: '#5d4037', skin: '#c08457', hair: '#1a1210', hat: 'turban', hatC: '#ec407a', wave: true },
  { top: '#90caf9', low: '#37474f', skin: '#a86b45', hair: '#1a1210' },
]

// An auto-rickshaw facing +z, true to size beside the people: a pressed-steel body, one wheel
// under the nose, a canvas roof, a rear bench and two wheels behind.
function auto(k: PropKit, body: string) {
  const paint: Look = { c: body, r: 0.55 }
  const roof: Look = { c: '#f2c300', r: 0.8 }
  const blk: Look = { c: '#1b1b1b', r: 0.7 }
  const tyre: Look = { c: '#151515', r: 0.9 }
  const steel: Look = { c: '#a9adb1', r: 0.45, m: 0.25 }
  // Floor pan and the rear tub the passengers sit in.
  k.box(blk, [0.66, 0.05, 1.2], [0, 0.22, -0.05])
  k.box(paint, [0.74, 0.34, 0.58], [0, 0.43, -0.36])
  k.box(roof, [0.75, 0.04, 0.6], [0, 0.6, -0.36])
  k.box(blk, [0.6, 0.06, 0.3], [0, 0.42, -0.25])
  k.box(blk, [0.6, 0.22, 0.06], [0, 0.55, -0.5])
  // The nose: a cowl narrowing forward over the front wheel, headlamp and the windscreen frame.
  frustum(k, paint, 0.46, 0.34, 0.5, 0.7, [0, 0.2, 0.42])
  k.box(roof, [0.34, 0.04, 0.26], [0, 0.71, 0.44])
  k.cyl({ c: '#fff8dc', r: 0.3 }, 0.05, 0.05, 0.03, [0, 0.55, 0.61], [Math.PI / 2, 0, 0], 8)
  k.box(steel, [0.18, 0.05, 0.02], [0, 0.32, 0.61])
  k.box({ c: '#8fb7c9', r: 0.2 }, [0.56, 0.3, 0.02], [0, 0.88, 0.36], [-0.12, 0, 0])
  for (const f of [-1, 1]) k.rod(blk, [f * 0.29, 0.7, 0.36], [f * 0.33, 1.03, 0.33], 0.014, 4)
  // Handlebar and the driver's seat.
  k.rod(blk, [-0.18, 0.75, 0.25], [0.18, 0.75, 0.25], 0.012, 4)
  k.rod(blk, [0, 0.62, 0.32], [0, 0.75, 0.25], 0.015, 4)
  k.box(blk, [0.3, 0.06, 0.22], [0, 0.52, 0.06])
  // Canvas roof: flat over the cab, curving down behind, with side rails.
  k.box(blk, [0.76, 0.04, 1.02], [0, 1.06, -0.06])
  k.add(blk, ROUND, [0, 0.82, -0.57], [0, Math.PI / 2, 0], [0.24, 0.76, 0.24])
  for (const f of [-1, 1]) {
    k.rod(blk, [f * 0.36, 0.6, -0.1], [f * 0.36, 1.05, -0.1], 0.012, 4)
    k.rod(steel, [f * 0.36, 0.72, 0.05], [f * 0.36, 0.72, -0.5], 0.009, 3)
  }
  // Wheels.
  k.cyl(tyre, 0.13, 0.13, 0.08, [0, 0.13, 0.5], [0, 0, Math.PI / 2], 10)
  for (const f of [-1, 1]) {
    k.cyl(tyre, 0.14, 0.14, 0.09, [f * 0.34, 0.14, -0.42], [0, 0, Math.PI / 2], 10)
    k.cyl(steel, 0.07, 0.07, 0.095, [f * 0.34, 0.14, -0.42], [0, 0, Math.PI / 2], 6)
  }
  k.box({ c: '#fdd835', r: 0.6 }, [0.2, 0.07, 0.01], [0, 0.32, -0.655])
  for (const f of [-1, 1]) k.box({ c: '#c62828', r: 0.6 }, [0.06, 0.05, 0.01], [f * 0.3, 0.45, -0.655])
}

// A holy cow: white, humped, horns painted and tipped with bells, a marigold garland round her
// neck. Facing +z, standing or lying down to chew.
function cow(k: PropKit, down: boolean) {
  const hide: Look = { c: '#efe9df', r: 1 }
  const grey: Look = { c: '#c9c2b6', r: 1 }
  const y = down ? 0.28 : 0.55
  k.sphere(hide, 1, [0, y, 0], [0.22, 0.24, 0.52], 9, 6)
  k.sphere(grey, 1, [0, y + 0.22, 0.28], [0.12, 0.12, 0.13], 7, 4)
  // Dewlap hanging under the neck, then the long face.
  k.box(hide, [0.08, 0.2, 0.22], [0, y - 0.06, 0.48])
  k.rod(hide, [0, y + 0.06, 0.42], [0, y + 0.16, 0.6], 0.09, 6)
  k.box(hide, [0.15, 0.16, 0.3], [0, y + 0.14, 0.72], [0.35, 0, 0])
  k.box(grey, [0.13, 0.08, 0.06], [0, y + 0.06, 0.86])
  for (const f of [-1, 1]) {
    k.box({ c: '#1a1a1a', r: 0.9 }, [0.02, 0.025, 0.025], [f * 0.075, y + 0.2, 0.7])
    k.box(hide, [0.1, 0.04, 0.06], [f * 0.11, y + 0.21, 0.62], [0, 0, f * -0.3])
    k.rod({ c: f > 0 ? '#e65100' : '#1565c0', r: 0.7 }, [f * 0.05, y + 0.26, 0.62], [f * 0.11, y + 0.4, 0.6], 0.016, 4)
    k.sphere(BRASS, 0.018, [f * 0.11, y + 0.41, 0.6], [1, 1, 1], 5, 3)
  }
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI
    k.ico({ c: MARIGOLD[i % 3], r: 0.9 }, 0.028, [Math.cos(a) * 0.12, y + 0.02 - Math.sin(a) * 0.1, 0.46], [1, 1, 1], 0)
  }
  k.rod(grey, [0, y + 0.1, -0.5], [0.03, y - 0.3, -0.56], 0.015, 4)
  if (down) {
    for (const f of [-1, 1]) {
      k.box(hide, [0.08, 0.08, 0.32], [f * 0.16, 0.05, 0.35])
      k.box(hide, [0.09, 0.08, 0.3], [f * 0.2, 0.05, -0.3])
    }
  } else {
    for (const f of [-1, 1]) for (const z of [0.3, -0.33]) {
      k.rod(hide, [f * 0.12, y - 0.1, z], [f * 0.12, 0.04, z], 0.04, 5)
      k.box({ c: '#3a3530', r: 1 }, [0.06, 0.04, 0.07], [f * 0.12, 0.02, z])
    }
  }
}

// A temple elephant facing +z: painted face, a red and gold cloth over her back, a howdah on
// top with its little canopy, anklets of bells, and her keeper beside her with his stick.
function elephant(k: PropKit) {
  const hide: Look = { c: '#7d7a78', r: 1 }
  const dark: Look = { c: '#64615f', r: 1 }
  const red: Look = { c: '#b71c1c', r: 0.95 }
  const gold: Look = { c: '#e0b040', r: 0.6 }
  k.sphere(hide, 1, [0, 1.08, -0.1], [0.5, 0.55, 0.8], 12, 8)
  for (const fx of [-1, 1]) for (const fz of [0.45, -0.6]) {
    k.cyl(hide, 0.15, 0.17, 0.85, [fx * 0.28, 0.43, fz], undefined, 9)
    k.cyl(gold, 0.175, 0.175, 0.05, [fx * 0.28, 0.12, fz], undefined, 9)
    k.cyl({ c: '#d8d2c8', r: 0.9 }, 0.17, 0.17, 0.04, [fx * 0.28, 0.02, fz], undefined, 9)
  }
  // Head, ears fanned out, the painted forehead and the trunk curling down.
  k.sphere(hide, 0.42, [0, 1.3, 0.72], [0.95, 1, 0.85], 11, 7)
  for (const f of [-1, 1]) {
    k.sphere(dark, 1, [f * 0.42, 1.22, 0.6], [0.06, 0.38, 0.32], 8, 6)
    k.box({ c: '#1a1a1a', r: 0.9 }, [0.03, 0.04, 0.03], [f * 0.24, 1.38, 1.0])
    k.cone({ c: '#f2ede2', r: 0.7 }, 0.04, 0.32, [f * 0.14, 0.92, 1.08], [1.1, 0, 0], 6)
  }
  // Painted patterns: a dotted arch over the brow and flowers down the trunk.
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI
    k.box({ c: ['#fdd835', '#e91e63', '#4fc3f7'][i % 3], r: 0.8 }, [0.05, 0.05, 0.02], [Math.cos(a) * 0.22, 1.42 + Math.sin(a) * 0.14, 1.06], [0.4, 0, 0])
  }
  const trunk: V3[] = [[0, 1.2, 1.05], [0, 0.95, 1.18], [0, 0.65, 1.2], [0, 0.4, 1.14], [0, 0.25, 1.2]]
  for (let i = 0; i < trunk.length - 1; i++) {
    k.rod(hide, trunk[i], trunk[i + 1], 0.11 - i * 0.018, 7)
    k.box({ c: ['#fdd835', '#e91e63', '#43a047', '#fdd835'][i], r: 0.8 }, [0.06, 0.06, 0.02], [0, (trunk[i][1] + trunk[i + 1][1]) / 2, (trunk[i][2] + trunk[i + 1][2]) / 2 + 0.1 - i * 0.01])
  }
  k.box(gold, [0.5, 0.04, 0.04], [0, 1.56, 0.9])
  // The cloth: a broad red blanket with a gold border and tassels, hanging both flanks.
  k.box(red, [1.08, 0.06, 0.9], [0, 1.6, -0.1])
  for (const f of [-1, 1]) {
    k.box(red, [0.04, 0.55, 0.9], [f * 0.53, 1.32, -0.1])
    k.box(gold, [0.045, 0.06, 0.92], [f * 0.535, 1.06, -0.1])
    for (let i = 0; i < 5; i++) k.cone(gold, 0.025, 0.08, [f * 0.54, 1.0, -0.5 + i * 0.2], [Math.PI, 0, 0], 5)
  }
  // The howdah: a railed seat on top under a small domed canopy.
  k.box(gold, [0.62, 0.22, 0.6], [0, 1.75, -0.15])
  k.box(red, [0.56, 0.06, 0.54], [0, 1.88, -0.15])
  for (const fx of [-1, 1]) for (const fz of [0.12, -0.42]) k.rod(gold, [fx * 0.28, 1.86, fz], [fx * 0.28, 2.3, fz], 0.015, 4)
  k.box(red, [0.66, 0.05, 0.64], [0, 2.32, -0.15])
  k.sphere(gold, 0.25, [0, 2.34, -0.15], [1.2, 0.8, 1.2], 10, 5, Math.PI / 2)
  k.cone(gold, 0.04, 0.16, [0, 2.6, -0.15], undefined, 6)
  k.rod(hide, [0, 1.0, -0.88], [0.05, 0.55, -0.95], 0.025, 4)
  person(k, PEOPLE_IN[1], 0.75, 0.75, -0.4)
  k.rod(WOOD, [0.62, 0.33, 0.85], [0.6, 1.0, 1.0], 0.012, 4)
}

// A goods lorry facing +z, painted all over: a bonnet with a decorated crown over the windscreen,
// flowered panels down the wooden body, a bulging tarpaulin and tasselled mud flaps.
function lorry(k: PropKit) {
  const cab: Look = { c: '#ef6c00', r: 0.6 }
  const crown: Look = { c: '#fdd835', r: 0.6 }
  const body: Look = { c: '#1565c0', r: 0.75 }
  const tyre: Look = { c: '#151515', r: 0.9 }
  k.box({ c: '#2b2b2b', r: 0.8 }, [0.8, 0.12, 2.5], [0, 0.32, -0.15])
  // Cab and bonnet.
  k.box(cab, [0.9, 0.5, 0.45], [0, 0.6, 0.85])
  k.box(cab, [0.92, 0.62, 0.6], [0, 0.96, 0.45])
  k.box({ c: '#7fa9bd', r: 0.2 }, [0.78, 0.26, 0.02], [0, 1.08, 0.755])
  k.box(crown, [0.94, 0.2, 0.04], [0, 1.38, 0.74])
  for (let i = 0; i < 6; i++) k.box({ c: CLOTH[i % CLOTH.length], r: 0.8 }, [0.11, 0.11, 0.02], [-0.38 + i * 0.152, 1.38, 0.765], [0, 0, Math.PI / 4])
  k.box({ c: '#c8c8c8', r: 0.4, m: 0.25 }, [0.5, 0.2, 0.02], [0, 0.6, 1.08])
  for (const f of [-1, 1]) k.cyl({ c: '#fff8dc', r: 0.3 }, 0.06, 0.06, 0.03, [f * 0.33, 0.64, 1.08], [Math.PI / 2, 0, 0], 8)
  k.box({ c: '#fafafa', r: 0.7 }, [0.92, 0.06, 0.06], [0, 0.38, 1.1])
  for (let i = 0; i < 5; i++) k.box({ c: i % 2 ? '#c62828' : '#fafafa', r: 0.7 }, [0.18, 0.062, 0.062], [-0.36 + i * 0.18, 0.38, 1.101])
  // The wooden body with painted panels.
  k.box(body, [0.94, 0.62, 1.7], [0, 0.69, -0.55])
  for (const f of [-1, 1]) for (let i = 0; i < 4; i++) {
    k.box({ c: '#fdd835', r: 0.8 }, [0.005, 0.38, 0.34], [f * 0.473, 0.7, -1.2 + i * 0.43])
    k.box({ c: CLOTH[(i * 2 + (f > 0 ? 1 : 0)) % CLOTH.length], r: 0.8 }, [0.005, 0.22, 0.22], [f * 0.477, 0.7, -1.2 + i * 0.43], [Math.PI / 4, 0, 0])
  }
  k.box({ c: '#fdd835', r: 0.8 }, [0.8, 0.4, 0.005], [0, 0.72, -1.403])
  for (let i = 0; i < 3; i++) k.box({ c: '#c62828', r: 0.8 }, [0.16, 0.06, 0.006], [-0.24 + i * 0.24, 0.78, -1.406])
  k.sphere({ c: '#2e7d32', r: 0.95 }, 1, [0, 1.0, -0.55], [0.46, 0.22, 0.84], 10, 4, Math.PI / 2)
  for (const z of [0.85, -0.3, -0.85]) for (const f of [-1, 1]) k.cyl(tyre, 0.2, 0.2, 0.14, [f * 0.39, 0.2, z], [0, 0, Math.PI / 2], 10)
  for (const f of [-1, 1]) {
    k.box({ c: '#1a1a1a', r: 0.9 }, [0.2, 0.24, 0.02], [f * 0.36, 0.17, -1.12])
    for (let i = 0; i < 3; i++) k.cone({ c: CLOTH[i + 1], r: 0.9 }, 0.02, 0.07, [f * 0.36 - 0.07 + i * 0.07, 0.02, -1.13], [Math.PI, 0, 0], 4)
  }
}

// A sandstone temple facing +z: a pillared porch under a row of little domes, and behind it the
// sanctum's tall curved spire, ribbed, with its fluted cap, gold pot and saffron flag.
function temple(k: PropKit) {
  const sand: Look = { c: '#e7cfa1', r: 0.9 }
  const deep: Look = { c: '#cfae78', r: 0.9 }
  const red: Look = { c: '#c0392b', r: 0.85 }
  for (let i = 0; i < 4; i++) k.box(i % 2 ? deep : sand, [4.6 - i * 0.3, 0.14, 4.6 - i * 0.3], [0, 0.07 + i * 0.14, 0])
  const base = 0.56
  // The porch: eight carved pillars, a deep cornice and small domes along it.
  for (const x of [-1.5, -0.5, 0.5, 1.5]) for (const z of [1.7, 0.8]) {
    k.box(sand, [0.22, 1.5, 0.22], [x, base + 0.75, z])
    k.box(deep, [0.3, 0.12, 0.3], [x, base + 0.06, z])
    k.box(deep, [0.34, 0.14, 0.34], [x, base + 1.43, z])
  }
  k.box(sand, [3.8, 0.24, 1.4], [0, base + 1.62, 1.25])
  k.box(deep, [4.0, 0.08, 1.6], [0, base + 1.5, 1.25])
  for (const x of [-1.3, 0, 1.3]) {
    k.sphere(sand, 0.42, [x, base + 1.74, 1.25], [1, 1.1, 1], 10, 6, Math.PI / 2)
    k.cone(BRASS, 0.05, 0.24, [x, base + 2.3, 1.25], undefined, 6)
  }
  // Sanctum and its spire: shrinking ribbed tiers, curving in towards the top.
  k.box(sand, [2.6, 2.2, 2.4], [0, base + 1.1, -0.9])
  k.box(DARK, [0.7, 1.1, 0.02], [0, base + 0.55, 0.31])
  arch(k, DARK, 0.7, 0.02, [0, base + 1.1, 0.31])
  let y = base + 2.2
  const tiers = [2.5, 2.3, 2.05, 1.8, 1.5, 1.2, 0.85]
  tiers.forEach((w, i) => {
    const h = 0.62
    frustum(k, i % 2 ? deep : sand, w, w, h, (tiers[i + 1] ?? 0.6) / w, [0, y, -0.9])
    for (const f of [-1, 1]) k.box(deep, [0.12, h, 0.05], [f * w * 0.18, y + h / 2, -0.9 + w / 2 - 0.02 - (w - (tiers[i + 1] ?? 0.6)) / 4], [-0.18, 0, 0])
    y += h
  })
  // The amalaka: a fluted stone disc, then the gold pot and the flag pole.
  k.cyl(sand, 0.55, 0.55, 0.22, [0, y + 0.08, -0.9], undefined, 14)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    k.box(deep, [0.06, 0.24, 0.06], [Math.sin(a) * 0.55, y + 0.08, -0.9 + Math.cos(a) * 0.55])
  }
  k.sphere(BRASS, 0.18, [0, y + 0.36, -0.9], [1, 1.1, 1], 8, 5)
  k.cone(BRASS, 0.06, 0.34, [0, y + 0.68, -0.9], undefined, 6)
  k.rod(WOOD, [0.3, y, -0.9], [0.3, y + 1.8, -0.9], 0.02, 4)
  k.add({ c: '#ff8f00', r: 1 }, FLAG, [0.3, y + 1.6, -1.15], [0, Math.PI / 2, 0], [0.45, 0.26, 0.01])
  // Red and gold trim, a hanging bell and lamps by the door, marigolds on the steps.
  k.box(red, [2.62, 0.08, 0.02], [0, base + 2.0, 0.305])
  k.rod(WIRE, [0, base + 1.5, 1.5], [0, base + 1.25, 1.5], 0.006, 3)
  k.cone(BRASS, 0.08, 0.14, [0, base + 1.18, 1.5], undefined, 8)
  for (let i = 0; i < 14; i++) k.ico({ c: MARIGOLD[i % 3], r: 0.9 }, 0.05, [-1.6 + i * 0.25, 0.6, 2.05], [1, 1, 1], 0)
}

const PENNANT = new CylinderGeometry(1, 0, 1, 3, 1)
// Bunting strung across the street: little flags in saffron, white and green.
function tricolour(k: PropKit) {
  const half = EDGE + 1.6
  k.rod(WIRE, [-half, 4.1, 0], [half, 4.1, 0], 0.006, 3)
  const cols = ['#ff9933', '#fafafa', '#138808']
  for (let i = 0; i < 27; i++) {
    const t = (i + 0.5) / 27
    const x = -half + t * half * 2
    const y = 4.1 - Math.sin(t * Math.PI) * 0.55
    k.add({ c: cols[i % 3], r: 0.95 }, PENNANT, [x, y - 0.12, 0], [0, 0, 0], [0.12, 0.22, 0.01])
  }
}

// The old city wall running off from the gate on both sides: crenellations, a round bastion and
// little domed kiosks, so the gateway stands in a wall rather than on open ground.
function cityWall(k: PropKit) {
  const pink: Look = { c: '#df8c75', r: 0.9 }
  const deep: Look = { c: '#c37460', r: 0.9 }
  k.box(pink, [14, 4.0, 1.4], [7, 2.0, 0])
  k.box(WHITE, [14.04, 0.1, 1.44], [7, 4.0, 0])
  for (let i = 0; i < 28; i++) k.box(pink, [0.28, 0.36, 1.44], [0.25 + i * 0.5, 4.23, 0])
  for (const f of [-1, 1]) for (let i = 0; i < 6; i++) {
    k.box(WHITE, [0.7, 1.1, 0.02], [1.6 + i * 2.2, 1.6, f * 0.71])
    arch(k, WHITE, 0.7, 0.02, [1.6 + i * 2.2, 2.15, f * 0.71], f > 0 ? 0 : Math.PI)
    k.box(deep, [0.56, 1.0, 0.025], [1.6 + i * 2.2, 1.55, f * 0.715])
    arch(k, deep, 0.56, 0.025, [1.6 + i * 2.2, 2.05, f * 0.715], f > 0 ? 0 : Math.PI)
  }
  k.cyl(pink, 1.4, 1.6, 5.0, [9.5, 2.5, 0], undefined, 12)
  k.cyl(WHITE, 1.45, 1.45, 0.1, [9.5, 5.0, 0], undefined, 12)
  kiosk(k, 9.5, 5.05, 0, 1.5, pink)
  kiosk(k, 4.5, 4.05, 0, 1.0, pink)
  for (const x of [3, 6, 12]) jharokha(k, x, 2.8, 0.7, pink)
}

// Shoppers along the arcades in threes, side by side (along x) and facing +z (the street).
function shoppers(k: PropKit, seed: number) {
  for (let i = 0; i < 3; i++) person(k, PEOPLE_IN[(seed * 3 + i * 5) % PEOPLE_IN.length], -0.6 + i * 0.6, ((i * 7 + seed) % 3) * 0.12 - 0.12, 0.25 * (i - 1))
}


// The old city behind the street front: taller pink blocks crowding up behind, with white
// cornices, crenellations, dark windows and a domed kiosk, so no gap shows open ground.
function backBlocks(k: PropKit, seed: number) {
  const r = rand(seed)
  let x = -1.7
  for (let i = 0; i < 3; i++) {
    const w = 1.0 + r() * 0.5
    const h = 4.2 + r() * 2.6
    const pink: Look = { c: PINKS[(seed + i * 2) % PINKS.length], r: 0.9 }
    const cx = x + w / 2
    const d = 2.2 + r() * 0.8
    k.box(pink, [w, h, d], [cx, h / 2, 0])
    k.box(WHITE, [w + 0.06, 0.08, d + 0.06], [cx, h, 0])
    k.box(pink, [w + 0.02, 0.2, 0.12], [cx, h + 0.14, d / 2 - 0.06])
    for (let fl = 1; fl < Math.floor(h / STOREY); fl++) {
      k.box(WHITE, [w + 0.03, 0.05, 0.04], [cx, fl * STOREY, d / 2 + 0.01])
      for (const wx of w > 1.2 ? [-0.3, 0.3] : [0]) k.box(DARK, [0.26, 0.42, 0.02], [cx + wx, fl * STOREY + 0.45, d / 2 + 0.012])
    }
    if (i === 1) kiosk(k, cx, h + 0.06, d / 2 - 0.5, 0.9, pink)
    x += w + 0.05
  }
}

// Roadside shrines: which side, and how far down the race.
const SHRINES = [[1, 0.13], [-1, 0.72]] as const

export default function Jaipur({ len, race }: WorldProps) {
  const homes = useMemo(() => HAVELIS.map((h, i) => prop(`jaipur-haveli-d3-${i}`, (k) => haveli(k, h))), [])
  const palaceP = useProp('jaipur-palace', palace)
  const gateP = useProp('jaipur-gate', gate)
  const autoG = useProp('jaipur-auto-green', (k) => auto(k, '#2e7d32'))
  const autoB = useProp('jaipur-auto-black', (k) => auto(k, '#1f1f1f'))
  const cowUp = useProp('jaipur-cow-up', (k) => cow(k, false))
  const cowDown = useProp('jaipur-cow-down', (k) => cow(k, true))
  const eleP = useProp('jaipur-elephant', elephant)
  const lorryP = useProp('jaipur-lorry', lorry)
  const templeP = useProp('jaipur-temple', temple)
  const flagsP = useProp('jaipur-tricolour', tricolour)
  const wallP = useProp('jaipur-city-wall', cityWall)
  const blocks = useMemo(() => [11, 23, 37].map((n) => prop(`jaipur-back-${n}`, (k) => backBlocks(k, n))), [])
  const crowds = useMemo(() => [0, 1, 2].map((i) => prop(`jaipur-shoppers-${i}`, (k) => shoppers(k, i))), [])
  const cartP = useProp('jaipur-cart', cart)
  const treeP = useProp('jaipur-neem', neem)
  const shrineP = useProp('jaipur-shrine', shrine)
  const chaiP = useProp('jaipur-chai', chaiStall)
  const gz = race * 0.5
  const pz = race + 10
  const tz = race * 0.3

  const geo = useMemo(() => {
    const r = rand(421)
    const rows: Spot[][] = HAVELIS.map(() => [])
    for (const side of [-1, 1] as const) {
      for (let z = -14 + (side > 0 ? 1.1 : 0); z < len + 40;) {
        const i = Math.floor(r() * HAVELIS.length)
        const h = HAVELIS[i]
        const zc = z + h.w / 2
        // Gaps for the gate, and on the left for the palace front.
        const clear = Math.abs(zc - gz) > 3.6 + h.w / 2 && !(side < 0 && Math.abs(zc - pz) < 8 + h.w / 2) && !(side > 0 && Math.abs(zc - tz) < 2.5 + h.w / 2)
        if (clear) rows[i].push({ x: side * (EDGE + 1.5 + h.d / 2), z: zc, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 })
        z += h.w + 0.04
      }
    }
    // Kerbside life on the pavement in front of the shops.
    const autos: Spot[] = []
    const autos2: Spot[] = []
    const carts: Spot[] = []
    const trees: Spot[] = []
    const cows: Spot[] = []
    const cowsDown: Spot[] = []
    const lorries: Spot[] = []
    const kerb: { side: number; z: number; r: number }[] = []
    for (const side of [-1, 1] as const) {
      for (let z = 22; z < len + 30; z += 5 + r() * 6) {
        if (Math.abs(z - gz) < 5) continue
        if (SHRINES.some(([sx, sz]) => sx === side && Math.abs(sz * race - z) < 2.4)) continue
        if (side > 0 && Math.abs(z - tz) < 3.5) continue
        const k = r()
        const x = side * (EDGE + 0.85)
        const ry = (side > 0 ? 0 : Math.PI) + (r() - 0.5) * 0.3
        if (k < 0.32) (r() < 0.5 ? autos : autos2).push({ x: side * (EDGE + 0.6), z, ry })
        else if (k < 0.48) carts.push({ x, z, ry: side > 0 ? 0.2 : Math.PI - 0.2 })
        else if (k < 0.62) trees.push({ x: side * (EDGE + 0.8), z, ry: r() * 6, s: 0.9 + r() * 0.2 })
        else if (k < 0.82) (r() < 0.5 ? cows : cowsDown).push({ x: side * (EDGE + 0.75), z, ry: (side > 0 ? 0 : Math.PI) + (r() - 0.5) * 1.2 })
        else {
          lorries.push({ x: side * (EDGE + 0.7), z: z + 0.6, ry: side > 0 ? 0 : Math.PI })
          kerb.push({ side, z: z + 0.6, r: 1.7 })
          z += 2
          continue
        }
        kerb.push({ side, z, r: 0.9 })
      }
    }
    // Marigold garlands strung across the street, each a sagging double string of flowers.
    const flowers: { x: number; z: number; y: number; s: number }[] = []
    for (let z = 8; z < len + 30; z += 13) {
      if (Math.abs(z - gz) < 5) continue
      for (const [dz, top] of [[0, 4.6], [0.35, 4.35]] as const) {
        for (let i = 0; i <= 30; i++) {
          const t = i / 30
          const x = -(EDGE + 1.6) + t * (EDGE + 1.6) * 2
          flowers.push({ x, z: z + dz, y: top - Math.sin(t * Math.PI) * 0.75, s: 1 })
        }
      }
    }
    const flags: Spot[] = []
    for (let z = 14.5; z < len + 30; z += 13) if (Math.abs(z - gz) > 5) flags.push({ x: 0, z })
    // Shoppers along both arcades, clear of whatever stands at the kerb.
    const shop: Spot[][] = [[], [], []]
    for (const side of [-1, 1] as const) {
      for (let z = -6; z < len + 30; z += 2.8 + r() * 1.8) {
        if (Math.abs(z - gz) < 4 || (side < 0 && Math.abs(z - pz) < 7) || (side > 0 && Math.abs(z - tz) < 3)) continue
        if (kerb.some((o) => o.side === side && Math.abs(o.z - z) < o.r + 1)) continue
        shop[Math.floor(r() * 3)].push({ x: side * (EDGE + 1.12), z, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 })
      }
    }
    // Cows resting in front of the city wall on each side of the gate.
    for (const side of [-1, 1]) for (const dz of [-3, 2.6]) cowsDown.push({ x: side * (EDGE + 4.5 + (dz > 0 ? 1 : 0)), z: gz + dz, ry: r() * 6 })
    // The city crowding up behind both street fronts, and behind the gate and temple gaps.
    const back: Spot[][] = [[], [], []]
    for (const side of [-1, 1] as const) {
      for (let z = -14 + (side > 0 ? 1.7 : 0); z < len + 40; z += 3.4) back[Math.floor(r() * 3)].push({ x: side * (EDGE + 5.9), z, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 })
    }
    return { back, rows, autos, autos2, carts, trees, cows, cowsDown, lorries, flowers, flags, shop }
  }, [len, race, gz, pz, tz])

  return (
    <>
      <Batch version={`jaipur:${len}`} cell={24} freeze prune>
        {/* Worn stone pavements between the road and the shops. */}
        {[-1, 1].map((s) => (
          <mesh key={s} rotation-x={-Math.PI / 2} position={[s * (EDGE + 1.3), 0.012, len / 2 + 5]}>
            <planeGeometry args={[2.6, len + 60]} />
            <meshStandardMaterial color="#cdb59a" />
          </mesh>
        ))}
        <group position={[0, 0, gz]}><PropMesh parts={gateP} /></group>
        <group position={[5.4, 0, gz]}><PropMesh parts={wallP} /></group>
        <group position={[-5.4, 0, gz]} rotation-y={Math.PI}><PropMesh parts={wallP} /></group>
        <group position={[EDGE + 3.85, 0, tz]} rotation-y={-Math.PI / 2}><PropMesh parts={templeP} /></group>
        <group position={[EDGE + 0.95, 0, race * 0.42]}><PropMesh parts={eleP} /></group>
        <group position={[-(EDGE + 1.7), 0, pz - 5.5]} rotation-y={Math.PI / 2 + 0.5}><PropMesh parts={eleP} /></group>
        {SHRINES.map(([side, f]) => (
          <group key={f} position={[side * (EDGE + 0.75), 0, f * race]} rotation-y={side > 0 ? -Math.PI / 2 : Math.PI / 2}><PropMesh parts={shrineP} /></group>
        ))}
        <group position={[-(EDGE + 0.95), 0, 10]} rotation-y={Math.PI / 2}><PropMesh parts={chaiP} /></group>
        <group position={[-(EDGE + 3.4), 0, pz]} rotation-y={Math.PI / 2}><PropMesh parts={palaceP} /></group>
        <mesh rotation-x={-Math.PI / 2} position={[-(EDGE + 1.8), 0.014, pz]}>
          <planeGeometry args={[3.2, 16]} />
          <meshStandardMaterial color="#e6d3bd" />
        </mesh>
      </Batch>
      {homes.map((h, i) => <Many key={i} parts={h} at={geo.rows[i]} />)}
      {blocks.map((b, i) => <Many key={i} parts={b} at={geo.back[i]} near={90} />)}
      <Many parts={autoG} at={geo.autos} near={80} />
      <Many parts={autoB} at={geo.autos2} near={80} />
      <Many parts={cowUp} at={geo.cows} near={80} />
      <Many parts={cowDown} at={geo.cowsDown} near={80} />
      <Many parts={lorryP} at={geo.lorries} near={80} />
      <Many parts={flagsP} at={geo.flags} />
      {crowds.map((c, i) => <Many key={i} parts={c} at={geo.shop[i]} near={70} />)}
      <Many parts={cartP} at={geo.carts} near={80} />
      <Many parts={treeP} at={geo.trees} />
      <Scatter spots={geo.flowers} colors={['#ff8f00', '#ffb300', '#ff6f00', '#ffca28']}>
        <icosahedronGeometry args={[0.1, 0]} />
      </Scatter>
      <Kites />
      <FarJaipur />
    </>
  )
}

// Paper kites tugging on their strings high over the street.
function Kites() {
  const refs = useRef<(Group | null)[]>([])
  const kites = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (3 + (i % 3) * 3), y: 10 + (i % 4) * 2, z: 14 + i * 7, ph: i * 1.3, c: ['#e53935', '#fdd835', '#1e88e5', '#8e24aa', '#43a047', '#ff7043', '#ec407a'][i] })), [])
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime
    kites.forEach((k, i) => {
      const g = refs.current[i]
      if (!g) return
      g.position.set(k.x + Math.sin(t * 0.7 + k.ph) * 1.2, k.y + Math.sin(t * 1.3 + k.ph) * 0.5, camera.position.z + k.z)
      g.rotation.z = Math.sin(t * 1.1 + k.ph) * 0.35
    })
  })
  return (
    <>
      {kites.map((k, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }}>
          <mesh rotation-z={Math.PI / 4} scale={[0.5, 0.5, 0.02]}>
            <boxGeometry />
            <meshStandardMaterial color={k.c} />
          </mesh>
          <mesh position={[0, -0.6, 0]} scale={[0.02, 0.8, 0.02]}>
            <boxGeometry />
            <meshStandardMaterial color="#fafafa" />
          </mesh>
        </group>
      ))}
    </>
  )
}

// The hill fort along the ridge to the left, and the marble tomb standing over the rooftops on the
// right, close enough that the haze doesn't swallow it and big enough to clear the havelis.

// The white marble tomb: platform, the great dome on its drum, four kiosks and four minarets.
function tomb(k: PropKit) {
  const marble: Look = { c: '#f1ebe0', r: 0.6 }
  const shade: Look = { c: '#c9bfae', r: 0.7 }
  const tx = 0
  const tz = 0
  k.box({ c: '#e8dccd', r: 0.8 }, [26, 1.4, 26], [tx, 0.7, tz])
  k.cyl(marble, 6.4, 6.4, 9, [tx, 5.9, tz], [0, Math.PI / 8, 0], 8)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    k.box(shade, [3.4, 5.6, 0.2], [tx + Math.sin(a) * 6.0, 5.4, tz + Math.cos(a) * 6.0], [0, a, 0])
    // The great arched recess in each face, dark inside.
    k.box({ c: '#6f6559', r: 0.9 }, [2.4, 4.2, 0.1], [tx + Math.sin(a) * 6.12, 5.1, tz + Math.cos(a) * 6.12], [0, a, 0])
    kioskFar(k, tx + Math.sin(a + Math.PI / 4) * 5.2, 10.4, tz + Math.cos(a + Math.PI / 4) * 5.2, marble)
    // Minarets at the platform's corners.
    const mx = tx + Math.sin(a + Math.PI / 4) * 16
    const mz = tz + Math.cos(a + Math.PI / 4) * 16
    k.cyl(marble, 0.7, 0.95, 14, [mx, 8.4, mz], undefined, 10)
    for (const y of [6, 10, 14]) k.cyl(shade, 1.15, 1.0, 0.35, [mx, y + 1.4, mz], undefined, 10)
    kioskFar(k, mx, 15.4, mz, marble)
  }
  k.cyl(marble, 4.0, 4.0, 2.4, [tx, 11.6, tz], undefined, 16)
  k.sphere(marble, 4.6, [tx, 14.4, tz], [1, 1.25, 1], 18, 10)
  k.cone(GOLD, 0.3, 2.4, [tx, 21.4, tz], undefined, 8)
}

function FarJaipur() {
  const tombP = useProp('jaipur-tomb', tomb)
  const parts = useProp('jaipur-far', (k) => {
    // The fort: walls and round bastions climbing a ridge, the palace on top.
    const hill: Look = { c: '#a58b5f', r: 1 }
    const wall: Look = { c: '#d7b27a', r: 0.95 }
    for (const [x, z, s] of [[34, 84, 16], [52, 96, 22], [70, 88, 16]]) k.sphere(hill, s, [x, -s * 0.45, z], [1.4, 1, 1], 14, 6, Math.PI / 2)
    const ridge = [[18, 2, 80], [26, 5, 82], [34, 8.5, 84], [42, 10, 88], [50, 11.5, 94], [58, 10, 92], [66, 7, 90], [74, 4, 88]]
    for (let i = 0; i < ridge.length - 1; i++) {
      const [x0, y0, z0] = ridge[i]
      const [x1, y1, z1] = ridge[i + 1]
      const dx = x1 - x0
      const dz = z1 - z0
      const l = Math.hypot(dx, dz)
      const ry = Math.atan2(dx, dz)
      k.box(wall, [0.9, 2.6, l], [(x0 + x1) / 2, (y0 + y1) / 2 + 0.6, (z0 + z1) / 2], [Math.atan2(y0 - y1, l), ry, 0])
      k.cyl(wall, 1.3, 1.5, 3.6, [x0, y0 + 1.2, z0], undefined, 10)
    }
    k.box(wall, [10, 5, 7], [46, 13, 92])
    k.box({ c: '#f0d9b0', r: 0.9 }, [10.4, 0.4, 7.4], [46, 15.7, 92])
    for (const s of [-1, 1]) kioskFar(k, 46 + s * 4, 15.9, 89, wall)
    for (let i = 0; i < 6; i++) k.box(DARK, [0.5, 0.9, 0.1], [42.5 + i * 1.4, 13.5, 88.45])
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
      <group position={[-22, 0, 82]} scale={1.5}><PropMesh parts={tombP} /></group>
    </Horizon>
  )
}

function kioskFar(k: PropKit, x: number, y: number, z: number, look: Look) {
  for (const px of [-1, 1]) for (const pz of [-1, 1]) k.box(look, [0.25, 1.4, 0.25], [x + px * 0.8, y + 0.7, z + pz * 0.8])
  k.box(look, [2.1, 0.25, 2.1], [x, y + 1.5, z])
  k.sphere(look, 0.95, [x, y + 1.6, z], [1, 1.2, 1], 12, 6, Math.PI / 2)
}
