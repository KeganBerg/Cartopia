import { BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Kit } from '../CarModel'
import { Loft } from '../loft'
import { Surface, bodyRing, box, disc, glassRing, greenhouse, honey, interior, plane, poly, rbox, slab, vent, type ExoticFit, type ExoticHelpers } from '../exoticCars'

// ---------------------------------------------------------------------------
// Kazumi Hayate RS: a 1990s twin-turbo front-engine sports coupe. A low wedge nose with
// its pop-up headlamps folded shut under two lids on the front corners, slim corner lamps
// over a wide intake, a smooth bubble greenhouse whose back glass wraps round into the
// side windows, a sculpted intake behind each door, wide hips, one slim tail lamp band
// right across the back, a tall wing on two struts and a round pipe at each corner. Our
// own drawing; the name and the bolt badge are invented.

type V3 = [number, number, number]

// A sheet through a grid of world points (rows of the same count), each triangle turned
// so it faces out toward dir, shaded smooth.
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

// A flat fan from a centre point round a ring of world points, turned to face dir.
function fan(c: V3, ring: V3[], dir: V3) {
  const pos: number[] = []
  for (let i = 0; i + 1 < ring.length; i++) {
    const [a, b] = [ring[i], ring[i + 1]]
    const ux = a[0] - c[0], uy = a[1] - c[1], uz = a[2] - c[2]
    const vx = b[0] - c[0], vy = b[1] - c[1], vz = b[2] - c[2]
    const d = (uy * vz - uz * vy) * dir[0] + (uz * vx - ux * vz) * dir[1] + (ux * vy - uy * vx) * dir[2]
    pos.push(...c, ...(d < 0 ? [...b, ...a] : [...a, ...b]))
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
  g.computeVertexNormals()
  return g
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

export const HAYATE = { len: 1.32, wid: 0.76, wheel: 0.15 }
const SIDES = [-1, 1] as const
// The bolt badge, 0.014 tall.
const BOLT: [number, number][] = [[-0.004, 0.007], [0.006, 0.007], [0.001, 0.001], [0.006, 0.001], [-0.004, -0.007], [-0.0005, -0.001], [-0.006, -0.001]]

// The black wheel well behind each tyre stands square to the car just clear of the widest
// point of the fender round it.
const wellX = (S: Surface, zz: number, R: number) => {
  let x = 0
  for (let i = -10; i <= 10; i++) x = Math.max(x, S.side(zz + (i / 10) * R))
  return x + 0.003
}

export function popupGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = HAYATE.wheel
  const wz = HAYATE.len * 0.33
  const fz = HAYATE.len / 2
  const tz = -fz

  // Body: soft sections. z, half width, bottom, shoulder, fender top, crease x, middle
  // height. A low wedge nose and a low hood sunk between two rounded front fenders that
  // rise over the wheels, the doors drawn in a little and broad hips swelling out over
  // the rear wheels to a high, square tail.
  const body = new Loft([
    bodyRing(fz, 0.3, 0.095, 0.142, 0.166, 0.2, 0.16, true),
    bodyRing(0.642, 0.333, 0.086, 0.178, 0.21, 0.22, 0.172, true),
    bodyRing(0.6, 0.355, 0.08, 0.232, 0.266, 0.225, 0.184, true),
    bodyRing(0.52, 0.368, 0.078, 0.288, 0.314, 0.23, 0.198, true),
    bodyRing(0.43, 0.372, 0.078, 0.31, 0.334, 0.235, 0.21, true),
    bodyRing(0.32, 0.37, 0.078, 0.282, 0.31, 0.24, 0.222, true),
    bodyRing(0.2, 0.362, 0.078, 0.256, 0.284, 0.25, 0.236, true),
    bodyRing(0.06, 0.356, 0.078, 0.244, 0.27, 0.27, 0.256, true),
    bodyRing(-0.12, 0.36, 0.078, 0.25, 0.278, 0.29, 0.27, true),
    bodyRing(-0.28, 0.376, 0.078, 0.27, 0.3, 0.29, 0.284, true),
    bodyRing(-0.43, 0.383, 0.08, 0.304, 0.326, 0.28, 0.294, true),
    bodyRing(-0.55, 0.377, 0.086, 0.284, 0.312, 0.27, 0.3, true),
    bodyRing(-0.625, 0.362, 0.096, 0.27, 0.302, 0.26, 0.301, true),
    bodyRing(tz, 0.342, 0.11, 0.264, 0.296, 0.25, 0.297, true),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)

  // Greenhouse: a bubble. A raked windshield, a short rounded roof, and back glass that
  // runs down to the deck and wraps round into the side windows.
  const glass = new Loft([
    glassRing(0.17, 0.316, 0.262, 0.29, 0.28, true),
    glassRing(0.09, 0.322, 0.266, 0.284, 0.348, true),
    glassRing(0.01, 0.326, 0.27, 0.276, 0.402, true),
    glassRing(-0.08, 0.328, 0.274, 0.27, 0.43, true),
    glassRing(-0.18, 0.33, 0.278, 0.266, 0.438, true),
    glassRing(-0.28, 0.33, 0.282, 0.262, 0.428, true),
    glassRing(-0.37, 0.322, 0.287, 0.252, 0.4, true),
    glassRing(-0.45, 0.304, 0.292, 0.234, 0.362, true),
    glassRing(-0.52, 0.272, 0.296, 0.2, 0.322, true),
    glassRing(-0.555, 0.22, 0.299, 0.15, 0.304, true),
  ], 5)
  k.add('glass', glass.geometry({ capFront: true, capBack: true }))
  const G = new Surface(k, glass, 3, 1)
  greenhouse(k, h, glass, { roof: [0.01, -0.27], pillar: [0.17, 0.01], belt: [0.16, -0.5], mirror: [0.12, 0.28, 0.29] })
  const roofY = (z: number) => glass.near(z).pts[4][1] + 0.009
  // A slim black B pillar raked back behind the door glass; behind it the glass runs
  // unbroken round the back.
  for (const sd of SIDES) {
    const at = (z: number, t: number): V3 => {
      const p = glass.near(z).pts
      const x = p[1][0] + (p[2][0] - p[1][0]) * t
      const y = p[1][1] + (p[2][1] - p[1][1]) * t
      return [sd * (x + 0.004), y, z]
    }
    const grid: V3[][] = []
    for (let i = 0; i <= 3; i++) {
      const t = i / 3
      const z = -0.1 - 0.06 * t
      grid.push([at(z, t), at(z - 0.022, t)])
    }
    k.add('black', sheet(grid, [sd, 0, 0]))
  }

  // Cabin: two buckets with a small bench behind, dash, wheel and console.
  interior(k, h, -0.1, 0.1)

  // Wheel arches: a black well and a dark lip round each tyre. The well is cut off just
  // over the shoulder, so where the arch runs up into the fender it never stands in the air
  // above the body; the lip follows the arch only below that.
  const R = 0.172
  const cy = r - 0.004
  for (const zz of [wz, -wz]) {
    const x = wellX(S, zz, R)
    const arc: V3[] = []
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI
      const z = zz + Math.cos(a) * R
      const cap = body.near(z).pts[3][1] + 0.004
      arc.push([x, Math.min(cy + Math.sin(a) * R, cap), z])
    }
    for (const sd of SIDES) {
      const m = (v: V3): V3 => [sd * v[0], v[1], v[2]]
      k.add('black', fan(m([x, cy, zz]), arc.map(m), [sd, 0, 0]))
      // The lip: a flat dark band round the arch's edge, left out where the arch is cut off.
      const rim = (i: number, d: number): V3 => {
        const t = (i / 20) * Math.PI
        return m([x + 0.0035, cy + Math.sin(t) * (R + d), zz + Math.cos(t) * (R + d)])
      }
      const quads: V3[][] = []
      for (let i = 0; i < 20; i++) {
        const top = Math.max(rim(i, 0.004)[1], rim(i + 1, 0.004)[1])
        if (top < body.near(zz + Math.cos(((i + 0.5) / 20) * Math.PI) * R).pts[3][1]) quads.push([rim(i, -0.008), rim(i + 1, -0.008), rim(i + 1, 0.004), rim(i, 0.004)])
      }
      for (const q of quads) k.add('dark', fan(q[0], q.slice(1), [sd, 0, 0]))
    }
  }

  // Sides: door cuts and a flush handle, the sculpted intake between door and rear wheel
  // (a black scoop under a body-colour lip, with three dark slats), a black sill, and
  // amber and red markers at the ends.
  for (const sd of SIDES) {
    S.wall('dark', plane(0.004, 0.15), sd, 0.2, 0.17, 0.003, 0.06)
    S.wall('dark', plane(0.004, 0.15), sd, -0.095, 0.18, 0.003, -0.08)
    S.wall('black', rbox(0.045, 0.01, 0.008, 0.003), sd, -0.05, 0.228, 0.003)
    S.wall('black', poly([[-0.07, 0.024], [0.055, 0.026], [0.05, -0.026], [-0.005, -0.024]]), sd, -0.18, 0.2, 0.003)
    for (const dy of [-0.012, 0, 0.012]) S.wall('dark', box(0.05 - dy * 1.5, 0.004, 0.004), sd, -0.17, 0.2 + dy, 0.006)
    S.wall('paint', rbox(0.135, 0.01, 0.014, 0.004), sd, -0.182, 0.229, 0.004)
    S.wall('amber', plane(0.035, 0.01), sd, 0.6, 0.15, 0.003)
    S.wall('tail', plane(0.035, 0.01), sd, -0.62, 0.24, 0.003)
    if (!fit.kit) k.add('black', rbox(0.03, 0.026, 0.42, 0.008), [sd * (S.side(0) + 0.002), 0.085, 0.01])
  }
  // Fuel flap on the right hip.
  S.wall('dark', new CircleGeometry(0.016, 12), 1, -0.275, 0.262, 0.003)

  // Pop-up headlamps, folded shut: a lid on top of each front fender, drawn by its shut
  // lines.
  for (const sd of SIDES) {
    const q = (pts: [number, number][]) => pts.map(([x, z]): [number, number] => [x * sd, z])
    const c = q([[0.2, 0.61], [0.296, 0.6], [0.304, 0.49], [0.208, 0.494]])
    for (let i = 0; i < 4; i++) {
      const [ax, az] = c[i]
      const [bx, bz] = c[(i + 1) % 4]
      const l = Math.hypot(bx - ax, bz - az)
      // The front seam is wider: the slot the lamp swings up out of.
      const w = i === 0 ? 0.004 : 0.0018
      const nx = (-(bz - az) / l) * w, nz = ((bx - ax) / l) * w
      k.add('black', decal(S, [[ax - nx, az - nz], [bx - nx, bz - nz], [bx + nx, bz + nz], [ax + nx, az + nz]], 0.003, i % 2 ? 6 : 3))
    }
  }

  // Nose: a slim clear lamp with an amber end tucked in each corner of the nose, the bolt
  // badge between them, a wide intake low across it with mesh behind and a black lip.
  const ny = fz + 0.002
  for (const sd of SIDES) {
    k.add('black', poly([[0.13, 0.142], [0.28, 0.145], [0.29, 0.158], [0.135, 0.157]].map(([x, y]) => [x * sd, y])), [0, 0, ny], [0, 0, 0])
    k.add('lamp', poly([[0.14, 0.145], [0.24, 0.147], [0.24, 0.155], [0.143, 0.154]].map(([x, y]) => [x * sd, y])), [0, 0, ny + 0.0025])
    k.add('amber', poly([[0.245, 0.147], [0.282, 0.148], [0.287, 0.156], [0.245, 0.155]].map(([x, y]) => [x * sd, y])), [0, 0, ny + 0.0025])
  }
  k.add('black', poly([[-0.24, 0.103], [0.24, 0.103], [0.258, 0.132], [-0.258, 0.132]]), [0, 0, ny])
  honey(k, 0, 0.1175, ny + 0.0005, 0.44, 0.022, 0.0065, 1)
  k.add('chrome', poly(BOLT.map(([x, y]) => [x, y + 0.146])), [0, 0, ny + 0.0025])
  if (!fit.kit) {
    k.add('black', box(0.56, 0.008, 0.04), [0, 0.088, fz - 0.012])
  }

  // Two slatted heat vents in the hood, one over each turbo.
  if (!fit.hood) for (const sd of SIDES) vent(S, sd * 0.135, 0.36, 0.06, 0.1, 4, sd * 0.06)

  // Cowl: a black strip across the foot of the windshield, and a wiper.
  S.top('black', box(0.5, 0.02, 0.004), 0, 0.182, 0.004)
  h.bar(k, 'black', [-0.22, 0.272, 0.175], [0.03, 0.279, 0.16], 0.007)

  // Tail: one slim lamp band right across, a dark garnish over it, a plate, reversing lamps
  // in a black valance, a pipe at each corner and a black diffuser.
  const by = tz - 0.002
  const back = (part: Parameters<Kit['add']>[0], pts: [number, number][], z: number) => k.add(part, poly(pts.map(([x, y]) => [-x, y])), [0, 0, z], [0, Math.PI, 0])
  back('black', [[-0.322, 0.246], [0.322, 0.246], [0.316, 0.276], [-0.316, 0.276]], by)
  back('tail', [[-0.31, 0.25], [0.31, 0.25], [0.305, 0.27], [-0.305, 0.27]], tz - 0.0045)
  // Each end is a brighter lamp; the middle a darker red lens with the badge.
  for (const sd of SIDES) k.add('tail', box(0.09, 0.004, 0.003), [sd * 0.25, 0.26, tz - 0.0075])
  back('dark', [[-0.04, 0.254], [0.04, 0.254], [0.04, 0.266], [-0.04, 0.266]], tz - 0.0065)
  back('chrome', BOLT.map(([x, y]) => [x, y + 0.26]), tz - 0.0085)
  back('black', [[-0.062, 0.173], [0.062, 0.173], [0.062, 0.227], [-0.062, 0.227]], by)
  back('lamp', [[-0.055, 0.1775], [0.055, 0.1775], [0.055, 0.2225], [-0.055, 0.2225]], tz - 0.0045)
  back('black', [[-0.32, 0.112], [0.32, 0.112], [0.326, 0.155], [-0.326, 0.155]], by)
  for (const sd of SIDES) back('lamp', [[-0.022, -0.006], [0.022, -0.006], [0.022, 0.006], [-0.022, 0.006]].map(([x, y]) => [x + sd * 0.09, y + 0.142]), tz - 0.0045)
  if (!fit.exhaust) for (const sd of SIDES) {
    k.add('chrome', new CylinderGeometry(0.026, 0.026, 0.05, 16), [sd * 0.235, 0.133, tz - 0.004], [Math.PI / 2, 0, 0])
    k.add('black', disc(0.02, 16), [sd * 0.235, 0.133, tz - 0.0295], [0, Math.PI, 0])
  }
  if (!fit.kit) {
    k.add('black', box(0.36, 0.008, 0.08), [0, 0.104, tz + 0.03])
    for (const x of [-0.09, 0, 0.09]) k.add('black', box(0.008, 0.03, 0.07), [x, 0.093, tz + 0.03])
  }

  // Wing: a tall body-colour blade up on two swept struts from the deck, with black end
  // plates and a dark lip along its trailing edge.
  if (!fit.spoiler) {
    const wy = 0.4
    const wzc = -0.605
    const deck = (x: number) => S.y(x, wzc)
    for (const sd of SIDES) {
      const x = sd * 0.2
      const yb = deck(0.2) - 0.006
      k.add('paint', slab([[wzc + 0.04, yb], [wzc - 0.02, yb], [wzc - 0.035, wy - 0.008], [wzc + 0.005, wy - 0.008]], 0.014), [x, 0, 0], [0, -Math.PI / 2, 0])
    }
    const foil: [number, number][] = [[0.05, 0.0], [0.035, 0.008], [0.0, 0.012], [-0.05, 0.008], [-0.055, 0.004], [-0.05, 0.0], [0.0, -0.002]]
    k.add('paint', slab(foil.map(([z, y]) => [wzc - 0.015 + z, wy + y]), 0.66), [0, 0, 0], [0, -Math.PI / 2, 0])
    k.add('dark', box(0.656, 0.008, 0.006), [0, wy + 0.012, wzc - 0.066])
    for (const sd of SIDES) k.add('black', slab([[wzc + 0.04, wy - 0.012], [wzc - 0.065, wy - 0.02], [wzc - 0.075, wy + 0.026], [wzc + 0.028, wy + 0.016]], 0.008), [sd * 0.334, 0, 0], [0, -Math.PI / 2, 0])
  }

  // Third brake light at the top of the back glass.
  G.top('tail', box(0.1, 0.01, 0.004), 0, -0.3, 0.004)

  // A wide stripe down the middle, over the nose, the hood, the roof and the deck.
  const sw = 0.1
  const strip = (z0: number, z1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = z0 + ((z1 - z0) * i) / n, b = z0 + ((z1 - z0) * (i + 1)) / n
      k.add('stripe', decal(S, [[-sw / 2, a], [sw / 2, a], [sw / 2, b], [-sw / 2, b]], 0.003, 3))
    }
  }
  if (!fit.hood) strip(0.655, 0.195, 6)
  for (let z = 0.0; z > -0.27; z -= 0.045) k.add('stripe', box(sw, 0.004, 0.046), [0, roofY(z) + 0.002, z])
  strip(-0.565, -0.655, 1)

  h.brakes(k, (z) => wellX(S, z, R) - 0.025, wz, r, 0.14)
}
