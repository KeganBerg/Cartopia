import { buildingLevel } from './data'
import { mergeGroups, groupParts, groupScale, groupTurn } from './merge'
import type { PlacedBuilding } from './store'
import { toWorld } from '../scene/grid'
import { isTravelCenter, travelLayout } from './travelCenter'
import { isMarketCenter, marketLayout } from './marketCenter'
import { isResort, resortLayout } from './resortCenter'

type Pt = [number, number]

// The merged block forms with a big store (or lobby) people walk into, and where its
// doors are on the block's own frame (x along its front, +z towards the road).
const STORES: Record<string, { is: (def: string, level: number, scale: readonly number[]) => boolean; door: (sx: number, sz: number) => { D: number; door: [number, number] } }> = {
  gas: { is: isTravelCenter, door: travelLayout },
  market: { is: isMarketCenter, door: marketLayout },
  motel: { is: isResort, door: resortLayout },
}
export const STORE_DEFS = Object.keys(STORES)

// Where townspeople go in: for every member of a merged big store (keyed like
// the walk graph's building nodes, `b<uid>`), the walk from the street edge of
// the lot in front of the doors to the doors, in town coordinates.
export function storeDoors(buildings: PlacedBuilding[], roads: Set<string>) {
  const out = new Map<string, Pt[]>()
  for (const g of mergeGroups(buildings).groups.values()) {
    const kind = STORES[g.anchor.def]
    if (!kind) continue
    const turn = groupTurn(g, roads)
    const scale = groupScale(g, turn)
    if (!kind.is(g.anchor.def, buildingLevel(g.anchor), scale)) continue
    const t = kind.door(scale[0], scale[2])
    const a = (turn * Math.PI) / 2
    const c = Math.cos(a), s = Math.sin(a)
    // A 2x4 is two stores side by side: each building walks to the doors of its own half.
    const parts = groupParts(g, turn)
    const walks = parts.map(({ at: [px, pz] }) => {
      const [cx, cz] = toWorld(g.x + (g.w - 1) / 2 + px, g.z + (g.h - 1) / 2 + pz)
      const at = ([x, z]: Pt): Pt => [cx + x * c + z * s, cz - x * s + z * c]
      return [at([t.door[0], t.D / 2 - 0.12]), at(t.door)]
    })
    const mx = g.x + g.w / 2, mz = g.z + g.h / 2
    for (const b of g.members) out.set(`b${b.uid}`, walks[parts.length > 1 && (g.code === 42 ? b.x >= mx : b.z >= mz) ? 1 : 0])
  }
  return out
}
