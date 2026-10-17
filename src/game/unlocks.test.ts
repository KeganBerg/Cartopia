import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { UNLOCKS, hasCrewHouse, unlocked, type Unlock } from './unlocks'

type S = Parameters<typeof unlocked>[0]
const at = (tutorial: number, level = 1, races = 0, buildings: { def: string }[] = []) => ({ tutorial, level, stats: { races }, visiting: null, buildings }) as unknown as S
const CREW = [{ def: 'crew' }]
const shown = (s: S) => (Object.keys(UNLOCKS) as Unlock[]).filter((id) => unlocked(s, id))

describe('buttons arrive one at a time for new players', () => {
  it('starts with nothing but coins and level', () => {
    expect(shown(at(0))).toEqual([])
  })
  it('follows the tutorial', () => {
    expect(shown(at(1))).toEqual(['fuel'])
    expect(shown(at(3))).toEqual(['fuel', 'shop'])
    expect(shown(at(8))).toEqual(['fuel', 'shop', 'edit', 'parts', 'cars', 'race'])
  })
  it('social and season wait for levels after the tutorial', () => {
    expect(shown(at(99, 1))).not.toContain('social')
    expect(shown(at(99, 2))).toContain('social')
    expect(shown(at(99, 2))).not.toContain('season')
    expect(shown(at(99, 3, 0, CREW))).toEqual(Object.keys(UNLOCKS))
  })
  it("shows everything in a friend's town but the Bank, which needs your own Crew House", () => {
    expect(shown({ ...at(0), visiting: { townName: 'x' } } as unknown as S)).toEqual(Object.keys(UNLOCKS).filter((id) => id !== 'bank'))
  })
})

describe('real-money buys wait for the Crew House (Kegan, 2026-10-17)', () => {
  it('hides the Bank and Car Packs until a Crew House is built or packed away', () => {
    expect(unlocked(at(99, 30), 'bank')).toBe(false)
    expect(unlocked(at(99, 30, 0, [{ def: 'garage' }]), 'bank')).toBe(false)
    expect(unlocked(at(99, 2, 0, CREW), 'bank')).toBe(true)
    expect(unlocked({ ...at(99, 30), stored: CREW } as unknown as S, 'bank')).toBe(true)
  })
  it('lets the admin through without one', () => {
    expect(unlocked({ ...at(99, 1), admin: true } as unknown as S, 'bank')).toBe(true)
  })
})

describe('Crew House unlock', () => {
  it('needs a built Crew House; the admin skips it', () => {
    expect(hasCrewHouse({ buildings: [] })).toBe(false)
    expect(hasCrewHouse({ buildings: [{ def: 'rescue' }] })).toBe(false)
    expect(hasCrewHouse({ buildings: [{ def: 'rescue' }, { def: 'crew' }] })).toBe(true)
    expect(hasCrewHouse({ buildings: [], admin: true })).toBe(true)
  })

  it('locks the Crew window until it is built, unless already in a crew', () => {
    const src = readFileSync('src/ui/Social.tsx', 'utf8')
    const panel = src.slice(src.indexOf('export function ClanPanel'), src.indexOf('function CrewLocked'))
    expect(panel).toMatch(/const built = useGame\(hasCrewHouse\)/)
    // The lock comes before sign-in, the crew list and the crew home.
    const lock = panel.indexOf('<CrewLocked />')
    expect(lock).toBeGreaterThan(0)
    expect(lock).toBeLessThan(panel.indexOf('<ClanBrowser'))
    expect(lock).toBeLessThan(panel.indexOf('Sign in to join'))
    expect(panel).toMatch(/!built && \(uid === null \|\| mine === null\)/)
  })
})
