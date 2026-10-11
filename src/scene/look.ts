import { Color, Vector3 } from 'three'
import { SEASON, type Season } from './season'

// The game's "look": light colours and the colour grade for every time of day,
// nudged per season. DayNight blends these keyframes as the clock turns and the
// post-processing grade reads the result, so lights and grade always agree.

export type Grade = {
  exposure: number
  contrast: number
  saturation: number
  vibrance: number // extra saturation for dull colours only, so bright paint never clips
  greens: number // pulls lime greens towards a deeper emerald
  shadows: Color // signed tint added to dark tones (split toning)
  highlights: Color // signed tint added to bright tones
  vignette: number
  bloom: number // glow strength around bright lights
  threshold: number // brightness a pixel needs before it glows
}

export type Look = {
  sun: Color
  sunIntensity: number
  sky: Color // hemisphere light from above: the colour shadows pick up
  ground: Color // hemisphere light bounced up from the ground
  hemiIntensity: number
  env: number // strength of sky reflections on paint, glass and metal
  grade: Grade
}

const tint = (r: number, g: number, b: number) => new Color(r, g, b)

function key(l: {
  sun: string; sunIntensity: number; sky: string; ground: string; hemiIntensity: number; env: number
  grade: Omit<Grade, 'shadows' | 'highlights'> & { shadows: [number, number, number]; highlights: [number, number, number] }
}): Look {
  return {
    ...l,
    sun: new Color(l.sun),
    sky: new Color(l.sky),
    ground: new Color(l.ground),
    grade: { ...l.grade, shadows: tint(...l.grade.shadows), highlights: tint(...l.grade.highlights) },
  }
}

// Bright toy-town midday: warm sun, cool sky fill so shadows read blue, punchy colour.
const DAY = key({
  sun: '#ffeccc', sunIntensity: 2.0, sky: '#a9d0ff', ground: '#7a9a55', hemiIntensity: 0.6, env: 0.45,
  grade: { exposure: 0.9, contrast: 1.1, saturation: 1.0, vibrance: 0.08, greens: 0.55, shadows: [-0.014, 0.0, 0.032], highlights: [0.012, 0.006, -0.006], vignette: 0.24, bloom: 0.18, threshold: 1.1 },
})

// Golden hour: low orange sun, violet shadows, glowing highlights.
const DUSK = key({
  sun: '#ff8838', sunIntensity: 1.9, sky: '#b48ad0', ground: '#6b5040', hemiIntensity: 0.55, env: 0.3,
  grade: { exposure: 0.95, contrast: 1.12, saturation: 1.2, vibrance: 0.22, greens: 0.2, shadows: [0.03, -0.015, 0.06], highlights: [0.08, 0.03, -0.05], vignette: 0.36, bloom: 0.7, threshold: 0.8 },
})

// Night: moonlit blue world so warm windows, lamps and headlights pop and glow.
const NIGHT = key({
  sun: '#9db4ff', sunIntensity: 0.4, sky: '#5466b0', ground: '#141a2c', hemiIntensity: 0.45, env: 0.1,
  grade: { exposure: 1.05, contrast: 1.12, saturation: 0.62, vibrance: 0.04, greens: 0.9, shadows: [-0.02, -0.004, 0.085], highlights: [0.05, 0.022, -0.02], vignette: 0.45, bloom: 1.8, threshold: 0.4 },
})

// Seasonal nudges on top of the time of day.
type Nudge = { sun: string; amount: number; saturation: number; shadows: [number, number, number]; highlights: [number, number, number] }
const SEASON_NUDGE: Record<Season, Nudge> = {
  spring: { sun: '#fff6f0', amount: 0.25, saturation: 0.02, shadows: [0.006, 0, 0.012], highlights: [0.012, 0.006, 0.008] }, // soft pastel
  summer: { sun: '#fff3d6', amount: 0.2, saturation: 0.05, shadows: [-0.004, 0.004, 0.006], highlights: [0.01, 0.008, -0.01] }, // vivid
  fall: { sun: '#ffd49a', amount: 0.4, saturation: 0.04, shadows: [0.006, -0.004, 0.012], highlights: [0.035, 0.014, -0.03] }, // golden
  winter: { sun: '#e6efff', amount: 0.45, saturation: -0.1, shadows: [-0.008, 0.004, 0.03], highlights: [-0.006, 0.002, 0.012] }, // crisp and cool
}

function blank(): Look {
  return {
    sun: new Color(), sunIntensity: 0, sky: new Color(), ground: new Color(), hemiIntensity: 0, env: 0,
    grade: { exposure: 0, contrast: 0, saturation: 0, vibrance: 0, greens: 0, shadows: new Color(), highlights: new Color(), vignette: 0, bloom: 0, threshold: 0 },
  }
}

function lerpLook(out: Look, a: Look, b: Look, t: number) {
  const n = (x: number, y: number) => x + (y - x) * t
  out.sun.copy(a.sun).lerp(b.sun, t)
  out.sky.copy(a.sky).lerp(b.sky, t)
  out.ground.copy(a.ground).lerp(b.ground, t)
  out.sunIntensity = n(a.sunIntensity, b.sunIntensity)
  out.hemiIntensity = n(a.hemiIntensity, b.hemiIntensity)
  out.env = n(a.env, b.env)
  const g = out.grade, ga = a.grade, gb = b.grade
  g.exposure = n(ga.exposure, gb.exposure)
  g.contrast = n(ga.contrast, gb.contrast)
  g.saturation = n(ga.saturation, gb.saturation)
  g.vibrance = n(ga.vibrance, gb.vibrance)
  g.greens = n(ga.greens, gb.greens)
  g.shadows.copy(ga.shadows).lerp(gb.shadows, t)
  g.highlights.copy(ga.highlights).lerp(gb.highlights, t)
  g.vignette = n(ga.vignette, gb.vignette)
  g.bloom = n(ga.bloom, gb.bloom)
  g.threshold = n(ga.threshold, gb.threshold)
  return out
}

