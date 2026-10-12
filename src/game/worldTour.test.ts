// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useGame } from './store'
import { carDef } from './data'
import { earnHint, paintOpen } from './paintRivals'
import { TOUR_BLUE, WORLD_TOUR, worldCar, worldDone, worldPrize } from './worldTour'

describe('World Tour', () => {
  it('has nine countries, each faster than the last', () => {
    expect(WORLD_TOUR).toHaveLength(9)
    for (let i = 1; i < WORLD_TOUR.length; i++) expect(WORLD_TOUR[i].pi).toBeGreaterThan(WORLD_TOUR[i - 1].pi)
  })
  it('brings a random real car each race', () => {
    for (let i = 0; i < WORLD_TOUR.length; i++) {
      const lo = worldCar(i, () => 0), hi = worldCar(i, () => 0.999)
      expect(carDef(lo.id).parked).toBeFalsy()
      expect(carDef(hi.id).parked).toBeFalsy()
    }
  })
  it('opens Tour Blue only once every racer is beaten', () => {
    expect(paintOpen({ worldTour: 8 }, TOUR_BLUE)).toBe(false)
    expect(paintOpen({ worldTour: 9 }, TOUR_BLUE)).toBe(true)
    expect(earnHint(TOUR_BLUE)).toBe('Beat the World Tour')
    expect(worldDone(undefined)).toBe(false)
  })
  it('advances on a win over the next racer, and pays double the first time', () => {
    useGame.setState((s) => ({ coins: 0, worldTour: 0, boosts: s.boosts && { ...s.boosts, streak: 0 } }))
    useGame.getState().worldTourResult(1, true)
    expect(useGame.getState().worldTour).toBe(0)
    useGame.getState().worldTourResult(0, false)
    expect(useGame.getState().worldTour).toBe(0)
    const before = useGame.getState().coins
    useGame.getState().worldTourResult(0, true)
    expect(useGame.getState().worldTour).toBe(1)
    expect(useGame.getState().coins - before).toBeGreaterThanOrEqual(worldPrize(0, true))
    useGame.getState().worldTourResult(0, true)
    expect(useGame.getState().worldTour).toBe(1)
    expect(worldPrize(0, true)).toBe(worldPrize(0, false) * 2)
    useGame.setState({ worldTour: 8 })
    useGame.getState().worldTourResult(8, true)
    expect(worldDone(useGame.getState().worldTour)).toBe(true)
  })
})
