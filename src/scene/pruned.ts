import type { Object3D } from 'three'

// Groups a pruning Batch hid because they held nothing but merged parts (kept here, not
// in userData, which React may replace). They still count as shown: see pick.ts.
export const prunedSet = new WeakSet<Object3D>()
export const prunedAway = (o: Object3D) => prunedSet.has(o)
