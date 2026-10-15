import { Color, DoubleSide, MeshStandardMaterial } from 'three'

// The Speedway's layout, shared by its model (BuildingModel, BuildingDetail)
// and the race and crowd inside it (SpeedwayLife).

// Track and terraces, in the model's own units (see the 'stadium' model).
export const TRACK = { inner: 1.04, outer: 1.7, lane: 1.4 }
export const TERRACE = { front: { r: 1.755, y: 0.1 }, back: { r: 1.835, y: 0.28 }, edge: 1.81 }
// The upper deck (level 9 up): a balcony hung off the glass over the back row.
export const DECK = { r0: 1.72, y: 1.24, t: 0.04, fans: 1.835 }
export const deckAt = (lvl: number) => lvl >= 9
// The stands' arc, the same as the wall's.
export const ARC0 = Math.PI * 0.15
export const ARC = Math.PI * 1.1

// The wall's glass: clear with a hint of the building's colour, one material per colour.
const glass = new Map<string, MeshStandardMaterial>()
export function speedwayGlass(tint: string) {
  let g = glass.get(tint)
  if (!g) {
    g = new MeshStandardMaterial({ color: new Color('#cfe8ff').lerp(new Color(tint), 0.35), transparent: true, opacity: 0.3, depthWrite: false, side: DoubleSide, roughness: 0.08, metalness: 0.1 })
    glass.set(tint, g)
  }
  return g
}

