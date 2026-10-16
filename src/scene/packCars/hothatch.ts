import { BufferGeometry, CircleGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, TorusGeometry, Vector2 } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Kit } from '../CarModel'
import { Loft } from '../loft'
import { Surface, bodyRing, box, disc, glassRing, greenhouse, plane, poly, rbox, slab, vent, type ExoticFit, type ExoticHelpers } from '../exoticCars'

// ---------------------------------------------------------------------------
// Vetta Scatto HF: a late-80s rally-bred hot hatch. A short, upright three-door box with
// a flat bonnet, a tall glasshouse and a steep hatch, square box flares bolted over all
// four tyres, four square headlamps in a slim black grille, a deep bumper with two fog
// lamps, a spoiler along the back of the roof, slim tail lamps that wrap round the rear
// flares and one fat pipe under the bumper. Our own drawing; the name and the shield
// badge are invented.

type V3 = [number, number, number]
const SIDES = [-1, 1] as const
export const SCATTO = { len: 1.12, wid: 0.72, wheel: 0.14 }

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
// so it faces out along dir, with shared corners so it shades smooth.
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

// A box flare seen from the side: (z, y) outline with the wheel opening cut up from below,
// extruded across the car from x = sd * out inward by d, with a small rolled edge.
function flare(sd: number, outline: [number, number][], out: number, d: number) {
  const e = 0.005
  const sh = new Shape(outline.map(([z, y]) => new Vector2(sd > 0 ? z : -z, y)))
  const g = new ExtrudeGeometry(sh, { depth: d - 2 * e, bevelEnabled: true, bevelSize: e, bevelThickness: e, bevelSegments: 2, curveSegments: 14 })
  g.translate(0, 0, e)
  g.rotateY(sd > 0 ? -Math.PI / 2 : Math.PI / 2)
  g.translate(sd * out, 0, 0)
  return g
}

// The side outline of one flare: bottom b, flat top t, ends z0 (front) and z1 (back), an
// opening of radius R round (wz, cy), the top corners chamfered by cf (front) and cb (back).
function flareOutline(z0: number, z1: number, b: number, t: number, wz: number, R: number, cy: number, cf: number, cb: number): [number, number][] {
  const out: [number, number][] = [[z1, b], [wz - R, b]]
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI - (i / 16) * Math.PI
    out.push([wz + Math.cos(a) * R, cy + Math.sin(a) * R])
  }
  out.push([wz + R, b], [z0, b], [z0, t - cf], [z0 - cf, t], [z1 + cb, t], [z1, t - cb])
  return out
}

