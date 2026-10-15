// Crates: bought with coins (Street, Garage) or gems (Gold, Diamond). Each holds one prize:
// coins, a part for one of your cars, a car, or a body or part skin. Every car and part has one
// home crate, picked by what it's worth (see homeCrate), so dearer crates hold dearer cars and
// parts. Cars only come once your level has unlocked them, so a crate never skips a level gate. A signed-in player's crates are
// rolled by the server (crate_open(), newest copy in supabase/migrations/0085_crate_value_fixes.sql, same tables and
// rules); guests roll here. crates.test.ts keeps the server's tables in step.
import { CARS, CUSTOM_PAINT, carLevel, CUSTOM_PAINT_CRATE, MODS, MOD_SKINS, SKINS, carDef, hasCustomPaint, ownedSkins, modDef, modFits, ownedMods, type CarDef, type ModDef, type SkinDef, type SkinTier } from './data'
import { PIECE_COUNT, PIECE_SOURCES, pieceId, piecePool } from './resto'
import { crateHats, hatDef } from './hats'
import { GEM_COINS, gemCoins } from './bucksPacks'

export type CrateId = 'street' | 'garage' | 'gold' | 'diamond'
// piece: a resto-mod piece (game/resto.ts).
export type CrateOdds = { coins: number; jackpot: number; mod: number; car: number; skin: number; piece: number }

export type CrateDef = {
  id: CrateId
  name: string
  pay: 'coins' | 'bucks'
  unlockLevel: number
  // Price: base + perLevel x level (coins), or a flat gem price. A coin crate stops getting
  // dearer at priceCap: its prizes stop growing long before, so a dearer crate was a worse deal.
  base: number
  perLevel: number
  priceCap?: number
  // Weights out of 100. The car weight is the most it can be: see crateOdds.
  odds: CrateOdds
  // The most the car slice is worth, as a share of the crate.
  carShare: number
  // Coin prizes as a share of what the crate is worth (see crateValue).
  coinMult: [number, number]
  jackpotMult: [number, number]
  // The dearest car and part (by carWorth / modWorth) whose home is this crate; the top crate
  // has no limit. Gem-priced cars and parts only live in gem crates.
  carMax?: number
  modMax?: number
  // Which skin tiers it can hold (body and part skins alike).
  skins: SkinTier[]
  // Bad-luck protection: after every - 1 opens in a row without a skin (of `tier`, if set), the
  // next open is one. The crate shows how many opens are left.
  pity?: { every: number; tier?: SkinTier }
  // Look of the crate in the depot.
  look: { wood: string; band: string; glow: string }
}

export const CRATES: CrateDef[] = [
  {
    id: 'street', name: 'Street Crate', pay: 'coins', unlockLevel: 1, base: 300, perLevel: 120, priceCap: 15,
    odds: { coins: 56, jackpot: 6, mod: 28, car: 10, skin: 0, piece: 0 }, carShare: 0.12, coinMult: [0.5, 1], jackpotMult: [2, 3],
    carMax: 10000, modMax: 2500, skins: [], look: { wood: '#b7844f', band: '#5d6670', glow: '#64b5f6' },
  },
  {
    id: 'garage', name: 'Garage Crate', pay: 'coins', unlockLevel: 1, base: 1500, perLevel: 500, priceCap: 30,
    odds: { coins: 40.9, jackpot: 8, mod: 31, car: 16, skin: 4, piece: 0.1 }, carShare: 0.15, coinMult: [0.45, 0.85], jackpotMult: [2, 3],
    carMax: 40000, modMax: 10000, skins: ['rare', 'epic'], look: { wood: '#2e7d4f', band: '#cfd8dc', glow: '#69f0ae' },
  },
  {
    id: 'gold', name: 'Gold Crate', pay: 'bucks', unlockLevel: 1, base: 8, perLevel: 0,
    odds: { coins: 33.95, jackpot: 6, mod: 30, car: 20, skin: 10, piece: 0.05 }, carShare: 0.15, coinMult: [0.45, 0.85], jackpotMult: [2, 3],
    carMax: 130000, modMax: 15000, skins: ['rare', 'epic', 'legendary'], pity: { every: 8 }, look: { wood: '#d4a017', band: '#7a4b12', glow: '#ffd54f' },
  },
  {
    id: 'diamond', name: 'Diamond Crate', pay: 'bucks', unlockLevel: 1, base: 25, perLevel: 0,
    odds: { coins: 23.9, jackpot: 6, mod: 24, car: 32, skin: 14, piece: 0.1 }, carShare: 0.2, coinMult: [0.7, 1.1], jackpotMult: [2.5, 3.5],
     skins: ['epic', 'legendary'], pity: { every: 10, tier: 'legendary' }, look: { wood: '#4fc3f7', band: '#e1f5fe', glow: '#b388ff' },
  },
]

