import { describe, expect, it } from 'vitest'
import { GROWTH, growthName } from './growth'

// Names that point at real-world tragedies never show in the game.
const BANNED = [/twin\s*towers?/i]

describe('banned names', () => {
  it('no building growth name uses a banned name', () => {
    for (const [id, names] of Object.entries(GROWTH)) {
      for (const n of names) for (const b of BANNED) expect(b.test(n), `${id}: ${n}`).toBe(false)
    }
  })

  it('HQ at level 10 is Skybridge Towers', () => {
    expect(growthName('hq', 'Corporate HQ', 10)).toBe('Skybridge Towers')
  })
})
