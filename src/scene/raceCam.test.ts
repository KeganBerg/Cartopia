import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { ANGLES, ANGLE_TIME, LINE_CLEAR, TOP_HOLD, angleCam, damp, direct, freshDirector, type Angle } from './raceCam'
const ROAD = 1.6 // the street's half width (RaceVenues.tsx)

// Runs the director over a race: `topAt` seconds in the car reaches top gear, the line `finish` seconds in.
function run(topAt: number, finish: number, allowed = true) {
  const d = freshDirector()
  const shots: { t: number; angle: Angle | null; eta: number }[] = []
  const dt = 1 / 60
  for (let t = 0; t < finish; t += dt) {
    const eta = finish - t
    direct(d, dt, t >= topAt, eta, allowed)
    shots.push({ t, angle: d.angle, eta })
  }
  return shots
}

describe('race camera', () => {
  it('cuts round every angle in order once in top gear, then back to the chase before the line', () => {
    const shots = run(5, 25)
    const seq = shots.map((s) => s.angle).filter((a, i, all) => a !== all[i - 1])
    expect(seq.slice(0, 5)).toEqual([null, 'low', 'side', 'front', null])
    expect(shots.find((s) => s.angle)!.t).toBeGreaterThanOrEqual(5 + TOP_HOLD - 0.02)
    // Nothing but the chase as the car comes to the line.
    expect(shots.filter((s) => s.eta < LINE_CLEAR).every((s) => !s.angle)).toBe(true)
  })

  it('plays each angle in full and never starts one it cannot finish', () => {
    for (const [top, fin] of [[5, 25], [6, 9.5], [7.5, 9.5], [2, 12]]) {
      const shots = run(top, fin)
      let len = 0
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i]
        if (s.angle && s.angle === shots[i - 1]?.angle) len++
        else if (shots[i - 1]?.angle) {
          expect((len + 1) / 60).toBeGreaterThanOrEqual(ANGLE_TIME - 0.02)
          len = 0
        }
      }
    }
  })

  it('stays on the chase out of top gear, under reduced motion or a replay', () => {
    expect(run(99, 25).every((s) => !s.angle)).toBe(true)
    expect(run(2, 25, false).every((s) => !s.angle)).toBe(true)
  })

  it('keeps every angle on the tarmac, clear of the barriers, and looking down the strip', () => {
    const pos = new Vector3()
    const at = new Vector3()
    for (const a of ANGLES) for (const tall of [false, true]) for (const t of [0, ANGLE_TIME]) {
      angleCam(a, t, 0.75, 100, 0.9, ROAD, tall, pos, at)
      expect(Math.abs(pos.x)).toBeLessThan(ROAD)
      expect(pos.y).toBeGreaterThan(0.2)
      expect(pos.distanceTo(at)).toBeGreaterThan(1)
    }
  })

  it('smooths the same at any frame rate', () => {
    const at = (fps: number) => {
      let x = 0
      for (let i = 0; i < fps; i++) x += (1 - x) * damp(5, 1 / fps)
      return x
    }
    expect(at(30)).toBeCloseTo(at(144), 6)
  })
})
