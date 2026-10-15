import { CircleGeometry, CylinderGeometry, TorusGeometry } from 'three'
import type { Kit, Part } from '../CarModel'
import { Loft, type Pt, type Section } from '../loft'
import { Surface, bodyRing, box, disc, ellipse, glassRing, greenhouse, honey, interior, plane, poly, rbox, slab, vent, type ExoticFit, type ExoticHelpers } from '../exoticCars'

// Kazumi Kaze TA-R: an invented late-90s time-attack hatchback coupe. A low two-door
// shell with box over-fenders bolted on front and rear (riveted to the body), a vented
// carbon hood, slim headlights, a huge splitter with canards, side skirts, vortex
// generators on the roof, a swan-neck wing on tall uprights and a finned diffuser.
// Every shape is our own drawing; no real badge or logo.

export const KAZE = { len: 1.4, wid: 0.82, wheel: 0.15 }
const SIDES = [-1, 1] as const
type V3 = [number, number, number]

// A black wheel well behind each tyre with a thick dark lip, R round a centre cy up.
// Each stands square to the car, just clear of the widest point of the box flare round it.
const wellX = (S: Surface, zz: number, R: number) => {
  let x = 0
  for (let i = -10; i <= 10; i++) x = Math.max(x, S.side(zz + (i / 10) * R))
  return x + 0.003
}
function wells(k: Kit, S: Surface, wz: number, R: number, cy: number) {
  for (const zz of [wz, -wz]) {
    const x = wellX(S, zz, R) - 0.003
    for (const sd of SIDES) {
      k.add('black', new CircleGeometry(R, 20, 0, Math.PI), [sd * (x + 0.003), cy, zz], [0, (sd * Math.PI) / 2, 0])
      k.add('dark', new TorusGeometry(R, 0.011, 4, 20, Math.PI), [sd * (x + 0.006), cy, zz], [0, (sd * Math.PI) / 2, 0])
    }
  }
}

// A thin dark line along the side wall from z0 to z1 at height y, in short pieces that
// follow the wall.
function seam(S: Surface, sd: number, z0: number, z1: number, y: number) {
  const n = Math.ceil((z1 - z0) / 0.07)
  const l = (z1 - z0) / n
  for (let i = 0; i < n; i++) S.wall('dark', plane(l + 0.001, 0.005), sd, z0 + (i + 0.5) * l, y, 0.0035)
}

// A thin panel lying `out` over the middle of the top surface, half width w, from z0 to
// z1 (a carbon hood skin): its own top follows the body's.
function skin(S: Surface, z0: number, z1: number, w: number, out: number) {
  const secs: Section[] = []
  const n = Math.max(2, Math.round(Math.abs(z1 - z0) / 0.02))
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n
    const pts: Pt[] = [[0, S.y(0, z) - 0.008], [w, S.y(w, z) - 0.008, true], [w, S.y(w, z) + out - 0.002, true], [w - 0.004, S.y(w - 0.004, z) + out, true], [w / 2, S.y(w / 2, z) + out], [0, S.y(0, z) + out]]
    secs.push({ z, pts })
  }
  return new Loft(secs, 1).geometry({ capFront: true, capBack: true })
}

// A round lamp facing back, in a black cup with a dark ring.
function backLamp(k: Kit, x: number, y: number, z: number, r: number, part: Part) {
  k.add('black', disc(r + 0.007, 18), [x, y, z - 0.003], [0, Math.PI, 0])
  k.add(part, disc(r, 18), [x, y, z - 0.0055], [0, Math.PI, 0])
  k.add('dark', new TorusGeometry(r + 0.003, 0.004, 4, 18), [x, y, z - 0.0065])
  k.add('dark', disc(r * 0.3, 10), [x, y, z - 0.008], [0, Math.PI, 0])
}

