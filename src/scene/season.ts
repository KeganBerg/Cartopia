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

export const PAL = PALETTES[SEASON]
