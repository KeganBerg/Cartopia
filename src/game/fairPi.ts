// Fair AI rivals: no AI drag rival is ever quicker than the player's race car can beat with
// perfect driving. Each ladder keeps its own rival PI as long as the car can beat it; past that,
// the rival drops to the most the car can beat. A stronger car still wins easier and by more (stars).
//
// How far above our PI a rival can be and still lose to a perfect drive (perfect launch, perfect
// shifts, boost in fourth, nearly every time) depends on how cleanly it shifts and on its skill:
// a sloppy rival can be well above us, a clean one with Slipstream or Oil Slick has to be well
// below. Measured with raceSim.ts (the worst of PI 25 to 140, less a point to spare); fairPi.test.ts races it to keep it true.
import type { SkillId } from './data'
import { characterMul } from './distance'
import { TOP_GEAR, fireBoost, freshRacer, shiftRacer, stepRacer } from './race'

// Margins at shift cleanness 0, 1/8, 2/8 ... 1. Between two steps the smaller one counts.
const STEPS = 8
const MARGIN: Record<SkillId | 'none', number[]> = {
  none: [19, 19, 19, 19, 15, 12, 5, 0, -2],
  launch: [19, 19, 17, 14, 10, 7, 0, -5, -8],
  nitro: [19, 19, 18, 16, 12, 9, 3, -3, -5],
  slipstream: [19, 15, 12, 9, 5, 3, -4, -10, -15],
  smooth: [14, 12, 11, 9, 7, 5, 2, 0, -2],
  oil: [18, 14, 11, 9, 5, 2, -5, -12, -17],
  torque: [19, 19, 17, 14, 10, 7, 0, -5, -8],
  freeze: [19, 19, 17, 15, 11, 8, 1, -3, -5],
}

// The most a rival can be above (or below, when negative) the car's PI.
export function fairMargin(cleanness: number, skill?: SkillId) {
  const m = MARGIN[skill ?? 'none'] ?? MARGIN.none
  const x = Math.max(0, Math.min(1, cleanness)) * STEPS
  return Math.min(m[Math.floor(x)], m[Math.ceil(x)])
}

// The rival's PI for this race: the ladder's, unless the car can't beat that.
export const fairRivalPi = (ladder: number, myPi: number, cleanness: number, skill?: SkillId) =>
  Math.max(1, Math.min(ladder, Math.floor(myPi + fairMargin(cleanness, skill))))

// Over a set distance a car's build costs it some pull (distance.ts): a sprinter fades in a mile,
// a long-hauler is slow off the line. AI rivals have no build, so the fair cap uses the PI of a
// buildless car that runs the same perfect time as ours over this distance.
const perfectTime = (piVal: number, track: number, c: number | null) => {
  const r = freshRacer()
  const dt = 1 / 120
  let t = 0
  while (r.finished === null && t < 120) {
    t += dt
    if (r.gear < TOP_GEAR && r.rpm >= 0.9) shiftRacer(r, 1.08)
    if (r.gear >= 3) fireBoost(r)
    stepRacer(r, piVal, dt, t, c === null ? 1 : characterMul(c, r.gear, r.dist), track)
  }
  return r.finished ?? t
}
const built = new Map<string, number>()
export function buildPi(myPi: number, c: number, track: number) {
  const key = `${myPi}:${c.toFixed(2)}:${track}`
  const known = built.get(key)
  if (known !== undefined) return known
  const target = perfectTime(myPi, track, c)
  let lo = 1
  let hi = myPi
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (perfectTime(mid, track, null) >= target) lo = mid
    else hi = mid - 1
  }
  built.set(key, lo)
  return lo
}
