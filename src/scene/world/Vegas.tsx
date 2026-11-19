import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, CircleGeometry, CylinderGeometry, IcosahedronGeometry, MeshStandardMaterial, Object3D, PlaneGeometry, SphereGeometry, SRGBColorSpace, type BufferGeometry, type Group, type InstancedMesh } from 'three'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Scatter, archTop, coconutPalm, frustum, gable, glow, person, prop, rand, useProp, wedge, type Dress, type Look, type PropKit, type Spot, type V3 } from './kit'
import type { WorldProps } from './WorldVenue'

// USA, Neon Mile: a mile down the desert strip in the sun. At the start, the welcome sign with
// tourists queueing for a photo, a gas station and old motels on the right; on the left an
// old-west saloon front under a giant waving neon cowboy. Then casino resorts on both sides with
// their names up their towers, lit marquees, limos and taxis under bulb-lined canopies, doormen
// and valets; between them a chrome diner, souvenir shops with giant dice, a slots arcade with a
// giant slot machine, a pawn shop and a drive-thru wedding chapel. The black glass pyramid with
// its seated kings and taxi rank, the iron tower before its mansard hotel, hot air balloon sign
// and little arch, the dancing fountains and cypress gardens before the curved hotel, the green
// statue with brownstones, a roller coaster round her skyline, the fairy-tale castle with its
// moat, a wedding chapel with an Elvis wedding on. A monorail runs above the right-hand lots.
// Pavements full of palms, newspaper boxes, hydrants, benches, Elvises, showgirls and tourists.
// Behind, more hotel towers and parking garages; ahead, red rock mountains, the observation
// wheel and the tall needle tower.

const DARK: Look = { c: '#23262a', r: 1 }
const WHITE: Look = { c: '#f2efe8', r: 0.8 }
const CHROME: Look = { c: '#c9ced3', r: 0.3, m: 0.7 }
// Neon here shows even by day.
const neon = (c: string) => glow(c, 0.45, 1.6)
const NEON = ['#ff3d7f', '#ffd23f', '#3de0ff', '#7dff6a', '#ff8a3d', '#c77dff']
// Plain finishes for parts repeated down the mile, so they merge into one draw per prop.
const STEEL: Look = { c: '#d4d8dc', r: 0.35, m: 0.25 }
const BRASS: Look = { c: '#c9a24a', r: 0.4, m: 0.25 }
const GOLD: Look = { c: '#e0b44a', r: 0.4, m: 0.2 }
const RED: Look = { c: '#d32f2f', r: 0.5 }
const PINK: Look = { c: '#ff4f9a', r: 0.5 }
const YEL: Look = { c: '#ffd23f', r: 0.5 }
const BLUE: Look = { c: '#1e5aa8', r: 0.6 }
const GLASS: Look = { c: '#9fc3d1', r: 0.2, m: 0.2 }
const TINT: Look = { c: '#1d2730', r: 0.25 }
const LEAF = ['#3f7f3a', '#4a8a3f', '#356b33']
// Building fronts stand this far from the road's centre line.
const FRONT = EDGE + 5.4

// ---------- Small shared shapes and helpers ----------

// A flat pane facing +z (turned ry): glass, lettering, stripes only ever seen from the front,
// 4 corners instead of a box's 24.
const QUAD = new PlaneGeometry(1, 1)
function pane(k: PropKit, look: Look, w: number, h: number, p: V3, ry = 0) {
  k.add(look, QUAD, p, [0, ry, 0], [w, h, 1])
}
// A little lumpy ball (flowers, leaves, feathers), 24 corners.
const BLOB = new SphereGeometry(1, 5, 3)
const blob = (k: PropKit, look: Look, r: number, p: V3, s: V3 = [1, 1, 1], rot: V3 = [0, 0, 0]) => k.add(look, BLOB, p, rot, [r * s[0], r * s[1], r * s[2]])

// The same PropKit, moved (dx, dz), turned ry, scaled sc and lifted dy, so a piece built at its
// own origin can be dropped into a bigger prop.
const sphGeos = new Map<string, SphereGeometry>()
const icoGeos = new Map<number, IcosahedronGeometry>()
function xf(k: PropKit, dx: number, dz: number, ry = 0, sc = 1, dy = 0): PropKit {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const P = (p: V3): V3 => [dx + (p[0] * c + p[2] * s) * sc, dy + p[1] * sc, dz + (-p[0] * s + p[2] * c) * sc]
  const R = (r?: V3): V3 => (r ? [r[0], r[1] + ry, r[2]] : [0, ry, 0])
  const S = (v: V3): V3 => [v[0] * sc, v[1] * sc, v[2] * sc]
  const o = {
    add: (l: Look, g: BufferGeometry, p: V3, r?: V3, sz: V3 = [1, 1, 1]) => (k.add(l, g, P(p), R(r), S(sz)), o),
    box: (l: Look, sz: V3, p: V3, r?: V3) => (k.box(l, S(sz), P(p), R(r)), o),
    cyl: (l: Look, rt: number, rb: number, h: number, p: V3, r?: V3, n = 10) => (k.cyl(l, rt * sc, rb * sc, h * sc, P(p), R(r), n), o),
    rod: (l: Look, a: V3, b: V3, rad: number, n = 6) => (k.rod(l, P(a), P(b), rad * sc, n), o),
    sphere: (l: Look, rad: number, p: V3, sz: V3 = [1, 1, 1], w = 10, h = 6, cap = Math.PI) => {
      const key = `${w}|${h}|${cap}`
      let g = sphGeos.get(key)
      if (!g) sphGeos.set(key, (g = new SphereGeometry(1, w, h, 0, Math.PI * 2, 0, cap)))
      k.add(l, g, P(p), [0, ry, 0], [rad * sz[0] * sc, rad * sz[1] * sc, rad * sz[2] * sc])
      return o
    },
    ico: (l: Look, rad: number, p: V3, sz: V3 = [1, 1, 1], detail = 1) => {
      let g = icoGeos.get(detail)
      if (!g) {
        icoGeos.set(detail, (g = new IcosahedronGeometry(1, detail)))
        g.computeVertexNormals()
      }
      k.add(l, g, P(p), [0, ry, 0], [rad * sz[0] * sc, rad * sz[1] * sc, rad * sz[2] * sc])
      return o
    },
    cone: (l: Look, rad: number, h: number, p: V3, r?: V3, n = 10) => (k.cone(l, rad * sc, h * sc, P(p), R(r), n), o),
    torus: (l: Look, R0: number, t: number, p: V3, r?: V3, arc?: number, seg?: number, tube?: number) => (k.torus(l, R0 * sc, t * sc, P(p), R(r), arc, seg, tube), o),
  }
  return o as unknown as PropKit
}

// Sign lettering in a blocky 3x5 type, each run of lit pixels one pane. Reads along +x (turned
// ry), facing +z, centred on p.
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001110', $: '011110010011110', '&': '010101010101011', '!': '010010010000010', '.': '000000000000010',
}
function text(k: PropKit, look: Look, str: string, p: V3, px: number, ry = 0) {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const W = str.length * 4 - 1
  for (let i = 0; i < str.length; i++) {
    const g = FONT[str[i]]
    if (!g) continue
    for (let row = 0; row < 5; row++) {
      let col = 0
      while (col < 3) {
        if (g[row * 3 + col] !== '1') {
          col++
          continue
        }
        let e = col
        while (e < 3 && g[row * 3 + e] === '1') e++
        const u = (i * 4 + (col + e) / 2 - W / 2) * px
        pane(k, look, (e - col) * px, px, [p[0] + u * c, p[1] + (2 - row) * px, p[2] - u * s], ry)
        col = e
      }
    }
  }
}
// The pixel size that fits str into width w, at most max.
const fit = (str: string, w: number, max: number) => Math.min(max, w / (str.length * 4 - 1))

// ---------- People ----------

const P = 1.3
const SKIN = ['#f3cfb0', '#e8b48e', '#c98e66', '#8a5a3c', '#f6dcc4', '#5c3a26']
const HAIR = ['#3b2a1e', '#8a5a2b', '#d8b46a', '#1c1c1c', '#a0522d', '#9e9e9e']
const SHIRT = ['#ff7043', '#29b6f6', '#66bb6a', '#ffca28', '#ab47bc', '#ef5350', '#26a69a', '#f5f5f5']
type Extra = 'elvis' | 'showgirl' | 'camera' | 'bags' | 'drink' | 'cowboy' | 'bride' | 'groom' | 'doorman' | 'suitcase' | 'shades' | 'sunhat' | 'bouquet'
// A person (kit.person, true size with a face) plus the strip's costumes and things in hand.
function folk(k: PropKit, d: Dress, ex: Extra[], x: number, z: number, ry: number) {
  const has = (e: Extra) => ex.includes(e)
  const sg = has('showgirl')
  person(k, sg ? { ...d, low: d.skin } : d, x, z, ry)
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const at = (u: number, y: number, w: number): V3 => [x + (u * c + w * s) * P, y * P, z + (-u * s + w * c) * P]
  const r: V3 = [0, ry, 0]
  const hair: Look = { c: d.hair, r: 0.9 }
  if (has('elvis')) {
    // White jumpsuit, gold belt and studs, the high collar, flares, shades and the quiff.
    k.cyl(GOLD, 0.09 * P, 0.09 * P, 0.035 * P, at(0, 0.28, 0), r, 8)
    k.box(WHITE, [0.17 * P, 0.07 * P, 0.025 * P], at(0, 0.56, -0.055), [-0.3, ry, 0])
    for (const u of [-0.035, 0.035]) k.box(GOLD, [0.016 * P, 0.016 * P, 0.01 * P], at(u, 0.43, 0.086), r)
    k.box(GOLD, [0.016 * P, 0.016 * P, 0.01 * P], at(0, 0.37, 0.09), r)
    for (const u of [-0.045, 0.045]) k.cyl(WHITE, 0.045 * P, 0.06 * P, 0.08 * P, at(u, 0.08, 0), r, 6)
    k.sphere(hair, 0.058 * P, at(0, 0.675, 0.03), [1.1, 0.7, 1.25], 6, 4)
    for (const u of [-0.077, 0.077]) k.box(hair, [0.012 * P, 0.05 * P, 0.022 * P], at(u, 0.585, 0.02), r)
  }
  if (has('shades') || has('elvis')) k.box({ c: '#111111', r: 0.3 }, [0.13 * P, 0.028 * P, 0.02 * P], at(0, 0.614, 0.079), r)
  if (sg) {
    // Sequinned top and briefs, a jewelled band and a great fan of plumes, a plume tail.
    k.box({ c: d.top, r: 0.5 }, [0.17 * P, 0.07 * P, 0.11 * P], at(0, 0.25, 0), r)
    k.cyl(GOLD, 0.085 * P, 0.085 * P, 0.03 * P, at(0, 0.665, 0), r, 8)
    const plume: Look = { c: d.hatC ?? '#ffffff', r: 0.9 }
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.3
      blob(k, plume, 1, at(Math.sin(a) * 0.13, 0.8 + Math.cos(a) * 0.12, -0.03), [0.035 * P, 0.13 * P, 0.012 * P], [0, ry, -a])
    }
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.4
      blob(k, plume, 1, at(Math.sin(a) * 0.14, 0.42 + Math.cos(a) * 0.12, -0.12), [0.03 * P, 0.13 * P, 0.012 * P], [0, ry, -a])
    }
    blob(k, GOLD, 0.03 * P, at(0, 0.7, 0.07))
  }
  if (has('camera')) {
    k.box({ c: '#151515', r: 0.4 }, [0.075 * P, 0.05 * P, 0.04 * P], at(0, 0.43, 0.1), r)
    k.cyl({ c: '#3a3a3a', r: 0.3 }, 0.016 * P, 0.016 * P, 0.03 * P, at(0, 0.43, 0.13), [Math.PI / 2, ry, 0], 6)
  }
  if (has('bags')) {
    k.box({ c: '#e91e63', r: 0.8 }, [0.03 * P, 0.12 * P, 0.14 * P], at(0.13, 0.2, 0.01), r)
    k.box({ c: '#fff3c4', r: 0.8 }, [0.03 * P, 0.1 * P, 0.12 * P], at(-0.13, 0.21, 0.01), r)
  }
  if (has('drink')) {
    k.cyl({ c: '#9be36b', r: 0.3 }, 0.03 * P, 0.014 * P, 0.26 * P, at(0.125, 0.4, 0.04), r, 6)
    k.rod(PINK, at(0.125, 0.52, 0.04), at(0.13, 0.6, 0.05), 0.004 * P, 3)
  }
  if (has('cowboy')) {
    k.cyl({ c: '#b58a52', r: 0.8 }, 0.07 * P, 0.08 * P, 0.07 * P, at(0, 0.69, 0), r, 8)
    k.cyl({ c: '#b58a52', r: 0.8 }, 0.15 * P, 0.15 * P, 0.012 * P, at(0, 0.655, 0), r, 10)
  }
  if (has('sunhat')) k.cyl({ c: d.hatC ?? '#f3e2b8', r: 0.8 }, 0.15 * P, 0.15 * P, 0.012 * P, at(0, 0.67, 0), r, 10)
  if (has('doorman')) {
    for (let i = 0; i < 3; i++) k.box(GOLD, [0.014 * P, 0.014 * P, 0.01 * P], at(0, 0.46 - i * 0.06, 0.088), r)
    k.box(GOLD, [0.1 * P, 0.012 * P, 0.072 * P], at(0, 0.688, 0.012), r)
  }
  if (has('suitcase')) {
    k.box({ c: '#5d4037', r: 0.6 }, [0.07 * P, 0.22 * P, 0.17 * P], at(-0.17, 0.13, 0), r)
    k.rod(DARK, at(-0.17, 0.24, -0.03), at(-0.13, 0.29, 0.0), 0.006 * P, 3)
  }
  if (has('bride')) {
    k.sphere(WHITE, 0.09 * P, at(0, 0.61, -0.015), [1.05, 1.05, 1.05], 8, 5, Math.PI * 0.6)
    k.box(WHITE, [0.16 * P, 0.3 * P, 0.02 * P], at(0, 0.45, -0.08), r)
  }
  if (has('bouquet')) {
    blob(k, { c: '#ff80ab', r: 0.8 }, 0.045 * P, at(0, 0.33, 0.1))
    blob(k, { c: '#ffffff', r: 0.8 }, 0.03 * P, at(0.03, 0.36, 0.12))
  }
  if (has('groom')) {
    pane(k, WHITE, 0.06 * P, 0.16 * P, at(0, 0.44, 0.09), ry)
    k.box(DARK, [0.05 * P, 0.02 * P, 0.01 * P], at(0, 0.51, 0.093), r)
  }
}
const D = (top: string, low: string, i: number, more: Partial<Dress> = {}): Dress => ({ top, low, skin: SKIN[i % SKIN.length], hair: HAIR[(i * 5 + 1) % HAIR.length], ...more })

