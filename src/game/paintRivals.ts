// Paint rivals: a roster of named racers, from rookies to legends, each driving
// their own colour. They can be raced at any level (the hard ones just need a
// faster car), and the first win over each one unlocks their colour in the Paint
// Shop. New towns start with only STARTER_PAINTS; towns from before the roster
// keep every colour they already had (`oldPaints`).
import { PAINTS, STARTER_PAINTS, LEGACY_PAINTS } from './data'
import { roadOpen } from './trophyRoad'
import { classWon, firstPaintClass, type Mastery } from './mastery'
import type { RaceDist } from './distance'
import type { VenueId } from '../scene/venues'

export type PaintRival = {
  id: string; name: string; icon: string
  paint: string // the colour they drive, and the one you win
  car: string // their car's model id
  pi: number; tier: 1 | 2 | 3 | 4 | 5
  venue: VenueId; dist: RaceDist; night?: boolean
  line: string // their taunt
}

export const TIERS = ['', 'Rookie', 'Street', 'Pro', 'Ace', 'Legend'] as const

export const PAINT_RIVALS: PaintRival[] = [
  { id: 'sunny', name: 'Sunny Sprocket', icon: '🌞', paint: '#fb8c00', car: 'pip', pi: 26, tier: 1, venue: 'main', dist: 'quarter', line: 'Orange is the fastest colour!' },
  { id: 'penny', name: 'Penny Pinwheel', icon: '🍭', paint: '#ec407a', car: 'bug', pi: 28, tier: 1, venue: 'beach', dist: 'quarter', line: 'Pink and proud. Try and catch me.' },
  { id: 'gus', name: 'Gus Gearhart', icon: '🧢', paint: '#fdd835', car: 'civic', pi: 31, tier: 1, venue: 'docks', dist: 'quarter', line: 'Meter\'s running, rookie.' },
  { id: 'moss', name: 'Moss McCoy', icon: '🌿', paint: '#43a047', car: 'trail', pi: 34, tier: 1, venue: 'farm', dist: 'quarter', line: 'Eat my gravel.' },
  { id: 'violet', name: 'Violet Vane', icon: '🔮', paint: '#8e24aa', car: 'miata', pi: 42, tier: 2, venue: 'desert', dist: 'quarter', line: 'I saw you losing. In my crystal ball.' },
  { id: 'marina', name: 'Marina Drift', icon: '🏄', paint: '#00acc1', car: 'hotshot', pi: 46, tier: 2, venue: 'beach', dist: 'half', line: 'Ride the wave or wipe out.' },
  { id: 'coco', name: 'Coco Clutch', icon: '☕', paint: '#6d4c41', car: 'stallion', pi: 50, tier: 2, venue: 'farm', dist: 'half', line: 'Fresh roast. Strong finish.' },
  { id: 'silas', name: 'Silas Spoke', icon: '🎿', paint: '#9e9e9e', car: 'kitsune', pi: 54, tier: 2, venue: 'snow', dist: 'quarter', line: 'Cold tyres? Not my problem.' },
  { id: 'midge', name: 'Midge Moonlight', icon: '🦉', paint: '#3949ab', car: 'kreis', pi: 60, tier: 3, venue: 'main', dist: 'half', night: true, line: 'I only race after dark.' },
  { id: 'cora', name: 'Cora Reefwell', icon: '🐚', paint: '#ff7a5c', car: 'vette', pi: 64, tier: 3, venue: 'beach', dist: 'half', line: 'Coral reefs and quick feet.' },
  { id: 'skye', name: 'Skye Updraft', icon: '🪁', paint: '#81d4fa', car: 'bergmeister', pi: 68, tier: 3, venue: 'snow', dist: 'half', line: 'Up here the air is thin. So is your lead.' },
  { id: 'kip', name: 'Kip Copperpot', icon: '🔧', paint: '#c0703a', car: 'rattler', pi: 72, tier: 3, venue: 'desert', dist: 'half', line: 'Built this engine with my own two hands.' },
  { id: 'lux', name: 'Lux Lavelle', icon: '🌸', paint: '#b39ddb', car: 'nightfall', pi: 80, tier: 4, venue: 'docks', dist: 'half', night: true, line: 'Darling, lavender never loses.' },
  { id: 'ollie', name: 'Ollie Oakhurst', icon: '🫒', paint: '#7d8a2c', car: 'ringmeister', pi: 88, tier: 4, venue: 'farm', dist: 'mile', line: 'A full mile. Pace yourself.' },
  { id: 'merlot', name: 'Duchess Merlot', icon: '🍷', paint: '#8c1d40', car: 'hyper', pi: 98, tier: 5, venue: 'main', dist: 'mile', night: true, line: 'A vintage year for winning.' },
  { id: 'tess', name: 'Tidal Tess', icon: '🌊', paint: '#00796b', car: 'zenith', pi: 108, tier: 5, venue: 'docks', dist: 'mile', line: 'Nobody outruns the tide.' },
]

export const paintRival = (id: string) => PAINT_RIVALS.find((r) => r.id === id)
export const rivalForPaint = (color: string) => PAINT_RIVALS.find((r) => r.paint === color)

// How cleanly they shift, 0 (sloppy) to 1 (perfect): rookies fumble, legends don't.
export const rowShift = (r: PaintRival) => Math.min(0.97, 0.3 + r.tier * 0.13)
// Pros and up use their car's skill.
export const rowSkills = (r: PaintRival) => r.tier >= 3
// What a race pays: a little more than a town rival at the same PI, plus a first-win bonus.
export const rowPrize = (r: PaintRival, first: boolean) => Math.round(((260 + r.pi * 9) * (first ? 2 : 1)) / 10) * 10

type PaintSave = { rivalRow?: Record<string, number>; oldPaints?: boolean; road?: number; roadItems?: string[]; mastery?: Record<string, Mastery> }

// Can this colour go on a car? Starter colours, gem colours (bought each time), colours
// from beaten rivals, Trophy Road and first-win colours once won, and for older towns every
// colour they had before the roster.
export function paintOpen(s: PaintSave, color: string) {
  const p = PAINTS.find((x) => x.color === color)
  if (!p) return false
  if (p.earn === 'road') return roadOpen(s.roadItems, color)
  if (p.earn === 'first') {
    const c = firstPaintClass(color)
    return !!c && classWon(s.mastery, c.id)
  }
  if (p.bucks || STARTER_PAINTS.includes(color)) return true
  if (s.oldPaints && LEGACY_PAINTS.includes(color)) return true
  const r = rivalForPaint(color)
  return !!r && (s.rivalRow?.[r.id] ?? 0) > 0
}

// Where a Trophy Road or first-win colour is won.
export function earnHint(color: string) {
  if (PAINTS.find((p) => p.color === color)?.earn === 'road') return 'Trophy Road mystery prize'
  const c = firstPaintClass(color)
  return c ? `Win a race in a ${c.name} car` : ''
}

// The chart colours rivals and starters cover (Trophy Road and first-win colours aren't counted here).
const ROSTER_PAINTS = PAINTS.filter((p) => !p.bucks && !p.earn)
export const paintsOpen = (s: PaintSave) => ROSTER_PAINTS.filter((p) => paintOpen(s, p.color)).length
export const PAINTS_TO_COLLECT = ROSTER_PAINTS.length
