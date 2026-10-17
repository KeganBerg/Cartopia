// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, Vector3, type Mesh, type Object3D } from 'three'
import { BUILDINGS } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { KeepShapes, MergeScale } from './mergeScale'
import { limitFor } from './keepShape'

// Towers stand straight (Kegan, 2026-10-17: the Horizon tower's twisting
// slabs read as a building sliding over). Every floor slab of a tower, a box
// at least a metre across above the ground floor, sits square to the lot and
// centred on what it stands on (drifting no more than DRIFT sideways) or
// wholly on a wider podium.
const DRIFT = 0.15
const LEVELS = [4, 7, 10]
const ONE: [number, number, number] = [1, 1, 1]
const x = new Vector3()

type Slab = { box: Box3; name: string }

async function slabs(id: string, level: number) {
  const def = BUILDINGS.find((d) => d.id === id)!
  const r = await ReactThreeTestRenderer.create(
    <MergeScale.Provider value={ONE}>
      <KeepShapes limit={limitFor(def)}>
        <BuildingModel def={def} level={level} />
      </KeepShapes>
    </MergeScale.Provider>,
  )
  await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
  const root = r.scene.instance as Object3D
  root.updateMatrixWorld(true)
  const all: Slab[] = []
  const bad: string[] = []
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || m.geometry?.type !== 'BoxGeometry') return
    const box = new Box3().setFromObject(m)
    const size = box.getSize(new Vector3())
    all.push({ box, name: `${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)} at y ${box.min.y.toFixed(2)}` })
    if (box.min.y < 1 || size.y < 0.2) return
    x.setFromMatrixColumn(m.matrixWorld, 0)
    const turned = Math.abs(Math.sin(2 * Math.atan2(x.z, x.x))) > 0.01
    if (turned && Math.min(size.x, size.z) > 0.7) bad.push(`turned slab ${all.at(-1)!.name}`)
  })
  // Slabs a metre or more across that stand above the lobby.
  for (const s of all) {
    const size = s.box.getSize(new Vector3())
    if (s.box.min.y < 1 || size.x < 1 || size.z < 1 || size.y < 0.2) continue
    const c = s.box.getCenter(new Vector3())
    const under = all.find((u) => {
      if (u === s || u.box.max.y < s.box.min.y - 0.12 || u.box.max.y > s.box.min.y + 0.05) return false
      const uc = u.box.getCenter(new Vector3())
      // Centred on it, or standing wholly on a wider podium.
      const inside = s.box.min.x >= u.box.min.x - 0.02 && s.box.max.x <= u.box.max.x + 0.02 && s.box.min.z >= u.box.min.z - 0.02 && s.box.max.z <= u.box.max.z + 0.02
      return inside || (Math.abs(uc.x - c.x) <= DRIFT && Math.abs(uc.z - c.z) <= DRIFT)
    })
    if (!under) bad.push(`slab drifts off what's under it: ${s.name}`)
  }
  await r.unmount()
  return bad
}

const TOWERS = ['offices', 'hq', 'glasstower', 'hospital', 'helipad']

describe('towers stand straight', () => {
  for (const id of TOWERS) {
    it(id, async () => {
      const bad: string[] = []
      for (const level of LEVELS) for (const b of await slabs(id, level)) bad.push(`L${level} ${b}`)
      expect(bad).toEqual([])
    }, 120_000)
  }
})
