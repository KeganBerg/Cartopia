// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { useGame } from './store'
import { FRIEND_LEVELS, FRIEND_POINTS, friendLevel } from './friendship'

describe('friendship', () => {
  it('climbs a level at each threshold', () => {
    expect(friendLevel(0)).toBe(0)
    expect(friendLevel(FRIEND_LEVELS[2].at)).toBe(2)
    expect(friendLevel(1e6)).toBe(FRIEND_LEVELS.length - 1)
  })
  it('adds points per friend and toasts a new level once', () => {
    const toast = vi.fn()
    useGame.setState({ friendship: {}, toast })
    useGame.getState().befriend('f1', 'gift', 'Sam')
    expect(useGame.getState().friendship).toEqual({ f1: FRIEND_POINTS.gift })
    expect(toast).not.toHaveBeenCalled()
    useGame.getState().befriend('f1', 'gift', 'Sam')
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Buddy'))
    expect(useGame.getState().friendship?.f2).toBeUndefined()
  })
})
