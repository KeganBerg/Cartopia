import { BufferGeometry, CircleGeometry, CylinderGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute, Quaternion, Shape, TorusGeometry, Vector2, Vector3 } from 'three'
import type { Kit, Part } from '../CarModel'
import { Loft, type Section } from '../loft'
import { Surface, bodyRing, box, disc, glassRing, greenhouse, honey, plane, poly, rbox, slab, vent, type ExoticFit, type ExoticHelpers } from '../exoticCars'

// ---------------------------------------------------------------------------
// Falke Sturm S1: a mid-1980s rally monster. A short, boxy hatchback with square box
// arches bolted out over all four tyres, a scoop on the roof feeding the engine behind
// the seats, louvred rear quarter windows, a big wing on the hatch, a pod of four round
// spotlights on the nose, a chunky bumper with an intake, mud flaps and a roll cage
// through the glass. Our own drawing; the name is invented.

type V3 = [number, number, number]
const SIDES = [-1, 1] as const
export const STURM = { len: 1.34, wid: 0.84, wheel: 0.15 }

// One flat facet through world points (a fan), with normals and uvs so it merges with the rest.
function facet(pts: V3[]) {
  const pos: number[] = []
  for (let i = 1; i + 1 < pts.length; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) pos.push(...p)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
  g.computeVertexNormals()
  return g
}

// A box arch seen from the side: (z, y) outline with the wheel opening cut up from below,
// extruded across the car from x = sd * out inward by d, with a small rolled edge.
function flare(sd: number, outline: [number, number][], out: number, d: number) {
  const e = 0.006
  const sh = new Shape(outline.map(([z, y]) => new Vector2(sd > 0 ? z : -z, y)))
  const g = new ExtrudeGeometry(sh, { depth: d - 2 * e, bevelEnabled: true, bevelSize: e, bevelThickness: e, bevelSegments: 2, curveSegments: 14 })
  // Shape x is car z (mirrored on the left), extrusion depth runs inward from the outer face.
  g.translate(0, 0, e)
  g.rotateY(sd > 0 ? -Math.PI / 2 : Math.PI / 2)
  g.translate(sd * out, 0, 0)
  return g
}

// The side outline of one box arch: bottom b, flat top t, ends z0 (front) and z1 (back),
// an opening of radius R round (wz, cy). rake: how far the top corners pull in.
function archOutline(z0: number, z1: number, b: number, t: number, wz: number, R: number, cy: number, rakeF: number, rakeB: number): [number, number][] {
  const out: [number, number][] = [[z1, b], [wz - R, b]]
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI - (i / 16) * Math.PI
    out.push([wz + Math.cos(a) * R, cy + Math.sin(a) * R])
  }
  out.push([wz + R, b], [z0, b], [z0, t - rakeF], [z0 - rakeF * 0.9, t], [z1 + rakeB * 1.2, t], [z1, t - rakeB])
  return out
}

// A big round spotlight facing forward: a deep chrome bezel, the lens, a reflector
// ring, a dark bulb cap and a strip of black tape across it, rally style.
function spot(k: Kit, x: number, y: number, z: number, r: number) {
  const can = new CylinderGeometry(r + 0.007, r + 0.004, 0.032, 18, 1)
  k.add('black', can, [x, y, z + 0.016], [Math.PI / 2, 0, 0])
  k.add('chrome', new TorusGeometry(r + 0.004, 0.0045, 4, 18), [x, y, z + 0.033])
  k.add('lamp', disc(r, 18), [x, y, z + 0.0345])
  k.add('chrome', new TorusGeometry(r * 0.55, 0.002, 3, 16), [x, y, z + 0.0365])
  k.add('dark', disc(r * 0.22, 10), [x, y, z + 0.0375])
  k.add('black', box(r * 1.9, 0.006, 0.002), [x, y, z + 0.0405], [0, 0, 0.6])
}

