// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const addFriend = vi.fn(async () => true)
vi.mock('./friendsList', () => ({ addFriend }))
const { arrival, captureArrival, crewInvite, gameLink, startInviteFollowUp } = await import('./invite')
const { useNames } = await import('./profiles')

const open = (path: string) => {
  history.replaceState(null, '', path)
  captureArrival()
}

describe('invite and source links', () => {
  beforeEach(() => {
    localStorage.clear()
    addFriend.mockClear()
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
    useNames.setState({ mine: { uid: 'u1', username: 'newbie', changedAt: null } })
    open('/?ref=newbie')
    const stop2 = startInviteFollowUp()
    expect(addFriend).not.toHaveBeenCalled()
    stop2()
  })

  it('tags shared links and points local builds at the live site', () => {
    expect(gameLink('share')).toBe('https://cartopia.lol/?from=share')
  })
})
