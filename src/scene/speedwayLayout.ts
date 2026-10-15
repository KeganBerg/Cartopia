import { Color, DoubleSide, MeshStandardMaterial } from 'three'

// The Speedway's layout, shared by its model (BuildingModel, BuildingDetail)
// and the race and seats inside it (SpeedwayLife).

// Track and terraces, in the model's own units (see the 'stadium' model).
export const TRACK = { inner: 1.04, outer: 1.7, lane: 1.4 }
// A grandstand of three stepped rows of seats behind a barrier wall at the
// track's edge: [front, back) radius and seat height. Fans sit on them.
export const BARRIER = { r: 1.7, t: 0.02, h: 0.2 }
export const TIERS = [{ r0: 1.72, r1: 1.795, y: 0.14 }, { r0: 1.795, r1: 1.87, y: 0.27 }, { r0: 1.87, r1: 1.95, y: 0.4 }]
// The upper deck (level 7 up): two more rows on a stepped balcony hung off the glass.
export const DECK = { t: 0.03, rows: [{ r0: 1.72, r1: 1.835, y: 1.0 }, { r0: 1.835, r1: 1.95, y: 1.13 }] }
export const deckAt = (lvl: number) => lvl >= 7
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

