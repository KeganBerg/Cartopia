import type { BuildingDef } from './data'

// Helping a friend's businesses while visiting their town, like Car Town Streets: tap a shop to
// lend a hand and you're paid a little for each. The server repeats these numbers in
// supabase/migrations/0047_town_helps.sql (the helps table), and help.test.ts checks they match.
export const HELPS_PER_TOWN = 5
export const HELPS_PER_DAY = 40
export const HELP_TABLE = { perTown: HELPS_PER_TOWN, perDay: HELPS_PER_DAY, coins: 20, coinsPerLevel: 5, coinsPerShopLevel: 10, xp: 2, xpPerFiveLevels: 1, lastParts: 2 }

// A business with a job to help with (not decor, houses or obstacles).
export const helpable = (d: BuildingDef) => !!d.jobSeconds && d.kind !== 'obstacle' && !d.parked

// What one help pays: `level` is the helper's level, `shopLevel` the business's upgrade level,
// `nth` which of today's helps in this town it is (1-based). Finishing the town adds parts.
export function helpPrize(level: number, shopLevel: number, nth: number) {
  const t = HELP_TABLE
  return {
    coins: t.coins + t.coinsPerLevel * level + t.coinsPerShopLevel * (Math.max(1, Math.min(10, shopLevel)) - 1),
    xp: t.xp + t.xpPerFiveLevels * Math.floor(level / 5),
    parts: nth === t.perTown ? t.lastParts : 0,
  }
}

// The shops that need a hand today: a few picked from the town by its owner and the date, so the
// town isn't covered in bubbles and the picks change every day. (The server takes help at any
// business; this only chooses which ones ask.)
export const ASKING = 8
export function askingForHelp<T extends { uid: string }>(shops: T[], ownerId: string, day: string): T[] {
  if (shops.length <= ASKING) return shops
  const hash = (t: string) => {
    let h = 2166136261
    for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619)
    return h >>> 0
  }
  return [...shops].sort((a, b) => hash(`${ownerId}:${day}:${a.uid}`) - hash(`${ownerId}:${day}:${b.uid}`)).slice(0, ASKING)
}

// How you lend a hand at each kind of business: the badge icon and the thank-you.
const ACTS: [RegExp, string, string][] = [
  [/wash/, '🧽', 'scrubbed cars'],
  [/tires|lube|bodyshop|tuner|parts|muffler|brakes|wraps|dynolab|engines|racefab/, '🔧', 'fixed a car'],
  [/gas/, '⛽', 'pumped gas'],
  [/pizza|burger|donut|icecream|diner|tacos|hotdog|coffee/, '🍔', 'served customers'],
  [/cinema|bowling|arcade|club|stadium|minigolf|funfair|waterpark|haunted/, '🎟️', 'sold tickets'],
  [/pool/, '🛟', 'kept watch at the pool'],
  [/laundry/, '🧺', 'folded laundry'],
  [/vet/, '🐾', 'walked the dogs'],
  [/postoffice/, '📮', 'sorted the mail'],
  [/library/, '📚', 'shelved books'],
  [/busdepot/, '🚌', 'washed the buses'],
  [/cityhall/, '📋', 'filed the paperwork'],
  [/motel|hotel/, '🛏️', 'made the beds'],
  [/school|academy|university/, '📚', 'helped in class'],
  [/hospital|firehouse|police/, '🩹', 'lent a hand'],
  [/market/, '🛒', 'stocked shelves'],
  [/offices|hq|glasstower|helipad/, '📋', 'sorted the mail'],
]
export function helpAct(id: string): { icon: string; did: string } {
  for (const [re, icon, did] of ACTS) if (re.test(id)) return { icon, did }
  return { icon: '🧹', did: 'tidied up' }
}
