import { buildingDef, TILE } from '../game/data'
import { lotSize, type PlacedBuilding } from '../game/store'
import { toWorld } from './grid'

// The part of a town worth looking at, in world units: the box round its buildings
// and roads (trees and other decorations only count when there's nothing else),
// and its middle. Visits open on this, so the camera never starts out in the
// countryside beside someone's town.
export type Focus = { x: number; z: number; minX: number; minZ: number; maxX: number; maxZ: number }

export function townFocus(town: { buildings: PlacedBuilding[]; roads: string[] }): Focus | null {
  const tiles: [number, number, number, number][] = []
  const add = (bs: PlacedBuilding[]) => {
    for (const b of bs) {
      if (b.stored) continue
      const [w, h] = lotSize(b.def, b.rot)
      tiles.push([b.x, b.z, b.x + w - 1, b.z + h - 1])
    }
  }
  add(town.buildings.filter((b) => buildingDef(b.def).kind !== 'decor'))
  for (const r of town.roads) {
    const [x, z] = r.split(',').map(Number)
    if (Number.isFinite(x) && Number.isFinite(z)) tiles.push([x, z, x, z])
  }
  if (!tiles.length) add(town.buildings)
  if (!tiles.length) return null
  const lo = toWorld(Math.min(...tiles.map((t) => t[0])), Math.min(...tiles.map((t) => t[1])))
  const hi = toWorld(Math.max(...tiles.map((t) => t[2])), Math.max(...tiles.map((t) => t[3])))
  const box = { minX: lo[0] - TILE / 2, minZ: lo[1] - TILE / 2, maxX: hi[0] + TILE / 2, maxZ: hi[1] + TILE / 2 }
  return { ...box, x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 }
}
