/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'

const handlers: Record<string, (m: { payload: any }) => any> = {}
let authCb: any
const sent: any[] = []
const UID_ME = '00000000-0000-0000-0000-00000000000a'
const UID_B = '00000000-0000-0000-0000-00000000000b'
const UID_C = '00000000-0000-0000-0000-00000000000c'
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
        in: async () => ({ data: [{ owner_id: UID_B, town_name: 'Btown', level: 3 }, { owner_id: UID_C, town_name: 'Ctown', level: 3 }], error: null }),
        eq: (_c: string, id: string) => ({ maybeSingle: async () => (t === 'live_races' ? { data: id === 'raceC' ? { a: UID_C } : { a: UID_ME, b: UID_B, b_pi: 300 }, error: null } : { data: null, error: null }) }),
      }),
    }),
  },
}))
vi.mock('./serverCar', () => ({ SERVER_CAR_COLUMNS: '', serverCar: () => ({ name: 'Car', color: '#ffffff', body: 'sedan', pi: 100, uid: null }), serverCallCard: () => undefined }))
vi.mock('./referee', () => ({ joinRefereed: async () => true }))
vi.mock('./cloud', () => ({ signedInUser: () => UID_ME }))
vi.mock('./wagers', () => ({ acceptWager: async () => true, offerWager: async () => true, startWagers: () => {}, syncWagers: async () => 0, voidWager: async () => 0 }))
const live = await import('./live')
const { useGame } = await import('../game/store')

// Saying yes to someone's challenge while ours is out: one race at a time.
describe('accepting an invite while our own challenge is pending', () => {
  it('calls off our challenge, so a late yes to it cannot replace the race', async () => {
    live.joinLobby()
    authCb('SIGNED_IN', { user: { id: UID_ME } })
    await new Promise((r) => setTimeout(r, 10))
    useGame.setState({ toast: () => {} } as any)
    const card = (id: string, uid: string) => ({ id, uid, town: 'T', level: 3, carName: 'Car', color: '#ffffff', body: 'sedan', pi: 100 })
    live.useLive.setState({ players: [card('lobbyB', UID_B) as any, card('lobbyC', UID_C) as any] })
    // We challenge B.
    await live.challenge('lobbyB')
    const outRace = live.useLive.getState().outgoing!.raceId
    // C challenges us; we accept C.
    await handlers.challenge({ payload: { to: live.useLive.getState().me, raceId: 'raceC', from: card('lobbyC', UID_C), mode: 'drag' } })
    expect(live.useLive.getState().invites.length).toBe(1)
    await live.answer('raceC', true)
    expect(live.useLive.getState().race?.raceId).toBe('raceC')
    // B now accepts our earlier challenge.
    await handlers.answer({ payload: { raceId: outRace, accept: true, from: card('lobbyB', UID_B) } })
    expect(live.useLive.getState().race?.raceId).toBe('raceC')
    // B hears it's off instead of waiting on a race that never starts.
    expect(sent.some((m) => m.event === 'cancel' && m.payload.raceId === outRace)).toBe(true)
    expect(sent.some((m) => m.event === 'expired' && m.payload.raceId === outRace)).toBe(true)
  })
})
