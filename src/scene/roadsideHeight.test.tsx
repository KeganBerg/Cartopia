// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, type Object3D } from 'three'
import { BUILDINGS } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { KeepShapes, MergeScale } from './mergeScale'
import { limitFor } from './keepShape'

// Roadside buildings stay low at every level, alone and merged (Kegan,
// 2026-10-17: "Why are gas stations the size of skyscrapers"). Height is
// measured in the block's own units, so a 2x2 may draw twice as tall but no
// taller than that. The food shops and offices grow into towers on purpose
// (growth.ts); these don't.
const CAP: Record<string, number> = { gas: 3.0, carwash: 3.6, tires: 3.4, lube: 3.4, dynolab: 4.4 }
const BLOCKS: [number, number, number][] = [[1, 1, 1], [2, 1, 1], [2, 2, 2]]

async function height(id: string, level: number, s: [number, number, number]) {
  const def = BUILDINGS.find((d) => d.id === id)!
  const r = await ReactThreeTestRenderer.create(
    <group scale={s}>
      <MergeScale.Provider value={s}>
        <KeepShapes limit={limitFor(def)}>
          <BuildingModel def={def} level={level} />
        </KeepShapes>
      </MergeScale.Provider>
    </group>,
  )
  await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
  const root = r.scene.instance as Object3D
  root.updateMatrixWorld(true)
  const h = new Box3().setFromObject(root).max.y / s[1]
  await r.unmount()
  return h
}

describe('roadside buildings never grow into towers', () => {
  for (const [id, cap] of Object.entries(CAP)) {
    it(id, async () => {
      const tall: string[] = []
      for (let level = 1; level <= 10; level++) {
        for (const s of BLOCKS) {
          const h = await height(id, level, s)
          if (h > cap) tall.push(`L${level} ${s.join('x')}: ${h.toFixed(2)} > ${cap}`)
        }
      }
      expect(tall).toEqual([])
    }, 120_000)
  }
})
