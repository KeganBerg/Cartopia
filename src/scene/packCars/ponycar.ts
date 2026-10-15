import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute, TorusGeometry, Vector3 } from 'three'
import type { Kit, Part } from '../CarModel'
import { Loft, type Pt, type Section } from '../loft'
import { Surface, box, disc, glassRing, greenhouse, honey, plane, poly, rbox, slab, vent, type ExoticFit, type ExoticHelpers } from '../exoticCars'

// ---------------------------------------------------------------------------
// Liberty Stinger SS: an everyday modern pony car. A long hood with a power dome and
// two heat vents, front fenders standing a little proud of it, a fastback roof with
// wide body-colour sails, broad hips over the rear wheels and a short deck ending in a
// small ducktail. A big mesh grille with slim headlamps tucked in its upper corners,
// three slanted bars in each tail lamp and four round pipes. Our own drawing; the name
// and the dart badge are invented.

export const STINGER = { len: 1.34, wid: 0.74, wheel: 0.155 }
const SIDES = [-1, 1] as const
type V3 = [number, number, number]

// A body half-ring like bodyRing, with the lower body tucked in under a crease along
// the doors: the bottom, the tuck, the crease, the upright wall to the shoulder, the
// chamfer, the fender top, the hood crease and the middle.
function ponyRing(z: number, W: number, yb: number, ysh: number, yd: number, wc: number, yc: number): Section {
  const pts: Pt[] = [
    [0, yb], [W - 0.04, yb, true], [W - 0.014, yb + 0.03, true], [W, yb + 0.115, true], [W, ysh, true], [W - 0.014, ysh + 0.012, true],
    [W - 0.05, yd, true], [Math.min(wc, W - 0.07), yc + 0.006, true], [0, yc],
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
    // The two long edges.
    for (const [j, jn] of [[0, 1], [m - 1, m - 2]]) {
      const d: V3 = [o[s][j][0] - o[s][jn][0], o[s][j][1] - o[s][jn][1], 0]
      quad(o[s][j], i[s][j], i[s + 1][j], o[s + 1][j], d)
    }
  }
  // End caps.
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

export function ponycarGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = STINGER.wheel
  const wz = STINGER.len * 0.33
  const fz = STINGER.len / 2
  const tz = -fz

  // Body: z, half width, bottom, shoulder, fender top, crease x, middle height. The
  // front fenders stand a touch above the hood; the hips swell out over the rear wheels.
  const body = new Loft([
    ponyRing(fz, 0.318, 0.115, 0.262, 0.275, 0.22, 0.282),
    ponyRing(0.66, 0.345, 0.104, 0.282, 0.296, 0.23, 0.298),
    ponyRing(0.61, 0.362, 0.098, 0.304, 0.322, 0.235, 0.312),
    ponyRing(0.5, 0.367, 0.095, 0.326, 0.345, 0.24, 0.326),
    ponyRing(0.4, 0.367, 0.095, 0.332, 0.35, 0.245, 0.333),
    ponyRing(0.28, 0.362, 0.095, 0.333, 0.35, 0.25, 0.338),
    ponyRing(0.15, 0.357, 0.095, 0.333, 0.349, 0.26, 0.34),
    ponyRing(-0.05, 0.357, 0.095, 0.334, 0.35, 0.27, 0.341),
    ponyRing(-0.25, 0.366, 0.095, 0.338, 0.354, 0.28, 0.342),
    ponyRing(-0.42, 0.375, 0.095, 0.342, 0.357, 0.28, 0.343),
    ponyRing(-0.55, 0.373, 0.098, 0.34, 0.355, 0.275, 0.344),
    ponyRing(-0.63, 0.36, 0.105, 0.336, 0.352, 0.26, 0.346),
    ponyRing(-0.66, 0.342, 0.114, 0.33, 0.346, 0.25, 0.342),
    ponyRing(tz, 0.33, 0.12, 0.322, 0.338, 0.24, 0.336),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 6, 3)

  // Greenhouse: a raked windshield, a short roof and a long fastback down to the deck.
  const glass = new Loft([
    glassRing(0.2, 0.318, 0.33, 0.29, 0.343),
    glassRing(0.12, 0.322, 0.333, 0.282, 0.402),
    glassRing(0.04, 0.322, 0.335, 0.272, 0.456),
    glassRing(-0.04, 0.322, 0.336, 0.264, 0.495),
    glassRing(-0.13, 0.322, 0.337, 0.26, 0.511),
    glassRing(-0.23, 0.322, 0.338, 0.256, 0.51),
    glassRing(-0.32, 0.32, 0.34, 0.25, 0.488),
    glassRing(-0.41, 0.308, 0.341, 0.238, 0.45),
    glassRing(-0.49, 0.272, 0.343, 0.222, 0.405),
    glassRing(-0.555, 0.215, 0.345, 0.2, 0.362),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  const G = new Surface(k, glass, 3, 1)
  greenhouse(k, h, glass, { roof: [0.03, -0.3], pillar: [0.21, 0.03], belt: [0.2, -0.36], mirror: [0.15, 0.27, 0.35] })
  const roofY = (z: number) => glass.near(z).pts[4][1]

  // Sails: body-colour C-pillars from the roof down the sides of the fastback, so the side
  // window ends in a slanted edge and the back glass is narrower than the roof.
  const sail = (z: number) => {
    const p = glass.near(z).pts
    const [wr, ys] = p[2]
    const [, yt] = p[3]
    // From a foot on the hip, standing clear outside the side glass, up to the roof edge.
    // Toward the back it draws in to the foot of the glass, so it tapers into the deck.
    const back = Math.min(1, Math.max(0, (-0.4 - z) / 0.155))
    const fx = Math.min(0.326, S.side(z) - 0.045) * (1 - back * back) + (p[1][0] + 0.012) * back * back
    // The panel stands up off the hip in a short step, so it never lies flush with it.
    const fy = S.y(fx, z) + 0.008
    const cx = wr + 0.008, cy = ys + 0.004
    const dx = cx - fx, dy = cy - fy
    const l = Math.hypot(dx, dy)
    const ns: [number, number] = [dy / l, -dx / l]
    const cl = Math.hypot(ns[0], ns[1] + 1)
    // The side window's back edge slants: the sail starts high at the front.
    const t0 = Math.min(0.9, Math.max(0, 1 + (z + 0.26) / 0.1))
    const dip = 0.02 * (1 - Math.min(1, t0 / 0.12))
    // How far the sail reaches in over the back glass.
    const reach = 0.05 + 0.03 * Math.min(1, Math.max(0, (-0.3 - z) / 0.12))
    const pts: [number, number, number, number][] = []
    for (const f of [0, 0.04, 0.45, 1]) {
      const t = t0 + (1 - t0) * f
      pts.push([fx + dx * t + (f ? 0 : dip * 0.15), fy + dy * t - (f ? 0 : dip), ns[0], ns[1]])
    }
    pts.push([wr - 0.014, yt + 0.006, ns[0] / cl, (ns[1] + 1) / cl])
    pts.push([wr - reach, yt + 0.006, 0, 1])
    return { z, pts }
  }
  const sails = Array.from({ length: 20 }, (_, i) => sail(-0.26 - (i * 0.292) / 19))
  for (const sd of SIDES) k.add('paint', band(sails, sd, 0, 0.006))

  // A black seal along the foot of the back glass.
  k.add('black', box(0.44, 0.014, 0.012), [0, 0.351, -0.553])

  // Third brake light at the top of the back glass, a shark-fin aerial and two wipers.
  G.top('tail', box(0.12, 0.01, 0.004), 0, -0.33, 0.004)
  k.add('black', slab([[0.03, 0], [-0.03, 0], [-0.025, 0.012], [0.005, 0.016]], 0.012), [0, roofY(-0.25) + 0.006, -0.25], [0, -Math.PI / 2, 0])
  for (const x of [-0.17, 0.06]) h.bar(k, 'black', [x, 0.352, 0.195], [x + 0.17, 0.362, 0.182], 0.008)

  // Wheel wells: a black half disc behind each tyre, black down to the sill, a dark lip.
  const R = 0.176
  const cy = r - 0.008
  for (const zz of [wz, -wz]) for (const sd of SIDES) {
    S.wall('black', new CircleGeometry(R, 20, 0, Math.PI), sd, zz, cy, 0.003)
    if (!fit.kit) S.wall('black', plane(R * 2, cy - 0.094), sd, zz, (cy + 0.094) / 2, 0.003)
    S.wall('dark', new TorusGeometry(R, 0.009, 4, 20, Math.PI), sd, zz, cy, 0.004)
  }

  // Sides: door cuts, a flush handle, a gill behind each front wheel, markers, a sill
  // and the filler on the left hip.
  for (const sd of SIDES) {
    S.wall('dark', plane(0.004, 0.2), sd, 0.215, 0.225, 0.0035)
    S.wall('dark', plane(0.004, 0.2), sd, -0.25, 0.225, 0.0035, -0.1)
    S.wall('black', rbox(0.045, 0.01, 0.008, 0.003), sd, -0.17, 0.305, 0.003)
    S.wall('black', poly([[-0.022, -0.03], [0.018, -0.03], [0.026, 0.028], [-0.016, 0.022]]), sd, 0.255, 0.245, 0.003)
    for (const dy of [-0.012, 0.004]) S.wall('dark', box(0.032, 0.005, 0.004), sd, 0.255, 0.245 + dy, 0.0055)
    S.wall('amber', plane(0.04, 0.012), sd, 0.635, 0.235, 0.003)
    S.wall('tail', plane(0.04, 0.012), sd, -0.635, 0.255, 0.003)
    if (!fit.kit) k.add('black', rbox(0.03, 0.03, 0.5, 0.01), [sd * (S.side(0) - 0.004), 0.108, 0])
  }
  S.wall('chrome', disc(0.022, 16), -1, -0.3, 0.29, 0.003)
  S.wall('dark', disc(0.014, 12), -1, -0.3, 0.29, 0.0055)

  // Hood: a power dome down the middle with a slot in its nose, a heat vent each side,
  // and a black cowl strip at the foot of the windshield.
  const domeKeys: [number, number, number][] = [[0.6, 0.095, 0.01], [0.55, 0.1, 0.015], [0.45, 0.106, 0.02], [0.36, 0.112, 0.022], [0.3, 0.115, 0.02], [0.26, 0.115, 0.012], [0.24, 0.115, 0.006]]
  const dome = new Loft(domeKeys.map(([z, w, rise]): Section => {
    const b = S.y(0, z) - 0.015
    const t = S.y(0, z) + rise
    const pts: Pt[] = [[0, b], [w, b, true], [w, t - 0.008, true], [w - 0.016, t], [0, t + 0.002]]
    return { z, pts }
  }), 3)
  const D = new Surface(k, dome, 2, 1)
  if (!fit.hood) {
    k.add('paint', dome.geometry({ capFront: true, capBack: true }))
    const y0 = S.y(0, 0.6)
    k.add('black', poly([[-0.075, -0.0035], [0.075, -0.0035], [0.068, 0.0035], [-0.068, 0.0035]]), [0, y0 + 0.0045, 0.6025])
    for (const sd of SIDES) vent(S, sd * 0.175, 0.45, 0.055, 0.13, 5, sd * 0.05)
  }
  S.top('black', box(0.5, 0.018, 0.004), 0, 0.222, 0.0055)

  // Nose: a big black grille right across, mesh in the middle, slim headlamps in its
  // upper corners, the dart badge, a lower intake with slats and a splitter lip.
  const fy = fz + 0.002
  k.add('black', poly([[-0.3, 0.262], [0.3, 0.262], [0.29, 0.198], [0.21, 0.168], [-0.21, 0.168], [-0.29, 0.198]]), [0, 0, fy])
  honey(k, 0, 0.207, fy + 0.0005, 0.34, 0.068, 0.0075, 1)
  k.add('dark', box(0.36, 0.005, 0.004), [0, 0.244, fy + 0.002])
  k.add('chrome', poly([[-0.034, 0], [-0.006, 0.01], [0.034, 0], [-0.006, -0.01]]), [0, 0.21, fy + 0.0065])
  k.add('dark', poly([[-0.018, 0], [-0.004, 0.005], [0.018, 0], [-0.004, -0.005]]), [0, 0.21, fy + 0.009])
  for (const sd of SIDES) {
    const x = sd * 0.245
    k.add('lamp', box(0.105, 0.008, 0.003), [x, 0.252, fy + 0.0035], [0, 0, sd * 0.04])
    for (const dx of [-0.025, 0.02]) {
      k.add('chrome', disc(0.016, 16), [x + sd * dx, 0.226, fy + 0.0025])
      k.add('lamp', disc(0.011, 16), [x + sd * dx, 0.226, fy + 0.005])
    }
    k.add('amber', plane(0.03, 0.008), [sd * 0.265, 0.205, fy + 0.0025])
    // Corner intakes low in the bumper.
    k.add('black', poly([[-0.025, -0.02], [0.025, -0.02], [0.02, 0.018], [-0.02, 0.018]]), [sd * 0.262, 0.14, fy])
  }
  k.add('black', poly([[-0.19, 0.152], [0.19, 0.152], [0.17, 0.12], [-0.17, 0.12]]), [0, 0, fy])
  for (const y of [0.13, 0.142]) k.add('dark', box(0.34, 0.004, 0.004), [0, y, fy + 0.002])
  if (!fit.kit) {
    k.add('black', box(0.62, 0.01, 0.05), [0, 0.112, fz - 0.008])
    k.add('dark', box(0.6, 0.004, 0.004), [0, 0.119, fz + 0.015])
  }

  // Tail: a black band across with three slanted bars in each lamp, the badge between
  // them, a plate, a black valance with reversing lamps, quad pipes and a diffuser.
  const by = tz - 0.002
  const back = (part: Part, pts: [number, number][], x: number, y: number, z: number) => k.add(part, poly(pts.map(([px, py]) => [-px, py])), [x, y, z], [0, Math.PI, 0])
  back('black', [[-0.312, 0.24], [0.312, 0.24], [0.3, 0.302], [-0.3, 0.302]], 0, 0, by)
  for (const sd of SIDES) {
    for (const dx of [0.17, 0.215, 0.26]) k.add('tail', box(0.03, 0.044, 0.004), [sd * dx, 0.271, tz - 0.0045], [0, 0, sd * 0.32])
    k.add('dark', box(0.135, 0.004, 0.004), [sd * 0.215, 0.297, tz - 0.004])
  }
  back('chrome', [[-0.034, 0], [-0.006, 0.01], [0.034, 0], [-0.006, -0.01]], 0, 0.271, tz - 0.0045)
  back('black', [[-0.062, -0.027], [0.062, -0.027], [0.062, 0.027], [-0.062, 0.027]], 0, 0.205, by)
  back('lamp', [[-0.055, -0.0225], [0.055, -0.0225], [0.055, 0.0225], [-0.055, 0.0225]], 0, 0.205, tz - 0.0045)
  back('black', [[-0.31, 0.12], [0.31, 0.12], [0.322, 0.172], [-0.322, 0.172]], 0, 0, by)
  for (const sd of SIDES) back('lamp', [[-0.025, -0.006], [0.025, -0.006], [0.025, 0.006], [-0.025, 0.006]], sd * 0.08, 0.156, tz - 0.0045)
  if (!fit.exhaust) for (const sd of SIDES) for (const dx of [0.19, 0.245]) {
    k.add('chrome', new CylinderGeometry(0.021, 0.021, 0.045, 14), [sd * dx, 0.143, tz - 0.01], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.016, 14), [sd * dx, 0.143, tz - 0.0328], [0, Math.PI, 0])
  }
  if (!fit.kit) {
    k.add('black', box(0.5, 0.008, 0.11), [0, 0.106, tz + 0.05], [0.12, 0, 0])
    for (const x of [-0.12, -0.04, 0.04, 0.12]) k.add('black', slab([[tz + 0.1, 0.1], [tz - 0.004, 0.1], [tz - 0.004, 0.124], [tz + 0.1, 0.108]], 0.006), [x, 0, 0], [0, -Math.PI / 2, 0])
  }
  // Ducktail: a small body-colour lip kicked up along the end of the deck.
  if (!fit.spoiler) {
    const yl = S.y(0, -0.64)
    k.add('paint', slab([[-0.6, yl - 0.012], [tz - 0.005, yl - 0.012], [tz - 0.008, yl + 0.016], [-0.655, yl + 0.013], [-0.61, yl + 0.002]], 0.6), [0, 0, 0], [0, -Math.PI / 2, 0])
  }

  // Twin stripes over the nose, the dome, the roof and the deck (drawn only when painted on).
  for (const x of [-0.052, 0.052]) {
    if (!fit.hood) {
      for (const [z, l] of [[0.655, 0.031], [0.625, 0.031], [0.6055, 0.011]]) S.top('stripe', plane(0.05, l), x, z, 0.003)
      for (let z = 0.584; z > 0.25; z -= 0.03) D.top('stripe', plane(0.05, 0.031), x, z, 0.0035)
    } else for (let z = 0.645; z > 0.25; z -= 0.045) S.top('stripe', plane(0.05, 0.046), x, z, 0.003)
    for (let z = 0.02; z > -0.3; z -= 0.045) {
      const e = 0.01
      const a = Math.atan2(roofY(z + e) - roofY(z - e), 2 * e)
      k.add('stripe', box(0.05, 0.004, 0.047), [x, roofY(z) + 0.011, z], [-a, 0, 0])
    }
    const end = fit.spoiler ? -0.66 : -0.595
    for (let z = -0.57; z >= end; z -= 0.03) S.top('stripe', plane(0.05, 0.031), x, z, 0.003)
  }

  // Cockpit: two buckets and a small rear bench poking above the sills, the dash with
  // its screen and the wheel.
  for (const sd of SIDES) h.seat(k, sd * 0.135, 0.27, -0.16, 0.14, 0.15)
  k.add('dash', rbox(0.56, 0.045, 0.09, 0.016), [0, 0.345, 0.11])
  k.add('display', plane(0.06, 0.032), [0, 0.37, 0.064], [-0.4, 0, 0])
  h.steering(k, 0.135, 0.385, 0.035)
  k.add('dash', rbox(0.07, 0.05, 0.24, 0.015), [0, 0.33, -0.04])
  k.add('cabin', rbox(0.44, 0.09, 0.04, 0.015), [0, 0.37, -0.42], [-0.3, 0, 0])

  h.brakes(k, (z) => S.side(z) + 0.003 - 0.025, wz, r, 0.14, (z) => S.yaw(z))
}
