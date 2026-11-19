import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { glowMats } from '../dayNight'
import { Batch } from '../Batch'
import { BoxGeometry, BufferAttribute, CapsuleGeometry, ExtrudeGeometry, Shape, type Group } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EDGE, Horizon, Many, PropMesh, Scatter, Sparkles, Water, archTop, flatten, frustum, glow, prop, rand, useProp, type Look, type PropKit, type Spot, type V3 } from './kit'
import type { WorldProps } from './WorldVenue'

// China, Lantern Harbour: a night race along the river embankment. Right: the promenade with its
// plane trees, benches and strolling families, a dragon dance troupe near the start, and the river:
// junks, sand barges, a ferry, sampans and cruise boats strung with lights; across the water the
// far bank's wall of lit towers, and ahead the skyline: the tower with the pink pearls, the
// bottle-opener tower, the twisting tower and the tiered pagoda tower. Left: the old stone bank
// buildings with domes and the customs clock tower, then the old town's shophouses under tiled
// roofs (roast ducks, dumplings, tea, silk, herbs), lanes behind carved stone gates, a neon
// shopping street, a temple behind the red gate halfway, a lion dance at its door, and by the
// finish a walled garden with a moon gate and the seven-storey pagoda. Art deco hotels and
// tower blocks rise behind the front row the whole way.

const STONE: Look = { c: '#d6cdbd', r: 0.85 }
const STONE_D: Look = { c: '#b3a891', r: 0.9 }
const GRANITE: Look = { c: '#8f8a82', r: 0.9 }
const WIN: Look = { c: '#ffffff', use: glowMats.window }
const RED: Look = { c: '#b71c1c', r: 0.7 }
const TILE: Look = { c: '#2f4f46', r: 0.6 }
// Gilt kept plain (low metalness) so it folds into each prop's one painted mesh.
const GOLD: Look = { c: '#e5b53c', r: 0.35, m: 0.25 }
const DARK: Look = { c: '#1e2328', r: 1 }
const IRON: Look = { c: '#33373c', r: 0.45, m: 0.25 }
const TIMBER: Look = { c: '#5b3a24', r: 0.85 }
const BAMBOO: Look = { c: '#c8a165', r: 0.8 }
const STEAM: Look = { c: '#eeeeea', r: 1 }
const LANTERN = glow('#ff3a2a', 0.35, 1.8)
const WARM = glow('#ffcf7a', 0.1, 1.6)
const NEON_P = glow('#ff3d9a', 0.3, 1.9)
const NEON_C = glow('#3fe0ff', 0.3, 1.9)

// Row lines: the front row's faces stand at x 4, its centre line at FRONT_X; the back row of
// tall blocks rises behind it from x 14.5.
const D = 4
const FRONT_X = EDGE + 1.4 + D / 2
const BACK_X = 17.5

// A box with its corners shared (8 vertices, not 24), for small parts (faces, hands, strokes of
// lettering, rails, sills) where its softer shading doesn't show and the vertices add up.
const LOWBOX = (() => {
  const b = new BoxGeometry(1, 1, 1)
  b.deleteAttribute('normal')
  b.deleteAttribute('uv')
  const g = mergeVertices(b)
  g.computeVertexNormals()
  g.setAttribute('uv', new BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
  return g
})()
const nub = (k: PropKit, look: Look, s: V3, p: V3, r?: V3) => k.add(look, LOWBOX, p, r, s)

// Places parts in a little frame of their own: at x, z, turned ry, scaled s.
function frame(x: number, z: number, ry: number, s = 1, y0 = 0) {
  const c = Math.cos(ry)
  const sn = Math.sin(ry)
  return (px: number, py: number, pz: number): V3 => [x + (px * c + pz * sn) * s, y0 + py * s, z + (-px * sn + pz * c) * s]
}

// People, at the townspeople's size and build (peopleGeo.ts, PERSON scale 1.3): legs and shoes,
// a torso with a belt, sleeved arms and hands, a head with eyes, nose, mouth and ears, and hair.
// Feet on the ground at y0. Poses: walking (legs and arms swing), an arm up waving, a phone
// held up for a photo, both hands up on a pole (the dragon dancers).
type Who = { shirt: string; pants: string; skin: string; hair: string; walk?: number; pose?: 'down' | 'wave' | 'photo' | 'pole'; hat?: string; s?: number; dress?: boolean }
const TORSO = new CapsuleGeometry(0.085, 0.16, 1, 8)
const ARM = new CapsuleGeometry(0.028, 0.14, 1, 5)
const SKINS = ['#f1c9a5', '#e8b98f', '#f5d0b5', '#d9a77c', '#efc19a']
const HAIRS = ['#16120f', '#221a15', '#2e241c', '#16120f', '#8f8f8f']
const TOPS = ['#c62828', '#1565c0', '#fafafa', '#2e7d32', '#f9a825', '#6a1b9a', '#ef6c00', '#00838f', '#ad1457', '#37474f']
const BOTTOMS = ['#263238', '#1a237e', '#4e342e', '#212121', '#546e7a', '#3e2723']
function who(r: () => number, o: Partial<Who> = {}): Who {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  return { shirt: pick(TOPS), pants: pick(BOTTOMS), skin: pick(SKINS), hair: pick(HAIRS), ...o }
}
function person(k: PropKit, x: number, z: number, ry: number, w: Who, y0 = 0) {
  const s = 1.3 * (w.s ?? 1)
  const P = frame(x, z, ry, s, y0)
  const skin: Look = { c: w.skin, r: 0.8 }
  const top: Look = { c: w.shirt, r: 0.85 }
  const legs: Look = { c: w.dress ? w.shirt : w.pants, r: 0.85 }
  const a = w.walk ?? 0
  for (const side of [-1, 1]) {
    const th = -side * a
    nub(k, legs, [0.06 * s, 0.24 * s, 0.07 * s], P(side * 0.045, 0.24 - 0.12 * Math.cos(th), -0.12 * Math.sin(th)), [th, ry, 0])
    nub(k, { c: '#262626', r: 0.7 }, [0.066 * s, 0.04 * s, 0.105 * s], P(side * 0.045, 0.24 - 0.23 * Math.cos(th) - 0.017 * Math.sin(th), -0.23 * Math.sin(th) + 0.017 * Math.cos(th)), [th, ry, 0])
  }
  if (w.dress) k.cyl(top, 0.09 * s, 0.13 * s, 0.2 * s, P(0, 0.25, 0), undefined, 8)
  k.add(top, TORSO, P(0, 0.39, 0), [0, ry, 0], [s, s, s])
  k.cyl({ c: '#2b2b2b', r: 0.8 }, 0.088 * s, 0.088 * s, 0.022 * s, P(0, 0.305, 0), undefined, 7)
  // Arms hang from the shoulders; phi swings an arm forward (negative) or back.
  const pose = w.pose ?? 'down'
  for (const side of [-1, 1]) {
    let phi = side * a * 0.9
    if (pose === 'photo' || pose === 'pole') phi = pose === 'photo' ? -1.35 : -2.3
    if (pose === 'wave' && side > 0) phi = Math.PI - 0.35
    const sx = side * 0.108
    k.add(top, ARM, P(sx, 0.51 - 0.095 * Math.cos(phi), -0.095 * Math.sin(phi)), [phi, ry, side * (pose === 'down' ? 0.1 : 0.02)], [s, s, s])
    nub(k, skin, [0.045 * s, 0.05 * s, 0.045 * s], P(sx * (pose === 'photo' || pose === 'pole' ? 0.55 : 1.05), 0.51 - 0.205 * Math.cos(phi), -0.205 * Math.sin(phi)))
  }
  if (pose === 'photo') nub(k, DARK, [0.07 * s, 0.11 * s, 0.012 * s], P(0, 0.58, 0.2), [0.25, ry, 0])
  // Head and face.
  nub(k, skin, [0.055 * s, 0.05 * s, 0.055 * s], P(0, 0.515, 0), [0, ry, 0])
  k.sphere(skin, 0.08 * s, P(0, 0.6, 0), [1, 1, 1], 8, 6)
  nub(k, skin, [0.02 * s, 0.025 * s, 0.02 * s], P(0, 0.593, 0.08), [0, ry, 0])
  for (const side of [-1, 1]) {
    nub(k, skin, [0.02 * s, 0.035 * s, 0.03 * s], P(side * 0.079, 0.6, -0.004), [0, ry, 0])
    nub(k, { c: '#161616', r: 0.6 }, [0.018 * s, 0.02 * s, 0.012 * s], P(side * 0.028, 0.614, 0.072), [0, ry, 0])
  }
  nub(k, { c: '#8a4a4a', r: 0.8 }, [0.03 * s, 0.007 * s, 0.012 * s], P(0, 0.568, 0.072), [0, ry, 0])
  const hair: Look = { c: w.hair, r: 0.9 }
  k.sphere(hair, 0.086 * s, P(0, 0.618, -0.012), [1, 0.85, 1], 8, 3, Math.PI / 2)
  nub(k, hair, [0.15 * s, 0.07 * s, 0.05 * s], P(0, 0.6, -0.05), [0, ry, 0])
  if (w.hat) {
    k.cyl({ c: w.hat, r: 0.8 }, 0.088 * s, 0.09 * s, 0.05 * s, P(0, 0.665, -0.005), undefined, 8)
    nub(k, { c: w.hat, r: 0.8 }, [0.12 * s, 0.012 * s, 0.08 * s], P(0, 0.645, 0.08), [0, ry, 0])
  }
}

// Character-like strokes for a sign: a few bars, a box, a cross or splayed legs inside a cell of
// size s centred on c, on a face whose normal is along z ('x': the strokes spread along x) or
// along x ('z').
function glyph(k: PropKit, ink: Look, ax: 'x' | 'z', c: V3, s: number, r: () => number) {
  const t = s * 0.13
  const put = (u: number, v: number, w: number, h: number, rot = 0) => {
    if (ax === 'x') nub(k, ink, [w, h, 0.012], [c[0] + u * s, c[1] + v * s, c[2]], [0, 0, rot])
    else nub(k, ink, [0.012, h, w], [c[0], c[1] + v * s, c[2] + u * s], [rot, 0, 0])
  }
  const kind = Math.floor(r() * 5)
  put(0, 0.38, s * 0.8, t)
  if (kind === 0) {
    put(0, 0, t, s * 0.8)
    put(0, 0.05, s * 0.62, t)
    put(-0.2, -0.28, t, s * 0.38, 0.65)
    put(0.2, -0.28, t, s * 0.38, -0.65)
  } else if (kind === 1) {
    put(-0.28, -0.1, t, s * 0.5)
    put(0.28, -0.1, t, s * 0.5)
    put(0, 0.12, s * 0.6, t)
    put(0, -0.33, s * 0.6, t)
    put(0, 0.26, t, s * 0.22)
  } else if (kind === 2) {
    put(-0.27, 0, t, s * 0.78)
    put(0.12, 0.13, s * 0.48, t)
    put(0.12, -0.1, s * 0.48, t)
    put(0.12, -0.36, s * 0.55, t)
    put(0.12, 0, t, s * 0.55)
  } else if (kind === 3) {
    put(0, 0.06, s * 0.78, t)
    put(-0.17, -0.18, t, s * 0.55, -0.5)
    put(0.17, -0.18, t, s * 0.55, 0.5)
    put(0, 0.24, t, s * 0.3)
  } else {
    put(-0.22, 0.02, t, s * 0.62)
    put(0.22, 0.02, t, s * 0.62)
    put(0, -0.05, s * 0.5, t)
    put(0, -0.36, s * 0.86, t)
  }
}

// A vertical sign hung out from a wall facing +z, at x, bottom at y, h tall, sticking out to
// z0 + 0.7: a frame, a panel and characters on both faces.
function blade(k: PropKit, x: number, y: number, h: number, z0: number, panel: Look, ink: Look, rim: Look, seed: number, wide = 0.5) {
  const z = z0 + 0.12 + wide / 2
  k.box(rim, [0.1, h + 0.1, wide + 0.12], [x, y + h / 2, z])
  k.box(panel, [0.12, h - 0.04, wide], [x, y + h / 2, z])
  for (const dy of [h - 0.05, 0.08]) k.box(DARK, [0.03, 0.03, 0.14], [x, y + dy, z0 + 0.06])
  const r = rand(seed)
  const n = Math.max(2, Math.floor(h / (wide * 0.82)))
  const cell = (h - 0.1) / n
  for (let i = 0; i < n; i++) {
    const cy = y + h - 0.05 - cell * (i + 0.5)
    const rr = r()
    for (const sx of [-1, 1]) glyph(k, ink, 'z', [x + sx * 0.066, cy, z], Math.min(cell, wide) * 0.78, rand(Math.floor(rr * 1e6) + 1))
  }
}

// A stack of bamboo steamers with lids and a curl of steam.
function steamers(k: PropKit, x: number, y: number, z: number, n: number, r = 0.15) {
  for (let i = 0; i < n; i++) k.cyl(i % 2 ? BAMBOO : { c: '#b8915a', r: 0.8 }, r, r, 0.075, [x, y + 0.0375 + i * 0.075, z], undefined, 8)
  const top = y + n * 0.075
  k.cyl({ c: '#9c7643', r: 0.8 }, r * 0.55, r, 0.05, [x, top + 0.025, z], undefined, 8)
  k.ico(STEAM, r * 0.55, [x + 0.02, top + 0.15, z], [1, 0.8, 1], 0)
  k.ico(STEAM, r * 0.42, [x - 0.03, top + 0.3, z + 0.02], [1, 0.8, 1], 0)
  k.ico(STEAM, r * 0.3, [x + 0.03, top + 0.42, z - 0.01], [1, 0.8, 1], 0)
}

// An electric scooter-bike, the kind every courier rides, parked at x, z with its nose turned
// ry from +x. A top box when `box` is given.
function ebike(k: PropKit, x: number, z: number, ry: number, body: string, box?: string) {
  const P = frame(x, z, ry)
  const R: V3 = [0, ry, 0]
  const tyre: Look = { c: '#1b1b1b', r: 0.9 }
  const shell: Look = { c: body, r: 0.5 }
  for (const dx of [-0.3, 0.3]) k.torus(tyre, 0.11, 0.03, P(dx, 0.13, 0), R, Math.PI * 2, 10, 3)
  k.box(shell, [0.42, 0.13, 0.13], P(0, 0.3, 0), R)
  k.box(DARK, [0.34, 0.04, 0.17], P(0.03, 0.18, 0), R)
  k.rod(shell, P(0.3, 0.13, 0), P(0.23, 0.58, 0), 0.025, 5)
  k.box(shell, [0.08, 0.16, 0.16], P(0.25, 0.47, 0), R)
  k.box({ c: '#fff6d8', r: 0.4 }, [0.02, 0.05, 0.08], P(0.29, 0.5, 0), R)
  k.box(DARK, [0.03, 0.03, 0.4], P(0.22, 0.6, 0), R)
  k.box(shell, [0.3, 0.1, 0.14], P(-0.1, 0.35, 0), R)
  k.box(DARK, [0.3, 0.05, 0.15], P(-0.1, 0.42, 0), R)
  k.box(shell, [0.2, 0.03, 0.13], P(-0.3, 0.27, 0), R)
  if (box) {
    k.box({ c: box, r: 0.7 }, [0.26, 0.24, 0.26], P(-0.32, 0.56, 0), R)
    k.box({ c: '#fafafa', r: 0.7 }, [0.27, 0.05, 0.27], P(-0.32, 0.6, 0), R)
  }
}

const xz = (p: V3): [number, number] => [p[0], p[2]]

// A steamed bun cart: steel body on two wheels, steamers on top, a red umbrella with a lamp, the
// cook behind it. Customers' side faces +z of the frame.
function bunCart(k: PropKit, x: number, z: number, ry: number, r: () => number) {
  const P = frame(x, z, ry)
  const R: V3 = [0, ry, 0]
  const steel: Look = { c: '#c4c9cc', r: 0.45 }
  k.box(steel, [0.9, 0.42, 0.48], P(0, 0.5, 0), R)
  k.box({ c: '#a63a2a', r: 0.7 }, [0.92, 0.12, 0.5], P(0, 0.66, 0), R)
  k.box({ c: '#8c9296', r: 0.5 }, [0.94, 0.03, 0.52], P(0, 0.73, 0), R)
  for (const dz of [-0.26, 0.26]) k.torus({ c: '#1b1b1b', r: 0.9 }, 0.15, 0.03, P(-0.3, 0.15, dz), R, Math.PI * 2, 10, 3)
  for (const dz of [-0.2, 0.2]) k.box(steel, [0.04, 0.3, 0.04], P(0.4, 0.15, dz), R)
  const [ax, , az] = P(0.18, 0, 0)
  steamers(k, ax, 0.745, az, 4)
  const [bx, , bz] = P(-0.18, 0, 0.02)
  steamers(k, bx, 0.745, bz, 3, 0.13)
  // A sign board across the front with three characters.
  k.box({ c: '#b71c1c', r: 0.7 }, [0.6, 0.18, 0.02], P(0, 0.5, 0.25), R)
  // (Characters drawn for a cart facing +z, as every cart here does.)
  for (let i = 0; i < 3; i++) glyph(k, GOLD, 'x', P(-0.18 + i * 0.18, 0.5, 0.262), 0.13, r)
  k.rod(IRON, P(-0.42, 0.7, -0.2), P(-0.42, 1.85, -0.2), 0.015, 4)
  k.cone({ c: '#c62828', r: 0.8 }, 0.62, 0.26, P(-0.42, 1.96, -0.2), undefined, 8)
  k.sphere(WARM, 0.06, P(-0.42, 1.72, -0.2), [1, 1, 1], 6, 4)
  person(k, ...xz(P(0.05, 0, -0.42)), ry, who(r, { shirt: '#fafafa', hat: '#fafafa' }))
}
// A tier of tiled roof with upswept corners, w by d at the eaves, rising h, sitting on p.
function eaves(k: PropKit, w: number, d: number, h: number, p: V3, tile = TILE, under = RED) {
  frustum(k, tile, w, d, h, 0.45, p)
  k.box(tile, [w * 0.5, 0.08, d * 0.12], [p[0], p[1] + h + 0.02, p[2]])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.cone(tile, 0.09, 0.45, [p[0] + sx * w / 2, p[1] + 0.12, p[2] + sz * d / 2], [sz * 0.9, 0, -sx * 0.9], 5)
  }
  k.box(under, [w * 0.9, 0.12, d * 0.9], [p[0], p[1] - 0.06, p[2]])
}

