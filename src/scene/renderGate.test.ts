import { describe, expect, it } from 'vitest'
import { coversScreen, pauseTownDraw, holdTown, townHeld } from './renderGate'

describe('menus that cover the town', () => {
  it('pauses for a phone panel, not a desktop one', () => {
    // A wide panel on a 390x844 phone: full width, the height less the notch strip.
    expect(coversScreen(390, 812, 390, 844)).toBe(true)
    // A short bottom sheet on the same phone leaves the town showing.
    expect(coversScreen(390, 420, 390, 844)).toBe(false)
    // The same wide panel on a laptop sits in the middle of the town.
    expect(coversScreen(860, 680, 1440, 900)).toBe(false)
    expect(coversScreen(0, 0, 0, 0)).toBe(false)
  })

  it('pausing the drawing leaves the town sounds on', () => {
    const release = pauseTownDraw()
    expect(townHeld()).toBe(false)
    release()
    const hold = holdTown()
    expect(townHeld()).toBe(true)
    hold()
  })
})
