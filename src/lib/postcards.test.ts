import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CARDS, MESSAGES } from './postcards'
import { CREW_ASK, CREW_GIVE_MAX } from './crewParts'

const sql = readFileSync(new URL('../../supabase/migrations/0067_postcards_crew_parts.sql', import.meta.url), 'utf8')

describe('postcards and crew parts', () => {
  it('only send what the server takes', () => {
    for (const c of CARDS) expect(c.id).toMatch(/^[a-z]{2,16}$/)
    expect(MESSAGES.length).toBeLessThanOrEqual(32)
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length)
  })
  it('match the server limits', () => {
    expect(sql).toContain(`want int not null default ${CREW_ASK}`)
    expect(sql).toContain(`and giver = me) >= ${CREW_GIVE_MAX}`)
  })
})
