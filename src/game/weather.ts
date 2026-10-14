import { naturalPhase } from './clock'
import { activeEvent } from './liveEvents'
import { SEASON, type Season } from '../scene/season'
import type { VenueId } from '../scene/venues'

// Town weather. Like the clock, it's worked out from the real time, so every
// player sees the same shower at the same moment. Time is cut into spells of a
// few minutes; each spell rolls a kind of weather that suits the season (East
// Coast calendar), crossfading into the next at its ends. Clear spells stay the most common.
// ?weather=clear|rain|storm|drizzle|fog|wind|snow|blizzard|mist|clearing|heat pins one for testing,
// and a 'weather' live event sets one for every player (see forcedAt).
//
// Other parts of the game (sounds, visuals) read weatherNow() each frame, and
// onThunder() fires a little after each lightning flash.

// 'dust' only blows through the desert race venue; the town never rolls it.
// Three gentler kinds only happen in town, and only on top of a clear sky:
// 'mist' lies low on spring, summer and fall mornings; 'clearing' follows a
// shower (wet streets drying in the sun, maybe a rainbow); 'heat' is a summer
// afternoon scorcher.
export type WeatherKind = 'clear' | 'rain' | 'storm' | 'drizzle' | 'fog' | 'wind' | 'snow' | 'blizzard' | 'dust' | 'mist' | 'clearing' | 'heat'
export const WEATHER_KINDS: WeatherKind[] = ['clear', 'rain', 'storm', 'drizzle', 'fog', 'wind', 'snow', 'blizzard', 'dust', 'mist', 'clearing', 'heat']
export const TOWN_ONLY = new Set<WeatherKind>(['mist', 'clearing', 'heat'])

// What a kind looks like at full strength. All 0..1.
// rain/snow: how hard it falls. cloud: how overcast and dim. haze: how far you can see
// (fog, whiteout). wind: how hard it blows. dust: blowing sand.
type Feel = { rain: number; snow: number; cloud: number; haze: number; wind: number; dust: number }
export const FEEL: Record<WeatherKind, Feel> = {
  clear: { rain: 0, snow: 0, cloud: 0, haze: 0, wind: 0, dust: 0 },
  rain: { rain: 0.6, snow: 0, cloud: 0.65, haze: 0.15, wind: 0.3, dust: 0 },
  storm: { rain: 1, snow: 0, cloud: 1, haze: 0.25, wind: 0.7, dust: 0 },
  drizzle: { rain: 0.25, snow: 0, cloud: 0.5, haze: 0.3, wind: 0.15, dust: 0 },
  fog: { rain: 0, snow: 0, cloud: 0.35, haze: 0.9, wind: 0, dust: 0 },
  wind: { rain: 0, snow: 0, cloud: 0.25, haze: 0.05, wind: 1, dust: 0 },
  snow: { rain: 0, snow: 0.55, cloud: 0.55, haze: 0.3, wind: 0.2, dust: 0 },
  blizzard: { rain: 0, snow: 1, cloud: 0.8, haze: 0.8, wind: 1, dust: 0 },
  dust: { rain: 0, snow: 0, cloud: 0.3, haze: 0.6, wind: 1, dust: 1 },
  mist: { rain: 0, snow: 0, cloud: 0.05, haze: 0.3, wind: 0, dust: 0 },
  clearing: { rain: 0, snow: 0, cloud: 0.08, haze: 0.05, wind: 0.1, dust: 0 },
  heat: { rain: 0, snow: 0, cloud: 0, haze: 0.12, wind: 0, dust: 0 },
}

const RAINY = new Set<WeatherKind>(['rain', 'storm', 'drizzle'])

// Odds of each kind per spell, by season. Summer fog only rolls in the morning.
const ODDS: Record<Season, [WeatherKind, number][]> = {
  spring: [['clear', 55], ['rain', 22], ['storm', 10], ['drizzle', 6], ['fog', 7]],
  summer: [['clear', 60], ['rain', 10], ['storm', 18], ['fog', 12]],
  fall: [['clear', 52], ['drizzle', 16], ['wind', 18], ['rain', 10], ['fog', 6]],
  winter: [['clear', 48], ['snow', 32], ['blizzard', 14], ['wind', 6]],
}

