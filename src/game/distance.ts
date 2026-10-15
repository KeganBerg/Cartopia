// Race distances: the Grand Prix and the Pro Tour run over a quarter mile, a half
// mile or a full mile, the easy races short and the hard ones long. A car's build
// (power against grip and lightness) decides which distance suits it, so picking
// the car (and how it's upgraded) for the race is part of winning:
//   Sprinters (grippy, light) hook up off the line but run out of breath at speed.
//   Long-haulers (big power, little grip) bog down off the line but pull for ever.
//   All-rounders sit in between, never the best and never the worst.
// Over a half mile the builds come out about even.
// The build only ever slows a car (characterMul <= 1) and AI rivals race without
// one, so the server's time floors and Grand Prix checks (raceFloor(), gpBeatTable(),
// both worked out over a quarter mile) stay safe: a longer race only ever needs
// the same PI or more to win (distance.test.ts checks).

import { TRACK } from './race'

export type RaceDist = 'quarter' | 'half' | 'mile'
export const RACE_DISTS: RaceDist[] = ['quarter', 'half', 'mile']
export const DIST: Record<RaceDist, { m: number; label: string; icon: string }> = {
  quarter: { m: TRACK, label: '¼ mile', icon: '¼' },
  half: { m: TRACK * 2, label: '½ mile', icon: '½' },
  mile: { m: TRACK * 4, label: '1 mile', icon: '1' },
}

// Grand Prix rounds 1-2 are quarter miles, 3-4 half miles, 5-6 a full mile.
export const gpDist = (round: number): RaceDist => (round < 2 ? 'quarter' : round < 4 ? 'half' : 'mile')
// Each Pro Tour leg: two quarter miles, two half miles, then the boss over a mile.
export const tourDist = (race: number): RaceDist => (['quarter', 'quarter', 'half', 'half', 'mile'] as const)[race % 5]

// -1 (pure sprinter) to 1 (pure long-hauler): power against grip and lightness (most cars carry
// a little more power than that, hence the 10). Races take it from the car's stock stats, so
// Garage upgrades and mods only ever add PI: a weight or tire step used to tip a car toward
// sprinter and lose more in the mile than its PI gained (statOrder.test.ts checks).
export const character = (s: { power: number; grip: number; weight: number }) =>
  Math.max(-1, Math.min(1, (s.power - (s.grip + 100 - s.weight) / 2 - 10) / 30))
// The build a car races with: its stock one, whatever is fitted.
export const raceCharacter = (def: { power: number; grip: number; weight: number }) => character(def)
export type Build = 'sprinter' | 'allrounder' | 'longhaul'
export const buildOf = (c: number): Build => (c < -0.25 ? 'sprinter' : c > 0.25 ? 'longhaul' : 'allrounder')
export const BUILDS: Record<Build, { name: string; icon: string; text: string }> = {
  sprinter: { name: 'Sprinter', icon: '⚡', text: 'Quick off the line, fades over a long race' },
  allrounder: { name: 'All-rounder', icon: '⚖️', text: 'Steady at any distance' },
  longhaul: { name: 'Long-hauler', icon: '🛣️', text: 'Slow off the line, pulls hardest over a mile' },
}
// Which builds suit a distance (good) and which struggle (bad).
export function fit(b: Build, d: RaceDist): 'good' | 'bad' | null {
  if (d === 'quarter') return b === 'sprinter' ? 'good' : b === 'longhaul' ? 'bad' : null
  if (d === 'mile') return b === 'longhaul' ? 'good' : b === 'sprinter' ? 'bad' : null
  return null
}

// How much a build can cost: long-haulers lose up to LAUNCH_LOSS of their pull in first and
// second gear; sprinters fade by up to FADE_LOSS, starting FADE_FROM metres in and reaching
// it FADE_OVER metres later.
export const LAUNCH_LOSS = 0.18
export const FADE_LOSS = 0.40
const FADE_FROM = 250
const FADE_OVER = 450
export function characterMul(c: number, gear: number, dist: number) {
  const launch = gear <= 1 ? 1 - LAUNCH_LOSS * (c + 1) / 2 : 1
  const fade = 1 - FADE_LOSS * ((1 - c) / 2) * Math.max(0, Math.min(1, (dist - FADE_FROM) / FADE_OVER))
  return launch * fade
}
