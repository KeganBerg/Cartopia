import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { chromeEnv } from './chromeEnv'
import {
  BoxGeometry, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, Euler, ExtrudeGeometry, Matrix4,
  MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, Shape as ThreeShape, SphereGeometry, TorusGeometry, Vector3,
  type Group,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { wheelTex } from './textures'
import { glowMats } from './dayNight'
import { FINISH_LOOK, fittedMods, isBike, skinNumber, type Body, type Finish, type ModSlot } from '../game/data'
import { tickSkins, withSkin } from './skins'
import { CarMods, RIM_LOOK, carbon, chrome as modChrome, glass as modGlass, modGeo, modIds } from './CarMods'
import { carBody, wheelPool, type WheelSlot } from './carBatch'
import { bake, finishOf, type Finish as Look } from './bake'
import { carStyle, hasTrim, trimBike, trimCar, type CarStyle } from './carTrim'
import { brakeGeo, wheelGeo, type RimStyle } from './carWheels'

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
  quad?: boolean // four round headlights, the inner left one an air intake
  flares?: boolean // bolt-on wide arches over each tyre
  ducktail?: boolean // small kicked-up lip on the trunk
  lightbar?: boolean // one full-width tail light
  tracks?: boolean // tank tracks looped round the wheels, armour skirts above
  armor?: boolean // visor slats, roof hatch, push bar and an exposed engine on the hood
  roofwing?: boolean // spoiler on the back edge of a hatchback's roof
  vee?: boolean // flat van nose with a big chrome V and round badge
  spare?: boolean // spare tyre hung on the tailgate
  frontbar?: boolean // one light strip across the nose instead of a grille
  ornament?: boolean // tall chrome grille with a hood ornament
  bus?: boolean // window posts down the sides, rub rails, stop arm and roof warning lamps
  plates?: boolean // armoured scout: wheels clear of the hull under faceted fenders, a raked prow, a roll hoop and a rear turret, no windshield
  dog?: boolean // shaggy fur tufts, floppy ears, eyes, nose, tongue and a tail
  track?: number // wheel distance from the centre line, when the wheels stand clear of the body
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
  widebody: { len: 1.36, wid: 0.76, body: 0.26, lift: 0.08, cabinLen: 0.5, cabinH: 0.2, cabinZ: -0.17, taper: 0.7, hood: 0.05, wheel: 0.17, drop: 0.03, nose: 0.05, scoop: true, quad: true, flares: true, ducktail: true, lightbar: true },
  tank: { len: 1.44, wid: 0.84, body: 0.3, lift: 0.17, cabinLen: 0.48, cabinH: 0.19, cabinZ: -0.14, taper: 0.5, hood: 0, wheel: 0.19, drop: 0.02, nose: 0.14, tracks: true, armor: true },
  hatch: { len: 1.06, wid: 0.68, body: 0.25, lift: 0.09, cabinLen: 0.66, cabinH: 0.25, cabinZ: -0.13, taper: 0.84, hood: 0.02, wheel: 0.15, drop: 0.05, nose: 0.05, roofwing: true },
  van: { len: 1.28, wid: 0.72, body: 0.27, lift: 0.12, cabinLen: 1.08, cabinH: 0.33, cabinZ: -0.06, taper: 0.97, hood: 0, wheel: 0.15, drop: 0, nose: 0.02, vee: true },
  suv: { len: 1.18, wid: 0.74, body: 0.3, lift: 0.17, cabinLen: 0.7, cabinH: 0.27, cabinZ: -0.14, taper: 0.95, hood: 0, wheel: 0.19, drop: 0.03, nose: 0.03, spare: true },
  ev: { len: 1.26, wid: 0.72, body: 0.21, lift: 0.08, cabinLen: 0.74, cabinH: 0.22, cabinZ: -0.08, taper: 0.6, hood: 0, wheel: 0.16, drop: 0.03, nose: 0.07, lightbar: true, frontbar: true },
  luxury: { len: 1.5, wid: 0.74, body: 0.28, lift: 0.1, cabinLen: 0.62, cabinH: 0.25, cabinZ: -0.18, taper: 0.84, hood: 0, wheel: 0.17, drop: 0.02, nose: 0.02, ornament: true },
  bus: { len: 1.8, wid: 0.8, body: 0.34, lift: 0.14, cabinLen: 1.46, cabinH: 0.32, cabinZ: -0.13, taper: 0.99, hood: 0, wheel: 0.18, drop: 0.1, nose: 0.06, bus: true },
  tusker: { len: 1.42, wid: 0.6, body: 0.2, lift: 0.2, cabinLen: 0.44, cabinH: 0.2, cabinZ: -0.02, taper: 1, hood: 0, wheel: 0.22, drop: 0.02, nose: 0.1, open: true, plates: true, track: 0.42 },
  dogvan: { len: 1.3, wid: 0.74, body: 0.28, lift: 0.12, cabinLen: 1.0, cabinH: 0.33, cabinZ: -0.1, taper: 0.97, hood: 0, wheel: 0.15, drop: 0.02, nose: 0.03, dog: true },
  // Open-wheel racer: drawn by formulaGeo; wid is the full width over the wheels.
  formula: { len: 1.4, wid: 0.84, body: 0.12, lift: 0.05, cabinLen: 0.3, cabinH: 0.1, cabinZ: -0.1, taper: 1, hood: 0, wheel: 0.15, drop: 0, nose: 0.06, track: 0.33 },
  // Motorcycles: only the size, wheel and ride height are used (see bikeGeo).
  scooter: { len: 0.8, wid: 0.22, body: 0.16, lift: 0.1, cabinLen: 0, cabinH: 0, cabinZ: 0, taper: 1, hood: 0, wheel: 0.12, drop: 0, nose: 0 },
  chopper: { len: 1.04, wid: 0.22, body: 0.16, lift: 0.12, cabinLen: 0, cabinH: 0, cabinZ: 0, taper: 1, hood: 0, wheel: 0.16, drop: 0, nose: 0 },
  sportbike: { len: 0.94, wid: 0.22, body: 0.18, lift: 0.12, cabinLen: 0, cabinH: 0, cabinZ: 0, taper: 1, hood: 0, wheel: 0.16, drop: 0, nose: 0 },
}

// Motorcycles. head = steering head [y, z]; seat = seat top [y, z].
type BikeBody = 'scooter' | 'chopper' | 'sportbike'
const BIKE: Record<BikeBody, { wz: number; head: [number, number]; seat: [number, number]; bars: number; lean: number }> = {
  scooter: { wz: 0.27, head: [0.5, 0.25], seat: [0.4, -0.1], bars: 0.07, lean: 0.05 },
  chopper: { wz: 0.38, head: [0.5, 0.26], seat: [0.34, -0.14], bars: 0.2, lean: -0.08 },
  sportbike: { wz: 0.31, head: [0.5, 0.22], seat: [0.44, -0.12], bars: -0.02, lean: 0.22 },
}

// A body this build doesn't know (another player's newer car) draws as a sedan.
const shapeOf = (body: Body) => SHAPES[body] ?? SHAPES.sedan

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
  return { sh, hood: hood + b, deck: deck + b, nose, hoodRaw: hood, L }
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
export const carSize = (body: Body) => ({ len: shapeOf(body).len, wid: shapeOf(body).wid })


// Wheel radius and the distance between front and rear axles, for steering and rolling.
export const wheelRig = (body: Body): WheelRig => ({ steer: [], spin: [], radius: shapeOf(body).wheel, base: isBike(body) ? BIKE[body as BikeBody].wz * 2 : shapeOf(body).len * 0.66 })

// Every part of a car that shares a look is merged into one mesh, so a car
// costs about a dozen draws however much detail it has (town traffic can show
// thirty at once, and phones pay for every draw).
// 'cabin' (seats), 'dash' (dark trim inside, brake rotors), 'display' (the dash screen) and 'caliper' are only drawn
// on cars shown whole: town traffic has solid glass and pooled wheels that hide them.
export type Part = 'paint' | 'dark' | 'black' | 'chrome' | 'glass' | 'screen' | 'seat' | 'wood' | 'lamp' | 'tail' | 'amber' | 'stripe' | 'cabin' | 'dash' | 'caliper' | 'display'
type V3 = [number, number, number]

