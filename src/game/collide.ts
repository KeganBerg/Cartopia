// Ground-plane collisions for the arcade driving games: cars are oriented boxes,
// kerbs and walls are boxes, posts and cones are circles. Every test answers how far
// to push the car back out, so a car scrapes along a wall instead of bouncing off thin air.

export type Box = { x: number; z: number; h: number; w: number; l: number } // h = 0 faces +z; w across, l along
export type Circle = { x: number; z: number; r: number }
export type Solid = Box | Circle
// Move the car by (x, z) to clear the solid; (nx, nz) is the unit normal pointing away from it.
export type Push = { x: number; z: number; nx: number; nz: number; depth: number }

const EPS = 1e-6
const isCircle = (s: Solid): s is Circle => 'r' in s

// The box's own across (local x) and along (local z) directions on the ground.
const axesOf = (b: Box): [number, number][] => [[Math.cos(b.h), -Math.sin(b.h)], [Math.sin(b.h), Math.cos(b.h)]]

// The four corners of a box, for drawing and for collisions.
export function corners(b: Box): [number, number][] {
  const c = Math.cos(b.h), s = Math.sin(b.h)
  const hw = b.w / 2, hl = b.l / 2
  return ([[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]] as const).map(([x, z]) => [b.x + x * c + z * s, b.z - x * s + z * c])
}

// Half the box's shadow on an axis.
const reach = (b: Box, ax: number, az: number) => {
  const [[ux, uz], [vx, vz]] = axesOf(b)
  return (Math.abs(ux * ax + uz * az) * b.w + Math.abs(vx * ax + vz * az) * b.l) / 2
}

// Separating axes: the shallowest overlap is the way out. Boxes that only touch don't hit.
export function boxPush(a: Box, b: Box): Push | null {
  const dx = a.x - b.x, dz = a.z - b.z
  let best: Push | null = null
  for (const [ax, az] of [...axesOf(a), ...axesOf(b)]) {
    const gap = Math.abs(dx * ax + dz * az)
    const depth = reach(a, ax, az) + reach(b, ax, az) - gap
    if (depth <= EPS) return null
    if (!best || depth < best.depth) {
      const sg = dx * ax + dz * az >= 0 ? 1 : -1
      best = { x: ax * sg * depth, z: az * sg * depth, nx: ax * sg, nz: az * sg, depth }
    }
  }
  return best
}

// A box against a round post: push the box straight away from the post's centre.
export function circlePush(a: Box, c: Circle): Push | null {
  const [[ux, uz], [vx, vz]] = axesOf(a)
  const dx = c.x - a.x, dz = c.z - a.z
  const lx = dx * ux + dz * uz, lz = dx * vx + dz * vz
  const hw = a.w / 2, hl = a.l / 2
  const px = Math.max(-hw, Math.min(hw, lx)), pz = Math.max(-hl, Math.min(hl, lz))
  if (px !== lx || pz !== lz) {
    // Centre outside the box: away from the nearest point on its edge.
    const ex = lx - px, ez = lz - pz
    const d = Math.hypot(ex, ez)
    if (d >= c.r - EPS) return null
    const wx = -(ex * ux + ez * vx) / d, wz = -(ex * uz + ez * vz) / d
    const depth = c.r - d
    return { x: wx * depth, z: wz * depth, nx: wx, nz: wz, depth }
  }
  // Centre inside the box: out through the nearest side.
  const sx = hw - Math.abs(lx) + c.r, sz = hl - Math.abs(lz) + c.r
  const [nx, nz, depth] = sx < sz
    ? [-(Math.sign(lx) || 1) * ux, -(Math.sign(lx) || 1) * uz, sx]
    : [-(Math.sign(lz) || 1) * vx, -(Math.sign(lz) || 1) * vz, sz]
  return { x: nx * depth, z: nz * depth, nx, nz, depth }
}

export const pushOf = (a: Box, s: Solid) => (isCircle(s) ? circlePush(a, s) : boxPush(a, s))
export const hits = (a: Box, s: Solid) => pushOf(a, s) !== null

// Push the car clear of everything it overlaps (a few rounds settles a corner between
// two solids). Returns the total move and the averaged way out, or null when it's clear.
export function separate(a: Box, solids: Solid[], rounds = 4): Push | null {
  let x = 0, z = 0, nx = 0, nz = 0
  const b = { ...a }
  for (let i = 0; i < rounds; i++) {
    let moved = false
    for (const s of solids) {
      const p = pushOf(b, s)
      if (!p) continue
      b.x += p.x
      b.z += p.z
      x += p.x
      z += p.z
      nx += p.nx * p.depth
      nz += p.nz * p.depth
      moved = true
    }
    if (!moved) break
  }
  const n = Math.hypot(nx, nz)
  if (n < EPS) return null
  return { x, z, nx: nx / n, nz: nz / n, depth: Math.hypot(x, z) }
}

