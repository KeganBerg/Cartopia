import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GP_ROUNDS, GP_SERIES, gpRivalPi } from './data'
import { gpBeatTable, gpRivalSlowest, gpSeries, restoreMinutes } from './guardTables'
import { raceFloor } from './race'

const dir = new URL('../../supabase/migrations/', import.meta.url)
// The newest migration holding each table.
const newest = (tag: string) => {
  const sql = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')).filter((s) => s.includes(tag)).pop()!
  const at = sql.indexOf(tag) + tag.length
  return JSON.parse(sql.slice(at, sql.indexOf(tag, at)))
}

describe('restore and Grand Prix checks', () => {
  // When one of these fails, regenerate the table in a new migration.
  it('has the restore times the game uses', () => {
    expect(newest('$restoremin$')).toEqual(restoreMinutes())
  })

  it('has the Grand Prix rivals the game uses', () => {
    expect(newest('$gpseries$')).toEqual(gpSeries())
    expect(newest('$gpbeat$')).toEqual(gpBeatTable())
    for (const s of GP_SERIES) {
      for (const clears of [0, 1, 5, 12]) {
        expect(Math.round(gpSeries()[s.id].last * (1 + clears * 0.08))).toBe(gpRivalPi(s, GP_ROUNDS - 1, clears))
      }
    }
  })

  it('lets a car at least as quick as the rival win', () => {
    const beat = gpBeatTable()
    for (let pi = 1; pi <= 250; pi++) expect(beat[pi - 1]).toBeLessThanOrEqual(pi)
    // A rival is never slower than its own best run.
    for (const pi of [20, 60, 120]) expect(gpRivalSlowest(pi)).toBeGreaterThan(raceFloor(pi))
  })
})
