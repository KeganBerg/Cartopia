// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KartRace } from '../game/kart'
import { useLive, type LivePlayer } from '../lib/live'

// The race screen itself needs WebGL; here it only records which race it was handed.
const seen = vi.hoisted(() => [] as KartRace[])
vi.mock('./Kart', () => ({
  KartGame: ({ live }: { live?: { race: KartRace } }) => {
    if (live) seen.push(live.race)
    return null
  },
  playerRacer: () => ({ name: 'You', pi: 40, ai: false, look: { body: 'coupe', color: '#1565c0' } }),
}))
vi.mock('./LiveKart', () => ({ liveKartPrize: () => 1000 }))
vi.mock('./ArcadeBits', () => ({ look: () => ({ body: 'coupe', color: '#888888' }) }))
vi.mock('../scene/BuildingPreview', () => ({ CarThumb: () => null }))

const { LiveKartParty } = await import('./LiveKartParty')

const card = (id: string, town: string): LivePlayer => ({ id, uid: null, town, level: 10, carName: 'Stallion', color: '#c62828', body: 'coupe', pi: 40 })

// A party channel in memory: the test plays the host's side.
function fakeChannel() {
  const subs = new Map<string, ((p: unknown) => void)[]>()
  const chan = {
    send: () => {},
    on: (e: string, f: (p: unknown) => void) => void subs.set(e, [...(subs.get(e) ?? []), f]),
    close: () => {},
  }
  return { chan, emit: (e: string, p: unknown) => subs.get(e)?.forEach((f) => f(p)) }
}

describe('kart party (guest)', () => {
  afterEach(() => { seen.length = 0 })

  it('keeps the same race when someone joins or leaves the lobby mid-race', async () => {
    const host = card('host', 'Gearville'), me = card('me', 'Nitro Bay'), other = card('g2', 'Piston Hill')
    const { chan, emit } = fakeChannel()
    const deps = { join: async () => true, channel: (_id: string, onJoined: () => void) => { setTimeout(onJoined); return chan }, report: async () => null, me: 'me' }
    const car = { model: 'stallion', color: '#1565c0', mods: [] } as never
    const el = document.createElement('div')
    const root = createRoot(el)
    useLive.setState({ players: [host, other] })
    await act(async () => {
      root.render(<LiveKartParty live={{ raceId: 'r1', opponent: host, host: false, mode: 'kart', party: true }} car={car} onExit={() => {}} deps={deps as never} />)
      await new Promise((r) => setTimeout(r, 10))
    })
    await act(async () => {
      emit('setup', { seed: 12345, track: 0, reverse: false, pi: 40, players: ['host', 'me', 'g2'], cards: [host, me, other] })
      emit('go', {})
    })
    const race = seen[seen.length - 1]
    expect(race.karts.length).toBeGreaterThan(3)

    // Lobby presence syncs replace the player list (someone joins, someone leaves).
    await act(async () => { useLive.setState({ players: [host, other, card('late', 'Muffler Bay')] }) })
    await act(async () => { useLive.setState({ players: [host] }) })
    expect(seen[seen.length - 1]).toBe(race)
    act(() => root.unmount())
  })
})
