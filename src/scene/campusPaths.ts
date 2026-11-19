// Routes for the people and learner cars on the campus lots (see CampusLife).

export type XZ = [number, number]
// Where person `i` is at `time` (seconds). Heading and leg swing follow from how it moves.
export type Mover = (i: number, time: number) => XZ

// A closed route through `pts`, walked at constant speed: returns the point a
// fraction `f` (0..1, wraps) of the way round.
export function loop(pts: XZ[]) {
  const segs = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]
    return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) }
  })
  const total = segs.reduce((n, s) => n + s.len, 0)
  return (f: number): XZ => {
    let d = (((f % 1) + 1) % 1) * total
    for (const s of segs) {
      if (d <= s.len) {
        const k = s.len ? d / s.len : 0
        return [s.p[0] + (s.q[0] - s.p[0]) * k, s.p[1] + (s.q[1] - s.p[1]) * k]
      }
      d -= s.len
    }
    return pts[0]
  }
}

// A running track: two straights joined by half circles, centred on (cx, cz), long along z.
export function track(cx: number, cz: number, straight: number, r: number) {
  const len = 2 * straight + 2 * Math.PI * r
  return (f: number): XZ => {
    let d = (((f % 1) + 1) % 1) * len
    if (d < straight) return [cx + r, cz + straight / 2 - d]
    d -= straight
    if (d < Math.PI * r) {
      const a = d / r
      return [cx + Math.cos(a) * r, cz - straight / 2 - Math.sin(a) * r]
    }
    d -= Math.PI * r
    if (d < straight) return [cx - r, cz - straight / 2 + d]
    d -= straight
    const a = d / r
    return [cx - Math.cos(a) * r, cz + straight / 2 + Math.sin(a) * r]
  }
}


// Kids running about a rectangle (cx, cz, half-width, half-depth): each one
// traces its own loose loop, so the yard looks busy without anyone colliding.
export const playMove = (cx: number, cz: number, hw: number, hd: number): Mover => (i, t) => {
  const a = 0.35 + (i % 5) * 0.09, b = 0.27 + (i % 7) * 0.07
  return [cx + Math.sin(t * a + i * 2.1) * hw * (0.55 + (i % 3) * 0.2), cz + Math.sin(t * b + i * 1.3) * hd * (0.5 + (i % 4) * 0.15)]
}

// People spread round a route, each at its own pace (runners lap, walkers stroll).
export const routeMove = (route: (f: number) => XZ, lap: number, spread = 0.02): Mover => (i, t) => {
  const pace = 1 + ((i * 37) % 10) / 40
  const dir = i % 2 ? 1 : -1
  const [x, z] = route(dir * t / (lap * pace) + i * 0.137)
  return [x + Math.sin(i * 4.7) * spread, z + Math.cos(i * 3.1) * spread]
}


// A closed drive through `pts`, rounded into a smooth curve (centripetal Catmull-Rom)
// so a car following it steers through bends instead of pivoting on the spot.
// Sampled once into an arc-length table: `at(d)` is the point `d` along the
// curve (wraps), its heading, and how sharply it bends there (radians per unit).
export type Drive = { len: number; at: (d: number, out?: DrivePose) => DrivePose; bend: (d0: number, d1: number) => number }
export type DrivePose = { x: number; z: number; yaw: number; curv: number }

export function smoothLoop(pts: XZ[], per = 20): Drive {
  const n = pts.length
  const P = (i: number) => pts[((i % n) + n) % n]
  const xs: number[] = [], zs: number[] = []
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2)
    const t = (a: XZ, b: XZ) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-4
    const t1 = t(p0, p1), t2 = t1 + t(p1, p2), t3 = t2 + t(p2, p3)
    for (let s = 0; s < per; s++) {
      const u = t1 + ((t2 - t1) * s) / per
      const lerp = (a: XZ, b: XZ, ta: number, tb: number): XZ => {
        const k = (u - ta) / (tb - ta)
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
      }
      const a1 = lerp(p0, p1, 0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3)
      const b1 = lerp(a1, a2, 0, t2), b2 = lerp(a2, a3, t1, t3)
      const c = lerp(b1, b2, t1, t2)
      xs.push(c[0])
      zs.push(c[1])
    }
  }
  const m = xs.length
  const cum = [0], yaw: number[] = [], curv: number[] = []
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m
    cum.push(cum[i] + Math.hypot(xs[j] - xs[i], zs[j] - zs[i]))
    yaw.push(Math.atan2(xs[j] - xs[i], zs[j] - zs[i]))
  }
  const len = cum[m]
  const index = (d: number) => {
    d = ((d % len) + len) % len
    let lo = 0, hi = m - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (cum[mid] <= d) lo = mid
      else hi = mid - 1
    }
    return { i: lo, k: (d - cum[lo]) / Math.max(1e-4, cum[lo + 1] - cum[lo]) }
  }
  // Bend measured as the turn in heading across a short stretch, so uneven
  // sample spacing doesn't spike it.
  const W = 0.12
  for (let i = 0; i < m; i++) {
    const a = yaw[index(cum[i] - W / 2).i], b = yaw[index(cum[i] + W / 2).i]
    curv.push(Math.atan2(Math.sin(b - a), Math.cos(b - a)) / W)
  }
  const at = (d: number, out: DrivePose = { x: 0, z: 0, yaw: 0, curv: 0 }) => {
    const { i, k } = index(d)
    const j = (i + 1) % m
    out.x = xs[i] + (xs[j] - xs[i]) * k
    out.z = zs[i] + (zs[j] - zs[i]) * k
    // Heading eased between samples so it turns continuously.
    const dy = Math.atan2(Math.sin(yaw[j] - yaw[i]), Math.cos(yaw[j] - yaw[i]))
    out.yaw = yaw[i] + dy * k
    out.curv = curv[i] + (curv[j] - curv[i]) * k
    return out
  }
  // Sharpest bend between d0 and d1: how hard the car will have to steer soon.
  const bend = (d0: number, d1: number) => {
    let most = 0
    for (let d = d0; d <= d1; d += 0.05) most = Math.max(most, Math.abs(curv[index(d).i]))
    return most
  }
  return { len, at, bend }
}

// How far along `drive` its nearest point to (x, z) is.
export function nearestD(drive: Drive, x: number, z: number) {
  const p: DrivePose = { x: 0, z: 0, yaw: 0, curv: 0 }
  let best = 0, gap = Infinity
  for (let d = 0; d < drive.len; d += 0.005) {
    drive.at(d, p)
    const g = Math.hypot(p.x - x, p.z - z)
    if (g < gap) [gap, best] = [g, d]
  }
  return best
}
