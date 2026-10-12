import { TILE } from './data'
import { growthStage } from './growth'

// A merged gas station at its last form (level 7-10) is no longer one station
// drawn bigger: it's a Big Bison travel stop built for the whole block, with
// rows of pumps under one long canopy and a big store people walk into. The
// model (src/scene/TravelCenter.tsx) and the townspeople (who walk in through
// its doors) both lay it out from here, in true units on the block's own
// frame: x along its front, z out of the front (+z faces the road).

export const isTravelCenter = (def: string, level: number, scale: readonly number[]) =>
  def === 'gas' && growthStage(level) === 3 && (scale[0] !== 1 || scale[2] !== 1)

type Rect = { x: number; z: number; w: number; d: number }
export type TravelLayout = {
  L: number
  D: number
  store: Rect & { h: number }
  // Where people step in: just in front of the doors, under the porch.
  door: [number, number]
  canopy: Rect
  // Pump islands, each running along x.
  islands: { x: number; z: number }[]
  // Parking bays beside the store, each facing the store.
  bays: { x: number; z: number }[]
  // The tall sign out front, and the bison statue people pose with.
  pylon: [number, number]
  statue: [number, number, number] | null
}

export const ISLAND = 1.3
const ROW = 0.8
const GAP = 0.55
// Half the width of the walk kept clear from the street to the doors.
const AISLE = 0.3

// `sx`, `sz`: the block's scale on the gas station's own 2x1 lot.
export function travelLayout(sx: number, sz: number): TravelLayout {
  const L = 2 * TILE * sx
  const D = TILE * sz
  const front = D / 2
  const back = -D / 2
  // A shallow pair (two lots side by side) has the store at one end; a deep
  // block has it across the back, with the pumps out front.
  const deep = D >= 3.5
  // A narrow block centres its store; a wide one keeps the left for parking.
  const wide = L >= 6
  const sw = !deep ? 2.7 : wide ? Math.min(L * 0.58, 7.2) : L - 0.6
  const sd = deep ? Math.min(Math.max(D * 0.3, 1.35), 2.4) : 1.35
  const sh = deep ? Math.min(1.5 + sd * 0.25, 2.1) : 1.55
  const store = { x: deep && !wide ? 0 : L / 2 - sw / 2 - 0.25, z: back + 0.2 + sd / 2, w: sw, d: sd, h: sh }
  const porch = store.z + sd / 2 + 0.42
  const door: [number, number] = [store.x, porch - 0.12]
  const canopy = deep
    ? { x: wide ? 0.5 : 0, z: (porch + 0.45 + front - 0.3) / 2, w: wide ? L - 1.6 : L - 0.6, d: front - 0.3 - (porch + 0.45) }
    : { x: (-L / 2 + 0.35 + store.x - sw / 2 - 0.45) / 2, z: -0.15, w: store.x - sw / 2 - 0.45 - (-L / 2 + 0.35), d: 1.5 }
  const islands: { x: number; z: number }[] = []
  const rows = Math.max(1, Math.floor((canopy.d + 0.45) / ROW))
  // Columns of islands either side of the walk to the doors.
  const segs: [number, number][] = deep
    ? [[canopy.x - canopy.w / 2, door[0] - AISLE], [door[0] + AISLE, canopy.x + canopy.w / 2]]
    : [[canopy.x - canopy.w / 2, canopy.x + canopy.w / 2]]
  for (const [lo, hi] of segs) {
    const cols = Math.floor((hi - lo + GAP) / (ISLAND + GAP))
    for (let c = 0; c < cols; c++) {
      const x = (lo + hi) / 2 + (c - (cols - 1) / 2) * (ISLAND + GAP)
      for (let r = 0; r < rows; r++) islands.push({ x, z: canopy.z + (r - (rows - 1) / 2) * ROW })
    }
  }
  const bays: { x: number; z: number }[] = []
  if (deep) {
    const left = -L / 2 + 0.35
    const right = store.x - sw / 2 - 0.3
    for (let x = left + 0.3; x + 0.3 <= right; x += 0.55) bays.push({ x, z: store.z })
  }
  // Both stand on the strip by the road left of the canopy (a shallow pair's
  // bison stands by the store's side wall; a narrow block has no room for one).
  const pylon: [number, number] = !deep ? [-L / 2 + 0.3, front - 0.25] : wide ? [-L / 2 + 0.5, front - 0.35] : [L / 2 - 0.15, back + 0.2]
  const statue: [number, number, number] | null = !deep ? [store.x - sw / 2 - 0.05, 0.05, store.z] : wide ? [-L / 2 + 0.5, 0.05, porch + 0.75] : null
  return { L, D, store, door, canopy, islands, bays, pylon, statue }
}
