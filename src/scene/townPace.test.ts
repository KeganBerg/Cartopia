import { describe, expect, it } from 'vitest'
import { PACES, lowestFps, nextPace, samplesFor } from './townPace'
import { fpsOf } from '../ui/FpsMeter'

describe('town pace', () => {
  it('drops sharpness first on a sharp screen, then frames', () => {
    const steps: number[] = []
    for (let i: number | null = 1; i != null; i = nextPace(i, 3)) steps.push(i)
    expect(steps.map((i) => PACES[i])).toEqual([PACES[1], PACES[2], PACES[3], PACES[4]])
  })

  it('skips sharpness steps a 1x screen never used', () => {
    expect(nextPace(0, 1)).toBe(4)
    expect(nextPace(4, 1)).toBeNull()
  })

  it('a 1.5x screen skips the 2x step', () => {
    expect(nextPace(0, 1.5)).toBe(2)
  })
})

describe('desktop pacing', () => {
  it('gives up sharpness below 50 fps on a computer, frames and effects only below 40', () => {
    expect(lowestFps(true, 0, false, 2)).toBe(50)
    expect(lowestFps(true, 2, false, 2)).toBe(50)
    // Sharpness is already as low as it goes: next would be 30 fps, which waits for below 40.
    expect(lowestFps(true, 3, false, 2)).toBe(40)
    expect(lowestFps(true, 0, false, 1)).toBe(40)
    expect(lowestFps(true, 4, false, 2)).toBe(22)
  })

  it('leaves phones and other scenes at 40', () => {
    expect(lowestFps(true, 1, true, 3)).toBe(40)
    expect(lowestFps(false, 0, false, 2)).toBe(40)
  })

  it('smooths edges 2x on a sharp screen, 4x on a plain one', () => {
    expect(samplesFor('high', 2)).toBe(2)
    expect(samplesFor('high', 1)).toBe(4)
    expect(samplesFor('high', 1.25)).toBe(4)
    expect(samplesFor('low', 1)).toBe(2)
  })
})

describe('fps counter', () => {
  it('counts frames a second', () => {
    expect(fpsOf(30, 500)).toBe(60)
    expect(fpsOf(0, 500)).toBe(0)
    expect(fpsOf(5, 0)).toBe(0)
  })
})
