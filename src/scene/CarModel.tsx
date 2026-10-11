import { useMemo } from 'react'
import {
  BoxGeometry, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, Euler, ExtrudeGeometry, Matrix4,
  MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, Shape as ThreeShape, SphereGeometry, TorusGeometry, Vector3,
  type Group,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { wheelTex } from './textures'
import { glowMats } from './dayNight'
import type { Body } from '../game/data'

type Shape = {
  len: number; wid: number
  body: number // lower body height
  lift: number // ground clearance
  cabinLen: number; cabinH: number; cabinZ: number
  taper: number // how much the cabin roof narrows (0 = box)
  hood: number // hood bulge height
  wheel: number
  spoiler?: boolean; bed?: boolean; scoop?: boolean
  round?: boolean // domed cabin and soft body, like a bubble car
  open?: boolean // no roof: windshield and seats only
  rollbar?: boolean
  fins?: boolean // fifties tail fins
  wood?: boolean // wood side panels
  wing?: boolean // tall rally wing
  drop: number // how far the hood sits below the rear deck
  nose: number // how far the nose falls away from the hood
}

const SHAPES: Record<Body, Shape> = {
  compact: { len: 0.95, wid: 0.64, body: 0.27, lift: 0.1, cabinLen: 0.58, cabinH: 0.28, cabinZ: -0.06, taper: 0.72, hood: 0, wheel: 0.15, drop: 0.06, nose: 0.05 },
  sedan: { len: 1.22, wid: 0.66, body: 0.24, lift: 0.1, cabinLen: 0.62, cabinH: 0.25, cabinZ: -0.06, taper: 0.74, hood: 0, wheel: 0.15, drop: 0.05, nose: 0.05 },
  sports: { len: 1.22, wid: 0.7, body: 0.19, lift: 0.08, cabinLen: 0.52, cabinH: 0.18, cabinZ: -0.12, taper: 0.64, hood: 0.03, wheel: 0.15, drop: 0.04, nose: 0.06, spoiler: true },
  muscle: { len: 1.32, wid: 0.7, body: 0.25, lift: 0.1, cabinLen: 0.52, cabinH: 0.21, cabinZ: -0.16, taper: 0.76, hood: 0.05, wheel: 0.16, drop: 0.02, nose: 0.05, scoop: true },
  truck: { len: 1.38, wid: 0.74, body: 0.32, lift: 0.18, cabinLen: 0.5, cabinH: 0.31, cabinZ: 0.2, taper: 0.88, hood: 0, wheel: 0.2, drop: 0.03, nose: 0.06, bed: true },
  super: { len: 1.28, wid: 0.76, body: 0.16, lift: 0.07, cabinLen: 0.5, cabinH: 0.16, cabinZ: -0.04, taper: 0.56, hood: 0.02, wheel: 0.15, drop: 0.03, nose: 0.07, spoiler: true, scoop: true },
  bubble: { len: 0.98, wid: 0.66, body: 0.28, lift: 0.11, cabinLen: 0.6, cabinH: 0.22, cabinZ: -0.04, taper: 0.6, hood: 0, wheel: 0.15, drop: 0.08, nose: 0.06, round: true },
  wagon: { len: 1.36, wid: 0.68, body: 0.25, lift: 0.1, cabinLen: 0.9, cabinH: 0.25, cabinZ: -0.16, taper: 0.9, hood: 0, wheel: 0.15, drop: 0.05, nose: 0.05, wood: true },
  wedge: { len: 1.3, wid: 0.78, body: 0.14, lift: 0.07, cabinLen: 0.56, cabinH: 0.15, cabinZ: 0.02, taper: 0.42, hood: 0, wheel: 0.15, drop: 0.02, nose: 0.08, spoiler: true },
  roadster: { len: 1.08, wid: 0.66, body: 0.2, lift: 0.08, cabinLen: 0.42, cabinH: 0.16, cabinZ: -0.12, taper: 0.7, hood: 0.02, wheel: 0.14, drop: 0.02, nose: 0.06, open: true },
  rally: { len: 1.2, wid: 0.68, body: 0.24, lift: 0.11, cabinLen: 0.6, cabinH: 0.24, cabinZ: -0.06, taper: 0.74, hood: 0.02, wheel: 0.16, drop: 0.05, nose: 0.05, scoop: true, wing: true },
  classic: { len: 1.48, wid: 0.72, body: 0.25, lift: 0.1, cabinLen: 0.56, cabinH: 0.22, cabinZ: -0.08, taper: 0.8, hood: 0, wheel: 0.15, drop: 0.02, nose: 0.04, fins: true },
  offroad: { len: 0.96, wid: 0.7, body: 0.16, lift: 0.2, cabinLen: 0.4, cabinH: 0.2, cabinZ: -0.1, taper: 1, hood: 0, wheel: 0.21, drop: 0.0, nose: 0.03, open: true, rollbar: true },
  coupe: { len: 1.26, wid: 0.72, body: 0.21, lift: 0.08, cabinLen: 0.5, cabinH: 0.2, cabinZ: -0.16, taper: 0.62, hood: 0.03, wheel: 0.16, drop: 0.03, nose: 0.06 },
}

// Side profile of the lower body: a high rear deck, a hood that drops toward
// the nose, and rounded corners. u runs along the car (+ is the front).
function bodyProfile(s: Shape, b: number) {
  const L = s.len / 2 - b
  const bot = s.lift + 0.03
  const deck = s.lift + s.body - b
  const hood = deck - s.drop
  const nose = Math.max(bot + 0.07, hood - s.nose)
  const r = Math.min(0.06, s.body * 0.3)
  const sh = new ThreeShape()
  sh.moveTo(-L + r, bot)
  sh.lineTo(L - r * 0.6, bot)
  sh.quadraticCurveTo(L, bot, L, bot + r)
  sh.lineTo(L, nose)
  sh.quadraticCurveTo(L, hood, L - s.len * 0.12, hood)
  // Hood runs back to the base of the windshield, then steps up to the deck.
  const cowl = Math.min(s.cabinZ + s.cabinLen / 2, L - s.len * 0.12 - 0.06)
  sh.lineTo(cowl + 0.04, hood)
  sh.quadraticCurveTo(cowl, hood, cowl - 0.04, deck)
  sh.lineTo(-L + r, deck)
  sh.quadraticCurveTo(-L, deck, -L, deck - r)
  sh.lineTo(-L, bot + r)
  sh.quadraticCurveTo(-L, bot, -L + r, bot)
  return { sh, hood: hood + b, deck: deck + b }
}

// Greenhouse profile: raked windshield, roof and rear window with soft corners.
function cabinProfile(s: Shape, base: number, b: number) {
  const front = s.cabinZ + s.cabinLen / 2 - b
  const rear = s.cabinZ - s.cabinLen / 2 + b
  const slack = s.cabinLen * (1 - s.taper)
  const roofF = front - slack * 0.72
  const roofR = rear + slack * 0.28
  const roof = base + s.cabinH - b
  const r = Math.min(0.05, s.cabinH * 0.35)
  const sh = new ThreeShape()
  sh.moveTo(rear, base - 0.02)
  sh.lineTo(front, base - 0.02)
  sh.lineTo(roofF + r * 0.5, roof - r * 0.4)
  sh.quadraticCurveTo(roofF, roof, roofF - r, roof)
  sh.lineTo(roofR + r, roof)
  sh.quadraticCurveTo(roofR, roof, roofR - r * 0.3, roof - r * 0.6)
  sh.lineTo(rear, base - 0.02)
  return { sh, front: front + b, rear: rear + b, roofF, roofR, roof: roof + b }
}

// Extrudes a side profile across the car's width with bevelled (rounded) edges.
function extrude(sh: ThreeShape, width: number, b: number) {
  const g = new ExtrudeGeometry(sh, { depth: Math.max(0.01, width - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 })
  // Profile x is along the car; turn it so it faces +z and centre it across the width.
  g.translate(0, 0, -(width - 2 * b) / 2)
  g.rotateY(-Math.PI / 2)
  g.computeVertexNormals()
  return g
}

// Footprint of a body (before any scaling), for keeping town cars apart.
export const carSize = (body: Body) => ({ len: SHAPES[body].len, wid: SHAPES[body].wid })

// Wheel radius and the distance between front and rear axles, for steering and rolling.
export const wheelRig = (body: Body): WheelRig => ({ steer: [], spin: [], radius: SHAPES[body].wheel, base: SHAPES[body].len * 0.66 })

// Every part of a car that shares a look is merged into one mesh, so a car
// costs about a dozen draws however much detail it has (town traffic can show
// thirty at once, and phones pay for every draw).
type Part = 'paint' | 'dark' | 'black' | 'chrome' | 'glass' | 'screen' | 'seat' | 'wood' | 'lamp' | 'tail' | 'amber' | 'stripe'
type V3 = [number, number, number]

class Kit {
  parts = new Map<Part, BufferGeometry[]>()
  add(part: Part, geo: BufferGeometry, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) {
    const m = new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(...r)), new Vector3(...s))
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m)
    geo.dispose()
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n)
    g.clearGroups()
    const list = this.parts.get(part) ?? []
    list.push(g)
    this.parts.set(part, list)
  }
  build() {
    const out: Partial<Record<Part, BufferGeometry>> = {}
    for (const [k, list] of this.parts) {
      out[k] = list.length === 1 ? list[0] : mergeGeometries(list)!
      if (list.length > 1) list.forEach((g) => g.dispose())
    }
    return out
  }
}

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
const plane = (w: number, h: number) => new PlaneGeometry(w, h)
const disc = (r: number, seg = 16) => new CircleGeometry(r, seg)
const cyl = (rt: number, rb: number, h: number, seg = 10) => new CylinderGeometry(rt, rb, h, seg)

