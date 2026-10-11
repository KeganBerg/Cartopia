import { describe, expect, it } from 'vitest'
import { DAILY_TASKS, WEEKLY_TASKS, drawTasks, weekKey, msToNextWeek, msToNextDay } from './data'

describe('task calendar', () => {
  it('names ISO weeks like Postgres IYYY-"W"IW', () => {
    expect(weekKey(Date.UTC(2026, 9, 11, 23))).toBe('2026-W41') // Sunday
    expect(weekKey(Date.UTC(2026, 9, 12, 0))).toBe('2026-W42') // Monday
    expect(weekKey(Date.UTC(2021, 0, 3))).toBe('2020-W53')
    expect(weekKey(Date.UTC(2024, 11, 30))).toBe('2025-W01')
  })
  it('counts down to the next reset', () => {
    const sun = Date.UTC(2026, 9, 11, 22)
    expect(msToNextDay(sun)).toBe(2 * 3600000)
    expect(msToNextWeek(sun)).toBe(2 * 3600000)
    expect(msToNextWeek(Date.UTC(2026, 9, 12, 0))).toBe(7 * 86400000)
  })
})

describe('drawTasks', () => {
  it('draws the same three for a key and respects unlocks', () => {
    const a = drawTasks(DAILY_TASKS, '2026-10-11', 5, () => true)
    expect(a).toEqual(drawTasks(DAILY_TASKS, '2026-10-11', 5, () => true))
    expect(new Set(a.map((t) => t.id)).size).toBe(3)
    for (let d = 1; d <= 28; d++) {
      const ids = drawTasks(DAILY_TASKS, `2026-02-${String(d).padStart(2, '0')}`, 1, () => false).map((t) => t.id)
      expect(ids).not.toContain('search')
      expect(ids).not.toContain('paint')
      expect(ids).toHaveLength(3)
    }
    expect(drawTasks(WEEKLY_TASKS, '2026-W41', 1, () => false)).toHaveLength(3)
  })
})
