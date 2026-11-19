import type { ReactNode } from 'react'
import { BufferGeometry, CircleGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, OctahedronGeometry, PlaneGeometry, Shape, type Texture } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BuildingDef } from '../game/data'
import { growthStage } from '../game/growth'
import type { NewModelProps } from './NewBuildings'
import { Ball, Box, Bulbs, Cyl, Pool, GOLD, type Mat, type V3 } from './edgeKit'
import { PerLot, Upright } from './mergeScale'
import { PEOPLE_SIZED } from './keepShape'
import { CarModel } from './CarModel'
import { PropMesh, prop, type Look } from './propKit'
import { DECOR_PROPS } from './decorProps'
import { glowMats } from './dayNight'
import { PAL, SEASON } from './season'
import { shade } from './flora'
import { useDoorTag } from './HomeBlock'
import { grassTex, gravelTex, paverTex, shingleTex, sidingTex, waterTex } from './textures'

// Grand homes: the Painted Lady, the Hillcrest Villa and the Goldcrest Mansion
// (see "More homes" in game/data.ts). Each grows in its own style:
//  - victorian: a Queen Anne house with a round turret, a wraparound porch
//    and gingerbread trim (1-3), a three-storey Grand Victorian with a porch
//    balcony and a dormer (4-6), then a Victorian Terrace, a row of painted
//    ladies in different trims (7-10).
//  - villa: a Mediterranean villa with an arched loggia, a courtyard fountain,
//    a pool and cypresses behind a gated drive (1-3), a Villa Estate with a
//    bell tower and a guest wing (4-6), then a three-storey Grand Villa (7-10).
//  - mansion: a symmetrical mansion with a columned portico and a gold
//    cupola, a circular drive round a fountain and a hedge garden behind iron
//    gates (1-3), the Goldcrest Estate with two wings (4-6), then the Goldcrest
//    Palace under a gold dome (7-10).
// Walls take def.color and roofs def.roof, so the player's theme shows. Lots
// face +z. Plain static meshes; fine detail (spindles, railings, fountains,
// hedges) is built once per kind with PropKit and shared by every copy.
// A merged pair draws two homes side by side (PerLot), each at true size.

export const GRAND_HOMES = new Set(['victorian', 'villa', 'mansion'])

type Kit = { m: Mat; win: ReactNode; bulb: ReactNode; ghost?: boolean }

const look = (c: string, r = 0.7, mt = 0, cast = false): Look => ({ c, r, m: mt, cast })
const cast = (l: Look): Look => ({ ...l, cast: true })
const IRON = look('#263238', 0.5, 0.35)
const GILT = look(GOLD, 0.3, 0.7)
const STONE = '#e0dcd3'
const WATER = '#4fc3f7'

// ---------------------------------------------------------------------------
// Shapes, built once and shared.

// A unit gable prism: a triangle (base -0.5..0.5 at y 0, apex at y 1) run
// along z from -0.5 to 0.5. Scaled to fill the gable end of a pitched roof.
let prismG: BufferGeometry | null = null
function prismGeo() {
  if (prismG) return prismG
  const A0: V3 = [-0.5, 0, 0.5], B0: V3 = [0.5, 0, 0.5], C0: V3 = [0, 1, 0.5]
  const A1: V3 = [-0.5, 0, -0.5], B1: V3 = [0.5, 0, -0.5], C1: V3 = [0, 1, -0.5]
  const tris: [V3, V3, V3][] = [[A0, B0, C0], [A1, C1, B1], [A0, C0, C1], [A0, C1, A1], [B0, B1, C1], [B0, C1, C0]]
  const pos: number[] = []
  const uv: number[] = []
  tris.forEach((t, i) => t.forEach(([x, y, z]) => {
    pos.push(x, y, z)
    if (i < 2) uv.push(x + 0.5, y)
    else uv.push(z + 0.5, y)
  }))
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  prismG = g
  return g
}

// A hipped roof w wide, d deep and h high: a ridge along the longer side,
// sloping down on all four sides to the eaves at y 0.
const hips = new Map<string, BufferGeometry>()
function hipGeo(w: number, d: number, h: number) {
  const key = `${w}|${d}|${h}`
  const hit = hips.get(key)
  if (hit) return hit
  const swap = d > w
  const W = swap ? d : w, Dd = swap ? w : d
  const r = (W - Dd) / 2
  const P0: V3 = [-W / 2, 0, Dd / 2], P1: V3 = [W / 2, 0, Dd / 2], P2: V3 = [W / 2, 0, -Dd / 2], P3: V3 = [-W / 2, 0, -Dd / 2]
  const R0: V3 = [-r, h, 0], R1: V3 = [r, h, 0]
  const tris: [V3, V3, V3][] = [[P0, P1, R1], [P0, R1, R0], [P2, P3, R0], [P2, R0, R1], [P1, P2, R1], [P3, P0, R0]]
  const pos: number[] = []
  const uv: number[] = []
  for (const t of tris) for (const [x, y, z] of t) {
    pos.push(x, y, z)
    uv.push(x / W + 0.5, z / Dd + 0.5)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  if (swap) g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  hips.set(key, g)
  return g
}

// A wall `len` long and `h` high pierced by `n` round-headed arches that run
// down to the ground (a loggia's arcade), `depth` thick, centred on z 0.
const arcades = new Map<string, BufferGeometry>()
function arcadeGeo(len: number, h: number, n: number, open: number, spring: number, depth: number) {
  const key = `${len}|${h}|${n}|${open}|${spring}|${depth}`
  const hit = arcades.get(key)
  if (hit) return hit
  const s = new Shape()
  s.moveTo(-len / 2, 0)
  const bay = len / n
  for (let i = 0; i < n; i++) {
    const cx = -len / 2 + bay * (i + 0.5)
    s.lineTo(cx - open / 2, 0)
    s.lineTo(cx - open / 2, spring)
    s.absarc(cx, spring, open / 2, Math.PI, 0, true)
    s.lineTo(cx + open / 2, 0)
  }
  s.lineTo(len / 2, 0)
  s.lineTo(len / 2, h)
  s.lineTo(-len / 2, h)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 })
  g.translate(0, 0, -depth / 2)
  arcades.set(key, g)
  return g
}

// ---------------------------------------------------------------------------
// Props, built once per kind.

// A porch railing `len` long (along x): rails and square spindles.
const spindleRail = (len: number, c: string) => prop(`gh-rail|${len}|${c}`, (k) => {
  const w = look(c, 0.6)
  k.box(w, [len, 0.025, 0.035], [0, 0.03, 0])
  k.box(cast(w), [len + 0.02, 0.03, 0.05], [0, 0.205, 0])
  const n = Math.max(2, Math.round(len / 0.06))
  for (let i = 0; i < n; i++) k.box(w, [0.022, 0.16, 0.022], [(-0.5 + (i + 0.5) / n) * len, 0.115, 0])
})

// Gingerbread frieze hung under a porch roof (its top at y 0): a board, a
// row of little spindles and a beaded bottom rail.
const frieze = (len: number, c: string) => prop(`gh-frieze|${len}|${c}`, (k) => {
  const w = look(c, 0.6)
  k.box(w, [len, 0.04, 0.03], [0, -0.02, 0])
  const n = Math.max(2, Math.round(len / 0.045))
  for (let i = 0; i < n; i++) {
    const x = (-0.5 + (i + 0.5) / n) * len
    k.box(w, [0.012, 0.05, 0.012], [x, -0.065, 0])
    k.sphere(w, 0.011, [x, -0.096, 0], [1, 1, 1], 6, 4)
  }
  k.box(w, [len, 0.012, 0.018], [0, -0.096, 0])
})

// Fan brackets at the top of a porch post (the post top at y 0), both ways.
const brackets = (c: string) => prop(`gh-bracket|${c}`, (k) => {
  const w = look(c, 0.6)
  for (const r of [0, Math.PI / 2]) {
    for (const sd of [-1, 1]) {
      const dx = Math.cos(r) * sd, dz = -Math.sin(r) * sd
      k.box(w, [0.13, 0.018, 0.018], [dx * 0.045, -0.045, dz * 0.045], [0, r, sd * Math.PI / 4])
      k.sphere(w, 0.014, [dx * 0.03, -0.065, dz * 0.03], [1, 1, 1], 6, 4)
    }
  }
})

// Bargeboard and a sunburst fan for a gable end w wide and h high (base at y 0,
// set just in front of the gable wall).
const gableTrim = (w: number, h: number, c: string, acc: string) => prop(`gh-gable|${w}|${h}|${c}|${acc}`, (k) => {
  const tr = look(c, 0.6)
  const ac = look(acc, 0.6)
  const t = Math.atan2(h, w / 2)
  const s = Math.hypot(w / 2, h)
  for (const sd of [-1, 1]) {
    const nx = -sd * Math.sin(t), ny = -Math.cos(t)
    k.box(cast(tr), [s, 0.07, 0.025], [sd * w / 4 + nx * 0.045, h / 2 + ny * 0.045, 0], [0, 0, -sd * t])
    // Scallops under the board.
    for (let i = 1; i < 6; i++) {
      const f = i / 6
      k.sphere(ac, 0.022, [sd * (w / 2) * f + nx * 0.085, h * (1 - f) + ny * 0.085, 0], [1, 1, 0.6], 6, 4)
    }
  }
  const yb = h * 0.55
  const hw = (w / 2) * (1 - yb / h)
  k.box(tr, [hw * 2, 0.03, 0.022], [0, yb, 0.004])
  k.box(tr, [0.03, h - yb - 0.06, 0.022], [0, (yb + h - 0.06) / 2, 0.004])
  const rr = Math.min(hw * 0.75, (h - yb) * 0.62)
  for (let i = 0; i < 7; i++) {
    const a = ((i + 0.5) / 7) * Math.PI
    k.rod(tr, [0, yb, 0.006], [Math.cos(a) * rr, yb + Math.sin(a) * rr, 0.006], 0.008, 4)
  }
  k.cyl(ac, 0.04, 0.04, 0.02, [0, yb + 0.005, 0.012], [Math.PI / 2, 0, 0], 10)
  k.cone(ac, 0.025, 0.09, [0, yb - 0.06, 0.006], [Math.PI, 0, 0], 6)
})

// A porch swing hung from the porch ceiling `top` above its floor.
const swing = (top: number, c: string) => prop(`gh-swing|${top}|${c}`, (k) => {
  const w = look(c, 0.7)
  k.box(cast(w), [0.4, 0.03, 0.14], [0, 0.2, 0])
  k.box(w, [0.4, 0.14, 0.02], [0, 0.28, -0.065])
  for (const x of [-0.19, 0.19]) {
    k.box(w, [0.02, 0.08, 0.14], [x, 0.25, 0])
    k.rod(IRON, [x, 0.22, 0], [x, top, 0], 0.005, 3)
  }
  k.box(look('#f48fb1', 0.9), [0.12, 0.08, 0.04], [-0.1, 0.25, -0.03], [-0.2, 0, 0])
})

// A white picket fence `len` long with a post at each end.
const picket = (len: number, c: string) => prop(`gh-picket|${len}|${c}`, (k) => {
  const w = look(c, 0.6)
  const n = Math.max(2, Math.round(len / 0.075))
  for (let i = 0; i < n; i++) {
    const x = (-0.5 + (i + 0.5) / n) * (len - 0.06)
    k.box(cast(w), [0.04, 0.24, 0.018], [x, 0.12, 0])
    k.cone(w, 0.029, 0.05, [x, 0.265, 0], [0, Math.PI / 4, 0], 4)
  }
  for (const y of [0.07, 0.19]) k.box(w, [len - 0.04, 0.03, 0.02], [0, y, -0.019])
  for (const sd of [-1, 1]) {
    k.box(cast(w), [0.06, 0.3, 0.06], [sd * (len / 2 - 0.03), 0.15, 0])
    k.sphere(w, 0.035, [sd * (len / 2 - 0.03), 0.33, 0], [1, 1, 1], 8, 6)
  }
})

// Wrought-iron railings `len` long and `h` tall with spear tips.
const ironFence = (len: number, h: number, tip: 'gold' | 'iron' | 'none') => prop(`gh-iron|${len}|${h}|${tip}`, (k) => {
  const n = Math.max(2, Math.round(len / 0.07))
  const tl = tip === 'gold' ? GILT : IRON
  for (let i = 0; i < n; i++) {
    const x = (-0.5 + (i + 0.5) / n) * len
    k.box(IRON, [0.016, h, 0.016], [x, h / 2, 0])
    if (tip !== 'none') k.cone(tl, 0.02, 0.06, [x, h + 0.03, 0], undefined, 4)
  }
  for (const y of [0.06, tip === 'none' ? h : h - 0.05]) k.box(IRON, [len, 0.025, 0.022], [0, y, 0])
  // A ring between the top rails, every other bar.
  for (let i = 0; i < n - 1; i += 2) k.torus(IRON, 0.022, 0.005, [(-0.5 + (i + 1) / n) * len, h - 0.1, 0], [0, 0, 0], Math.PI * 2, 10, 3)
})

