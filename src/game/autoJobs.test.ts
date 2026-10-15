import { describe, expect, it } from 'vitest'
import { applyAutoJobs, autoJobs, autoJobsChange, bestMatch, roundPay } from './autoJobs'
import type { OwnedCar, PlacedBuilding } from './store'

const up = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const car = (uid: string, model: string, x: Partial<OwnedCar> = {}): OwnedCar => ({ uid, model, color: '#fff', upgrades: up, ...x })
let at = 0
const bldg = (uid: string, def: string, x: Partial<PlacedBuilding> = {}): PlacedBuilding => ({ uid, def, x: (at += 4), z: 0, jobEndsAt: null, ...x })

describe('auto jobs', () => {
  it('finds the best total, not just the best first pick', () => {
    // Greedy would give row 0 to column 0 (10) and leave row 1 with 1: 11. Best is 9 + 8.
    expect(bestMatch([[10, 9], [8, 1]])).toEqual([1, 0])
    expect(bestMatch([[5], [7], [6]])).toEqual([-1, 0, -1])
    expect(bestMatch([[1, 3, 2]])).toEqual([1])
  })

  it('puts every car on a business it loves when it can', () => {
    // Kipper Pocket loves the Pizza Place; Kazumi Commuter loves both the Pizza Place and the Diner.
    const plan = autoJobs([bldg('p', 'pizza'), bldg('d', 'diner')], [car('commuter', 'civic'), car('pocket', 'pip')])
    expect(Object.fromEntries(plan.map((p) => [p.building, p.car]))).toEqual({ p: 'pocket', d: 'commuter' })
    expect(plan.every((p) => p.loves)).toBe(true)
  })

  it('fills the biggest jobs first when cars run short, and skips flats and empty tanks', () => {
    const plan = autoJobs(
      [bldg('p', 'pizza'), bldg('k', 'parkade'), bldg('c', 'coffee')],
      [car('a', 'pip', { flat: true }), car('b', 'trail'), car('c', 'civic', { lowFuel: true })],
    )
    expect(plan.map((p) => [p.building, p.car])).toEqual([['k', 'b']])
  })

  it('leaves homes and decor alone and keeps a broken car on a job nobody else took', () => {
    const buildings = [bldg('h', 'house'), bldg('p', 'pizza', { car: 'a' }), bldg('k', 'parkade')]
    const cars = [car('a', 'pip', { flat: true }), car('b', 'trail')]
    const plan = autoJobs(buildings, cars)
    expect(autoJobsChange(plan)).toBe(true)
    const next = applyAutoJobs(buildings, plan)
    expect(next.map((b) => b.car)).toEqual([undefined, 'a', 'b'])
    expect(next[0]).toBe(buildings[0])
    expect(autoJobsChange(autoJobs(next, cars))).toBe(false)
    expect(roundPay(next, cars)).toBeGreaterThan(roundPay(buildings, cars))
  })
})
