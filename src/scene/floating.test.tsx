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
import { describe, floating, hovering, REST, TOUCH } from './floating'
import { groupScale, mergeable, type MergeGroup } from '../game/merge'
import { DAY_MS } from '../game/clock'

type Scale = [number, number, number]
// Noon, then midnight: night spots (the club's dancers, lit signs) only show after dark.
// Noon and midnight on the town clock.
const NOON = 0, MIDNIGHT = DAY_MS / 2
// How the town draws a merged pair (two side by side, facing south).
const PAIR = groupScale({ cols: 2, rows: 1 } as MergeGroup, 0)
// Every level on its own (trims come in one level at a time), and each growth
// form as a merged pair, a 2x2 and a 4x4 block for buildings that can merge.
const BLOCKS: Scale[] = [[2, 2, 2], [4, 4, 4]]
const runs = (id: string): [number, Scale, number][] => [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l): [number, Scale, number] => [l, [1, 1, 1], NOON]),
  ...[1, 4, 7, 10].map((l): [number, Scale, number] => [l, [1, 1, 1], MIDNIGHT]),
  ...(mergeable(id) ? [NOON, MIDNIGHT].flatMap((t) => [1, 4, 7, 10].map((l): [number, Scale, number] => [l, PAIR, t])) : []),
  ...(mergeable(id) ? BLOCKS.flatMap((sc) => [1, 4, 7, 10].map((l): [number, Scale, number] => [l, sc, NOON])) : []),
]
const tag = (s: Scale) => (s[0] === 1 && s[2] === 1 ? '' : s[0] === s[1] ? ` ${s[0]}x${s[0]}` : ' pair')

// Buildings still being fixed in their own work; none right now.
const LATER = new Set<string>([])

group('nothing floats', () => {
  for (const def of BUILDINGS.filter((d) => !d.parked && !LATER.has(d.id))) {
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
        const at = `L${level}${tag(scale)}${time === MIDNIGHT ? ' night' : ''}`
        for (const p of floating(r.scene.instance as Object3D, TOUCH * scale[1], scale[1])) bad.add(`${at}: ${describe(p)}`)
        // Low slabs (steps, mats, ramps) sit right on the lot or what's under them, not just near it.
        // (A 2x2 or 4x4 block scales its slabs and their gaps alike; the contact check covers those.)
        if (scale[1] === 1) for (const p of hovering(r.scene.instance as Object3D)) bad.add(`${at}: hovers more than ${REST} up: ${describe({ ...p, n: 1, gap: p.box.min.y, members: [p] })}`)
        await r.unmount()
        vi.restoreAllMocks()
      }
      if (process.env.FLOAT_REPORT) (await import('node:fs')).appendFileSync(process.env.FLOAT_REPORT, JSON.stringify({ id: def.id, bad: [...bad] }) + '\n')
      expect([...bad]).toEqual([])
    }, 180_000)
  }
})

group('nothing floats on landmarks', () => {
  it('vanguard tower', async () => {
    const bad = new Set<string>()
    for (const time of [NOON, MIDNIGHT]) {
      vi.spyOn(Date, 'now').mockReturnValue(time)
      const r = await ReactThreeTestRenderer.create(<VanguardTower />)
      await ReactThreeTestRenderer.act(async () => r.advanceFrames(2, 1 / 60))
      for (const p of floating(r.scene.instance as Object3D)) bad.add(`${time === MIDNIGHT ? 'night' : 'day'}: ${describe(p)}`)
      await r.unmount()
      vi.restoreAllMocks()
    }
    expect([...bad]).toEqual([])
  })
})