// One leaf of a pair of iron gates w wide: hinged at x 0, reaching to x w/2
// where the pair meets, its bars rising in an arc towards that end, with
// scrolls along the middle rail and (crest) a gilt medallion.
const gateLeaf = (w: number, h: number, crest: boolean) => prop(`gh-leaf|${w}|${h}|${crest}`, (k) => {
  const L = w / 2
  const n = Math.round(L / 0.06)
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * L
    const top = h + Math.sin((x / w) * Math.PI) * 0.14
    k.box(IRON, [0.016, top, 0.016], [x, top / 2, 0])
    k.cone(crest ? GILT : IRON, 0.02, 0.06, [x, top + 0.03, 0], undefined, 4)
  }
  for (const y of [0.06, h * 0.55]) k.box(IRON, [L, 0.03, 0.024], [L / 2, y, 0])
  k.box(IRON, [0.03, h, 0.03], [L - 0.015, h / 2, 0.005])
  for (const f of [0.25, 0.75]) k.torus(crest ? GILT : IRON, 0.04, 0.007, [f * L, h * 0.55 + 0.05, 0], [0, 0, 0], Math.PI * 2, 12, 3)
  if (crest) {
    k.cyl(GILT, 0.06, 0.06, 0.02, [L * 0.55, h * 0.78, 0.014], [Math.PI / 2, 0, 0], 16)
    k.cone(GILT, 0.03, 0.08, [L * 0.55, h * 0.78 + 0.09, 0.014], undefined, 4)
  }
})

// A pair of gates w wide standing open: hinged at the piers, both leaves swung
// in towards the house so the way through is clear.
function OpenGates({ at, w, h, crest }: { at: V3; w: number; h: number; crest: boolean }) {
  return (
    <group position={at}>
      {[-1, 1].map((sd) => <Prop key={sd} parts={gateLeaf(w, h, crest)} at={[sd * w / 2, 0, 0]} ry={Math.PI / 2 - sd * 0.2} />)}
    </group>
  )
}

// Italian cypress: a short trunk under a tall dark green spire.
const cypress = () => prop(`gh-cypress|${SEASON}`, (k) => {
  const g = SEASON === 'winter' ? ['#2b5530', '#33603a'] : ['#2e6b34', '#38793e']
  k.cyl(cast(look('#6d4c41', 0.9)), 0.03, 0.04, 0.16, [0, 0.08, 0], undefined, 6)
  k.ico(cast(look(g[0], 0.9)), 0.15, [0, 0.5, 0], [1, 2.7, 1], 1)
  k.ico(look(g[1], 0.9), 0.1, [0.03, 0.62, 0.05], [1, 2.6, 1], 1)
  k.ico(look(g[1], 0.9), 0.09, [-0.02, 0.92, -0.02], [1, 2.2, 1], 1)
})

// Round-headed garden tree in the season's colours.
const tree = () => prop(`gh-tree|${SEASON}`, (k) => {
  k.cyl(cast(look('#7b5034', 0.9)), 0.035, 0.06, 0.5, [0, 0.25, 0], undefined, 7)
  const blobs: [number, number, number, number][] = [[0, 0.66, 0, 0.24], [0.14, 0.56, 0.06, 0.16], [-0.13, 0.58, -0.05, 0.17], [0.02, 0.82, -0.02, 0.15], [-0.04, 0.6, 0.15, 0.14]]
  blobs.forEach(([x, y, z, r], i) => k.ico(cast(look(PAL.leaves[i % 5], 0.85)), r, [x, y, z], [1, 0.9, 1], 1))
})

// A shrub in the season's bush colours.
const shrub = () => prop(`gh-shrub|${SEASON}`, (k) => {
  k.ico(cast(look(PAL.bush[0], 0.85)), 0.13, [0, 0.11, 0], [1.1, 0.85, 1.1], 1)
  k.ico(look(PAL.bush[1], 0.85), 0.08, [0.08, 0.15, 0.05], [1, 0.9, 1], 0)
})

// A bed of flowers `len` long behind a low edging.
const flowerBed = (len: number) => prop(`gh-bed|${len}|${SEASON}`, (k) => {
  k.box(look('#6d4c41', 1), [len, 0.05, 0.16], [0, 0.025, 0])
  const pal = SEASON === 'fall' ? ['#ff8f00', '#c62828', '#fbc02d'] : ['#ec407a', '#fff176', '#ab47bc', '#ffffff']
  const n = Math.max(2, Math.round(len / 0.09))
  for (let i = 0; i < n; i++) {
    const x = (-0.5 + (i + 0.5) / n) * len
    k.ico(look('#43a047', 0.85), 0.05, [x, 0.07, 0], [1, 0.7, 1], 0)
    k.ico(look(pal[i % pal.length], 0.6), 0.03, [x + 0.01, 0.11, 0.02], [1, 0.8, 1], 0)
  }
})

// A window box of flowers `len` long (its back against the wall at z 0).
const windowBox = (len: number) => prop(`gh-wbox|${len}|${SEASON}`, (k) => {
  k.box(cast(look('#6d4c41', 0.9)), [len, 0.06, 0.07], [0, 0.03, 0.035])
  const pal = SEASON === 'fall' ? ['#ff8f00', '#c62828'] : ['#ec407a', '#fff176', '#ffffff']
  const n = Math.max(2, Math.round(len / 0.06))
  for (let i = 0; i < n; i++) {
    const x = (-0.5 + (i + 0.5) / n) * (len - 0.02)
    k.ico(look('#43a047', 0.85), 0.03, [x, 0.07, 0.04], [1, 0.8, 1], 0)
    k.ico(look(pal[i % pal.length], 0.6), 0.02, [x, 0.095, 0.05], [1, 0.8, 1], 0)
  }
})

// Mailbox on a post.
const mailbox = () => prop('gh-mailbox', (k) => {
  k.box(cast(look('#5d4037', 0.9)), [0.04, 0.36, 0.04], [0, 0.18, 0])
  k.box(look('#37474f', 0.5, 0.3), [0.1, 0.06, 0.18], [0, 0.39, 0])
  k.cyl(cast(look('#37474f', 0.5, 0.3)), 0.05, 0.05, 0.18, [0, 0.42, 0], [Math.PI / 2, 0, 0], 10)
  k.box(look('#e53935', 0.6), [0.012, 0.08, 0.03], [0.056, 0.45, -0.04])
})

// A rose arch over the garden gate, w across, in three pieces so the way
// through stays clear: a post with its climbing roses (+x side; turned for the
// other), and the arch over the top, clear above people's heads.
const ROSE = SEASON === 'fall' ? '#c62828' : '#ec407a'
const ROSE_LEAF = ['#2e7d32', '#388e3c']
const ARCH_H = 0.66
const roseArchPost = (w: number) => prop(`gh-archpost|${w}|${SEASON}`, (k) => {
  k.box(cast(look('#fafafa', 0.6)), [0.04, ARCH_H, 0.04], [w / 2, ARCH_H / 2, 0])
  for (const y of [0.15, 0.32, 0.48, 0.62]) {
    k.ico(look(ROSE_LEAF[0], 0.85), 0.045, [w / 2, y, 0.02], [1, 1, 0.8], 0)
    k.ico(look(ROSE, 0.6), 0.025, [w / 2 + 0.02, y + 0.04, 0.04], [1, 1, 1], 0)
  }
})
const roseArchTop = (w: number) => prop(`gh-archtop|${w}|${SEASON}`, (k) => {
  k.torus(cast(look('#fafafa', 0.6)), w / 2, 0.02, [0, ARCH_H, 0], [0, 0, 0], Math.PI, 14, 4)
  for (let i = 1; i < 8; i++) {
    const a = (i / 8) * Math.PI
    const p: V3 = [Math.cos(a) * w / 2, ARCH_H + Math.sin(a) * w / 2, 0]
    k.ico(look(ROSE_LEAF[i % 2], 0.85), 0.055, p, [1, 1, 0.8], 0)
    if (i % 2 === 0) k.ico(look(ROSE, 0.6), 0.03, [p[0], p[1] + 0.03, 0.04], [1, 1, 1], 0)
  }
})
function RoseArch({ at, w }: { at: V3; w: number }) {
  return (
    <group position={at}>
      {[0, Math.PI].map((ry) => <Prop key={ry} parts={roseArchPost(w)} at={[0, 0, 0]} ry={ry} />)}
      <Prop parts={roseArchTop(w)} at={[0, 0, 0]} />
    </group>
  )
}

// Iron cresting along a roof ridge `len` long.
const cresting = (len: number) => prop(`gh-crest|${len}`, (k) => {
  k.box(IRON, [len, 0.02, 0.02], [0, 0.01, 0])
  const n = Math.max(2, Math.round(len / 0.07))
  for (let i = 0; i < n; i++) {
    const x = (-0.5 + (i + 0.5) / n) * len
    k.box(IRON, [0.012, 0.09, 0.012], [x, 0.055, 0])
    k.cone(IRON, 0.018, 0.045, [x, 0.12, 0], undefined, 4)
  }
  k.box(IRON, [len, 0.012, 0.014], [0, 0.07, 0])
})

// A stone birdbath.
const birdbath = () => prop('gh-birdbath', (k) => {
  k.cyl(cast(look(STONE, 0.9)), 0.08, 0.1, 0.04, [0, 0.02, 0], undefined, 10)
  k.cyl(cast(look(STONE, 0.9)), 0.03, 0.045, 0.3, [0, 0.19, 0], undefined, 8)
  k.cyl(cast(look(STONE, 0.9)), 0.14, 0.06, 0.06, [0, 0.37, 0], undefined, 12)
  k.cyl(look(WATER, 0.2), 0.12, 0.12, 0.01, [0, 0.4, 0], undefined, 12)
})

// A fountain: a round basin, a pedestal bowl and a jet; `tiers` 2 or 3.
const fountain = (tiers: 2 | 3, gold: boolean) => prop(`gh-fountain|${tiers}|${gold}`, (k) => {
  const st = cast(look(STONE, 0.9))
  const wa = look(WATER, 0.15)
  k.cyl(st, 0.38, 0.4, 0.1, [0, 0.05, 0], undefined, 20)
  k.cyl(wa, 0.34, 0.34, 0.012, [0, 0.106, 0], undefined, 20)
  k.torus(st, 0.36, 0.035, [0, 0.12, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 24, 5)
  k.cyl(st, 0.06, 0.09, 0.32, [0, 0.27, 0], undefined, 10)
  k.cyl(st, 0.22, 0.07, 0.08, [0, 0.46, 0], undefined, 16)
  k.cyl(wa, 0.19, 0.19, 0.01, [0, 0.505, 0], undefined, 16)
  let top = 0.5
  if (tiers === 3) {
    k.cyl(st, 0.035, 0.05, 0.2, [0, 0.6, 0], undefined, 8)
    k.cyl(st, 0.13, 0.04, 0.06, [0, 0.72, 0], undefined, 14)
    k.cyl(wa, 0.11, 0.11, 0.01, [0, 0.755, 0], undefined, 14)
    top = 0.75
  }
  k.cyl(st, 0.025, 0.035, 0.14, [0, top + 0.07, 0], undefined, 8)
  if (gold) {
    k.sphere(GILT, 0.05, [0, top + 0.18, 0], [1, 1, 1], 10, 8)
    k.cone(GILT, 0.025, 0.1, [0, top + 0.26, 0], undefined, 6)
  } else {
    k.sphere(look(STONE, 0.9), 0.04, [0, top + 0.17, 0], [1, 1, 1], 10, 8)
  }
  // Spray falling from the bowl rim into the basin.
  const spray = look('#b3e5fc', 0.2)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    k.rod(spray, [Math.cos(a) * 0.2, 0.49, Math.sin(a) * 0.2], [Math.cos(a) * 0.27, 0.11, Math.sin(a) * 0.27], 0.012, 4)
  }
})

// Pool lounger along z, its head at -z.
const lounger = (c: string) => prop(`gh-lounger|${c}`, (k) => {
  const fr = look('#fafafa', 0.5)
  k.box(cast(fr), [0.2, 0.03, 0.5], [0, 0.1, 0])
  for (const x of [-0.085, 0.085]) for (const z of [-0.21, 0.21]) k.box(fr, [0.02, 0.09, 0.02], [x, 0.045, z])
  k.box(look(c, 0.8), [0.18, 0.03, 0.32], [0, 0.13, 0.08])
  k.box(cast(look(c, 0.8)), [0.18, 0.03, 0.18], [0, 0.18, -0.15], [-0.6, 0, 0])
  k.box(look('#fafafa', 0.9), [0.12, 0.012, 0.1], [0, 0.15, 0.12])
})

