import { createContext, useContext, type ReactNode } from 'react'

// A merged block draws one building scaled up (see groupScale in game/merge.ts),
// and a 1x2 pair stretches it 2x one way only. Props that must keep their real
// shape, like cars, read the scale here and undo it.
export const MergeScale = createContext<[number, number, number]>([1, 1, 1])
export const useMergeScale = () => useContext(MergeScale)

// Keeps its children in true proportion inside a merged building, at the
// block's smaller ground scale: a 2x2 block's display car stays 2x like the
// rest of the building, a pair's stays normal size instead of stretched.
// Put it outside any rotation, so the undo lines up with the building's axes.
export function Upright({ children, size }: { children: ReactNode; size?: number }) {
  const [sx, sy, sz] = useMergeScale()
  if (sx === 1 && sy === 1 && sz === 1) return <>{children}</>
  const k = size ?? Math.min(sx, sz)
  return <group scale={[k / sx, k / sy, k / sz]}>{children}</group>
}
