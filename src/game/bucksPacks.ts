// Gem packs sold in the Bank. Kept apart from data.ts so the checkout function can price a
// pack on the server without bundling the game.
export type BucksPack = { id: string; name: string; price: number; bucks: number; bonus: number; coins?: number; parts?: number; tag?: string; art: string }
export const BUCKS_PACKS: BucksPack[] = [
  { id: 'handful', name: 'Handful of Gems', price: 1.99, bucks: 10, bonus: 0, art: '💎' },
  { id: 'stack', name: 'Stack of Gems', price: 4.99, bucks: 25, bonus: 3, art: '💎💎' },
  { id: 'bag', name: 'Bag of Gems', price: 9.99, bucks: 50, bonus: 10, coins: 2500, tag: 'Most popular', art: '💰' },
  { id: 'vault', name: 'Vault of Gems', price: 19.99, bucks: 100, bonus: 30, coins: 7500, parts: 25, art: '🏦' },
  { id: 'truck', name: 'Truckload of Gems', price: 49.99, bucks: 250, bonus: 100, coins: 25000, parts: 75, art: '🚚' },
  { id: 'tanker', name: 'Golden Tanker', price: 99.99, bucks: 500, bonus: 250, coins: 60000, parts: 200, tag: 'Best value', art: '🏆' },
]
