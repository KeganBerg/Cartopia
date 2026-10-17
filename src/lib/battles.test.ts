import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BATTLE_RULES, battleChests, battleShare, warLeague, warPoints, warTiers, type Battle } from './battles'

const side = { bot: false, name: 'A', tag: 'AA', emblem: '🏁', color: '#ff7043', score: 0, members: [] }
const battle = (b: Partial<Battle>): Battle => ({ week: '2026-10-05', venue: 'main', result: null, mine: 50, mvp: false, us: side, them: side, claimed: [], ...b })

describe('crew battles', () => {
  it('uses the same rules as the server', () => {
    // The latest definition of crew_battle_rules() (0113 adds par and the war chest tiers).
    const sql = readFileSync('supabase/migrations/0113_crew_war_chests_log.sql', 'utf8')
    const rules = JSON.parse(sql.match(/crew_battle_rules\(\)[\s\S]*?select '(\{.*?\})'::jsonb/)![1])
    for (const [k, v] of Object.entries(BATTLE_RULES)) expect(rules[k], k).toEqual(v)
  })

  it('owes chests only to scorers on the winning or drawing side', () => {
    expect(battleChests(battle({ result: null }))).toEqual([])
    expect(battleChests(battle({ result: 'loss' }))).toEqual([])
    expect(battleChests(battle({ result: 'win', mine: BATTLE_RULES.minPoints - 1 }))).toEqual([])
    expect(battleChests(battle({ result: 'draw', mvp: true }))).toEqual(['battle'])
    expect(battleChests(battle({ result: 'win', mvp: true }))).toEqual(['battle', 'mvp'])
    expect(battleChests(battle({ result: 'win', mvp: true, claimed: ['battle', 'mvp'] }))).toEqual([])
  })

  it('splits the tug of war by points', () => {
    expect(battleShare(0, 0)).toBe(0.5)
    expect(battleShare(30, 10)).toBe(0.75)
  })

  it('opens a war chest at each tier of par for members who scored enough, win or lose', () => {
    const us = { ...side, score: 40 }
    expect(warTiers(battle({ us }))).toEqual([]) // before 0113: no par, no track
    const t = warTiers(battle({ us, par: 90, mine: 25 }))
    expect(t.map((x) => [x.need, x.reached, x.claimable])).toEqual([[36, true, true], [90, false, false]])
    expect(warTiers(battle({ us, par: 90, mine: BATTLE_RULES.minPoints - 1 }))[0].claimable).toBe(false)
    expect(warTiers(battle({ us, par: 90, mine: 25, claimed: ['tier1'] }))[0].claimable).toBe(false)
    expect(warTiers(battle({ us: { ...side, score: 90 }, par: 90, mine: 25, result: 'loss' })).every((x) => x.claimable)).toBe(true)
  })

  it('says what a race adds and ranks crews in leagues', () => {
    expect(warPoints(1, 0)).toBe(1)
    expect(warPoints(1, 1)).toBe(4)
    expect(warLeague({ wins: 0, losses: 0, draws: 0, streak: 0 }).id).toBe('bronze')
    expect(warLeague({ wins: 2, losses: 0, draws: 0, streak: 2 }).id).toBe('silver')
    expect(warLeague({ wins: 20, losses: 2, draws: 0, streak: 0 }).id).toBe('diamond')
    expect(warLeague({ wins: 0, losses: 200, draws: 0, streak: 0 }).rating).toBe(0)
  })

  it('keeps war chests apart from the other crew chests on the server', () => {
    const sql = readFileSync('supabase/migrations/0113_crew_war_chests_log.sql', 'utf8')
    // crew_chests is keyed by (owner, day): goal = Monday, victory + 1, MVP + 2, war chests + 3 and + 4.
    expect(sql).toMatch(/values \(me, p_week \+ 2 \+ p_tier, v_clan, 'tier' \|\| p_tier\)/)
    expect(sql).toMatch(/p_tier not in \(1, 2\)/)
    expect(sql).toMatch(/p_week not in \(wk, wk - 7\)/)
    expect(sql).toMatch(/v_points < \(rules ->> 'minPoints'\)::int/)
  })
})
