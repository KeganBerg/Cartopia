/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'

const handlers: Record<string, (m: { payload: any }) => any> = {}
let authCb: any
const sent: any[] = []
const UID_ME = '00000000-0000-0000-0000-00000000000a'
const UID_B = '00000000-0000-0000-0000-00000000000b'
vi.mock('./supabase', () => ({
  supabase: {
    auth: { onAuthStateChange: (cb: any) => { authCb = cb; return { data: { subscription: { unsubscribe() {} } } } } },
    realtime: { setAuth: async () => {} },
    channel: () => {
      const ch: any = {
        on: (_t: string, f: { event: string }, h: any) => { handlers[f.event] = h; return ch },
        subscribe: () => ch, track: () => {}, send: (m: any) => sent.push(m), presenceState: () => ({}),
      }
      return ch
    },
    removeChannel: () => {},
    from: (t: string) => ({
      select: () => ({
        in: async () => ({ data: [{ owner_id: UID_B, town_name: 'Btown', level: 20 }], error: null }),
        eq: (_c: string, id: string) => ({ maybeSingle: async () => (t === 'live_races' ? { data: id === 'theirBet' ? { a: UID_B } : { a: UID_ME, b: UID_B, b_pi: 90 }, error: null } : { data: null, error: null }) }),
      }),
    }),
  },
}))
vi.mock('./serverCar', () => ({ SERVER_CAR_COLUMNS: '', serverCar: () => ({ name: 'Car', color: '#ffffff', body: 'sedan', pi: 90, uid: null }), serverCallCard: () => undefined }))
vi.mock('./referee', () => ({ joinRefereed: async () => true }))
vi.mock('./cloud', () => ({ signedInUser: () => UID_ME }))
// The server refuses to hold this pair's 4th bet of the day (0059_economy_followups.sql).
vi.mock('./wagers', () => ({ acceptWager: async () => 'limit', offerWager: async () => true, startWagers: () => {}, syncWagers: async () => 0, voidWager: async () => 0 }))
const live = await import('./live')
const { useGame } = await import('../game/store')

const card = (id: string, uid: string) => ({ id, uid, town: 'Btown', level: 20, carName: 'Car', color: '#ffffff', body: 'sedan', pi: 90 })

// Found by the two-player test (scripts/twoplayer): a bet over the daily cap read as "That bet is off"
// to the player saying yes and "Challenge declined" (plus a minute's cooldown) to the challenger.
describe('a bet over the daily limit', () => {
  it('tells both players it is the limit, and the challenger can race them straight away', async () => {
    live.joinLobby()
    authCb('SIGNED_IN', { user: { id: UID_ME } })
    await new Promise((r) => setTimeout(r, 10))
    const toasts: string[] = []
    useGame.setState({ toast: (t: string) => toasts.push(t) } as any)
    live.useLive.setState({ players: [card('lobbyB', UID_B) as any] })

    // B bets us 500; we say yes but the server won't hold it.
    await handlers.challenge({ payload: { to: live.useLive.getState().me, raceId: 'theirBet', from: card('lobbyB', UID_B), mode: 'drag', stake: 500 } })
    await live.answer('theirBet', true)
    expect(live.useLive.getState().race).toBeNull()
    expect(toasts.at(-1)).toBe(live.BET_LIMIT)
    const ans = sent.find((m) => m.event === 'answer' && m.payload.raceId === 'theirBet')
    expect(ans.payload).toMatchObject({ accept: false, why: 'limit' })

    // We bet B; B's game answers no with the same reason.
    live.useLive.setState({ cooldownFrom: {}, cooldownTo: {} })
    await live.challenge('lobbyB', 'drag', 500)
    const out = live.useLive.getState().outgoing!
    await handlers.answer({ payload: { raceId: out.raceId, accept: false, why: 'limit', from: card('lobbyB', UID_B) } })
    expect(toasts.at(-1)).toBe(live.BET_LIMIT)
    expect(live.useLive.getState().cooldownTo.lobbyB).toBeUndefined()
  })
})
