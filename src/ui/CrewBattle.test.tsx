// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

// The battle screen's 3D scenes need WebGL; only the no-crew view is checked here.
vi.mock('@react-three/fiber', () => ({ Canvas: () => null, useFrame: () => {}, useThree: () => ({}) }))
// Some art is drawn on a 2D canvas at import; jsdom has none.
const ctx: object = new Proxy({}, { get: () => () => ctx })
HTMLCanvasElement.prototype.getContext = (() => ctx) as never
vi.mock('./Loading', () => ({ LoadingScene: () => <div className="loading-scene" />, LoadingBand: () => null }))

const { BattlePanel } = await import('./CrewBattle')
const { useCrewBattle } = await import('../lib/battles')

describe('crew battle panel', () => {
  it("shows the no-crew screen, not an endless loader, after a player leaves their crew", async () => {
    // The server's answer for someone with no crew this week and no battle last week.
    useCrewBattle.setState({ battle: { rules: null, now: '', payable: true, chests: 0, record: null, current: null, last: null } as never, failed: false, ready: 0 })
    const el = document.createElement('div')
    const root = createRoot(el)
    await act(async () => root.render(<BattlePanel />))
    expect(el.querySelector('.cb-none')).not.toBeNull()
    expect(el.querySelector('.loading-scene')).toBeNull()
    act(() => root.unmount())
  })
})
