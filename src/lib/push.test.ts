import { describe, expect, it } from 'vitest'
import { alertsFor } from './push'
import type { PlacedBuilding } from '../game/store'

const now = 1_000_000_000_000
const town = (over: Partial<Parameters<typeof alertsFor>[0]> = {}) => ({
  buildings: [] as PlacedBuilding[], restoring: null, fuel: 999, fuelUpdatedAt: now, level: 5, townName: 'Elm Bay', ...over,
})
const job = (def: string, endsIn: number | null): PlacedBuilding => ({ uid: def + endsIn, def, x: 0, z: 0, jobEndsAt: endsIn === null ? null : now + endsIn })

describe('alertsFor', () => {
  it('sends one jobs alert for when the last long job ends', () => {
    const a = alertsFor(town({ buildings: [job('pizza', 5 * 60e3), job('tacos', 20 * 60e3), job('coffee', null)] }), now)
    expect(a).toEqual([{ kind: 'jobs', at: now + 20 * 60e3, title: 'Jobs done! 💰', body: 'Your businesses in Elm Bay are ready to collect.' }])
  })
  it('skips anything due within two minutes', () => {
    expect(alertsFor(town({ buildings: [job('pizza', 60e3)] }), now)).toEqual([])
  })
  it('adds restore and fuel alerts, soonest first', () => {
    const a = alertsFor(town({ fuel: 0, restoring: { endsAt: now + 3 * 60e3 } as never }), now)
    expect(a.map((x) => x.kind)).toEqual(['restore', 'fuel'])
    expect(a[1].at).toBeGreaterThan(now)
  })
})
