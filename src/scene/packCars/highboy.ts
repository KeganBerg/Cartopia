import { CatmullRomCurve3, CylinderGeometry, Euler, Quaternion, LatheGeometry, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3, type BufferGeometry } from 'three'
import type { Kit, Part } from '../CarModel'
import { Loft, type Pt, type Section } from '../loft'
import { Surface, bodyRing, box, disc, frame, plane, poly, rbox, slab, type ExoticFit, type ExoticHelpers } from '../exoticCars'

// Liberty Firebolt Highboy: an invented 1932-style highboy hot rod. A narrow, tall
// roadster tub sitting high on exposed frame rails, no fenders anywhere, a tall chrome
// grille shell with round headlamps on stalks, a skinny hood top with a chromed
// blower and twin scoops punched up through it, the V8 open to the world at the sides
// with lakes headers sweeping into side pipes, a dropped I-beam axle on a transverse
// spring with chrome hairpins, a chopped windscreen, a tuck-and-roll bench and a
// turtle deck with small round taillights on stalks. Every shape is our own drawing;
// no real badge or logo.

export const FIREBOLT = { len: 1.36, wid: 0.78, wheel: 0.16 }
const SIDES = [-1, 1] as const
type V3 = [number, number, number]

// A straight member from a to b: a box t by d across (a frame rail, a leaf), or a round
// rod of radius t (a shock, a stand). Plain geometry: cheaper than rounded bars.
function along(a: V3, b: V3) {
  const v = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), v.clone().normalize()))
  return { len: v.length(), p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] as V3, r: [e.x, e.y, e.z] as V3 }
}
function beam(k: Kit, part: Part, a: V3, b: V3, t: number, d = t) {
  const o = along(a, b)
  k.add(part, box(t, o.len, d), o.p, o.r)
}
function rod(k: Kit, part: Part, a: V3, b: V3, t: number, seg = 8) {
  const o = along(a, b)
  k.add(part, new CylinderGeometry(t, t, o.len, seg), o.p, o.r)
}

// A bent pipe through the given points.
function tube(k: Kit, part: Part, pts: V3[], r: number, seg = 16, rad = 8) {
  k.add(part, new TubeGeometry(new CatmullRomCurve3(pts.map((p) => new Vector3(...p))), seg, r, rad, false))
}

// A lamp bucket: a bullet-shaped shell r across, depth d deep, opening toward +y.
function bucket(r: number, d: number) {
  const prof = [[0.001, -d], [r * 0.45, -d * 0.95], [r * 0.8, -d * 0.7], [r * 0.97, -d * 0.35], [r, -d * 0.1], [r, 0]].map(([x, y]) => new Vector2(x, y))
  return new LatheGeometry(prof, 18)
}

// A round lamp in a chrome bucket, facing forward (dir 1) or back (dir -1).
function lampPod(k: Kit, x: number, y: number, z: number, r: number, dir: 1 | -1, part: Part) {
  const g = bucket(r, r * 1.1)
  g.rotateX((dir * Math.PI) / 2)
  k.add('chrome', g, [x, y, z])
  const ry = dir < 0 ? Math.PI : 0
  k.add(part, disc(r * 0.86, 18), [x, y, z + dir * 0.002], [0, ry, 0])
  k.add('chrome', new TorusGeometry(r * 0.48, r * 0.06, 3, 16), [x, y, z + dir * 0.004])
  k.add('black', disc(r * 0.2, 10), [x, y, z + dir * 0.0045], [0, ry, 0])
  k.add('chrome', new TorusGeometry(r * 0.94, r * 0.11, 4, 18), [x, y, z + dir * 0.001])
}

// The half outline of a '32-style grille shell (x >= 0 is mirrored), y from its bottom
// point up to its crown, inset by `i`.
function shellOutline(i: number): [number, number][] {
  const half: [number, number][] = []
  const bw = 0.122 - i
  const tw = 0.142 - i
  const top = 0.25 - i
  const bot = i * 0.8
  const rc = 0.04 - i * 0.5
  // From the bottom point out to the side, up the side, round the top corner, across.
  half.push([0, bot - 0.014])
  half.push([bw * 0.55, bot - 0.004])
  half.push([bw * 0.9, bot + 0.004])
  half.push([bw, bot + 0.022])
  half.push([tw, top - rc])
  for (let s = 1; s <= 5; s++) {
    const a = (s / 5) * (Math.PI / 2)
    half.push([tw - rc + Math.cos(a) * rc, top - rc + Math.sin(a) * rc])
  }
  half.push([0, top + 0.004])
  const out: [number, number][] = half.slice(1, -1)
  const left = half.slice(1, -1).reverse().map(([x, y]): [number, number] => [-x, y])
  return [half[0], ...out, half[half.length - 1], ...left]
}

