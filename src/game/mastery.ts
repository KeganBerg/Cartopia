// Car mastery: four tiers per car model, earned only by racing it. Every drag race in a car
// counts (time trials and ghost runs don't), in any mode, so normal play fills them.
// Each tier pays gems once and unlocks a look for that model only: Bronze, Silver and Gold
// finishes (data.ts FINISHES) and the Signature pattern (data.ts PATTERNS).
// The server guard (econ_guard(), catalog key `mastery`) pays the same gems and trophies
// and checks the counts against the save's race wins.

export type MasteryMode = 'drag' | 'campaign' | 'rival' | 'tuner' | 'tour' | 'event' | 'live' | 'cup' | 'gp'
// Saved per car model: races finished, races won, the modes won in, wins over a car with
// a higher PI, and how many tiers have been reached (and paid).
export type Mastery = { races: number; wins: number; modes: MasteryMode[]; upsets: number; tier: number }

export type MasteryTier = {
  id: 'bronze' | 'silver' | 'signature' | 'gold'; name: string; icon: string
  bucks: number; trophies: number
  // What this tier needs on top of the tiers before it.
  need: { races?: number; wins?: number; modes?: number; upsets?: number }
}
export const MASTERY_TIERS: MasteryTier[] = [
  { id: 'bronze', name: 'Bronze', icon: '🥉', bucks: 1, trophies: 0, need: { races: 10 } },
  { id: 'silver', name: 'Silver', icon: '🥈', bucks: 1, trophies: 0, need: { wins: 10 } },
  { id: 'signature', name: 'Signature', icon: '✍️', bucks: 1, trophies: 0, need: { modes: 3 } },
  { id: 'gold', name: 'Gold', icon: '🥇', bucks: 2, trophies: 5, need: { upsets: 5 } },
]

export const emptyMastery = (): Mastery => ({ races: 0, wins: 0, modes: [], upsets: 0, tier: 0 })

// A rival's id says which mode the race was in (see the rival builders in ui/Race.tsx).
// Solo runs (time trials, ghosts) return null: they don't count.
export function masteryMode(rivalId: string): MasteryMode | null {
  if (rivalId === 'trial' || rivalId === 'ghost') return null
  if (rivalId.startsWith('live:')) return 'live'
  const pre = rivalId.split('-')[0]
  if (pre === 'camp') return 'campaign'
  if (pre === 'row' || pre === 'rival') return 'rival'
  if (pre === 'tuner' || pre === 'tour' || pre === 'event' || pre === 'cup' || pre === 'gp') return pre
  return 'drag'
}

// How far a car is towards one need: [have, of].
export function needProgress(m: Mastery, t: MasteryTier): [number, number][] {
  const n = t.need
  const out: [number, number][] = []
  if (n.races) out.push([Math.min(m.races, n.races), n.races])
  if (n.wins) out.push([Math.min(m.wins, n.wins), n.wins])
  if (n.modes) out.push([Math.min(m.modes.length, n.modes), n.modes])
  if (n.upsets) out.push([Math.min(m.upsets, n.upsets), n.upsets])
  return out
}
const met = (m: Mastery, t: MasteryTier) => needProgress(m, t).every(([a, b]) => a >= b)

// The tiers a car has reached, in order: a tier only counts once the ones before it have.
export function tierReached(m: Mastery) {
  let n = 0
  while (n < MASTERY_TIERS.length && met(m, MASTERY_TIERS[n])) n++
  return n
}

// One finished race in this car. Returns the new counts and the tiers it newly reached.
export function noteRace(m: Mastery | undefined, won: boolean, mode: MasteryMode, upset: boolean) {
  const cur = m ?? emptyMastery()
  const next: Mastery = {
    races: cur.races + 1,
    wins: cur.wins + (won ? 1 : 0),
    modes: won && !cur.modes.includes(mode) ? [...cur.modes, mode] : cur.modes,
    upsets: cur.upsets + (won && upset ? 1 : 0),
    tier: cur.tier,
  }
  next.tier = Math.max(cur.tier, tierReached(next))
  return { next, reached: MASTERY_TIERS.slice(cur.tier, next.tier) }
}

export const masteryTier = (all: Record<string, Mastery> | undefined, model: string) => all?.[model]?.tier ?? 0
// The tier that shows on a car: its highest one, if any.
export const masteryBadge = (tier: number) => (tier > 0 ? MASTERY_TIERS[Math.min(tier, MASTERY_TIERS.length) - 1] : null)