// A red lantern with gold caps and a tassel, hanging from a cord at its top (y).
function lantern(k: PropKit, x: number, y: number, z: number, r = 0.16, cord = 0.12) {
  nub(k, DARK, [0.012, cord, 0.012], [x, y - cord / 2, z])
  k.sphere(LANTERN, r, [x, y - cord - r * 0.85, z], [1, 0.85, 1], 8, 5)
  k.cyl(GOLD, r * 0.45, r * 0.45, 0.04, [x, y - cord - 0.02, z], undefined, 6)
  k.cyl(GOLD, r * 0.45, r * 0.45, 0.04, [x, y - cord - r * 1.7 + 0.02, z], undefined, 6)
  nub(k, { c: '#fdd835', r: 0.8 }, [0.025, r, 0.025], [x, y - cord - r * 2.2, z])
}

// A stone bank building facing +z, lit windows in rows, a dome or a clock tower on some, and
// something on the pavement in front (st): a bun cart, couriers' bikes, a fruit stall.
type Bank = { w: number; floors: number; top: 'dome' | 'clock' | 'flat' | 'mansard'; stone: Look; bikes?: boolean; st?: number }
const BANKS: Bank[] = [
  { w: 5.0, floors: 5, top: 'dome', stone: STONE, st: 0 },
  { w: 4.0, floors: 6, top: 'flat', stone: { c: '#c9bda8', r: 0.85 }, bikes: true, st: 1 },
  { w: 4.6, floors: 5, top: 'mansard', stone: { c: '#ddd3c2', r: 0.85 }, st: 2 },
  { w: 3.6, floors: 6, top: 'flat', stone: { c: '#bfb5a2', r: 0.85 }, st: 3 },
  { w: 5.4, floors: 4, top: 'mansard', stone: STONE, bikes: true, st: 4 },
]
// Tall enough that the top row of windows sits under the cornice with a dentil course above.
const bankH = (floors: number) => floors * 1.15 + 1.5
function bank(k: PropKit, b: Bank) {
  const H = bankH(b.floors)
  const f = D / 2
  k.box(b.stone, [b.w, H, D], [0, H / 2, 0])
  k.box(GRANITE, [b.w + 0.06, 1.4, D + 0.06], [0, 0.7, 0])
  for (let i = 0; i < 3; i++) k.box({ c: '#7d7871', r: 0.9 }, [b.w + 0.08, 0.04, D + 0.08], [0, 0.35 + i * 0.4, 0])
  k.box(STONE_D, [b.w + 0.16, 0.2, D + 0.16], [0, H, 0])
  k.box(STONE_D, [b.w + 0.08, 0.1, D + 0.08], [0, 1.45, 0])
  // Arched doorway with bronze doors and a lamp each side.
  k.box(GRANITE, [1.1, 1.3, 0.08], [0, 0.65, f + 0.03])
  archTop(k, GRANITE, 1.1, 0.08, [0, 1.3, f + 0.03])
  k.box({ c: '#5d4a2c', r: 0.4, m: 0.25 }, [0.8, 1.15, 0.06], [0, 0.58, f + 0.06])
  for (const s of [-1, 1]) k.box(WIN, [0.12, 0.2, 0.12], [s * 0.75, 1.2, f + 0.15])
  // A pediment over the door on brackets, and granite steps up to it.
  frustum(k, STONE_D, 1.0, 0.22, 0.3, 0.05, [0, 1.92, f + 0.11])
  k.box(STONE_D, [1.0, 0.06, 0.22], [0, 1.89, f + 0.11])
  for (const s of [-1, 1]) k.box(STONE_D, [0.08, 0.2, 0.18], [s * 0.42, 1.76, f + 0.09])
  for (let i = 0; i < 2; i++) k.box(GRANITE, [1.5 - i * 0.2, 0.1, 0.5 - i * 0.2], [0, 0.05 + i * 0.1, f + 0.25 - i * 0.1])
  // A dentil course under the cornice.
  for (let x = -b.w / 2 + 0.15; x < b.w / 2 - 0.05; x += 0.36) nub(k, STONE_D, [0.14, 0.09, 0.06], [x, H - 0.14, f + 0.03])
  // Rows of lit windows between engaged columns.
  const n = Math.round(b.w / 0.75)
  for (let fl = 1; fl < b.floors + 1; fl++) for (let i = 0; i < n; i++) {
    const x = -b.w / 2 + (b.w / n) * (i + 0.5)
    const y = 1.5 + (fl - 1) * 1.15 + 0.5
    if (fl === 1 && Math.abs(x) < 0.7) continue
    k.box(WIN, [0.36, 0.62, 0.02], [x, y, f + 0.006])
    nub(k, STONE_D, [0.44, 0.06, 0.08], [x, y - 0.35, f + 0.03])
    if (fl === b.floors) archTop(k, STONE_D, 0.4, 0.05, [x, y + 0.32, f + 0.02])
    else nub(k, STONE_D, [0.44, 0.06, 0.08], [x, y + 0.35, f + 0.03])
  }
  for (let i = 0; i <= n; i++) {
    const x = -b.w / 2 + (b.w / n) * i
    k.cyl(b.stone, 0.07, 0.07, H - 1.7, [x, 1.5 + (H - 1.7) / 2, f + 0.06], undefined, 8)
  }
  if (b.bikes) bikeRow(k, -b.w / 2 + 0.7, f + 0.75, 4)
  if (b.top !== 'flat') {
    // A balustrade round the roof.
    for (let x = -b.w / 2 + 0.15; x < b.w / 2 - 0.1; x += 0.3) nub(k, STONE_D, [0.09, 0.3, 0.09], [x, H + 0.25, f - 0.08])
    k.box(STONE_D, [b.w, 0.08, 0.16], [0, H + 0.43, f - 0.08])
  }
  if (b.top === 'dome') {
    k.cyl(b.stone, 1.4, 1.5, 1.2, [0, H + 0.7, 0], undefined, 16)
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.5) / 12) * Math.PI * 2
      if (Math.cos(a) > -0.3) k.box(WIN, [0.22, 0.5, 0.02], [Math.sin(a) * 1.46, H + 0.75, Math.cos(a) * 1.46], [0, a, 0])
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      k.cyl(STONE_D, 0.06, 0.06, 1.1, [Math.sin(a) * 1.5, H + 0.7, Math.cos(a) * 1.5], undefined, 6)
    }
    k.sphere({ c: '#5f7f78', r: 0.5, m: 0.25 }, 1.45, [0, H + 1.3, 0], [1, 0.95, 1], 18, 8, Math.PI / 2)
    k.cyl(STONE_D, 0.25, 0.3, 0.6, [0, H + 2.9, 0], undefined, 8)
    k.sphere(GOLD, 0.18, [0, H + 3.35, 0])
  } else if (b.top === 'mansard') {
    frustum(k, { c: '#4c5a5e', r: 0.6, m: 0.2 }, b.w, D, 1.2, 0.75, [0, H + 0.1, 0])
    for (let i = 0; i < n; i += 2) k.box(WIN, [0.3, 0.4, 0.02], [-b.w / 2 + (b.w / n) * (i + 0.5), H + 0.6, f - 0.18])
  } else {
    for (let i = 0; i < Math.round(b.w / 0.4); i++) nub(k, b.stone, [0.12, 0.3, 0.12], [-b.w / 2 + 0.2 + i * 0.4, H + 0.25, f - 0.06])
    // A flagpole on the roof with a red flag.
    k.cyl(DARK, 0.03, 0.04, 2.2, [0, H + 1.2, f - 0.8], undefined, 5)
    k.sphere(GOLD, 0.06, [0, H + 2.33, f - 0.8], [1, 1, 1], 6, 4)
    k.box(RED, [0.02, 0.5, 0.8], [0, H + 1.98, f - 0.38])
  }
  bankStreet(k, b, f)
}

// The pavement in front of each bank (clear of the door steps, |x| < 0.9).
function bankStreet(k: PropKit, b: Bank, f: number) {
  const r = rand(400 + (b.st ?? 9))
  const half = b.w / 2
  if (b.st === 0) {
    bunCart(k, 1.55, f + 0.7, 0, r)
    person(k, 1.4, f + 1.2, Math.PI, who(r))
    person(k, 1.85, f + 1.15, Math.PI + 0.4, who(r, { s: 0.75, shirt: '#f9a825' }))
    person(k, -1.6, f + 0.95, Math.PI / 2, who(r, { walk: 0.35 }))
  } else if (b.st === 1) {
    k.box({ c: '#2e7d32', r: 0.6 }, [0.3, 0.55, 0.3], [1.3, 0.275, f + 0.35])
    k.box({ c: '#ffb300', r: 0.6 }, [0.32, 0.06, 0.32], [1.3, 0.58, f + 0.35])
    person(k, 1.1, f + 1.0, -Math.PI / 2, who(r, { walk: 0.4 }))
    person(k, 1.45, f + 1.05, -Math.PI / 2, who(r, { walk: 0.3, dress: true, shirt: '#c2185b' }))
  } else if (b.st === 2) {
    ebike(k, 1.15, f + 0.75, 0.35, '#1e88e5', '#fdd835')
    ebike(k, 1.75, f + 0.75, 0.35, '#e53935')
    person(k, -1.3, f + 0.9, Math.PI / 2, who(r, { walk: 0.35 }))
    person(k, -1.65, f + 1.1, Math.PI / 2, who(r, { walk: 0.3, pose: 'photo' }))
  } else if (b.st === 3) {
    // A red post box and a man on his phone.
    k.box({ c: '#2e7d32', r: 0.6 }, [0.4, 0.75, 0.32], [1.2, 0.375, f + 0.3])
    k.box({ c: '#1b5e20', r: 0.6 }, [0.44, 0.05, 0.36], [1.2, 0.77, f + 0.3])
    person(k, -1.25, f + 0.85, Math.PI * 0.85, who(r, { pose: 'photo' }))
  } else if (b.st === 4) {
    // A fruit stall: crates of oranges, apples, lychees and melons under a striped awning.
    const x = 1.75
    k.box(TIMBER, [1.3, 0.5, 0.6], [x, 0.25, f + 0.55])
    const fruit = ['#ff9800', '#d32f2f', '#c2185b', '#7cb342']
    for (let i = 0; i < 4; i++) {
      k.box({ c: '#a1773f', r: 0.9 }, [0.28, 0.12, 0.5], [x - 0.45 + i * 0.3, 0.56, f + 0.55], [-0.25, 0, 0])
      for (let j = 0; j < 4; j++) k.ico({ c: fruit[i], r: 0.7 }, 0.055, [x - 0.5 + i * 0.3 + (j % 2) * 0.1, 0.64 + (j > 1 ? 0.05 : 0), f + 0.45 + (j > 1 ? -0.12 : 0.1)], [1, 1, 1], 0)
    }
    for (const dx of [-0.62, 0.62]) k.box(IRON, [0.03, 1.5, 0.03], [x + dx, 0.75, f + 0.85])
    for (let i = 0; i < 6; i++) k.box({ c: i % 2 ? '#fafafa' : '#2e7d32', r: 0.8 }, [0.22, 0.03, 0.95], [x - 0.55 + i * 0.22, 1.5, f + 0.45], [0.22, 0, 0])
    person(k, x, f + 0.12, 0, who(r))
    person(k, x - 0.2, f + 1.15, Math.PI, who(r, { hair: '#8f8f8f', shirt: '#5d4037' }))
    person(k, -half + 0.6, f + 1.2, -Math.PI / 2, who(r, { walk: 0.4 }))
  }
}

// Shared bicycles in a row on the pavement, side on to the kerb.
function bikeRow(k: PropKit, x0: number, z: number, n: number) {
  const frame: Look = { c: '#f2b134', r: 0.6 }
  const tyre: Look = { c: '#1b1b1b', r: 0.9 }
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 0.32
    for (const dz of [-0.26, 0.26]) k.torus(tyre, 0.14, 0.02, [x, 0.16, z + dz], [0, Math.PI / 2, 0], Math.PI * 2, 10, 3)
    k.rod(frame, [x, 0.16, z - 0.26], [x, 0.36, z + 0.02], 0.018, 4)
    k.rod(frame, [x, 0.36, z + 0.02], [x, 0.16, z + 0.26], 0.018, 4)
    k.rod(frame, [x, 0.16, z - 0.26], [x, 0.4, z - 0.08], 0.018, 4)
    k.rod(frame, [x, 0.4, z - 0.08], [x, 0.36, z + 0.02], 0.018, 4)
    k.rod(frame, [x, 0.16, z + 0.26], [x, 0.48, z + 0.2], 0.018, 4)
    k.box(DARK, [0.06, 0.03, 0.12], [x, 0.42, z - 0.1])
    k.box(DARK, [0.26, 0.02, 0.02], [x, 0.49, z + 0.2])
    k.box(frame, [0.14, 0.08, 0.1], [x, 0.42, z + 0.28])
  }
  // The rack they're locked to.
  k.box({ c: '#3b3f44', r: 0.6 }, [n * 0.32, 0.03, 0.03], [x0 + (n - 1) * 0.16, 0.3, z + 0.36])
  for (const s of [-1, 1]) k.box({ c: '#3b3f44', r: 0.6 }, [0.03, 0.3, 0.03], [x0 + (n - 1) * 0.16 + s * n * 0.15, 0.15, z + 0.36])
}

