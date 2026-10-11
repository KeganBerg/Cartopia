// Weekly events: a limited-time race series that changes every Monday 00:00 UTC.
// Each week one event from a rotation of six runs: its own venue, its own sky
// (forced weather, sometimes at night) and five races, the fifth a boss. Clearing
// all five wins that event's exclusive skin, which can't be bought or found in
// crates; it only comes back when the event does, six weeks later.
//
// Rivals are set from the player's best car when they enter the event (saved as
// `pi`), so the series is a test of driving at every level, and upgrading during
// the week makes the later races easier. Prizes are ordinary race coins plus a
// coin bonus for the boss, and skins aren't checked by the server, so the event
// needs no guard or catalog SQL.
//
// The save keeps `event: { week, pi, won }`: the week (its Monday) the progress
// belongs to, the rival base PI and the races won. A new week starts fresh.

import { MAX_RACE_PI } from './race'
import { msToNextWeek } from './data'
import type { WeatherKind } from './weather'
import { trialWeek } from './trial'

export const EVENT_RACES = 5 // the last is the boss

export type EventDef = {
  id: string
  name: string
  venue: 'main' | 'beach' | 'desert' | 'snow' | 'farm' | 'docks'
  night: boolean
  sky: WeatherKind
  // One line under the title on the event screen.
  blurb: string
  // The exclusive body skin (SKINS id in data.ts) clearing the event wins.
  skin: string
  // Accent colour for the tile tag and chips.
  color: string
  rivals: string[] // four racers, then the boss
}

// Rotation order. Each sits three venues away from that week's time trial (trial.ts
// steps through VENUES the same way), so the two weekly modes never share a track.
export const WEEKLY_EVENTS: EventDef[] = [
  {
    id: 'whiteout', name: 'Whiteout Sprint', venue: 'snow', night: false, sky: 'blizzard', color: '#8fd3ff',
    blurb: 'Full blizzard over Frostbite Pass. Grip is a rumour.', skin: 'hoarfrost',
    rivals: ['Sasha Snowplough', 'Bjorn Icepick', 'Tundra Tess', 'Polar Pete', 'The Yeti'],
  },
  {
    id: 'harvestmoon', name: 'Harvest Moon Run', venue: 'farm', night: true, sky: 'clear', color: '#ffb347',
    blurb: 'Midnight on the backroad under a giant orange moon.', skin: 'harvestmoon',
    rivals: ['Hank Hayride', 'Dottie Dustbowl', 'Cornfield Cal', 'Silo Sue', 'The Scarecrow'],
  },
  {
    id: 'foghorn', name: 'Foghorn Classic', venue: 'docks', night: true, sky: 'fog', color: '#ffd84a',
    blurb: 'Night fog rolls off the water. Race the lighthouse beam.', skin: 'beacon',
    rivals: ['Rusty Bollard', 'Marina Knots', 'Skipper Sloane', 'Gale Hooper', 'Captain Fogbank'],
  },
  {
    id: 'neondownpour', name: 'Neon Downpour', venue: 'main', night: true, sky: 'storm', color: '#ff4fd8',
    blurb: 'Main Street at midnight in a thunderstorm. Neon on wet asphalt.', skin: 'rainglass',
    rivals: ['Vinnie Volt', 'Puddles McGee', 'Neon Nadia', 'Strobe Ramirez', 'Madame Monsoon'],
  },
  {
    id: 'shallows', name: 'Sunset Shallows Cup', venue: 'beach', night: false, sky: 'clear', color: '#4fe3d0',
    blurb: 'Golden hour on the boardwalk, salt spray in the air.', skin: 'shallows',
    rivals: ['Coral Kahale', 'Sandy Dunbar', 'Breaker Boone', 'Lulu Lagoon', 'The Riptide Kid'],
  },
  {
    id: 'mirage', name: 'Mirage Mile', venue: 'desert', night: false, sky: 'dust', color: '#ff7a3d',
    blurb: 'A dust storm rips through Red Rock Canyon. Trust the heat haze.', skin: 'mirage',
    rivals: ['Dusty Ridgeway', 'Cactus Kate', 'Sidewinder Sal', 'Mesa Max', 'The Sun King'],
  },
]

const FIRST_MONDAY = Date.UTC(1970, 0, 5)
// Weeks since the first Monday, for the rotation.
export const weekIndex = (week: string) => Math.round((Date.parse(`${week}T00:00:00Z`) - FIRST_MONDAY) / (7 * 86400000))
// This week's event (or the event for any week, by its Monday).
export const eventFor = (week = trialWeek()) => WEEKLY_EVENTS[((weekIndex(week) % WEEKLY_EVENTS.length) + WEEKLY_EVENTS.length) % WEEKLY_EVENTS.length]
// The week after this one, for "next up" previews.
export const nextEventWeek = (t = Date.now()) => trialWeek(t + msToNextWeek(t) + 1000)
// When an event's skin is next on offer: weeks from this one (0: this week).
export const weeksUntil = (id: string, week = trialWeek()) => {
  const i = WEEKLY_EVENTS.findIndex((e) => e.id === id)
  const now = ((weekIndex(week) % WEEKLY_EVENTS.length) + WEEKLY_EVENTS.length) % WEEKLY_EVENTS.length
  return (i - now + WEEKLY_EVENTS.length) % WEEKLY_EVENTS.length
}

export type EventProgress = { week: string; pi: number; won: number }
// The player's progress this week (a stale week counts as not started).
export const eventProgress = (p: EventProgress | null | undefined, week = trialWeek()) => (p && p.week === week ? p : null)

// Rivals sit around the PI the player entered with: two easier warm-ups, then a
// climb to a boss a few points better, so the boss needs good shifting or an upgrade.
const OFFSET = [-8, -4, 0, 3, 6]
export const eventRivalPi = (base: number, race: number) => Math.max(20, Math.min(MAX_RACE_PI, Math.round(base + OFFSET[race])))
// How cleanly rivals shift (0 sloppy, 1 perfect): event racers are sharp.
export const eventShift = (race: number) => 0.6 + race * 0.1
export const eventIsBoss = (race: number) => race === EVENT_RACES - 1
// Race coins for a win (a loss pays a tenth, like every race).
export const eventPrize = (base: number, race: number) => Math.round((200 + eventRivalPi(base, race) * 9) / 10) * 10
// The boss bonus, on top of the skin. Paid again (doubled) when the skin is already owned.
export const eventBonus = (base: number) => Math.round((1000 + base * 30) / 100) * 100