export class Kit {
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
// One bevel segment: for small parts seen through glass.
const rbox1 = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
const plane = (w: number, h: number) => new PlaneGeometry(w, h)
const disc = (r: number, seg = 16) => new CircleGeometry(r, seg)
const cyl = (rt: number, rb: number, h: number, seg = 10) => new CylinderGeometry(rt, rb, h, seg)

const SLEEK: Body[] = ['super', 'wedge', 'bubble', 'ev']
const ROUND_LAMPS: Body[] = ['bubble', 'classic', 'offroad', 'compact', 'truck', 'van', 'suv', 'bus', 'dogvan', 'tusker']
const BIG_GRILLE: Body[] = ['muscle', 'truck', 'classic', 'wagon', 'luxury', 'bus']
const LOW: Body[] = ['sports', 'super', 'wedge', 'coupe', 'hatch']
const RUGGED: Body[] = ['truck', 'offroad', 'rally', 'suv']
const VINTAGE: Body[] = ['classic', 'wagon', 'bubble', 'luxury', 'van', 'dogvan', 'bus']
const FOUR_DOOR: Body[] = ['sedan', 'wagon', 'suv', 'luxury', 'ev', 'van', 'dogvan']

// Where bolt-on mods attach, fitted to each body's size and shape: wheel spots, the sides and
// ends of the body, where a spoiler mounts (the trunk, or the roof when the cabin runs to the
// back), the hood (or whatever stands in for it), and a scale for parts sized for a mid-size car.
export type ModFrame = {
  body: Body; len: number; wid: number; lift: number; wheel: number; wz: number; wx: number
  bodyW: number; side: number; front: number; rear: number; pipeY: number
  deck: number; deckZ: number; deckW: number; hoodTop: number; hoodZ: number; hs: number
}
export function carFrame(body: Body): ModFrame {
  const s = shapeOf(body)
  if (isBike(body)) {
    const b = BIKE[body as BikeBody]
    const r = s.wheel
    const [hy, hz] = b.head
    const [sy, sz] = b.seat
    const scooter = body === 'scooter'
    return {
      body, len: s.len, wid: s.wid, lift: r * 0.6, wheel: r, wz: b.wz, wx: 0, bodyW: 0.2, side: 0.1, front: b.wz + r, rear: -b.wz - r * 0.4, pipeY: r + 0.04,
      deck: sy + 0.05, deckZ: sz - 0.2, deckW: 0.24, hoodTop: scooter ? hy - 0.02 : (hy + sy) / 2 + 0.04, hoodZ: scooter ? hz - 0.02 : hz - 0.04, hs: 0.5,
    }
  }
  if (body === 'formula') {
    return {
      body, len: s.len, wid: s.wid, lift: s.lift, wheel: s.wheel, wz: s.len * 0.33, wx: s.track!, bodyW: 0.5, side: 0.25, front: s.len / 2, rear: -s.len / 2 + 0.05, pipeY: 0.24,
      deck: 0.27, deckZ: -s.len / 2 + 0.08, deckW: 0.56, hoodTop: 0.36, hoodZ: -0.17, hs: 0.55,
    }
  }
  const b = s.round ? Math.min(0.1, s.body * 0.4) : 0.035
  const p = bodyProfile(s, b)
  const cowl = Math.min(s.cabinZ + s.cabinLen / 2, s.len / 2 - s.len * 0.2)
  // A cabin that runs to the back leaves no trunk, so spoilers go on the roof.
  const roofMount = !s.open && s.cabinZ - s.cabinLen / 2 < -s.len / 2 + 0.16
  const c = cabinProfile(s, p.deck - 0.01, 0.025)
  return {
    body, len: s.len, wid: s.wid, lift: s.lift, wheel: s.wheel, wz: s.len * 0.33, wx: s.track ?? s.wid / 2 - 0.02,
    bodyW: s.wid, side: s.tracks ? s.wid / 2 + 0.08 : s.wid / 2, front: s.len / 2, rear: -s.len / 2, pipeY: s.lift + 0.06,
    deck: roofMount ? c.roof : p.deck, deckZ: roofMount ? c.roofR + 0.05 : -s.len / 2 + 0.08, deckW: roofMount ? s.wid * 0.84 : s.wid,
    hoodTop: p.hood + s.hood, hoodZ: (cowl + s.len / 2 - s.len * 0.1) / 2, hs: Math.min(1.15, s.wid / 0.7),
  }
}

type CarGeo = { parts: Partial<Record<Part, BufferGeometry>>; wheel: BufferGeometry }
const geoCache = new Map<string, CarGeo>()

// Open-wheel racer: needle nose, sidepods, airbox, halo, front and rear wings, wheels on arms.
function formulaGeo(key: string, fit: Partial<Record<ModSlot, string>>): CarGeo {
  const s = SHAPES.formula
  const k = new Kit()
  const wz = s.len * 0.33
  const tx = s.track!
  const nose = cyl(0.035, 0.075, 0.5, 12)
  k.add('paint', nose, [0, 0.14, 0.42], [Math.PI / 2, 0, 0], [1.4, 1, 0.8])
  k.add('paint', rbox(0.26, 0.14, 0.62, 0.05), [0, 0.16, 0])
  for (const sd of [-1, 1]) k.add('paint', rbox(0.15, 0.12, 0.42, 0.05), [sd * 0.17, 0.14, -0.08])
  k.add('paint', rbox(0.2, 0.15, 0.42, 0.06), [0, 0.19, -0.36])
  k.add('paint', rbox(0.1, 0.12, 0.14, 0.04), [0, 0.3, -0.17])
  k.add('black', disc(0.03, 10), [0, 0.32, -0.099])
  // Cockpit with the driver's helmet, and the halo hoop over it.
  k.add('black', rbox(0.16, 0.04, 0.24, 0.02), [0, 0.235, 0.06])
  k.add('chrome', new SphereGeometry(0.055, 12, 10), [0, 0.28, 0.02])
  k.add('black', box(0.08, 0.02, 0.01), [0, 0.29, 0.07])
  k.add('black', new TorusGeometry(0.1, 0.012, 5, 14, Math.PI), [0, 0.31, 0.03], [Math.PI / 2, 0, 0])
  k.add('black', box(0.02, 0.1, 0.02), [0, 0.26, 0.13], [-0.3, 0, 0])
  // Front wing with endplates, rear wing on a pillar.
  k.add('paint', box(s.wid * 0.74, 0.015, 0.12), [0, 0.05, s.len / 2 - 0.04])
  k.add('black', box(s.wid * 0.7, 0.012, 0.06), [0, 0.07, s.len / 2 - 0.08], [0.25, 0, 0])
  for (const sd of [-1, 1]) k.add('black', box(0.015, 0.07, 0.15), [sd * s.wid * 0.37, 0.07, s.len / 2 - 0.05])
  if (!fit.spoiler) {
    k.add('paint', box(0.52, 0.02, 0.13), [0, 0.42, -s.len / 2 + 0.07], [0.12, 0, 0])
    k.add('black', box(0.52, 0.015, 0.06), [0, 0.45, -s.len / 2 + 0.03], [0.4, 0, 0])
    for (const sd of [-1, 1]) k.add('paint', box(0.015, 0.16, 0.2), [sd * 0.265, 0.37, -s.len / 2 + 0.07])
    k.add('black', box(0.03, 0.2, 0.05), [0, 0.3, -s.len / 2 + 0.11])
  }
  // Suspension arms out to each wheel.
  for (const z of [wz, -wz]) for (const sd of [-1, 1]) for (const y of [0.1, 0.19]) {
    const len = tx - 0.12
    k.add('black', box(len, 0.012, 0.02), [sd * (0.12 + len / 2), y, z])
  }
  k.add('tail', plane(0.06, 0.03), [0, 0.2, -s.len / 2 + 0.05], [0, Math.PI, 0])
  brakes(k, tx, wz, s.wheel, 0.16)
  if (!fit.exhaust) k.add('chrome', cyl(0.025, 0.025, 0.08, 10), [0, 0.24, -s.len / 2 + 0.1], [Math.PI / 2 - 0.2, 0, 0])
  // Racing stripes along the nose and engine cover.
  for (const x of [-0.03, 0.03]) {
    k.add('stripe', box(0.04, 0.006, 0.42), [x, 0.18, 0.42])
    k.add('stripe', box(0.04, 0.006, 0.38), [x, 0.27, -0.36])
  }
  const wheel = new CylinderGeometry(s.wheel, s.wheel, 0.16, 18, 1)
  const uv = wheel.getAttribute('uv')
  const side = (18 + 1) * 2
  for (let i = 0; i < uv.count; i++) uv.setX(i, i < side ? 0.5 + uv.getX(i) * 0.5 : uv.getX(i) * 0.5)
  wheel.rotateZ(Math.PI / 2)
  const out = { parts: k.build(), wheel }
  geoCache.set(key, out)
  return out
}

// A bucket seat: cushion, a raked back and a headrest, seen through the glass.
function seat(k: Kit, x: number, y: number, z: number, w: number, back: number) {
  k.add('cabin', rbox1(w, 0.045, 0.11, 0.018), [x, y + 0.025, z + 0.045])
  k.add('cabin', rbox1(w, back, 0.04, 0.016), [x, y + back / 2 + 0.03, z - 0.02], [-0.18, 0, 0])
  // Side bolsters on the back, a shade darker.
  for (const sd of [-1, 1]) k.add('dash', rbox1(0.016, back * 0.8, 0.045, 0.007), [x + sd * (w / 2 - 0.006), y + back * 0.45 + 0.03, z - 0.015], [-0.18, 0, 0])
  k.add('cabin', rbox1(w * 0.58, 0.04, 0.03, 0.012), [x, y + back + 0.06, z - 0.035], [-0.18, 0, 0])
}

// Steering wheel on its column, tilted toward the driver.
function steering(k: Kit, x: number, y: number, z: number) {
  k.add('dash', new TorusGeometry(0.038, 0.008, 5, 16), [x, y, z], [-0.5, 0, 0])
  k.add('dash', box(0.07, 0.008, 0.008), [x, y, z], [-0.5, 0, 0])
  k.add('dash', cyl(0.01, 0.012, 0.08, 6), [x, y - 0.02, z + 0.04], [1.0, 0, 0])
}

// What shows through the windows of a closed car: a dash with a gauge hood and a
// screen, the wheel, front seats with a console between them, rear seats when the
// cabin is long enough (rows of them in vans and buses), and a mirror at the top of
// the windshield. Everything is kept behind the raked glass.
function cabinInside(k: Kit, s: Shape, top: number, c: { front: number; rear: number; roofF: number; roofR: number; roof: number }) {
  const base = top - 0.01
  const slope = (c.front - c.roofF) / Math.max(0.05, c.roof - base)
  const back = (c.roofR - c.rear) / Math.max(0.05, c.roof - base)
  // Furthest forward (and back) anything at height y can sit and stay inside the glass.
  const fwd = (y: number) => c.front - 0.03 - (y - base) * slope
  const aft = (y: number) => c.rear + 0.03 + (y - base) * back
  const wi = s.wid * 0.8 - 0.06
  const dy = top + 0.035
  k.add('dash', rbox1(wi, 0.05, 0.09, 0.02), [0, dy, fwd(dy + 0.025) - 0.045])
  const dx = s.wid * 0.19
  // Gauge hood in front of the driver, and a lit screen in the middle of the dash.
  k.add('dash', rbox1(0.1, 0.03, 0.05, 0.012), [dx, dy + 0.035, fwd(dy + 0.05) - 0.06])
  k.add('display', plane(0.06, 0.035), [0, dy + 0.02, fwd(dy + 0.04) - 0.095], [-0.4, 0, 0])
  const wy = top + 0.075
  steering(k, dx, wy, fwd(wy + 0.03) - 0.1)
  const hb = Math.max(0.06, Math.min(0.15, s.cabinH * 0.85 - 0.075))
  const sw = Math.min(0.15, s.wid * 0.25)
  const zs = Math.max(aft(top + hb) + 0.03, Math.min(fwd(top) - 0.28, c.front - s.cabinLen * 0.5))
  for (const sd of [-1, 1]) seat(k, sd * dx, base, zs, sw, hb)
  k.add('dash', rbox1(0.06, 0.05, 0.2, 0.015), [0, base + 0.03, zs + 0.1])
  // Rear rows, as many as fit behind the front seats.
  for (let z = zs - 0.22; aft(top + hb) + 0.02 < z; z -= 0.22) {
    k.add('cabin', rbox1(wi * 0.9, 0.045, 0.11, 0.018), [0, base + 0.025, z + 0.045])
    k.add('cabin', rbox1(wi * 0.9, hb * 0.85, 0.04, 0.016), [0, base + hb * 0.42 + 0.03, z - 0.02], [-0.15, 0, 0])
    for (const sd of [-1, 1]) k.add('cabin', rbox1(sw * 0.5, 0.035, 0.03, 0.01), [sd * dx, base + hb * 0.85 + 0.05, z - 0.03])
  }
  const my = c.roof - 0.035
  k.add('dash', rbox1(0.055, 0.02, 0.012, 0.006), [0, my, fwd(my) - 0.02])
}

// Brake rotors and calipers behind each wheel's spokes.
function brakes(k: Kit, wx: number, wz: number, r: number, w: number) {
  for (const z of [wz, -wz]) for (const sd of [-1, 1]) {
    const b = brakeGeo(r, w, sd)
    k.add('dash', b.rotor, [sd * wx, r, z])
    k.add('caliper', b.caliper, [sd * wx, r, z])
  }
}

// Stock parts that a fitted mod replaces are left out of the merged body.
function carGeo(body: Body, fit: Partial<Record<ModSlot, string>>, model?: string): CarGeo {
  const key = `${body}|${model ?? ''}|${fit.spoiler ? 1 : 0}${fit.hood ? 1 : 0}${fit.exhaust ? 1 : 0}${fit.kit ? 1 : 0}`
  const hit = geoCache.get(key)
  if (hit) return hit
  if (body === 'formula') return formulaGeo(key, fit)
  const s = shapeOf(body)
  const k = new Kit()
  const b = s.round ? Math.min(0.1, s.body * 0.4) : 0.035
  const lower = bodyProfile(s, b)
  const top = lower.deck
  const hoodY = lower.hood
  const wz = s.len * 0.33
  const cowl = s.cabinZ + s.cabinLen / 2
  const hoodFront = s.len / 2 - s.len * 0.1
  const front = s.len / 2
  const low = LOW.includes(body) || SLEEK.includes(body)
  // Front bumper: slimmer and lower on low cars so the headlights clear it.
  const bumperH = low ? 0.05 : 0.07
  const bumperY = s.lift + (low ? 0.055 : 0.07)
  const plateY = low ? bumperY + 0.005 : s.lift + 0.12
  const lightY = Math.min(lower.hoodRaw - 0.012, Math.max(bumperY + bumperH / 2 + 0.03, s.lift + (Math.max(s.lift + 0.1, hoodY - s.nose) - s.lift) * 0.7))
  // Where a flat part at height y sits on the nose, and how far it tips back: the
  // front face is upright up to the nose line, then curves back into the hood.
  const noseAt = (y: number): [number, number, number] => {
    const n = lower.nose
    const h = lower.hoodRaw
    if (y <= n || h - n < 0.005) return [front, y, 0]
    const t = 1 - Math.sqrt(1 - Math.min(1, (y - n) / (h - n)))
    const nz = 2 * (1 - t) * (h - n)
    const ny = 2 * t * s.len * 0.12
    const l = Math.hypot(nz, ny) || 1
    return [lower.L - t * t * s.len * 0.12 + (b * nz) / l, y + (b * ny) / l, -Math.atan2(ny, nz)]
  }
  // Adds a part flat on the nose at (x, y), lifted `out` off the surface, turned rz in its own plane.
  const onNose = (part: Part, geo: BufferGeometry, x: number, y: number, out = 0.004, rz = 0) => {
    const [nz, ny, rx] = noseAt(y)
    k.add(part, geo, [x, ny - Math.sin(rx) * out, nz + Math.cos(rx) * out], [rx, 0, rz])
  }
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
    if (RUGGED.includes(body) && !fit.kit) k.add('black', new TorusGeometry(s.wheel * 1.2, 0.03, 5, 14, Math.PI), [sd * (s.wid / 2 + 0.01), s.wheel, z], [0, (sd * Math.PI) / 2, 0], [1, 1, 1.6])
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
    // Two little seats, a dash and a wheel under the dome.
    for (const sd of [-1, 1]) seat(k, sd * s.wid * 0.17, top - 0.02, s.cabinZ - 0.04, s.wid * 0.22, 0.12)
    k.add('dash', rbox(s.wid * 0.6, 0.05, 0.06, 0.02), [0, top + 0.03, s.cabinZ + s.cabinLen * 0.3])
    steering(k, s.wid * 0.17, top + 0.08, s.cabinZ + s.cabinLen * 0.22)
  } else if (s.open) {
    // Open top: raked windshield in a frame, seats with headrests, a dash and a wheel.
    const base: V3 = [0, top, s.cabinZ]
    const ws: V3 = [0, top + s.cabinH * 0.45, s.cabinZ + s.cabinLen * 0.5]
    if (!s.plates) k.add('screen', box(s.wid * 0.86, s.cabinH * 0.9, 0.02), ws, [-0.5, 0, 0])
    if (!s.plates) k.add('black', box(s.wid * 0.9, 0.025, 0.03), [0, ws[1] + Math.cos(0.5) * s.cabinH * 0.45, ws[2] - Math.sin(0.5) * s.cabinH * 0.45], [-0.5, 0, 0])
    for (const sd of [-1, 1]) {
      k.add('seat', rbox(s.wid * 0.28, 0.16, 0.16, 0.04), [sd * s.wid * 0.2, base[1] + 0.06, base[2]])
      k.add('seat', rbox(s.wid * 0.26, 0.2, 0.05, 0.02), [sd * s.wid * 0.2, base[1] + 0.14, base[2] - 0.08], [-0.15, 0, 0])
      k.add('seat', rbox(s.wid * 0.14, 0.07, 0.05, 0.02), [sd * s.wid * 0.2, base[1] + 0.27, base[2] - 0.1])
    }
    k.add('black', rbox(s.wid * 0.78, 0.06, 0.08, 0.02), [0, top + 0.03, s.cabinZ + s.cabinLen * 0.38])
    // Two round gauges and a row of switches on the dash.
    for (const gx of [-0.06, 0.06]) {
      k.add('chrome', new TorusGeometry(0.022, 0.004, 3, 12), [-s.wid * 0.2 + gx * 0.5, top + 0.064, s.cabinZ + s.cabinLen * 0.38 - 0.03], [-0.6, 0, 0])
      k.add('lamp', disc(0.018, 10), [-s.wid * 0.2 + gx * 0.5, top + 0.064, s.cabinZ + s.cabinLen * 0.38 - 0.031], [-0.6 + Math.PI, 0, Math.PI])
    }
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
    cabinInside(k, s, top, c)
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
      k.add(VINTAGE.includes(body) ? 'paint' : 'black', box(0.012, ph, 0.035), [sd * s.wid * 0.405, (top + roofY) / 2, roofZ - roofLen * 0.05])
      k.add('black', box(0.012, 0.02, s.cabinLen * 0.86), [sd * s.wid * 0.402, top + 0.008, s.cabinZ])
      // Drip rail along the edge of the roof.
      k.add(VINTAGE.includes(body) ? 'chrome' : 'black', box(0.008, 0.008, roofLen * 0.96), [sd * s.wid * 0.416, roofY - 0.006, roofZ])
    }
    // Cowl panel with vent slots across the base of the windshield.
    k.add('black', box(s.wid * 0.74, 0.008, 0.04), [0, top + 0.003, c.front + 0.012])
    for (let i = -4; i <= 4; i++) k.add('dark', box(0.012, 0.009, 0.026), [i * s.wid * 0.07, top + 0.004, c.front + 0.012])
    // Wipers resting at the base of the windshield.
    for (const x of [-0.12, 0.08]) k.add('black', box(0.16, 0.008, 0.012), [x * s.wid * 1.6, top + 0.01, c.front - 0.03], [0, 0.25, 0])
    // Third brake light on the rear edge of the roof.
    k.add('tail', plane(0.12, 0.014), [0, roofY - 0.012, c.roofR - 0.012], [0, Math.PI, 0])
    // Radio aerial on everyday cars, roof rails on the wagon.
    if (body === 'sedan' || body === 'compact' || body === 'classic') k.add('black', cyl(0.004, 0.006, 0.2, 4), [s.wid * 0.3, top + 0.1, -s.len / 2 + 0.12], [-0.3, 0, 0])
    if (body === 'wagon' || body === 'truck' || body === 'suv' || body === 'van') {
      for (const sd of [-1, 1]) {
        k.add('chrome', box(0.02, 0.02, roofLen * 0.9), [sd * s.wid * 0.33, roofY + 0.02, roofZ])
        for (const z of [-0.4, 0.4]) k.add('chrome', box(0.02, 0.025, 0.02), [sd * s.wid * 0.33, roofY + 0.008, roofZ + z * roofLen * 0.9])
      }
    }
    if (s.armor) {
      // Armour slats across the windshield, a roof hatch and a whip aerial.
      const rake = Math.atan2(c.roof - top, c.front - c.roofF)
      for (const t of [0.4, 0.7]) k.add('paint', box(s.wid * 0.8, 0.016, 0.024), [0, top + (c.roof - top) * t, c.front + (c.roofF - c.front) * t + 0.012], [rake, 0, 0])
      k.add('paint', cyl(0.07, 0.08, 0.04, 12), [0, roofY + 0.02, roofZ - roofLen * 0.12])
      k.add('chrome', cyl(0.074, 0.074, 0.008, 12), [0, roofY + 0.042, roofZ - roofLen * 0.12])
      k.add('black', cyl(0.003, 0.006, 0.34, 4), [-s.wid * 0.32, roofY + 0.15, c.roofR + 0.02], [-0.15, 0, 0])
    }
    if (s.bus) {
      // Window posts along both sides, roof warning lamps, the stop arm and the rear emergency door.
      for (let z = c.rear + 0.16; z < c.front - 0.12; z += 0.17) for (const sd of [-1, 1]) k.add('paint', box(0.012, ph, 0.03), [sd * s.wid * 0.405, (top + roofY) / 2, z])
      for (const sd of [-1, 1]) {
        k.add('amber', box(0.05, 0.03, 0.03), [sd * s.wid * 0.3, roofY + 0.005, c.roofF - 0.02])
        k.add('tail', box(0.05, 0.03, 0.03), [sd * s.wid * 0.3, roofY + 0.005, c.roofR + 0.02])
      }
      k.add('black', box(0.012, 0.012, 0.12), [-(s.wid / 2 + 0.02), top - 0.05, c.front - 0.18])
      k.add('tail', disc(0.045, 8), [-(s.wid / 2 + 0.03), top - 0.05, c.front - 0.24], [0, -Math.PI / 2, 0])
      k.add('dark', plane(0.22, roofY - s.lift - 0.12), [0, (roofY + s.lift + 0.08) / 2, -front - 0.006], [0, Math.PI, 0])
      k.add('black', box(s.wid * 0.6, 0.06, 0.02), [0, roofY - 0.05, c.front - 0.01])
    }
    if (s.dog) {
      // Floppy ears hanging over the windshield corners, big eyes above it.
      for (const sd of [-1, 1]) {
        k.add('dark', rbox(0.06, 0.22, 0.14, 0.03), [sd * s.wid * 0.44, roofY - 0.08, c.roofF - 0.04], [0, 0, sd * 0.35])
        k.add('lamp', disc(0.045, 14), [sd * 0.12, roofY - 0.045, c.roofF + 0.012], [-0.3, 0, 0])
        k.add('black', disc(0.02, 10), [sd * 0.11, roofY - 0.05, c.roofF + 0.02], [-0.3, 0, 0])
      }
    }
    if (s.roofwing && !fit.spoiler) {
      k.add('paint', box(s.wid * 0.8, 0.022, 0.12), [0, roofY + 0.012, c.roofR - 0.03], [-0.15, 0, 0])
      for (const sd of [-1, 1]) k.add('black', box(0.012, 0.05, 0.1), [sd * s.wid * 0.4, roofY - 0.005, c.roofR - 0.03])
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
  if (s.wing && !fit.spoiler) {
    for (const sd of [-1, 1]) k.add('black', box(0.03, 0.2, 0.04), [sd * s.wid * 0.3, top + 0.1, -s.len / 2 + 0.08])
    k.add('paint', box(s.wid * 0.9, 0.03, 0.15), [0, top + 0.21, -s.len / 2 + 0.08])
    for (const sd of [-1, 1]) k.add('black', box(0.012, 0.08, 0.17), [sd * s.wid * 0.45, top + 0.2, -s.len / 2 + 0.08])
  }
  if (s.hood > 0) k.add('paint', rbox(s.wid * 0.5, s.hood * 2, s.len * 0.26, s.hood * 0.9), [0, hoodY, s.len * 0.3])
  if (s.scoop && !fit.hood) {
    k.add('black', rbox(0.16, 0.07, 0.16, 0.025), [0, hoodY + s.hood + 0.02, s.len * 0.27])
    k.add('black', box(0.12, 0.03, 0.01), [0, hoodY + s.hood + 0.03, s.len * 0.27 + 0.082])
  }
  if (s.bed) {
    k.add('black', box(s.wid * 0.84, 0.03, s.len * 0.4), [0, top + 0.01, -s.len * 0.27])
    // Bed rails and a tailgate handle.
    for (const sd of [-1, 1]) k.add('chrome', box(0.025, 0.02, s.len * 0.4), [sd * s.wid * 0.45, top + 0.01, -s.len * 0.27])
    k.add('chrome', box(0.12, 0.02, 0.01), [0, top - 0.05, -s.len / 2 - 0.004])
  }
  if (s.vee) {
    // Big chrome V on the flat nose, meeting at a round badge.
    for (const sd of [-1, 1]) k.add('chrome', box(0.02, 0.2, 0.01), [sd * 0.07, top - 0.03, front + 0.006], [0, 0, sd * 0.45])
    k.add('chrome', disc(0.05, 16), [0, top - 0.12, front + 0.008])
  }
  if (s.bus) for (const y of [0.35, 0.75]) for (const sd of [-1, 1]) k.add('black', box(0.012, 0.02, s.len * 0.9), [sd * (s.wid / 2 + 0.004), s.lift + s.body * y, 0])
  if (s.plates) {
    // Armoured scout: wheels standing clear of a narrow hull on exposed arms, a faceted
    // fender over each wheel, a raked armoured prow, a roll hoop behind the seats and a
    // three-barrel turret on a post at the back.
    const tx = s.track!
    const r = s.wheel
    const fy = r * 2 + 0.05
    for (const zz of [wz, -wz]) for (const sd of [-1, 1]) {
      const fx = sd * tx
      const fwd = zz > 0
      // Fender: a flat top over the tyre with sloped ends, the long slope facing out from the car's middle.
      const [lf, lr] = fwd ? [0.26, 0.12] : [0.12, 0.2]
      k.add('paint', rbox(0.24, 0.03, r * 1.1, 0.01), [fx, fy, zz])
      k.add('paint', rbox(0.24, 0.03, lf, 0.01), [fx, fy - Math.sin(0.55) * lf / 2, zz + r * 0.55 + (Math.cos(0.55) * lf) / 2 - 0.01], [0.55, 0, 0])
      k.add('paint', rbox(0.24, 0.03, lr, 0.01), [fx, fy - Math.sin(0.55) * lr / 2, zz - r * 0.55 - (Math.cos(0.55) * lr) / 2 + 0.01], [-0.55, 0, 0])
      // Outer skirt leaning in at the top, and the inner wall back to the hull.
      k.add('paint', rbox(0.025, 0.1, r * 1.5, 0.008), [fx + sd * 0.115, fy - 0.06, zz], [0, 0, sd * 0.3])
      k.add('dark', box(0.02, fy - top + 0.02, r * 1.6), [sd * (s.wid / 2 + 0.01), (fy + top) / 2 - 0.01, zz])
      // Rivets along the fender top.
      for (const u of [-0.35, 0, 0.35]) k.add('chrome', disc(0.009, 6), [fx + sd * 0.08, fy + 0.016, zz + u * r], [-Math.PI / 2, 0, 0])
      // Suspension: two arms out to the hub and a coil-over shock.
      for (const dy of [-0.04, 0.04]) bar(k, 'black', [sd * (s.wid / 2 - 0.01), r + dy, zz], [sd * (tx - 0.09), r + dy * 0.6, zz], 0.022)
      bar(k, 'chrome', [sd * (tx - 0.09), r + 0.03, zz - 0.02], [sd * (s.wid / 2 - 0.02), top + 0.02, zz - 0.05], 0.022)
      if (fwd) {
        // Twin headlights set into the front slope of each front fender.
        for (const lx of [-0.05, 0.05]) {
          const p: V3 = [fx + lx, fy - Math.sin(0.55) * lf * 0.55 + 0.018, zz + r * 0.55 + Math.cos(0.55) * lf * 0.55]
          k.add('black', cyl(0.032, 0.032, 0.04, 12), p, [Math.PI / 2, 0, 0])
          k.add('lamp', disc(0.026, 12), [p[0], p[1], p[2] + 0.021])
          k.add('chrome', new TorusGeometry(0.029, 0.004, 3, 12), [p[0], p[1], p[2] + 0.021])
        }
      } else {
        k.add('tail', plane(0.07, 0.022), [fx, fy - Math.sin(0.55) * lr * 0.5 + 0.017, zz - r * 0.55 - Math.cos(0.55) * lr * 0.5 - 0.004], [0.55, Math.PI, 0])
      }
    }
    // Prow: a raked armour face with a slotted grille, a sloped hood with a ridge, and a heavy bumper with a winch.
    k.add('paint', rbox(s.wid * 0.9, 0.2, 0.07, 0.015), [0, s.lift + 0.13, front - 0.01], [-0.32, 0, 0])
    k.add('dark', plane(s.wid * 0.6, 0.12), [0, s.lift + 0.14, front + 0.032], [-0.32, 0, 0])
    for (let i = -3; i <= 3; i++) k.add('black', plane(0.02, 0.1), [i * 0.045, s.lift + 0.14, front + 0.034], [-0.32, 0, 0])
    k.add('paint', rbox(s.wid * 0.94, 0.04, 0.42, 0.012), [0, top + 0.03, front - 0.25], [0.2, 0, 0])
    k.add('paint', rbox(0.09, 0.035, 0.36, 0.012), [0, top + 0.06, front - 0.27], [0.2, 0, 0])
    for (const sd of [-1, 1]) k.add('black', box(0.08, 0.006, 0.12), [sd * 0.13, top + 0.05, front - 0.22], [0.2, 0, 0])
    k.add('black', rbox(s.wid * 1.1, 0.06, 0.07, 0.02), [0, s.lift + 0.02, front + 0.05])
    k.add('black', cyl(0.035, 0.035, 0.16, 10), [0, s.lift + 0.06, front + 0.07], [0, 0, Math.PI / 2])
    k.add('chrome', cyl(0.037, 0.037, 0.05, 10), [0, s.lift + 0.06, front + 0.07], [0, 0, Math.PI / 2])
    for (const sd of [-1, 1]) {
      k.add('chrome', new TorusGeometry(0.022, 0.008, 5, 10), [sd * s.wid * 0.42, s.lift + 0.0, front + 0.085], [0, Math.PI / 2, 0])
      k.add('amber', plane(0.04, 0.02), [sd * s.wid * 0.5, s.lift + 0.03, front + 0.086])
    }
    // Faceted hull: sloped armour along each side between the wheels, and a dark V under it.
    for (const sd of [-1, 1]) {
      k.add('paint', rbox(0.1, 0.025, wz * 2 - r * 2.2, 0.008), [sd * (s.wid / 2 - 0.02), top - 0.02, 0], [0, 0, sd * -0.6])
      k.add('dark', rbox(0.025, 0.08, wz * 2 - r * 2.4, 0.008), [sd * (s.wid / 2 - 0.05), s.lift + 0.02, 0], [0, 0, sd * 0.5])
    }
    // Roll hoop behind the seats, braced back to the rear deck.
    const hz = s.cabinZ - 0.17
    k.add('black', new TorusGeometry(s.wid * 0.36, 0.02, 6, 16, Math.PI), [0, top, hz])
    for (const sd of [-1, 1]) bar(k, 'black', [sd * s.wid * 0.3, top + s.wid * 0.2, hz], [sd * s.wid * 0.36, top + 0.01, hz - 0.22], 0.02)
    if (!fit.spoiler) {
      // Turret: a post with a ring, the gun body with a three-barrel spinner, a shield and grips.
      const tz = -front + 0.3
      const gy = top + 0.34
      k.add('black', cyl(0.045, 0.07, gy - top - 0.04, 10), [0, top + (gy - top - 0.04) / 2, tz])
      k.add('dark', cyl(0.1, 0.1, 0.03, 16), [0, gy - 0.07, tz])
      k.add('dark', rbox(0.13, 0.1, 0.22, 0.03), [0, gy, tz + 0.02])
      k.add('black', cyl(0.05, 0.05, 0.07, 12), [0, gy, tz + 0.16], [Math.PI / 2, 0, 0])
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 2
        k.add('black', cyl(0.012, 0.012, 0.34, 8), [Math.cos(a) * 0.024, gy + Math.sin(a) * 0.024, tz + 0.36], [Math.PI / 2, 0, 0])
      }
      for (const z of [0.3, 0.52]) k.add('chrome', new TorusGeometry(0.038, 0.007, 4, 12), [0, gy, tz + z])
      k.add('paint', rbox(0.3, 0.15, 0.018, 0.006), [0, gy + 0.05, tz + 0.13], [-0.15, 0, 0])
      k.add('black', plane(0.08, 0.012), [0, gy + 0.08, tz + 0.142], [-0.15, 0, 0])
      for (const sd of [-1, 1]) bar(k, 'black', [sd * 0.05, gy - 0.02, tz - 0.09], [sd * 0.07, gy + 0.02, tz - 0.16], 0.016)
      k.add('dark', rbox(0.07, 0.08, 0.12, 0.01), [0.1, gy - 0.02, tz + 0.02])
    }
  }
  if (s.dog) {
    // Shaggy tufts all over the sides, a big black nose, a lolling tongue and a tail (unless a bigger one is fitted).
    for (let i = 0; i < 28; i++) {
      const sd = i % 2 ? 1 : -1
      const z = -s.len * 0.42 + ((i * 0.37) % 1) * s.len * 0.8
      const y = s.lift + 0.06 + ((i * 0.61) % 1) * (s.body + 0.18)
      k.add(i % 3 ? 'paint' : 'dark', rbox(0.03, 0.07, 0.08, 0.012), [sd * (s.wid / 2 + 0.008), y, z], [0, 0, sd * (0.2 + ((i * 0.29) % 1) * 0.3)])
    }
    k.add('black', new SphereGeometry(0.055, 12, 10), [0, top - 0.04, front + 0.03], [0, 0, 0], [1.3, 1, 1])
    k.add('tail', rbox(0.07, 0.012, 0.12, 0.005), [0, s.lift + 0.1, front + 0.05], [1.1, 0, 0])
    if (!fit.spoiler) k.add('paint', cyl(0.02, 0.035, 0.24, 8), [0, top + 0.12, -front - 0.04], [-0.6, 0, 0])
  }
  if (s.spare) {
    k.add('black', cyl(0.12, 0.12, 0.08, 16), [0, s.lift + s.body * 0.62, -front - 0.05], [Math.PI / 2, 0, 0])
    k.add('chrome', disc(0.06, 12), [0, s.lift + s.body * 0.62, -front - 0.091], [0, Math.PI, 0])
  }
  if (s.ornament) {
    // Tall chrome grille standing up from the bumper and a little figure on the hood.
    k.add('chrome', rbox(0.2, 0.14, 0.03, 0.01), [0, lightY + 0.02, front + 0.008])
    for (let i = -3; i <= 3; i++) k.add('dark', box(0.008, 0.12, 0.006), [i * 0.025, lightY + 0.02, front + 0.025])
    k.add('chrome', box(0.012, 0.05, 0.03), [0, hoodY + 0.025, front - 0.04], [-0.4, 0, 0])
    for (const sd of [-1, 1]) k.add('chrome', box(0.008, 0.014, s.len * 0.7), [sd * (s.wid / 2 + 0.004), s.lift + s.body * 0.7, 0])
  }
  if (s.frontbar) onNose('lamp', plane(s.wid * 0.82, 0.014), 0, lightY + 0.03, 0.006)
  if (s.ducktail && !fit.spoiler) k.add('paint', box(s.wid * 0.84, 0.03, 0.1), [0, top + 0.015, -s.len / 2 + 0.07], [0.35, 0, 0])
  if (s.flares && !fit.kit) {
    for (const sd of [-1, 1]) {
      for (const zz of [wz, -wz]) k.add('paint', new TorusGeometry(s.wheel * 1.18, 0.03, 6, 14, Math.PI), [sd * (s.wid / 2 + 0.02), s.wheel, zz], [0, (sd * Math.PI) / 2, 0], [1, 1, 1.6])
      k.add('black', box(0.03, 0.04, wz * 2 - s.wheel * 2.5), [sd * (s.wid / 2 + 0.012), s.lift + 0.04, 0])
    }
  }
  if (s.tracks) {
    const tx = s.wid / 2 - 0.02
    for (const sd of [-1, 1]) {
      const x = sd * tx
      // Track loop: a band round each end wheel joined by top and bottom runs, with cleats on top.
      for (const zz of [wz, -wz]) k.add('black', new CylinderGeometry(s.wheel + 0.016, s.wheel + 0.016, 0.16, 18, 1, true), [x, s.wheel, zz], [0, 0, Math.PI / 2])
      for (const y of [0.008, s.wheel * 2 + 0.008]) k.add('black', box(0.16, 0.016, wz * 2), [x, y, 0])
      for (let i = -4; i <= 4; i++) k.add('dark', box(0.165, 0.012, 0.03), [x, s.wheel * 2 + 0.02, (i * wz) / 4.5])
      // Middle road wheel between the two real ones.
      k.add('dark', disc(s.wheel * 0.75, 14), [sd * (tx + 0.072), s.wheel, 0], [0, (sd * Math.PI) / 2, 0])
      k.add('chrome', disc(0.035, 10), [sd * (tx + 0.074), s.wheel, 0], [0, (sd * Math.PI) / 2, 0])
      // Armour skirt over the top of the track, with a row of rivets.
      if (!fit.kit) {
        k.add('paint', rbox(0.03, s.wheel * 0.62, wz * 2 + s.wheel * 1.7, 0.012), [sd * (tx + 0.085), s.wheel * 1.62, 0])
        for (let i = -3; i <= 3; i++) k.add('chrome', disc(0.011, 6), [sd * (tx + 0.101), s.wheel * 1.75, (i * wz) / 3], [0, (sd * Math.PI) / 2, 0])
      }
    }
  }
  if (s.armor) {
    // Push bar across the nose with two tow hooks.
    k.add('black', rbox(s.wid * 1.02, 0.06, 0.05, 0.02), [0, s.lift + 0.06, front + 0.04])
    for (const sd of [-1, 1]) k.add('chrome', new TorusGeometry(0.022, 0.008, 5, 10), [sd * s.wid * 0.36, s.lift + 0.02, front + 0.06], [0, Math.PI / 2, 0])
    if (!fit.hood) {
      // Exposed V10 on the hood: two chrome cylinder banks with a row of intake stacks each.
      for (const sd of [-1, 1]) {
        k.add('chrome', rbox(0.09, 0.05, 0.24, 0.015), [sd * 0.055, hoodY + 0.03, s.len * 0.27], [0, 0, sd * 0.5])
        for (let i = 0; i < 5; i++) k.add('chrome', cyl(0.012, 0.016, 0.05, 8), [sd * 0.08, hoodY + 0.075, s.len * 0.27 - 0.09 + i * 0.045], [0, 0, sd * 0.5])
      }
      k.add('black', rbox(0.06, 0.04, 0.26, 0.012), [0, hoodY + 0.02, s.len * 0.27])
    }
  }
  if (s.spoiler && !fit.spoiler) {
    for (const sd of [-1, 1]) k.add('black', box(0.03, 0.12, 0.04), [sd * s.wid * 0.32, top + 0.06, -s.len / 2 + 0.07])
    k.add(body === 'super' ? 'black' : 'paint', box(s.wid * 0.95, 0.03, 0.14), [0, top + 0.13, -s.len / 2 + 0.07])
  }
  // Racing stripes along the hood, the rear deck and the roof (drawn only when painted on).
  for (const x of [-0.07, 0.07]) {
    k.add('stripe', box(0.07, 0.006, hoodFront - cowl), [x, hoodY + 0.003, (hoodFront + cowl) / 2])
    k.add('stripe', box(0.07, 0.006, cowl + s.len / 2 - 0.05), [x, top + 0.003, (cowl - s.len / 2) / 2])
    if (roofLen > 0) k.add('stripe', box(0.07, 0.006, roofLen * 0.95), [x, roofY + 0.003, roofZ])
  }

