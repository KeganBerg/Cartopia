import type { Intersection, Material, Mesh, Object3D } from 'three'
import { prunedAway } from './pruned'

// Which object a tap on the town really lands on. A tap's ray passes through
// everything under the finger, nearest first, and the nearest thing can be a
// neighbour's faint shadow sheet, glow or hidden part that nobody can see. So
// the nearest *solid* hit wins: something drawn (or hidden only because the
// town drew it merged, or its group emptied by the merge, see Batch) with a material that shows.

const faint = (m: Material | Material[] | undefined) => {
  const mats = Array.isArray(m) ? m : m ? [m] : []
  return mats.length > 0 && mats.every((x) => !x.visible || (x.transparent && x.opacity < 0.5) || !x.depthWrite)
}

const shown = (o: Object3D) => {
  for (let x: Object3D | null = o; x; x = x.parent) if (!x.visible && !x.userData.batched && !prunedAway(x)) return false
  return true
}

export const solidHit = (o: Object3D) => shown(o) && !faint((o as Mesh).material)

export function firstSolid<T extends Pick<Intersection, 'object'>>(hits: T[]): T | undefined {
  return hits.find((h) => solidHit(h.object))
}

// True when the tap's first solid hit is part of `owner` (a building's group).
export function tapOwnedBy(hits: Pick<Intersection, 'object'>[], owner: Object3D) {
  const hit = firstSolid(hits)
  if (!hit) return false
  for (let x: Object3D | null = hit.object; x; x = x.parent) if (x === owner) return true
  return false
}
