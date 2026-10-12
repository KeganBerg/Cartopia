import { TILE } from './data'
import { growthStage } from './growth'

// A merged motel at its last form (level 7-10) is built for the whole block
// as a resort: hotel wings wrapped round a pool deck, with the lobby out front
// under a drop-off canopy where guests walk in. Laid out here in true units on
// the block's frame (x along its front, +z towards the road); drawn by
// src/scene/ResortCenter.tsx, and the townspeople walk in at `door` (see
// storeDoors).

export const isResort = (def: string, level: number, scale: readonly number[]) =>
  def === 'motel' && growthStage(level) === 3 && (scale[0] !== 1 || scale[2] !== 1)

export type Rect = { x: number; z: number; w: number; d: number }
export type ResortLayout = {
  L: number
  D: number
  // The tall hotel wing, and the low wings either side of the deck.
  wing: Rect
  sides: Rect[]
  // The lobby (null on a shallow pair: the doors are in the wing) and its canopy.
  lobby: Rect | null
  door: [number, number]
  deck: Rect
  pool: Rect
  // Sun loungers: position and which way they face (+1 towards +z).
  loungers: { x: number; z: number; face: 1 | -1 }[]
  palms: [number, number][]
  // The tiki bar at one end of the deck, when there's room.
  bar: [number, number] | null
  // Where the water slide stands, at the other end.
  slide: [number, number] | null
}

export function resortLayout(sx: number, sz: number): ResortLayout {
  const L = 2 * TILE * sx
  const D = TILE * sz
  const back = -D / 2
  const front = D / 2
  const deep = D >= 3.5
  let wing: Rect, lobby: Rect | null, door: [number, number], deck: Rect
  const sides: Rect[] = []
  if (!deep) {
    // A shallow pair: the hotel at the right-hand end, the pool deck beside it.
    const hw = Math.min(3.4, L * 0.42)
    wing = { x: L / 2 - 0.25 - hw / 2, z: back + 0.2 + 0.65, w: hw, d: 1.3 }
    lobby = null
    door = [wing.x, wing.z + wing.d / 2 + 0.12]
    const x0 = -L / 2 + 0.25
    const x1 = wing.x - hw / 2 - 0.2
    deck = { x: (x0 + x1) / 2, z: 0, w: x1 - x0, d: D - 0.5 }
  } else {
    const wd = Math.min(Math.max(D * 0.2, 0.9), 1.6)
    wing = { x: 0, z: back + 0.2 + wd / 2, w: L - 0.4, d: wd }
    const z0 = wing.z + wd / 2 + 0.15
    let z1 = front - 0.3
    let x0 = -L / 2 + 0.2
    let x1 = L / 2 - 0.2
    if (L >= 6) {
      const sw = Math.min(1.1, L * 0.12)
      for (const sd of [-1, 1]) sides.push({ x: sd * (L / 2 - 0.2 - sw / 2), z: (wing.z + wd / 2 + front - 0.3) / 2, w: sw, d: front - 0.3 - (wing.z + wd / 2) })
      x0 += sw + 0.15
      x1 -= sw + 0.15
    }
    if (D >= 6) {
      // A big block: the lobby out front, set back behind the drop-off drive.
      const ld = 0.7
      lobby = { x: 0, z: front - 0.85 - ld / 2, w: Math.min(2.4, L * 0.42), d: ld }
      door = [0, lobby.z + ld / 2 + 0.12]
      z1 = lobby.z - ld / 2 - 0.15
    } else if (sides.length) {
      // The doors are in the front end of the right-hand wing.
      lobby = null
      door = [sides[1].x, front - 0.3 + 0.12]
    } else {
      // A narrow block: a little lobby pavilion at the front corner.
      lobby = { x: L / 2 - 0.2 - 0.5, z: front - 0.3 - 0.3, w: 1.0, d: 0.6 }
      door = [lobby.x, front - 0.3 + 0.12]
      x1 = lobby.x - lobby.w / 2 - 0.15
    }
    deck = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 }
  }
  // The pool: inset from the deck, leaving a walk round it for the loungers.
  const ends = deck.w >= 4 ? 0.9 : 0.45
  const pool = { x: deck.x, z: deck.z - (deep ? 0 : 0.05), w: deck.w - 2 * ends, d: Math.min(Math.max(deck.d - 0.9, 0.5), deck.d * 0.6) }
  const loungers: ResortLayout['loungers'] = []
  const rim = (deck.d - pool.d) / 2
  if (rim >= 0.3) {
    for (let x = pool.x - pool.w / 2 + 0.2; x <= pool.x + pool.w / 2 - 0.2; x += 0.42) {
      loungers.push({ x, z: pool.z + pool.d / 2 + Math.min(rim, 0.6) / 2 + 0.02, face: -1 })
      if (rim >= 0.45 && deep) loungers.push({ x, z: pool.z - pool.d / 2 - Math.min(rim, 0.6) / 2 - 0.02, face: 1 })
    }
  }
  const palms: [number, number][] = []
  const px = [deck.x - deck.w / 2 + 0.22, deck.x + deck.w / 2 - 0.22]
  for (const x of px) palms.push([x, deck.z + deck.d / 2 - 0.22])
  if (deep) for (const x of px) palms.push([x, deck.z - deck.d / 2 + 0.22])
  const bar: [number, number] | null = ends >= 0.9 ? [deck.x - deck.w / 2 + ends / 2, deck.z] : null
  const slide: [number, number] | null = ends >= 0.9 ? [deck.x + deck.w / 2 - ends / 2, deck.z] : null
  return { L, D, wing, sides, lobby, door, deck, pool, loungers, palms, bar, slide }
}
