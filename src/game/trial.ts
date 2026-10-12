// Weekly time trial: one venue a week, a solo run against a ghost, and a leaderboard that
// resets every Monday 00:00 UTC. Times are kept by the server
// (supabase/migrations/0026_time_trials.sql), which raises any time faster than the player's
// best car allows to raceFloor(), the same floor the live race referee uses.
import { TRACK } from './race'
import { RACE_FUEL } from './data'
import { VENUES, type Venue } from '../scene/venues'

export const TRIAL_FUEL = RACE_FUEL

// Prizes for last week's board, best place first. upTo: the lowest place a tier covers
// (null: everyone who set a time). public.trial_prize_table() holds the same list; trial.test.ts checks.
export type TrialPrize = { upTo: number | null; bucks: number; coins: number; trophies: number }
export const TRIAL_PRIZES: TrialPrize[] = [
  { upTo: 1, bucks: 10, coins: 10000, trophies: 5 },
  { upTo: 2, bucks: 7, coins: 6000, trophies: 4 },
  { upTo: 3, bucks: 5, coins: 4000, trophies: 3 },
  { upTo: 10, bucks: 2, coins: 2000, trophies: 2 },
  { upTo: null, bucks: 0, coins: 500, trophies: 1 },
]
export const trialPrize = (place: number) => TRIAL_PRIZES.find((p) => p.upTo === null || place <= p.upTo)!

// The week a time counts for: its Monday (UTC) as YYYY-MM-DD, like public.this_week().
export function trialWeek(t = Date.now()) {
  const d = new Date(t)
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return new Date(monday).toISOString().slice(0, 10)
}

// Venues take turns, so the same one never runs two weeks in a row.
const FIRST_MONDAY = Date.UTC(1970, 0, 5)
export function trialVenue(week: string): Venue {
  const n = Math.round((Date.parse(`${week}T00:00:00Z`) - FIRST_MONDAY) / (7 * 86400000))
  return VENUES[((n % VENUES.length) + VENUES.length) % VENUES.length]
}

// Where the ghost is after t seconds of a run that finishes in `time`: it pulls away from the line
// like a real car, then holds its pace.
export const GHOST_CURVE = 1.6
export const ghostDist = (t: number, time: number) => TRACK * Math.min(1, Math.max(0, t / time)) ** GHOST_CURVE

// "2d 5h", "5h 12m", "9m"
export function shortLeft(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000))
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}
