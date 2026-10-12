// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useGame } from './store'
import { PAINT_RIVALS } from './paintRivals'
import { PAINTS, PANEL_COLOR_COST, PATTERNS, RIM_COLOR_COST, panelJobCost, patternDef, tidyPanels } from './data'
import { readFileSync } from 'node:fs'

const up = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const camo = patternDef('camo')!.coins

describe('panelJobCost', () => {
  it('charges each new colour and pattern once', () => {
    expect(panelJobCost(undefined, { hood: { color: '#212121', pattern: 'camo' }, rims: { color: '#fdd835' } }))
      .toEqual({ coins: PANEL_COLOR_COST + camo + RIM_COLOR_COST, bucks: 0 })
  })
  it('is free to keep or take off what a car has', () => {
    const was = { hood: { color: '#212121' }, body: { pattern: 'camo' } }
    expect(panelJobCost(was, was)).toEqual({ coins: 0, bucks: 0 })
    expect(panelJobCost(was, {})).toEqual({ coins: 0, bucks: 0 })
  })
  it('charges a gem for a gem colour', () => {
    expect(panelJobCost(undefined, { doors: { color: '#76ff03' } })).toEqual({ coins: 0, bucks: 1 })
  })
})

describe('tidyPanels', () => {
  it('drops empty panels, and the lot when none are left', () => {
    expect(tidyPanels({ hood: {}, roof: { color: '#fafafa' } })).toEqual({ roof: { color: '#fafafa' } })
    expect(tidyPanels({ hood: {} })).toBeUndefined()
  })
})

describe('paintPanels', () => {
  const g = () => useGame.getState()
  it('paints panels, charges for them and keeps them on the car', () => {
    useGame.setState({ oldPaints: true, level: 10, coins: 5000, bucks: 0, levelUp: null, cars: [{ uid: 'p1', model: 'pip', color: '#e53935', upgrades: up }] })
    expect(g().paintPanels('p1', { hood: { color: '#212121' }, body: { pattern: 'camo' } })).toBe(true)
    expect(g().coins).toBe(5000 - PANEL_COLOR_COST - camo)
    expect(g().cars[0].panels).toEqual({ body: { pattern: 'camo' }, hood: { color: '#212121' } })
    // Back to stock: free, and the field goes.
    expect(g().paintPanels('p1', {})).toBe(true)
    expect(g().cars[0].panels).toBeUndefined()
  })
  it('keeps patterns behind their level', () => {
    const carbon = PATTERNS.find((p) => p.id === 'carbon')!
    useGame.setState({ level: carbon.unlockLevel - 1, coins: 50000, cars: [{ uid: 'p2', model: 'pip', color: '#e53935', upgrades: up }] })
    expect(g().paintPanels('p2', { hood: { pattern: 'carbon' } })).toBe(false)
    expect(g().coins).toBe(50000)
  })
  it('refuses colours off the chart and car-only panels on a bike', () => {
    useGame.setState({ oldPaints: true, level: 10, coins: 50000, cars: [{ uid: 'b1', model: 'baron', color: '#212121', upgrades: up }] })
    expect(g().paintPanels('b1', { hood: { color: '#212121' } })).toBe(false)
    expect(g().paintPanels('b1', { rims: { color: '#123456' } })).toBe(false)
    expect(g().paintPanels('b1', { body: { pattern: 'tiger' }, rims: { color: '#fdd835' } })).toBe(true)
  })
})

describe('rival colours on panels', () => {
  it('stay locked until the rival is beaten', () => {
    const r = PAINT_RIVALS.find((x) => PAINTS.some((p) => p.color === x.paint))!
    useGame.setState({ oldPaints: false, rivalRow: {}, level: 10, coins: 50000, cars: [{ uid: 'r1', model: 'pip', color: '#e53935', upgrades: up }] })
    expect(useGame.getState().paintPanels('r1', { hood: { color: r.paint } })).toBe(false)
    useGame.setState({ rivalRow: { [r.id]: 1 } })
    expect(useGame.getState().paintPanels('r1', { hood: { color: r.paint } })).toBe(true)
  })
})

describe('panel shader', () => {
  it('has a branch for every pattern number', () => {
    const src = readFileSync('src/scene/panelPaint.ts', 'utf8')
    for (const p of PATTERNS) expect(src, p.id).toContain(`id == ${p.n})`)
  })
})
