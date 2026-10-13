import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clubHit, clubPulse, resetClubBeat } from './clubBeat'
import { GROOVES } from './clubGrooves'
import { barMs, BREAK_FROM, deckAt, nightWith, sixAt, trackOf, wallOf } from './clubSet'
import { DAY_MS } from '../game/clock'
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

// Play `ms` of the club's music from wall-clock time `from` and count the
// colour changes, the kicks the track plays, and which tracks the lights followed.
function watch(from: number, ms: number) {
  const s = new Soundscape(fakeCtx(), fakeCtx() as unknown as AudioNode)
  // Audio time 1 s is `from` on the wall clock.
  s.wallAt = (t) => from + (t - 1) * 1000
  s.onHit = (at, kind, amt, g) => clubHit(at * 1000, kind, amt, g)
  let next = 0.6
  let last = -1
  let changes = 0
  let lastBeat = -Infinity
  let longest = 0
  const grooves = new Set<number>()
  const end = 1000 + ms
  // Watch from the second beat on, at 60 fps, scheduling ahead in 0.2 s
  // chunks as the game does.
  for (let now = 600; now < end; now += 1000 / 60) {
    while (next * 1000 <= now) {
      s.step(next, 1, 'fall', true)
      next += 0.2
    }
    const p = clubPulse(now, 125)
    if (now < 1000 + 500) {
      last = p.step
      continue
    }
    expect(p.live).toBe(true)
    grooves.add(p.groove)
    if (p.step !== last) changes++
    last = p.step
    // The beat count restarts on every beat mark: how long between them.
    if (p.beat < 0.05 && now - lastBeat > 100) {
      if (lastBeat > 0) longest = Math.max(longest, now - lastBeat)
      lastBeat = now
    }
  }
  let kicks = 0
  // The kicks heard (27 ms after they start) inside the watched stretch.
  const a = from + 500 - 27
  const z = from + ms - 27
  for (let p = sixAt(a), n = p.n + 1, night = p.night; ; n++) {
    if (wallOf(night, n) >= (night + 1) * DAY_MS) {
      night++
      n = 0
    }
    if (wallOf(night, n) >= z) break
    if (deckAt(night, n).kick) kicks++
  }
  return { changes, kicks, grooves, longest }
}

describe('club colour steps per beat', () => {
  beforeEach(() => {
    resetClubBeat()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  // A stretch of each track, a breakdown, and a night running into the next.
  const start = (g: number, bar: number) => nightWith(g, 40) * DAY_MS + bar * barMs(g)
  const stretches: [string, number, number][] = [
    ...GROOVES.map((g, i): [string, number, number] => [g.name, start(i, 18), 12 * barMs(i)]),
    ['a breakdown', start(0, BREAK_FROM - 2), 12 * barMs(0)],
  ]
  for (const [what, from, ms] of stretches) {
    it(`${what}: one colour per kick, never more than one a beat`, () => {
      const { changes, kicks, grooves } = watch(from, ms)
      const beats = ms / (barMs(trackOf(sixAt(from).night)) / 4)
      // The breakdown's eight bars have no kick, so the colour holds.
      if (what === 'a breakdown') expect(kicks).toBeLessThanOrEqual(beats - 8 * 4)
      expect(Math.abs(changes - kicks)).toBeLessThanOrEqual(1)
      expect(changes).toBeLessThanOrEqual(beats)
      expect([...grooves]).toEqual([trackOf(sixAt(from).night)])
    })
  }

  it('into the next night (a live event keeps the club open): the next track takes over with no gap', () => {
    const night = 77
    const from = (night + 1) * DAY_MS - 6000
    const { grooves, longest } = watch(from, 12000)
    expect([...grooves]).toEqual([trackOf(night), trackOf(night + 1)])
    // The beat never stops for longer than the slower track's beat (plus a frame).
    const beat = Math.max(barMs(trackOf(night)), barMs(trackOf(night + 1))) / 4
    expect(longest).toBeLessThanOrEqual(beat + 40)
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