// How often a clear morning is misty, by season.
const MIST: Record<Season, number> = { spring: 0.45, summer: 0.4, fall: 0.6, winter: 0 }


export const SPELL_MS = 4 * 60 * 1000
// Each change of weather crossfades over this long, centred on the spell boundary.
const FADE_MS = 80 * 1000
// Whatever the schedule says, what's shown glides towards it with this time constant,
// so a live event that starts or is ended early never pops.
const GLIDE_MS = 10_000
const DAY = 24 * 60 * 60 * 1000

const PIN = (() => {
  if (typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('weather')
  return v && (WEATHER_KINDS as string[]).includes(v) ? (v as WeatherKind) : null
})()

// A repeatable random number in 0..1 for a spell.
function hash(n: number) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// The kind of weather a spell brings.
// The season's roll for a spell, before the fix-ups below.
function rolled(index: number, season: Season): WeatherKind {
  const odds = ODDS[season]
  const total = odds.reduce((s, [, w]) => s + w, 0)
  let r = hash(index * 7 + season.length) * total
  for (const [k, w] of odds) if ((r -= w) < 0) return k
  return 'clear'
}

export function spellKind(index: number, season: Season = SEASON): WeatherKind {
  if (PIN) return PIN
  let kind = rolled(index, season)
  // Two big storms in a row feel endless: the second one calms to rain or snow.
  if ((kind === 'storm' || kind === 'blizzard') && spellKind(index - 1, season) === kind) kind = kind === 'storm' ? 'rain' : 'snow'
  // Morning on the town clock: from just before dawn to mid-morning (0.5 is midnight, 0 noon).
  const phase = naturalPhase(index * SPELL_MS)
  const morning = phase >= 0.68 && phase <= 0.9
  if (kind === 'fog' && season === 'summer' && !morning) kind = 'clear'
  if (kind === 'clear') {
    // Some days are misty mornings or summer scorchers all through, not spell by spell.
    const day = Math.floor((index * SPELL_MS) / DAY)
    // The sun comes out on wet streets after most showers.
    if (season !== 'winter' && RAINY.has(rolled(index - 1, season))) {
      if (hash(index * 13 + 5) < 0.7) kind = 'clearing'
    } else if (morning && hash(day * 31 + 7) < MIST[season]) kind = 'mist'
    // Summer afternoons (noon to late afternoon) bake on hot days.
    else if (season === 'summer' && (phase < 0.2 || phase > 0.95) && hash(day * 17 + 3) < 0.4) kind = 'heat'
  }
  return kind
}

export type Mix = Record<WeatherKind, number>
const emptyMix = (): Mix => Object.fromEntries(WEATHER_KINDS.map((k) => [k, 0])) as Mix
// A mix that's all one kind.
export function mixOf(kind: WeatherKind, s = 1): Mix {
  const m = emptyMix()
  m[kind] = s
  if (kind !== 'clear') m.clear = 1 - s
  return m
}

export type Weather = Feel & {
  kind: WeatherKind // the kind with the most say right now
  strength: number // 0..1 how much say it has
  mix: Mix // how much of each kind is in the sky right now (adds up to 1)
  wet: number // how wet the ground is: soaks up during rain, dries after
  cover: number // how much snow lies on roofs, roads and cars
  flash: number // lightning brightness right now (set by the weather visuals)
}

const smooth01 = (x: number) => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}

// The schedule's mix: one spell's kind, crossfading into its neighbour across
// each boundary. Two spells of the same kind run straight on with no dip.
function spellMix(now: number, out: Mix) {
  for (const k of WEATHER_KINDS) out[k] = 0
  if (PIN) { out[PIN] = 1; return out }
  const i = Math.floor(now / SPELL_MS)
  const t = now - i * SPELL_MS
  const half = FADE_MS / 2
  if (t < half) {
    const x = smooth01((t + half) / FADE_MS)
    out[spellKind(i - 1)] += 1 - x
    out[spellKind(i)] += x
  } else if (t > SPELL_MS - half) {
    const x = smooth01((t - (SPELL_MS - half)) / FADE_MS)
    out[spellKind(i)] += 1 - x
    out[spellKind(i + 1)] += x
  } else out[spellKind(i)] = 1
  return out
}

