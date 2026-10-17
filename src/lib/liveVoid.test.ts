/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: null }))
vi.mock('./cloud', () => ({ signedInUser: () => null }))
const voided: string[] = []
vi.mock('./wagers', () => ({ acceptWager: async () => true, offerWager: async () => true, startWagers: () => {}, syncWagers: async () => 0, voidWager: async (id: string) => { voided.push(id); return 1 } }))
const live = await import('./live')

const race = (raceId: string) => ({ raceId, opponent: { id: 'x', town: 'Btown' }, host: false, mode: 'drag', stake: 500 }) as any
const tick = () => new Promise((r) => setTimeout(r, 5))

// Found by the two-player test (scripts/twoplayer): the race screen's cleanup called the bet off, and
// React runs a cleanup on a screen that stays (development mounts every screen twice), so every
// bet was refunded while both players raced on with the pot showing.
describe('a bet on a live race that has not started', () => {
  it('stays on while its race is still the live race', async () => {
    live.useLive.setState({ race: race('r1') })
    live.voidUnlessRacing('r1')
    await tick()
    expect(voided).toEqual([])
  })
  it('is called off once the race has ended', async () => {
    live.useLive.setState({ race: race('r2') })
    live.voidUnlessRacing('r2')
    live.endLiveRace()
    await tick()
    expect(voided).toEqual(['r2'])
  })
})