  k.add('chrome', rbox(s.wid * 0.96, 0.07, 0.06, 0.028), [0, s.lift + 0.07, -front + 0.005])
  // The armoured scout has its own nose (see the plates section above).
  const roundLamps = ROUND_LAMPS.includes(body)
  const bigGrille = BIG_GRILLE.includes(body)
  const sleek = SLEEK.includes(body)
  if (!s.plates) {
    // Bumpers, with a black lower lip and a lower air intake on the front.
    k.add('chrome', rbox(s.wid * 0.96, bumperH, 0.06, 0.024), [0, bumperY, front - 0.005])
    if (!fit.kit) k.add('black', box(s.wid * 0.8, 0.02, 0.05), [0, s.lift + 0.03, front - 0.02])
    // Front: headlights in dark housings either side of a grille (or a low intake on sleek cars), turn signals and a plate.
    for (const sd of [-1, 1]) {
      const x = sd * s.wid * 0.3
      if (s.quad) {
        // Two round lamps each side in a black bezel; the inner left one is an air intake.
        onNose('black', rbox(0.17, 0.07, 0.01, 0.01), x, lightY, 0.002)
        for (const lx of [0.37, 0.23]) {
          const intake = sd < 0 && lx === 0.23
          onNose(intake ? 'black' : 'lamp', disc(0.028, 14), sd * s.wid * lx, lightY, 0.008)
          onNose(intake ? 'chrome' : 'chrome', new TorusGeometry(0.031, 0.005, 4, 16), sd * s.wid * lx, lightY, 0.009)
          if (!intake) onNose('chrome', disc(0.009, 8), sd * s.wid * lx, lightY, 0.01)
        }
      } else if (roundLamps) {
        // Sealed-beam lamp: black bucket, chrome ring, lens and a bulb shield in the middle.
        onNose('black', disc(0.058, 18), x, lightY, 0.002)
        onNose('lamp', disc(0.046, 18), x, lightY, 0.004)
        onNose('chrome', new TorusGeometry(0.049, 0.006, 4, 20), x, lightY, 0.006)
        onNose('chrome', disc(0.014, 10), x, lightY, 0.007)
        for (const a of [-0.5, 0.5]) onNose('chrome', plane(0.002, 0.07), x, lightY, 0.0055, a)
      } else if (sleek) {
        // Slim slanted LED strip with a row of projector dots under it.
        onNose('black', plane(0.17, 0.042), x, lightY, 0.002, sd * 0.16)
        onNose('lamp', plane(0.16, 0.009), x, lightY + 0.013, 0.004, sd * 0.16)
        for (const i of [0, 1, 2]) onNose('lamp', disc(0.009, 8), x - sd * (0.045 - i * 0.04), lightY - 0.006 + sd * (0.045 - i * 0.04) * 0.16, 0.004)
      } else {
        // Housing with a chrome reflector, twin projector lenses and a light strip along the top.
        onNose('black', plane(0.16, 0.055), x, lightY, 0.002, sd * 0.12)
        onNose('glass', plane(0.144, 0.042), x, lightY, 0.003, sd * 0.12)
        for (const lx of [-0.035, 0.035]) {
          const px = x + lx * sd
          onNose('black', disc(0.019, 12), px, lightY - 0.004 + lx * sd * 0.12, 0.004)
          onNose('lamp', disc(0.014, 12), px, lightY - 0.004 + lx * sd * 0.12, 0.005)
        }
        onNose('lamp', plane(0.13, 0.008), x, lightY + 0.017, 0.005, sd * 0.12)
      }
      // Amber turn signal at the outer corner, and a side marker behind it.
      onNose('amber', plane(0.045, 0.022), sd * s.wid * 0.43, lightY - 0.04, 0.004)
      k.add('amber', plane(0.04, 0.018), [sd * (s.wid / 2 + 0.004), lightY - 0.02, front - 0.09], [0, (sd * Math.PI) / 2, 0])
      // Fog lamps low on the bumper of off-roaders and rally cars.
      if (RUGGED.includes(body)) k.add('lamp', disc(0.025, 10), [sd * s.wid * 0.3, s.lift + 0.07, front + 0.026])
    }
    if (!sleek) {
      // Grille: a surround with a mesh of slats and bars behind it.
      const gw = s.wid * (bigGrille ? 0.42 : 0.3)
      const gh = bigGrille ? 0.075 : 0.05
      const gy = Math.max(bumperY + bumperH / 2 + gh / 2 - 0.005, lightY - 0.005)
      onNose('dark', plane(gw * 0.94, gh * 0.86), 0, gy, 0.003)
      const rim = bigGrille ? 'chrome' : 'black'
      for (const sd of [-1, 1]) {
        onNose(rim, box(gw, 0.008, 0.008), 0, gy + (sd * gh) / 2, 0.004)
        onNose(rim, box(0.008, gh, 0.008), (sd * gw) / 2, gy, 0.004)
      }
      const n = bigGrille ? 4 : 3
      for (let i = 0; i < n; i++) onNose(bigGrille ? 'chrome' : 'black', box(gw * 0.9, 0.005, 0.006), 0, gy - gh / 2 + (gh * (i + 1)) / (n + 1), 0.005)
      for (let i = 1; i < 6; i++) onNose('black', box(0.004, gh * 0.8, 0.005), (i / 6 - 0.5) * gw * 0.9, gy, 0.004)
    }
  }
  if (sleek && body !== 'bubble') {
    // Wide intake cut into the bumper, with a splitter bar across it.
    k.add('black', plane(s.wid * 0.6, bumperH * 0.7), [0, bumperY, front + 0.0255])
    k.add('dark', box(s.wid * 0.58, 0.006, 0.006), [0, bumperY, front + 0.027])
    // Side air intakes ahead of the rear wheels.
    for (const sd of [-1, 1]) k.add('black', plane(0.14, 0.05), [sd * (s.wid / 2 + 0.004), s.lift + s.body * 0.55, -wz + s.wheel * 1.3], [0, (sd * Math.PI) / 2, 0])
  }
  if (!s.plates) k.add('lamp', plane(0.11, 0.04), [0, plateY, front + 0.032])
  // Rear: wide tail lights with reversing lamps, a plate, and exhausts.
  const ty = s.lift + (top - s.lift) * 0.68
  if (s.lightbar) {
    // One racetrack tail light across the whole back, split by a dark badge panel.
    k.add('black', plane(s.wid * 0.9, 0.06), [0, ty, -front - 0.002], [0, Math.PI, 0])
    k.add('tail', plane(s.wid * 0.86, 0.04), [0, ty, -front - 0.004], [0, Math.PI, 0])
    k.add('dark', plane(0.1, 0.044), [0, ty, -front - 0.006], [0, Math.PI, 0])
    // LED segments: thin dark breaks along the bar, and reversing lamps at each end.
    for (let i = 1; i < 10; i++) if (Math.abs(i - 5) > 1) k.add('black', plane(0.003, 0.04), [(i / 10 - 0.5) * s.wid * 0.86, ty, -front - 0.005], [0, Math.PI, 0])
    for (const sd of [-1, 1]) k.add('lamp', plane(0.035, 0.012), [sd * s.wid * 0.36, ty - 0.012, -front - 0.006], [0, Math.PI, 0])
  } else {
    for (const sd of [-1, 1]) {
      // Tail light cluster: a red lens with a brighter inner ring, an amber indicator and a reversing lamp.
      const x = sd * s.wid * 0.3
      k.add('black', plane(0.17, 0.06), [x, ty, -front - 0.002], [0, Math.PI, 0])
      k.add('tail', plane(0.15, 0.045), [x, ty, -front - 0.004], [0, Math.PI, 0])
      k.add('dark', plane(0.15, 0.004), [x, ty + 0.006, -front - 0.005], [0, Math.PI, 0])
      k.add('lamp', new TorusGeometry(0.012, 0.003, 3, 12), [x + sd * 0.045, ty - 0.006, -front - 0.006], [0, Math.PI, 0])
      k.add('amber', plane(0.035, 0.012), [x - sd * 0.045, ty - 0.012, -front - 0.006], [0, Math.PI, 0])
      k.add('lamp', plane(0.03, 0.03), [sd * s.wid * 0.19, ty, -front - 0.005], [0, Math.PI, 0])
    }
  }
  k.add('lamp', plane(0.11, 0.045), [0, s.lift + 0.13, -s.len / 2 - 0.035], [0, Math.PI, 0])
  const pipes = fit.exhaust || hasTrim(model, 'centerExhaust') ? [] : LOW.includes(body) || body === 'muscle' || body === 'widebody' ? [-1, 1] : body === 'offroad' || body === 'ev' ? [] : [-1]
  for (const sd of pipes) {
    k.add('chrome', cyl(0.024, 0.024, 0.08, 10), [sd * s.wid * 0.3, s.lift + 0.035, -front - 0.02], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.016, 10), [sd * s.wid * 0.3, s.lift + 0.035, -front - 0.061], [0, Math.PI, 0])
    k.add('chrome', new TorusGeometry(0.024, 0.004, 4, 12), [sd * s.wid * 0.3, s.lift + 0.035, -front - 0.06])
  }
  // Red reflectors on the rear bumper corners, and black frames round both plates.
  for (const sd of [-1, 1]) k.add('tail', plane(0.035, 0.012), [sd * s.wid * 0.42, s.lift + 0.075, -front - 0.026], [0, Math.PI, 0])
  k.add('black', plane(0.124, 0.054), [0, s.lift + 0.13, -s.len / 2 - 0.034], [0, Math.PI, 0])
  if (!s.plates) k.add('black', plane(0.124, 0.052), [0, plateY, front + 0.031])
  // Low cars get a black diffuser under the rear bumper.
  if (LOW.includes(body) && !fit.kit) {
    k.add('black', box(s.wid * 0.7, 0.03, 0.06), [0, s.lift + 0.02, -front + 0.02])
    for (const x of [-0.15, 0, 0.15]) k.add('black', box(0.01, 0.04, 0.06), [x * s.wid, s.lift + 0.02, -front + 0.02])
  }
  // Mud flaps behind each wheel on rugged bodies.
  if (RUGGED.includes(body) && !fit.kit) for (const zz of [wz, -wz]) for (const sd of [-1, 1]) k.add('black', box(0.12, 0.1, 0.012), [sd * (s.wid / 2 - 0.07), s.lift + 0.02, zz - s.wheel * 1.15])
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
  if (closed && FOUR_DOOR.includes(body)) for (const sd of [-1, 1]) k.add('chrome', box(0.01, 0.012, 0.05), [sd * (s.wid / 2 + 0.004), top - 0.05, s.cabinZ + s.cabinLen * 0.5 - 0.06])
  // Panel lines: the hood's edges and front, and the trunk lid on cars with a trunk.
  const hoodLen = hoodFront - cowl
  if (!s.plates && !s.dog && !s.armor && hoodLen > 0.12) {
    for (const sd of [-1, 1]) k.add('dark', box(0.005, 0.003, hoodLen), [sd * s.wid * 0.4, hoodY + 0.002, (hoodFront + cowl) / 2])
    k.add('dark', box(s.wid * 0.8, 0.003, 0.005), [0, hoodY + 0.002, hoodFront - 0.005])
  }
  const deckLen = s.cabinZ - s.cabinLen / 2 - (-front + 0.04)
  if (!s.open && !s.round && !s.bed && !s.tracks && deckLen > 0.16) {
    for (const sd of [-1, 1]) k.add('dark', box(0.005, 0.003, deckLen), [sd * s.wid * 0.38, top + 0.002, -front + 0.04 + deckLen / 2])
    k.add('dark', box(s.wid * 0.76, 0.003, 0.005), [0, top + 0.002, -front + 0.04 + deckLen])
  }
  // Wheel arch lips: a thin dark band round each opening on road cars.
  if (!s.plates && !s.tracks && !s.flares && !RUGGED.includes(body) && !s.open) {
    for (const z of [wz, -wz]) for (const sd of [-1, 1]) k.add('dark', new TorusGeometry(s.wheel * 1.2, 0.008, 3, 14, Math.PI), [sd * (s.wid / 2 + 0.004), s.wheel, z], [0, (sd * Math.PI) / 2, 0], [1, 1, 0.6])
  }
  if (!s.tracks) brakes(k, s.track ?? s.wid / 2 - 0.02, wz, s.wheel, 0.14)
  // This model's own trim (see carTrim.ts).
  trimCar(k, model, {
    len: s.len, wid: s.wid, lift: s.lift, body: s.body, wheel: s.wheel, cabinZ: s.cabinZ, cabinLen: s.cabinLen,
    top, hoodY, bulge: s.hood * 2 > 0 ? s.hood : 0, hoodFront, cowl, front, wz, lightY, plateY, nose: noseAt, exhaust: !!fit.exhaust, ty, roofY, roofLen, roofZ, closed,
  })

  // Wheel: one mesh per wheel. The tread and the spoked rim share one texture,
  // so tyre and rim are a single draw.
  const wheel = new CylinderGeometry(s.wheel, s.wheel, 0.14, 18, 1)
  const uv = wheel.getAttribute('uv')
  const side = (18 + 1) * 2
  for (let i = 0; i < uv.count; i++) uv.setX(i, i < side ? 0.5 + uv.getX(i) * 0.5 : uv.getX(i) * 0.5)
  wheel.rotateZ(Math.PI / 2)

  const out = { parts: k.build(), wheel }
  geoCache.set(key, out)
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
  dash: new MeshStandardMaterial({ color: '#26282b', roughness: 0.7, metalness: 0.2 }),
  rubber: new MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.92 }),
  display: new MeshBasicMaterial({ color: '#7fd0ff' }),
}
// Tinted glass you can see the cabin through, for cars shown whole. Town traffic
// bakes MAT.glass solid instead.
const seeGlass = new MeshStandardMaterial({ color: '#3d6a8c', metalness: 0.6, roughness: 0.04, transparent: true, opacity: 0.55, depthWrite: false })
// One material per seat, caliper or rim colour in use.
const tinted = new Map<string, MeshStandardMaterial>()
function matOf(key: string, color: string, metal: number, rough: number) {
  const k = `${key}|${color}|${metal}|${rough}`
  let m = tinted.get(k)
  if (!m) tinted.set(k, (m = new MeshStandardMaterial({ color, metalness: metal, roughness: rough })))
  return m
}
// Wheel materials: stock, and one per rim finish from the Rims mod.
const wheelMats = new Map<string, MeshStandardMaterial>()
function wheelMaterial(rim?: string) {
  const look = rim ? RIM_LOOK[rim] : undefined
  const key = look ? rim! : ''
  let m = wheelMats.get(key)
  if (!m) wheelMats.set(key, (m = new MeshStandardMaterial({ map: wheelTex(), color: look?.[0] ?? '#ffffff', metalness: look?.[1] ?? 0.35, roughness: look?.[2] ?? 0.6 })))
  return m
}

