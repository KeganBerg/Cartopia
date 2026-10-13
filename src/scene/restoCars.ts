import { CircleGeometry, CylinderGeometry, TorusGeometry, type BufferGeometry } from 'three'
import { Loft, type Section } from './loft'
import type { Kit, Part } from './CarModel'
import type { Body } from '../game/data'
import { Surface, bodyRing, box, disc, ellipse, frame, glassRing, greenhouse, honey, plane, poly, rbox, type ExoticFit, type ExoticHelpers } from './exoticCars'

// Resto-mods: secret cars only built from four crate pieces (see game/resto.ts). Old
// shapes (a 1950s pontoon-fender racer, a 1960s step-nose coupe, a '69 muscle coupe)
// lofted the same way as the exotics, with modern wheels and brakes. Every shape is
// our own drawing and every name is invented.

const SIDES = [-1, 1] as const

// A black wheel well behind each tyre with a thin dark lip, radius R centred cy up.
function arches(S: Surface, wz: number, R: number, cy: number, lip: Part = 'dark') {
  for (const zz of [wz, -wz]) for (const sd of SIDES) {
    S.wall('black', new CircleGeometry(R, 20, 0, Math.PI), sd, zz, cy, 0.002)
    S.wall(lip, new TorusGeometry(R, 0.008, 4, 20, Math.PI), sd, zz, cy, 0.004)
  }
}

// A rounded hump lofted along the car (a headrest fairing, a hood bulge): each key is
// [z, half width, top]; the base sits at `base`, buried in the body under it.
function pod(keys: [number, number, number][], base: number) {
  const secs: Section[] = keys.map(([z, w, top]) => {
    const h = top - base
    return { z, pts: [[0, base], [w, base, true], [w, base + h * 0.45], [w * 0.72, base + h * 0.88], [w * 0.3, top - 0.001], [0, top]] }
  })
  return new Loft(secs, 4).geometry({ capFront: true, capBack: true })
}

// Turns an arc made round +x (from angle 0 to len) so it faces the front (+z).
function faceFront(geo: BufferGeometry, len: number) {
  geo.rotateY(-(Math.PI / 2 + len / 2))
  return geo
}

// A curved screen standing on the cowl: radius R round a point behind it, H tall.
function screen(k: Kit, x: number, y: number, z: number, R: number, H: number, arc: number) {
  const g = new CylinderGeometry(R, R, H, 14, 1, true, -arc / 2, arc)
  k.add('glass', g, [x, y + H / 2, z - R], [-0.2, 0, 0])
  const rim = new TorusGeometry(R, 0.004, 3, 14, arc)
  rim.rotateX(-Math.PI / 2)
  k.add('chrome', faceFront(rim, arc), [x, y + H - 0.001, z - R - H * 0.2])
}

// A round lamp in a chrome ring on a sloping surface, with a reflector ring and bulb.
function roundLamp(S: Surface, x: number, z: number, r: number, part: Part = 'lamp') {
  S.top('black', disc(r + 0.006, 18), x, z, 0.002)
  S.top(part, disc(r, 18), x, z, 0.004)
  S.top('chrome', new TorusGeometry(r * 0.55, 0.0025, 3, 16), x, z, 0.005)
  S.top('dark', disc(r * 0.22, 10), x, z, 0.0055)
  S.top('chrome', new TorusGeometry(r + 0.003, 0.004, 4, 18), x, z, 0.005)
}

// Louvres on a panel `out` above the surface: a black opening w by l with n painted slats.
function louvres(S: Surface, x: number, z: number, w: number, l: number, n: number, out: number) {
  S.top('black', plane(w, l), x, z, out)
  for (let i = 0; i < n; i++) S.top('paint', box(w * 0.9, 0.005, 0.005), x, z + ((i + 0.5) / n - 0.5) * l, out + 0.002)
}

// Chrome drip rails along both edges of the roof, from z0 back to z1.
function dripRails(k: Kit, h: ExoticHelpers, glass: Loft, z0: number, z1: number) {
  for (const sd of SIDES) {
    let prev: [number, number, number] | null = null
    for (let i = 0; i <= 6; i++) {
      const z = z0 + ((z1 - z0) * i) / 6
      const p = glass.near(z).pts
      const v: [number, number, number] = [sd * (p[2][0] + 0.003), p[2][1] + 0.003, z]
      if (prev) h.bar(k, 'chrome', prev, v, 0.008)
      prev = v
    }
  }
}

// Two black wiper arms parked along the bottom of the windshield.
function wipers(k: Kit, h: ExoticHelpers, y: number, z: number) {
  for (const x of [-0.17, 0.05]) h.bar(k, 'black', [x, y, z], [x + 0.17, y + 0.008, z - 0.012], 0.007)
}