export const crateDef = (id: string) => CRATES.find((c) => c.id === id)

// Roughly what a gem buys at this level, in coins. Lives with the gem packs, which scale by it too.
export { GEM_COINS, gemCoins }
export const cratePrice = (c: CrateDef, level: number) => c.base + c.perLevel * Math.min(level, c.priceCap ?? level)
export const crateCost = (c: CrateDef, level: number) =>
  c.pay === 'coins' ? { coins: cratePrice(c, level), bucks: 0 } : { coins: 0, bucks: cratePrice(c, level) }
// What a crate is worth in coins: its coin price, or its gems at gemCoins.
export const crateValue = (c: CrateDef, level: number) => (c.pay === 'coins' ? cratePrice(c, level) : cratePrice(c, level) * gemCoins(level))

export const carValue = (car: CarDef, level: number) => car.price + (car.bucks ?? 0) * gemCoins(level)

// What a car or part is worth in coins, which picks its home crate: its price, with parts at 50
// coins each and gems at what a gem buys at the level it unlocks.
export const PART_COINS = 50
export const carWorth = (car: CarDef) => car.price + (car.bucks ?? 0) * gemCoins(car.unlockLevel)
export const modWorth = (m: ModDef) => m.coins + m.parts * PART_COINS + m.bucks * gemCoins(m.unlockLevel)

// The home crate: the cheapest one (CRATES runs cheapest first) whose limit it fits under, and a
// gem crate for anything priced in gems. New cars and parts sort themselves in. Season prize cars
// stay out of crates, like event skins: they're only won on the season track.
const home = (worth: number, gems: boolean, max: (c: CrateDef) => number | undefined): CrateId =>
  CRATES.find((c) => (!gems || c.pay === 'bucks') && worth <= (max(c) ?? Infinity))!.id
export const carCrate = (car: CarDef): CrateId | null => (car.parked || car.season || car.secret || car.pack ? null : home(carWorth(car), !!car.bucks, (c) => c.carMax))
export const modCrate = (m: ModDef): CrateId => home(modWorth(m), m.bucks > 0, (c) => c.modMax)
export const homeCars = (c: CrateDef) => CARS.filter((car) => carCrate(car) === c.id)
export const homeMods = (c: CrateDef) => MODS.filter((m) => modCrate(m) === c.id)

// The next crate down. When none of a crate's own cars (or parts) are in reach yet, it gives the
// ones from the crate below instead, so a Diamond Crate at level 10 still holds cars.
export const crateBelow = (c: CrateDef): CrateDef | undefined => CRATES[CRATES.indexOf(c) - 1]

// Cars a crate can hold at this level: its own cars your level has reached (carLevel: a Rusty-only
// classic waits for the first search spot that finds it).
export function crateCars(c: CrateDef, level: number): CarDef[] {
  const cars = homeCars(c).filter((car) => carLevel(car) <= level)
  const below = crateBelow(c)
  return cars.length || !below ? cars : crateCars(below, level)
}

// The chance of each car among the car prizes: cheaper cars are likelier (weight 1 / value).
export function carOdds(c: CrateDef, level: number): { model: string; p: number }[] {
  const cars = crateCars(c, level)
  const total = cars.reduce((a, car) => a + 1 / carValue(car, level), 0)
  return cars.map((car) => ({ model: car.id, p: 1 / carValue(car, level) / total }))
}

