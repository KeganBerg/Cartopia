import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { glowMats } from '../dayNight'
import { Batch } from '../Batch'
import { EDGE, Horizon, Many, PropMesh, Sparkles, Water, archTop, frustum, glow, prop, rand, useProp, type Look, type PropKit, type Spot } from './kit'
import type { WorldProps } from './WorldVenue'

// UK, Clocktower Embankment: a night race along the river. Left: brick terraces with white sash
// windows and black railings, red phone boxes and double-decker buses at the kerb, then the
// long Gothic palace with its great clock tower and the square royal tower at the far end.
// Right: the embankment wall, plane trees and globe lamps, the river, the giant observation wheel
// turning slowly on the far bank, and the twin-towered bascule bridge ahead.

const SANDSTONE: Look = { c: '#d6c08c', r: 0.85 }
const SAND_D: Look = { c: '#b9a272', r: 0.9 }
const SLATE: Look = { c: '#4f5b5c', r: 0.6, m: 0.2 }
const WIN: Look = { c: '#ffffff', use: glowMats.window }
const WARM = glow('#ffd889', 0.15, 1.6)
const IRON: Look = { c: '#1d2022', r: 0.5, m: 0.5 }
const GOLD: Look = { c: '#d9a83a', r: 0.3, m: 0.7 }
const RED: Look = { c: '#c8102e', r: 0.45 }
const WHITE: Look = { c: '#f2efe8', r: 0.7 }
// Satin cast iron for the props repeated down the mile: plain finishes, so they fold
// into each prop's one painted mesh instead of costing a draw of their own in every stretch.
const IRON_P: Look = { c: '#1d2022', r: 0.55, m: 0.2 }
const GRANITE: Look = { c: '#8f8a80', r: 0.9 }
const BRONZE: Look = { c: '#4a5440', r: 0.55, m: 0.2 }

// A pointed Gothic window opening, lit, in a stone frame, facing +z on a face at z = f.
function lancet(k: PropKit, x: number, y: number, f: number, w: number, h: number) {
  k.box(SAND_D, [w + 0.1, h + 0.06, 0.04], [x, y + h / 2, f + 0.005])
  k.box(WIN, [w, h, 0.03], [x, y + h / 2, f + 0.012])
  k.box(WIN, [w * 0.72, w * 0.72, 0.03], [x, y + h, f + 0.012], [0, 0, Math.PI / 4])
  k.box(SANDSTONE, [0.03, h + w * 0.4, 0.04], [x, y + h / 2 + 0.1, f + 0.02])
  // Tracery: a transom and a hood mould over the point.
  k.box(SANDSTONE, [w, 0.03, 0.04], [x, y + h * 0.55, f + 0.02])
  k.box(SAND_D, [w * 0.8, 0.05, 0.05], [x - w * 0.275, y + h + w * 0.275, f + 0.03], [0, 0, Math.PI / 4])
  k.box(SAND_D, [w * 0.8, 0.05, 0.05], [x + w * 0.275, y + h + w * 0.275, f + 0.03], [0, 0, -Math.PI / 4])
}

// One bay of the palace front, 3 wide, facing +z: buttresses with pinnacles, two storeys of
// tall lit windows, carved panels between, a pierced parapet and the steep slate roof.
function palaceBay(k: PropKit) {
  const W = 3
  const H = 6
  const f = 2
  k.box(SANDSTONE, [W, H, 4], [0, H / 2, 0])
  for (const s of [-1, 1]) {
    k.box(SANDSTONE, [0.3, H + 0.4, 0.3], [s * (W / 2 - 0.15), (H + 0.4) / 2, f + 0.1])
    frustum(k, SANDSTONE, 0.3, 0.3, 1.1, 0, [s * (W / 2 - 0.15), H + 0.4, f + 0.1])
    // Little pinnacles at the buttress's shoulders.
    for (const t of [-1, 1]) frustum(k, SANDSTONE, 0.1, 0.1, 0.5, 0, [s * (W / 2 - 0.15) + t * 0.19, H + 0.25, f + 0.1])
  }
  for (const x of [-0.75, 0, 0.75]) {
    lancet(k, x, 0.8, f, 0.36, 1.6)
    lancet(k, x, 3.4, f, 0.36, 1.6)
    for (let i = 0; i < 3; i++) k.box(SAND_D, [0.36, 0.05, 0.03], [x, 2.75 + i * 0.18, f + 0.008])
  }
  k.box(SAND_D, [W, 0.1, 0.1], [0, 2.6, f + 0.04])
  k.box(SAND_D, [W, 0.14, 0.14], [0, H, f + 0.05])
  for (let i = 0; i < 6; i++) k.box(SANDSTONE, [0.22, 0.35, 0.12], [-W / 2 + 0.25 + i * 0.5, H + 0.25, f - 0.02])
  frustum(k, SLATE, W, 3.4, 2.2, 0.3, [0, H, -0.2])
  for (let i = 0; i < 6; i++) k.cyl(IRON, 0.02, 0.02, 0.4, [-W / 2 + 0.25 + i * 0.5, H + 2.4, -0.2], undefined, 4)
}

