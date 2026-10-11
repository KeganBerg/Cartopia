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