// A rims mod swaps the stock rim for its own style and finish.
const RIM_STYLE: Record<string, RimStyle> = { chrome: 'deep', goldmesh: 'mesh', forged: 'split' }

// Close-up wheels: a tyre and a 3D rim each, steering and rolling with the rig.
function Wheels({ at, r, w, rig, rims, rusty, look }: { at: number[][]; r: number; w: number; rig?: WheelRig; rims?: string; rusty?: boolean; look: CarStyle }) {
  const mod = rims ? RIM_LOOK[rims] : undefined
  const style = (rims && RIM_STYLE[rims]) || look.rim
  const geo = wheelGeo(style, r, w, look.ww && !mod)
  const rim = rusty ? matOf('rim', '#7a5a44', 0.2, 0.9) : mod ? matOf('rim', mod[0], Math.max(0.6, mod[1] + 0.4), mod[2]) : matOf('rim', look.rimColor ?? '#d5d9de', 0.75, 0.28)
  return (
    <>
      {at.map(([x, z], i) => (
        <group key={i} position={[x, r, z]} ref={rig && i < 2 ? (o) => void (rig.steer[i] = o) : undefined}>
          <group ref={rig ? (o) => void (rig.spin[i] = o) : undefined}>
            <mesh geometry={geo.tire} material={MAT.rubber} castShadow />
            <mesh geometry={geo.rims[x < 0 ? 0 : 1]} material={rim} />
          </group>
        </group>
      ))}
    </>
  )
}

