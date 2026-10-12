// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { useGame } from './store'
import { boostsSpent } from './boosts'
import { MODS, PATTERNS, carDef, modFits } from './data'
import { TUNER_TRIALS, buildChecks, buildReady, hostMods, tunerPrize, tunerTrial } from './tuner'
import { venue } from '../scene/venues'

const up = (u: Partial<Record<'engine' | 'turbo' | 'tires' | 'weight', number>> = {}) => ({ engine: 0, turbo: 0, tires: 0, weight: 0, ...u })

describe('Tuner Trials', () => {
  it('name real cars, venues, parts and patterns', () => {
    for (const t of TUNER_TRIALS) {
      expect(carDef(t.car).id, t.id).toBe(t.car)
      expect(venue(t.venue).id, t.id).toBe(t.venue)
      for (const ids of Object.values(t.build.mods)) if (ids !== true) for (const id of ids) expect(MODS.some((m) => m.id === id), id).toBe(true)
      if (t.pattern) expect(PATTERNS.find((p) => p.id === t.pattern)?.trial, t.id).toBe(t.id)
    }
    for (const p of PATTERNS) if (p.trial) expect(tunerTrial(p.trial)?.pattern, p.id).toBe(p.id)
  })
  it('get harder down the list', () => {
    for (let i = 1; i < TUNER_TRIALS.length; i++) expect(TUNER_TRIALS[i].pi).toBeGreaterThan(TUNER_TRIALS[i - 1].pi)
  })
  it('give every host car the parts its own trial asks for', () => {
    for (const t of TUNER_TRIALS) {
      const mods = hostMods(t)
      expect(mods.every((id) => modFits(MODS.find((m) => m.id === id)!, carDef(t.car).body)), t.id).toBe(true)
      expect(buildReady(t, { model: t.car, mods, upgrades: up(t.build.tune) }), t.id).toBe(true)
    }
  })
})

describe('buildChecks', () => {
  const t = tunerTrial('downforce')!
  it('flags missing parts, the wrong tyres and low tuning', () => {
    const c = buildChecks(t, { model: 'pip', mods: ['raintires'], upgrades: up({ tires: 1 }) })
    expect(c.map((x) => [x.slot, x.ok])).toEqual([['spoiler', false], ['tires', false], ['tires', false]])
  })
  it('passes once the build is there', () => {
    const spoiler = MODS.find((m) => m.slot === 'spoiler' && !m.bucks && modFits(m, carDef('pip').body))!.id
    expect(buildReady(t, { model: 'pip', mods: [spoiler, 'snowstuds'], upgrades: up({ tires: 2 }) })).toBe(true)
  })
})

describe('tunerResult', () => {
  const g = () => useGame.getState()
  it('pays double the first time and unlocks the pattern', () => {
    const t = tunerTrial('downforce')!
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 12, 12))
    useGame.setState({ coins: 0, tuner: {}, tunerPrize: null, levelUp: null, boosts: boostsSpent(Date.UTC(2026, 9, 12, 12)) })
    g().tunerResult(t.id, true)
    vi.restoreAllMocks()
    expect(g().coins).toBe(tunerPrize(t, true))
    expect(g().tuner).toEqual({ downforce: 1 })
    expect(g().tunerPrize).toBe('downforce')
    g().closeTunerPrize()
    useGame.setState((s) => ({ boosts: s.boosts && { ...s.boosts, streak: 0 } })) // no win-streak bonus on the payout checked
    g().tunerResult(t.id, true)
    expect(g().coins).toBe(tunerPrize(t, true) + tunerPrize(t, false))
    expect(g().tunerPrize).toBeNull()
  })
  it('counts nothing for a loss', () => {
    useGame.setState({ tuner: {}, tunerPrize: null })
    g().tunerResult('pipes', false)
    expect(g().tuner).toEqual({})
  })
})

describe('trial patterns', () => {
  it('stay shut until their trial is won', () => {
    useGame.setState({ oldPaints: true, level: 50, coins: 50000, tuner: {}, cars: [{ uid: 't1', model: 'pip', color: '#e53935', upgrades: up() }] })
    expect(useGame.getState().paintPanels('t1', { body: { pattern: 'hex' } })).toBe(false)
    useGame.setState({ tuner: { downforce: 1 } })
    expect(useGame.getState().paintPanels('t1', { body: { pattern: 'hex' } })).toBe(true)
  })
})