// A round lamp in a chrome ring on an upright face at z, facing forward (dir 1) or back.
function faceLamp(k: Kit, x: number, y: number, z: number, r: number, dir: 1 | -1, part: Part = 'lamp') {
  const ry = dir < 0 ? Math.PI : 0
  k.add('black', disc(r + 0.007, 18), [x, y, z + dir * 0.001], [0, ry, 0])
  k.add(part, disc(r, 18), [x, y, z + dir * 0.003], [0, ry, 0])
  k.add('dark', disc(r * 0.35, 12), [x, y, z + dir * 0.004], [0, ry, 0])
  k.add('chrome', new TorusGeometry(r + 0.004, 0.0045, 4, 18), [x, y, z + dir * 0.004], [0, ry, 0])
}

// Seats, a dash and a wheel at the given heights, for cars whose floor sits high.
function cabin(k: Kit, h: ExoticHelpers, floor: number, seatZ: number, dashY: number, dashZ: number, dashW: number) {
  for (const sd of SIDES) h.seat(k, sd * 0.13, floor, seatZ, 0.15, 0.15)
  k.add('dash', rbox(dashW, 0.045, 0.09, 0.02), [0, dashY, dashZ])
  for (const sd of SIDES) k.add('chrome', new TorusGeometry(0.014, 0.003, 3, 12), [sd * 0.13 + 0.02, dashY + 0.01, dashZ - 0.047])
  h.steering(k, 0.13, dashY + 0.02, dashZ - 0.1)
  k.add('dash', rbox(0.07, 0.06, 0.24, 0.015), [0, floor + 0.03, (seatZ + dashZ) / 2])
}

// A white racing disc with a black 8 (it reads the same from either side).
function roundel(S: Surface, sd: number, z: number, y: number, r: number) {
  S.wall('lamp', disc(r, 22), sd, z, y, 0.003)
  for (const dy of [-0.3, 0.3]) S.wall('black', new TorusGeometry(r * 0.27, r * 0.09, 4, 14), sd, z, y + dy * r * 1.1, 0.005)
}

// ---------------------------------------------------------------------------
// Corvara Pontone 58: a 1950s V12 sports racer. Pontoon front fenders standing
// clear of a low nose with an oval egg-crate mouth, a cut-in waist behind them, an
// open cockpit with a wrap-round screen, a fairing behind the driver's head, side
// pipes and racing roundels.
export const PONTONE = { len: 1.36, wid: 0.76, wheel: 0.14 }

