import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clubHit, clubPulse, resetClubBeat } from './clubBeat'
import { GROOVES } from './clubGrooves'
import { Soundscape } from './ambience'
import { technoBeat, startEvent, stopEvent, SIXTEENTH_MS, BUILD_MS } from '../game/techno'

// Kegan: the club's colour should move "doot doot doot doot", once per kick,
// not on every bass note. Play each groove through the real Soundscape (on a
// stand-in audio context that accepts anything), feed its notes to the lights
// the way the game does, watch at 60 fps and count colour changes per beat.

// An audio context that takes any call and returns more of itself.
function fakeCtx(): BaseAudioContext {
  const fn = function () {}
  const any: unknown = new Proxy(fn, {
    get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'currentTime' || k === 'sampleRate' ? 44100 : any),
    set: () => true,
    apply: () => any,
    construct: () => any as object,
  })
  return any as BaseAudioContext
}

function colourStepsPerBeat(groove: number, beats = 32) {
  const s = new Soundscape(fakeCtx(), fakeCtx() as unknown as AudioNode)
  s.groove = groove
  s.onHit = (at, kick) => clubHit(at * 1000, kick)
  const bpm = GROOVES[groove].bpm
  const beat = 60 / bpm
  // Schedule ahead in 0.2 s chunks as the game does, and watch the lights at
  // 60 fps from the second beat on.
  const from = 2000
  const to = from + beats * beat * 1000
  let next = 1
  let last = -1
  let changes = 0
  for (let now = 1000; now < to; now += 1000 / 60) {
    while (next * 1000 <= now) {
      s.step(next, 1, 'fall', true)
      next += 0.2
    }
    const p = clubPulse(now, bpm)
    if (now < from) {
      last = p.step
      continue
    }
    expect(p.live).toBe(true)
    if (p.step !== last) changes++
    last = p.step
  }
  return changes / beats
}

describe('club colour steps per beat', () => {
  beforeEach(() => {
    resetClubBeat()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  GROOVES.forEach((g, i) => {
    it(`${g.name}: one colour per kick`, () => {
      expect(colourStepsPerBeat(i)).toBeCloseTo(1, 1)
    })
  })

  it('Rave Mode: a new colour only on kicks (none through the kickless break)', () => {
    startEvent('techno', { from: -BUILD_MS, drop: 0, until: Infinity })
    try {
      // The build-up and its kickless breakdown, then 24 bars from the drop:
      // drop, groove, peak, tension, then the break (20-23).
      let last = -1
      let changes = 0
      let kicks = 0
      let lastKickBeat = -1
      for (let wall = -BUILD_MS; wall < 24 * 16 * SIXTEENTH_MS; wall += 1000 / 60) {
        vi.spyOn(Date, 'now').mockReturnValue(wall)
        const p = clubPulse(performance.now(), 124)
        const b = technoBeat(wall)
        if (b.kick > 0 && b.beat !== lastKickBeat) {
          kicks++
          lastKickBeat = b.beat
        }
        if (last >= 0 && p.step !== last) {
          changes++
          expect(b.kick).toBeGreaterThan(0)
        }
        last = p.step
      }
      expect(Math.abs(changes - kicks)).toBeLessThanOrEqual(1)
    } finally {
      stopEvent('techno')
    }
  })
})
