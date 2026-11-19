// @vitest-environment jsdom
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const ctx: object = new Proxy({}, { get: () => () => ctx })
HTMLCanvasElement.prototype.getContext = (() => ctx) as never
vi.mock('../scene/BuildingPreview', () => ({ BuildingThumb: () => null, CarThumb: () => null }))

const { voiceLine, TUTORIAL_STEPS } = await import('./Tutorial')
const { VOICE_LINES, voiceUrl } = await import('../lib/tutorialVoice')
const { useGame } = await import('../game/store')
type Game = ReturnType<typeof useGame.getState>
const at = (over: Partial<Game>) => ({ ...useGame.getState(), panel: null, visiting: null, levelUp: null, mode: 'play', search: null, ...over }) as Game
const file = (url: string) => join(process.cwd(), 'public', url)

describe('the tutorial voice', () => {
  it('has a small voice file for every line', () => {
    for (const id of VOICE_LINES) {
      const f = file(voiceUrl(id))
      expect(existsSync(f), id).toBe(true)
      expect(statSync(f).size, id).toBeLessThan(80_000)
    }
  })
  it('says something on every step', () => {
    for (let t = 0; t < TUTORIAL_STEPS; t++) expect(voiceLine(at({ tutorial: t })), `step ${t}`).not.toBeNull()
  })
  it('uses every line, including the placing and editing ones', () => {
    const used = new Set<string>()
    for (let t = 0; t < TUTORIAL_STEPS; t++) {
      for (const mode of ['play', 'place', 'move'] as const) used.add(voiceLine(at({ tutorial: t, mode }))!)
    }
    // Touch or mouse picks one of the two "glowing lot" lines.
    const lot = ['05-build-lot-tap', '06-build-lot-click']
    expect(VOICE_LINES.filter((id) => !used.has(id) && !lot.includes(id))).toEqual([])
    expect(lot.some((id) => used.has(id))).toBe(true)
  })
  it('stays quiet once the tutorial is over, and in menus that are not part of the step', () => {
    expect(voiceLine(at({ tutorial: TUTORIAL_STEPS }))).toBeNull()
    expect(voiceLine(at({ tutorial: 99 }))).toBeNull()
    expect(voiceLine(at({ tutorial: 1, panel: 'goals' }))).toBeNull()
    expect(voiceLine(at({ tutorial: 5, panel: 'rescue' }))).toBe('09-restore')
  })
})
