// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { rotorStep, ROTOR_MAX_STEP, TAIL_RATIO } from './ServiceVehicles'

// Kegan saw a helicopter over town with its blades standing still. The rotor turned at a
// real rotor's speed, and four blades that repeat every quarter turn strobed into stillness
// (or crept backwards) at the frame rates phones draw the town at.
const QUARTER = Math.PI / 2
// How far the blades seem to move in one frame: the nearest match a quarter turn allows.
const seen = (step: number) => ((step + QUARTER / 2) % QUARTER) - QUARTER / 2

describe('helicopter rotors', () => {
  it('read as turning forwards at every frame rate', () => {
    for (const fps of [12, 15, 18, 20, 24, 30, 40, 45, 50, 60, 90, 120, 144, 240]) {
      const step = rotorStep(1 / fps)
      expect(step, `${fps} fps`).toBeGreaterThan(0)
      // Well clear of the strobe: under a third of the eighth turn where forwards and backwards look alike.
      expect(seen(step), `${fps} fps`).toBeCloseTo(step, 6)
      expect(step, `${fps} fps`).toBeLessThan(QUARTER / 4)
      expect(seen(step * TAIL_RATIO), `tail ${fps} fps`).toBeCloseTo(step * TAIL_RATIO, 6)
      expect(step * TAIL_RATIO, `tail ${fps} fps`).toBeLessThan(QUARTER / 2 * 0.75)
    }
  })
  it('turn visibly fast at 30 and 60 fps', () => {
    // At least about a turn a second on screen.
    expect(rotorStep(1 / 60) * 60).toBeGreaterThan(2 * Math.PI)
    expect(rotorStep(1 / 30) * 30).toBeGreaterThan(2 * Math.PI)
  })
  it('never jump on a long frame, and stop with the engine', () => {
    expect(rotorStep(2)).toBe(ROTOR_MAX_STEP)
    expect(rotorStep(1 / 60, 0)).toBe(0)
  })
})
