import { TILE } from './data'
import { cycle } from '../lib/cycle'

// What stands on each road tile's sidewalks: street lamps, fire hydrants and furniture (bins,
// mailboxes, bike racks...). The road renderer (World.tsx) draws them from here, and the walk
// graph (walkGraph.ts) bends the sidewalk paths round them, so townspeople step round a lamp
// post instead of walking through it.

export type Side = 'e' | 'w' | 's' | 'n'
export type PropKind = 'bin' | 'news' | 'mail' | 'bollards' | 'planter' | 'sign' | 'box' | 'bikes' | 'meter'
export const PROPS: PropKind[] = ['bin', 'news', 'mail', 'bollards', 'planter', 'sign', 'box', 'bikes', 'meter']

// A piece on side `side` of its tile, at (x, z) in that side's frame: x runs along the side,
// z out toward its edge (the tile's edge is at z = TILE / 2, the kerb at TILE / 2 - 0.4).
export type Furniture = { kind: 'lamp' | 'hydrant'; side: Side; x: number; z: number } | { kind: PropKind; side: Side; x: number; z: number }

const HALF = TILE / 2
// Lamps and hydrants stand out at the kerb, furniture back against the lawn edge, leaving the
// middle of the sidewalk (0.2 in from the tile's edge) for people.
export const KERB_Z = HALF - 0.32
export const PROP_Z = HALF - 0.1

// Each piece's footprint up to head height, in its own frame before it is placed: [x0, x1, z0, z1].
// Lamps take the widest of the three designs (Menu > Town picks one). streetFurniture.test.ts
// checks these against the models.
export const FOOTPRINT: Record<Furniture['kind'], [number, number, number, number]> = {
  lamp: [-0.17, 0.17, -0.17, 0.17],
  hydrant: [-0.105, 0.105, -0.11, 0.076],
  bikes: [-0.221, 0.221, -0.181, 0.176],
  bin: [-0.085, 0.085, -0.084, 0.084],
  news: [-0.161, 0.161, -0.063, 0.076],
  mail: [-0.083, 0.083, -0.096, 0.073],
  bollards: [-0.349, 0.349, -0.049, 0.049],
  planter: [-0.169, 0.169, -0.094, 0.094],
  sign: [-0.086, 0.086, -0.023, 0.023],
  box: [-0.141, 0.141, -0.076, 0.076],
  meter: [-0.181, 0.181, -0.033, 0.026],
}

// The road tile fields the choice depends on (see traffic/layout.ts, World.tsx Roads).
export type FurnitureTile = { x: number; z: number; arms: boolean[]; junction: boolean; oneWay: number; mate: number; xing: boolean[] }

// Sides in the arms' order (east, west, south, north).
const SIDES: Side[] = ['e', 'w', 's', 'n']

export function furnitureOf(t: FurnitureTile): Furniture[] {
  const { x, z, arms, junction, oneWay, mate, xing } = t
  const [e, w, s, n] = arms
  const straightX = !junction && (e || w) && !s && !n
  const straightZ = !junction && (s || n) && !e && !w
  const plain = (straightX || straightZ) && !xing.some(Boolean)
  const out: Furniture[] = []
  // Along the side, each stays clear of the sidewalk's corners, where paths turn and meet.
  const lamp = (side: Side) => out.push({ kind: 'lamp', side, x: 0.4, z: KERB_Z })
  const hydrant = (straightX || straightZ) && (x * 5 + z * 3) % 7 === 0
  if (hydrant) out.push({ kind: 'hydrant', side: straightX ? ((x + z) % 2 ? 'n' : 's') : ((x + z) % 2 ? 'w' : 'e'), x: -0.5, z: KERB_Z })
  // Street lamps every few tiles along straight roads, alternating sides.
  if ((straightX || straightZ) && !xing.some(Boolean) && (x * 7 + z * 5) % 3 === 0) lamp(straightX ? ((x + z) % 2 ? 's' : 'n') : ((x + z) % 2 ? 'e' : 'w'))
  // A lamp lighting the corner where a side road meets the street.
  if (junction && arms.filter(Boolean).length === 3) lamp(SIDES[arms.indexOf(false)])
  // Lamps go on the outside edge of an avenue.
  if (oneWay >= 0 && !xing.some(Boolean) && (x * 7 + z * 5) % 3 === 0) lamp(SIDES[mate ^ 1])
  // Furniture on some straight stretches, on the side without a lamp (and not beside a hydrant).
  if (plain && !hydrant && (x * 11 + z * 13) % 4 === 0) {
    out.push({ kind: cycle(PROPS, x * 5 + z * 3), side: straightX ? ((x + z) % 2 ? 'n' : 's') : ((x + z) % 2 ? 'w' : 'e'), x: -0.2, z: PROP_Z })
  }
  return out
}

// Turns a side's frame (+z toward that edge of the tile) into the tile's.
export const SIDE_ROT: Record<Side, number> = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }

// A piece's footprint as four corners in the tile's frame (x, z from the tile's middle).
export function footprintOf(f: Furniture): [number, number][] {
  const [x0, x1, z0, z1] = FOOTPRINT[f.kind]
  const r = SIDE_ROT[f.side]
  const c = Math.cos(r)
  const s = Math.sin(r)
  return ([[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as [number, number][]).map(([px, pz]) => {
    const lx = f.x + px
    const lz = f.z + pz
    // Three.js rotateY: x' = x cos + z sin, z' = -x sin + z cos.
    return [lx * c + lz * s, -lx * s + lz * c] as [number, number]
  })
}
