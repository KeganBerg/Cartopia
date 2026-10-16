// Endless goals: made up on the spot from what the player has, so the Goals list never runs dry.
// They fill the Goals tab next to the story goals (which come first), scale with level, and point at
// the player's own buildings and cars. The server guard pays each one from ENDLESS_PAY by its number
// and the save's level, at most ENDLESS_PAY.perDay a UTC day (econ_private.endless_pay()).
import {
  BUILDINGS, MAX_UPGRADE, UPGRADE_SLOTS, buildingDef, buildingLevel, carDef, dayKey, maxLevel, performance, takesDriver, upgradable, xpToNext,
  type CounterKey, type StatKey, type UpgradeSlot,
} from './data'

export type EndlessKind =
  | 'jobs' | 'coins' | 'races' | 'wins' | 'campaign' | 'search' | 'service' | 'upgrades' | 'mods' | 'paint' | 'gp'
  | 'stars' | 'build' | 'bldgUp' | 'carUp' | 'cars' | 'land' | 'drivers' | 'level'
// k: the goal's number over the town's life (1, 2, 3...). Progress is the stat less `base`, toward n.
// def: the building (build, bldgUp) or car uid (carUp) it's about.
export type EndlessGoal = { k: number; kind: EndlessKind; n: number; base: number; def?: string }
// n: endless goals collected ever; today: collected on `day` (UTC); goals: the ones on the board now;
// last: the kind collected last, so the next draw is something else; drawn: the last k handed out.
export type Endless = { n: number; day: string; today: number; goals: EndlessGoal[]; last?: EndlessKind; drawn?: number }

// What each one pays. The 5th, 10th, 15th... collected also pays parts, and every 10th gems.
// The guard reads these from econ_private.endless_pay(), which endless.test.ts checks against the migration.
export const ENDLESS_PAY = { coins: 200, coinsPerLevel: 60, xp: 25, xpPerLevel: 6, parts: 5, partsEvery: 5, bucks: 1, bucksEvery: 10, perDay: 12 }
// num: which endless goal this is to be collected, counting from 1 over the town's life.
export const endlessPay = (num: number, level: number) => ({
  coins: ENDLESS_PAY.coins + ENDLESS_PAY.coinsPerLevel * level,
  xp: ENDLESS_PAY.xp + ENDLESS_PAY.xpPerLevel * level,
  parts: num % ENDLESS_PAY.partsEvery === 0 ? ENDLESS_PAY.parts : 0,
  bucks: num % ENDLESS_PAY.bucksEvery === 0 ? ENDLESS_PAY.bucks : 0,
})

// The town as the goals see it. value() reads a story-goal stat (statValue in the store).
type Car = { uid: string; model: string; upgrades: Record<UpgradeSlot, number>; mods?: string[] }
export type EndlessTown = {
  level: number; xp: number; stats: Partial<Record<CounterKey, number>>; land: string[]; campaign: Record<string, number>
  buildings: { uid: string; def: string; level?: number; car?: string | null }[]; cars: Car[]
  value: (stat: StatKey, def?: string) => number
}

const MAX_PLOTS = 49 // 7x7: the starting 3x3 and two plots out on every side
const ALL_STARS = 105
const carUps = (c: Car) => UPGRADE_SLOTS.reduce((n, sl) => n + (c.upgrades[sl.id] ?? 0), 0)
const step = (v: number, to: number) => Math.max(to, Math.round(v / to) * to)

type Kind = {
  icon: string; weight: number; stat?: CounterKey
  text: (n: number, name: string) => string
  // The target and starting point, or null when it doesn't fit this town right now.
  make: (t: EndlessTown, rand: () => number) => { n: number; base?: number; def?: string } | null
}
const counter = (stat: CounterKey, n: (l: number) => number, ok: (t: EndlessTown) => boolean = () => true) =>
  (t: EndlessTown) => (ok(t) ? { n: n(t.level), base: t.stats[stat] ?? 0 } : null)
const owns = (t: EndlessTown, ...defs: string[]) => t.buildings.some((b) => defs.includes(b.def))
const pick = <T,>(xs: T[], rand: () => number) => xs[Math.floor(rand() * xs.length)]