// The customs house: a tall clock tower in stages, a lit clock on each face.
function clockTower(k: PropKit) {
  bank(k, { w: 6.4, floors: 5, top: 'flat', stone: STONE })
  const H = bankH(5)
  k.box(STONE, [2.6, 4.2, 2.6], [0, H + 2.1, 0.4])
  k.box(STONE_D, [2.8, 0.2, 2.8], [0, H + 4.2, 0.4])
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    k.cyl(WARM, 0.85, 0.85, 0.04, [dx * 1.32, H + 3.0, 0.4 + dz * 1.32], [Math.PI / 2, ry, 0], 24)
    k.box(DARK, [0.05, 0.6, 0.02], [dx * 1.36, H + 3.2, 0.4 + dz * 1.36], [0, ry, 0])
    k.box(DARK, [0.45, 0.05, 0.02], [dx * 1.36 + dz * 0.15, H + 3.0, 0.4 + dz * 1.36 - dx * 0.15], [0, ry, 0])
    k.box(STONE_D, [1.9, 0.1, 0.1], [dx * 1.32, H + 2.0, 0.4 + dz * 1.32], [0, ry, 0])
  }
  k.box(STONE, [1.8, 1.4, 1.8], [0, H + 5.0, 0.4])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(STONE_D, 0.08, 0.08, 1.4, [sx * 0.9, H + 5.0, 0.4 + sz * 0.9], undefined, 6)
  frustum(k, { c: '#5f7f78', r: 0.5, m: 0.25 }, 1.6, 1.6, 1.4, 0.2, [0, H + 5.7, 0.4])
  k.cyl(GOLD, 0.03, 0.05, 1.0, [0, H + 7.6, 0.4], undefined, 6)
  // Two flower-sellers and tourists on its steps.
  const r = rand(77)
  person(k, -2.2, D / 2 + 0.9, Math.PI / 2, who(r, { walk: 0.35 }))
  person(k, 2.0, D / 2 + 0.8, -Math.PI * 0.6, who(r, { pose: 'photo' }))
  person(k, 2.35, D / 2 + 1.05, -Math.PI * 0.6, who(r, { pose: 'wave', dress: true }))
}

// A red ceremonial gate over the road: four pillars, beams and three tiers of roof.
function gate(k: PropKit) {
  for (const x of [-4.4, -2.9, 2.9, 4.4]) {
    k.cyl(RED, 0.22, 0.24, 5.0, [x, 2.5, 0], undefined, 12)
    k.box(GRANITE, [0.8, 0.5, 0.8], [x, 0.25, 0])
    k.box(GRANITE, [0.5, 0.9, 1.2], [x, 0.45, 0])
  }
  // Painted beams: red with blue and green bands, a gold name board in the middle.
  for (const y of [3.4, 4.4]) {
    k.box(RED, [9.4, 0.36, 0.5], [0, y, 0])
    k.box({ c: '#1f5f8b', r: 0.7 }, [9.42, 0.1, 0.52], [0, y + 0.12, 0])
    k.box({ c: '#2e7d4f', r: 0.7 }, [9.42, 0.06, 0.52], [0, y - 0.12, 0])
  }
  for (const s of [-1, 1]) {
    k.box(GOLD, [1.4, 0.8, 0.1], [0, 3.9, s * 0.3])
    k.box(RED, [1.2, 0.6, 0.12], [0, 3.9, s * 0.31])
    const r = rand(55)
    for (let i = 0; i < 3; i++) glyph(k, GOLD, 'x', [-0.36 + i * 0.36, 3.9, s * 0.375], 0.3, r)
  }
  eaves(k, 3.8, 1.6, 0.9, [0, 5.0, 0])
  for (const s of [-1, 1]) eaves(k, 2.4, 1.4, 0.7, [s * 3.65, 4.6, 0])
  k.box(GOLD, [0.2, 0.3, 0.2], [0, 6.1, 0])
  // A pair of stone lions guarding each side of the approach, facing the oncoming road.
  for (const s of [-1, 1]) lion(k, s * 3.65, -1.1, s)
  // Lanterns hanging under each side span.
  for (const s of [-1, 1]) {
    k.cyl(DARK, 0.01, 0.01, 0.5, [s * 3.65, 3.0, 0], undefined, 4)
    k.sphere(LANTERN, 0.26, [s * 3.65, 2.6, 0], [1, 0.85, 1], 12, 8)
    k.cyl(GOLD, 0.12, 0.12, 0.06, [s * 3.65, 2.82, 0], undefined, 10)
    k.cyl(GOLD, 0.12, 0.12, 0.06, [s * 3.65, 2.38, 0], undefined, 10)
  }
}

// A guardian lion sitting on a plinth at x, z, facing -z; side s puts its raised paw on the
// inside (a ball under the male's paw on the left, a cub under the female's on the right).
function lion(k: PropKit, x: number, z: number, s: number) {
  const st: Look = { c: '#a9a399', r: 0.9 }
  const mane: Look = { c: '#97918a', r: 0.95 }
  k.box(GRANITE, [0.75, 0.5, 0.95], [x, 0.25, z])
  k.box(STONE_D, [0.8, 0.06, 1.0], [x, 0.53, z])
  k.box(st, [0.6, 0.12, 0.8], [x, 0.62, z])
  // Haunches, chest, forelegs.
  k.sphere(st, 0.27, [x, 0.85, z + 0.18], [1, 0.9, 1.1], 8, 6)
  k.sphere(st, 0.24, [x, 1.05, z - 0.08], [1, 1.25, 0.9], 8, 6)
  for (const dx of [-0.13, 0.13]) k.cyl(st, 0.07, 0.08, 0.45, [x + dx, 0.88, z - 0.2], undefined, 6)
  // Mane, head, snout and the curls on top.
  k.ico(mane, 0.26, [x, 1.38, z - 0.12], [1, 1, 0.85], 1)
  k.box(st, [0.3, 0.2, 0.18], [x, 1.36, z - 0.32])
  k.box(mane, [0.18, 0.1, 0.12], [x, 1.32, z - 0.43])
  for (const dx of [-0.09, 0.09]) k.sphere({ c: '#5a5650', r: 0.9 }, 0.035, [x + dx, 1.43, z - 0.41], [1, 1, 1], 6, 4)
  k.box({ c: '#7a3a2a', r: 0.9 }, [0.14, 0.03, 0.04], [x, 1.27, z - 0.42])
  // Ball (or cub) under the inner forepaw.
  k.sphere(st, 0.1, [x - s * 0.15, 0.78, z - 0.3], [1, 1, 1], 8, 6)
  k.cyl(st, 0.05, 0.05, 0.3, [x + s * 0.15, 0.75, z - 0.12], undefined, 6)
  k.cyl(st, 0.06, 0.06, 0.1, [x - s * 0.15, 0.9, z - 0.3], undefined, 6)
}

// A seven-storey pagoda, each storey a little smaller, with a gold finial, standing on p.
function pagoda(k: PropKit, p: V3 = [0, 0, 0]) {
  const [px, , pz] = p
  k.box(GRANITE, [5.2, 0.6, 5.2], [px, 0.3, pz])
  for (let i = 0; i < 3; i++) k.box(GRANITE, [1.6, 0.2, 0.4], [px, 0.1 + i * 0.2, pz + 2.9 - i * 0.2])
  let y = 0.6
  for (let i = 0; i < 7; i++) {
    const w = 3.6 - i * 0.32
    const h = i === 0 ? 1.6 : 1.15
    k.cyl({ c: '#e9dcc4', r: 0.85 }, w / 2, w / 2 + 0.05, h, [px, y + h / 2, pz], [0, Math.PI / 8, 0], 8)
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2
      k.box(RED, [0.1, h, 0.1], [px + Math.sin(a) * w / 2, y + h / 2, pz + Math.cos(a) * w / 2])
      if (j % 2 === 0) k.box(WIN, [0.35, h * 0.5, 0.02], [px + Math.sin(a + Math.PI / 8) * (w / 2 - 0.02), y + h * 0.5, pz + Math.cos(a + Math.PI / 8) * (w / 2 - 0.02)], [0, a + Math.PI / 8, 0])
    }
    y += h
    eaves(k, w + 1.1, w + 1.1, 0.45, [px, y, pz])
    // A little lantern at each eave corner.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) lantern(k, px + sx * (w + 0.9) / 2, y - 0.08, pz + sz * (w + 0.9) / 2, 0.09, 0.06)
    y += 0.3
  }
  k.cyl(GOLD, 0.08, 0.12, 2.0, [px, y + 1.0, pz], undefined, 8)
  for (let i = 0; i < 5; i++) k.torus(GOLD, 0.16, 0.04, [px, y + 0.4 + i * 0.3, pz], [Math.PI / 2, 0, 0], Math.PI * 2, 10, 4)
}

// The promenade along the embankment, 6 long: the granite flood wall and iron rail, a lamp
// post, a plane tree, a flower bed and a bench facing the river.
function rail(k: PropKit) {
  railRun(k, -3, 3)
  k.box({ c: '#6d6a64', r: 0.95 }, [0.8, 0.04, 6], [-0.55, 0.02, 0])
  planeTree(k, 1.05, 3)
  // A granite flower bed with low shrubs and a row of flowers.
  k.box(GRANITE, [0.7, 0.3, 1.9], [0.75, 0.15, -1.1])
  k.box({ c: '#3d2e22', r: 1 }, [0.6, 0.02, 1.8], [0.75, 0.3, -1.1])
  for (let i = 0; i < 4; i++) k.ico({ c: i % 2 ? '#3f6a34' : '#4c7a3c', r: 1 }, 0.17, [0.75, 0.38, -1.8 + i * 0.47], [1.1, 0.7, 1], 0)
  for (let i = 0; i < 7; i++) k.box({ c: ['#d9343a', '#f2c233', '#f4f0e6'][i % 3], r: 0.8 }, [0.07, 0.07, 0.07], [0.75 + (i % 2 ? 0.2 : -0.2), 0.38, -1.95 + i * 0.28])
  k.cyl(IRON, 0.05, 0.07, 2.6, [0, 1.3, 0], undefined, 8)
  for (const s of [-1, 1]) {
    k.rod(IRON, [0, 2.4, 0], [0, 2.55, s * 0.4], 0.025, 5)
    k.sphere(WARM, 0.13, [0, 2.45, s * 0.42], [1, 1, 1], 8, 6)
  }
  // A slatted bench facing the river on cast iron legs.
  for (let i = 0; i < 3; i++) k.box({ c: '#7a5232', r: 0.85 }, [0.1, 0.03, 1.1], [0.42 + i * 0.11, 0.3, 1.2])
  for (let i = 0; i < 2; i++) k.box({ c: '#7a5232', r: 0.85 }, [0.03, 0.09, 1.1], [0.72, 0.42 + i * 0.12, 1.2])
  for (const dz of [-0.48, 0.48]) {
    k.box(IRON, [0.36, 0.04, 0.04], [0.55, 0.28, 1.2 + dz])
    k.box(IRON, [0.04, 0.3, 0.04], [0.42, 0.14, 1.2 + dz])
    k.box(IRON, [0.04, 0.6, 0.04], [0.72, 0.3, 1.2 + dz])
  }
  // A litter bin.
  k.cyl({ c: '#455a64', r: 0.6 }, 0.12, 0.11, 0.5, [0.3, 0.25, 2.2], undefined, 8)
  k.cyl({ c: '#263238', r: 0.6 }, 0.13, 0.13, 0.05, [0.3, 0.52, 2.2], undefined, 8)
}

// The flood wall and its iron rail from z0 to z1.
function railRun(k: PropKit, z0: number, z1: number) {
  const L = z1 - z0
  const zc = (z0 + z1) / 2
  k.box(GRANITE, [0.3, 0.5, L], [0, 0.25, zc])
  k.box(STONE_D, [0.36, 0.06, L], [0, 0.53, zc])
  for (let z = z0 + 0.3; z <= z1 - 0.29; z += 0.6) {
    nub(k, IRON, [0.05, 0.66, 0.05], [0, 0.89, z])
    // A diamond between each pair of posts.
    if (z < z1 - 0.6) nub(k, IRON, [0.02, 0.2, 0.2], [0, 0.86, z + 0.3], [Math.PI / 4, 0, 0])
  }
  k.box(IRON, [0.08, 0.06, L], [0, 1.1, zc])
  k.box(IRON, [0.05, 0.04, L], [0, 0.62, zc])
}

// A plane tree in a granite tree pit: a mottled trunk, forked limbs, a broad leafy crown.
function planeTree(k: PropKit, x: number, z: number) {
  const bark: Look = { c: '#a39a82', r: 0.9 }
  const patch: Look = { c: '#cfc7ad', r: 0.9 }
  k.box(GRANITE, [0.6, 0.06, 0.6], [x, 0.03, z])
  k.box({ c: '#3d2e22', r: 1 }, [0.48, 0.02, 0.48], [x, 0.06, z])
  k.rod(bark, [x, 0, z], [x - 0.05, 1.7, z + 0.05], 0.1, 7)
  for (const [dx, dy, dz] of [[0.04, 0.5, 0.1], [-0.06, 1.1, -0.08], [0.07, 1.4, 0.03]] as const) k.box(patch, [0.07, 0.16, 0.08], [x + dx, dy, z + dz])
  k.rod(bark, [x - 0.05, 1.7, z + 0.05], [x + 0.35, 2.6, z + 0.4], 0.07, 6)
  k.rod(bark, [x - 0.05, 1.7, z + 0.05], [x - 0.3, 2.7, z - 0.35], 0.07, 6)
  k.rod(bark, [x - 0.05, 1.7, z + 0.05], [x + 0.1, 2.8, z - 0.1], 0.06, 5)
  const leaf = ['#3c6a32', '#4a7a3a', '#35602c']
  ;[[0.35, 2.95, 0.4, 0.8], [-0.35, 3.0, -0.4, 0.8], [0.05, 3.35, -0.05, 0.85]].forEach(([dx, y, dz, r], i) => k.ico({ c: leaf[i % 3], r: 1 }, r, [x + dx, y, z + dz], [1, 0.72, 1], 1))
}

// A string of red lanterns across the road.
function lanterns(k: PropKit) {
  const span = EDGE * 2 + 3.4
  k.rod(DARK, [-span / 2, 4.8, 0], [0, 4.3, 0], 0.012, 4)
  k.rod(DARK, [0, 4.3, 0], [span / 2, 4.8, 0], 0.012, 4)
  for (let i = 1; i < 9; i++) {
    const x = -span / 2 + (span / 9) * i
    const y = 4.8 - Math.sin((i / 9) * Math.PI) * 0.5 - 0.35
    k.sphere(LANTERN, 0.18, [x, y, 0], [1, 0.85, 1], 8, 5)
    k.cyl(GOLD, 0.08, 0.08, 0.05, [x, y + 0.16, 0], undefined, 8)
    k.cyl(GOLD, 0.08, 0.08, 0.05, [x, y - 0.16, 0], undefined, 8)
    nub(k, { c: '#fdd835', r: 0.8 }, [0.03, 0.18, 0.03], [x, y - 0.27, 0])
  }
}

