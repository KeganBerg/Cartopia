import { describe, expect, it } from 'vitest'
import { cleanCard } from './live'

describe('cleanCard', () => {
  it('drops cards that are not objects or have no id', () => {
    expect(cleanCard(null)).toBeNull()
    expect(cleanCard('hi')).toBeNull()
    expect(cleanCard({ town: 'x' })).toBeNull()
  })
  it('filters names and keeps fields within range', () => {
    const c = cleanCard({ id: 'abcd1234', town: 'Sh1t Creek', carName: 'fuk', level: 1e9, pi: -5, color: 'red;', body: 'spaceship', mods: ['nope', 7], uid: 'x' })!
    expect(c.town).toBe('Town #1234')
    expect(c.carName).toBe('Mystery Car')
    expect(c.level).toBe(200)
    expect(c.pi).toBe(1)
    expect(c.color).toBe('#888888')
    expect(c.body).toBe('sedan')
    expect(c.mods).toEqual([])
    expect(c.uid).toBeNull()
  })
  it('keeps a well-formed card as it is', () => {
    const card = { id: 'p1', uid: '8a1e7edb-cb66-437e-b1be-d3768917fda2', town: 'Gearville', level: 7, carName: 'Kazumi Zephyr', color: '#1e88e5', body: 'roadster', pi: 55, mods: [], closed: false }
    expect(cleanCard(card)).toEqual(card)
  })
})

describe('challenge cooldown', () => {
  it('drops the cooldown when it ends so Live buttons turn back on', async () => {
    const { vi } = await import('vitest')
    const { startCooldown, useLive } = await import('./live')
    vi.useFakeTimers()
    try {
      startCooldown('p9')
      expect(useLive.getState().cooldownTo.p9).toBeGreaterThan(Date.now())
      vi.advanceTimersByTime(61000)
      expect(useLive.getState().cooldownTo.p9).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