// Skins a crate can hold: every body skin (SKINS) and part skin (MOD_SKINS) of its tiers, so a new
// skin joins the crates as soon as it's added there. Rarer tiers are less likely. Weekly event
// skins (game/events.ts) are the exception: they're only won by clearing their event. So are
// skins a level hands out: everyone past it has one, so in a crate it could only pay coins.
// Custom Colour (CUSTOM_PAINT) rides in one crate's paint slice as a body skin of its tier.
// Weekly event skins and level skins never go in crates.
function inCrates(d: SkinDef) {
  return !('event' in d.unlock) && !('level' in d.unlock)
}
export const SKIN_WEIGHT: Record<SkinTier, number> = { rare: 6, epic: 3, legendary: 1 }
export type CrateSkin = { id: string; part: boolean; def: SkinDef }
export function crateSkins(c: CrateDef): CrateSkin[] {
  const all = [...SKINS.map((def) => ({ id: def.id, part: false, def })), ...MOD_SKINS.map((def) => ({ id: def.id, part: true, def }))]
  if (c.id === CUSTOM_PAINT_CRATE) all.push({ id: CUSTOM_PAINT.id, part: false, def: CUSTOM_PAINT })
  return all.filter((x) => c.skins.includes(x.def.tier) && inCrates(x.def))
}
export function skinOdds(c: CrateDef): (CrateSkin & { p: number })[] {
  const list = crateSkins(c)
  const total = list.reduce((a, x) => a + SKIN_WEIGHT[x.def.tier], 0)
  return list.map((x) => ({ ...x, p: SKIN_WEIGHT[x.def.tier] / total }))
}
// What a skin you already have turns into, by tier, as a share of the crate's worth.
export const SKIN_DUPE: Record<SkinTier, number> = { rare: 0.6, epic: 1, legendary: 1.5 }
// Skins the player already has, body and part (from ownedSkins / ownedModSkins in data.ts), and hats.
// pieces: resto-mod pieces held ("model:piece"; the server counts its own ledger).
export type OwnedSkins = { skins: string[]; modSkins: string[]; hats?: string[]; pieces?: string[] }
// The body skins a crate counts as yours: ownedSkins plus Custom Colour once won.
export const crateOwnedSkins = (s: Parameters<typeof ownedSkins>[0]) => [...ownedSkins(s), ...(hasCustomPaint(s) ? [CUSTOM_PAINT.id] : [])]

// What a piece you already have turns into, as a share of the crate's worth.
export const PIECE_DUPE = 1

// Hats (game/hats.ts crateHats): a slice of each crate, out of 100 like CrateOdds, taken from its
// coin prizes. Only hats the player doesn't have drop; with none left it stays coins. The server
// rolls the same slice (crateTables() hat and hats).
export const HAT_ODDS: Record<CrateId, number> = { street: 3, garage: 4, gold: 6, diamond: 8 }

type CarLike = { uid: string; model: string; mods?: string[] | null; ownedMods?: string[] | null }

// Parts a crate could give: for each of your cars, the crate's own parts that fit it, that your
// level has unlocked and that the car doesn't already have. With none left, the crate below's.
export function modChoices(c: CrateDef, level: number, cars: CarLike[]): { car: string; mods: string[] }[] {
  const own = homeMods(c).filter((m) => m.unlockLevel <= level)
  const out: { car: string; mods: string[] }[] = []
  for (const car of cars) {
    const def = carDef(car.model)
    if (def.parked) continue
    const have = ownedMods(car)
    const mods = own.filter((m) => modFits(m, def.body) && !have.includes(m.id)).map((m) => m.id)
    if (mods.length) out.push({ car: car.uid, mods })
  }
  const below = crateBelow(c)
  return out.length || !below ? out : modChoices(below, level, cars)
}

const roundCoins = (n: number) => Math.max(10, Math.round(n / 10) * 10)

// What a duplicate car turns into: 40% of its value, kept between half and 1.5x the crate's worth.
export const dupeCoins = (c: CrateDef, level: number, car: CarDef) => {
  const v = crateValue(c, level)
  return roundCoins(Math.min(v * 1.5, Math.max(v * 0.5, carValue(car, level) * 0.4)))
}

