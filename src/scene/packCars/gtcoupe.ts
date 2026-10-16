import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Kit } from '../CarModel'
import { Loft } from '../loft'
import { Surface, bodyRing, box, disc, glassRing, greenhouse, honey, interior, plane, poly, rbox, slab, type ExoticFit, type ExoticHelpers, flatWell } from '../exoticCars'

// ---------------------------------------------------------------------------
// Kazumi Sora GT: an everyday front-engine 2+2 sports coupe. A long low hood between
// two rounded front fenders that stand a little proud of it, the cab set well back, a
// smooth fastback roof falling to a short deck with a small duck tail, full hips over
// the rear wheels, slim swept headlights, a wide plain mouth, slim tail lamps joined by
// a dark garnish and a pipe at each corner. Our own drawing; the name is invented.

type V3 = [number, number, number]

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

// A sheet through a grid of world points (rows of the same count), each triangle turned
// so it faces out to side sd.
function sheet(grid: V3[][], dir: V3) {
  const pos: number[] = []
  const tri = (a: V3, b: V3, c: V3) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    const d = (uy * vz - uz * vy) * dir[0] + (uz * vx - ux * vz) * dir[1] + (ux * vy - uy * vx) * dir[2]
    pos.push(...a, ...(d < 0 ? [...c, ...b] : [...b, ...c]))
  }
  for (let i = 0; i + 1 < grid.length; i++) for (let j = 0; j + 1 < grid[i].length; j++) {
    tri(grid[i][j], grid[i][j + 1], grid[i + 1][j + 1])
    tri(grid[i][j], grid[i + 1][j + 1], grid[i + 1][j])
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
  // Shared corners so the sheet shades smooth, not faceted.
  const m = mergeVertices(g)
  g.dispose()
  m.computeVertexNormals()
  return m
}

// A patch lying on the body's top, following it: a four-cornered outline in (x, z),
// sampled n by n and lifted `out` above the surface.
function decal(S: Surface, c: [number, number][], out: number, n = 6) {
  const grid: V3[][] = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const row: V3[] = []
    for (let j = 0; j <= n; j++) {
      const v = j / n
      const x = (c[0][0] * (1 - v) + c[1][0] * v) * (1 - u) + (c[3][0] * (1 - v) + c[2][0] * v) * u
      const z = (c[0][1] * (1 - v) + c[1][1] * v) * (1 - u) + (c[3][1] * (1 - v) + c[2][1] * v) * u
      row.push([x, S.y(x, z) + out, z])
    }
    grid.push(row)
  }
  return sheet(grid, [0, 1, 0])
}

export const SORA = { len: 1.3, wid: 0.74, wheel: 0.15 }
const SIDES = [-1, 1] as const

// A black wheel well behind each tyre with a thin dark lip, standing square to the car
// just clear of the widest point of the fender round it.
const wellX = (S: Surface, zz: number, R: number) => {
  let x = 0
  for (let i = -10; i <= 10; i++) x = Math.max(x, S.side(zz + (i / 10) * R))
  return x + 0.003
}