export const KINDS: Record<EndlessKind, Kind> = {
  jobs: { icon: '🍕', weight: 3, stat: 'jobs', text: (n) => `Collect from ${n} businesses`,
    make: counter('jobs', (l) => Math.min(50, step(5 + l, 5)), (t) => t.buildings.some((b) => buildingDef(b.def).jobSeconds)) },
  coins: { icon: '💰', weight: 3, stat: 'coinsEarned', text: (n) => `Earn ${n.toLocaleString()} coins`, make: counter('coinsEarned', (l) => step(1000 + 500 * l, 500)) },
  races: { icon: '🏁', weight: 3, stat: 'races', text: (n) => `Race ${n} times`, make: counter('races', (l) => 3 + Math.floor(l / 10)) },
  wins: { icon: '🏆', weight: 3, stat: 'racesWon', text: (n) => `Win ${n} races`, make: counter('racesWon', (l) => 2 + Math.floor(l / 10)) },
  campaign: { icon: '🗺', weight: 2, stat: 'campaignWins', text: (n) => `Win ${n} campaign races`, make: counter('campaignWins', () => 2) },
  search: { icon: '🔍', weight: 3, stat: 'searches', text: (n) => `Search ${n} times at Rusty's`,
    make: counter('searches', (l) => 2 + Math.floor(l / 15), (t) => owns(t, 'rescue')) },
  service: { icon: '⛽', weight: 2, stat: 'serviced', text: (n) => `Service ${n} stranded cars`,
    make: counter('serviced', (l) => 2 + Math.floor(l / 20), (t) => owns(t, 'gas', 'tires')) },
  upgrades: { icon: '⬆', weight: 2, stat: 'upgrades', text: (n) => `Do ${n} upgrades`, make: counter('upgrades', (l) => 2 + Math.floor(l / 10)) },
  mods: { icon: '🪽', weight: 2, stat: 'modsBought', text: (n) => (n > 1 ? `Fit ${n} car mods` : 'Fit a car mod'),
    make: counter('modsBought', (l) => 1 + Math.floor(l / 25), (t) => t.level >= 3) },
  paint: { icon: '🎨', weight: 1, stat: 'painted', text: () => 'Paint a car', make: counter('painted', () => 1, (t) => t.level >= 2) },
  gp: { icon: '🥇', weight: 1, stat: 'gpWins', text: () => 'Win a Grand Prix series', make: counter('gpWins', () => 1, (t) => t.level >= 2) },
  stars: { icon: '✨', weight: 2, text: (n) => `Earn ${n} campaign stars`,
    make: (t) => {
      const have = t.value('stars')
      return have < ALL_STARS ? { n: Math.min(3, ALL_STARS - have), base: have } : null
    } },
  // A building the player hasn't got yet, among the cheapest few their level allows.
  build: { icon: '🏗', weight: 4, text: (_, name) => `Build a ${name}`,
    make: (t, rand) => {
      const have = new Set(t.buildings.map((b) => b.def))
      const can = BUILDINGS.filter((d) => d.jobSeconds && d.kind !== 'obstacle' && d.price > 0 && !d.bucks && !d.event && !d.wild && !d.parked && d.unlockLevel <= t.level && !have.has(d.id))
        .sort((a, b) => a.price - b.price).slice(0, 3)
      return can.length ? { n: 1, def: pick(can, rand).id } : null
    } },
  // One of the player's own buildings, one level up. Lower ones come up more.
  bldgUp: { icon: '⬆', weight: 4, text: (n, name) => `Upgrade ${name} to level ${n}`,
    make: (t, rand) => {
      const best = new Map<string, number>()
      for (const b of t.buildings) {
        const d = buildingDef(b.def)
        if (upgradable(d) && !d.event) best.set(b.def, Math.max(best.get(b.def) ?? 0, buildingLevel(b)))
      }
      const can = [...best].filter(([def, lv]) => lv < maxLevel(buildingDef(def))).sort((a, b) => a[1] - b[1]).slice(0, 4)
      if (!can.length) return null
      const [def, lv] = pick(can, rand)
      return { n: lv + 1, def }
    } },
  // One of the player's best cars that still has parts to upgrade.
  carUp: { icon: '🔧', weight: 4, text: (n, name) => (n > 1 ? `Upgrade ${name} ×${n}` : `Upgrade ${name}`),
    make: (t, rand) => {
      const can = t.cars.filter((c) => carUps(c) < UPGRADE_SLOTS.length * MAX_UPGRADE)
        .sort((a, b) => performance(carDef(b.model), b.upgrades, b.mods) - performance(carDef(a.model), a.upgrades, a.mods)).slice(0, 3)
      if (!can.length) return null
      const c = pick(can, rand)
      const ups = carUps(c)
      return { n: Math.min(2, UPGRADE_SLOTS.length * MAX_UPGRADE - ups), base: ups, def: c.uid }
    } },
  cars: { icon: '🚗', weight: 2, text: () => 'Get a new car', make: (t) => ({ n: 1, base: t.cars.length }) },
  land: { icon: '🌳', weight: 1, text: () => 'Buy a plot of land', make: (t) => (t.land.length < MAX_PLOTS ? { n: 1, base: t.land.length } : null) },
  drivers: { icon: '🧑‍✈️', weight: 2, text: () => 'Give a business a driver',
    make: (t) => {
      const have = t.value('drivers')
      const seats = t.buildings.filter((b) => takesDriver(buildingDef(b.def))).length
      return seats > have && t.cars.length > have ? { n: 1, base: have } : null
    } },
  // Only once the next level is in sight.
  level: { icon: '⭐', weight: 2, text: (n) => `Reach level ${n}`, make: (t) => (t.xp >= xpToNext(t.level) / 2 ? { n: t.level + 1 } : null) },
}