// Clusters of two or three, built round (0, 0) facing +z.
function elvisPhoto(k: PropKit) {
  folk(k, D('#f4f1ea', '#f4f1ea', 4, { hair: '#111111', wave: true }), ['elvis'], -0.15, 0, 0.2)
  folk(k, D(SHIRT[0], '#3d5a80', 1, { hair: HAIR[2] }), ['sunhat', 'shades'], 0.22, 0.02, -0.2)
  folk(k, D(SHIRT[1], '#c8b48a', 2, { hat: 'cap', hatC: '#d32f2f' }), ['camera'], 0.05, 0.75, Math.PI)
}
function showgirls(k: PropKit) {
  folk(k, D('#e91e63', '#e91e63', 4, { hair: '#3b2a1e', wave: true, hatC: '#ffd1e6' }), ['showgirl'], -0.38, 0, 0.15)
  folk(k, D(SHIRT[3], '#3d3d3d', 3, { hat: 'cap', hatC: '#1e5aa8' }), ['drink', 'shades'], 0, 0.08, 0)
  folk(k, D('#3de0ff', '#3de0ff', 0, { hair: '#d8b46a', hatC: '#ffffff' }), ['showgirl'], 0.38, 0, -0.15)
}
function shoppers(k: PropKit) {
  folk(k, D(SHIRT[4], '#2b3a55', 0, { hair: HAIR[4] }), ['bags', 'shades'], -0.22, 0, 0.1)
  folk(k, D('#29b6f6', '#d9c7a0', 2, { hat: 'cap', hatC: '#f5f5f5' }), ['camera'], 0.2, -0.05, -0.1)
  const kid = xf(k, 0.02, 0.42, 0.3, 0.7)
  folk(kid, D(SHIRT[2], '#3d5a80', 5, { wave: true }), [], 0, 0, 0)
}
function walkers(k: PropKit) {
  folk(k, D('#8d6e63', '#2b3a55', 1, {}), ['cowboy'], -0.2, 0, 0)
  folk(k, D(SHIRT[5], '#f5f5f5', 4, { hair: HAIR[2] }), ['drink', 'sunhat'], 0.22, -0.55, 0)
  folk(k, D(SHIRT[6], '#3d3d3d', 3, {}), ['drink', 'shades'], 0.5, -0.4, 0)
}

// ---------- Cars, built facing +z ----------

const TYRE: Look = { c: '#151515', r: 0.9 }
// A flat round hub cap or whitewall, facing +z.
const DISC = new CircleGeometry(1, 8)
function wheels(k: PropKit, xs: number, zs: number[], r = 0.2, wall = false) {
  for (const z of zs) for (const s of [-1, 1]) {
    k.cyl(TYRE, r, r, 0.14, [s * xs, r, z], [0, 0, Math.PI / 2], 8)
    if (wall) k.add(WHITE, DISC, [s * (xs + 0.072), r, z], [0, s * Math.PI / 2, 0], [r * 0.72, r * 0.72, 1])
    k.add(STEEL, DISC, [s * (xs + 0.074), r, z], [0, s * Math.PI / 2, 0], [r * 0.42, r * 0.42, 1])
  }
}
function taxi(k: PropKit) {
  const Y: Look = { c: '#f4c21b', r: 0.45 }
  k.box(Y, [0.95, 0.38, 2.1], [0, 0.39, 0])
  k.box(Y, [0.86, 0.34, 1.1], [0, 0.75, -0.12])
  k.box(TINT, [0.8, 0.28, 0.03], [0, 0.75, 0.47], [-0.45, 0, 0])
  k.box(TINT, [0.8, 0.26, 0.03], [0, 0.75, -0.7], [0.45, 0, 0])
  for (const s of [-1, 1]) {
    for (const z of [0.15, -0.38]) pane(k, TINT, 0.44, 0.24, [s * 0.432, 0.76, z], s * Math.PI / 2)
    for (let i = 0; i < 10; i++) pane(k, i % 2 ? DARK : WHITE, 0.2, 0.07, [s * 0.477, 0.47, -0.9 + i * 0.2], s * Math.PI / 2)
    pane(k, { c: '#fff6d0', r: 0.4 }, 0.16, 0.08, [s * 0.32, 0.45, 1.052])
    pane(k, RED, 0.14, 0.08, [s * 0.34, 0.47, -1.052], Math.PI)
  }
  k.box(WHITE, [0.36, 0.13, 0.13], [0, 1.0, -0.12])
  text(k, DARK, 'TAXI', [0, 1.0, -0.053], 0.019)
  for (const z of [1.07, -1.07]) k.box(STEEL, [0.97, 0.08, 0.06], [0, 0.24, z])
  wheels(k, 0.44, [0.68, -0.68])
}
function limo(k: PropKit) {
  const W: Look = { c: '#f4f4f2', r: 0.35 }
  k.box(W, [1.0, 0.4, 4.4], [0, 0.38, 0])
  k.box(W, [0.92, 0.3, 3.1], [0, 0.73, -0.3])
  k.box(TINT, [0.84, 0.26, 0.03], [0, 0.73, 1.27], [-0.5, 0, 0])
  k.box(TINT, [0.84, 0.24, 0.03], [0, 0.73, -1.86], [0.5, 0, 0])
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) pane(k, TINT, 0.52, 0.2, [s * 0.462, 0.74, 0.9 - i * 0.6], s * Math.PI / 2)
    pane(k, STEEL, 4.3, 0.025, [s * 0.502, 0.5, 0], s * Math.PI / 2)
    pane(k, { c: '#fff6d0', r: 0.4 }, 0.18, 0.07, [s * 0.34, 0.45, 2.202])
    pane(k, RED, 0.16, 0.08, [s * 0.36, 0.47, -2.202], Math.PI)
  }
  k.box(STEEL, [0.4, 0.16, 0.02], [0, 0.42, 2.205])
  k.box(STEEL, [0.04, 0.08, 0.06], [0, 0.62, 2.1])
  for (const z of [2.22, -2.22]) k.box(STEEL, [1.02, 0.08, 0.06], [0, 0.24, z])
  wheels(k, 0.46, [1.55, -1.55])
}
// A pink convertible with tail fins and whitewalls; `wed` gives it the cans and the sign.
function classic(k: PropKit, col: string, wed = false) {
  const B: Look = { c: col, r: 0.4 }
  k.box(B, [1.0, 0.34, 2.5], [0, 0.37, 0])
  for (const s of [-1, 1]) {
    wedge(k, B, [0.08, 0.2, 0.7], [s * 0.46, 0.64, -0.85])
    pane(k, STEEL, 2.4, 0.03, [s * 0.502, 0.45, 0], s * Math.PI / 2)
    k.cyl(RED, 0.05, 0.05, 0.03, [s * 0.4, 0.6, -1.26], [Math.PI / 2, 0, 0], 8)
    pane(k, { c: '#fff6d0', r: 0.4 }, 0.15, 0.1, [s * 0.3, 0.44, 1.252])
  }
  // The open cabin: red seats, the steering wheel, a raked windscreen.
  k.box({ c: '#f5f0e6', r: 0.7 }, [0.84, 0.12, 1.3], [0, 0.56, -0.25])
  for (const z of [0.05, -0.65]) k.box({ c: '#f5f0e6', r: 0.7 }, [0.84, 0.28, 0.1], [0, 0.68, z])
  k.torus(DARK, 0.1, 0.015, [0.22, 0.72, 0.3], [-0.6, 0, 0], Math.PI * 2, 10, 3)
  k.box({ c: '#bfe3ef', r: 0.15 }, [0.86, 0.26, 0.02], [0, 0.66, 0.5], [-0.5, 0, 0])
  for (const z of [1.28, -1.28]) k.box(STEEL, [1.04, 0.1, 0.07], [0, 0.24, z])
  wheels(k, 0.45, [0.8, -0.8], 0.19, true)
  if (wed) {
    k.box(WHITE, [0.7, 0.18, 0.02], [0, 0.5, -1.262])
    text(k, PINK, 'JUST MARRIED', [0, 0.5, -1.274], 0.012, Math.PI)
    for (let i = 0; i < 3; i++) {
      const cz = -1.75 - i * 0.12
      k.rod(DARK, [-0.2 + i * 0.2, 0.25, -1.28], [-0.25 + i * 0.25, 0.05, cz], 0.005, 3)
      k.cyl(STEEL, 0.04, 0.04, 0.1, [-0.25 + i * 0.25, 0.04, cz], [0, 0, Math.PI / 2], 6)
    }
  }
}

// ---------- Casinos ----------

// A casino resort facing +z: a tall tower behind with its name up top, a podium with an
// entrance canopy lined with bulbs and a limo or a taxi under it, the doorman, a guest and the
// valet, neon bands round the podium, and a tall pylon sign out at the kerb.
const CASINOS = [
  { w: 10, h: 20, tower: '#d8b56a', band: '#ff3d7f', glass: '#b08a3c', name: 'GOLDEN ACE', marq: ['LOOSE SLOTS', 'BUFFET $9'] },
  { w: 9, h: 16, tower: '#f1ede4', band: '#3de0ff', glass: '#6f8fa8', name: 'VENEZIA', marq: ['GONDOLAS', 'LIVE OPERA'] },
  { w: 11, h: 24, tower: '#c9d4dc', band: '#ffd23f', glass: '#4f6f8a', name: 'SILVER STAR', marq: ['POKER ROOM', 'MAGIC 8PM'] },
  { w: 8, h: 13, tower: '#e8c9b5', band: '#7dff6a', glass: '#8a5f4a', name: 'DESERT ROSE', marq: ['BINGO 24H', 'STEAKHOUSE'] },
  { w: 10, h: 18, tower: '#2f3640', band: '#c77dff', glass: '#1f2a36', name: 'MIDNIGHT', marq: ['JAZZ CLUB', 'BLACKJACK'] },
]
const CD = 10
// Plain colour billboards: a field, a big shape, a show title.
const BOARDS = [
  { bg: '#1e5aa8', fg: '#ffd23f', bar: '#ffffff', t: 'MAGIC' },
  { bg: '#d32f2f', fg: '#ffffff', bar: '#ffd23f', t: 'CIRCUS' },
  { bg: '#ffd23f', fg: '#d32f2f', bar: '#1e5aa8', t: 'COMEDY' },
  { bg: '#1b1b1b', fg: '#ff3d7f', bar: '#3de0ff', t: 'TONIGHT' },
  { bg: '#2e7d32', fg: '#ffd23f', bar: '#ffffff', t: 'ROCK SHOW' },
]
function billboard(k: PropKit, idx: number, p: V3, ry: number) {
  const b = BOARDS[idx % BOARDS.length]
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  const at = (x: number, y: number, z: number): V3 => [p[0] + x * c + z * s, p[1] + y, p[2] - x * s + z * c]
  for (const x of [-1.6, 1.6]) k.box(DARK, [0.14, 2.2, 0.14], at(x, -1.1, -0.2), [0, ry, 0])
  k.box({ c: '#e8e8e8', r: 0.8 }, [4.4, 2.2, 0.14], at(0, 0.9, -0.02), [0, ry, 0])
  pane(k, { c: b.bg, r: 0.7 }, 4.2, 2.0, at(0, 0.9, 0.054), ry)
  const sx = idx % 2 ? 1.2 : -1.2
  k.cyl({ c: b.fg, r: 0.7 }, 0.7, 0.7, 0.03, at(sx, 0.95, 0.07), [Math.PI / 2, ry, 0], 10)
  if (idx % 3 === 0) k.box({ c: b.fg, r: 0.7 }, [0.9, 0.9, 0.03], at(sx, 0.95, 0.075), [0, ry, Math.PI / 4])
  text(k, { c: b.bar, r: 0.7 }, b.t, at(-sx * 0.55, 1.15, 0.058), fit(b.t, 2.4, 0.11), ry)
  pane(k, { c: b.bar, r: 0.7 }, 2.2, 0.12, at(-sx * 0.55, 0.55, 0.058), ry)
  k.box(DARK, [4.4, 0.06, 0.5], at(0, -0.15, 0.2), [0, ry, 0])
}
function casino(k: PropKit, c: (typeof CASINOS)[number], idx: number) {
  const tower: Look = { c: c.tower, r: 0.6, m: 0.15 }
  const glass: Look = { c: c.glass, r: 0.2, m: 0.25 }
  const band = neon(c.band)
  const acc = neon(NEON[(idx + 2) % NEON.length])
  const bulb = neon('#fff2c0')
  const venice = idx === 1
  const f = CD / 2
  // The tower set back on the lot, wings either side of a taller core, glass bands per floor.
  const tw = c.w * 0.6
  k.box(tower, [tw, c.h, 3.4], [0, c.h / 2, -2.4])
  k.box(tower, [tw * 0.4, c.h + 2, 3.6], [0, (c.h + 2) / 2, -2.4])
  for (let y = 3.6; y < c.h - 1.8; y += 1.15) k.box(glass, [tw + 0.04, 0.55, 3.44], [0, y, -2.4])
  for (const s of [-1, 1]) k.box(band, [0.1, c.h - 4.2, 0.1], [s * tw * 0.2, (c.h - 4.2) / 2 + 2.8, -0.58])
  // The name across the top of the tower, gold on a dark board.
  const np = fit(c.name, tw * 0.9, 0.13)
  k.box(DARK, [tw * 0.96, np * 8, 0.06], [0, c.h - 0.75, -0.5])
  text(k, { c: '#ffd56a', r: 0.5 }, c.name, [0, c.h - 0.75, -0.468], np)
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
  for (let x = -c.w / 2 + 1; x <= c.w / 2 - 1; x += 1.1) pane(k, BRASS, 0.05, 1.3, [x, 0.8, f + 0.034])
  k.box(band, [c.w + 0.04, 0.12, 0.04], [0, 2.3, f + 0.02])
  k.box(acc, [c.w + 0.04, 0.08, 0.04], [0, 2.05, f + 0.02])
  billboard(k, idx, [venice ? c.w / 2 - 2.6 : -c.w / 2 + 2.6, 4.8, f - 1.2], 0)
  // Entrance canopy on steel posts, bulbs underneath and a row of bulbs along its front edge.
  k.box(WHITE, [4, 0.25, 2.4], [0, 1.9, f + 1.2])
  k.box(band, [4.04, 0.06, 2.44], [0, 2.0, f + 1.2])
  for (const x of [-1.8, 1.8]) for (const z of [f + 0.4, f + 2.3]) k.cyl(STEEL, 0.06, 0.06, 1.8, [x, 0.9, z], undefined, 8)
  for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) k.add(bulb, QUAD, [-1.6 + i * 0.53, 1.774, f + 0.5 + j * 0.7], [Math.PI / 2, 0, 0], [0.09, 0.09, 1])
  for (let i = 0; i < 9; i++) pane(k, bulb, 0.09, 0.09, [-1.8 + i * 0.45, 1.9, f + 2.422])
  // A red carpet out of the doors; a limo or a taxi at the kerb under the canopy.
  pane(k, { c: '#b71c1c', r: 0.9 }, 1.0, 1.0, [0, 0.008, f + 0.5], 0)
  if (idx % 2 === 0) limo(xf(k, -0.1, f + 1.45, Math.PI / 2))
  else taxi(xf(k, 0.2, f + 1.45, Math.PI / 2))
  // The doorman, a guest with a suitcase going in, and the valet at his stand.
  folk(k, D('#8b1a1a', '#1a1a1a', idx, { hat: 'cap', hatC: '#8b1a1a' }), ['doorman'], -0.95, f + 0.3, 0)
  const vx = 3.0
  const vz = f + 1.6
  folk(k, D('#f5f5f5', '#1a1a1a', idx + 4, {}), [], vx - 0.42, vz + 0.1, -0.3)
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
    // Gondola with its gondolier in his striped top and straw boater.
    const gx = -c.w / 2 + 1.6
    k.sphere(DARK, 1, [gx, 0.08, cz], [1.3, 0.18, 0.24], 10, 4)
    k.rod(STEEL, [gx + 1.2, 0.12, cz], [gx + 1.38, 0.5, cz], 0.025, 4)
    for (let i = 0; i < 3; i++) k.box(STEEL, [0.1, 0.03, 0.02], [gx + 1.3 + 0.03 * i, 0.32 + i * 0.06, cz])
    k.box({ c: '#b71c1c', r: 0.8 }, [0.4, 0.12, 0.3], [gx - 0.2, 0.22, cz])
    const gk = xf(k, gx - 0.85, cz, Math.PI / 2, 1, 0.12)
    folk(gk, D('#f5f5f5', '#1a1a1a', 1, {}), ['sunhat'], 0, 0, 0)
    for (let i = 0; i < 3; i++) gk.box({ c: '#1e3a8a', r: 0.8 }, [0.24, 0.025, 0.2], [0, 0.4 + i * 0.07, 0])
    gk.rod({ c: '#8a6a4c', r: 0.8 }, [0.2, 0.4, 0.1], [0.5, -0.1, 0.5], 0.015, 4)
    for (const s of [-1, 1]) {
      k.cyl({ c: '#f2efe8', r: 0.6 }, 0.05, 0.05, 1.6, [gx + s * 1.5, 0.8, cz - 0.5], undefined, 6)
      for (let i = 0; i < 2; i++) k.cyl({ c: '#1e5aa8', r: 0.6 }, 0.052, 0.052, 0.3, [gx + s * 1.5, 0.45 + i * 0.6, cz - 0.5], undefined, 6)
    }
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
  // The pylon sign: a tall column, a big lit panel with the name, the marquee with tonight's
  // offers, a crown ringed with bulbs.
  const sx = c.w / 2 - 0.9
  k.box(DARK, [0.5, 6, 0.5], [sx, 3, sz])
  k.box(band, [2.2, 2.4, 0.3], [sx, 6.6, sz])
  k.box(DARK, [2.4, 2.6, 0.26], [sx, 6.6, sz - 0.04])
  const words = c.name.split(' ')
  const wp = fit(words.reduce((a, b) => (a.length > b.length ? a : b)), 2.0, 0.085)
  words.forEach((w, i) => text(k, DARK, w, [sx, 6.6 + (words.length === 1 ? 0 : (0.5 - i) * wp * 7.5), sz + 0.153], wp))
  k.box(bulb, [1.8, 0.9, 0.3], [sx, 4.6, sz])
  k.box(DARK, [1.96, 1.04, 0.26], [sx, 4.6, sz - 0.04])
  c.marq.forEach((m, i) => text(k, { c: '#b71c1c', r: 0.6 }, m, [sx, 4.78 - i * 0.34, sz + 0.153], fit(m, 1.62, 0.045)))
  for (const y of [4.1, 5.1]) k.box(acc, [1.9, 0.06, 0.04], [sx, y, sz + 0.155])
  k.sphere(acc, 0.55, [sx, 8.3, sz], [1, 1, 0.5], 12, 8)
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI
    k.box(band, [0.08, 0.5, 0.08], [sx + Math.sin(a) * 0.78, 8.3 + Math.cos(a) * 0.62, sz], [0, 0, -a])
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    pane(k, bulb, 0.11, 0.11, [sx + Math.cos(a) * 1.2, 6.6 + Math.sin(a) * 1.3, sz + 0.16])
  }
}

