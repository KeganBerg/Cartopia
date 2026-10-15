// Pro Tour: an endless ladder of races that opens once Back Streets (campaign
// chapter 1) is cleared, with no level gate, so players who are waiting on a
// level for the next chapter always have a next race. Races come in legs of
// five, the fifth a boss; each leg runs at a different venue, and two legs in
// every five run at midnight under the floodlights. Rivals climb steadily and
// keep climbing forever, so the ladder is a test of how far a garage can go.
//
// The save keeps one number, `tour`: tour races won so far (the next race is
// race `tour`). Prizes are ordinary race coins and the leg bonus is coins
// only, so the server's worth bank covers them like any other race.

import { MAX_RACE_PI } from './race'

export const TOUR_RACES = 5 // per leg; the last is the boss
// Venue order, so each leg in a row looks different (ids from scene/venues.ts).
export const TOUR_VENUES = ['main', 'docks', 'desert', 'snow', 'beach', 'farm'] as const
export type TourVenue = (typeof TOUR_VENUES)[number]

const SUFFIX = ['Sprint', 'Shootout', 'Showdown', 'Classic', 'Dash', 'Open', 'Rumble']
const FIRST = ['Ace', 'Blaze', 'Cruz', 'Dex', 'Echo', 'Flint', 'Gigi', 'Hawk', 'Indy', 'Jett', 'Kit', 'Lux', 'Mack', 'Nova', 'Ozzy', 'Pike', 'Quinn', 'Rex', 'Sky', 'Tex', 'Uma', 'Vex', 'Wren', 'Zed']
const HANDLE = ['Overdrive', 'Redline', 'Burnout', 'Clutch', 'Nitrous', 'Apex', 'Gearbox', 'Sideways', 'Torque', 'Hotrod', 'Throttle', 'Chicane', 'Slipstream', 'Lugnut', 'Piston']
const BOSS = ['The Phantom', 'Night Hawk', 'Iron Duchess', 'The Comet', 'Big Engine Betty', 'Count Turbo', 'The Undertaker', 'Lady Lightning', 'The Kingpin', 'Midnight Mara', 'Chrome Baron', 'The Wraith']

export type TourLeg = { index: number; name: string; venue: TourVenue; night: boolean; boss: string }

// Two legs in every five run at night, so every venue gets its turn under the lights.
export const tourNight = (leg: number) => leg % 5 === 2 || leg % 5 === 4
export function tourLeg(leg: number): TourLeg {
  const venue = TOUR_VENUES[leg % TOUR_VENUES.length]
  const night = tourNight(leg)
  return { index: leg, venue, night, name: night ? 'Midnight' : SUFFIX[leg % SUFFIX.length], boss: BOSS[leg % BOSS.length] }
}
export const tourLegOf = (race: number) => Math.floor(race / TOUR_RACES)
export const tourIsBoss = (race: number) => race % TOUR_RACES === TOUR_RACES - 1

// Rival PI: quick through the first eight legs (campaign-level cars), then a
// slower climb that never stops, up to the most the race referee allows.
export const tourRivalPi = (race: number) =>
  Math.min(MAX_RACE_PI, Math.round(34 + 1.6 * Math.min(race, 40) + 0.6 * Math.max(0, race - 40) + (tourIsBoss(race) ? 3 : 0)))
// How cleanly a rival shifts (0 sloppy, 1 perfect); every rival is clean by leg 12.
export const tourShift = (race: number) => Math.min(1, 0.35 + race / 90)
// Rivals use their car's skill from the third leg on; bosses always do.
export const tourSkills = (race: number) => tourLegOf(race) >= 2 || tourIsBoss(race)
export function tourRivalName(race: number) {
  if (tourIsBoss(race)) return tourLeg(tourLegOf(race)).boss
  const h = (race * 2654435761) >>> 0
  return `${FIRST[h % FIRST.length]} ${HANDLE[(h >>> 8) % HANDLE.length]}`
}
// The prize for winning a race (losses pay a tenth, like every race).
// pi: the PI actually raced, when the rival was eased to the player's car (game/fairPi.ts), so a
// slower car earns what its own races are worth.
export const tourPrize = (race: number, pi = tourRivalPi(race)) => Math.round((150 + Math.min(pi, tourRivalPi(race)) * 8) / 10) * 10
// The one-time bonus for beating a leg's boss. Coins only.
export const tourLegBonus = (leg: number) => 500 + leg * 300
