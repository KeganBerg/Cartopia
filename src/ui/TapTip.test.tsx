// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { TapTips, SKILL_CHIPS, SkillIcon, hideTip } from './TapTip'
import { SKILLS, skillBoost, skillDrag, type SkillId } from '../game/data'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mount(ui: React.ReactNode) {
  const el = document.createElement('div')
  document.body.append(el)
  const root = createRoot(el)
  act(() => { hideTip(); root.render(<><TapTips />{ui}</>) })
  const tap = (q: string) => act(() => (document.querySelector(q) as HTMLElement).click())
  const bubble = () => document.querySelector('.tap-tip')?.textContent ?? null
  return { tap, bubble, done: () => { act(() => root.unmount()); el.remove() } }
}

describe('tap to explain', () => {
  it('a plain badge shows its title when tapped', () => {
    const m = mount(<span id="b" title="Clear bonus (once)">🏁 5k</span>)
    expect(m.bubble()).toBeNull()
    m.tap('#b')
    expect(m.bubble()).toBe('Clear bonus (once)')
    m.done()
  })

  it('a skill icon inside a button explains instead of pressing the button', () => {
    const press = vi.fn()
    const m = mount(<button id="row" onClick={press}>Race <SkillIcon sk="torque" /></button>)
    m.tap('[data-skill]')
    expect(press).not.toHaveBeenCalled()
    expect(m.bubble()).toContain('Low-End Torque')
    expect(m.bubble()).toContain('+10% power')
    m.tap('#row')
    expect(press).toHaveBeenCalledTimes(1)
    m.done()
  })

  it('a titled button still presses on a tap', () => {
    const press = vi.fn()
    const m = mount(<button id="b" title="Turn it" onClick={press}>🔄</button>)
    m.tap('#b')
    expect(press).toHaveBeenCalledTimes(1)
    expect(m.bubble()).toBeNull()
    m.done()
  })
})

describe('skill chips match the race maths', () => {
  const at = (gear: number, dist = 10) => ({ gear, dist })
  const effect = (sk: SkillId) => {
    // Biggest boost or slow-down the skill gives across gears and the first seconds.
    let best = 1
    for (let g = 0; g < 6; g++) {
      best = Math.max(best, skillBoost(sk, at(g, 5), at(g, 10)))
      best = Math.max(best, 2 - skillDrag(sk, at(g), 1))
    }
    return Math.round((best - 1) * 100)
  }
  it('every skill has chips', () => {
    expect(Object.keys(SKILL_CHIPS).sort()).toEqual(Object.keys(SKILLS).sort())
  })
  it.each(Object.keys(SKILLS).filter((k) => k !== 'smooth') as SkillId[])('%s shows its real percentage', (sk) => {
    expect(SKILL_CHIPS[sk][0]).toContain(`${effect(sk)}%`)
  })
})