// A lane (lilong) running back between two buildings, facing +z like a bank, 2.6 wide: a carved
// stone gate at its mouth with a lit name board, grey brick walls with lit windows, a red
// door at the far end, lanterns and washing overhead, bikes, a cycle rickshaw and the neighbours,
// and vertical shop signs hung out either side of the mouth, lit after dark.
const LANE_W = 2.6
const GATE: Look = { c: '#bdb3a2', r: 0.9 }
const BRICKG: Look = { c: '#5f5a55', r: 0.95 }
const BRICKR: Look = { c: '#8a4a3a', r: 0.95 }
function lane(k: PropKit) {
  const f = D / 2
  k.box({ c: '#77736c', r: 0.95 }, [LANE_W + 0.1, 0.02, 9.2], [0, 0.01, -2.4])
  // The gate: pillars, a lintel, a curved pediment with the name board and finials.
  for (const s of [-1, 1]) {
    k.box(GATE, [0.35, 2.8, 0.4], [s * 1.08, 1.4, f - 0.3])
    k.box(GATE, [0.45, 0.12, 0.5], [s * 1.08, 0.06, f - 0.3])
    k.box(GATE, [0.2, 0.25, 0.2], [s * 1.08, 3.27, f - 0.3])
    k.sphere(GATE, 0.12, [s * 1.08, 3.5, f - 0.3], [1, 1, 1], 8, 6)
  }
  k.box(GATE, [LANE_W - 0.1, 0.35, 0.45], [0, 2.97, f - 0.3])
  k.box(GATE, [1.9, 0.5, 0.3], [0, 3.38, f - 0.3])
  archTop(k, GATE, 1.9, 0.3, [0, 3.63, f - 0.3], 0, 0.45)
  k.box(WARM, [1.1, 0.28, 0.02], [0, 3.4, f - 0.14])
  const gr = rand(31)
  for (let i = 0; i < 4; i++) glyph(k, { c: '#3a1a12', r: 0.8 }, 'x', [-0.39 + i * 0.26, 3.4, f - 0.125], 0.2, gr)
  k.box(BRICKR, [1.3, 0.04, 0.06], [0, 3.22, f - 0.12])
  // The lane walls beyond the banks, with lit windows facing in, and the far end.
  for (const s of [-1, 1]) {
    k.box(BRICKG, [0.2, 3.4, 5.2], [s * 1.2, 1.7, -4.6])
    for (const y of [1.15, 2.3]) k.box(BRICKR, [0.22, 0.08, 5.2], [s * 1.2, y, -4.6])
    for (const z of [-3.2, -5.4]) {
      k.box(WARM, [0.02, 0.45, 0.32], [s * 1.09, 1.7, z])
      k.box(GATE, [0.06, 0.05, 0.42], [s * 1.08, 1.45, z])
      // A black shikumen door with a stone frame under each window.
      k.box(GATE, [0.04, 1.1, 0.6], [s * 1.085, 0.55, z + 0.75])
      k.box({ c: '#141414', r: 0.6 }, [0.04, 0.95, 0.46], [s * 1.075, 0.48, z + 0.75])
    }
    k.cyl({ c: '#2a5d8f', r: 0.5 }, 0.13, 0.1, 0.24, [s * 0.9, 0.12, -2.4], undefined, 8)
    k.ico({ c: '#3f7a3a', r: 1 }, 0.18, [s * 0.9, 0.38, -2.4], [1, 0.9, 1], 0)
  }
  k.box(BRICKG, [LANE_W, 3.4, 0.3], [0, 1.7, -7.1])
  k.box(BRICKR, [LANE_W, 0.08, 0.32], [0, 2.3, -7.1])
  k.box(GATE, [0.9, 1.6, 0.06], [0, 0.8, -6.93])
  k.box({ c: '#6a1a16', r: 0.6 }, [0.7, 1.4, 0.06], [0, 0.7, -6.91])
  k.box(WARM, [0.5, 0.35, 0.02], [0, 2.8, -6.94])
  // Lanterns strung across the lane.
  for (const [z, span] of [[0.2, LANE_W + 0.3], [-3.8, 2.2]]) {
    k.box(DARK, [span, 0.015, 0.015], [0, 3.15, z])
    for (const x of [-0.6, 0, 0.6]) {
      k.sphere(LANTERN, 0.15, [x, 2.85, z], [1, 0.85, 1], 8, 6)
      k.cyl(GOLD, 0.07, 0.07, 0.04, [x, 2.99, z], undefined, 6)
      nub(k, DARK, [0.01, 0.15, 0.01], [x, 3.08, z])
    }
  }
  // Washing on bamboo poles across the lane.
  const cloth = ['#fafafa', '#e57373', '#64b5f6', '#ffd54f', '#81c784', '#ba68c8']
  for (const z of [-2.6, -5.6]) {
    k.rod(BAMBOO, [-1.1, 2.55, z], [1.1, 2.6, z + 0.1], 0.025, 5)
    for (let i = 0; i < 5; i++) {
      const x = -0.85 + i * 0.42
      const pants = (i + (z < -4 ? 1 : 0)) % 3 === 0
      k.box({ c: cloth[(i * 2 + (z < -4 ? 1 : 0)) % cloth.length], r: 0.9 }, pants ? [0.2, 0.42, 0.02] : [0.3, 0.32, 0.02], [x, pants ? 2.34 : 2.4, z + 0.05 + (x + 1.1) * 0.022])
    }
  }
  bikeRow(k, -0.95, -1.2, 3)
  rickshaw(k, 0.55, f - 1.0)
  // A grandmother on her way out and a boy with a kite.
  const r = rand(19)
  person(k, -0.35, -3.4, 0.2, who(r, { hair: '#9a9a9a', shirt: '#5c6bc0', walk: 0.25 }))
  person(k, 0.3, -4.6, Math.PI * 0.9, who(r, { s: 0.72, pose: 'wave' }))
  // Vertical shop signs on the fronts each side of the lane mouth.
  sign(k, -1.75, 2.3, 2.2, LANTERN, DARK, 1)
  sign(k, -1.75, 4.8, 1.4, WARM, RED, 2)
  sign(k, 1.75, 2.6, 1.8, WARM, RED, 3)
}

// A vertical sign hung out from a wall at x (its face along z, in the y-z plane), bottom at y,
// h tall: a red frame, a lit panel and characters on both faces.
function sign(k: PropKit, x: number, y: number, h: number, lit: Look, ink: Look, seed: number) {
  const f = D / 2
  const z = f + 0.38
  k.box(RED, [0.1, h + 0.1, 0.62], [x, y + h / 2, z])
  k.box(lit, [0.12, h - 0.06, 0.5], [x, y + h / 2, z])
  for (const dy of [h + 0.02, 0.1]) k.box(DARK, [0.03, 0.03, 0.42], [x, y + dy, f + 0.2])
  const r = rand(seed)
  const n = Math.max(2, Math.floor(h / 0.5))
  for (let i = 0; i < n; i++) {
    const cy = y + h - 0.3 - i * ((h - 0.2) / n)
    const rr = r()
    for (const sx of [-1, 1]) glyph(k, ink, 'z', [x + sx * 0.066, cy, z], 0.34, rand(Math.floor(rr * 1e6) + 1))
  }
}

// A cycle rickshaw parked facing +z: a front wheel and saddle, a red bench seat over two rear
// wheels under a folding hood.
function rickshaw(k: PropKit, x: number, z: number) {
  const tyre: Look = { c: '#1b1b1b', r: 0.9 }
  const frame: Look = { c: '#2f4f46', r: 0.6 }
  const seat: Look = { c: '#8b1e1e', r: 0.7 }
  for (const s of [-1, 1]) k.torus(tyre, 0.18, 0.025, [x + s * 0.32, 0.2, z - 0.15], [0, Math.PI / 2, 0], Math.PI * 2, 12, 3)
  k.torus(tyre, 0.18, 0.025, [x, 0.2, z + 0.75], [0, Math.PI / 2, 0], Math.PI * 2, 12, 3)
  k.rod(frame, [x - 0.32, 0.2, z - 0.15], [x + 0.32, 0.2, z - 0.15], 0.02, 4)
  k.rod(frame, [x, 0.25, z - 0.1], [x, 0.5, z + 0.5], 0.022, 4)
  k.rod(frame, [x, 0.5, z + 0.5], [x, 0.2, z + 0.75], 0.022, 4)
  k.rod(frame, [x, 0.5, z + 0.5], [x, 0.7, z + 0.6], 0.02, 4)
  k.box(DARK, [0.3, 0.02, 0.02], [x, 0.71, z + 0.62])
  k.box(DARK, [0.07, 0.03, 0.14], [x, 0.56, z + 0.38])
  k.box(frame, [0.66, 0.06, 0.4], [x, 0.36, z - 0.12])
  k.box(seat, [0.62, 0.1, 0.34], [x, 0.44, z - 0.14])
  k.box(seat, [0.62, 0.36, 0.06], [x, 0.66, z - 0.32])
  k.box(frame, [0.5, 0.03, 0.2], [x, 0.24, z + 0.16])
  archTop(k, { c: '#5a1414', r: 0.8 }, 0.7, 0.36, [x, 0.84, z - 0.22], Math.PI / 2, 0.75)
}

// Old town shophouses: a terrace of three two- or three-storey fronts under tiled roofs with
// upswept eaves, open shops lit inside, carved lattice windows, a balcony, red lanterns, a gilt
// name board over each shop and a blade sign; the shop's wares and its people out front.
type Shop = 'tea' | 'duck' | 'dumpling' | 'medicine' | 'silk' | 'noodle'
const SHOP_W = 3.6
const TERRACE_W = SHOP_W * 3
const TERRACES: { shop: Shop; floors: number; wall: string; lift: number }[][] = [
  [{ shop: 'tea', floors: 2, wall: '#e6dcc6', lift: 0 }, { shop: 'duck', floors: 1, wall: '#d8cdb5', lift: 0 }, { shop: 'dumpling', floors: 2, wall: '#cfc3a8', lift: 0.14 }],
  [{ shop: 'medicine', floors: 2, wall: '#d4cab3', lift: 0.1 }, { shop: 'silk', floors: 2, wall: '#e9e1cf', lift: 0 }, { shop: 'noodle', floors: 1, wall: '#d9ccb0', lift: 0 }],
]
function terrace(k: PropKit, i: number) {
  TERRACES[i].forEach((h, j) => shophouse(k, (j - 1) * SHOP_W, h.shop, h.floors, { c: h.wall, r: 0.9 }, h.lift, i * 3 + j))
}
function shophouse(k: PropKit, xc: number, shop: Shop, floors: number, wall: Look, lift: number, seed: number) {
  const f = D / 2
  const r = rand(900 + seed)
  const w = SHOP_W
  const top = 1.6 + floors * 1.15 + lift
  const red: Look = { c: '#8e1b14', r: 0.7 }
  // Upper storeys over a recessed shop.
  k.box(wall, [w, top - 1.6, D], [xc, 1.6 + (top - 1.6) / 2, 0])
  k.box(wall, [w, 1.6, D - 0.7], [xc, 0.8, -0.35])
  k.box(WARM, [w - 0.7, 1.3, 0.02], [xc, 0.75, f - 0.69])
  for (const s of [-1, 1]) k.box(TIMBER, [0.3, 1.6, 0.72], [xc + s * (w / 2 - 0.15), 0.8, f - 0.35])
  k.box(TIMBER, [w, 0.12, 0.74], [xc, 1.56, f - 0.36])
  k.box({ c: '#6b6762', r: 0.95 }, [w - 0.6, 0.1, 0.7], [xc, 0.05, f - 0.35])
  // A gilt name board over the shop.
  k.box({ c: '#161210', r: 0.6 }, [2.5, 0.38, 0.06], [xc, 1.84, f + 0.03])
  k.box(GOLD, [2.6, 0.04, 0.07], [xc, 2.04, f + 0.03])
  k.box(GOLD, [2.6, 0.04, 0.07], [xc, 1.64, f + 0.03])
  for (let i = 0; i < 4; i++) glyph(k, GOLD, 'x', [xc - 0.84 + i * 0.56, 1.84, f + 0.066], 0.28, r)
  // Lattice windows and red columns on the storeys above.
  for (let fl = 0; fl < floors; fl++) {
    const y = 1.6 + lift + fl * 1.15 + 0.62
    for (const s of [-1, 1]) {
      const x = xc + s * 0.85
      k.box(WIN, [0.8, 0.62, 0.02], [x, y, f + 0.006])
      nub(k, TIMBER, [0.9, 0.06, 0.06], [x, y + 0.34, f + 0.03])
      nub(k, TIMBER, [0.9, 0.06, 0.06], [x, y - 0.34, f + 0.03])
      for (const dx of [-0.42, -0.14, 0.14, 0.42]) nub(k, TIMBER, [0.035, 0.66, 0.03], [x + dx, y, f + 0.03])
      nub(k, TIMBER, [0.86, 0.03, 0.03], [x, y, f + 0.03])
    }
    if (fl === 1) {
      // A balcony with a red rail.
      k.box(TIMBER, [w - 0.1, 0.08, 0.42], [xc, y - 0.44, f + 0.21])
      k.box(red, [w - 0.1, 0.05, 0.04], [xc, y - 0.02, f + 0.4])
      for (let x = -w / 2 + 0.15; x < w / 2 - 0.1; x += 0.3) nub(k, red, [0.03, 0.4, 0.03], [xc + x, y - 0.22, f + 0.4])
    }
  }
  for (const s of [-1, 1]) k.cyl(red, 0.06, 0.06, top - 1.6, [xc + s * (w / 2 - 0.08), 1.6 + (top - 1.6) / 2, f + 0.04], undefined, 6)
  eaves(k, w + 0.3, D + 0.6 + lift * 0.4, 0.85, [xc, top, 0])
  for (const s of [-1, 1]) lantern(k, xc + s * 1.15, top - 0.12, f + 0.16, 0.15, 0.1)
  // The shop's wares.
  const cz = f - 0.12
  k.box(TIMBER, [w - 1.0, 0.55, 0.3], [xc, 0.275, cz])
  k.box({ c: '#8a5a34', r: 0.6 }, [w - 0.96, 0.04, 0.34], [xc, 0.57, cz])
  if (shop === 'duck') {
    // Roast ducks hung in a row in the window.
    k.box(IRON, [2.2, 0.02, 0.02], [xc, 1.42, f - 0.45])
    for (let i = 0; i < 6; i++) {
      const x = xc - 0.9 + i * 0.36
      k.box(IRON, [0.01, 0.1, 0.01], [x, 1.36, f - 0.45])
      k.sphere({ c: '#8e3b17', r: 0.5 }, 0.1, [x, 1.15, f - 0.45], [0.8, 1.5, 0.7], 6, 5)
      k.box({ c: '#6d2a10', r: 0.6 }, [0.03, 0.12, 0.03], [x, 0.94, f - 0.45])
    }
    k.cyl({ c: '#a1773f', r: 0.9 }, 0.18, 0.18, 0.08, [xc + 0.6, 0.63, cz], undefined, 10)
  } else if (shop === 'dumpling') {
    for (let i = 0; i < 3; i++) steamers(k, xc - 0.7 + i * 0.7, 0.59, cz, 3 + (i % 2))
  } else if (shop === 'tea') {
    for (let y = 0; y < 3; y++) {
      k.box(TIMBER, [2.4, 0.04, 0.22], [xc, 0.35 + y * 0.35, f - 0.58])
      for (let i = 0; i < 7; i++) k.cyl({ c: ['#c62828', '#2e7d32', '#f9a825', '#1565c0'][(i + y) % 4], r: 0.5 }, 0.07, 0.07, 0.2, [xc - 1.05 + i * 0.35, 0.47 + y * 0.35, f - 0.58], undefined, 6)
    }
    k.sphere({ c: '#8d4b2a', r: 0.5 }, 0.09, [xc - 0.4, 0.66, cz], [1.2, 0.8, 1.2], 6, 4)
  } else if (shop === 'medicine') {
    // A wall of little drawers with brass pulls.
    for (let y = 0; y < 4; y++) for (let i = 0; i < 9; i++) {
      nub(k, { c: '#7b4a2a', r: 0.8 }, [0.24, 0.24, 0.04], [xc - 1.12 + i * 0.28, 0.32 + y * 0.28, f - 0.66])
      if ((i + y) % 2 === 0) nub(k, GOLD, [0.04, 0.03, 0.02], [xc - 1.12 + i * 0.28, 0.32 + y * 0.28, f - 0.63])
    }
    for (let i = 0; i < 4; i++) k.cyl({ c: '#d7ccb5', r: 0.6 }, 0.07, 0.08, 0.18, [xc - 0.6 + i * 0.4, 0.68, cz], undefined, 6)
  } else if (shop === 'silk') {
    // Bolts of silk on shelves and a qipao on a stand by the door.
    const silk = ['#c62828', '#f9a825', '#1565c0', '#ad1457', '#2e7d32', '#6a1b9a']
    for (let y = 0; y < 3; y++) for (let i = 0; i < 6; i++) k.cyl({ c: silk[(i + y * 2) % 6], r: 0.4 }, 0.08, 0.08, 0.36, [xc - 1.0 + i * 0.4, 0.4 + y * 0.32, f - 0.56], [0, 0, Math.PI / 2], 6)
    k.cyl({ c: '#b71c1c', r: 0.4 }, 0.1, 0.16, 0.7, [xc + 1.25, 0.6, f + 0.25], undefined, 8)
    k.sphere({ c: '#b71c1c', r: 0.4 }, 0.11, [xc + 1.25, 1.0, f + 0.25], [1, 1.1, 0.8], 6, 4)
    k.cyl(GOLD, 0.015, 0.015, 0.95, [xc + 1.25, 0.47, f + 0.25], undefined, 4)
  } else {
    // Noodle bar: a pot of broth steaming on the counter, a stool and a diner out front.
    k.cyl(IRON, 0.2, 0.18, 0.22, [xc - 0.5, 0.7, cz], undefined, 10)
    k.ico(STEAM, 0.12, [xc - 0.5, 0.95, cz], [1.2, 0.8, 1.2], 0)
    k.ico(STEAM, 0.09, [xc - 0.45, 1.12, cz + 0.02], [1, 0.8, 1], 0)
    for (let i = 0; i < 3; i++) k.cyl({ c: '#fafafa', r: 0.4 }, 0.05, 0.035, 0.05, [xc + 0.2 + i * 0.16, 0.615, cz], undefined, 6)
    k.box({ c: '#c62828', r: 0.6 }, [0.6, 0.04, 0.4], [xc + 0.9, 0.5, f + 0.62])
    for (const dx of [-0.25, 0.25]) for (const dz of [-0.16, 0.16]) k.box({ c: '#c62828', r: 0.6 }, [0.03, 0.48, 0.03], [xc + 0.9 + dx, 0.24, f + 0.62 + dz])
    for (const dz of [-0.2, 0.2]) steamers(k, xc + 0.85, 0.52, f + 0.62 + dz, 1, 0.09)
  }
  // The shopkeeper behind the counter.
  person(k, xc + (r() - 0.5) * 0.8, f - 0.48, 0, who(r, { shirt: shop === 'duck' || shop === 'dumpling' ? '#fafafa' : undefined }))
  // A blade sign on one pier.
  if (seed % 2 === 0) blade(k, xc + w / 2 - 0.16, 2.0 + lift, Math.min(1.8, top - 2.4), f, WARM, RED, RED, 60 + seed)
  // Out front: e-bikes, potted plants, passers-by.
  if (seed % 3 === 0) ebike(k, xc - 1.1, f + 0.95, 0.1, '#ef6c00', '#1565c0')
  if (seed % 3 === 1) {
    for (const s of [-1, 1]) {
      k.cyl({ c: '#e8eef5', r: 0.4 }, 0.15, 0.11, 0.3, [xc + s * 1.45, 0.15, f + 0.25], undefined, 8)
      k.cyl({ c: '#1f4e8c', r: 0.4 }, 0.152, 0.152, 0.05, [xc + s * 1.45, 0.2, f + 0.25], undefined, 8)
      k.ico({ c: '#3f7a3a', r: 1 }, 0.2, [xc + s * 1.45, 0.45, f + 0.25], [1, 1.1, 1], 0)
    }
  }
  if (shop === 'dumpling' || shop === 'duck') {
    person(k, xc - 0.3, f + 0.45, Math.PI, who(r))
    person(k, xc + 0.15, f + 0.6, Math.PI + 0.3, who(r, { s: 0.74, shirt: '#ffeb3b' }))
  }
  if (shop === 'silk') person(k, xc - 0.7, f + 0.8, Math.PI * 0.7, who(r, { dress: true, shirt: '#ad1457', pose: 'photo' }))
  if (shop === 'noodle') person(k, xc + 0.9, f + 1.0, Math.PI / 2 + 0.2, who(r, { walk: 0.3 }))
  if (shop === 'tea') person(k, xc - 1.4, f + 1.1, -Math.PI / 2, who(r, { walk: 0.4, hair: '#9a9a9a' }))
}

