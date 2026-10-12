import { describe, expect, it, vi } from 'vitest'

// The rows the signed-in player can read: a race claimed by "real" and a party hosted by "host".
const rows: Record<string, Record<string, { a?: string; host?: string }>> = {
  live_races: { 'race-1': { a: 'real' } },
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

const { sentBy } = await import('./live')

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