export function gtcoupeGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = SORA.wheel
  const wz = SORA.len * 0.33
  const front = SORA.len / 2
  const tz = -front

  // Body: soft rounded sections. z, half width, bottom, shoulder, fender top, crease x,
  // middle height. The front fenders rise just above the hood, the doors pull in a
  // little and the hips swell back out over the rear wheels.
  const body = new Loft([
    bodyRing(front, 0.29, 0.088, 0.16, 0.19, 0.2, 0.188, true),
    bodyRing(0.638, 0.335, 0.08, 0.19, 0.222, 0.22, 0.208, true),
    bodyRing(0.6, 0.36, 0.076, 0.228, 0.258, 0.23, 0.228, true),
    bodyRing(0.52, 0.37, 0.075, 0.268, 0.298, 0.235, 0.248, true),
    bodyRing(0.43, 0.372, 0.075, 0.282, 0.314, 0.24, 0.26, true),
    bodyRing(0.32, 0.368, 0.075, 0.272, 0.306, 0.245, 0.27, true),
    bodyRing(0.2, 0.36, 0.075, 0.256, 0.292, 0.26, 0.279, true),
    bodyRing(0.06, 0.356, 0.075, 0.248, 0.283, 0.285, 0.285, true),
    bodyRing(-0.12, 0.358, 0.075, 0.25, 0.286, 0.29, 0.288, true),
    bodyRing(-0.28, 0.37, 0.075, 0.27, 0.302, 0.29, 0.292, true),
    bodyRing(-0.43, 0.376, 0.076, 0.284, 0.316, 0.28, 0.296, true),
    bodyRing(-0.55, 0.37, 0.08, 0.278, 0.312, 0.27, 0.3, true),
    bodyRing(-0.62, 0.355, 0.09, 0.27, 0.306, 0.26, 0.302, true),
    bodyRing(tz, 0.33, 0.105, 0.258, 0.298, 0.25, 0.3, true),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)

  // Greenhouse: a raked windshield, a short roof and a long fastback down to the deck.
  const glass = new Loft([
    glassRing(0.15, 0.322, 0.272, 0.305, 0.286),
    glassRing(0.07, 0.326, 0.274, 0.284, 0.35),
    glassRing(-0.01, 0.328, 0.276, 0.27, 0.414),
    glassRing(-0.09, 0.33, 0.278, 0.264, 0.446),
    glassRing(-0.18, 0.33, 0.28, 0.262, 0.452),
    glassRing(-0.28, 0.328, 0.282, 0.256, 0.436),
    glassRing(-0.38, 0.316, 0.286, 0.242, 0.396),
    glassRing(-0.46, 0.296, 0.29, 0.222, 0.35),
    glassRing(-0.52, 0.27, 0.293, 0.2, 0.312),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  greenhouse(k, h, glass, { roof: [-0.01, -0.3], pillar: [0.15, -0.01], belt: [0.14, -0.44], mirror: [0.12, 0.275, 0.29] })
  const roofY = (z: number) => glass.near(z).pts[4][1] + 0.009
  // A painted C pillar sweeping from the roof down to the hips, so the side glass ends in
  // a clean quarter window, and a slim black B pillar behind the door glass.
  for (const sd of SIDES) {
    const at = (z: number, t: number): V3 => {
      const p = glass.near(z).pts
      const x = p[1][0] + (p[2][0] - p[1][0]) * t
      const y = p[1][1] + (p[2][1] - p[1][1]) * t
      const ux = p[2][0] - p[1][0]
      const uy = p[2][1] - p[1][1]
      const l = Math.hypot(ux, uy)
      return [sd * (x + (uy / l) * 0.004), y - (ux / l) * 0.004, z]
    }
    // A grid over the side glass: rows up the glass, each from the raked leading edge back
    // to the glass's end, every triangle turned to face out.
    const z0 = -0.3
    const z1 = -0.53
    const lead = (t: number) => z0 - 0.1 * (1 - t) ** 1.3
    const grid: V3[][] = []
    for (let i = 0; i <= 5; i++) {
      const t = i / 5
      const row: V3[] = []
      for (let j = 0; j <= 6; j++) row.push(at(lead(t) + (z1 - lead(t)) * (j / 6), t))
      grid.push(row)
    }
    k.add('paint', sheet(grid, [sd, 0, 0]))
    // Over the top of the rear glass the pillar widens toward the tail, leaving a narrower
    // rear window between the two.
    const top: V3[][] = []
    for (let i = 0; i <= 6; i++) {
      const z = -0.295 + ((z1 + 0.235) * i) / 6
      const p = glass.near(z).pts
      const yt = p[4][1] + 0.004
      const xi = p[3][0] * (0.8 - 0.25 * (i / 6))
      const row: V3[] = []
      for (let j = 0; j <= 4; j++) row.push([sd * (xi + ((p[3][0] - xi) * j) / 4), yt, z])
      row.push([sd * (p[2][0] + 0.003), p[2][1] + 0.003, z], at(z, 1))
      top.push(row)
    }
    k.add('paint', sheet(top, [sd * 0.3, 1, 0]))
    const b = [at(-0.19, 0), at(-0.215, 0), at(-0.225, 1), at(-0.2, 1)]
    k.add('black', facet(sd > 0 ? b : [b[0], b[3], b[2], b[1]]))
  }

  // Cabin: two seats with a small bench behind, dash, wheel and gear lever.
  interior(k, h, -0.12, 0.1)
  k.add('dash', rbox(0.46, 0.05, 0.08, 0.02), [0, 0.22, -0.32])

  // Wheel arches: a black well and dark lip round each tyre.
  const R = 0.172
  const cy = r - 0.004
  for (const zz of [wz, -wz]) {
    const x = wellX(S, zz, R)
    flatWell(k, S, zz, cy, R, r, x)
  }

  // Sides: door cut and handle, a small gill behind each front wheel, a black sill, a
  // front marker and a fuel flap on the right hip.
  for (const sd of SIDES) {
    S.wall('dark', plane(0.005, 0.16), sd, 0.17, 0.18, 0.003, 0.08)
    S.wall('dark', plane(0.005, 0.15), sd, -0.21, 0.19, 0.003, -0.05)
    S.wall('black', rbox(0.05, 0.011, 0.008, 0.004), sd, -0.15, 0.235, 0.003)
    S.wall('black', poly([[-0.03, -0.012], [0.035, -0.008], [0.03, 0.012], [-0.03, 0.01]]), sd, 0.235, 0.205, 0.003)
    S.wall('dark', box(0.05, 0.004, 0.003), sd, 0.235, 0.205, 0.005)
    S.wall('amber', plane(0.035, 0.012), sd, 0.6, 0.17, 0.003)
    if (!fit.kit) k.add('black', rbox(0.03, 0.026, 0.44, 0.008), [sd * (S.side(0) + 0.002), 0.085, 0])
  }
  S.wall('dark', new CircleGeometry(0.02, 12), 1, -0.33, 0.24, 0.003)

  // Nose: a wide plain mouth low in the bumper with mesh behind, a thin slot above it,
  // small amber lamps in the corners and a slim black lip.
  const fz = front
  honey(k, 0, 0.127, fz + 0.001, 0.38, 0.06, 0.008, 1)
  k.add('dark', rbox(0.4, 0.006, 0.006, 0.002), [0, 0.16, fz + 0.003])
  if (!fit.kit) k.add('dark', rbox(0.4, 0.006, 0.006, 0.002), [0, 0.094, fz + 0.0045])
  k.add('black', plane(0.14, 0.012), [0, 0.172, fz + 0.002])
  for (const sd of SIDES) {
    k.add('black', poly([[-0.03, -0.012], [0.03, -0.016], [0.03, 0.012], [-0.03, 0.014]].map(([x, y]) => [x * sd, y])), [sd * 0.235, 0.125, fz + 0.002])
    k.add('amber', plane(0.04, 0.01), [sd * 0.235, 0.128, fz + 0.004])
  }
  if (!fit.kit) k.add('black', box(0.56, 0.008, 0.04), [0, 0.08, fz - 0.012])
  // Plate.
  k.add('black', plane(0.124, 0.034), [0, 0.1, fz + 0.01])
  k.add('lamp', plane(0.11, 0.028), [0, 0.1, fz + 0.013])

  // Headlights: slim swept units on each front corner, a black slot with two small
  // projectors and an LED line along its top edge.
  for (const sd of SIDES) {
    const q = (pts: [number, number][]) => pts.map(([x, z]): [number, number] => [x * sd, z])
    k.add('black', decal(S, q([[0.15, 0.632], [0.3, 0.618], [0.33, 0.552], [0.2, 0.598]]), 0.004))
    k.add('lamp', decal(S, q([[0.2, 0.612], [0.3, 0.603], [0.322, 0.56], [0.24, 0.588]]), 0.008, 4))
    k.add('lamp', decal(S, q([[0.165, 0.629], [0.29, 0.617], [0.293, 0.612], [0.168, 0.623]]), 0.008, 3))
    k.add('amber', decal(S, q([[0.17, 0.615], [0.195, 0.613], [0.205, 0.603], [0.182, 0.606]]), 0.008, 2))
    for (const [x, z] of [[0.235, 0.6], [0.285, 0.584]]) {
      k.add('chrome', decal(S, q([[x - 0.014, z + 0.008], [x + 0.014, z + 0.008], [x + 0.014, z - 0.008], [x - 0.014, z - 0.008]]), 0.0115, 2))
    }
  }

  // Cowl: a black strip across the foot of the windshield, and a wiper.
  S.top('black', box(0.5, 0.022, 0.004), 0, 0.163, 0.004)
  h.bar(k, 'black', [-0.22, 0.288, 0.15], [0.03, 0.295, 0.135], 0.007)

  // Tail: slim lamps across each corner joined by a dark garnish, a plate, a reverse lamp,
  // a pipe at each corner and a black diffuser along the bottom.
  for (const sd of SIDES) {
    k.add('black', poly([[0.13, -0.022], [0.3, -0.022], [0.318, 0.0], [0.3, 0.022], [0.13, 0.018]].map(([x, y]) => [-x * sd, y])), [0, 0.25, tz - 0.002], [0, Math.PI, 0])
    k.add('tail', poly([[0.15, -0.012], [0.29, -0.012], [0.302, 0.0], [0.29, 0.012], [0.15, 0.009]].map(([x, y]) => [-x * sd, y])), [0, 0.25, tz - 0.0045], [0, Math.PI, 0])
    k.add('tail', box(0.12, 0.004, 0.003), [sd * 0.21, 0.25, tz - 0.0075])
    k.add('lamp', plane(0.03, 0.01), [sd * 0.14, 0.165, tz - 0.003], [0, Math.PI, 0])
    k.add('tail', plane(0.04, 0.008), [sd * 0.27, 0.16, tz - 0.003], [0, Math.PI, 0])
  }
  k.add('dark', plane(0.26, 0.014), [0, 0.25, tz - 0.002], [0, Math.PI, 0])
  k.add('black', plane(0.124, 0.054), [0, 0.2, tz - 0.002], [0, Math.PI, 0])
  k.add('lamp', plane(0.11, 0.045), [0, 0.2, tz - 0.0045], [0, Math.PI, 0])
  if (!fit.kit) {
    k.add('black', box(0.58, 0.03, 0.08), [0, 0.1, tz + 0.03])
    for (const x of [-0.08, 0, 0.08]) k.add('black', box(0.008, 0.035, 0.07), [x, 0.09, tz + 0.03])
  }
  if (!fit.exhaust) for (const sd of SIDES) {
    k.add('chrome', new CylinderGeometry(0.024, 0.024, 0.05, 14), [sd * 0.22, 0.115, tz + 0.005], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.019, 14), [sd * 0.22, 0.115, tz - 0.0205], [0, Math.PI, 0])
  }
  // Duck tail: a small lip rising off the end of the deck.
  if (!fit.spoiler) k.add('paint', slab([[-0.05, -0.008], [0.0, -0.008], [0.012, 0.012], [-0.01, 0.006], [-0.05, 0.003]], 0.62), [0, S.y(0, tz + 0.01) + 0.002, tz + 0.012], [0, Math.PI / 2, 0])

  // Third brake light on the top of the rear glass.
  k.add('tail', box(0.12, 0.008, 0.008), [0, roofY(-0.31) - 0.004, -0.31])

  // Twin stripes over the hood, roof and deck (drawn only when painted on).
  for (const x of [-0.05, 0.05]) {
    if (!fit.hood) for (let z = 0.6; z > 0.17; z -= 0.05) S.top('stripe', plane(0.045, 0.052), x, z, 0.003)
    for (let z = -0.02; z > -0.3; z -= 0.05) k.add('stripe', box(0.045, 0.004, 0.052), [x, roofY(z) + 0.002, z])
    S.top('stripe', plane(0.045, 0.05), x, -0.56, 0.003)
  }

  h.brakes(k, (z) => wellX(S, z, R) - 0.025, wz, r, 0.14)
}
