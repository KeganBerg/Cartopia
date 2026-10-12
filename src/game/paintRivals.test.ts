// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { PAINT_RIVALS, PAINTS_TO_COLLECT, paintOpen, paintsOpen, rivalForPaint, rowPrize, rowShift } from './paintRivals'
import { RIVALS } from './rivals'
import { CAMPAIGN, CARS, GP_SERIES, LEGACY_PAINTS, PAINTS, STARTER_PAINTS } from './data'
import { VENUES } from '../scene/venues'
import { isCleanName } from '../lib/names'
import { useGame, saveOf } from './store'

describe('paint rivals', () => {
  it('have unique, clean names nobody else races under', () => {
    const others = new Set([...CAMPAIGN.flatMap((c) => c.rivals), ...GP_SERIES.flatMap((s) => s.rivals), ...RIVALS.map((r) => r.name)])
    expect(new Set(PAINT_RIVALS.map((r) => r.id)).size).toBe(PAINT_RIVALS.length)
    expect(new Set(PAINT_RIVALS.map((r) => r.name)).size).toBe(PAINT_RIVALS.length)
    for (const r of PAINT_RIVALS) {
      expect(isCleanName(r.name), r.name).toBe(true)
      expect(others.has(r.name), r.name).toBe(false)
      expect(r.line.split(' ').length, r.line).toBeLessThanOrEqual(10)
      expect(CARS.some((c) => c.id === r.car), r.car).toBe(true)
      expect(VENUES.some((v) => v.id === r.venue), r.venue).toBe(true)
    }
  })

  it('each hold one coin colour, and every non-starter coin colour has a rival', () => {
    const coin = PAINTS.filter((p) => !p.bucks).map((p) => p.color)
    expect(new Set(PAINT_RIVALS.map((r) => r.paint)).size).toBe(PAINT_RIVALS.length)
    for (const r of PAINT_RIVALS) {
      expect(coin).toContain(r.paint)
      expect(STARTER_PAINTS).not.toContain(r.paint)
    }
    for (const c of coin) if (!STARTER_PAINTS.includes(c)) expect(rivalForPaint(c), c).toBeTruthy()
    expect(PAINTS_TO_COLLECT).toBe(STARTER_PAINTS.length + PAINT_RIVALS.length)
    for (const c of [...STARTER_PAINTS, ...LEGACY_PAINTS]) expect(coin).toContain(c)
  })

  it('get harder down the roster, from rookies to legends', () => {
    for (let i = 1; i < PAINT_RIVALS.length; i++) {
      expect(PAINT_RIVALS[i].pi).toBeGreaterThan(PAINT_RIVALS[i - 1].pi)
      expect(PAINT_RIVALS[i].tier).toBeGreaterThanOrEqual(PAINT_RIVALS[i - 1].tier)
      expect(rowShift(PAINT_RIVALS[i])).toBeGreaterThanOrEqual(rowShift(PAINT_RIVALS[i - 1]))
    }
    expect(PAINT_RIVALS[0].tier).toBe(1)
    expect(PAINT_RIVALS.at(-1)!.tier).toBe(5)
    expect(rowPrize(PAINT_RIVALS[0], true)).toBeGreaterThan(rowPrize(PAINT_RIVALS[0], false))
  })

  it('new towns start with the starter colours; old towns keep theirs', () => {
    expect(paintsOpen({ rivalRow: {} })).toBe(STARTER_PAINTS.length)
    expect(paintOpen({ rivalRow: {} }, '#ec407a')).toBe(false)
    expect(paintOpen({ rivalRow: {} }, '#ffd700')).toBe(true) // gem colours stay for sale
    expect(paintOpen({ rivalRow: { penny: 1 } }, '#ec407a')).toBe(true)
    expect(paintsOpen({ rivalRow: {}, oldPaints: true })).toBe(LEGACY_PAINTS.length)
    // New colours are won even by old towns.
    expect(paintOpen({ rivalRow: {}, oldPaints: true }, '#ff7a5c')).toBe(false)
  })
})

describe('paint rivals in the store', () => {
  const car = { uid: 'p1', model: 'pip', color: '#e53935', upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }

  it('a first win unlocks the colour and pays the first-win prize', () => {
    useGame.setState({ coins: 0, rivalRow: {}, oldPaints: false, paintPrize: null, cars: [car] })
    expect(useGame.getState().paintCar('p1', { color: '#ec407a', finish: 'gloss', stripe: null })).toBe(false)
    useGame.getState().rowResult('penny', false)
    expect(useGame.getState().rivalRow.penny).toBeUndefined()
    useGame.setState({ coins: 1000 })
    useGame.getState().rowResult('penny', true)
    const s = useGame.getState()
    expect(s.rivalRow.penny).toBe(1)
    expect(s.paintPrize).toBe('penny')
    expect(s.coins).toBeGreaterThanOrEqual(1000 + rowPrize(PAINT_RIVALS[1], true))
    expect(s.paintCar('p1', { color: '#ec407a', finish: 'gloss', stripe: null })).toBe(true)
    useGame.getState().closePaintPrize()
    useGame.getState().rowResult('penny', true)
    expect(useGame.getState().rivalRow.penny).toBe(2)
    expect(useGame.getState().paintPrize).toBeNull()
  })

  it('a save from before paint rivals keeps every old colour, a new one does not', () => {
    const { rivalRow: _r, oldPaints: _o, ...old } = saveOf(useGame.getState())
    useGame.getState().loadSave(old as ReturnType<typeof saveOf>)
    expect(useGame.getState().oldPaints).toBe(true)
    expect(useGame.getState().rivalRow).toEqual({})
    useGame.getState().loadSave({ ...old, rivalRow: {}, oldPaints: false } as ReturnType<typeof saveOf>)
    expect(useGame.getState().oldPaints).toBe(false)
    expect(saveOf(useGame.getState()).oldPaints).toBe(false)
  })
})
