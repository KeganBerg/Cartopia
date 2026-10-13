import { describe, expect, it } from 'vitest'
import { PLOT, START_LAND } from './data'
import { TRAFFIC, roadShare, roadsShort, trafficLevel, townTraffic } from './traffic'

const row = (n: number, z = 0) => Array.from({ length: n }, (_, i) => `${i},${z}`)
const tiles = START_LAND.length * PLOT * PLOT

describe('traffic meter', () => {
  it('is the share of owned land that is road', () => {
    expect(roadShare([], START_LAND)).toBe(0)
    expect(roadShare(row(24), START_LAND)).toBeCloseTo(24 / tiles)
    // Road off your land doesn't count.
    expect(roadShare(['-5,-5'], START_LAND)).toBe(0)
    expect(roadShare(row(3), [])).toBe(0)
  })
  it('jams under 15%, is busy to 22%, then clear', () => {
    expect(trafficLevel(0.1)).toBe('jam')
    expect(trafficLevel(0.15)).toBe('busy')
    expect(trafficLevel(0.21)).toBe('busy')
    expect(trafficLevel(0.3)).toBe('clear')
    expect(TRAFFIC.jam.pace).toBeLessThan(TRAFFIC.busy.pace)
    expect(TRAFFIC.jam.tourists).toBeLessThan(1)
  })
  it('counts the road tiles still needed', () => {
    const need = Math.ceil(0.15 * tiles)
    expect(roadsShort([], START_LAND)).toBe(need)
    const roads = [0, 1, 2, 3, 4].flatMap((z) => row(24, z)).slice(0, need)
    expect(roadsShort(roads, START_LAND)).toBe(0)
    expect(townTraffic({ roads, land: START_LAND }).name).toBe('Busy')
    expect(townTraffic({ roads: [], land: START_LAND }).name).toBe('Jammed')
  })
})
