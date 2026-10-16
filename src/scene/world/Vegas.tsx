import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, CylinderGeometry, MeshStandardMaterial, Object3D, SRGBColorSpace, type InstancedMesh } from 'three'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Scatter, archTop, coconutPalm, frustum, glow, prop, rand, useProp, type Look, type PropKit, type Spot, type V3 } from './kit'
import type { WorldProps } from './WorldVenue'

// USA, Neon Mile: a mile down the desert strip in the sun. The welcome sign stands at the
// start; then casino towers with lit marquees on both sides, the black glass pyramid with its
// beam, the half-size iron tower, the dancing fountains before a curved hotel, the green
// statue with her torch before a little skyline, the fairy-tale castle, a wedding chapel and
// motel signs. Ahead, the red rock mountains and the tall needle tower.

const DARK: Look = { c: '#23262a', r: 1 }
const WHITE: Look = { c: '#f2efe8', r: 0.8 }
const CHROME: Look = { c: '#c9ced3', r: 0.3, m: 0.7 }
// Neon here shows even by day.
const neon = (c: string) => glow(c, 0.45, 1.6)
const NEON = ['#ff3d7f', '#ffd23f', '#3de0ff', '#7dff6a', '#ff8a3d', '#c77dff']

// A casino resort facing +z: a tall tower behind, a podium with an entrance canopy lined with
// bulbs, neon bands round the podium, and a tall pylon sign out at the kerb.
const CASINOS = [
  { w: 10, h: 20, tower: '#d8b56a', band: '#ff3d7f', glass: '#b08a3c' },
  { w: 9, h: 16, tower: '#f1ede4', band: '#3de0ff', glass: '#6f8fa8' },
  { w: 11, h: 24, tower: '#c9d4dc', band: '#ffd23f', glass: '#4f6f8a' },
  { w: 8, h: 13, tower: '#e8c9b5', band: '#7dff6a', glass: '#8a5f4a' },
  { w: 10, h: 18, tower: '#2f3640', band: '#c77dff', glass: '#1f2a36' },
]
const CD = 10
// Plain finishes for the parts repeated down the mile (posts, rails), so each casino stays a
// handful of draws: its painted body, its glass, and three neons.
const STEEL: Look = { c: '#d4d8dc', r: 0.35, m: 0.25 }
const BRASS: Look = { c: '#c9a24a', r: 0.4, m: 0.25 }
// Plain colour billboards: a field, a big shape and a stripe, no lettering.
const BOARDS = [
  { bg: '#1e5aa8', fg: '#ffd23f', bar: '#ffffff' },
  { bg: '#d32f2f', fg: '#ffffff', bar: '#1b1b1b' },
  { bg: '#ffd23f', fg: '#d32f2f', bar: '#1e5aa8' },
  { bg: '#1b1b1b', fg: '#ff3d7f', bar: '#3de0ff' },
  { bg: '#2e7d32', fg: '#ffd23f', bar: '#ffffff' },
]
function billboard(k: PropKit, idx: number, p: V3, ry: number) {
  const b = BOARDS[idx % BOARDS.length]
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  // Offsets in the board's own frame: x across, z out of the face.
  const at = (x: number, y: number, z: number): V3 => [p[0] + x * c + z * s, p[1] + y, p[2] - x * s + z * c]
  for (const x of [-1.6, 1.6]) k.box(DARK, [0.14, 2.2, 0.14], at(x, -1.1, -0.2), [0, ry, 0])
  k.box({ c: '#e8e8e8', r: 0.8 }, [4.4, 2.2, 0.14], at(0, 0.9, -0.02), [0, ry, 0])
  k.box({ c: b.bg, r: 0.7 }, [4.2, 2.0, 0.04], at(0, 0.9, 0.07), [0, ry, 0])
  k.cyl({ c: b.fg, r: 0.7 }, 0.75, 0.75, 0.03, at(idx % 2 ? 1.0 : -1.0, 0.95, 0.1), [Math.PI / 2, ry, 0], 10)
  if (idx % 3 === 0) k.box({ c: b.fg, r: 0.7 }, [0.9, 0.9, 0.03], at(idx % 2 ? 1.0 : -1.0, 0.95, 0.105), [0, ry, Math.PI / 4])
  k.box({ c: b.bar, r: 0.7 }, [2.0, 0.28, 0.03], at(idx % 2 ? -0.8 : 0.8, 1.2, 0.1), [0, ry, 0])
  k.box({ c: b.bar, r: 0.7 }, [1.5, 0.16, 0.03], at(idx % 2 ? -1.05 : 1.05, 0.7, 0.1), [0, ry, 0])
  k.box(DARK, [4.4, 0.06, 0.5], at(0, -0.15, 0.2), [0, ry, 0])
}
function casino(k: PropKit, c: (typeof CASINOS)[number], idx: number) {
  const tower: Look = { c: c.tower, r: 0.6, m: 0.15 }
  const glass: Look = { c: c.glass, r: 0.2, m: 0.5 }
  const band = neon(c.band)
  const acc = neon(NEON[(idx + 2) % NEON.length])
  const bulb = neon('#fff2c0')
  const venice = idx === 1
  const f = CD / 2
  // The tower set back on the lot, wings either side of a taller core, glass bands per floor.
  const tw = c.w * 0.6
  k.box(tower, [tw, c.h, 3.4], [0, c.h / 2, -2.4])
  k.box(tower, [tw * 0.4, c.h + 2, 3.6], [0, (c.h + 2) / 2, -2.4])
  for (let y = 3.6; y < c.h - 0.6; y += 1.15) k.box(glass, [tw + 0.04, 0.55, 3.44], [0, y, -2.4])
  // Vertical neon fins up the core.
  for (const s of [-1, 1]) k.box(band, [0.1, c.h - 3, 0.1], [s * tw * 0.2, (c.h - 3) / 2 + 2.8, -0.58])
  // The crown: two setbacks on the core and a lit cap, the wings' parapets.
  k.box(tower, [tw * 0.3, 1.6, 2.8], [0, c.h + 2.8, -2.4])
  k.box(tower, [tw * 0.18, 1.2, 2.0], [0, c.h + 4.2, -2.4])
  k.box(acc, [tw * 0.3 + 0.06, 0.16, 2.86], [0, c.h + 3.5, -2.4])
  k.cyl(STEEL, 0.03, 0.08, 2.4, [0, c.h + 6, -2.4], undefined, 6)
  k.box(band, [tw * 0.4 + 0.06, 0.4, 3.66], [0, c.h + 1.6, -2.4])
  for (const s of [-1, 1]) k.box(tower, [tw * 0.3, 0.4, 3.5], [s * tw * 0.35, c.h + 0.2, -2.4])
  // The podium: casino floor behind gold glass, neon trim, a billboard on its roof.
  k.box({ c: '#e9e2d4', r: 0.8 }, [c.w, 2.6, 5], [0, 1.3, f - 2.5])
  k.box(glass, [c.w - 1, 1.3, 0.04], [0, 0.8, f + 0.01])
  k.box(band, [c.w + 0.04, 0.12, 0.04], [0, 2.3, f + 0.02])
  k.box(acc, [c.w + 0.04, 0.08, 0.04], [0, 2.05, f + 0.02])
  billboard(k, idx, [venice ? c.w / 2 - 2.6 : -c.w / 2 + 2.6, 4.8, f - 1.2], 0)
  // Entrance canopy on steel posts, bulbs underneath and a row of bulbs along its front edge.
  k.box(WHITE, [4, 0.25, 2.4], [0, 1.9, f + 1.2])
  k.box(band, [4.04, 0.06, 2.44], [0, 2.0, f + 1.2])
  for (const x of [-1.8, 1.8]) for (const z of [f + 0.4, f + 2.3]) k.cyl(STEEL, 0.06, 0.06, 1.8, [x, 0.9, z], undefined, 8)
  for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) k.sphere(bulb, 0.06, [-1.6 + i * 0.53, 1.75, f + 0.5 + j * 0.7], [1, 1, 1], 4, 3)
  for (let i = 0; i < 9; i++) k.box(bulb, [0.08, 0.08, 0.04], [-1.8 + i * 0.45, 1.9, f + 2.42])
  // The valet stand by the doors: a little lectern, its key box, a red parasol.
  const vx = 3.0
  const vz = f + 1.6
  k.box({ c: '#5a3a24', r: 0.7 }, [0.45, 0.8, 0.35], [vx, 0.4, vz])
  k.box(BRASS, [0.5, 0.05, 0.4], [vx, 0.82, vz])
  k.box(DARK, [0.25, 0.3, 0.06], [vx, 1.05, vz - 0.12])
  k.rod(STEEL, [vx + 0.3, 0, vz], [vx + 0.3, 1.6, vz], 0.025, 5)
  k.cone({ c: '#c62828', r: 0.8 }, 0.5, 0.28, [vx + 0.3, 1.68, vz], undefined, 8)
  // The Venetian one: a canal across its frontage, a humped stone bridge to the doors, a moored
  // gondola, and the brick bell tower at the corner.
  const sz = venice ? f + 4.4 : f + 3.2
  if (venice) {
    const water: Look = { c: '#3f8fb0', r: 0.15 }
    const stone: Look = { c: '#e6dccb', r: 0.85 }
    const cz = f + 3.1
    k.box(water, [c.w, 0.03, 1.2], [0, 0.005, cz])
    for (const s of [-1, 1]) k.box(stone, [c.w, 0.18, 0.16], [0, 0.09, cz + s * 0.68])
    // Bridge: a humped stone arch over the canal, its dark arch opening, a balustrade each side.
    archTop(k, stone, 1.4, 1.5, [0, 0, cz], Math.PI / 2, 0.6)
    for (const s of [-1, 1]) {
      archTop(k, DARK, 0.9, 0.02, [s * 0.755, 0, cz], Math.PI / 2, 0.45)
      const hp = (t: number): V3 => [s * 0.68, 0.42 * Math.sin(t) + 0.3, cz + 0.7 * Math.cos(t)]
      for (let i = 0; i < 6; i++) {
        const t0 = (i / 6) * Math.PI
        const t1 = ((i + 1) / 6) * Math.PI
        k.rod(stone, hp(t0), hp(t1), 0.04, 5)
        const b = hp(t0)
        k.box(stone, [0.06, 0.3, 0.06], [b[0], b[1] - 0.15, b[2]])
      }
    }
    // Gondola: a long black hull, the steel prow comb, a red seat.
    const gx = -c.w / 2 + 1.6
    k.sphere(DARK, 1, [gx, 0.08, cz], [1.3, 0.18, 0.24], 10, 4)
    k.rod(STEEL, [gx + 1.2, 0.12, cz], [gx + 1.38, 0.5, cz], 0.025, 4)
    for (let i = 0; i < 3; i++) k.box(STEEL, [0.1, 0.03, 0.02], [gx + 1.3 + 0.03 * i, 0.32 + i * 0.06, cz])
    k.box({ c: '#b71c1c', r: 0.8 }, [0.4, 0.12, 0.3], [gx - 0.2, 0.22, cz])
    for (const s of [-1, 1]) {
      k.cyl({ c: '#f2efe8', r: 0.6 }, 0.05, 0.05, 1.6, [gx + s * 1.5, 0.8, cz - 0.5], undefined, 6)
      for (let i = 0; i < 2; i++) k.cyl({ c: '#1e5aa8', r: 0.6 }, 0.052, 0.052, 0.3, [gx + s * 1.5, 0.45 + i * 0.6, cz - 0.5], undefined, 6)
    }
    // The bell tower.
    const bx = -c.w / 2 + 0.9
    const bz = f - 0.6
    const brick: Look = { c: '#b4573f', r: 0.9 }
    k.box(brick, [1.4, 10, 1.4], [bx, 5, bz])
    for (const s of [-1, 1]) k.box(stone, [0.12, 10, 1.44], [bx + s * 0.6, 5, bz])
    k.box(stone, [1.6, 0.25, 1.6], [bx, 10.1, bz])
    k.box(stone, [1.4, 1.6, 1.4], [bx, 11.0, bz])
    for (const ry of [0, Math.PI / 2]) k.box(DARK, [0.8, 1.1, 1.42], [bx, 10.95, bz], [0, ry, 0])
    k.box(stone, [1.6, 0.25, 1.6], [bx, 11.9, bz])
    k.box(brick, [1.2, 0.8, 1.2], [bx, 12.4, bz])
    k.cone({ c: '#4f8a6e', r: 0.6 }, 0.9, 3.0, [bx, 14.3, bz], [0, Math.PI / 4, 0], 4)
    k.sphere(BRASS, 0.18, [bx, 15.9, bz], [1, 1, 1], 6, 4)
  }
  // The pylon sign: a tall column, a big lit panel ringed with bulbs, the marquee board, a crown.
  const sx = c.w / 2 - 0.9
  k.box(DARK, [0.5, 6, 0.5], [sx, 3, sz])
  k.box(band, [2.2, 2.4, 0.3], [sx, 6.6, sz])
  k.box(DARK, [2.4, 2.6, 0.26], [sx, 6.6, sz - 0.04])
  k.box(bulb, [1.8, 0.9, 0.3], [sx, 4.6, sz])
  k.box(DARK, [1.96, 1.04, 0.26], [sx, 4.6, sz - 0.04])
  for (let i = 0; i < 4; i++) k.box(DARK, [1.5, 0.06, 0.02], [sx, 4.32 + i * 0.19, sz + 0.16])
  for (const y of [4.1, 5.1]) k.box(acc, [1.9, 0.06, 0.04], [sx, y, sz + 0.155])
  k.sphere(acc, 0.55, [sx, 8.3, sz], [1, 1, 0.5], 12, 8)
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI
    k.box(band, [0.08, 0.5, 0.08], [sx + Math.sin(a) * 0.78, 8.3 + Math.cos(a) * 0.62, sz], [0, 0, -a])
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    k.sphere(bulb, 0.07, [sx + Math.cos(a) * 1.2, 6.6 + Math.sin(a) * 1.3, sz + 0.18], [1, 1, 1], 4, 3)
  }
}