// ---------- Infill between the casinos: front at z = 0, 4.6 wide, the lot in front ----------

const FW = 4.6
// A streamlined chrome diner: the barrel roof, red stripes, a row of windows with diners at the
// counter, the vestibule, DINER on the roof, an atomic starburst sign and a pink convertible.
function diner(k: PropKit) {
  const SS: Look = { c: '#d5dade', r: 0.35, m: 0.25 }
  k.box({ c: '#8a8f94', r: 0.8 }, [4.3, 0.25, 3.3], [0, 0.125, -2.0])
  k.box(SS, [4.4, 1.6, 3.4], [0, 1.05, -2.0])
  archTop(k, SS, 3.4, 4.4, [0, 1.85, -2.0], Math.PI / 2, 0.3)
  for (const y of [0.45, 1.75]) k.box(RED, [4.42, 0.12, 3.42], [0, y, -2.0])
  for (let i = 0; i < 7; i++) {
    if (i === 3) continue
    const x = -1.8 + i * 0.6
    pane(k, GLASS, 0.5, 0.6, [x, 1.15, -0.298])
    if (i === 1 || i === 5) folk(k, D(SHIRT[i], '#2b3a55', i, {}), [], x, -0.75, 0)
  }
  // The vestibule with its glass door.
  k.box(SS, [1.1, 2.0, 0.7], [0, 1.0, -0.05])
  k.box(RED, [1.12, 0.12, 0.72], [0, 1.75, -0.05])
  pane(k, GLASS, 0.5, 1.2, [0, 0.8, 0.302])
  pane(k, STEEL, 0.03, 1.2, [0, 0.8, 0.305])
  // The roof sign: white board on struts, DINER in red, STARLITE in blue.
  for (const x of [-1.3, 1.3]) k.box(DARK, [0.06, 1.0, 0.06], [x, 2.6, -1.8])
  k.box(WHITE, [3.2, 1.1, 0.1], [0, 3.1, -1.8])
  text(k, RED, 'DINER', [0, 3.0, -1.748], 0.12)
  text(k, BLUE, 'STARLITE', [0, 3.5, -1.748], 0.045)
  // The starburst sign on its pole at the corner of the lot.
  const px = 1.95
  const pz = 2.9
  k.cyl(DARK, 0.06, 0.08, 4.3, [px, 2.15, pz], undefined, 6)
  k.box(WHITE, [1.4, 0.55, 0.1], [px, 3.0, pz])
  text(k, RED, 'OPEN 24H', [px, 3.0, pz + 0.052], 0.035)
  k.sphere(YEL, 0.18, [px, 4.4, pz], [1, 1, 1], 6, 4)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const t: V3 = [px + Math.cos(a) * 0.55, 4.4 + Math.sin(a) * 0.55, pz]
    k.rod(i % 2 ? RED : YEL, [px, 4.4, pz], t, 0.025, 4)
    k.sphere(i % 2 ? YEL : RED, 0.07, t, [1, 1, 1], 5, 3)
  }
  classic(xf(k, -0.8, 1.75, Math.PI / 2), '#f48fb1')
}
// A souvenir shop: pink stucco, a striped awning, rails of T-shirts out front, SOUVENIRS on
// the fascia and a pair of giant dice on the roof.
function gifts(k: PropKit) {
  const st: Look = { c: '#f3c6a5', r: 0.9 }
  k.box(st, [4.4, 3.2, 5], [0, 1.6, -2.5])
  k.box({ c: '#e0a98a', r: 0.9 }, [4.5, 0.25, 5.1], [0, 3.25, -2.5])
  pane(k, GLASS, 1.5, 1.3, [-1.2, 1.0, 0.002])
  pane(k, GLASS, 1.5, 1.3, [1.2, 1.0, 0.002])
  pane(k, { c: '#5a3a24', r: 0.7 }, 0.7, 1.6, [0, 0.8, 0.002])
  for (let i = 0; i < 11; i++) k.box(i % 2 ? WHITE : RED, [0.4, 0.04, 1.1], [-2.0 + i * 0.4, 2.15, 0.5], [0.35, 0, 0])
  k.box(BLUE, [4.2, 0.6, 0.06], [0, 2.75, 0.03])
  text(k, WHITE, 'SOUVENIRS', [0, 2.75, 0.062], 0.1)
  // T-shirt rails either side of the door.
  for (const s of [-1, 1]) {
    const x = s * 1.3
    for (const u of [-0.5, 0.5]) k.box(DARK, [0.03, 1.2, 0.03], [x + u, 0.6, 1.3])
    k.box(DARK, [1.05, 0.03, 0.03], [x, 1.2, 1.3])
    for (let j = 0; j < 4; j++) {
      const c = SHIRT[(j + (s > 0 ? 2 : 0)) % SHIRT.length]
      k.box({ c, r: 0.9 }, [0.22, 0.3, 0.03], [x - 0.36 + j * 0.24, 1.0, 1.3])
      pane(k, j % 2 ? RED : BLUE, 0.08, 0.08, [x - 0.36 + j * 0.24, 1.03, 1.317])
    }
  }
  // An A-board on the pavement.
  for (const s of [-1, 1]) k.box(WHITE, [0.5, 0.65, 0.03], [-1.6, 0.31, 2.6 + s * 0.1], [s * 0.15, 0, 0])
  text(k, RED, '3 FOR $10', [-1.6, 0.42, 2.722], 0.012, 0)
  // Giant dice on the roof, pips on the faces the road sees.
  const PIPS: [number, number][][] = [[[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]]
  ;[[-0.9, -1.8, 0.4, 3, 4], [0.9, -2.2, -0.5, 4, 1]].forEach(([x, z, ry, a, b]) => {
    const dk = xf(k, x, z, ry, 1, 3.4)
    dk.box({ c: '#fbfbf7', r: 0.6 }, [1.1, 1.1, 1.1], [0, 0.55, 0])
    for (const [u, v] of PIPS[a]) pane(dk, RED, 0.16, 0.16, [u * 0.3, 0.55 + v * 0.3, 0.552])
    for (const [u, v] of PIPS[b]) dk.add(RED, QUAD, [u * 0.3, 1.102, v * 0.3], [-Math.PI / 2, 0, 0], [0.16, 0.16, 1])
  })
  folk(k, D(SHIRT[6], '#c8b48a', 3, { hat: 'cap', hatC: '#ffd23f' }), ['camera'], 0.55, 1.75, -0.4)
}
// A slots arcade: purple front, the deep bulb-lined marquee, slot cabinets by the doors, and a
// giant slot machine on the roof showing two cherries and a seven.
function slotMachine(k: PropKit, s: number) {
  k.box({ c: '#b71c1c', r: 0.5 }, [0.5 * s, 0.9 * s, 0.4 * s], [0, 0.45 * s, 0])
  pane(k, { c: '#fff8e1', r: 0.4 }, 0.36 * s, 0.22 * s, [0, 0.62 * s, 0.202 * s])
  for (let i = 0; i < 3; i++) pane(k, i === 1 ? RED : YEL, 0.06 * s, 0.1 * s, [(i - 1) * 0.11 * s, 0.62 * s, 0.205 * s])
  k.box(GOLD, [0.52 * s, 0.1 * s, 0.42 * s], [0, 0.95 * s, 0])
  k.box(DARK, [0.4 * s, 0.06 * s, 0.1 * s], [0, 0.4 * s, 0.22 * s])
}
function arcade(k: PropKit) {
  const pur: Look = { c: '#3a2550', r: 0.8 }
  const bulb = neon('#fff2c0')
  k.box(pur, [4.4, 3.0, 5], [0, 1.5, -2.5])
  for (const x of [-1.5, 1.5]) pane(k, { c: '#7a6a9a', r: 0.2 }, 1.1, 1.6, [x, 0.95, 0.002])
  pane(k, GOLD, 1.2, 1.7, [0, 0.85, 0.002])
  pane(k, DARK, 0.03, 1.7, [0, 0.85, 0.005])
  // The marquee: a deep canopy, its fascia with SLOTS, bulbs along its edges and underneath.
  k.box(pur, [4.6, 0.7, 1.6], [0, 2.45, 0.8])
  k.box(YEL, [4.62, 0.08, 1.62], [0, 2.1, 0.8])
  text(k, YEL, 'SLOTS', [0, 2.5, 1.602], 0.08)
  text(k, WHITE, 'LOOSEST IN TOWN', [0, 2.21, 1.602], 0.018)
  for (let i = 0; i < 12; i++) k.box(bulb, [0.07, 0.07, 0.04], [-2.2 + i * 0.4, 2.76, 1.61])
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) k.box(bulb, [0.07, 0.05, 0.07], [-1.8 + i * 0.72, 2.07, 0.4 + j * 0.8])
  for (const x of [-1.6, 1.6]) slotMachine(xf(k, x, 0.35), 1)
  // The giant slot machine on the roof.
  const rk = xf(k, 0, -1.6, 0, 1, 3.0)
  rk.box({ c: '#c62828', r: 0.5 }, [2.4, 2.6, 1.0], [0, 1.3, 0])
  archTop(rk, GOLD, 2.4, 1.0, [0, 2.6, 0], 0, 0.35)
  rk.box(GOLD, [2.5, 0.2, 1.1], [0, 0.1, 0])
  rk.box(YEL, [2.0, 0.42, 0.04], [0, 2.25, 0.52])
  text(rk, RED, 'JACKPOT', [0, 2.25, 0.543], 0.06)
  rk.box(DARK, [2.0, 0.95, 0.04], [0, 1.45, 0.52])
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.64
    pane(rk, WHITE, 0.56, 0.82, [x, 1.45, 0.543])
    if (i === 2) text(rk, RED, '7', [x, 1.45, 0.546], 0.1)
    else {
      for (const u of [-0.08, 0.08]) blob(rk, RED, 0.09, [x + u, 1.35, 0.56], [1, 1, 0.5])
      rk.rod({ c: '#2e7d32', r: 0.8 }, [x - 0.08, 1.42, 0.56], [x, 1.62, 0.56], 0.015, 3)
      rk.rod({ c: '#2e7d32', r: 0.8 }, [x + 0.08, 1.42, 0.56], [x, 1.62, 0.56], 0.015, 3)
    }
  }
  rk.box(DARK, [1.2, 0.25, 0.2], [0, 0.55, 0.58])
  rk.cyl(STEEL, 0.08, 0.08, 0.3, [1.35, 1.2, 0], [0, 0, Math.PI / 2], 6)
  rk.rod(STEEL, [1.45, 1.2, 0], [1.45, 2.3, 0.15], 0.045, 6)
  rk.sphere(RED, 0.16, [1.45, 2.35, 0.16], [1, 1, 1], 7, 5)
  folk(k, D('#ff4f9a', '#ff4f9a', 0, { hair: '#1c1c1c', hatC: '#ffe0f0', wave: true }), ['showgirl'], 0.9, 2.0, -0.3)
}
// A pawn shop: tan block, barred windows, PAWN and WE BUY GOLD, the three gold balls on a
// bracket out at the kerb, air conditioners on the roof.
function pawn(k: PropKit) {
  const tan: Look = { c: '#c79a6a', r: 0.95 }
  k.box(tan, [4.4, 2.8, 5], [0, 1.4, -2.5])
  k.box({ c: '#a97e52', r: 0.95 }, [4.5, 0.2, 5.1], [0, 2.85, -2.5])
  for (const x of [-1.3, 1.3]) {
    pane(k, GLASS, 1.4, 1.1, [x, 1.1, 0.002])
    for (let i = 0; i < 6; i++) pane(k, STEEL, 0.03, 1.1, [x - 0.6 + i * 0.24, 1.1, 0.006])
  }
  pane(k, DARK, 0.75, 1.6, [0, 0.8, 0.002])
  for (let i = 0; i < 4; i++) pane(k, STEEL, 0.03, 1.6, [-0.27 + i * 0.18, 0.8, 0.006])
  k.box(DARK, [4.2, 0.7, 0.06], [0, 2.25, 0.03])
  text(k, YEL, 'PAWN', [0, 2.33, 0.062], 0.085)
  text(k, WHITE, 'WE BUY GOLD', [0, 2.04, 0.062], 0.022)
  const px = 1.95
  const pz = 2.9
  k.cyl(DARK, 0.06, 0.08, 3.6, [px, 1.8, pz], undefined, 6)
  k.box(DARK, [1.3, 0.05, 0.05], [px - 0.6, 3.5, pz])
  for (const [dx, dy] of [[-0.35, 0.65], [-0.85, 0.65], [-0.6, 0.98]]) {
    k.rod(DARK, [px + dx, 3.5, pz], [px + dx, 3.5 - dy + 0.17, pz], 0.01, 3)
    k.sphere(GOLD, 0.17, [px + dx, 3.5 - dy, pz], [1, 1, 1], 8, 5)
  }
  k.box(YEL, [1.0, 0.4, 0.06], [px, 1.55, pz])
  text(k, DARK, 'LOANS', [px, 1.55, pz + 0.032], 0.04)
  for (const x of [-1.2, 0.8]) {
    k.box({ c: '#cfcfcf', r: 0.6 }, [0.8, 0.5, 0.7], [x, 3.2, -2.6])
    k.cyl(DARK, 0.25, 0.25, 0.02, [x, 3.46, -2.6], undefined, 8)
  }
  folk(k, D(SHIRT[2], '#3d3d3d', 2, {}), [], -1.0, 1.0, 2.6)
}
// A drive-thru wedding chapel: a white chapel with its steeple, the pink drive-thru canopy with a
// heart, WEDDINGS on the board, and a couple coming out.
function driveChapel(k: PropKit) {
  k.box(WHITE, [3.0, 2.4, 4.4], [-0.75, 1.2, -2.5])
  gable(k, { c: '#e9e3d6', r: 0.7 }, 4.6, 3.3, 1.1, [-0.75, 2.4, -2.5], Math.PI / 2)
  k.box(WHITE, [1.0, 1.4, 1.0], [-0.75, 3.1, -0.9])
  k.cone({ c: '#e9e3d6', r: 0.7 }, 0.75, 1.8, [-0.75, 4.7, -0.9], [0, Math.PI / 4, 0], 4)
  k.box(GOLD, [0.06, 0.5, 0.06], [-0.75, 5.85, -0.9])
  k.box(GOLD, [0.3, 0.06, 0.06], [-0.75, 5.95, -0.9])
  pane(k, { c: '#7a4b2e', r: 0.8 }, 0.9, 1.4, [-0.75, 0.7, -0.298])
  for (const x of [-1.75, 0.25]) pane(k, { c: '#c7a6e0', r: 0.3 }, 0.4, 0.8, [x, 1.3, -0.298])
  // The drive-thru canopy beside it.
  const pinkC: Look = { c: '#f06292', r: 0.6 }
  k.box(pinkC, [1.6, 0.18, 4.0], [1.5, 2.3, -1.5])
  for (const z of [0.3, -3.3]) k.box(WHITE, [0.12, 2.3, 0.12], [2.2, 1.15, z])
  k.box(pinkC, [1.62, 0.6, 0.08], [1.5, 2.7, 0.52])
  text(k, WHITE, 'DRIVE THRU', [1.5, 2.7, 0.563], 0.032)
  for (const s of [-1, 1]) k.sphere(PINK, 0.3, [1.5 + s * 0.2, 3.45, 0.5], [1, 1, 0.3], 8, 5)
  k.box(PINK, [0.42, 0.42, 0.09], [1.5, 3.28, 0.5], [0, 0, Math.PI / 4])
  // The board on the lot.
  for (const x of [-1.6, -0.2]) k.box(WHITE, [0.08, 1.6, 0.08], [x, 0.8, 2.8])
  k.box(pinkC, [1.6, 0.6, 0.08], [-0.9, 1.75, 2.8])
  text(k, WHITE, 'WEDDINGS', [-0.9, 1.82, 2.842], 0.04)
  text(k, WHITE, 'NO WAITING', [-0.9, 1.6, 2.842], 0.022)
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x = -0.75 + s * (0.6 + i * 0.25)
    k.box(WHITE, [0.07, 0.6, 0.03], [x, 0.3, 1.0])
  }
  for (const s of [-1, 1]) k.box(WHITE, [0.95, 0.05, 0.03], [-0.75 + s * 0.97, 0.42, 0.98])
  folk(k, D('#f5f5f5', '#f5f5f5', 0, { robe: true, hair: HAIR[2] }), ['bride', 'bouquet'], -0.95, 0.5, 0.1)
  folk(k, D('#1a1a1a', '#1a1a1a', 1, {}), ['groom'], -0.55, 0.5, -0.1)
  classic(xf(k, 1.5, -1.0), '#f8f8f8', true)
}

