import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, IcosahedronGeometry, OctahedronGeometry } from 'three'
import { Kit } from './kit'
import { PAL, SEASON } from './season'

// Low-poly scenery models, each baked into one geometry by a Kit, for drawing
// hundreds of copies as instances (see Many in Outskirts.tsx). Colours are baked
// in; an instance tint multiplies them, so white parts take the tint fully.
// Shapes match the town's own trees and bushes, only much cheaper: every copy
// is drawn every frame, so each model is kept to a few hundred vertices (open
// cylinders and cones, no hidden caps, coarse leaf balls).

// Faceted: every triangle gets its own flat normal, like flatShading.
const facet = (g: BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g
  n.computeVertexNormals()
  return n
}

const ico0 = facet(new IcosahedronGeometry(1, 0))
const octa = facet(new OctahedronGeometry(1, 0))
const box = new BoxGeometry(1, 1, 1)
const cyl6 = facet(new CylinderGeometry(1, 1, 1, 6, 1, true))
const disc6 = facet(new CylinderGeometry(1, 1, 0.01, 6, 1, false))
const taper = facet(new CylinderGeometry(0.6, 1, 1, 6, 1, true))
const cone5 = facet(pyramid(5))
const cone3 = facet(pyramid(3))

// A cone with no base and no degenerate triangles at the tip: n sides, height 1, radius 1.
function pyramid(n: number) {
  const p: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2
    p.push(0, 0.5, 0, Math.sin(a), -0.5, Math.cos(a), Math.sin(b), -0.5, Math.cos(b))
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3))
  return g
}

const TRUNK = '#7b5034'
const SNOW = '#f4f8fb'
const winter = SEASON === 'winter'

function made(build: (k: Kit) => void) {
  const k = new Kit()
  build(k)
  return k.geometry()!
}

// Cartoon oak, like the town's: a tapered trunk under faceted leaf balls in the
// season's colours (bare branches with snowy tips in winter). `v` picks a colour mix.
export function oak(v: number) {
  return made((k) => {
    k.add(taper, TRUNK, 0, 0.4, 0, 0, 0.16, 0.8, 0.16)
    if (PAL.bare) {
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + v
        const tilt = 0.6 + (i % 2) * 0.25
        const y = 0.75 + (i % 3) * 0.18
        const dx = Math.sin(tilt) * 0.3, dy = Math.cos(tilt) * 0.3
        k.add(cyl6, '#6d4c41', Math.cos(a) * dx, y + dy, -Math.sin(a) * dx, a, 0.04, 0.6, 0.04, 0, -tilt)
        k.add(ico0, SNOW, Math.cos(a) * dx * 2, y + dy * 2, -Math.sin(a) * dx * 2, 0, 0.09)
      }
      return
    }
    const balls = [[0, 1.15, 0, 0.62], [0.32, 0.95, 0.12, 0.44], [-0.28, 1.0, -0.12, 0.46]]
    balls.forEach(([x, y, z, r], i) => k.add(ico0, PAL.leaves[(i + v) % 5], x, y, z, i * 0.7, r))
  })
}

// Evergreen: stacked cones, snow on the tiers in winter.
export function pine() {
  const cone = facet(pyramid(7))
  return made((k) => {
    k.add(cyl6, '#6d4c41', 0, 0.25, 0, 0, 0.1, 0.5, 0.1)
    ;[[0.62, 0.7, 0.55], [0.48, 0.6, 1.0], [0.32, 0.5, 1.4]].forEach(([r, h, y], i) => {
      k.add(cone, ['#1b5e20', '#2e7d32', '#388e3c'][i], 0, y, 0, i * 0.4, r, h, r)
      if (winter) k.add(cone, SNOW, 0, y + h * 0.22, 0, i * 0.4, r * 0.55, h * 0.56, r * 0.55)
    })
  })
}

