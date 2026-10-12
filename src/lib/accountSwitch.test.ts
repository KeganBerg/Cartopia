import { describe, expect, it, vi } from 'vitest'

vi.mock('./clans', () => ({ fetchMyClan: async () => ({ members: [{ ownerId: 'me' }, { ownerId: 'mate' }] }) }))
const { onAccount } = await import('./accountSwitch')
const { useGifts } = await import('./gifts')
const { useGhost } = await import('./ghosts')
const { useFriends } = await import('./friendsList')
const { useCrewMates } = await import('./crewRaces')

describe('signing out or switching accounts', () => {
  it("loads the crewmates at sign-in, without opening the Crew window", async () => {
    onAccount('me')
    await new Promise((r) => setTimeout(r, 0))
    expect(useCrewMates.getState().ids).toEqual(['mate'])
  })

  it("clears the last account's gifts, taunts, friend requests and crewmates", () => {
    useGifts.setState({ inbox: [{ id: 1 } as never], sent: { x: true } })
    useGhost.setState({ inbox: [{ id: 1 } as never] })
    useFriends.setState({ list: [{ id: 'f', status: 'incoming' } as never], loaded: true })
    onAccount(null)
    expect(useGifts.getState().inbox).toEqual([])
    expect(useGifts.getState().sent).toEqual({})
    expect(useGhost.getState().inbox).toEqual([])
    expect(useFriends.getState().list).toEqual([])
    expect(useCrewMates.getState().ids).toEqual([])
  })
})
