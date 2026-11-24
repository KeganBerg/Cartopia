import { describe, expect, it } from 'vitest'
import { tiltBand } from './PostFx'

describe('tilt-shift band', () => {
  it('keeps the wide-screen band on desktops and landscape phones', () => {
    expect(tiltBand(1280, 800)).toEqual([0.72, 0.28])
    expect(tiltBand(844, 390)).toEqual([0.72, 0.28])
  })
  it('blurs only thin strips on portrait phones', () => {
    const [focus, feather] = tiltBand(390, 844)
    expect(focus + feather).toBeLessThanOrEqual(1)
    expect(focus).toBeGreaterThan(0.8)
  })
})