// A market umbrella on a stand.
const umbrella = (c: string) => prop(`gh-umbrella|${c}`, (k) => {
  k.cyl(look('#9e9e9e', 0.7), 0.07, 0.08, 0.04, [0, 0.02, 0], undefined, 10)
  k.cyl(look('#eceff1', 0.5), 0.012, 0.012, 0.7, [0, 0.38, 0], undefined, 6)
  k.cone(cast(look(c, 0.8)), 0.34, 0.14, [0, 0.72, 0], undefined, 8)
  k.sphere(look('#eceff1', 0.5), 0.02, [0, 0.8, 0], [1, 1, 1], 6, 4)
})

// A terracotta pot with a clipped lemon tree.
const lemonPot = () => prop(`gh-lemon|${SEASON}`, (k) => {
  k.cyl(cast(look('#c1663c', 0.9)), 0.09, 0.065, 0.16, [0, 0.08, 0], undefined, 10)
  k.cyl(look('#5d4037', 1), 0.085, 0.085, 0.01, [0, 0.16, 0], undefined, 10)
  k.cyl(look('#6d4c41', 0.9), 0.012, 0.015, 0.2, [0, 0.26, 0], undefined, 5)
  k.ico(cast(look('#388e3c', 0.85)), 0.13, [0, 0.42, 0], [1, 0.95, 1], 1)
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26
    k.sphere(look('#fdd835', 0.5), 0.022, [Math.cos(a) * 0.11, 0.4 + (i % 2) * 0.06, Math.sin(a) * 0.11], [1, 1, 1], 6, 4)
  }
})

// A pergola `w` by `d` with vines over its top.
const pergola = (w: number, d: number, h: number) => prop(`gh-pergola|${w}|${d}|${h}|${SEASON}`, (k) => {
  const wood = look('#8d6e63', 0.85)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(cast(wood), [0.05, h, 0.05], [sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03)])
  for (const sx of [-1, 1]) k.box(cast(wood), [0.04, 0.06, d + 0.1], [sx * (w / 2 - 0.03), h + 0.03, 0])
  const n = Math.round(d / 0.12)
  for (let i = 0; i <= n; i++) k.box(cast(wood), [w + 0.1, 0.03, 0.03], [0, h + 0.075, -d / 2 + (i * d) / n])
  const leaf = ['#43a047', '#388e3c', '#66bb6a']
  for (let i = 0; i < 9; i++) {
    const z = -d / 2 + 0.08 + ((d - 0.16) * i) / 8
    const x = (i % 3 - 1) * w * 0.3
    k.ico(look(leaf[i % 3], 0.85), 0.09, [x, h + 0.11, z], [1.3, 0.5, 1.1], 1)
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) k.ico(look(leaf[i % 3], 0.85), 0.05, [sx * (w / 2 - 0.03), 0.2 + i * 0.22, d / 2 - 0.03], [1, 1.4, 1], 0)
})

// Stone balustrade `len` long: rails and vase balusters.
const balustrade = (len: number, c: string) => prop(`gh-bal|${len}|${c}`, (k) => {
  const s = look(c, 0.85)
  k.box(s, [len, 0.03, 0.07], [0, 0.015, 0])
  k.box(cast(s), [len + 0.02, 0.035, 0.08], [0, 0.2, 0])
  const n = Math.max(2, Math.round(len / 0.075))
  for (let i = 0; i < n; i++) {
    const x = (-0.5 + (i + 0.5) / n) * len
    k.cyl(s, 0.014, 0.024, 0.09, [x, 0.075, 0], undefined, 6)
    k.cyl(s, 0.022, 0.014, 0.07, [x, 0.15, 0], undefined, 6)
  }
})

// A hedge parterre `w` by `d`: clipped box hedges round two beds of roses,
// cone topiaries at the corners and an urn in the middle.
const parterre = (w: number, d: number, topiary: boolean) => prop(`gh-parterre|${w}|${d}|${topiary}|${SEASON}`, (k) => {
  const hg = cast(look(SEASON === 'winter' ? '#2e5d31' : '#2e7d32', 0.9))
  const t = 0.07, h = 0.12
  for (const sz of [-1, 1]) k.box(hg, [w, h, t], [0, h / 2, sz * (d / 2 - t / 2)])
  for (const sx of [-1, 1]) k.box(hg, [t, h, d - 2 * t], [sx * (w / 2 - t / 2), h / 2, 0])
  k.box(hg, [w - 2 * t, h, t], [0, h / 2, 0])
  // Gravel walk down the middle, roses in the beds.
  k.box(look('#e6dccb', 1), [0.1, 0.012, d - 2 * t], [0, 0.006, 0])
  const pal = SEASON === 'fall' ? ['#c62828', '#ff8f00'] : ['#e91e63', '#ffffff', '#f06292']
  let i = 0
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    const cx = sx * (w / 4 + 0.015), cz = sz * (d / 4)
    for (const [ox, oz] of [[-0.06, -d / 10], [0.06, 0], [-0.04, d / 10]]) {
      k.ico(look('#388e3c', 0.85), 0.055, [cx + ox, 0.05, cz + oz], [1, 0.7, 1], 0)
      k.ico(look(pal[i++ % pal.length], 0.6), 0.03, [cx + ox, 0.09, cz + oz], [1, 0.8, 1], 0)
    }
  }
  if (topiary) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - t / 2), z = sz * (d / 2 - t / 2)
      k.cone(cast(look('#1b5e20', 0.9)), 0.07, 0.3, [x, h + 0.15, z], undefined, 8)
    }
  }
  k.cyl(look(STONE, 0.9), 0.06, 0.07, 0.14, [0, 0.07, 0], undefined, 8)
  k.sphere(cast(look(STONE, 0.9)), 0.07, [0, 0.19, 0], [1, 0.8, 1], 10, 6)
})

// Stone quoins up the four corners of a block w x d, h tall.
const quoins = (w: number, d: number, h: number) => prop(`gh-quoins|${w}|${d}|${h}`, (k) => {
  const s = look('#cfcac0', 0.9)
  const n = Math.floor(h / 0.12)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const y = 0.06 + i * 0.12
      const long = i % 2 === 0
      k.box(s, [long ? 0.2 : 0.12, 0.1, 0.012], [sx * (w / 2 - (long ? 0.1 : 0.06) + 0.004), y, sz * (d / 2 + 0.006)])
      k.box(s, [0.012, 0.1, long ? 0.12 : 0.2], [sx * (w / 2 + 0.006), y, sz * (d / 2 - (long ? 0.06 : 0.1) + 0.004)])
    }
  }
})

// A gilded urn on a stone pedestal.
const urn = (gold: boolean) => prop(`gh-urn|${gold}`, (k) => {
  const st = cast(look(STONE, 0.9))
  k.box(st, [0.16, 0.24, 0.16], [0, 0.12, 0])
  k.box(st, [0.19, 0.03, 0.19], [0, 0.255, 0])
  const u = gold ? cast(GILT) : st
  k.cyl(u, 0.04, 0.05, 0.04, [0, 0.29, 0], undefined, 10)
  k.sphere(u, 0.075, [0, 0.36, 0], [1, 0.85, 1], 12, 8)
  k.cyl(u, 0.065, 0.05, 0.04, [0, 0.42, 0], undefined, 12)
})

// ---------------------------------------------------------------------------
// Building parts.

// A pitched roof w across and d along z, rising h at the ridge: the gable
// walls (wall colour), two roof slabs overhanging by `over` at the eaves and
// `side` past the gables, and a ridge cap.
function Gable({ m, at, w, d, h, wall, roof, wt, rt, over = 0.08, side = 0.06, ry = 0 }: { m: Mat; at: V3; w: number; d: number; h: number; wall: string; roof: string; wt?: Texture; rt?: Texture; over?: number; side?: number; ry?: number }) {
  const t = Math.atan2(h, w / 2)
  const s = Math.hypot(w / 2, h)
  const th = 0.05
  const L = s + over
  return (
    <group position={at} rotation-y={ry}>
      <mesh geometry={prismGeo()} scale={[w, h, d]} castShadow receiveShadow>{m(wall, wt)}</mesh>
      {[-1, 1].map((sd) => {
        const dx = sd * Math.cos(t), dy = -Math.sin(t)
        const nx = sd * Math.sin(t), ny = Math.cos(t)
        return <Box key={sd} m={m} at={[dx * (L / 2) + nx * (th / 2), h + dy * (L / 2) + ny * (th / 2), 0]} rot={[0, 0, -sd * t]} s={[L, th, d + 2 * side]} c={roof} t={rt} />
      })}
      <Box m={m} at={[0, h + th * 0.75, 0]} s={[0.07, 0.05, d + 2 * side + 0.01]} c={shade(roof, -0.08)} />
    </group>
  )
}

function Hip({ m, at, w, d, h, c, t }: { m: Mat; at: V3; w: number; d: number; h: number; c: string; t?: Texture }) {
  return <mesh position={at} geometry={hipGeo(w, d, h)} castShadow receiveShadow>{m(c, t)}</mesh>
}

// A window on a wall (at: its centre on the wall face, facing +z turned by ry):
// a painted frame, the glass and a sill.
// A set of windows drawn as one mesh of glass and one of frames: each spec is
// [x, y, z, ry, w, h], the middle of the window on the wall face, facing +z
// turned by ry. `out` is how far the glass stands off the wall.
type WSpec = [number, number, number, number, number, number]
const glassGeos = new Map<string, BufferGeometry>()
function glassGeo(list: WSpec[], arch: boolean, out: number) {
  const key = `${arch}|${out}|${list.map((v) => v.map((n) => n.toFixed(4)).join(',')).join(';')}`
  const hit = glassGeos.get(key)
  if (hit) return hit
  const parts: BufferGeometry[] = []
  for (const [x, y, z, ry, w, h] of list) {
    parts.push(new PlaneGeometry(w, h).translate(0, 0, out).rotateY(ry).translate(x, y, z))
    if (arch) parts.push(new CircleGeometry(w / 2, 12, 0, Math.PI).translate(0, h / 2, out).rotateY(ry).translate(x, y, z))
  }
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  g.computeBoundingSphere()
  glassGeos.set(key, g)
  return g
}

// Plain panes of glass (no frames), or of any material `mat`.
function Panes({ k, list, mat }: { k: Kit; list: WSpec[]; mat?: ReactNode }) {
  if (!list.length) return null
  return <mesh geometry={glassGeo(list, false, 0)}>{mat ?? k.win}</mesh>
}

const framesOf = (list: WSpec[], frame: string, sill: boolean, hood: boolean, arch: boolean, shutters?: string) =>
  prop(`gh-wins|${frame}|${sill}|${hood}|${arch}|${shutters}|${list.map((v) => v.map((n) => n.toFixed(4)).join(',')).join(';')}`, (k) => {
    const f = look(frame, 0.6)
    for (const [x, y, z, ry, w, h] of list) {
      const c = Math.cos(ry), sn = Math.sin(ry)
      const at = (ox: number, oy: number, oz: number): V3 => [x + ox * c + oz * sn, y + oy, z - ox * sn + oz * c]
      if (arch) k.box(f, [w + 0.06, h + w / 2 + 0.06, 0.02], at(0, w / 4, 0.012), [0, ry, 0])
      else k.box(f, [w + 0.06, h + 0.06, 0.02], at(0, 0, 0.012), [0, ry, 0])
      if (sill) k.box(f, [w + 0.1, 0.03, 0.05], at(0, -h / 2 - 0.045, 0.03), [0, ry, 0])
      if (hood) k.box(f, [w + 0.12, 0.05, 0.06], at(0, h / 2 + 0.06, 0.03), [0, ry, 0])
      if (shutters) for (const sd of [-1, 1]) k.box(look(shutters, 0.7), [0.07, h + 0.06, 0.016], at(sd * (w / 2 + 0.07), 0.02, 0.014), [0, ry, 0])
    }
  })

// Framed windows: one mesh of frames (and sills, hoods, shutters), one of glass.
function Wins({ k, list, frame = '#fafafa', sill = true, hood = false, arch = false, shutters }: { k: Kit; list: WSpec[]; frame?: string; sill?: boolean; hood?: boolean; arch?: boolean; shutters?: string }) {
  if (!list.length) return null
  return (
    <group>
      <PropMesh parts={framesOf(list, frame, sill, hood, arch, shutters)} />
      <mesh geometry={glassGeo(list, arch, 0.026)}>{k.win}</mesh>
    </group>
  )
}

const doorFrame = (w: number, h: number, frame: string, fan: boolean) => prop(`gh-door|${w}|${h}|${frame}|${fan}`, (k) => {
  k.box(look(frame, 0.6), [w + 0.08, h + 0.04, 0.02], [0, h / 2 + 0.02, 0.012])
  if (fan) k.box(look(frame, 0.6), [w + 0.08, w / 2 + 0.04, 0.02], [0, h + w / 4 + 0.04, 0.012])
  k.box(GILT, [0.03, 0.03, 0.008], [w * 0.3, h * 0.45, 0.03])
})

