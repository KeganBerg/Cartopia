// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// Some art is drawn on a 2D canvas at import; jsdom has none.
const ctx: object = new Proxy({}, { get: () => () => ctx })
HTMLCanvasElement.prototype.getContext = (() => ctx) as never

// The 3D parts stand in as plain elements; the parking scene pauses the town like the real one.
vi.mock('@react-three/fiber', () => ({ Canvas: ({ children }: { children: React.ReactNode }) => <div className="cv">{children}</div>, useFrame: () => {}, useThree: () => ({}) }))
vi.mock('../scene/Stage', () => ({ StageSlot: ({ children }: { children: React.ReactNode }) => <div className="cv">{children}</div>, useStageReady: () => true }))
vi.mock('../scene/BuildingPreview', () => ({ CarThumb: () => null }))
vi.mock('../scene/ChaseScene', () => ({ ChaseScene: () => null }))
vi.mock('./ArcadeMore', () => ({ STAR_GAMES: [], StarGame: () => null }))
vi.mock('./Loading', () => ({ LoadingScene: ({ onReady }: { onReady?: () => void }) => { useEffect(() => onReady?.(), [onReady]); return null } }))
vi.mock('../scene/ParkScene', async () => {
  const { holdTown } = await import('../scene/renderGate')
  return {
    ParkScene: ({ onEnd }: { onEnd: (e: { parked: boolean; time: number; bumps: number }) => void }) => {
      useEffect(() => holdTown(), [])
      return <button className="crash" onClick={() => onEnd({ parked: false, time: 3, bumps: 3 })} />
    },
  }
})
vi.mock('./ArcadeBits', async (orig) => ({
  ...(await orig<typeof import('./ArcadeBits')>()),
  payFuel: () => true,
  Countdown: ({ onGo }: { onGo: () => void }) => { useEffect(() => onGo(), [onGo]); return null },
}))

const { ArcadePanel } = await import('./Arcade')
const { useGame } = await import('../game/store')
const { townHeld } = await import('../scene/renderGate')

describe('Parking Pro', () => {
  it('lets the town move again after a few retries and Back', async () => {
    useGame.setState({ cars: [{ uid: 'a1', model: 'pip', color: '#fff', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }], fuel: 100, level: 10 })
    const el = document.createElement('div')
    document.body.append(el)
    const root = createRoot(el)
    const click = (q: string) => act(async () => (el.querySelector(q) as HTMLElement).click())
    await act(async () => root.render(<ArcadePanel />))
    await click('.arc-tile.park button')
    await click('.arc-lot')
    for (let i = 0; i < 3; i++) {
      await click('.crash')
      await click('.arc-full .buy.alt')
    }
    // One run on screen, not one per retry.
    expect(el.querySelectorAll('.cv')).toHaveLength(1)
    await click('.arc-full .close')
    expect(townHeld()).toBe(false)
    await act(async () => root.unmount())
  })
})
