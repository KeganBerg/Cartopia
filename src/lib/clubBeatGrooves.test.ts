import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clubHit, clubPulse, resetClubBeat } from './clubBeat'
import { GROOVES } from './clubGrooves'
import { BAR_MS, decksAt, grooveOf, MIX_BARS, RUN_BARS, SIXTEENTH_MS as SET_SIX } from './clubSet'
import { Soundscape } from './ambience'
import { technoBeat, startEvent, stopEvent, SIXTEENTH_MS, BUILD_MS } from '../game/techno'

// Kegan: the club's colour should move "doot doot doot doot", once per kick,
// not on every bass note. Play the club's set through the real Soundscape (on
// a stand-in audio context that accepts anything), feed its notes to the
// lights the way the game does, watch at 60 fps and count colour changes.

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

// Play `bars` bars of the club's set from bar `from` (on the set's wall
// clock) and count the colour changes, the kicks the set plays, and which
// groove the lights followed.
function watch(from: number, bars: number) {
  const s = new Soundscape(fakeCtx(), fakeCtx() as unknown as AudioNode)
  // Audio time 1 s is bar `from` of the set.
  s.wallAt = (t) => from * BAR_MS + (t - 1) * 1000
  s.onHit = (at, kind, amt, g) => clubHit(at * 1000, kind, amt, g)
  let next = 0.6
  let last = -1
  let changes = 0
  const grooves = new Set<number>()
  const end = 1000 + bars * BAR_MS
  // Watch from the second beat on, at 60 fps, scheduling ahead in 0.2 s
  // chunks as the game does.
  for (let now = 600; now < end; now += 1000 / 60) {
    while (next * 1000 <= now) {
      s.step(next, 1, 'fall', true)
      next += 0.2
    }
    const p = clubPulse(now)
    if (now < 1000 + 500) {
      last = p.step
      continue
    }
    expect(p.live).toBe(true)
    grooves.add(p.groove)
    if (p.step !== last) changes++
    last = p.step
  }
  let kicks = 0
  for (let n = Math.ceil(((1000 + 500 - 27) / SET_SIX) + from * 16 - 1000 / SET_SIX); n * SET_SIX < from * BAR_MS + (end - 1000 - 27); n++) if (decksAt(n).some((d) => d.kick)) kicks++
  return { changes, kicks, grooves }
}

describe('club colour steps per beat', () => {
  beforeEach(() => {
    resetClubBeat()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  // A stretch led by each of the first runs' grooves, a mix from one groove
  // into the next, and a breakdown.
  const stretches: [string, number][] = [
    ...GROOVES.map((_, j): [string, number] => [`${GROOVES[grooveOf(j)].name} leading`, j * RUN_BARS + 20]),
    ['a mix into the next groove', 2 * RUN_BARS - MIX_BARS - 2],
    ['a breakdown', RUN_BARS - MIX_BARS + 46],
  ]
  for (const [what, from] of stretches) {
    it(`${what}: one colour per kick, never more than one a beat`, () => {
      const bars = 12
      const { changes, kicks } = watch(from, bars)
      // The breakdown's eight bars have no kick, so the colour holds.
      if (what === 'a breakdown') expect(kicks).toBeLessThanOrEqual(bars * 4 - 8 * 4)
      expect(Math.abs(changes - kicks)).toBeLessThanOrEqual(1)
      expect(changes).toBeLessThanOrEqual(bars * 4)
    })
  }

  it('the lights follow the groove whose kick leads, through the mix', () => {
    const { grooves } = watch(2 * RUN_BARS - MIX_BARS + 4, 8)
    expect([...grooves]).toEqual([grooveOf(1), grooveOf(2)])
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
