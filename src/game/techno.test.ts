import { afterEach, describe, expect, it, vi } from 'vitest'
import { BAR_MS, BUILD_MS, CYCLE_BARS, kickOn, sectionOf, startEvent, stopEvent, technoBeat, technoLeft, technoNight, technoOn, technoToDrop, weeklyRave } from './techno'
import { dayPhase, isNight } from './clock'
import { HALCYON } from './raveSong'

// The drop, as a wall-clock time.
const AT = 1_800_000_000_000

describe('Rave Mode', () => {
  afterEach(() => {
    stopEvent('techno')
    vi.useRealTimers()
  })

  it('runs at 150 bpm on our track, 132 with halcyon', () => {
    expect(BAR_MS).toBeCloseTo((60000 / (HALCYON ? 132 : 150)) * 4)
  })

  it('a ten-second build-up, then drop, groove and peak (and tension and breakdown on our track)', () => {
    expect(BUILD_MS).toBe(10_000)
    expect([-5, -1].map(sectionOf)).toEqual(['break', 'break'])
    if (HALCYON) expect([0, 3, 4, 11, 12, 15, 16].map(sectionOf)).toEqual(['drop', 'drop', 'groove', 'groove', 'peak', 'peak', 'drop'])
    else expect([0, 3, 4, 11, 12, 15, 16, 19, 20, 23, 24].map(sectionOf)).toEqual(['drop', 'drop', 'groove', 'groove', 'peak', 'peak', 'tension', 'tension', 'break', 'break', 'drop'])
  })

  it('keeps four on the floor after the drop, none through the build-up', () => {
    const n = (bar: number, k: number) => bar * 16 + k
    expect(kickOn(n(-3, 0))).toBe(false)
    expect(kickOn(n(0, 0))).toBe(true)
    expect(kickOn(n(0, 4))).toBe(true)
    expect(kickOn(n(5, 2))).toBe(false)
    expect(kickOn(n(15, 12))).toBe(true)
  })

  it('flashes on the kick and fades before the next one', () => {
    const t = AT + 6 * BAR_MS
    expect(technoBeat(t + 5, AT).kick).toBeGreaterThan(0.9)
    expect(technoBeat(t + 380, AT).kick).toBeLessThan(0.1)
    expect(technoBeat(t, AT).side).toBe(-technoBeat(t + BAR_MS / 4, AT).side)
  })

  it('builds through the warning into the drop, and flashes again each time the drop loops', () => {
    expect(technoBeat(AT - BUILD_MS, AT).build).toBeCloseTo(0)
    expect(technoBeat(AT - 10, AT).build).toBeGreaterThan(0.99)
    expect(technoBeat(AT + 10, AT).drop).toBeGreaterThan(0.9)
    expect(technoBeat(AT + 6 * BAR_MS, AT).drop).toBe(0)
    expect(technoBeat(AT + CYCLE_BARS * BAR_MS + 10, AT).drop).toBeGreaterThan(0.9)
  })

  it('starts with the build-up, drops a minute later, ends on time and eases the town into the night', () => {
    vi.useFakeTimers()
    const now = Date.now()
    startEvent('techno', { until: now + BUILD_MS + 60_000 })
    expect(technoOn()).toBe(true)
    expect(technoToDrop()).toBe(BUILD_MS)
    expect(technoNight(now)).toBe(0)
    vi.advanceTimersByTime(7000)
    expect(technoNight()).toBe(1)
    expect(isNight()).toBe(true)
    expect(dayPhase()).toBeCloseTo(0.5)
    vi.advanceTimersByTime(BUILD_MS)
    expect(technoToDrop()).toBe(0)
    expect(technoLeft()).toBe(60_000 - 7000)
    vi.advanceTimersByTime(54_000)
    expect(technoOn()).toBe(false)
    expect(technoNight()).toBeGreaterThan(0)
    vi.advanceTimersByTime(7000)
    expect(technoNight()).toBe(0)
  })

  it('a late joiner starts already in the night, on the same bar', () => {
    const now = Date.now()
    startEvent('techno', { from: now - 120_000, until: now + 60_000 })
    expect(technoNight(now)).toBe(1)
    expect(technoToDrop(now)).toBe(0)
  })

  it('ignores an event that is already over', () => {
    startEvent('techno', { until: Date.now() - 1 })
    expect(technoOn()).toBe(false)
  })

  it('comes on by itself every Friday, building up to a 10:00 pm drop and ending at 10:01, on the player’s clock', () => {
    // Friday 16 Oct 2026 in the test machine's own time zone.
    const drop = new Date(2026, 9, 16, 22, 0, 0).getTime()
    const w = weeklyRave(drop + 30_000)!
    expect(w.drop).toBe(drop)
    expect(w.from).toBe(drop - BUILD_MS)
    expect(w.to).toBe(drop + 60_000)
    expect(weeklyRave(drop - 5_000)?.drop).toBe(drop)
    expect(weeklyRave(drop - BUILD_MS - 1000)).toBeNull()
    expect(weeklyRave(drop + 61_000)).toBeNull()
    expect(weeklyRave(new Date(2026, 9, 17, 22, 0, 30).getTime())).toBeNull()
  })

  it('drops exactly ten seconds after the button (the event row’s start)', () => {
    vi.useFakeTimers()
    const now = Date.now()
    startEvent('techno', { from: now, until: now + 68_000 })
    expect(technoToDrop(now)).toBe(10_000)
  })
})
