// Little extras in the town's sky, all cosmetic: the moon following the real
// lunar calendar, northern lights between 1 and 2 in the morning (the player's
// own clock) on clear nights, a shooting star now and then, and the odd plane,
// helicopter, banner plane, blimp, hot-air balloon or cartoon rocket passing over. This is the timing; the
// drawing is in scene/SkyExtras.tsx and the free view's sky (Horizon.tsx).
//
// ?sky=aurora|meteor|planes|heli|banner|blimp|balloon|rocket (comma-separated for several) forces
// an effect on for screenshots, and ?moon=0..1 pins the moon's phase.

// A known new moon (2000-01-06 18:14 UTC) and the average length of the moon's
// cycle, new to new.
export const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14)
export const SYNODIC_DAYS = 29.530588853
const DAY_MS = 24 * 60 * 60 * 1000

const params = () => (typeof location === 'undefined' ? null : new URLSearchParams(location.search))

export type SkyPin = 'aurora' | 'meteor' | 'planes' | 'heli' | 'banner' | 'blimp' | 'balloon' | 'rocket'
const PINS: SkyPin[] = ['aurora', 'meteor', 'planes', 'heli', 'banner', 'blimp', 'balloon', 'rocket']
export function parseSkyPins(v: string | null): Set<SkyPin> {
  return new Set((v ?? '').split(',').map((s) => s.trim()).filter((s): s is SkyPin => (PINS as string[]).includes(s)))
}
export const skyPins = parseSkyPins(params()?.get('sky') ?? null)

const moonPin = (() => {
  const v = params()?.get('moon')
  const n = v === null || v === undefined ? NaN : Number(v)
  return Number.isFinite(n) ? n - Math.floor(n) : null
})()

// How far through its cycle the moon is: 0 new, 0.25 first quarter, 0.5 full,
// 0.75 last quarter.
export function moonPhase(now = Date.now()) {
  if (moonPin !== null) return moonPin
  const days = (now - NEW_MOON_EPOCH) / DAY_MS
  const p = days / SYNODIC_DAYS
  return p - Math.floor(p)
}

// How much of the disc is lit, 0 (new) to 1 (full).
export const moonLit = (phase: number) => (1 - Math.cos(2 * Math.PI * phase)) / 2

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// The northern lights' hour on the device's own clock: 1:00 to 2:00 AM, easing
// in and out over the first and last few minutes. 0..1.
const AURORA_FADE_MIN = 8
export function auroraHour(d: Date = new Date()) {
  if (skyPins.has('aurora')) return 1
  const m = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 - 60 // minutes past 1 AM
  if (m < 0 || m >= 60) return 0
  return smooth(0, AURORA_FADE_MIN, m) * smooth(60, 60 - AURORA_FADE_MIN, m)
}

// How clear the sky is for stars, 0 (overcast, raining, foggy) to 1.
export function skyClear(w: { cloud: number; haze: number; rain: number; snow: number }) {
  return (1 - smooth(0.15, 0.45, w.cloud)) * (1 - smooth(0.2, 0.5, w.haze)) * (1 - smooth(0, 0.1, w.rain + w.snow))
}

// Seconds until the next shooting star: roughly 20 to 60 (a few seconds when forced).
export function meteorGap(r: number) {
  return skyPins.has('meteor') ? 3 + r * 3 : 20 + r * 40
}

// Fly-bys: something passes over every minute or two. An airliner any time
// (lights blinking at night) and now and then a news helicopter; on fair days
// also a hot-air balloon, a banner plane or the blimp; and once in a long while
// a little rocket.
export type FlyBy = 'plane' | 'heli' | 'banner' | 'blimp' | 'balloon' | 'rocket'
const forcedFlyBys = () => PINS.filter((p) => p !== 'aurora' && p !== 'meteor' && skyPins.has(p))
export function flyByGap(r: number) {
  return forcedFlyBys().length ? 2 + r * 2 : 45 + r * 75
}

// Which one comes next. `fair` is false in rain, snow, wind or fog (no balloons
// then, and nothing at all in a real storm); `night` is 0..1.
export function pickFlyBy(r1: number, r2: number, night: number, fair: boolean, storm = false): FlyBy | null {
  const forced = forcedFlyBys()
  if (forced.length) {
    const p = forced[Math.floor(r1 * forced.length) % forced.length]
    return p === 'planes' ? 'plane' : (p as FlyBy)
  }
  if (storm) return null
  if (r1 < 0.03) return 'rocket'
  if (night < 0.5 && fair) {
    if (r2 < 0.25) return 'balloon'
    if (r2 < 0.4) return 'banner'
    if (r2 < 0.52) return 'blimp'
  }
  if (r2 > 0.82) return 'heli'
  return 'plane'
}