// The great clock tower: a tall shaft of panelled stone, the four lit clock faces, the belfry
// and the gilded spire.
function clockTower(k: PropKit) {
  const w = 3
  k.box(SAND_D, [w + 0.4, 1.2, w + 0.4], [0, 0.6, 0])
  k.box(SANDSTONE, [w, 15, w], [0, 8.7, 0])
  for (const [dx, dz] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    for (let i = 0; i < 6; i++) {
      const y = 2.2 + i * 2.1
      for (const t of [-0.75, 0, 0.75]) k.box(i % 2 ? WIN : SAND_D, [dz ? 0.32 : 0.03, 1.4, dz ? 0.03 : 0.32], [dx * (w / 2 + 0.005) + (dz ? t : 0), y, dz * (w / 2 + 0.005) + (dx ? t : 0)])
    }
    for (const t of [-1.3, 1.3]) k.box(SANDSTONE, [dz ? 0.22 : 0.18, 15, dz ? 0.18 : 0.22], [dx * (w / 2 + 0.06) + (dz ? t : 0), 8.7, dz * (w / 2 + 0.06) + (dx ? t : 0)])
  }
  // Clock stage, wider, with a lit face on each side.
  k.box(SANDSTONE, [w + 0.7, 3.6, w + 0.7], [0, 18, 0])
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    const cx = dx * ((w + 0.7) / 2 + 0.02)
    const cz = dz * ((w + 0.7) / 2 + 0.02)
    k.box(GOLD, [3.2, 3.2, 0.04], [cx, 18, cz], [0, ry, 0])
    k.cyl(WARM, 1.35, 1.35, 0.04, [cx + dx * 0.02, 18, cz + dz * 0.02], [Math.PI / 2, ry, 0], 28)
    k.torus(IRON, 1.35, 0.06, [cx + dx * 0.04, 18, cz + dz * 0.04], [0, ry, 0], Math.PI * 2, 28, 4)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const r = 1.15
      k.box(IRON, [0.06, 0.2, 0.02], [cx + dx * 0.05 + (dz ? Math.sin(a) * r : 0), 18 + Math.cos(a) * r, cz + dz * 0.05 + (dx ? Math.sin(a) * r : 0)], [0, ry, -a])
    }
    k.box(IRON, [0.07, 0.95, 0.02], [cx + dx * 0.06, 18.42, cz + dz * 0.06], [0, ry, 0])
    k.box(IRON, [0.07, 0.65, 0.02], [cx + dx * 0.06 + (dz ? 0.25 : 0), 18.1, cz + dz * 0.06 + (dx ? -0.25 : 0)], [0, ry, dz ? -1.2 : 1.2])
  }
  k.box(SAND_D, [w + 0.9, 0.3, w + 0.9], [0, 19.9, 0])
  // Belfry with pointed openings, the steep iron spire with its gables and the gilded finial.
  k.box(SANDSTONE, [w + 0.3, 2.2, w + 0.3], [0, 21.1, 0])
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    for (const t of [-0.9, 0, 0.9]) {
      const x = dx * ((w + 0.3) / 2 + 0.005) + (dz ? t : 0)
      const z = dz * ((w + 0.3) / 2 + 0.005) + (dx ? t : 0)
      k.box({ c: '#2a2a2a', r: 1 }, [dz ? 0.5 : 0.03, 1.2, dz ? 0.03 : 0.5], [x, 21.0, z])
      archTop(k, { c: '#2a2a2a', r: 1 }, 0.5, 0.03, [x, 21.6, z], ry)
    }
    k.box(SLATE, [dz ? 1.2 : 0.6, 1.2, dz ? 0.6 : 1.2], [dx * 1.2, 22.8, dz * 1.2])
  }
  frustum(k, SLATE, w + 0.3, w + 0.3, 6.5, 0.12, [0, 22.2, 0])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.box(SANDSTONE, [0.3, 1.6, 0.3], [sx * 1.7, 20.8, sz * 1.7])
    frustum(k, GOLD, 0.3, 0.3, 1.0, 0, [sx * 1.7, 21.6, sz * 1.7])
  }
  k.box(GOLD, [0.5, 0.8, 0.5], [0, 29.1, 0])
  frustum(k, GOLD, 0.35, 0.35, 1.8, 0, [0, 29.5, 0])
  k.cyl(GOLD, 0.03, 0.03, 1.0, [0, 31.6, 0], undefined, 5)
}

// The square royal tower at the palace's far end, with corner turrets.
function royalTower(k: PropKit) {
  const w = 5.4
  k.box(SANDSTONE, [w, 20, w], [0, 10, 0])
  k.box(SAND_D, [3, 4.6, 0.1], [0, 2.3, w / 2 + 0.02])
  archTop(k, SAND_D, 3, 0.1, [0, 4.6, w / 2 + 0.02])
  k.box({ c: '#2a2a2a', r: 1 }, [2.4, 4.2, 0.08], [0, 2.1, w / 2 + 0.06])
  for (let i = 0; i < 4; i++) for (const t of [-1.4, 0, 1.4]) lancet(k, t, 6.5 + i * 3.2, w / 2, 0.45, 2.0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.cyl(SANDSTONE, 0.55, 0.55, 22.5, [sx * (w / 2), 11.25, sz * (w / 2)], undefined, 8)
    frustum(k, GOLD, 0.8, 0.8, 1.8, 0, [sx * (w / 2), 22.5, sz * (w / 2)])
  }
  for (let i = 0; i < 9; i++) k.box(SANDSTONE, [0.32, 0.6, 0.2], [-w / 2 + 0.6 + i * 0.53, 20.3, w / 2 - 0.08])
  k.cyl(IRON, 0.07, 0.07, 6, [0, 23, 0], undefined, 6)
}

