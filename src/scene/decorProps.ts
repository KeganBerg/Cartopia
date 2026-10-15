import { PropKit, prop, type Look } from './propKit'
import { STREET_PROPS } from './streetProps'
import { PAL, SEASON } from './season'

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

  // Palm: a curved, ringed trunk, a crown of arching fronds with leaflets down
  // both sides, and a cluster of coconuts.
  palm: () => prop(`palm|${SEASON}`, (k) => {
    const bark = ['#8d6e63', '#a1887f']
    let x = 0
    for (let i = 0; i < 9; i++) {
      const y = 0.1 + i * 0.18
      const nx = i * i * 0.0028
      k.cyl(cast(L(bark[i % 2], 0.95)), 0.085 - i * 0.004, 0.1 - i * 0.004, 0.19, [nx, y, 0], [0, 0, -0.02 - i * 0.012], 8)
      k.torus(L('#6d4c41', 0.95), 0.095 - i * 0.004, 0.012, [nx, y - 0.09, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 8, 3)
      x = nx
    }
    const top: [number, number, number] = [x + 0.03, 1.72, 0]
    const leaf = PAL.fronds
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * Math.PI * 2 + 0.2
      const ca = Math.cos(a), sa = Math.sin(a)
      // The spine arches up and out, then droops.
      const pts: [number, number, number][] = [0, 1, 2, 3, 4].map((j) => {
        const t = j / 4
        const r = 0.08 + t * 0.62
        return [top[0] + ca * r, top[1] + 0.12 * Math.sin(t * Math.PI * 0.9) - t * t * 0.26, top[2] + sa * r]
      })
      for (let j = 0; j < 4; j++) {
        const [x0, y0, z0] = pts[j]
        const [x1, y1, z1] = pts[j + 1]
        k.rod(L('#689f38', 0.9), pts[j], pts[j + 1], 0.012 - j * 0.002, 4)
        // Leaflets feather out from the spine on both sides, angled forward and drooping.
        const w = [0.2, 0.19, 0.15, 0.09][j]
        for (const t of [0.25, 0.75]) {
          const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t, pz = z0 + (z1 - z0) * t
          for (const s of [-1, 1]) {
            const b2 = a + s * 1.0
            const cb = Math.cos(b2), sb = Math.sin(b2)
            const look = L(leaf[(f + j + (s > 0 ? 1 : 0)) % 2], 0.85)
            k.box(cast(look), [w, 0.008, 0.085], [px + cb * w * 0.45, py - w * 0.17, pz + sb * w * 0.45], [0, -b2, -0.38])
          }
        }
      }
    }
    for (let i = 0; i < 4; i++) k.sphere(L('#5d4037', 0.8), 0.06, [top[0] + Math.cos(i * 1.6) * 0.08, top[1] - 0.09, Math.sin(i * 1.6) * 0.08], [1, 1, 1], 7, 5)
  }),

  // Bus stop shelter: framed glass walls, a lit advert panel, a slatted bench
  // and a timetable post, on a paved pad.
  busstop: () => prop('busstop', (k) => {
    const frame = L('#37474f', 0.45, 0.4)
    const glass = L('#cfe7f3', 0.15, 0.1)
    for (const [x, z] of [[-0.65, -0.42], [0.65, -0.42], [-0.65, 0.05], [0.65, 0.05]]) k.box(cast(frame), [0.05, 1.22, 0.05], [x, 0.66, z])
    k.box(cast(glass), [1.26, 0.86, 0.02], [0, 0.62, -0.42])
    for (const y of [0.18, 1.06]) k.box(frame, [1.3, 0.04, 0.04], [0, y, -0.42])
    for (const x of [-0.65, 0.65]) {
      k.box(cast(glass), [0.02, 0.86, 0.43], [x, 0.62, -0.185])
      for (const y of [0.18, 1.06]) k.box(frame, [0.04, 0.04, 0.47], [x, y, -0.185])
    }
    // Roof: a canopy with a fascia and a drip edge.
    k.box(cast(L('#455a64', 0.5, 0.3)), [1.48, 0.05, 0.64], [0, 1.29, -0.18])
    k.box(L('#1e88e5', 0.5), [1.5, 0.07, 0.02], [0, 1.27, 0.14])
    k.box(L('#cfd8dc', 0.5), [1.4, 0.015, 0.56], [0, 1.26, -0.18])
    // Bench: slats on two brackets.
    for (let i = 0; i < 3; i++) k.box(cast(L(i % 2 ? '#8d6e63' : '#7b5a48', 0.85)), [1.1, 0.022, 0.06], [0, 0.29, -0.33 + i * 0.07])
    for (const x of [-0.45, 0.45]) {
      k.box(frame, [0.04, 0.27, 0.04], [x, 0.14, -0.26])
      k.box(frame, [0.04, 0.03, 0.2], [x, 0.27, -0.27])
    }
    // Advert panel frame on the right-hand wall (its picture glows, drawn by the model).
    k.box(L('#263238', 0.5), [0.04, 0.66, 0.36], [0.68, 0.66, -0.2])
    // Timetable on the sign post.
    k.box(L('#eceff1', 0.5), [0.1, 0.16, 0.012], [0.6, 1.0, 0.565])
    k.box(L('#263238', 0.5), [0.11, 0.17, 0.008], [0.6, 1.0, 0.556])
    k.cyl(L('#90a4ae', 0.4, 0.5), 0.03, 0.03, 1.5, [0.6, 0.75, 0.55], undefined, 8)
    k.cyl(L('#90a4ae', 0.4, 0.5), 0.05, 0.055, 0.03, [0.6, 0.065, 0.55], undefined, 8)
  }),

  // Hot dog cart: a steel cart on spoked wheels, a grill lid, condiments and a
  // napkin box, a push handle and a stand leg.
  hotdog: () => prop('hotdog', (k) => {
    const steel = L('#cfd8dc', 0.3, 0.6)
    k.box(cast(L('#eceff1', 0.4, 0.3)), [0.9, 0.42, 0.5], [0, 0.42, 0])
    k.box(L('#e53935', 0.5), [0.86, 0.12, 0.006], [0, 0.42, 0.253])
    k.box(L('#fdd835', 0.5), [0.86, 0.02, 0.006], [0, 0.35, 0.253])
    k.box(cast(steel), [0.94, 0.04, 0.54], [0, 0.65, 0])
    for (const x of [-0.3, 0, 0.3]) k.box(steel, [0.2, 0.004, 0.36], [x, 0.672, 0.02])
    k.box(L('#9e9e9e', 0.3, 0.6), [0.38, 0.06, 0.3], [-0.2, 0.7, 0.02])
    k.box(L('#bdbdbd', 0.3, 0.6), [0.35, 0.015, 0.27], [-0.2, 0.735, 0.02])
    k.cyl(L('#fdd835', 0.4), 0.02, 0.022, 0.1, [0.18, 0.72, 0.15], undefined, 8)
    k.cone(L('#fdd835', 0.4), 0.012, 0.03, [0.18, 0.785, 0.15], undefined, 6)
    k.cyl(L('#e53935', 0.4), 0.02, 0.022, 0.1, [0.24, 0.72, 0.15], undefined, 8)
    k.cone(L('#e53935', 0.4), 0.012, 0.03, [0.24, 0.785, 0.15], undefined, 6)
    k.box(L('#9e9e9e', 0.4, 0.5), [0.08, 0.06, 0.06], [0.33, 0.7, 0.15])
    k.box(L('#ffffff', 0.8), [0.06, 0.012, 0.04], [0.33, 0.736, 0.15])
    for (const s of [-1, 1]) {
      k.cyl(cast(L('#263238', 0.9)), 0.16, 0.16, 0.05, [-0.2, 0.17, s * 0.27], [Math.PI / 2, 0, 0], 16)
      k.cyl(steel, 0.05, 0.05, 0.06, [-0.2, 0.17, s * 0.27], [Math.PI / 2, 0, 0], 8)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI
        k.rod(steel, [-0.2 + Math.cos(a) * 0.12, 0.17 + Math.sin(a) * 0.12, s * 0.295], [-0.2 - Math.cos(a) * 0.12, 0.17 - Math.sin(a) * 0.12, s * 0.295], 0.006, 4)
      }
    }
    k.rod(steel, [0.45, 0.42, -0.2], [0.68, 0.5, -0.2], 0.015)
    k.rod(steel, [0.45, 0.42, 0.2], [0.68, 0.5, 0.2], 0.015)
    k.rod(L('#212121', 0.8), [0.68, 0.5, -0.22], [0.68, 0.5, 0.22], 0.02)
    k.rod(steel, [0.35, 0.21, 0], [0.35, 0, 0], 0.02)
    k.cyl(L('#424242', 0.9), 0.04, 0.04, 0.02, [0.35, 0.01, 0], undefined, 8)
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
    k.cyl({ c: '#fff', glow: 'lamp' }, 0.07, 0.05, 0.13, [0.4, 1.555, 0], [0, Math.PI / 4, 0], 4)
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
    // The flag itself waves in the wind: WavingFlag.tsx, drawn by the Flag Pole model.
    if (!SNOW) {
      const pal = SEASON === 'fall' ? ['#ff8f00', '#c62828', '#fbc02d'] : ['#e91e63', '#ffeb3b', '#ab47bc']
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        clump(k, Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0, 0.09, pal[i % 3], 4, i)
      }
    }
  }),
  // Oak: a flared trunk with bark ridges that forks into limbs, under a
  // lumpy canopy of leaf clumps in the season's colours. Winter shows the
  // bare branches with snow on them.
  oak: () => prop(`oak|${SEASON}`, (k) => {
    const bark = cast(L('#6f4a30', 0.95))
    const dark = L('#5a3b26', 0.95)
    k.cyl(bark, 0.1, 0.16, 0.8, [0, 0.4, 0], undefined, 9)
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + 0.3
      const ca = Math.cos(a), sa = Math.sin(a)
      // Root flare and a bark ridge up the trunk.
      k.cone(dark, 0.06, 0.2, [ca * 0.15, 0.05, sa * 0.15], [sa * 1.05, 0, -ca * 1.05], 5)
      k.rod(dark, [ca * 0.155, 0.04, sa * 0.155], [ca * 0.1, 0.72, sa * 0.1], 0.018, 4)
    }
    // Limbs fork from the top of the trunk.
    const limbs: [number, number, number][] = [[0.42, 1.12, 0.1], [-0.38, 1.1, -0.12], [0.06, 1.4, -0.08], [-0.12, 1.05, 0.38], [0.2, 1.0, -0.36]]
    for (const [x, y, z] of limbs) k.rod(bark, [0, 0.74, 0], [x, y, z], 0.05, 6)
    if (PAL.bare) {
      limbs.forEach(([x, y, z], i) => {
        // Twigs off each limb, snow along the top.
        for (const s of [-1, 1]) {
          const tip: [number, number, number] = [x * 1.4 + s * z * 0.4, y + 0.3 + jit(i, s) * 0.1, z * 1.4 - s * x * 0.4]
          k.rod(dark, [x, y, z], tip, 0.022, 4)
          k.ico(L('#ffffff', 0.8), 0.05, [tip[0], tip[1] + 0.02, tip[2]], [1.3, 0.5, 1.3], 0)
        }
        k.ico(L('#ffffff', 0.8), 0.07, [x, y + 0.04, z], [1.4, 0.45, 1.4], 0)
      })
      return
    }
    const leaves = PAL.leaves
    const blobs: [number, number, number, number][] = [
      [0, 1.22, 0, 0.56], [0.36, 1.08, 0.12, 0.4], [-0.34, 1.06, -0.1, 0.42], [0.04, 1.58, -0.04, 0.4],
      [-0.1, 1.08, 0.36, 0.38], [0.18, 1.02, -0.36, 0.36], [0.28, 1.42, 0.24, 0.3], [-0.3, 1.4, 0.16, 0.3], [-0.16, 1.44, -0.3, 0.3],
    ]
    blobs.forEach(([x, y, z, r], i) => {
      const look = L(leaves[i % leaves.length], 0.85)
      k.ico(r >= 0.36 ? cast(look) : look, r, [x, y, z], [1, 0.88, 1], 1)
      // Small leaf tufts break up the outline of each clump.
      for (let j = 0; j < 2; j++) {
        const a = j * 2.1 + i
        const d = r * 0.74
        k.ico(L(leaves[(i + j + 1) % leaves.length], 0.85), r * 0.32, [x + Math.cos(a) * d, y + r * 0.25 + jit(i, j) * r * 0.4, z + Math.sin(a) * d], [1, 0.8, 1], 0)
      }
    })
    if (SEASON === 'fall') {
      // Fallen leaves round the trunk.
      for (let i = 0; i < 12; i++) {
        const a = i * 2.4, d = 0.28 + (i % 4) * 0.12
        k.box(L(leaves[i % leaves.length], 0.9), [0.07, 0.008, 0.05], [Math.cos(a) * d, 0.012 + (i % 3) * 0.003, Math.sin(a) * d], [0, a, 0])
      }
    }
  }),

  // Gazebo trim: front steps, turned balusters under the rails, a seat
  // round the inside, corner brackets under the roof ring and a spike finial.
  gazeboTrim: () => prop('gazeboTrim', (k) => {
    const white = L('#fafafa', 0.6)
    k.box(cast(L('#c9bcb6', 0.9)), [0.52, 0.08, 0.2], [0, 0.04, 0.95])
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      const b = a + Math.PI / 3
      const p = [Math.sin(a) * 0.72, Math.cos(a) * 0.72], q = [Math.sin(b) * 0.72, Math.cos(b) * 0.72]
      // Brackets from each post up to the roof ring.
      const ci = [Math.sin(a) * 0.6, Math.cos(a) * 0.6]
      k.rod(white, [p[0], 1.2, p[1]], [ci[0], 1.37, ci[1]], 0.014, 4)
      k.box(white, [0.11, 0.05, 0.11], [p[0], 0.18, p[1]])
      if (i === 5) continue
      const mid = (a + b) / 2
      for (let j = 1; j < 6; j++) {
        const t = j / 6
        const x = (p[0] + (q[0] - p[0]) * t) * 0.97, z = (p[1] + (q[1] - p[1]) * t) * 0.97
        k.cyl(white, 0.012, 0.016, 0.22, [x, 0.29, z], undefined, 6)
      }
      k.box(white, [0.7, 0.03, 0.035], [Math.sin(mid) * 0.62, 0.19, Math.cos(mid) * 0.62], [0, mid, 0])
      // A bench seat along the three back sides.
      if (i === 1 || i === 2 || i === 3) {
        k.box(cast(L('#8d6e63', 0.8)), [0.6, 0.03, 0.14], [Math.sin(mid) * 0.5, 0.36, Math.cos(mid) * 0.5], [0, mid, 0])
        k.box(L('#795548', 0.8), [0.5, 0.18, 0.02], [Math.sin(mid) * 0.46, 0.26, Math.cos(mid) * 0.46], [0, mid, 0])
      }
    }
    k.cone(L('#c9a227', 0.35, 0.6), 0.02, 0.16, [0, 2.24, 0], undefined, 6)
  }),
}