export function timeAttackGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = KAZE.wheel
  const wz = KAZE.len * 0.33
  const front = KAZE.len / 2
  // z, half width, bottom, shoulder, fender top, crease x, middle height. The flares are
  // boxes stepping out of the narrow doors right round each wheel.
  const body = new Loft([
    bodyRing(0.7, 0.34, 0.085, 0.16, 0.18, 0.2, 0.19),
    bodyRing(0.67, 0.4, 0.078, 0.23, 0.255, 0.24, 0.215),
    bodyRing(0.6, 0.43, 0.072, 0.302, 0.322, 0.25, 0.235),
    bodyRing(0.48, 0.43, 0.07, 0.312, 0.332, 0.26, 0.25),
    bodyRing(0.36, 0.43, 0.07, 0.308, 0.328, 0.26, 0.262),
    bodyRing(0.3, 0.385, 0.07, 0.272, 0.292, 0.27, 0.272),
    bodyRing(0.18, 0.37, 0.07, 0.262, 0.285, 0.27, 0.28),
    bodyRing(-0.1, 0.37, 0.07, 0.265, 0.287, 0.27, 0.283),
    bodyRing(-0.27, 0.378, 0.07, 0.274, 0.296, 0.27, 0.286),
    bodyRing(-0.34, 0.436, 0.07, 0.31, 0.332, 0.27, 0.288),
    bodyRing(-0.48, 0.436, 0.07, 0.316, 0.338, 0.27, 0.29),
    bodyRing(-0.6, 0.434, 0.075, 0.31, 0.332, 0.27, 0.292),
    bodyRing(-0.67, 0.412, 0.085, 0.298, 0.318, 0.26, 0.295),
    bodyRing(-0.7, 0.39, 0.095, 0.285, 0.304, 0.24, 0.29),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)

  // Greenhouse: an upright windshield, a short roof and a hatch falling to a short deck.
  const glass = new Loft([
    glassRing(0.26, 0.32, 0.27, 0.3, 0.278),
    glassRing(0.16, 0.32, 0.28, 0.285, 0.34),
    glassRing(0.06, 0.322, 0.283, 0.268, 0.398),
    glassRing(-0.04, 0.322, 0.285, 0.26, 0.428),
    glassRing(-0.16, 0.322, 0.286, 0.258, 0.434),
    glassRing(-0.28, 0.32, 0.288, 0.252, 0.42),
    glassRing(-0.4, 0.31, 0.29, 0.24, 0.38),
    glassRing(-0.52, 0.29, 0.292, 0.22, 0.33),
    glassRing(-0.6, 0.27, 0.293, 0.2, 0.305),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  const G = new Surface(k, glass, 3, 1)
  greenhouse(k, h, glass, { roof: [0.05, -0.33], pillar: [0.26, 0.05], belt: [0.25, -0.57], mirror: [0.17, 0.31, 0.3] })
  const roofY = (z: number) => glass.near(z).pts[4][1] + 0.009
  // A dark sun strip across the top of the windshield, and one wiper.
  G.top('dark', box(0.48, 0.035, 0.002), 0, 0.09, 0.003)
  h.bar(k, 'black', [-0.2, 0.292, 0.235], [0.04, 0.3, 0.215], 0.008)

  // Over-fenders: a black well and dark lip in each, a ring of rivets round the arch, and a
  // seam where each box meets the door.
  const R = 0.168
  const cy = r - 0.008
  wells(k, S, wz, R, cy)
  for (const zz of [wz, -wz]) for (const sd of SIDES) {
    for (let i = 0; i <= 8; i++) {
      const a = ((22 + (i / 8) * 136) * Math.PI) / 180
      S.wall('chrome', disc(0.0055, 8), sd, zz + Math.cos(a) * (R + 0.024), cy + Math.sin(a) * (R + 0.024), 0.003)
    }
    for (const dz of [-0.205, 0.205]) S.wall('chrome', disc(0.0055, 8), sd, zz + dz, 0.105, 0.003)
  }
  // Fender louvres on top of each box, where the hot air leaves the wells.
  for (const sd of SIDES) {
    vent(S, sd * 0.33, 0.42, 0.06, 0.13, 5)
    vent(S, sd * 0.34, -0.42, 0.06, 0.12, 4)
  }

  // Carbon hood: a dark skin over the middle with two big louvred vents, a bulge vent in
  // the middle and four pins.
  if (!fit.hood) {
    k.add('black', skin(S, 0.27, 0.635, 0.215, 0.003))
    for (const sd of SIDES) vent(S, sd * 0.105, 0.43, 0.11, 0.15, 7, sd * -0.08)
    for (const sd of SIDES) for (const z of [0.6, 0.3]) {
      S.top('chrome', disc(0.009, 12), sd * 0.18, z, 0.006)
      S.top('dark', disc(0.004, 8), sd * 0.18, z, 0.0085)
    }
  }
  // Cowl: a black strip across the base of the windshield.
  S.top('black', box(0.5, 0.025, 0.004), 0, 0.255, 0.008)

  // Nose: a wide black mouth with mesh, brake ducts at its corners, an amber lamp above
  // each, slim headlights along the top of the nose and a plate holder off-centre.
  const fz = front
  honey(k, 0, 0.128, fz + 0.002, 0.36, 0.05, 0.009, 1)
  k.add('dark', box(0.372, 0.006, 0.006), [0, 0.155, fz + 0.004])
  if (!fit.kit) k.add('dark', box(0.372, 0.006, 0.006), [0, 0.098, fz + 0.004])
  for (const sd of SIDES) {
    k.add('black', poly(ellipse(0.034, 0.016, 14)), [sd * 0.265, 0.128, fz + 0.003])
    k.add('dark', new TorusGeometry(0.034, 0.004, 3, 14), [sd * 0.265, 0.128, fz + 0.005], [0, 0, 0], [1, 0.5, 1])
    k.add('amber', plane(0.045, 0.012), [sd * 0.265, 0.16, fz + 0.003])
  }
  // Headlights: a slim black slot on each corner of the nose, two projectors and a lamp bar.
  for (const sd of SIDES) {
    const x = sd * 0.285
    const z = 0.652
    S.top('black', poly([[-0.1, -0.016], [0.08, -0.022], [0.1, 0.012], [-0.09, 0.022]].map(([px, py]) => [-sd * px, py])), x, z, 0.002)
    for (const dx of [0.058, 0.024]) {
      S.top('chrome', disc(0.014, 16), x + sd * dx, z, 0.0075)
      S.top('lamp', disc(0.01, 16), x + sd * dx, z, 0.0105)
    }
    S.top('lamp', box(0.075, 0.007, 0.003), x - sd * 0.045, z + 0.005, 0.0078, sd * 0.06)
    S.top('amber', box(0.05, 0.005, 0.003), x - sd * 0.05, z - 0.009, 0.0078, sd * 0.06)
  }
  // Tow hooks: a red strap loop off each end.
  if (!fit.kit) {
    k.add('caliper', new TorusGeometry(0.02, 0.005, 4, 12), [0.2, 0.09, fz + 0.012], [0, Math.PI / 2, 0])
    k.add('black', box(0.012, 0.012, 0.02), [0.2, 0.09, fz - 0.002])
  }
  // Splitter: a big black plate standing out ahead of the nose on two rods, canards on the
  // corners and a lip along the bottom of the bumper.
  if (!fit.kit) {
    k.add('black', rbox(0.8, 0.012, 0.11, 0.004), [0, 0.068, fz - 0.01])
    k.add('dark', box(0.8, 0.004, 0.012), [0, 0.0765, fz + 0.035])
    for (const sd of SIDES) {
      k.add('black', box(0.012, 0.03, 0.09), [sd * 0.398, 0.083, fz - 0.015])
      h.bar(k, 'chrome', [sd * 0.12, 0.074, fz + 0.03], [sd * 0.12, 0.13, fz - 0.005], 0.006)
      for (const [y, dz] of [[0.115, 0], [0.155, -0.02]] as [number, number][]) {
        k.add('black', box(0.06, 0.005, 0.045), [sd * 0.405, y, 0.655 + dz], [0, sd * 0.45, sd * -0.22])
      }
    }
  }

  // Sides: skirts between the boxes, door seams, a handle, a quick-release filler, front
  // markers, and a rear quarter vent.
  for (const sd of SIDES) {
    if (!fit.kit) {
      k.add('black', rbox(0.04, 0.034, 0.5, 0.01), [sd * (S.side(0) + 0.008), 0.087, -0.01])
      k.add('dark', box(0.006, 0.006, 0.5), [sd * (S.side(0) + 0.0285), 0.074, -0.01])
    }
    S.wall('dark', plane(0.005, 0.17), sd, 0.21, 0.18, 0.003)
    S.wall('dark', plane(0.005, 0.15), sd, -0.18, 0.18, 0.003, 0.12)
    seam(S, sd, -0.21, 0.21, 0.112)
    S.wall('black', rbox(0.045, 0.012, 0.008, 0.004), sd, -0.15, 0.245, 0.003)
    S.wall('amber', plane(0.04, 0.014), sd, 0.66, 0.16, 0.003)
    S.wall('tail', plane(0.035, 0.012), sd, -0.67, 0.2, 0.003)
    // Rear quarter: a black gill ahead of the rear box.
    S.wall('black', poly([[-0.03, -0.03], [0.035, -0.024], [0.03, 0.03], [-0.03, 0.024]]), sd, -0.25, 0.205, 0.004)
    for (const dy of [-0.012, 0, 0.012]) S.wall('dark', box(0.055, 0.004, 0.003), sd, -0.25, 0.205 + dy, 0.006)
  }
  S.top('chrome', disc(0.02, 16), 0.335, -0.262, 0.003)
  S.top('dark', disc(0.013, 12), 0.335, -0.262, 0.0055)

  // Roof: a flat scoop up front and a row of vortex generators along its back edge.
  const sy = roofY(0.0)
  k.add('paint', rbox(0.15, 0.024, 0.13, 0.008), [0, sy + 0.008, -0.02])
  k.add('black', rbox(0.11, 0.014, 0.006, 0.004), [0, sy + 0.012, 0.0465])
  const vz = -0.28
  const vy = roofY(vz)
  for (let i = -4; i <= 4; i++) k.add('black', slab([[-0.035, -0.004], [0.01, -0.004], [-0.035, 0.016]], 0.004), [i * 0.042, vy, vz], [0, -Math.PI / 2, 0])
  k.add('tail', box(0.12, 0.012, 0.006), [0, roofY(-0.33) + 0.003, -0.335])

  // Tail: a black panel across the back with four round lamps, a plate in the middle, a
  // single fat pipe off to one side, a tow hook and a diffuser with tall fins.
  const tz = -front
  k.add('black', plane(0.66, 0.07), [0, 0.235, tz - 0.0025], [0, Math.PI, 0])
  k.add('dark', box(0.68, 0.005, 0.006), [0, 0.272, tz - 0.003])
  for (const sd of SIDES) {
    backLamp(k, sd * 0.27, 0.235, tz, 0.024, 'tail')
    backLamp(k, sd * 0.195, 0.235, tz, 0.024, 'tail')
    k.add('lamp', plane(0.04, 0.012), [sd * 0.11, 0.235, tz - 0.0055], [0, Math.PI, 0])
  }
  k.add('black', plane(0.124, 0.054), [0, 0.16, tz - 0.0025], [0, Math.PI, 0])
  k.add('lamp', plane(0.11, 0.045), [0, 0.16, tz - 0.005], [0, Math.PI, 0])
  k.add('caliper', new TorusGeometry(0.02, 0.005, 4, 12), [0.3, 0.12, tz - 0.012], [0, Math.PI / 2, 0])
  k.add('black', box(0.012, 0.012, 0.02), [0.3, 0.12, tz + 0.002])
  if (!fit.exhaust) {
    k.add('chrome', new CylinderGeometry(0.03, 0.03, 0.06, 16), [-0.2, 0.15, tz - 0.012], [Math.PI / 2, 0, 0])
    k.add('dark', new TorusGeometry(0.027, 0.004, 4, 16), [-0.2, 0.15, tz - 0.042])
    k.add('black', disc(0.024, 16), [-0.2, 0.15, tz - 0.04], [0, Math.PI, 0])
  }
  if (!fit.kit) {
    // A ramp rising to the back, with fins standing under it.
    k.add('black', box(0.62, 0.01, 0.17), [0, 0.092, tz + 0.04], [0.25, 0, 0])
    for (const x of [-0.27, -0.18, -0.09, 0, 0.09, 0.18, 0.27]) k.add('black', slab([[tz + 0.11, 0.066], [tz - 0.035, 0.066], [tz - 0.035, 0.114], [tz + 0.11, 0.078]], 0.007), [x, 0, 0], [0, -Math.PI / 2, 0])
  }
  // Wing: a big inverted main plane and a steep flap hung from two swan-neck uprights that
  // hook over its top, with tall endplates and a gurney along the flap.
  if (!fit.spoiler) {
    const wy = 0.5
    const wc = -0.555
    for (const sd of SIDES) {
      const x = sd * 0.2
      const base = S.y(x, -0.665) - 0.012
      const neck: [number, number][] = [
        [-0.64, base], [-0.69, base], [-0.69, base + 0.03], [-0.668, 0.4], [-0.66, 0.48], [-0.64, 0.53], [-0.6, 0.548], [-0.55, 0.55],
        [-0.5, 0.54], [-0.49, 0.515], [-0.505, 0.511], [-0.52, 0.528], [-0.56, 0.532], [-0.6, 0.526], [-0.628, 0.5], [-0.64, 0.44], [-0.645, 0.38], [-0.64, base + 0.03],
      ]
      k.add('black', slab(neck, 0.012), [x, 0, 0], [0, -Math.PI / 2, 0])
      k.add('dark', box(0.03, 0.006, 0.07), [x, base + 0.005, -0.665])
    }
    const foil: [number, number][] = [[0.075, 0], [0.065, 0.006], [0.03, 0.009], [-0.03, 0.008], [-0.075, 0.003], [-0.075, -0.001], [-0.03, -0.008], [0.02, -0.013], [0.06, -0.01]]
    k.add('black', slab(foil, 0.84), [0, wy, wc], [0, -Math.PI / 2, -0.06])
    k.add('dark', slab(foil.map(([u, v]) => [u * 0.42, v * 0.6]), 0.84), [0, wy + 0.028, wc - 0.085], [0, -Math.PI / 2, -0.5])
    k.add('black', box(0.84, 0.012, 0.003), [0, wy + 0.051, wc - 0.1])
    for (const sd of SIDES) k.add('black', slab([[-0.47, wy - 0.06], [-0.67, wy - 0.06], [-0.67, wy + 0.08], [-0.6, wy + 0.08], [-0.49, wy + 0.025]], 0.008), [sd * 0.424, 0, 0], [0, -Math.PI / 2, 0])
  } else {
    k.add('black', box(0.62, 0.012, 0.012), [0, S.y(0, tz + 0.01) + 0.004, tz + 0.01])
  }

  // Racing stripe: one wide band off to the driver's side, over the nose, roof, hatch
  // and deck; the hood stays bare carbon.
  const sx = 0.09
  for (let z = 0.69; z > 0.645; z -= 0.045) S.top('stripe', plane(0.08, 0.046), sx, z, 0.004)
  for (let z = 0.03; z > -0.34; z -= 0.05) {
    if (Math.abs(z) < 0.1) continue // the roof scoop
    k.add('stripe', box(0.08, 0.004, 0.052), [sx, roofY(z) + 0.002, z])
  }
  for (let z = -0.615; z > -0.7; z -= 0.04) S.top('stripe', plane(0.08, 0.042), sx, z, 0.004)

  // Cockpit: buckets, the dash and wheel, and a roll cage seen through the glass.
  interior(k, h, -0.13, 0.15)
  const cage = (a: V3, b: V3) => h.bar(k, 'dash', a, b, 0.012)
  for (const sd of SIDES) {
    cage([sd * 0.25, 0.17, -0.27], [sd * 0.22, 0.395, -0.25])
    cage([sd * 0.22, 0.395, -0.25], [sd * 0.2, 0.405, 0.03])
    cage([sd * 0.2, 0.405, 0.03], [sd * 0.25, 0.3, 0.15])
    cage([sd * 0.22, 0.38, -0.26], [sd * 0.22, 0.3, -0.45])
  }
  cage([-0.22, 0.395, -0.25], [0.22, 0.395, -0.25])
  cage([-0.24, 0.2, -0.27], [0.22, 0.39, -0.255])
  h.brakes(k, (z) => wellX(S, z, R) - 0.025, wz, r, 0.14)
}