// The neon shopping street: two tall blocks, 9 wide, faced in tile and glass, rows of lit
// windows, big vertical neon signs, neon bands, a rooftop sign, shop windows, couriers and
// shoppers on the pavement.
const NEON_W = 9
function neonBlock(k: PropKit) {
  const f = D / 2
  const r = rand(4242)
  const tiles: Look = { c: '#d9cfbd', r: 0.8 }
  const glass: Look = { c: '#46535e', r: 0.4 }
  const blocks = [{ x: -2.25, floors: 6, face: tiles }, { x: 2.25, floors: 5, face: glass }]
  for (const [bi, b] of blocks.entries()) {
    const H = 1.7 + b.floors * 1.15
    k.box(b.face, [4.5, H, D], [b.x, H / 2, 0])
    // Shop windows and an awning.
    k.box(WARM, [4.1, 1.2, 0.02], [b.x, 0.75, f + 0.006])
    for (let i = 0; i <= 4; i++) nub(k, DARK, [0.06, 1.3, 0.05], [b.x - 2.05 + i * 1.025, 0.75, f + 0.02])
    k.box({ c: bi ? '#00695c' : '#c62828', r: 0.7 }, [4.4, 0.06, 0.6], [b.x, 1.55, f + 0.3], [-0.25, 0, 0])
    for (let fl = 0; fl < b.floors; fl++) {
      const y = 1.7 + fl * 1.15 + 0.55
      for (let i = 0; i < 3; i++) k.box(WIN, [1.1, 0.7, 0.02], [b.x - 1.45 + i * 1.45, y, f + 0.006])
      k.box(bi ? DARK : { c: '#bfb5a2', r: 0.85 }, [4.52, 0.1, 0.06], [b.x, y - 0.5, f + 0.03])
      if (fl % 2 === 1) k.box(bi ? NEON_P : NEON_C, [4.5, 0.05, 0.03], [b.x, y - 0.44, f + 0.07])
    }
    k.box(bi ? DARK : { c: '#bfb5a2', r: 0.85 }, [4.6, 0.25, D + 0.1], [b.x, H, 0])
    // A rooftop sign on struts.
    k.box(DARK, [3.4, 0.9, 0.08], [b.x, H + 0.9, f - 0.6])
    k.box(bi ? WARM : NEON_P, [3.3, 0.8, 0.02], [b.x, H + 0.9, f - 0.55])
    for (let i = 0; i < 4; i++) glyph(k, bi ? RED : DARK, 'x', [b.x - 1.2 + i * 0.8, H + 0.9, f - 0.535], 0.6, r)
    for (const dx of [-1.4, 1.4]) k.box(DARK, [0.06, 0.5, 0.06], [b.x + dx, H + 0.3, f - 0.6])
  }
  // Big blade signs: dark panels with neon characters, neon rims.
  blade(k, -0.25, 2.3, 4.6, f, { c: '#1a1414', r: 0.8 }, NEON_P, NEON_C, 71, 0.62)
  blade(k, 4.3, 2.0, 3.2, f, WARM, RED, RED, 72, 0.5)
  blade(k, -4.3, 4.6, 2.6, f, { c: '#141a1e', r: 0.8 }, NEON_C, NEON_P, 73, 0.5)
  // A lit advert box and a row of couriers' bikes.
  k.box(DARK, [0.5, 1.5, 0.12], [-3.2, 0.75, f + 1.0])
  k.box(NEON_C, [0.42, 1.2, 0.14], [-3.2, 0.85, f + 1.0])
  for (let i = 0; i < 3; i++) ebike(k, 0.9 + i * 0.5, f + 0.8, Math.PI / 2 + 0.3, ['#fafafa', '#1e88e5', '#212121'][i], i === 1 ? '#fdd835' : undefined)
  person(k, -1.6, f + 0.7, Math.PI / 2, who(r, { walk: 0.4 }))
  person(k, -1.25, f + 0.95, Math.PI / 2, who(r, { walk: 0.35, dress: true }))
  person(k, 3.4, f + 0.9, -Math.PI / 2, who(r, { walk: 0.4, pose: 'photo' }))
  person(k, -2.6, f + 1.05, Math.PI, who(r, { pose: 'photo' }))
}

// The back row: an art deco hotel with a green pyramid roof, a tower block of flats and a
// stepped brick tower lit in strips, 24 long, facing +z.
function backRow(k: PropKit, v: number) {
  const f = 3
  const r = rand(50 + v)
  const order = v ? [2, 0, 1] : [0, 1, 2]
  order.forEach((t, i) => {
    const x = (i - 1) * 8
    if (t === 0) {
      const H = 15 + v * 2
      const st: Look = { c: '#c9bfa8', r: 0.85 }
      k.box(st, [6, H, 6], [x, H / 2, 0])
      for (let y = 1.6; y < H - 1; y += 1.4) {
        for (let j = 0; j < 4; j++) k.box(WIN, [1.0, 0.75, 0.02], [x - 2.1 + j * 1.4, y, f + 0.006])
        for (let j = 0; j < 3; j++) k.box(WIN, [0.02, 0.75, 1.0], [x + 3.006, y, -1.4 + j * 1.4])
      }
      for (let j = 0; j < 5; j++) nub(k, st, [0.16, H - 1, 0.12], [x - 2.8 + j * 1.4, (H - 1) / 2 + 0.5, f + 0.05])
      k.box({ c: '#a89f88', r: 0.85 }, [6.3, 0.4, 6.3], [x, H, 0])
      k.box(WARM, [6.32, 0.08, 6.32], [x, H + 0.22, 0])
      frustum(k, { c: '#3f6b5a', r: 0.5 }, 4.2, 4.2, 4.5, 0, [x, H + 0.2, 0])
      k.cyl(GOLD, 0.03, 0.06, 1.4, [x, H + 5.3, 0], undefined, 5)
    } else if (t === 1) {
      const H = 21 + v * 3
      const c: Look = { c: '#9aa1a6', r: 0.85 }
      k.box(c, [5.2, H, 5.2], [x, H / 2, 0])
      for (let y = 1.4; y < H - 0.8; y += 1.15) {
        k.box(WIN, [1.6, 0.6, 0.02], [x - 1.2, y, 2.606])
        if (r() < 0.75) k.box(WIN, [1.6, 0.6, 0.02], [x + 1.2, y, 2.606])
        nub(k, { c: '#c7ccd0', r: 0.8 }, [5.3, 0.08, 0.3], [x, y - 0.42, 2.7])
        k.box(WIN, [0.02, 0.6, 1.6], [x + 2.606, y, 0.8])
        k.box(WIN, [0.02, 0.6, 1.6], [x - 2.606, y, -0.8])
      }
      k.box({ c: '#7d858a', r: 0.8 }, [2, 1.4, 2], [x, H + 0.7, -0.5])
      k.cyl({ c: '#6b7378', r: 0.7 }, 0.5, 0.5, 1.2, [x + 1.4, H + 0.6, 1], undefined, 8)
      k.box(RED, [0.08, 3, 0.08], [x - 1.5, H + 1.5, 1])
      k.box(LANTERN, [0.18, 0.18, 0.18], [x - 1.5, H + 3.05, 1])
    } else {
      const brick: Look = { c: '#6b4a38', r: 0.9 }
      const tiers = [[6, 11], [4.6, 5], [3.2, 4]]
      let y = 0
      for (const [w, h] of tiers) {
        k.box(brick, [w, h, w], [x, y + h / 2, 0])
        for (const dx of [-1, 1]) k.box(WARM, [0.12, h - 0.8, 0.02], [x + dx * w * 0.2, y + h / 2, w / 2 + 0.006])
        for (let yy = y + 1; yy < y + h - 0.6; yy += 1.15) for (const dx of [-1, 1]) k.box(WIN, [w * 0.2, 0.6, 0.02], [x + dx * w * 0.36, yy, w / 2 + 0.006])
        k.box({ c: '#4e3528', r: 0.9 }, [w + 0.2, 0.25, w + 0.2], [x, y + h, 0])
        y += h
      }
      k.cyl(DARK, 0.05, 0.08, 2.5, [x, y + 1.25, 0], undefined, 5)
    }
  })
}

// The temple behind the red gate, facing +z, 10 wide: yellow walls with big painted characters
// either side of the gate, a forecourt with a bronze incense burner smoking, stone lanterns, a
// ginkgo, worshippers, and the hall with red columns and a double golden roof; a lion dance at
// its door on the pavement.
function temple(k: PropKit) {
  const f = D / 2
  const yel: Look = { c: '#d9a63a', r: 0.85 }
  const gold: Look = { c: '#c9962e', r: 0.55 }
  const r = rand(808)
  k.box({ c: '#8e8a84', r: 0.95 }, [9.6, 0.03, 10], [0, 0.015, -3])
  // Front and side walls.
  for (const s of [-1, 1]) {
    k.box(yel, [3.5, 2.6, 0.3], [s * 3.25, 1.3, f - 0.4])
    eaves(k, 3.7, 0.7, 0.3, [s * 3.25, 2.6, f - 0.4], TILE, TILE)
    k.box(GRANITE, [3.52, 0.3, 0.34], [s * 3.25, 0.15, f - 0.4])
    for (let i = 0; i < 2; i++) {
      k.box({ c: '#f3e6c4', r: 0.9 }, [0.95, 0.95, 0.02], [s * 3.25 + (i - 0.5) * 1.2, 1.45, f - 0.24])
      glyph(k, { c: '#7a1a10', r: 0.8 }, 'x', [s * 3.25 + (i - 0.5) * 1.2, 1.45, f - 0.225], 0.8, r)
    }
    k.box(yel, [0.3, 2.6, 9.4], [s * 4.85, 1.3, -3.3])
  }
  // Forecourt: the incense burner (a bronze cauldron on legs, a little roof, smoke).
  const bronze: Look = { c: '#6d5a3a', r: 0.5, m: 0.2 }
  k.box(GRANITE, [1.3, 0.3, 1.3], [0, 0.15, -1.2])
  k.cyl(bronze, 0.5, 0.42, 0.55, [0, 0.75, -1.2], undefined, 10)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    k.cyl(bronze, 0.06, 0.05, 0.3, [Math.sin(a) * 0.32, 0.38, -1.2 + Math.cos(a) * 0.32], undefined, 5)
  }
  for (const s of [-1, 1]) k.torus(bronze, 0.12, 0.03, [s * 0.5, 1.12, -1.2], [0, Math.PI / 2, 0], Math.PI * 2, 8, 3)
  for (let i = 0; i < 4; i++) k.cyl(bronze, 0.03, 0.03, 0.7, [Math.sin(i * 1.57 + 0.78) * 0.3, 1.35, -1.2 + Math.cos(i * 1.57 + 0.78) * 0.3], undefined, 4)
  frustum(k, bronze, 0.9, 0.9, 0.35, 0.3, [0, 1.7, -1.2])
  k.sphere(bronze, 0.08, [0, 2.12, -1.2], [1, 1, 1], 6, 4)
  for (let i = 0; i < 5; i++) k.ico({ c: '#b9b6b0', r: 1 }, 0.16 + i * 0.05, [Math.sin(i) * 0.15, 1.2 + i * 0.32, -1.2 + Math.cos(i * 1.3) * 0.12], [1, 0.7, 1], 0)
  // Stone lanterns.
  for (const s of [-1, 1]) {
    const x = s * 2.6
    k.box(GRANITE, [0.4, 0.15, 0.4], [x, 0.075, -1.0])
    k.cyl(GRANITE, 0.08, 0.1, 0.6, [x, 0.45, -1.0], undefined, 6)
    k.box(GRANITE, [0.42, 0.08, 0.42], [x, 0.78, -1.0])
    k.box(WARM, [0.3, 0.28, 0.3], [x, 0.96, -1.0])
    frustum(k, GRANITE, 0.56, 0.56, 0.25, 0.1, [x, 1.1, -1.0])
  }
  // A ginkgo in a stone ring.
  k.cyl(GRANITE, 0.5, 0.5, 0.25, [-3.6, 0.125, -2.6], undefined, 10)
  k.rod({ c: '#6d5a48', r: 1 }, [-3.6, 0, -2.6], [-3.55, 2.6, -2.6], 0.14, 6)
  for (const [dx, dy, dz, s] of [[0, 3.6, 0, 1.0], [0.4, 2.9, 0.3, 0.75], [-0.4, 3.0, -0.3, 0.75], [0.1, 4.4, 0, 0.6]]) k.ico({ c: dy > 4 ? '#d8c13c' : '#9fb33a', r: 1 }, s, [-3.6 + dx, dy, -2.6 + dz], [1, 0.9, 1], 1)
  // The hall on its terrace.
  const hz = -5.6
  k.box(GRANITE, [9.0, 0.5, 4.4], [0, 0.25, hz])
  for (let i = 0; i < 3; i++) k.box(GRANITE, [2.2, 0.17, 0.3], [0, 0.085 + i * 0.17, hz + 2.5 - i * 0.15])
  k.box(yel, [8.0, 2.8, 3.4], [0, 1.9, hz - 0.2])
  for (let i = 0; i < 6; i++) {
    const x = -3.75 + i * 1.5
    k.cyl({ c: '#b0221a', r: 0.6 }, 0.13, 0.14, 2.8, [x, 1.9, hz + 1.85], undefined, 8)
    if (i < 5) {
      k.box(WARM, [1.1, 2.0, 0.02], [x + 0.75, 1.6, hz + 1.51])
      for (const dx of [-0.36, -0.12, 0.12, 0.36]) nub(k, { c: '#7a1a10', r: 0.7 }, [0.04, 2.0, 0.03], [x + 0.75 + dx, 1.6, hz + 1.53])
      for (const dy of [-0.6, 0, 0.6]) nub(k, { c: '#7a1a10', r: 0.7 }, [1.1, 0.04, 0.03], [x + 0.75, 1.6 + dy, hz + 1.53])
    }
  }
  k.box({ c: '#1f5f8b', r: 0.7 }, [8.6, 0.3, 4.2], [0, 3.45, hz])
  eaves(k, 10.0, 5.4, 1.1, [0, 3.6, hz], gold)
  k.box(yel, [6.4, 1.0, 3.0], [0, 5.0, hz])
  eaves(k, 7.6, 4.2, 1.3, [0, 5.5, hz], gold)
  k.box(gold, [3.6, 0.3, 0.3], [0, 6.95, hz])
  for (const s of [-1, 1]) k.cone(gold, 0.18, 0.5, [s * 1.8, 7.15, hz], [0, 0, -s * 0.5], 5)
  k.box({ c: '#161210', r: 0.6 }, [1.6, 0.6, 0.06], [0, 5.0, hz + 1.53])
  for (let i = 0; i < 3; i++) glyph(k, GOLD, 'x', [-0.45 + i * 0.45, 5.0, hz + 1.565], 0.38, r)
  // Worshippers at the burner with incense, and a monk in saffron.
  for (let i = 0; i < 4; i++) person(k, -1.2 + i * 0.8, 0.1 + (i % 2) * 0.35, Math.PI + (i - 1.5) * 0.2, who(r, { pose: i % 2 ? 'photo' : 'down' }))
  person(k, 1.8, -3.0, 0.3, who(r, { shirt: '#e8a020', pants: '#e8a020', hair: '#e1b48c', walk: 0.25 }))
  // The lion dance on the pavement: a red lion and a gold lion, a drummer between.
  lionDancer(k, -3.4, f + 0.8, Math.PI / 2 - 0.3, '#d32f2f', '#f9a825')
  lionDancer(k, 3.4, f + 0.8, -Math.PI / 2 + 0.3, '#f9a825', '#d32f2f')
}