// The welcome sign, facing +z: a diamond-shaped board lit with bulbs, the star on top.
let signTex: CanvasTexture | null = null
function signMat() {
  if (!signTex) {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 320
    const g = c.getContext('2d')!
    g.fillStyle = '#fbf7ec'
    g.fillRect(0, 0, 512, 320)
    g.textAlign = 'center'
    g.fillStyle = '#1e5aa8'
    g.font = 'bold 44px sans-serif'
    g.fillText('WELCOME', 256, 88)
    g.font = 'italic bold 30px sans-serif'
    g.fillText('to the', 256, 128)
    g.fillStyle = '#d32f2f'
    g.font = 'bold 78px sans-serif'
    g.fillText('NEON MILE', 256, 222)
    g.fillStyle = '#1e5aa8'
    g.font = 'bold 30px sans-serif'
    g.fillText('RACE ON', 256, 278)
    signTex = new CanvasTexture(c)
    signTex.colorSpace = SRGBColorSpace
    signTex.anisotropy = 4
  }
  return new MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.35, roughness: 0.6 })
}
function welcomeFrame(k: PropKit) {
  for (const x of [-0.9, 0.9]) k.box(WHITE, [0.22, 2.6, 0.22], [x, 1.3, -0.1])
  k.box({ c: '#d32f2f', r: 0.6 }, [3.8, 0.12, 0.2], [0, 2.4, -0.1])
  // Diamond board behind the face.
  k.box(WHITE, [3.3, 2.0, 0.12], [0, 3.6, -0.15], [0, 0, 0])
  k.box(WHITE, [2.0, 2.0, 0.1], [0, 3.6, -0.16], [0, 0, Math.PI / 4])
  for (let i = 0; i < 22; i++) k.sphere(neon('#ffe08a'), 0.06, [-1.6 + 3.2 * ((i % 11) / 10), i < 11 ? 4.62 : 2.58, 0], [1, 1, 1], 6, 4)
  for (const s of [-1, 1]) for (let j = 0; j < 5; j++) k.sphere(neon('#ffe08a'), 0.06, [s * 1.66, 2.75 + j * 0.45, 0], [1, 1, 1], 6, 4)
  // The red star on top on its little stalk.
  k.box({ c: '#d32f2f', r: 0.6 }, [0.06, 0.6, 0.06], [0.9, 5.0, -0.1])
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    k.box(neon('#ff3d3d'), [0.12, 0.42, 0.05], [0.9 + Math.sin(a) * 0.18, 5.5 + Math.cos(a) * 0.18, -0.1], [0, 0, -a])
  }
  k.cyl({ c: '#e7d3a6', r: 1 }, 1.4, 1.6, 0.25, [0, 0.12, -0.1], undefined, 12)
}

