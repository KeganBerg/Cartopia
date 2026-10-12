// @vitest-environment jsdom
import './testCanvas'
import { describe as group, expect, it, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { Object3D } from 'three'
import { BUILDINGS } from '../game/data'
import { BuildingModel } from './BuildingModel'
import { VanguardTower } from './Landmark'
import { KeepShapes, MergeScale } from './mergeScale'
import { limitFor } from './keepShape'
import { describe, floating } from './floating'
import { groupScale, mergeable, type MergeGroup } from '../game/merge'
import { DAY_MS } from '../game/clock'

type Scale = [number, number, number]
// Noon, then midnight: night spots (the club's dancers, lit signs) only show after dark.
const NOON = 0, MIDNIGHT = DAY_MS / 2
// How the town draws a merged pair (two side by side, facing south).
const PAIR = groupScale({ cols: 2, rows: 1 } as MergeGroup, 0)
// Every level on its own (trims come in one level at a time), and each growth
// form as a merged pair for buildings that can merge.
const runs = (id: string): [number, Scale, number][] => [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l): [number, Scale, number] => [l, [1, 1, 1], NOON]),
  ...[1, 4, 7, 10].map((l): [number, Scale, number] => [l, [1, 1, 1], MIDNIGHT]),
  ...(mergeable(id) ? [NOON, MIDNIGHT].flatMap((t) => [1, 4, 7, 10].map((l): [number, Scale, number] => [l, PAIR, t])) : []),
]

group('nothing floats', () => {
  for (const def of BUILDINGS.filter((d) => !d.parked)) {
    it(def.id, async () => {
      const bad = new Set<string>()
      for (const [level, scale, time] of runs(def.id)) {
        vi.spyOn(Date, 'now').mockReturnValue(time)
        const r = await ReactThreeTestRenderer.create(
          <group scale={scale}>
            <MergeScale.Provider value={scale}>
              <KeepShapes limit={limitFor(def)}>
                <BuildingModel def={def} level={level} />
              </KeepShapes>
            </MergeScale.Provider>
          </group>,
        )
        await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
        for (const p of floating(r.scene.instance as Object3D)) bad.add(`L${level}${scale.some((v) => v !== 1) ? ' pair' : ''}${time ? ' night' : ''}: ${describe(p)}`)
        await r.unmount()
        vi.restoreAllMocks()
      }
      if (process.env.FLOAT_REPORT) (await import('node:fs')).appendFileSync(process.env.FLOAT_REPORT, JSON.stringify({ id: def.id, bad: [...bad] }) + '\n')
      expect([...bad]).toEqual([])
    })
  }
})

group('nothing floats on landmarks', () => {
  it('vanguard tower', async () => {
    const bad = new Set<string>()
    for (const time of [NOON, MIDNIGHT]) {
      vi.spyOn(Date, 'now').mockReturnValue(time)
      const r = await ReactThreeTestRenderer.create(<VanguardTower />)
      await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
      for (const p of floating(r.scene.instance as Object3D)) bad.add(`${time ? 'night' : 'day'}: ${describe(p)}`)
      await r.unmount()
      vi.restoreAllMocks()
    }
    expect([...bad]).toEqual([])
  })
})