const SLEEK: Body[] = ['super', 'wedge', 'bubble']
const ROUND_LAMPS: Body[] = ['bubble', 'classic', 'offroad', 'compact', 'truck']
const BIG_GRILLE: Body[] = ['muscle', 'truck', 'classic', 'wagon']
const LOW: Body[] = ['sports', 'super', 'wedge', 'coupe']
const RUGGED: Body[] = ['truck', 'offroad', 'rally']

type CarGeo = { parts: Partial<Record<Part, BufferGeometry>>; wheel: BufferGeometry }
const geoCache = new Map<Body, CarGeo>()

function carGeo(body: Body): CarGeo {
  const hit = geoCache.get(body)
  if (hit) return hit
  const s = SHAPES[body]
  const k = new Kit()
  const b = s.round ? Math.min(0.1, s.body * 0.4) : 0.035
  const lower = bodyProfile(s, b)
  const top = lower.deck
  const hoodY = lower.hood
  const wz = s.len * 0.33
  const cowl = s.cabinZ + s.cabinLen / 2
  const hoodFront = s.len / 2 - s.len * 0.1
  const front = s.len / 2
  const lightY = s.lift + (Math.max(s.lift + 0.1, hoodY - s.nose) - s.lift) * 0.7
  const closed = !s.open && !s.round
  let roofY = top
  let roofLen = 0
  let roofZ = s.cabinZ

  k.add('paint', extrude(lower.sh, s.wid, b))
  // Dark rocker panel along the bottom.
  k.add('dark', rbox(s.wid * 1.01, 0.06, s.len * 0.8, 0.025), [0, s.lift + 0.04, 0])
  // Wheel arches: dark wells behind each tyre so the wheels sit in the body.
  for (const z of [wz, -wz]) for (const sd of [-1, 1]) {
    k.add('black', new CircleGeometry(s.wheel * 1.18, 18, 0, Math.PI), [sd * (s.wid / 2 + 0.003), s.wheel, z], [0, (sd * Math.PI) / 2, 0])
    // Rugged bodies get chunky black fender flares round the arches.
    if (RUGGED.includes(body)) k.add('black', new TorusGeometry(s.wheel * 1.2, 0.03, 5, 14, Math.PI), [sd * (s.wid / 2 + 0.01), s.wheel, z], [0, (sd * Math.PI) / 2, 0], [1, 1, 1.6])
  }

  if (s.round) {
    // Domed cabin: glass all round under a painted roof cap.
    const p: V3 = [0, top - 0.02, s.cabinZ]
    const sc: V3 = [s.wid * 0.46, s.cabinH * 1.25, s.cabinLen * 0.58]
    k.add('glass', new SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), p, [0, 0, 0], sc)
    k.add('paint', new SphereGeometry(1, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.36), p, [0, 0, 0], [sc[0] * 1.02, sc[1] * 1.02, sc[2] * 1.02])
    // Chrome strip round the dome's base and a little rear engine grille.
    k.add('chrome', new TorusGeometry(1, 0.03, 4, 24), [0, top - 0.015, s.cabinZ], [Math.PI / 2, 0, 0], [sc[0] * 1.01, sc[2] * 1.01, 1])
    for (const y of [0, 0.03, 0.06]) k.add('black', box(0.2, 0.012, 0.01), [0, top - 0.09 + y, -front - 0.002])
  } else if (s.open) {
    // Open top: raked windshield in a frame, seats with headrests, a dash and a wheel.
    const base: V3 = [0, top, s.cabinZ]
    const ws: V3 = [0, top + s.cabinH * 0.45, s.cabinZ + s.cabinLen * 0.5]
    k.add('screen', box(s.wid * 0.86, s.cabinH * 0.9, 0.02), ws, [-0.5, 0, 0])
    k.add('black', box(s.wid * 0.9, 0.025, 0.03), [0, ws[1] + Math.cos(0.5) * s.cabinH * 0.45, ws[2] - Math.sin(0.5) * s.cabinH * 0.45], [-0.5, 0, 0])
    for (const sd of [-1, 1]) {
      k.add('seat', rbox(s.wid * 0.28, 0.16, 0.16, 0.04), [sd * s.wid * 0.2, base[1] + 0.06, base[2]])
      k.add('seat', rbox(s.wid * 0.26, 0.2, 0.05, 0.02), [sd * s.wid * 0.2, base[1] + 0.14, base[2] - 0.08], [-0.15, 0, 0])
      k.add('seat', rbox(s.wid * 0.14, 0.07, 0.05, 0.02), [sd * s.wid * 0.2, base[1] + 0.27, base[2] - 0.1])
    }
    k.add('black', rbox(s.wid * 0.78, 0.06, 0.08, 0.02), [0, top + 0.03, s.cabinZ + s.cabinLen * 0.38])
    k.add('black', new TorusGeometry(0.055, 0.012, 5, 14), [-s.wid * 0.2, top + 0.11, s.cabinZ + s.cabinLen * 0.28], [-0.9, 0, 0])
    if (s.rollbar) {
      k.add('chrome', new TorusGeometry(s.wid * 0.3, 0.025, 6, 16, Math.PI), [0, top + 0.1, s.cabinZ - 0.18])
      // Light bar across the roll bar with four spot lamps.
      k.add('black', box(s.wid * 0.5, 0.05, 0.05), [0, top + 0.1 + s.wid * 0.3, s.cabinZ - 0.18])
      for (const x of [-0.15, -0.05, 0.05, 0.15]) k.add('lamp', disc(0.02, 10), [x * s.wid * 2, top + 0.1 + s.wid * 0.3, s.cabinZ - 0.154])
    }
  } else {
    const cb = 0.025
    const c = cabinProfile(s, lower.deck - 0.01, cb)
    k.add('glass', extrude(c.sh, s.wid * 0.8, cb))
    // Painted roof panel sitting on the glass, slightly wider so it reads as a roof line.
    const rs = new ThreeShape()
    const t = 0.03
    rs.moveTo(c.roofR, c.roof - t)
    rs.lineTo(c.roofF, c.roof - t)
    rs.lineTo(c.roofF - 0.01, c.roof)
    rs.lineTo(c.roofR + 0.01, c.roof)
    rs.lineTo(c.roofR, c.roof - t)
    k.add('paint', extrude(rs, s.wid * 0.84, 0.015))
    roofY = c.roof
    roofLen = c.roofF - c.roofR
    roofZ = (c.roofF + c.roofR) / 2
    const ph = roofY - top
    for (const sd of [-1, 1]) {
      // Door pillar between the side windows, and black window trim along the belt line.
      k.add('paint', box(0.012, ph, 0.035), [sd * s.wid * 0.405, (top + roofY) / 2, roofZ - roofLen * 0.05])
      k.add('black', box(0.012, 0.02, s.cabinLen * 0.86), [sd * s.wid * 0.402, top + 0.008, s.cabinZ])
    }
    // Wipers resting at the base of the windshield.
    for (const x of [-0.12, 0.08]) k.add('black', box(0.16, 0.008, 0.012), [x * s.wid * 1.6, top + 0.01, c.front - 0.03], [0, 0.25, 0])
    // Third brake light on the rear edge of the roof.
    k.add('tail', plane(0.12, 0.014), [0, roofY - 0.012, c.roofR - 0.012], [0, Math.PI, 0])
    // Radio aerial on everyday cars, roof rails on the wagon.
    if (body === 'sedan' || body === 'compact' || body === 'classic') k.add('black', cyl(0.004, 0.006, 0.2, 4), [s.wid * 0.3, top + 0.1, -s.len / 2 + 0.12], [-0.3, 0, 0])
    if (body === 'wagon' || body === 'truck') {
      for (const sd of [-1, 1]) {
        k.add('chrome', box(0.02, 0.02, roofLen * 0.9), [sd * s.wid * 0.33, roofY + 0.02, roofZ])
        for (const z of [-0.4, 0.4]) k.add('chrome', box(0.02, 0.025, 0.02), [sd * s.wid * 0.33, roofY + 0.008, roofZ + z * roofLen * 0.9])
      }
    }
    // Amber cab marker lamps along the front of the truck roof.
    if (body === 'truck') for (const x of [-0.12, 0, 0.12]) k.add('amber', box(0.04, 0.02, 0.03), [x * s.wid, roofY + 0.005, c.roofF - 0.02])
  }

  if (s.wood) {
    for (const sd of [-1, 1]) {
      k.add('wood', plane(s.len * 0.8, s.body * 0.55), [sd * (s.wid / 2 + 0.004), s.lift + s.body * 0.55, -0.05], [0, (sd * Math.PI) / 2, 0])
      // Light wood frame round the panel.
      for (const y of [-1, 1]) k.add('chrome', box(0.006, 0.012, s.len * 0.8), [sd * (s.wid / 2 + 0.007), s.lift + s.body * 0.55 + (y * s.body * 0.55) / 2, -0.05])
    }
  }
  if (s.fins) {
    for (const sd of [-1, 1]) {
      k.add('paint', box(0.05, 0.1, s.len * 0.26), [sd * s.wid * 0.42, top + 0.04, -s.len * 0.38], [-0.25, 0, 0])
      // Chrome side spear and round fin lamps, fifties style.
      k.add('chrome', box(0.008, 0.016, s.len * 0.62), [sd * (s.wid / 2 + 0.004), s.lift + s.body * 0.6, s.len * 0.06])
      k.add('tail', disc(0.03, 12), [sd * s.wid * 0.42, top + 0.07, -s.len / 2 - 0.01], [0, Math.PI, 0])
    }
    k.add('chrome', new SphereGeometry(0.025, 8, 6), [0, hoodY + 0.02, hoodFront - 0.02], [0, 0, 0], [0.6, 1, 2])
  }
  if (s.wing) {
    for (const sd of [-1, 1]) k.add('black', box(0.03, 0.2, 0.04), [sd * s.wid * 0.3, top + 0.1, -s.len / 2 + 0.08])
    k.add('paint', box(s.wid * 0.9, 0.03, 0.15), [0, top + 0.21, -s.len / 2 + 0.08])
    for (const sd of [-1, 1]) k.add('black', box(0.012, 0.08, 0.17), [sd * s.wid * 0.45, top + 0.2, -s.len / 2 + 0.08])
  }
  if (s.hood > 0) k.add('paint', rbox(s.wid * 0.5, s.hood * 2, s.len * 0.26, s.hood * 0.9), [0, hoodY, s.len * 0.3])
  if (s.scoop) {
    k.add('black', rbox(0.16, 0.07, 0.16, 0.025), [0, hoodY + s.hood + 0.02, s.len * 0.27])
    k.add('black', box(0.12, 0.03, 0.01), [0, hoodY + s.hood + 0.03, s.len * 0.27 + 0.082])
  }
  if (s.bed) {
    k.add('black', box(s.wid * 0.84, 0.03, s.len * 0.4), [0, top + 0.01, -s.len * 0.27])
    // Bed rails and a tailgate handle.
    for (const sd of [-1, 1]) k.add('chrome', box(0.025, 0.02, s.len * 0.4), [sd * s.wid * 0.45, top + 0.01, -s.len * 0.27])
    k.add('chrome', box(0.12, 0.02, 0.01), [0, top - 0.05, -s.len / 2 - 0.004])
  }
  if (s.spoiler) {
    for (const sd of [-1, 1]) k.add('black', box(0.03, 0.12, 0.04), [sd * s.wid * 0.32, top + 0.06, -s.len / 2 + 0.07])
    k.add(body === 'super' ? 'black' : 'paint', box(s.wid * 0.95, 0.03, 0.14), [0, top + 0.13, -s.len / 2 + 0.07])
  }
  // Racing stripes along the hood, the rear deck and the roof (drawn only when painted on).
  for (const x of [-0.07, 0.07]) {
    k.add('stripe', box(0.07, 0.006, hoodFront - cowl), [x, hoodY + 0.003, (hoodFront + cowl) / 2])
    k.add('stripe', box(0.07, 0.006, cowl + s.len / 2 - 0.05), [x, top + 0.003, (cowl - s.len / 2) / 2])
    if (roofLen > 0) k.add('stripe', box(0.07, 0.006, roofLen * 0.95), [x, roofY + 0.003, roofZ])
  }

  // Bumpers, with a black lower lip on the front.
  for (const sd of [1, -1]) k.add('chrome', rbox(s.wid * 0.96, 0.07, 0.06, 0.028), [0, s.lift + 0.07, sd * (s.len / 2 - 0.005)])
  k.add('black', box(s.wid * 0.8, 0.02, 0.05), [0, s.lift + 0.03, s.len / 2 - 0.02])
  // Front: headlights in dark bezels either side of a grille (or a low intake on sleek cars), turn signals and a plate.
  const z = front + 0.004
  const roundLamps = ROUND_LAMPS.includes(body)
  const bigGrille = BIG_GRILLE.includes(body)
  const sleek = SLEEK.includes(body)
  for (const sd of [-1, 1]) {
    const x = sd * s.wid * 0.3
    if (roundLamps) {
      k.add('black', disc(0.056, 16), [x, lightY, z - 0.002])
      k.add('lamp', disc(0.045, 16), [x, lightY, z])
    } else {
      k.add('black', plane(0.16, 0.055), [x, lightY, z - 0.002], [0, 0, sd * 0.12])
      k.add('lamp', plane(0.14, 0.04), [x, lightY, z], [0, 0, sd * 0.12])
    }
    // Amber turn signal at the outer corner, and a side marker behind it.
    k.add('amber', plane(0.045, 0.022), [sd * s.wid * 0.43, lightY - 0.045, z])
    k.add('amber', plane(0.04, 0.018), [sd * (s.wid / 2 + 0.004), lightY - 0.02, front - 0.09], [0, (sd * Math.PI) / 2, 0])
    // Fog lamps low on the bumper of off-roaders and rally cars.
    if (RUGGED.includes(body)) k.add('lamp', disc(0.025, 10), [sd * s.wid * 0.3, s.lift + 0.07, front + 0.026])
  }
  if (!sleek) {
    k.add(bigGrille ? 'chrome' : 'black', rbox(s.wid * (bigGrille ? 0.42 : 0.3), bigGrille ? 0.07 : 0.045, 0.01, 0.004), [0, lightY - 0.005, z])
    // Grille slats.
    const n = bigGrille ? 3 : 2
    for (let i = 0; i < n; i++) {
      const gh = bigGrille ? 0.07 : 0.045
      k.add(bigGrille ? 'black' : 'dark', box(s.wid * (bigGrille ? 0.38 : 0.27), 0.006, 0.006), [0, lightY - 0.005 - gh / 2 + (gh * (i + 1)) / (n + 1), z + 0.005])
    }
  }
  if (sleek && body !== 'bubble') {
    k.add('black', plane(s.wid * 0.6, 0.035), [0, s.lift + 0.12, z])
    // Side air intakes ahead of the rear wheels.
    for (const sd of [-1, 1]) k.add('black', plane(0.14, 0.05), [sd * (s.wid / 2 + 0.004), s.lift + s.body * 0.55, -wz + s.wheel * 1.3], [0, (sd * Math.PI) / 2, 0])
  }
  k.add('lamp', plane(0.11, 0.04), [0, s.lift + 0.12, s.len / 2 + 0.035])
  // Rear: wide tail lights with reversing lamps, a plate, and exhausts.
  for (const sd of [-1, 1]) {
    const ty = s.lift + (top - s.lift) * 0.68
    k.add('black', plane(0.17, 0.06), [sd * s.wid * 0.3, ty, -front - 0.002], [0, Math.PI, 0])
    k.add('tail', plane(0.15, 0.045), [sd * s.wid * 0.3, ty, -front - 0.004], [0, Math.PI, 0])
    k.add('lamp', plane(0.03, 0.03), [sd * s.wid * 0.19, ty, -front - 0.005], [0, Math.PI, 0])
  }
  k.add('lamp', plane(0.11, 0.045), [0, s.lift + 0.13, -s.len / 2 - 0.035], [0, Math.PI, 0])
  const pipes = LOW.includes(body) || body === 'muscle' ? [-1, 1] : body === 'offroad' ? [] : [-1]
  for (const sd of pipes) {
    k.add('chrome', cyl(0.024, 0.024, 0.08, 10), [sd * s.wid * 0.3, s.lift + 0.035, -front - 0.02], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.016, 10), [sd * s.wid * 0.3, s.lift + 0.035, -front - 0.061], [0, Math.PI, 0])
  }
  // Low cars get a black diffuser under the rear bumper.
  if (LOW.includes(body)) {
    k.add('black', box(s.wid * 0.7, 0.03, 0.06), [0, s.lift + 0.02, -front + 0.02])
    for (const x of [-0.15, 0, 0.15]) k.add('black', box(0.01, 0.04, 0.06), [x * s.wid, s.lift + 0.02, -front + 0.02])
  }
  // Mud flaps behind each wheel on rugged bodies.
  if (RUGGED.includes(body)) for (const zz of [wz, -wz]) for (const sd of [-1, 1]) k.add('black', box(0.12, 0.1, 0.012), [sd * (s.wid / 2 - 0.07), s.lift + 0.02, zz - s.wheel * 1.15])
  // Fuel filler on the right rear quarter.
  if (!s.open) k.add('dark', disc(0.025, 12), [s.wid / 2 + 0.004, top - 0.06, -wz + 0.06], [0, Math.PI / 2, 0])
  // Door seams, handles and mirrors on closed cars.
  if (closed) {
    for (const sd of [-1, 1]) {
      k.add('dark', plane(0.008, top - s.lift - 0.11), [sd * (s.wid / 2 + 0.003), (s.lift + 0.07 + top) / 2, s.cabinZ + s.cabinLen * 0.08], [0, (sd * Math.PI) / 2, 0])
      k.add('dark', plane(0.008, top - s.lift - 0.11), [sd * (s.wid / 2 + 0.003), (s.lift + 0.07 + top) / 2, s.cabinZ + s.cabinLen * 0.5], [0, (sd * Math.PI) / 2, 0])
      k.add('chrome', box(0.01, 0.012, 0.05), [sd * (s.wid / 2 + 0.004), top - 0.05, s.cabinZ + s.cabinLen * 0.08 - 0.06])
      k.add('paint', rbox(0.06, 0.04, 0.03, 0.012), [sd * (s.wid * 0.4 + 0.03), top + 0.05, cowl - 0.04])
      k.add('black', box(0.03, 0.012, 0.012), [sd * (s.wid * 0.4 - 0.005), top + 0.035, cowl - 0.04])
      k.add('glass', plane(0.045, 0.028), [sd * (s.wid * 0.4 + 0.03), top + 0.05, cowl - 0.056], [0, Math.PI, 0])
    }
  }

  // Wheel: one mesh per wheel. The tread and the spoked rim share one texture,
  // so tyre and rim are a single draw.
  const wheel = new CylinderGeometry(s.wheel, s.wheel, 0.14, 18, 1)
  const uv = wheel.getAttribute('uv')
  const side = (18 + 1) * 2
  for (let i = 0; i < uv.count; i++) uv.setX(i, i < side ? 0.5 + uv.getX(i) * 0.5 : uv.getX(i) * 0.5)
  wheel.rotateZ(Math.PI / 2)

  const out = { parts: k.build(), wheel }
  geoCache.set(body, out)
  return out
}

