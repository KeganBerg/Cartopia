import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { raceFloor } from '../game/race'
import type { Battle, BattleSide, WarAttack } from './battles'
import { msToWarRaces, nextTarget, streetTime, warMap, warStars, type MapSpot } from './warMap'

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

  it('picks revenge first, then the fewest stars, then the slowest time', () => {
    const spot = (id: string, stars: number, t: number, revenge = false): MapSpot => ({ id, name: id, car: 'c', body: 'sedan', color: '#fff', pi: 100, t, stars, hits: 0, revenge })
    expect(nextTarget([spot('a', 1, 8), spot('b', 0, 7), spot('c', 0, 9)], 100)?.id).toBe('c')
    expect(nextTarget([spot('a', 1, 8, true), spot('b', 0, 7), spot('c', 0, 9)], 100)?.id).toBe('a')
    // All beaten: a rematch, the slowest first.
    expect(nextTarget([spot('a', 3, 8), spot('b', 3, 7)], 100)?.id).toBe('a')
    expect(nextTarget([], 100)).toBeNull()
    // The rival just raced waits while anyone else is left.
    expect(nextTarget([spot('a', 0, 9), spot('b', 1, 7)], 100, 'a')?.id).toBe('b')
    expect(nextTarget([spot('a', 1, 9)], 100, 'a')?.id).toBe('a')
  })

  it('marks rivals who took stars off you', () => {
    const r = (id: string) => ({ id, name: id, car: 'Hellhound', body: 'muscle', color: '#f00', pi: 100, t: 8 })
    const side = (ids: string[]): BattleSide => ({ bot: false, name: 'X', tag: 'X', emblem: '🏁', color: '#fff', score: 0, members: [], roster: ids.map(r) })
    const attacks: WarAttack[] = [{ side: 'them', by: 'r2', byName: 'R2', target: 'me', won: true, stars: 2, points: 10, at: '' }, { side: 'them', by: 'r3', byName: 'R3', target: 'm2', won: true, stars: 1, points: 5, at: '' }]
    const map = warMap({ week: '2026-10-12', venue: 'main', result: null, mine: 0, mvp: false, claimed: [], us: side(['me', 'm2']), them: side(['r1', 'r2', 'r3']), attacks }, 'me')
    expect(map.them.map((s) => !!s.revenge)).toEqual([false, true, false])
  })

  it('counts down to UTC midnight', () => {
    expect(msToWarRaces(Date.UTC(2026, 9, 18, 21, 0))).toBe(3 * 3600_000)
  })
})