// A panelled front door (at: the middle of its bottom edge on the wall face);
// `side`: not the way in from the street, so not offered to townspeople.
function Door({ k, at, w, h, c, frame = '#fafafa', ry = 0, fan, side }: { k: Kit; at: V3; w: number; h: number; c: string; frame?: string; ry?: number; fan?: boolean; side?: boolean }) {
  const tag = useDoorTag()
  return (
    <group position={at} rotation-y={ry}>
      <PropMesh parts={doorFrame(w, h, frame, !!fan)} />
      <mesh position={[0, h / 2, 0.026]} userData={side ? undefined : tag}><planeGeometry args={[w, h - 0.02]} />{k.m(c)}</mesh>
      <mesh position={[0, h * 0.72, 0.03]}><planeGeometry args={[w * 0.55, h * 0.26]} />{k.win}</mesh>
      {fan && <mesh position={[0, h + 0.03, 0.026]}><circleGeometry args={[w / 2, 12, 0, Math.PI]} />{k.win}</mesh>}
    </group>
  )
}

// The lawn over a whole lot w x d (top at y 0.04).
function Lawn({ m, w, d }: { m: Mat; w: number; d: number }) {
  return <Box m={m} at={[0, 0.02, 0]} s={[w, 0.04, d]} c="#ffffff" t={grassTex(w / 2, d / 2)} shadow={false} />
}

// A flat strip of paving on the lawn (top at y 0.06, or `y` higher).
function Pave({ m, x, z, w, d, c = '#ffffff', t, y = 0 }: { m: Mat; x: number; z: number; w: number; d: number; c?: string; t?: Texture; y?: number }) {
  return <Box m={m} at={[x, 0.05 + y / 2, z]} s={[w, 0.02 + y, d]} c={c} t={t} shadow={false} />
}

function Prop({ parts, at, ry = 0, s = 1, human }: { parts: ReturnType<typeof prop>; at: V3; ry?: number; s?: number; human?: boolean }) {
  return (
    <group position={at} rotation-y={ry} scale={s} userData={human ? PEOPLE_SIZED : undefined}>
      <PropMesh parts={parts} />
    </group>
  )
}

// A gas lamp post (the town's Victorian lantern, shrunk to garden size) with
// its pool of light; the arm points along -x turned by ry.
function GasLamp({ k, at, ry = 0 }: { k: Kit; at: V3; ry?: number }) {
  return (
    <group position={at}>
      <group rotation-y={Math.PI + ry} scale={0.55}><PropMesh parts={DECOR_PROPS.lamp()} /></group>
      {!k.ghost && <Pool r={0.45} x={-Math.cos(ry) * 0.22} z={Math.sin(ry) * 0.22} y={0.03} />}
    </group>
  )
}

function Car({ at, ry, body, color }: { at: V3; ry: number; body: 'sedan' | 'wagon' | 'luxury' | 'sports' | 'suv' | 'classic'; color: string }) {
  return (
    <group position={at}>
      <Upright size={1}>
        <group rotation-y={ry}>
          <CarModel body={body} color={color} />
        </group>
      </Upright>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Painted Lady.

const VIC = { trim: '#fffde7', acc: '#26a69a', deck: '#90a4ae', found: '#8d8f91' }

function PaintedLady({ k, def, lvl }: { k: Kit; def: BuildingDef; lvl: number }) {
  const { m, ghost } = k
  const st = growthStage(lvl)
  const wall = def.color, roof = def.roof
  const F = 0.78
  const floors = st === 1 ? 2 : 3
  const H = st === 1 ? 2 * F : 2 * F + 0.66
  const W = 1.2, D = 0.9, cx = -0.1, cz = -0.32
  const zf = cz + D / 2, xr = cx + W / 2, xl = cx - W / 2, zb = cz - D / 2
  const rise = 0.62
  const fish = shade(wall, -0.06)
  const ys = Array.from({ length: floors }, (_, i) => i * F + (i === 2 ? 0.34 : 0.43))
  // Turret on the front right corner.
  const tx = xr, tz = zf, tr = 0.27
  const Ht = H + 0.66
  const tAngles = [0, 0.8, 1.6]
  // Bay window on the front left, up two floors.
  const bx = -0.42, bw = 0.5, bp = 0.17, bh = 2 * F - 0.04
  const doorX = 0.04
  const gold = lvl >= 6
  return (
    <group>
      {!ghost && <Lawn m={m} w={1.9} d={1.9} />}
      {/* The house: siding walls on a stone foundation, a trim band at each floor. */}
      <Box m={m} at={[cx, H / 2, cz]} s={[W, H, D]} c={wall} t={sidingTex(1.5, H * 1.6)} />
      <Box m={m} at={[cx, 0.055, cz]} s={[W + 0.03, 0.11, D + 0.03]} c={VIC.found} shadow={false} />
      {Array.from({ length: floors - 1 }, (_, i) => <Box key={i} m={m} at={[cx, F * (i + 1), cz]} s={[W + 0.02, 0.04, D + 0.02]} c={VIC.trim} shadow={false} />)}
      <Box m={m} at={[cx, H - 0.04, cz]} s={[W + 0.04, 0.07, D + 0.04]} c={VIC.trim} shadow={false} />
      <Gable m={m} at={[cx, H, cz]} w={W + 0.04} d={D + 0.02} h={rise} wall={fish} wt={shingleTex(3, 2)} roof={roof} rt={shingleTex(3, 3)} over={0.09} side={0.08} />
      {[1, -1].map((sd) => (
        <group key={sd} position={[cx, H, cz + sd * ((D + 0.02) / 2 + 0.014)]} rotation-y={sd > 0 ? 0 : Math.PI}>
          <PropMesh parts={gableTrim(W + 0.04, rise, VIC.trim, VIC.acc)} />
        </group>
      ))}
      {/* Round window up in the gable. */}
      <Cyl m={m} at={[cx, H + 0.17, zf + 0.012]} r={0.12} h={0.02} c={VIC.trim} seg={16} rot={[Math.PI / 2, 0, 0]} />
      <mesh position={[cx, H + 0.17, zf + 0.024]}><circleGeometry args={[0.09, 16]} />{lvl >= 6 ? m('#ce93d8') : k.win}</mesh>
      {lvl >= 3 && !ghost && <group position={[cx, H + rise + 0.06, cz]} rotation-y={Math.PI / 2}><PropMesh parts={cresting(D + 0.1)} /></group>}
      {/* Chimney through the left slope. */}
      <Box m={m} at={[cx - 0.36, H + 0.38, cz - 0.22]} s={[0.17, 0.9, 0.17]} c="#a1665e" />
      <Box m={m} at={[cx - 0.36, H + 0.85, cz - 0.22]} s={[0.22, 0.05, 0.22]} c="#5d4037" />

      {/* The turret: a round tower with trim rings, windows on every floor and a witch's-hat roof. */}
      <mesh position={[tx, Ht / 2, tz]} castShadow receiveShadow>
        <cylinderGeometry args={[tr, tr, Ht, 12]} />
        {m(wall, sidingTex(2, Ht * 1.6))}
      </mesh>
      <Cyl m={m} at={[tx, 0.055, tz]} r={tr + 0.02} h={0.11} c={VIC.found} seg={12} />
      {Array.from({ length: floors }, (_, i) => i + 1).map((i) => (
        <Cyl key={i} m={m} at={[tx, i === floors ? Ht - 0.045 : F * i, tz]} r={tr + 0.02} h={i === floors ? 0.08 : 0.04} c={i === floors ? VIC.acc : VIC.trim} seg={12} />
      ))}
      <Cyl m={m} at={[tx, H - 0.04, tz]} r={tr + 0.02} h={0.07} c={VIC.trim} seg={12} />
      <Wins k={k} sill={false} list={[
        ...ys.flatMap((y) => tAngles.map((a): WSpec => [tx + Math.sin(a) * (tr - 0.005), y, tz + Math.cos(a) * (tr - 0.005), a, 0.15, y > 2 * F ? 0.3 : 0.36])),
        ...tAngles.map((a): WSpec => [tx + Math.sin(a) * (tr - 0.005), H + 0.3, tz + Math.cos(a) * (tr - 0.005), a, 0.12, 0.22]),
      ]} />
      <mesh position={[tx, Ht + 0.48, tz]} castShadow>
        <coneGeometry args={[tr + 0.08, 0.96, 12]} />
        {m(roof, shingleTex(3, 2))}
      </mesh>
      <Cyl m={m} at={[tx, Ht + 1.04, tz]} r={0.012} h={0.26} c={gold ? GOLD : VIC.trim} seg={5} />
      <Ball m={m} at={[tx, Ht + 1.04, tz]} r={0.035} c={gold ? GOLD : VIC.acc} />

      {/* Two-storey bay window. */}
      <Box m={m} at={[bx, bh / 2, zf + bp / 2]} s={[bw, bh, bp]} c={wall} t={sidingTex(0.6, bh * 1.6)} />
      <Box m={m} at={[bx, 0.06, zf + bp / 2 + 0.01]} s={[bw + 0.03, 0.12, bp + 0.02]} c={VIC.found} shadow={false} />
      <Box m={m} at={[bx, bh + 0.025, zf + bp / 2 + 0.015]} s={[bw + 0.07, 0.05, bp + 0.06]} c={roof} />
      <Box m={m} at={[bx, F, zf + bp / 2 + 0.005]} s={[bw + 0.02, 0.04, bp + 0.01]} c={VIC.trim} shadow={false} />
      <Panes k={k} list={[0.44, F + 0.4].flatMap((y) => [-1, 1].map((sd): WSpec => [bx + sd * (bw / 2 + 0.006), y, zf + bp / 2, (sd * Math.PI) / 2, 0.1, 0.36]))} />
      <Panes k={k} list={[
        ...ys.flatMap((y) => [-0.5, -0.1].map((z): WSpec => [xl - 0.006, y, z, -Math.PI / 2, 0.2, 0.36])),
        ...ys.flatMap((y) => [-0.45, 0.15].map((x): WSpec => [x, y, zb - 0.006, Math.PI, 0.22, 0.36])),
      ]} />
      {!ghost && lvl >= 2 && <group position={[bx, F + 0.1, zf + bp]}><PropMesh parts={windowBox(0.36)} /></group>}

      {/* Front door, the window over it, and the third floor. */}
      <Door k={k} at={[doorX, 0.12, zf]} w={0.26} h={0.58} c={roof} frame={VIC.trim} />
      {/* (Three sets of frames, so the way up to the door stays clear between them.) */}
      <Wins k={k} frame={VIC.trim} list={[[bx, 0.44, zf + bp, 0, 0.3, 0.38], [bx, F + 0.4, zf + bp, 0, 0.3, 0.38]]} />
      <Wins k={k} frame={VIC.trim} list={[
        [doorX, F + 0.42, zf, 0, 0.22, 0.4],
        ...(floors === 3 ? [bx, doorX].map((x): WSpec => [x, ys[2], zf, 0, 0.22, 0.32]) : []),
      ]} />
      <Wins k={k} frame={VIC.trim} list={ys.flatMap((y) => [-0.6, -0.32].map((z): WSpec => [xr, y, cz + z + 0.32, Math.PI / 2, 0.2, y > 2 * F ? 0.3 : 0.38]))} />
      {/* Side windows (the right side shows), plain panes round the back. */}
      {st === 2 && lvl >= 5 && <Dormer k={k} at={[cx + 0.38, H, cz - 0.15]} roof={roof} wall={wall} />}

      <Porch k={k} lvl={lvl} st={st} zf={zf} xr={xr} roof={roof} F={F} />
      {!ghost && <VicYard k={k} lvl={lvl} st={st} zf={zf} doorX={doorX} bx={bx} />}
    </group>
  )
}

// A gabled dormer on the right roof slope, facing +x.
function Dormer({ k, at, roof, wall }: { k: Kit; at: V3; roof: string; wall: string }) {
  const { m } = k
  return (
    <group position={at}>
      <Box m={m} at={[0, 0.22, 0]} s={[0.36, 0.44, 0.34]} c={wall} t={sidingTex(0.4, 0.7)} />
      <Gable m={m} at={[0.02, 0.44, 0]} w={0.34} d={0.4} h={0.2} wall={wall} roof={roof} rt={shingleTex(1, 1)} over={0.05} side={0.04} ry={Math.PI / 2} />
      <Wins k={k} frame={VIC.trim} sill={false} list={[[0.18, 0.24, 0, Math.PI / 2, 0.16, 0.22]]} />
    </group>
  )
}

// The wraparound porch: deck, turned posts with fan brackets, spindle rails,
// a gingerbread frieze under the roof; a balcony on top from level 4.
function Porch({ k, lvl, st, zf, xr, roof, F }: { k: Kit; lvl: number; st: number; zf: number; xr: number; roof: string; F: number }) {
  const { m, ghost, bulb } = k
  const x0 = -0.15, x1 = 0.88, z1 = 0.55, zs = -0.62
  const deck = 0.12
  const top = F
  // The front posts stand clear either side of the steps up to the door.
  const px = 0.22
  const posts: [number, number][] = [[x0 + 0.01, z1 - 0.03], [px, z1 - 0.03], [x1 - 0.03, z1 - 0.03], [x1 - 0.03, (z1 + zs) / 2 - 0.05], [x1 - 0.03, zs + 0.03]]
  const fl = x1 - 0.03 - px
  const sl = z1 - zs - 0.06
  return (
    <group>
      <Box m={m} at={[(x0 + x1) / 2, deck / 2, (zf + z1) / 2]} s={[x1 - x0, deck, z1 - zf]} c={VIC.deck} />
      <Box m={m} at={[(xr + x1) / 2, deck / 2 - 0.003, (zs + zf) / 2]} s={[x1 - xr, deck - 0.006, zf - zs]} c={VIC.deck} />
      {/* Steps down to the path. */}
      <Box m={m} at={[0.04, 0.04, z1 + 0.06]} s={[0.34, 0.08, 0.12]} c={VIC.deck} shadow={false} />
      <Box m={m} at={[0.04, 0.025, z1 + 0.17]} s={[0.34, 0.05, 0.1]} c={VIC.deck} shadow={false} />
      {posts.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <Box m={m} at={[x, deck + (top - deck) / 2, z]} s={[0.05, top - deck, 0.05]} c={VIC.trim} />
          <group position={[x, top - 0.02, z]}><PropMesh parts={brackets(VIC.trim)} /></group>
        </group>
      ))}
      <Box m={m} at={[(x0 + x1) / 2, top + 0.045, (zf + z1) / 2 + 0.01]} rot={[0.1, 0, 0]} s={[x1 - x0 + 0.06, 0.05, z1 - zf + 0.08]} c={roof} t={shingleTex(2, 1)} />
      <Box m={m} at={[(xr + x1) / 2 + 0.015, top + 0.051, (zs + zf) / 2 - 0.01]} rot={[0, 0, -0.1]} s={[x1 - xr + 0.03, 0.05, zf - zs + 0.06]} c={roof} t={shingleTex(1, 2)} />
      <group position={[(x0 + x1) / 2, top - 0.02, z1 - 0.03]}><PropMesh parts={frieze(x1 - x0 - 0.06, VIC.trim)} /></group>
      <group position={[x1 - 0.03, top - 0.02, (z1 + zs) / 2]} rotation-y={Math.PI / 2}><PropMesh parts={frieze(sl, VIC.trim)} /></group>
      <group position={[px + fl / 2, deck, z1 - 0.03]}><PropMesh parts={spindleRail(fl - 0.05, VIC.trim)} /></group>
      <group position={[x1 - 0.03, deck, (z1 + zs) / 2]} rotation-y={Math.PI / 2}><PropMesh parts={spindleRail(sl - 0.05, VIC.trim)} /></group>
      {/* Porch light by the door and a lantern hung from the ceiling. */}
      <mesh position={[-0.13, 0.52, zf + 0.03]}><boxGeometry args={[0.06, 0.09, 0.05]} />{bulb}</mesh>
      <mesh position={[0.62, top - 0.08, 0.34]}><sphereGeometry args={[0.04, 8, 6]} />{bulb}</mesh>
      <Cyl m={m} at={[0.62, top - 0.025, 0.34]} r={0.006} h={0.05} c="#263238" seg={4} />
      {!ghost && <Pool r={0.55} x={0.3} z={0.75} />}
      {!ghost && lvl >= 2 && <group position={[x1 - 0.12, deck, -0.3]} rotation-y={-Math.PI / 2}><PropMesh parts={swing(top - deck, '#fafafa')} /></group>}
      {st === 2 && (
        <group>
          {/* Upstairs balcony on the porch roof. */}
          <group position={[(x0 + x1) / 2 + 0.01, top + 0.05, z1 + 0.01]}><PropMesh parts={spindleRail(x1 - x0 - 0.02, VIC.trim)} /></group>
          <group position={[x1 + 0.005, top + 0.056, (zs + zf) / 2 + 0.02]} rotation-y={Math.PI / 2}><PropMesh parts={spindleRail(zf - zs + 0.02, VIC.trim)} /></group>
          {!ghost && <Prop parts={DECOR_PROPS.flowers()} at={[0.5, top + 0.05, 0.3]} s={0.14} />}
        </group>
      )}
    </group>
  )
}