// ---------- Pavement furniture, front facing +z ----------

// Newspaper boxes in a row, a litter bin and a fire hydrant.
function kerbA(k: PropKit) {
  ;['#d32f2f', '#1e5aa8', '#ffd23f'].forEach((c, i) => {
    const x = -0.75 + i * 0.36
    k.box({ c, r: 0.5 }, [0.32, 0.45, 0.3], [x, 0.5, 0])
    for (const u of [-0.12, 0.12]) k.box(DARK, [0.03, 0.28, 0.03], [x + u, 0.14, 0])
    pane(k, GLASS, 0.24, 0.18, [x, 0.55, 0.152])
    pane(k, WHITE, 0.24, 0.05, [x, 0.38, 0.152])
  })
  k.cyl({ c: '#2f5a3a', r: 0.7 }, 0.2, 0.18, 0.7, [0.25, 0.35, 0], undefined, 8)
  k.sphere({ c: '#2f5a3a', r: 0.7 }, 0.2, [0.25, 0.7, 0], [1, 0.5, 1], 8, 3, Math.PI / 2)
  k.cyl(GOLD, 0.205, 0.205, 0.04, [0.25, 0.6, 0], undefined, 8)
  const hx = 0.75
  k.cyl(RED, 0.09, 0.1, 0.45, [hx, 0.225, 0], undefined, 8)
  k.sphere(RED, 0.1, [hx, 0.45, 0], [1, 0.8, 1], 8, 3, Math.PI / 2)
  k.cyl({ c: '#e0e0e0', r: 0.5 }, 0.04, 0.04, 0.28, [hx, 0.3, 0], [0, 0, Math.PI / 2], 6)
  k.cyl({ c: '#e0e0e0', r: 0.5 }, 0.05, 0.05, 0.08, [hx, 0.3, 0.1], [Math.PI / 2, 0, 0], 6)
  k.cyl(RED, 0.12, 0.12, 0.04, [hx, 0.02, 0], undefined, 8)
}
// A bus bench with a show advert on its back, and a planter of flowering oleander.
function kerbB(k: PropKit) {
  k.box({ c: '#5a5f66', r: 0.6 }, [1.4, 0.06, 0.38], [-0.4, 0.42, 0])
  for (const x of [-1.0, 0.2]) k.box(DARK, [0.06, 0.42, 0.34], [x, 0.21, 0])
  k.box(DARK, [1.45, 0.6, 0.06], [-0.4, 0.78, -0.2])
  pane(k, { c: '#7b1fa2', r: 0.6 }, 1.35, 0.5, [-0.4, 0.78, -0.168])
  text(k, YEL, 'MAGIC SHOW', [-0.4, 0.84, -0.165], 0.026)
  text(k, WHITE, 'NIGHTLY 9PM', [-0.4, 0.66, -0.165], 0.016)
  const px = 0.85
  k.box({ c: '#cbbfa8', r: 0.9 }, [0.7, 0.4, 0.7], [px, 0.2, 0])
  k.box({ c: '#6b4a2e', r: 1 }, [0.62, 0.02, 0.62], [px, 0.405, 0])
  ;[[0, 0.75, 0, 0.34], [0.15, 0.6, 0.12, 0.25], [-0.15, 0.62, -0.1, 0.24]].forEach(([x, y, z, r], i) => k.ico({ c: LEAF[i % 3], r: 1 }, r, [px + x, y, z], [1, 1.1, 1], 0))
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9
    blob(k, i % 2 ? PINK : { c: '#ffffff', r: 0.8 }, 0.05, [px + Math.cos(a) * 0.25, 0.75 + (i % 3) * 0.12, Math.sin(a) * 0.25])
  }
}

// ---------- The second row: hotel towers and garages behind the casinos ----------

function backSlab(k: PropKit) {
  const cream: Look = { c: '#e9dcc4', r: 0.7 }
  const gl: Look = { c: '#6f8fa8', r: 0.25 }
  k.box(cream, [10, 27, 5], [0, 13.5, 0])
  for (let y = 2; y < 25.5; y += 1.15) k.box(gl, [9.6, 0.5, 5.04], [0, y, 0])
  for (const x of [-3.3, 3.3]) k.box(cream, [0.5, 27, 5.08], [x, 13.5, 0])
  k.box(cream, [10.4, 0.6, 5.4], [0, 27.3, 0])
  k.box(RED, [6, 1.4, 0.2], [0, 26.2, 2.65])
  text(k, WHITE, 'HOTEL', [0, 26.2, 2.752], 0.22)
}
function backTwins(k: PropKit) {
  const t: Look = { c: '#c99a7a', r: 0.7 }
  const gl: Look = { c: '#3f5f78', r: 0.25 }
  for (const [x, h] of [[-3, 22], [3, 29]] as const) {
    k.box(t, [4, h, 4], [x, h / 2, 0])
    for (let y = 2; y < h - 1; y += 1.15) k.box(gl, [4.04, 0.55, 4.04], [x, y, 0])
    k.box(t, [3, 1.6, 3], [x, h + 0.8, 0])
    frustum(k, { c: '#3de0ff', r: 0.4 }, 2.2, 2.2, 1.6, 0.2, [x, h + 1.6, 0])
  }
  k.box(gl, [2.2, 1.6, 2], [0, 14, 0])
  k.box(t, [2.2, 0.3, 2.1], [0, 14.9, 0])
}
function backGarage(k: PropKit) {
  const con: Look = { c: '#cfc8bb', r: 0.9 }
  const cars = ['#d32f2f', '#f2efe8', '#1e5aa8', '#23262a', '#f4c21b', '#9e9e9e']
  for (let i = 0; i < 6; i++) {
    const y = i * 1.2
    k.box(con, [11, 0.3, 7], [0, y + 0.15, 0])
    k.box(con, [11, 0.35, 0.15], [0, y + 0.47, 3.45])
    if (i < 5) for (let j = 0; j < 7; j++) k.box({ c: cars[(i * 3 + j) % 6], r: 0.4 }, [1.0, 0.42, 0.55], [-4.5 + j * 1.5, y + 0.51, 2.7])
  }
  for (let x = -5.2; x <= 5.2; x += 2.6) k.box(con, [0.3, 7.2, 0.3], [x, 3.6, 3.3])
  k.box(con, [11, 7.2, 0.3], [0, 3.6, -3.4])
  k.box(BLUE, [0.2, 3.4, 1.6], [5.6, 4.6, 2.4])
  text(k, WHITE, 'P', [5.705, 5.6, 2.4], 0.3, Math.PI / 2)
  text(k, WHITE, 'PARK', [5.705, 3.9, 2.4], 0.07, Math.PI / 2)
  // A hotel slab rising behind the garage.
  const t: Look = { c: '#d7e0e6', r: 0.6 }
  k.box(t, [7, 22, 4], [0, 11, -6])
  for (let y = 2; y < 21; y += 1.15) k.box({ c: '#4f6f8a', r: 0.25 }, [7.04, 0.5, 4.04], [0, y, -6])
  k.box(neon('#ff3d7f'), [7.06, 0.3, 4.06], [0, 21.4, -6])
}

// ---------- Monorail on the right-hand lots ----------

