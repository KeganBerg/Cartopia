// Gem packs sold in the Bank. Kept apart from data.ts so the checkout function can price a
// pack on the server without bundling the game.
//
// Gem amounts land on the things gems buy: Handful = a Gold Crate and a refill, Stack = a Diamond Crate and a refill,
// Bag = the first gem car (40) and a Diamond Crate, Vault = the 100 and 40 gem cars, Truckload =
// the two legendaries (180 + 220). Cars stay level-gated, so gems never skip a level.
// The coins and parts grow with the buyer's level, the way everything else they earn does: coins are
// worth `coinGems` gems at that level (gemCoins), parts grow 10% a level like building parts payouts.
// Checkout stamps the buyer's level on the Stripe session, so the webhook grants what the shop showed.
export type BucksPack = { id: string; name: string; price: number; bucks: number; bonus: number; coinGems?: number; parts?: number; tag?: string; art: string }
export const BUCKS_PACKS: BucksPack[] = [
  { id: 'handful', name: 'Handful of Gems', price: 1.99, bucks: 10, bonus: 2, art: '💎' },
  { id: 'stack', name: 'Stack of Gems', price: 4.99, bucks: 25, bonus: 7, art: '💎💎' },
  { id: 'bag', name: 'Bag of Gems', price: 9.99, bucks: 50, bonus: 15, coinGems: 5, tag: 'Most popular', art: '💰' },
  { id: 'vault', name: 'Vault of Gems', price: 19.99, bucks: 100, bonus: 40, coinGems: 10, parts: 20, art: '🏦' },
  { id: 'truck', name: 'Truckload of Gems', price: 49.99, bucks: 250, bonus: 150, coinGems: 25, parts: 60, art: '🚚' },
  { id: 'tanker', name: 'Golden Tanker', price: 99.99, bucks: 500, bonus: 350, coinGems: 60, parts: 160, tag: 'Best value', art: '🏆' },
]

// Roughly what a gem buys at this level, in coins (five fuel's worth of jobs).
export const GEM_COINS = { base: 300, perLevel: 100 }
export const gemCoins = (level: number) => GEM_COINS.base + GEM_COINS.perLevel * level

export const packLevel = (level: unknown) => {
  const n = Math.floor(Number(level))
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 99) : 1
}
// Coins round to 100 under 10,000 and to 500 above, so the shop shows tidy numbers.
const tidy = (n: number) => (n < 10000 ? Math.round(n / 100) * 100 : Math.round(n / 500) * 500)
export function packGrant(p: BucksPack, level: unknown) {
  const l = packLevel(level)
  return {
    bucks: p.bucks + p.bonus,
    coins: p.coinGems ? tidy(p.coinGems * gemCoins(l)) : 0,
    parts: p.parts ? Math.round(p.parts * (1 + 0.1 * (l - 1))) : 0,
  }
}
