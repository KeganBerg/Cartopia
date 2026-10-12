import { PropKit, prop, type Look } from './propKit'
import { STREET_PROPS } from './streetProps'
import { SEASON } from './season'

// Park decor rebuilt for the free camera: cast-iron benches with slatted seats,
// flower beds of real clumps of blooms, plank picnic tables on A-frames, a
// clipped hedge of leafy lobes, a Victorian lantern post and a waving town flag.
// Built once each (propKit) and baked into the town mesh, so they cost
// triangles, not draws. The placement ghost keeps the plain shapes.

const L = (c: string, r = 0.75, m = 0, cast = false): Look => ({ c, r, m, cast })
const cast = (l: Look): Look => ({ ...l, cast: true })
const IRON = L('#2b2f33', 0.5, 0.3)
const SNOW = SEASON === 'winter'

// Deterministic jitter so every copy looks the same between loads.
const jit = (i: number, k: number) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return s - Math.floor(s) - 0.5
}

// A clump of flowers: leafy lobes with small blooms domed over them.
function clump(k: PropKit, x: number, z: number, y: number, size: number, bloom: string, n: number, seed: number) {
  const leaf = ['#2e7d32', '#388e3c', '#43a047']
  k.ico(cast(L(leaf[seed % 3], 0.85)), size, [x, y + size * 0.4, z], [1.1, 0.55, 1.1], size > 0.1 ? 1 : 0)
  k.ico(L(leaf[(seed + 1) % 3], 0.85), size * 0.7, [x + size * 0.45, y + size * 0.3, z - size * 0.3], [1, 0.65, 1], 0)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed
    const r = i % 3 === 0 ? size * 0.2 : size * 0.65
    const h = y + size * (1.05 - (r / size) * 0.4) + jit(seed, i) * size * 0.12
    k.ico(L(bloom, 0.6), size * 0.26, [x + Math.cos(a) * r, h, z + Math.sin(a) * r], [1, 0.7, 1], 0)
    if (i % 3 === 0) k.ico(L('#fff59d', 0.6), size * 0.09, [x + Math.cos(a) * r, h + size * 0.15, z + Math.sin(a) * r], [1, 1, 1], 0)
  }
}