// Handles on a car's wheels so a driving car can steer the front pair and roll all four.
// `slots`: where a lean car's wheels are drawn in the shared wheel pool (see carBatch.ts).
export type WheelRig = { steer: (Group | null)[]; spin: (Group | null)[]; radius: number; base: number; slots?: (WheelSlot | null)[] }

// lean: draw the body as one merged mesh and the wheels from the shared pool (town
// traffic). Needs `rig`, whose owner places the wheels each frame; no exhaust flames.
// skin: a skin id (game/data.ts SKINS) drawn into the paint.
type CarProps = { body: Body; model?: string; color: string; finish?: Finish | null; skin?: string | null; highlight?: boolean; stripe?: string | null; beams?: boolean; rusty?: boolean; rig?: WheelRig; mods?: string[] | null; flames?: boolean; lean?: boolean }

// A lean car: every part baked into two meshes (the parts that cast a shadow and the
// rest) with the finish it would otherwise be drawn with, except the see-through screen;
// the wheels' groups stay for steering and rolling but are drawn from the shared wheel pool.
// `extra` is drawn as is (chrome paint, which mirrors its own studio and can't be baked).
function LeanCar({ parts, looks, casters, mods, modPaint, highlight, wheels, radius, width, rims, rig, beams, extra }: {
  parts: Partial<Record<Part, BufferGeometry>>; looks: Partial<Record<Part, Look>>; casters: Part[]
  mods: { body: Body; ids: string[] }; modPaint: Look; highlight?: boolean
  wheels: V3[]; radius: number; width: number; rims?: string; rig: WheelRig; beams: React.ReactNode; extra?: React.ReactNode
}) {
  const key = (Object.keys(looks) as Part[]).map((k) => `${k}:${parts[k]?.uuid ?? 0}:${JSON.stringify(looks[k])}`).join() + mods.ids.join() + JSON.stringify(modPaint)
  const geo = useMemo(() => {
    const shade: [BufferGeometry, Look][] = []
    const rest: [BufferGeometry, Look][] = []
    for (const k of Object.keys(looks) as Part[]) if (parts[k] && looks[k]) (casters.includes(k) ? shade : rest).push([parts[k]!, looks[k]!])
    // Mod paint and carbon cast shadows; mod chrome doesn't.
    const m = mods.ids.length ? modGeo(mods.body, mods.ids) : {}
    if (m.paint) shade.push([m.paint, modPaint])
    if (m.carbon) shade.push([m.carbon, finishOf(carbon)])
    if (m.chrome) rest.push([m.chrome, finishOf(modChrome)])
    // Glass mod parts (bike screens, bubbles) bake solid in town traffic.
    if (m.glass) rest.push([m.glass, finishOf(modGlass)])
    return { shade: shade.length ? bake(shade) : null, rest: rest.length ? bake(rest) : null }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    geo.shade?.dispose()
    geo.rest?.dispose()
  }, [geo])
  useEffect(() => {
    const mat = wheelMaterial(rims)
    rig.slots = wheels.map(() => wheelPool.take(mat, radius, width))
    return () => {
      rig.slots?.forEach((w) => w && wheelPool.give(w))
      rig.slots = undefined
    }
  }, [rig, rims, radius, width, wheels.length]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      {geo.shade && <mesh geometry={geo.shade} material={highlight ? carBody.picked : carBody.plain} castShadow />}
      {geo.rest && <mesh geometry={geo.rest} material={highlight ? carBody.picked : carBody.plain} />}
      {parts.screen && <mesh geometry={parts.screen} material={MAT.screen} />}
      {extra}
      {beams}
      {wheels.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} ref={i < (wheels.length === 2 ? 1 : 2) ? (o) => void (rig.steer[i] = o) : undefined}>
          <group ref={(o) => void (rig.spin[i] = o)} />
        </group>
      ))}
    </group>
  )
}

