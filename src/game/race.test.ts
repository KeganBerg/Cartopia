import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MAX_RACE_PI, dynoPull, freshRacer, raceFloor, stepRacer } from './race'

const dir = new URL('../../supabase/migrations/', import.meta.url)
// The newest migration that sets public.race_floor().
const migration = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')).filter((sql) => sql.includes('$floors$')).pop()!

describe('live race referee', () => {
  it('has the fastest finish times the race screen allows', () => {
    // When this fails, regenerate the list between the $floors$ markers in a new migration.
    const floors = JSON.parse(/\$floors\$(.*)\$floors\$/s.exec(migration)![1])
    expect(floors).toEqual(Array.from({ length: MAX_RACE_PI }, (_, i) => raceFloor(i + 1)))
  })

  it('never calls a perfect honest race too fast', () => {
    for (const pi of [15, 40, 80, 120]) {
      for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
        const r = freshRacer()
        let t = 0
        while (r.finished === null) {
          t += dt
          if (r.gear < 3 && r.rpm >= 0.8) {
            r.quality = 1.08
            r.gear++
            r.rpm = 0.35
          }
          stepRacer(r, pi, dt, t, r.gear === 0 ? 1.2 : 1)
        }
        expect(r.finished!).toBeGreaterThan(raceFloor(pi))
      }
    }
  })
})

describe('garage dyno', () => {
  it('gets quicker with every point of PI and never beats the referee', () => {
    let last = Infinity
    for (let pi = 10; pi <= 200; pi += 5) {
      const t = dynoPull(pi)
      expect(t).toBeLessThan(last)
      expect(t).toBeGreaterThan(raceFloor(pi))
      last = t
    }
  })
})
