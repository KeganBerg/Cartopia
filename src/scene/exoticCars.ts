import { BoxGeometry, BufferGeometry, CircleGeometry, CylinderGeometry, Euler, ExtrudeGeometry, Matrix4, PlaneGeometry, Shape, ShapeGeometry, TorusGeometry, Vector2, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { Loft, type Pt, type Section } from './loft'
import type { Kit, Part } from './CarModel'
import type { Body } from '../game/data'

// Exotic bodies: top-tier cars whose shapes the extruded side profiles can't make,
// lofted through hand-drawn cross-sections with crisp creases (see loft.ts) and
// detailed with the same parts every other car uses, so they bake and batch the same.
// Every shape here is our own drawing; no outside model is used.

type V3 = [number, number, number]
export type ExoticHelpers = {
  seat: (k: Kit, x: number, y: number, z: number, w: number, back: number) => void
  steering: (k: Kit, x: number, y: number, z: number) => void
  brakes: (k: Kit, wx: number | ((z: number) => number), wz: number, r: number, w: number, yaw?: (z: number) => number) => void
  bar: (k: Kit, part: Part, a: V3, b: V3, t: number) => void
}
export type ExoticFit = { spoiler?: string; hood?: string; exhaust?: string; kit?: string }

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)
const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))
const plane = (w: number, h: number) => new PlaneGeometry(w, h)
const disc = (r: number, seg = 16) => new CircleGeometry(r, seg)
// A flat polygon in its own x/y plane, facing +z.
const poly = (pts: [number, number][]) => new ShapeGeometry(new Shape(pts.map(([x, y]) => new Vector2(x, y))))
// The same polygon with a little depth, for raised trim.
const slab = (pts: [number, number][], d: number) => {
  const g = new ExtrudeGeometry(new Shape(pts.map(([x, y]) => new Vector2(x, y))), { depth: d, bevelEnabled: false })
  g.translate(0, 0, -d / 2)
  return g
}

// Places flat parts on a lofted surface.
class Surface {
  readonly k: Kit
  readonly loft: Loft
  readonly topFrom: number
  readonly sideAt: number
  constructor(k: Kit, loft: Loft, topFrom: number, sideAt: number) {
    this.k = k
    this.loft = loft
    this.topFrom = topFrom
    this.sideAt = sideAt
  }
  y(x: number, z: number) { return this.loft.top(x, z, this.topFrom) }
  // Lays a part flat on the top surface at (x, z), its own +y pointing forward and +x to
  // the car's left, lifted `out` along the surface normal, turned `turn` about it.
  top(part: Part, geo: BufferGeometry, x: number, z: number, out = 0.003, turn = 0) {
    const e = 0.006
    const y = this.y(x, z)
    const dx = (this.y(x + e, z) - this.y(x - e, z)) / (2 * e)
    const dz = (this.y(x, z + e) - this.y(x, z - e)) / (2 * e)
    const n = new Vector3(-dx, 1, -dz).normalize()
    const f = new Vector3(0, 0, 1).addScaledVector(n, -n.z).normalize()
    const r = new Vector3().crossVectors(f, n)
    const m = new Matrix4().makeBasis(r, f, n).multiply(new Matrix4().makeRotationZ(turn))
    const rot = new Euler().setFromRotationMatrix(m)
    this.k.add(part, geo, [x + n.x * out, y + n.y * out, z + n.z * out], [rot.x, rot.y, rot.z])
  }
  // Half width of the upright side wall at z.
  side(z: number) { return this.loft.near(z).pts[this.sideAt][0] }
  // Stands a part on the side wall (sd: -1 left, 1 right) at height y, leaning with the
  // wall as it narrows. The part's own +x points to the back of the car on both sides
  // (the left side's copy is mirrored), turned rz in its own plane first.
  // How far the side wall turns in at z (positive where it widens toward the front).
  yaw(z: number) {
    const e = 0.01
    return Math.atan2(this.side(z + e) - this.side(z - e), 2 * e)
  }
  wall(part: Part, geo: BufferGeometry, sd: number, z: number, y: number, out = 0.003, rz = 0) {
    const yaw = this.yaw(z)
    if (rz) geo.rotateZ(rz)
    this.k.add(part, sd < 0 ? mirrorX(geo) : geo, [sd * (this.side(z) + out), y, z], [0, sd * (Math.PI / 2 + yaw), 0])
  }
}

// Where the brakes go on an axle: tucked so the rotor's face stands just proud of the
// black well on the side wall (the well sits 0.003 off the wall), never flush with it.
const brakeX = (S: Surface, z: number) => S.side(z) + 0.003 - 0.025

// A flat part flipped left to right, still facing the same way.
function mirrorX(geo: BufferGeometry) {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.scale(-1, 1, 1)
  const p = g.getAttribute('position')
  const n = g.getAttribute('normal')
  const u = g.getAttribute('uv')
  for (let i = 0; i < p.count; i += 3) for (const a of [p, n, u]) {
    if (!a) continue
    for (let c = 0; c < a.itemSize; c++) {
      const t = a.getComponent(i + 1, c)
      a.setComponent(i + 1, c, a.getComponent(i + 2, c))
      a.setComponent(i + 2, c, t)
    }
  }
  return g
}

// Half-ring of a body section: the bottom, a crisp upright side wall, a chamfered
// shoulder, the fender top and a crease where the fender falls to the middle.
// soft: a rounded shoulder and fender top instead of a chamfer and crease.
function bodyRing(z: number, W: number, yb: number, ysh: number, yd: number, wc: number, yc: number, soft = false): Section {
  const pts: Pt[] = [
    [0, yb], [W - 0.03, yb, true], [W, yb + 0.025, true], [W, ysh, !soft], [W - (soft ? 0.018 : 0.014), ysh + (soft ? 0.02 : 0.012), !soft],
    [W - 0.05, yd, !soft], [Math.min(wc, W - 0.07), yc + 0.006, true], [0, yc],
  ]
  return { z, pts }
}