// A dancing lion (two dancers under one costume), its nose along +z of its frame.
function lionDancer(k: PropKit, x: number, z: number, ry: number, coat: string, trim: string) {
  const P = frame(x, z, ry)
  const R: V3 = [0, ry, 0]
  const fur: Look = { c: coat, r: 0.9 }
  const tr: Look = { c: trim, r: 0.8 }
  const white: Look = { c: '#f5f5f5', r: 0.9 }
  // Four legs in furry trousers.
  for (const dz of [-0.36, 0.26]) for (const s of [-1, 1]) {
    nub(k, tr, [0.09, 0.3, 0.1], P(s * 0.08, 0.17, dz), R)
    nub(k, { c: '#262626', r: 0.7 }, [0.09, 0.05, 0.13], P(s * 0.08, 0.025, dz + 0.02), R)
    k.ico(white, 0.065, P(s * 0.08, 0.06, dz), [1, 0.5, 1], 0)
  }
  // The body: a rounded back dipping to the tail, banded in the trim colour, a white fringe
  // hanging along both sides.
  const spine: V3[] = [[0, 0.66, 0.36], [0, 0.62, 0.05], [0, 0.6, -0.25], [0, 0.52, -0.55]]
  for (let i = 0; i < 3; i++) {
    k.rod(fur, P(...spine[i]), P(...spine[i + 1]), 0.24 - i * 0.02, 8)
    k.sphere(i % 2 ? tr : fur, 0.24 - i * 0.02, P(...spine[i + 1]), [1, 0.9, 1], 8, 5)
  }
  for (const s of [-1, 1]) {
    nub(k, white, [0.04, 0.12, 0.8], P(s * 0.22, 0.42, -0.08), R)
    for (let i = 0; i < 4; i++) nub(k, tr, [0.03, 0.04, 0.12], P(s * 0.235, 0.64, 0.25 - i * 0.22), R)
  }
  k.ico(white, 0.13, P(0, 0.58, -0.68), [0.9, 1.1, 1], 0)
  // The head: big and round with a gilded brow, a mirror and a horn, bulging eyes with lashes,
  // an open mouth with teeth, fur trim and a white beard.
  const hy = 0.86
  const hz = 0.55
  k.sphere(fur, 0.27, P(0, hy, hz), [1, 0.92, 0.95], 10, 7)
  k.sphere(tr, 0.2, P(0, hy + 0.12, hz + 0.06), [1.25, 0.55, 1.1], 8, 5)
  k.cyl({ c: '#e0e0e0', r: 0.2, m: 0.25 }, 0.055, 0.055, 0.02, P(0, hy + 0.13, hz + 0.27), [Math.PI / 2 - 0.4, ry, 0], 8)
  k.cone(tr, 0.05, 0.2, P(0, hy + 0.3, hz + 0.08), [0.5, ry, 0], 5)
  for (const s of [-1, 1]) {
    k.sphere(white, 0.075, P(s * 0.12, hy + 0.02, hz + 0.22), [1, 1, 0.8], 7, 5)
    k.sphere(DARK, 0.038, P(s * 0.12, hy + 0.02, hz + 0.28), [1, 1, 1], 6, 4)
    nub(k, DARK, [0.15, 0.025, 0.03], P(s * 0.12, hy + 0.1, hz + 0.25), [0, ry, -s * 0.2])
    k.ico(white, 0.08, P(s * 0.25, hy + 0.1, hz - 0.05), [0.6, 1.1, 1], 0)
    k.cone(fur, 0.07, 0.14, P(s * 0.17, hy + 0.24, hz - 0.08), [0, ry, -s * 0.5], 5)
  }
  // Mouth: a red cavity, white teeth, the lower jaw dropped open.
  nub(k, { c: '#5a0a0a', r: 0.8 }, [0.3, 0.12, 0.08], P(0, hy - 0.13, hz + 0.24), R)
  nub(k, white, [0.28, 0.03, 0.03], P(0, hy - 0.07, hz + 0.28), R)
  nub(k, fur, [0.32, 0.06, 0.24], P(0, hy - 0.24, hz + 0.16), [0.35, ry, 0])
  nub(k, white, [0.26, 0.025, 0.03], P(0, hy - 0.2, hz + 0.27), [0.35, ry, 0])
  k.ico(white, 0.11, P(0, hy - 0.33, hz + 0.18), [1.3, 0.9, 0.7], 0)
}

// The walled garden by the finish, facing +z, 14 wide: a white wall with a dark tiled coping that
// rolls like a dragon's back, a moon gate and lattice windows, and behind it the pagoda, a
// pavilion, a willow, bamboo, a rockery and a lily pond; visitors outside.
function garden(k: PropKit) {
  const f = D / 2
  const wz = f - 0.3
  const white: Look = { c: '#efeae0', r: 0.9 }
  const grey: Look = { c: '#4a4f52', r: 0.8 }
  const r = rand(616)
  k.box({ c: '#5d6b4a', r: 1 }, [13.8, 0.02, 9.6], [0, 0.01, -3.2])
  // The wall, open for the moon gate (radius 1.1, centre 1.25 up).
  const R = 1.1
  const cy = 1.25
  for (const s of [-1, 1]) {
    k.box(white, [5.8, 2.7, 0.3], [s * 4.1, 1.35, wz])
    k.box(white, [0.3, 2.7, 9.4], [s * 6.85, 1.35, wz - 4.85])
  }
  k.box(white, [2.4, 2.7 - cy - R, 0.3], [0, cy + R + (2.7 - cy - R) / 2, wz])
  for (let y = 0.05; y < cy + R; y += 0.15) {
    const yc = y + 0.075
    const hw = Math.sqrt(Math.max(0, R * R - (yc - cy) ** 2))
    const w = 1.2 - hw
    if (w > 0.005) for (const s of [-1, 1]) k.box(white, [w, 0.15, 0.3], [s * (hw + w / 2), yc, wz])
  }
  k.torus(grey, R, 0.06, [0, cy, wz + 0.16], [0, 0, 0], Math.PI * 2, 20, 4)
  k.torus(grey, R, 0.06, [0, cy, wz - 0.16], [0, 0, 0], Math.PI * 2, 20, 4)
  k.box(GRANITE, [1.6, 0.06, 0.6], [0, 0.03, wz])
  // Lattice windows.
  for (const x of [-4.8, -2.8, 2.8, 4.8]) {
    k.box(grey, [0.8, 0.8, 0.32], [x, 1.5, wz])
    k.box({ c: '#202426', r: 0.9 }, [0.64, 0.64, 0.33], [x, 1.5, wz])
    for (const d of [-0.16, 0.16]) {
      k.box(white, [0.04, 0.64, 0.34], [x + d, 1.5, wz])
      k.box(white, [0.64, 0.04, 0.34], [x, 1.5 + d, wz])
    }
    k.box(white, [0.5, 0.04, 0.34], [x, 1.5, wz], [0, 0, Math.PI / 4])
  }
  // The coping: a dark tiled ridge rolling up and down, ending in a dragon's head over the gate.
  for (let x = -6.9; x < 6.9; x += 0.3) {
    const h = 0.2 + 0.18 * Math.sin(x * 0.9) ** 2
    nub(k, grey, [0.32, h, 0.5], [x + 0.15, 2.7 + h / 2, wz])
  }
  for (const s of [-1, 1]) {
    k.box(grey, [0.4, 0.3, 0.3], [s * 1.3, 3.15, wz])
    k.cone(grey, 0.1, 0.4, [s * 1.45, 3.35, wz], [0, 0, -s * 0.8], 5)
  }
  // Behind the wall: the pagoda, a pavilion, a willow, bamboo, a rockery and a lily pond.
  pagoda(k, [0, 0, -5.4])
  const px = 4.6
  const pz = -5.2
  k.box(GRANITE, [2.2, 0.3, 2.2], [px, 0.15, pz])
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    k.cyl({ c: '#b0221a', r: 0.6 }, 0.07, 0.07, 1.8, [px + Math.sin(a) * 0.85, 1.2, pz + Math.cos(a) * 0.85], undefined, 6)
  }
  eaves(k, 2.6, 2.6, 0.9, [px, 2.1, pz])
  k.sphere(GOLD, 0.12, [px, 3.1, pz], [1, 1, 1], 6, 4)
  k.box({ c: '#2b4a52', r: 0.3 }, [3.0, 0.02, 2.2], [-4.5, 0.03, -4.6])
  for (let i = 0; i < 6; i++) k.cyl({ c: '#4f8a3a', r: 0.9 }, 0.12, 0.12, 0.01, [-5.3 + (i % 3) * 0.8, 0.045, -5.1 + Math.floor(i / 3) * 0.9], undefined, 7)
  for (const [x, y, z, s] of [[-2.6, 0.4, -1.4, 0.55], [-2.2, 0.95, -1.6, 0.4], [-2.8, 1.3, -1.3, 0.3], [-1.9, 0.3, -1.0, 0.35]]) k.ico({ c: '#9a9890', r: 1 }, s, [x, y, z], [1, 1.3, 0.8], 0)
  // A willow: a short trunk and curtains of hanging fronds.
  k.rod({ c: '#5a4a3a', r: 1 }, [3.4, 0, -1.8], [3.3, 2.4, -1.8], 0.12, 6)
  k.ico({ c: '#7aa04a', r: 1 }, 1.0, [3.3, 3.0, -1.8], [1.2, 0.7, 1.2], 1)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    k.box({ c: i % 2 ? '#86ad52' : '#6e9640', r: 1 }, [0.1, 1.6, 0.04], [3.3 + Math.sin(a) * 1.0, 2.1, -1.8 + Math.cos(a) * 1.0], [0, a, 0])
  }
  // Bamboo groves along the inside of the wall.
  for (const [bx, bz] of [[-5.8, -0.6], [-4.6, -1.0], [5.8, -0.9]]) {
    for (let i = 0; i < 6; i++) {
      const x = bx + (r() - 0.5) * 0.7
      const z = bz + (r() - 0.5) * 0.5
      const h = 3.4 + r() * 1.2
      k.cyl({ c: '#6f9a3a', r: 0.7 }, 0.035, 0.045, h, [x, h / 2, z], undefined, 5)
      k.ico({ c: i % 2 ? '#4f8a34' : '#5f9a3a', r: 1 }, 0.35, [x, h - 0.2, z], [0.8, 1.4, 0.8], 0)
    }
  }
  // Visitors at the moon gate.
  person(k, -1.6, f + 0.75, 0.4, who(r, { pose: 'photo' }))
  person(k, -1.0, f + 0.95, Math.PI * 0.85, who(r, { pose: 'wave', dress: true, shirt: '#c62828' }))
  person(k, 1.6, f + 0.8, -Math.PI / 2, who(r, { walk: 0.35 }))
  person(k, 1.95, f + 1.0, -Math.PI / 2, who(r, { walk: 0.35, s: 0.72 }))
}

// A bank under repair in bamboo scaffolding with green netting and a worker on the boards.
function scaffold(k: PropKit) {
  const b: Bank = { w: 4.6, floors: 5, top: 'flat', stone: { c: '#cbbfa9', r: 0.85 } }
  bank(k, b)
  const f = D / 2 + 0.45
  const H = bankH(5) + 1.0
  for (let x = -2.3; x <= 2.31; x += 0.575) k.cyl(BAMBOO, 0.03, 0.035, H, [x, H / 2, f], undefined, 5)
  for (let y = 1.6; y < H; y += 1.15) {
    k.cyl(BAMBOO, 0.025, 0.025, 4.7, [0, y, f + 0.02], [0, 0, Math.PI / 2], 5)
    k.box(TIMBER, [4.6, 0.04, 0.4], [0, y - 0.02, f - 0.12])
  }
  for (let i = 0; i < 4; i++) k.cyl(BAMBOO, 0.02, 0.02, 3.2, [-1.75 + i * 1.15, 3.6, f + 0.04], [0, 0, i % 2 ? 0.55 : -0.55], 4)
  const net: Look = { c: '#2f6b3a', r: 0.95 }
  k.box(net, [2.2, 4.5, 0.02], [-1.15, 5.2, f + 0.08])
  k.box(net, [1.1, 2.3, 0.02], [1.7, 6.3, f + 0.08])
  k.box({ c: '#fafafa', r: 0.9 }, [2.0, 0.5, 0.025], [0.8, 2.2, f + 0.09])
  glyph(k, RED, 'x', [0.35, 2.2, f + 0.105], 0.4, rand(5))
  glyph(k, RED, 'x', [0.8, 2.2, f + 0.105], 0.4, rand(6))
  glyph(k, RED, 'x', [1.25, 2.2, f + 0.105], 0.4, rand(7))
  const r = rand(88)
  person(k, 1.0, f - 0.2, 0, who(r, { shirt: '#1565c0', hat: '#fdd835' }), 3.9)
  person(k, -0.8, f + 0.65, Math.PI, who(r, { shirt: '#ef6c00', hat: '#fdd835' }))
  // A sand pile and a wheelbarrow at its foot.
  k.cone({ c: '#c2a878', r: 1 }, 0.5, 0.4, [1.6, 0.2, f + 0.6], undefined, 8)
}

