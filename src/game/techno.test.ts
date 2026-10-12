import { afterEach, describe, expect, it, vi } from 'vitest'
import { BAR_MS, CYCLE_BARS, kickOn, sectionOf, startEvent, stopEvent, technoBeat, technoLeft, technoNight, technoOn } from './techno'
import { dayPhase, isNight } from './clock'

// A bar number at the start of an arrangement cycle (the drop).
const DROP = CYCLE_BARS * 1_000_000

describe('Techno Night', () => {
  afterEach(() => {
    stopEvent('techno')
    vi.useRealTimers()
  })

  it('runs at 150 bpm: a sixteenth every 100 ms, a bar every 1.6 s', () => {
    expect(BAR_MS).toBe(1600)
  })

  it('lays out drop, groove, peak, tension and breakdown over 24 bars', () => {
    const at = (p: number) => sectionOf(DROP + p)
    expect([0, 3, 4, 11, 12, 15, 16, 19, 20, 23].map(at)).toEqual(['drop', 'drop', 'groove', 'groove', 'peak', 'peak', 'tension', 'tension', 'break', 'break'])
  })

  it('keeps four on the floor except through the breakdown', () => {
    const n = (p: number, k: number) => (DROP + p) * 16 + k
    expect(kickOn(n(0, 0))).toBe(true)
    expect(kickOn(n(5, 4))).toBe(true)
    expect(kickOn(n(5, 2))).toBe(false)
    expect(kickOn(n(21, 0))).toBe(false)
  })

  it('flashes on the kick and fades before the next one', () => {
    const t = (DROP + 6) * BAR_MS
    expect(technoBeat(t + 5).kick).toBeGreaterThan(0.9)
    expect(technoBeat(t + 380).kick).toBeLessThan(0.1)
    expect(technoBeat(t).side).toBe(-technoBeat(t + 400).side)
  })

  it('builds through the breakdown and goes off on the drop', () => {
    const brk = (DROP + 20) * BAR_MS
    expect(technoBeat(brk).build).toBeCloseTo(0)
    expect(technoBeat(brk + BAR_MS * 3.9).build).toBeGreaterThan(0.95)
    expect(technoBeat((DROP + 24) * BAR_MS + 10).drop).toBeGreaterThan(0.9)
    expect(technoBeat((DROP + 6) * BAR_MS).drop).toBe(0)
  })

  it('starts, counts down, ends on time and eases the town into the night', () => {
    vi.useFakeTimers()
    const now = Date.now()
    startEvent('techno', { until: now + 60_000 })
    expect(technoOn()).toBe(true)
    expect(technoLeft()).toBe(60_000)
    expect(technoNight(now)).toBe(0)
    vi.advanceTimersByTime(5000)
    expect(technoNight()).toBe(1)
    expect(isNight()).toBe(true)
    expect(dayPhase()).toBeCloseTo(0.5)
    vi.advanceTimersByTime(56_000)
    expect(technoOn()).toBe(false)
    expect(technoNight()).toBeGreaterThan(0)
    vi.advanceTimersByTime(5000)
    expect(technoNight()).toBe(0)
  })

  it('a late joiner starts already in the night', () => {
    const now = Date.now()
    startEvent('techno', { from: now - 60_000, until: now + 60_000 })
    expect(technoNight(now)).toBe(1)
  })

  it('ignores an event that is already over', () => {
    startEvent('techno', { until: Date.now() - 1 })
    expect(technoOn()).toBe(false)
  })
})
