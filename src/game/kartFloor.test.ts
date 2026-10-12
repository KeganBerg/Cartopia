import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LAPS, TRACKS, buildTrack, kartStats } from './kart'

// The kart party referee (supabase/migrations/0060_kart_floor_by_pi.sql) raises any finish faster
// than three laps of the shortest line at 1.6x top speed. Keep it below anything a real kart can do.
const sql = readFileSync(new URL('../../supabase/migrations/0060_kart_floor_by_pi.sql', import.meta.url), 'utf8')
const m = /select round\((\d+) \/ \(\((\d+) \+ (\d+) \* \(1 - exp\(-greatest\(coalesce\(pi, 1\), 1\) \/ ([\d.]+)\)\)\) \* ([\d.]+)\), 3\)/.exec(sql)
const [dist, base, span, scale, mult] = m ? m.slice(1).map(Number) : []
const floor = (pi: number) => dist / ((base + span * (1 - Math.exp(-Math.max(pi, 1) / scale))) * mult)

// Shortest closed line inside the barriers: pull each point to its neighbours' midpoint.
function shortestLap(id: string) {
  const t = buildTrack(TRACKS.find((d) => d.id === id)!)
  const o = new Float64Array(t.n)
  const px = (i: number) => t.x[i] + t.nx[i] * o[i], pz = (i: number) => t.z[i] + t.nz[i] * o[i]
  for (let it = 0; it < 6000; it++) for (let i = 0; i < t.n; i++) {
    const a = (i + t.n - 1) % t.n, b = (i + 1) % t.n
    const mx = (px(a) + px(b)) / 2, mz = (pz(a) + pz(b)) / 2
    o[i] = Math.max(-t.wall, Math.min(t.wall, (mx - t.x[i]) * t.nx[i] + (mz - t.z[i]) * t.nz[i]))
  }
  let len = 0
  for (let i = 0; i < t.n; i++) { const b = (i + 1) % t.n; len += Math.hypot(px(b) - px(i), pz(b) - pz(i)) }
  return len
}

describe('kart party floor', () => {
  it('is found in the migration', () => expect(m).not.toBeNull())
  it('uses kartStats() top speed', () => {
    for (const pi of [1, 50, 120, 250, 999]) expect(base + span * (1 - Math.exp(-pi / scale))).toBeCloseTo(kartStats(pi).top, 6)
  })
  it('allows a faster boost than any in the game', () => expect(mult).toBeGreaterThanOrEqual(1.45 * 1.05))
  it('is no longer than three laps of the shortest line on any circuit', () => {
    const best = Math.min(...TRACKS.map((d) => shortestLap(d.id)))
    expect(dist).toBeLessThanOrEqual(LAPS * best)
    expect(floor(1)).toBeGreaterThan(40)
    expect(floor(999)).toBeGreaterThan(25)
  })
})