// Any vehicle: a motorcycle for bike bodies, otherwise a car. Faces +z.
export function CarModel(props: CarProps) {
  return isBike(props.body) ? <BikeModel {...props} /> : <CarBody {...props} />
}

// The body paint: glossy, matte or chrome, with a skin (by number) drawn into it. Rust is always flat.
function PaintMaterial({ color, finish, rusty, highlight, skin = 0 }: { color: string; finish?: Finish | null; rusty?: boolean; highlight?: boolean; skin?: number }) {
  const [metal, rough, lift] = rusty ? [0.1, 0.95, 0] : FINISH_LOOK[finish ?? 'gloss'] ?? FINISH_LOOK.gloss
  const tint = useMemo(() => (lift ? '#' + new Color(color).lerp(new Color('#ffffff'), lift).getHexString() : color), [color, lift])
  const gl = useThree((s) => s.gl)
  const env = !rusty && finish === 'chrome' ? chromeEnv(gl) : null
  const skinHook = useMemo(() => (skin ? { onBeforeCompile: (sh: Parameters<typeof withSkin>[0]) => withSkin(sh, String(skin)), customProgramCacheKey: () => `skin-${skin}` } : {}), [skin])
  return <meshStandardMaterial key={`${env ? 'chrome' : 'paint'}-${skin}`} {...skinHook} color={tint} metalness={metal} roughness={rough} envMap={env} envMapIntensity={env ? 1.3 : 1} emissive={highlight ? '#ffffff' : '#000000'} emissiveIntensity={highlight ? 0.25 : 0} />
}

