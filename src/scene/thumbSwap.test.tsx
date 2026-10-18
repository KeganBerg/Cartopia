// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const ctx: object = new Proxy({}, { get: () => () => ctx })
HTMLCanvasElement.prototype.getContext = (() => ctx) as never
// Like Chrome here: a target that's unobserved and observed again isn't always reported again.
const told = new WeakSet<Element>()
globalThis.IntersectionObserver = class {
  cb: IntersectionObserverCallback
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb
  }
  observe(el: Element) {
    if (told.has(el)) return
    told.add(el)
    this.cb([{ target: el, isIntersecting: true } as IntersectionObserverEntry], this as never)
  }
  unobserve() {}
  disconnect() {}
} as never

// The browser's first size report comes later; these tests set the size themselves.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as never

const { CarThumb, thumbsSeen } = await import('./BuildingPreview')

describe('a thumbnail that swaps car', () => {
  // The Grand Prix prize box cycles its cars on one canvas: they went blank after the first swap.
  it('stays on screen, so the next car draws', async () => {
    const el = document.createElement('div')
    const root = createRoot(el)
    await act(async () => root.render(<CarThumb body="sedan" color="#ff0000" />))
    expect(thumbsSeen()).toEqual([1, 1])
    await act(async () => root.render(<CarThumb body="truck" color="#00ff00" />))
    expect(thumbsSeen()).toEqual([1, 1])
    await act(async () => root.unmount())
  })
})

describe('a thumbnail that swaps car, picture kept', () => {
  // Clearing the canvas on every swap made the Grand Prix prize box blink blank each time it cycled.
  it('keeps the old picture until the new car draws, and clears it once gone', async () => {
    const el = document.createElement('div')
    const root = createRoot(el)
    await act(async () => root.render(<CarThumb body="sedan" color="#ff0000" />))
    const canvas = el.querySelector('canvas')!
    canvas.width = 120
    canvas.height = 90
    await act(async () => root.render(<CarThumb body="truck" color="#0000ff" />))
    expect(canvas.width).toBe(120)
    await act(async () => root.unmount())
    expect(canvas.width).toBe(0)
  })
})
