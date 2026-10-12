import { TILE } from './data'
import { growthStage } from './growth'

// A merged Fresh Mart at its last form (level 7-10) is built for the whole
// block as a supercenter: one long store across the back with a garden centre
// beside it, and a car park out front that shoppers cross to the doors. Laid
// out here in true units on the block's frame (x along its front, +z towards
// the road); drawn by src/scene/MarketCenter.tsx, and the townspeople walk in
// through `door` (see storeDoors).

export const isMarketCenter = (def: string, level: number, scale: readonly number[]) =>
  def === 'market' && growthStage(level) === 3 && (scale[0] !== 1 || scale[2] !== 1)

type Rect = { x: number; z: number; w: number; d: number }
export type MarketLayout = {
  L: number
  D: number
  store: Rect & { h: number }
  door: [number, number]
  // Parking bays: `face` 1 parks nose to the road, -1 nose to the store.
  bays: { x: number; z: number; face: 1 | -1 }[]
  // Lamp posts in the car park.
  lamps: [number, number][]
  garden: Rect | null
  pylon: [number, number]
  // Trees on the planted strip along the road.
  trees: number[]
}

export const BAY_W = 0.62
export const BAY_D = 1.15
const AISLE = 0.6
// Half the width of the crossing kept clear from the street to the doors.
const WALK = 0.42

export function marketLayout(sx: number, sz: number): MarketLayout {
  const L = 2 * TILE * sx
  const D = TILE * sz
  const back = -D / 2
  const front = D / 2
  const deep = D >= 3.5
  const wide = L >= 6
  const gw = deep && wide ? Math.min(2.2, L * 0.18) : 0
  const sw = !deep ? Math.min(3.2, L * 0.42) : L - 0.6 - (gw ? gw + 0.2 : 0)
  const sd = deep ? Math.min(Math.max(D * 0.3, 1.2), 2.6) : 1.4
  const sh = Math.min(1.35 + sd * 0.2, 1.9)
  // Centred on a narrow block, else pushed to the right-hand end.
  const store = { x: deep && !wide ? 0 : L / 2 - 0.3 - sw / 2, z: back + 0.2 + sd / 2, w: sw, d: sd, h: sh }
  const zf = store.z + sd / 2
  const door: [number, number] = [store.x, zf + (deep ? 0.3 : 0.12)]
  const garden = gw ? { x: -L / 2 + 0.3 + gw / 2, z: store.z, w: gw, d: Math.min(sd, 2.2) } : null
  const bays: MarketLayout['bays'] = []
  const lamps: [number, number][] = []
  const trees: number[] = []
  const strip = 0.3
  const cols = (lo: number, hi: number) => {
    const out: number[] = []
    for (let x = lo + BAY_W / 2; x + BAY_W / 2 <= hi; x += BAY_W) if (Math.abs(x - door[0]) > WALK + BAY_W / 2) out.push(x)
    return out
  }
  if (deep) {
    // Rows of bays out front, back to back in pairs with a drive aisle
    // between each pair, leaving a planted strip along the road.
    let z = zf + 0.35 + AISLE
    const limit = front - strip
    const heads = L > 9 ? [-L / 2 + 0.4, door[0] - WALK + 0.06, L / 2 - 0.4] : [-L / 2 + 0.4, L / 2 - 0.4]
    for (let r = 0; z + BAY_D <= limit; r++) {
      const face = r % 2 ? 1 : -1
      for (const x of cols(-L / 2 + 0.6, L / 2 - 0.6)) bays.push({ x, z: z + BAY_D / 2, face })
      // Lamps stand between each back-to-back pair of rows (or by a lone row).
      if (face === 1 || z + 2 * BAY_D > limit) for (const x of heads) lamps.push([x, face === 1 ? z : z + BAY_D / 2])
      z += BAY_D + (face === 1 ? AISLE : 0)
    }
    for (let x = -L / 2 + 0.6; x <= L / 2 - 0.6; x += 1.4) if (Math.abs(x - door[0]) > WALK + 0.3) trees.push(x)
  } else {
    // A shallow pair: the store at one end, one row of bays beside it.
    for (const x of cols(-L / 2 + 0.3, store.x - sw / 2 - 0.25)) bays.push({ x, z: 0, face: 1 })
    lamps.push([store.x - sw / 2 - 0.12, front - 0.2])
  }
  const pylon: [number, number] = deep ? [-L / 2 + 0.25, front - 0.2] : [-L / 2 + 0.22, front - 0.2]
  return { L, D, store, door, bays, lamps, garden, pylon, trees }
}
