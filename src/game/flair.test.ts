// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useGame } from './store'
import { CHEERS, TRAILS, flairCount, flairOpen, flairOpenCount, myCheer, myTrail } from './flair'
import { MASTERY_TIERS, type Mastery } from './mastery'
import { cupRacesOf } from './cups'
import { CAR_CLASSES, carsInClass } from './classes'
import { Celebration } from '../scene/celebration'

const g = () => useGame.getState()
const blank = { trophies: 0, stats: {}, cups: {}, mastery: {} }
const done: Mastery = { races: 20, wins: 20, modes: ['drag', 'tour', 'event'], upsets: 5, tier: MASTERY_TIERS.length }

describe('flair', () => {
  it('starts with one trail and one celebration, every other one won by a challenge', () => {
    expect(TRAILS[0].challenge).toBeUndefined()
    expect(CHEERS[0].challenge).toBeUndefined()
    for (const x of [...TRAILS.slice(1), ...CHEERS.slice(1)]) expect(x.challenge, x.id).toBeDefined()
    expect(new Set(TRAILS.map((t) => t.id)).size).toBe(TRAILS.length)
    expect(new Set(CHEERS.map((c) => c.id)).size).toBe(CHEERS.length)
    expect(flairOpenCount(blank)).toBe(2)
  })
  it('counts challenges from the save', () => {
    expect(flairCount('trophies', { ...blank, trophies: 120 })).toBe(120)
    expect(flairCount('races', { ...blank, stats: { races: 7 } })).toBe(7)
    const all = Object.fromEntries(cupRacesOf('compact').map((r) => [r.id, 1]))
    expect(flairCount('cupRaces', { ...blank, cups: all })).toBe(3)
    expect(flairCount('cupClasses', { ...blank, cups: all })).toBe(1)
    const gold = Object.fromEntries(carsInClass('compact').slice(0, 3).map((c) => [c.id, done]))
    expect(flairCount('masterCars', { ...blank, mastery: gold })).toBe(3)
    expect(flairCount('goldClasses', { ...blank, mastery: gold })).toBe(1)
    expect(flairCount('galaxy', { ...blank, mastery: gold })).toBe(0)
    expect(CAR_CLASSES.length).toBeGreaterThan(1)
  })
  it('only lets an open one be picked, and falls back when the pick is locked', () => {
    useGame.setState({ trophies: 0, trail: undefined, cheer: undefined })
    g().pickFlair('trail', 'frost')
    expect(g().trail).toBeUndefined()
    useGame.setState({ trophies: 100 })
    expect(flairOpen(TRAILS.find((t) => t.id === 'frost')!.challenge, g())).toBe(true)
    g().pickFlair('trail', 'frost')
    expect(g().trail).toBe('frost')
    expect(myTrail(g()).id).toBe('frost')
    g().pickFlair('cheer', 'fireworks')
    expect(myCheer(g()).id).toBe('confetti')
    // A save edited to a locked pick still shows the starter.
    useGame.setState({ cheer: 'fireworks' })
    expect(myCheer(g()).id).toBe('confetti')
  })
  it('marks what is open as seen', () => {
    useGame.setState({ trophies: 100, flairSeen: undefined })
    g().seeFlair()
    expect(g().flairSeen).toBe(flairOpenCount(g()))
  })
})

describe('celebration', () => {
  it('launches, plays and ends on its own', () => {
    const c = new Celebration()
    let r = 0
    const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
    c.start(CHEERS[0], 0, 0, 0, 4, rand)
    expect(c.mesh.visible).toBe(true)
    for (let i = 0; i < 20; i++) c.update(0.05)
    expect(c.mesh.visible).toBe(true)
    for (let i = 0; i < 100; i++) c.update(0.05)
    expect(c.mesh.visible).toBe(false)
    c.dispose()
  })
})
