// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { KART_FEEL, TouchDrive, newDriveInput, sideRanges } from './DriveControls'

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

describe('sideRanges', () => {
  it('gives a thumb in the middle the full range both ways', () => {
    expect(sideRanges(195, 390, KART_FEEL.range)).toEqual({ left: 84, right: 84 })
  })
  it('lets a thumb near the right edge reach full right lock before the edge', () => {
    const r = sideRanges(350, 390, KART_FEEL.range)
    expect(r.left).toBe(84)
    expect(r.right).toBe(26)
    expect(350 + r.right).toBeLessThanOrEqual(390)
  })
})

describe('TouchDrive near the screen edge', () => {
  it('reaches full lock when the thumb lands close to the edge', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const input = newDriveInput()
    const root = createRoot(host)
    act(() => root.render(<TouchDrive input={input} tall feel={KART_FEEL} />))
    const zone = host.querySelector('.dc-steer')!
    zone.getBoundingClientRect = () => ({ left: 0, top: 0, width: window.innerWidth, height: 250, right: window.innerWidth, bottom: 250, x: 0, y: 0, toJSON: () => ({}) })
    const x = window.innerWidth - 40
    finger(zone, 'pointerdown', 1, x)
    finger(zone, 'pointermove', 1, window.innerWidth - 2)
    expect(input.steer).toBe(-1)
    finger(zone, 'pointerup', 1, window.innerWidth - 2)
    act(() => root.unmount())
    host.remove()
  })
})
