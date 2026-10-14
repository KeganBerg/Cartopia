import { beforeEach, describe, expect, it } from 'vitest'
import { clubHit, clubPulse, resetClubBeat } from '../lib/clubBeat'
import { newDance, stepDance } from './danceClock'

// A two-step bar at 130 bpm: a beat cue on every beat, kicks off the grid and
// claps on 2 and 4, the way the club's garage and breaks tracks play.
const BPM = 130
const BEAT = 60000 / BPM
function schedule(bars: number) {
  for (let b = 0; b < bars * 4; b++) {
    const at = 1000 + b * BEAT
    clubHit(at, 'beat', 0)
    if (b % 4 === 0) clubHit(at, 'kick')
    if (b % 4 === 2) clubHit(at + BEAT * 0.75, 'kick')
    if (b % 2 === 1) clubHit(at, 'clap')
  }
}

// The biggest pose change between two frames, in beats and in clap.
function run(frames: number, pose: (now: number, dt: number) => { beats: number; clap: number }) {
  let prev: { beats: number; clap: number } | null = null
  let jump = 0
  let clapJump = 0
  for (let f = 0; f < frames; f++) {
    const now = 1000 + f * (1000 / 60)
    const p = pose(now, 1 / 60)
    if (prev && f > 30) {
      jump = Math.max(jump, Math.abs(p.beats - prev.beats))
      clapJump = Math.max(clapJump, Math.abs(p.clap - prev.clap))
    }
    prev = p
  }
  return { jump, clapJump }
}

describe('rooftop dancers', () => {
  beforeEach(resetClubBeat)

  it('used to snap on off-grid kicks and claps', () => {
    schedule(8)
    const old = run(60 * 12, (now) => {
      const m = clubPulse(now, BPM)
      return { beats: m.step + m.beat, clap: m.env.clap }
    })
    expect(old.jump).toBeGreaterThan(0.4)
    expect(old.clapJump).toBeGreaterThan(0.8)
  })

  it('move smoothly through a two-step bar', () => {
    schedule(8)
    const d = newDance()
    const fine = run(60 * 12, (now, dt) => {
      const m = clubPulse(now, BPM)
      stepDance(d, dt, m.grid, m.bpm, m.env.clap)
      return { beats: d.phase, clap: d.clap }
    })
    // One frame at 130 bpm is about 0.036 beats.
    expect(fine.jump).toBeLessThan(0.06)
    expect(fine.clapJump).toBeLessThan(0.3)
  })

  it('stays on the beat grid', () => {
    schedule(8)
    const d = newDance()
    let m = clubPulse(1000, BPM)
    for (let f = 0; f < 60 * 10; f++) {
      m = clubPulse(1000 + f * (1000 / 60), BPM)
      stepDance(d, 1 / 60, m.grid, m.bpm, 0)
    }
    let err = m.grid - (d.phase - Math.floor(d.phase))
    err -= Math.round(err)
    expect(Math.abs(err)).toBeLessThan(0.05)
  })
})
