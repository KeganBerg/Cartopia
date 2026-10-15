// Fair AI rivals: no AI drag rival is ever quicker than the player's race car can beat with
// perfect driving. Each ladder keeps its own rival PI as long as the car can beat it; past that,
// the rival drops to the most the car can beat. A stronger car still wins easier and by more (stars).
//
// How far above our PI a rival can be and still lose to a perfect drive (perfect launch, perfect
// shifts, boost in fourth, nearly every time) depends on how cleanly it shifts and on its skill:
// a sloppy rival can be well above us, a clean one with Slipstream or Oil Slick has to be well
// below. Measured with raceSim.ts at shift cleanness 0, 0.25, 0.5, 0.75 and 1, less a point to
// spare; fairPi.test.ts races it to keep it true.
import type { SkillId } from './data'

const KNOTS = [0, 0.25, 0.5, 0.75, 1]
const MARGIN: Record<SkillId | 'none', number[]> = {
  none: [19, 19, 17, 8, -2],
  launch: [19, 18, 11, 2, -9],
  nitro: [19, 19, 14, 5, -5],
  slipstream: [19, 13, 7, -2, -15],
  smooth: [15, 11, 7, 2, -2],
  oil: [19, 14, 7, -2, -15],
  torque: [19, 18, 12, 3, -8],
  freeze: [19, 19, 14, 5, -5],
}

// The most a rival can be above (or below, when negative) the car's PI.
export function fairMargin(cleanness: number, skill?: SkillId) {
  const m = MARGIN[skill ?? 'none'] ?? MARGIN.none
  const c = Math.max(0, Math.min(1, cleanness))
  const i = Math.min(KNOTS.length - 2, Math.floor(c / 0.25))
  const k = (c - KNOTS[i]) / 0.25
  return m[i] + (m[i + 1] - m[i]) * k
}

// The rival's PI for this race: the ladder's, unless the car can't beat that.
export const fairRivalPi = (ladder: number, myPi: number, cleanness: number, skill?: SkillId) =>
  Math.max(1, Math.min(ladder, Math.floor(myPi + fairMargin(cleanness, skill))))
