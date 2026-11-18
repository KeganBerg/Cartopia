// @vitest-environment jsdom
import '../scene/testCanvas'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { useGame } = await import('../game/store')
const { Badges } = await import('./Badges')
const { anchorEls, setAnchorShown } = await import('../scene/anchors')

// Every job timer in town redrew each second, those panned off screen too: a hundred or more
// at once in a big town, a hitch every second while moving round. One off screen now waits,
// and shows the right time again the moment it comes back into view.
describe('job timers off screen', () => {
  afterEach(() => vi.useRealTimers())

  it('hold while hidden and catch up as they come back', async () => {
    vi.useFakeTimers()
    const t0 = new Date('2026-11-18T12:00:00Z').getTime()
    vi.setSystemTime(t0)
    const ends = t0 + 300_000
    useGame.setState({
      tutorial: 99, mode: 'play', visiting: null, cars: [],
      buildings: [
        { uid: 'on', def: 'pizza', x: 0, z: 0, rot: 0, jobEndsAt: ends },
        { uid: 'off', def: 'pizza', x: 4, z: 4, rot: 0, jobEndsAt: ends },
      ],
    } as never)
    const el = document.createElement('div')
    const root = createRoot(el)
    await act(async () => root.render(<Badges />))
    const time = (id: string) => anchorEls.get(id)!.querySelector('.time')!.textContent
    expect(time('on')).toBe('5m 00s')
    expect(time('off')).toBe('5m 00s')
    setAnchorShown('off', false)
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(time('on')).toBe('4m 57s')
    expect(time('off')).toBe('5m 00s')
    await act(async () => setAnchorShown('off', true))
    expect(time('off')).toBe('4m 57s')
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(time('off')).toBe('4m 56s')
    await act(async () => root.unmount())
  })
})
