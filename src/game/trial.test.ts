import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TRIAL_PRIZES, trialPrize, trialWeek, trialVenue, ghostDist, shortLeft } from './trial'
import { TRACK } from './race'

const sql = readFileSync(new URL('../../supabase/migrations/0026_time_trials.sql', import.meta.url), 'utf8')

describe('weekly time trial', () => {
  it('has the same prizes as the server', () => {
    // When this fails, paste JSON.stringify(TRIAL_PRIZES) between the $prizes$ markers in a new migration.
    expect(JSON.parse(/\$prizes\$(.*)\$prizes\$/s.exec(sql)![1])).toEqual(TRIAL_PRIZES)
  })

  it('pays by place', () => {
    expect(trialPrize(1).bucks).toBe(150)
    expect(trialPrize(3).bucks).toBe(75)
    expect(trialPrize(10).bucks).toBe(30)
    expect(trialPrize(11).bucks).toBe(0)
    expect(trialPrize(500).coins).toBe(500)
  })

  it('weeks start Monday 00:00 UTC, like public.this_week()', () => {
    expect(trialWeek(Date.UTC(2026, 9, 11, 23, 59))).toBe('2026-10-05') // Sunday
    expect(trialWeek(Date.UTC(2026, 9, 12, 0, 0))).toBe('2026-10-12') // Monday
    expect(trialWeek(Date.UTC(2027, 0, 1))).toBe('2026-12-28')
  })

  it('never runs the same venue two weeks in a row', () => {
    let t = Date.UTC(2026, 0, 5)
    let last = ''
    for (let i = 0; i < 60; i++, t += 7 * 86400000) {
      const v = trialVenue(trialWeek(t)).id
      expect(v).not.toBe(last)
      last = v
    }
  })

  it('moves the ghost from the line to the finish in its time', () => {
    expect(ghostDist(0, 5)).toBe(0)
    expect(ghostDist(5, 5)).toBe(TRACK)
    expect(ghostDist(9, 5)).toBe(TRACK)
    expect(ghostDist(2.5, 5)).toBeLessThan(TRACK / 2)
  })

  it('shows time left compactly', () => {
    expect(shortLeft(2 * 86400000 + 5 * 3600000)).toBe('2d 5h')
    expect(shortLeft(3 * 3600000 + 12 * 60000)).toBe('3h 12m')
    expect(shortLeft(9 * 60000)).toBe('9m')
  })
})