// Where a vertical line at x crosses a closed outline: its lowest and highest y.
function spanAt(pts: [number, number][], x: number): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % pts.length]
    if ((x - x0) * (x - x1) > 0 || x0 === x1) continue
    const y = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    lo = Math.min(lo, y)
    hi = Math.max(hi, y)
  }
  return [lo, hi]
}

export function highboyGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  const r = FIREBOLT.wheel
  const wz = FIREBOLT.len * 0.33
  const wx = FIREBOLT.wid / 2 - 0.02

  // ---- The tub: firewall and cowl, an open two-seat cockpit, then the turtle deck.
  // z, half width, bottom, shoulder, wall top, crease x, middle height
  const body = new Loft([
    bodyRing(0.16, 0.25, 0.175, 0.352, 0.384, 0.15, 0.394, true),
    bodyRing(0.1, 0.262, 0.175, 0.356, 0.388, 0.16, 0.398, true),
    bodyRing(0.045, 0.27, 0.175, 0.356, 0.388, 0.2, 0.37, true),
    bodyRing(-0.01, 0.276, 0.175, 0.354, 0.386, 0.215, 0.25, true),
    bodyRing(-0.14, 0.279, 0.175, 0.352, 0.384, 0.215, 0.248, true),
    bodyRing(-0.27, 0.279, 0.178, 0.35, 0.382, 0.215, 0.25, true),
    bodyRing(-0.325, 0.277, 0.182, 0.348, 0.38, 0.2, 0.335, true),
    bodyRing(-0.38, 0.274, 0.19, 0.342, 0.374, 0.17, 0.372, true),
    bodyRing(-0.48, 0.268, 0.2, 0.33, 0.362, 0.16, 0.366, true),
    bodyRing(-0.575, 0.258, 0.205, 0.3, 0.332, 0.15, 0.338, true),
    bodyRing(-0.635, 0.242, 0.21, 0.272, 0.302, 0.14, 0.305, true),
    bodyRing(-0.665, 0.226, 0.215, 0.252, 0.282, 0.13, 0.285, true),
  ], 5)
  k.add('paint', body.geometry({ capFront: true, capBack: true }))
  const S = new Surface(k, body, 5, 3)

  // ---- Frame: boxed rails pinched in at the front horns, kicking up over the rear axle.
  for (const sd of SIDES) {
    const rail: V3[] = [[sd * 0.17, 0.145, 0.645], [sd * 0.17, 0.145, 0.52], [sd * 0.235, 0.145, 0.2], [sd * 0.235, 0.145, -0.28], [sd * 0.235, 0.205, -0.42], [sd * 0.235, 0.205, -0.6]]
    for (let i = 1; i < rail.length; i++) beam(k, 'black', rail[i - 1], rail[i], 0.03, 0.05)
    k.add('chrome', disc(0.016, 12), [sd * 0.17, 0.145, 0.6705])
  }
  // Front crossmember under the radiator, and a chrome spreader bar between the horns.
  k.add('black', box(0.32, 0.03, 0.04), [0, 0.15, 0.585])
  rod(k, 'chrome', [-0.17, 0.118, 0.655], [0.17, 0.118, 0.655], 0.006)
  // Crossmember under the cab and a steering box on the left rail.
  k.add('black', box(0.44, 0.025, 0.04), [0, 0.135, 0.0])

  // ---- Front suspension: a chrome dropped I-beam axle, a transverse leaf spring over it,
  // hairpin radius rods back to the frame, tube shocks, the tie rod and drag link.
  const ay = r
  const axle: V3[] = [[-0.31, ay + 0.012, wz], [-0.26, ay + 0.004, wz], [-0.2, ay - 0.04, wz], [0, ay - 0.05, wz], [0.2, ay - 0.04, wz], [0.26, ay + 0.004, wz], [0.31, ay + 0.012, wz]]
  for (let i = 1; i < axle.length; i++) beam(k, 'chrome', axle[i - 1], axle[i], 0.022, 0.03)
  for (const sd of SIDES) {
    // Kingpin boss and spindle out to the hub.
    k.add('chrome', new CylinderGeometry(0.016, 0.016, 0.06, 12), [sd * 0.315, ay + 0.012, wz])
    k.add('black', new CylinderGeometry(0.012, 0.012, 0.06, 10), [sd * 0.33, ay, wz], [0, 0, Math.PI / 2])
    // Hairpins: two rods from the axle end that meet at the frame.
    tube(k, 'chrome', [[sd * 0.255, ay + 0.02, wz], [sd * 0.23, ay + 0.004, wz - 0.1], [sd * 0.205, ay - 0.01, 0.25]], 0.007, 10, 6)
    tube(k, 'chrome', [[sd * 0.255, ay - 0.02, wz], [sd * 0.23, ay - 0.022, wz - 0.1], [sd * 0.205, ay - 0.016, 0.25]], 0.007, 10, 6)
    k.add('chrome', new SphereGeometry(0.011, 8, 6), [sd * 0.205, ay - 0.013, 0.25])
    // Tube shock from the axle up to the frame horn.
    rod(k, 'chrome', [sd * 0.24, ay - 0.005, wz + 0.02], [sd * 0.19, 0.205, wz + 0.07], 0.008)
    rod(k, 'black', [sd * 0.233, ay + 0.02, wz + 0.025], [sd * 0.212, 0.11 + 0.06, wz + 0.045], 0.011)
  }
  // Transverse spring: a stack of leaves bowed up to the crossmember.
  for (let leaf = 0; leaf < 3; leaf++) {
    const span = 0.22 - leaf * 0.05
    const y0 = ay - 0.04 + 0.016 + leaf * 0.011
    const pts: V3[] = []
    for (let i = 0; i <= 6; i++) {
      const x = -span + (2 * span * i) / 6
      pts.push([x, y0 + 0.035 * (1 - (x / 0.22) ** 2), wz])
    }
    for (let i = 1; i < pts.length; i++) beam(k, 'black', pts[i - 1], pts[i], 0.009, 0.036)
  }
  rod(k, 'chrome', [0.3, ay - 0.012, wz - 0.03], [-0.3, ay - 0.012, wz - 0.03], 0.005)
  tube(k, 'chrome', [[0.3, ay + 0.03, wz - 0.02], [0.27, ay + 0.04, wz - 0.12], [0.24, ay + 0.045, 0.22]], 0.006, 8, 6)

  // ---- Grille shell: tall, raked a touch, with a split chrome insert and a cap on top.
  const gz = 0.6
  const gy = 0.158
  const rake = -0.08
  const at = (part: Part, geo: BufferGeometry, x: number, y: number, z: number) =>
    k.add(part, geo, [x, gy + y * Math.cos(rake) - z * Math.sin(rake), gz + y * Math.sin(rake) + z * Math.cos(rake)], [rake, 0, 0])
  const outer = shellOutline(0)
  const inner = shellOutline(0.016)
  at('chrome', frame(outer, inner, 0.034), 0, 0, 0)
  at('black', poly(inner), 0, 0, -0.012)
  // Insert: thin chrome bars either side of a heavier centre bar.
  for (let i = -8; i <= 8; i++) {
    const x = i * 0.0135
    const [lo, hi] = spanAt(inner, x)
    if (!isFinite(lo) || hi - lo < 0.02) continue
    at(i === 0 ? 'chrome' : 'dark', box(i === 0 ? 0.009 : 0.004, hi - lo, 0.008), x, (lo + hi) / 2, i === 0 ? 0.003 : -0.004)
  }
  // Radiator behind the insert, a cap on the crown, and a hose to the engine.
  at('black', box(0.23, 0.2, 0.04), 0, 0.115, -0.04)
  at('chrome', new CylinderGeometry(0.014, 0.017, 0.016, 14), 0, 0.262, -0.002)
  at('chrome', new SphereGeometry(0.008, 10, 6), 0, 0.272, -0.002)

  // ---- Headlamps on chrome stands off the frame horns, small amber lamps under them.
  for (const sd of SIDES) {
    const lx = sd * 0.218
    const ly = 0.335
    const lz = 0.6
    lampPod(k, lx, ly, lz, 0.042, 1, 'lamp')
    rod(k, 'chrome', [sd * 0.17, 0.165, 0.62], [lx * 0.98, ly - 0.03, lz - 0.025], 0.007)
    k.add('chrome', new SphereGeometry(0.012, 10, 6), [lx * 0.98, ly - 0.03, lz - 0.025])
    lampPod(k, sd * 0.195, 0.22, 0.618, 0.015, 1, 'amber')
  }

  // ---- The engine: a blown V8 in the open between the rails.
  const ez = 0.33
  k.add('chrome', rbox(0.15, 0.05, 0.22, 0.015), [0, 0.15, ez - 0.02])
  k.add('dark', rbox(0.17, 0.09, 0.28, 0.02), [0, 0.215, ez])
  // Heads and chromed valve covers on each bank, finned on top, with breathers.
  for (const sd of SIDES) {
    k.add('dark', rbox(0.06, 0.07, 0.27, 0.012), [sd * 0.072, 0.268, ez], [0, 0, -sd * 0.62])
    k.add('chrome', box(0.052, 0.024, 0.26), [sd * 0.096, 0.297, ez], [0, 0, -sd * 0.62])
    for (let i = 0; i < 4; i++) k.add('chrome', box(0.04, 0.008, 0.006), [sd * 0.1, 0.306, ez - 0.08 + i * 0.045], [0, 0, -sd * 0.62])
    k.add('chrome', new CylinderGeometry(0.012, 0.012, 0.03, 12), [sd * 0.108, 0.318, ez + 0.1], [0, 0, -sd * 0.62])
    k.add('black', disc(0.009, 10), [sd * 0.117, 0.331, ez + 0.1], [-Math.PI / 2, 0, -sd * 0.62])
  }
  // Intake in the valley, a front timing cover, the crank pulley and the blower drive.
  k.add('chrome', box(0.08, 0.03, 0.24), [0, 0.305, ez])
  k.add('dark', rbox(0.12, 0.08, 0.03, 0.012), [0, 0.22, ez + 0.156])
  k.add('chrome', new CylinderGeometry(0.035, 0.035, 0.022, 18), [0, 0.205, ez + 0.172], [Math.PI / 2, 0, 0])
  // Fan and water pump.
  k.add('chrome', new CylinderGeometry(0.02, 0.02, 0.03, 12), [0, 0.26, ez + 0.175], [Math.PI / 2, 0, 0])
  for (let i = 0; i < 4; i++) k.add('black', box(0.012, 0.075, 0.004), [0, 0.26, ez + 0.195], [0, 0, (i * Math.PI) / 4])

  const hoodY = (z: number) => 0.396 - (0.57 - z) * 0.008
  const hood = new Loft([0.57, 0.5, 0.36, 0.22, 0.165].map((z): Section => {
    const W = 0.15 + (0.57 - z) * 0.06
    const yt = hoodY(z)
    const yb = yt - 0.009
    const pts: Pt[] = [[0, yb], [W - 0.012, yb, true], [W, yb + 0.003, true], [W, yt - 0.004], [W - 0.01, yt - 0.001], [W * 0.5, yt], [0, yt + 0.0015]]
    return { z, pts }
  }), 4)
  k.add('paint', hood.geometry({ capFront: true, capBack: true }))
  const H = new Surface(k, hood, 4, 3)

  if (!fit.hood) {
    // The blower: a ribbed chrome case punched up through the hood with a snout and belt
    // drive at the front, and two scoops on top, each with a black mouth and a mesh.
    const by = 0.395
    k.add('chrome', rbox(0.115, 0.09, 0.25, 0.018), [0, by, ez + 0.005])
    for (const sd of SIDES) for (const dy of [-0.03, -0.016, 0.02, 0.033]) k.add('chrome', box(0.006, 0.006, 0.23), [sd * 0.059, by + dy, ez + 0.005])
    k.add('black', rbox(0.12, 0.01, 0.255, 0.004), [0, by - 0.05, ez + 0.005])
    k.add('chrome', new CylinderGeometry(0.03, 0.03, 0.024, 18), [0, by - 0.005, ez + 0.172], [Math.PI / 2, 0, 0])
    k.add('chrome', new CylinderGeometry(0.018, 0.018, 0.04, 12), [0, by - 0.005, ez + 0.145], [Math.PI / 2, 0, 0])
    // The belt: a black band round both pulleys.
    const belt: [number, number][] = []
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI
      belt.push([Math.cos(a) * 0.04, 0.205 + Math.sin(a) * 0.04])
    }
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI
      belt.push([Math.cos(a) * 0.035, by - 0.005 + Math.sin(a) * 0.035])
    }
    k.add('black', slab(belt, 0.016), [0, 0, ez + 0.172])
    // Two carb bases and two scoops on the top of the case.
    for (const dz of [0.06, -0.065]) {
      const sz = ez + dz
      k.add('black', rbox(0.08, 0.016, 0.08, 0.004), [0, by + 0.052, sz])
      const sc: [number, number][] = [[-0.045, 0], [0.04, 0], [0.05, 0.075], [0.035, 0.08], [-0.045, 0.045]]
      k.add('chrome', slab(sc, 0.085), [0, by + 0.059, sz], [0, -Math.PI / 2, 0])
      // The mouth: a black opening inset in the front face, with mesh bars across it.
      const face = Math.atan2(0.01, 0.075)
      const mz = sz + 0.045 + 0.003
      const my = by + 0.059 + 0.04
      k.add('black', plane(0.07, 0.06), [0, my, mz + 0.0045], [-face, 0, 0])
      for (const dx of [-0.02, 0, 0.02]) k.add('chrome', box(0.004, 0.058, 0.004), [dx, my, mz + 0.0085], [-face, 0, 0])
      k.add('chrome', box(0.068, 0.004, 0.004), [0, my, mz + 0.0085], [-face, 0, 0])
    }
  }

  // ---- Lakes headers: four chrome primaries out of each bank, sweeping down and back into a
  // collector that runs along the side as a side pipe (just a stub when an exhaust is fitted).
  for (const sd of SIDES) {
    const cz = 0.15
    const cx = sd * 0.272
    const cy = 0.2
    for (let i = 0; i < 4; i++) {
      const pz = ez - 0.1 + i * 0.062
      tube(k, 'chrome', [[sd * 0.1, 0.262, pz], [sd * 0.17, 0.27, pz], [sd * 0.215, 0.245, pz - 0.035], [sd * 0.24, 0.215, Math.max(cz + 0.05, pz - 0.1)], [cx, cy + 0.004, cz + 0.02]], 0.011, 18, 7)
    }
    if (!fit.exhaust) {
      tube(k, 'chrome', [[cx, cy + 0.004, cz + 0.04], [cx + sd * 0.015, cy, cz - 0.04], [sd * 0.305, cy - 0.005, cz - 0.12], [sd * 0.31, cy - 0.006, -0.24]], 0.02, 20, 10)
      k.add('black', disc(0.016, 12), [sd * 0.31, cy - 0.006, -0.2405], [0, Math.PI, 0])
      k.add('chrome', new TorusGeometry(0.019, 0.004, 4, 12), [sd * 0.31, cy - 0.006, -0.239])
      // Brackets holding the side pipe to the body.
      for (const z of [-0.04, -0.18]) rod(k, 'black', [sd * 0.27, cy - 0.006, z], [sd * 0.31, cy - 0.006, z], 0.004)
    } else {
      tube(k, 'chrome', [[cx, cy + 0.004, cz + 0.04], [cx + sd * 0.006, cy, cz - 0.02]], 0.018, 4, 10)
      k.add('black', disc(0.014, 12), [cx + sd * 0.006, cy, cz - 0.0205], [0, Math.PI, 0])
    }
  }

  // ---- Windscreen: a chopped, near-upright screen in a chrome frame on the cowl, with
  // a mirror on top.
  const wsZ = 0.088
  const wsTilt = -0.18
  const wsW = 0.232
  const wsH = 0.122
  const wsY = 0.37
  const rr = 0.03
  const rect = (w: number, top: number, bot: number, rc: number): [number, number][] => {
    const pts: [number, number][] = [[-w, bot], [w, bot]]
    for (let s = 0; s <= 4; s++) {
      const a = (s / 4) * (Math.PI / 2)
      pts.push([w - rc + Math.sin(a) * rc, top - rc + Math.cos(a) * rc])
    }
    for (let s = 0; s <= 4; s++) {
      const a = (s / 4) * (Math.PI / 2)
      pts.push([-w + rc - Math.cos(a) * rc, top - rc + Math.sin(a) * rc])
    }
    return pts
  }
  const wpos = (y: number, dz = 0): V3 => [0, wsY + y * Math.cos(wsTilt) - dz * Math.sin(wsTilt), wsZ + y * Math.sin(wsTilt) + dz * Math.cos(wsTilt)]
  k.add('chrome', frame(rect(wsW, wsH, 0, rr), rect(wsW - 0.012, wsH - 0.012, 0.016, rr - 0.008), 0.012), wpos(0), [wsTilt, 0, 0])
  k.add('glass', box(wsW * 2 - 0.02, wsH - 0.024, 0.003), wpos(0.016 + (wsH - 0.028) / 2), [wsTilt, 0, 0])
  // The posts down to the cowl sides.
  for (const sd of SIDES) rod(k, 'chrome', [sd * (wsW - 0.006), 0.35, wsZ + 0.01], [sd * (wsW - 0.006), wsY + 0.02, wsZ - 0.002], 0.006)
  k.add('chrome', box(0.012, 0.02, 0.008), wpos(wsH + 0.006, -0.006), [wsTilt, 0, 0])
  k.add('chrome', rbox(0.07, 0.024, 0.01, 0.008), wpos(wsH + 0.022, -0.014), [wsTilt, 0, 0])
  k.add('glass', plane(0.06, 0.016), wpos(wsH + 0.022, -0.0215), [wsTilt, Math.PI, 0])

  // ---- Cockpit: a tuck-and-roll bench, a painted dash with an engine-turned gauge panel,
  // a banjo-style wheel and a chrome shifter.
  k.add('black', box(0.4, 0.004, 0.28), [0, 0.252, -0.135])
  const seatZ = -0.2
  k.add('seat', rbox(0.4, 0.04, 0.14, 0.015), [0, 0.272, seatZ])
  for (let i = -4; i <= 4; i++) k.add('seat', new CylinderGeometry(0.011, 0.011, 0.12, 8), [i * 0.041, 0.292, seatZ], [Math.PI / 2, 0, 0])
  k.add('seat', rbox(0.4, 0.11, 0.035, 0.014), [0, 0.335, seatZ - 0.075], [-0.22, 0, 0])
  for (let i = -4; i <= 4; i++) k.add('seat', new CylinderGeometry(0.01, 0.01, 0.1, 8), [i * 0.041, 0.335, seatZ - 0.06], [-0.22, 0, 0])
  k.add('dash', box(0.006, 0.12, 0.13), [0, 0.3, seatZ])
  // Gauge panel on the dash: an oval of engine-turned chrome holding four dials.
  k.add('chrome', rbox(0.2, 0.05, 0.01, 0.02), [0.02, 0.35, 0.03], [0.5, 0, 0])
  for (const x of [-0.05, -0.005, 0.04, 0.085]) {
    k.add('black', disc(0.016, 14), [x, 0.35, 0.03 - 0.006], [0.5 + Math.PI, 0, Math.PI])
    k.add('lamp', disc(0.012, 14), [x, 0.35 + 0.002 * Math.sin(0.5), 0.03 - 0.0065 - 0.003], [0.5 + Math.PI, 0, Math.PI])
  }
  h.steering(k, 0.13, 0.365, -0.03)
  rod(k, 'chrome', [-0.02, 0.255, -0.04], [-0.02, 0.33, -0.07], 0.0035)
  k.add('chrome', new SphereGeometry(0.013, 10, 8), [-0.02, 0.335, -0.072])

  // ---- Body sides: suicide doors, a belt reveal, chrome handles and hinges.
  for (const sd of SIDES) {
    S.wall('dark', plane(0.005, 0.15), sd, 0.035, 0.27, 0.003)
    S.wall('dark', plane(0.005, 0.15), sd, -0.255, 0.27, 0.003, 0.05)
    // Belt reveal: a raised band along the side just under the shoulder.
    const n = 8
    for (let i = 0; i < n; i++) {
      const z0 = 0.155 - (i * 0.79) / n
      const z1 = 0.155 - ((i + 1) * 0.79) / n
      S.wall('paint', box(Math.abs(z1 - z0) + 0.004, 0.012, 0.006), sd, (z0 + z1) / 2, 0.323, 0.002)
    }
    S.wall('chrome', rbox(0.04, 0.01, 0.01, 0.004), sd, -0.21, 0.3, 0.005)
    for (const y of [0.21, 0.29]) S.wall('chrome', rbox(0.02, 0.02, 0.008, 0.004), sd, 0.03, y, 0.004)
  }

  // ---- Rear: the quick-change axle under the deck, ladder bars, a tank, round taillights
  // on stalks, the plate and nerf bars.
  const rz = -wz
  for (const sd of SIDES) {
    k.add('black', new CylinderGeometry(0.022, 0.026, 0.25, 12), [sd * 0.18, r, rz], [0, 0, Math.PI / 2])
    tube(k, 'chrome', [[sd * 0.2, r - 0.02, rz + 0.01], [sd * 0.215, r - 0.03, rz + 0.12], [sd * 0.235, 0.14, -0.2]], 0.008, 10, 6)
    tube(k, 'chrome', [[sd * 0.2, r + 0.02, rz + 0.01], [sd * 0.215, r - 0.005, rz + 0.12], [sd * 0.235, 0.14, -0.2]], 0.008, 10, 6)
    rod(k, 'chrome', [sd * 0.24, r + 0.01, rz - 0.03], [sd * 0.235, 0.23, rz - 0.06], 0.009)
  }
  k.add('chrome', rbox(0.1, 0.1, 0.1, 0.03), [0, r, rz])
  k.add('chrome', new CylinderGeometry(0.04, 0.04, 0.03, 18), [0, r, rz - 0.06], [Math.PI / 2, 0, 0])
  k.add('dark', disc(0.026, 14), [0, r, rz - 0.078], [0, Math.PI, 0])
  // Fuel tank slung under the tail.
  k.add('paint', rbox(0.38, 0.05, 0.1, 0.02), [0, 0.2, -0.6])
  const tz = -0.665
  for (const sd of SIDES) {
    rod(k, 'chrome', [sd * 0.2, 0.235, tz + 0.03], [sd * 0.262, 0.245, tz - 0.012], 0.006)
    lampPod(k, sd * 0.262, 0.245, tz - 0.016, 0.022, -1, 'tail')
  }
  k.add('black', plane(0.124, 0.054), [0, 0.25, tz - 0.0025], [0, Math.PI, 0])
  k.add('lamp', plane(0.11, 0.045), [0, 0.25, tz - 0.005], [0, Math.PI, 0])
  k.add('chrome', box(0.04, 0.008, 0.012), [0, 0.282, tz - 0.004])
  if (!fit.kit) for (const sd of SIDES) {
    tube(k, 'chrome', [[sd * 0.12, 0.2, -0.6], [sd * 0.13, 0.185, -0.685], [sd * 0.2, 0.185, -0.705], [sd * 0.28, 0.19, -0.69]], 0.009, 12, 6)
    k.add('chrome', new SphereGeometry(0.0095, 8, 6), [sd * 0.28, 0.19, -0.69])
  }
  // Polished deck rack on the turtle deck, unless a spoiler takes its place.
  if (!fit.spoiler) {
    for (const x of [-0.05, -0.025, 0, 0.025, 0.05]) S.top('chrome', box(0.01, 0.13, 0.006), x, -0.52, 0.006)
    for (const z of [-0.46, -0.58]) S.top('chrome', box(0.12, 0.012, 0.008), 0, z, 0.009)
  }

  // ---- Racing stripes: twin stripes down the hood, over the cowl and down the turtle deck
  // (drawn only when painted on).
  for (const sd of SIDES) {
    const x = sd * 0.098
    for (let z = 0.55; z > 0.19; z -= 0.042) H.top('stripe', plane(0.036, 0.0425), x, z, 0.0025)
    for (let z = 0.152; z > 0.1; z -= 0.025) S.top('stripe', plane(0.036, 0.0255), x, z, 0.003)
    for (let z = -0.385; z > -0.66; z -= 0.035) S.top('stripe', plane(0.036, 0.0355), x, z, 0.003)
  }

  h.brakes(k, wx, wz, r, 0.14)
}