// A wooden junk moored by the embankment, facing +z: a high stern, three masts with battened
// red sails, lanterns strung along her and a lit cabin.
const JUNK_SAIL = (() => {
  const sh = new Shape()
  sh.moveTo(0, 0)
  sh.lineTo(1, 0)
  sh.lineTo(1.12, 0.62)
  sh.quadraticCurveTo(1.0, 1.0, 0.55, 1.08)
  sh.lineTo(-0.1, 0.86)
  sh.closePath()
  return new ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -0.015).rotateY(-Math.PI / 2)
})()
function junk(k: PropKit) {
  const wood: Look = { c: '#5a3a22', r: 0.9 }
  const woodD: Look = { c: '#3e2816', r: 0.95 }
  const sail: Look = { c: '#a8261c', r: 0.9 }
  k.box(woodD, [1.5, 0.5, 4.6], [0, 0.15, 0])
  k.box(wood, [1.7, 0.4, 4.4], [0, 0.6, -0.1])
  frustum(k, wood, 1.7, 1.0, 0.4, 0.4, [0, 0.4, 2.6], 0)
  k.box(wood, [1.2, 0.3, 0.9], [0, 0.65, 2.55])
  k.box(wood, [1.8, 0.7, 1.2], [0, 1.1, -1.9])
  k.box(woodD, [1.9, 0.08, 1.3], [0, 1.47, -1.9])
  k.box(RED, [1.82, 0.06, 4.42], [0, 0.82, -0.1])
  k.box(WARM, [1.82, 0.22, 0.6], [0, 1.1, -1.7])
  k.box(wood, [1.0, 0.5, 1.2], [0, 1.05, 0.2])
  k.box(woodD, [1.1, 0.06, 1.3], [0, 1.32, 0.2])
  // Masts, sails and battens.
  for (const [z, h, w] of [[1.4, 2.6, 1.3], [-0.3, 3.6, 1.8], [-1.9, 2.4, 1.1]] as const) {
    k.cyl(woodD, 0.04, 0.05, h + 0.9, [0, 0.8 + (h + 0.9) / 2, z], undefined, 5)
    k.add(sail, JUNK_SAIL, [0.06, 1.1, z], [0, Math.PI, 0], [1, h, w])
    for (let i = 1; i < 6; i++) k.box(woodD, [0.05, 0.03, w * 1.05], [0.06, 1.1 + h * (i / 6) * 0.95, z - w * 0.5])
  }
  // A string of lanterns from bow to stern over the masts.
  k.rod(DARK, [0, 1.0, 3.0], [0, 4.4, -0.3], 0.008, 3)
  k.rod(DARK, [0, 4.4, -0.3], [0, 1.6, -2.5], 0.008, 3)
  for (let i = 1; i < 5; i++) {
    const t = i / 5
    k.sphere(LANTERN, 0.1, [0, 1.0 + t * 3.4 - 0.12, 3.0 - t * 3.3], [1, 0.85, 1], 8, 6)
    k.sphere(LANTERN, 0.1, [0, 4.4 - t * 2.8 - 0.12, -0.3 - t * 2.2], [1, 0.85, 1], 8, 6)
  }
}

// River traffic at anchor: a tug towing three low sand barges, a double-deck ferry, sampans.
function barges(k: PropKit) {
  const hull: Look = { c: '#3a3f44', r: 0.8 }
  const rust: Look = { c: '#7a4a32', r: 0.9 }
  for (let i = 0; i < 3; i++) {
    const z = -i * 5.4
    k.box(hull, [1.6, 0.45, 5.0], [0, 0.2, z])
    k.box(rust, [1.62, 0.08, 5.02], [0, 0.46, z])
    k.box(rust, [1.4, 0.1, 0.6], [0, 0.5, z + 2.4])
    k.cone({ c: '#b89a6a', r: 1 }, 0.9, 0.7, [0, 0.8, z - 0.8], undefined, 6)
    k.cone({ c: '#a88a5a', r: 1 }, 0.7, 0.55, [0, 0.72, z + 1.0], undefined, 6)
    if (i < 2) k.box(DARK, [0.03, 0.03, 0.5], [0, 0.45, z - 2.75])
  }
  // The tug at the head.
  k.box(hull, [1.5, 0.55, 3.0], [0, 0.25, 4.2])
  frustum(k, hull, 1.5, 1.0, 0.55, 0.3, [0, 0, 5.9])
  k.box({ c: '#e8e2d4', r: 0.7 }, [1.1, 0.8, 1.2], [0, 0.95, 3.8])
  k.box(WARM, [1.12, 0.22, 1.0], [0, 1.1, 3.85])
  k.box({ c: '#c62828', r: 0.7 }, [0.9, 0.1, 1.0], [0, 1.4, 3.8])
  k.cyl(DARK, 0.12, 0.14, 0.7, [0, 1.6, 3.3], undefined, 8)
  for (const s of [-1, 1]) k.torus({ c: '#1b1b1b', r: 0.9 }, 0.14, 0.05, [s * 0.77, 0.4, 4.6], [0, Math.PI / 2, 0], Math.PI * 2, 8, 3)
}
function ferry(k: PropKit) {
  const hull: Look = { c: '#1e4e79', r: 0.7 }
  const deck: Look = { c: '#f2f2ee', r: 0.7 }
  k.box(hull, [2.4, 0.6, 6.4], [0, 0.3, 0])
  frustum(k, hull, 2.4, 1.6, 0.6, 0.4, [0, 0, 3.6])
  k.box(deck, [2.2, 0.8, 5.0], [0, 1.0, -0.3])
  k.box(deck, [1.9, 0.7, 3.8], [0, 1.75, -0.5])
  k.box({ c: '#c62828', r: 0.7 }, [2.42, 0.12, 6.42], [0, 0.6, 0])
  for (const y of [1.05, 1.8]) for (const s of [-1, 1]) k.box(WIN, [0.02, 0.32, y > 1.5 ? 3.4 : 4.6], [s * (y > 1.5 ? 0.96 : 1.11), y, y > 1.5 ? -0.5 : -0.3])
  k.box(deck, [1.0, 0.5, 1.0], [0, 2.35, 0.6])
  k.box(WIN, [1.02, 0.2, 0.6], [0, 2.4, 0.8])
  k.cyl({ c: '#c62828', r: 0.6 }, 0.18, 0.2, 0.8, [0, 2.5, -1.6], undefined, 8)
  k.box(DARK, [2.0, 0.06, 0.06], [0, 2.15, -2.4])
  const r = rand(17)
  for (let i = 0; i < 4; i++) person(k, -0.6 + i * 0.4, 2.0 + (i % 2) * 0.2, Math.PI / 2, who(r, { pose: i === 1 ? 'photo' : 'down' }), 2.1)
}
function sampan(k: PropKit) {
  const wood: Look = { c: '#6a4a2a', r: 0.9 }
  k.box(wood, [0.8, 0.3, 2.8], [0, 0.15, 0])
  frustum(k, wood, 0.8, 0.5, 0.3, 0.3, [0, 0, 1.6])
  archTop(k, { c: '#3a2e22', r: 0.9 }, 0.8, 1.0, [0, 0.3, -0.3], Math.PI / 2, 0.8)
  k.rod(BAMBOO, [0, 0.3, -1.4], [0.2, 1.0, -2.2], 0.02, 4)
  person(k, 0, -1.0, 0, who(rand(3), { hat: '#c8a165', shirt: '#455a64' }), 0.3)
}

// A dragon dance on the promenade: nine dancers carrying a red and gold dragon on poles, its
// head turned to the oncoming road, a dancer leading it with the pearl, a drummer and cymbals.
function dragonDance(k: PropKit) {
  const r = rand(888)
  const red: Look = { c: '#c62828', r: 0.7 }
  const gold: Look = { c: '#e8b23a', r: 0.5 }
  const pts: V3[] = []
  for (let i = 0; i < 10; i++) pts.push([0.42 * Math.sin(i * 0.9), 1.3 + 0.28 * Math.sin(i * 0.9 + 1.2), 0.4 + i * 0.62])
  for (let i = 0; i < 9; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
    k.rod(red, a, m, 0.17 - i * 0.008, 8)
    k.rod(gold, m, b, 0.17 - i * 0.008, 8)
    k.sphere(red, 0.17 - i * 0.008, b, [1, 1, 1], 8, 5)
    k.cone(gold, 0.06, 0.16, [b[0], b[1] + 0.2, b[2]], [-0.4, 0, 0], 4)
    k.rod({ c: '#fdd835', r: 0.9 }, [a[0], a[1] - 0.17, a[2]], [m[0], m[1] - 0.17, m[2]], 0.04, 4)
  }
  for (let i = 0; i < 9; i++) {
    const p = pts[i]
    // Dancer facing the head (-z), hands up on the pole under the body.
    const hz = p[2] + 0.27
    person(k, p[0], hz, Math.PI, who(r, { shirt: i % 2 ? '#fdd835' : '#c62828', pants: '#212121', pose: 'pole', walk: 0.25 * Math.sin(i * 1.3) }))
    k.rod({ c: '#7a5232', r: 0.9 }, [p[0], 0.75, p[2]], [p[0], p[1] - 0.15, p[2]], 0.02, 4)
  }
  // The head.
  const [hx, hy, hz] = pts[0]
  k.box(red, [0.4, 0.34, 0.5], [hx, hy + 0.06, hz - 0.2])
  k.box(gold, [0.42, 0.06, 0.52], [hx, hy + 0.25, hz - 0.2])
  k.box(red, [0.3, 0.16, 0.34], [hx, hy - 0.02, hz - 0.58])
  k.box({ c: '#7a0f0f', r: 0.8 }, [0.28, 0.06, 0.38], [hx, hy - 0.16, hz - 0.5], [0.35, 0, 0])
  k.box({ c: '#f5f5f5', r: 0.8 }, [0.26, 0.03, 0.04], [hx, hy - 0.1, hz - 0.73])
  for (const s of [-1, 1]) {
    k.sphere({ c: '#f5f5f5', r: 0.6 }, 0.08, [hx + s * 0.15, hy + 0.2, hz - 0.38], [1, 1, 0.7], 6, 4)
    k.sphere(DARK, 0.04, [hx + s * 0.15, hy + 0.2, hz - 0.43], [1, 1, 1], 6, 4)
    k.cone(gold, 0.04, 0.32, [hx + s * 0.1, hy + 0.42, hz - 0.05], [0.7, 0, s * 0.3], 5)
    k.rod({ c: '#fdd835', r: 0.8 }, [hx + s * 0.14, hy, hz - 0.72], [hx + s * 0.5, hy - 0.1, hz - 0.95], 0.012, 3)
    k.ico({ c: '#43a047', r: 0.9 }, 0.12, [hx + s * 0.22, hy + 0.08, hz - 0.05], [0.6, 1, 1], 0)
  }
  k.ico({ c: '#f5f5f5', r: 0.9 }, 0.12, [hx, hy - 0.22, hz - 0.35], [1.2, 0.8, 1], 0)
  // The tail: a fan of gold.
  const t = pts[9]
  for (const a of [-0.5, 0, 0.5]) k.cone(gold, 0.08, 0.4, [t[0] + a * 0.2, t[1] + 0.1, t[2] + 0.3], [1.3, a, 0], 4)
  // The pearl and its dancer.
  person(k, 0.25, -0.75, 0, who(r, { shirt: '#fdd835', pants: '#c62828', pose: 'pole' }))
  k.rod({ c: '#7a5232', r: 0.9 }, [0.25, 0.75, -0.48], [0.25, 1.6, -0.48], 0.02, 4)
  k.sphere({ c: '#ff7043', r: 0.4 }, 0.17, [0.25, 1.75, -0.48], [1, 1, 1], 8, 6)
  for (let i = 0; i < 3; i++) k.ico({ c: '#e53935', r: 0.8 }, 0.07, [0.25 + Math.sin(i * 2.1) * 0.17, 1.75 + Math.cos(i * 2.1) * 0.17, -0.48], [1, 1, 1], 0)
  // The drum on its stand, the drummer and the cymbals.
  const dz = 6.9
  k.cyl({ c: '#b71c1c', r: 0.6 }, 0.32, 0.32, 0.42, [-0.45, 0.62, dz], [Math.PI / 2, 0, Math.PI / 2], 12)
  k.cyl({ c: '#e8d9b0', r: 0.8 }, 0.3, 0.3, 0.44, [-0.45, 0.62, dz], [Math.PI / 2, 0, Math.PI / 2], 12)
  for (const s of [-1, 1]) k.rod({ c: '#3e2723', r: 0.9 }, [-0.45 + s * 0.2, 0, dz + 0.2], [-0.45 + s * 0.12, 0.45, dz], 0.025, 4)
  person(k, -0.45, dz + 0.5, Math.PI, who(r, { shirt: '#c62828', pose: 'photo' }))
  person(k, 0.4, dz + 0.3, Math.PI + 0.5, who(r, { shirt: '#fdd835', pose: 'wave' }))
  // Children watching.
  person(k, 0.75, 3.0, -Math.PI / 2, who(r, { s: 0.7, pose: 'wave' }))
  person(k, 0.7, 3.4, -Math.PI / 2, who(r, { s: 0.75 }))
}

// Strollers on the promenade: three groups (a family, friends with a selfie phone, an old
// couple and a cyclist), each about two long, walking along +z of the group's frame.
function strollers(k: PropKit, v: number) {
  const r = rand(300 + v * 7)
  if (v === 0) {
    person(k, -0.12, 0, 0, who(r, { walk: 0.4 }))
    person(k, 0.18, 0.15, 0, who(r, { walk: 0.35, dress: true }))
    person(k, 0.05, 0.6, 0, who(r, { walk: 0.45, s: 0.68 }))
    person(k, 0.0, -1.4, Math.PI, who(r, { walk: 0.3 }))
  } else if (v === 1) {
    person(k, 0, 0, Math.PI * 0.95, who(r, { pose: 'photo' }))
    person(k, 0.2, -0.25, Math.PI * 1.05, who(r, { pose: 'wave' }))
    person(k, -0.15, 1.3, 0, who(r, { walk: 0.4 }))
  } else {
    person(k, -0.1, 0, Math.PI, who(r, { walk: 0.2, hair: '#9a9a9a' }))
    person(k, 0.2, 0.05, Math.PI, who(r, { walk: 0.2, hair: '#bdbdbd', dress: true, shirt: '#6a1b9a' }))
    // A courier on an e-bike, parked to check his phone.
    ebike(k, 0.05, 1.6, Math.PI / 2, '#fafafa', '#fdd835')
    person(k, -0.3, 1.5, -Math.PI / 2, who(r, { pose: 'photo', shirt: '#fdd835', hat: '#fdd835' }))
  }
}

