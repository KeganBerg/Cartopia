import { describe, expect, it, vi } from 'vitest'

let view: unknown = null
vi.mock('./supabase', () => ({ supabase: { rpc: async () => ({ data: view, error: null }) } }))
const { raceCalledOff } = await import('./referee')

// Found by the two-player test (scripts/twoplayer): a racer whose connection came back after the
// other racer had cancelled joined the dead race and waited on the line for someone who had gone.
describe('raceCalledOff', () => {
  it('is true once the server has voided the race', async () => {
    view = { done: false, won: null, void: true, forfeit: false, my_t: null, their_t: null }
    expect(await raceCalledOff('r1')).toBe(true)
  })
  it('is false while the race is still on', async () => {
    view = { done: false, won: null, void: false, forfeit: false, my_t: null, their_t: null }
    expect(await raceCalledOff('r1')).toBe(false)
  })
})
