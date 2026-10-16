import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute, TorusGeometry, Vector3 } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Kit, Part } from '../CarModel'
import { Loft, type Pt, type Section } from '../loft'
import { Surface, box, disc, frame, glassRing, greenhouse, plane, poly, rbox, slab, type ExoticFit, type ExoticHelpers } from '../exoticCars'

// ---------------------------------------------------------------------------
// Liberty Thunderjet 440: an early-seventies muscle hardtop. Tall slab sides under a
// low pillarless greenhouse, a long flat hood with a raised cowl scoop opening toward
// the windshield and two hood pins, a full-width grille set back in a chrome bezel with
// four round lamps, slim chrome bumpers wrapping the corners, a semi-fastback roof with
// body-colour sails, coke-bottle hips kicking up over the rear wheels, a small spoiler
// on the deck, a full-width tail lamp bar and a pipe each side. Our own drawing; the
// name and the badges are invented.

export const THUNDERJET = { len: 1.42, wid: 0.76, wheel: 0.155 }
const SIDES = [-1, 1] as const
type V3 = [number, number, number]

// Body half-ring: the bottom, a short tuck, an upright slab side up to the belt crease
// (its widest line), a narrow chamfer, the fender top, the hood crease and the middle.
function slabRing(z: number, W: number, yb: number, ysh: number, yd: number, wc: number, yc: number): Section {
  const pts: Pt[] = [
    [0, yb], [W - 0.038, yb, true], [W - 0.012, yb + 0.03, true], [W, yb + 0.1, true], [W, ysh, true], [W - 0.016, ysh + 0.01, true],
    [W - 0.042, yd, true], [Math.min(wc, W - 0.07), yc + 0.003, true], [0, yc],
  ]
  return { z, pts }
}

// A thin solid band through cross-sections: each is a line of points (outer face) with
// an outward normal per point, given a thickness from -inner to +outer.
function band(lines: { z: number; pts: [number, number, number, number][] }[], sd: number, outer: number, inner: number) {
  const pos: number[] = []
  const nor: number[] = []
  const o = lines.map((l) => l.pts.map(([x, y, nx, ny]): V3 => [sd * (x + nx * outer), y + ny * outer, l.z]))
  const i = lines.map((l) => l.pts.map(([x, y, nx, ny]): V3 => [sd * (x - nx * inner), y - ny * inner, l.z]))
  const nrm = lines.map((l) => l.pts.map(([, , nx, ny]): V3 => [sd * nx, ny, 0]))
  // A quad turned to face `out`; smooth normals per corner when given, else its own.
  const quad = (a: V3, b: V3, c: V3, d: V3, out: V3, ns?: V3[]) => {
    const n = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]))
    if (n.lengthSq() < 1e-14) n.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]).cross(new Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2])).negate()
    const flip = n.dot(new Vector3(...out)) < 0
    const f = n.normalize().multiplyScalar(flip ? -1 : 1)
    const v = [a, b, c, d]
    const vn = ns ?? [0, 1, 2, 3].map((): V3 => [f.x, f.y, f.z])
    const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]
    for (const k of order) {
      pos.push(...v[k])
      nor.push(...vn[k])
    }
  }
  const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]]
  const m = lines[0].pts.length
  for (let s = 0; s < lines.length - 1; s++) {
    for (let j = 0; j < m - 1; j++) {
      const ns = [nrm[s][j], nrm[s][j + 1], nrm[s + 1][j + 1], nrm[s + 1][j]]
      const n: V3 = [ns[0][0] + ns[1][0], ns[0][1] + ns[1][1], 0]
      quad(o[s][j], o[s][j + 1], o[s + 1][j + 1], o[s + 1][j], n, ns)
      quad(i[s][j], i[s][j + 1], i[s + 1][j + 1], i[s + 1][j], neg(n), ns.map(neg))
    }
    for (const [j, jn] of [[0, 1], [m - 1, m - 2]]) {
      const d: V3 = [o[s][j][0] - o[s][jn][0], o[s][j][1] - o[s][jn][1], 0]
      quad(o[s][j], i[s][j], i[s + 1][j], o[s + 1][j], d)
    }
  }
  for (const s of [0, lines.length - 1]) {
    const dir = Math.sign(lines[s].z - lines[s === 0 ? 1 : s - 1].z)
    for (let j = 0; j < m - 1; j++) quad(o[s][j], o[s][j + 1], i[s][j + 1], i[s][j], [0, 0, dir])
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2))
  return g
}

// A sheet through a grid of world points (rows of the same count), each triangle turned
// to face `dir`, shaded smooth.
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