function VicYard({ k, lvl, st, zf, doorX, bx }: { k: Kit; lvl: number; st: number; zf: number; doorX: number; bx: number }) {
  const { m } = k
  const gx = doorX
  return (
    <group>
      <Pave m={m} x={gx} z={0.9} w={0.3} d={0.2} c="#ffffff" t={paverTex(0.4, 0.3)} />
      {st === 1 ? (
        <group>
          <Prop parts={picket(0.76, '#fafafa')} at={[(-0.93 + gx - 0.17) / 2, 0.04, 0.9]} />
          <Prop parts={picket(0.93 - gx - 0.17, '#fafafa')} at={[(0.93 + gx + 0.17) / 2, 0.04, 0.9]} />
        </group>
      ) : (
        <group>
          {[-1, 1].map((sd) => {
            const a = gx + sd * 0.23
            const b = sd * 0.93
            const len = Math.abs(b - a) - 0.08
            return (
              <group key={sd}>
                <Prop parts={ironFence(len, 0.3, 'iron')} at={[(a + b) / 2 + sd * 0.04 - sd * 0.04, 0.04, 0.9]} />
                <Box m={m} at={[a, 0.24, 0.9]} s={[0.1, 0.4, 0.1]} c="#a1665e" />
                <Box m={m} at={[a, 0.46, 0.9]} s={[0.13, 0.04, 0.13]} c={STONE} />
              </group>
            )
          })}
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <mesh position={[gx + sd * 0.23, 0.53, 0.9]}><boxGeometry args={[0.07, 0.1, 0.07]} />{k.bulb}</mesh>
              <mesh position={[gx + sd * 0.23, 0.615, 0.9]}><coneGeometry args={[0.065, 0.07, 4]} />{m(lvl >= 6 ? GOLD : '#263238')}</mesh>
            </group>
          ))}
        </group>
      )}
      {lvl >= 3 && <RoseArch at={[gx, 0.04, 0.9]} w={0.42} />}
      <Prop parts={mailbox()} at={[gx + 0.3, 0.04, 0.8]} ry={0} human />
      <GasLamp k={k} at={[-0.46, 0.04, 0.78]} ry={Math.PI} />
      <Prop parts={tree()} at={[-0.68, 0.04, 0.6]} />
      <Prop parts={shrub()} at={[-0.82, 0.04, -0.1]} />
      <Prop parts={shrub()} at={[0.85, 0.04, -0.82]} />
      {lvl >= 2 && <Prop parts={flowerBed(0.46)} at={[bx, 0.04, zf + 0.29]} />}
      {lvl >= 2 && <Prop parts={flowerBed(0.5)} at={[0.6, 0.04, 0.66]} />}
      {lvl >= 3 && <Prop parts={birdbath()} at={[-0.82, 0.04, 0.1]} s={0.8} />}
      {st === 2 && lvl >= 5 && <Prop parts={DECOR_PROPS.bench('#8d6e63')} at={[-0.62, 0.04, -0.82]} s={0.42} human />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Victorian Terrace: a row of narrow painted ladies, each in its own trims.

const LADIES = [
  { h: 0.07, l: 0.06, trim: '#fffde7', acc: '#00897b', door: '#00695c' },
  { h: 0, l: -0.05, trim: '#ffffff', acc: '#ad1457', door: '#880e4f' },
  { h: -0.08, l: 0.1, trim: '#fff59d', acc: '#283593', door: '#1a237e' },
]
// The player's wall colour turned a little round the colour wheel, so each lady differs.
const tint = (c: string, h: number, l: number) => `#${new Color(c).offsetHSL(h, 0, l).getHexString()}`

function RowHouse({ k, x, lvl, wall, roof, trim, acc, door, end }: { k: Kit; x: number; lvl: number; wall: string; roof: string; trim: string; acc: string; door: string; end: number }) {
  const { m, bulb, ghost } = k
  const W = 0.58, D = 1.0, cz = -0.35, zf = cz + D / 2
  const F = 0.7
  const H = 3 * F + 0.05 * (lvl - 7)
  const rise = 0.44
  const bx = -0.13, bw = 0.24, bp = 0.15
  const dx = 0.17
  const fy = [0.48, F + 0.4, 2 * F + 0.36]
  return (
    <group position={[x, 0, 0]}>
      <Box m={m} at={[0, H / 2, cz]} s={[W, H, D]} c={wall} t={sidingTex(0.8, H * 1.6)} />
      <Box m={m} at={[0, 0.07, cz]} s={[W + 0.02, 0.14, D + 0.02]} c={VIC.found} shadow={false} />
      {[F, 2 * F].map((y) => <Box key={y} m={m} at={[0, y, cz]} s={[W + 0.01, 0.035, D + 0.01]} c={trim} shadow={false} />)}
      <Box m={m} at={[0, H - 0.045, cz]} s={[W + 0.02, 0.08, D + 0.03]} c={trim} shadow={false} />
      <Gable m={m} at={[0, H, cz]} w={W + 0.02} d={D + 0.01} h={rise} wall={shade(wall, -0.06)} wt={shingleTex(2, 2)} roof={roof} rt={shingleTex(2, 3)} over={0.04} side={0.07} />
      <group position={[0, H, zf + 0.025]}><PropMesh parts={gableTrim(W + 0.02, rise, trim, acc)} /></group>
      <Cyl m={m} at={[0, H + 0.12, zf + 0.012]} r={0.085} h={0.02} c={trim} seg={14} rot={[Math.PI / 2, 0, 0]} />
      <mesh position={[0, H + 0.12, zf + 0.024]}><circleGeometry args={[0.06, 14]} />{k.win}</mesh>
      {lvl >= 9 && <Ball m={m} at={[0, H + rise + 0.1, zf + 0.04]} r={0.035} c={GOLD} />}
      {lvl >= 9 && <Cyl m={m} at={[0, H + rise + 0.05, zf + 0.04]} r={0.01} h={0.08} c={GOLD} seg={5} />}
      {/* Two-storey bay on the left, the door up one step on the right. */}
      <Box m={m} at={[bx, F, zf + bp / 2]} s={[bw, 2 * F, bp]} c={wall} t={sidingTex(0.4, 2 * F * 1.6)} />
      <Box m={m} at={[bx, 2 * F - 0.02, zf + bp / 2 + 0.006]} s={[bw + 0.03, 0.05, bp + 0.02]} c={trim} shadow={false} />
      <Box m={m} at={[bx, 2 * F + 0.02, zf + bp / 2 + 0.012]} s={[bw + 0.05, 0.04, bp + 0.04]} c={roof} />
      <Box m={m} at={[bx, F, zf + bp / 2 + 0.004]} s={[bw + 0.02, 0.03, bp + 0.01]} c={acc} shadow={false} />
      <Wins k={k} frame={trim} sill={false} list={[[bx, fy[0], zf + bp, 0, 0.16, 0.36], [bx, fy[1], zf + bp, 0, 0.16, 0.36]]} />
      <Wins k={k} frame={trim} sill={false} list={[
        [dx, fy[1], zf, 0, 0.16, 0.36],
        ...[-0.13, 0.14].map((wx): WSpec => [wx, fy[2], zf, 0, 0.16, 0.32]),
        ...(end !== 0 ? fy.map((y): WSpec => [(end * W) / 2, y, cz - 0.1, (end * Math.PI) / 2, 0.18, 0.3]) : []),
      ]} />
      <Box m={m} at={[dx, 0.04, zf + 0.06]} s={[0.24, 0.08, 0.12]} c={STONE} shadow={false} />
      <Door k={k} at={[dx, 0.08, zf]} w={0.17} h={0.6} c={door} frame={trim} />
      <Box m={m} at={[dx, 0.75, zf + 0.06]} s={[0.26, 0.03, 0.12]} c={acc} />
      <mesh position={[dx + 0.12, 0.55, zf + 0.025]}><boxGeometry args={[0.04, 0.06, 0.04]} />{bulb}</mesh>
      <Panes k={k} list={fy.map((y): WSpec => [0, y, cz - D / 2 - 0.006, Math.PI, 0.2, 0.32])} />
      {!ghost && lvl >= 8 && (
        <group>
          <group position={[bx, F + 0.17, zf + bp]}><PropMesh parts={windowBox(0.24)} /></group>
          {[-0.13, 0.14].map((wx) => <group key={wx} position={[wx, 2 * F + 0.15, zf]}><PropMesh parts={windowBox(0.2)} /></group>)}
        </group>
      )}
    </group>
  )
}

function Terrace({ k, def, lvl }: { k: Kit; def: BuildingDef; lvl: number }) {
  const { m, ghost } = k
  const xs = [-0.62, 0, 0.62]
  return (
    <group>
      {!ghost && <Lawn m={m} w={1.9} d={1.9} />}
      {xs.map((x, i) => (
        <RowHouse key={x} k={k} x={x} lvl={lvl} wall={tint(def.color, LADIES[i].h, LADIES[i].l)} end={i === 0 ? -1 : i === 2 ? 1 : 0} roof={def.roof} trim={LADIES[i].trim} acc={LADIES[i].acc} door={LADIES[i].door} />
      ))}
      {!ghost && (
        <group>
          {/* A brick sidewalk along the front, a path to each door, little front gardens. */}
          <Pave m={m} x={0} z={0.82} w={1.9} d={0.26} t={paverTex(2.4, 0.3)} />
          {xs.map((x) => <Pave key={x} m={m} x={x + 0.17} z={0.53} w={0.2} d={0.32} t={paverTex(0.3, 0.4)} />)}
          {xs.map((x) => <Prop key={x} parts={shrub()} at={[x - 0.12, 0.04, 0.42]} s={0.8} />)}
          {lvl >= 8 && [-0.14, 0.48].map((x) => <GasLamp key={x} k={k} at={[x, 0.06, 0.82]} ry={-Math.PI / 2} />)}
          {lvl >= 9 && xs.map((x) => <Prop key={x} parts={flowerBed(0.22)} at={[x - 0.1, 0.04, 0.6]} />)}
          {lvl >= 10 && xs.map((x) => (
            <Prop key={x} parts={ironFence(0.3, 0.16, 'gold')} at={[x - 0.135, 0.04, 0.68]} />
          ))}
          {lvl >= 10 && <Bulbs from={[-0.96, 0.95, 0.66]} to={[0.96, 0.95, 0.66]} n={8} sag={0.06} posts={0.91} />}
        </group>
      )}
    </group>
  )
}

function Victorian({ k, def, lvl }: { k: Kit; def: BuildingDef; lvl: number }) {
  return (
    <PerLot step={2}>
      {growthStage(lvl) === 3 ? <Terrace k={k} def={def} lvl={lvl} /> : <PaintedLady k={k} def={def} lvl={lvl} />}
    </PerLot>
  )
}

// ---------------------------------------------------------------------------
// Hillcrest Villa.

const VIL = { trim: '#fff3e0', shutter: '#558b2f', court: '#ffe0b2', tile: '#d7a07a' }

function Villa({ k, def, lvl }: { k: Kit; def: BuildingDef; lvl: number }) {
  return (
    <PerLot step={4}>
      <VillaLot k={k} def={def} lvl={lvl} />
    </PerLot>
  )
}

function VillaLot({ k, def, lvl }: { k: Kit; def: BuildingDef; lvl: number }) {
  const { m, ghost, bulb } = k
  const st = growthStage(lvl)
  const wall = def.color, roof = def.roof
  const tile = shingleTex(4, 3)
  const F = 0.8
  const floors = st === 3 ? 3 : 2
  const H = floors * F
  const W = 2.2, D = 1.3, cx = -0.65, cz = -1.25
  const zf = cz + D / 2, xr = cx + W / 2
  // The front door at the head of the drive, then the loggia across the rest of the ground floor.
  const doorX = -1.5
  const lz = zf + 0.42, lx0 = -1.17, lx1 = 0.3, llen = lx1 - lx0, lcx = (lx0 + lx1) / 2
  const bays = 3, bay = llen / bays
  const bayX = Array.from({ length: bays }, (_, i) => lx0 + bay * (i + 0.5))
  const upX = [-1.38, -0.88, -0.4, 0.08]
  const winY = (f: number) => f * F + 0.36
  // Bell tower at the back left (from level 4), a guest wing on the right.
  const tower = st >= 2
  const TH = H + 0.9
  const wingH = st === 3 ? 1.6 : 0.85
  // Pool.
  const px = 1.4, pz = 0.3, pw = 0.62, pd = 1.8
  return (
    <group>
      {!ghost && <Lawn m={m} w={3.9} d={3.9} />}
      {/* Main house: stucco walls, a cornice and a hipped roof of terracotta tiles. */}
      <Box m={m} at={[cx, H / 2, cz]} s={[W, H, D]} c={wall} />
      <Box m={m} at={[cx, 0.06, cz]} s={[W + 0.03, 0.12, D + 0.03]} c={shade(wall, -0.1)} shadow={false} />
      {floors === 3 && <Box m={m} at={[cx, 2 * F, cz]} s={[W + 0.02, 0.04, D + 0.02]} c={VIL.trim} shadow={false} />}
      <Box m={m} at={[cx, H + 0.04, cz]} s={[W + 0.12, 0.08, D + 0.12]} c={VIL.trim} />
      <Hip m={m} at={[cx, H + 0.08, cz]} w={W + 0.3} d={D + 0.24} h={0.55} c={roof} t={tile} />
      <Box m={m} at={[cx - 0.55, H + 0.5, cz - 0.3]} s={[0.2, 0.7, 0.2]} c={wall} />
      <Hip m={m} at={[cx - 0.55, H + 0.85, cz - 0.3]} w={0.3} d={0.3} h={0.12} c={roof} />

      {/* Loggia: an arcade of round arches, a tiled floor, a terrace with a balustrade on top. */}
      <mesh geometry={arcadeGeo(llen, F, bays, 0.36, 0.45, 0.1)} position={[lcx, 0, lz - 0.05]} castShadow receiveShadow>{m(wall)}</mesh>
      {[lx0 + 0.05, lx1 - 0.05].map((x) => <Box key={x} m={m} at={[x, F / 2, (zf + lz - 0.1) / 2]} s={[0.1, F, lz - 0.1 - zf]} c={wall} />)}
      <Box m={m} at={[lcx, 0.06, (zf + lz) / 2]} s={[llen - 0.2, 0.02, lz - zf - 0.1]} c={VIL.tile} t={paverTex(4, 1)} shadow={false} />
      <Box m={m} at={[lcx, F + 0.03, (zf + lz) / 2 + 0.01]} s={[llen + 0.04, 0.06, lz - zf + 0.04]} c={VIL.trim} />
      <group position={[lcx, F + 0.06, lz - 0.01]}><PropMesh parts={balustrade(llen - 0.04, VIL.trim)} /></group>
      <Panes k={k} list={[
        ...bayX.map((x): WSpec => [x, 0.36, zf + 0.006, 0, 0.24, 0.52]),
        ...Array.from({ length: floors }, (_, f) => [-1.4, -0.7, 0.0].map((x): WSpec => [x, winY(f), cz - D / 2 - 0.006, Math.PI, 0.2, 0.36])).flat(),
        ...Array.from({ length: floors }, (_, f): WSpec => [cx - W / 2 - 0.006, winY(f), cz + 0.2, -Math.PI / 2, 0.2, 0.36]),
      ]} />
      {bayX.slice(0, -1).map((x, i) => (
        <mesh key={i} position={[x + bay / 2, 0.62, lz + 0.03]}><boxGeometry args={[0.05, 0.08, 0.05]} />{bulb}</mesh>
      ))}
      {/* Front door on a stone step, a lamp beside it. */}
      <Box m={m} at={[doorX, 0.03, zf + 0.06]} s={[0.36, 0.06, 0.12]} c={VIL.court} shadow={false} />
      <Door k={k} at={[doorX, 0.06, zf]} w={0.26} h={0.56} c="#6d4c41" frame={VIL.trim} fan />
      <mesh position={[doorX + 0.22, 0.6, zf + 0.03]}><boxGeometry args={[0.05, 0.08, 0.05]} />{bulb}</mesh>
      {/* Upstairs: French windows to the terrace with green shutters, and the floor above. */}
      <Wins k={k} arch sill={false} frame={VIL.trim} shutters={VIL.shutter} list={[
        ...upX.map((x): WSpec => [x, winY(1) - 0.04, zf, 0, 0.2, 0.36]),
        ...(floors === 3 ? upX.map((x): WSpec => [x, winY(2) - 0.04, zf, 0, 0.2, 0.32]) : []),
        ...Array.from({ length: floors }, (_, f) => [-1.6, -1.0].map((z): WSpec => [xr, winY(f) - 0.04, z, Math.PI / 2, 0.2, 0.34])).flat(),
      ]} />
      {floors === 3 && lvl >= 8 && !ghost && upX.map((x) => (
        <group key={x} position={[x, 2 * F + 0.04, zf]}>
          <Box m={m} at={[0, 0, 0.09]} s={[0.36, 0.04, 0.18]} c={VIL.trim} />
          <group position={[0, 0.02, 0.17]}><PropMesh parts={ironFence(0.34, 0.16, 'none')} /></group>
        </group>
      ))}

      {tower && (
        <group position={[-1.45, 0, -1.6]}>
          <Box m={m} at={[0, TH / 2, 0]} s={[0.56, TH, 0.56]} c={wall} />
          <Box m={m} at={[0, TH - 0.5, 0]} s={[0.6, 0.04, 0.6]} c={VIL.trim} shadow={false} />
          <Box m={m} at={[0, TH + 0.03, 0]} s={[0.66, 0.06, 0.66]} c={VIL.trim} />
          <Hip m={m} at={[0, TH + 0.06, 0]} w={0.74} d={0.74} h={0.36} c={roof} t={shingleTex(1.5, 1.5)} />
          {/* Belvedere: two arched openings a side at the top. */}
          <mesh geometry={glassGeo([0, Math.PI / 2, Math.PI, -Math.PI / 2].flatMap((a) => [-0.11, 0.11].map((o): WSpec => [o * Math.cos(a) + 0.286 * Math.sin(a), TH - 0.3, -o * Math.sin(a) + 0.286 * Math.cos(a), a, 0.14, 0.2])), true, 0)}>{m('#3e2723')}</mesh>
          {lvl >= 10 && <Cyl m={m} at={[0, TH + 0.5, 0]} r={0.012} h={0.2} c={GOLD} seg={5} />}
          {lvl >= 10 && <Ball m={m} at={[0, TH + 0.6, 0]} r={0.04} c={GOLD} />}
        </group>
      )}
      {tower && (
        <group position={[1.0, 0, -1.5]}>
          <Box m={m} at={[0, wingH / 2, 0]} s={[1.1, wingH, 0.8]} c={wall} />
          <Box m={m} at={[0, wingH + 0.03, 0]} s={[1.18, 0.06, 0.88]} c={VIL.trim} />
          <Hip m={m} at={[0, wingH + 0.06, 0]} w={1.26} d={0.96} h={0.34} c={roof} t={shingleTex(2, 2)} />
          <Door k={k} at={[-0.22, 0, 0.4]} w={0.24} h={0.5} c="#6d4c41" frame={VIL.trim} fan side />
          <Wins k={k} arch sill={false} frame={VIL.trim} shutters={VIL.shutter} list={[[0.22, 0.36, 0.4, 0, 0.2, 0.32], ...(st === 3 ? [-0.22, 0.22].map((x): WSpec => [x, F + 0.32, 0.4, 0, 0.2, 0.3]) : [])]} />
          <mesh position={[-0.22, 0.6, 0.43]}><boxGeometry args={[0.05, 0.08, 0.05]} />{bulb}</mesh>
        </group>
      )}

      {/* Courtyard paving, the gravel drive and the pool deck. */}
      {!ghost && (
        <group>
          <Pave m={m} x={-0.3} z={0.35} w={1.7} d={1.9} c={VIL.court} t={paverTex(2.2, 2.4)} />
          <Pave m={m} x={-1.5} z={0.9} w={0.66} d={2.1} c="#ffffff" t={gravelTex(1, 3)} />
          {/* Deck round the pool, in four strips. */}
          <Pave m={m} x={0.62 + (px - pw / 2 - 0.62) / 2} z={0.3} w={px - pw / 2 - 0.62} d={2.6} c={VIL.court} t={paverTex(0.6, 3)} />
          <Pave m={m} x={(px + pw / 2 + 1.92) / 2} z={0.3} w={1.92 - px - pw / 2} d={2.6} c={VIL.court} t={paverTex(0.3, 3)} />
          <Pave m={m} x={px} z={(pz - pd / 2 - 1.0) / 2} w={pw} d={pz - pd / 2 + 1.0} c={VIL.court} t={paverTex(0.8, 0.4)} />
          <Pave m={m} x={px} z={(pz + pd / 2 + 1.6) / 2} w={pw} d={1.6 - pz - pd / 2} c={VIL.court} t={paverTex(0.8, 0.4)} />
          <Box m={m} at={[px, 0.045, pz]} s={[pw, 0.01, pd]} c={WATER} t={waterTex('villa', 0.5, 1.4)} shadow={false} />
          <mesh position={[px, 0.052, pz]} rotation-x={-Math.PI / 2} renderOrder={2}>
            <planeGeometry args={[pw, pd]} />
            <primitive object={glowMats.poolWater} attach="material" dispose={null} />
          </mesh>
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[px, 0.07, pz + sd * (pd / 2 + 0.025)]} s={[pw + 0.1, 0.02, 0.05]} c="#fafafa" shadow={false} />)}
          {[-1, 1].map((sd) => <Box key={sd} m={m} at={[px + sd * (pw / 2 + 0.025), 0.07, pz]} s={[0.05, 0.02, pd]} c="#fafafa" shadow={false} />)}
          <Pool r={0.6} x={px} z={pz - 0.4} />
          <Pool r={0.6} x={px} z={pz + 0.5} />
        </group>
      )}
      {!ghost && <VillaYard k={k} lvl={lvl} st={st} px={px} pz={pz} pw={pw} pd={pd} />}
      {/* Front wall in stucco with a tiled cap, and the gate posts. */}
      <Box m={m} at={[(-1.12 + 1.92) / 2, 0.2, 1.86]} s={[1.92 + 1.12, 0.32, 0.1]} c={wall} />
      <Box m={m} at={[(-1.12 + 1.92) / 2, 0.38, 1.86]} s={[1.92 + 1.12 + 0.02, 0.04, 0.14]} c={roof} />
      {[-1.87, -1.13].map((x) => (
        <group key={x}>
          <Box m={m} at={[x, 0.32, 1.86]} s={[0.16, 0.56, 0.16]} c={wall} />
          <Box m={m} at={[x, 0.62, 1.86]} s={[0.18, 0.04, 0.18]} c={roof} />
          <mesh position={[x, 0.7, 1.86]}><boxGeometry args={[0.08, 0.1, 0.08]} />{bulb}</mesh>
          <Box m={m} at={[x, 0.77, 1.86]} s={[0.11, 0.03, 0.11]} c="#263238" shadow={false} />
        </group>
      ))}
      {!ghost && <OpenGates w={0.6} h={0.4} crest={false} at={[-1.5, 0.04, 1.86]} />}
      {!ghost && <Pool r={0.5} x={-1.5} z={1.6} />}
    </group>
  )
}