// Greenhouse half-ring: belt, side glass leaning in, a chamfered roof edge, the roof.
function glassRing(z: number, wb: number, base: number, wr: number, yt: number, soft = false): Section {
  const pts: Pt[] = [[0, base], [wb, base, true], [wr, Math.max(base + 0.002, yt - 0.016), !soft], [wr - 0.018, yt, !soft], [0, yt]]
  return { z, pts }
}

// What every exotic's glass gets: a painted roof lying over it from the windshield's top
// edge back (narrower than the glass, so the side windows show), black pillars down the
// windshield's sides, a black belt along the bottom of the side glass, and door mirrors
// on stalks. Ranges are [front z, back z]; mirror is [z, stalk x, stalk y].
function greenhouse(k: Kit, h: ExoticHelpers, glass: Loft, o: { roof: [number, number]; pillar: [number, number]; belt: [number, number]; mirror: [number, number, number]; roofPart?: Part }) {
  const roofKeys: Section[] = []
  const n = 6
  for (let i = 0; i <= n; i++) {
    const z = o.roof[0] + ((o.roof[1] - o.roof[0]) * i) / n
    const p = glass.near(z).pts
    const wr = p[2][0]
    const yt = p[4][1]
    roofKeys.push({ z, pts: [[0, yt - 0.01], [wr - 0.012, yt - 0.01, true], [wr - 0.012, yt + 0.002, true], [wr - 0.028, yt + 0.008, true], [0, yt + 0.009]] })
  }
  k.add(o.roofPart ?? 'paint', new Loft(roofKeys, 4).geometry({ capFront: true, capBack: true }))
  const line = (part: Part, sd: number, [z0, z1]: [number, number], at: (p: Pt[], z: number) => V3, t: number) => {
    let prev: V3 | null = null
    const n = 6
    for (let i = 0; i <= n; i++) {
      const z = z0 + ((z1 - z0) * i) / n
      const v = at(glass.near(z).pts, z)
      v[0] *= sd
      if (prev) h.bar(k, part, prev, v, t)
      prev = v
    }
  }
  for (const sd of [-1, 1]) {
    line('black', sd, o.pillar, (p, z) => [p[2][0] + 0.002, p[2][1] + 0.004, z], 0.016)
    line('black', sd, o.belt, (p, z) => [p[1][0] + 0.004, p[1][1] + 0.008, z], 0.012)
    const [mz, mx, my] = o.mirror
    h.bar(k, 'black', [sd * mx, my, mz], [sd * (mx + 0.08), my + 0.03, mz - 0.03], 0.012)
    k.add('paint', rbox(0.07, 0.04, 0.035, 0.012), [sd * (mx + 0.11), my + 0.035, mz - 0.03], [0, 0, sd * -0.1])
    k.add('glass', plane(0.055, 0.028), [sd * (mx + 0.11), my + 0.035, mz - 0.051], [0, Math.PI, 0])
  }
}

// Honeycomb mesh: rows of dark grey hexagons on a black panel w by h centred at (x, y),
// on the front (dir 1) or the back (dir -1) face at z. The hexagons are interior trim
// ('dash'), so town traffic shows the plain black panel and pays nothing for them.
function honey(k: Kit, x: number, y: number, z: number, w: number, h: number, r: number, dir: 1 | -1) {
  k.add('black', plane(w, h), [x, y, z + dir * 0.001], [0, dir < 0 ? Math.PI : 0, 0])
  const dx = r * 1.8
  const dy = r * 1.56
  const rows = Math.max(1, Math.floor(h / dy))
  const cols = Math.max(1, Math.floor(w / dx))
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols - (j % 2); i++) {
    const cx = x - ((cols - 1) * dx) / 2 + i * dx + (j % 2 ? dx / 2 : 0)
    const cy = y - ((rows - 1) * dy) / 2 + j * dy
    k.add('dash', new CircleGeometry(r * 0.78, 6), [cx, cy, z + dir * 0.0035], [0, dir < 0 ? Math.PI : 0, Math.PI / 6])
  }
}

// A slatted vent lying on a surface: a black opening w wide and l long with n body-colour
// louvres across it.
function vent(S: Surface, x: number, z: number, w: number, l: number, n: number, turn = 0) {
  S.top('black', poly([[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2 * 0.86, l / 2], [-w / 2 * 0.86, l / 2]]), x, z, 0.0065, turn)
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5
    S.top('dark', box(w * 0.9, 0.006, 0.006), x - Math.sin(turn) * t * l, z + Math.cos(turn) * t * l, 0.0095, turn)
  }
}

// ---------------------------------------------------------------------------
// Veloce Fulmine: a V12 wedge. One line from the nose over the roof to the tail,
// hexagonal wheel arches, Y lamps, big side intakes, a louvred engine cover, a
// high wing and twin hexagonal pipes up in the tail.
export const FULMINE = { len: 1.38, wid: 0.8, wheel: 0.14, lift: 0.06 }