// The black glass pyramid, a sphinx-like lion at its door, two obelisks and the beam of light.
function pyramid(k: PropKit) {
  frustum(k, { c: '#1c1f24', r: 0.1, m: 0.6 }, 26, 26, 19, 0, [0, 0, 0])
  frustum(k, { c: '#2a2f36', r: 0.1, m: 0.6 }, 26.4, 26.4, 0.6, 0.98, [0, 0, 0])
  k.cyl(glow('#e9f6ff', 0.35, 1.4), 0.25, 0.6, 50, [0, 44, 0], undefined, 8)
  const gold: Look = { c: '#c9a24a', r: 0.4, m: 0.6 }
  for (const x of [-5.5, 5.5]) {
    frustum(k, gold, 1, 1, 7, 0.4, [x, 0, 15])
    frustum(k, gold, 0.4, 0.4, 0.4, 0, [x, 7, 15])
  }
  // The lion with the king's head, lying on a plinth, facing out.
  const sand: Look = { c: '#cfae78', r: 1 }
  k.box({ c: '#b48a55', r: 1 }, [3, 0.6, 7], [0, 0.3, 17])
  k.box(sand, [1.8, 1.2, 5], [0, 1.2, 16.6])
  k.box(sand, [1.6, 1.6, 1.2], [0, 1.8, 18.4])
  for (const s of [-1, 1]) k.box(sand, [0.55, 0.5, 1.8], [s * 0.6, 0.85, 19.6])
  frustum(k, { c: '#e2c48e', r: 1 }, 1.5, 1.3, 1.6, 0.6, [0, 2.4, 18.6])
  k.box(sand, [0.9, 1.0, 0.8], [0, 3.1, 18.9])
  for (const s of [-1, 1]) k.box({ c: '#b48c58', r: 1 }, [0.32, 1.2, 0.3], [s * 0.6, 2.8, 18.9])
  k.box(neon('#3de0ff'), [10, 0.3, 0.1], [0, 1.6, 13.05])
}