export const DECOR_PROPS = {
  // Park bench: cast-iron ends with scrolled arms, slatted seat and back, and a litter bin beside it.
  bench: (wood: string) => prop(`bench|${wood}`, (k) => {
    const slat = (i: number) => L(i % 2 ? wood : '#7a5640', 0.8)
    for (const x of [-0.46, 0, 0.46]) {
      const end = x !== 0
      const look = end ? cast(IRON) : IRON
      k.rod(look, [x, 0, -0.13], [x, 0.3, -0.12], 0.022, 6)
      k.rod(look, [x, 0, 0.15], [x, 0.3, 0.13], 0.022, 6)
      k.rod(look, [x, 0.3, 0.13], [x, 0.66, 0.2], 0.02, 6)
      k.rod(IRON, [x, 0.29, -0.15], [x, 0.29, 0.15], 0.016, 6)
      for (const z of [-0.13, 0.15]) k.box(IRON, [0.06, 0.012, 0.06], [x, 0.006, z])
      if (end) {
        k.rod(IRON, [x, 0.46, -0.15], [x, 0.47, 0.17], 0.016, 6)
        k.rod(IRON, [x, 0.3, -0.12], [x, 0.46, -0.14], 0.014, 6)
        k.torus(IRON, 0.03, 0.009, [x, 0.46, -0.16], [0, Math.PI / 2, 0], Math.PI * 1.5, 10, 4)
      }
    }
    for (let i = 0; i < 4; i++) k.box(cast(slat(i)), [1.06, 0.024, 0.065], [0, 0.315, -0.11 + i * 0.075])
    for (let i = 0; i < 3; i++) {
      const y = 0.42 + i * 0.085
      k.box(cast(slat(i + 1)), [1.06, 0.065, 0.022], [0, y, 0.155 + (y - 0.3) * 0.19], [-0.19, 0, 0])
    }
    k.box(L('#c9a227', 0.35, 0.6), [0.12, 0.03, 0.004], [0, 0.505, 0.162], [-0.19, 0, 0])
  }),

  // Flower bed: a timber sleeper border, a mounded bed of soil and clumps of blooms.
  flowers: () => prop(`flowers|${SEASON}`, (k) => {
    for (const [sx, sz, x, z] of [[1.38, 0.1, 0, -0.64], [1.38, 0.1, 0, 0.64], [0.1, 1.18, -0.64, 0], [0.1, 1.18, 0.64, 0]]) {
      k.box(cast(L('#7b5a43', 0.9)), [sx, 0.1, sz], [x, 0.05, z])
      k.box(cast(L('#8d6e53', 0.9)), [sx - (sx > 1 ? 0.06 : 0), 0.09, sz - (sz > 1 ? 0.06 : 0)], [x, 0.145, z])
    }
    k.box(L('#4e342e', 1), [1.2, 0.12, 1.2], [0, 0.07, 0])
    k.sphere(L('#5d4037', 1), 0.6, [0, 0.12, 0], [1, 0.12, 1], 14, 4, Math.PI / 2)
    const pal = SEASON === 'fall' ? ['#ff8f00', '#c62828', '#fbc02d', '#8e24aa'] : ['#e91e63', '#ffeb3b', '#ab47bc', '#ff7043', '#ffffff']
    let i = 0
    for (const x of [-0.38, 0, 0.38]) for (const z of [-0.38, 0, 0.38]) {
      clump(k, x + jit(i, 1) * 0.08, z + jit(i, 2) * 0.08, 0.16 + (x === 0 && z === 0 ? 0.03 : 0), 0.15, pal[i % pal.length], 6, i)
      i++
    }
    // Lavender spikes along the back.
    for (let j = 0; j < 7; j++) {
      const x = -0.48 + j * 0.16
      k.rod(L('#558b2f', 0.9), [x, 0.15, 0.5], [x + jit(j, 3) * 0.04, 0.38, 0.5], 0.008, 3)
      k.cone(L('#7e57c2', 0.7), 0.022, 0.12, [x + jit(j, 3) * 0.04, 0.42, 0.5], undefined, 5)
    }
  }),

  // Picnic table: plank top on A-frame legs, bench planks either side, a basket, a plate and a cup.
  picnic: (wood: string) => prop(`picnic|${wood}`, (k) => {
    const plank = (i: number) => cast(L(i % 2 ? wood : '#8f7466', 0.85))
    for (let i = 0; i < 5; i++) k.box(plank(i), [1.12, 0.04, 0.088], [0, 0.38, -0.2 + i * 0.1])
    for (const x of [-0.4, 0.4]) {
      for (const s of [-1, 1]) {
        k.rod(cast(L('#6d4c41', 0.85)), [x, 0.36, s * 0.1], [x, 0, s * 0.42], 0.025, 4)
      }
      k.box(L('#6d4c41', 0.85), [0.05, 0.04, 1.02], [x, 0.2, 0])
      k.box(L('#6d4c41', 0.85), [0.05, 0.035, 0.5], [x, 0.34, 0])
    }
    for (const s of [-1, 1]) for (const dz of [-0.05, 0.05]) k.box(plank(dz > 0 ? 1 : 0), [1.12, 0.035, 0.085], [0, 0.235, s * 0.45 + dz])
    // Basket with a handle, a plate with a sandwich and a cup.
    k.box(L('#d7a86e', 0.95), [0.18, 0.11, 0.12], [0.25, 0.465, 0])
    k.box(L('#b98a52', 0.95), [0.185, 0.015, 0.125], [0.25, 0.52, 0])
    k.torus(L('#8d6e63', 0.9), 0.06, 0.01, [0.25, 0.525, 0], [0, 0, 0], Math.PI, 10, 4)
    k.cyl(L('#fafafa', 0.5), 0.07, 0.065, 0.012, [-0.15, 0.406, 0.05], undefined, 14)
    k.box(L('#f5deb3', 0.9), [0.08, 0.025, 0.05], [-0.15, 0.425, 0.05])
    k.box(L('#7cb342', 0.9), [0.085, 0.006, 0.055], [-0.15, 0.427, 0.05])
    k.cyl(L('#e53935', 0.5), 0.022, 0.018, 0.06, [-0.32, 0.43, -0.1], undefined, 10)
  }),

  // Clipped hedge: a stone kerb, a dense core and leafy lobes over its top and faces.
  hedge: () => prop(`hedge|${SEASON}`, (k) => {
    k.box(L('#9e9e9e', 0.95), [1.98, 0.08, 0.7], [0, 0.04, 0])
    k.box(L('#8a8a8a', 0.95), [1.94, 0.02, 0.72], [0, 0.085, 0])
    const leaf = SNOW ? ['#2e5d31', '#356b38'] : ['#2e7d32', '#33873a', '#3c9142']
    k.box(cast(L(leaf[0], 0.9)), [1.82, 0.5, 0.54], [0, 0.33, 0])
    for (let i = 0; i < 8; i++) {
      const x = -0.79 + i * 0.226
      k.ico(cast(L(leaf[i % leaf.length], 0.9)), 0.17, [x, 0.6 + jit(i, 1) * 0.03, jit(i, 2) * 0.06], [0.95, 0.55, 1.6], 1)
      for (const s of [-1, 1]) k.ico(L(leaf[(i + 1) % leaf.length], 0.9), 0.17, [x + 0.05 + jit(i, s + 4) * 0.05, 0.36 + jit(i, s) * 0.08, s * 0.2], [0.85, 1.25, 0.75], 1)
    }
    if (SNOW) for (let i = 0; i < 6; i++) k.sphere(L('#ffffff', 0.9), 0.2, [-0.7 + i * 0.28, 0.66, 0], [1.1, 0.25, 1.1], 10, 3, Math.PI / 2)
    if (SEASON === 'spring' || SEASON === 'summer') {
      for (let i = 0; i < 9; i++) {
        const x = -0.82 + i * 0.2
        k.ico(L(['#f06292', '#fff176', '#ffffff'][i % 3], 0.6), 0.035, [x, 0.12, 0.31], [1, 0.8, 1], 0)
        k.ico(L('#43a047', 0.85), 0.05, [x + 0.05, 0.11, 0.3], [1, 0.6, 1], 0)
      }
    }
  }),

  // Pine: a rough trunk with root flare, then five shaggy tiers, each two
  // offset cones so the outline is ragged, a few branch tips poking out.
  pine: () => prop(`pine|${SEASON}`, (k) => {
    k.cyl(cast(L('#5d4037', 0.95)), 0.06, 0.12, 0.55, [0, 0.275, 0], undefined, 8)
    for (let i = 0; i < 4; i++) k.cone(L('#5d4037', 0.95), 0.05, 0.14, [Math.cos(i * 1.57) * 0.1, 0.03, Math.sin(i * 1.57) * 0.1], [Math.sin(i * 1.57) * 1.1, 0, -Math.cos(i * 1.57) * 1.1], 5)
    const greens = ['#1b5e20', '#22672a', '#2e7d32', '#347f38', '#388e3c']
    const tiers: [number, number, number][] = [[0.66, 0.5, 0.48], [0.56, 0.46, 0.8], [0.46, 0.42, 1.08], [0.35, 0.38, 1.34], [0.22, 0.34, 1.58]]
    tiers.forEach(([r, h, y], i) => {
      k.cone(cast(L(greens[i], 0.9)), r, h, [0, y, 0], [0, i * 0.5, 0], 9)
      k.cone(L(greens[Math.min(4, i + 1)], 0.9), r * 0.92, h * 0.9, [0, y + 0.03, 0], [0, i * 0.5 + 0.35, 0], 7)
      if (SNOW) k.cone(L('#f4f8fb', 0.8), r * 0.6, h * 0.5, [0, y + h * 0.25, 0], [0, i * 0.5, 0], 9)
    })
  }),

  // Victorian lantern post: footing, fluted base, ringed pole, scrolled arm and a
  // four-sided lantern hanging over the path (its glass glows at night).
  lamp: () => prop('decorLamp', (k) => {
    k.cyl(L('#9e9e9e', 0.95), 0.16, 0.17, 0.04, [0, 0.02, 0], undefined, 12)
    k.cyl(cast(IRON), 0.06, 0.11, 0.22, [0, 0.15, 0], undefined, 12)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      k.box(IRON, [0.018, 0.2, 0.018], [Math.cos(a) * 0.085, 0.15, Math.sin(a) * 0.085], [0, -a, -0.2])
    }
    k.cyl(IRON, 0.07, 0.07, 0.03, [0, 0.27, 0], undefined, 12)
    k.cyl(cast(IRON), 0.032, 0.045, 1.42, [0, 0.98, 0], undefined, 10)
    for (const y of [0.55, 1.1, 1.66]) k.cyl(IRON, 0.05, 0.05, 0.03, [0, y, 0], undefined, 10)
    k.sphere(IRON, 0.05, [0, 1.73, 0], [1, 1, 1], 10, 6)
    // Arm out to the lantern, with a scroll brace under it.
    k.rod(cast(IRON), [0, 1.73, 0], [0.4, 1.73, 0], 0.016, 6)
    k.torus(IRON, 0.08, 0.009, [0.09, 1.65, 0], [0, 0, 0], Math.PI * 1.4, 12, 4)
    k.rod(IRON, [0.04, 1.6, 0], [0.24, 1.72, 0], 0.01, 5)
    // Lantern: a hook, the roof, four glass panes framed in iron, a base.
    k.rod(IRON, [0.4, 1.73, 0], [0.4, 1.68, 0], 0.008, 5)
    k.cone(cast(IRON), 0.09, 0.07, [0.4, 1.65, 0], [0, Math.PI / 4, 0], 4)
    k.sphere(IRON, 0.014, [0.4, 1.69, 0], [1, 1, 1], 6, 4)
    k.cyl({ c: '#fff', glow: true }, 0.07, 0.05, 0.13, [0.4, 1.555, 0], [0, Math.PI / 4, 0], 4)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      k.rod(IRON, [0.4 + Math.cos(a) * 0.072, 1.62, Math.sin(a) * 0.072], [0.4 + Math.cos(a) * 0.052, 1.49, Math.sin(a) * 0.052], 0.006, 4)
    }
    k.cyl(IRON, 0.055, 0.035, 0.03, [0.4, 1.475, 0], [0, Math.PI / 4, 0], 4)
  }),

  // Flag pole: stepped plinth, cleat and halyard, a gold ball, a waving flag and flower clumps round the base.
  flagpole: (gold: string) => prop(`flagpole|${gold}|${SEASON}`, (k) => {
    k.cyl(cast(L('#cfd8dc', 0.9)), 0.36, 0.42, 0.14, [0, 0.07, 0], undefined, 16)
    k.cyl(L('#b0bec5', 0.9), 0.24, 0.28, 0.08, [0, 0.18, 0], undefined, 16)
    k.box(L('#c9a227', 0.35, 0.6), [0.16, 0.08, 0.004], [0, 0.07, 0.395], [-0.15, 0, 0])
    k.cyl(cast(L('#eceff1', 0.35, 0.5)), 0.025, 0.04, 2.6, [0, 1.52, 0], undefined, 10)
    k.sphere(L(gold, 0.3, 0.6), 0.06, [0, 2.86, 0], [1, 1, 1], 10, 6)
    k.box(L('#9e9e9e', 0.4, 0.6), [0.02, 0.06, 0.02], [0.045, 0.9, 0])
    k.rod(L('#f5f5f5', 0.8), [0.03, 0.92, 0], [0.03, 2.7, 0], 0.003, 3)
    // A flag in waving strips: green over white, a gold car disc in the middle.
    for (let i = 0; i < 6; i++) {
      const x = 0.06 + i * 0.11 + 0.055
      const z = Math.sin(i * 1.2) * 0.06
      const ry = -Math.cos(i * 1.2) * 0.35
      k.box(cast(L('#2e7d32', 0.8)), [0.115, 0.22, 0.012], [x, 2.6, z], [0, ry, 0])
      k.box(cast(L('#fafafa', 0.8)), [0.115, 0.22, 0.012], [x, 2.38, z], [0, ry, 0])
      if (i === 2 || i === 3) k.box(L(gold, 0.4, 0.4), [0.08, 0.14, 0.02], [x + (i === 2 ? 0.015 : -0.015), 2.49, z], [0, ry, 0])
    }
    if (!SNOW) {
      const pal = SEASON === 'fall' ? ['#ff8f00', '#c62828', '#fbc02d'] : ['#e91e63', '#ffeb3b', '#ab47bc']
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        clump(k, Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0, 0.09, pal[i % 3], 4, i)
      }
    }
  }),
}

// The litter bin that stands beside a park bench.
export const benchBin = () => STREET_PROPS.bin()
