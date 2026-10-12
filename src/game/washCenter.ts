import { TILE } from './data'
import { growthStage } from './growth'

// A merged car wash at its last form (level 7-10, the Bubble Car Spa) is built
// for the whole block: express wash tunnels along the back, cars queueing at
// the pay kiosks, and rows of vacuum bays out front. Laid out here in true
// units on the block's frame (x along its front, +z towards the road); drawn
// by src/scene/WashCenter.tsx.

export const isWashCenter = (def: string, level: number, scale: readonly number[]) =>
  def === 'carwash' && growthStage(level) === 3 && (scale[0] !== 1 || scale[2] !== 1)

export type WashLayout = {
  L: number
  D: number
  // Tunnels run along x, cars go in at x0 and come out at x1.
  tunnels: { x0: number; x1: number; z: number }[]
  // Vacuum bays: each a car's space with a post beside it. Nose to the back
  // on a deep block; parked along the front on a shallow pair (`along`).
  vacs: { x: number; z: number }[]
  along: boolean
  pylon: [number, number]
}

export const TUNNEL_D = 0.95
const BAY = 0.9
const ROW = 1.25

export function washLayout(sx: number, sz: number): WashLayout {
  const L = 2 * TILE * sx
  const D = TILE * sz
  const back = -D / 2
  const front = D / 2
  // One tunnel, or two side by side on a big block; the kiosks and the queue
  // take the left end, the exit apron the right.
  const n = D >= 7 ? 2 : 1
  const x0 = -L / 2 + Math.min(1.4, L * 0.22)
  const x1 = L / 2 - Math.min(0.8, L * 0.12)
  const tunnels = Array.from({ length: n }, (_, i) => ({ x0, x1, z: back + 0.2 + TUNNEL_D / 2 + i * (TUNNEL_D + 0.55) }))
  const behind = tunnels[n - 1].z + TUNNEL_D / 2 + 0.2
  const vacs: { x: number; z: number }[] = []
  const along = front - behind < 1.3
  if (along) {
    for (let x = -L / 2 + 1.1; x + 0.6 <= L / 2 - 0.2; x += 1.3) vacs.push({ x, z: (behind + front) / 2 })
  } else {
    const rows = Math.max(1, Math.floor((front - 0.05 - behind) / ROW))
    for (let r = 0; r < rows; r++) {
      const z = behind + 0.6 + r * ROW
      for (let x = -L / 2 + 1.0; x + 0.45 <= L / 2 - 0.2; x += BAY) vacs.push({ x, z })
    }
  }
  return { L, D, tunnels, vacs, along, pylon: [-L / 2 + 0.3, front - 0.3] }
}
