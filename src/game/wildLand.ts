import { PLOT, type BuildingDef } from './data'

// Newly bought land comes wild: old oaks, tall pines, boulders and bushes stand
// on it, and each has to be bulldozed (for coins) before anything can be built
// on its tile. The same plot always grows the same wild things, so a reload or a
// second device never reshuffles them.

export type Wild = { def: string; x: number; z: number }

// Pick weights: mostly trees, then rocks, then bushes.
const KINDS: [string, number][] = [['wildoak', 0.3], ['wildpine', 0.25], ['wildrock', 0.27], ['bush', 0.18]]

// A small seeded random (mulberry32) so the layout is fixed per plot.
function rand(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The wild things on plot (px, pz), in tile coordinates. Twelve to sixteen of them,
// grown in two or three clumps the way a real copse is, never two on one tile.
export function wildPlot(px: number, pz: number): Wild[] {
  const r = rand(Math.imul(px + 1000, 73856093) ^ Math.imul(pz + 1000, 19349663) ^ 0x5eed)
  const count = 12 + Math.floor(r() * 5)
  const clumps = Array.from({ length: 2 + Math.floor(r() * 2) }, () => [1 + r() * (PLOT - 2), 1 + r() * (PLOT - 2)])
  const used = new Set<string>()
  const out: Wild[] = []
  for (let tries = 0; out.length < count && tries < 400; tries++) {
    // Two in three grow round a clump, the rest stand on their own.
    const [cx, cz] = r() < 0.66 ? clumps[Math.floor(r() * clumps.length)] : [r() * PLOT, r() * PLOT]
    const lx = Math.floor(cx + (r() - 0.5) * 3.2)
    const lz = Math.floor(cz + (r() - 0.5) * 3.2)
    if (lx < 0 || lz < 0 || lx >= PLOT || lz >= PLOT) continue
    const x = px * PLOT + lx
    const z = pz * PLOT + lz
    if (used.has(`${x},${z}`)) continue
    used.add(`${x},${z}`)
    let pick = r()
    const def = KINDS.find(([, w]) => (pick -= w) < 0)?.[0] ?? 'bush'
    out.push({ def, x, z })
  }
  return out
}

// Coins to bulldoze one: its listed price, 6% more per level after 1, rounded to 5.
export const clearCost = (d: Pick<BuildingDef, 'price'>, level: number) =>
  Math.round((d.price * (1 + 0.06 * (Math.max(1, level) - 1))) / 5) * 5