// The same paint as PaintMaterial, for baking (any finish but chrome).
// A chrome car with a skin bakes as chrome-like metal, without its studio reflections.
function paintLook(color: string, finish?: Finish | null, rusty?: boolean, skin = 0): Look {
  const [metal, rough, lift] = rusty ? [0.1, 0.95, 0] : FINISH_LOOK[finish ?? 'gloss'] ?? FINISH_LOOK.gloss
  return { color: lift ? '#' + new Color(color).lerp(new Color('#ffffff'), lift).getHexString() : color, metal: Math.min(metal, 0.75), rough: Math.max(rough, skin ? 0.2 : 0), glow: true, skin }
}

// Toy-style car: bevelled extruded body and cabin so no edge is a hard box corner. Faces +z.
function CarBody({ body, model, color, finish, skin, highlight, stripe, beams, rusty, rig, mods, flames, lean }: CarProps) {
  // Rusty finds come home stock.
  const fit = rusty ? {} : fittedMods(mods, body)
  const sk = rusty ? 0 : skinNumber(skin)
  useFrame(() => void (sk && tickSkins()))
  const s = shapeOf(body)
  const g = carGeo(body, fit, model)
  const p = g.parts
  // Rusty finds keep a hint of their paint under brown, matte rust.
  const tint = useMemo(() => (rusty ? '#' + new Color(color).lerp(new Color('#8a5a3c'), 0.72).getHexString() : color), [color, rusty])
  const dark = useMemo(() => '#' + new Color(tint).multiplyScalar(0.6).getHexString(), [tint])
  const wz = s.len * 0.33
  const wx = s.track ?? s.wid / 2 - 0.02
  const shared = (['black', 'chrome', 'screen', 'seat', 'wood', 'lamp', 'tail', 'amber', 'dash', 'display'] as const).filter((k) => p[k])
  const look = carStyle(model)
  const beam = beams && (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, s.len / 2 + 0.55]} renderOrder={2}>
      <planeGeometry args={[s.wid * 1.5, 1.3]} />
      <primitive object={glowMats.beam} attach="material" dispose={null} />
    </mesh>
  )
  if (lean && rig) {
    const chromed = !rusty && finish === 'chrome' && !sk
    const looks: Partial<Record<Part, Look>> = {
      ...(chromed ? {} : { paint: paintLook(tint, finish, rusty, sk) }), dark: { color: dark }, ...(stripe ? { stripe: { color: stripe } } : {}),
      black: finishOf(MAT.black), chrome: finishOf(MAT.chrome), glass: finishOf(MAT.glass), seat: finishOf(MAT.seat), wood: finishOf(MAT.wood),
      lamp: finishOf(MAT.lamp), tail: finishOf(MAT.tail), amber: finishOf(MAT.amber),
    }
    return (
      <LeanCar parts={p} looks={looks} casters={['paint', 'glass']} mods={{ body, ids: modIds(fit) }} modPaint={{ color: tint, metal: rusty ? 0.1 : 0.4, rough: 0.3 }} highlight={highlight}
        wheels={[[-wx, s.wheel, wz], [wx, s.wheel, wz], [-wx, s.wheel, -wz], [wx, s.wheel, -wz]]} radius={s.wheel} width={0.14} rims={fit.rims} rig={rig} beams={beam}
        extra={chromed && <mesh geometry={p.paint} castShadow><PaintMaterial color={tint} finish={finish} highlight={highlight} /></mesh>} />
    )
  }
  return (
    <group>
      <mesh geometry={p.paint} castShadow>
        <PaintMaterial color={tint} finish={finish} rusty={rusty} highlight={highlight} skin={sk} />
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
      {shared.map((k) => <mesh key={k} geometry={p[k]} material={MAT[k]} />)}
      {p.glass && <mesh geometry={p.glass} material={seeGlass} castShadow />}
      {p.cabin && <mesh geometry={p.cabin} material={matOf('seat', look.seat ?? '#2b2b2b', 0, 0.75)} />}
      {p.caliper && <mesh geometry={p.caliper} material={matOf('cal', look.caliper ?? '#4a4d52', look.caliper ? 0.2 : 0.5, 0.45)} />}
      <CarMods body={body} fit={fit} tint={tint} metal={rusty ? 0.1 : 0.4} flames={flames} />
      {/* Headlight beams on the road, visible after dark. */}
      {beam}
      <Wheels at={[[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]} r={s.wheel} w={s.track ? 0.16 : 0.14} rig={rig} rims={fit.rims} rusty={rusty} look={look} />
    </group>
  )
}

// A box stretched from a to b (a strut, a limb, a fork leg).
function bar(k: Kit, part: Part, a: V3, b: V3, t: number) {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize())
  const e = new Euler().setFromQuaternion(q)
  k.add(part, rbox(t, d.length() + t, t, t * 0.45), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [e.x, e.y, e.z])
}