// A brick terrace house facing +z: stucco ground floor, white-framed sash windows, a
// fanlit door (a pillared porch on the stucco ones), area railings with a gate, a dormer in the
// slate mansard and a stack of chimney pots.
const BRICKS = ['#8a4b36', '#a65b3e', '#c9a86a', '#7b4535', '#b58a5a']
function terrace(k: PropKit, c: string, stucco: boolean) {
  const brick: Look = { c, r: 0.95 }
  const W = 2.2
  const H = 5.4
  const f = 1.5
  k.box(brick, [W, H, 3], [0, H / 2, 0])
  if (stucco) k.box(WHITE, [W + 0.02, 1.5, 3.02], [0, 0.75, 0])
  k.box(WHITE, [W + 0.04, 0.12, 3.06], [0, 1.52, 0])
  k.box({ c: '#141414', r: 0.4 }, [0.48, 0.95, 0.04], [-0.5, 0.5, f + 0.01])
  k.box(WIN, [0.48, 0.22, 0.03], [-0.5, 1.1, f + 0.01])
  // Door steps out to the pavement.
  k.box({ c: '#d9d4c8', r: 0.9 }, [0.7, 0.12, 0.45], [-0.5, 0.06, f + 0.225])
  if (stucco) {
    // Pillared porch: two columns and a cornice over the door.
    for (const s of [-1, 1]) {
      k.cyl(WHITE, 0.06, 0.07, 1.2, [-0.5 + s * 0.33, 0.8, f + 0.38], [0, Math.PI / 4, 0], 4)
    }
    k.box(WHITE, [0.9, 0.14, 0.5], [-0.5, 1.55, f + 0.25])
  }
  k.box(WIN, [0.5, 0.75, 0.03], [0.45, 0.75, f + 0.01])
  for (let fl = 0; fl < 3; fl++) for (const x of [-0.55, 0.55]) {
    const y = 1.85 + fl * 1.15
    const h = fl === 2 ? 0.55 : 0.8
    k.box(WHITE, [0.5, h + 0.08, 0.03], [x, y + h / 2, f + 0.006])
    k.box(WIN, [0.42, h, 0.03], [x, y + h / 2, f + 0.012])
    if (fl < 2) k.box(WHITE, [0.42, 0.04, 0.04], [x, y + h / 2, f + 0.02])
    k.box(WHITE, [0.03, h, 0.04], [x, y + h / 2, f + 0.02])
    k.box(WHITE, [0.56, 0.05, 0.08], [x, y - 0.03, f + 0.03])
    if (fl === 0) {
      for (let i = 0; i < 3; i++) k.box(IRON_P, [0.025, 0.28, 0.025], [x - 0.2 + i * 0.2, y + 0.12, f + 0.16])
      k.box(IRON_P, [0.5, 0.025, 0.025], [x, y + 0.26, f + 0.16])
    }
  }
  k.box(WHITE, [W + 0.06, 0.1, 3.08], [0, H, 0])
  k.box(brick, [W, 0.35, 0.1], [0, H + 0.2, f - 0.05])
  frustum(k, SLATE, W, 2.6, 0.8, 0.3, [0, H, -0.1])
  // A dormer in the mansard.
  k.box(SLATE, [0.62, 0.55, 0.6], [0.45, H + 0.42, 0.72])
  k.box(WIN, [0.4, 0.34, 0.03], [0.45, H + 0.42, 1.03])
  k.box(SLATE, [0.7, 0.05, 0.66], [0.45, H + 0.72, 0.72])
  // Chimney stack with its clay pots.
  k.box(brick, [0.5, 1.0, 0.5], [W / 2 - 0.25, H + 0.5, -0.3])
  for (const [x, z, h] of [[-0.12, 0, 0.3], [0.1, 0, 0.24]]) k.cyl({ c: '#b5653b', r: 0.9 }, 0.05, 0.065, h, [W / 2 - 0.25 + x, H + 1.0 + h / 2, -0.3 + z], undefined, 5)
  // Area railings along the pavement, open at the steps.
  for (let i = 0; i < 11; i++) {
    const x = -W / 2 + 0.1 + i * 0.2
    if (x > -0.85 && x < -0.15) continue
    k.box(IRON_P, [0.025, 0.55, 0.025], [x, 0.28, f + 0.45])
  }
  for (const x of [-0.85, -0.15]) k.box(IRON_P, [0.05, 0.7, 0.05], [x, 0.35, f + 0.45])
  k.box(IRON_P, [0.25, 0.03, 0.03], [-0.975, 0.52, f + 0.45])
  k.box(IRON_P, [1.25, 0.03, 0.03], [0.475, 0.52, f + 0.45])
}

