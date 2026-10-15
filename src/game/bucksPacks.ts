// Gem packs sold in the Bank. Kept apart from data.ts so the checkout function can price a
// pack on the server without bundling the game.
//
// Packs are meant to feel worth buying: gems per dollar climb from 10 to 15, and each pack buys
// something real. Handful = two Gold Crates and a refill, Stack = two Diamond Crates, Bag = the first gem
// car (40) and three Diamond Crates, Vault = the 40, 70 and 100 gem cars, Truckload = every gem car.
// Cars stay level-gated, so gems never skip a level.
// The coins and parts grow with the buyer's level, the way everything else they earn does: coins are
// worth `coinGems` gems at that level (gemCoins), parts grow 10% a level like building parts payouts.
// Checkout stamps the buyer's level on the Stripe session, so the webhook grants what the shop showed.
export type BucksPack = {
  id: string; name: string; price: number; bucks: number; bonus: number; coinGems?: number; parts?: number; tag?: string; art: string
  // Car packs: the pack-only car it brings (a CARS id with `pack: true`) and the level it goes on sale
  // at (the car's unlockLevel; data.test.ts keeps the two in step). One per account.
  car?: string; unlock?: number
}
export const BUCKS_PACKS: BucksPack[] = [
  { id: 'handful', name: 'Handful of Gems', price: 1.99, bucks: 10, bonus: 10, art: '💎' },
  { id: 'stack', name: 'Stack of Gems', price: 4.99, bucks: 25, bonus: 30, coinGems: 3, art: '💎💎' },
  { id: 'bag', name: 'Bag of Gems', price: 9.99, bucks: 50, bonus: 70, coinGems: 10, parts: 15, tag: 'Most popular', art: '💰' },
  { id: 'vault', name: 'Vault of Gems', price: 19.99, bucks: 100, bonus: 160, coinGems: 25, parts: 40, art: '🏦' },
  { id: 'truck', name: 'Truckload of Gems', price: 49.99, bucks: 250, bonus: 450, coinGems: 70, parts: 120, art: '🚚' },
  { id: 'tanker', name: 'Golden Tanker', price: 99.99, bucks: 500, bonus: 1000, coinGems: 160, parts: 300, tag: 'Best value', art: '🏆' },
]

// Car packs: a car you can only get here, a little quicker than the Showroom's best at its level,
// plus gems. On sale once you reach the car's level, so money never skips progression.
export const CAR_PACKS: BucksPack[] = [
  { id: 'car-firebolt', name: 'Hot Rod Pack', price: 4.99, bucks: 25, bonus: 0, car: 'firebolt', unlock: 8, art: '🔥' },
  { id: 'car-kaze', name: 'Time Attack Pack', price: 9.99, bucks: 50, bonus: 0, car: 'kaze', unlock: 15, art: '🏁' },
  { id: 'car-sturm', name: 'Rally Legend Pack', price: 19.99, bucks: 100, bonus: 0, car: 'sturm', unlock: 25, art: '🏔️' },
  { id: 'car-vanta', name: 'Hypercar Pack', price: 49.99, bucks: 250, bonus: 0, car: 'vanta', unlock: 40, tag: 'Fastest car', art: '⚡' },
]
export const ALL_PACKS = [...BUCKS_PACKS, ...CAR_PACKS]

// Roughly what a gem buys at this level, in coins (five fuel's worth of jobs).
export const GEM_COINS = { base: 300, perLevel: 100 }
export const gemCoins = (level: number) => GEM_COINS.base + GEM_COINS.perLevel * level

export const packLevel = (level: unknown) => {
  const n = Math.floor(Number(level))
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 99) : 1
}
// Coins round to 100 under 10,000 and to 500 above, and parts to 5, so every number ends in 5 or 0.
const tidy = (n: number) => (n < 10000 ? Math.round(n / 100) * 100 : Math.round(n / 500) * 500)
export function packGrant(p: BucksPack, level: unknown) {
  const l = packLevel(level)
  return {
    bucks: p.bucks + p.bonus,
    coins: p.coinGems ? tidy(p.coinGems * gemCoins(l)) : 0,
    parts: p.parts ? Math.round((p.parts * (1 + 0.1 * (l - 1))) / 5) * 5 : 0,
  }
}
