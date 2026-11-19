// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startMenuHistory } from '../lib/menuHistory'
import { useGame } from './store'
import { buildingDef, themable } from './data'
import { readFileSync } from 'node:fs'

// The menu header is rendered for real; its module draws some art on a 2D canvas at import,
// and its 3D scenes need WebGL, neither of which jsdom has.
vi.mock('@react-three/fiber', () => ({ Canvas: () => null, useFrame: () => {}, useThree: () => ({}) }))
const ctx: object = new Proxy({}, { get: () => () => ctx })
HTMLCanvasElement.prototype.getContext = (() => ctx) as never
const { Panel } = await import('../ui/Menus')

const g = () => useGame.getState()

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('closing a menu goes back to the one it came from', () => {
  beforeEach(() => useGame.setState({ panel: null, panelBack: [] }))

  it('steps back through every menu, then to the town', () => {
    g().openPanel('garage')
    g().openPanel('crates')
    g().openShop()
    g().closePanel()
    expect(g().panel).toBe('crates')
    g().closePanel()
    expect(g().panel).toBe('garage')
    g().closePanel()
    expect(g().panel).toBe(null)
  })

  it('a not-enough popup returns to the menu that raised it', () => {
    g().openPanel('shop')
    g().showNeed('coins', 500)
    expect(g().panel).toBe('need')
    g().closePanel()
    expect(g().panel).toBe('shop')
    // Following the popup on to the Bank comes back to the Shop, skipping the popup.
    g().showNeed('bucks', 5)
    g().openPanel('bank')
    g().closePanel()
    expect(g().panel).toBe('shop')
  })

  it('tabs between sibling menus keep the way back', () => {
    g().openPanel('race')
    g().openPanel('garage')
    g().swapPanel('showroom')
    g().swapPanel('crates')
    g().closePanel()
    expect(g().panel).toBe('race')
  })

  it('reopening a menu already on the trail cuts back to it instead of looping', () => {
    g().openPanel('race')
    g().openPanel('garage')
    g().openPanel('race')
    expect(g().panelBack).toEqual([])
    g().closePanel()
    expect(g().panel).toBe(null)
  })

  it('a menu opened from the town starts a fresh trail', () => {
    g().openPanel('race')
    g().openPanel('garage')
    useGame.setState({ panel: null })
    g().openPanel('shop')
    g().closePanel()
    expect(g().panel).toBe(null)
  })

  it("a building's upgrade menu goes back to the Shop's Upgrades list it was opened from", () => {
    const b = g().buildings.find((o) => themable(buildingDef(o.def)))!
    g().openPanel('shop')
    g().openUpgrade(b.uid)
    expect(g().panel).toBe('upgrade')
    // Not enough coins: the popup returns to the upgrade, which returns to the Shop.
    g().showNeed('coins', 500)
    g().closePanel()
    expect(g().panel).toBe('upgrade')
    expect(g().upgrading).toBe(b.uid)
    g().closePanel()
    expect(g().panel).toBe('shop')
  })

  it('a building tapped in the town closes back to the town', () => {
    const b = g().buildings.find((o) => themable(buildingDef(o.def)))!
    g().openUpgrade(b.uid)
    expect(g().panelBack).toEqual([])
  })
})

describe('menu header: back arrow and X', () => {
  beforeEach(() => useGame.setState({ panel: null, panelBack: [] }))
  afterEach(() => vi.useRealTimers())

  const show = () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(createElement(Panel, { title: 'Shop', children: null })))
    return { host, root, back: () => host.querySelector<HTMLButtonElement>('.panel-head .panel-back'), x: () => host.querySelector<HTMLButtonElement>('.panel-head .close')! }
  }

  it('opened from the town: only the X', () => {
    g().openPanel('shop')
    const { back, root } = show()
    expect(back()).toBe(null)
    act(() => root.unmount())
  })

  it('opened from another menu: the back arrow returns to it', () => {
    g().openPanel('garage')
    g().openPanel('crates')
    g().openShop()
    const { back, root } = show()
    expect(back()).not.toBe(null)
    act(() => back()!.click())
    expect(g().panel).toBe('crates')
    expect(g().panelBack).toEqual(['garage'])
    act(() => root.unmount())
  })

  it('the X closes straight to the town, skipping the way back', () => {
    vi.useFakeTimers()
    g().openPanel('garage')
    g().openPanel('crates')
    g().openShop()
    const { x, root } = show()
    act(() => x().click())
    act(() => void vi.advanceTimersByTime(400))
    expect(g().panel).toBe(null)
    expect(g().panelBack).toEqual([])
    act(() => root.unmount())
  })

  it('closeMenus empties the trail', () => {
    g().openPanel('race')
    g().openPanel('garage')
    g().closeMenus()
    expect(g().panel).toBe(null)
    expect(g().panelBack).toEqual([])
  })

  it('the full-screen menus get the same back arrow, and their X goes to the town', () => {
    for (const f of ['Crates.tsx', 'Wheel.tsx', 'Rescue.tsx']) {
      const src = readFileSync(`src/ui/${f}`, 'utf8')
      expect(src).toMatch(/<div className="rf-top">\n\s*(\{!embedded && )?<MenuBack \/>/)
      expect(src).toMatch(/closeMenus\(\)[^\n]*aria-label="Close"/)
    }
  })
})

describe('phone back gesture and browser back', () => {
  let stop = () => {}
  beforeEach(() => {
    useGame.setState({ panel: null, panelBack: [] })
    stop = startMenuHistory()
  })
  afterEach(() => {
    stop()
    vi.restoreAllMocks()
  })
  const pressBack = () => window.dispatchEvent(new PopStateEvent('popstate'))

  it('steps back through the menus, then to the town', () => {
    const push = vi.spyOn(history, 'pushState')
    g().openPanel('garage')
    g().openPanel('crates')
    expect(push).toHaveBeenCalledTimes(1)
    pressBack()
    expect(g().panel).toBe('garage')
    // Still in a menu: a fresh entry so the next back press lands here too.
    expect(push).toHaveBeenCalledTimes(2)
    pressBack()
    expect(g().panel).toBe(null)
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('a menu closed on screen takes its history entry off', async () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {})
    g().openPanel('shop')
    g().closeMenus()
    await Promise.resolve()
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('a menu swapped for another on screen keeps its entry', async () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {})
    g().openPanel('shop')
    g().closeMenus()
    g().openPanel('garage')
    await Promise.resolve()
    expect(back).not.toHaveBeenCalled()
  })

  it('does nothing in the middle of a race', () => {
    g().openPanel('race')
    const race = document.body.appendChild(document.createElement('div'))
    race.className = 'race-full'
    pressBack()
    expect(g().panel).toBe('race')
    race.remove()
  })
})
