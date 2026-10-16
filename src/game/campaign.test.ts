import { describe, expect, it } from 'vitest'
import { CARS, CAMPAIGN, CAMPAIGN_RACES, campaignOpen, campaignRaceId, campaignReward, campaignStarsNeed, campaignRivalPi, campaignRivalSkills, campaignShift, carDef, performance, type CarDef } from './data'
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
  const me = bestAt(ch.tuned)
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
    for (const ch of CAMPAIGN) for (let i = 0; i < CAMPAIGN_RACES; i++) expect(campaignRivalPi(ch, i)).toBeLessThanOrEqual(piOf(bestAt(ch.tuned)) + 8)
  })
})

describe('campaign gates', () => {
  const won = (ci: number, stars: number) => Object.fromEntries(Array.from({ length: CAMPAIGN_RACES }, (_, i) => [campaignRaceId(CAMPAIGN[ci], i), stars]))
  it('opens chapters on the boss before and stars, never on level', () => {
    expect(campaignOpen({}, 0, 1)).toBe(true)
    // A high level alone opens nothing.
    expect(campaignOpen({}, 1, 99)).toBe(false)
    // Boss beaten but only one star a race: 5 of the 10 needed.
    expect(campaignOpen(won(0, 1), 1, 1)).toBe(false)
    // Two stars a race at level 1: open.
    expect(campaignOpen(won(0, 2), 1, 1)).toBe(true)
    // Stars from earlier chapters count, but the chapter before still needs its boss.
    expect(campaignOpen({ ...won(0, 3), ...won(1, 3) }, 3, 1)).toBe(false)
  })
  it('asks for more stars each chapter, always reachable with two a race', () => {
    for (let ci = 1; ci < CAMPAIGN.length; ci++) {
      expect(campaignStarsNeed(ci)).toBeGreaterThan(campaignStarsNeed(ci - 1))
      expect(campaignStarsNeed(ci)).toBeLessThanOrEqual(ci * CAMPAIGN_RACES * 2)
    }
  })
  it('lets the admin past every gate', () => {
    for (let ci = 0; ci < CAMPAIGN.length; ci++) expect(campaignOpen({}, ci, Infinity)).toBe(true)
  })
  it('pays a first win on the PI raced when the rival was eased', () => {
    const ch = CAMPAIGN[6]
    const full = campaignReward(ch, 0, true)
    expect(campaignReward(ch, 0, true, campaignRivalPi(ch, 0))).toBe(full)
    expect(campaignReward(ch, 0, true, campaignRivalPi(ch, 0) / 2)).toBeLessThan(full * 0.6)
    expect(campaignReward(ch, 0, true, 1)).toBeGreaterThan(0)
  })
})
