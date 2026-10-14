// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { FREE_PLAYS, comboMult, freeLeft, takeFree, PARK_LEN, PARK_LOTS, PARKED_W, boxesHit, carHits, chaseReward, chaseRow, drive, parkReward, parkStars, parkedIn, lotOpen, type Box } from './arcade'

const car = (x: number, z: number, h = 0): Box => ({ x, z, h, w: 0.8, l: PARK_LEN })

describe('arcade', () => {
  it('always leaves an open lane on the chase road', () => {
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 500; i++) {
      const r = chaseRow(rand, i)
      expect(r.cars.length).toBeGreaterThan(0)
      expect(r.cars.length).toBeLessThan(3)
      if (r.coins !== null) expect(r.cars).not.toContain(r.coins)
    }
  })

  it('caps chase pay by level', () => {
    expect(chaseReward(0, 1).coins).toBe(0)
    expect(chaseReward(100000, 1).coins).toBe(160)
    expect(chaseReward(100000, 10).coins).toBe(520)
    expect(chaseReward(100000, 10).xp).toBe(25)
  })

  it('detects box collisions at any angle', () => {
    expect(boxesHit(car(0, 0), car(0.7, 0))).toBe(true)
    expect(boxesHit(car(0, 0), car(0.9, 0))).toBe(false)
    expect(boxesHit(car(0, 0), car(1.2, 0, Math.PI / 2))).toBe(true)
    expect(boxesHit(car(0, 0), car(1.4, 0, Math.PI / 2))).toBe(false)
  })

  it('counts a car as parked only when it is fully in the spot', () => {
    const spot: Box = { x: 0, z: 0, h: 0, w: 1.4, l: 2.4 }
    expect(parkedIn(car(0, 0), spot)).toBe(true)
    expect(parkedIn(car(0, 0, Math.PI), spot)).toBe(true)
    expect(parkedIn(car(0.5, 0), spot)).toBe(false)
    expect(parkedIn(car(0, 0, 0.6), spot)).toBe(false)
  })

  it('steers like a car', () => {
    const p = drive({ x: 0, z: 0, h: 0 }, 2, 0, 1)
    expect(p.z).toBeCloseTo(2)
    expect(drive({ x: 0, z: 0, h: 0 }, 2, 0.4, 0.1).h).toBeGreaterThan(0)
    expect(drive({ x: 0, z: 0, h: 0 }, -2, 0.4, 0.1).h).toBeLessThan(0)
  })

  it('lays out every lot so it can be won', () => {
    for (const lot of PARK_LOTS) {
      const start = { ...lot.start, w: 0.8, l: PARK_LEN }
      expect(carHits(start, lot), `${lot.name} start`).toBe(false)
      // A car parked dead centre in the spot touches nothing.
      expect(carHits({ ...lot.spot, w: 0.8, l: PARK_LEN }, lot), `${lot.name} spot`).toBe(false)
      expect(parkedIn({ ...lot.spot, w: 0.8, l: PARK_LEN }, lot.spot)).toBe(true)
      expect(lot.spot.w).toBeGreaterThan(PARKED_W)
    }
  })

  it('parks in the first lot by driving straight in', () => {
    const lot = PARK_LOTS[0]
    let p = { ...lot.start }
    for (let i = 0; i < 95; i++) p = drive(p, 1, 0, 0.1)
    expect(carHits({ ...p, w: 0.8, l: PARK_LEN }, lot)).toBe(false)
    expect(parkedIn({ ...p, w: 0.8, l: PARK_LEN }, lot.spot)).toBe(true)
  })

  it('pays more stars and later lots more', () => {
    expect(parkStars(5, 0, 9)).toBe(3)
    expect(parkStars(12, 1, 9)).toBe(2)
    expect(parkStars(40, 2, 9)).toBe(1)
    expect(parkReward(0, 3, 5).coins).toBeGreaterThan(parkReward(0, 1, 5).coins)
    expect(parkReward(7, 3, 5).coins).toBeGreaterThan(parkReward(0, 3, 5).coins)
    expect(parkReward(0, 0, 5).coins).toBe(0)
    expect(lotOpen([], 0)).toBe(true)
    expect(lotOpen([0], 1)).toBe(false)
    expect(lotOpen([2], 1)).toBe(true)
  })

  it('gives a few free plays a game each day', () => {
    localStorage.clear()
    for (let i = 0; i < FREE_PLAYS; i++) expect(takeFree('stunt')).toBe(true)
    expect(takeFree('stunt')).toBe(false)
    expect(freeLeft('stunt')).toBe(0)
    expect(freeLeft('chase')).toBe(FREE_PLAYS)
    localStorage.setItem('cartopia-arcade-free', JSON.stringify({ day: '1999-1-1', used: { chase: 9 } }))
    expect(freeLeft('chase')).toBe(FREE_PLAYS)
  })

  it('builds the chase combo two near misses at a time, up to x5', () => {
    expect([0, 1, 2, 3, 4, 8, 20].map(comboMult)).toEqual([1, 1, 2, 2, 3, 5, 5])
  })
})
