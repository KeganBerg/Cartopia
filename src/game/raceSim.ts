// A headless drag race against an AI rival, run the way the race screen runs one (DragRace in
// ui/Race.tsx, its AI rival included), with us driving perfectly. Tests use it to check that AI
// rivals stay beatable (see fairPi.ts and campaign.test.ts).
import { skillBoost, skillDrag, smoothShift, type CarDef, type SkillId } from './data'
import { characterMul } from './distance'
import { AI_BAND, AI_BOOST_GEAR, TRACK, TOP_GEAR, aiReaction, fireBoost, freshRacer, launchRacer, revLaunch, shiftBand, shiftQuality, shiftRacer, stepRacer } from './race'
import { conditions, gripMul } from './grip'
import type { VenueId } from '../scene/venues'

// A repeatable 0-1 roll.
export function rng(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// One race on a clear day: we launch perfectly, shift perfectly (mid-band) and fire the boost in
// `boostGear`, with no car skill. The rival drives as the race screen's AI does. True if we win.
export function perfectDuel(me: CarDef, myPi: number, venue: VenueId, rivalPi: number, rival: CarDef, cleanness: number, skill: SkillId | undefined, boostGear: number, roll: () => number, build: number | null = null, track = TRACK) {
  const grip = conditions('clear', venue, me.grip)
  const theirGrip = conditions('clear', venue, rival.grip)
  const shiftAt = Array.from({ length: TOP_GEAR }, (_, g) => {
    const b = shiftBand(g, theirGrip.lo, theirGrip.hi, AI_BAND)
    return b.lo + (b.hi - b.lo) * (0.25 + 0.6 * roll()) - (1 - cleanness) * (0.06 + 0.1 * roll())
  })
  const reaction = aiReaction(cleanness, roll())
  const a = freshRacer(false)
  const b = freshRacer(false)
  revLaunch(a, 0.65)
  const dt = 1 / 240
  let t = 0
  while ((a.finished === null || b.finished === null) && t < 60) {
    t += dt
    if (a.gear < TOP_GEAR) {
      // Mid-way up the strict band, the same shift point however wide the player's band is.
      const mid = shiftBand(a.gear, grip.lo, grip.hi, AI_BAND)
      const band = shiftBand(a.gear, grip.lo, grip.hi)
      if (a.rpm >= (mid.lo + mid.hi) / 2) shiftRacer(a, shiftQuality(a.rpm, band.lo, band.hi).q)
    }
    if (a.gear >= boostGear) fireBoost(a)
    stepRacer(a, myPi, dt, t, skillDrag(skill, a, t) * gripMul(grip, a.gear, a.rpm, t) * (build === null ? 1 : characterMul(build, a.gear, a.dist)), track)
    if (!b.launched && t >= reaction) launchRacer(b, reaction)
    if (b.launched && b.gear < TOP_GEAR && b.rpm >= shiftAt[b.gear]) {
      const band = shiftBand(b.gear, theirGrip.lo, theirGrip.hi, AI_BAND)
      const q = shiftQuality(b.rpm, band.lo, band.hi, false)
      shiftRacer(b, smoothShift(skill) && q.label === 'Good' ? 1.08 : q.q)
    }
    if (b.gear >= AI_BOOST_GEAR) fireBoost(b)
    stepRacer(b, rivalPi, dt, t, skillBoost(skill, b, a) * gripMul(theirGrip, b.gear, b.rpm, t), track)
  }
  return a.finished! < b.finished!
}