// A slim bumper seen from above: a blade w half wide across the end at zf, rounding the
// corners and wrapping `wrap` back along the sides, t thick; dir 1 front, -1 rear.
function bumperPlan(zf: number, w: number, wrap: number, t: number, dir: number): [number, number][] {
  const rc = 0.06
  const arc = (r: number, x0: number, from: number, to: number) => {
    const out: [number, number][] = []
    for (let i = 0; i <= 5; i++) {
      const a = from + ((to - from) * i) / 5
      out.push([x0 + Math.cos(a) * r, zf - dir * rc + dir * Math.sin(a) * r])
    }
    return out
  }
  const outer: [number, number][] = [[w, zf - dir * wrap], ...arc(rc, w - rc, 0, Math.PI / 2), ...arc(rc, -(w - rc), Math.PI / 2, Math.PI), [-w, zf - dir * wrap]]
  const inner: [number, number][] = [[-(w - t), zf - dir * wrap], ...arc(rc - t, -(w - rc), Math.PI, Math.PI / 2), ...arc(rc - t, w - rc, Math.PI / 2, 0), [w - t, zf - dir * wrap]]
  return [...outer, ...inner]
}

// A rounded rectangle outline, half sizes w by h, corner radius r, centred at (x, y).
function rrect(x: number, y: number, w: number, h: number, r: number): [number, number][] {
  const out: [number, number][] = []
  for (const [cx, cy, a0] of [[w - r, h - r, 0], [-(w - r), h - r, Math.PI / 2], [-(w - r), -(h - r), Math.PI], [w - r, -(h - r), Math.PI * 1.5]]) {
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i / 3) * (Math.PI / 2)
      out.push([x + cx + Math.cos(a) * r, y + cy + Math.sin(a) * r])
    }
  }
  return out
}

// A black wheel well square to the car, just clear of the widest point of the fender round it.
const wellX = (S: Surface, zz: number, R: number) => {
  let x = 0
  for (let i = -10; i <= 10; i++) x = Math.max(x, S.side(zz + (i / 10) * R))
  return x + 0.003
}