// A red telephone box with its glazing bars and lit name band, and a red pillar box beside it.
function phoneBox(k: PropKit) {
  k.box(RED, [0.5, 1.2, 0.5], [0, 0.6, 0])
  k.box(RED, [0.56, 0.08, 0.56], [0, 0.04, 0])
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
    k.box(WIN, [0.34, 0.75, 0.02], [dx * 0.251, 0.6, dz * 0.251], [0, ry, 0])
    for (const y of [0.4, 0.6, 0.8]) k.box(RED, [0.34, 0.02, 0.03], [dx * 0.255, y, dz * 0.255], [0, ry, 0])
    k.box(WARM, [0.32, 0.07, 0.02], [dx * 0.255, 1.08, dz * 0.255], [0, ry, 0])
  }
  k.box(RED, [0.56, 0.06, 0.56], [0, 1.23, 0])
  k.cyl(RED, 0.28, 0.28, 0.5, [0, 1.26, 0], [Math.PI / 2, 0, 0], 12)
  k.cyl(RED, 0.28, 0.28, 0.5, [0, 1.26, 0], [0, 0, Math.PI / 2], 12)
  // The pillar box: a red drum on a black plinth, a domed cap with a rim, the dark letter slot.
  const px = 0.75
  k.cyl({ c: '#151515', r: 0.6 }, 0.19, 0.2, 0.12, [px, 0.06, 0], undefined, 12)
  k.cyl(RED, 0.17, 0.17, 0.85, [px, 0.545, 0], undefined, 12)
  k.cyl(RED, 0.2, 0.2, 0.05, [px, 0.99, 0], undefined, 12)
  k.sphere(RED, 0.18, [px, 1.01, 0], [1, 0.7, 1], 12, 5, Math.PI / 2)
  k.box({ c: '#141414', r: 0.6 }, [0.16, 0.025, 0.04], [px, 0.86, 0.16])
  k.box({ c: '#f2efe8', r: 0.6 }, [0.1, 0.07, 0.02], [px, 0.7, 0.165])
}

// A red double-decker bus with the open rear platform and its stairs, lit inside, facing +z.
function bus(k: PropKit) {
  const BLACK: Look = { c: '#151515', r: 0.6 }
  // Lower deck stops short of the back for the open platform; the upper deck runs over it.
  k.box(RED, [1.1, 1.0, 3.9], [0, 0.75, 0.25])
  k.box(RED, [0.55, 1.0, 0.5], [-0.275, 0.75, -1.95])
  k.box(RED, [1.1, 0.9, 4.3], [0, 1.75, -0.05])
  k.box(RED, [1.12, 0.12, 4.32], [0, 1.26, -0.02])
  k.box(WHITE, [1.12, 0.08, 4.32], [0, 1.32, -0.02])
  k.box(RED, [1.04, 0.06, 4.2], [0, 2.22, -0.05])
  for (const s of [-1, 1]) {
    k.box(WIN, [0.02, 0.4, 3.5], [s * 0.555, 0.98, 0.2])
    k.box(WIN, [0.02, 0.42, 3.9], [s * 0.555, 1.85, -0.05])
    // Window pillars, on the side the race sees.
    if (s < 0) for (let i = 0; i <= 6; i++) {
      k.box(RED, [0.03, 0.42, 0.06], [s * 0.565, 0.98, -1.55 + i * 0.583])
      k.box(RED, [0.03, 0.44, 0.06], [s * 0.565, 1.85, -2.0 + i * 0.65])
    }
  }
  // The platform: floor, the grab pole, the stairs climbing to the top deck.
  k.box({ c: '#3a3a3a', r: 0.9 }, [0.55, 0.06, 0.5], [0.275, 0.3, -1.95])
  k.box({ c: '#2a2a2a', r: 0.9 }, [0.02, 0.9, 0.5], [0.0, 0.8, -1.95])
  k.rod({ c: '#e8e2cc', r: 0.4 }, [0.5, 0.33, -2.16], [0.5, 1.2, -2.16], 0.025, 6)
  for (let i = 0; i < 4; i++) k.box(BLACK, [0.45, 0.04, 0.12], [0.3, 0.45 + i * 0.2, -2.12 + i * 0.12])
  k.box(WIN, [0.4, 0.3, 0.02], [-0.3, 1.0, -2.21])
  k.box(WIN, [0.9, 0.36, 0.02], [0, 1.85, -2.21])
  // Front: windscreens, the destination blind in its dark box, grille and lamps.
  k.box(WIN, [0.95, 0.42, 0.02], [0, 1.85, 2.11])
  k.box(WIN, [0.95, 0.4, 0.02], [0, 0.98, 2.21])
  k.box({ c: '#101010', r: 0.6 }, [0.8, 0.2, 0.02], [0, 2.1, 2.105])
  k.box(WARM, [0.7, 0.12, 0.02], [0, 2.1, 2.115])
  k.box({ c: '#101010', r: 0.6 }, [0.42, 0.28, 0.02], [0, 0.55, 2.21])
  for (let i = 0; i < 4; i++) k.box({ c: '#9e9e9e', r: 0.5 }, [0.36, 0.025, 0.02], [0, 0.45 + i * 0.065, 2.22])
  for (const s of [-1, 1]) {
    k.box(WARM, [0.12, 0.1, 0.02], [s * 0.38, 0.45, 2.21])
    k.rod(BLACK, [s * 0.55, 1.15, 2.1], [s * 0.7, 1.2, 2.0], 0.012, 4)
    k.box(BLACK, [0.03, 0.14, 0.09], [s * 0.71, 1.12, 2.0])
  }
  k.box(BLACK, [1.12, 0.2, 4.42], [0, 0.18, 0])
  for (const z of [1.4, -1.3]) for (const s of [-1, 1]) {
    k.cyl({ c: '#111111', r: 0.9 }, 0.26, 0.26, 0.16, [s * 0.5, 0.26, z], [0, 0, Math.PI / 2], 14)
    k.cyl({ c: '#9e9e9e', r: 0.45 }, 0.12, 0.12, 0.17, [s * 0.5, 0.26, z], [0, 0, Math.PI / 2], 10)
  }
}

