import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Object3D } from 'three'
import { keepProps, keepShape, releaseShape, uniform } from './keepShape'

// A merged block draws one building scaled up (see groupScale in game/merge.ts):
// a 2x2 grows evenly, a 1x2 pair gets twice as long one way only. A pair must
// look like one longer building, not the small one stretched:
//
// THE RULE, inside a pair (KeepShapes, wrapped round every model in World):
//  - Props keep their shape: any prop-sized group or mesh (see propLimit) that
//    isn't flat (cars, people, cones, windows, doors, sills, signs' letters),
//    and every instanced crowd. They keep their place, not the stretch.
//  - Walls, roofs and lots stretch, but their tiling textures (bricks, siding,
//    window grids, awning stripes) repeat more instead of getting wider.
//  - Things laid out in bays (rows of windows, columns) draw more of them
//    along the longer side: lay them out in a <Facade> (or read useBays()).
// Decorations that are one object (trees, lamps) don't merge at all (game/merge.ts).
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

// How many times over a model's facades should repeat along its own x and z:
// [2, 1] or [1, 2] in a pair, [1, 1] otherwise. Anything laid out in bays
// (windows, shopfronts, columns) uses it to draw more of them across the
// longer side; KeepShapes keeps each one at its true size.
export function useBays(): [number, number] {
  const [sx, , sz] = useMergeScale()
  const k = Math.min(sx, sz)
  return [sx / k, sz / k]
}

function count(o: Object3D) {
  let n = 0
  o.traverse(() => void n++)
  return n
}

// The KeepShapes group above `o`. Found through the scene, not a React ref:
// a parent's ref isn't set yet when its children's layout effects run, and
// these must run before Batch bakes the town (also a layout effect, higher up).
function rootOf(o: Object3D) {
  for (let p = o.parent; p; p = p.parent) if (p.userData.mergeRoot) return p
  return null
}

// Re-scans whenever something mounts or unmounts (a crowd at school hours, a
// level's new trims), and drops the fixes once the block is no longer a pair.
function Watch({ scale, limit }: { scale: readonly number[]; limit: number }) {
  const marker = useRef<Group>(null)
  const seen = useRef(-1)
  const key = scale.join()
  useLayoutEffect(() => {
    const r = marker.current?.parent
    if (!r) return
    keepProps(r, scale, limit)
    seen.current = count(r)
    return () => {
      r.traverse(releaseShape)
      seen.current = -1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limit])
  useFrame(() => {
    const r = marker.current?.parent
    if (!r) return
    const n = count(r)
    if (n === seen.current) return
    keepProps(r, scale, limit)
    seen.current = n
  })
  return <group ref={marker} />
}

const MERGE_ROOT = { mergeRoot: true }

// Wraps a building model inside the block's scale group (see World).
export function KeepShapes({ limit, children }: { limit: number; children: ReactNode }) {
  const scale = useMergeScale()
  return (
    <group userData={MERGE_ROOT}>
      {children}
      {!uniform(scale) && <Watch scale={scale} limit={limit} />}
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
// `tall` grows it evenly to the pair's height instead (a mast or tower that
// something stretched is strung from).
export function Upright({ children, size, tall }: { children: ReactNode; size?: number; tall?: boolean }) {
  const scale = useMergeScale()
  const g = useRef<Group>(null)
  const flat = uniform(scale)
  const key = scale.join()
  useLayoutEffect(() => {
    const o = g.current
    const r = o && rootOf(o)
    if (!o || !r || flat) return
    keepShape(o, r, scale, tall ? scale[1] : size)
    return () => releaseShape(o)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, size, flat, tall])
  // Always a group, so the scene has the same shape merged or not.
  // Marked too, so KeepShapes keeps it when it mounts before the block's root
  // is there to hand to keepShape above.
  return <group ref={g} userData={{ upright: true, size, tall }} scale={flat && size != null ? size / scale[0] : 1}>{children}</group>
}

// One face of a building laid out in bays: `children` gets the face's length
// as it is drawn (twice `len` along a pair) and lays its windows, piers or
// mullions out across that, centred on 0, in true size. Place it at the face
// (`at`, turned by `ry` so its x runs along the face, z out of it).
// A round piece (a drum tower, a tank) drawn once per lot along a pair, each in
// true shape, instead of one squashed into an oval: a pair of donut shops gets
// two drum towers. `step` is a lot's width in the model's own units.
export function PerLot({ step, children }: { step: number; children: ReactNode }) {
  const [bx, bz] = useBays()
  const n = Math.round(Math.max(bx, bz))
  if (n <= 1) return <Upright>{children}</Upright>
  const alongX = bx >= bz
  return Array.from({ length: n }, (_, i) => {
    // True offset from the middle, then back into the stretched model's units.
    const t = ((i + 0.5) / n - 0.5) * n * step
    return (
      <group key={i} position={alongX ? [t / n, 0, 0] : [0, 0, t / n]}>
        <Upright>{children}</Upright>
      </group>
    )
  })
}

export function Facade({ at, ry = 0, len, children }: { at: [number, number, number]; ry?: number; len: number; children: (L: number) => ReactNode }) {
  const [bx, bz] = useBays()
  const b = Math.abs(Math.sin(ry)) > 0.5 ? bz : bx
  return (
    <group position={at} rotation-y={ry}>
      <Upright>{children(len * b)}</Upright>
    </group>
  )
}