// The half-size iron tower: four legs curving in, two platforms, the spire and its beacon.
function ironTower(k: PropKit) {
  const iron: Look = { c: '#7a6450', r: 0.6, m: 0.4 }
  const lv: [number, number][] = [[0, 4.2], [4, 2.8], [8, 1.7], [13, 0.9], [19, 0.45], [26, 0.2]]
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let i = 0; i < lv.length - 1; i++) {
      const [y0, r0] = lv[i]
      const [y1, r1] = lv[i + 1]
      k.rod(iron, [sx * r0, y0, sz * r0], [sx * r1, y1, sz * r1], 0.24 - i * 0.035, 6)
    }
  }
  // Lattice crossings between the legs on each face.
  for (let i = 0; i < lv.length - 1; i++) {
    const [y0, r0] = lv[i]
    const [y1, r1] = lv[i + 1]
    for (const s of [-1, 1]) {
      k.rod(iron, [-r0, y0, s * r0], [r1, y1, s * r1], 0.05, 4)
      k.rod(iron, [r0, y0, s * r0], [-r1, y1, s * r1], 0.05, 4)
      k.rod(iron, [s * r0, y0, -r0], [s * r1, y1, r1], 0.05, 4)
      k.rod(iron, [s * r0, y0, r0], [s * r1, y1, -r1], 0.05, 4)
    }
  }
  // The arches between the feet.
  for (const ry of [0, Math.PI / 2]) k.torus(iron, 2.8, 0.12, [0, 1.2, 0], [0, ry, 0], Math.PI, 16, 5)
  // Platforms with railings and lights.
  for (const [y, r] of [[4, 3.4], [13, 1.4], [19, 0.8]] as const) {
    k.box(iron, [r * 2, 0.35, r * 2], [0, y, 0])
    k.box(neon('#ffd28a'), [r * 2 + 0.04, 0.08, r * 2 + 0.04], [0, y + 0.3, 0])
  }
  k.cyl(iron, 0.12, 0.2, 4, [0, 28, 0], undefined, 6)
  k.sphere(glow('#ff3d3d', 0.5, 1.6), 0.25, [0, 30.2, 0])
  k.box({ c: '#e7d3a6', r: 1 }, [10, 0.2, 10], [0, 0.1, 0])
}

// The hotel stands this far back from the lake's near shore.
const LAKE_FRONT = 11.2
// The curved lake hotel behind the fountains: a crescent of cream towers with blue glass.
function lakeHotel(k: PropKit) {
  const cream: Look = { c: '#ecdfc8', r: 0.7 }
  const blue: Look = { c: '#7f9fb5', r: 0.2, m: 0.4 }
  const R = 22
  for (let i = -5; i <= 5; i++) {
    const a = i * 0.11
    const x = Math.sin(a) * R
    const z = -Math.cos(a) * R + R
    const h = 16 - Math.abs(i) * 0.9
    k.box(cream, [4.2, h, 3.4], [x, h / 2, z], [0, -a, 0])
    for (let y = 2; y < h - 1; y += 1.15) k.box(blue, [4.24, 0.5, 3.44], [x, y, z], [0, -a, 0])
    k.box(cream, [4.4, 0.6, 3.6], [x, h + 0.3, z], [0, -a, 0])
  }
  // Balustrade along the lake's near shore, with lamp posts.
  for (let i = -14; i <= 14; i++) {
    const x = i * 1.2
    k.box(WHITE, [1.1, 0.12, 0.3], [x, 0.85, LAKE_FRONT])
    k.box(WHITE, [0.14, 0.75, 0.14], [x - 0.55, 0.4, LAKE_FRONT])
    if (i % 4 === 0) {
      k.cyl(DARK, 0.05, 0.06, 2.4, [x, 1.2, LAKE_FRONT], undefined, 6)
      k.sphere(glow('#fff2c0', 0.3, 1.2), 0.18, [x, 2.5, LAKE_FRONT])
    }
  }
}

