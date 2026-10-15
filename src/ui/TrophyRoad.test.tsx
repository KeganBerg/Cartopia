// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { useGame } from '../game/store'

// The car on the road is a 3D thumb; the screen's layout is what's tested.
vi.mock('../scene/BuildingPreview', () => ({ CarThumb: () => null }))
vi.mock('./Custom', () => ({ PatternSwatch: () => null }))

const { TrophyRoad } = await import('./TrophyRoad')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('Trophy Road screen', () => {
  it('opens for a save that has never claimed a stop (no road cosmetics saved yet)', () => {
    useGame.setState({ trophies: 60, road: undefined, roadItems: undefined })
    const el = document.createElement('div')
    const root = createRoot(el)
    act(() => root.render(<TrophyRoad />))
    expect(el.querySelectorAll('.tr-stop').length).toBeGreaterThan(0)
    expect(el.querySelectorAll('.tr-stop.ready').length).toBe(2)
    expect(el.querySelector('.tr-svg path')?.getAttribute('d')).toMatch(/^M /)
    act(() => root.unmount())
  })
})
