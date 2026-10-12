import { BufferAttribute, BufferGeometry, Color } from 'three'
import { PAL, SEASON } from './season'

// The shape and colour of the land around the town, for the free view's
// horizon (Horizon.tsx). Pure maths, no rendering, so it can be tested.

export const R0 = 186 // terrain starts here, tucked under the edge of the town's meadow
export const R1 = 1500 // and runs out here, in the haze
const SMALL = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700
const RINGS = SMALL ? 46 : 56
const SEGS = SMALL ? 150 : 180
export const TAU = Math.PI * 2
const ringR = (i: number) => R0 + (R1 - R0) * (i / RINGS) ** 1.75

// Directions (angle of atan2(z, x)) of each side's landmark.
export const A_MTN = Math.PI / 4
export const A_CITY = (-3 * Math.PI) / 4
export const A_LAKE = (3 * Math.PI) / 4
export const A_WOODS = -Math.PI / 4
export const polar = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r]
export const CITY = polar(820, A_CITY)
export const LAKE = polar(520, A_LAKE)
// The highway crosses in front of the city.
export const HWY0 = polar(520, A_CITY)
export const HWY_DIR: [number, number] = [Math.cos(A_CITY + Math.PI / 2), Math.sin(A_CITY + Math.PI / 2)]
export const HWY_LEN = 950
// A railway runs the same way, nearer town, so a train crosses the farmland.
export const RAIL0 = polar(390, A_CITY)
export const RAIL_LEN = 900

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const angDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % TAU
  return d > Math.PI ? TAU - d : d
}

// Value noise, seeded and deterministic so every player sees the same hills.
export function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}
function fbm(x: number, y: number, oct = 4) {
  let v = 0, amp = 0.5, f = 1
  for (let i = 0; i < oct; i++) {
    v += amp * noise(x * f, y * f)
    f *= 2.03
    amp *= 0.5
  }
  return v / (1 - 0.5 ** oct)
}
// Sharp crests for mountains.
function ridged(x: number, y: number) {
  let v = 0, amp = 0.55, f = 1
  for (let i = 0; i < 5; i++) {
    const n = 1 - Math.abs(noise(x * f + i * 9.1, y * f - i * 4.7) * 2 - 1)
    v += amp * n * n
    f *= 2.1
    amp *= 0.48
  }
  return v
}

// Distance from the highway's centre line, and how far along it a point is.
export function hwy(x: number, z: number) {
  const dx = x - HWY0[0], dz = z - HWY0[1]
  const s = dx * HWY_DIR[0] + dz * HWY_DIR[1]
  const d = Math.abs(dx * -HWY_DIR[1] + dz * HWY_DIR[0])
  return { s, d: Math.abs(s) > HWY_LEN ? d + (Math.abs(s) - HWY_LEN) : d }
}
export const hwyHeight = (s: number) => 1.2 + 9 * fbm(s / 420 + 40, 3.3, 2)
// The same for the railway (it runs parallel to the highway).
export function rail(x: number, z: number) {
  const dx = x - RAIL0[0], dz = z - RAIL0[1]
  const s = dx * HWY_DIR[0] + dz * HWY_DIR[1]
  const d = Math.abs(dx * -HWY_DIR[1] + dz * HWY_DIR[0])
  return { s, d: Math.abs(s) > RAIL_LEN ? d + (Math.abs(s) - RAIL_LEN) : d }
}
export const railHeight = (s: number) => 1.6 + 7 * fbm(s / 380 - 20, 8.1, 2)
export const railPoint = (s: number): [number, number] => [RAIL0[0] + HWY_DIR[0] * s, RAIL0[1] + HWY_DIR[1] * s]
const LAKE_R = 190
export const lakeOf = (x: number, z: number) => Math.hypot((x - LAKE[0]) / 1.35, z - LAKE[1]) / LAKE_R

// Height of the land at a point (0 is the town's ground).
export function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z)
  if (r < R0) return -0.3
  const a = Math.atan2(z, x)
  const t = smooth(R0 + 8, 270, r)
  // Rolling hills everywhere, gentler on the farm side.
  const farm = 1 - smooth(0.6, 1.3, angDist(a, A_CITY))
  let h = -0.3 + t * (1.4 + fbm(x / 95, z / 95) * (16 - farm * 9))
  // Mountains: a big range behind the town, lower blue peaks all round the rim.
  const range = Math.max(0, Math.cos(angDist(a, A_MTN))) ** 1.4
  const tall = smooth(330, 760, r) * (0.18 + 0.82 * range) * (1 - farm * 0.75)
  const rim = smooth(950, 1400, r) * (0.55 + 0.45 * fbm(a * 3, 7.7, 2))
  h += ridged(x / 300, z / 300) * 330 * tall + rim * 170
  // A flat plain for the city and a level bed for the highway.
  const city = smooth(260, 110, Math.hypot(x - CITY[0], z - CITY[1]))
  h += (2 - h) * city
  const { s, d } = hwy(x, z)
  const bed = smooth(70, 13, d)
  h += (hwyHeight(s) - 0.3 - h) * bed
  const rl = rail(x, z)
  h += (railHeight(rl.s) - 0.3 - h) * smooth(60, 11, rl.d)
  // The lake bowl.
  const lk = lakeOf(x, z)
  // (kept clear of the town's meadow, which ends about 200 units out)
  if (lk < 1.5) h += (-7 - h) * smooth(1.25, 0.8, lk) * smooth(235, 290, r)
  return h
}