// How far along a goal is, toward g.n.
export function endlessHave(t: EndlessTown, g: EndlessGoal): number {
  const k = KINDS[g.kind]
  if (!k) return 0
  if (k.stat) return Math.max(0, (t.stats[k.stat] ?? 0) - g.base)
  switch (g.kind) {
    case 'build': return t.value('owns', g.def)
    case 'bldgUp': return t.buildings.reduce((n, b) => (b.def === g.def ? Math.max(n, buildingLevel(b)) : n), 0)
    case 'carUp': {
      const c = t.cars.find((o) => o.uid === g.def)
      return c ? Math.max(0, carUps(c) - g.base) : 0
    }
    case 'cars': return Math.max(0, t.cars.length - g.base)
    case 'land': return Math.max(0, t.land.length - g.base)
    case 'drivers': return Math.max(0, t.value('drivers') - g.base)
    case 'stars': return Math.max(0, t.value('stars') - g.base)
    case 'level': return t.level
    default: return 0
  }
}
export const endlessDone = (t: EndlessTown, g: EndlessGoal) => endlessHave(t, g) >= g.n

// The name in a goal's line: its building, or the car's model.
export function endlessName(g: EndlessGoal, cars: { uid: string; model: string }[]) {
  if (g.kind === 'build' || g.kind === 'bldgUp') return buildingDef(g.def ?? '').name
  if (g.kind === 'carUp') {
    const c = cars.find((o) => o.uid === g.def)
    return c ? carDef(c.model).name : 'your car'
  }
  return ''
}
export const endlessText = (g: EndlessGoal, cars: { uid: string; model: string }[]) => KINDS[g.kind]?.text(g.n, endlessName(g, cars)) ?? ''

// A goal that no longer makes sense: the car was sold or the building it upgrades is gone.
const stale = (t: EndlessTown, g: EndlessGoal) =>
  !KINDS[g.kind] || (g.kind === 'carUp' && !t.cars.some((c) => c.uid === g.def)) || (g.kind === 'bldgUp' && !t.buildings.some((b) => b.def === g.def))

function seeded(seed: number) {
  let h = (seed * 2654435761) >>> 0 || 1
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

// Draws goal number k, unlike the kinds already on the board where it can.
export function drawEndless(t: EndlessTown, k: number, avoid: EndlessKind[] = []): EndlessGoal {
  const rand = seeded(k * 31 + t.level)
  const fits = (skip: EndlessKind[]) => (Object.keys(KINDS) as EndlessKind[]).filter((id) => !skip.includes(id))
  for (const pool of [fits(avoid), fits([])]) {
    const made = pool.map((kind) => ({ kind, m: KINDS[kind].make(t, rand) })).filter((o) => o.m)
    let roll = rand() * made.reduce((n, o) => n + KINDS[o.kind].weight, 0)
    for (const o of made) {
      roll -= KINDS[o.kind].weight
      if (roll <= 0) return { k, kind: o.kind, n: o.m!.n, base: o.m!.base ?? 0, ...(o.m!.def ? { def: o.m!.def } : {}) }
    }
  }
  // Coins can always be earned.
  return { k, kind: 'coins', n: KINDS.coins.make(t, rand)!.n, base: t.stats.coinsEarned ?? 0 }
}

// Endless goals on the board: as many as the story leaves room for in three, and one more from
// level 5 so there's always a fresh one, once the tutorial's done.
export const endlessSlots = (story: number, level: number) => Math.max(3 - story, level >= 5 ? 1 : 0)
export const emptyEndless = (): Endless => ({ n: 0, day: '', today: 0, goals: [] })

// The board topped up to `slots` goals, stale ones swapped out. Null when nothing changed.
export function filledEndless(e: Endless | null | undefined, t: EndlessTown, slots: number): Endless | null {
  const cur = e ?? emptyEndless()
  const kept = cur.goals.filter((g) => !stale(t, g))
  if (kept.length >= slots && kept.length === cur.goals.length) return null
  const goals = [...kept]
  let next = Math.max(cur.drawn ?? 0, cur.n, ...cur.goals.map((g) => g.k)) + 1
  while (goals.length < slots) goals.push(drawEndless(t, next++, [...goals.map((g) => g.kind), ...(cur.last ? [cur.last] : [])]))
  return { ...cur, goals, drawn: next - 1 }
}

// Collected today, counting from 0 on a new UTC day.
export const endlessToday = (e: Endless | null | undefined, now = Date.now()) => (e && e.day === dayKey(now) ? e.today : 0)
export const endlessCapped = (e: Endless | null | undefined, now = Date.now()) => endlessToday(e, now) >= ENDLESS_PAY.perDay
