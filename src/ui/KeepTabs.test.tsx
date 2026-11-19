// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KeepTabs, Kept } from './KeepTabs'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const built: string[] = []
const live = new Set<string>()
function Page({ name }: { name: string }) {
  useEffect(() => {
    built.push(name)
    live.add(name)
    return () => void live.delete(name)
  }, [name])
  return <p className={`page-${name}`}>{name}</p>
}
const shown = (host: HTMLElement) => [...host.querySelectorAll('p')].filter((p) => p.style.display !== 'none').map((p) => p.textContent)

afterEach(() => {
  built.length = 0
  live.clear()
  vi.useRealTimers()
})

describe('KeepTabs', () => {
  it('builds a tab once and only shows it again when tapped back to', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const go = (tab: string) => act(() => root.render(<KeepTabs tab={tab} render={(t) => <Page name={t} />} />))
    go('a')
    go('b')
    go('a')
    go('b')
    expect(host.querySelectorAll('p.page-a').length).toBe(1)
    expect(shown(host)).toEqual(['b'])
    // The hidden tab's effects stop (its thumbnails stop drawing) and start again when it shows.
    expect([...live]).toEqual(['b'])
    expect(built.filter((n) => n === 'a').length).toBe(2)
    act(() => root.unmount())
  })

  it('does not rebuild hidden tabs when the page around them changes', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const renders: string[] = []
    const Count = ({ name, n }: { name: string; n: number }) => (renders.push(name), <p>{name + n}</p>)
    const go = (tab: string, n: number) => act(() => root.render(<KeepTabs tab={tab} render={(t) => <Count name={t} n={n} />} />))
    go('a', 0)
    go('b', 0)
    go('c', 0)
    renders.length = 0
    go('c', 1)
    go('c', 2)
    expect(renders).toEqual(['c', 'c'])
    // Shown again, it catches up.
    go('a', 3)
    expect(host.textContent).toContain('a3')
    act(() => root.unmount())
  })
})

describe('Kept', () => {
  it('keeps a menu while the menus are up and lets it go back in town', () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    const root = createRoot(host)
    const go = (panel: string | null) => act(() => root.render(<><Kept on={panel === 'shop'} open={!!panel}><Page name="shop" /></Kept><Kept on={panel === 'goals'} open={!!panel}><Page name="goals" /></Kept></>))
    go('shop')
    go('goals')
    expect(shown(host)).toEqual(['goals'])
    go('shop')
    expect(shown(host)).toEqual(['shop'])
    expect(host.querySelectorAll('p').length).toBe(2)
    go(null)
    expect(shown(host)).toEqual([])
    expect(host.querySelectorAll('p').length).toBe(2)
    // One at a time, a moment after closing.
    act(() => void vi.advanceTimersByTime(900))
    expect(host.querySelectorAll('p').length).toBe(1)
    act(() => void vi.advanceTimersByTime(400))
    expect(host.querySelectorAll('p').length).toBe(0)
    act(() => root.unmount())
  })
  it('keeps them if a menu opens again before they go', () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    const root = createRoot(host)
    const go = (panel: string | null) => act(() => root.render(<Kept on={panel === 'shop'} open={!!panel}><Page name="shop" /></Kept>))
    go('shop')
    go(null)
    go('goals')
    act(() => void vi.advanceTimersByTime(2000))
    expect(host.querySelectorAll('p').length).toBe(1)
    act(() => root.unmount())
  })
})