// The green statue with her torch, on a star fort, with a little skyline behind her.
function liberty(k: PropKit) {
  const cu: Look = { c: '#6fa58e', r: 0.7 }
  const stone: Look = { c: '#b9ad97', r: 0.9 }
  k.box(stone, [5, 1, 5], [0, 0.5, 0])
  frustum(k, stone, 3, 3, 4, 0.75, [0, 1, 0])
  k.box(stone, [2.5, 0.4, 2.5], [0, 5.2, 0])
  frustum(k, cu, 1.9, 1.6, 5.2, 0.45, [0, 5.4, 0])
  k.box(cu, [0.9, 1, 0.7], [0, 10.9, 0])
  k.sphere(cu, 0.5, [0, 11.8, 0], [1, 1.15, 1], 12, 8)
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.33
    k.rod(cu, [Math.sin(a) * 0.4, 12.2, -Math.cos(a) * 0.4 + 0.1], [Math.sin(a) * 1.0, 12.6, -Math.cos(a) * 1.0 + 0.1], 0.06, 4)
  }
  // Right arm raising the torch high; left arm holding the tablet.
  k.rod(cu, [0.6, 10.8, 0], [1.0, 13.8, 0.1], 0.22, 7)
  k.cyl({ c: '#c9a24a', r: 0.4, m: 0.6 }, 0.3, 0.15, 0.6, [1.05, 14.1, 0.1], undefined, 8)
  k.cone(glow('#ffb43d', 0.6, 1.8), 0.28, 0.7, [1.05, 14.75, 0.1], undefined, 8)
  k.box(cu, [0.6, 1.0, 0.2], [-0.75, 9.6, 0.4], [0.2, 0, 0.2])
  // The little skyline behind: setback towers with spires.
  const t: Look = { c: '#c8c1b4', r: 0.7 }
  const t2: Look = { c: '#9aa6ad', r: 0.4, m: 0.3 }
  for (const [x, z, w, h] of [[-6, -6, 3, 16], [-2.5, -8, 2.5, 22], [2, -7, 3, 19], [5.5, -5, 2.4, 13], [8.5, -8, 2.6, 17]] as const) {
    k.box(t, [w, h, w], [x, h / 2, z])
    k.box(t, [w * 0.7, 3, w * 0.7], [x, h + 1.5, z])
    k.box(t2, [w * 0.4, 2, w * 0.4], [x, h + 4, z])
    k.cyl(CHROME, 0.04, 0.12, 2.5, [x, h + 6.2, z], undefined, 6)
    for (let y = 1.5; y < h; y += 1.4) k.box({ c: '#5f6f7a', r: 0.3, m: 0.3 }, [w + 0.02, 0.4, w + 0.02], [x, y, z])
  }
}

// The fairy-tale castle: white walls, round towers with red, blue and gold cone roofs.
function castle(k: PropKit) {
  const wall: Look = { c: '#f0ece3', r: 0.8 }
  const roofs = ['#d32f2f', '#1e5aa8', '#f2c230']
  k.box(wall, [16, 6, 6], [0, 3, -2])
  for (let x = -7.5; x <= 7.5; x += 1) k.box(wall, [0.5, 0.6, 6.1], [x, 6.3, -2])
  k.box({ c: '#3a2a20', r: 1 }, [3, 3.6, 0.1], [0, 1.8, 1.01])
  k.cyl({ c: '#3a2a20', r: 1 }, 1.5, 1.5, 0.1, [0, 3.6, 1.01], [Math.PI / 2, 0, 0], 12)
  const towers: [number, number, number, number][] = [[-8, 0.5, 1.6, 10], [8, 0.5, 1.6, 10], [-4, -4, 1.3, 13], [4, -4, 1.3, 13], [0, -5, 1.6, 16], [-10, -4, 1.1, 8], [10, -4, 1.1, 8]]
  towers.forEach(([x, z, r, h], i) => {
    k.cyl(wall, r, r, h, [x, h / 2, z], undefined, 14)
    k.cone({ c: roofs[i % 3], r: 0.6 }, r * 1.25, r * 2.4, [x, h + r * 1.2, z], undefined, 14)
    k.cyl(DARK, 0.02, 0.02, 0.8, [x, h + r * 2.4 + 0.4, z], undefined, 4)
    k.box({ c: roofs[(i + 1) % 3], r: 0.7 }, [0.02, 0.25, 0.4], [x, h + r * 2.4 + 0.65, z + 0.2])
    for (let y = 2; y < h - 1; y += 2.4) k.box({ c: '#2a3a4a', r: 0.2 }, [0.3, 0.7, 0.04], [x, y, z + r + 0.01])
  })
  k.box(neon('#ff3d7f'), [8, 0.2, 0.1], [0, 4.6, 1.06])
}

// A pitched roof: a triangular prism along z, its base 1 wide at y 0 and its ridge at y 1.
const ROOF = new CylinderGeometry(0.5, 0.5, 1, 3, 1).rotateX(-Math.PI / 2).translate(0, 0.25, 0).scale(1 / 0.866, 1 / 0.75, 1)

