// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const addFriend = vi.fn(async () => true)
vi.mock('./friendsList', () => ({ addFriend }))
let reply: Record<string, unknown> = {}
const rpc = vi.fn(async (name: string) => ({ data: reply[name] ?? null, error: null }))
vi.mock('./supabase', () => ({ supabase: { rpc } }))
vi.mock('./cloud', () => ({ flushSave: async () => {}, signedInUser: () => 'u1' }))
const { arrival, captureArrival, claimInviteRewards, crewInvite, gameLink, startInviteFollowUp } = await import('./invite')
const { useGame } = await import('../game/store')
const { useNames } = await import('./profiles')

const open = (path: string) => {
  history.replaceState(null, '', path)
  captureArrival()
}

describe('invite and source links', () => {
  beforeEach(() => {
    localStorage.clear()
    addFriend.mockClear()
    rpc.mockClear()
    reply = {}
    useNames.setState({ mine: undefined })
  })

  it('keeps the first source and inviter, and cleans the address bar', () => {
    open('/?from=TikTok&ref=@Speedy_1&chatdemo')
    expect(arrival()).toMatchObject({ from: 'tiktok', ref: 'speedy_1' })
    expect(location.search).toBe('?chatdemo=')
    open('/?from=reddit')
    expect(arrival()?.from).toBe('tiktok')
  })

  it('reads utm_source and ignores junk', () => {
    open('/?utm_source=youtube&utm_medium=shorts')
    expect(arrival()?.from).toBe('youtube')
    localStorage.clear()
    open('/?from=<script>')
    expect(arrival()).toBeNull()
  })

  it('remembers a crew link by its tag', () => {
    open('/?join=mr-x')
    expect(crewInvite()).toBe('MRX')
    expect(location.search).toBe('')
    // The demo crew's own switch stays put.
    open('/?crew=demo')
    expect(location.search).toBe('?crew=demo')
  })

  it('sends the inviter one friend request after sign-in, never to yourself', () => {
    open('/?ref=speedy')
    const stop = startInviteFollowUp()
    expect(addFriend).not.toHaveBeenCalled()
    useNames.setState({ mine: { uid: 'u1', username: 'newbie', changedAt: null } })
    useNames.setState({ mine: { uid: 'u1', username: 'newbie2', changedAt: null } })
    expect(addFriend).toHaveBeenCalledTimes(1)
    expect(addFriend).toHaveBeenCalledWith({ username: 'speedy' })
    stop()

    localStorage.clear()
    addFriend.mockClear()
    rpc.mockClear()
    reply = {}
    useNames.setState({ mine: { uid: 'u1', username: 'newbie', changedAt: null } })
    open('/?ref=newbie')
    const stop2 = startInviteFollowUp()
    expect(addFriend).not.toHaveBeenCalled()
    stop2()
  })

  it('tells the server the first touch once, after sign-in', async () => {
    reply = { record_arrival: 'ok' }
    open('/?from=tiktok&ref=speedy')
    const stop = startInviteFollowUp()
    useNames.setState({ mine: { uid: 'u1', username: 'newbie', changedAt: null } })
    await new Promise((r) => setTimeout(r, 0))
    expect(rpc).toHaveBeenCalledWith('record_arrival', { p_source: 'tiktok', p_ref: 'speedy' })
    expect(arrival()?.recorded).toBe(true)
    stop()
  })

  it('takes the gem count and save time the server wrote, so the next save keeps the reward', async () => {
    useGame.setState({ bucks: 40, updatedAt: 1 })
    reply = { claim_invite_rewards: { gems: 100, bucks: 140, updatedAt: 5000 } }
    await claimInviteRewards()
    expect(useGame.getState()).toMatchObject({ bucks: 140, updatedAt: 5000 })
    reply = { claim_invite_rewards: { gems: 0, bucks: 140 } }
    useGame.setState({ bucks: 150, updatedAt: 6000 })
    await claimInviteRewards()
    expect(useGame.getState()).toMatchObject({ bucks: 150, updatedAt: 6000 })
  })

  it('tags shared links and points local builds at the live site', () => {
    expect(gameLink('share')).toBe('https://cartopia.lol/?from=share')
  })
})