export function pontoneGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = PONTONE.wheel
  const wz = PONTONE.len * 0.33
  const front = PONTONE.len / 2
  // z, half width, bottom, shoulder, fender top, crease x, middle height
  const body = new Loft([
    bodyRing(0.68, 0.2, 0.095, 0.15, 0.17, 0.12, 0.165, true),
    bodyRing(0.63, 0.3, 0.085, 0.215, 0.245, 0.17, 0.178, true),
    bodyRing(0.55, 0.355, 0.08, 0.27, 0.298, 0.19, 0.192, true),
    bodyRing(0.45, 0.375, 0.08, 0.292, 0.318, 0.2, 0.205, true),
    bodyRing(0.34, 0.37, 0.08, 0.278, 0.302, 0.21, 0.215, true),
    bodyRing(0.22, 0.338, 0.08, 0.215, 0.24, 0.22, 0.222, true),
    bodyRing(0.11, 0.322, 0.08, 0.19, 0.214, 0.27, 0.15, true),
    bodyRing(-0.06, 0.326, 0.08, 0.19, 0.214, 0.27, 0.135, true),
    bodyRing(-0.2, 0.345, 0.08, 0.205, 0.228, 0.27, 0.145, true),
    bodyRing(-0.32, 0.366, 0.08, 0.252, 0.276, 0.22, 0.232, true),
    bodyRing(-0.45, 0.375, 0.08, 0.292, 0.316, 0.22, 0.248, true),
    bodyRing(-0.57, 0.36, 0.085, 0.276, 0.3, 0.2, 0.25, true),
    bodyRing(-0.68, 0.28, 0.1, 0.222, 0.242, 0.16, 0.226, true),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)
  arches(S, wz, 0.158, r - 0.005)

  // Nose: an oval mouth with a chrome lip and an egg-crate of chrome bars.
  const mouth = ellipse(0.13, 0.034, 24)
  const inner = ellipse(0.118, 0.025, 24)
  k.add('chrome', frame(mouth, inner, 0.012), [0, 0.13, front + 0.004])
  k.add('black', poly(inner), [0, 0.13, front + 0.002])
  for (let i = -3; i <= 3; i++) {
    const x = i * 0.03
    const hgt = 2 * 0.025 * Math.sqrt(Math.max(0, 1 - (x / 0.118) ** 2))
    k.add('chrome', box(0.004, hgt, 0.006), [x, 0.13, front + 0.004])
  }
  k.add('chrome', box(0.22, 0.004, 0.006), [0, 0.13, front + 0.004])
  // Headlights in the front of each pontoon, a small badge on the nose, and two
  // leather straps over the hood.
  for (const sd of SIDES) roundLamp(S, sd * 0.262, 0.605, 0.034)
  S.top('chrome', poly(ellipse(0.016, 0.012, 12)), 0, 0.655, 0.003)
  for (const sd of SIDES) {
    S.top('dark', box(0.018, 0.09, 0.004), sd * 0.1, 0.55, 0.003)
    S.top('chrome', box(0.026, 0.012, 0.005), sd * 0.1, 0.52, 0.005)
    // Louvres either side of the bulge, and a small amber lamp under each headlight.
    louvres(S, sd * 0.15, 0.34, 0.05, 0.11, 5, 0.002)
    S.top('amber', disc(0.011, 12), sd * 0.262, 0.655, 0.003)
    S.top('chrome', new TorusGeometry(0.012, 0.003, 3, 12), sd * 0.262, 0.655, 0.004)
  }
  // Hood bulge with an air mouth at its front.
  if (!fit.hood) {
    k.add('paint', pod([[0.52, 0.045, 0.232], [0.49, 0.058, 0.24], [0.4, 0.064, 0.25], [0.3, 0.06, 0.252], [0.22, 0.042, 0.238]], 0.16))
    k.add('black', poly(ellipse(0.04, 0.011, 16)), [0, 0.218, 0.522])
  }

  // Cockpit: a dash with two gauges, the driver's bucket and wheel, a black cover
  // over the passenger side, a wrap-round screen and a mirror on the cowl.
  k.add('dash', rbox(0.5, 0.035, 0.05, 0.012), [0, 0.19, 0.115])
  for (const x of [0.07, 0.13, 0.19, -0.05]) {
    k.add('chrome', new TorusGeometry(0.013, 0.003, 3, 12), [x, 0.2, 0.089])
    k.add('lamp', disc(0.011, 12), [x, 0.2, 0.0885], [0, Math.PI, 0])
    k.add('black', box(0.002, 0.009, 0.001), [x, 0.203, 0.0878], [0, 0, 0.7])
  }
  h.seat(k, 0.13, 0.12, -0.09, 0.14, 0.12)
  h.steering(k, 0.13, 0.235, 0.04)
  k.add('dark', rbox(0.27, 0.01, 0.31, 0.004), [-0.13, 0.198, -0.03])
  for (let i = 0; i < 4; i++) for (const x of [-0.03, -0.25]) k.add('chrome', disc(0.004, 6), [x, 0.204, 0.09 - i * 0.08], [-Math.PI / 2, 0, 0])
  k.add('dark', rbox(0.004, 0.012, 0.3, 0.002), [-0.13, 0.204, -0.03])
  screen(k, 0.13, 0.205, 0.13, 0.1, 0.065, 2.4)
  k.add('chrome', box(0.006, 0.04, 0.006), [0.27, 0.225, 0.14])
  k.add('chrome', disc(0.018, 12), [0.27, 0.25, 0.135], [0, Math.PI, 0])
  // Fairing behind the driver's head, flowing down the tail.
  k.add('paint', pod([[-0.17, 0.05, 0.31], [-0.2, 0.066, 0.355], [-0.3, 0.07, 0.36], [-0.42, 0.058, 0.33], [-0.54, 0.038, 0.29], [-0.63, 0.015, 0.255]], 0.18), [0.13, 0, 0])
  k.add('dash', rbox(0.1, 0.05, 0.02, 0.008), [0.13, 0.31, -0.168])
  // A chrome filler on the fairing and a roll hoop tucked into its front.
  k.add('chrome', new CylinderGeometry(0.016, 0.016, 0.008, 14), [0.13, 0.352, -0.36])
  k.add('dark', disc(0.01, 10), [0.13, 0.357, -0.36], [-Math.PI / 2, 0, 0])
  for (const x of [0.07, 0.19]) h.bar(k, 'chrome', [x, 0.2, -0.165], [x, 0.29, -0.17], 0.012)
  h.bar(k, 'chrome', [0.07, 0.29, -0.17], [0.19, 0.29, -0.17], 0.012)

  // Sides: gills behind the front wheel, a roundel on each door, side pipes, a
  // fuel cap on the tail.
  for (const sd of SIDES) {
    // Four gills in a chrome surround, and louvres on top of each rear fender.
    S.wall('chrome', rbox(0.115, 0.066, 0.003, 0.01), sd, 0.2, 0.16, 0.002)
    S.wall('black', rbox(0.105, 0.056, 0.003, 0.008), sd, 0.2, 0.16, 0.003)
    for (let i = 0; i < 4; i++) S.wall('paint', box(0.008, 0.052, 0.003), sd, 0.24 - i * 0.026, 0.16, 0.004, 0.25)
    louvres(S, sd * 0.26, -0.4, 0.05, 0.1, 4, 0.002)
    roundel(S, sd, -0.04, 0.138, 0.046)
    S.wall('dark', plane(0.005, 0.1), sd, 0.1, 0.14, 0.003)
    S.wall('chrome', rbox(0.03, 0.008, 0.008, 0.003), sd, 0.06, 0.17, 0.004)
  }
  if (!fit.exhaust) {
    for (const dy of [0, 0.028]) {
      const x = S.side(0) + 0.022
      h.bar(k, 'chrome', [x, 0.09 + dy, 0.26], [x, 0.09 + dy, -0.34], 0.02)
      k.add('black', disc(0.007, 10), [x, 0.09 + dy, -0.355], [0, Math.PI, 0])
    }
  }
  S.top('chrome', disc(0.032, 18), -0.2, -0.47, 0.003)
  S.top('dark', disc(0.022, 14), -0.2, -0.47, 0.005)
  // Racing stripe down the nose and the tail (drawn only when painted on).
  for (let z = 0.66; z > 0.53; z -= 0.04) S.top('stripe', plane(0.08, 0.042), 0, z, 0.0015)
  for (let z = -0.36; z > -0.66; z -= 0.04) S.top('stripe', plane(0.08, 0.042), -0.08, z, 0.0015)

  // Tail: round lamps, a plate and a small chrome tow ring.
  const tz = -front
  for (const sd of SIDES) {
    faceLamp(k, sd * 0.17, 0.19, tz, 0.022, -1, 'tail')
    faceLamp(k, sd * 0.17, 0.145, tz, 0.013, -1, 'amber')
  }
  k.add('black', plane(0.11, 0.045), [0, 0.15, tz - 0.003], [0, Math.PI, 0])
  k.add('lamp', plane(0.096, 0.035), [0, 0.15, tz - 0.004], [0, Math.PI, 0])
  k.add('chrome', frame([[-0.06, -0.026], [0.06, -0.026], [0.06, 0.026], [-0.06, 0.026]], [[-0.055, -0.021], [0.055, -0.021], [0.055, 0.021], [-0.055, 0.021]], 0.004), [0, 0.15, tz - 0.004], [0, Math.PI, 0])
  k.add('chrome', new TorusGeometry(0.014, 0.004, 4, 12), [0.12, 0.11, tz - 0.004], [0, Math.PI, 0])
  // A small oval grille low in the tail for the brakes, and nerf bars at the corners.
  k.add('black', poly(ellipse(0.07, 0.014, 18)), [0, 0.112, tz - 0.003], [0, Math.PI, 0])
  for (let i = -2; i <= 2; i++) k.add('chrome', box(0.003, 0.02, 0.004), [i * 0.025, 0.112, tz - 0.005])
  for (const sd of SIDES) {
    h.bar(k, 'chrome', [sd * 0.13, 0.12, tz + 0.02], [sd * 0.14, 0.12, tz - 0.025], 0.012)
    h.bar(k, 'chrome', [sd * 0.14, 0.12, tz - 0.025], [sd * 0.25, 0.12, tz - 0.015], 0.012)
    h.bar(k, 'chrome', [sd * 0.13, 0.11, front - 0.02], [sd * 0.15, 0.11, front + 0.02], 0.012)
    h.bar(k, 'chrome', [sd * 0.15, 0.11, front + 0.02], [sd * 0.24, 0.11, front + 0.005], 0.012)
  }
  h.brakes(k, PONTONE.wid / 2 - 0.02, wz, r, 0.14)
}

