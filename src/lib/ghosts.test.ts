import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TAUNTS, tauntsFor, parTime } from './ghosts'
import { raceFloor } from '../game/race'

const sql = readFileSync(new URL('../../supabase/migrations/0030_friend_ghosts.sql', import.meta.url), 'utf8')

describe('friend ghost races', () => {
  it('has the same taunt ids as the server', () => {
    const ids = JSON.parse(/\$taunts\$(.*)\$taunts\$/s.exec(sql)![1]) as { brag: number[]; any: number[] }
    expect(ids.brag).toEqual(TAUNTS.filter((t) => t.brag).map((t) => t.id))
    expect(ids.any).toEqual(TAUNTS.filter((t) => !t.brag).map((t) => t.id))
  })

  it('only offers brag taunts after a win', () => {
    expect(tauntsFor(false).every((t) => !t.brag)).toBe(true)
    expect(tauntsFor(true)).toHaveLength(TAUNTS.length)
  })

  it('keeps taunts short enough for a phone', () => {
    for (const t of TAUNTS) expect(t.text.length).toBeLessThanOrEqual(32)
  })

  it('sets a par slower than a perfect run, like the server', () => {
    // public.ghost_target: round(race_floor(pi) * 1.3, 2)
    for (const p of [20, 80, 150]) expect(parTime(p)).toBeCloseTo(Math.round(raceFloor(p) * 1.3 * 100) / 100, 5)
    expect(parTime(80)).toBeGreaterThan(raceFloor(80))
  })
})