function VillaYard({ k, lvl, st, px, pz, pw, pd }: { k: Kit; lvl: number; st: number; px: number; pz: number; pw: number; pd: number }) {
  const lx = px - pw / 2 - 0.22
  return (
    <group>
      <Prop parts={fountain(st === 3 && lvl >= 10 ? 3 : 2, false)} at={[0, 0.06, 0.5]} />
      {/* The car parks on the court beside the drive, leaving the way to the door clear. */}
      <Car at={[-0.92, 0.06, 0.64]} ry={Math.PI} body={st === 3 ? 'luxury' : 'sedan'} color={st === 1 ? '#f5f5f5' : '#455a64'} />
      {/* Loungers and an umbrella down the pool side. */}
      <Prop parts={lounger('#4fc3f7')} at={[lx, 0.06, pz - 0.45]} human />
      <Prop parts={lounger('#4fc3f7')} at={[lx, 0.06, pz + 0.35]} human />
      {lvl < 5 && <Prop parts={umbrella('#ff7043')} at={[lx, 0.06, pz - 0.05]} human />}
      {lvl >= 2 && <Prop parts={lounger('#ff8a65')} at={[lx, 0.06, pz + 0.85]} human />}
      {lvl >= 5 && <Prop parts={pergola(0.42, 1.5, 0.7)} at={[lx, 0.06, pz + 0.2]} />}
      {/* Cypresses down the right side and either side of the gate. */}
      {[-0.75, -0.15, 0.45, 1.05].map((z) => <Prop key={z} parts={cypress()} at={[1.83, 0.06, z]} />)}
      {[-1.0, -0.5].map((x) => <Prop key={x} parts={cypress()} at={[x, 0.04, 1.62]} />)}
      {lvl >= 3 && [0.0, 0.5].map((x) => <Prop key={x} parts={cypress()} at={[x, 0.04, 1.62]} />)}
      {lvl >= 2 && [-1.8, 0.15].map((x) => <Prop key={x} parts={lemonPot()} at={[x, 0.06, -0.08]} />)}
      {lvl >= 3 && <Prop parts={flowerBed(0.5)} at={[0.12, 0.06, 1.2]} />}
      {lvl >= 6 && [-0.46, 0.3].map((x) => <Bulbs key={x} from={[x, 0.84, -0.14]} to={[x, 0.42, 1.8]} n={6} sag={0.12} />)}
      {lvl >= 6 && [-0.3, 0.55].map((x) => <Prop key={x} parts={lemonPot()} at={[x, 0.06, 1.15]} />)}
      {st === 3 && <Prop parts={umbrella('#26a69a')} at={[px, 0.06, pz + pd / 2 + 0.28]} human />}
      {lvl >= 9 && (
        <group position={[px + 0.25, 0.06, -0.78]}>
          {/* Round spa at the deep end. */}
          <Cyl m={k.m} at={[0, 0.06, 0]} r={0.2} h={0.12} c="#fafafa" seg={18} />
          <Cyl m={k.m} at={[0, 0.125, 0]} r={0.17} h={0.012} c={WATER} seg={18} />
        </group>
      )}
      {lvl >= 10 && [-1.82, -1.18].map((x) => <GasLamp key={x} k={k} at={[x, 0.06, 1.55]} ry={-Math.PI / 2} />)}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Goldcrest Mansion.

const MAN = { trim: '#fafafa', stone: '#d8d2c6', door: '#1b3a2f', gravel: '#efe6d6' }

const crest = () => prop('gh-crest', (k) => {
  k.sphere(cast(GILT), 0.06, [0, 0.06, 0], [1, 1, 1], 10, 8)
  for (const x of [-0.05, 0, 0.05]) k.cone(GILT, 0.025, x === 0 ? 0.14 : 0.1, [x, 0.16 + (x === 0 ? 0.03 : 0), 0], undefined, 4)
})
function Crest({ at }: { at: V3 }) {
  return <group position={at}><PropMesh parts={crest()} /></group>
}

// Four columns on their bases, gold capitals, `ch` tall.
const colonnade = (xs: number[], ch: number) => prop(`gh-cols|${xs.join(',')}|${ch}`, (k) => {
  for (const x of xs) {
    k.box(look(MAN.trim, 0.6), [0.15, 0.06, 0.15], [x, 0.03, 0])
    k.cyl(cast(look(MAN.trim, 0.6)), 0.05, 0.062, ch - 0.1, [x, ch / 2, 0], undefined, 12)
    k.box(GILT, [0.15, 0.06, 0.15], [x, ch - 0.03, 0])
  }
})

// A gate pier beside the drive, with a lantern and a gold cap, and the stone
// post at the end of the railings 1.5 further out (+x; turned for the left side).
const pier = () => prop('gh-pier', (k) => {
  k.box(cast(look(MAN.stone, 0.9)), [0.16, 0.72, 0.16], [0, 0.4, 0])
  k.box(look(MAN.trim, 0.8), [0.2, 0.04, 0.2], [0, 0.78, 0])
  k.box({ c: '#fff', glow: true }, [0.09, 0.12, 0.09], [0, 0.86, 0])
  k.cone(GILT, 0.08, 0.08, [0, 0.96, 0], [0, Math.PI / 4, 0], 4)
  k.box(look(MAN.stone, 0.9), [0.1, 0.46, 0.1], [1.5, 0.27, 0])
})

// A flag on a pole: a big banner in the roof colour with the gold crest on it
// (it flies along +x), a gold ball or star on top.
const banner = (c: string, star: boolean) => prop(`gh-banner|${c}|${star}`, (k) => {
  k.cyl(look(STONE, 0.9), 0.05, 0.06, 0.06, [0, 0.03, 0], undefined, 8)
  k.cyl(cast(look('#eceff1', 0.4, 0.4)), 0.015, 0.02, 1.1, [0, 0.55, 0], undefined, 6)
  k.box(cast(look(c, 0.8)), [0.46, 0.3, 0.016], [0.25, 0.9, 0])
  k.box(GILT, [0.46, 0.03, 0.02], [0.25, 0.75, 0])
  k.cyl(GILT, 0.07, 0.07, 0.024, [0.25, 0.91, 0], [Math.PI / 2, 0, 0], 14)
  for (const x of [-0.035, 0, 0.035]) k.cone(GILT, 0.016, x === 0 ? 0.07 : 0.05, [0.25 + x, 0.99 + (x === 0 ? 0.01 : 0), 0], undefined, 4)
  if (star) k.add(GILT, new OctahedronGeometry(0.07, 0), [0, 1.17, 0], [0, 0, Math.PI / 4])
  else k.sphere(GILT, 0.035, [0, 1.12, 0], [1, 1, 1], 8, 6)
})

// Gilded ironwork over the gates, sprung from the gate piers' caps (y 0): two
// iron arcs with gold bars between them and the crest at the crown.
const overthrow = () => prop('gh-overthrow', (k) => {
  k.torus(IRON, 0.32, 0.018, [0, 0, 0], [0, 0, 0], Math.PI, 20, 5)
  k.torus(IRON, 0.24, 0.014, [0, 0, 0], [0, 0, 0], Math.PI, 18, 4)
  for (let i = 1; i < 8; i++) {
    const a = (i / 8) * Math.PI
    k.rod(GILT, [Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0], [Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0], 0.01, 4)
  }
  for (const sd of [-1, 1]) {
    k.sphere(GILT, 0.03, [sd * 0.29, 0.03, 0], [1, 1, 1], 8, 6)
    k.torus(GILT, 0.05, 0.008, [sd * 0.13, 0.11, 0], [0, 0, 0], Math.PI * 2, 12, 3)
  }
  k.cyl(GILT, 0.07, 0.07, 0.024, [0, 0.36, 0], [Math.PI / 2, 0, 0], 16)
  k.sphere(GILT, 0.04, [0, 0.45, 0], [1, 1, 1], 10, 8)
  for (const x of [-0.04, 0, 0.04]) k.cone(GILT, 0.02, x === 0 ? 0.11 : 0.08, [x, 0.52 + (x === 0 ? 0.015 : 0), 0], undefined, 4)
})

function Mansion({ k, def, lvl }: { k: Kit; def: BuildingDef; lvl: number }) {
  const { m, ghost } = k
  const st = growthStage(lvl)
  const wall = def.color, roof = def.roof
  const F = 0.85
  const floors = st === 3 ? 3 : 2
  const H = floors * F
  const W = 2.7, D = 1.1, cz = -1.35
  const zf = cz + D / 2
  const winXs = [-1.12, -0.8, 0.8, 1.12]
  const winY = (f: number) => f * F + (f === 0 ? 0.48 : 0.42)
  const wings = st >= 2
  const wingH = st === 3 ? 1.9 : 1.1
  const ringZ = 0.92
  return (
    <group>
      {!ghost && <Lawn m={m} w={3.9} d={3.9} />}
      {/* The house: a stone plinth, quoined corners, a string course, a cornice with a gold band. */}
      <Box m={m} at={[0, H / 2, cz]} s={[W, H, D]} c={wall} />
      <Box m={m} at={[0, 0.08, cz]} s={[W + 0.05, 0.16, D + 0.05]} c={MAN.stone} shadow={false} />
      <group position={[0, 0, cz]}><PropMesh parts={quoins(W, D, H)} /></group>
      {Array.from({ length: floors - 1 }, (_, i) => <Box key={i} m={m} at={[0, F * (i + 1), cz]} s={[W + 0.03, 0.05, D + 0.03]} c={MAN.stone} shadow={false} />)}
      <Box m={m} at={[0, H + 0.05, cz]} s={[W + 0.12, 0.1, D + 0.12]} c={MAN.trim} />
      <Box m={m} at={[0, H - 0.02, cz]} s={[W + 0.03, 0.03, D + 0.03]} c={GOLD} shadow={false} />
      <Hip m={m} at={[0, H + 0.1, cz]} w={W + 0.2} d={D + 0.2} h={0.6} c={roof} t={shingleTex(5, 2)} />
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 1.02, 0, cz]}>
          <Box m={m} at={[0, H + 0.68, 0]} s={[0.2, 0.7, 0.32]} c={wall} />
          <Box m={m} at={[0, H + 1.05, 0]} s={[0.26, 0.05, 0.38]} c={MAN.stone} />
        </group>
      ))}
      {/* Dormers on the front slope. */}
      {[-0.72, 0.72].map((x) => (
        <group key={x} position={[x, H + 0.1, zf - 0.27]}>
          <Box m={m} at={[0, 0.2, 0]} s={[0.3, 0.4, 0.42]} c={MAN.trim} />
          <Gable m={m} at={[0, 0.4, 0]} w={0.34} d={0.44} h={0.18} wall={MAN.trim} roof={roof} over={0.04} side={0.03} />
          <Wins k={k} sill={false} list={[[0, 0.2, 0.21, 0, 0.15, 0.22]]} />
        </group>
      ))}
      {/* Cupola, then the gold dome of the palace. */}
      {st < 3 ? (
        <group position={[0, H + 0.62, cz]}>
          <Box m={m} at={[0, 0.06, 0]} s={[0.5, 0.16, 0.5]} c={MAN.trim} />
          <Cyl m={m} at={[0, 0.3, 0]} r={st === 2 ? 0.24 : 0.2} h={0.34} c={MAN.trim} seg={8} />
          <Panes k={k} list={[0, 1, 2, 3].map((i): WSpec => [Math.sin((i * Math.PI) / 2) * (st === 2 ? 0.226 : 0.188), 0.3, Math.cos((i * Math.PI) / 2) * (st === 2 ? 0.226 : 0.188), (i * Math.PI) / 2, 0.1, 0.2])} />
          <Cyl m={m} at={[0, 0.49, 0]} r={st === 2 ? 0.28 : 0.24} h={0.04} c={GOLD} seg={16} />
          <mesh position={[0, 0.51, 0]} castShadow><sphereGeometry args={[st === 2 ? 0.25 : 0.21, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />{m(GOLD)}</mesh>
          <Crest at={[0, 0.51 + (st === 2 ? 0.25 : 0.21), 0]} />
        </group>
      ) : (
        <group position={[0, H + 0.55, cz]}>
          <Cyl m={m} at={[0, 0.1, 0]} r={0.5} h={0.24} c={MAN.trim} seg={20} />
          <Cyl m={m} at={[0, 0.42, 0]} r={0.42} h={0.42} c={wall} seg={20} />
          <Panes k={k} list={Array.from({ length: 8 }, (_, i): WSpec => [Math.sin((i * Math.PI) / 4) * 0.41, 0.42, Math.cos((i * Math.PI) / 4) * 0.41, (i * Math.PI) / 4, 0.1, 0.24])} />
          <Cyl m={m} at={[0, 0.65, 0]} r={0.47} h={0.06} c={GOLD} seg={20} />
          <mesh position={[0, 0.68, 0]} castShadow><sphereGeometry args={[0.44, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />{m(GOLD)}</mesh>
          <Cyl m={m} at={[0, 1.18, 0]} r={0.1} h={0.16} c={MAN.trim} seg={8} />
          <mesh position={[0, 1.27, 0]}><coneGeometry args={[0.13, 0.12, 8]} />{m(GOLD)}</mesh>
          <Crest at={[0, 1.33, 0]} />
        </group>
      )}
      {lvl >= 9 && !ghost && <group position={[0, H + 0.1, zf + 0.05]}><PropMesh parts={balustrade(W - 0.1, GOLD)} /></group>}

      {/* Windows with pediment hoods; a gold-handled door under a fanlight in a stone surround. */}
      <Wins k={k} hood list={Array.from({ length: floors }, (_, f) => winXs.map((x): WSpec => [x, winY(f), zf, 0, 0.2, f === 0 ? 0.42 : 0.36])).flat()} />
      <Wins k={k} list={Array.from({ length: floors - 1 }, (_, f) => [-0.33, 0.33].map((x): WSpec => [x, winY(f + 1), zf, 0, 0.2, 0.36])).flat()} />
      <Box m={m} at={[0, 0.56, zf + 0.025]} s={[0.56, 0.88, 0.05]} c={MAN.stone} shadow={false} />
      <Door k={k} at={[0, 0.12, zf + 0.05]} w={0.36} h={0.6} c={MAN.door} fan />
      <mesh position={[-0.09, 0.42, zf + 0.08]}><boxGeometry args={[0.03, 0.03, 0.008]} />{m(GOLD)}</mesh>
      <Panes k={k} list={[
        ...Array.from({ length: floors }, (_, f) => [-0.9, -0.3, 0.3, 0.9].map((x): WSpec => [x, winY(f), cz - D / 2 - 0.006, Math.PI, 0.2, 0.36])).flat(),
        ...Array.from({ length: floors }, (_, f) => [-1, 1].map((sd): WSpec => [sd * (W / 2 + 0.008), winY(f), cz, (sd * Math.PI) / 2, 0.2, 0.36])).flat(),
      ]} />

      <Portico k={k} zf={zf} H={H} roof={roof} />

      {wings && [-1, 1].map((sd) => (
        <group key={sd} position={[sd * 1.63, 0, -1.45]}>
          <Box m={m} at={[0, wingH / 2, 0]} s={[0.56, wingH, 0.9]} c={wall} />
          <Box m={m} at={[0, 0.08, 0]} s={[0.6, 0.16, 0.94]} c={MAN.stone} shadow={false} />
          <Box m={m} at={[0, wingH + 0.04, 0]} s={[0.64, 0.08, 0.98]} c={MAN.trim} />
          <group position={[0, wingH + 0.08, 0.45]}><PropMesh parts={balustrade(0.6, lvl >= 9 ? GOLD : MAN.trim)} /></group>
          <Wins k={k} arch sill={false} list={Array.from({ length: st === 3 ? 2 : 1 }, (_, f): WSpec => [0, f * F + 0.42, 0.45, 0, 0.22, f === 0 ? 0.42 : 0.36])} />
          <Panes k={k} list={Array.from({ length: st === 3 ? 2 : 1 }, (_, f): WSpec => [sd * 0.286, f * F + 0.5, 0, (sd * Math.PI) / 2, 0.22, 0.36])} />
          {!ghost && <Prop parts={urn(true)} at={[sd * 0.18, wingH + 0.08, 0.3]} s={0.7} />}
          {lvl >= 8 && !ghost && <group position={[sd * 0.12, wingH + 0.08, -0.25]} rotation-y={sd > 0 ? Math.PI : 0}><PropMesh parts={banner(roof, lvl >= 10)} /></group>}
        </group>
      ))}

      {!ghost && <MansionGrounds k={k} lvl={lvl} st={st} ringZ={ringZ} />}
      {/* Front railings on stone posts, and the gate piers either side of the drive. */}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          {!ghost && <Prop parts={ironFence(1.4, 0.42, 'gold')} at={[sd * 1.18, 0.04, 1.9]} />}
        </group>
      ))}
      {[-1, 1].map((sd) => <Prop key={sd} parts={pier()} at={[sd * 0.4, 0, 1.9]} ry={sd > 0 ? 0 : Math.PI} />)}
      {!ghost && <OpenGates w={0.64} h={0.5} crest at={[0, 0.04, 1.9]} />}
      {lvl >= 10 && !ghost && <Prop parts={overthrow()} at={[0, 0.8, 1.9]} />}
      {!ghost && <Pool r={0.6} x={0} z={1.65} />}
    </group>
  )
}

