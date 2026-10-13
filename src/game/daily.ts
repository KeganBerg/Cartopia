// The Daily Run: one quarter-mile run a day that's the same for everyone: the same venue,
// weather and stock loaner car (no upgrades or parts), picked from the UTC date. You race a
// par ghost for a medal, run it as often as you like, and share your best as a short text.
// There is no streak: a missed day is simply a missed day. The first run each day pays like
// a race (through finishRace, so the server guard's coin bank covers it); later runs just
// chase a better time.
import { CARS, performance, type CarDef } from './data'
import { raceFloor } from './race'
import { VENUES, type Venue } from '../scene/venues'

export const DAILY_PAY = [1200, 900, 600, 300] // gold, silver, bronze, no medal
// Medal times as a share over the fastest possible run in the day's car (race.ts raceFloor).
export const DAILY_MEDALS = [{ icon: '🥇', over: 1.12 }, { icon: '🥈', over: 1.2 }, { icon: '🥉', over: 1.3 }]

const ZERO = { engine: 0, turbo: 0, tires: 0, weight: 0 }

// The day a run counts for, as YYYY-MM-DD (UTC).
export const dailyDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10)
// Day number since the first Daily Run, for the share text.
const FIRST = Date.UTC(2026, 9, 12)
export const dailyNumber = (day: string) => Math.round((Date.parse(`${day}T00:00:00Z`) - FIRST) / 86400000) + 1

// A small seeded random from the day (mulberry32), so every player gets the same picks.
function seeded(day: string) {
  let a = 0
  for (const ch of day) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Cars the Daily Run lends: any coin car that can be owned (no gem cars, nothing parked).
export const DAILY_CARS: CarDef[] = CARS.filter((c) => !c.parked && !c.bucks && !c.rescueOnly)

export type DailyRun = { day: string; venue: Venue; car: CarDef; color: string; pi: number; medals: number[]; par: number }
export function dailyRun(day = dailyDay()): DailyRun {
  const r = seeded(day)
  const venue = VENUES[Math.floor(r() * VENUES.length)]
  const car = DAILY_CARS[Math.floor(r() * DAILY_CARS.length)]
  const color = car.colors[Math.floor(r() * car.colors.length)]
  const pi = performance(car, ZERO)
  const floor = raceFloor(pi)
  const medals = DAILY_MEDALS.map((m) => Math.round(floor * m.over * 100) / 100)
  return { day, venue, car, color, pi, medals, par: medals[medals.length - 1] }
}

// 0 gold, 1 silver, 2 bronze, 3 no medal.
export const dailyMedal = (run: DailyRun, time: number) => {
  const i = run.medals.findIndex((m) => time <= m)
  return i < 0 ? DAILY_MEDALS.length : i
}

// What the save keeps: today's day, best time and whether the day's pay is taken.
export type DailySave = { day: string; best: number | null; paid: boolean }

// The share text: the day, the conditions and the best time with its medal.
export function dailyShare(run: DailyRun, best: number) {
  const m = DAILY_MEDALS[dailyMedal(run, best)]?.icon ?? '🏁'
  return `🏁 Cartopia Daily #${dailyNumber(run.day)}\n${run.venue.icon} ${run.venue.name} · ${run.car.name}\n⏱️ ${best.toFixed(3)}s ${m}`
}
