// Real-money buys (gem packs and car packs) open with the Crew House (Kegan, 2026-10-17). Until the
// town has one, built or packed away, nothing that leads to checkout shows, and
// netlify/functions/checkout.mts refuses a checkout too. The admin skips it like every other lock.
// No imports, so the Netlify function can use it.
export const PAY_BUILDING = 'crew'

type Placed = { def?: unknown }
export const canBuyPacks = (s: { buildings?: Placed[] | null; stored?: Placed[] | null; admin?: boolean }) =>
  !!s.admin || [...(Array.isArray(s.buildings) ? s.buildings : []), ...(Array.isArray(s.stored) ? s.stored : [])].some((b) => b?.def === PAY_BUILDING)
