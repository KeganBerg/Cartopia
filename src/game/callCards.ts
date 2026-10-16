// Call Cards: animated backgrounds a player's car stands on in other players' Quick Race menus.
// Pure looks, no stats. Every player has the Showroom card; the rest only drop from crates, a
// slice of each crate's coin prizes (CALL_ODDS in crates.ts), rarer tiers less likely. Only
// cards the player doesn't have drop, so there are no duplicates; with all of a crate's cards
// owned, that slice stays coins. The server rolls the same (crateTables() callCards) and keeps
// a save's cards to what its crates gave (supabase migration call_cards).
// The looks are CSS loops (src/ui/call-cards.css), cheap enough for six on a phone at once.
import type { CrateId } from './crates'

export type CallCardTier = 'rare' | 'epic' | 'legendary'

export type CallCardDef = {
  id: string
  name: string
  icon: string
  // The starter card has no tier and never drops.
  tier?: CallCardTier
}

export const STOCK_CARD = 'showroom'

export const CALL_CARDS: CallCardDef[] = [
  { id: STOCK_CARD, name: 'Showroom', icon: '💡' },
  { id: 'neonalley', name: 'Neon Alley', icon: '🌃', tier: 'rare' },
  { id: 'raincheck', name: 'Rain Check', icon: '🌧️', tier: 'rare' },
  { id: 'sunsetstrip', name: 'Sunset Strip', icon: '🌅', tier: 'rare' },
  { id: 'checkerrush', name: 'Checker Rush', icon: '🏁', tier: 'rare' },
  { id: 'ravelights', name: 'Rave Lights', icon: '🪩', tier: 'epic' },
  { id: 'warpspeed', name: 'Warp Speed', icon: '💨', tier: 'epic' },
  { id: 'polarglow', name: 'Polar Glow', icon: '🌌', tier: 'epic' },
  { id: 'midnightgrid', name: 'Midnight Grid', icon: '🕹️', tier: 'epic' },
  { id: 'thunderroad', name: 'Thunder Road', icon: '⚡', tier: 'legendary' },
  { id: 'inferno', name: 'Inferno', icon: '🔥', tier: 'legendary' },
  { id: 'starwarp', name: 'Star Warp', icon: '✨', tier: 'legendary' },
  { id: 'goldrush', name: 'Gold Rush', icon: '🏆', tier: 'legendary' },
]

export const TIER_ICON: Record<CallCardTier, string> = { rare: '🔷', epic: '💜', legendary: '🌟' }
export const TIER_NAME: Record<CallCardTier, string> = { rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

// Which tiers each crate holds (like crate skins: Street only rare, Diamond no rare).
export const CALL_CRATE_TIERS: Record<CrateId, CallCardTier[]> = {
  street: ['rare'],
  garage: ['rare', 'epic'],
  gold: ['rare', 'epic', 'legendary'],
  diamond: ['epic', 'legendary'],
}
// Within a crate, a card's chance is its tier's weight over the pool's.
export const CALL_WEIGHT: Record<CallCardTier, number> = { rare: 6, epic: 3, legendary: 1 }

export const callCardDef = (id: string | null | undefined) => (id ? CALL_CARDS.find((c) => c.id === id) : undefined)
// A known card id, else the Showroom (old saves, other players' unknown or newer cards).
export const callCardOr = (id: string | null | undefined) => (callCardDef(id) ? id! : STOCK_CARD)

export const crateCallCards = (crate: CrateId) => CALL_CARDS.filter((c) => c.tier && CALL_CRATE_TIERS[crate].includes(c.tier))

// The cards a save has: the Showroom and the crate cards it won.
export const ownedCallCards = (s: { callCards?: string[] | null }) => [STOCK_CARD, ...(s.callCards ?? []).filter((id) => id !== STOCK_CARD && callCardDef(id))]