// The Goldcrest crest: a gold ball under a crown of three points.
// Columned portico on a podium with steps, a pediment with the gold crest.
function Portico({ k, zf, H, roof }: { k: Kit; zf: number; H: number; roof: string }) {
  const { m, bulb, ghost } = k
  const pz = zf + 0.3, pw = 1.24, P = 0.12 // the podium, one easy step up
  // Two pairs of columns, -0.5 -0.26 | 0.26 0.5, the way in clear between them.
  const cols = [-0.12, 0.12]
  const ch = Math.min(H, 1.9) - 0.12
  return (
    <group>
      <Box m={m} at={[0, P / 2, pz]} s={[pw, P, 0.6]} c={MAN.stone} />
      {[0, 1, 2].map((i) => <Box key={i} m={m} at={[0, 0.01 + 0.015 * (3 - i), pz + 0.36 + i * 0.1]} s={[pw - 0.1 - i * 0.04, 0.02 + 0.03 * (3 - i), 0.12]} c={MAN.stone} shadow={false} />)}
      {[-0.38, 0.38].map((x) => <group key={x} position={[x, P, pz + 0.18]}><PropMesh parts={colonnade(cols, ch)} /></group>)}
      <Box m={m} at={[0, P + ch + 0.07, pz]} s={[pw + 0.06, 0.14, 0.62]} c={MAN.trim} />
      <Box m={m} at={[0, P + ch + 0.03, pz + 0.313]} s={[pw + 0.07, 0.025, 0.01]} c={GOLD} shadow={false} />
      <Gable m={m} at={[0, P + ch + 0.14, pz]} w={pw + 0.06} d={0.62} h={0.36} wall={MAN.trim} roof={shade(roof, 0.12)} over={0.06} side={0.04} />
      <group position={[0, P + ch + 0.26, pz + 0.316]}>
        <Cyl m={m} at={[0, 0, 0]} r={0.09} h={0.02} c={GOLD} seg={16} rot={[Math.PI / 2, 0, 0]} />
        <Crest at={[0, 0.05, 0.01]} />
      </group>
      <mesh position={[0, P + ch - 0.04, pz]}><sphereGeometry args={[0.05, 8, 6]} />{bulb}</mesh>
      <Cyl m={m} at={[0, P + ch + 0.0, pz]} r={0.006} h={0.06} c="#263238" seg={4} />
      {!ghost && <Pool r={0.7} x={0} z={pz + 0.5} />}
    </group>
  )
}

