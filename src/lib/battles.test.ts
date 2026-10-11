import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BATTLE_RULES, battleChests, battleShare, type Battle } from './battles'

const side = { bot: false, name: 'A', tag: 'AA', emblem: '🏁', color: '#ff7043', score: 0, members: [] }
const battle = (b: Partial<Battle>): Battle => ({ week: '2026-10-05', venue: 'main', result: null, mine: 50, mvp: false, us: side, them: side, claimed: [], ...b })

describe('crew battles', () => {
  it('uses the same rules as the server', () => {
    const sql = readFileSync('supabase/migrations/0048_crew_battles.sql', 'utf8')
    const rules = JSON.parse(sql.match(/crew_battle_rules\(\)[\s\S]*?select '(\{.*?\})'::jsonb/)![1])
    for (const [k, v] of Object.entries(BATTLE_RULES)) expect(rules[k], k).toBe(v)
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
})