export function fulmineGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = FULMINE.wheel
  const wz = FULMINE.len * 0.33
  const front = FULMINE.len / 2
  // z, half width, bottom, shoulder, fender top, crease x, middle height
  const body = new Loft([
    bodyRing(0.69, 0.28, 0.075, 0.105, 0.125, 0.15, 0.12),
    bodyRing(0.63, 0.35, 0.068, 0.15, 0.175, 0.19, 0.15),
    bodyRing(0.54, 0.395, 0.065, 0.24, 0.27, 0.2, 0.19),
    bodyRing(0.45, 0.405, 0.065, 0.3, 0.322, 0.21, 0.225),
    bodyRing(0.34, 0.405, 0.065, 0.285, 0.31, 0.21, 0.24),
    bodyRing(0.22, 0.4, 0.065, 0.25, 0.28, 0.22, 0.25),
    bodyRing(0.04, 0.388, 0.065, 0.225, 0.262, 0.23, 0.258),
    bodyRing(-0.16, 0.4, 0.065, 0.24, 0.275, 0.24, 0.268),
    bodyRing(-0.34, 0.418, 0.065, 0.29, 0.318, 0.24, 0.278),
    bodyRing(-0.46, 0.422, 0.065, 0.305, 0.332, 0.245, 0.283),
    bodyRing(-0.6, 0.415, 0.07, 0.29, 0.318, 0.25, 0.283),
    bodyRing(-0.69, 0.4, 0.08, 0.27, 0.3, 0.25, 0.28),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)

  // Greenhouse: a long raked windshield, a short roof and a fastback falling to the engine cover.
  const glass = new Loft([
    glassRing(0.33, 0.29, 0.232, 0.25, 0.236),
    glassRing(0.2, 0.3, 0.24, 0.235, 0.31),
    glassRing(0.05, 0.305, 0.248, 0.215, 0.39),
    glassRing(-0.07, 0.305, 0.255, 0.205, 0.418),
    glassRing(-0.19, 0.305, 0.262, 0.2, 0.42),
    glassRing(-0.31, 0.3, 0.27, 0.195, 0.392),
    glassRing(-0.43, 0.29, 0.276, 0.18, 0.33),
    glassRing(-0.53, 0.27, 0.28, 0.16, 0.29),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  const G = new Surface(k, glass, 3, 1)
  greenhouse(k, h, glass, { roof: [0.06, -0.33], pillar: [0.33, 0.04], belt: [0.3, -0.5], mirror: [0.24, 0.3, 0.27] })

  // Hexagonal wheel arches: a black well behind each tyre with a crisp body-dark lip.
  for (const zz of [wz, -wz]) for (const sd of [-1, 1]) {
    const R = r * 1.2
    S.wall('black', new CircleGeometry(R, 3, 0, Math.PI), sd, zz, r - 0.012, 0.003)
    S.wall('dark', new TorusGeometry(R, 0.011, 4, 3, Math.PI), sd, zz, r - 0.012, 0.004)
  }
  // Side: a sill blade, the door's cut line, and a big intake scooping air in ahead of the rear wheel.
  for (const sd of [-1, 1]) {
    k.add('black', rbox(0.03, 0.035, wz * 2 - r * 2.6, 0.01), [sd * (S.side(0) - 0.005), 0.085, -0.01])
    S.wall('dark', plane(0.006, 0.15), sd, 0.21, 0.17, 0.005, -0.35)
    S.wall('dark', plane(0.006, 0.12), sd, -0.11, 0.165, 0.005, 0.2)
    S.wall('dark', plane(0.4, 0.006), sd, 0.05, 0.236, 0.003, 0.0)
    // Intake: a dark triangle cut back into the wall, with a blade across its mouth.
    const tri: [number, number][] = [[-0.13, -0.055], [0.12, -0.055], [0.12, 0.06]]
    S.wall('black', poly(tri.map(([x, y]) => [x * 1, y])), sd, -0.22, 0.175, 0.003)
    S.wall('dark', box(0.25, 0.008, 0.01), sd, -0.21, 0.152, 0.01, 0.38)
    for (const dz of [-0.03, 0.03, 0.09]) S.wall('dark', box(0.006, 0.07, 0.008), sd, -0.22 + dz, 0.165 - dz * 0.2, 0.009)
    // A crease low along the side between the wheels.
    S.wall('dark', box(wz * 2 - r * 2.8, 0.005, 0.004), sd, 0, 0.115, 0.002)
    // Amber marker low on the front of the wall.
    S.wall('amber', plane(0.04, 0.014), sd, 0.6, 0.11, 0.004)
  }
  // Air intakes on top of each rear haunch.
  for (const sd of [-1, 1]) S.top('black', poly([[-0.03, -0.06], [0.03, -0.045], [0.03, 0.06], [-0.03, 0.05]]), sd * 0.36, -0.32, 0.003)

  // Nose: three black intakes across the front face, a splitter under it, and an angular
  // lamp each side with a Y of light inside.
  honey(k, 0, 0.098, front + 0.002, 0.17, 0.03, 0.009, 1)
  // Canards: two little black blades on each corner of the nose.
  for (const sd of [-1, 1]) for (const [y, dz] of [[0.09, 0], [0.11, -0.025]]) k.add('black', box(0.07, 0.006, 0.04), [sd * 0.33, y, front - 0.06 + dz], [0, sd * 0.5, sd * -0.2])
  for (const sd of [-1, 1]) k.add('black', poly([[-0.07, -0.016], [0.06, -0.016], [0.08, 0.016], [-0.06, 0.016]].map(([x, y]) => [x * sd, y])), [sd * 0.17, 0.097, front + 0.003])
  if (!fit.kit) {
    k.add('black', box(0.6, 0.012, 0.07), [0, 0.07, front - 0.02])
    for (const sd of [-1, 1]) k.add('black', box(0.012, 0.03, 0.06), [sd * 0.29, 0.08, front - 0.03])
  }
  for (const sd of [-1, 1]) {
    const x = sd * 0.255
    const z = 0.595
    // Housing: a slanted hexagon, longer on the outside.
    S.top('black', poly([[-0.075, -0.02], [0.05, -0.03], [0.085, 0.0], [0.06, 0.03], [-0.07, 0.025], [-0.085, 0.0]].map(([px, py]) => [-sd * px, py])), x, z, 0.002)
    // The Y: an outer arm, an inner arm and a stem meeting near the middle.
    S.top('lamp', box(0.07, 0.008, 0.004), x - sd * 0.025, z + 0.008, 0.004, sd * 0.35)
    S.top('lamp', box(0.07, 0.008, 0.004), x - sd * 0.025, z - 0.008, 0.004, -sd * 0.35)
    S.top('lamp', box(0.06, 0.008, 0.004), x + sd * 0.035, z, 0.004)
  }
  // Two ducts on the roof, a fuel cap on the right haunch.
  for (const sd of [-1, 1]) G.top('black', poly([[-0.012, -0.04], [0.012, -0.04], [0.02, 0.03], [-0.02, 0.03]]), sd * 0.07, -0.12, 0.012)
  S.top('dark', new CircleGeometry(0.02, 6), 0.33, -0.44, 0.003)
  // Hood: two vents in the channel and a crease down the middle.
  for (const sd of [-1, 1]) S.top('black', poly([[-0.025, -0.04], [0.02, -0.04], [0.03, 0.04], [-0.02, 0.04]].map(([x, y]) => [-sd * x, y])), sd * 0.07, 0.47, 0.0065)
  // Cowl: a black strip at the base of the windshield, and a wiper.
  S.top('black', box(0.48, 0.03, 0.004), 0, 0.345, 0.0055)
  S.top('black', box(0.2, 0.008, 0.006), 0.04, 0.325, 0.0095, 0.1)

  // Engine cover: black louvres across the fastback between two painted buttress ridges.
  for (let i = 0; i < 6; i++) {
    const z = -0.36 - i * 0.03
    G.top('black', box(G.loft.near(z).pts[2][0] * 1.6, 0.012, 0.006), 0, z, 0.004)
  }
  // Rear deck: a vented panel behind the glass.
  for (let i = 0; i < 4; i++) S.top('black', box(0.3, 0.012, 0.004), 0, -0.56 - i * 0.025, 0.0055)

  // Tail: a black mesh panel across the back, a Y of red in each corner, twin hexagonal
  // pipes high in the middle, a plate and a finned diffuser.
  const tz = -front
  honey(k, 0, 0.17, tz - 0.0015, 0.7, 0.12, 0.016, -1)
  // Body-colour frame round the mesh, split by a bar across the middle.
  k.add('dark', box(0.7, 0.008, 0.006), [0, 0.2, tz - 0.008])
  for (const sd of [-1, 1]) {
    const x = sd * 0.29
    k.add('tail', box(0.1, 0.012, 0.004), [x + sd * 0.01, 0.255, tz - 0.007], [0, 0, sd * 0.35])
    k.add('tail', box(0.1, 0.012, 0.004), [x + sd * 0.01, 0.225, tz - 0.007], [0, 0, -sd * 0.35])
    k.add('tail', box(0.07, 0.012, 0.004), [x - sd * 0.06, 0.24, tz - 0.007])
    k.add('lamp', plane(0.03, 0.012), [sd * 0.16, 0.12, tz - 0.0075], [0, Math.PI, 0])
  }
  if (!fit.exhaust) {
    for (const sd of [-1, 1]) {
      k.add('chrome', new CylinderGeometry(0.028, 0.028, 0.06, 6), [sd * 0.04, 0.235, tz - 0.01], [Math.PI / 2, 0, 0])
      k.add('black', disc(0.02, 6), [sd * 0.04, 0.235, tz - 0.043], [0, Math.PI, Math.PI / 6])
    }
  }
  k.add('black', plane(0.124, 0.054), [0, 0.15, tz - 0.0075], [0, Math.PI, 0])
  k.add('lamp', plane(0.11, 0.045), [0, 0.15, tz - 0.01], [0, Math.PI, 0])
  if (!fit.kit) {
    k.add('black', box(0.6, 0.03, 0.08), [0, 0.075, tz + 0.02])
    for (const x of [-0.2, -0.1, 0, 0.1, 0.2]) k.add('black', box(0.01, 0.05, 0.08), [x, 0.075, tz + 0.01])
  }
  // Wing on two black pylons over the tail, with endplates.
  if (!fit.spoiler) {
    const wy = 0.43
    const wzz = tz + 0.08
    for (const sd of [-1, 1]) h.bar(k, 'black', [sd * 0.17, S.y(sd * 0.17, wzz + 0.04), wzz + 0.04], [sd * 0.17, wy - 0.01, wzz], 0.018)
    k.add('paint', slab([[-0.06, -0.008], [0.05, -0.006], [0.06, 0.004], [-0.05, 0.01]], 0.74), [0, wy, wzz], [0, Math.PI / 2, 0])
    for (const sd of [-1, 1]) k.add('black', slab([[-0.07, -0.03], [0.07, -0.03], [0.06, 0.03], [-0.05, 0.02]], 0.01), [sd * 0.375, wy - 0.005, wzz], [0, Math.PI / 2, 0])
  }

  // Racing stripes down the hood channel, the roof and the engine cover (drawn only when painted on).
  for (const x of [-0.045, 0.045]) {
    for (let z = 0.62; z > 0.36; z -= 0.05) S.top('stripe', plane(0.06, 0.052), x, z, 0.003)
    for (let z = 0.04; z > -0.32; z -= 0.05) {
      const p = glass.near(z).pts
      k.add('stripe', box(0.06, 0.004, 0.052), [x, p[4][1] + 0.011, z])
    }
    for (let z = -0.56; z > -0.67; z -= 0.05) S.top('stripe', plane(0.06, 0.052), x, z, 0.003)
  }

  interior(k, h, -0.14, 0.16)
  h.brakes(k, (z) => brakeX(S, z), wz, r, 0.14, (z) => S.yaw(z))
  // Third brake light at the top of the fastback.
  G.top('tail', box(0.1, 0.012, 0.004), 0, -0.33, 0.004)
}

// Two bucket seats, a dash with a screen, the wheel and a console, seen through the glass.
function interior(k: Kit, h: ExoticHelpers, seatZ: number, dashZ: number) {
  for (const sd of [-1, 1]) h.seat(k, sd * 0.13, 0.17, seatZ, 0.15, 0.15)
  k.add('dash', rbox(0.5, 0.05, 0.09, 0.02), [0, 0.27, dashZ])
  k.add('display', plane(0.06, 0.035), [0, 0.29, dashZ - 0.05], [-0.4, 0, 0])
  h.steering(k, 0.13, 0.29, dashZ - 0.1)
  k.add('dash', rbox(0.07, 0.06, 0.26, 0.015), [0, 0.2, (seatZ + dashZ) / 2])
}

// Round wheel arches: a black well behind each tyre and a thin dark lip.
function roundArches(S: Surface, wz: number, r: number) {
  for (const zz of [wz, -wz]) for (const sd of [-1, 1]) {
    S.wall('black', new CircleGeometry(r * 1.2, 18, 0, Math.PI), sd, zz, r - 0.01, 0.003)
    S.wall('dark', new TorusGeometry(r * 1.2, 0.009, 4, 18, Math.PI), sd, zz, r - 0.01, 0.004)
  }
}

// A thin fin standing up along the middle of the car, following a surface: base(z) is
// the surface height and rise(z) how far the fin stands above it.
function spine(k: Kit, part: Part, z0: number, z1: number, base: (z: number) => number, rise: (z: number) => number, t: number) {
  const n = 14
  const top: [number, number][] = []
  const bot: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n
    const b = base(z)
    bot.push([z, b - 0.015])
    top.push([z, b + rise(z)])
  }
  k.add(part, slab([...bot, ...top.reverse()], t), [0, 0, 0], [0, -Math.PI / 2, 0])
}

// An outline with a hole, as a flat slab (a grille surround, a ring of trim).
function frame(outer: [number, number][], inner: [number, number][], d: number) {
  const sh = new Shape(outer.map(([x, y]) => new Vector2(x, y)))
  sh.holes.push(new Shape(inner.map(([x, y]) => new Vector2(x, y))))
  const g = new ExtrudeGeometry(sh, { depth: d, bevelEnabled: false })
  g.translate(0, 0, -d / 2)
  return g
}

// An arch: straight sides with a round top, w half width, h height, base at y = 0.
const arch = (w: number, h: number, seg = 10): [number, number][] => {
  const out: [number, number][] = [[w, 0]]
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI
    out.push([Math.cos(a) * w, h - w + Math.sin(a) * w])
  }
  out.push([-w, 0])
  return out
}
const ellipse = (rx: number, ry: number, seg = 16): [number, number][] =>
  Array.from({ length: seg }, (_, i) => [Math.cos((i / seg) * Math.PI * 2) * rx, Math.sin((i / seg) * Math.PI * 2) * ry])

