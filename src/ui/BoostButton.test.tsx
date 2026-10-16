// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { BoostButton, nextGain, type BoostGain } from './BoostButton'
import { freshRacer, shiftRacer, SHIFT_FILL } from '../game/race'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('BoostButton', () => {
  it('shows each upshift top-up on the ring before the boost is fired', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const r = freshRacer()
    r.boost = 0
    let gain: BoostGain | null = null
    const draw = () => act(() => root.render(<BoostButton r={r} onFire={() => {}} ready gain={gain} />))
    const shift = (q: number) => {
      const before = r.boost
      shiftRacer(r, q)
      gain = nextGain(gain, before, r.boost)
      draw()
    }
    draw()
    const btn = host.querySelector<HTMLButtonElement>('.boost-btn')!
    expect(host.querySelector('.boost-gain')).toBeNull()
    shift(1)
    expect(btn.style.getPropertyValue('--fill')).toBe(`${Math.round(SHIFT_FILL.perfect * 100)}%`)
    expect(host.querySelector('.boost-gain')?.textContent).toBe(`+${Math.round(SHIFT_FILL.perfect * 100)}%`)
    expect(btn.disabled).toBe(false)
    shift(0.96)
    expect(host.querySelector('.boost-gain')?.textContent).toBe(`+${Math.round(SHIFT_FILL.good * 100)}%`)
    // A sloppy shift adds nothing, so no new chip.
    const n = gain!.n
    shift(0.5)
    expect(gain!.n).toBe(n)
    // Once fired the chip goes; the ring is burning down.
    r.boostUsed = r.burning = true
    draw()
    expect(host.querySelector('.boost-gain')).toBeNull()
    act(() => root.unmount())
  })
})

// PC players saw an empty-looking tank: the ring was a fixed share of the button's diagonal,
// so it shrank to a few pixels on a desktop screen. No screen size may hide or shrink it again.
describe('boost ring CSS', () => {
  const css = readFileSync('src/index.css', 'utf8') + readFileSync('src/theme.css', 'utf8')
  it('draws the ring as a share of the button, thick enough to read', () => {
    const m = css.match(/\.boost-btn \{[^}]*radial-gradient\(circle closest-side, #263238 0 (\d+)%/)
    expect(m, 'ring background must use closest-side').not.toBeNull()
    expect(Number(m![1])).toBeLessThanOrEqual(70)
  })
  it('never hides the ring or its gain chip, at any size', () => {
    const rules = css.match(/[^{}]*\.boost-(btn|gain)[^{}]*\{[^}]*\}/g) ?? []
    for (const rule of rules) expect(rule).not.toMatch(/display:\s*none|visibility:\s*hidden|background:\s*(none|transparent)|background-image/)
  })
})
