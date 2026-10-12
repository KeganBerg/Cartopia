import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { WHEEL, WHEEL_DUPE, WHEEL_FALLBACK, rollWheel, spinGems, wheelCoins, wheelSlice, wheelTables } from './wheel'
import { useGame } from './store'

// wheel_spin()'s table (0064_wheel_spin.sql; pending/ holds staged SQL before it's numbered).
const serverTable = () => {
  const tag = '$wheel$'
  const files = ['../../supabase/pending/', '../../supabase/migrations/'].flatMap((d) => {
    const dir = new URL(d, import.meta.url)
    return existsSync(dir) ? readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')) : []
  })
  const sql = files.filter((s) => s.includes(tag)).pop()!
  const at = sql.indexOf(tag) + tag.length
  return JSON.parse(sql.slice(at, sql.indexOf(tag, at)))
}

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const none = { skins: [], modSkins: [] }

describe('daily prize wheel', () => {
  it('has eight slices whose weights add up to 100', () => {
    expect(WHEEL).toHaveLength(8)
    expect(WHEEL.reduce((a, s) => a + s.weight, 0)).toBe(100)
    expect(new Set(WHEEL.map((s) => s.id)).size).toBe(8)
    expect(wheelSlice(WHEEL_FALLBACK)?.kind).toBe('coins')
    expect(wheelSlice(WHEEL_DUPE)?.kind).toBe('coins')
  })

  it('makes bigger prizes rarer', () => {
    const coins = WHEEL.filter((s) => s.kind === 'coins').sort((a, b) => ('mult' in a && 'mult' in b ? a.mult - b.mult : 0))
    for (let i = 1; i < coins.length; i++) expect(coins[i].weight).toBeLessThan(coins[i - 1].weight)
    const gems = WHEEL.filter((s) => s.kind === 'gems' || s.kind === 'jackpot').sort((a, b) => ('gems' in a && 'gems' in b ? a.gems - b.gems : 0))
    for (let i = 1; i < gems.length; i++) expect(gems[i].weight).toBeLessThan(gems[i - 1].weight)
  })

  it('pays coins that grow with level', () => {
    expect(wheelCoins(0.7, 20)).toBeGreaterThan(wheelCoins(0.7, 5))
    expect(wheelCoins(0.3, 1) % 10).toBe(0)
  })

  it('lands on every slice at about its odds', () => {
    const rand = seeded(7)
    const cars = [{ uid: 'a', model: 'civic' }]
    const n = 20000
    const hits: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      const s = rollWheel(20, cars, none, rand)
      hits[s.slice] = (hits[s.slice] ?? 0) + 1
      expect(s.open.crate).toBe('wheel')
      expect(s.open.cost.coins).toBe(0)
    }
    for (const s of WHEEL) expect(Math.abs((hits[s.id] ?? 0) / n - s.weight / 100)).toBeLessThan(0.012)
  })

  it('gives gems as a negative gem cost, and a part for one of your cars', () => {
    const cars = [{ uid: 'a', model: 'civic' }]
    const seen = new Set<string>()
    const rand = seeded(3)
    for (let i = 0; i < 3000; i++) {
      const s = rollWheel(20, cars, none, rand)
      const sl = wheelSlice(s.slice)!
      seen.add(sl.kind)
      if (sl.kind === 'gems' || sl.kind === 'jackpot') expect(spinGems(s.open)).toBe(sl.gems)
      else expect(spinGems(s.open)).toBe(0)
      if (sl.kind === 'part') expect(s.open.drop).toMatchObject({ kind: 'mod', car: 'a' })
      if (sl.kind === 'skin') expect(['skin', 'skindupe']).toContain(s.open.drop.kind)
    }
    expect(seen.size).toBe(5)
  })

  it('pays the fallback coins when no part fits', () => {
    // Pick the part slice: its range starts after coins-s.
    const at = (WHEEL[0].weight + 0.5) / 100
    const s = rollWheel(20, [], none, () => at)
    expect(s.slice).toBe(WHEEL_FALLBACK)
    expect(s.open.drop).toMatchObject({ kind: 'coins' })
  })

  it('matches the server table', () => {
    expect(serverTable()).toEqual(wheelTables())
  })
})

describe('a spin in the town', () => {
  beforeEach(() => useGame.setState({ coins: 100, bucks: 2, crates: 4, lastDaily: null, dailyStreak: 0 }))

  it('adds gems and coins and counts the open', () => {
    useGame.getState().applyCrate({ seq: 5, crate: 'wheel', cost: { coins: 0, bucks: -3 }, drop: { kind: 'coins', coins: 0, jackpot: false } })
    expect(useGame.getState()).toMatchObject({ bucks: 5, coins: 100, crates: 5 })
    useGame.getState().applyCrate({ seq: 6, crate: 'wheel', cost: { coins: 0, bucks: 0 }, drop: { kind: 'coins', coins: 450, jackpot: false } })
    expect(useGame.getState()).toMatchObject({ bucks: 5, coins: 550, crates: 6 })
  })

  it('marks the day spun and keeps a streak', () => {
    useGame.getState().markSpun('2026-10-11')
    useGame.getState().markSpun('2026-10-12')
    expect(useGame.getState()).toMatchObject({ lastDaily: '2026-10-12', dailyStreak: 2 })
    useGame.getState().markSpun('2026-10-12')
    expect(useGame.getState().dailyStreak).toBe(2)
    useGame.getState().markSpun('2026-10-15')
    expect(useGame.getState().dailyStreak).toBe(1)
  })
})