// A 'weather' live event (live_events table) sets the sky for everyone, e.g.
//   select live_event_start('weather', 30, '{"kind": "fog"}');
// It crossfades in over the schedule and back out at its end. ?weather= still wins, for testing.
function forcedAt(now: number) {
  if (PIN) return null
  const e = activeEvent(['weather'], now)
  const k = e?.payload.kind
  if (!e || typeof k !== 'string' || !(WEATHER_KINDS as string[]).includes(k) || k === 'dust') return null
  return { kind: k as WeatherKind, s: smooth01(Math.min((now - e.from) / FADE_MS, (e.to - now) / FADE_MS)) }
}

// Where the sky is heading at this moment.
// A brand new player's first minutes are always sunny (App turns this on during the tutorial).
let calmSky = false
export function setCalmSky(on: boolean) {
  calmSky = on
}

function targetMix(now: number, out: Mix) {
  if (calmSky) {
    for (const k of WEATHER_KINDS) out[k] = 0
    out.clear = 1
    return out
  }
  spellMix(now, out)
  const forced = forcedAt(now)
  if (forced && forced.s > 0) {
    for (const k of WEATHER_KINDS) out[k] *= 1 - forced.s
    out[forced.kind] += forced.s
  }
  return out
}

// Fills in the feel (rain, cloud, ...) and the leading kind from a mix.
function feelOf(mix: Mix, now: number, out: Feel & { kind: WeatherKind; strength: number }) {
  out.rain = out.snow = out.cloud = out.haze = out.wind = out.dust = 0
  let kind: WeatherKind = 'clear'
  for (const k of WEATHER_KINDS) {
    const m = mix[k]
    if (m <= 0) continue
    const f = FEEL[k]
    out.rain += f.rain * m
    out.snow += f.snow * m
    out.cloud += f.cloud * m
    out.haze += f.haze * m
    out.wind += f.wind * m
    out.dust += f.dust * m
    if (m > mix[kind]) kind = k
  }
  out.kind = kind
  out.strength = mix[kind]
  // Even a calm spell has a breath of wind, and storms gust.
  out.wind = Math.min(1, out.wind * (0.8 + 0.3 * Math.sin(now / 2300) + 0.2 * Math.sin(now / 900)))
  return out
}

const scratchMix = emptyMix()
function feelAt(now: number, out: Feel & { kind: WeatherKind; strength: number }) {
  return feelOf(targetMix(now, scratchMix), now, out)
}

// Wet ground and snow cover build up over a spell and linger after it, so they're
// stepped through the last couple of spells.
const STEP_MS = 5000
const scratch = { kind: 'clear' as WeatherKind, strength: 0, rain: 0, snow: 0, cloud: 0, haze: 0, wind: 0, dust: 0 }
function groundAt(now: number) {
  if (calmSky) return { wet: 0, cover: 0 }
  if (PIN) return { wet: FEEL[PIN].rain > 0 ? 1 : PIN === 'clearing' ? 0.7 : 0, cover: FEEL[PIN].snow > 0 ? 1 : 0 }
  let wet = 0, cover = 0
  const start = Math.floor(now / STEP_MS) * STEP_MS - 2 * SPELL_MS
  for (let t = start; t <= now; t += STEP_MS) {
    const f = feelAt(t, scratch)
    const dt = STEP_MS / 1000
    // Soaks in about 40 s of real rain, dries in about two minutes.
    // Puddles hang on longer while the sun comes out after a shower.
    wet = f.rain > 0.05 ? Math.min(1, wet + dt * (0.6 + f.rain) / 40) : Math.max(0, wet - dt / (scratchMix.clearing > 0.5 ? 260 : 120))
    // Snow settles over a minute or so and melts slowly.
    cover = f.snow > 0.05 ? Math.min(1, cover + dt * (0.4 + f.snow) / 60) : Math.max(0, cover - dt / 150)
  }
  return { wet, cover }
}

export const weather: Weather = { kind: 'clear', strength: 0, mix: mixOf('clear'), rain: 0, snow: 0, cloud: 0, haze: 0, wind: 0, dust: 0, wet: 0, cover: 0, flash: 0 }
let lastAt = -Infinity
let groundStamp = -1
const goal = emptyMix()