const MONO_X = -(EDGE + 3.4)
const MONO_Y = 6.2
// It starts past the old motels.
const MONO_Z0 = 66
function monoBeam(k: PropKit) {
  const con: Look = { c: '#d9d4ca', r: 0.8 }
  k.box(con, [0.7, 0.6, 10], [0, MONO_Y, 5])
  k.box({ c: '#9a958c', r: 0.8 }, [0.2, 0.12, 10], [0, MONO_Y - 0.36, 5])
}
function monoPier(k: PropKit) {
  const con: Look = { c: '#cfc8bb', r: 0.8 }
  k.box(con, [0.6, MONO_Y - 0.3, 0.6], [0, (MONO_Y - 0.3) / 2, 0])
  frustum(k, con, 1.0, 1.0, 0.5, 0.7, [0, MONO_Y - 0.8, 0])
  k.box(con, [0.9, 0.3, 0.9], [0, 0.15, 0])
}
function monoTrain(k: PropKit) {
  const body: Look = { c: '#f5f5f5', r: 0.4 }
  for (let i = 0; i < 3; i++) {
    const z = (i - 1) * 3.1
    k.box(body, [1.0, 1.05, 3.0], [0, MONO_Y + 0.85, z])
    k.box({ c: '#1e5aa8', r: 0.5 }, [1.02, 0.5, 3.0], [0, MONO_Y + 0.1, z])
    k.box(RED, [1.03, 0.08, 3.0], [0, MONO_Y + 0.38, z])
    for (const s of [-1, 1]) pane(k, TINT, 2.6, 0.42, [s * 0.505, MONO_Y + 0.98, z], s * Math.PI / 2)
  }
  for (const s of [-1, 1]) {
    k.sphere(body, 1, [0, MONO_Y + 0.65, s * 4.65], [0.5, 0.75, 0.9], 8, 5)
    k.sphere(TINT, 1, [0, MONO_Y + 0.9, s * 4.7], [0.44, 0.4, 0.82], 8, 5)
  }
}
function MonoTrain({ z0, z1 }: { z0: number; z1: number }) {
  const parts = useProp('vegas-mono-train', monoTrain)
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const L = z1 - z0
    const u = (clock.elapsedTime * 5) % (2 * L)
    g.position.z = z0 + (u < L ? u : 2 * L - u)
  })
  return (
    <group ref={ref} position={[MONO_X, 0, z0]}>
      <PropMesh parts={parts} />
    </group>
  )
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
  k.box(WHITE, [3.3, 2.0, 0.12], [0, 3.6, -0.15], [0, 0, 0])
  k.box(WHITE, [2.0, 2.0, 0.1], [0, 3.6, -0.16], [0, 0, Math.PI / 4])
  for (let i = 0; i < 22; i++) k.sphere(neon('#ffe08a'), 0.06, [-1.6 + 3.2 * ((i % 11) / 10), i < 11 ? 4.62 : 2.58, 0], [1, 1, 1], 6, 4)
  for (const s of [-1, 1]) for (let j = 0; j < 5; j++) k.sphere(neon('#ffe08a'), 0.06, [s * 1.66, 2.75 + j * 0.45, 0], [1, 1, 1], 6, 4)
  k.box({ c: '#d32f2f', r: 0.6 }, [0.06, 0.6, 0.06], [0.9, 5.0, -0.1])
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    k.box(neon('#ff3d3d'), [0.12, 0.42, 0.05], [0.9 + Math.sin(a) * 0.18, 5.5 + Math.cos(a) * 0.18, -0.1], [0, 0, -a])
  }
  k.cyl({ c: '#e7d3a6', r: 1 }, 1.4, 1.6, 0.25, [0, 0.12, -0.1], undefined, 12)
}

// The start, on the right: the plaza round the welcome sign with a queue of tourists for the
// photo, a photo booth, parked cars, a gas station behind with its price sign, a motel beside.
// World coordinates relative to (0, 0, 0).
function startWest(k: PropKit) {
  const pave: Look = { c: '#9a948a', r: 0.95 }
  const sx = -(EDGE + 3.2)
  // The queue for the photo and the one taking it.
  folk(k, D('#f4f1ea', '#f4f1ea', 4, { hair: '#111111', wave: true }), ['elvis'], sx - 0.9, 8.6, Math.PI / 2 + 0.5)
  folk(k, D(SHIRT[3], '#3d5a80', 1, {}), ['sunhat', 'shades'], sx - 0.6, 9.2, Math.PI / 2 + 0.5)
  folk(k, D(SHIRT[1], '#c8b48a', 2, { hat: 'cap', hatC: '#d32f2f' }), ['camera'], sx + 0.9, 10.6, -Math.PI / 2 - 0.6)
  ;[[-8.2, 9.8], [-8.5, 10.6]].forEach(([x, z], i) => folk(k, D(SHIRT[(i + 4) % 8], i % 2 ? '#2b3a55' : '#c8b48a', i + 1, i === 2 ? { hat: 'cap', hatC: '#1e5aa8' } : {}), i === 1 ? ['bags'] : i === 3 ? ['drink'] : [], x, z, Math.PI * 0.95))
  // The photo booth.
  const bx = -9.6
  const bz = 4.4
  k.box({ c: '#ffd23f', r: 0.6 }, [1.2, 2.0, 1.2], [bx, 1.0, bz])
  k.box(RED, [1.3, 0.3, 1.3], [bx, 2.15, bz])
  text(k, WHITE, 'PHOTOS', [bx + 0.652, 2.15, bz], 0.035, Math.PI / 2)
  pane(k, { c: '#5a3a24', r: 0.7 }, 0.7, 1.4, [bx + 0.602, 0.85, bz], Math.PI / 2)
  // Parking bays with cars.
  k.box(pave, [6, 0.02, 9], [-12.5, 0.011, 5])
  for (let i = 0; i < 6; i++) k.box(WHITE, [2.4, 0.005, 0.08], [-11.2, 0.026, 1.0 + i * 1.6])
  taxi(xf(k, -11.4, 1.8, -Math.PI / 2))
  classic(xf(k, -11.4, 5.0, -Math.PI / 2), '#4fc3f7')
  limo(xf(k, -14.3, 6.2, 0))
  // The gas station: canopy on four posts, two pumps, the shop and the tall price sign.
  const gx = -17
  const gz = 3
  const can: Look = { c: '#f5f5f5', r: 0.6 }
  for (const x of [-1.6, 1.6]) for (const z of [-2.2, 2.2]) k.box(can, [0.25, 2.6, 0.25], [gx + x, 1.3, gz + z])
  k.box(can, [4.6, 0.4, 6.2], [gx, 2.8, gz])
  k.box(RED, [4.62, 0.14, 6.22], [gx, 2.75, gz])
  for (const z of [-1, 1]) {
    k.box({ c: '#cfcfcf', r: 0.6 }, [0.6, 0.15, 1.2], [gx, 0.075, gz + z * 1.2])
    k.box(RED, [0.4, 1.1, 0.6], [gx, 0.7, gz + z * 1.2])
    pane(k, DARK, 0.25, 0.2, [gx + 0.202, 0.95, gz + z * 1.2], Math.PI / 2)
  }
  k.box({ c: '#e7d3a6', r: 0.9 }, [3, 2.4, 6], [gx - 5, 1.2, gz])
  k.box(RED, [3.02, 0.5, 6.02], [gx - 5, 2.2, gz])
  text(k, WHITE, 'GAS & SNACKS', [gx - 3.488, 2.2, gz], 0.06, Math.PI / 2)
  pane(k, GLASS, 0.02, 1, [gx - 3.49, 0.9, gz])
  for (const z of [-1.5, 1.5]) pane(k, GLASS, 1.6, 1.0, [gx - 3.495, 1.0, gz + z], Math.PI / 2)
  const ps = gz + 6
  k.box(DARK, [0.25, 6, 0.25], [gx + 2, 3, ps])
  k.box(RED, [0.2, 1.0, 2.2], [gx + 2, 6.2, ps])
  text(k, WHITE, 'GAS', [gx + 2.105, 6.2, ps], 0.11, Math.PI / 2)
  k.box(WHITE, [0.2, 1.2, 2.2], [gx + 2, 5.1, ps])
  text(k, DARK, '3.49', [gx + 2.105, 5.35, ps], 0.08, Math.PI / 2)
  text(k, DARK, '3.89', [gx + 2.105, 4.85, ps], 0.08, Math.PI / 2)
}