// Birch: a slim white trunk with dark bands and a light, airy crown.
export function birch() {
  const crown = { spring: ['#a5d66f', '#8bc34a'], summer: ['#7cb342', '#9ccc65'], fall: ['#fdd835', '#f9a825'], winter: [SNOW, SNOW] }[SEASON]
  return made((k) => {
    k.add(cyl6, '#eceff1', 0, 0.8, 0, 0, 0.06, 1.6, 0.06)
    for (const y of [0.45, 1.05]) k.add(cyl6, '#37474f', 0, y, 0, y, 0.062, 0.04, 0.062)
    if (PAL.bare) {
      for (let i = 0; i < 4; i++) k.add(cyl6, '#cfd8dc', 0, 1.3 + i * 0.1, 0, i * 1.6, 0.02, 0.5, 0.02, 0, 0.7)
      return
    }
    ;[[0, 1.65, 0, 0.42], [0.16, 1.4, 0.08, 0.32]].forEach(([x, y, z, r], i) => k.add(ico0, crown[i % 2], x, y, z, i, r, r * 1.25, r))
  })
}

// Wild bush: a lumpy cluster in the season's bush colours.
export function bush() {
  return made((k) => {
    ;[[0, 0.22, 0, 0.32], [0.24, 0.16, 0.1, 0.24]].forEach(([x, y, z, r], i) => {
      k.add(ico0, i % 2 ? PAL.bush[1] : PAL.bush[0], x, y, z, i, r, r * 0.85, r)
    })
    if (winter) k.add(ico0, SNOW, 0, 0.36, 0, 0, 0.22, 0.12, 0.22)
  })
}

// Boulder with a smaller stone at its foot.
export function rock() {
  return made((k) => {
    k.add(ico0, '#8c8c8c', 0, 0.12, 0, 0.3, 0.32, 0.24, 0.26)
    k.add(ico0, '#7a7a7a', 0.3, 0.05, 0.12, 1.1, 0.12, 0.09, 0.1)
    k.add(ico0, winter ? SNOW : '#7d8a5a', 0, 0.25, 0, 0.3, 0.2, 0.06, 0.16)
  })
}

// Grass clump seen from above: three thin blades fanning out, white so the
// instance tint colours it.
export function tuft() {
  return made((k) => {
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI * 2 + 0.4
      k.add(cone3, '#ffffff', Math.cos(a) * 0.05, 0.12, Math.sin(a) * 0.05, a, 0.04, 0.26 + (b % 2) * 0.08, 0.04, 0.35 * Math.cos(a), 0.35 * Math.sin(a))
    }
  })
}

// The same clump for the free camera's close-ups: six flat blades of mixed
// height fanning out from the root (every other one a shade darker), thin so
// they read as grass blades at street level, not spikes.
export function blades() {
  return made((k) => {
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2 + 0.4 + (b % 2) * 0.5
      const h = [0.3, 0.22, 0.34, 0.18, 0.27, 0.24][b]
      const lean = 0.25 + (b % 3) * 0.12
      const r = 0.02 + (b % 2) * 0.025
      k.add(cone3, b % 2 ? '#ffffff' : '#e3e8dc', Math.cos(a) * r, h * 0.45, Math.sin(a) * r, Math.PI / 2 - a, 0.028, h, 0.007, lean)
    }
  })
}

// A wildflower: a stalk and a white bloom the tint colours.
export function flower() {
  return made((k) => {
    k.add(cone3, '#cfe8b0', 0, 0.09, 0, 0, 0.012, 0.18, 0.012)
    k.add(octa, '#ffffff', 0, 0.19, 0, 0, 0.045)
  })
}

// The wildflower up close: a leafy stalk and four petals round a yellow eye.
export function bloom() {
  return made((k) => {
    k.add(cone3, '#6f9a3f', 0, 0.09, 0, 0, 0.01, 0.18, 0.006)
    k.add(cone3, '#7cb342', 0.02, 0.05, 0, 0.3, 0.03, 0.1, 0.006, 0, -0.7)
    // Two crossed petal pairs (kept cheap: meadows hold hundreds of these).
    for (const a of [0, Math.PI / 2]) k.add(octa, '#ffffff', 0, 0.185, 0, a, 0.055, 0.008, 0.022)
    k.add(octa, '#f9c74f', 0, 0.19, 0, 0, 0.014, 0.01, 0.014)
  })
}