function bikeGeo(body: BikeBody, fit: Partial<Record<ModSlot, string>>, model?: string): CarGeo {
  const key = `${body}|${model ?? ''}|${fit.exhaust ? 1 : 0}`
  const hit = geoCache.get(key)
  if (hit) return hit
  const s = SHAPES[body]
  const b = BIKE[body]
  const k = new Kit()
  const r = s.wheel
  const [hy, hz] = b.head
  const [sy, sz] = b.seat
  // Fork legs from the front axle up to the steering head, with a fender over the tyre.
  for (const x of [-0.045, 0.045]) bar(k, 'chrome', [x, r, b.wz], [x, hy, hz], 0.022)
  k.add('paint', rbox(0.08, 0.025, r * 1.3, 0.012), [0, r * 2 + 0.03, b.wz], [-0.15, 0, 0])
  // Headlight and handlebars.
  k.add('black', cyl(0.05, 0.045, 0.05, 12), [0, hy - 0.02, hz + 0.05], [Math.PI / 2, 0, 0])
  k.add('lamp', disc(0.042, 12), [0, hy - 0.02, hz + 0.077])
  for (const sd of [-1, 1]) bar(k, 'black', [0, hy + 0.02, hz - 0.01], [sd * 0.19, hy + 0.04 + b.bars, hz - 0.05], 0.018)
  for (const sd of [-1, 1]) k.add('black', cyl(0.014, 0.014, 0.05, 6), [sd * 0.2, hy + 0.04 + b.bars, hz - 0.05], [0, 0, Math.PI / 2])
  // Frame from the head back to the rear axle, and the swingarm.
  bar(k, 'black', [0, hy - 0.04, hz - 0.02], [0, sy - 0.08, sz - 0.1], 0.04)
  for (const x of [-0.05, 0.05]) bar(k, 'black', [x, r, -b.wz], [x, r + 0.08, -0.04], 0.026)
  // Engine between the wheels.
  if (body === 'scooter') {
    // Step-through: a floorboard, a leg shield up to the bars, and a round body over the rear wheel.
    k.add('paint', rbox(0.2, 0.04, 0.28, 0.015), [0, r + 0.05, 0.02])
    k.add('paint', rbox(0.24, hy - r - 0.04, 0.05, 0.02), [0, (hy + r) / 2, hz - 0.02], [-0.18, 0, 0])
    k.add('paint', new SphereGeometry(1, 14, 10), [0, r + 0.15, -b.wz + 0.08], [0, 0, 0], [0.13, 0.14, 0.2])
    k.add('dark', rbox(0.12, 0.1, 0.16, 0.03), [0.05, r + 0.03, -b.wz + 0.05])
  } else {
    k.add('chrome', rbox(0.14, 0.13, 0.17, 0.03), [0, r + 0.1, 0.02])
    // V-twin cylinders on the cruiser, a sloped block on the sport bike.
    if (body === 'chopper') for (const sd of [-1, 1]) k.add('chrome', cyl(0.045, 0.05, 0.14, 10), [0, r + 0.22, 0.02 + sd * 0.05], [sd * 0.45, 0, 0])
    else k.add('dark', rbox(0.15, 0.1, 0.12, 0.03), [0, r + 0.2, 0.06], [0.3, 0, 0])
    // Fuel tank between the head and the seat.
    k.add('paint', rbox(0.16, 0.1, (hz - sz) * 0.62, 0.045), [0, (hy + sy) / 2 - 0.02, (hz + sz) / 2 + 0.02], [body === 'sportbike' ? 0.2 : 0.08, 0, 0])
  }
  // Seat, a rear fender with the tail light.
  k.add('seat', rbox(0.15, 0.05, 0.26, 0.022), [0, sy, sz])
  k.add('paint', rbox(0.1, 0.03, r * 1.5, 0.012), [0, r * 2 + 0.03, -b.wz + 0.02], [0.2, 0, 0])
  k.add('tail', plane(0.07, 0.03), [0, r * 2 + 0.06, -b.wz - r * 0.7], [0, Math.PI, 0])
  if (body === 'sportbike') {
    // Full fairing round the head, a tinted screen, a belly pan and a raised tail.
    k.add('paint', rbox(0.2, 0.2, 0.22, 0.06), [0, hy - 0.1, hz + 0.02], [0.35, 0, 0])
    k.add('screen', box(0.15, 0.1, 0.01), [0, hy + 0.05, hz - 0.01], [-0.7, 0, 0])
    k.add('paint', rbox(0.16, 0.08, 0.3, 0.03), [0, r + 0.02, 0.04], [-0.1, 0, 0])
    k.add('paint', rbox(0.12, 0.08, 0.2, 0.03), [0, sy + 0.03, sz - 0.2], [-0.3, 0, 0])
  }
  if (body === 'chopper') {
    // Sissy bar behind the seat and chrome crash bars by the engine.
    bar(k, 'chrome', [0, sy, sz - 0.14], [0, sy + 0.2, sz - 0.18], 0.02)
    k.add('seat', rbox(0.12, 0.1, 0.03, 0.015), [0, sy + 0.16, sz - 0.16])
    for (const sd of [-1, 1]) k.add('chrome', new TorusGeometry(0.07, 0.01, 5, 10, Math.PI), [sd * 0.1, r + 0.12, 0.14], [0, Math.PI / 2, Math.PI / 2])
  }
  // Stock exhaust down the right side.
  if (!fit.exhaust) {
    bar(k, 'chrome', [0.08, r + 0.06, 0.06], [0.1, r + 0.03, -b.wz + 0.02], 0.03)
    k.add('chrome', cyl(0.03, 0.03, 0.12, 10), [0.1, r + 0.04, -b.wz - 0.02], [Math.PI / 2 - 0.1, 0, 0])
  }
  // Rider: helmet in the bike's paint, dark jacket, legs to the pegs, hands on the grips.
  const hip: V3 = [0, sy + 0.07, sz]
  const neck: V3 = [0, sy + 0.32 - b.lean * 0.3, sz + 0.06 + b.lean * 0.5]
  bar(k, 'black', hip, neck, 0.15)
  k.add('paint', new SphereGeometry(0.075, 12, 10), [0, neck[1] + 0.09, neck[2] + 0.01])
  k.add('glass', new SphereGeometry(0.068, 10, 6, -Math.PI / 2.6, Math.PI / 1.3, Math.PI / 3, Math.PI / 3.2), [0, neck[1] + 0.085, neck[2] + 0.02])
  for (const sd of [-1, 1]) {
    bar(k, 'black', [sd * 0.08, neck[1] - 0.03, neck[2]], [sd * 0.19, hy + 0.04 + b.bars, hz - 0.06], 0.05)
    const knee: V3 = [sd * 0.1, sy + 0.04, sz + 0.2]
    bar(k, 'dark', [sd * 0.06, hip[1], hip[2]], knee, 0.07)
    bar(k, 'dark', knee, [sd * 0.1, r + 0.05, sz + (body === 'chopper' ? 0.36 : 0.12)], 0.06)
  }
  trimBike(k, model, { r, wz: b.wz, head: b.head, seat: b.seat })

  const wheel = new CylinderGeometry(r, r, 0.07, 18, 1)
  const uv = wheel.getAttribute('uv')
  const side = (18 + 1) * 2
  for (let i = 0; i < uv.count; i++) uv.setX(i, i < side ? 0.5 + uv.getX(i) * 0.5 : uv.getX(i) * 0.5)
  wheel.rotateZ(Math.PI / 2)
  const out = { parts: k.build(), wheel }
  geoCache.set(key, out)
  return out
}

// Bikes take every mod slot, with bike-sized parts.
function BikeModel({ body, model, color, finish, skin, highlight, beams, rusty, rig, mods, flames, lean }: CarProps) {
  const fit = rusty ? {} : fittedMods(mods, body)
  const sk = rusty ? 0 : skinNumber(skin)
  useFrame(() => void (sk && tickSkins()))
  const bb = body as BikeBody
  const g = bikeGeo(bb, fit, model)
  const p = g.parts
  const tint = useMemo(() => (rusty ? '#' + new Color(color).lerp(new Color('#8a5a3c'), 0.72).getHexString() : color), [color, rusty])
  const dark = useMemo(() => '#' + new Color('#37474f').lerp(new Color(tint), 0.15).getHexString(), [tint])
  const shared = (['black', 'chrome', 'glass', 'screen', 'seat', 'lamp', 'tail'] as const).filter((k) => p[k])
  const r = SHAPES[bb].wheel
  const wz = BIKE[bb].wz
  // Close-up wheels: wire spokes on the cruiser, split spokes on the sport bike, pressed steel on the scooter.
  const bikeStyle: RimStyle = (fit.rims && RIM_STYLE[fit.rims]) || (bb === 'chopper' ? 'wire' : bb === 'sportbike' ? 'split' : 'steel')
  const bw = wheelGeo(bikeStyle, r, 0.07)
  const rimLook = fit.rims ? RIM_LOOK[fit.rims] : undefined
  const bikeRim = rusty ? matOf('rim', '#7a5a44', 0.2, 0.9) : rimLook ? matOf('rim', rimLook[0], Math.max(0.6, rimLook[1] + 0.4), rimLook[2]) : matOf('rim', bb === 'sportbike' ? '#2b2b2b' : '#d5d9de', 0.75, 0.28)
  const beam = beams && (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, SHAPES[bb].len / 2 + 0.5]} renderOrder={2}>
      <planeGeometry args={[0.5, 1.1]} />
      <primitive object={glowMats.beam} attach="material" dispose={null} />
    </mesh>
  )
  if (lean && rig) {
    const chromed = !rusty && finish === 'chrome' && !sk
    const looks: Partial<Record<Part, Look>> = {
      ...(chromed ? {} : { paint: paintLook(tint, finish, rusty, sk) }), dark: { color: dark },
      black: finishOf(MAT.black), chrome: finishOf(MAT.chrome), glass: finishOf(MAT.glass), seat: finishOf(MAT.seat),
      lamp: finishOf(MAT.lamp), tail: finishOf(MAT.tail),
    }
    return (
      <LeanCar parts={p} looks={looks} casters={['paint', 'black']} mods={{ body, ids: modIds(fit) }} modPaint={{ color: tint, metal: rusty ? 0.1 : 0.4, rough: 0.3 }} highlight={highlight}
        wheels={[[0, r, wz], [0, r, -wz]]} radius={r} width={0.07} rims={fit.rims} rig={rig} beams={beam}
        extra={chromed && <mesh geometry={p.paint} castShadow><PaintMaterial color={tint} finish={finish} highlight={highlight} /></mesh>} />
    )
  }
  return (
    <group>
      <mesh geometry={p.paint} castShadow>
        <PaintMaterial color={tint} finish={finish} rusty={rusty} highlight={highlight} skin={sk} />
      </mesh>
      {p.dark && (
        <mesh geometry={p.dark}>
          <meshStandardMaterial color={dark} />
        </mesh>
      )}
      {shared.map((k) => <mesh key={k} geometry={p[k]} material={MAT[k]} castShadow={k === 'black'} />)}
      <CarMods body={body} fit={fit} tint={tint} metal={rusty ? 0.1 : 0.4} flames={flames} />
      {beam}
      {[wz, -wz].map((z, i) => (
        <group key={i} position={[0, r, z]} ref={rig && i === 0 ? (o) => void (rig.steer[0] = o) : undefined}>
          <group ref={rig ? (o) => void (rig.spin[i] = o) : undefined}>
            <mesh geometry={bw.tire} material={MAT.rubber} castShadow />
            {bw.rims.map((g, j) => <mesh key={j} geometry={g} material={bikeRim} />)}
          </group>
        </group>
      ))}
    </group>
  )
}
