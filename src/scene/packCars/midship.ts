import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Kit, Part } from '../CarModel'
import { Loft } from '../loft'
import { Surface, bodyRing, box, disc, glassRing, greenhouse, honey, plane, poly, rbox, slab, vent, type ExoticFit, type ExoticHelpers, flatWell } from '../exoticCars'

// ---------------------------------------------------------------------------
// Nordwerk Kestrel GT: an entry mid-engine sports car. A short low nose between two
// rounded front fenders, slim LED lamps on their corners and a big intake under each,
// a rounded cab pushed well forward, a deep intake scooped into each flank ahead of the
// rear wheel, flying-buttress sails from the roof to the hips over a louvred engine
// cover, a ducktail that stands up off the tail on two stalks, one light bar right
// across the back and twin pipes in the middle of the diffuser. Our own drawing; the
// name and badges are invented.

export const KESTREL = { len: 1.34, wid: 0.78, wheel: 0.15 }
const SIDES = [-1, 1] as const
type V3 = [number, number, number]

// A closed tube through rings of points (each ring the same count, in order round the
// tube), with flat end caps; faces are turned to point away from each ring's middle.
function skin(rings: V3[][]) {
  const pos: number[] = []
  const mid = rings.map((r) => r.reduce((s, p) => [s[0] + p[0] / r.length, s[1] + p[1] / r.length, s[2] + p[2] / r.length], [0, 0, 0] as V3))
  const tri = (a: V3, b: V3, c: V3, out: Vector3) => {
    const n = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]))
    if (n.dot(out) < 0) [b, c] = [c, b]
    pos.push(...a, ...b, ...c)
  }
  const n = rings[0].length
  for (let i = 0; i < rings.length - 1; i++) {
    const m = mid[i].map((v, c) => (v + mid[i + 1][c]) / 2) as V3
    for (let j = 0; j < n; j++) {
      const a = rings[i][j], b = rings[i][(j + 1) % n], c = rings[i + 1][(j + 1) % n], d = rings[i + 1][j]
      const q = [a, b, c, d].reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0] as V3)
      const out = new Vector3(q[0] - m[0], q[1] - m[1], q[2] - m[2])
      tri(a, b, c, out)
      tri(a, c, d, out)
    }
  }
  for (const [i, o] of [[0, 1], [rings.length - 1, rings.length - 2]]) {
    const out = new Vector3(mid[i][0] - mid[o][0], mid[i][1] - mid[o][1], mid[i][2] - mid[o][2])
    for (let j = 0; j < n; j++) tri(mid[i], rings[i][j], rings[i][(j + 1) % n], out)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2))
  return g
}

// A sheet through a grid of world points (rows of the same count), each triangle turned
// to face dir, with shared corners so it shades smooth.
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
  const m = mergeVertices(g)
  g.dispose()
  m.computeVertexNormals()
  return m
}

