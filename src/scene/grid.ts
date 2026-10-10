import { GRID, TILE } from '../game/data'

// World position of a tile's centre, with the grid centred on the origin.
export const toWorld = (x: number, z: number): [number, number] => [
  (x - (GRID - 1) / 2) * TILE,
  (z - (GRID - 1) / 2) * TILE,
]

export const toTile = (wx: number, wz: number): [number, number] => [
  Math.round(wx / TILE + (GRID - 1) / 2),
  Math.round(wz / TILE + (GRID - 1) / 2),
]

export const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