// A little white wedding chapel with a steeple and a lit heart.
function chapel(k: PropKit) {
  k.box(WHITE, [3, 2.2, 4], [0, 1.1, 0])
  k.add({ c: '#e9e3d6', r: 0.7 }, ROOF, [0, 2.2, 0], [0, 0, 0], [3.4, 1.3, 4.3])
  k.box(WHITE, [1.1, 1.8, 1.1], [0, 3.2, 1.4])
  k.cone({ c: '#e9e3d6', r: 0.7 }, 0.8, 2, [0, 5.1, 1.4], undefined, 4)
  k.box({ c: '#d9a63a', r: 0.4, m: 0.6 }, [0.06, 0.6, 0.06], [0, 6.4, 1.4])
  k.box({ c: '#7a4b2e', r: 0.8 }, [0.9, 1.4, 0.06], [0, 0.7, 2.01])
  for (const x of [-1, 1]) k.box({ c: '#9fc3d1', r: 0.2, m: 0.3 }, [0.4, 0.8, 0.04], [x, 1.2, 2.01])
  for (const s of [-1, 1]) k.sphere(neon('#ff3d7f'), 0.32, [s * 0.22, 3.4, 1.97], [1, 1, 0.3], 10, 6)
  k.box(neon('#ff3d7f'), [0.44, 0.44, 0.1], [0, 3.22, 1.97], [0, 0, Math.PI / 4])
  // White picket fence with a gap for the flower arch, and a stone path to the door.
  const picket: Look = { c: '#f5f5f5', r: 0.6 }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = s * (0.75 + i * 0.24)
      k.box(picket, [0.08, 0.7, 0.03], [x, 0.35, 3.0])
      k.cone(picket, 0.057, 0.1, [x, 0.75, 3.0], [0, Math.PI / 4, 0], 4)
    }
    for (const y of [0.25, 0.55]) k.box(picket, [1.05, 0.06, 0.03], [s * 1.23, y, 2.97])
  }
  k.box({ c: '#d8cbb3', r: 0.9 }, [0.8, 0.02, 1.2], [0, 0.015, 2.6])
  // The wedding arch: a white hoop on two posts, wound with roses and leaves.
  const ax = 0.58
  for (const s of [-1, 1]) k.box(picket, [0.08, 1.4, 0.08], [s * ax, 0.7, 3.0])
  k.torus(picket, ax, 0.04, [0, 1.4, 3.0], [0, 0, 0], Math.PI, 12, 4)
  const roses = ['#e91e63', '#ffffff', '#f48fb1', '#c2185b']
  for (let i = 0; i < 15; i++) {
    const t = (i / 14) * Math.PI
    k.ico({ c: '#3f7f3a', r: 1 }, 0.09, [Math.cos(t) * ax, 1.4 + Math.sin(t) * ax, 3.0], [1, 1, 0.8], 0)
    k.sphere({ c: roses[i % 4], r: 0.7 }, 0.06, [Math.cos(t + 0.1) * (ax + 0.03), 1.4 + Math.sin(t + 0.1) * (ax + 0.03), 3.05], [1, 1, 1], 6, 4)
  }
  for (const s of [-1, 1]) for (let j = 0; j < 4; j++) {
    k.ico({ c: '#3f7f3a', r: 1 }, 0.08, [s * ax, 0.4 + j * 0.3, 3.0], [1, 1, 0.8], 0)
    k.sphere({ c: roses[(j + 1) % 4], r: 0.7 }, 0.055, [s * (ax + 0.03), 0.5 + j * 0.3, 3.06], [1, 1, 1], 6, 4)
  }
  // Pots of white flowers either side of the door.
  for (const s of [-1, 1]) {
    k.cyl({ c: '#e9e3d6', r: 0.7 }, 0.18, 0.13, 0.3, [s * 0.75, 0.15, 2.3], undefined, 8)
    k.ico({ c: '#3f7f3a', r: 1 }, 0.22, [s * 0.75, 0.42, 2.3], [1, 0.8, 1], 0)
    for (let j = 0; j < 4; j++) k.sphere(picket, 0.05, [s * 0.75 + Math.cos(j * 1.6) * 0.13, 0.55, 2.3 + Math.sin(j * 1.6) * 0.13], [1, 1, 1], 6, 4)
  }
}

// A desert patch beyond the lots: a tall saguaro with its arms, a barrel cactus, a creosote
// bush and a couple of red rocks.
function cactus(k: PropKit) {
  const green: Look = { c: '#5f7d45', r: 0.9 }
  k.cyl(green, 0.22, 0.26, 3.6, [0, 1.8, 0], undefined, 7)
  k.sphere(green, 0.22, [0, 3.6, 0], [1, 1, 1], 7, 3, Math.PI / 2)
  for (const [s, y0, h] of [[1, 1.4, 1.3], [-1, 1.9, 1.0]] as const) {
    k.rod(green, [0, y0, 0], [s * 0.55, y0 + 0.15, 0], 0.15, 6)
    k.sphere(green, 0.15, [s * 0.55, y0 + 0.15, 0], [1, 1, 1], 6, 4)
    k.rod(green, [s * 0.55, y0 + 0.15, 0], [s * 0.55, y0 + 0.15 + h, 0], 0.15, 6)
    k.sphere(green, 0.15, [s * 0.55, y0 + 0.15 + h, 0], [1, 1, 1], 6, 3, Math.PI / 2)
  }
  k.sphere(green, 0.32, [1.3, 0.22, 0.8], [1, 0.8, 1], 7, 5)
  for (let i = 0; i < 3; i++) k.box({ c: '#f2c230', r: 0.7 }, [0.07, 0.05, 0.07], [1.3 + Math.cos(i * 2.1) * 0.09, 0.47, 0.8 + Math.sin(i * 2.1) * 0.09])
  k.ico({ c: '#8a8f5a', r: 1 }, 0.55, [-1.2, 0.35, -0.6], [1.2, 0.7, 1], 0)
  k.ico({ c: '#a8553a', r: 1 }, 0.5, [0.6, 0.2, -1.1], [1.4, 0.6, 1], 0)
  k.ico({ c: '#b5653b', r: 1 }, 0.3, [1.0, 0.12, -1.5], [1, 0.7, 1.3], 0)
}