// ---------------------------------------------------------------------------
// Valtorre Sprint 65: a 1960s twin-cam coupe brought up to date. A long flat hood
// whose lid steps up above the nose, four round lamps either side of a chrome oval,
// a tall thin-pillared glasshouse, a crisp waist crease, slim chrome bumperettes
// and a Kamm tail.
export const SPRINT = { len: 1.3, wid: 0.76, wheel: 0.15 }

export function sprintGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = SPRINT.wheel
  const wz = SPRINT.len * 0.33
  const front = SPRINT.len / 2
  const body = new Loft([
    bodyRing(0.65, 0.33, 0.09, 0.25, 0.265, 0.22, 0.265),
    bodyRing(0.6, 0.358, 0.085, 0.282, 0.298, 0.24, 0.295),
    bodyRing(0.5, 0.37, 0.08, 0.302, 0.316, 0.25, 0.31),
    bodyRing(0.3, 0.37, 0.08, 0.306, 0.32, 0.25, 0.318),
    bodyRing(0.1, 0.368, 0.08, 0.31, 0.325, 0.25, 0.323),
    bodyRing(-0.15, 0.368, 0.08, 0.312, 0.327, 0.25, 0.326),
    bodyRing(-0.4, 0.37, 0.08, 0.312, 0.328, 0.25, 0.33),
    bodyRing(-0.55, 0.362, 0.085, 0.305, 0.322, 0.24, 0.326),
    bodyRing(-0.65, 0.335, 0.095, 0.288, 0.306, 0.22, 0.31),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)
  const glass = new Loft([
    glassRing(0.2, 0.328, 0.322, 0.3, 0.33),
    glassRing(0.1, 0.33, 0.324, 0.272, 0.44),
    glassRing(0.0, 0.33, 0.325, 0.262, 0.5),
    glassRing(-0.12, 0.33, 0.326, 0.256, 0.515),
    glassRing(-0.25, 0.33, 0.327, 0.255, 0.512),
    glassRing(-0.36, 0.322, 0.328, 0.25, 0.474),
    glassRing(-0.45, 0.31, 0.329, 0.24, 0.395),
    glassRing(-0.5, 0.3, 0.329, 0.23, 0.338),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  greenhouse(k, h, glass, { roof: [0.0, -0.37], pillar: [0.2, 0.0], belt: [0.2, -0.48], mirror: [0.14, 0.29, 0.34] })
  dripRails(k, h, glass, 0.02, -0.4)
  wipers(k, h, 0.338, 0.19)
  // Chrome strip under the back window.
  h.bar(k, 'chrome', [-0.29, 0.335, -0.49], [0.29, 0.335, -0.49], 0.008)
  // Thin chrome B pillars and a chrome strip along the bottom of the side glass.
  for (const sd of SIDES) {
    const p = glass.near(-0.24).pts
    h.bar(k, 'chrome', [sd * (p[1][0] + 0.003), p[1][1] + 0.01, -0.22], [sd * (p[2][0] + 0.003), p[2][1] - 0.01, -0.25], 0.012)
    k.add('chrome', box(0.006, 0.006, 0.6), [sd * 0.334, 0.336, -0.15])
  }
  arches(S, wz, 0.168, r - 0.01)

  // The step: the hood lid stands proud of the nose and the fenders.
  if (!fit.hood) {
    S.top('paint', rbox(0.44, 0.36, 0.014, 0.004), 0, 0.41, 0.004)
    for (const sd of SIDES) {
      S.top('dark', box(0.004, 0.34, 0.004), sd * 0.224, 0.41, 0.004)
      louvres(S, sd * 0.13, 0.33, 0.08, 0.07, 5, 0.019)
    }
    S.top('chrome', box(0.006, 0.3, 0.004), 0, 0.42, 0.019)
  }
  // Nose: four round lamps, a chrome oval shield in the middle with a mesh either
  // side of it, a slot under it, slim bumperettes and two small fog lamps.
  const fz = front
  for (const sd of SIDES) {
    faceLamp(k, sd * 0.262, 0.2, fz, 0.036, 1)
    faceLamp(k, sd * 0.176, 0.2, fz, 0.029, 1)
    k.add('black', plane(0.085, 0.04), [sd * 0.085, 0.2, fz + 0.001])
    k.add('chrome', frame([[-0.045, -0.023], [0.045, -0.023], [0.045, 0.023], [-0.045, 0.023]], [[-0.042, -0.02], [0.042, -0.02], [0.042, 0.02], [-0.042, 0.02]], 0.005), [sd * 0.085, 0.2, fz + 0.002])
    for (const dy of [-0.012, 0, 0.012]) k.add('chrome', box(0.08, 0.003, 0.004), [sd * 0.085, 0.2 + dy, fz + 0.003])
    k.add('chrome', rbox(0.17, 0.018, 0.03, 0.008), [sd * 0.22, 0.128, fz + 0.008])
    k.add('chrome', rbox(0.03, 0.018, 0.06, 0.008), [sd * 0.31, 0.128, fz - 0.015], [0, sd * 0.5, 0])
    faceLamp(k, sd * 0.1, 0.12, fz, 0.014, 1)
  }
  const shield = ellipse(0.03, 0.046, 18)
  k.add('chrome', frame(shield, ellipse(0.022, 0.038, 18), 0.012), [0, 0.195, fz + 0.005])
  k.add('dark', poly(ellipse(0.022, 0.038, 18)), [0, 0.195, fz + 0.002])
  for (const dy of [-0.024, -0.012, 0, 0.012, 0.024]) k.add('chrome', box(0.04 * Math.sqrt(1 - (dy / 0.038) ** 2), 0.003, 0.004), [0, 0.195 + dy, fz + 0.004])
  if (!fit.kit) k.add('black', box(0.5, 0.012, 0.05), [0, 0.095, fz - 0.015])
  k.add('black', plane(0.2, 0.02), [0, 0.15, fz + 0.001])
  S.top('chrome', disc(0.014, 14), 0, 0.62, 0.004)

  // Sides: a crisp crease along the waist, door cuts, a chrome handle, a round badge
  // behind the front wheel, markers and a black sill.
  for (const sd of SIDES) {
    S.wall('dark', box(1.12, 0.004, 0.003), sd, -0.02, 0.255, 0.002)
    S.wall('dark', plane(0.005, 0.2), sd, 0.17, 0.2, 0.003)
    S.wall('dark', plane(0.005, 0.2), sd, -0.21, 0.2, 0.003, 0.08)
    S.wall('chrome', rbox(0.045, 0.01, 0.01, 0.004), sd, -0.17, 0.275, 0.005)
    S.wall('chrome', disc(0.016, 14), sd, 0.21, 0.23, 0.003)
    S.wall('amber', plane(0.035, 0.012), sd, 0.58, 0.2, 0.003)
    S.wall('tail', plane(0.035, 0.012), sd, -0.58, 0.22, 0.003)
    k.add('black', rbox(0.026, 0.03, wz * 2 - r * 2.5, 0.01), [sd * (S.side(0) - 0.004), 0.092, 0])
    // A slim chrome spear along the flank and a cooling vent behind the front wheel.
    S.wall('chrome', box(0.5, 0.005, 0.003), sd, 0.0, 0.14, 0.003)
    S.wall('chrome', plane(0.06, 0.03), sd, 0.25, 0.19, 0.002)
    S.wall('black', plane(0.054, 0.024), sd, 0.25, 0.19, 0.003)
    for (const dy of [-0.007, 0, 0.007]) S.wall('chrome', box(0.05, 0.002, 0.002), sd, 0.25, 0.19 + dy, 0.004)
  }
  // Fuel filler on the right rear fender, trunk lid cut and a chrome script on it.
  S.top('chrome', disc(0.022, 16), 0.3, -0.46, 0.003)
  S.top('dark', disc(0.015, 12), 0.3, -0.46, 0.005)
  for (const sd of SIDES) S.top('dark', box(0.004, 0.13, 0.003), sd * 0.24, -0.58, 0.002)
  S.top('dark', box(0.48, 0.004, 0.003), 0, -0.52, 0.002)

  // Tail: upright lamps, chrome bumperettes, a plate, twin pipes and a lip.
  const tz = -front
  for (const sd of SIDES) {
    k.add('black', plane(0.07, 0.07), [sd * 0.25, 0.235, tz - 0.002], [0, Math.PI, 0])
    k.add('tail', plane(0.06, 0.04), [sd * 0.25, 0.245, tz - 0.004], [0, Math.PI, 0])
    k.add('amber', plane(0.06, 0.018), [sd * 0.25, 0.211, tz - 0.004], [0, Math.PI, 0])
    k.add('chrome', frame([[-0.037, -0.037], [0.037, -0.037], [0.037, 0.037], [-0.037, 0.037]], [[-0.033, -0.033], [0.033, -0.033], [0.033, 0.033], [-0.033, 0.033]], 0.005), [sd * 0.25, 0.235, tz - 0.003], [0, Math.PI, 0])
    k.add('lamp', plane(0.025, 0.012), [sd * 0.16, 0.235, tz - 0.004], [0, Math.PI, 0])
    k.add('chrome', rbox(0.18, 0.018, 0.03, 0.008), [sd * 0.22, 0.14, tz - 0.008])
  }
  k.add('chrome', box(0.1, 0.012, 0.006), [-0.13, 0.275, tz - 0.004])
  k.add('chrome', box(0.6, 0.005, 0.005), [0, 0.183, tz - 0.004])
  k.add('black', plane(0.12, 0.05), [0, 0.215, tz - 0.003], [0, Math.PI, 0])
  k.add('lamp', plane(0.105, 0.04), [0, 0.215, tz - 0.004], [0, Math.PI, 0])
  if (!fit.exhaust) for (const x of [0.12, 0.17]) {
    k.add('chrome', new CylinderGeometry(0.014, 0.014, 0.05, 12), [x, 0.1, tz - 0.01], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.01, 12), [x, 0.1, tz - 0.036], [0, Math.PI, 0])
  }
  if (!fit.spoiler) k.add('paint', rbox(0.6, 0.012, 0.05, 0.005), [0, 0.318, tz + 0.03], [0.15, 0, 0])

  // Racing stripes over the hood, roof and trunk (drawn only when painted on).
  for (const x of [-0.05, 0.05]) {
    for (let z = 0.57; z > 0.24; z -= 0.05) S.top('stripe', plane(0.05, 0.052), x, z, 0.02)
    for (let z = 0; z > -0.36; z -= 0.05) k.add('stripe', box(0.05, 0.004, 0.052), [x, glass.near(z).pts[4][1] + 0.011, z])
    for (let z = -0.53; z > -0.64; z -= 0.05) S.top('stripe', plane(0.05, 0.052), x, z, 0.0015)
  }
  cabin(k, h, 0.215, -0.16, 0.33, 0.13, 0.56)
  h.brakes(k, SPRINT.wid / 2 - 0.02, wz, r, 0.14)
}

// ---------------------------------------------------------------------------
// Liberty Revenant '69: a big-block muscle coupe on modern wheels. A wide flat front
// with four lamps in a black grille, a chrome bumper with slots, a long hood with a
// cowl bulge, sharp shoulders, a semi-fastback roof and lamps set in the rear bumper.
export const REVENANT = { len: 1.42, wid: 0.8, wheel: 0.155 }

export function revenantGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = REVENANT.wheel
  const wz = REVENANT.len * 0.33
  const front = REVENANT.len / 2
  const body = new Loft([
    bodyRing(0.71, 0.37, 0.1, 0.27, 0.29, 0.28, 0.285),
    bodyRing(0.66, 0.385, 0.09, 0.3, 0.315, 0.28, 0.305),
    bodyRing(0.5, 0.39, 0.085, 0.312, 0.327, 0.28, 0.312),
    bodyRing(0.3, 0.39, 0.085, 0.312, 0.327, 0.28, 0.318),
    bodyRing(0.1, 0.385, 0.085, 0.31, 0.326, 0.28, 0.322),
    bodyRing(-0.1, 0.385, 0.085, 0.312, 0.328, 0.28, 0.325),
    bodyRing(-0.3, 0.39, 0.085, 0.316, 0.332, 0.28, 0.33),
    bodyRing(-0.47, 0.39, 0.085, 0.318, 0.334, 0.28, 0.332),
    bodyRing(-0.62, 0.385, 0.095, 0.314, 0.33, 0.28, 0.33),
    bodyRing(-0.71, 0.37, 0.11, 0.305, 0.32, 0.27, 0.322),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)
  const glass = new Loft([
    glassRing(0.1, 0.34, 0.318, 0.31, 0.326),
    glassRing(0.01, 0.342, 0.32, 0.282, 0.425),
    glassRing(-0.09, 0.342, 0.322, 0.268, 0.48),
    glassRing(-0.22, 0.342, 0.324, 0.262, 0.492),
    glassRing(-0.34, 0.338, 0.326, 0.258, 0.488),
    glassRing(-0.45, 0.326, 0.328, 0.242, 0.44),
    glassRing(-0.55, 0.305, 0.329, 0.205, 0.365),
    glassRing(-0.6, 0.285, 0.33, 0.185, 0.338),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  greenhouse(k, h, glass, { roof: [-0.02, -0.5], pillar: [0.1, -0.02], belt: [0.1, -0.56], mirror: [0.04, 0.3, 0.34], roofPart: 'black' })
  dripRails(k, h, glass, -0.01, -0.5)
  wipers(k, h, 0.334, 0.085)
  h.bar(k, 'chrome', [-0.3, 0.335, -0.59], [0.3, 0.335, -0.59], 0.009)
  for (const sd of SIDES) k.add('chrome', box(0.006, 0.006, 0.62), [sd * 0.346, 0.331, -0.24])
  arches(S, wz, 0.178, r - 0.01)

  // Hood: a cowl bulge rising toward the windshield, and two chrome pins.
  if (!fit.hood) {
    k.add('paint', pod([[0.62, 0.085, 0.322], [0.56, 0.11, 0.334], [0.4, 0.118, 0.344], [0.2, 0.114, 0.35], [0.11, 0.105, 0.35]], 0.29))
    k.add('black', box(0.16, 0.014, 0.004), [0, 0.344, 0.106])
    for (const sd of SIDES) {
      S.top('chrome', disc(0.009, 10), sd * 0.24, 0.6, 0.003)
      louvres(S, sd * 0.25, 0.32, 0.07, 0.12, 6, 0.002)
    }
    k.add('black', poly(ellipse(0.06, 0.012, 16)), [0, 0.324, 0.622])
  }
  // Front: a black grille right across with four lamps in chrome cups, chrome bars
  // and a badge; a chrome bumper with two slots; a black splitter under it.
  const fz = front
  k.add('black', plane(0.72, 0.085), [0, 0.225, fz + 0.001])
  honey(k, 0, 0.225, fz + 0.001, 0.26, 0.07, 0.008, 1)
  k.add('chrome', box(0.73, 0.008, 0.01), [0, 0.27, fz + 0.002])
  for (const sd of SIDES) {
    faceLamp(k, sd * 0.3, 0.225, fz, 0.033, 1)
    faceLamp(k, sd * 0.215, 0.225, fz, 0.033, 1)
    for (const dy of [-0.024, -0.008, 0.008, 0.024]) k.add('chrome', box(0.13, 0.003, 0.005), [sd * 0.095, 0.225 + dy, fz + 0.003])
  }
  k.add('chrome', rbox(0.06, 0.02, 0.008, 0.004), [0, 0.225, fz + 0.005])
  k.add('dark', box(0.04, 0.008, 0.004), [0, 0.225, fz + 0.01])
  k.add('chrome', rbox(0.78, 0.055, 0.05, 0.02), [0, 0.145, fz + 0.008])
  for (const sd of SIDES) {
    k.add('black', plane(0.12, 0.022), [sd * 0.15, 0.145, fz + 0.034])
    k.add('amber', plane(0.05, 0.014), [sd * 0.3, 0.145, fz + 0.035])
  }
  k.add('black', plane(0.12, 0.045), [0, 0.145, fz + 0.034])
  k.add('lamp', plane(0.105, 0.035), [0, 0.145, fz + 0.035])
  if (!fit.kit) {
    k.add('black', box(0.7, 0.012, 0.08), [0, 0.1, fz - 0.005])
    for (const sd of SIDES) k.add('black', box(0.012, 0.03, 0.07), [sd * 0.34, 0.11, fz - 0.01])
  }

  // Sides: a sharp crease, door cuts, a chrome handle, a chrome rocker strip, a
  // fender badge and markers front and back.
  for (const sd of SIDES) {
    S.wall('dark', box(1.3, 0.004, 0.003), sd, 0, 0.262, 0.002)
    S.wall('dark', plane(0.005, 0.2), sd, 0.12, 0.2, 0.003)
    S.wall('dark', plane(0.005, 0.2), sd, -0.28, 0.2, 0.003, 0.06)
    S.wall('chrome', rbox(0.05, 0.01, 0.01, 0.004), sd, -0.23, 0.285, 0.005)
    S.wall('chrome', box(wz * 2 - r * 2.5, 0.012, 0.004), sd, 0, 0.11, 0.003)
    S.wall('chrome', rbox(0.06, 0.018, 0.006, 0.004), sd, 0.3, 0.24, 0.003)
    S.wall('dark', box(0.04, 0.006, 0.004), sd, 0.3, 0.24, 0.006)
    S.wall('amber', plane(0.04, 0.014), sd, 0.64, 0.2, 0.003)
    S.wall('tail', plane(0.04, 0.014), sd, -0.64, 0.22, 0.003)
    // A scoop in the rear quarter ahead of the wheel, with chrome fins.
    S.wall('chrome', rbox(0.1, 0.034, 0.003, 0.008), sd, -0.3, 0.215, 0.002)
    S.wall('black', rbox(0.092, 0.026, 0.003, 0.007), sd, -0.3, 0.215, 0.003)
    for (let i = 0; i < 3; i++) S.wall('chrome', box(0.004, 0.024, 0.002), sd, -0.27 - i * 0.03, 0.215, 0.004)
    S.wall('chrome', rbox(0.07, 0.008, 0.006, 0.003), sd, 0.42, 0.21, 0.003)
  }
  // Flip-top filler on the left rear quarter, and the trunk lid's cut and lock.
  S.wall('chrome', disc(0.022, 16), -1, -0.52, 0.29, 0.003)
  S.wall('dark', disc(0.014, 12), -1, -0.52, 0.29, 0.005)
  for (const sd of SIDES) S.top('dark', box(0.004, 0.11, 0.003), sd * 0.3, -0.65, 0.002)
  S.top('dark', box(0.6, 0.004, 0.003), 0, -0.6, 0.002)

  // Tail: a chrome bumper with the lamps set in it, a plate over it, twin pipes and
  // a small ducktail.
  const tz = -front
  k.add('chrome', rbox(0.78, 0.06, 0.05, 0.02), [0, 0.165, tz - 0.008])
  for (const sd of SIDES) {
    // Each lamp sits in a black recess, split in three by chrome, with a reverse lamp.
    k.add('black', box(0.16, 0.04, 0.012), [sd * 0.22, 0.165, tz - 0.029])
    k.add('tail', plane(0.1, 0.026), [sd * 0.24, 0.165, tz - 0.0355], [0, Math.PI, 0])
    k.add('lamp', plane(0.035, 0.026), [sd * 0.165, 0.165, tz - 0.0355], [0, Math.PI, 0])
    for (const x of [0.185, 0.24, 0.29]) k.add('chrome', box(0.004, 0.03, 0.004), [sd * x, 0.165, tz - 0.036])
    k.add('chrome', frame([[-0.082, -0.022], [0.082, -0.022], [0.082, 0.022], [-0.082, 0.022]], [[-0.078, -0.018], [0.078, -0.018], [0.078, 0.018], [-0.078, 0.018]], 0.004), [sd * 0.22, 0.165, tz - 0.035], [0, Math.PI, 0])
  }
  k.add('black', plane(0.124, 0.054), [0, 0.245, tz - 0.003], [0, Math.PI, 0])
  k.add('lamp', plane(0.11, 0.045), [0, 0.245, tz - 0.004], [0, Math.PI, 0])
  k.add('chrome', box(0.6, 0.006, 0.006), [0, 0.29, tz - 0.004])
  if (!fit.exhaust) for (const sd of SIDES) {
    k.add('chrome', new CylinderGeometry(0.02, 0.02, 0.06, 14), [sd * 0.26, 0.1, tz - 0.01], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.015, 14), [sd * 0.26, 0.1, tz - 0.041], [0, Math.PI, 0])
  }
  if (!fit.spoiler) k.add('paint', rbox(0.68, 0.014, 0.06, 0.006), [0, 0.336, tz + 0.04], [0.18, 0, 0])

  // Twin stripes over the hood bulge, roof and trunk (drawn only when painted on).
  for (const x of [-0.06, 0.06]) {
    for (let z = 0.6; z > 0.12; z -= 0.05) S.top('stripe', plane(0.055, 0.052), x, z, fit.hood ? 0.0015 : 0.035)
    for (let z = -0.02; z > -0.48; z -= 0.05) k.add('stripe', box(0.055, 0.004, 0.052), [x, glass.near(z).pts[4][1] + 0.011, z])
    for (let z = -0.58; z > -0.7; z -= 0.05) S.top('stripe', plane(0.055, 0.052), x, z, 0.0015)
  }
  cabin(k, h, 0.215, -0.24, 0.33, 0.04, 0.6)
  h.brakes(k, REVENANT.wid / 2 - 0.02, wz, r, 0.14)
}

export const RESTO: Partial<Record<Body, (k: Kit, fit: ExoticFit, h: ExoticHelpers) => void>> = { pontoon: pontoneGeo, stepnose: sprintGeo, restomuscle: revenantGeo }
