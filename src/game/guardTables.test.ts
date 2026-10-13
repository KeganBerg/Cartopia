import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GP_ROUNDS, GP_SERIES, gpRivalPi } from './data'
import { GP_BEAT } from './gpBeat'
import { bay2Table, gpBeatTable, gpRivalSlowest, gpSeries, hotTable, rarities, rescueRoll, rescueSpots, restoreMinutes, spotCosts, truckTable, visitorTable } from './guardTables'
import { hotSpot, RESCUE_SPOTS, utcDay } from './data'
import { rollSearch } from './store'
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

  it("rolls Rusty's searches like the game", () => {
    expect(newest('$spots$')).toEqual(rescueSpots())
    expect(newest('$rarity$')).toEqual(rarities())
    expect(newest('$roll$')).toEqual(rescueRoll())
    expect(newest('$spotcost$')).toEqual(spotCosts())
  })

  it("rolls Rusty's hot tip, truck and second bay like the game", () => {
    expect(newest('$hot$')).toEqual(hotTable())
    expect(newest('$truck$')).toEqual(truckTable())
    expect(newest('$bay2$')).toEqual(bay2Table())
  })

  it("picks the hot spot the way rescue_roll() does: open spots, by UTC day", () => {
    const day = 20000 * 86400000
    for (let d = 0; d < 10; d++) {
      for (const level of [1, 4, 9, 15, 24, 40]) {
        const open = RESCUE_SPOTS.filter((sp) => level >= sp.unlockLevel)
        expect(hotSpot(level, day + d * 86400000)).toBe(open[utcDay(day + d * 86400000) % open.length].id)
      }
    }
  })

  it('rolls extra spots for an upgraded truck', () => {
    for (const [truck, n] of [[0, 8], [1, 9], [2, 10], [3, 11], [9, 11]]) {
      const q = rollSearch('suburbs', [{ i: n - 1, uid: 'rx', model: 'pip', rarity: 'common' }], { truck })
      expect(q.pins.length).toBe(n)
      expect(q.pins[n - 1]).toEqual({ kind: 'car', model: 'pip', rarity: 'common', uid: 'rx' })
    }
  })

  it('rolls town visitors and barn finds like the game', () => {
    expect(newest('$visitors$')).toEqual(visitorTable())
    expect(newest('$barnspots$')).toEqual(rescueSpots())
  })

  it("puts the server's finds on their pins and no other cars", () => {
    const finds = [{ i: 2, uid: 'rabc', model: 'vette', rarity: 'rare' as const }]
    for (let n = 0; n < 50; n++) {
      const q = rollSearch('downtown', finds)
      expect(q.pins.filter((p) => p.kind === 'car')).toEqual([{ kind: 'car', model: 'vette', rarity: 'rare', uid: 'rabc' }])
      expect(q.pins[2].kind).toBe('car')
      expect(q.flatAt).not.toBe(2)
    }
  })

  it('has the Grand Prix rivals the game uses', () => {
    expect(newest('$gpseries$')).toEqual(gpSeries())
    expect(newest('$gpbeat$')).toEqual(gpBeatTable())
    expect(GP_BEAT).toEqual(gpBeatTable())
    for (const s of GP_SERIES) {
      for (const clears of [0, 1, 5, 12]) {
        expect(Math.round(gpSeries()[s.id].last * (1 + clears * 0.08))).toBe(gpRivalPi(s, GP_ROUNDS - 1, clears))
      }
    }
  }, 60000)

  it('lets a car at least as quick as the rival win', () => {
    const beat = gpBeatTable()
    for (let pi = 1; pi <= 250; pi++) expect(beat[pi - 1]).toBeLessThanOrEqual(pi)
    // A rival is never slower than its own best run.
    for (const pi of [20, 60, 120]) expect(gpRivalSlowest(pi)).toBeGreaterThan(raceFloor(pi))
  }, 60000)
})