export type CrateDrop =
  | { kind: 'coins'; coins: number; jackpot: boolean }
  | { kind: 'car'; model: string; uid: string; color: string }
  | { kind: 'dupe'; model: string; coins: number }
  | { kind: 'mod'; car: string; mod: string }
  | { kind: 'skin'; skin: string; part: boolean }
  | { kind: 'skindupe'; skin: string; part: boolean; coins: number }
  | { kind: 'hat'; hat: string }
  // A resto-mod piece (0-3); the fourth one comes with the built car's uid and colour.
  | { kind: 'piece'; model: string; piece: number; uid?: string; color?: string }
  | { kind: 'piecedupe'; model: string; piece: number; coins: number }
// `crate` is the crate opened, or another reward that hands out crate drops (the daily wheel,
// a resto-mod piece from Rusty's Old Race Track).
export type CrateOpen = { seq?: number; crate: CrateId | 'wheel' | 'rusty_track'; cost: { coins: number; bucks: number }; drop: CrateDrop }

const newUid = (rand: () => number) => 'k' + Array.from({ length: 14 }, () => Math.floor(rand() * 36).toString(36)).join('')

function pickWeighted<T>(items: T[], weight: (t: T) => number, rand: () => number): T {
  const total = items.reduce((a, t) => a + weight(t), 0)
  let r = rand() * total
  for (const t of items) {
    r -= weight(t)
    if (r <= 0) return t
  }
  return items[items.length - 1]
}

export const skinOf = (id: string, part: boolean) => (part ? MOD_SKINS : [...SKINS, CUSTOM_PAINT]).find((x) => x.id === id)

// Opens left until the pity prize, given how many opens in a row missed it (null: no pity).
export const pityLeft = (c: CrateDef, dry: number) => (c.pity ? Math.max(1, c.pity.every - dry) : null)
// Whether a prize counts as the pity prize, which starts the count again.
export function pityHit(c: CrateDef, d: CrateDrop) {
  if (!c.pity || (d.kind !== 'skin' && d.kind !== 'skindupe')) return false
  return !c.pity.tier || skinOf(d.skin, d.part)?.tier === c.pity.tier
}

// One resto-mod piece: a random piece of a car the level has unlocked and you haven't built.
// One you hold pays `dupeCoins`; the last missing one builds the car. Null when no car is in
// reach. Crates roll it for their piece slice; other rewards (Rusty's top zone) can too, and
// hand the drop to applyCrate() (signed-in players get it from the server's piece_grant()).
export function rollPiece(level: number, cars: { model: string }[], have: readonly string[], rand: () => number, dupeCoins: number): Extract<CrateDrop, { kind: 'piece' | 'piecedupe' }> | null {
  const pool = piecePool(level, { cars })
  if (!pool.length) return null
  const car = pool[Math.floor(rand() * pool.length)]
  const piece = Math.floor(rand() * PIECE_COUNT)
  if (have.includes(pieceId(car.id, piece))) return { kind: 'piecedupe', model: car.id, piece, coins: dupeCoins }
  const done = Array.from({ length: PIECE_COUNT }, (_, i) => i).every((i) => i === piece || have.includes(pieceId(car.id, i)))
  if (!done) return { kind: 'piece', model: car.id, piece }
  return { kind: 'piece', model: car.id, piece, uid: newUid(rand), color: car.colors[Math.floor(rand() * car.colors.length)] }
}

// A piece from a reward outside crates (PIECE_SOURCES), for guests: null most goes. Hand a drop
// to applyCrate() with no seq; signed-in players get theirs from econ_private.resto_piece_roll().
export function rollSourcePiece(source: string, level: number, cars: { model: string }[], have: readonly string[], rand: () => number = Math.random) {
  const src = PIECE_SOURCES[source]
  if (!src || rand() >= src.odds) return null
  return rollPiece(level, cars, have, rand, src.dupe)
}

