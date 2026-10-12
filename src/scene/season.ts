// Seasons follow the calendar where the player is (meteorological seasons on
// the device's local date, flipped south of the equator; see game/sun.ts).
// ?season=winter|spring|summer|fall pins one for testing.
import { south } from '../game/sun'

export type Season = 'winter' | 'spring' | 'summer' | 'fall'
const ORDER: Season[] = ['winter', 'spring', 'summer', 'fall']

export function seasonOf(month: number, southern = false): Season {
  const i = Math.floor((month % 12) / 3) // 0 Dec-Feb, 1 Mar-May, 2 Jun-Aug, 3 Sep-Nov
  return ORDER[(i + (southern ? 2 : 0)) % 4]
}

function currentSeason(): Season {
  const pin = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('season') : null
  if (pin === 'winter' || pin === 'spring' || pin === 'summer' || pin === 'fall') return pin
  return seasonOf(new Date().getMonth() + 1, south())
}

export const SEASON: Season = currentSeason()

// How far through the current season today is (0 at its first day, 1 at its last),
// on the same local calendar. ?seasonT=0..1 pins it for testing.
function seasonProgress(): number {
  const pin = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('seasonT') : null
  if (pin !== null && !Number.isNaN(Number(pin))) return Math.max(0, Math.min(1, Number(pin)))
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate()
  // Each season is a three-month block starting on the first of December, March, June or September.
  const startMonth = [12, 3, 6, 9][Math.floor((m % 12) / 3)]
  const startYear = startMonth === 12 && m <= 2 ? y - 1 : y
  const start = Date.UTC(startYear, startMonth - 1, 1)
  const end = Date.UTC(startYear, startMonth + 2, 1)
  return Math.max(0, Math.min(1, (Date.UTC(y, m - 1, d) - start) / (end - start)))
}
export const SEASON_T = seasonProgress()

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
// Seasons hand over gradually: through the last couple of weeks of a season the
// world takes on more and more of the next one, and through the first couple of
// weeks of the next it lets go of the last, meeting half way on the changeover day.
// `other` is the neighbouring season and `mix` (0..0.5) how much of it shows.
export const SEASON_MIX: { other: Season; mix: number } = (() => {
  const i = ORDER.indexOf(SEASON)
  if (SEASON_T > 0.5) return { other: ORDER[(i + 1) % 4], mix: 0.5 * smooth(0.82, 1, SEASON_T) }
  return { other: ORDER[(i + 3) % 4], mix: 0.5 * (1 - smooth(0, 0.18, SEASON_T)) }
})()

type Palette = {
  grass: string
  grassSpeckle: string[]
  grassDots: string[] // flowers, fallen leaves or snow sparkle
  dots: number
  ground: string // land outside your plots
  leaves: [string, string, string, string, string] // oak leaf balls
  bush: [string, string]
  fronds: [string, string]
  sun: string
  bare: boolean // winter trees drop their leaves
}

export const PALETTES: Record<Season, Palette> = {
  spring: {
    grass: '#86d05a', grassSpeckle: ['#7cc850', '#93da66', '#79c04c', '#9fe070'], grassDots: ['#fff59d', '#ffffff', '#f8bbd0', '#ce93d8'], dots: 60,
    ground: '#68b444', leaves: ['#8bd96a', '#f8bbd0', '#7ccf5e', '#f48fb1', '#a5e08a'], bush: ['#7ccf5e', '#f8bbd0'], fronds: ['#66bb6a', '#43a047'], sun: '#fffaf0', bare: false,
  },
  summer: {
    grass: '#7cc54e', grassSpeckle: ['#72bb45', '#86cf58', '#6fb342', '#8fd660'], grassDots: ['#fff59d', '#ffffff'], dots: 10,
    ground: '#5aa83a', leaves: ['#4caf50', '#5cb85c', '#43a047', '#66c266', '#4caf50'], bush: ['#43a047', '#66bb6a'], fronds: ['#4caf50', '#43a047'], sun: '#ffffff', bare: false,
  },
  fall: {
    grass: '#a9b552', grassSpeckle: ['#9faa48', '#b5bf5d', '#97a142', '#c2c46a'], grassDots: ['#e65100', '#ff8f00', '#c62828', '#fbc02d'], dots: 35,
    ground: '#8c9a43', leaves: ['#ef6c00', '#fbc02d', '#d84315', '#ff8f00', '#c62828'], bush: ['#d84315', '#f9a825'], fronds: ['#9e9d24', '#827717'], sun: '#ffe2b8', bare: false,
  },
  winter: {
    grass: '#eef3f7', grassSpeckle: ['#e3eaf0', '#f8fbfd', '#dbe4ec', '#ffffff'], grassDots: ['#cfd8dc', '#b0bec5'], dots: 30,
    ground: '#dfe8ee', leaves: ['#ffffff', '#f1f5f8', '#e8eef2', '#ffffff', '#f1f5f8'], bush: ['#2e7d32', '#f5f8fa'], fronds: ['#689f38', '#558b2f'], sun: '#e8f1ff', bare: true,
  },
}

// The palette in use, blended toward the neighbouring season during a changeover:
// single colours fade across; lists (leaves, flowers) swap colour by colour, so a
// canopy in late summer is part green, part turning orange.
function blend(a: Palette, b: Palette, f: number): Palette {
  if (f <= 0.001) return a
  const lerp = (x: string, y: string) => {
    const p = parseInt(x.slice(1), 16), q = parseInt(y.slice(1), 16)
    const ch = (sh: number) => Math.round(((p >> sh) & 255) + ((((q >> sh) & 255) - ((p >> sh) & 255)) * f))
    return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
  }
  const swap = <T extends string[]>(x: T, y: string[]) => x.map((c, i) => ((i + 0.5) / x.length < f ? y[i % y.length] : c)) as T
  return {
    grass: lerp(a.grass, b.grass),
    grassSpeckle: a.grassSpeckle.map((c, i) => lerp(c, b.grassSpeckle[i % b.grassSpeckle.length])),
    grassDots: swap(a.grassDots, b.grassDots),
    dots: Math.round(a.dots + (b.dots - a.dots) * f),
    ground: lerp(a.ground, b.ground),
    leaves: swap(a.leaves, b.leaves),
    bush: swap(a.bush, b.bush),
    fronds: a.fronds.map((c, i) => lerp(c, b.fronds[i])) as [string, string],
    sun: lerp(a.sun, b.sun),
    bare: a.bare,
  }
}
export const PAL = blend(PALETTES[SEASON], PALETTES[SEASON_MIX.other], SEASON_MIX.mix)
