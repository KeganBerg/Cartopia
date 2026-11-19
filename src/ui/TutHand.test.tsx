// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

const ctx: object = new Proxy({}, { get: () => () => ctx })
HTMLCanvasElement.prototype.getContext = (() => ctx) as never
vi.mock('../scene/BuildingPreview', () => ({ BuildingThumb: () => null, CarThumb: () => null }))

const { handTarget, TUTORIAL_STEPS } = await import('./Tutorial')
const { handBelow } = await import('./TutHand')
const { useGame } = await import('../game/store')
type Game = ReturnType<typeof useGame.getState>
const at = (over: Partial<Game>) => ({ ...useGame.getState(), panel: null, visiting: null, levelUp: null, mode: 'play', search: null, ...over }) as Game

// Kegan's mom needed hand-holding: the hand must always show the next tap.
describe('the tutorial hand', () => {
  it('points somewhere on every step in town (a step waiting on a job may rest)', () => {
    for (let t = 0; t < TUTORIAL_STEPS; t++) {
      const target = handTarget(at({ tutorial: t }))
      if (t !== 2) expect(target, `step ${t}`).not.toBeNull()
    }
  })
  it('rests once the tutorial is over', () => {
    expect(handTarget(at({ tutorial: TUTORIAL_STEPS }))).toBeNull()
    expect(handTarget(at({ tutorial: 99 }))).toBeNull()
  })
  it('points at the glowing lot while placing Rusty’s', () => {
    expect(handTarget(at({ tutorial: 3, mode: 'place', placing: 'rescue' }))).toBe('lot')
  })
  it('leads into the menu each step works in', () => {
    expect(handTarget(at({ tutorial: 3, panel: 'shop' }))).toEqual(['.start-here'])
    expect(handTarget(at({ tutorial: 4, panel: 'rescue' }))?.[0]).toMatch(/rsc-spot/)
    expect(handTarget(at({ tutorial: 8, panel: 'race' }))?.[0]).toMatch(/rm-lead-go/)
  })
  it('shows the way out of a menu that isn’t part of the step', () => {
    expect(handTarget(at({ tutorial: 1, panel: 'goals' }))).toContain('.close')
    expect(handTarget(at({ tutorial: 6, panel: 'rescue' }))).toContain('.close')
  })
})

describe('the hand on the tutorial card', () => {
  it('points down at Next from above, so it never covers Skip under it', () => {
    const next = { x: 300, y: 700, w: 70, h: 40 }
    expect(handBelow(next, true, 844)).toBe(false)
    expect(handBelow(next, false, 844)).toBe(true)
  })
})