// Rolls one crate for a player at this level with these cars and skins. A part with nothing left
// to fit, or a car prize with no cars in reach, becomes a coin prize instead; a car or skin the
// player already has turns into coins. `dry` opens in a row without the pity prize make the next
// one it when pityLeft reaches 1.
export function rollCrate(c: CrateDef, level: number, cars: CarLike[], rand: () => number = Math.random, owned: OwnedSkins = { skins: [], modSkins: [] }, dry = 0): CrateDrop {
  const v = crateValue(c, level)
  const kinds = Object.entries(crateOdds(c, level)) as [keyof CrateOdds, number][]
  const pity = pityLeft(c, dry) === 1
  let kind = pity ? 'skin' : pickWeighted(kinds, (k) => k[1], rand)[0]
  if (kind === 'mod') {
    const choices = modChoices(c, level, cars)
    if (choices.length) {
      const pick = choices[Math.floor(rand() * choices.length)]
      return { kind: 'mod', car: pick.car, mod: pick.mods[Math.floor(rand() * pick.mods.length)] }
    }
    kind = 'coins'
  }
  if (kind === 'piece') {
    const d = rollPiece(level, cars, owned.pieces ?? [], rand, roundCoins(v * PIECE_DUPE))
    if (d) return d
    kind = 'coins'
  }
  if (kind === 'skin') {
    const pool = crateSkins(c).filter((x) => !pity || !c.pity?.tier || x.def.tier === c.pity.tier)
    if (pool.length) {
      const x = pickWeighted(pool, (y) => SKIN_WEIGHT[y.def.tier], rand)
      if ((x.part ? owned.modSkins : owned.skins).includes(x.id)) return { kind: 'skindupe', skin: x.id, part: x.part, coins: roundCoins(v * SKIN_DUPE[x.def.tier]) }
      return { kind: 'skin', skin: x.id, part: x.part }
    }
    kind = 'coins'
  }
  if (kind === 'car') {
    const pool = crateCars(c, level)
    if (pool.length) {
      const car = pickWeighted(pool, (x) => 1 / carValue(x, level), rand)
      if (cars.some((o) => o.model === car.id)) return { kind: 'dupe', model: car.id, coins: dupeCoins(c, level, car) }
      return { kind: 'car', model: car.id, uid: newUid(rand), color: car.colors[Math.floor(rand() * car.colors.length)] }
    }
    kind = 'coins'
  }
  if (kind === 'coins') {
    const hats = crateHats(c.id).filter((h) => !(owned.hats ?? []).includes(h.id))
    const coinW = crateOdds(c, level).coins
    if (hats.length && rand() * coinW < HAT_ODDS[c.id]) return { kind: 'hat', hat: hats[Math.floor(rand() * hats.length)].id }
  }
  const [lo, hi] = kind === 'jackpot' ? c.jackpotMult : c.coinMult
  return { kind: 'coins', coins: roundCoins(v * (lo + (hi - lo) * rand())), jackpot: kind === 'jackpot' }
}


// How exciting a prize is, for the reveal's glow: 0 coins, 1 a jackpot or part, 2 a gem part or a
// new rare or epic skin or a hat, 3 a new car, legendary skin or crate-only hat.
export function dropTier(d: CrateDrop): 0 | 1 | 2 | 3 {
  if (d.kind === 'car') return 3
  if (d.kind === 'piece') return d.uid ? 3 : 2
  if (d.kind === 'hat') return hatDef(d.hat)?.challenge ? 2 : 3
  if (d.kind === 'skin') return skinOf(d.skin, d.part)?.tier === 'legendary' ? 3 : 2
  if (d.kind === 'mod') return modDef(d.mod)?.bucks ? 2 : 1
  if (d.kind === 'coins' && d.jackpot) return 1
  return 0
}

// The order a ×10 open shows its prizes in: plain coins first, the rarest last (by dropTier, then
// cars over paints over hats over pieces over parts over jackpots over coins back for something
// already yours, then the bigger coin win). Ties keep the order they were opened in.
const KIND_RANK: Record<CrateDrop['kind'], number> = { coins: 0, dupe: 1, skindupe: 1, piecedupe: 1, mod: 3, piece: 4, hat: 5, skin: 6, car: 7 }
export function revealOrder<T extends { drop: CrateDrop }>(opens: T[]): T[] {
  const rank = (d: CrateDrop) => dropTier(d) * 100 + KIND_RANK[d.kind] * 10 + (d.kind === 'coins' && d.jackpot ? 5 : 0)
  const won = (d: CrateDrop) => ('coins' in d ? d.coins : 0)
  return opens.map((o, i) => ({ o, i })).sort((a, b) => rank(a.o.drop) - rank(b.o.drop) || won(a.o.drop) - won(b.o.drop) || a.i - b.i).map((x) => x.o)
}