// A plane tree with mottled bark and a broad crown.
function plane(k: PropKit) {
  k.cyl({ c: '#8a8270', r: 1 }, 0.12, 0.16, 2.4, [0, 1.2, 0], undefined, 7)
  for (const [x, z] of [[0.5, 0.2], [-0.4, -0.3]]) k.rod({ c: '#8a8270', r: 1 }, [0, 2.0, 0], [x, 2.8, z], 0.07, 5)
  const leaf = ['#3f5f34', '#4a6b3b', '#36532e']
  ;[[0, 3.2, 0, 1.2], [0.8, 2.9, 0.2, 0.85], [-0.7, 3.0, -0.3, 0.85], [0, 3.7, 0.1, 0.8]].forEach(([x, y, z, r], i) => k.ico({ c: leaf[i % 3], r: 1 }, r, [x, y, z], [1, 0.8, 1], 1))
}

// A dolphin lamp on the embankment wall: two cast-iron fish coiled round the foot, a fluted
// column with collars, the glass globe and its little crown.
function dolphinLamp(k: PropKit, z: number) {
  k.box(GRANITE, [0.42, 0.22, 0.42], [0, 1.21, z])
  k.cyl(IRON_P, 0.12, 0.16, 0.42, [0, 1.53, z], undefined, 6)
  for (const s of [-1, 1]) {
    k.torus(IRON_P, 0.13, 0.045, [s * 0.15, 1.6, z], [0, Math.PI / 2, s * 0.6], Math.PI * 1.4, 6, 3)
    k.sphere(IRON_P, 0.07, [s * 0.2, 1.42, z], [1, 0.8, 1.3], 5, 3)
  }
  k.cyl(IRON_P, 0.045, 0.06, 1.5, [0, 2.48, z], undefined, 6)
  k.cyl(IRON_P, 0.075, 0.075, 0.06, [0, 2.9, z], undefined, 6)
  k.cyl(IRON_P, 0.09, 0.05, 0.12, [0, 3.28, z], undefined, 6)
  k.sphere(WARM, 0.2, [0, 3.5, z])
  k.cyl(IRON_P, 0.06, 0.1, 0.08, [0, 3.72, z], undefined, 6)
  k.cone(IRON_P, 0.05, 0.16, [0, 3.84, z], undefined, 4)
}

// A 24-metre stretch of the embankment: the granite river wall, two dolphin lamps, and a
// slatted bench between the plane trees whose cast-iron ends are kneeling camels.
function embankment(k: PropKit) {
  k.box({ c: '#9a9488', r: 0.9 }, [0.6, 1.0, 24], [0, 0.5, 0])
  k.box({ c: '#b5ae9f', r: 0.9 }, [0.7, 0.12, 24], [0, 1.04, 0])
  for (const z of [-6, 6]) dolphinLamp(k, z)
  const wood: Look = { c: '#7a5634', r: 0.9 }
  const bx = 0.75
  const bz = 0
  for (let i = 0; i < 3; i++) k.box(wood, [0.11, 0.035, 1.4], [bx - 0.11 + i * 0.13, 0.42, bz])
  for (let i = 0; i < 2; i++) k.box(wood, [0.03, 0.11, 1.4], [bx - 0.2 - i * 0.04, 0.58 + i * 0.16, bz], [0, 0, 0.25])
  for (const s of [-1, 1]) {
    const z = bz + s * 0.72
    // The camel: legs folded under, the body, its hump under the arm, neck and head.
    k.box(IRON_P, [0.4, 0.06, 0.06], [bx, 0.03, z])
    k.box(IRON_P, [0.06, 0.38, 0.05], [bx + 0.15, 0.22, z])
    k.box(IRON_P, [0.06, 0.38, 0.05], [bx - 0.15, 0.22, z])
    k.sphere(IRON_P, 0.13, [bx - 0.02, 0.5, z], [1.5, 0.75, 0.35], 6, 4)
    k.sphere(IRON_P, 0.09, [bx - 0.06, 0.6, z], [1, 1, 0.5], 6, 3, Math.PI / 2)
    k.rod(IRON_P, [bx + 0.14, 0.52, z], [bx + 0.24, 0.7, z], 0.035, 5)
    k.box(IRON_P, [0.12, 0.06, 0.05], [bx + 0.28, 0.71, z])
    k.box(IRON_P, [0.05, 0.42, 0.04], [bx - 0.24, 0.7, z], [0, 0, 0.25])
  }
}