// The start, on the left: an old-west saloon front of three false-fronted buildings with a
// boardwalk, and a giant neon cowboy waving from the roof with HOWDY beside him. Faces +z.
function saloon(k: PropKit) {
  const woods = ['#a4673a', '#c08a50', '#8a5530']
  const trim: Look = { c: '#f2e3c2', r: 0.8 }
  ;[[-9, 7, 4.6, 'SALOON'], [-1.5, 7.5, 5.6, 'LUCKY NUGGET'], [6.5, 7, 4.2, 'GENERAL STORE']].forEach(([x, w, h, name], i) => {
    const X = x as number
    const W = w as number
    const H = h as number
    const wood: Look = { c: woods[i], r: 0.95 }
    k.box(wood, [W, H - 0.8, 6], [X, (H - 0.8) / 2, -3])
    k.box(wood, [W, 0.8, 0.2], [X, H - 0.4, -0.1])
    k.box(trim, [W + 0.1, 0.18, 0.3], [X, H, -0.1])
    for (let j = 0; j < Math.floor(W / 0.5); j++) pane(k, { c: woods[(i + 1) % 3], r: 0.95 }, 0.03, H - 1.0, [X - W / 2 + 0.25 + j * 0.5, (H - 1.0) / 2, 0.002])
    k.box(trim, [W * 0.8, 0.7, 0.06], [X, H - 1.2, 0.03])
    text(k, { c: '#5a2e14', r: 0.8 }, name as string, [X, H - 1.2, 0.062], fit(name as string, W * 0.74, 0.1))
    // Upper windows, saloon doors, the porch roof on posts.
    for (const u of [-W / 4, W / 4]) {
      pane(k, GLASS, 0.9, 1.1, [X + u, 2.9, 0.004])
      pane(k, trim, 1.0, 0.08, [X + u, 3.49, 0.006])
    }
    pane(k, DARK, 1.1, 1.6, [X, 0.8, 0.004])
    for (const s of [-1, 1]) k.box({ c: '#7a4b2e', r: 0.8 }, [0.5, 0.7, 0.04], [X + s * 0.26, 1.0, 0.03])
    for (const u of [-W / 4, W / 4]) pane(k, GLASS, 1.0, 0.9, [X + u, 1.1, 0.004])
  })
  const plank: Look = { c: '#8a6a4c', r: 1 }
  k.box(plank, [24, 0.15, 2], [-1.5, 0.075, 1.0])
  k.box({ c: '#6f5340', r: 0.9 }, [24, 0.12, 2.3], [-1.5, 2.25, 1.0], [0.08, 0, 0])
  for (let x = -13; x <= 10; x += 2.5) k.box({ c: '#6f5340', r: 0.9 }, [0.14, 2.2, 0.14], [x, 1.1, 1.95])
  for (let x = -12; x <= 9; x += 7) {
    for (const u of [0, 1.6]) k.box(plank, [0.1, 0.8, 0.1], [x + u, 0.4, 2.7])
    k.box(plank, [1.8, 0.08, 0.08], [x + 0.8, 0.75, 2.7])
  }
  for (const [x, z] of [[-5.4, 1.4], [-5.0, 1.7], [3.2, 1.5]]) {
    k.cyl({ c: '#8a5a2b', r: 0.9 }, 0.22, 0.22, 0.55, [x, 0.42, z], undefined, 8)
    for (const y of [0.25, 0.6]) k.cyl(DARK, 0.225, 0.225, 0.04, [x, y, z], undefined, 8)
  }
  // The giant cowboy, about nine storeys of neon-trimmed sheet steel, waving from the roof.
  const ck = xf(k, -1.5, -3.2, 0, 1, 5.6)
  const jean: Look = { c: '#2f4f8a', r: 0.8 }
  const shirt: Look = { c: '#d84315', r: 0.7 }
  const skin: Look = { c: '#e8b48e', r: 0.8 }
  const hat: Look = { c: '#c9a46a', r: 0.8 }
  for (const s of [-1, 1]) {
    ck.box({ c: '#5a3a24', r: 0.7 }, [0.8, 1.1, 1.3], [s * 0.6, 0.55, 0.2])
    ck.box(jean, [0.75, 3.4, 0.75], [s * 0.6, 2.8, 0])
  }
  ck.box({ c: '#5a3a24', r: 0.7 }, [2.1, 0.35, 0.85], [0, 4.5, 0])
  ck.box(GOLD, [0.5, 0.4, 0.1], [0, 4.5, 0.43])
  ck.box(shirt, [2.0, 2.6, 0.9], [0, 6.0, 0])
  for (const s of [-1, 1]) ck.box({ c: '#3e2723', r: 0.8 }, [0.6, 2.5, 0.95], [s * 0.7, 6.0, 0])
  ck.rod(shirt, [-1.1, 7.0, 0], [-1.6, 5.0, 0.2], 0.33, 6)
  ck.sphere(skin, 0.3, [-1.6, 4.8, 0.2], [1, 1, 1], 6, 4)
  ck.rod(shirt, [1.1, 7.0, 0], [2.2, 8.6, 0.1], 0.33, 6)
  ck.sphere(skin, 0.34, [2.3, 8.9, 0.1], [1, 1.2, 0.6], 6, 4)
  ck.box({ c: '#ffffff', r: 0.8 }, [0.9, 0.4, 0.92], [0, 7.2, 0.01])
  ck.box(skin, [0.5, 0.5, 0.5], [0, 7.5, 0])
  ck.sphere(skin, 0.75, [0, 8.4, 0], [1, 1.1, 0.95], 8, 6)
  for (const s of [-1, 1]) ck.box(DARK, [0.14, 0.18, 0.04], [s * 0.28, 8.55, 0.7])
  ck.box({ c: '#3e2723', r: 0.8 }, [0.6, 0.1, 0.04], [0, 8.05, 0.7])
  ck.box(skin, [0.18, 0.25, 0.2], [0, 8.35, 0.75])
  ck.cyl(hat, 1.7, 1.7, 0.12, [0, 9.15, 0], [0.1, 0, 0], 12)
  ck.cyl(hat, 0.75, 0.85, 0.9, [0, 9.6, 0], undefined, 10)
  ck.cyl({ c: '#5a3a24', r: 0.8 }, 0.86, 0.86, 0.18, [0, 9.3, 0], undefined, 10)
  ck.cyl(neon('#ffd23f'), 1.72, 1.72, 0.04, [0, 9.22, 0], [0.1, 0, 0], 12)
  // HOWDY on its own frame beside him, bulbs round it.
  const hk = xf(k, 6.5, -3.0, 0, 1, 7.0)
  for (const x of [-1.5, 1.5]) hk.box(DARK, [0.15, 2.2, 0.15], [x, -1.1, -0.1])
  hk.box(RED, [4.0, 1.4, 0.15], [0, 0.7, 0])
  text(hk, YEL, 'HOWDY', [0, 0.7, 0.078], 0.16)
  for (let i = 0; i < 16; i++) hk.box(neon('#fff2c0'), [0.08, 0.08, 0.05], [-1.9 + i * 0.253, 1.38, 0.08])
  for (let i = 0; i < 16; i++) hk.box(neon('#fff2c0'), [0.08, 0.08, 0.05], [-1.9 + i * 0.253, 0.02, 0.08])
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
// Round the pyramid, in its own frame (it faces +z, its front at z 13): the paved forecourt,
// two seated kings flanking it, palms, a taxi rank, the pharaoh pylon sign, tourists.
function pyramidPlaza(k: PropKit) {
  const pave: Look = { c: '#d8c49a', r: 0.95 }
  k.box(pave, [36, 0.02, 9], [0, 0.011, 17.5])
  for (let x = -17; x <= 17; x += 2) pane(k, { c: '#c4ae82', r: 0.95 }, 0.08, 9, [x, 0.023, 17.5], 0)
  const stone: Look = { c: '#d9bf8a', r: 1 }
  const stoneD: Look = { c: '#b89a66', r: 1 }
  for (const s of [-1, 1]) {
    // A seated king on his throne, hands on knees, the striped headcloth.
    const kk = xf(k, s * 9.5, 16, 0)
    kk.box(stoneD, [2.2, 0.6, 2.8], [0, 0.3, 0])
    kk.box(stone, [1.8, 1.8, 1.8], [0, 1.5, -0.4])
    kk.box(stone, [1.6, 0.8, 1.4], [0, 2.0, 0.4])
    for (const u of [-0.45, 0.45]) kk.box(stone, [0.6, 1.4, 0.6], [u, 1.3, 0.95])
    kk.box(stone, [1.5, 2.2, 1.0], [0, 3.5, -0.4])
    for (const u of [-0.95, 0.95]) kk.box(stone, [0.4, 1.6, 0.5], [u, 3.2, -0.1])
    kk.box(stone, [0.8, 0.9, 0.8], [0, 5.0, -0.35])
    frustum(kk, { c: '#2f6db5', r: 0.7 }, 1.4, 1.0, 1.1, 0.6, [0, 4.5, -0.45])
    for (let i = 0; i < 4; i++) pane(kk, { c: '#e0b44a', r: 0.5 }, 0.08, 1.0, [-0.5 + i * 0.33, 4.9, 0.08])
    kk.box(stone, [0.25, 0.5, 0.2], [0, 4.5, 0.05])
    for (const u of [-0.18, 0.18]) kk.box(DARK, [0.12, 0.06, 0.02], [u, 5.15, 0.06])
    kk.box(stoneD, [2.3, 0.15, 2.9], [0, 0.07, 0])
  }
  // The pylon sign out at the lot's edge.
  const sx = -14
  const sz = 21.5
  frustum(k, { c: '#c9a24a', r: 0.5 }, 1.2, 1.2, 7.5, 0.5, [sx, 0, sz])
  k.box(DARK, [3.2, 1.3, 0.3], [sx, 6.0, sz])
  text(k, { c: '#e0b44a', r: 0.5 }, 'PHARAOH', [sx, 6.0, sz + 0.153], 0.1)
  frustum(k, { c: '#c9a24a', r: 0.5 }, 0.6, 0.6, 1.2, 0, [sx, 7.5, sz])
  // A taxi rank down the side.
  ;[13, 16, 19].forEach((x, i) => (i === 1 ? limo(xf(k, x + 0.6, 21.5, Math.PI / 2)) : taxi(xf(k, x, 21.5, Math.PI / 2))))
  k.box({ c: '#c9a24a', r: 0.5 }, [0.1, 2.0, 0.1], [11.2, 1.0, 22.2])
  k.box(YEL, [0.8, 0.5, 0.05], [11.2, 1.9, 22.2])
  text(k, DARK, 'TAXI', [11.2, 1.9, 22.23], 0.04)
  // Tourists on the forecourt.
  folk(k, D(SHIRT[0], '#3d5a80', 1, {}), ['camera', 'sunhat'], -3.5, 19.5, 0.4)
  folk(k, D(SHIRT[4], '#c8b48a', 2, {}), ['shades'], -3.0, 19.8, -0.6)
  folk(k, D(SHIRT[2], '#2b3a55', 4, { hat: 'cap', hatC: '#ffd23f' }), ['bags'], 3.5, 21.0, Math.PI)
  folk(k, D(SHIRT[7], '#3d3d3d', 3, {}), ['drink'], 4.0, 20.6, Math.PI - 0.5)
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
  for (const ry of [0, Math.PI / 2]) k.torus(iron, 2.8, 0.12, [0, 1.2, 0], [0, ry, 0], Math.PI, 16, 5)
  for (const [y, r] of [[4, 3.4], [13, 1.4], [19, 0.8]] as const) {
    k.box(iron, [r * 2, 0.35, r * 2], [0, y, 0])
    k.box(neon('#ffd28a'), [r * 2 + 0.04, 0.08, r * 2 + 0.04], [0, y + 0.3, 0])
  }
  k.cyl(iron, 0.12, 0.2, 4, [0, 28, 0], undefined, 6)
  k.sphere(glow('#ff3d3d', 0.5, 1.6), 0.25, [0, 30.2, 0])
  k.box({ c: '#e7d3a6', r: 1 }, [10, 0.2, 10], [0, 0.1, 0])
}
// Round the iron tower, in world-aligned coordinates from its foot (-x is away from the road):
// the mansard-roofed hotel behind, the little triumphal arch, the striped hot air balloon sign,
// a café terrace under parasols with people at the tables, round clipped trees.
function paris(k: PropKit) {
  const cream: Look = { c: '#eee3cc', r: 0.8 }
  const slate: Look = { c: '#5f6b74', r: 0.6 }
  // The hotel: a long block with a mansard roof, dormers, rows of windows, two end pavilions.
  const hx = -10
  k.box(cream, [6, 10, 28], [hx, 5, 0])
  frustum(k, slate, 6, 28, 2.6, 0.75, [hx, 10, 0])
  for (let z = -13; z <= 13; z += 1.3) {
    for (let y = 1.6; y < 9.5; y += 1.6) pane(k, { c: '#7f9fb5', r: 0.2 }, 0.7, 1.0, [hx + 3.002, y, z], Math.PI / 2)
    k.box(cream, [0.6, 0.7, 0.5], [hx + 1.9, 11.0, z])
    pane(k, DARK, 0.3, 0.4, [hx + 2.202, 11.0, z], Math.PI / 2)
  }
  for (const s of [-1, 1]) {
    k.box(cream, [7, 12, 5], [hx + 0.5, 6, s * 14])
    frustum(k, slate, 7, 5, 3, 0.4, [hx + 0.5, 12, s * 14])
    k.box(GOLD, [0.1, 1.2, 0.1], [hx + 0.5, 15.4, s * 14])
  }
  k.box(RED, [0.2, 1.4, 9], [hx + 3.1, 8.6, 0])
  text(k, WHITE, 'HOTEL LUTECE', [hx + 3.205, 8.6, 0], 0.15, Math.PI / 2)
  // The little arch, facing the road, beside the tower.
  const ax = 2.4
  const az = 11.5
  const ak = xf(k, ax, az, Math.PI / 2)
  ak.box(cream, [4, 4.2, 1.5], [0, 2.1, 0])
  ak.box(cream, [4.3, 0.5, 1.7], [0, 4.45, 0])
  ak.box(cream, [3.6, 0.6, 1.4], [0, 5.0, 0])
  ak.box(DARK, [1.4, 1.8, 1.52], [0, 0.9, 0])
  archTop(ak, DARK, 1.4, 1.52, [0, 1.8, -0.76], 0, 1)
  for (const s of [-1, 1]) pane(ak, { c: '#d9ccb0', r: 0.8 }, 0.8, 1.4, [s * 1.4, 2.6, 0.752])
  // The balloon sign on its mast at the far end.
  const bz = -12
  const bx = 3.1
  k.cyl(DARK, 0.1, 0.14, 7, [bx, 3.5, bz], undefined, 6)
  const bands = ['#1e5aa8', '#ffffff', '#d32f2f', '#ffffff', '#1e5aa8']
  k.sphere({ c: '#ffffff', r: 0.6 }, 1.5, [bx, 9.0, bz], [1, 1.15, 1], 10, 6)
  for (let i = 0; i < 5; i++) {
    const y = 9.0 - 1.3 + i * 0.65
    const rr = 1.5 * Math.sqrt(Math.max(0, 1 - ((y - 9.0) / 1.72) ** 2)) + 0.01
    k.cyl({ c: bands[i], r: 0.6 }, rr, rr, 0.3, [bx, y, bz], undefined, 10)
  }
  k.box(RED, [0.02, 0.5, 2.2], [bx + 1.52, 9.0, bz])
  text(k, WHITE, 'BONJOUR', [bx + 1.535, 9.0, bz], 0.06, Math.PI / 2)
  k.box({ c: '#8a6a4c', r: 1 }, [0.6, 0.5, 0.6], [bx, 7.0, bz])
  for (const [u, w] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) k.rod(DARK, [bx + u, 7.25, bz + w], [bx + u * 3, 8.0, bz + w * 3], 0.015, 3)
  // The café terrace: tables, parasols and people.
  for (const [x, z] of [[2.2, -7], [2.4, 7.0], [-6, -7.5], [-6.2, 7.5]]) {
    k.cyl({ c: '#e0e0e0', r: 0.5 }, 0.3, 0.3, 0.04, [x, 0.5, z], undefined, 10)
    k.cyl(DARK, 0.03, 0.03, 0.5, [x, 0.25, z], undefined, 4)
    k.rod(DARK, [x, 0.5, z], [x, 1.7, z], 0.02, 4)
    k.cone({ c: '#c62828', r: 0.8 }, 0.75, 0.35, [x, 1.75, z], undefined, 8)
    if (z > 0) folk(k, D(SHIRT[(x * 3 + z) & 7], '#2b3a55', Math.abs(z) | 0, {}), ['drink'], x + 0.5, z, -Math.PI / 2)
    else folk(k, D(SHIRT[((x * 7 + z) & 7)], '#3d3d3d', (Math.abs(z) | 0) + 2, { hair: HAIR[2] }), ['sunhat'], x - 0.5, z, Math.PI / 2)
  }
  for (const z of [-9.5, 9.5, -6.4, 6.4]) {
    k.box({ c: '#cbbfa8', r: 0.9 }, [0.6, 0.5, 0.6], [4.2, 0.25, z])
    k.cyl({ c: '#6f5340', r: 1 }, 0.06, 0.07, 1.0, [4.2, 1.0, z], undefined, 5)
    k.ico({ c: LEAF[(z | 0) & 1], r: 1 }, 0.55, [4.2, 1.8, z], [1, 1, 1], 1)
  }
}

// The hotel stands this far back from the lake's near shore.
const LAKE_FRONT = 11.2
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
// The lake's gardens, in the hotel's frame (shore along x at z = LAKE_FRONT): cypress rows
// and the classical gateway with the hotel's name at each end, people at the rail.
function lakeGardens(k: PropKit) {
  const cyp: Look = { c: '#2f5a33', r: 1 }
  const stone: Look = { c: '#efe6d4', r: 0.8 }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) for (const z of [LAKE_FRONT - 1.2, LAKE_FRONT - 3.6]) {
      const x = s * (18.2 + i * 1.6)
      k.cyl({ c: '#6f5340', r: 1 }, 0.06, 0.08, 0.6, [x, 0.3, z], undefined, 5)
      k.sphere(cyp, 0.5, [x, 2.0, z], [1, 3.4, 1], 7, 5)
    }
    // The gateway: two columns and a lintel with the name, urns on top.
    const gx = s * 19.5
    const gz = LAKE_FRONT - 0.2
    for (const u of [-1.4, 1.4]) {
      k.box(stone, [0.7, 0.4, 0.7], [gx + u, 0.2, gz])
      k.cyl(stone, 0.25, 0.28, 3.2, [gx + u, 2.0, gz], undefined, 10)
      k.box(stone, [0.6, 0.25, 0.6], [gx + u, 3.7, gz])
      k.sphere(stone, 0.25, [gx + u, 4.5, gz], [1, 1.2, 1], 8, 5)
    }
    k.box(stone, [3.7, 0.7, 0.7], [gx, 4.15, gz])
    text(k, { c: '#9c7a2e', r: 0.5 }, 'BELLARIA', [gx, 4.15, gz + 0.352], 0.07)
  }
  ;[[-8, 0.5, Math.PI], [6, 0.4, Math.PI - 0.3]].forEach(([x, dz, ry], i) =>
    folk(k, D(SHIRT[i * 2], i % 2 ? '#2b3a55' : '#c8b48a', i, {}), i === 0 ? ['camera'] : i === 2 ? ['sunhat', 'drink'] : [], x, LAKE_FRONT + 0.6 + dz * 0.3, ry))
}

