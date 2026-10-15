import { MeshStandardMaterial, type Texture } from 'three'

// A big town is ~30,000 tiny meshes, and Batch draws it from its own merged copy,
// so each building's own pieces stay only for taps. ~18,000 of their materials were
// copies of a few hundred colours. Now placed buildings share one plain material per
// colour and texture (see useMat in BuildingModel; shapes: sharedShapes.ts). Nothing
// changes them in place (a new colour asks for another), so nothing looks different.
const mats = new Map<string, MeshStandardMaterial>()
export function plainMat(color: string, map?: Texture) {
  const k = `${color}|${map?.uuid ?? ''}`
  let m = mats.get(k)
  if (!m) mats.set(k, (m = new MeshStandardMaterial({ color, map: map ?? null })))
  return m
}