// The weather right now. Cheap to call every frame: it's worked out at most ten
// times a second and shared.
export function weatherNow(now = Date.now()): Weather {
  const gap = now - lastAt
  if (Math.abs(gap) < 100) return weather
  lastAt = now
  targetMix(now, goal)
  // Glide towards the schedule; jump straight there after a long gap (first call, a tab coming back).
  const a = gap > 0 && gap < 15_000 ? 1 - Math.exp(-gap / GLIDE_MS) : 1
  for (const k of WEATHER_KINDS) weather.mix[k] += (goal[k] - weather.mix[k]) * a
  feelOf(weather.mix, now, weather)
  const stamp = Math.floor(now / 1000)
  if (stamp !== groundStamp) {
    groundStamp = stamp
    Object.assign(weather, groundAt(now))
  }
  return weather
}

// Lightning and thunder. The visuals call strike(); sound can listen with onThunder.
// `delay` is how long after the flash the rumble arrives (ms), `loud` 0..1.
type Thunder = (delay: number, loud: number) => void
const thunder = new Set<Thunder>()
export function onThunder(f: Thunder) {
  thunder.add(f)
  return () => { thunder.delete(f) }
}
// A repeatable 0..1 roll from a string (a live race id), the same on both racers' screens.
export function seedRoll(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return hash(h)
}

export function strike(delay: number, loud: number) {
  for (const f of thunder) f(delay, loud)
}

// Every venue has its own skies: drizzle and fog on the docks, dust storms in
// the canyon, blizzards up the pass. A live race rolls its weather from the race
// id, so both racers see the same sky. Otherwise bad weather in town carries
// over to the race (adjusted for the venue), and a clear day rolls the venue's own.
const VENUE_SKIES: Record<VenueId, [WeatherKind, number][]> = {
  main: [['clear', 45], ['rain', 20], ['storm', 12], ['drizzle', 10], ['fog', 13]],
  beach: [['clear', 45], ['rain', 15], ['storm', 15], ['fog', 15], ['wind', 10]],
  desert: [['clear', 45], ['dust', 35], ['wind', 20]],
  snow: [['clear', 35], ['snow', 40], ['blizzard', 25]],
  farm: [['clear', 45], ['rain', 18], ['storm', 14], ['fog', 13], ['drizzle', 10]],
  docks: [['clear', 40], ['fog', 25], ['drizzle', 15], ['rain', 10], ['storm', 10]],
}
const AS_SNOW: Partial<Record<WeatherKind, WeatherKind>> = { rain: 'snow', drizzle: 'snow', storm: 'blizzard' }
const IN_DESERT: Partial<Record<WeatherKind, WeatherKind>> = { rain: 'dust', drizzle: 'clear', storm: 'dust', snow: 'wind', blizzard: 'dust', fog: 'clear' }

function rollVenue(venue: VenueId, roll: number): WeatherKind {
  const odds = VENUE_SKIES[venue]
  let r = roll * odds.reduce((s, [, w]) => s + w, 0)
  for (const [k, w] of odds) if ((r -= w) < 0) return k
  return 'clear'
}

// `force`: a sky the race always has (weekly events), kept as it is at every venue.
export function raceWeather(venue: VenueId, seed?: string, force?: WeatherKind): Weather {
  let kind: WeatherKind
  const town = weatherNow()
  if (PIN) kind = town.kind
  else if (force) kind = force
  else if (seed) kind = rollVenue(venue, seedRoll(seed))
  else kind = town.kind !== 'clear' && !TOWN_ONLY.has(town.kind) && town.strength > 0.3 ? town.kind : rollVenue(venue, Math.random())
  if (force && !PIN) kind = force
  else if (venue === 'snow') kind = AS_SNOW[kind] ?? kind
  else if (venue === 'desert') kind = IN_DESERT[kind] ?? kind
  // Winter rain falls as snow everywhere but the desert.
  else if (SEASON === 'winter') kind = AS_SNOW[kind] ?? kind
  const f = FEEL[kind]
  return {
    kind, strength: 1, mix: mixOf(kind), flash: 0,
    rain: f.rain, snow: f.snow, cloud: f.cloud, haze: f.haze, wind: f.wind, dust: f.dust,
    wet: f.rain > 0 ? 1 : 0,
    cover: f.snow > 0 ? 0.85 : venue === 'snow' || venue === 'desert' ? 0 : town.cover,
  }
}
