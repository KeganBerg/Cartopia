import { BufferGeometry, CircleGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, Vector3 } from 'three'
import type { Kit } from '../CarModel'
import { Loft } from '../loft'
import { Surface, bodyRing, box, disc, glassRing, greenhouse, honey, plane, poly, rbox, slab, spine, vent, type ExoticFit, type ExoticHelpers } from '../exoticCars'

// ---------------------------------------------------------------------------
// Aether Vanta LT: a long-tail hypercar. Very low and wide, a bubble canopy set well
// forward, a tall shark fin from the roof to the tail, flying buttresses over the rear
// haunches, big intakes scooped into the doors, and a tail stretched well past the rear
// wheels ending in a full-width light bar over a full-width diffuser, with a low
// twin-element wing built into it.
export const VANTA = { len: 1.5, wid: 0.82, wheel: 0.145 }

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
  const uv = new Float32Array((pos.length / 3) * 2)
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return g
}

export function longtailGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = VANTA.wheel
  const wz = VANTA.len * 0.33
  const front = 0.68
  const tz = -0.84
  // z, half width, bottom, shoulder, fender top, crease x, middle height
  const body = new Loft([
    bodyRing(front, 0.25, 0.075, 0.1, 0.118, 0.12, 0.11),
    bodyRing(0.63, 0.35, 0.066, 0.2, 0.222, 0.17, 0.135),
    bodyRing(0.565, 0.4, 0.062, 0.285, 0.308, 0.2, 0.168),
    bodyRing(0.49, 0.408, 0.062, 0.305, 0.326, 0.21, 0.2),
    bodyRing(0.38, 0.405, 0.062, 0.29, 0.312, 0.21, 0.22),
    bodyRing(0.24, 0.39, 0.062, 0.24, 0.27, 0.2, 0.235),
    bodyRing(0.08, 0.375, 0.062, 0.215, 0.25, 0.2, 0.245),
    bodyRing(-0.1, 0.385, 0.062, 0.23, 0.262, 0.22, 0.255),
    bodyRing(-0.3, 0.41, 0.062, 0.29, 0.315, 0.24, 0.265),
    bodyRing(-0.49, 0.415, 0.062, 0.315, 0.335, 0.25, 0.27),
    bodyRing(-0.62, 0.405, 0.065, 0.3, 0.32, 0.25, 0.27),
    bodyRing(-0.74, 0.385, 0.072, 0.28, 0.298, 0.24, 0.262),
    bodyRing(tz, 0.35, 0.088, 0.258, 0.272, 0.22, 0.248),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)

  // Bubble canopy set forward, falling away behind into the fin.
  const glass = new Loft([
    glassRing(0.31, 0.2, 0.225, 0.16, 0.235, true),
    glassRing(0.2, 0.24, 0.235, 0.18, 0.3, true),
    glassRing(0.06, 0.26, 0.24, 0.17, 0.365, true),
    glassRing(-0.06, 0.26, 0.245, 0.16, 0.385, true),
    glassRing(-0.17, 0.25, 0.25, 0.145, 0.38, true),
    glassRing(-0.27, 0.22, 0.255, 0.11, 0.345, true),
    glassRing(-0.36, 0.17, 0.26, 0.07, 0.3, true),
    glassRing(-0.42, 0.12, 0.262, 0.04, 0.275, true),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  greenhouse(k, h, glass, { roof: [0.08, -0.24], pillar: [0.31, 0.08], belt: [0.3, -0.4], mirror: [0.2, 0.25, 0.25] })
  // Seats, dash and wheel kept low under the bubble.
  for (const sd of [-1, 1]) h.seat(k, sd * 0.115, 0.14, -0.08, 0.13, 0.12)
  k.add('dash', rbox(0.42, 0.04, 0.08, 0.016), [0, 0.25, 0.16])
  k.add('display', plane(0.06, 0.03), [0, 0.265, 0.115], [-0.4, 0, 0])
  h.steering(k, 0.115, 0.26, 0.07)
  k.add('dash', rbox(0.06, 0.05, 0.22, 0.015), [0, 0.18, 0.04])

  // Shark fin down the middle, from the roof over the engine cover to the wing.
  const deck = (z: number) => (z > -0.42 ? Math.max(glass.near(z).pts[4][1] + (z > -0.24 ? 0.009 : 0), S.y(0, z)) : S.y(0, z))
  const finTop = (z: number) => {
    const roof = glass.near(-0.1).pts[4][1] + 0.016
    const t = Math.min(1, Math.max(0, (-0.12 - z) / (-0.12 - tz - 0.03)))
    return roof - 0.1 * t * (0.6 + 0.4 * t)
  }
  const rise = (z: number) => Math.max(0.01, finTop(z) - deck(z))
  spine(k, 'paint', -0.1, tz + 0.03, deck, rise, 0.012)

  // Flying buttresses: painted blades from the canopy's rear quarters back over the haunches,
  // with a black channel on the deck under each so the air through reads.
  const path: [number, number, number][] = [[-0.16, 0.135, 0.358], [-0.26, 0.17, 0.352], [-0.36, 0.215, 0.346], [-0.46, 0.255, 0.34], [-0.56, 0.285, 0.333], [-0.64, 0.302, 0.322], [-0.7, 0.31, 0.3]]
  for (const sd of [-1, 1]) {
    const rings = path.map(([z, x, y], i): V3[] => {
      const a = i === 0 ? 0.012 : 0.018
      const b = 0.011
      return [[sd * (x - a), y - b, z], [sd * (x + a), y - b, z], [sd * (x + a), y + b * 0.4, z], [sd * x, y + b, z], [sd * (x - a), y + b * 0.6, z]]
    })
    k.add('paint', skin(rings))
    for (let i = 1; i < path.length - 2; i++) {
      const [z0, x0] = path[i]
      const [z1, x1] = path[i + 1]
      const len = Math.hypot(z1 - z0, x1 - x0)
      S.top('black', plane(0.05, len + 0.004), sd * (x0 + x1) / 2, (z0 + z1) / 2, 0.003, -sd * Math.atan2(x1 - x0, z0 - z1))
    }
  }

  // Wheel arches: faceted black wells with a crisp dark lip.
  for (const zz of [wz, -wz]) for (const sd of [-1, 1]) {
    const R = r * 1.2
    S.well(sd, zz, r - 0.012, R, r, 6, 'dark', 0.01)
  }

  // Sides: an intake scooped into each door, a sill blade, door cut and a front marker.
  for (const sd of [-1, 1]) {
    const iz = -0.08
    S.wall('black', poly([[-0.2, 0.02], [-0.05, -0.03], [0.17, -0.045], [0.2, 0.05], [0.06, 0.045]]), sd, iz, 0.165, 0.003)
    // Body-colour strake over the mouth, sweeping up toward the back.
    const pts: [number, number][] = [[0.22, 0.188], [0.12, 0.205], [0.0, 0.212], [-0.12, 0.215], [-0.24, 0.218]]
    for (let i = 1; i < pts.length; i++) {
      const [z0, y0] = pts[i - 1]
      const [z1, y1] = pts[i]
      h.bar(k, 'paint', [sd * (S.side(z0 - 0.08) + 0.006), y0, z0 - 0.08 + 0.0], [sd * (S.side(z1 - 0.08) + 0.006), y1, z1 - 0.08], 0.014)
    }
    for (const dz of [-0.07, 0.0, 0.07]) S.wall('dark', box(0.006, 0.06, 0.008), sd, iz + dz, 0.16 - dz * 0.1, 0.008, 0.25)
    k.add('black', rbox(0.03, 0.03, wz * 2 - r * 2.6, 0.01), [sd * (S.side(0) - 0.004), 0.08, 0])
    S.wall('dark', plane(0.006, 0.12), sd, 0.24, 0.17, 0.005, -0.3)
    S.wall('dark', box(wz * 2 - r * 2.9, 0.005, 0.004), sd, 0, 0.11, 0.002)
    S.wall('amber', plane(0.035, 0.012), sd, 0.6, 0.105, 0.004)
    // Vents on the front fender tops behind the wheels.
    vent(S, sd * 0.33, 0.33, 0.05, 0.09, 4, sd * 0.1)
  }

  // Nose: a wide low mouth of mesh, intakes in the corners, splitter and canards.
  honey(k, 0, 0.095, front + 0.001, 0.3, 0.03, 0.008, 1)
  for (const sd of [-1, 1]) k.add('black', poly([[0.17, -0.016], [0.25, -0.012], [0.25, 0.012], [0.18, 0.018]].map(([x, y]) => [x * sd, y])), [0, 0.094, front + 0.003])
  if (!fit.kit) {
    // Splitter: a plate cut to the nose's own plan (a straight bar stood out past the
    // tapering corners), tucked up against the floor and lipped just past the mouth.
    const out = new Shape()
    const zs = [0.56, 0.6, 0.63, 0.66, front]
    zs.forEach((z, i) => (i ? out.lineTo : out.moveTo).call(out, body.near(z).pts[1][0] - 0.004, -z))
    out.lineTo(body.near(front).pts[1][0] - 0.03, -(front + 0.014))
    out.lineTo(-(body.near(front).pts[1][0] - 0.03), -(front + 0.014))
    for (const z of [...zs].reverse()) out.lineTo(-(body.near(z).pts[1][0] - 0.004), -z)
    k.add('black', new ExtrudeGeometry(out, { depth: 0.008, bevelEnabled: false }), [0, body.near(front).pts[0][1] - 0.006, 0], [-Math.PI / 2, 0, 0])
    // Canards stand straight out of the nose's corner walls.
    for (const sd of [-1, 1]) S.wall('black', box(0.05, 0.005, 0.04), sd, 0.62, 0.115, 0.016, 0.25)
  }
  // Headlights: a slim LED slash in a black slit on each fender, and a short daytime tick.
  for (const sd of [-1, 1]) {
    const x = sd * 0.27
    const z = 0.575
    const turn = sd * -0.35
    S.top('black', poly([[-0.085, -0.008], [0.08, -0.013], [0.09, 0.009], [-0.075, 0.013]]), x, z, 0.002, turn)
    // The LED lies flat in the slit, following the fender's curve (a raised bar read as a rod).
    S.top('lamp', poly([[-0.078, -0.004], [0.075, -0.007], [0.082, 0.004], [-0.07, 0.007]]), x, z, 0.0045, turn)
    S.top('lamp', poly([[-0.003, -0.013], [0.003, -0.013], [0.003, 0.013], [-0.003, 0.013]]), x - sd * 0.075, z - 0.005 - 0.026, 0.0045, turn)
  }
  // Hood: two ducts each side of the middle and a cowl strip at the canopy's foot.
  if (!fit.hood) for (const sd of [-1, 1]) {
    vent(S, sd * 0.125, 0.5, 0.075, 0.12, 3, sd * 0.12)
    S.top('black', poly([[-0.03, -0.02], [0.03, -0.02], [0.022, 0.02], [-0.022, 0.02]]), sd * 0.125, 0.4, 0.003)
  }
  S.top('black', box(0.36, 0.02, 0.004), 0, 0.33, 0.0055)

  // Engine cover: black louvres either side of the fin, between the buttresses.
  for (let i = 0; i < 6; i++) {
    const z = -0.46 - i * 0.03
    for (const sd of [-1, 1]) S.top('black', box(0.1, 0.012, 0.004), sd * 0.15, z, 0.0055)
  }
  // Fuel flap on the left haunch.
  S.top('dark', new CircleGeometry(0.018, 6), -0.34, -0.4, 0.003)

  // Tail: a full-width light bar on a black band, mesh under it, twin pipes, a plate, a
  // diffuser right across and the wing built into the end of the tail.
  k.add('black', plane(0.7, 0.04), [0, 0.238, tz - 0.0025], [0, Math.PI, 0])
  k.add('tail', box(0.68, 0.01, 0.004), [0, 0.242, tz - 0.007])
  k.add('tail', box(0.6, 0.004, 0.004), [0, 0.225, tz - 0.007])
  for (const sd of [-1, 1]) k.add('tail', box(0.006, 0.04, 0.004), [sd * 0.335, 0.235, tz - 0.0072])
  // With bolt-on pipes the mesh is a plain black panel, so their ends stand clear of it.
  if (fit.exhaust) k.add('black', plane(0.62, 0.11), [0, 0.16, tz - 0.0025], [0, Math.PI, 0])
  else honey(k, 0, 0.16, tz - 0.0015, 0.62, 0.11, 0.013, -1)
  for (const sd of [-1, 1]) k.add('lamp', plane(0.04, 0.01), [sd * 0.25, 0.2, tz - 0.0075], [0, Math.PI, 0])
  if (!fit.exhaust) for (const sd of [-1, 1]) {
    k.add('chrome', new CylinderGeometry(0.026, 0.026, 0.05, 12), [sd * 0.07, 0.14, tz - 0.012], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.02, 12), [sd * 0.07, 0.14, tz - 0.0375], [0, Math.PI, 0])
  }
  k.add('black', plane(0.124, 0.054), [0, 0.19, tz - 0.0075], [0, Math.PI, 0])
  k.add('lamp', plane(0.11, 0.045), [0, 0.19, tz - 0.0105], [0, Math.PI, 0])
  if (!fit.kit) {
    k.add('black', box(0.66, 0.025, 0.16), [0, 0.078, tz + 0.06])
    for (const x of [-0.3, -0.22, -0.15, -0.08, 0.08, 0.15, 0.22, 0.3]) k.add('black', box(0.008, 0.055, 0.15), [x, 0.085, tz + 0.055], [0.2, 0, 0])
  }
  if (!fit.spoiler) {
    const y1 = S.y(0, tz + 0.08) + 0.02
    const y2 = y1 + 0.022
    k.add('paint', slab([[-0.045, -0.006], [0.04, -0.003], [0.045, 0.005], [-0.04, 0.007]], 0.66), [0, y1, tz + 0.08], [0, Math.PI / 2, 0])
    k.add('black', slab([[-0.025, -0.004], [0.025, -0.002], [0.028, 0.004], [-0.022, 0.005]], 0.66), [0, y2, tz + 0.03], [0, Math.PI / 2, -0.25])
    for (const sd of [-1, 1]) {
      const yb = S.y(sd * 0.335, tz + 0.06)
      k.add('black', slab([[-0.08, yb - 0.01], [0.06, yb - 0.01], [0.075, y2 + 0.015], [-0.02, y2 + 0.012]], 0.008), [sd * 0.335, 0, tz + 0.06], [0, Math.PI / 2, 0])
    }
  }

  // Racing stripes over the hood, the roof and the long tail (drawn only when painted on).
  for (const x of [-0.045, 0.045]) {
    if (!fit.hood) for (let z = 0.63; z > 0.34; z -= 0.05) S.top('stripe', plane(0.05, 0.052), x, z, 0.003)
    for (let z = 0.06; z > -0.22; z -= 0.05) k.add('stripe', box(0.05, 0.004, 0.052), [x, glass.near(z).pts[4][1] + 0.011, z])
    for (let z = -0.45; z > -0.7; z -= 0.05) S.top('stripe', plane(0.05, 0.052), x, z, 0.003)
  }

  h.brakes(k, (z) => S.side(z) + 0.003 - 0.025, wz, r, 0.14, (z) => S.yaw(z))
  // Third brake light on the fin.
  h.bar(k, 'tail', [0, finTop(-0.64) - 0.004, -0.64], [0, finTop(-0.72) - 0.004, -0.72], 0.016)
}

