import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JUMP_START_DELAY, MAX_RACE_PI, dynoPull, fireBoost, freshRacer, launchRacer, raceFloor, shiftRacer, stepRacer } from './race'

const dir = new URL('../../supabase/migrations/', import.meta.url)
// The newest migration that sets public.race_floor().
const migration = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')).filter((sql) => sql.includes('$floors$')).pop()!

describe('live race referee', () => {
  it('has the fastest finish times the race screen allows', () => {
    // When this fails, regenerate the list between the $floors$ markers in a new migration.
    const floors = JSON.parse(/\$floors\$(.*)\$floors\$/s.exec(migration)![1])
    expect(floors).toEqual(Array.from({ length: MAX_RACE_PI }, (_, i) => raceFloor(i + 1)))
  }, 60000)

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

  it('never calls a perfect boosted race too fast, whenever the boost fires', () => {
    for (const pi of [15, 40, 80, 120, 200]) {
      for (const fireAt of [0.3, 0.8, 1.5, 2.5]) {
        const r = freshRacer(false)
        const dt = 1 / 144
        let t = 0
        while (r.finished === null) {
          t += dt
          if (!r.launched) launchRacer(r, 0)
          if (r.gear < 3 && r.rpm >= 0.92) shiftRacer(r, 1.08)
          if (t >= fireAt) fireBoost(r)
          stepRacer(r, pi, dt, t, r.gear === 0 ? 1.2 : 1)
        }
        expect(r.finished!).toBeGreaterThan(raceFloor(pi))
      }
    }
  })
})

describe('launch and boost', () => {
  const run = (launchAt: number, fire: (r: ReturnType<typeof freshRacer>, t: number) => boolean, shiftAt = 0.9) => {
    const r = freshRacer(false)
    const dt = 1 / 120
    let t = 0
    while (r.finished === null && t < 60) {
      t += dt
      if (!r.launched && t >= (launchAt < 0 ? JUMP_START_DELAY : launchAt)) launchRacer(r, launchAt)
      if (r.launched && r.gear < 3 && r.rpm >= shiftAt) shiftRacer(r, shiftAt >= 0.78 && shiftAt <= 0.93 ? 1.08 : 0.75)
      if (fire(r, t)) fireBoost(r)
      stepRacer(r, 60, dt, t)
    }
    return r.finished!
  }
  const never = () => false
  const midRace = (r: { gear: number }) => r.gear >= 2

  it('rewards a quick launch and punishes a jump start', () => {
    expect(run(0.2, never)).toBeLessThan(run(0.6, never))
    expect(run(-1, never)).toBeGreaterThan(run(0.2, never))
  })

  it('fills the tank from a clean launch and clean shifts, and fires once', () => {
    const r = freshRacer(false)
    launchRacer(r, 0.1)
    for (let i = 0; i < 3; i++) shiftRacer(r, 1.08)
    expect(r.boost).toBeCloseTo(1)
    expect(r.streak).toBe(3)
    expect(fireBoost(r)).toBe(true)
    expect(fireBoost(r)).toBe(false)
    const sloppy = freshRacer(false)
    launchRacer(sloppy, 0.8)
    for (let i = 0; i < 3; i++) shiftRacer(sloppy, 0.75)
    expect(sloppy.boost).toBe(0)
    expect(fireBoost(sloppy)).toBe(false)
  })

  it('is worth firing mid-race, and wasted off the line', () => {
    expect(run(0.2, midRace)).toBeLessThan(run(0.2, never))
    expect(run(0.2, (r) => r.launched)).toBeGreaterThan(run(0.2, midRace))
  })

  it('lets clean driving beat a quicker car driven sloppily', () => {
    const clean = run(0.15, midRace)
    const r = freshRacer(false)
    const dt = 1 / 120
    let t = 0
    while (r.finished === null) {
      t += dt
      if (!r.launched && t >= 0.6) launchRacer(r, 0.6)
      if (r.launched && r.gear < 3 && r.rpm >= 0.7) shiftRacer(r, 0.95)
      stepRacer(r, 68, dt, t)
    }
    expect(clean).toBeLessThan(r.finished!)
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