// Fallen log, mossy on top, pale cut ends.
export function log() {
  return made((k) => {
    k.add(cyl6, '#6d4c41', 0, 0.12, 0, 0, 0.12, 1.4, 0.12, 0, Math.PI / 2)
    k.add(disc6, '#d7b98e', 0.7, 0.12, 0, 0, 0.115, 1, 0.115, 0, Math.PI / 2)
    k.add(disc6, '#d7b98e', -0.7, 0.12, 0, 0, 0.115, 1, 0.115, 0, Math.PI / 2)
    k.add(box, winter ? SNOW : '#6b8e23', 0, 0.23, 0, 0, 1.1, 0.03, 0.12)
  })
}

export function stump() {
  return made((k) => {
    k.add(taper, '#6d4c41', 0, 0.1, 0, 0, 0.16, 0.2, 0.16)
    k.add(disc6, '#d7b98e', 0, 0.2, 0, 0, 0.13, 1, 0.13)
  })
}

// A heap of fallen leaves (fall), or a snow drift (winter).
export function heap() {
  return made((k) => {
    if (winter) {
      k.add(ico0, SNOW, 0, 0, 0, 0, 0.45, 0.14, 0.3)
      return
    }
    k.add(ico0, PAL.leaves[0], 0, 0, 0, 0, 0.32, 0.12, 0.26)
    k.add(ico0, PAL.leaves[1], 0.18, 0, 0.1, 1, 0.18, 0.08, 0.16)
  })
}

export function mushroom() {
  return made((k) => {
    k.add(cyl6, '#f5f0e6', 0, 0.04, 0, 0, 0.018, 0.08, 0.018)
    k.add(cone5, '#d84315', 0, 0.09, 0, 0, 0.055, 0.04, 0.055)
  })
}

// Reeds and cattails for a lake shore.
export function reeds() {
  return made((k) => {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4
      const x = Math.cos(a) * 0.12 * (i % 3), z = Math.sin(a) * 0.12 * (i % 3)
      const h = 0.5 + (i % 3) * 0.15
      k.add(cone3, winter ? '#bfae8a' : '#6b8e23', x, h / 2, z, a, 0.025, h, 0.025, 0.12 * Math.cos(a), 0.12 * Math.sin(a))
      if (i % 2 === 0) k.add(cyl6, '#5d4037', x + 0.06 * Math.sin(a), h * 0.85, z, 0, 0.025, 0.12, 0.025)
    }
  })
}

// A low crop plant for fields: leafy rows in spring and summer, golden stalks
// in the fall, stubble in winter.
export function crop() {
  return made((k) => {
    if (SEASON === 'winter') {
      k.add(cyl6, '#bfa77a', 0, 0.05, 0, 0, 0.02, 0.1, 0.02)
      return
    }
    const [c1, c2, h] = { spring: ['#8bc34a', '#7cb342', 0.25], summer: ['#5f9e35', '#4f8a2b', 0.75], fall: ['#c9a84a', '#b8953e', 0.7] }[SEASON] as [string, string, number]
    k.add(cone3, c1, 0, h / 2, 0, 0, 0.05, h, 0.05)
    k.add(cone5, c2, 0, h * 0.55, 0, 0.5, 0.18, h * 0.8, 0.18)
  })
}

export function pumpkin() {
  return made((k) => {
    k.add(ico0, '#ef6c00', 0, 0.1, 0, 0, 0.14, 0.11, 0.14)
    k.add(cyl6, '#5d4037', 0, 0.22, 0, 0, 0.015, 0.05, 0.015)
  })
}

// Tint helpers.
export const shade = (hex: string, l: number) => `#${new Color(hex).offsetHSL(0, 0, l).getHexString()}`
