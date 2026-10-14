// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { TouchDrive, newDriveInput } from './DriveControls'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom has no PointerEvent; the controls only read these fields.
const finger = (target: Element, type: string, id: number, x: number, y = 100) => act(() => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.assign(e, { pointerId: id, pointerType: 'touch' })
  target.dispatchEvent(e)
})

describe('TouchDrive steering', () => {
  it('keeps steering with the first thumb when a second finger lands in the zone and lifts', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const input = newDriveInput()
    const root = createRoot(host)
    act(() => root.render(<TouchDrive input={input} tall />))
    const zone = host.querySelector('.dc-steer')!
    zone.getBoundingClientRect = () => ({ left: 0, top: 0, width: 380, height: 250, right: 380, bottom: 250, x: 0, y: 0, toJSON: () => ({}) })
    finger(zone, 'pointerdown', 1, 200)
    finger(zone, 'pointermove', 1, 240)
    const held = input.steer
    expect(held).toBeLessThan(-0.5)
    // The other thumb rests on the left of the zone, wiggles, then lifts.
    finger(zone, 'pointerdown', 2, 20)
    finger(zone, 'pointermove', 2, 24)
    expect(input.steer).toBe(held)
    finger(zone, 'pointerup', 2, 24)
    expect(input.steer).toBe(held)
    // The first thumb still steers, and lifting it straightens up.
    finger(zone, 'pointermove', 1, 160)
    expect(input.steer).toBeGreaterThan(0.5)
    finger(zone, 'pointerup', 1, 160)
    expect(input.steer).toBe(0)
    act(() => root.unmount())
    host.remove()
  })
})