// A patch lying on the body's top, following it: a four-cornered outline in (x, z),
// sampled n by n and lifted `out` above the surface.
function decal(S: Surface, c: [number, number][], out: number, n = 5) {
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

// A black wheel well behind each tyre, standing square to the car just clear of the
// widest point of the fender round it.
const wellX = (S: Surface, zz: number, R: number) => {
  let x = 0
  for (let i = -10; i <= 10; i++) x = Math.max(x, S.side(zz + (i / 10) * R))
  return x + 0.003
}

export function midshipGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = KESTREL.wheel
  const wz = KESTREL.len * 0.33
  const fz = KESTREL.len / 2
  const tz = -fz

  // Body: z, half width, bottom, shoulder, fender top, crease x, middle height. A short
  // low nose, front fenders rounded up above a low hood, the doors pulled in under the
  // cab and wide hips over the rear wheels running out to a high flat tail.
  const body = new Loft([
    bodyRing(fz, 0.3, 0.08, 0.162, 0.184, 0.2, 0.178, true),
    bodyRing(0.648, 0.348, 0.074, 0.198, 0.23, 0.22, 0.192, true),
    bodyRing(0.6, 0.374, 0.072, 0.245, 0.285, 0.23, 0.205, true),
    bodyRing(0.51, 0.386, 0.072, 0.28, 0.318, 0.235, 0.222, true),
    bodyRing(0.42, 0.388, 0.072, 0.29, 0.326, 0.24, 0.232, true),
    bodyRing(0.32, 0.382, 0.072, 0.284, 0.318, 0.245, 0.242, true),
    bodyRing(0.2, 0.37, 0.072, 0.276, 0.308, 0.27, 0.27, true),
    bodyRing(0.05, 0.364, 0.072, 0.276, 0.308, 0.29, 0.285, true),
    bodyRing(-0.1, 0.37, 0.072, 0.282, 0.314, 0.29, 0.295, true),
    bodyRing(-0.25, 0.386, 0.072, 0.298, 0.33, 0.27, 0.305, true),
    bodyRing(-0.4, 0.398, 0.073, 0.31, 0.342, 0.25, 0.31, true),
    bodyRing(-0.52, 0.397, 0.075, 0.31, 0.342, 0.25, 0.31, true),
    bodyRing(-0.61, 0.387, 0.08, 0.302, 0.332, 0.24, 0.308, true),
    bodyRing(tz, 0.372, 0.088, 0.29, 0.318, 0.23, 0.302, true),
], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)
  // The same top, taking in the rounded shoulder, for parts laid over the fender edges.
  const S4 = new Surface(k, body, 4, 3)

  // Greenhouse: a fast windshield, a short rounded roof set well forward and a steep
  // rear screen falling to the engine cover.
  const glass = new Loft([
    glassRing(0.3, 0.27, 0.245, 0.2, 0.258, true),
    glassRing(0.2, 0.3, 0.258, 0.238, 0.335, true),
    glassRing(0.1, 0.318, 0.27, 0.254, 0.395, true),
    glassRing(0.0, 0.325, 0.278, 0.26, 0.422, true),
    glassRing(-0.1, 0.325, 0.285, 0.256, 0.43, true),
    glassRing(-0.19, 0.315, 0.291, 0.242, 0.416, true),
    glassRing(-0.27, 0.285, 0.296, 0.21, 0.385, true),
    glassRing(-0.34, 0.23, 0.3, 0.16, 0.35, true),
    glassRing(-0.385, 0.17, 0.303, 0.115, 0.328, true),
], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  greenhouse(k, h, glass, { roof: [0.03, -0.2], pillar: [0.3, 0.03], belt: [0.28, -0.3], mirror: [0.19, 0.29, 0.3] })
  const roofY = (z: number) => glass.near(z).pts[4][1] + 0.009

  // Cockpit: two low buckets, the dash with its screen, the wheel and a console.
  for (const sd of SIDES) h.seat(k, sd * 0.125, 0.18, -0.1, 0.13, 0.13)
  k.add('dash', rbox(0.46, 0.04, 0.08, 0.016), [0, 0.28, 0.19])
  k.add('display', plane(0.06, 0.03), [0, 0.298, 0.145], [-0.4, 0, 0])
  h.steering(k, 0.125, 0.3, 0.1)
  k.add('dash', rbox(0.06, 0.05, 0.22, 0.015), [0, 0.23, 0.04])
  // A dark bulkhead behind the seats, so the cab reads closed off from the engine.
  k.add('cabin', rbox(0.4, 0.07, 0.03, 0.012), [0, 0.33, -0.3], [-0.3, 0, 0])

  // Flying buttresses: broad painted sails from the back corners of the roof down onto
  // the hips, each a blade with an outer wall dropping to the body, so the side glass
  // ends in a raked C pillar and a tunnel runs between the sail and the rear screen,
  // with a black channel on the deck inside it so the air through reads.
  const path: [number, number, number][] = [[-0.13, 0.242, 0.424], [-0.22, 0.268, 0.404], [-0.31, 0.292, 0.378], [-0.4, 0.31, 0.352], [-0.49, 0.322, 0.3], [-0.57, 0.33, 0.3], [-0.625, 0.334, 0.3]]
  for (const sd of SIDES) {
    const rings = path.map(([z, x, yp], i): V3[] => {
      const end = i === path.length - 1
      const a = i === 0 ? 0.022 : end ? 0.024 : 0.032
      const b = 0.007
      const xi = x - a
      const xo = x + a
      // Toward the tail the blade lies down onto the hip instead of floating over it.
      const y = end ? S.y(x, z) + 0.006 : Math.max(yp, S.y(x, z) + 0.016)
      const foot = i === 0 ? y - 0.022 : S.y(xo, z) - 0.006
      const leg = Math.min(foot, y - 0.022)
      return [[xi, y + 0.006, z], [xo - 0.008, y + b - 0.004, z], [xo, y - 0.01, z], [xo, leg, z], [xo - 0.01, leg, z], [xo - 0.01, y - 0.018, z], [xi, y + 0.006 - 2 * b, z]].map(([px, py, pz]): V3 => [sd * px, py, pz])
    })
    k.add('paint', skin(rings))
    const [z0, x0] = path[1]
    const [z1, x1] = path[3]
    k.add('black', decal(S, [[sd * (x0 - 0.026), z0], [sd * (x0 + 0.012), z0], [sd * (x1 + 0.012), z1], [sd * (x1 - 0.026), z1]], 0.003, 6))
  }

  // Engine cover: a louvred panel between the sails behind the rear screen, and a black
  // seal along the foot of the screen.
  vent(S, 0, -0.485, 0.3, 0.17, 7)
  S.top('black', box(0.3, 0.014, 0.004), 0, -0.39, 0.004)

  // Wheel arches: a black well and dark lip round each tyre.
  const R = 0.172
  const cy = r - 0.004
  for (const zz of [wz, -wz]) {
    const x = wellX(S, zz, R)
    flatWell(k, S, zz, cy, R, r, x)
  }

  // Sides: a deep intake ahead of each rear wheel with fins in its mouth, door cut and a
  // flush handle, a black sill, a front marker and the filler on the left hip.
  for (const sd of SIDES) {
    const iz = -0.2
    S.wall('black', poly([[-0.085, -0.055], [0.075, -0.06], [0.09, 0.048], [-0.06, 0.03]]), sd, iz, 0.2, 0.003)
    for (const dz of [-0.04, 0, 0.04]) S.wall('dark', box(0.006, 0.075, 0.008), sd, iz + dz, 0.195 + dz * 0.15, 0.007, 0.12)
    // A body-colour strake over the top of the mouth, sweeping up toward the hip.
    h.bar(k, 'paint', [sd * (S.side(-0.125) + 0.004), 0.25, -0.125], [sd * (S.side(-0.29) + 0.004), 0.27, -0.29], 0.012)
    S.wall('dark', plane(0.005, 0.15), sd, 0.215, 0.19, 0.003, 0.12)
    S.wall('dark', plane(0.005, 0.12), sd, -0.11, 0.2, 0.003, -0.05)
    S.wall('black', rbox(0.045, 0.01, 0.008, 0.003), sd, -0.06, 0.262, 0.003)
    S.wall('amber', plane(0.035, 0.01), sd, 0.615, 0.17, 0.003)
    if (!fit.kit) k.add('black', rbox(0.03, 0.026, 0.46, 0.008), [sd * (S.side(-0.02) - 0.002), 0.082, -0.02])
  }
  S.top('dark', new CircleGeometry(0.018, 10), -0.33, -0.45, 0.003)

  // Nose: a big intake in each corner under the lamps, mesh behind it and a bar across,
  // a slim slot between them, the badge on the hood's nose and a black splitter.
  const fy = fz + 0.002
  for (const sd of SIDES) {
    const q = (pts: [number, number][]) => pts.map(([x, y]): [number, number] => [x * sd, y])
    k.add('black', poly(q([[0.12, 0.088], [0.262, 0.088], [0.284, 0.112], [0.278, 0.15], [0.15, 0.146], [0.125, 0.13]])), [0, 0, fy])
    honey(k, sd * 0.2, 0.117, fy + 0.001, 0.13, 0.045, 0.007, 1)
    k.add('paint', box(0.15, 0.007, 0.006), [sd * 0.2, 0.12, fy + 0.006])
  }
  k.add('black', poly([[-0.09, 0.1], [0.09, 0.1], [0.082, 0.118], [-0.082, 0.118]]), [0, 0, fy])
  S.top('chrome', new CircleGeometry(0.014, 14), 0, 0.64, 0.003)
  S.top('dark', poly([[-0.008, -0.006], [0.0, 0.008], [0.008, -0.006]]), 0, 0.64, 0.0055)
  if (!fit.kit) {
    k.add('black', box(0.58, 0.01, 0.05), [0, 0.076, fz - 0.012])
    for (const sd of SIDES) k.add('black', box(0.05, 0.005, 0.03), [sd * 0.31, 0.1, 0.64], [0, sd * 0.5, sd * -0.2])
  }

  // Headlights: a slim swept black slot on each front corner with an LED strip along it.
  for (const sd of SIDES) {
    const q = (pts: [number, number][]) => pts.map(([x, z]): [number, number] => [x * sd, z])
    k.add('black', decal(S4, q([[0.16, 0.64], [0.29, 0.62], [0.318, 0.585], [0.19, 0.618]]), 0.004))
    k.add('lamp', decal(S4, q([[0.18, 0.632], [0.29, 0.614], [0.304, 0.594], [0.2, 0.618]]), 0.007, 4))
  }

  // Hood: a black cowl strip at the foot of the windshield and a wiper.
  S.top('black', box(0.46, 0.02, 0.004), 0, 0.31, 0.004)
  h.bar(k, 'black', [-0.2, 0.258, 0.29], [0.04, 0.262, 0.28], 0.007)

  // Tail: one light bar right across on a black band, a plate between the hips, a black
  // valance with the reversing lamps, a diffuser right across and two pipes in its middle.
  const by = tz - 0.002
  const back = (part: Part, pts: [number, number][], y: number, z: number) => k.add(part, poly(pts.map(([px, py]) => [-px, py])), [0, y, z], [0, Math.PI, 0])
  back('black', [[-0.35, -0.018], [0.35, -0.018], [0.358, 0.016], [-0.358, 0.016]], 0.27, by)
  k.add('tail', box(0.68, 0.007, 0.004), [0, 0.274, tz - 0.0045])
  for (const sd of SIDES) back('tail', [[0.3, -0.012], [0.344, -0.012], [0.35, 0.011], [0.29, 0.011]].map(([x, y]) => [x * sd, y]), 0.27, tz - 0.0045)
  k.add('dark', box(0.08, 0.012, 0.003), [0, 0.255, tz - 0.004])
  back('black', [[-0.062, -0.027], [0.062, -0.027], [0.062, 0.027], [-0.062, 0.027]], 0.205, by)
  back('lamp', [[-0.055, -0.0225], [0.055, -0.0225], [0.055, 0.0225], [-0.055, 0.0225]], 0.205, tz - 0.0045)
  back('black', [[-0.34, 0.098], [0.34, 0.098], [0.355, 0.152], [-0.355, 0.152]], 0, by)
  for (const sd of SIDES) k.add('lamp', plane(0.05, 0.012), [sd * 0.25, 0.14, tz - 0.0045], [0, Math.PI, 0])
  if (!fit.exhaust) for (const sd of SIDES) {
    k.add('chrome', new CylinderGeometry(0.024, 0.024, 0.05, 14), [sd * 0.045, 0.122, tz + 0.002], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.019, 14), [sd * 0.045, 0.122, tz - 0.0235], [0, Math.PI, 0])
  }
  if (!fit.kit) {
    k.add('black', box(0.62, 0.012, 0.13), [0, 0.088, tz + 0.06], [0.14, 0, 0])
    for (const x of [-0.27, -0.2, -0.13, 0.13, 0.2, 0.27]) k.add('black', slab([[tz + 0.12, 0.084], [tz - 0.004, 0.084], [tz - 0.004, 0.112], [tz + 0.12, 0.096]], 0.006), [x, 0, 0], [0, -Math.PI / 2, 0])
  }

  // Ducktail: a body-colour blade raised off the end of the deck on two black stalks.
  if (!fit.spoiler) {
    const yd = S.y(0, tz + 0.04)
    k.add('paint', slab([[-0.035, -0.005], [0.03, -0.004], [0.036, 0.006], [-0.03, 0.004]], 0.6), [0, yd + 0.03, tz + 0.04], [0, Math.PI / 2, 0.12])
    for (const sd of SIDES) k.add('black', slab([[-0.025, yd - 0.008], [0.02, yd - 0.008], [0.012, yd + 0.028], [-0.012, yd + 0.028]], 0.008), [sd * 0.2, 0, tz + 0.04], [0, Math.PI / 2, 0])
  }

  // Twin stripes over the hood, the roof and the tail (drawn only when painted on).
  for (const x of [-0.045, 0.045]) {
    if (!fit.hood) for (let z = 0.62; z > 0.32; z -= 0.05) S.top('stripe', plane(0.045, 0.052), x, z, 0.003)
    for (let z = 0.02; z > -0.2; z -= 0.045) {
      const e = 0.01
      const a = Math.atan2(roofY(z + e) - roofY(z - e), 2 * e)
      k.add('stripe', box(0.045, 0.004, 0.047), [x, roofY(z) + 0.002, z], [-a, 0, 0])
    }
    for (let z = -0.59; z > tz + 0.07; z -= 0.03) S.top('stripe', plane(0.045, 0.031), x, z, 0.003)
  }

  h.brakes(k, (z) => wellX(S, z, R) - 0.025, wz, r, 0.14)
}
