// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { ShotMode } from './ShotMode'
import { isTap, setShot, useShot } from './shot'
import { setFreeCam, useFreeCam } from '../scene/freeCam'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mount = () => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(<ShotMode />))
  return { host, done: () => { act(() => root.unmount()); host.remove() } }
}
const press = (type: string, x: number, y: number, timeStamp: number) => {
  const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
  Object.defineProperties(e, { pointerId: { value: 1 }, isPrimary: { value: true }, timeStamp: { value: timeStamp } })
  act(() => void window.dispatchEvent(e))
}
const hidden = () => document.documentElement.classList.contains('shot')

afterEach(() => {
  act(() => { setShot(false); setFreeCam(false) })
})

describe('screenshot mode', () => {
  it('only offers itself in the free camera', () => {
    const m = mount()
    expect(m.host.querySelector('.shot-dock')).toBeNull()
    act(() => setFreeCam(true))
    expect(m.host.querySelector('[aria-label="Screenshot mode"]')).not.toBeNull()
    m.done()
  })

  it('hides the page, and Esc brings it back without leaving the free camera', () => {
    act(() => setFreeCam(true))
    const m = mount()
    // Stands in for FreeCam.tsx's own Esc, which leaves the free view.
    const leave = (e: KeyboardEvent) => e.code === 'Escape' && setFreeCam(false)
    window.addEventListener('keydown', leave)
    act(() => m.host.querySelector<HTMLButtonElement>('[aria-label="Screenshot mode"]')!.click())
    expect(hidden()).toBe(true)
    expect(m.host.querySelector('.shot-dock')).toBeNull()
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })))
    expect(hidden()).toBe(false)
    expect(useFreeCam.getState().on).toBe(true)
    window.removeEventListener('keydown', leave)
    m.done()
  })

  it('a tap shows the menus again; dragging the camera does not', () => {
    act(() => setFreeCam(true))
    const m = mount()
    act(() => setShot(true))
    press('pointerdown', 100, 100, 0)
    press('pointerup', 180, 140, 120)
    expect(useShot.getState().on).toBe(true)
    press('pointerdown', 100, 100, 1000)
    press('pointerup', 103, 101, 1100)
    expect(useShot.getState().on).toBe(false)
    expect(hidden()).toBe(false)
    // The click that follows the tap doesn't reach the town (it would open a building).
    let opened = 0
    m.host.addEventListener('click', () => opened++)
    act(() => void m.host.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(opened).toBe(0)
    act(() => void m.host.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(opened).toBe(1)
    m.done()
  })

  it('leaving the free camera ends it', () => {
    act(() => setFreeCam(true))
    const m = mount()
    act(() => setShot(true))
    act(() => setFreeCam(false))
    expect(useShot.getState().on).toBe(false)
    expect(hidden()).toBe(false)
    m.done()
  })

  it('tells taps from drags and long presses', () => {
    expect(isTap(3, 4, 100)).toBe(true)
    expect(isTap(12, 0, 100)).toBe(false)
    expect(isTap(0, 0, 600)).toBe(false)
  })

  it('hides every layer but the town view', () => {
    // The town's Canvas carries the one class the hiding rule spares.
    expect(readFileSync('src/App.tsx', 'utf8')).toMatch(/<Canvas className="town-3d"/)
    const css = readFileSync('src/index.css', 'utf8')
    expect(css).toContain('html.shot #root > :not(.town-3d):not(.shot-ui)')
    expect(css).toContain('html.shot body > :not(#root)')
  })
})
