import { beforeEach, describe, expect, it } from 'vitest'
import { clubHit, clubPulse, resetClubBeat } from './clubBeat'
import { SET_BPM } from './clubSet'

describe('club beat', () => {
  beforeEach(resetClubBeat)

  it('moves the colours on and flashes when a scheduled kick is heard, not before', () => {
    clubHit(1000, 'kick')
    clubHit(1120, 'bass')
    const before = clubPulse(990, 124)
    expect(before.step).toBe(0)
    const kick = clubPulse(1000, 124)
    expect(kick.step).toBe(1)
    expect(kick.flash).toBeCloseTo(1)
    expect(kick.live).toBe(true)
    const later = clubPulse(1100, 124)
    expect(later.flash).toBeLessThan(0.6)
    // An off-beat bass note keeps the colour and doesn't flash.
    const bass = clubPulse(1120, 124)
    expect(bass.step).toBe(1)
    expect(bass.flash).toBeLessThan(0.6)
    expect(bass.live).toBe(true)
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
    for (let i = 0; i < 5; i++) clubHit(100 + i * 100, 'kick')
    const p = clubPulse(5000, 124)
    expect(p.step).toBe(5)
    expect(p.flash).toBe(0)
  })

  it('the other parts flash their own layer and never move the colour on', () => {
    clubHit(1000, 'kick', 1, 2)
    clubHit(1100, 'hat', 0.6, 2)
    clubHit(1200, 'clap', 1, 2)
    const hat = clubPulse(1100, 124)
    expect(hat.step).toBe(1)
    expect(hat.env.hat).toBeCloseTo(0.6)
    expect(hat.env.clap).toBe(0)
    const clap = clubPulse(1200, 124)
    expect(clap.step).toBe(1)
    expect(clap.env.clap).toBeCloseTo(1)
    expect(clap.env.hat).toBeLessThan(0.1)
    expect(clap.groove).toBe(2)
  })

  it('counts the beat from the last kick or beat mark, at the set\'s tempo', () => {
    clubHit(1000, 'kick', 1, 4)
    expect(clubPulse(1000).beat).toBe(0)
    expect(clubPulse(1000 + 60000 / SET_BPM / 2).beat).toBeCloseTo(0.5)
    // A breakdown has no kick, but the beat marks keep the count.
    clubHit(1000 + 60000 / SET_BPM, 'beat', 0, 4)
    const p = clubPulse(1000 + 60000 / SET_BPM)
    expect(p.beat).toBe(0)
    expect(p.step).toBe(1)
    expect(p.flash).toBeLessThan(0.7)
  })
})