// Materials every car shares; only the paint differs from car to car.
const MAT = {
  black: new MeshStandardMaterial({ color: '#161616', roughness: 0.8, side: DoubleSide }),
  chrome: new MeshStandardMaterial({ color: '#cfd8dc', metalness: 0.7, roughness: 0.25 }),
  glass: new MeshStandardMaterial({ color: '#4f86b0', metalness: 0.55, roughness: 0.06 }),
  screen: new MeshStandardMaterial({ color: '#9fd3f2', transparent: true, opacity: 0.6, metalness: 0.4, roughness: 0.05 }),
  seat: new MeshStandardMaterial({ color: '#3e2723', roughness: 0.7 }),
  wood: new MeshStandardMaterial({ color: '#8d5a3b', roughness: 0.8 }),
  lamp: new MeshBasicMaterial({ color: '#fffde7' }),
  tail: new MeshBasicMaterial({ color: '#ff1744' }),
  amber: new MeshBasicMaterial({ color: '#ffa000' }),
}
let wheelMat: MeshStandardMaterial | null = null
const wheelMaterial = () => (wheelMat ??= new MeshStandardMaterial({ map: wheelTex(), metalness: 0.35, roughness: 0.6 }))

// Handles on a car's wheels so a driving car can steer the front pair and roll all four.
export type WheelRig = { steer: (Group | null)[]; spin: (Group | null)[]; radius: number; base: number }