const nudgeSun = new Color()
const nudgeTint = new Color()

// The look for a given darkness (0 day, 1 night) and sunset amount, written into `out`.
export function lookFor(night: number, dusk: number, out: Look = blank(), season: Season = SEASON): Look {
  lerpLook(out, DAY, NIGHT, night)
  lerpLook(out, out, DUSK, dusk)
  const s = SEASON_NUDGE[season]
  const day = 1 - night
  out.sun.lerp(nudgeSun.set(s.sun), s.amount * day * (1 - dusk))
  out.grade.saturation += s.saturation
  out.grade.shadows.add(nudgeTint.setRGB(...s.shadows))
  out.grade.highlights.add(nudgeTint.setRGB(...s.highlights).multiplyScalar(day))
  return out
}

// Where the light comes from. The sun climbs high at noon and swings low from
// the east at dawn and the west at dusk for long shadows; the moon hangs still.
const NOON = new Vector3(25, 40, 15).normalize()
const MOON_DIR = new Vector3(-10, 40, 25).normalize()
const sunDirTmp = new Vector3()
export function lightDir(phase: number, night: number, out = new Vector3()) {
  const d = Math.abs(phase - 0.5) // 0.5 at noon, about 0.22 at sunset
  const high = Math.min(1, Math.max(0, (d - 0.22) / 0.28)) ** 0.8
  const el = (22 + 43 * high) * (Math.PI / 180)
  const swing = (1 - high) * 1.1 * (phase < 0.5 ? -1 : 1) // evening sun lights the street fronts, morning the sides
  const az = Math.atan2(NOON.x, NOON.z) + swing
  sunDirTmp.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  return out.copy(sunDirTmp).lerp(MOON_DIR, night).normalize()
}

// The current look of the town, kept up to date by DayNight each frame.
export const townLook: Look = lookFor(0, 0)

// Whether the post-processing grade is running (it can switch off on slow devices).
export const fxState = { on: true }

// Khronos PBR Neutral tone mapping, the same curve the renderer applies.
function neutral(c: Color) {
  const x = Math.min(c.r, c.g, c.b)
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04
  c.r -= offset; c.g -= offset; c.b -= offset
  const peak = Math.max(c.r, c.g, c.b)
  const start = 0.76
  if (peak < start) return c
  const d = 1 - start
  const top = 1 - (d * d) / (peak + d - start)
  c.multiplyScalar(top / peak)
  const g = 1 - 1 / (0.15 * (peak - top) + 1)
  c.r += (top - c.r) * g; c.g += (top - c.g) * g; c.b += (top - c.b) * g
  return c
}

const luma = (r: number, g: number, b: number) => r * 0.2126 + g * 0.7152 + b * 0.0722
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Vignette darkening at a screen position (0..1, y up). Mirrors the shader.
export function vignetteAt(g: Grade, u: number, v: number) {
  const dx = (u - 0.5) * 1.0, dy = (v - 0.5) * 0.85
  return 1 - g.vignette * smooth(0.3, 0.75, Math.hypot(dx, dy))
}

// Run a linear colour through the same tone map and grade as the screen, so
// page colours outside the 3D view (phone status bar) match what is drawn.
// Keep in step with the shader in PostFx.tsx.
export function gradeColor(c: Color, g: Grade, u = 0.5, v = 1): Color {
  neutral(c).multiplyScalar(g.exposure)
  let r = Math.max(0, c.r) ** (1 / 2.2), gg = Math.max(0, c.g) ** (1 / 2.2), b = Math.max(0, c.b) ** (1 / 2.2)
  const green = Math.min(1, Math.max(0, gg - Math.max(r, b))) * g.greens
  r -= 0.22 * green; gg -= 0.2 * green; b += 0.03 * green
  const l0 = luma(r, gg, b)
  const sh = 1 - smooth(0, 0.6, l0), hi = smooth(0.4, 1, l0)
  r += g.shadows.r * sh + g.highlights.r * hi
  gg += g.shadows.g * sh + g.highlights.g * hi
  b += g.shadows.b * sh + g.highlights.b * hi
  r = (r - 0.5) * g.contrast + 0.5
  gg = (gg - 0.5) * g.contrast + 0.5
  b = (b - 0.5) * g.contrast + 0.5
  const l = luma(r, gg, b)
  const spread = Math.max(r, gg, b) - Math.min(r, gg, b)
  const sat = g.saturation + g.vibrance * (1 - Math.min(1, spread * 2))
  r = l + (r - l) * sat; gg = l + (gg - l) * sat; b = l + (b - l) * sat
  const vig = vignetteAt(g, u, v)
  const clamp = (x: number) => Math.min(1, Math.max(0, x * vig)) ** 2.2
  return c.setRGB(clamp(r), clamp(gg), clamp(b))
}
