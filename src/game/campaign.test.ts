import { describe, expect, it } from 'vitest'
import { CARS, CAMPAIGN, CAMPAIGN_RACES, campaignRivalPi, campaignRivalSkills, campaignShift, carDef, performance, type CarDef } from './data'
import { perfectDuel, rng } from './raceSim'
import type { VenueId } from '../scene/venues'

// Players kept losing Desert Strip with a perfect launch and perfect shifts: its rivals ran up to
// PI 58 when the best car you can own at level 8 is PI 47. This races every campaign race the way
// the race screen does (DragRace in ui/Race.tsx, AI rival included) to keep that from coming back.

const stock = { engine: 0, turbo: 0, tires: 0, weight: 0 }
const piOf = (c: CarDef) => performance(c, stock)
// The best car the Showroom sells at this level (Rusty's finds, season and secret cars aside).
const bestAt = (level: number) =>
  CARS.filter((c) => !c.rescueOnly && !c.season && !c.secret && c.unlockLevel <= level).sort((a, b) => piOf(b) - piOf(a))[0]

function winRate(ci: number, i: number, margin: number, boostGear: number) {
  const ch = CAMPAIGN[ci]
  const me = bestAt(ch.unlockLevel)
  const rival = carDef(ch.cars![i])
  const skill = campaignRivalSkills(ci, i) ? rival.skill : undefined
  const roll = rng(7 + ci * 31 + i)
  let wins = 0
  const runs = 60
  for (let k = 0; k < runs; k++) if (perfectDuel(me, piOf(me) - margin, ch.venue as VenueId, campaignRivalPi(ch, i), rival, campaignShift(ci, i), skill, boostGear, roll)) wins++
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