// A motel sign: a tall pole, an arrow of bulbs bending towards the road, the vacancy board.
function motel(k: PropKit) {
  // The motel itself behind its sign: two storeys of rooms off an open walkway.
  const wall: Look = { c: '#f3e3c3', r: 0.9 }
  const trim: Look = { c: '#2f8f83', r: 0.7 }
  k.box(wall, [12, 2.6, 3], [0, 1.3, -5])
  k.box(trim, [12.2, 0.12, 1.2], [0, 1.3, -2.9])
  k.box(trim, [12.2, 0.15, 4.4], [0, 2.68, -4.4])
  for (let i = 0; i < 10; i++) {
    const x = -5.4 + i * 1.2
    for (const y of [0, 1.3]) {
      k.box({ c: ['#e57373', '#4fc3f7', '#ffd54f'][i % 3], r: 0.7 }, [0.45, 0.95, 0.04], [x, y + 0.5, -3.49])
      k.box({ c: '#9fc3d1', r: 0.2, m: 0.3 }, [0.4, 0.4, 0.04], [x + 0.45, y + 0.7, -3.49])
    }
    for (const y of [0.65, 1.95]) k.box(WHITE, [0.06, 1.3, 0.06], [x - 0.3, y, -2.35])
  }
  k.box(WHITE, [12, 0.05, 0.05], [0, 1.85, -2.35])
  for (let x = -6; x <= 6; x += 0.3) k.box(WHITE, [0.03, 0.5, 0.03], [x, 1.6, -2.35])
  k.box({ c: '#3d6f8a', r: 0.7 }, [0.3, 5, 0.3], [0, 2.5, 0])
  k.box(neon('#3de0ff'), [0.9, 2.2, 0.18], [0, 4.6, 0])
  k.box({ c: '#1f3c5b', r: 0.7 }, [1.0, 2.3, 0.14], [0, 4.6, -0.04])
  k.box(neon('#ff3d7f'), [2.4, 0.3, 0.12], [-0.9, 3.2, 0])
  k.box(neon('#ff3d7f'), [0.6, 0.6, 0.12], [-2.1, 3.2, 0], [0, 0, Math.PI / 4])
  for (let i = 0; i < 8; i++) k.sphere(neon('#ffe08a'), 0.05, [0.3 - i * 0.3, 3.45, 0.06], [1, 1, 1], 6, 4)
  k.box(neon('#7dff6a'), [1.2, 0.4, 0.1], [0.4, 2.3, 0])
  k.box(DARK, [1.3, 0.5, 0.08], [0.4, 2.3, -0.04])
}

// Dancing fountains: jets that rise and fall in waves along the lake.
function Fountains({ x, z, w }: { x: number; z: number; w: number }) {
  const ref = useRef<InstancedMesh>(null)
  const N = 28
  const geo = useMemo(() => new CylinderGeometry(0.06, 0.16, 1, 6, 1, true).translate(0, 0.5, 0), [])
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#eef8ff', emissive: '#bfe6ff', emissiveIntensity: 0.4, transparent: true, opacity: 0.85, roughness: 0.2 }), [])
  const o = useMemo(() => new Object3D(), [])
  useLayoutEffect(() => {
    ref.current?.computeBoundingSphere()
  }, [])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1)
      const h = 1.2 + Math.max(0, Math.sin(t * 1.3 - u * 7)) * 5 + Math.max(0, Math.sin(t * 0.6 + u * 3)) * 2.5
      o.position.set(x + Math.sin(u * Math.PI) * 1.2, 0, z + (u - 0.5) * w)
      o.scale.set(1, h, 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, N]} frustumCulled={false} raycast={() => null} />
}

export default function Vegas({ len, race }: WorldProps) {
  const casinos = useMemo(() => CASINOS.map((c, i) => prop(`vegas-casino-d2-${i}`, (k) => casino(k, c, i))), [])
  const palmP = useProp('vegas-palm', coconutPalm)
  const frameP = useProp('vegas-welcome', welcomeFrame)
  const pyrP = useProp('vegas-pyramid', pyramid)
  const ironP = useProp('vegas-iron', ironTower)
  const lakeP = useProp('vegas-lake', lakeHotel)
  const libP = useProp('vegas-liberty', liberty)
  const castleP = useProp('vegas-castle', castle)
  const chapelP = useProp('vegas-chapel-d2', chapel)
  const motelP = useProp('vegas-motel', motel)
  const cactusP = useProp('vegas-cactus', cactus)
  const sign = useMemo(() => signMat(), [])
  useLayoutEffect(() => () => sign.dispose(), [sign])
  // Landmarks, by side: + is the left of the screen, - the right.
  const L = useMemo(() => ({
    pyramid: { x: EDGE + 24, z: race * 0.18 },
    iron: { x: -(EDGE + 9), z: race * 0.38 },
    lake: { x: EDGE + 5.4, z: race * 0.56 },
    liberty: { x: -(EDGE + 9), z: race * 0.74 },
    castle: { x: EDGE + 9, z: race * 0.9 },
    chapel: { x: -(EDGE + 5.5), z: race * 0.27 },
  }), [race])

  // The first stretch on the right is old motels before the casinos begin.
  const MOTELS = Math.min(race * 0.15, 70)
  const geo = useMemo(() => {
    const r = rand(1601)
    const rows: Spot[][] = CASINOS.map(() => [])
    const clear = (z: number, side: number, half: number) => (side < 0 && z - half < MOTELS + 6) || Object.values(L).some((l) => Math.sign(l.x) === side && Math.abs(z - l.z) < half + (l === L.chapel ? 3 : l === L.lake ? 22 : l === L.pyramid ? 15 : 10))
    for (const side of [1, -1]) {
      for (let z = 14; z < len + 40;) {
        const i = Math.floor(r() * CASINOS.length)
        const c = CASINOS[i]
        const zc = z + c.w / 2
        if (!clear(zc, side, c.w / 2)) rows[i].push({ x: side * (EDGE + 5.4 + CD / 2), z: zc, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 })
        z += c.w + 2 + r() * 3
      }
    }
    const palms: Spot[] = []
    for (const side of [1, -1]) for (let z = -10 + side * 2; z < len + 40; z += 9 + r() * 3) palms.push({ x: side * (EDGE + 0.9), z, ry: r() * 6, s: 0.95 + r() * 0.3 })
    const motels: Spot[] = []
    for (let z = 18; z < MOTELS; z += 16) motels.push({ x: -(EDGE + 1.6), z, ry: Math.PI / 2 })
    const rr = rand(17)
    const scrub = Array.from({ length: 160 }, () => ({ x: (rr() < 0.5 ? 1 : -1) * (EDGE + 18 + rr() * 30), z: rr() * (len + 60) - 14, s: 0.6 + rr() * 0.8, ry: rr() * 6 }))
    const cacti: Spot[] = []
    for (let z = -10; z < len + 40; z += 15 + rr() * 12) {
      const side = rr() < 0.5 ? 1 : -1
      const x = side * (EDGE + 17.5 + rr() * 26)
      if ((side > 0 && Math.abs(z - L.pyramid.z) < 17) || (side < 0 && Math.abs(z - L.liberty.z) < 12)) continue
      cacti.push({ x, z, ry: rr() * 6, s: 0.8 + rr() * 0.5 })
    }
    return { rows, palms, motels, scrub, cacti }
  }, [len, L, MOTELS])

  return (
    <>
      <Batch version={`vegas:${len}`} cell={24}>
        {[1, -1].map((s) => (
          <mesh key={s} rotation-x={-Math.PI / 2} position={[s * (EDGE + 0.9), 0.012, len / 2 + 5]}>
            <planeGeometry args={[1.8, len + 60]} />
            <meshStandardMaterial color="#d8cfbf" />
          </mesh>
        ))}
        {[1, -1].map((s) => (
          <mesh key={`lot${s}`} rotation-x={-Math.PI / 2} position={[s * (EDGE + 9), 0.01, len / 2 + 5]}>
            <planeGeometry args={[14, len + 60]} />
            <meshStandardMaterial color="#c9bba3" />
          </mesh>
        ))}
        <group position={[-(EDGE + 3.2), 0, 7]} rotation-y={Math.PI / 2 + 0.5}>
          <PropMesh parts={frameP} />
          <mesh position={[0, 3.6, 0.0]} material={sign}>
            <planeGeometry args={[3.2, 2.0]} />
          </mesh>
        </group>
        <group position={[L.pyramid.x, 0, L.pyramid.z]} rotation-y={-Math.PI / 2}><PropMesh parts={pyrP} /></group>
        <group position={[L.iron.x, 0, L.iron.z]}><PropMesh parts={ironP} /></group>
        <group position={[L.lake.x - 3.1 + LAKE_FRONT, 0, L.lake.z]} rotation-y={-Math.PI / 2}><PropMesh parts={lakeP} /></group>
        <mesh rotation-x={-Math.PI / 2} position={[L.lake.x, 0.02, L.lake.z]}>
          <planeGeometry args={[6, 34]} />
          <meshStandardMaterial color="#3f7fa6" roughness={0.1} metalness={0.2} />
        </mesh>
        <group position={[L.liberty.x, 0, L.liberty.z]} rotation-y={Math.PI / 2}><PropMesh parts={libP} /></group>
        <group position={[L.castle.x, 0, L.castle.z]} rotation-y={-Math.PI / 2}><PropMesh parts={castleP} /></group>
        <group position={[L.chapel.x, 0, L.chapel.z]} rotation-y={Math.PI / 2}><PropMesh parts={chapelP} /></group>
        <Scatter spots={geo.scrub} colors={['#8a8f5a', '#9c9a62', '#7d7a4f']}>
          <icosahedronGeometry args={[0.35, 0]} />
        </Scatter>
      </Batch>
      {casinos.map((c, i) => <Many key={i} parts={c} at={geo.rows[i]} />)}
      <Many parts={palmP} at={geo.palms} />
      <Many parts={motelP} at={geo.motels} />
      <Many parts={cactusP} at={geo.cacti} />
      <Fountains x={L.lake.x} z={L.lake.z} w={30} />
      <FarVegas />
    </>
  )
}

