import { describe, expect, it } from 'vitest'
import { KART_R, KartRace, TRACKS, buildTrack, gpField, idleInput, lateral, type Track } from './kart'

// Every kart stays between the barriers for a whole Grand Prix race at every venue, both
// ways round: the AI field, and a player who only holds the gas (no steering at all).
// Each kart's track position (idx) must also stay on its own stretch of road, never snap
// to a nearby one where the loop passes close to itself.

const DT = 1 / 120 // the screen steps the race at this fixed rate

function nearest(t: Track, x: number, z: number) {
  let best = 0, bd = Infinity
  for (let i = 0; i < t.n; i++) {
    const d = (t.x[i] - x) ** 2 + (t.z[i] - z) ** 2
    if (d < bd) { bd = d; best = i }
  }
  return best
}

describe('karts stay on the track', () => {
  for (const def of TRACKS) for (const reverse of [false, true]) {
    it(`${def.name}${reverse ? ' reversed' : ''}: every kart stays inside the barriers for a full race`, () => {
      const t = buildTrack(def, reverse)
      const r = new KartRace(t, gpField(['A', 'B', 'C', 'D', 'E'], 2, 60, { name: 'Me', pi: 60 }), 7)
      const me = r.karts.findIndex((k) => !k.ai)
      const gasOnly = { ...idleInput(), gas: 1 }
      let worst = 0, lost = 0
      while (r.karts.some((k) => !k.ai && k.done === null) && r.t < 240) {
        r.step(DT, r.karts.map((_, i) => (i === me ? gasOnly : idleInput())), true)
        for (const k of r.karts) {
          const g = nearest(t, k.x, k.z)
          worst = Math.max(worst, Math.abs(lateral(t, g, k.x, k.z)))
          if (Math.min(Math.abs(g - k.idx), t.n - Math.abs(g - k.idx)) > 6) lost++
        }
      }
      // A shove from another kart can nudge one a little past the wall for a single step.
      expect(worst).toBeLessThanOrEqual(t.wall + KART_R * 0.5)
      expect(lost).toBe(0)
      // Every AI kart finishes the race.
      expect(r.karts.filter((k) => k.ai).every((k) => k.done !== null)).toBe(true)
    }, 60000)
  }
})
