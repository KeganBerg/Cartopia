// Call Cards: animated backgrounds a player's car stands on in other players' Quick Race menus.
// Pure looks, no stats. Every player has the Showroom card; the 32 others only drop from crates, a
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
  { id: 'tiresmoke', name: 'Tire Smoke', icon: '🛞', tier: 'rare' },
  { id: 'hazard', name: 'Hazard Zone', icon: '🚧', tier: 'rare' },
  { id: 'oceandrive', name: 'Ocean Drive', icon: '🌊', tier: 'rare' },
  { id: 'snowday', name: 'Snow Day', icon: '❄️', tier: 'rare' },
  { id: 'autumnlane', name: 'Autumn Lane', icon: '🍂', tier: 'rare' },
  { id: 'dragtree', name: 'Christmas Tree', icon: '🚦', tier: 'rare' },
  { id: 'bubblepop', name: 'Bubble Pop', icon: '🫧', tier: 'rare' },
  { id: 'pixelpark', name: 'Pixel Park', icon: '👾', tier: 'rare' },
  { id: 'ravelights', name: 'Rave Lights', icon: '🪩', tier: 'epic' },
  { id: 'warpspeed', name: 'Warp Speed', icon: '💨', tier: 'epic' },
  { id: 'polarglow', name: 'Polar Glow', icon: '🌌', tier: 'epic' },
  { id: 'midnightgrid', name: 'Midnight Grid', icon: '🕹️', tier: 'epic' },
  { id: 'plasma', name: 'Plasma Swirl', icon: '🌀', tier: 'epic' },
  { id: 'lasergrid', name: 'Laser Scan', icon: '🔴', tier: 'epic' },
  { id: 'circuitry', name: 'Circuit Rush', icon: '🔌', tier: 'epic' },
  { id: 'deepsea', name: 'Deep Sea', icon: '🐠', tier: 'epic' },
  { id: 'fireworks', name: 'Fireworks', icon: '🎆', tier: 'epic' },
  { id: 'comettrail', name: 'Comet Trail', icon: '☄️', tier: 'epic' },
  { id: 'discoball', name: 'Disco Ball', icon: '🕺', tier: 'epic' },
  { id: 'sakura', name: 'Sakura Drift', icon: '🌸', tier: 'epic' },
  { id: 'thunderroad', name: 'Thunder Road', icon: '⚡', tier: 'legendary' },
  { id: 'inferno', name: 'Inferno', icon: '🔥', tier: 'legendary' },
  { id: 'starwarp', name: 'Star Warp', icon: '✨', tier: 'legendary' },
  { id: 'goldrush', name: 'Gold Rush', icon: '🏆', tier: 'legendary' },
  { id: 'blackhole', name: 'Black Hole', icon: '🕳️', tier: 'legendary' },
  { id: 'magmacore', name: 'Magma Core', icon: '🌋', tier: 'legendary' },
  { id: 'diamondrain', name: 'Diamond Rain', icon: '💎', tier: 'legendary' },
  { id: 'championlap', name: "Champion's Lap", icon: '📸', tier: 'legendary' },
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
