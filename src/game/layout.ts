// Town is a square grid of tiles. A ring road runs around the edge plus a cross
// through the middle; everything else is a building lot.
export const GRID = 12
export const TILE = 2

export type Tile = { x: number; z: number; kind: 'road' | 'lot' }

const isRoad = (x: number, z: number) =>
  x === 0 || z === 0 || x === GRID - 1 || z === GRID - 1 || x === GRID / 2 || z === GRID / 2

export const tiles: Tile[] = Array.from({ length: GRID * GRID }, (_, i) => {
  const x = i % GRID
  const z = Math.floor(i / GRID)
  return { x, z, kind: isRoad(x, z) ? 'road' : 'lot' }
})

// World position of a tile's centre, with the grid centred on the origin.
export const toWorld = (x: number, z: number): [number, number] => [
  (x - (GRID - 1) / 2) * TILE,
  (z - (GRID - 1) / 2) * TILE,
]

// Closed loop of tile coordinates cars drive along (the outer ring road).
export const ringPath: [number, number][] = (() => {
  const n = GRID - 1
  const path: [number, number][] = []
  for (let x = 0; x < n; x++) path.push([x, 0])
  for (let z = 0; z < n; z++) path.push([n, z])
  for (let x = n; x > 0; x--) path.push([x, n])
  for (let z = n; z > 0; z--) path.push([0, z])
  return path
})()