// An embankment statue on its granite plinth: a horseman, sword raised, his horse stepping out
// towards the oncoming race.
function statue(k: PropKit) {
  k.box(GRANITE, [1.4, 0.3, 1.9], [0, 0.15, 0])
  k.box({ c: '#9a958a', r: 0.9 }, [1.15, 1.6, 1.75], [0, 1.1, 0])
  k.box(GRANITE, [1.35, 0.15, 1.95], [0, 1.95, 0])
  k.box(BRONZE, [0.04, 0.25, 0.7], [0.58, 1.15, 0])
  // The horse, one pair of legs lifted, its weight on the hind legs.
  const y = 2.03
  k.sphere(BRONZE, 0.56, [0, y + 0.98, -0.05], [0.48, 0.52, 1], 12, 8)
  k.sphere(BRONZE, 0.24, [0, y + 1.0, 0.38], [1, 1.05, 1], 8, 6)
  k.sphere(BRONZE, 0.24, [0, y + 1.05, -0.45], [0.95, 1.1, 1], 8, 6)
  for (const s of [-1, 1]) {
    k.rod(BRONZE, [s * 0.13, y + 0.85, 0.35], [s * 0.13, y + 0.32, 0.45], 0.075, 6)
    k.rod(BRONZE, [s * 0.13, y + 0.32, 0.45], [s * 0.13, y, 0.32], 0.055, 6)
    k.rod(BRONZE, [s * 0.13, y + 0.95, -0.45], [s * 0.13, y + 0.65, -0.72], 0.07, 6)
    k.rod(BRONZE, [s * 0.13, y + 0.65, -0.72], [s * 0.1, y + 0.4, -0.88], 0.055, 6)
  }
  k.rod(BRONZE, [0, y + 1.1, -0.45], [0, y + 1.62, -0.66], 0.16, 7)
  k.box(BRONZE, [0.2, 0.24, 0.48], [0, y + 1.66, -0.84], [-0.5, 0, 0])
  k.box(BRONZE, [0.05, 0.14, 0.08], [0, y + 1.82, -0.6])
  k.rod(BRONZE, [0, y + 1.0, 0.55], [0, y + 0.45, 0.78], 0.08, 6)
  // The rider.
  k.box(BRONZE, [0.34, 0.12, 0.3], [0, y + 1.24, 0.05])
  for (const s of [-1, 1]) k.rod(BRONZE, [s * 0.15, y + 1.24, 0.05], [s * 0.26, y + 0.88, -0.05], 0.05, 5)
  frustum(k, BRONZE, 0.3, 0.22, 0.55, 0.7, [0, y + 1.28, 0.1])
  k.sphere(BRONZE, 0.1, [0, y + 1.93, 0.08], [1, 1.1, 1], 8, 6)
  k.rod(BRONZE, [0.14, y + 1.75, 0.08], [0.22, y + 2.1, -0.15], 0.04, 5)
  k.rod(BRONZE, [0.22, y + 2.1, -0.15], [0.24, y + 2.7, -0.3], 0.02, 4)
  k.rod(BRONZE, [-0.14, y + 1.75, 0.08], [-0.18, y + 1.45, -0.3], 0.04, 5)
}

// A river cruiser moored at the wall: white hull with a navy band, a long glazed saloon lit
// from inside, the open top deck with its rail and benches, and the little wheelhouse.
function cruiser(k: PropKit) {
  const L = 13
  const navy: Look = { c: '#1f2d4a', r: 0.6 }
  k.box(WHITE, [2.6, 0.7, L], [0, 0.3, 0])
  k.box(navy, [2.64, 0.18, L + 0.02], [0, 0.18, 0])
  // Pointed bow: a three-sided prism, one corner forward.
  k.cyl(WHITE, 1.5, 1.5, 0.7, [0, 0.3, L / 2 + 0.75], undefined, 3)
  k.cyl(navy, 1.51, 1.51, 0.18, [0, 0.18, L / 2 + 0.75], undefined, 3)
  k.box(WHITE, [2.2, 0.85, L - 2.5], [0, 1.08, -0.6])
  for (const s of [-1, 1]) {
    k.box(WIN, [0.02, 0.5, L - 3], [s * 1.101, 1.12, -0.6])
    for (let i = 0; i <= 5; i++) k.box(WHITE, [0.04, 0.5, 0.1], [s * 1.11, 1.12, -0.6 - (L - 3) / 2 + i * ((L - 3) / 5)])
    k.box(navy, [0.04, 0.05, L - 2.5], [s * 1.11, 1.47, -0.6])
  }
  k.box({ c: '#cfd3d6', r: 0.7 }, [2.24, 0.06, L - 2.4], [0, 1.53, -0.6])
  // Top deck rail and benches, the wheelhouse forward.
  for (const s of [-1, 1]) {
    k.box(WHITE, [0.04, 0.04, L - 2.5], [s * 1.08, 1.98, -0.6])
    for (let i = 0; i <= 7; i++) k.box(WHITE, [0.03, 0.42, 0.03], [s * 1.08, 1.77, -0.6 - (L - 2.5) / 2 + i * ((L - 2.5) / 7)])
  }
  for (let i = 0; i < 5; i++) k.box({ c: '#3f6fa8', r: 0.7 }, [1.6, 0.25, 0.4], [0, 1.68, -5 + i * 1.6])
  k.box(WHITE, [1.6, 0.8, 1.2], [0, 1.95, 4.0])
  k.box(WIN, [1.4, 0.32, 0.02], [0, 2.1, 4.61])
  k.box(navy, [1.7, 0.08, 1.3], [0, 2.38, 4.0])
  k.box(WARM, [0.12, 0.12, 0.12], [0, 2.48, 4.0])
  k.cyl({ c: '#c8102e', r: 0.6 }, 0.07, 0.09, 0.6, [0, 1.85, -5.8], undefined, 8)
  for (const z of [-4.5, 0, 4.5]) k.torus({ c: '#e65100', r: 0.7 }, 0.18, 0.05, [1.34, 0.42, z], [0, Math.PI / 2, 0], Math.PI * 2, 10, 4)
}

