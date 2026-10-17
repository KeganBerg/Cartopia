// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { ENDLESS_PAY, ENDLESS_XP_SHARE, KINDS, endlessXp, drawEndless, endlessCapped, endlessDone, endlessPay, endlessSlots, endlessText, filledEndless, type EndlessTown } from './endless'
import { BUILDINGS, GOALS, xpGain, xpToNext } from './data'

const dir = `${process.cwd()}/supabase/migrations`
const town = (over: Partial<EndlessTown> = {}): EndlessTown => ({
  level: 12, xp: 0, stats: { jobs: 40, coinsEarned: 9000, races: 10, racesWon: 6 }, land: ['0,0', '0,1'], campaign: {},
  buildings: [{ uid: 'b1', def: 'pizza', level: 2 }, { uid: 'b2', def: 'rescue' }, { uid: 'b3', def: 'gas' }],
  cars: [{ uid: 'c1', model: 'civic', upgrades: { engine: 1, turbo: 0, tires: 0, weight: 0 } }],
  trophies: 40, tour: 3, rivalRow: {},
  value: () => 0,
  ...over,
})

describe('endless goals', () => {
  it('never run out: a thousand goals in a row at every level, each a real, short goal', () => {
    for (const level of [1, 3, 5, 12, 25, 40, 60]) {
      let e = filledEndless(null, town({ level }), 3)!
      for (let i = 0; i < 1000; i++) {
        expect(e.goals).toHaveLength(3)
        for (const g of e.goals) {
          expect(KINDS[g.kind]).toBeTruthy()
          expect(g.n).toBeGreaterThan(0)
          const text = endlessText(g, town().cars)
          expect(text.split(/\s+/).length).toBeLessThanOrEqual(12)
          expect(text).not.toContain('undefined')
        }
        // Collect the first and top up again.
        const [g, ...rest] = e.goals
        e = filledEndless({ ...e, n: e.n + 1, goals: rest, last: g.kind }, town({ level }), 3)!
      }
      expect(e.n).toBe(1000)
    }
  })

  it('draws on the town: its own buildings and cars, buildings it can afford to add, nothing it lacks', () => {
    const seen = new Set<string>()
    for (let k = 1; k < 400; k++) {
      const g = drawEndless(town(), k)
      seen.add(g.kind)
      if (g.kind === 'bldgUp') expect(g).toEqual(expect.objectContaining(g.def === 'pizza' ? { n: 3 } : { def: 'gas', n: 2 }))
      if (g.kind === 'carUp') expect(g).toMatchObject({ def: 'c1', base: 1 })
      if (g.kind === 'build') {
        const d = BUILDINGS.find((b) => b.id === g.def)!
        expect(d.unlockLevel).toBeLessThanOrEqual(12)
        expect(['pizza', 'rescue', 'gas']).not.toContain(g.def)
      }
    }
    for (const k of ['bldgUp', 'carUp', 'build', 'search', 'jobs']) expect(seen).toContain(k)
    // No Rusty's and no gas or tire shop: no search or service goals.
    for (let k = 1; k < 200; k++) expect(['search', 'service']).not.toContain(drawEndless(town({ buildings: [{ uid: 'b1', def: 'pizza' }] }), k).kind)
  })

  it('scales with level', () => {
    const jobs = (level: number) => KINDS.jobs.make(town({ level }), Math.random)!.n
    expect(jobs(40)).toBeGreaterThan(jobs(5))
    expect(endlessPay(1, 30).coins).toBeGreaterThan(endlessPay(1, 5).coins)
  })

  it('swaps out a goal for a car that was sold', () => {
    const e = { n: 4, day: '', today: 0, goals: [{ k: 5, kind: 'carUp' as const, n: 2, base: 1, def: 'gone' }] }
    const next = filledEndless(e, town(), 1)!
    expect(next.goals[0].k).toBe(6)
    expect(next.goals[0].def).not.toBe('gone')
  })

  it('counts progress from when the goal was drawn', () => {
    const t = town()
    const g = { k: 1, kind: 'jobs' as const, n: 10, base: 40 }
    expect(endlessDone(t, g)).toBe(false)
    expect(endlessDone({ ...t, stats: { ...t.stats, jobs: 50 } }, g)).toBe(true)
  })

  it('leaves the first levels to the story, then always keeps one going', () => {
    expect(endlessSlots(3, 2)).toBe(0)
    expect(endlessSlots(3, 5)).toBe(1)
    expect(endlessSlots(1, 2)).toBe(2)
    expect(endlessSlots(0, 30)).toBe(3)
  })

  it('pays parts every 5th and gems every 10th, and stops at the daily cap', () => {
    expect(endlessPay(5, 10)).toMatchObject({ parts: ENDLESS_PAY.parts, bucks: 0 })
    expect(endlessPay(10, 10)).toMatchObject({ parts: ENDLESS_PAY.parts, bucks: ENDLESS_PAY.bucks })
    expect(endlessPay(7, 10)).toMatchObject({ parts: 0, bucks: 0 })
    const now = Date.UTC(2026, 9, 16, 12)
    expect(endlessCapped({ n: 30, day: '2026-10-16', today: ENDLESS_PAY.perDay, goals: [] }, now)).toBe(true)
    expect(endlessCapped({ n: 30, day: '2026-10-15', today: ENDLESS_PAY.perDay, goals: [] }, now)).toBe(false)
  })

  it('XP still moves the level bar late in the game: at least a share of the level, never under the boosted base', () => {
    for (const l of [3, 10, 20, 30, 50, 70]) {
      expect(endlessXp(l)).toBeGreaterThanOrEqual(Math.round(ENDLESS_XP_SHARE * xpToNext(l)) - 5)
      expect(endlessXp(l)).toBeGreaterThanOrEqual(xpGain(l, endlessPay(1, l).xp))
    }
    // Twelve a day stays well under a level, so goals help without skipping the curve.
    for (const l of [10, 30, 50]) expect((12 * endlessXp(l)) / xpToNext(l)).toBeLessThan(0.25)
  })

  it('matches what the server guard pays (econ_private.endless_pay)', () => {
    const sql = readdirSync(dir).sort().map((f) => readFileSync(`${dir}/${f}`, 'utf8')).filter((s) => s.includes('$endless$')).pop()!
    const json = sql.match(/\$endless\$\s*select '([^']+)'::jsonb/)![1]
    expect(JSON.parse(json)).toEqual(ENDLESS_PAY)
  })

})

