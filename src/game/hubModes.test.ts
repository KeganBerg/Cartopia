import { describe, expect, it } from 'vitest'
import { MODE_LEVEL, nextRace } from './hubModes'

describe('race menu front page', () => {
  it('leads with the campaign, then the weekly event, then the Pro Tour, then a quick race', () => {
    expect(nextRace(0, true, true)).toBe('campaign')
    expect(nextRace(-1, true, true)).toBe('event')
    expect(nextRace(-1, false, true)).toBe('tour')
    expect(nextRace(-1, false, false)).toBe('quick')
  })
  it('has every mode on the menu by level 4', () => {
    expect(Math.max(...Object.values(MODE_LEVEL))).toBeLessThanOrEqual(4)
  })
})
