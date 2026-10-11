import { createContext, useContext, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Object3D } from 'three'
import { keepProps, keepShape, releaseShape, uniform } from './keepShape'

// A merged block draws one building scaled up (see groupScale in game/merge.ts),
// and a 1x2 pair stretches it 2x one way only. Walls and lots may stretch with
// it, but cars, people and props must keep their real shape.
//
// THE RULE: inside a stretched pair, every prop keeps its shape by default.
// KeepShapes (wrapped round every building model in World) finds them itself:
//  - any group whose footprint is prop-sized (see propLimit) and isn't flat,
//  - any lone non-box mesh that size (posts, bulbs, bushes, sign faces),
//  - every instanced mesh (crowds), one instance at a time.
// A prop keeps its place in the stretched block, but not its stretch. A model
// that is one prop as a whole (a tree, a lamp) grows evenly to the pair's height.
// Opt-outs and overrides:
//  - <Stretch> marks a small piece that must stretch with the building
//    (a fence run, a trim that has to meet the walls). Things inside still
//    get checked.
//  - <Upright> forces a group to keep its shape whatever its size, and with
//    `size` sets how big it draws in a uniform 2x2 block (the Drive-In's cars).
// src/scene/mergeShape.test.tsx renders every building as a pair and fails if
// anything round, lettered or instanced comes out stretched.
export const MergeScale = createContext<[number, number, number]>([1, 1, 1])
export const useMergeScale = () => useContext(MergeScale)
const MergeRoot = createContext<RefObject<Object3D | null> | null>(null)

function count(o: Object3D) {
  let n = 0
  o.traverse(() => void n++)
  return n
}

// Re-scans whenever something mounts or unmounts (a crowd at school hours, a
// level's new trims), and drops the fixes once the block is no longer a pair.
function Watch({ root, scale, limit }: { root: RefObject<Group | null>; scale: readonly number[]; limit: number }) {
  const seen = useRef(-1)
  const key = scale.join()
  useLayoutEffect(() => {
    const r = root.current
    if (!r) return
    keepProps(r, scale, limit)
    seen.current = count(r)
    return () => {
      r.traverse(releaseShape)
      seen.current = -1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, key, limit])
  useFrame(() => {
    const r = root.current
    if (!r) return
    const n = count(r)
    if (n === seen.current) return
    keepProps(r, scale, limit)
    seen.current = n
  })
  return null
}

// Wraps a building model inside the block's scale group (see World).
export function KeepShapes({ limit, children }: { limit: number; children: ReactNode }) {
  const scale = useMergeScale()
  const root = useRef<Group>(null)
  return (
    <group ref={root}>
      <MergeRoot.Provider value={root}>{children}</MergeRoot.Provider>
      {!uniform(scale) && <Watch root={root} scale={scale} limit={limit} />}
    </group>
  )
}

// A piece that must stretch with the building even though it's prop-sized.
export function Stretch({ children }: { children: ReactNode }) {
  return <group userData={{ stretch: true }}>{children}</group>
}

// Keeps its children in true proportion whatever their size, at the block's
// smaller ground scale: a 2x2 block's display car stays 2x like the rest of
// the building, a pair's stays normal size instead of stretched. `size` sets
// that scale instead. Works under any turn or movement.
export function Upright({ children, size }: { children: ReactNode; size?: number }) {
  const scale = useMergeScale()
  const root = useContext(MergeRoot)
  const g = useRef<Group>(null)
  const flat = uniform(scale)
  const key = scale.join()
  useLayoutEffect(() => {
    const o = g.current
    const r = root?.current
    if (!o || !r || flat) return
    keepShape(o, r, scale, size)
    return () => releaseShape(o)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, key, size, flat])
  // Always a group, so the scene has the same shape merged or not.
  return <group ref={g} scale={flat && size != null ? size / scale[0] : 1}>{children}</group>
}