export default function London({ len, race }: WorldProps) {
  const bayP = useProp('london-bay-d2', palaceBay)
  const clockP = useProp('london-clock', clockTower)
  const royalP = useProp('london-royal-d2', royalTower)
  const homes = useMemo(() => BRICKS.flatMap((c, i) => [prop(`london-terrace-d2-${i}-a`, (k) => terrace(k, c, false)), prop(`london-terrace-d2-${i}-b`, (k) => terrace(k, c, true))]), [])
  const phoneP = useProp('london-phone-d2', phoneBox)
  const busP = useProp('london-bus-d2', bus)
  const planeP = useProp('london-plane', plane)
  const embP = useProp('london-embankment-24', embankment)
  const statueP = useProp('london-statue', statue)
  const boatP = useProp('london-cruiser', cruiser)
  const p0 = race * 0.3
  const p1 = p0 + 66
  const RX = -(EDGE + 1.6)

  const geo = useMemo(() => {
    const r = rand(1031)
    const bays: Spot[] = []
    for (let z = p0 + 3; z < p1 - 3; z += 3) bays.push({ x: EDGE + 1.4 + 2, z, ry: -Math.PI / 2 })
    const rows: Spot[][] = homes.map(() => [])
    const phones: Spot[] = []
    const buses: Spot[] = []
    for (let z = -14; z < len + 40; z += 2.2) {
      if (z > p0 - 6 && z < p1 + 5) continue
      rows[Math.floor(r() * homes.length)].push({ x: EDGE + 1.4 + 1.5, z: z + 1.1, ry: -Math.PI / 2 })
    }
    for (let z = 16; z < len + 30; z += 9 + r() * 10) {
      if (z > p0 - 8 && z < p1 + 6) continue
      if (r() < 0.4) buses.push({ x: EDGE + 0.75, z, ry: 0 })
      else phones.push({ x: EDGE + 1.0, z, ry: -Math.PI / 2 })
    }
    const embs: Spot[] = []
    const trees: Spot[] = []
    for (let z = -14; z < len + 40; z += 6) {
      if ((z + 14) % 24 === 0) embs.push({ x: RX - 1.6, z: z + 12 })
      if (Math.abs(z + 3 - p0) > 3) trees.push({ x: RX - 0.4, z: z + 3, ry: r() * 6, s: 0.9 + r() * 0.25 })
    }
    return { bays, rows, phones, buses, embs, trees }
  }, [len, p0, p1, homes, RX])

  return (
    <>
      <Batch version={`london:${len}`} cell={24}>
        <mesh rotation-x={-Math.PI / 2} position={[EDGE + 0.7, 0.012, len / 2 + 5]}>
          <planeGeometry args={[1.4, len + 60]} />
          <meshStandardMaterial color="#8c8d8a" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[RX - 0.4, 0.012, len / 2 + 5]}>
          <planeGeometry args={[2.6, len + 60]} />
          <meshStandardMaterial color="#9a9a94" />
        </mesh>
        <group position={[EDGE + 1.9, 0, p0 - 2.4]}><PropMesh parts={clockP} /></group>
        <group position={[EDGE + 4.3, 0, p1 + 0.3]} rotation-y={-Math.PI / 2}><PropMesh parts={royalP} /></group>
        <group position={[RX - 0.15, 0, p0]} rotation-y={-1.2}><PropMesh parts={statueP} /></group>
        {[race * 0.16, race * 0.78].map((z) => <group key={z} position={[RX - 3.3, 0, z]}><PropMesh parts={boatP} /></group>)}
      </Batch>
      <Many parts={bayP} at={geo.bays} />
      {homes.map((h, i) => <Many key={i} parts={h} at={geo.rows[i]} />)}
      <Many parts={phoneP} at={geo.phones} />
      <Many parts={busP} at={geo.buses} />
      <Many parts={embP} at={geo.embs} />
      <Many parts={planeP} at={geo.trees} />
      <Water x={RX - 42} z={len / 2} w={80} d={len + 240} id="london" color="#5f7684" rough={0.2} />
      <Sparkles edge={RX - 2} />
      <Wheel x={RX - 30} z={race * 0.62} />
      <FarLondon />
    </>
  )
}

