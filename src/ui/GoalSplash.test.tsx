// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const ctx: object = new Proxy({}, { get: () => () => ctx })
HTMLCanvasElement.prototype.getContext = (() => ctx) as never
vi.mock('../scene/BuildingPreview', () => ({ BuildingThumb: () => null, CarThumb: () => null }))

const { GoalSplash } = await import('./GoalSplash')
const { TUTORIAL_STEPS } = await import('./Tutorial')
const { useGame } = await import('../game/store')

describe('the goal splash after the tutorial', () => {
  it('waits for the level-up splash instead of stacking on it', async () => {
    useGame.setState({ tutorial: TUTORIAL_STEPS, panel: null, visiting: null, mode: 'play', levelUp: { from: 2, to: 3, coins: 200, bucks: 1 } })
    const el = document.createElement('div')
    const root = createRoot(el)
    await act(async () => root.render(<GoalSplash />))
    expect(el.querySelector('.goal')).toBeNull()
    await act(async () => useGame.getState().closeLevelUp())
    expect(el.querySelector('.goal')).not.toBeNull()
    await act(async () => root.unmount())
  })
})