// A clipped hedge ring round the fountain lawn.
const ringHedge = (r: number) => prop(`gh-ring|${r}|${SEASON}`, (k) => {
  k.torus(cast(look(SEASON === 'winter' ? '#2e5d31' : '#2e7d32', 0.9)), r, 0.04, [0, 0.03, 0], [Math.PI / 2, 0, 0], Math.PI * 2, 32, 5)
  const pal = SEASON === 'fall' ? ['#c62828', '#ff8f00'] : ['#e91e63', '#ffffff']
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    k.ico(look(pal[i % 2], 0.6), 0.025, [Math.cos(a) * (r - 0.1), 0.02, Math.sin(a) * (r - 0.1)], [1, 0.8, 1], 0)
  }
})

function MansionGrounds({ k, lvl, st, ringZ }: { k: Kit; lvl: number; st: number; ringZ: number }) {
  const { m } = k
  return (
    <group>
      {/* Round gravel forecourt out to the gates, the way up the middle to the steps
          between two fountains, each in a lawn ringed by a clipped hedge. */}
      <mesh position={[0, 0.05, ringZ]} receiveShadow><cylinderGeometry args={[1.0, 1.0, 0.02, 40]} />{m(MAN.gravel, gravelTex(2, 2))}</mesh>
      <Pave m={m} x={0} z={1.86} w={0.66} d={0.2} c={MAN.gravel} t={gravelTex(1, 0.3)} y={0.006} />
      <Pave m={m} x={0} z={0.08} w={0.9} d={0.3} c={MAN.gravel} t={gravelTex(1, 0.4)} y={0.006} />
      {[-0.6, 0.6].map((x) => (
        <group key={x} position={[x, 0, ringZ]}>
          <mesh position={[0, 0.07, 0]} receiveShadow><cylinderGeometry args={[0.31, 0.31, 0.02, 28]} />{m('#ffffff', grassTex(0.32, 0.32))}</mesh>
          <Prop parts={ringHedge(0.3)} at={[0, 0.08, 0]} />
          <Prop parts={fountain(st >= 2 && lvl >= 6 ? 3 : 2, st === 3)} at={[0, 0.08, 0]} s={0.6} />
        </group>
      ))}
      {/* A gravel forecourt either side of the steps, each with a parking bay. */}
      {[-1, 1].filter((sd) => sd > 0 || lvl >= 5).map((sd) => <Pave key={sd} m={m} x={sd * 1.31} z={0.005} w={1.22} d={1.55} c={MAN.gravel} t={gravelTex(1.5, 2)} y={0.006} />)}
      <Car at={[1.5, 0.066, 0.0]} ry={0} body="luxury" color={lvl >= 7 ? '#212121' : '#eceff1'} />
      {lvl >= 5 && <Car at={[-1.5, 0.066, 0.0]} ry={0} body="sports" color="#c62828" />}
      {/* Hedge parterres either side of the drive, out front. */}
      {[-1, 1].map((sd) => <Prop key={sd} parts={parterre(0.76, 0.92, lvl >= 9 || st >= 2)} at={[sd * 1.5, 0.04, 1.32]} />)}
      {lvl >= 2 && [-1, 1].map((sd) => <Prop key={sd} parts={urn(lvl >= 3)} at={[sd * 0.74, sd > 0 || lvl >= 5 ? 0.066 : 0.04, -0.1]} />)}
      {lvl < 5 && <Prop parts={tree()} at={[-1.45, 0.04, -0.15]} />}
      {lvl < 5 && [-1.0, 1.15].map((z) => <Prop key={z} parts={shrub()} at={[-1.75, 0.04, z * 0.4]} />)}
      {lvl >= 6 && [-1, 1].map((sd) => <GasLamp key={sd} k={k} at={[sd * 1.02, 0.04, 1.5]} ry={sd > 0 ? 0 : Math.PI} />)}
    </group>
  )
}

// ---------------------------------------------------------------------------

export function GrandHomeModel({ def, ghost, m, win, bulb, level = 1 }: NewModelProps) {
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  const k: Kit = { m, win, bulb, ghost }
  if (def.id === 'villa') return <Villa k={k} def={def} lvl={lvl} />
  if (def.id === 'mansion') return <Mansion k={k} def={def} lvl={lvl} />
  return <Victorian k={k} def={def} lvl={lvl} />
}
