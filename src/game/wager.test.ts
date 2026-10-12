import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { STAKES, claim, isStake, shortCoins, stakesFor } from './wager'

const sql = readFileSync(new URL('../../supabase/migrations/0057_wager_matches.sql', import.meta.url), 'utf8')

describe('wager matches', () => {
  it('server stakes match STAKES', () => {
    const m = sql.match(/\$stakes\$(.*?)\$stakes\$/)
    expect(m).not.toBeNull()
    expect(JSON.parse(m![1])).toEqual(STAKES.map((x) => [...x]))
  })

  it('stakes need both levels and your coins', () => {
    expect(stakesFor(30, 2, 1e9)).toEqual([500])
    expect(stakesFor(30, 30, 1e9)).toEqual(STAKES.map(([s]) => s))
    expect(stakesFor(30, 30, 9000)).toEqual([500, 2000])
    expect(stakesFor(1, 1, 100)).toEqual([])
    expect(isStake(10000, 8)).toBe(true)
    expect(isStake(10000, 7)).toBe(false)
    expect(isStake(1234, 99)).toBe(false)
  })

  it('claims an unbroken run of ledger rows once', () => {
    const rows = [
      { seq: 3, delta: 1000, race_id: 'r1', kind: 'win' as const },
      { seq: 2, delta: -500, race_id: 'r1', kind: 'hold' as const },
      { seq: 1, delta: -500, race_id: 'r0', kind: 'hold' as const },
      { seq: 5, delta: 500, race_id: 'r2', kind: 'refund' as const },
    ]
    expect(claim(0, rows)).toEqual({ n: 3, coins: 0 })
    expect(claim(1, rows)).toEqual({ n: 3, coins: 500 })
    expect(claim(3, rows)).toEqual({ n: 3, coins: 0 })
  })

  it('short coin labels', () => {
    expect(shortCoins(500)).toBe('500')
    expect(shortCoins(2000)).toBe('2K')
    expect(shortCoins(250000)).toBe('250K')
  })
})
