import { beforeEach, describe, expect, it } from 'vitest'
import { EASE_MS, forcedPhase, setLiveEvents } from './liveEvents'
import { isNight, msUntilNight } from './clock'
import { sunDay } from './sun'

const DAY_MS = 86_400_000
const T = sunDay(20_000).noon // a real noon
const ev = (kind: string, from: number, to: number, id = 1) => ({ id, kind, payload: {}, from, to })

describe('live events', () => {
  beforeEach(() => setLiveEvents([]))

  it('leaves the clock alone with no events', () => {
    expect(forcedPhase(0.2, T)).toBeNull()
    expect(isNight(T)).toBe(false)
  })

  it('makes it night for everyone, easing in, then back', () => {
    setLiveEvents([ev('night', T, T + 60_000)])
    const mid = forcedPhase(0, T + EASE_MS / 2)!
    expect(mid).toBeGreaterThan(0.1)
    expect(mid).toBeLessThan(0.4)
    expect(forcedPhase(0, T + EASE_MS)).toBe(0.5)
    expect(isNight(T + EASE_MS)).toBe(true)
    expect(msUntilNight(T + EASE_MS)).toBe(0)
    expect(forcedPhase(0, T + 60_000 + EASE_MS / 2)).toBeGreaterThan(0.1)
    expect(forcedPhase(0, T + 60_000 + EASE_MS)).toBeNull()
  })

  it('eases the short way round the day', () => {
    setLiveEvents([ev('day', T, T + 60_000)])
    expect(forcedPhase(0.9, T + EASE_MS / 2)).toBeGreaterThan(0.9)
  })

  it('holds the night back during a forced day', () => {
    const night = T + 0.4 * DAY_MS // the real clock says night here
    expect(isNight(night)).toBe(true)
    setLiveEvents([ev('day', night - EASE_MS, night + 60_000)])
    expect(isNight(night)).toBe(false)
    // Countdown runs to the end of the event, then on to the next real night opening.
    expect(msUntilNight(night)).toBe(60_000 + msUntilNight(night + 60_000))
  })

  it('lets the newest event win and ignores unknown kinds', () => {
    setLiveEvents([ev('night', T, T + 60_000, 1), ev('day', T + 1000, T + 60_000, 2), ev('weather', T, T + 60_000, 3)])
    expect(forcedPhase(0.3, T + 1000 + EASE_MS)).toBe(0)
  })
})

describe('registered kinds', () => {
  it('starts and stops a registered kind with its event', async () => {
    const { registerLiveKind, syncHandlers } = await import('./liveEvents')
    const log: string[] = []
    setLiveEvents([ev('techno', T, T + 60_000, 7)])
    registerLiveKind('techno', { start: (e) => log.push(`start ${e.id}`), stop: () => log.push('stop') })
    syncHandlers(T - 1)
    syncHandlers(T + 1)
    syncHandlers(T + 2)
    syncHandlers(T + 60_000)
    expect(log).toEqual(['start 7', 'stop'])
  })
})
