import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TAUNTS, tauntsFor, parTime, receivedTaunt, tauntText, MUTED_TAUNT } from './ghosts'
import { raceFloor } from '../game/race'

// The newest migration that (re)defines public.ghost_taunt_ids() is the one the server runs.
const dir = new URL('../../supabase/migrations/', import.meta.url)
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => readFileSync(new URL(f, dir), 'utf8')).filter((s) => s.includes('$taunts$')).at(-1)!

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

  it('offers GG and Nice race first, win or lose', () => {
    for (const won of [false, true]) expect(tauntsFor(won).slice(0, 2).map((t) => t.text)).toEqual(['GG! 🤝', 'Nice race! 👏'])
  })

  it('shows a thumbs-up for every received taunt when muted', () => {
    for (const t of TAUNTS) {
      expect(receivedTaunt(t.id, true)).toBe(MUTED_TAUNT)
      expect(receivedTaunt(t.id, false)).toBe(tauntText(t.id))
    }
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
