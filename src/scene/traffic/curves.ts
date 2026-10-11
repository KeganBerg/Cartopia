// Cubic Bezier curves walked by arc length, so cars keep a steady speed
// through bends and every leg of a route joins the next without a kink.

export type V2 = [number, number]

export type Curve = {
  p: [V2, V2, V2, V2]
  len: number
  lut: Float32Array // arc length at each of N+1 evenly spaced t values
}

const N = 24
// Handle length that makes a cubic Bezier match a quarter circle.
export const KAPPA = 0.5523

export const add = (a: V2, b: V2, k = 1): V2 => [a[0] + b[0] * k, a[1] + b[1] * k]
export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]]
export const lerp = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

function bez(p: Curve['p'], t: number): V2 {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]]
}

function deriv(p: Curve['p'], t: number): V2 {
  const u = 1 - t
  const a = 3 * u * u, b = 6 * u * t, c = 3 * t * t
  return [
    a * (p[1][0] - p[0][0]) + b * (p[2][0] - p[1][0]) + c * (p[3][0] - p[2][0]),
    a * (p[1][1] - p[0][1]) + b * (p[2][1] - p[1][1]) + c * (p[3][1] - p[2][1]),
  ]
}

export function cubic(p0: V2, p1: V2, p2: V2, p3: V2): Curve {
  const p: Curve['p'] = [p0, p1, p2, p3]
  const lut = new Float32Array(N + 1)
  let prev = p0
  for (let i = 1; i <= N; i++) {
    const q = bez(p, i / N)
    lut[i] = lut[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1])
    prev = q
  }
  return { p, len: lut[N], lut }
}

export const line = (a: V2, b: V2) => cubic(a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b)

// Quarter-circle-like bend from `a` heading `da` to `b`, arriving at right angles.
export function bend(a: V2, da: V2, b: V2): Curve {
  // The corner where the two straight lines meet.
  const k = (b[0] - a[0]) * da[0] + (b[1] - a[1]) * da[1]
  const q = add(a, da, k)
  return cubic(a, lerp(a, q, KAPPA), lerp(b, q, KAPPA), b)
}

function tAt(c: Curve, s: number) {
  if (s <= 0) return 0
  if (s >= c.len) return 1
  let lo = 0, hi = N
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (c.lut[mid] < s) lo = mid
    else hi = mid
  }
  const span = c.lut[hi] - c.lut[lo] || 1
  return (lo + (s - c.lut[lo]) / span) / N
}

export function pointAt(c: Curve, s: number): V2 {
  return bez(c.p, tAt(c, s))
}

// Point and unit direction at arc length s, written into `p` and `h` (no allocation;
// same numbers as pointAt and dirAt).
export function poseAt(c: Curve, s: number, p: V2, h: V2) {
  const t = tAt(c, s)
  const q = c.p
  let u = 1 - t
  let a = u * u * u, b = 3 * u * u * t, k = 3 * u * t * t, d = t * t * t
  p[0] = a * q[0][0] + b * q[1][0] + k * q[2][0] + d * q[3][0]
  p[1] = a * q[0][1] + b * q[1][1] + k * q[2][1] + d * q[3][1]
  const td = Math.min(0.999, Math.max(0.001, t))
  u = 1 - td
  a = 3 * u * u
  b = 6 * u * td
  k = 3 * td * td
  const dx = a * (q[1][0] - q[0][0]) + b * (q[2][0] - q[1][0]) + k * (q[3][0] - q[2][0])
  const dz = a * (q[1][1] - q[0][1]) + b * (q[2][1] - q[1][1]) + k * (q[3][1] - q[2][1])
  const l = Math.hypot(dx, dz) || 1
  h[0] = dx / l
  h[1] = dz / l
}

// Unit direction of travel at arc length s.
export function dirAt(c: Curve, s: number): V2 {
  const d = deriv(c.p, Math.min(0.999, Math.max(0.001, tAt(c, s))))
  const l = Math.hypot(d[0], d[1]) || 1
  return [d[0] / l, d[1] / l]
}