// The giant observation wheel on the far bank, its lit pods turning slowly.
function Wheel({ x, z }: { x: number; z: number }) {
  const R = 15
  const frame = useProp('london-wheel-frame', (k) => {
    const white: Look = { c: '#e8ecef', r: 0.5, m: 0.3 }
    for (const s of [-1, 1]) k.rod(white, [0, 0.5, s * 7], [0, R + 2, 0], 0.4, 8)
    k.box({ c: '#7d7f80', r: 0.8 }, [3, 1, 16], [0, 0.5, 0])
  })
  const wheel = useProp('london-wheel', (k) => {
    const white: Look = { c: '#e8ecef', r: 0.5, m: 0.3 }
    const pod = glow('#cfefff', 0.25, 1.3)
    k.torus(white, R, 0.22, [0, 0, 0], [0, Math.PI / 2, 0], Math.PI * 2, 48, 6)
    k.torus(white, R - 1.2, 0.14, [0, 0, 0], [0, Math.PI / 2, 0], Math.PI * 2, 48, 5)
    k.torus(glow('#5ab7ff', 0.2, 1.5), R - 0.6, 0.08, [0, 0, 0], [0, Math.PI / 2, 0], Math.PI * 2, 48, 4)
    k.cyl(white, 0.9, 0.9, 1.6, [0, 0, 0], [0, 0, Math.PI / 2], 12)
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2
      k.rod(white, [0, 0, 0], [0, Math.cos(a) * (R - 1.2), Math.sin(a) * (R - 1.2)], 0.04, 4)
      k.sphere(pod, 0.55, [0.7, Math.cos(a) * (R + 0.4), Math.sin(a) * (R + 0.4)], [0.8, 0.7, 1.3], 10, 6)
    }
  })
  const spin = useRef<Group>(null)
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.x += dt * 0.03
  })
  return (
    <group position={[x, 0, z]} rotation-y={0.6}>
      <PropMesh parts={frame} />
      <group ref={spin} position={[0, R + 2, 0]}><PropMesh parts={wheel} /></group>
    </group>
  )
}

// The bascule bridge across the river ahead: two Gothic towers, the high walkways, the blue
// suspension chains to the bank towers.
function FarLondon() {
  const parts = useProp('london-far', (k) => {
    const blue: Look = { c: '#5b8fb3', r: 0.5, m: 0.3 }
    const stone: Look = { c: '#c9c0a8', r: 0.85 }
    const z = 92
    const towers = [-44, -24]
    for (const tx of towers) {
      k.box({ c: '#7d7a72', r: 0.9 }, [8, 4, 7], [tx, 2, z])
      k.box(stone, [6, 22, 6], [tx, 15, z])
      for (let i = 0; i < 4; i++) k.box(WIN, [0.6, 1.8, 0.1], [tx, 8 + i * 4, z - 3.05])
      archTop(k, { c: '#22303a', r: 1 }, 3.4, 0.1, [tx, 6.5, z - 3.05])
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        k.cyl(stone, 0.8, 0.8, 24, [tx + sx * 3, 16, z + sz * 3], undefined, 8)
        frustum(k, SLATE, 1.8, 1.8, 3, 0, [tx + sx * 3, 28, z + sz * 3])
        k.cyl(GOLD, 0.06, 0.06, 1.2, [tx + sx * 3, 31.6, z + sz * 3], undefined, 4)
      }
      frustum(k, SLATE, 6.2, 6.2, 5, 0.2, [tx, 26, z])
      k.cyl(GOLD, 0.08, 0.08, 2, [tx, 32, z], undefined, 4)
    }
    // Road deck between and beyond the towers, and the two high walkways.
    k.box(blue, [80, 1.2, 5], [-34, 6.8, z])
    for (const dz of [-1.8, 1.8]) k.box(blue, [20, 2.2, 1.2], [-34, 24, z + dz])
    for (let i = 0; i < 10; i++) k.rod(blue, [-43 + i * 2, 23, z - 1.8], [-42 + i * 2, 25, z - 1.8], 0.12, 4)
    // The chains: a curved rod from each tower out to a bank tower, and a line of hangers.
    for (const [a, b] of [[-44, -70], [-24, 2]] as const) {
      const pts = 8
      for (let i = 0; i < pts; i++) {
        const t0 = i / pts
        const t1 = (i + 1) / pts
        const p = (t: number): [number, number, number] => [a + (b - a) * t, 23 - Math.sin(t * Math.PI * 0.9) * 10 - t * 6, z - 3.2]
        k.rod(blue, p(t0), p(t1), 0.35, 6)
        k.rod(blue, p(t0), [p(t0)[0], 7.4, z - 3.2], 0.08, 4)
      }
      k.box(stone, [3, 9, 3], [b, 4.5, z])
      frustum(k, SLATE, 3, 3, 2, 0, [b, 9, z])
    }
    // The city's lit towers beyond the river, one a tall glass shard.
    frustum(k, glow('#6f8aa3', 0.2, 0.3), 9, 9, 44, 0.05, [-58, 0, 122])
    for (let y = 3; y < 36; y += 3) frustum(k, glow('#ffe7b0', 0.05, 1.0), 9.06 * (1 - y / 46.3), 9.06 * (1 - y / 46.3), 0.3, 0.99, [-58, y, 122])
    const rr = rand(31)
    for (let i = 0; i < 9; i++) {
      const x = 6 + i * 7
      const h = 10 + rr() * 18
      k.box(glow('#5c6f82', 0.35, 0.35), [5, h, 5], [x, h / 2, 108 + rr() * 10])
      for (let y = 2; y < h - 1; y += 2.2) k.box(glow('#ffe7b0', 0.05, 1.2), [4.4, 0.22, 0.1], [x, y, 105.4])
    }
  })
  return (
    <Horizon>
      <PropMesh parts={parts} />
    </Horizon>
  )
}