// When the car only overlaps solids by a sliver of its width (under SLIP of it), the
// smallest sideways shift that clears them all; null when it's a real hit.
const SLIP = 0.3
export function cornerSlip(a: Box, solids: Solid[]): { x: number; z: number } | null {
  const [ux, uz] = axesOf(a)[0]
  const near = solids.filter((s) => hits(a, s))
  const most = a.w * SLIP
  for (let d = 0.02; d <= most + 1e-9; d += 0.02) {
    for (const sg of [1, -1]) {
      const x = ux * d * sg, z = uz * d * sg
      if (!near.some((s) => hits({ ...a, x: a.x + x, z: a.z + z }, s)) && !separate({ ...a, x: a.x + x, z: a.z + z }, solids, 1)) return { x, z }
    }
  }
  return null
}

// Hitting within about 35° of square on counts as head on.
const HEAD_ON = 0.82
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

// How a car moving at speed v on heading h answers a wall with this normal.
// Head on it bounces back a little; at a glancing angle it keeps the speed along the
// wall and its nose swings round to run with it. impact is the speed into the wall.
export function scrape(v: number, h: number, nx: number, nz: number) {
  const fx = Math.sin(h), fz = Math.cos(h)
  const d = fx * nx + fz * nz
  const impact = -v * d
  if (impact <= 0) return { v, h, impact: 0 }
  // Turn towards the wall's line, whichever way along it the car is already going.
  const tx = fx - d * nx, tz = fz - d * nz
  const along = Math.hypot(tx, tz) > 1e-3 ? wrap(Math.atan2(tx, tz) - h) : 0
  if (Math.abs(d) > HEAD_ON) return { v: -v * 0.25, h: h + along * 0.15, impact }
  return { v: v * Math.sqrt(1 - d * d) * 0.92, h: h + along * 0.5, impact }
}

// The car's box at a pose, from its measured footprint (cz = the middle's offset along the car).
export type Footprint = { w: number; l: number; cz: number }
export const carBox = (p: { x: number; z: number; h: number }, f: Footprint): Box => ({
  x: p.x + Math.sin(p.h) * f.cz, z: p.z + Math.cos(p.h) * f.cz, h: p.h, w: f.w, l: f.l,
})

// One drive step against the world: move, push clear, scrape. Returns the new pose and
// speed, plus how hard it hit (0 when nothing was touched).
export function step(pose: { x: number; z: number; h: number }, v: number, next: { x: number; z: number; h: number }, f: Footprint, solids: Solid[]) {
  const p = { ...next }
  const hit = separate(carBox(p, f), solids)
  if (!hit) return { pose: p, v, impact: 0, nx: 0, nz: 0 }
  // Clipping a corner with the edge of the bumper glances the car off sideways.
  const square = Math.abs(Math.sin(p.h) * hit.nx + Math.cos(p.h) * hit.nz) > HEAD_ON
  const slip = square && cornerSlip(carBox(p, f), solids)
  if (slip) {
    const q = { ...p, x: p.x + slip.x, z: p.z + slip.z }
    const n = Math.hypot(slip.x, slip.z)
    return { pose: q, v: v * 0.8, impact: Math.abs(v) * 0.2, nx: slip.x / n, nz: slip.z / n }
  }
  p.x += hit.x
  p.z += hit.z
  const r = scrape(v, p.h, hit.nx, hit.nz)
  // Swinging the nose round can poke a corner back in; settle it again, and if that
  // still can't clear it keep the old heading.
  if (r.h !== p.h) {
    const turned = { ...p, h: r.h }
    const again = separate(carBox(turned, f), solids)
    if (again) { turned.x += again.x; turned.z += again.z }
    if (!again || !separate(carBox(turned, f), solids)) Object.assign(p, turned)
  }
  // Never let a step end inside something: fall back to where it started.
  if (separate(carBox(p, f), solids, 1)) return { pose: { ...pose }, v: r.v, impact: r.impact, nx: hit.nx, nz: hit.nz }
  return { pose: p, v: r.v, impact: r.impact, nx: hit.nx, nz: hit.nz }
}
