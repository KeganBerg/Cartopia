import { createContext, useContext, type ReactNode } from 'react'
import { TILE, type BuildingDef } from '../game/data'
import { TrueSize, useMergeScale } from './mergeScale'
import { doorTag, type DoorKind } from './doors'

// Rows in the middle of a big block face a lane inside it, out of the street's
// reach: their doors are drawn but not offered to townspeople (doors.ts).
const InnerRow = createContext(false)
// A home's front-door tag, or none for a home on an inner row.
export const useDoorTag = (kind?: DoorKind) => (useContext(InnerRow) ? undefined : doorTag(kind))

// Merged homes are a street of real-size homes, never one home blown up: a
// pair is two homes side by side, a 2x2 four homes back to back, a 4x4 four
// rows of four. Rows alternate which way they face, so every home has a front
// garden on a street and its back yard against the next row's.
export function HomeBlock({ def, children }: { def: BuildingDef; children: ReactNode }) {
  const [sx, , sz] = useMergeScale()
  const nx = Math.round(sx), nz = Math.round(sz)
  if (nx <= 1 && nz <= 1) return children
  const W = def.w * TILE, D = def.h * TILE
  const homes: ReactNode[] = []
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    // Back rows of each back-to-back pair face away from the road.
    const away = nz > 1 && (nz - 1 - j) % 2 === 1
    homes.push(
      <group key={`${i},${j}`} position={[(i - (nx - 1) / 2) * W, 0, (j - (nz - 1) / 2) * D]} rotation-y={away ? Math.PI : 0}>
        <InnerRow.Provider value={j > 0 && j < nz - 1}>{children}</InnerRow.Provider>
      </group>,
    )
  }
  return <TrueSize>{homes}</TrueSize>
}
