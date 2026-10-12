import { describe, expect, it, vi } from 'vitest'

// The rows the signed-in player can read: a race claimed by "real" and a party hosted by "host".
// race-1 has been joined by "rival"; race-3 was claimed for "rival" but they never joined.
const rows: Record<string, Record<string, { a?: string; b?: string; b_pi?: number | null; host?: string }>> = {
  live_races: { 'race-1': { a: 'real', b: 'rival', b_pi: 410 }, 'race-3': { a: 'real', b: 'rival', b_pi: null } },
  kart_parties: { 'party-1': { host: 'host' } },
}
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => ({ data: rows[table][id] ?? null, error: null }),
        }),
      }),
    }),
  },
}))

const { sentBy, joinedBy } = await import('./live')

describe('sentBy', () => {
  it('accepts a challenge from the player who claimed the race', async () => {
    expect(await sentBy('race-1', 'real', false)).toBe(true)
    expect(await sentBy('party-1', 'host', true)).toBe(true)
  })
  it('drops a challenge that names someone else as the sender', async () => {
    expect(await sentBy('race-1', 'faker', false)).toBe(false)
    expect(await sentBy('party-1', 'faker', true)).toBe(false)
  })
  it('drops a challenge for a race nobody claimed', async () => {
    expect(await sentBy('race-2', 'real', false)).toBe(false)
    expect(await sentBy('race-1', 'real', true)).toBe(false)
  })
})

describe('joinedBy', () => {
  it('accepts a yes from the challenged player once they joined the race', async () => {
    expect(await joinedBy('race-1', 'rival')).toBe(true)
  })
  it('drops a yes from anyone else, or before the race was joined', async () => {
    expect(await joinedBy('race-1', 'faker')).toBe(false)
    expect(await joinedBy('race-3', 'rival')).toBe(false)
    expect(await joinedBy('race-2', 'rival')).toBe(false)
  })
})
