// @vitest-environment jsdom
import './testCanvas'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Color, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { BUILDINGS } from '../game/data'
import { sunDay } from '../game/sun'
import { clubHit, resetClubBeat } from '../lib/clubBeat'
import { BuildingModel } from './BuildingModel'
import { VanguardTower } from './Landmark'

// Kegan: every club window and the Vanguard penthouse show ONE colour at a
// time, all stepping on together with the bass. Draw both at midnight, play a
// few notes, and check every lit material tagged `clubLed` shows the same hue
// each frame (brightness may differ; the colour may not).

const MIDNIGHT = sunDay(20_000).noon + 12 * 3_600_000 // the town clock follows local time
const club = BUILDINGS.find((d) => d.id === 'club')!

const hue = (c: Color) => {
  const m = Math.max(c.r, c.g, c.b)
  return m > 0 ? new Color(c.r / m, c.g / m, c.b / m).getHexString() : 'dark'
}

afterEach(() => vi.restoreAllMocks())

describe('club LEDs stay in step', () => {
  for (const level of [1, 7, 10]) {
    it(`club L${level} and the Vanguard penthouse share one colour`, async () => {
      vi.spyOn(Date, 'now').mockReturnValue(MIDNIGHT)
      resetClubBeat()
      const r = await ReactThreeTestRenderer.create(
        <group>
          <BuildingModel def={club} level={level} />
          <group position={[-5, 0, 0]}><VanguardTower /></group>
        </group>,
      )
      const mats = new Map<MeshStandardMaterial, string>()
      ;(r.scene.instance as Object3D).traverse((o) => {
        for (const m of [(o as Mesh).material].flat()) if (m?.userData.clubLed) mats.set(m as MeshStandardMaterial, o.name)
      })
      // The upper windows, the front LED window and the penthouse floors.
      expect(mats.size).toBeGreaterThanOrEqual(3)
      const seen = new Set<string>()
      for (let note = 0; note < 7; note++) {
        clubHit(performance.now() - 1, 'kick')
        await ReactThreeTestRenderer.act(async () => r.advanceFrames(1, 1 / 60))
        const hues = new Set([...mats.keys()].map((m) => hue(m.emissive)))
        expect([...hues]).toHaveLength(1)
        expect(hues.has('dark')).toBe(false)
        seen.add([...hues][0])
      }
      // And the colour moves on with the notes.
      expect(seen.size).toBeGreaterThan(1)
      await r.unmount()
    })
  }
})

describe('each groove plays the lights its own way', () => {
  it('between kicks, a groove flashes the lights on its own parts', async () => {
    const { LOOKS } = await import('./clubLeds')
    // Every groove has a look, and no two are the same.
    const { GROOVES } = await import('../lib/clubGrooves')
    expect(LOOKS).toHaveLength(GROOVES.length)
    expect(new Set(LOOKS.map((l) => JSON.stringify(l))).size).toBe(GROOVES.length)
    // The kick always flashes the windows hardest.
    for (const l of LOOKS) for (const [k, v] of Object.entries(l.w)) if (k !== 'kick') expect(v).toBeLessThan(l.w.kick!)
  })
})
