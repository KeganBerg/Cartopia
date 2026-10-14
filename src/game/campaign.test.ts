import { describe, expect, it } from 'vitest'
import { CARS, CAMPAIGN, CAMPAIGN_RACES, campaignRivalPi, campaignRivalSkills, campaignShift, carDef, performance, skillBoost, skillDrag, smoothShift, type CarDef, type SkillId } from './data'
import { AI_BOOST_GEAR, TOP_GEAR, aiReaction, fireBoost, freshRacer, launchRacer, revLaunch, shiftBand, shiftQuality, shiftRacer, stepRacer } from './race'
import { conditions, gripMul } from './grip'
import type { VenueId } from '../scene/venues'

// Players kept losing Desert Strip with a perfect launch and perfect shifts: its rivals ran up to
// PI 58 when the best car you can own at level 8 is PI 47. This races every campaign race the way
// the race screen does (DragRace in ui/Race.tsx, AI rival included) to keep that from coming back.

const stock = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const piOf = (c: CarDef) => performance(c, stock)
// The best car the Showroom sells at this level (Rusty's finds, season and secret cars aside).
const bestAt = (level: number) =>
  CARS.filter((c) => !c.rescueOnly && !c.season && !c.secret && c.unlockLevel <= level).sort((a, b) => piOf(b) - piOf(a))[0]

function rng(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// One race on a clear day: we launch perfectly, shift perfectly (mid-band) and fire the boost in
// `boostGear`, with no car skill. The rival drives as the race screen's AI does. True if we win.
function race(me: CarDef, myPi: number, venue: VenueId, rivalPi: number, rival: CarDef, cleanness: number, skill: SkillId | undefined, boostGear: number, roll: () => number) {
  const grip = conditions('clear', venue, me.grip)
  const theirGrip = conditions('clear', venue, rival.grip)
  const shiftAt = Array.from({ length: TOP_GEAR }, (_, g) => {
    const b = shiftBand(g, theirGrip.lo, theirGrip.hi)
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
      const band = shiftBand(a.gear, grip.lo, grip.hi)
      if (a.rpm >= (band.lo + band.hi) / 2) shiftRacer(a, shiftQuality(a.rpm, band.lo, band.hi).q)
    }
    if (a.gear >= boostGear) fireBoost(a)
    stepRacer(a, myPi, dt, t, skillDrag(skill, a, t) * gripMul(grip, a.gear, a.rpm, t))
    if (!b.launched && t >= reaction) launchRacer(b, reaction)
    if (b.launched && b.gear < TOP_GEAR && b.rpm >= shiftAt[b.gear]) {
      const band = shiftBand(b.gear, theirGrip.lo, theirGrip.hi)
      const q = shiftQuality(b.rpm, band.lo, band.hi)
      shiftRacer(b, smoothShift(skill) && q.label === 'Good' ? 1.08 : q.q)
    }
    if (b.gear >= AI_BOOST_GEAR) fireBoost(b)
    stepRacer(b, rivalPi, dt, t, skillBoost(skill, b, a) * gripMul(theirGrip, b.gear, b.rpm, t))
  }
  return a.finished! < b.finished!
}

function winRate(ci: number, i: number, margin: number, boostGear: number) {
  const ch = CAMPAIGN[ci]
  const me = bestAt(ch.unlockLevel)
  const rival = carDef(ch.cars![i])
  const skill = campaignRivalSkills(ci, i) ? rival.skill : undefined
  const roll = rng(7 + ci * 31 + i)
  let wins = 0
  const runs = 60
  for (let k = 0; k < runs; k++) if (race(me, piOf(me) - margin, ch.venue as VenueId, campaignRivalPi(ch, i), rival, campaignShift(ci, i), skill, boostGear, roll)) wins++
  return wins / runs
}

describe('campaign difficulty', () => {
  it('names a real car for every rival', () => {
    for (const ch of CAMPAIGN) {
      expect(ch.cars).toHaveLength(CAMPAIGN_RACES)
      for (const id of ch.cars!) expect(CARS.some((c) => c.id === id)).toBe(true)
    }
  })

  it('every race can be won by the best stock car of the unlock level, driven perfectly', () => {
    CAMPAIGN.forEach((ch, ci) => {
      for (let i = 0; i < CAMPAIGN_RACES; i++) {
        // With a point of PI to spare, boost fired in fourth: nearly always.
        expect(winRate(ci, i, 1, 3), `${ch.name} race ${i + 1}`).toBeGreaterThanOrEqual(0.9)
        // Boost fired early, in second: still most of the time.
        expect(winRate(ci, i, 0, 1), `${ch.name} race ${i + 1}, early boost`).toBeGreaterThanOrEqual(0.75)
      }
    })
  })

  it('never puts a rival far above the cars the player can own yet', () => {
    for (const ch of CAMPAIGN) for (let i = 0; i < CAMPAIGN_RACES; i++) expect(campaignRivalPi(ch, i)).toBeLessThanOrEqual(piOf(bestAt(ch.unlockLevel)) + 8)
  })
})
