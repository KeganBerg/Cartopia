import { describe, expect, it } from 'vitest'
import { NEW_MOON_EPOCH, SYNODIC_DAYS, auroraHour, flyByGap, meteorGap, moonLit, moonPhase, parseSkyPins, pickFlyBy, skyClear } from './skyExtras'

const DAY = 24 * 60 * 60 * 1000
// Distance round the cycle, so 0.99 is close to 0.01.
const off = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b))

describe('moon', () => {
  it('is new at the epoch and a whole cycle later', () => {
    expect(off(moonPhase(NEW_MOON_EPOCH), 0)).toBeLessThan(1e-9)
    expect(off(moonPhase(NEW_MOON_EPOCH + SYNODIC_DAYS * DAY), 0)).toBeLessThan(1e-6)
    expect(moonPhase(NEW_MOON_EPOCH + (SYNODIC_DAYS / 2) * DAY)).toBeCloseTo(0.5, 6)
  })

  it('matches real full and new moons within a day or so', () => {
    const day = 1 / SYNODIC_DAYS
    expect(off(moonPhase(Date.UTC(2024, 3, 23, 23, 49)), 0.5)).toBeLessThan(day) // full, 23 Apr 2024
    expect(off(moonPhase(Date.UTC(2024, 3, 8, 18, 21)), 0)).toBeLessThan(day) // new (eclipse), 8 Apr 2024
    expect(off(moonPhase(Date.UTC(2025, 8, 7, 18, 9)), 0.5)).toBeLessThan(day) // full, 7 Sep 2025
    expect(off(moonPhase(Date.UTC(1969, 6, 20, 20, 17)), 0.25)).toBeLessThan(2 * day) // waxing crescent at the landing (day 6-7)
  })

  it('is always in 0..1, before the epoch too', () => {
    for (let t = NEW_MOON_EPOCH - 400 * DAY; t < NEW_MOON_EPOCH + 400 * DAY; t += 3.7 * DAY) {
      const p = moonPhase(t)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThan(1)
    }
  })

  it('lights none of the disc when new, half at the quarters, all when full', () => {
    expect(moonLit(0)).toBeCloseTo(0)
    expect(moonLit(0.25)).toBeCloseTo(0.5)
    expect(moonLit(0.5)).toBeCloseTo(1)
    expect(moonLit(0.75)).toBeCloseTo(0.5)
  })
})

describe('aurora hour', () => {
  const at = (h: number, m: number) => new Date(2026, 0, 10, h, m)
  it('only shows between 1 and 2 in the morning, local time', () => {
    expect(auroraHour(at(0, 59))).toBe(0)
    expect(auroraHour(at(1, 30))).toBe(1)
    expect(auroraHour(at(2, 0))).toBe(0)
    expect(auroraHour(at(13, 30))).toBe(0)
    expect(auroraHour(at(23, 30))).toBe(0)
  })
  it('fades in and out at the ends of the hour', () => {
    const start = auroraHour(at(1, 2))
    const end = auroraHour(at(1, 57))
    expect(start).toBeGreaterThan(0)
    expect(start).toBeLessThan(1)
    expect(end).toBeGreaterThan(0)
    expect(end).toBeLessThan(1)
    expect(auroraHour(at(1, 4))).toBeGreaterThan(start)
  })
})

describe('clear sky', () => {
  const w = (o: Partial<{ cloud: number; haze: number; rain: number; snow: number }>) => ({ cloud: 0, haze: 0, rain: 0, snow: 0, ...o })
  it('is clear on a clear night and not under cloud, fog or rain', () => {
    expect(skyClear(w({}))).toBe(1)
    expect(skyClear(w({ cloud: 0.65 }))).toBe(0)
    expect(skyClear(w({ haze: 0.9 }))).toBe(0)
    expect(skyClear(w({ rain: 0.25 }))).toBe(0)
    expect(skyClear(w({ cloud: 0.08, haze: 0.05 }))).toBeGreaterThan(0.9)
  })
})

describe('scheduling', () => {
  it('spaces shooting stars 20 to 60 seconds apart', () => {
    expect(meteorGap(0)).toBe(20)
    expect(meteorGap(0.999)).toBeLessThan(60)
    expect(meteorGap(0.5)).toBe(40)
  })
  it('sends something over every minute or two', () => {
    expect(flyByGap(0)).toBeGreaterThanOrEqual(45)
    expect(flyByGap(1)).toBeLessThanOrEqual(120)
  })
  it('flies balloons only on fair days, rarely a rocket, nothing in a storm', () => {
    expect(pickFlyBy(0.5, 0.1, 0, true)).toBe('balloon')
    expect(pickFlyBy(0.5, 0.1, 1, true)).toBe('plane')
    expect(pickFlyBy(0.5, 0.1, 0, false)).toBe('plane')
    expect(pickFlyBy(0.01, 0.9, 1, true)).toBe('rocket')
    expect(pickFlyBy(0.5, 0.1, 0, true, true)).toBeNull()
    let rockets = 0
    for (let i = 0; i < 1000; i++) if (pickFlyBy(i / 1000, 0.9, 0, true) === 'rocket') rockets++
    expect(rockets).toBeLessThan(50)
  })
  it('reads the ?sky= pins', () => {
    expect([...parseSkyPins('aurora,planes')]).toEqual(['aurora', 'planes'])
    expect(parseSkyPins('nope').size).toBe(0)
    expect(parseSkyPins(null).size).toBe(0)
  })
})