type Seg = { kind: string; z: number }
export default function Shanghai({ len, race }: WorldProps) {
  const banks = useMemo(() => BANKS.map((b, i) => prop(`shanghai-bank-${i}-d3`, (k) => bank(k, b))), [])
  const terraces = useMemo(() => TERRACES.map((_, i) => prop(`shanghai-terrace-${i}`, (k) => terrace(k, i))), [])
  const backs = useMemo(() => [0, 1].map((v) => prop(`shanghai-back-${v}`, (k) => backRow(k, v))), [])
  const walkers = useMemo(() => [0, 1, 2].map((v) => prop(`shanghai-strollers-${v}`, (k) => strollers(k, v))), [])
  const neonP = useProp('shanghai-neon', neonBlock)
  const clockP = useProp('shanghai-clock-d3', clockTower)
  const gateP = useProp('shanghai-gate-d3', gate)
  const templeP = useProp('shanghai-temple', temple)
  const gardenP = useProp('shanghai-garden', garden)
  const scaffoldP = useProp('shanghai-scaffold', scaffold)
  const railP = useProp('shanghai-rail-d3', rail)
  const lanternP = useProp('shanghai-lanterns-d3', lanterns)
  const laneP = useProp('shanghai-lane-d3', lane)
  const junkP = useProp('shanghai-junk', junk)
  const bargeP = useProp('shanghai-barges', barges)
  const ferryP = useProp('shanghai-ferry', ferry)
  const sampanP = useProp('shanghai-sampan', sampan)
  const dragonP = useProp('shanghai-dragon', dragonDance)
  const gz = race * 0.5
  const tz = race * 0.25
  const pz = race + 12
  const sz = race * 0.8
  const dz = 21
  const RX = -(EDGE + 2.2)

  const geo = useMemo(() => {
    const r = rand(733)
    // The front row: banks along the Bund, then the old town's shophouses, then the neon street,
    // and the landmarks in their own gaps.
    const W: Record<string, number> = { b0: 5.0, b1: 4.0, b2: 4.6, b3: 3.6, b4: 5.4, t0: TERRACE_W, t1: TERRACE_W, neon: NEON_W, lane: LANE_W }
    const zone = (z: number) => {
      const m = ((z % 240) + 240) % 240
      return m < 70 ? ['b0', 'b1', 'b2', 'b3', 'b4'] : m < 135 ? ['t0', 't1', 't0', 't1', 'b3'] : m < 200 ? ['neon', 't0', 'neon', 't1', 'b1'] : ['b0', 'b2', 'b4', 'b1', 'b3']
    }
    const specials = [{ kind: 'clock', c: tz, w: 6.4 }, { kind: 'temple', c: gz, w: 10 }, { kind: 'scaffold', c: sz, w: 4.6 }, { kind: 'garden', c: pz, w: 14 }].filter((s) => s.c < len + 40).sort((a, b) => a.c - b.c)
    const segs: Seg[] = []
    let nextLane = 16
    const fill = (from: number, to: number) => {
      const run: { kind: string; w: number }[] = []
      let z = from
      for (;;) {
        let opts = zone(z).filter((k) => z + W[k] <= to)
        if (z >= nextLane && z + LANE_W <= to) opts = ['lane']
        if (!opts.length) {
          const small = ['b3', 'b1', 'b2', 'b0', 'b4', 'lane'].filter((k) => z + W[k] <= to)
          if (!small.length) break
          opts = [small[0]]
        }
        const kind = opts[Math.floor(r() * opts.length)]
        if (kind === 'lane') nextLane = z + 34 + r() * 14
        run.push({ kind, w: W[kind] })
        z += W[kind] + 0.15
      }
      // Spread what's left between the buildings as alleys.
      const gap = run.length ? (to - z + 0.15) / run.length : 0
      let zz = from
      for (const p of run) {
        segs.push({ kind: p.kind, z: zz + p.w / 2 })
        zz += p.w + 0.15 + gap
      }
    }
    let z = -14
    for (const s of specials) {
      fill(z, s.c - s.w / 2 - 0.15)
      segs.push({ kind: s.kind, z: s.c })
      z = s.c + s.w / 2 + 0.15
    }
    fill(z, len + 40)
    const at = (k: string) => segs.filter((s) => s.kind === k).map((s) => ({ x: FRONT_X, z: s.z, ry: -Math.PI / 2 }))
    const rows = BANKS.map((_, i) => at(`b${i}`))
    const terr = [at('t0'), at('t1')]
    const neon = at('neon')
    const lanes = at('lane')
    // The back row, but not behind the pagoda.
    const back: Spot[][] = [[], []]
    for (let zb = -2; zb < len + 40; zb += 24.5) if (Math.abs(zb - pz) > 16) back[Math.floor(r() * 2)].push({ x: BACK_X, z: zb, ry: -Math.PI / 2 })
    // The promenade, open at the gate and for the dragon dance.
    // Where a module is left out, plain rail runs on (stopping short of the gate's pillars).
    const rails: Spot[] = []
    const runs: [number, number][] = []
    for (let zr = -14; zr < len + 40; zr += 6) {
      if (Math.abs(zr - gz) > 4 && (zr < dz - 2 || zr > dz + 9)) rails.push({ x: RX, z: zr })
      else if (Math.abs(zr - gz) <= 4) {
        if (zr - 3 < gz - 0.65) runs.push([zr - 3, Math.min(zr + 3, gz - 0.65)])
        if (zr + 3 > gz + 0.65) runs.push([Math.max(zr - 3, gz + 0.65), zr + 3])
      } else runs.push([zr - 3, zr + 3])
    }
    const strings: Spot[] = []
    for (let zs = 10; zs < len + 30; zs += 11) if (Math.abs(zs - gz) > 4) strings.push({ x: 0, z: zs })
    // Strollers between the tree pits and the kerb.
    const walk: Spot[][] = [[], [], []]
    for (let zw = -10; zw < len + 40; zw += 5 + r() * 6) {
      if ((zw > dz - 3 && zw < dz + 10) || Math.abs(zw - gz) < 3) continue
      walk[Math.floor(r() * 3)].push({ x: RX + 1.62 + (r() - 0.5) * 0.12, z: zw, ry: (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.2 })
    }
    // Paving setts along the promenade, a little glinting in the lamplight.
    const rr = rand(81)
    const setts = Array.from({ length: 160 }, () => ({ x: RX + 0.4 + rr() * 1.2, z: rr() * (len + 60) - 14, s: 0.6 + rr() * 0.5, ry: rr() * 6, y: 0.01 }))
    return { rows, terr, neon, lanes, back, rails, runs, strings, walk, setts, segs }
  }, [len, gz, tz, pz, sz, RX])
  const fillP = useMemo(() => prop(`shanghai-railfill-${geo.runs.map((r) => r.join(',')).join(';')}`, (k) => {
    for (const [a, b] of geo.runs) railRun(k, a, b)
  }), [geo.runs])

  return (
    <>
      <Batch version={`shanghai:${len}`} cell={24} freeze prune>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 0.8, 0.012, len / 2 + 5]}>
          <planeGeometry args={[1.6, len + 60]} />
          <meshStandardMaterial color="#9a958d" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[RX + 1.0, 0.012, len / 2 + 5]}>
          <planeGeometry args={[2.4, len + 60]} />
          <meshStandardMaterial color="#a39d93" />
        </mesh>
        <group position={[0, 0, gz]}><PropMesh parts={gateP} /></group>
        {geo.segs.map((s) => {
          const parts = s.kind === 'clock' ? clockP : s.kind === 'temple' ? templeP : s.kind === 'garden' ? gardenP : s.kind === 'scaffold' ? scaffoldP : null
          return parts && <group key={s.kind} position={[FRONT_X, 0, s.z]} rotation-y={-Math.PI / 2}><PropMesh parts={parts} /></group>
        })}
        {[race * 0.18, race * 0.68].map((z) => <group key={z} position={[RX - 3.2, 0, z]} rotation-y={0.04}><PropMesh parts={junkP} /></group>)}
        <group position={[RX - 13, 0, race * 0.42]} rotation-y={0.05}><PropMesh parts={bargeP} /></group>
        <group position={[RX - 20, 0, race * 0.88]} rotation-y={Math.PI - 0.1}><PropMesh parts={ferryP} /></group>
        {[race * 0.05, race * 0.3, race * 0.56, race * 0.95].map((z, i) => <group key={z} position={[RX - 1.6 - (i % 2) * 0.6, 0, z]} rotation-y={0.15 * (i % 2 ? 1 : -1)}><PropMesh parts={sampanP} /></group>)}
        <group position={[RX + 1.05, 0, dz]}><PropMesh parts={dragonP} /></group>
        <group position={[RX, 0, 0]}><PropMesh parts={fillP} /></group>
        <Scatter spots={geo.setts} colors={['#8b867e', '#9d978e']}>
          <boxGeometry args={[0.2, 0.02, 0.2]} />
        </Scatter>
      </Batch>
      {banks.map((b, i) => <Many key={i} parts={b} at={geo.rows[i]} />)}
      {terraces.map((t, i) => <Many key={i} parts={t} at={geo.terr[i]} />)}
      <Many parts={neonP} at={geo.neon} />
      {backs.map((b, i) => <Many key={i} parts={b} at={geo.back[i]} />)}
      {walkers.map((w, i) => <Many key={i} parts={w} at={geo.walk[i]} near={70} />)}
      <Many parts={railP} at={geo.rails} near={80} />
      <Many parts={lanternP} at={geo.strings} />
      <Many parts={laneP} at={geo.lanes} />
      <Water x={RX - 40} z={len / 2} w={78} d={len + 240} id="shanghai" color="#6f8fa3" rough={0.15} />
      <Sparkles edge={RX - 0.3} />
      <Cruisers len={len} x={RX} />
      <Skyline />
    </>
  )
}

// Cruise boats outlined in lights, sliding up and down the river.
function Cruisers({ len, x }: { len: number; x: number }) {
  const boat = useProp('shanghai-cruiser-d3', (k) => {
    const hull: Look = { c: '#f2f2f2', r: 0.6 }
    k.box({ c: '#263238', r: 0.7 }, [1.6, 0.4, 5.4], [0, 0.2, 0])
    k.box(hull, [1.5, 0.6, 4.8], [0, 0.7, 0])
    k.box(hull, [1.3, 0.5, 3.6], [0, 1.25, -0.3])
    k.box(hull, [1.0, 0.4, 2.0], [0, 1.7, -0.6])
    for (const y of [0.72, 1.27]) for (const s of [-1, 1]) k.box(WIN, [0.02, 0.24, y > 1 ? 3.2 : 4.4], [s * (y > 1 ? 0.66 : 0.76), y, y > 1 ? -0.3 : 0])
    for (const s of [-1, 1]) {
      k.box(NEON_C, [0.03, 0.04, 4.8], [s * 0.77, 1.0, 0])
      k.box(NEON_C, [0.03, 0.04, 3.6], [s * 0.67, 1.5, -0.3])
    }
    k.box(NEON_C, [1.3, 0.04, 0.03], [0, 1.5, 1.5])
    k.box({ c: '#c62828', r: 0.7 }, [0.02, 0.35, 0.5], [0, 2.3, -1.2])
    k.cyl(DARK, 0.02, 0.02, 0.8, [0, 2.2, -1.5], undefined, 4)
  })
  const flat = useMemo(() => flatten(boat), [boat])
  const refs = useRef<(Group | null)[]>([])
  const boats = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ x: x - 7 - (i % 3) * 7, z: (i / 5) * (len + 60), v: (i % 2 ? -1 : 1) * (0.6 + (i % 3) * 0.2) })), [len, x])
  useFrame((_, dt) => {
    boats.forEach((b, i) => {
      b.z += b.v * dt
      if (b.z > len + 70) b.z -= len + 90
      if (b.z < -20) b.z += len + 90
      refs.current[i]?.position.set(b.x, 0, b.z)
    })
  })
  return (
    <>
      {boats.map((b, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }} position={[b.x, 0, b.z]} rotation-y={b.v < 0 ? Math.PI : 0}>
          <PropMesh parts={flat} />
        </group>
      ))}
    </>
  )
}

// The far bank: the pearl tower, the bottle-opener tower, the twisting tower, the tiered pagoda
// tower and a wall of glass ahead; along the whole far shore a lit embankment and tower blocks;
// on the old town side, far flats behind the back row.
function Skyline() {
  const parts = useProp('shanghai-skyline-d3', (k) => {
    // Glass that keeps a faint blue glow after dark, so the towers stand out against the night sky.
    const glass = glow('#5b7fa6', 0.35, 0.35)
    const glass2 = glow('#6c7f93', 0.4, 0.3)
    const lit = glow('#d6f0ff', 0.1, 1.4)
    const pinkGlow = glow('#ff4fa3', 0.15, 1.5)
    // Pearl tower: three legs, a big pearl low, a smaller one high, a little one and the spire.
    const px = -38
    const pz = 60
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      k.rod({ c: '#d9d4cf', r: 0.5 }, [px + Math.sin(a) * 6, 0, pz + Math.cos(a) * 6], [px + Math.sin(a) * 1.4, 14, pz + Math.cos(a) * 1.4], 0.9, 8)
    }
    for (let i = 0; i < 3; i++) k.cyl({ c: '#d9d4cf', r: 0.5 }, 1.0, 1.0, 34, [px + Math.sin(i * 2.1) * 1.2, 22, pz + Math.cos(i * 2.1) * 1.2], undefined, 10)
    k.sphere({ c: '#c2185b', r: 0.3, m: 0.25 }, 5.2, [px, 14, pz], [1, 1, 1], 20, 14)
    k.sphere({ c: '#c2185b', r: 0.3, m: 0.25 }, 3.2, [px, 36, pz], [1, 1, 1], 18, 12)
    k.sphere({ c: '#c2185b', r: 0.3, m: 0.25 }, 1.4, [px, 46, pz], [1, 1, 1], 14, 10)
    for (const y of [12, 14, 16, 35, 37]) k.torus(pinkGlow, y < 30 ? 5.25 : 3.25, 0.12, [px, y, pz], [Math.PI / 2, 0, 0], Math.PI * 2, 32, 4)
    k.cyl({ c: '#d9d4cf', r: 0.5 }, 0.5, 0.8, 8, [px, 51, pz], undefined, 8)
    k.cyl({ c: '#bdbdbd', r: 0.4, m: 0.25 }, 0.12, 0.3, 10, [px, 60, pz], undefined, 6)
    // The bottle opener: a tall tapering slab with a trapezoid hole near its top.
    const bx = -10
    const bz = 76
    frustum(k, glass, 9, 9, 50, 0.7, [bx, 0, bz])
    k.box(DARK, [4.2, 4.6, 7], [bx, 52.5, bz])
    for (const s of [-1, 1]) k.box(glass, [1.6, 7, 6.4], [bx + s * 2.9, 53.5, bz])
    k.box(glass, [7.4, 1.4, 6.4], [bx, 56.4, bz])
    for (let y = 4; y < 50; y += 3) nub(k, lit, [9 - y * 0.05, 0.25, 0.1], [bx, y, bz - 4.5 + y * 0.022])
    // The twisting tower, stacked slabs each turned a little more.
    const tx = 4
    const tz = 86
    for (let i = 0; i < 26; i++) {
      const s = 10 - i * 0.22
      k.box(i % 2 ? glass : glass2, [s, 2.6, s], [tx, 1.3 + i * 2.6, tz], [0, i * 0.06, 0])
      if (i % 2) nub(k, lit, [s * 0.9, 0.2, 0.1], [tx, 1.3 + i * 2.6, tz - s / 2 - 0.02], [0, i * 0.06, 0])
    }
    // The tiered pagoda tower: setbacks that step in like a pagoda's storeys, a gold crown and spire.
    const jx = -24
    const jz = 80
    let y = 0
    for (let i = 0; i < 9; i++) {
      const w = 8 - i * 0.62
      const h = i < 3 ? 7 : 4.2 - i * 0.2
      k.box(glass2, [w, h, w], [jx, y + h / 2, jz])
      k.box({ c: '#9aa3a8', r: 0.5 }, [w + 0.5, 0.3, w + 0.5], [jx, y + h, jz])
      nub(k, lit, [w * 0.7, 0.2, 0.1], [jx, y + h - 0.6, jz - w / 2 - 0.03])
      y += h
    }
    k.box({ c: '#d6a83a', r: 0.4 }, [2.2, 2.4, 2.2], [jx, y + 1.2, jz])
    k.cyl({ c: '#bdbdbd', r: 0.4 }, 0.08, 0.35, 9, [jx, y + 6.9, jz], undefined, 6)
    // A wall of lit glass towers along the far bank.
    const rr = rand(91)
    for (let i = 0; i < 16; i++) {
      const x = -90 + i * 7 + rr() * 3
      if (Math.abs(x - px) < 9 || Math.abs(x - bx) < 7 || Math.abs(x - tx) < 7 || Math.abs(x - jx) < 6) continue
      const h = 14 + rr() * 26
      const w = 4 + rr() * 3
      const z = 66 + rr() * 24
      k.box(rr() < 0.5 ? glass : glass2, [w, h, w], [x, h / 2, z])
      for (let yy = 3; yy < h - 1; yy += 2.4) nub(k, lit, [w * 0.86, 0.22, 0.1], [x, yy, z - w / 2 - 0.02])
      k.box(rr() < 0.4 ? pinkGlow : lit, [w * 0.6, 0.3, 0.1], [x, h + 0.4, z - w / 2])
    }
    // The far shore beside the road: a lit embankment, a row of trees, then towers, each with its
    // windows lit on the face turned to the river.
    k.box({ c: '#56595c', r: 0.9 }, [3, 1.0, 230], [-47.5, 0.5, 40])
    k.box(WARM, [0.05, 0.1, 230], [-45.97, 0.85, 40])
    for (let zz = -70; zz < 150; zz += 4.5) k.ico({ c: '#2f4a32', r: 1 }, 1.2, [-48.4, 1.9, zz], [1, 0.9, 1], 0)
    const fr = rand(707)
    for (let zz = -66; zz < 150; zz += 7 + fr() * 5) {
      const w = 4 + fr() * 4
      const d = 4 + fr() * 3
      const h = 10 + fr() * 30
      const x = -53 - d / 2 - fr() * 14
      if (zz > 45 && zz < 100 && x > -60) continue
      const g = fr() < 0.5 ? glass : glass2
      k.box(g, [d, h, w], [x, h / 2, zz])
      for (let yy = 2.5; yy < h - 1; yy += 2.2) nub(k, lit, [0.1, 0.22, w * 0.84], [x + d / 2 + 0.02, yy, zz])
      if (fr() < 0.5) k.box(fr() < 0.5 ? pinkGlow : lit, [0.1, 0.4, w * 0.7], [x + d / 2 + 0.02, h + 0.5, zz])
    }
    // Flats on the old town side, far behind the back row, ahead.
    for (let zz = 30; zz < 100; zz += 9 + fr() * 6) {
      const w = 5 + fr() * 3
      const h = 26 + fr() * 18
      const x = 30 + fr() * 26
      k.box({ c: '#5d6670', r: 0.85 }, [w, h, w], [x, h / 2, zz])
      for (let yy = 3; yy < h - 1; yy += 2.3) nub(k, lit, [w * 0.7, 0.2, 0.1], [x, yy, zz - w / 2 - 0.02])
      k.box(LANTERN, [0.4, 0.4, 0.4], [x, h + 0.3, zz])
    }
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
