// @vitest-environment jsdom
import { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUSY_MS, OPEN_MS, usePauseTownUnder, useTownPaused } from './renderGate'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let paused = false
function Watch() {
  paused = useTownPaused()
  return null
}
// A small menu (jsdom lays nothing out, so it never covers the screen): only opening and
// scrolling hold the town.
function Menu() {
  const box = useRef<HTMLDivElement>(null)
  usePauseTownUnder(box)
  return <div ref={box} className="menu"><div className="list" /></div>
}

afterEach(() => vi.useRealTimers())

describe('town behind a menu that opens and scrolls', () => {
  it('holds the town while the menu slides in and while it scrolls, then draws again', () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => root.render(<><Watch /><Menu /></>))
    expect(paused).toBe(true)
    act(() => vi.advanceTimersByTime(OPEN_MS + 1))
    expect(paused).toBe(false)
    // A scroll inside the menu (a list in it) holds the town until the scrolling stops.
    act(() => host.querySelector('.list')!.dispatchEvent(new Event('scroll')))
    expect(paused).toBe(true)
    act(() => vi.advanceTimersByTime(BUSY_MS - 50))
    act(() => host.querySelector('.list')!.dispatchEvent(new Event('scroll')))
    act(() => vi.advanceTimersByTime(BUSY_MS - 50))
    expect(paused).toBe(true)
    act(() => vi.advanceTimersByTime(100))
    expect(paused).toBe(false)
    // Closing mid-scroll lets the town go.
    act(() => host.querySelector('.list')!.dispatchEvent(new Event('scroll')))
    act(() => root.render(<Watch />))
    expect(paused).toBe(false)
    act(() => root.unmount())
  })
})