export function hothatchGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = SCATTO.wheel
  const wz = SCATTO.len * 0.33
  const fz = SCATTO.len / 2
  const tz = -fz

  // Body: a slab-sided box. z, half width, bottom, shoulder, bonnet edge, crease x, middle
  // height. The flat bonnet drops a little to an upright nose; the tail is cut off square.
  const body = new Loft([
    bodyRing(fz, 0.32, 0.11, 0.276, 0.288, 0.25, 0.284),
    bodyRing(0.55, 0.334, 0.1, 0.287, 0.298, 0.25, 0.294),
    bodyRing(0.5, 0.338, 0.09, 0.297, 0.308, 0.25, 0.303),
    bodyRing(0.36, 0.338, 0.09, 0.306, 0.317, 0.25, 0.312),
    bodyRing(0.2, 0.338, 0.09, 0.312, 0.323, 0.25, 0.318),
    bodyRing(0.0, 0.338, 0.09, 0.316, 0.327, 0.26, 0.322),
    bodyRing(-0.3, 0.338, 0.09, 0.319, 0.33, 0.26, 0.325),
    bodyRing(-0.5, 0.336, 0.09, 0.32, 0.331, 0.26, 0.326),
    bodyRing(-0.55, 0.332, 0.1, 0.319, 0.33, 0.26, 0.325),
    bodyRing(tz, 0.32, 0.11, 0.313, 0.325, 0.25, 0.32),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)

  // Greenhouse: a raked windshield, a long flat roof, upright side glass and a steep hatch.
  const glass = new Loft([
    glassRing(0.21, 0.322, 0.304, 0.306, 0.318),
    glassRing(0.15, 0.324, 0.306, 0.298, 0.378),
    glassRing(0.09, 0.324, 0.308, 0.292, 0.433),
    glassRing(0.035, 0.324, 0.309, 0.288, 0.47),
    glassRing(-0.03, 0.324, 0.31, 0.286, 0.487),
    glassRing(-0.16, 0.324, 0.312, 0.286, 0.493),
    glassRing(-0.3, 0.324, 0.314, 0.285, 0.491),
    glassRing(-0.39, 0.322, 0.315, 0.283, 0.483),
    glassRing(-0.45, 0.317, 0.317, 0.279, 0.448),
    glassRing(-0.5, 0.31, 0.318, 0.272, 0.39),
    glassRing(-0.53, 0.3, 0.319, 0.264, 0.336),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  const G = new Surface(k, glass, 3, 1)
  greenhouse(k, h, glass, { roof: [0.03, -0.39], pillar: [0.21, 0.03], belt: [0.21, -0.36], mirror: [0.16, 0.27, 0.335] })
  const roofY = (z: number) => glass.near(z).pts[4][1] + 0.009

  // A point on the side glass at z, t of the way up from the belt to the roof edge,
  // lifted a little off it.
  const at = (sd: number, z: number, t: number, off = 0.004): V3 => {
    const p = glass.near(z).pts
    const x = p[1][0] + (p[2][0] - p[1][0]) * t
    const y = p[1][1] + (p[2][1] - p[1][1]) * t
    const ux = p[2][0] - p[1][0]
    const uy = p[2][1] - p[1][1]
    const l = Math.hypot(ux, uy)
    return [sd * (x + (uy / l) * off), y - (ux / l) * off, z]
  }
  // Wide body-colour C pillars round the hatch: a sheet over the back of the side glass
  // (its front edge leaning forward at the top) and over the hatch's top corners, so the
  // hatch glass is narrower than the roof. A black B pillar ends the door glass.
  for (const sd of SIDES) {
    const z1 = -0.53
    const lead = (t: number) => -0.37 + 0.035 * t
    const grid: V3[][] = []
    for (let i = 0; i <= 4; i++) {
      const t = i / 4
      const row: V3[] = []
      for (let j = 0; j <= 6; j++) row.push(at(sd, lead(t) + (z1 - lead(t)) * (j / 6), t))
      grid.push(row)
    }
    k.add('paint', sheet(grid, [sd, 0, 0]))
    const top: V3[][] = []
    for (let i = 0; i <= 6; i++) {
      const z = -0.335 + ((z1 + 0.335) * i) / 6
      const p = glass.near(z).pts
      const yt = p[4][1] + 0.004
      const xi = p[3][0] - 0.06
      const row: V3[] = []
      for (let j = 0; j <= 3; j++) row.push([sd * (xi + ((p[3][0] - xi) * j) / 3), yt, z])
      row.push([sd * (p[2][0] + 0.003), p[2][1] + 0.003, z], at(sd, z, 1))
      top.push(row)
    }
    k.add('paint', sheet(top, [sd * 0.3, 1, 0]))
    const b = [at(sd, -0.15, 0), at(sd, -0.175, 0), at(sd, -0.175, 1), at(sd, -0.15, 1)]
    k.add('black', facet(sd > 0 ? b : [b[0], b[3], b[2], b[1]]))
  }

  // Box flares over all four tyres, standing out of the doors, each lined black.
  const out = 0.404
  const R = 0.152
  const cy = r - 0.002
  const flares = [
    { z0: 0.545, z1: 0.195, c: wz, t: 0.3, cf: 0.03, cb: 0.014 },
    { z0: -0.195, z1: -0.545, c: -wz, t: 0.31, cf: 0.014, cb: 0.024 },
  ]
  for (const f of flares) for (const sd of SIDES) {
    k.add('paint', flare(sd, flareOutline(f.z0, f.z1, 0.108, f.t, f.c, R, cy, f.cf, f.cb), out, 0.058))
    // The well: black on the body side behind the tyre, a liner round the opening and a
    // dark lip on its edge.
    const x = S.side(f.c) + 0.006
    k.add('black', new CircleGeometry(R, 18, 0, Math.PI), [sd * x, cy, f.c], [0, (sd * Math.PI) / 2, 0])
    k.add('black', plane(R * 2, cy - 0.1), [sd * x, (cy + 0.1) / 2, f.c], [0, (sd * Math.PI) / 2, 0])
    const liner = new CylinderGeometry(R - 0.002, R - 0.002, out - x + 0.004, 18, 1, true, -Math.PI / 2, Math.PI)
    liner.rotateZ(Math.PI / 2)
    liner.rotateX(-Math.PI / 2)
    k.add('black', liner, [sd * (x + out) / 2, cy, f.c])
    k.add('dark', new TorusGeometry(R - 0.004, 0.005, 4, 20, Math.PI), [sd * (out - 0.003), cy, f.c], [0, Math.PI / 2, 0])
  }

  // Sides: door cuts, a handle, a black rubbing strip, a black sill, an amber marker on the
  // front flare and a stripe low along the doors and over the flares (drawn only when
  // painted on).
  for (const sd of SIDES) {
    S.wall('dark', plane(0.004, 0.2), sd, 0.18, 0.205, 0.0035)
    S.wall('dark', plane(0.004, 0.2), sd, -0.182, 0.205, 0.0035)
    S.wall('black', rbox(0.05, 0.01, 0.008, 0.003), sd, -0.14, 0.285, 0.003)
    S.wall('black', rbox(0.35, 0.018, 0.012, 0.005), sd, 0, 0.215, 0.002)
    S.wall('stripe', plane(0.35, 0.028), sd, 0, 0.16, 0.003)
    for (const f of flares) k.add('stripe', plane(Math.abs(f.z0 - f.z1) - 0.024, 0.028), [sd * (out + 0.003), 0.16, (f.z0 + f.z1) / 2], [0, sd * Math.PI / 2, 0])
    k.add('amber', plane(0.03, 0.014), [sd * (out + 0.003), 0.235, 0.515], [0, sd * Math.PI / 2, 0])
    k.add('black', rbox(0.03, 0.03, 0.372, 0.01), [sd * (S.side(0) - 0.004), 0.108, 0])
  }

  // Bonnet: a pair of louvred vents near the cowl and a black cowl strip with two wipers.
  if (!fit.hood) for (const sd of SIDES) vent(S, sd * 0.19, 0.3, 0.09, 0.09, 4)
  S.top('black', box(0.52, 0.02, 0.004), 0, 0.222, 0.0045)
  for (const x of [-0.2, 0.04]) h.bar(k, 'black', [x, 0.33, 0.212], [x + 0.15, 0.34, 0.2], 0.007)

  // Nose: a slim black band across the face carrying four square headlamps and a slatted
  // grille with the shield badge.
  const fy = fz + 0.002
  k.add('black', plane(0.62, 0.062), [0, 0.232, fy])
  for (const sd of SIDES) for (const [x, w] of [[0.255, 0.074], [0.172, 0.068]] as const) {
    k.add('chrome', plane(w + 0.008, 0.05), [sd * x, 0.232, fy + 0.002])
    k.add('lamp', plane(w, 0.042), [sd * x, 0.232, fy + 0.0045])
  }
  for (const y of [0.217, 0.232, 0.247]) k.add('dash', box(0.22, 0.005, 0.004), [0, y, fy + 0.004])
  k.add('chrome', poly([[-0.018, 0.016], [0.018, 0.016], [0.018, -0.002], [0, -0.018], [-0.018, -0.002]]), [0, 0.232, fy + 0.009])
  k.add('tail', poly([[-0.012, 0.011], [0.012, 0.011], [0.012, -0.002], [0, -0.012], [-0.012, -0.002]]), [0, 0.232, fy + 0.0115])

  // Front bumper: deep, black, wrapping round the flares, with the plate, two fog lamps, a
  // slot below and amber corner lamps; a splitter lip under it.
  const fb = fz + 0.035
  k.add('black', rbox(0.822, 0.085, 0.07, 0.014), [0, 0.142, fz])
  k.add('black', plane(0.13, 0.034), [0, 0.158, fb + 0.002])
  k.add('lamp', plane(0.12, 0.026), [0, 0.158, fb + 0.0045])
  for (const sd of SIDES) {
    k.add('chrome', new TorusGeometry(0.021, 0.004, 4, 18), [sd * 0.21, 0.15, fb + 0.001])
    k.add('lamp', disc(0.019, 18), [sd * 0.21, 0.15, fb + 0.003])
    k.add('amber', plane(0.045, 0.014), [sd * 0.315, 0.165, fb + 0.002])
  }
  k.add('dash', plane(0.26, 0.012), [0, 0.118, fb + 0.002])
  if (!fit.kit) k.add('black', box(0.7, 0.006, 0.03), [0, 0.098, fz + 0.03])

  // Tail: slim lamps across a black band, wrapping round onto the ends of the flares, the
  // badge between them, a plate, a black bumper with a reflector each end, the hatch
  // wiper and one fat pipe out under the left of the bumper.
  const ty = 0.272
  const by = tz - 0.002
  k.add('black', plane(0.62, 0.042), [0, ty, by], [0, Math.PI, 0])
  for (const sd of SIDES) {
    k.add('tail', plane(0.11, 0.032), [sd * 0.25, ty, tz - 0.0045], [0, Math.PI, 0])
    k.add('amber', plane(0.035, 0.032), [sd * 0.172, ty, tz - 0.0045], [0, Math.PI, 0])
    k.add('lamp', plane(0.03, 0.032), [sd * 0.135, ty, tz - 0.0045], [0, Math.PI, 0])
    // The wrap: lamps on the back ends of the rear flares and a sliver on their outer faces.
    k.add('tail', plane(0.064, 0.032), [sd * (out - 0.036), ty, -0.55 - 0.0025], [0, Math.PI, 0])
    if (!fit.kit) k.add('tail', plane(0.022, 0.032), [sd * (out + 0.003), ty, -0.528], [0, sd * Math.PI / 2, 0])
  }
  k.add('chrome', box(0.18, 0.004, 0.003), [0, ty + 0.009, tz - 0.004])
  k.add('chrome', poly([[-0.014, 0.012], [0.014, 0.012], [0.014, -0.002], [0, -0.014], [-0.014, -0.002]]), [0, ty - 0.004, tz - 0.0045], [0, Math.PI, 0])
  k.add('black', plane(0.13, 0.042), [0, 0.215, by], [0, Math.PI, 0])
  k.add('lamp', plane(0.12, 0.034), [0, 0.215, tz - 0.0045], [0, Math.PI, 0])
  const rb = tz - 0.035
  k.add('black', rbox(0.822, 0.08, 0.07, 0.014), [0, 0.14, tz])
  for (const sd of SIDES) k.add('tail', plane(0.05, 0.012), [sd * 0.31, 0.155, rb - 0.002], [0, Math.PI, 0])
  if (!fit.kit) k.add('black', box(0.4, 0.006, 0.03), [0, 0.098, tz - 0.03])
  if (!fit.exhaust) {
    const px = -0.2
    const py = 0.098
    const pr = 0.026
    k.add('chrome', new CylinderGeometry(pr, pr, 0.07, 16), [px, py, tz - 0.004], [Math.PI / 2, 0, 0])
    k.add('chrome', new TorusGeometry(pr - 0.002, 0.004, 5, 18), [px, py, tz - 0.04])
    k.add('black', disc(pr - 0.004, 16), [px, py, tz - 0.0415], [0, Math.PI, 0])
  }
  const wy = (z: number) => G.y(0, z) + 0.006
  h.bar(k, 'black', [0, wy(-0.505), -0.505], [0.1, wy(-0.475), -0.475], 0.006)

  // Roof spoiler: a body-colour blade carried off the back of the roof, out over the hatch,
  // with a third brake light along its trailing edge.
  if (!fit.spoiler) {
    const y0 = roofY(-0.37)
    k.add('paint', slab([[-0.35, y0 - 0.012], [-0.47, y0 - 0.02], [-0.478, y0 - 0.006], [-0.44, y0 + 0.007], [-0.395, y0 + 0.002], [-0.35, y0 - 0.004]], 0.56), [0, 0, 0], [0, -Math.PI / 2, 0])
    k.add('tail', box(0.14, 0.006, 0.004), [0, y0 - 0.014, -0.4745], [0.05, 0, 0])
  }

  // Twin stripes over the bonnet and the roof (drawn only when painted on).
  for (const x of [-0.055, 0.055]) {
    if (!fit.hood) for (let z = 0.53; z > 0.33; z -= 0.045) S.top('stripe', plane(0.045, 0.046), x, z, 0.003)
    else for (let z = 0.53; z > 0.24; z -= 0.045) S.top('stripe', plane(0.045, 0.046), x, z, 0.003)
    for (let z = 0.0; z > -0.37; z -= 0.045) k.add('stripe', box(0.045, 0.004, 0.046), [x, roofY(z) + 0.002, z])
  }

  // Cockpit: two buckets, a small rear bench, the dash with two dials and the wheel.
  for (const sd of SIDES) h.seat(k, sd * 0.13, 0.2, -0.09, 0.14, 0.15)
  k.add('cabin', rbox(0.46, 0.09, 0.05, 0.015), [0, 0.3, -0.36], [-0.2, 0, 0])
  k.add('dash', rbox(0.58, 0.05, 0.08, 0.015), [0, 0.325, 0.12])
  for (const x of [0.105, 0.155]) k.add('display', disc(0.016, 14), [x, 0.335, 0.077], [-0.3, 0, 0])
  h.steering(k, 0.13, 0.355, 0.05)
  k.add('dash', rbox(0.07, 0.06, 0.22, 0.015), [0, 0.22, 0.0])

  h.brakes(k, 0.3, wz, r, 0.14)
}
