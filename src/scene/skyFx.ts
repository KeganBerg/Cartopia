import type { Weather } from '../game/weather'
import { SEASON, type Season } from './season'
import { nightAmount } from '../game/clock'
import { gloomOf } from './weatherLook'

// The finishing touches on the sky, worked out from the weather and the time of
// day (all 0..1). Atmosphere.tsx draws them; the town's look and roads read some.
// banks: fog lying on the ground in rolling banks (fog, morning mist, steam off
//   drying streets). Thicker is more of the town hidden.
// low: how low the banks lie (1 is ground-hugging mist, 0 thick fog up to the eaves).
// rays: shafts of sun (or moon) through the air: sunrise, sunset, fog burning off,
//   the sun breaking through after a shower.
// rainbow: after a shower, while the streets are still wet.
// glint: sun sparkling on wet roads as they dry.
// heat: a summer scorcher: warm haze and a mirage shimmering on the asphalt.
// halo: how strongly lamps glow through the damp air.
// shade: how dark the shadows of fair-weather clouds drifting over town are.
export type SkyFx = { banks: number; low: number; rays: number; moon: number; rainbow: number; glint: number; heat: number; halo: number; shade: number }

// What the sky is doing this frame, kept up to date by Atmosphere.tsx.
export const sky: SkyFx = { banks: 0, low: 1, rays: 0, moon: 0, rainbow: 0, glint: 0, heat: 0, halo: 0, shade: 0 }

const clamp = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// How low the sun sits: peaks just after sunrise and just before sunset.
export function lowSun(phase: number) {
  const d = Math.abs(phase - 0.5) // 0 at midnight, 0.5 at noon
  return clamp(1 - Math.abs(d - 0.275) / 0.07)
}

export function skyFx(w: Weather, phase: number, season: Season = SEASON, out: SkyFx = { banks: 0, low: 0, rays: 0, moon: 0, rainbow: 0, glint: 0, heat: 0, halo: 0, shade: 0 }): SkyFx {
  const night = nightAmount(phase)
  const day = 1 - night
  // How much of each kind is in the sky, so every effect fades as the weather changes.
  const fog = w.mix.fog
  const mist = w.mix.mist
  const clearing = w.mix.clearing
  const drizzle = w.mix.drizzle
  const rainy = clamp(w.rain * 3)
  // Warm wet streets steam a little as the sun dries them.
  const steam = season === 'winter' ? 0 : clearing * smooth(0.1, 0.5, w.wet) * day
  out.banks = Math.max(fog, 0.75 * mist, 0.32 * drizzle, 0.3 * steam)
  out.low = out.banks > 0 ? clamp((0.75 * mist + 0.32 * drizzle + 0.3 * steam) / out.banks) : 1
  // The sun only shows through broken cloud.
  const sunny = day * (1 - rainy) * (1 - smooth(0.4, 0.8, w.cloud))
  const low = lowSun(phase)
  // Fog swallows the shafts rather than showing them off.
  // Golden hour only (and the sun breaking through after a shower), never at midday.
  out.rays = sunny * Math.max(0.8 * low, 0.5 * clearing * low) * (1 - out.banks)
  out.moon = 0
  out.rainbow = season === 'winter' ? 0 : clearing * smooth(0.12, 0.4, w.wet) * smooth(0.5, 0.8, day)
  out.glint = sunny * smooth(0.05, 0.4, w.wet) * (1 - 0.6 * fog)
  out.heat = w.mix.heat * day
  const lamps = Math.max(night, gloomOf(w) * 0.8)
  // Broken cloud on a sunny day; none under overcast, in fog, or after dark.
  out.shade = 0.4 * day * (1 - smooth(0.25, 0.6, w.cloud)) * (1 - out.banks) * (1 - 0.6 * w.mix.heat)
  out.halo = lamps * (0.35 + 0.65 * clamp(Math.max(fog, 0.8 * mist, w.haze, 0.6 * rainy)))
  return out
}
