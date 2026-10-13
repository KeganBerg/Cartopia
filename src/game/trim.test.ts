// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useGame, saveOf } from './store'
import { TRIM_KINDS, tidyTrim, trimCost, trimLocked, trimDef } from './trim'

const car = { uid: 't1', model: 'civic', color: '#e53935', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }

describe('trim', () => {
  it('keeps only picks that are not stock, and charges each new one once', () => {
    expect(tidyTrim({ tint: 'stock', lights: 'warm', handles: 'nope' })).toEqual({ lights: 'warm' })
    expect(tidyTrim({})).toBeUndefined()
    expect(trimCost(undefined, { tint: 'smoke', lights: 'warm' })).toBe(trimDef('tint', 'smoke').coins + trimDef('lights', 'warm').coins)
    expect(trimCost({ tint: 'smoke' }, { tint: 'smoke' })).toBe(0)
    expect(trimCost({ tint: 'smoke' }, {})).toBe(0)
    for (const k of TRIM_KINDS) expect(k.list[0]).toMatchObject({ id: 'stock', coins: 0 })
  })
  it('holds back high-level picks, but not ones the car already has', () => {
    expect(trimLocked(1, undefined, { tint: 'gold' })?.id).toBe('gold')
    expect(trimLocked(1, { tint: 'gold' }, { tint: 'gold' })).toBeNull()
    expect(trimLocked(20, undefined, { tint: 'gold' })).toBeNull()
  })
  it('buys trim in the store, and puts a saved look on another car', () => {
    const other = { ...car, uid: 't2', color: '#1e88e5' }
    useGame.setState({ coins: 5000, level: 20, cars: [car, other], presets: undefined, oldPaints: true })
    const g = () => useGame.getState()
    expect(g().setTrim('t1', { tint: 'limo', handles: 'black' })).toBe(true)
    expect(g().coins).toBe(5000 - trimDef('tint', 'limo').coins - trimDef('handles', 'black').coins)
    expect(g().setTrim('t1', { tint: 'limo', handles: 'black' })).toBe(false)
    g().savePreset(0, 't1')
    expect(saveOf(g()).presets?.[0]).toMatchObject({ color: '#e53935', trim: { tint: 'limo', handles: 'black' } })
    expect(g().applyPreset(0, 't2')).toBe(true)
    const t2 = g().cars.find((c) => c.uid === 't2')!
    expect(t2.color).toBe('#e53935')
    expect(t2.trim).toEqual({ tint: 'limo', handles: 'black' })
    g().clearPreset(0)
    expect(g().presets?.[0]).toBeNull()
    useGame.setState({ coins: 0 })
    expect(g().setTrim('t2', { lights: 'ice' })).toBe(false)
  })
})
