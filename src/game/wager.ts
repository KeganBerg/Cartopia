// Wager matches: two signed-in players stake coins on a live drag race. Coins only, never gems:
// gems can be bought with real money, and betting them would be real-money gambling.
// The server holds both stakes when the challenge is accepted and pays the winner both
// (supabase/migrations/0057_wager_matches.sql); a race that doesn't count gives them back.

// Each stake and the level both racers need to bet it. wager.test.ts checks the SQL matches.
export const STAKES: readonly (readonly [stake: number, level: number])[] = [
  [500, 1],
  [2000, 3],
  [10000, 8],
  [50000, 15],
  [250000, 25],
]

// Stakes two racers can bet: both need the level, and you need the coins.
export function stakesFor(myLevel: number, theirLevel: number, coins: number) {
  const lvl = Math.min(myLevel, theirLevel)
  return STAKES.filter(([s, l]) => l <= lvl && s <= coins).map(([s]) => s)
}

export function isStake(stake: number, lvl: number) {
  return STAKES.some(([s, l]) => s === stake && l <= lvl)
}

// 250000 -> "250K", 2000 -> "2K", 500 -> "500".
export function shortCoins(n: number) {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`
  return String(n)
}

// One line of the server's wager ledger: a hold (-stake), a win (+2x stake) or a refund (+stake).
export type WagerEntry = { seq: number; delta: number; race_id: string; kind: 'hold' | 'win' | 'refund' }

// Entries after the save's `wagers` count, in order, as one coin change and the new count.
export function claim(applied: number, entries: WagerEntry[]) {
  const fresh = entries.filter((e) => e.seq > applied).sort((a, b) => a.seq - b.seq)
  let n = applied
  let coins = 0
  for (const e of fresh) {
    // Only an unbroken run counts, matching the server, which sums seq (applied, n].
    if (e.seq !== n + 1) break
    n = e.seq
    coins += e.delta
  }
  return { n, coins }
}
