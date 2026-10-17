// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { CamButton } from './CamButton'
import { setPrefs, usePrefs } from '../lib/prefs'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('race camera button', () => {
  it('steps through the views by tap and by C, remembering drag and kart picks apart', () => {
    setPrefs({ dragView: 'chase', kartView: 'chase' })
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(<CamButton kind="drag" />))
    const btn = host.querySelector<HTMLButtonElement>('.cam-btn')!
    act(() => btn.click())
    expect(usePrefs.getState().dragView).toBe('far')
    expect(host.querySelector('.cam-flash')?.textContent).toContain('Wide')
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' })) })
    expect(usePrefs.getState().dragView).toBe('bumper')
    // A held key doesn't race round the views.
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', repeat: true })) })
    expect(usePrefs.getState().dragView).toBe('bumper')
    expect(usePrefs.getState().kartView).toBe('chase')
    expect(JSON.parse(localStorage.getItem('cartopia-prefs')!).dragView).toBe('bumper')
    act(() => root.unmount())
  })

  it('sits in the top bar of both race screens, next to the close button', () => {
    for (const f of ['Race.tsx', 'Kart.tsx']) expect(readFileSync(`src/ui/${f}`, 'utf8')).toMatch(/<CamButton kind="(drag|kart)" \/>\n\s*<button className="close"/)
  })
})
