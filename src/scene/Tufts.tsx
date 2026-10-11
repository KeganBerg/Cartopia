import { useMemo } from 'react'
import { PLOT, TILE } from '../game/data'
import { lotSize, type PlacedBuilding } from '../game/store'
import { toWorld } from './grid'
import { PAL, SEASON } from './season'
import { shade } from './flora'
import { Scatter, push, type Shape, type Spot } from './Outskirts'

// Lawn detail on empty tiles of the player's land: grass clumps in the season's
// greens, wildflower drifts in spring and summer, leaf heaps and the odd
// mushroom ring in the fall, snow drifts with dry grass poking through in
// winter, and a few pebbles. Each kind is one instanced draw for the whole town,
// all kept low so nothing hides a spot you might build on.

// Small deterministic hash so the lawn stays put between loads.
const hash = (x: number, z: number, k: number) => {
  let h = (x * 374761393 + z * 668265263 + k * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const winter = SEASON === 'winter'
const GREENS = winter ? ['#c9b98f', '#bfae84', '#d6c79d'] : [shade(PAL.grass, -0.1), shade(PAL.grass, 0.06), PAL.grassSpeckle[2], PAL.grassSpeckle[3], shade(PAL.grass, -0.16)]
const BLOOMS = SEASON === 'spring' ? ['#fff59d', '#ffffff', '#f8bbd0', '#ce93d8'] : SEASON === 'summer' ? ['#fdd835', '#ffffff', '#ffffff', '#ec407a'] : []
const STONE = ['#ffffff', '#e8e8e8', '#d6d6d6']

export function GrassTufts({ land, roads, buildings }: { land: string[]; roads: string[]; buildings: PlacedBuilding[] }) {
  // Only footprints matter, so job timers ticking on buildings don't rebuild this.
  const lots = buildings.map((b) => {
    const [w, h] = lotSize(b.def, b.rot)
    return `${b.x},${b.z},${w},${h}`
  }).join(';')
  const sets = useMemo(() => {
    const used = new Set(roads)
    for (const l of lots ? lots.split(';') : []) {
      const [bx, bz, w, h] = l.split(',').map(Number)
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) used.add(`${bx + i},${bz + j}`)
    }
    const sets: Partial<Record<Shape, Spot[]>> = {}
    const spot = (wx: number, wz: number, x: number, z: number, k: number, spread = 0.85) =>
      [wx + (hash(x, z, k) - 0.5) * TILE * spread, wz + (hash(x, z, k + 101) - 0.5) * TILE * spread] as const
    for (const key of land) {
      const [px, pz] = key.split(',').map(Number)
      for (let x = px * PLOT; x < px * PLOT + PLOT; x++)
        for (let z = pz * PLOT; z < pz * PLOT + PLOT; z++) {
          if (used.has(`${x},${z}`)) continue
          const [wx, wz] = toWorld(x, z)
          const tufts = winter ? Math.floor(hash(x, z, 0) * 2) : 3 + Math.floor(hash(x, z, 0) * 3)
          for (let t = 0; t < tufts; t++) {
            const [cx, cz] = spot(wx, wz, x, z, t + 1)
            push(sets, 'tuft', { x: cx, z: cz, ry: hash(x, z, t + 30) * 6, s: 1 + hash(x, z, t + 40) * 0.6, sy: 0.7 + hash(x, z, t + 50) * 0.6, tint: GREENS[(x + z + t) % GREENS.length] })
          }
          const roll = hash(x, z, 7)
          if (BLOOMS.length && roll < 0.22) {
            const col = BLOOMS[Math.floor(hash(x, z, 8) * BLOOMS.length)]
            const [cx, cz] = spot(wx, wz, x, z, 9, 0.5)
            for (let f = 0; f < 6; f++)
              push(sets, 'flower', { x: cx + (hash(x, z, f + 60) - 0.5) * 0.7, z: cz + (hash(x, z, f + 70) - 0.5) * 0.7, ry: f, s: 0.7 + hash(x, z, f + 80) * 0.4, tint: col })
          }
          if ((SEASON === 'fall' || winter) && roll > 0.86) {
            const [cx, cz] = spot(wx, wz, x, z, 11, 0.6)
            push(sets, 'heap', { x: cx, z: cz, ry: hash(x, z, 12) * 6, s: 0.6 + hash(x, z, 13) * 0.5 })
          }
          if (SEASON === 'fall' && roll > 0.5 && roll < 0.53) {
            const [cx, cz] = spot(wx, wz, x, z, 14, 0.4)
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2
              push(sets, 'mushroom', { x: cx + Math.cos(a) * 0.3, z: cz + Math.sin(a) * 0.3, ry: a, s: 0.7 + hash(x, z, i + 90) * 0.5 })
            }
          }
          if (hash(x, z, 15) < 0.12) {
            const [cx, cz] = spot(wx, wz, x, z, 16)
            push(sets, 'rock', { x: cx, z: cz, ry: hash(x, z, 17) * 6, s: 0.22 + hash(x, z, 18) * 0.2, sy: 0.7, tint: STONE[(x + z) % 3] })
          }
        }
    }
    return sets
  }, [land, roads, lots])
  return <Scatter sets={sets} />
}