// The litter bin that stands beside a park bench.
export const benchBin = () => STREET_PROPS.bin()

// Wild land (game/wildLand.ts): what grows round an old tree or a boulder that
// was never cleared. Long grass in clumps of blades, a fern, toadstools on a
// fallen branch, pine cones and pebbles, all inside the tile and on the ground.
const WILD_GRASS: Record<string, string[]> = {
  spring: ['#5fae3a', '#76c043', '#4e9a2f'],
  summer: ['#4e9a2f', '#5fae3a', '#3f8a26'],
  fall: ['#a7a03c', '#8c9a43', '#c2a34a'],
  winter: ['#b9a98a', '#a1907a', '#cbbd9f'],
}

function grass(k: PropKit, x: number, z: number, n: number, h: number, seed: number) {
  const g = WILD_GRASS[SEASON] ?? WILD_GRASS.summer
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed
    const lean = 0.25 + jit(seed, i) * 0.3
    const hh = h * (0.75 + jit(i, seed) * 0.5)
    k.cone(L(g[i % 3], 0.9), 0.03, hh, [x + Math.cos(a) * 0.04, hh / 2 - 0.01, z + Math.sin(a) * 0.04], [Math.sin(a) * lean, 0, -Math.cos(a) * lean], 4)
  }
  if (SNOW) k.ico(L('#f4f8fb', 0.8), 0.07, [x, 0.02, z], [1.4, 0.35, 1.4], 0)
}