// What the land is made of at a point: fields, meadow, forest floor, rock or snow.
export const SNOWLINE = { winter: 0, spring: 150, summer: 205, fall: 175 }[SEASON]
const C = (h: string) => new Color(h)
const GRASS = SEASON === 'winter' ? [C('#e9eff4'), C('#dde6ec')] : SEASON === 'fall' ? [C('#93a046'), C('#a7a24c')] : [C(PAL.ground), C(PAL.grassSpeckle[1])]
const CROPS = {
  spring: ['#7fc04f', '#a4d65e', '#e8d84a', '#6a8f3a', '#8b6a4a'],
  summer: ['#6fb141', '#d9b44a', '#e6c65a', '#5f9e38', '#a07a52'],
  fall: ['#c49a3e', '#8d6b45', '#b5873a', '#d1aa52', '#7a5a3c'],
  winter: ['#eef3f7', '#e2e9ee', '#f7fafc', '#dfe7ed', '#e8eef2'],
}[SEASON].map(C)
const ROCK = C('#8a8378'), ROCK_DARK = C('#6f6a62'), SNOW = C('#f4f8fb'), SAND = C('#d8c79a'), FOREST_FLOOR = C(SEASON === 'winter' ? '#d9e2e8' : SEASON === 'fall' ? '#7c6a34' : '#3f7a34')
const tmp = new Color()

function groundColor(out: Color, x: number, z: number, h: number, slope: number) {
  const g = fbm(x / 40, z / 40, 2)
  out.copy(GRASS[0]).lerp(GRASS[1], g)
  // Patchwork fields on the farm side.
  const f = fieldAt(x, z)
  if (f && slope < 0.35) out.copy(CROPS[f.kind])
  // Forest floor under the woods.
  if (forest(x, z) > 0.5 && slope < 0.6) out.lerp(FOREST_FLOOR, 0.6)
  // Beaches round the lake, rock on steep faces, snow up high.
  if (lakeOf(x, z) < 1.12 && h < 2.5) out.copy(SAND)
  if (slope > 0.75) out.lerp(g > 0.5 ? ROCK : ROCK_DARK, smooth(0.75, 1.2, slope))
  else if (h > 90) out.lerp(ROCK, smooth(90, 160, h) * 0.8)
  const snow = SEASON === 'winter' ? 1 - smooth(0.9, 1.4, slope) * 0.6 : smooth(SNOWLINE - 25, SNOWLINE + 15, h + g * 30) * (1 - smooth(1.1, 1.5, slope))
  if (snow > 0) out.lerp(SNOW, snow)
  const { d } = hwy(x, z)
  if (d < 18) out.lerp(tmp.set(SEASON === 'winter' ? '#cfd6dc' : '#7d8a5a'), smooth(18, 9, d) * 0.6)
  const rd = rail(x, z).d
  if (rd < 12) out.lerp(tmp.set(SEASON === 'winter' ? '#d4dadf' : '#8a8064'), smooth(12, 6, rd) * 0.55)
  return out
}

// The farm side is cut into fields on a slanted grid. Each cell is a crop (kind
// 0..4, see Countryside.tsx for what grows in each season) or plain grass.
export const FIELD = { w: 46, d: 34 }
const U = [0.8, 0.6], V = [-0.6, 0.8]
export const FIELD_AXES = { u: U as [number, number], v: V as [number, number] }
export function fieldCell(x: number, z: number) {
  return { fx: Math.floor((x * U[0] + z * U[1]) / FIELD.w), fz: Math.floor((x * V[0] + z * V[1]) / FIELD.d) }
}
export function fieldCentre(fx: number, fz: number): [number, number] {
  const u = (fx + 0.5) * FIELD.w, v = (fz + 0.5) * FIELD.d
  return [u * U[0] + v * V[0], u * U[1] + v * V[1]]
}
// The field a point is in, or null: only on the farm side, clear of the roads, rail, lake and city.
export function fieldAt(x: number, z: number) {
  const r = Math.hypot(x, z)
  if (r < 230 || r > 700) return null
  const farm = 1 - smooth(0.55, 1.15, angDist(Math.atan2(z, x), A_CITY))
  if (farm <= 0.3) return null
  if (hwy(x, z).d < 16 || rail(x, z).d < 12) return null
  const { fx, fz } = fieldCell(x, z)
  const k = hash(fx, fz)
  if (k >= 0.78) return null
  return { fx, fz, kind: Math.floor(k * 6.4) % 5 }
}

