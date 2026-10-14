import { beforeEach, describe, expect, it } from 'vitest'
import { useGame } from './store'

const g = () => useGame.getState()

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
})