// The green statue with her torch, on a star fort, with a little skyline behind her.
const LIB_TOWERS = [[-6, -6, 3, 16], [-2.5, -8, 2.5, 22], [2, -7, 3, 19], [5.5, -5, 2.4, 13], [8.5, -8, 2.6, 17]] as const
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
  k.rod(cu, [0.6, 10.8, 0], [1.0, 13.8, 0.1], 0.22, 7)
  k.cyl({ c: '#c9a24a', r: 0.4, m: 0.6 }, 0.3, 0.15, 0.6, [1.05, 14.1, 0.1], undefined, 8)
  k.cone(glow('#ffb43d', 0.6, 1.8), 0.28, 0.7, [1.05, 14.75, 0.1], undefined, 8)
  k.box(cu, [0.6, 1.0, 0.2], [-0.75, 9.6, 0.4], [0.2, 0, 0.2])
  const t: Look = { c: '#c8c1b4', r: 0.7 }
  const t2: Look = { c: '#9aa6ad', r: 0.4, m: 0.3 }
  for (const [x, z, w, h] of LIB_TOWERS) {
    k.box(t, [w, h, w], [x, h / 2, z])
    k.box(t, [w * 0.7, 3, w * 0.7], [x, h + 1.5, z])
    k.box(t2, [w * 0.4, 2, w * 0.4], [x, h + 4, z])
    k.cyl(CHROME, 0.04, 0.12, 2.5, [x, h + 6.2, z], undefined, 6)
    for (let y = 1.5; y < h; y += 1.4) k.box({ c: '#5f6f7a', r: 0.3, m: 0.3 }, [w + 0.02, 0.4, w + 0.02], [x, y, z])
  }
}
// Round the statue, in her frame: brownstones with stoops and fire escapes either side, a red
// roller coaster looping round the skyline, a hot dog cart and a taxi out front.
function libertyStreet(k: PropKit) {
  const browns = ['#7a4a35', '#8a5a40', '#6b3f2e', '#94654a']
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const x = s * (4.6 + i * 2.8)
    const brick: Look = { c: browns[(i + (s > 0 ? 2 : 0)) % 4], r: 0.95 }
    k.box(brick, [2.7, 4.6, 4], [x, 2.3, 1])
    k.box({ c: '#d9ccb0', r: 0.8 }, [2.8, 0.3, 4.1], [x, 4.75, 1])
    for (let fl = 0; fl < 3; fl++) for (const u of [-0.7, 0, 0.7]) {
      const y = 1.6 + fl * 1.15
      pane(k, GLASS, 0.42, 0.7, [x + u, y, 3.002])
      pane(k, { c: '#d9ccb0', r: 0.8 }, 0.5, 0.08, [x + u, y + 0.4, 3.004])
    }
    // The stoop up to the door, and the fire escape.
    pane(k, { c: '#3e2723', r: 0.8 }, 0.6, 1.0, [x - 0.7, 1.0, 3.004])
    for (let j = 0; j < 4; j++) k.box({ c: '#a89a85', r: 0.9 }, [0.8, 0.15, 0.3], [x - 0.7, 0.075 + j * 0.15, 3.0 + (4 - j) * 0.25])
    for (const y of [2.05, 3.2]) {
      k.box(DARK, [1.6, 0.04, 0.5], [x + 0.35, y, 3.25])
      k.box(DARK, [1.6, 0.03, 0.03], [x + 0.35, y + 0.4, 3.5])
      for (let j = 0; j < 5; j++) k.box(DARK, [0.02, 0.4, 0.02], [x - 0.45 + j * 0.4, y + 0.2, 3.5])
    }
    k.rod(DARK, [x - 0.3, 2.05, 3.4], [x + 0.9, 3.2, 3.4], 0.02, 3)
  }
  // The roller coaster round the towers.
  const rail: Look = { c: '#d32f2f', r: 0.5 }
  const N = 40
  const pt = (i: number, off: number): V3 => {
    const a = (i / N) * Math.PI * 2
    const h = 7 + 3 * Math.sin(a * 2) + 2 * Math.sin(a * 5)
    return [1.5 + Math.cos(a) * (10 + off), h, -6.5 + Math.sin(a) * (4.6 + off * 0.5)]
  }
  for (let i = 0; i < N; i++) {
    for (const off of [-0.3, 0.3]) k.rod(rail, pt(i, off), pt(i + 1, off), 0.06, 4)
    const a = pt(i, -0.3)
    const b = pt(i, 0.3)
    k.rod({ c: '#7a7a7a', r: 0.6 }, a, b, 0.03, 3)
    if (i % 4 === 0) k.rod({ c: '#9e9e9e', r: 0.6 }, pt(i, 0), [pt(i, 0)[0], 0, pt(i, 0)[2]], 0.08, 5)
  }
  for (let j = 0; j < 3; j++) {
    const p0 = pt(6 + j * 0.6, 0)
    k.box({ c: '#ffd23f', r: 0.5 }, [0.55, 0.35, 0.8], [p0[0], p0[1] + 0.25, p0[2]], [0, Math.atan2(p0[0] - 1.5, -(p0[2] + 6.5) * 2), 0])
  }
  // A hot dog cart with its parasol and vendor, and a taxi at the kerb.
  const hx = -3.2
  const hz = 4.2
  k.box({ c: '#cfd4d8', r: 0.4 }, [1.1, 0.6, 0.6], [hx, 0.65, hz])
  for (const s of [-1, 1]) k.cyl(TYRE, 0.18, 0.18, 0.06, [hx + s * 0.35, 0.18, hz + 0.33], [Math.PI / 2, 0, 0], 8)
  k.rod(DARK, [hx, 0.95, hz], [hx, 2.0, hz], 0.02, 4)
  k.cone({ c: '#ffd23f', r: 0.7 }, 0.8, 0.35, [hx, 2.05, hz], undefined, 8)
  pane(k, RED, 0.9, 0.2, [hx, 0.7, hz + 0.302])
  text(k, WHITE, 'HOT DOGS', [hx, 0.7, hz + 0.304], 0.02)
  folk(k, D('#f5f5f5', '#2b3a55', 2, { hat: 'cap', hatC: '#d32f2f' }), [], hx, hz - 0.6, 0)
  folk(k, D(SHIRT[5], '#3d3d3d', 0, {}), ['camera'], hx + 0.6, hz + 0.9, Math.PI)
  taxi(xf(k, 4.2, 5.3, Math.PI / 2))
}

// The fairy-tale castle: white walls, round towers with red, blue and gold cone roofs, banners,
// a moat with its drawbridge and two knights on guard.
function castle(k: PropKit) {
  const wall: Look = { c: '#f0ece3', r: 0.8 }
  const roofs = ['#d32f2f', '#1e5aa8', '#f2c230']
  k.box(wall, [16, 6, 6], [0, 3, -2])
  for (let x = -7.5; x <= 7.5; x += 1) k.box(wall, [0.5, 0.6, 6.1], [x, 6.3, -2])
  k.box({ c: '#3a2a20', r: 1 }, [3, 3.6, 0.1], [0, 1.8, 1.01])
  k.cyl({ c: '#3a2a20', r: 1 }, 1.5, 1.5, 0.1, [0, 3.6, 1.01], [Math.PI / 2, 0, 0], 12)
  // The portcullis bars in the gateway.
  for (let i = 0; i < 7; i++) pane(k, DARK, 0.05, 3.2, [-1.2 + i * 0.4, 2.2, 1.064])
  for (let i = 0; i < 5; i++) pane(k, DARK, 2.8, 0.05, [0, 0.8 + i * 0.7, 1.066])
  const towers: [number, number, number, number][] = [[-8, 0.5, 1.6, 10], [8, 0.5, 1.6, 10], [-4, -4, 1.3, 13], [4, -4, 1.3, 13], [0, -5, 1.6, 16], [-10, -4, 1.1, 8], [10, -4, 1.1, 8]]
  towers.forEach(([x, z, r, h], i) => {
    k.cyl(wall, r, r, h, [x, h / 2, z], undefined, 14)
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2
      k.box(wall, [0.4, 0.5, 0.3], [x + Math.sin(a) * (r + 0.05), h + 0.2, z + Math.cos(a) * (r + 0.05)], [0, a, 0])
    }
    k.cyl({ c: roofs[(i + 2) % 3], r: 0.6 }, r * 1.15, r * 1.15, 0.2, [x, h + 0.5, z], undefined, 14)
    k.cone({ c: roofs[i % 3], r: 0.6 }, r * 1.25, r * 2.4, [x, h + 0.6 + r * 1.2, z], undefined, 14)
    k.sphere(GOLD, 0.12, [x, h + 0.6 + r * 2.4, z], [1, 1, 1], 6, 4)
    k.cyl(DARK, 0.02, 0.02, 0.8, [x, h + 0.6 + r * 2.4 + 0.4, z], undefined, 4)
    k.box({ c: roofs[(i + 1) % 3], r: 0.7 }, [0.02, 0.25, 0.4], [x, h + 0.6 + r * 2.4 + 0.65, z + 0.2])
    for (let y = 2; y < h - 1; y += 2.4) k.box({ c: '#2a3a4a', r: 0.2 }, [0.3, 0.7, 0.04], [x, y, z + r + 0.01])
  })
  // Banners hanging down the front wall.
  for (const [x, c] of [[-5.5, '#d32f2f'], [-2.6, '#1e5aa8'], [2.6, '#1e5aa8'], [5.5, '#d32f2f']] as const) {
    pane(k, { c, r: 0.8 }, 1.0, 2.6, [x, 4.2, 1.004])
    k.box(GOLD, [0.36, 0.36, 0.02], [x, 4.3, 1.012], [0, 0, Math.PI / 4])
    k.box(GOLD, [1.1, 0.06, 0.06], [x, 5.5, 1.03])
  }
  for (const x of [-6.8, -4, 4, 6.8]) for (const y of [2.2]) k.box({ c: '#2a3a4a', r: 0.2 }, [0.35, 0.9, 0.04], [x, y, 1.01])
  k.box(neon('#ff3d7f'), [8, 0.2, 0.1], [0, 4.6, 1.06])
  // The moat and the lowered drawbridge, chains up to the gate.
  k.box({ c: '#3f7fa6', r: 0.15 }, [20, 0.03, 1.4], [0, 0.012, 2.3])
  for (const s of [-1, 1]) k.box({ c: '#a8a090', r: 0.9 }, [20, 0.2, 0.15], [0, 0.1, 2.3 + s * 0.78])
  k.box({ c: '#7a5a3a', r: 1 }, [2.6, 0.12, 2.2], [0, 0.2, 2.2])
  for (const s of [-1, 1]) k.rod(DARK, [s * 1.2, 0.25, 3.25], [s * 1.4, 3.4, 1.05], 0.03, 3)
  // Two knights with lances and shields either side of the bridge.
  for (const s of [-1, 1]) {
    const kk = xf(k, s * 2.4, 3.6, 0)
    const armour: Look = { c: '#b0b6bc', r: 0.4, m: 0.2 }
    kk.box({ c: '#8a8070', r: 0.9 }, [0.8, 0.5, 0.8], [0, 0.25, 0])
    folk(xf(kk, 0, 0, 0, 1.6, 0.5), { top: '#b0b6bc', low: '#b0b6bc', skin: '#b0b6bc', hair: '#b0b6bc' }, [], 0, 0, 0)
    kk.sphere(armour, 0.19, [0, 0.5 + 0.62 * P * 1.6, 0], [1, 1.1, 1], 8, 5)
    kk.cone({ c: roofs[s > 0 ? 0 : 1], r: 0.7 }, 0.05, 0.25, [0, 0.5 + 0.8 * P * 1.6, 0], undefined, 5)
    kk.box({ c: roofs[s > 0 ? 0 : 1], r: 0.7 }, [0.32, 0.45, 0.04], [-s * 0.2, 1.1, 0.16])
    kk.rod({ c: '#8a6a4c', r: 0.8 }, [s * 0.25, 0.5, 0.05], [s * 0.25, 2.8, 0.05], 0.025, 4)
    kk.cone(armour, 0.05, 0.25, [s * 0.25, 2.92, 0.05], undefined, 5)
  }
}

// A little white wedding chapel with a steeple and a lit heart, an Elvis wedding under its arch.
const ROOF = new CylinderGeometry(0.5, 0.5, 1, 3, 1).rotateX(-Math.PI / 2).translate(0, 0.25, 0).scale(1 / 0.866, 1 / 0.75, 1)
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
  for (const s of [-1, 1]) {
    k.cyl({ c: '#e9e3d6', r: 0.7 }, 0.18, 0.13, 0.3, [s * 0.75, 0.15, 2.3], undefined, 8)
    k.ico({ c: '#3f7f3a', r: 1 }, 0.22, [s * 0.75, 0.42, 2.3], [1, 0.8, 1], 0)
    for (let j = 0; j < 4; j++) k.sphere(picket, 0.05, [s * 0.75 + Math.cos(j * 1.6) * 0.13, 0.55, 2.3 + Math.sin(j * 1.6) * 0.13], [1, 1, 1], 6, 4)
  }
  // The wedding: bride and groom on the path, Elvis marrying them, a guest taking pictures, the
  // white convertible waiting at the side with its cans.
  folk(k, D('#f5f5f5', '#f5f5f5', 4, { robe: true, hair: HAIR[1] }), ['bride', 'bouquet'], -0.2, 2.45, Math.PI / 2 + 0.3)
  folk(k, D('#1a1a1a', '#1a1a1a', 2, {}), ['groom'], 0.2, 2.45, -Math.PI / 2 - 0.3)
  folk(k, D('#f4f1ea', '#f4f1ea', 0, { hair: '#111111', wave: true }), ['elvis'], 0, 2.05, 0)
  folk(k, D(SHIRT[4], '#3d3d3d', 3, {}), ['camera'], 1.0, 3.6, Math.PI + 0.5)
  classic(xf(k, 2.6, 1.0), '#f8f8f8', true)
  // CHAPEL OF LOVE on a pink board at the corner.
  for (const x of [-2.6, -1.6]) k.box(picket, [0.08, 2.2, 0.08], [x, 1.1, 3.1])
  k.box(PINK, [1.4, 0.6, 0.08], [-2.1, 2.0, 3.1])
  text(k, WHITE, 'CHAPEL', [-2.1, 2.1, 3.142], 0.035)
  text(k, WHITE, 'OF LOVE', [-2.1, 1.88, 3.142], 0.025)
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

