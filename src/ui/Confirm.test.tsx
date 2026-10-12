// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { useAsk, Confirm, type AskPref } from './Confirm'
import { setPrefs, usePrefs } from '../lib/prefs'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// A button that does `run` after asking, the way Rusty's Leave and garage Sell do.
function Asker({ pref, run }: { pref: AskPref; run: () => void }) {
  const a = useAsk(pref)
  return (
    <>
      <button id="go" onClick={() => a.ask(run)}>Go</button>
      {a.open && <Confirm pref={pref} icon="💰" title="Sure?" ok="Yes" onOk={a.yes} onCancel={a.close} />}
    </>
  )
}

function mount(run: () => void) {
  const el = document.createElement('div')
  document.body.append(el)
  const root = createRoot(el)
  act(() => root.render(<Asker pref="askSell" run={run} />))
  const click = (q: string) => act(() => (document.querySelector(q) as HTMLElement).click())
  return { click, done: () => act(() => root.unmount()) }
}

describe('are you sure', () => {
  it('asks first, and Cancel does nothing', () => {
    setPrefs({ askSell: true })
    const run = vi.fn()
    const m = mount(run)
    m.click('#go')
    expect(document.querySelector('.cf-card')).not.toBeNull()
    expect(run).not.toHaveBeenCalled()
    m.click('.cf-no')
    expect(document.querySelector('.cf-card')).toBeNull()
    expect(run).not.toHaveBeenCalled()
    m.click('#go')
    m.click('.cf-yes')
    expect(run).toHaveBeenCalledTimes(1)
    expect(usePrefs.getState().askSell).toBe(true)
    m.done()
  })

  it("stops asking after \"Don't ask again\", until Settings turns it back on", () => {
    setPrefs({ askSell: true })
    const run = vi.fn()
    const m = mount(run)
    m.click('#go')
    m.click('.fw-hide input')
    m.click('.cf-yes')
    expect(run).toHaveBeenCalledTimes(1)
    expect(usePrefs.getState().askSell).toBe(false)
    expect(JSON.parse(localStorage.getItem('cartopia-prefs')!).askSell).toBe(false)
    m.click('#go')
    expect(document.querySelector('.cf-card')).toBeNull()
    expect(run).toHaveBeenCalledTimes(2)
    act(() => setPrefs({ askSell: true }))
    m.click('#go')
    expect(document.querySelector('.cf-card')).not.toBeNull()
    m.done()
  })

  it("ticking \"Don't ask again\" then Cancel keeps asking", () => {
    setPrefs({ askSell: true })
    const m = mount(vi.fn())
    m.click('#go')
    m.click('.fw-hide input')
    m.click('.cf-no')
    expect(usePrefs.getState().askSell).toBe(true)
    m.done()
  })
})