// ---------------------------------------------------------------------------
// Moreau Eclat: a W16 hypercar. Rounded fenders, a horseshoe grille on a raised nose
// spine, a chrome C sweeping round each door, a fin down the roof, one light bar
// across the tail and four big pipes in the middle.
export const ECLAT = { len: 1.4, wid: 0.82, wheel: 0.145 }

export function eclatGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = ECLAT.wheel
  const wz = ECLAT.len * 0.33
  const front = ECLAT.len / 2
  const body = new Loft([
    bodyRing(0.7, 0.26, 0.085, 0.135, 0.155, 0.1, 0.175, true),
    bodyRing(0.63, 0.345, 0.075, 0.2, 0.225, 0.15, 0.2, true),
    bodyRing(0.54, 0.395, 0.07, 0.265, 0.29, 0.18, 0.218, true),
    bodyRing(0.46, 0.41, 0.07, 0.305, 0.33, 0.2, 0.232, true),
    bodyRing(0.34, 0.41, 0.07, 0.295, 0.32, 0.2, 0.245, true),
    bodyRing(0.2, 0.405, 0.07, 0.27, 0.3, 0.21, 0.26, true),
    bodyRing(0, 0.398, 0.07, 0.26, 0.29, 0.22, 0.27, true),
    bodyRing(-0.2, 0.405, 0.07, 0.275, 0.305, 0.23, 0.282, true),
    bodyRing(-0.36, 0.422, 0.07, 0.3, 0.328, 0.24, 0.295, true),
    bodyRing(-0.46, 0.425, 0.07, 0.308, 0.335, 0.24, 0.3, true),
    bodyRing(-0.6, 0.415, 0.075, 0.295, 0.32, 0.24, 0.298, true),
    bodyRing(-0.7, 0.395, 0.085, 0.275, 0.3, 0.23, 0.29, true),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)
  const glass = new Loft([
    glassRing(0.32, 0.29, 0.237, 0.25, 0.241, true),
    glassRing(0.2, 0.3, 0.25, 0.23, 0.32, true),
    glassRing(0.06, 0.305, 0.26, 0.2, 0.4, true),
    glassRing(-0.06, 0.305, 0.265, 0.19, 0.435, true),
    glassRing(-0.18, 0.305, 0.272, 0.185, 0.44, true),
    glassRing(-0.3, 0.3, 0.28, 0.18, 0.41, true),
    glassRing(-0.4, 0.29, 0.287, 0.17, 0.36, true),
    glassRing(-0.48, 0.27, 0.292, 0.15, 0.31, true),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  const G = new Surface(k, glass, 3, 1)
  greenhouse(k, h, glass, { roof: [0.06, -0.3], pillar: [0.32, 0.06], belt: [0.3, -0.45], mirror: [0.24, 0.3, 0.275] })
  roundArches(S, wz, r)

  // Fin down the middle of the roof and the engine cover, and a sharp spine up the nose.
  const roofTop = (z: number) => (z > -0.3 ? glass.near(z).pts[4][1] + 0.009 : S.y(0, z))
  spine(k, 'paint', 0.0, -0.66, roofTop, (z) => 0.01 + 0.012 * Math.sin(Math.min(1, (0.0 - z) / 0.66) * Math.PI), 0.012)
  spine(k, 'paint', front - 0.005, 0.36, (z) => S.y(0, z), (z) => 0.012 * Math.min(1, (z - 0.36) / 0.08), 0.03)
  // Creases running back over the hood from each headlight to the windshield.
  for (const sd of [-1, 1]) for (let z = 0.56; z > 0.33; z -= 0.035) S.top('dark', box(0.005, 0.036, 0.003), sd * (0.17 - (0.56 - z) * 0.12), z, 0.0015, sd * 0.12)
  // Engine grille: a honeycomb panel on the rear deck behind the glass.
  S.top('black', poly([[-0.17, -0.05], [0.17, -0.05], [0.15, 0.05], [-0.15, 0.05]]), 0, -0.57, 0.002)
  for (const x of [-0.12, -0.06, 0, 0.06, 0.12]) for (const dz of [-0.025, 0.012]) S.top('dash', new CircleGeometry(0.014, 6), x + (dz > 0 ? 0.03 : 0), -0.57 + dz, 0.005)
  // Two roof intakes either side of the fin.
  for (const sd of [-1, 1]) G.top('black', poly(ellipse(0.025, 0.05, 12)), sd * 0.06, -0.33, 0.004)

  // Horseshoe grille: a chrome arch on the nose filled with dark mesh and a centre bar.
  const hs = arch(0.052, 0.085)
  const hi = arch(0.04, 0.075).map(([x, y]): [number, number] => [x, y + 0.006])
  k.add('chrome', frame(hs, hi, 0.012), [0, 0.088, front + 0.002], [-0.12, 0, 0])
  k.add('dark', poly(hi), [0, 0.088, front + 0.0], [-0.12, 0, 0])
  for (const x of [-0.02, 0, 0.02]) k.add('black', box(0.004, 0.07, 0.006), [x, 0.1255, front + 0.0035], [-0.12, 0, 0])
  // Big intakes either side of it, and a splitter under the lot.
  for (const sd of [-1, 1]) k.add('black', poly([[0.06, -0.02], [0.2, -0.025], [0.22, 0.02], [0.07, 0.03]].map(([x, y]) => [x * sd, y])), [0, 0.11, front + 0.003], [0, 0, 0])
  if (!fit.kit) k.add('black', box(0.62, 0.012, 0.07), [0, 0.075, front - 0.02])
  // Headlights: four small lamps in a row in a slim black housing each side.
  for (const sd of [-1, 1]) {
    const x = sd * 0.25
    S.top('black', poly([[-0.07, -0.018], [0.07, -0.024], [0.075, 0.016], [-0.065, 0.022]].map(([px, py]) => [-sd * px, py])), x, 0.6, 0.002)
    for (let i = 0; i < 4; i++) S.top('lamp', box(0.022, 0.018, 0.004), x + sd * (i - 1.5) * 0.031, 0.6 - (i - 1.5) * 0.003, 0.004)
  }
  // C-line: a chrome sweep round the back of each door, the intake inside it in black.
  for (const sd of [-1, 1]) {
    const cz = -0.0
    const cy = 0.17
    const pts: [number, number][] = []
    for (let i = 0; i <= 12; i++) {
      const a = (70 + (i / 12) * 220) * (Math.PI / 180)
      pts.push([cz + 0.13 * Math.cos(a), cy + 0.085 * Math.sin(a)])
    }
    for (let i = 1; i < pts.length; i++) {
      const [z0, y0] = pts[i - 1]
      const [z1, y1] = pts[i]
      h.bar(k, 'chrome', [sd * (S.side(z0) + 0.006), y0, z0], [sd * (S.side(z1) + 0.006), y1, z1], 0.013)
    }
    // The intake: the inside of the C, set just behind the chrome.
    const inside = Array.from({ length: 11 }, (_, i): [number, number] => {
      const a = (100 + (i / 10) * 160) * (Math.PI / 180)
      return [-0.105 * Math.cos(a), 0.065 * Math.sin(a)]
    })
    S.wall('black', poly(inside), sd, cz - 0.01, cy, 0.003)
    // Door seam ahead of the C, sill blade and a front marker.
    S.wall('dark', plane(0.006, 0.15), sd, 0.2, 0.17, 0.005, 0.25)
    // Vent behind the front wheel: three black slots.
    for (let i = 0; i < 3; i++) S.wall('black', box(0.05, 0.008, 0.002), sd, 0.29 - i * 0.004, 0.23 - i * 0.02, 0.003, -0.3)
    k.add('black', rbox(0.03, 0.035, wz * 2 - r * 2.6, 0.01), [sd * (S.side(0) - 0.005), 0.085, -0.01])
    S.wall('amber', plane(0.04, 0.014), sd, 0.6, 0.12, 0.004)
  }

  // Tail: one light bar right across, honeycomb under it, four big pipes in the middle,
  // a plate, a diffuser and a flat wing that sits just proud of the tail.
  const tz = -front
  k.add('black', plane(0.76, 0.04), [0, 0.262, tz - 0.0025], [0, Math.PI, 0])
  k.add('tail', box(0.72, 0.014, 0.004), [0, 0.262, tz - 0.007])
  honey(k, 0, 0.19, tz - 0.002, 0.7, 0.1, 0.016, -1)
  for (const sd of [-1, 1]) k.add('lamp', plane(0.035, 0.012), [sd * 0.3, 0.23, tz - 0.008], [0, Math.PI, 0])
  if (!fit.exhaust) {
    k.add('black', rbox(0.15, 0.094, 0.03, 0.02), [0, 0.1385, tz - 0.004])
    for (const [x, y] of [[-0.033, 0.16], [0.033, 0.16], [-0.033, 0.11], [0.033, 0.11]]) {
      k.add('chrome', new CylinderGeometry(0.022, 0.022, 0.05, 14), [x, y, tz - 0.012], [Math.PI / 2, 0, 0])
      k.add('black', disc(0.016, 14), [x, y, tz - 0.04], [0, Math.PI, 0])
    }
  }
  k.add('black', plane(0.124, 0.054), [0, 0.215, tz - 0.008], [0, Math.PI, 0])
  k.add('lamp', plane(0.11, 0.045), [0, 0.215, tz - 0.0105], [0, Math.PI, 0])
  if (!fit.kit) {
    k.add('black', box(0.64, 0.03, 0.08), [0, 0.075, tz + 0.02])
    for (const x of [-0.24, -0.14, 0.14, 0.24]) k.add('black', box(0.01, 0.05, 0.08), [x, 0.075, tz + 0.01])
  }
  if (!fit.spoiler) {
    const wy = S.y(0, tz + 0.06) + 0.03
    for (const sd of [-1, 1]) k.add('black', box(0.012, 0.035, 0.04), [sd * 0.2, wy - 0.02, tz + 0.06])
    k.add('paint', slab([[-0.055, -0.008], [0.05, -0.004], [0.055, 0.006], [-0.05, 0.008]], 0.72), [0, wy, tz + 0.06], [0, Math.PI / 2, 0])
  }

  // Racing stripes over the nose, the roof and the tail (drawn only when painted on).
  for (const x of [-0.05, 0.05]) {
    for (let z = 0.62; z > 0.36; z -= 0.05) S.top('stripe', plane(0.055, 0.052), x, z, 0.003)
    for (let z = 0.04; z > -0.28; z -= 0.05) k.add('stripe', box(0.055, 0.004, 0.052), [x, glass.near(z).pts[4][1] + 0.011, z])
  }
  interior(k, h, -0.14, 0.17)
  h.brakes(k, (z) => brakeX(S, z), wz, r, 0.14, (z) => S.yaw(z))
}

// ---------------------------------------------------------------------------
// Aurelio Orafo: a hand-built V12 coupe. A teardrop canopy standing up between round
// fenders, a snorkel on the roof, triangles of round lamps, four pipes in a ring and a
// long ducktail.
export const ORAFO = { len: 1.42, wid: 0.8, wheel: 0.145 }

export function orafoGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = ORAFO.wheel
  const wz = ORAFO.len * 0.33
  const front = ORAFO.len / 2
  const body = new Loft([
    bodyRing(0.71, 0.24, 0.085, 0.12, 0.14, 0.1, 0.13, true),
    bodyRing(0.64, 0.33, 0.075, 0.19, 0.215, 0.14, 0.155, true),
    bodyRing(0.55, 0.385, 0.07, 0.26, 0.29, 0.17, 0.19, true),
    bodyRing(0.47, 0.405, 0.07, 0.305, 0.33, 0.19, 0.215, true),
    bodyRing(0.35, 0.405, 0.07, 0.295, 0.32, 0.2, 0.232, true),
    bodyRing(0.2, 0.395, 0.07, 0.26, 0.29, 0.22, 0.25, true),
    bodyRing(0, 0.378, 0.07, 0.235, 0.27, 0.22, 0.262, true),
    bodyRing(-0.2, 0.392, 0.07, 0.255, 0.285, 0.23, 0.272, true),
    bodyRing(-0.36, 0.415, 0.07, 0.3, 0.325, 0.24, 0.28, true),
    bodyRing(-0.47, 0.42, 0.07, 0.31, 0.335, 0.24, 0.285, true),
    bodyRing(-0.62, 0.4, 0.08, 0.29, 0.312, 0.24, 0.292, true),
    bodyRing(-0.71, 0.37, 0.095, 0.275, 0.3, 0.22, 0.305, true),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)
  const glass = new Loft([
    glassRing(0.3, 0.25, 0.235, 0.2, 0.24, true),
    glassRing(0.18, 0.27, 0.245, 0.19, 0.33, true),
    glassRing(0.04, 0.275, 0.255, 0.175, 0.41, true),
    glassRing(-0.08, 0.275, 0.262, 0.165, 0.44, true),
    glassRing(-0.2, 0.265, 0.27, 0.15, 0.43, true),
    glassRing(-0.32, 0.24, 0.275, 0.12, 0.38, true),
    glassRing(-0.44, 0.2, 0.28, 0.085, 0.32, true),
    glassRing(-0.52, 0.15, 0.283, 0.055, 0.29, true),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  greenhouse(k, h, glass, { roof: [0.04, -0.36], pillar: [0.3, 0.04], belt: [0.28, -0.46], mirror: [0.22, 0.27, 0.27] })
  roundArches(S, wz, r)

  // Roof snorkel: a scoop on the roof with a black mouth.
  const ry = glass.near(-0.12).pts[4][1]
  k.add('paint', rbox(0.11, 0.045, 0.17, 0.02), [0, ry + 0.02, -0.15])
  k.add('black', rbox(0.08, 0.026, 0.01, 0.006), [0, ry + 0.026, -0.064])

  // Nose: an oval intake low in the middle with two small ones beside it, a splitter, and a
  // teardrop of black on each front fender holding three round lamps.
  k.add('black', poly(ellipse(0.11, 0.022, 20)), [0, 0.105, front + 0.003])
  for (const sd of [-1, 1]) k.add('black', poly(ellipse(0.045, 0.016, 14)), [sd * 0.17, 0.1, front + 0.003])
  if (!fit.kit) k.add('black', box(0.56, 0.012, 0.07), [0, 0.075, front - 0.02])
  for (const sd of [-1, 1]) {
    const x = sd * 0.24
    const z = 0.59
    S.top('black', poly(ellipse(0.034, 0.05, 18)), x, z + 0.005, 0.002, sd * 0.35)
    for (const [dx, dz] of [[0, 0.028], [-0.017, -0.004], [0.017, -0.004]]) {
      S.top('lamp', disc(0.014, 14), x + dx, z + dz, 0.005)
      S.top('chrome', new TorusGeometry(0.015, 0.003, 3, 14), x + dx, z + dz, 0.006)
    }
  }
  // Two vents on the hood.
  for (const sd of [-1, 1]) vent(S, sd * 0.075, 0.46, 0.06, 0.1, 4, sd * -0.15)
  // Chrome bonnet pins, and an oval badge on the nose.
  for (const sd of [-1, 1]) S.top('chrome', disc(0.008, 10), sd * 0.13, 0.6, 0.003)
  S.top('chrome', poly(ellipse(0.022, 0.014, 14)), 0, 0.665, 0.005)
  S.top('dash', poly(ellipse(0.016, 0.009, 14)), 0, 0.665, 0.007)
  // Louvres across the rear deck.
  for (let i = 0; i < 5; i++) S.top('black', box(0.26 - i * 0.02, 0.01, 0.004), 0, -0.56 - i * 0.022, 0.003)

  // Sides: a door seam, a sill blade, an intake on top of each rear haunch, a front marker.
  for (const sd of [-1, 1]) {
    S.wall('dark', plane(0.006, 0.14), sd, 0.19, 0.17, 0.005, 0.25)
    S.wall('dark', plane(0.006, 0.12), sd, -0.15, 0.165, 0.005, -0.15)
    k.add('black', rbox(0.03, 0.035, wz * 2 - r * 2.6, 0.01), [sd * (S.side(0) - 0.005), 0.085, -0.01])
    vent(S, sd * 0.34, -0.3, 0.05, 0.13, 5)
    S.wall('black', poly(ellipse(0.07, 0.03, 14)), sd, -0.24, 0.18, 0.003)
    S.wall('amber', plane(0.04, 0.014), sd, 0.62, 0.11, 0.004)
  }

  // Tail: two round lamps each side in black rings, four pipes in a chrome ring in the middle,
  // a mesh panel under them, a plate, a diffuser, and a flap at each corner of the ducktail.
  const tz = -front
  honey(k, 0, 0.15, tz - 0.002, 0.6, 0.09, 0.015, -1)
  for (const sd of [-1, 1]) for (const x of [0.2, 0.28]) {
    k.add('black', disc(0.03, 16), [sd * x, 0.245, tz - 0.0025], [0, Math.PI, 0])
    k.add('tail', disc(0.023, 16), [sd * x, 0.245, tz - 0.005], [0, Math.PI, 0])
    k.add('chrome', new TorusGeometry(0.027, 0.004, 3, 16), [sd * x, 0.245, tz - 0.005])
  }
  if (!fit.exhaust) {
    k.add('chrome', new TorusGeometry(0.05, 0.008, 4, 20), [0, 0.225, tz - 0.012])
    k.add('black', disc(0.05, 20), [0, 0.225, tz - 0.008], [0, Math.PI, 0])
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      const p: V3 = [Math.cos(a) * 0.024, 0.225 + Math.sin(a) * 0.024, tz - 0.02]
      k.add('chrome', new CylinderGeometry(0.014, 0.014, 0.04, 12), p, [Math.PI / 2, 0, 0])
      k.add('black', disc(0.01, 12), [p[0], p[1], tz - 0.043], [0, Math.PI, 0])
    }
  }
  k.add('black', plane(0.124, 0.054), [0, 0.15, tz - 0.008], [0, Math.PI, 0])
  k.add('lamp', plane(0.11, 0.045), [0, 0.15, tz - 0.0105], [0, Math.PI, 0])
  if (!fit.kit) {
    k.add('black', box(0.56, 0.03, 0.08), [0, 0.085, tz + 0.02])
    for (const x of [-0.18, -0.09, 0.09, 0.18]) k.add('black', box(0.01, 0.05, 0.08), [x, 0.085, tz + 0.01])
  }
  if (!fit.spoiler) for (const sd of [-1, 1]) {
    const x = sd * 0.25
    const y = S.y(x, tz + 0.05)
    k.add('paint', slab([[-0.05, -0.006], [0.045, -0.004], [0.05, 0.004], [-0.045, 0.006]], 0.16), [x, y + 0.02, tz + 0.05], [0, Math.PI / 2, 0.0])
    k.add('black', box(0.01, 0.025, 0.03), [x, y + 0.006, tz + 0.05])
  }

  for (const x of [-0.045, 0.045]) {
    for (let z = 0.63; z > 0.36; z -= 0.05) S.top('stripe', plane(0.05, 0.052), x, z, 0.003)
  }
  interior(k, h, -0.14, 0.15)
  h.brakes(k, (z) => brakeX(S, z), wz, r, 0.14, (z) => S.yaw(z))
}

// Exotic bodies by name, and what draws each.
export const EXOTIC: Partial<Record<Body, (k: Kit, fit: ExoticFit, h: ExoticHelpers) => void>> = { scissor: fulmineGeo, horseshoe: eclatGeo, teardrop: orafoGeo }
