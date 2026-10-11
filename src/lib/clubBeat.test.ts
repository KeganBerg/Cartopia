import { beforeEach, describe, expect, it } from 'vitest'
import { clubHit, clubPulse, resetClubBeat } from './clubBeat'

describe('club beat', () => {
  beforeEach(resetClubBeat)

  it('moves the colours on and flashes when a scheduled note is heard, not before', () => {
    clubHit(1000, true)
    clubHit(1120, false)
    const before = clubPulse(990, 124)
    expect(before.step).toBe(0)
    const kick = clubPulse(1000, 124)
    expect(kick.step).toBe(1)
    expect(kick.flash).toBeCloseTo(1)
    expect(kick.live).toBe(true)
    const later = clubPulse(1100, 124)
    expect(later.flash).toBeLessThan(0.6)
    const bass = clubPulse(1120, 124)
    expect(bass.step).toBe(2)
    expect(bass.flash).toBeCloseTo(0.6)
  })

  it('keeps a gentle pulse at the tempo when no music plays', () => {
    const beat = 60000 / 120
    clubPulse(10 * beat + 1, 120)
    const a = clubPulse(11 * beat + 1, 120)
    expect(a.live).toBe(false)
    expect(a.step).toBe(1)
    expect(a.flash).toBeGreaterThan(0.25)
    expect(a.flash).toBeLessThanOrEqual(0.3)
    expect(clubPulse(12 * beat + 1, 120).step).toBe(2)
  })

  it('a backlog from a sleeping tab moves the colours without a late flash', () => {
    for (let i = 0; i < 5; i++) clubHit(100 + i * 100, true)
    const p = clubPulse(5000, 124)
    expect(p.step).toBe(5)
    expect(p.flash).toBe(0)
  })
})