// Ahead: red rock mountains on both sides and the tall needle tower with its pod.
function FarVegas() {
  const parts = useProp('vegas-far', (k) => {
    const reds = ['#b5573a', '#a24a32', '#c46a45', '#94432e']
    const rr = rand(23)
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1
      const x = side * (40 + rr() * 40)
      const z = 95 + rr() * 30
      const w = 14 + rr() * 16
      const h = 8 + rr() * 14
      frustum(k, { c: reds[i % 4], r: 1 }, w, w * 0.7, h, 0.35 + rr() * 0.3, [x, 0, z], rr() * 3)
      frustum(k, { c: reds[(i + 1) % 4], r: 1 }, w * 0.5, w * 0.4, h * 0.3, 0.7, [x, h, z], rr() * 3)
    }
    for (let i = 0; i < 6; i++) k.sphere({ c: '#9b6b54', r: 1 }, 1, [-70 + i * 28, 0, 130], [22, 10, 10], 12, 8, Math.PI / 2)
    // The needle tower: a tapering three-legged shaft, the pod, the mast and its lights.
    const tx = 16
    const tz = 104
    const shaft: Look = { c: '#e9e6df', r: 0.6 }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      k.rod(shaft, [tx + Math.cos(a) * 3.2, 0, tz + Math.sin(a) * 3.2], [tx + Math.cos(a) * 1.2, 42, tz + Math.sin(a) * 1.2], 0.9, 8)
    }
    k.cyl(shaft, 1.2, 1.6, 44, [tx, 22, tz], undefined, 10)
    k.cyl(shaft, 4.2, 2.4, 2.4, [tx, 44, tz], undefined, 18)
    k.cyl({ c: '#3b4a52', r: 0.15, m: 0.5 }, 4.3, 4.3, 1.4, [tx, 46.1, tz], undefined, 18)
    k.cyl(shaft, 3.6, 4.3, 1.6, [tx, 47.6, tz], undefined, 18)
    k.cyl(neon('#ff3d7f'), 4.32, 4.32, 0.2, [tx, 45.1, tz], undefined, 18)
    k.cyl(CHROME, 0.2, 0.5, 9, [tx, 53, tz], undefined, 6)
    k.sphere(glow('#ff3d3d', 0.5, 1.6), 0.4, [tx, 57.7, tz])
    // Distant casino towers along the strip ahead.
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1
      const x = side * (8 + rr() * 26)
      const h = 10 + rr() * 22
      const c = ['#d8b56a', '#f1ede4', '#c9d4dc', '#e8c9b5', '#2f3640'][i % 5]
      const v: V3 = [x, h / 2, 82 + rr() * 14]
      k.box({ c, r: 0.6, m: 0.15 }, [5, h, 4], v)
      k.box(neon(NEON[i % NEON.length]), [5.06, 0.4, 4.06], [x, h - 0.6, v[2]])
    }
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