// Height of the terrain MESH at a point, which between its vertices differs a
// little from heightAt (the land is flat facets). Things standing on the ground
// use this so they neither float nor sink.
export function groundAt(x: number, z: number) {
  const r = Math.hypot(x, z)
  if (r < R0 || r >= R1) return heightAt(x, z)
  const i = Math.min(RINGS - 1, Math.floor(RINGS * ((r - R0) / (R1 - R0)) ** (1 / 1.75)))
  let a = Math.atan2(z, x)
  if (a < 0) a += TAU
  const step = TAU / SEGS
  const vert = (ii: number, jj: number): [number, number, number] => {
    const ang = (jj + (ii % 2) * 0.5) * step
    const rr = ringR(ii)
    const vx = Math.cos(ang) * rr, vz = Math.sin(ang) * rr
    return [vx, heightAt(vx, vz), vz]
  }
  const j0 = Math.floor(a / step - (i % 2) * 0.5)
  for (let ii = Math.max(0, i - 1); ii <= Math.min(RINGS - 1, i + 1); ii++) {
    for (let jj = j0 - 2; jj <= j0 + 2; jj++) {
      const p = (di: number, dj: number) => vert(ii + di, jj + dj)
      const tris = ii % 2 === 0 ? [[p(0, 0), p(1, 0), p(0, 1)], [p(0, 1), p(1, 0), p(1, 1)]] : [[p(0, 0), p(1, 0), p(1, 1)], [p(0, 0), p(1, 1), p(0, 1)]]
      for (const [A, B, Cc] of tris) {
        const det = (B[2] - Cc[2]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[2] - Cc[2])
        const l1 = ((B[2] - Cc[2]) * (x - Cc[0]) + (Cc[0] - B[0]) * (z - Cc[2])) / det
        const l2 = ((Cc[2] - A[2]) * (x - Cc[0]) + (A[0] - Cc[0]) * (z - Cc[2])) / det
        const l3 = 1 - l1 - l2
        if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * A[1] + l2 * B[1] + l3 * Cc[1]
      }
    }
  }
  return heightAt(x, z)
}

// Where the woods grow (0..1).
export function forest(x: number, z: number) {
  const a = Math.atan2(z, x)
  const woods = 0.35 + 0.45 * Math.max(0, Math.cos(angDist(a, A_WOODS))) - 0.25 * (1 - smooth(0.5, 1.1, angDist(a, A_CITY)))
  return fbm(x / 70 + 13, z / 70 - 5, 3) * 0.9 + woods * 0.45
}

// The land as one faceted mesh: rings of vertices growing further apart with
// distance, a flat colour per triangle like the rest of the low-poly world.
export function buildTerrain() {
  const radii: number[] = []
  for (let i = 0; i <= RINGS; i++) radii.push(ringR(i))
  const grid: number[][] = radii.map((r, i) =>
    Array.from({ length: SEGS }, (_, j) => {
      // Stagger alternate rings by half a step so triangles don't line up into spokes.
      const a = ((j + (i % 2) * 0.5) / SEGS) * TAU
      const x = Math.cos(a) * r, z = Math.sin(a) * r
      return heightAt(x, z)
    }),
  )
  const xz = (i: number, j: number): [number, number] => {
    const a = ((j + (i % 2) * 0.5) / SEGS) * TAU
    return [Math.cos(a) * radii[i], Math.sin(a) * radii[i]]
  }
  const pos: number[] = []
  const col: number[] = []
  const c = new Color()
  const tri = (p: [number, number, number][]) => {
    // Facing up (three's triangles wind counter-clockwise seen from the front).
    const [a, b, d] = p
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    if (ny < 0) {
      p = [a, d, b]
      nx = -nx; ny = -ny; nz = -nz
    }
    const slope = Math.hypot(nx, nz) / Math.max(1e-6, ny)
    const cx = (a[0] + b[0] + d[0]) / 3, cy = (a[1] + b[1] + d[1]) / 3, cz = (a[2] + b[2] + d[2]) / 3
    groundColor(c, cx, cz, cy, slope)
    // A touch of per-facet variation keeps big slopes from looking flat-printed.
    const v = 0.94 + hash(cx * 0.37, cz * 0.53) * 0.1
    for (const q of p) {
      pos.push(q[0], q[1], q[2])
      col.push(c.r * v, c.g * v, c.b * v)
    }
  }
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const j1 = (j + 1) % SEGS
      const p = (ii: number, jj: number): [number, number, number] => {
        const [x, z] = xz(ii, jj)
        return [x, grid[ii][jj], z]
      }
      if (i % 2 === 0) {
        tri([p(i, j), p(i + 1, j), p(i, j1)])
        tri([p(i, j1), p(i + 1, j), p(i + 1, j1)])
      } else {
        tri([p(i, j), p(i + 1, j), p(i + 1, j1)])
        tri([p(i, j), p(i + 1, j1), p(i, j1)])
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