// Toy-style car: bevelled extruded body and cabin so no edge is a hard box corner. Faces +z.
export function CarModel({ body, color, highlight, stripe, beams, rusty, rig }: { body: Body; color: string; highlight?: boolean; stripe?: string | null; beams?: boolean; rusty?: boolean; rig?: WheelRig }) {
  const s = SHAPES[body]
  const g = carGeo(body)
  const p = g.parts
  // Rusty finds keep a hint of their paint under brown, matte rust.
  const tint = useMemo(() => (rusty ? '#' + new Color(color).lerp(new Color('#8a5a3c'), 0.72).getHexString() : color), [color, rusty])
  const dark = useMemo(() => '#' + new Color(tint).multiplyScalar(0.6).getHexString(), [tint])
  const wz = s.len * 0.33
  const wx = s.wid / 2 - 0.02
  const shared = (['black', 'chrome', 'glass', 'screen', 'seat', 'wood', 'lamp', 'tail', 'amber'] as const).filter((k) => p[k])
  return (
    <group>
      <mesh geometry={p.paint} castShadow>
        <meshStandardMaterial color={tint} metalness={rusty ? 0.1 : 0.4} roughness={rusty ? 0.95 : 0.3} emissive={highlight ? '#ffffff' : '#000000'} emissiveIntensity={highlight ? 0.25 : 0} />
      </mesh>
      {p.dark && (
        <mesh geometry={p.dark}>
          <meshStandardMaterial color={dark} />
        </mesh>
      )}
      {stripe && p.stripe && (
        <mesh geometry={p.stripe}>
          <meshStandardMaterial color={stripe} />
        </mesh>
      )}
      {shared.map((k) => <mesh key={k} geometry={p[k]} material={MAT[k]} castShadow={k === 'glass'} />)}
      {/* Headlight beams on the road, visible after dark. */}
      {beams && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, s.len / 2 + 0.55]} renderOrder={2}>
          <planeGeometry args={[s.wid * 1.5, 1.3]} />
          <primitive object={glowMats.beam} attach="material" dispose={null} />
        </mesh>
      )}
      {/* Chunky toy wheels with spoked rims. */}
      {[[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]].map(([x, z], i) => (
        <group key={i} position={[x, s.wheel, z]} ref={rig && i < 2 ? (o) => void (rig.steer[i] = o) : undefined}>
          <group ref={rig ? (o) => void (rig.spin[i] = o) : undefined}>
            <mesh geometry={g.wheel} material={wheelMaterial()} />
          </group>
        </group>
      ))}
    </group>
  )
}
