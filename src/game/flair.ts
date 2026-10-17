// Flair: the player's own boost trail colour and win celebration, shown on every race they drive
// (drag and kart). Pure looks, never bought: each one is won by a challenge on the progression
// already in the game (trophies, Class Cups, mastery, races), so there's nothing new for the
// server guard to pay. The save keeps only what's picked (`trail`, `cheer`); what's open is
// worked out from the save each time.
import type { CounterKey } from './data'
import { CAR_CLASSES } from './classes'
import { MASTERY_TIERS, classTier, galaxy, type Mastery } from './mastery'
import { cupWon } from './cups'
import type { TrailLook } from '../scene/boostTrail'

export type FlairSave = {
  trophies: number
  stats: Partial<Record<CounterKey, number>>
  cups?: Record<string, number>
  mastery?: Record<string, Mastery>
}
// What a challenge counts.
export type FlairStat = 'trophies' | 'races' | 'campaignWins' | 'coinsEarned' | 'cupRaces' | 'cupClasses' | 'masterCars' | 'goldClasses' | 'galaxy'
export type FlairChallenge = { icon: string; text: string; stat: FlairStat; goal: number }

export type TrailDef = { id: string; name: string; look: TrailLook; challenge?: FlairChallenge }
export type CheerKind = 'confetti' | 'sparks' | 'fireworks' | 'coins' | 'hearts' | 'stars'
export type CheerDef = { id: CheerKind; name: string; icon: string; colors: string[]; challenge?: FlairChallenge }

const ch = (icon: string, text: string, stat: FlairStat, goal: number): FlairChallenge => ({ icon, text, stat, goal })
const look = (head: string, tail: string, width = 0.55): TrailLook => ({ head, tail, width, life: 0.4 })

// The first of each list is everyone's from the start.
export const TRAILS: TrailDef[] = [
  { id: 'flame', name: 'Flame', look: look('#ffe082', '#ff3d00') },
  { id: 'frost', name: 'Frost', look: look('#e0f7ff', '#2979ff'), challenge: ch('🏆', 'Reach 100 trophies', 'trophies', 100) },
  { id: 'tidal', name: 'Tidal', look: look('#a7ffeb', '#00838f'), challenge: ch('🏁', 'Finish 100 races', 'races', 100) },
  { id: 'toxic', name: 'Toxic', look: look('#f4ff81', '#2e7d32'), challenge: ch('🏆', 'Win a whole Class Cup', 'cupClasses', 1) },
  { id: 'neon', name: 'Neon', look: look('#ff80ff', '#6200ea'), challenge: ch('🎖️', 'Master a car', 'masterCars', 1) },
  { id: 'goldrush', name: 'Gold Rush', look: look('#fff8e1', '#ffb300', 0.6), challenge: ch('🥇', 'Reach Gold in a class', 'goldClasses', 1) },
  { id: 'rainbow', name: 'Rainbow', look: look('#ff5252', '#40c4ff', 0.6), challenge: ch('🏆', 'Win every Class Cup', 'cupClasses', CAR_CLASSES.length) },
  { id: 'galaxy', name: 'Galaxy', look: look('#ea80fc', '#1a237e', 0.65), challenge: ch('🌌', 'Reach Galaxy mastery', 'galaxy', 1) },
]

export const CHEERS: CheerDef[] = [
  { id: 'confetti', name: 'Confetti', icon: '🎊', colors: ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'] },
  { id: 'sparks', name: 'Sparkler', icon: '✨', colors: ['#fff8e1', '#ffd740', '#ffab40'], challenge: ch('🗺', 'Win 25 campaign races', 'campaignWins', 25) },
  { id: 'hearts', name: 'Hearts', icon: '💖', colors: ['#ff4081', '#ff80ab', '#f8bbd0'], challenge: ch('🏆', 'Win 6 Class Cup races', 'cupRaces', 6) },
  { id: 'coins', name: 'Coin Rain', icon: '🪙', colors: ['#ffd740', '#ffc400', '#fff59d'], challenge: ch('💰', 'Earn 250,000 coins', 'coinsEarned', 250000) },
  { id: 'fireworks', name: 'Fireworks', icon: '🎆', colors: ['#ff1744', '#00e5ff', '#76ff03', '#ffea00', '#d500f9'], challenge: ch('🏆', 'Reach 500 trophies', 'trophies', 500) },
  { id: 'stars', name: 'Star Burst', icon: '🌟', colors: ['#ffffff', '#fff176', '#80d8ff'], challenge: ch('🎖️', 'Master 5 cars', 'masterCars', 5) },
]

export const trailDef = (id: string | null | undefined) => TRAILS.find((t) => t.id === id) ?? TRAILS[0]
export const cheerDef = (id: string | null | undefined) => CHEERS.find((c) => c.id === id) ?? CHEERS[0]

// How far a save is through a challenge (uncapped).
export function flairCount(stat: FlairStat, s: FlairSave): number {
  switch (stat) {
    case 'trophies': return s.trophies
    case 'races': case 'campaignWins': case 'coinsEarned': return s.stats[stat] ?? 0
    case 'cupRaces': return Object.values(s.cups ?? {}).filter((n) => n > 0).length
    case 'cupClasses': return CAR_CLASSES.filter((c) => cupWon(s.cups, c.id)).length
    case 'masterCars': return Object.values(s.mastery ?? {}).filter((m) => m.tier >= MASTERY_TIERS.length).length
    case 'goldClasses': return CAR_CLASSES.filter((c) => classTier(s.mastery, c.id) >= 1).length
    case 'galaxy': return galaxy(s.mastery) ? 1 : 0
  }
}
export const flairProgress = (c: FlairChallenge | undefined, s: FlairSave) => (c ? Math.min(c.goal, flairCount(c.stat, s)) : 0)
export const flairOpen = (c: FlairChallenge | undefined, s: FlairSave) => !c || flairCount(c.stat, s) >= c.goal

// The trail and celebration a save shows: what it picked, or the starters if that isn't open (any more).
export function myTrail(s: FlairSave & { trail?: string }) {
  const t = trailDef(s.trail)
  return flairOpen(t.challenge, s) ? t : TRAILS[0]
}
export function myCheer(s: FlairSave & { cheer?: string }) {
  const c = cheerDef(s.cheer)
  return flairOpen(c.challenge, s) ? c : CHEERS[0]
}
// How many trails and celebrations are open, for the Race menu.
export const flairOpenCount = (s: FlairSave) => [...TRAILS, ...CHEERS].filter((x) => flairOpen(x.challenge, s)).length
