// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.mock('../lib/prefs', async (orig) => ({ ...(await orig<object>()), reduceMotionOn: () => false }))

const { FlyLayer } = await import('./Fly')
const { fx } = await import('../game/fx')

// Kegan: "collecting almost everything jitters". Each collect measured the counters after the
// flying coins went in, so the browser laid the whole page out again for each kind of reward.
describe('collecting', () => {
  it('measures the counters before any coin is added, and once per kind', () => {
    const anims: Animation[] = []
    HTMLElement.prototype.animate = function () {
      const a = { onfinish: null } as unknown as Animation
      anims.push(a)
      return a
    }
    const box = { left: 10, top: 10, width: 40, height: 20, right: 50, bottom: 30, x: 10, y: 10, toJSON() {} } as DOMRect
    const order: string[] = []
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      order.push(document.querySelector('.fly') ? 'after' : 'before')
      return box
    })
    for (const k of ['coins', 'parts']) {
      const el = document.createElement('span')
      el.dataset.fly = k
      document.body.appendChild(el)
    }
    const speedo = document.createElement('div')
    speedo.className = 'speedo'
    document.body.appendChild(speedo)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => root.render(<FlyLayer />))

    fx({ kind: 'collect', uids: ['a', 'b'], coins: 120, parts: 2, xp: 5 })
    expect(document.querySelectorAll('.fly').length).toBeGreaterThan(0)
    expect(order).toEqual(['before', 'before', 'before'])

    // The coins land: counters bounce without being measured again.
    for (const a of anims) (a.onfinish as unknown as (() => void) | null)?.()
    expect(order.length).toBe(3)

    // A quick second tap reuses where the counters were.
    fx({ kind: 'collect', uids: ['a'], coins: 50, parts: 0, xp: 0 })
    expect(order.length).toBe(3)

    rect.mockRestore()
    act(() => root.unmount())
  })
})