// An old motel and its sign: two storeys of rooms off an open walkway, the pool and an ice
// machine, the arrow of bulbs bending towards the road and the VACANCY board.
function motel(k: PropKit) {
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
  // The pool with its ladder and loungers, a guest by the water.
  k.box({ c: '#e8e2d6', r: 0.9 }, [6.6, 0.06, 1.9], [1.9, 0.03, -1.25])
  k.box({ c: '#4fc3f7', r: 0.15 }, [4.0, 0.03, 1.2], [3.0, 0.055, -1.25])
  for (const x of [-0.2, 0.6]) {
    k.box(WHITE, [0.5, 0.06, 1.0], [x, 0.3, -1.25], [0.15, 0, 0])
    k.box(WHITE, [0.04, 0.25, 0.04], [x, 0.13, -0.8])
  }
  folk(k, D('#ff7043', '#ff7043', 1, {}), ['sunhat', 'shades'], 1.3, -0.45, 0.4)
  k.box({ c: '#e0e0e0', r: 0.5 }, [0.6, 1.0, 0.5], [-2.2, 0.5, -2.1])
  k.box(BLUE, [0.62, 0.25, 0.52], [-2.2, 0.85, -2.1])
  text(k, WHITE, 'ICE', [-2.2, 0.85, -1.838], 0.035)
  k.box({ c: '#3d6f8a', r: 0.7 }, [0.3, 5, 0.3], [0, 2.5, 0])
  k.box(neon('#3de0ff'), [0.9, 2.2, 0.18], [0, 4.6, 0])
  text(k, DARK, 'MOTEL', [0, 4.6, 0.092], 0.04)
  k.box({ c: '#1f3c5b', r: 0.7 }, [1.0, 2.3, 0.14], [0, 4.6, -0.04])
  k.box(neon('#ff3d7f'), [2.4, 0.3, 0.12], [-0.9, 3.2, 0])
  k.box(neon('#ff3d7f'), [0.6, 0.6, 0.12], [-2.1, 3.2, 0], [0, 0, Math.PI / 4])
  for (let i = 0; i < 8; i++) k.sphere(neon('#ffe08a'), 0.05, [0.3 - i * 0.3, 3.45, 0.06], [1, 1, 1], 6, 4)
  k.box(neon('#7dff6a'), [1.2, 0.4, 0.1], [0.4, 2.3, 0])
  text(k, DARK, 'VACANCY', [0.4, 2.3, 0.052], 0.035)
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

const FILLERS: [string, (k: PropKit) => void][] = [['diner', diner], ['gifts', gifts], ['arcade', arcade], ['pawn', pawn], ['drive', driveChapel]]
const BACKS: [string, (k: PropKit) => void][] = [['slab', backSlab], ['twins', backTwins], ['garage', backGarage]]
const CLUSTERS: [string, (k: PropKit) => void][] = [['elvis', elvisPhoto], ['showgirls', showgirls], ['shoppers', shoppers], ['walkers', walkers]]

export default function Vegas({ len, race }: WorldProps) {
  const casinos = useMemo(() => CASINOS.map((c, i) => prop(`vegas-casino-d3-${i}`, (k) => casino(k, c, i))), [])
  const fillers = useMemo(() => FILLERS.map(([n, f]) => prop(`vegas-fill-${n}`, f)), [])
  const backs = useMemo(() => BACKS.map(([n, f]) => prop(`vegas-back-${n}`, f)), [])
  const clusters = useMemo(() => CLUSTERS.map(([n, f]) => prop(`vegas-folk-${n}`, f)), [])
  const palmP = useProp('vegas-palm', coconutPalm)
  const kerbAP = useProp('vegas-kerb-a', kerbA)
  const kerbBP = useProp('vegas-kerb-b', kerbB)
  const beamP = useProp('vegas-mono-beam', monoBeam)
  const pierP = useProp('vegas-mono-pier', monoPier)
  const frameP = useProp('vegas-welcome', welcomeFrame)
  const westP = useProp('vegas-start-west', startWest)
  const saloonP = useProp('vegas-saloon', saloon)
  const pyrP = useProp('vegas-pyramid', pyramid)
  const plazaP = useProp('vegas-pyramid-plaza', pyramidPlaza)
  const ironP = useProp('vegas-iron', ironTower)
  const parisP = useProp('vegas-paris', paris)
  const lakeP = useProp('vegas-lake', lakeHotel)
  const gardenP = useProp('vegas-lake-gardens', lakeGardens)
  const libP = useProp('vegas-liberty', liberty)
  const libStreetP = useProp('vegas-liberty-street', libertyStreet)
  const castleP = useProp('vegas-castle-d3', castle)
  const chapelP = useProp('vegas-chapel-d3', chapel)
  const motelP = useProp('vegas-motel-d3', motel)
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
    const fill: Spot[][] = FILLERS.map(() => [])
    const margin = (l: (typeof L)[keyof typeof L]) => (l === L.chapel ? 4.5 : l === L.lake ? 22 : l === L.pyramid ? 15 : l === L.iron ? 14 : 10)
    const clear = (z: number, side: number, half: number) => (side < 0 && z - half < MOTELS + 6) || (side > 0 && z - half < 14) || Object.values(L).some((l) => Math.sign(l.x) === side && Math.abs(z - l.z) < half + margin(l))
    // Down each side: a casino, then a shop or diner in the gap before the next; where a casino
    // won't fit beside a landmark, shops fill in.
    const casinoZ: { z: number; half: number }[] = []
    let fi = 0
    for (const side of [1, -1]) {
      const ry = side > 0 ? -Math.PI / 2 : Math.PI / 2
      for (let z = 14; z < len + 40;) {
        const i = Math.floor(r() * CASINOS.length)
        const c = CASINOS[i]
        const zc = z + c.w / 2
        if (!clear(zc, side, c.w / 2)) {
          rows[i].push({ x: side * (FRONT + CD / 2), z: zc, ry })
          if (side < 0) casinoZ.push({ z: zc, half: i === 1 ? c.w / 2 + 0.3 : 3.6 })
          z += c.w + 0.2
        } else {
          if (!clear(z + FW / 2, side, FW / 2)) fill[fi++ % FILLERS.length].push({ x: side * FRONT, z: z + FW / 2, ry })
          z += FW + 0.2
          continue
        }
        if (!clear(z + FW / 2, side, FW / 2)) fill[fi++ % FILLERS.length].push({ x: side * FRONT, z: z + FW / 2, ry })
        z += FW + 0.2
      }
    }
    // The second row of towers and garages.
    const back: Spot[][] = BACKS.map(() => [])
    for (const side of [1, -1]) for (let z = -14 + (side > 0 ? 0 : 6); z < len + 50; z += 13) {
      if (side > 0 && Math.abs(z - L.pyramid.z) < 20) continue
      back[Math.floor(r() * BACKS.length)].push({ x: side * (EDGE + 25 + r() * 3), z: z + r() * 2, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 })
    }
    // The pavements: palms, then furniture and people between them, clear of the race crowd.
    const palms: Spot[] = []
    for (const side of [1, -1]) for (let z = -10 + side * 2; z < len + 40; z += 9 + r() * 3) palms.push({ x: side * (EDGE + 0.9), z, ry: r() * 6, s: 0.95 + r() * 0.3 })
    const crowd = (z: number) => (z > -6 && z < 19) || (z > race - 10 && z < race + 6)
    const nearPalm = (side: number, z: number, d: number) => palms.some((p) => Math.sign(p.x) === side && Math.abs(p.z - z) < d)
    const kA: Spot[] = []
    const kB: Spot[] = []
    const folks: Spot[][] = CLUSTERS.map(() => [])
    let ci = 0
    for (const side of [1, -1]) {
      const ry = side > 0 ? -Math.PI / 2 : Math.PI / 2
      for (let z = -12 + side; z < len + 40; z += 3.4 + r() * 2.2) {
        if (crowd(z) || nearPalm(side, z, 1.3)) continue
        const u = r()
        if (u < 0.22) kA.push({ x: side * (EDGE + 1.5), z, ry })
        else if (u < 0.38) kB.push({ x: side * (EDGE + 1.45), z, ry })
        else if (u < 0.85) folks[ci++ % CLUSTERS.length].push({ x: side * (EDGE + 1.15 + r() * 0.25), z, ry: ry + (r() - 0.5) * 0.6 })
      }
    }
    const motels: Spot[] = []
    for (const z of [-10, 18, 32, 46, 60]) if (z < MOTELS + 6) motels.push({ x: -(EDGE + 1.6), z, ry: Math.PI / 2 })
    // The monorail: beam the whole way from just past the start, piers where nothing's below.
    const beams: Spot[] = []
    for (let z = MONO_Z0; z < len + 40; z += 10) beams.push({ x: MONO_X, z })
    const busy = [...casinoZ, ...[0, 1, 2].flatMap((i) => fill[i].filter((f) => f.x < 0).map((f) => ({ z: f.z, half: 2.6 })))]
    const piers: Spot[] = [{ x: MONO_X, z: MONO_Z0 + 0.4 }]
    for (let z = MONO_Z0 + 15; z < len + 40; z += 15) {
      let zz = z
      for (let t = 0; t < 12 && (busy.some((c) => Math.abs(c.z - zz) < c.half) || Math.abs(zz - L.chapel.z) < 4); t++) zz += 0.7
      if (busy.some((c) => Math.abs(c.z - zz) < c.half) || Math.abs(zz - L.chapel.z) < 4) continue
      piers.push({ x: MONO_X, z: zz })
    }
    const rr = rand(17)
    const scrub = Array.from({ length: 160 }, () => ({ x: (rr() < 0.5 ? 1 : -1) * (EDGE + 33 + rr() * 20), z: rr() * (len + 60) - 14, s: 0.6 + rr() * 0.8, ry: rr() * 6 }))
    const cacti: Spot[] = []
    for (let z = -10; z < len + 40; z += 9 + rr() * 8) {
      const side = rr() < 0.5 ? 1 : -1
      cacti.push({ x: side * (EDGE + 33 + rr() * 16), z, ry: rr() * 6, s: 0.8 + rr() * 0.5 })
    }
    return { rows, fill, back, palms, kA, kB, folks, motels, beams, piers, scrub, cacti }
  }, [len, race, L, MOTELS])

  return (
    <>
      <Batch version={`vegas:${len}`} cell={24} freeze prune>
        {[1, -1].map((s) => (
          <mesh key={s} rotation-x={-Math.PI / 2} position={[s * (EDGE + 0.9), 0.012, len / 2 + 5]}>
            <planeGeometry args={[1.8, len + 60]} />
            <meshStandardMaterial color="#d8cfbf" />
          </mesh>
        ))}
        {[1, -1].map((s) => (
          <mesh key={`lot${s}`} rotation-x={-Math.PI / 2} position={[s * (EDGE + 17), 0.01, len / 2 + 5]}>
            <planeGeometry args={[30, len + 60]} />
            <meshStandardMaterial color="#c9bba3" />
          </mesh>
        ))}
        {[1, -1].map((s) => (
          <mesh key={`drive${s}`} rotation-x={-Math.PI / 2} position={[s * (EDGE + 3.6), 0.014, len / 2 + 5]}>
            <planeGeometry args={[2.0, len + 60]} />
            <meshStandardMaterial color="#8d8a85" />
          </mesh>
        ))}
        <group position={[-(EDGE + 3.2), 0, 7]} rotation-y={Math.PI / 2 + 0.5}>
          <PropMesh parts={frameP} />
          <mesh position={[0, 3.6, 0.0]} material={sign}>
            <planeGeometry args={[3.2, 2.0]} />
          </mesh>
        </group>
        <PropMesh parts={westP} />
        <group position={[FRONT, 0, 0]} rotation-y={-Math.PI / 2}><PropMesh parts={saloonP} /></group>
        <group position={[L.pyramid.x, 0, L.pyramid.z]} rotation-y={-Math.PI / 2}>
          <PropMesh parts={pyrP} />
          <PropMesh parts={plazaP} />
        </group>
        <group position={[L.iron.x, 0, L.iron.z]}>
          <PropMesh parts={ironP} />
          <PropMesh parts={parisP} />
        </group>
        <group position={[L.lake.x - 3.1 + LAKE_FRONT, 0, L.lake.z]} rotation-y={-Math.PI / 2}>
          <PropMesh parts={lakeP} />
          <PropMesh parts={gardenP} />
        </group>
        <mesh rotation-x={-Math.PI / 2} position={[L.lake.x, 0.02, L.lake.z]}>
          <planeGeometry args={[6, 34]} />
          <meshStandardMaterial color="#3f7fa6" roughness={0.1} metalness={0.2} />
        </mesh>
        <group position={[L.liberty.x, 0, L.liberty.z]} rotation-y={Math.PI / 2}>
          <PropMesh parts={libP} />
          <PropMesh parts={libStreetP} />
        </group>
        <group position={[L.castle.x, 0, L.castle.z]} rotation-y={-Math.PI / 2}><PropMesh parts={castleP} /></group>
        <group position={[L.chapel.x, 0, L.chapel.z]} rotation-y={Math.PI / 2}><PropMesh parts={chapelP} /></group>
        <Scatter spots={geo.scrub} colors={['#8a8f5a', '#9c9a62', '#7d7a4f']}>
          <icosahedronGeometry args={[0.35, 0]} />
        </Scatter>
      </Batch>
      {casinos.map((c, i) => <Many key={i} parts={c} at={geo.rows[i]} />)}
      {fillers.map((c, i) => <Many key={i} parts={c} at={geo.fill[i]} />)}
      {backs.map((c, i) => <Many key={i} parts={c} at={geo.back[i]} />)}
      {clusters.map((c, i) => <Many key={i} parts={c} at={geo.folks[i]} near={70} />)}
      <Many parts={palmP} at={geo.palms} />
      <Many parts={kerbAP} at={geo.kA} near={80} />
      <Many parts={kerbBP} at={geo.kB} near={80} />
      <Many parts={motelP} at={geo.motels} />
      <Many parts={beamP} at={geo.beams} />
      <Many parts={pierP} at={geo.piers} />
      <Many parts={cactusP} at={geo.cacti} near={90} />
      <MonoTrain z0={MONO_Z0 + 6} z1={len + 20} />
      <Fountains x={L.lake.x} z={L.lake.z} w={30} />
      <FarVegas />
    </>
  )
}

// Ahead: red rock mountains on both sides, the observation wheel, the tall needle tower and the
// towers of the strip further on, all close enough to stand out of the haze.
function FarVegas() {
  const parts = useProp('vegas-far-d3', (k) => {
    const reds = ['#b5573a', '#a24a32', '#c46a45', '#94432e']
    const rr = rand(23)
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1
      const x = side * (42 + rr() * 40)
      const z = 62 + rr() * 22
      const w = 14 + rr() * 16
      const h = 8 + rr() * 12
      frustum(k, { c: reds[i % 4], r: 1 }, w, w * 0.7, h, 0.35 + rr() * 0.3, [x, 0, z], rr() * 3)
      frustum(k, { c: reds[(i + 1) % 4], r: 1 }, w * 0.5, w * 0.4, h * 0.3, 0.7, [x, h, z], rr() * 3)
    }
    for (let i = 0; i < 7; i++) k.sphere({ c: '#9b6b54', r: 1 }, 1, [-90 + i * 30, 0, 92], [22, 9, 10], 12, 6, Math.PI / 2)
    // The needle tower: a tapering three-legged shaft, the pod, the mast and its lights.
    const tx = 24
    const tz = 80
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
    // The observation wheel: rim, spokes, cabins and its A-frame legs.
    const wx = -30
    const wz = 70
    const wy = 17
    const wr = 14
    const white: Look = { c: '#f2f2f2', r: 0.5 }
    k.torus(white, wr, 0.3, [wx, wy, wz], [0, Math.PI / 2, 0], Math.PI * 2, 32, 4)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const p: V3 = [wx, wy + Math.sin(a) * wr, wz + Math.cos(a) * wr]
      k.rod(white, [wx, wy, wz], p, 0.08, 3)
      k.sphere({ c: '#bfe3ef', r: 0.2 }, 0.9, [wx, p[1], p[2]], [1, 0.8, 1], 6, 4)
    }
    k.cyl(DARK, 1.0, 1.0, 1.2, [wx, wy, wz], [0, 0, Math.PI / 2], 10)
    for (const s of [-1, 1]) k.rod(white, [wx + 3, 0, wz + s * 6], [wx, wy, wz], 0.5, 6)
    // Distant casino towers along the strip ahead.
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1
      const x = side * (12 + rr() * 24)
      const h = 12 + rr() * 22
      const c = ['#d8b56a', '#f1ede4', '#c9d4dc', '#e8c9b5', '#2f3640'][i % 5]
      const v: V3 = [x, h / 2, 66 + rr() * 14]
      k.box({ c, r: 0.6, m: 0.15 }, [5, h, 4], v)
      for (let y = 2; y < h - 1.5; y += 2.3) k.box({ c: '#5f6f7a', r: 0.3 }, [5.04, 0.6, 4.04], [x, y, v[2]])
      k.box(neon(NEON[i % NEON.length]), [5.06, 0.4, 4.06], [x, h - 0.6, v[2]])
    }
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