export function musclecoupeGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = THUNDERJET.wheel
  const wz = THUNDERJET.len * 0.33
  const fz = THUNDERJET.len / 2
  const tz = -fz

  // Body: z, half width, bottom, belt, fender top, hood crease x, middle height. Tall slab
  // sides; the doors pull in and the hips swell out and kick up over the rear wheels, so
  // the deck sits down between them.
  const keys = [
    slabRing(fz, 0.35, 0.132, 0.333, 0.343, 0.24, 0.335),
    slabRing(0.69, 0.366, 0.118, 0.341, 0.351, 0.25, 0.342),
    slabRing(0.64, 0.377, 0.106, 0.345, 0.356, 0.25, 0.346),
    slabRing(0.54, 0.379, 0.1, 0.347, 0.358, 0.25, 0.348),
    slabRing(0.44, 0.379, 0.1, 0.348, 0.359, 0.25, 0.35),
    slabRing(0.32, 0.375, 0.1, 0.348, 0.359, 0.255, 0.352),
    slabRing(0.18, 0.369, 0.1, 0.348, 0.359, 0.26, 0.353),
    slabRing(0.02, 0.364, 0.1, 0.348, 0.359, 0.27, 0.354),
    slabRing(-0.14, 0.364, 0.1, 0.349, 0.361, 0.275, 0.356),
    slabRing(-0.26, 0.37, 0.1, 0.355, 0.369, 0.28, 0.358),
    slabRing(-0.38, 0.38, 0.1, 0.365, 0.379, 0.28, 0.36),
    slabRing(-0.5, 0.384, 0.1, 0.369, 0.383, 0.28, 0.362),
    slabRing(-0.6, 0.381, 0.102, 0.368, 0.382, 0.275, 0.363),
    slabRing(-0.67, 0.372, 0.108, 0.364, 0.378, 0.265, 0.362),
    slabRing(tz, 0.36, 0.12, 0.357, 0.371, 0.255, 0.36),
  ]
  const body = new Loft(keys, 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 6, 3)
  // The body's own rings, so trim on the side follows its facets exactly.
  const rings: Section[] = []
  for (let i = 0; i < keys.length - 1; i++) for (let s = 0; s < 5; s++) rings.push(body.at(i + s / 5))
  rings.push(body.at(keys.length - 1))
  const along = (z0: number, z1: number) => rings.filter((q) => q.z <= z0 + 1e-6 && q.z >= z1 - 1e-6)

  // Greenhouse: a low cab set well back, a raked windshield, a short roof and a long
  // semi-fastback falling to a short deck.
  const glass = new Loft([
    glassRing(0.17, 0.322, 0.348, 0.296, 0.362),
    glassRing(0.1, 0.327, 0.35, 0.288, 0.415),
    glassRing(0.02, 0.33, 0.351, 0.279, 0.468),
    glassRing(-0.06, 0.33, 0.352, 0.272, 0.494),
    glassRing(-0.15, 0.33, 0.353, 0.268, 0.5),
    glassRing(-0.25, 0.33, 0.357, 0.265, 0.497),
    glassRing(-0.34, 0.327, 0.362, 0.258, 0.478),
    glassRing(-0.43, 0.316, 0.368, 0.245, 0.444),
    glassRing(-0.5, 0.29, 0.366, 0.228, 0.41),
    glassRing(-0.56, 0.25, 0.365, 0.21, 0.378),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  greenhouse(k, h, glass, { roof: [0.025, -0.33], pillar: [0.17, 0.025], belt: [0.16, -0.46], mirror: [0.13, 0.27, 0.362], roofPart: 'black' })

  // Sails: body-colour C pillars over the back of the side glass, their leading edge
  // raked, and reaching in over the top of the back glass so it is narrower than the roof.
  // No B pillar: the door and quarter glass run together, hardtop style.
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
    const z0 = -0.29
    const z1 = -0.56
    const lead = (t: number) => z0 - 0.13 * (1 - t) ** 1.2
    const grid: V3[][] = []
    for (let i = 0; i <= 5; i++) {
      const t = i / 5
      const row: V3[] = []
      for (let j = 0; j <= 6; j++) row.push(at(lead(t) + (z1 - lead(t)) * (j / 6), t))
      grid.push(row)
    }
    k.add('black', sheet(grid, [sd, 0, 0]))
    const top: V3[][] = []
    for (let i = 0; i <= 6; i++) {
      const z = -0.29 + ((z1 + 0.27) * i) / 6
      const p = glass.near(z).pts
      const yt = p[4][1] + 0.004
      const xi = p[3][0] * (0.9 - 0.12 * (i / 6))
      const row: V3[] = []
      for (let j = 0; j <= 4; j++) row.push([sd * (xi + ((p[3][0] - xi) * j) / 4), yt, z])
      row.push([sd * (p[2][0] + 0.003), p[2][1] + 0.003, z], at(z, 1))
      top.push(row)
    }
    k.add('black', sheet(top, [sd * 0.3, 1, 0]))
  }
  // Two wipers parked at the foot of the windshield.
  for (const x of [-0.18, 0.05]) h.bar(k, 'black', [x, 0.371, 0.168], [x + 0.17, 0.381, 0.155], 0.008)

  // Wheel wells: a black half disc behind each tyre, black down to the sill, and a
  // chrome lip moulding round the arch.
  const R = 0.168
  const cy = r - 0.008
  for (const zz of [wz, -wz]) {
    const x = wellX(S, zz, R)
    for (const sd of SIDES) {
      k.add('black', new CircleGeometry(R, 20, 0, Math.PI), [sd * x, cy, zz], [0, (sd * Math.PI) / 2, 0])
      if (!fit.kit) k.add('black', plane(R * 2, cy - 0.096), [sd * x, (cy + 0.096) / 2, zz], [0, (sd * Math.PI) / 2, 0])
      k.add('chrome', new TorusGeometry(R, 0.0065, 4, 20, Math.PI), [sd * (x + 0.001), cy, zz], [0, (sd * Math.PI) / 2, 0])
    }
  }

  // Side stripe: a band along the slab side just under the belt crease, from behind the
  // headlamps to the tail, rising with the hips; cut at each door shut line.
  const STRIPE: [number, number][] = [[0.66, 0.203], [0.197, -0.217], [-0.223, -0.665]]
  for (const [z0, z1] of STRIPE) {
    const lines = along(z0, z1).map((q) => {
      const [W, ysh] = q.pts[4]
      return { z: q.z, pts: [[W, ysh - 0.023, 1, 0], [W, ysh - 0.009, 1, 0]] as [number, number, number, number][] }
    })
    for (const sd of SIDES) k.add('stripe', band(lines, sd, 0.003, -0.0012))
  }

  // Rocker moulding: a slim chrome strip along the foot of the doors.
  if (!fit.kit) {
    const lines = along(0.27, -0.28).map((q) => {
      const [W, y] = q.pts[3]
      return { z: q.z, pts: [[W, y + 0.004, 1, 0], [W, y + 0.014, 1, 0]] as [number, number, number, number][] }
    })
    for (const sd of SIDES) k.add('chrome', band(lines, sd, 0.003, -0.0012))
  }

  // Sides: door shut lines, a chrome handle, the 440 badge on each front fender, markers
  // front and back, and a chrome filler cap on the left hip.
  for (const sd of SIDES) {
    S.wall('dark', plane(0.004, 0.21), sd, 0.2, 0.25, 0.003)
    S.wall('dark', plane(0.004, 0.21), sd, -0.22, 0.252, 0.003)
    S.wall('chrome', rbox(0.05, 0.012, 0.008, 0.004), sd, -0.17, 0.3, 0.003)
    S.wall('chrome', plane(0.05, 0.012), sd, 0.29, 0.305, 0.003)
    S.wall('dark', plane(0.04, 0.005), sd, 0.29, 0.305, 0.0055)
    S.wall('amber', plane(0.036, 0.013), sd, 0.665, 0.24, 0.003)
    S.wall('tail', plane(0.036, 0.013), sd, -0.655, 0.255, 0.003)
  }
  S.wall('chrome', disc(0.017, 16), -1, -0.6, 0.29, 0.003)

  // Hood: a raised cowl scoop down the middle, growing toward the windshield and open at
  // its back, and a chrome pin each side of the nose; a black cowl strip at the foot of
  // the windshield.
  if (!fit.hood) {
    const scoopKeys: [number, number, number][] = [[0.6, 0.085, 0.002], [0.55, 0.095, 0.008], [0.45, 0.104, 0.018], [0.35, 0.11, 0.027], [0.27, 0.113, 0.033], [0.215, 0.114, 0.036]]
    const scoop = new Loft(scoopKeys.map(([z, w, rise]): Section => {
      const b = S.y(0, z) - 0.015
      const t = S.y(0, z) + rise
      const pts: Pt[] = [[0, b], [w, b, true], [w, t - 0.006, true], [w - 0.014, t], [0, t + 0.002]]
      return { z, pts }
    }), 3)
    k.add('paint', scoop.geometry({ capFront: true, capBack: true }))
    // The opening, facing the windshield, with two dark slats.
    const yb = S.y(0, 0.215)
    const back = (part: Part, pts: [number, number][], y: number, z: number) => k.add(part, poly(pts.map(([px, py]) => [-px, py])), [0, y, z], [0, Math.PI, 0])
    back('black', [[-0.096, 0.003], [0.096, 0.003], [0.093, 0.029], [-0.093, 0.029]], yb, 0.2125)
    for (const dy of [0.012, 0.021]) k.add('dark', box(0.18, 0.004, 0.004), [0, yb + dy, 0.21])
    for (const sd of SIDES) {
      S.top('chrome', disc(0.012, 14), sd * 0.215, 0.64, 0.003)
      S.top('dark', disc(0.006, 10), sd * 0.215, 0.64, 0.0055)
    }
  }
  S.top('black', box(0.52, 0.016, 0.004), 0, 0.185, 0.0045)

  // Nose: the blunt front face carries a full-width grille set back inside a chrome bezel,
  // four round lamps in chrome buckets, horizontal bars between them and a centre badge.
  const gy = 0.268
  const gw = 0.322
  const gh = 0.045
  k.add('chrome', frame(rrect(0, gy, gw + 0.012, gh + 0.012, 0.016), rrect(0, gy, gw, gh, 0.01), 0.022), [0, 0, fz + 0.003])
  k.add('black', plane(gw * 2, gh * 2), [0, gy, fz + 0.0025])
  for (const dy of [-0.024, 0, 0.024]) for (const sd of SIDES) k.add('chrome', box(0.11, 0.004, 0.005), [sd * 0.072, gy + dy, fz + 0.005])
  k.add('chrome', box(0.012, gh * 2, 0.006), [0, gy, fz + 0.006])
  k.add('chrome', poly([[-0.03, 0], [0, 0.016], [0.03, 0], [0, -0.016]]), [0, gy, fz + 0.0095])
  k.add('stripe', poly([[-0.016, 0], [0, 0.009], [0.016, 0], [0, -0.009]]), [0, gy, fz + 0.012])
  for (const sd of SIDES) for (const x of [0.17, 0.258]) {
    k.add('chrome', new CylinderGeometry(0.034, 0.034, 0.008, 18), [sd * x, gy, fz + 0.006], [Math.PI / 2, 0, 0])
    k.add('lamp', disc(0.027, 18), [sd * x, gy, fz + 0.0125])
  }
  // Amber parking lamps at the ends of the grille.
  for (const sd of SIDES) k.add('amber', plane(0.018, 0.05), [sd * 0.307, gy, fz + 0.005])
  // Slim chrome bumper wrapping the corners, the plate on its face.
  k.add('chrome', slab(bumperPlan(fz + 0.028, 0.383, 0.075, 0.034, 1), 0.032), [0, 0.175, 0], [Math.PI / 2, 0, 0])
  k.add('black', plane(0.124, 0.036), [0, 0.175, fz + 0.0305])
  k.add('lamp', plane(0.11, 0.028), [0, 0.175, fz + 0.033])
  if (!fit.kit) k.add('black', box(0.6, 0.012, 0.04), [0, 0.128, fz - 0.012])

  // Tail: a full-width lamp bar set in a chrome bezel, broken by thin dark ribs, with
  // reversing lamps in the middle either side of the badge.
  const by = tz - 0.0025
  const ly = 0.282
  const lw = 0.318
  const lh = 0.023
  const back = (part: Part, pts: [number, number][], x: number, y: number, z: number) => k.add(part, poly(pts.map(([px, py]) => [-px, py])), [x, y, z], [0, Math.PI, 0])
  const rect = (w: number, hh: number): [number, number][] => [[-w, -hh], [w, -hh], [w, hh], [-w, hh]]
  k.add('chrome', frame(rrect(0, ly, lw + 0.01, lh + 0.01, 0.012), rrect(0, ly, lw, lh, 0.006), 0.018), [0, 0, tz - 0.002])
  back('tail', rect(lw, lh), 0, ly, by)
  for (let i = -5; i <= 5; i++) if (Math.abs(i) > 1) k.add('dark', box(0.004, lh * 2, 0.004), [i * 0.054, ly, tz - 0.0045])
  for (const sd of SIDES) back('lamp', rect(0.026, lh - 0.006), sd * 0.054, ly, tz - 0.0055)
  back('black', rect(0.022, lh), 0, ly, tz - 0.0055)
  k.add('chrome', disc(0.016, 16), [0, ly, tz - 0.008], [0, Math.PI, 0])
  k.add('chrome', slab(bumperPlan(tz - 0.026, 0.383, 0.07, 0.032, -1), 0.03), [0, 0.205, 0], [Math.PI / 2, 0, 0])
  back('black', rect(0.064, 0.022), 0, 0.165, by)
  back('lamp', rect(0.056, 0.0165), 0, 0.165, tz - 0.0045)
  if (!fit.kit) k.add('black', box(0.58, 0.014, 0.05), [0, 0.124, tz + 0.02])
  // One pipe each side, a chrome tip turned down a touch out of the valance.
  if (!fit.exhaust) for (const sd of SIDES) {
    k.add('chrome', new CylinderGeometry(0.022, 0.022, 0.05, 14), [sd * 0.24, 0.142, tz - 0.004], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.017, 14), [sd * 0.24, 0.142, tz - 0.0295], [0, Math.PI, 0])
  }
  // A small spoiler across the end of the deck: a blade on two end plates.
  if (!fit.spoiler) {
    const yd = S.y(0, -0.66)
    k.add('paint', slab([[-0.635, yd + 0.022], [-0.7, yd + 0.024], [-0.705, yd + 0.036], [-0.665, yd + 0.031]], 0.6), [0, 0, 0], [0, -Math.PI / 2, 0])
    for (const sd of SIDES) k.add('paint', slab([[-0.64, yd - 0.008], [-0.7, yd - 0.008], [-0.705, yd + 0.036], [-0.66, yd + 0.031]], 0.012), [sd * 0.29, 0, 0], [0, -Math.PI / 2, 0])
  }

  // Cockpit: two buckets and a rear bench under the roof, the dash and the wheel.
  for (const sd of SIDES) h.seat(k, sd * 0.135, 0.275, -0.14, 0.14, 0.14)
  k.add('dash', rbox(0.56, 0.045, 0.09, 0.016), [0, 0.37, 0.09])
  h.steering(k, 0.135, 0.405, 0.015)
  k.add('dash', rbox(0.07, 0.05, 0.24, 0.015), [0, 0.345, -0.03])
  k.add('cabin', rbox(0.46, 0.08, 0.04, 0.015), [0, 0.37, -0.39], [-0.3, 0, 0])

  h.brakes(k, (z) => wellX(S, z, R) - 0.025, wz, r, 0.14)
}