// The odds a crate rolls from at this level. Cars are worth more than the crate, so the car slice
// shrinks until it's worth no more than carShare of the crate (cars dear next to the crate are
// rarer), and what it loses goes to coins. Each car's value is weighed at 1 / value (carOdds), so
// a car slice's average car is worth n / sum(1 / value).
export function crateOdds(c: CrateDef, level: number): CrateOdds {
  const pool = crateCars(c, level)
  if (!pool.length) return c.odds
  const avg = pool.length / pool.reduce((a, car) => a + 1 / carValue(car, level), 0)
  const car = Math.min(c.odds.car, Math.floor((1000 * c.carShare * crateValue(c, level)) / avg) / 10)
  return { ...c.odds, coins: c.odds.coins + c.odds.car - car, car }
}

// The odds as a player sees them: coins (with jackpots), hats, parts, cars and skins, in whole
// percent (cars to a tenth below 1%, resto-mod pieces to a hundredth). Hats come out of the coin
// slice (HAT_ODDS), so pass `hats` false once the player has every hat the crate holds.
export function crateOddsShown(c: CrateDef, level: number, hats = true) {
  const o = crateOdds(c, level)
  const t = o.coins + o.jackpot + o.mod + o.car + o.skin + o.piece
  const pc = (n: number) => Math.round((n / t) * 100)
  const car = (o.car / t) * 100
  const hat = hats && crateHats(c.id).length ? HAT_ODDS[c.id] : 0
  return { coins: pc(o.coins + o.jackpot - hat), hat: pc(hat), mod: pc(o.mod), car: car < 1 ? Math.round(car * 10) / 10 : Math.round(car), skin: pc(o.skin), piece: Math.round((o.piece / t) * 10000) / 100 }
}


// The tables crate_open() rolls from, as embedded in the server's SQL.
export function crateTables() {
  return {
    crates: Object.fromEntries(CRATES.map((c) => [c.id, {
      pay: c.pay, unlock: c.unlockLevel, base: c.base, perLevel: c.perLevel, ...(c.priceCap ? { priceCap: c.priceCap } : {}), odds: c.odds,
      carShare: c.carShare, coinMult: c.coinMult, jackpotMult: c.jackpotMult, skins: c.skins, below: crateBelow(c)?.id ?? null,
      ...(c.pity ? { pity: c.pity } : {}),
      // The hat slice (out of 100, taken from coins) and the hats it can give, in HATS order.
      hat: HAT_ODDS[c.id], hats: crateHats(c.id).map((h) => h.id),
    }])),
    // Body skins by id, part skins by id: tier, and the level or collection set that also unlocks one.
    skinWeight: SKIN_WEIGHT,
    skinDupe: SKIN_DUPE,
    // Custom Colour drops only from its own crate (`only`).
    skins: Object.fromEntries([...SKINS.filter(inCrates).map((d) => [d.id, skinRow(d)]), [CUSTOM_PAINT.id, { ...skinRow(CUSTOM_PAINT), only: CUSTOM_PAINT_CRATE }]]),
    modSkins: Object.fromEntries(MOD_SKINS.filter(inCrates).map((d) => [d.id, skinRow(d)])),
    gem: GEM_COINS,
    pieceDupe: PIECE_DUPE,
    pieces: PIECE_COUNT,
    // Every car's body (parts are rolled for any car you own); `crate` is its home crate, if any.
    // A crate rolls from its own cars or parts, and from `below` when none are in reach.
    cars: Object.fromEntries(CARS.map((car) => [car.id, {
      body: car.body, crate: carCrate(car), unlock: carLevel(car), price: car.price, bucks: car.bucks ?? 0, colors: car.colors,
      ...(car.secret ? { secret: true } : {}),
    }])),
    mods: Object.fromEntries(MODS.map((m) => [m.id, {
      crate: modCrate(m), unlock: m.unlockLevel, ...(m.only ? { only: m.only } : {}), ...(m.notOn ? { notOn: m.notOn } : {}),
    }])),
  }
}

function skinRow(d: SkinDef) {
  const u = d.unlock
  return { tier: d.tier, ...('level' in u ? { level: u.level } : {}), ...('set' in u ? { set: u.set } : {}) }
}