// A straight rod from a to b (cheap: six sides), for the cage and stays seen through glass.
function rod(k: Kit, part: Part, a: V3, b: V3, t: number) {
  const v = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), v.clone().normalize()))
  k.add(part, new CylinderGeometry(t / 2, t / 2, v.length() + t * 0.6, 6, 1), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [e.x, e.y, e.z])
}

// A flat slat from a to b, w across and d thick.
function slat(k: Kit, part: Part, a: V3, b: V3, w: number, d: number) {
  const v = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), v.clone().normalize()))
  k.add(part, box(d, v.length(), w), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [e.x, e.y, e.z])
}

// A lofted hump with flat sides and a soft top (a roof scoop): keys [z, half width, top].
function hump(keys: [number, number, number][], base: number) {
  const secs: Section[] = keys.map(([z, w, top]) => {
    const h = top - base
    return { z, pts: [[0, base], [w, base, true], [w, base + h * 0.7], [w * 0.8, top - 0.002], [0, top]] }
  })
  return new Loft(secs, 3).geometry({ capFront: true, capBack: true })
}

export function groupBGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = STURM.wheel
  const wz = STURM.len * 0.33
  const front = STURM.len / 2
  const tz = -front

  // Body: a slab-sided box with a flat bonnet, a short square nose and a square tail.
  // z, half width, bottom, shoulder, deck edge, crease x, middle height
  const body = new Loft([
    bodyRing(0.67, 0.368, 0.105, 0.24, 0.258, 0.28, 0.262),
    bodyRing(0.645, 0.388, 0.095, 0.262, 0.28, 0.3, 0.283),
    bodyRing(0.56, 0.395, 0.09, 0.278, 0.296, 0.3, 0.298),
    bodyRing(0.4, 0.395, 0.09, 0.29, 0.307, 0.3, 0.309),
    bodyRing(0.24, 0.395, 0.09, 0.298, 0.316, 0.3, 0.319),
    bodyRing(0.0, 0.395, 0.09, 0.304, 0.321, 0.3, 0.325),
    bodyRing(-0.3, 0.395, 0.09, 0.308, 0.325, 0.3, 0.329),
    bodyRing(-0.56, 0.395, 0.09, 0.308, 0.325, 0.3, 0.33),
    bodyRing(-0.645, 0.39, 0.095, 0.304, 0.322, 0.29, 0.327),
    bodyRing(-0.67, 0.375, 0.105, 0.294, 0.314, 0.28, 0.32),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)

  // Greenhouse: an upright windshield, a flat roof, slab side glass and a steep hatch.
  const glass = new Loft([
    glassRing(0.245, 0.343, 0.316, 0.33, 0.324),
    glassRing(0.16, 0.348, 0.319, 0.298, 0.43),
    glassRing(0.08, 0.348, 0.321, 0.288, 0.488),
    glassRing(0.0, 0.348, 0.322, 0.285, 0.504),
    glassRing(-0.15, 0.348, 0.324, 0.285, 0.51),
    glassRing(-0.3, 0.348, 0.326, 0.285, 0.506),
    glassRing(-0.4, 0.346, 0.327, 0.282, 0.47),
    glassRing(-0.5, 0.336, 0.328, 0.272, 0.39),
    glassRing(-0.56, 0.326, 0.328, 0.262, 0.338),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  greenhouse(k, h, glass, { roof: [0.07, -0.33], pillar: [0.245, 0.07], belt: [0.245, -0.52], mirror: [0.17, 0.33, 0.35], roofPart: 'paint' })
  const roofY = (z: number) => glass.near(z).pts[4][1] + 0.009

  // Box arches over all four tyres, standing well out of the doors, each lined black.
  const out = 0.462
  const R = 0.172
  const cy = r - 0.005
  const arches: { z0: number; z1: number; c: number }[] = [
    { z0: 0.655, z1: 0.228, c: wz },
    { z0: -0.228, z1: -0.66, c: -wz },
  ]
  for (const a of arches) for (const sd of SIDES) {
    const rear = a.c < 0
    k.add('paint', flare(sd, archOutline(a.z0, a.z1, 0.108, 0.345, a.c, R, cy, rear ? 0.02 : 0.03, rear ? 0.03 : 0.02), out, 0.095))
    // Black liner inside the opening and a dark lip round its edge.
    const liner = new CylinderGeometry(R - 0.002, R - 0.002, 0.13, 18, 1, true, -Math.PI / 2, Math.PI)
    liner.rotateZ(Math.PI / 2)
    liner.rotateX(-Math.PI / 2)
    k.add('black', liner, [sd * 0.4, cy, a.c], [0, 0, 0])
    k.add('black', new CircleGeometry(R, 18, 0, Math.PI), [sd * 0.399, cy, a.c], [0, sd * Math.PI / 2, 0])
    k.add('dark', new TorusGeometry(R - 0.006, 0.0065, 4, 20, Math.PI), [sd * (out - 0.004), cy, a.c], [0, Math.PI / 2, 0])
  }
  // The rear arches breathe: an intake in the face of each, ahead of the rear wheel.
  for (const sd of SIDES) {
    const fz = -0.228 + 0.006
    k.add('black', poly([[-0.03, -0.075], [0.03, -0.075], [0.03, 0.06], [-0.02, 0.07]].map(([x, y]) => [x * sd, y])), [sd * 0.425, 0.24, fz + 0.003])
    for (const dy of [-0.045, -0.015, 0.015, 0.045]) k.add('dark', box(0.058, 0.005, 0.004), [sd * 0.425, 0.24 + dy, fz + 0.006])
    // Small cooling slots in the top of the front arches, behind the wheel.
    for (let i = 0; i < 3; i++) k.add('black', plane(0.05, 0.012), [sd * 0.415, 0.3455 + 0.0025, 0.3 - i * 0.025], [-Math.PI / 2, 0, 0])
  }

  // Quick-release fuel filler on top of the right rear arch.
  k.add('chrome', new CylinderGeometry(0.02, 0.02, 0.008, 14), [0.415, 0.351 + 0.004, -0.36])
  k.add('dark', disc(0.013, 12), [0.415, 0.3615, -0.36], [-Math.PI / 2, 0, 0])

  // Sides: a black sill between the arches, door cuts, a handle, a livery band that runs
  // across the doors and the arches, and a racing number on each door.
  for (const sd of SIDES) {
    if (!fit.kit) k.add('black', rbox(0.04, 0.05, 0.46, 0.012), [sd * 0.39, 0.105, 0])
    S.wall('dark', plane(0.005, 0.19), sd, 0.215, 0.215, 0.003)
    S.wall('dark', plane(0.005, 0.19), sd, -0.2, 0.215, 0.003)
    S.wall('dark', plane(0.41, 0.005), sd, 0.0, 0.135, 0.003)
    S.wall('black', rbox(0.05, 0.012, 0.012, 0.004), sd, -0.15, 0.285, 0.004)
    // Livery band (drawn only when painted on): low on the doors, over the arches' faces.
    S.wall('stripe', plane(0.46, 0.05), sd, 0, 0.17, 0.006)
    for (const a of arches) {
      const zm = (a.z0 + a.z1) / 2
      const l = Math.abs(a.z0 - a.z1) - 0.03
      k.add('stripe', plane(l, 0.035), [sd * (out + 0.003), 0.32, zm], [0, sd * Math.PI / 2, 0])
    }
    // Number board: a white square with a black 8 on it (it reads the same from either side).
    S.wall('lamp', rbox(0.1, 0.08, 0.003, 0.008), sd, 0.02, 0.24, 0.003)
    for (const dy of [-0.014, 0.014]) S.wall('black', new TorusGeometry(0.011, 0.0035, 4, 14), sd, 0.02, 0.24 + dy, 0.0055)
    // Amber marker on the front arch, red on the rear.
    k.add('amber', plane(0.035, 0.014), [sd * (out + 0.003), 0.2, 0.62], [0, sd * Math.PI / 2, 0])
    k.add('tail', plane(0.035, 0.014), [sd * (out + 0.003), 0.2, -0.625], [0, sd * Math.PI / 2, 0])
  }

  // Louvred rear quarter windows: a black panel over the side glass with body slats.
  for (const sd of SIDES) {
    const z0 = -0.19
    const z1 = -0.41
    const at = (z: number, t: number): V3 => {
      const p = glass.near(z).pts
      const x = p[1][0] + (p[2][0] - p[1][0]) * t
      const y = p[1][1] + (p[2][1] - p[1][1]) * t
      const ux = p[2][0] - p[1][0]
      const uy = p[2][1] - p[1][1]
      const l = Math.hypot(ux, uy)
      return [sd * (x + (uy / l) * 0.004), y - (ux / l) * 0.004, z]
    }
    const quad: V3[] = [at(z0, 0.08), at(z1, 0.08), at(z1, 0.9), at(z0, 0.92)]
    k.add('black', facet(sd > 0 ? quad : [quad[0], quad[3], quad[2], quad[1]]))
    for (let i = 0; i < 5; i++) {
      const t = 0.16 + i * 0.16
      const a = at(z0 - 0.008, t)
      const b = at(z1 + 0.008, t)
      const lift = (p: V3): V3 => [p[0] + sd * 0.004, p[1] + 0.001, p[2]]
      slat(k, 'paint', lift(a), lift(b), 0.007, 0.004)
    }
    // A painted B pillar between door glass and louvres.
    slat(k, 'paint', at(-0.175, 0.0), at(-0.175, 0.98), 0.03, 0.01)
  }

  // Roll cage seen through the glass: a main hoop behind the seats, a diagonal, bars up
  // the A pillars and along the roof, and door bars.
  const cage: Part = 'chrome'
  const hz = -0.2
  for (const sd of SIDES) {
    rod(k, cage, [sd * 0.27, 0.2, hz], [sd * 0.25, 0.47, hz], 0.012)
    rod(k, cage, [sd * 0.25, 0.47, hz], [sd * 0.25, 0.47, 0.06], 0.012)
    rod(k, cage, [sd * 0.25, 0.47, 0.06], [sd * 0.3, 0.33, 0.2], 0.012)
    rod(k, cage, [sd * 0.3, 0.26, 0.15], [sd * 0.3, 0.27, hz + 0.01], 0.01)
    rod(k, cage, [sd * 0.25, 0.46, hz], [sd * 0.2, 0.32, -0.42], 0.01)
  }
  rod(k, cage, [-0.25, 0.47, hz], [0.25, 0.47, hz], 0.012)
  rod(k, cage, [-0.26, 0.24, hz], [0.25, 0.46, hz], 0.01)

  // Cabin: two buckets, a plain dash with three gauges, the wheel and a gear lever.
  for (const sd of SIDES) h.seat(k, sd * 0.13, 0.17, -0.1, 0.15, 0.17)
  k.add('dash', rbox(0.6, 0.05, 0.08, 0.015), [0, 0.305, 0.17])
  for (const x of [0.09, 0.13, 0.17]) k.add('display', disc(0.012, 12), [x, 0.315, 0.128], [-0.3, 0, 0])
  h.steering(k, 0.13, 0.32, 0.09)
  k.add('dash', rbox(0.07, 0.06, 0.24, 0.015), [0, 0.2, 0.0])
  h.bar(k, 'chrome', [0, 0.23, 0.04], [0, 0.29, 0.02], 0.008)

  // Roof: a raised scoop feeding the engine, a flip-up vent at the front and a stubby aerial.
  const sb = roofY(-0.06) - 0.004
  k.add('paint', hump([[-0.02, 0.07, sb + 0.05], [-0.06, 0.08, sb + 0.062], [-0.16, 0.085, sb + 0.064], [-0.26, 0.08, sb + 0.05], [-0.34, 0.06, sb + 0.012]], sb))
  k.add('black', plane(0.13, 0.045), [0, sb + 0.026, -0.02 + 0.0035])
  for (const dy of [-0.012, 0.004]) k.add('dark', box(0.125, 0.004, 0.004), [0, sb + 0.026 + dy, -0.02 + 0.006])
  k.add('black', rbox(0.11, 0.008, 0.07, 0.003), [0, roofY(0.02) + 0.003, 0.02], [0.12, 0, 0])
  for (let i = 0; i < 3; i++) k.add('dark', box(0.09, 0.003, 0.006), [0, roofY(0.02) + 0.0105, 0.0 + i * 0.02], [0.12, 0, 0])
  h.bar(k, 'black', [-0.2, roofY(-0.25), -0.25], [-0.2, roofY(-0.25) + 0.09, -0.27], 0.004)

  // Bonnet: two big vents, four pins and a black nose panel; the spotlight pod sits on it.
  if (!fit.hood) {
    for (const sd of SIDES) vent(S, sd * 0.2, 0.43, 0.12, 0.14, 6)
    S.top('black', box(0.06, 0.03, 0.004), 0, 0.27, 0.0045)
  }
  for (const sd of SIDES) for (const z of [0.58, 0.29]) {
    S.top('chrome', disc(0.008, 10), sd * 0.3, z, 0.003)
    S.top('black', box(0.004, 0.022, 0.003), sd * 0.3, z + 0.016, 0.0045)
  }
  // Light pod: a black box on the nose carrying four big round spotlights.
  const podZ = 0.625
  const podY = 0.305
  k.add('black', rbox(0.6, 0.085, 0.05, 0.012), [0, podY, podZ])
  for (const sd of SIDES) h.bar(k, 'black', [sd * 0.2, podY - 0.03, podZ - 0.01], [sd * 0.2, S.y(sd * 0.2, 0.57), 0.57], 0.012)
  for (const x of [-0.21, -0.07, 0.07, 0.21]) spot(k, x, podY, podZ + 0.025, 0.036)

  // Nose: square headlamps either side of a black slot grille, a chunky bumper with a
  // honeycomb intake, tow hook and a splitter.
  const fz = front
  k.add('black', plane(0.66, 0.08), [0, 0.215, fz + 0.002])
  for (const sd of SIDES) {
    k.add('lamp', plane(0.1, 0.055), [sd * 0.25, 0.215, fz + 0.0045])
    k.add('chrome', box(0.1, 0.004, 0.004), [sd * 0.25, 0.215, fz + 0.006])
    k.add('amber', plane(0.04, 0.055), [sd * 0.34, 0.215, fz + 0.0045])
    for (const dy of [-0.016, 0, 0.016]) k.add('dark', box(0.14, 0.006, 0.004), [sd * 0.1, 0.215 + dy, fz + 0.005])
  }
  k.add('dark', box(0.05, 0.03, 0.004), [0, 0.215, fz + 0.006])
  k.add('black', rbox(0.84, 0.075, 0.08, 0.02), [0, 0.135, fz - 0.005])
  honey(k, 0, 0.13, fz + 0.035 + 0.001, 0.3, 0.045, 0.008, 1)
  for (const sd of SIDES) k.add('black', plane(0.1, 0.03), [sd * 0.3, 0.13, fz + 0.0365])
  k.add('caliper', new TorusGeometry(0.012, 0.004, 4, 12), [0.17, 0.095, fz + 0.035], [Math.PI / 2, 0, 0])
  if (!fit.kit) k.add('black', box(0.74, 0.01, 0.07), [0, 0.092, fz + 0.01])

  // Mud flaps behind every wheel, hanging under the arches.
  for (const a of arches) for (const sd of SIDES) {
    const z = a.c - R - 0.01
    k.add('black', box(0.12, 0.07, 0.006), [sd * 0.4, 0.07, z])
    k.add('dark', box(0.1, 0.012, 0.002), [sd * 0.4, 0.05, z - 0.004])
  }

  // Tail: a black band across with the lamps in it, a louvred engine grille under the
  // hatch, a plate, a bumper, twin pipes and the wing.
  k.add('black', plane(0.72, 0.075), [0, 0.255, tz - 0.002], [0, Math.PI, 0])
  for (const sd of SIDES) {
    k.add('tail', plane(0.15, 0.055), [sd * 0.27, 0.255, tz - 0.0045], [0, Math.PI, 0])
    k.add('amber', plane(0.045, 0.055), [sd * 0.165, 0.255, tz - 0.0045], [0, Math.PI, 0])
    k.add('chrome', box(0.003, 0.055, 0.004), [sd * 0.27, 0.255, tz - 0.006])
  }
  k.add('lamp', plane(0.05, 0.03), [0, 0.255, tz - 0.0045], [0, Math.PI, 0])
  k.add('black', plane(0.11, 0.045), [0, 0.18, tz - 0.002], [0, Math.PI, 0])
  k.add('lamp', plane(0.1, 0.036), [0, 0.18, tz - 0.0045], [0, Math.PI, 0])
  for (const sd of SIDES) {
    k.add('black', plane(0.17, 0.05), [sd * 0.2, 0.18, tz - 0.002], [0, Math.PI, 0])
    for (const dy of [-0.016, 0, 0.016]) k.add('dark', box(0.16, 0.006, 0.004), [sd * 0.2, 0.18 + dy, tz - 0.005])
  }
  // Louvres on the deck behind the hatch glass (engine cooling).
  for (let i = 0; i < 4; i++) S.top('black', box(0.42, 0.01, 0.004), 0, -0.585 - i * 0.022, 0.0045)
  k.add('black', rbox(0.84, 0.077, 0.07, 0.02), [0, 0.1265, tz + 0.01])
  if (!fit.exhaust) for (const x of [0.11, 0.17]) {
    k.add('chrome', new CylinderGeometry(0.02, 0.02, 0.06, 14), [x, 0.085, tz - 0.01], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.015, 14), [x, 0.085, tz - 0.0405], [0, Math.PI, 0])
  }
  if (!fit.spoiler) {
    const wy = 0.47
    const wzz = -0.6
    for (const sd of SIDES) slat(k, 'black', [sd * 0.26, S.y(sd * 0.26, -0.6) - 0.01, -0.6], [sd * 0.26, wy, wzz - 0.01], 0.05, 0.02)
    k.add('paint', slab([[-0.07, -0.01], [0.06, -0.006], [0.075, 0.008], [-0.06, 0.014]], 0.82), [0, wy + 0.01, wzz], [0, Math.PI / 2, 0])
    k.add('black', box(0.82, 0.006, 0.02), [0, wy + 0.022, wzz - 0.072], [0.6, 0, 0])
    for (const sd of SIDES) k.add('black', slab([[-0.085, -0.045], [0.08, -0.035], [0.075, 0.035], [-0.07, 0.04]], 0.01), [sd * 0.415, wy + 0.01, wzz], [0, Math.PI / 2, 0])
    // Stripe across the wing (drawn only when painted on).
    k.add('stripe', box(0.09, 0.004, 0.13), [0, wy + 0.022, wzz], [-0.07, 0, 0])
  }

  // Twin bonnet and roof stripes (drawn only when painted on).
  for (const x of [-0.06, 0.06]) {
    for (let z = 0.56; z > 0.27; z -= 0.05) S.top('stripe', plane(0.05, 0.052), x, z, 0.003)
    for (let z = 0.06; z > -0.02; z -= 0.05) k.add('stripe', box(0.05, 0.004, 0.052), [x, roofY(z) + 0.002, z])
  }

  h.brakes(k, 0.4 - 0.03, wz, r, 0.14)
}
