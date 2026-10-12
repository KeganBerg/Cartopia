import { describe, expect, it } from 'vitest'
import { sunDay } from '../game/sun'

const DAY_MS = 86_400_000
import { GROOVES, grooveFor } from './clubGrooves'

describe('club grooves', () => {
  it('plays a different groove on back-to-back nights, the same all night', () => {
    const night = sunDay(20_000).noon + 0.5 * DAY_MS // the middle of a night
    const g = grooveFor(night)
    expect(grooveFor(night - 0.2 * DAY_MS)).toBe(g) // evening
    expect(grooveFor(night + 0.19 * DAY_MS)).toBe(g) // before dawn
    expect(grooveFor(night + DAY_MS)).not.toBe(g)
    const week = new Set(GROOVES.map((_, i) => grooveFor(night + i * DAY_MS)))
    expect(week.size).toBe(GROOVES.length)
  })
  it('keeps every groove a house groove', () => {
    for (const g of GROOVES) {
      expect(g.bpm).toBeGreaterThanOrEqual(118)
      expect(g.bpm).toBeLessThanOrEqual(132)
      expect(g.bass).toHaveLength(16)
      expect(g.loop.length).toBeGreaterThan(0)
      if (g.acid) expect(g.acid.notes).toHaveLength(16)
    }
  })
})
