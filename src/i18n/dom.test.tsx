// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { applyDict } from './dom'
import { compile } from './translate'

const es = compile({ Garage: 'Garaje', 'Win {} races': 'Gana {} carreras', Close: 'Cerrar', 'Search…': 'Buscar…' })
const tick = () => new Promise((r) => setTimeout(r, 0))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function View({ n, chat }: { n: number; chat: string }) {
  return (
    <div>
      <h2>Garage</h2>
      <b>Win {n} races</b>
      <button aria-label="Close">✕</button>
      <input placeholder="Search…" />
      <p data-no-i18n>{chat}</p>
    </div>
  )
}

afterEach(() => {
  applyDict(null)
  document.body.innerHTML = ''
})

describe('the page in another language', () => {
  it('translates what React draws, follows its updates, and goes back to English', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<View n={3} chat="Garage" />))
    applyDict(es)
    expect(host.querySelector('h2')!.textContent).toBe('Garaje')
    expect(host.querySelector('b')!.textContent).toBe('Gana 3 carreras')
    expect(host.querySelector('button')!.getAttribute('aria-label')).toBe('Cerrar')
    expect(host.querySelector('input')!.getAttribute('placeholder')).toBe('Buscar…')
    // Players' own words are left alone.
    expect(host.querySelector('p')!.textContent).toBe('Garage')

    act(() => root.render(<View n={4} chat="Garage" />))
    await tick()
    expect(host.querySelector('b')!.textContent).toBe('Gana 4 carreras')

    applyDict(null)
    expect(host.querySelector('h2')!.textContent).toBe('Garage')
    expect(host.querySelector('b')!.textContent).toBe('Win 4 races')
    expect(host.querySelector('button')!.getAttribute('aria-label')).toBe('Close')
    // React keeps working on its own nodes after we've written over them.
    act(() => root.render(<View n={5} chat="Garage" />))
    expect(host.querySelector('b')!.textContent).toBe('Win 5 races')
    act(() => root.unmount())
  })
})