function undergrowth(k: PropKit, kind: 'oak' | 'pine' | 'rock') {
  const tufts: [number, number][] = kind === 'rock' ? [[-0.62, 0.42], [0.55, 0.6], [0.7, -0.35], [-0.5, -0.62]] : [[-0.66, 0.38], [0.58, 0.56], [0.62, -0.52], [-0.4, -0.7], [0.1, 0.78]]
  tufts.forEach(([x, z], i) => grass(k, x, z, 9, 0.42, i * 3 + 1))
  // Pebbles half sunk in the ground.
  for (const [x, z, r] of [[0.78, 0.15, 0.06], [-0.78, -0.12, 0.05], [0.32, -0.8, 0.045]] as const) {
    k.ico(L('#8a8a8a', 0.95), r, [x, r * 0.35, z], [1.2, 0.7, 1], 0)
  }
  if (kind === 'rock') return
  if (kind === 'pine') {
    // Pine cones dropped round the trunk.
    for (let i = 0; i < 6; i++) {
      const a = i * 1.9 + 0.4, d = 0.32 + (i % 3) * 0.13
      k.ico(L('#7a5236', 0.9), 0.035, [Math.cos(a) * d, 0.03, Math.sin(a) * d], [0.75, 0.75, 1.25], 0)
    }
    return
  }
  // A fallen branch with toadstools growing on it, and a fern beside the trunk.
  const bark = L('#6b4a32', 0.95)
  k.rod(cast(bark), [0.12, 0.08, 0.72], [0.82, 0.08, 0.2], 0.08, 8)
  k.cyl(L('#c8a27a', 0.9), 0.07, 0.07, 0.01, [0.825, 0.08, 0.197], [0, -0.64, Math.PI / 2], 8)
  k.rod(bark, [0.5, 0.12, 0.45], [0.6, 0.3, 0.6], 0.025, 5)
  if (!SNOW) {
    for (const [x, z, s] of [[-0.2, 0.62, 1], [-0.05, 0.75, 0.8], [0.72, -0.62, 0.9]] as const) {
      k.cyl(L('#f5ecd7', 0.8), 0.02 * s, 0.026 * s, 0.1 * s, [x, 0.05 * s, z], undefined, 6)
      k.sphere(L('#d32f2f', 0.6), 0.065 * s, [x, 0.1 * s, z], [1, 0.8, 1], 10, 4, Math.PI / 2)
    }
    const fern = WILD_GRASS[SEASON] ?? WILD_GRASS.summer
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      k.box(L(fern[i % 3], 0.85), [0.07, 0.014, 0.36], [-0.5 + Math.sin(a) * 0.15, 0.1, 0.2 + Math.cos(a) * 0.15], [0.45, a, 0])
    }
  }
}

