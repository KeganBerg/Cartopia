import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { raceFloor } from '../game/race'
import type { Battle, BattleSide, WarAttack } from './battles'
import { streetTime, warMap, warStars } from './warMap'

const sql = readFileSync('supabase/migrations/0114_crew_war_map.sql', 'utf8')

describe('crew war map', () => {
  it('gives stars like the server: a win, then 1% and 3% margins', () => {
    expect(warStars(8.4, 8)).toBe(0)
    expect(warStars(8, 8)).toBe(0)
    expect(warStars(7.95, 8)).toBe(1)
    expect(warStars(7.92, 8)).toBe(2)
    expect(warStars(7.76, 8)).toBe(3)
    expect(sql).toMatch(/kept <= r\.their \* \(1 - \(rules ->> 'star2'\)::numeric\)/)
    expect(sql).toMatch(/kept <= r\.their \* \(1 - \(rules ->> 'star3'\)::numeric\)/)
  })

  it('times street crew drivers like the server, tougher for stronger drivers', () => {
    expect(sql).toContain("round(public.race_floor(my_pi) * (1.34 - 0.05 * least(greatest(w, 0.4), 1.6)), 2)")
    expect(streetTime(100, 1)).toBeCloseTo(raceFloor(100) * 1.29, 2)
    expect(streetTime(100, 1.6)).toBeLessThan(streetTime(100, 0.5))
    expect(streetTime(100, 9)).toBe(streetTime(100, 1.6))
  })

  it('shows each crew the stars the other took off its members', () => {
    const r = (id: string, name: string) => ({ id, name, car: 'Hellhound', body: 'muscle', color: '#f00', pi: 100, t: 8 })
    const side = (tag: string, ids: string[]): BattleSide => ({ bot: false, name: tag, tag, emblem: '🏁', color: '#fff', score: 0, members: [], roster: ids.map((id) => r(id, id.toUpperCase())) })
    const hit = (side: 'us' | 'them', target: string, stars: number): WarAttack => ({ side, by: 'x', byName: 'X', target, won: stars > 0, stars, points: stars * 5, at: '' })
    const attacks = [hit('us', 'r1', 1), hit('us', 'r1', 3), hit('us', 'r2', 0), hit('them', 'me', 2)]
    const b: Battle = { week: '2026-10-12', venue: 'main', result: null, mine: 0, mvp: false, claimed: [], us: side('US', ['me', 'm2']), them: side('TH', ['r1', 'r2', 'r3']), attacks }
    const map = warMap(b, 'me')
    expect(map.them.map((s) => [s.id, s.stars, s.hits])).toEqual([['r1', 3, 2], ['r2', 0, 1], ['r3', 0, 0]])
    expect(map.us.map((s) => [s.id, s.stars, !!s.me])).toEqual([['me', 2, true], ['m2', 0, false]])
    for (const s of map.them) {
      const hits = b.attacks!.filter((a) => a.side === 'us' && a.target === s.id)
      expect(s.hits).toBe(hits.length)
      expect(s.stars).toBe(Math.max(0, ...hits.map((a) => a.stars)))
    }
    for (const s of map.us) expect(s.hits).toBe(b.attacks!.filter((a) => a.side === 'them' && a.target === s.id).length)
  })

  it('numbers street crew drivers the way war_attack_start reads them', () => {
    expect(sql).toContain("'id', 'bot' || i")
    expect(sql).toMatch(/with ordinality as e\(m, i\)/)
    expect(sql).toContain("i := substr(p_target, 4)::int")
  })
})
