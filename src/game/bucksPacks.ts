// Gem packs sold in the Bank. Kept apart from data.ts so the checkout function can price a
// pack on the server without bundling the game.
//
// Packs are meant to feel worth buying: gems per dollar climb from about 150 to 225, and each pack
// buys something real. Gems were rescaled x10 on 2026-10-16 (Kegan): prices x10, free payouts x15.
// Handful = three Gold Crates and a refill, Stack = three Diamond Crates, Bag = the first gem car (400)
// and five Diamond Crates, Vault = the 400, 700 and 1000 gem cars and more, Truckload = every gem car.
// Cars stay level-gated, so gems never skip a level.
// The coins and parts grow with the buyer's level, the way everything else they earn does: coins are
// worth `coinGems` gems at that level (gemCoins), parts grow 10% a level like building parts payouts.
// Checkout stamps the buyer's level on the Stripe session, so the webhook grants what the shop showed.
export type BucksPack = {
  id: string; name: string; price: number; bucks: number; bonus: number; coinGems?: number; parts?: number; tag?: string; art: string
  // Car packs: the car it brings (a CARS id). One per account. Super packs sit in their own row.
  car?: string; tier?: 'super'
}
export const BUCKS_PACKS: BucksPack[] = [
  { id: 'handful', name: 'Handful of Gems', price: 1.99, bucks: 200, bonus: 100, art: '💎' },
  { id: 'stack', name: 'Stack of Gems', price: 4.99, bucks: 500, bonus: 300, coinGems: 30, art: '💎💎' },
  { id: 'bag', name: 'Bag of Gems', price: 9.99, bucks: 1000, bonus: 750, coinGems: 100, parts: 15, tag: 'Most popular', art: '💰' },
  { id: 'vault', name: 'Vault of Gems', price: 19.99, bucks: 2000, bonus: 1750, coinGems: 250, parts: 40, art: '🏦' },
  { id: 'truck', name: 'Truckload of Gems', price: 49.99, bucks: 5000, bonus: 5000, coinGems: 700, parts: 120, art: '🚚' },
  { id: 'tanker', name: 'Golden Tanker', price: 99.99, bucks: 10000, bonus: 12500, coinGems: 1600, parts: 300, tag: 'Best value', art: '🏆' },
]

// Car packs, one of each per account, on sale at any level (Kegan chose no level lock, 2026-10-15).
// Every pack is a pack-only car (Kegan, 2026-10-15). Street packs: plain sports and muscle cars, PI 50-99.
// Super and hyper packs: pack-only cars above the Showroom (supercars from PI 100, hypercars from 115).
export const CAR_PACKS: BucksPack[] = [
  { id: 'car-scatto', name: 'Scatto Pack', price: 2.99, bucks: 400, bonus: 0, car: 'scatto', art: '🚗' },
  { id: 'car-stinger', name: 'Stinger Pack', price: 4.99, bucks: 800, bonus: 0, car: 'stinger', art: '🚗' },
  { id: 'car-thunderjet', name: 'Thunderjet Pack', price: 5.99, bucks: 950, bonus: 0, car: 'thunderjet', art: '🚗' },
  { id: 'car-sora', name: 'Sora Pack', price: 7.99, bucks: 1300, bonus: 0, car: 'sora', art: '🚗' },
  { id: 'car-hayate', name: 'Hayate Pack', price: 9.99, bucks: 1750, bonus: 0, car: 'hayate', art: '🚗' },
  { id: 'car-kestrel', name: 'Kestrel Pack', price: 12.99, bucks: 2350, bonus: 0, car: 'kestrel', art: '🚗' },
  { id: 'car-firebolt', name: 'Hot Rod Pack', price: 14.99, bucks: 2750, bonus: 0, car: 'firebolt', art: '🔥', tier: 'super' },
  { id: 'car-kaze', name: 'Time Attack Pack', price: 19.99, bucks: 3750, bonus: 0, car: 'kaze', art: '🏁', tier: 'super' },
  { id: 'car-sturm', name: 'Rally Legend Pack', price: 29.99, bucks: 6000, bonus: 0, car: 'sturm', art: '🏔️', tier: 'super' },
  { id: 'car-vanta', name: 'Hypercar Pack', price: 49.99, bucks: 10000, bonus: 0, car: 'vanta', tag: 'Fastest car', art: '⚡', tier: 'super' },
]
export const ALL_PACKS = [...BUCKS_PACKS, ...CAR_PACKS]
// Car packs no longer sold (Showroom cars, replaced by pack-only cars 2026-10-16). A checkout opened
// on the old site and paid after a deploy still has to deliver, so the webhook keeps knowing them.
export const RETIRED_PACKS: BucksPack[] = [
  { id: 'car-brawler', name: 'Brawler Pack', price: 2.99, bucks: 150, bonus: 0, car: 'charger', art: '🚗' },
  { id: 'car-ronin', name: 'Ronin Pack', price: 5.99, bucks: 300, bonus: 0, car: 'gtr', art: '🚗' },
  { id: 'car-ring', name: 'Ring V10 Pack', price: 9.99, bucks: 500, bonus: 0, car: 'ringmeister', art: '🚗' },
  { id: 'car-hyperion', name: 'Hyperion Pack', price: 12.99, bucks: 650, bonus: 0, car: 'hyper', art: '🚗' },
]

// Roughly what a gem buys at this level, in coins (half a fuel's worth of jobs; a tenth of the
// pre-2026-10-16 rate, when gems went x10).
export const GEM_COINS = { base: 30, perLevel: 10 }
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