export const WILD_PROPS = {
  oak: () => prop(`wild-oak|${SEASON}`, (k) => undergrowth(k, 'oak')),
  pine: () => prop(`wild-pine|${SEASON}`, (k) => undergrowth(k, 'pine')),
  // A big lichen-spotted boulder with a smaller one leaning on it, moss on top
  // and grass round the foot.
  boulder: () => prop(`wild-rock|${SEASON}`, (k) => {
    const stone = ['#a39e93', '#8d877c', '#b0aa9e']
    k.ico(cast(L(stone[0], 0.95)), 0.62, [0, 0.38, 0], [1.1, 0.78, 0.95], 1)
    k.ico(cast(L(stone[1], 0.95)), 0.34, [0.5, 0.2, 0.36], [1, 0.8, 1.1], 0)
    k.ico(L(stone[2], 0.95), 0.2, [-0.48, 0.1, 0.42], [1.2, 0.7, 1], 0)
    // Moss over the crown (snow in winter) and lichen spots on the sides.
    k.ico(L(SNOW ? '#f4f8fb' : '#6a8f3a', 0.9), 0.4, [-0.06, 0.78, 0.02], [1.15, 0.28, 1], 1)
    for (const [x, y, z] of [[0.52, 0.45, -0.25], [-0.4, 0.5, 0.42], [0.1, 0.3, 0.6]] as const) {
      k.ico(L('#c5c98a', 0.9), 0.07, [x, y, z], [1, 0.6, 1], 0)
    }
    undergrowth(k, 'rock')
  }),
}