describe('endless goal variety', () => {
  it('covers every mode a level 30 town with an arcade has open', () => {
    const t = town({ level: 30, buildings: [...town().buildings, { uid: 'b4', def: 'arcade' }] })
    const seen = new Set<string>()
    for (let k = 1; k < 3000; k++) seen.add(drawEndless(t, k).kind)
    const want = ['crates', 'arcade', 'dailyRun', 'restore', 'flats', 'trophies', 'proTour', 'worldTour', 'cups', 'paintRival', 'tuner', 'power']
    expect(want.filter((k) => !seen.has(k))).toEqual([])
  })

  it('counts tallies like Pro Tour wins from when the goal was drawn', () => {
    const g = drawEndless(town(), 1, Object.keys(KINDS).filter((k) => k !== 'proTour') as never)
    expect(g).toMatchObject({ kind: 'proTour', base: 3 })
    expect(endlessDone(town({ tour: 5 }), g)).toBe(true)
    expect(endlessDone(town({ tour: 4 }), g)).toBe(false)
  })
})

describe('endless goals in the store', () => {
  beforeEach(() => localStorage.clear())

  it('fill the board once the story is done, pay on collect, and draw the next', async () => {
    const { useGame, activeEndless } = await import('./store')
    const all = GOALS.filter((g) => !g.event).map((g) => g.id)
    useGame.setState({ tutorial: 99, level: 20, claimedGoals: all, endless: null, coins: 0, parts: 0 })
    useGame.getState().tick(Date.now())
    const board = activeEndless(useGame.getState())
    expect(board).toHaveLength(3)
    // Finish every counter goal, then collect one.
    const s = useGame.getState()
    useGame.setState({ stats: Object.fromEntries(Object.entries(s.stats).map(([k, v]) => [k, v + 10000])) as typeof s.stats })
    const g = activeEndless(useGame.getState()).find((o) => KINDS[o.kind].stat)
    if (!g) return
    useGame.getState().claimEndless(g.k)
    const after = useGame.getState()
    expect(after.endless!.n).toBe(1)
    expect(after.endless!.today).toBe(1)
    expect(after.coins).toBe(endlessPay(1, 20).coins)
    expect(after.xp - s.xp).toBe(endlessXp(20))
    expect(activeEndless(after)).toHaveLength(3)
    expect(activeEndless(after).some((o) => o.k === g.k)).toBe(false)
  })
})

// Found by the two-player test (scripts/twoplayer): a fresh board's blank day made the server send a
// correction (0108 reads it as a bad count next to a saved town with no board), and the page reloaded.
describe('the endless board as saved', () => {
  it('never goes to the server with a blank day', async () => {
    const { datedEndless } = await import('./endless')
    const { saveOf, useGame } = await import('./store')
    const now = Date.UTC(2026, 9, 17, 13, 0)
    expect(datedEndless({ n: 0, day: '', today: 0, goals: [] }, now).day).toBe('2026-10-17')
    const collected = { n: 3, day: '2026-10-15', today: 1, goals: [] }
    expect(datedEndless(collected, now)).toBe(collected)
    useGame.setState({ endless: { n: 0, day: '', today: 0, goals: [{ k: 1, kind: 'drivers', n: 1, base: 0 }] } })
    expect(saveOf(useGame.getState()).endless?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
