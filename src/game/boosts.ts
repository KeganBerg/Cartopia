// Casual-first coin bonuses on top of race and arcade pay. They add up rather than multiply, and
// the total is capped at BOOST_CAP so no mix of them outruns the server guard's coin bank
// (econ_guard() only lets town worth grow by a few minutes of income at a time).
//   * First win of the day: the first win each UTC day in drag races, karts and the arcade pays double.
//   * Welcome back: after two days away, the next WELCOME_RACES races and arcade games pay double.
//   * Weekend: Friday to Sunday (UTC) pays half again.
// A loss still pays: LOSS_SHARE of the prize against the AI, LIVE_LOSS_SHARE against a person, so two
// friends can't trade wins for coins.

export type BoostMode = 'race' | 'kart' | 'arcade'
// Saved with the town: the UTC day of the last first-win bonus in each mode, and how many
// welcome-back payouts are left.
export type Boosts = { firstWin: Partial<Record<BoostMode, string>>; welcome: number }

export const LOSS_SHARE = 0.4
export const LIVE_LOSS_SHARE = 0.25
export const FIRST_WIN_BONUS = 1
export const WELCOME_BONUS = 1
export const WEEKEND_BONUS = 0.5
export const BOOST_CAP = 2.5
export const WELCOME_AWAY_MS = 48 * 3600_000
export const WELCOME_RACES = 10

export const emptyBoosts = (): Boosts => ({ firstWin: {}, welcome: 0 })
const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10)
// Friday, Saturday or Sunday in UTC.
export const isWeekend = (now: number) => [5, 6, 0].includes(new Date(now).getUTCDay())

// Every bonus already used up today, for plain pay (tests use it).
export function boostsSpent(now = Date.now()): Boosts {
  const day = dayOf(now)
  return { firstWin: { race: day, kart: day, arcade: day }, welcome: 0 }
}

export type Boost = { mult: number; firstWin: boolean; welcome: boolean; weekend: boolean; next: Boosts }

// The multiplier for one payout, and the bonus state after it. `paid` is false for a payout of
// nothing (an arcade game that won no coins), which uses up no bonus.
export function boostFor(b: Boosts | null | undefined, mode: BoostMode, won: boolean, now = Date.now(), paid = true): Boost {
  const cur = b ?? emptyBoosts()
  const day = dayOf(now)
  const firstWin = paid && won && cur.firstWin[mode] !== day
  const welcome = paid && cur.welcome > 0
  const weekend = paid && isWeekend(now)
  const mult = Math.min(BOOST_CAP, 1 + (firstWin ? FIRST_WIN_BONUS : 0) + (welcome ? WELCOME_BONUS : 0) + (weekend ? WEEKEND_BONUS : 0))
  const next = {
    firstWin: firstWin ? { ...cur.firstWin, [mode]: day } : cur.firstWin,
    welcome: welcome ? cur.welcome - 1 : cur.welcome,
  }
  return { mult, firstWin, welcome, weekend, next }
}

// Coming back after WELCOME_AWAY_MS or more tops the welcome-back payouts up to WELCOME_RACES.
export function welcomeBack(b: Boosts | null | undefined, awayMs: number): Boosts {
  const cur = b ?? emptyBoosts()
  return awayMs >= WELCOME_AWAY_MS ? { ...cur, welcome: Math.max(cur.welcome, WELCOME_RACES) } : cur
}

// The short label for a boosted payout, e.g. "×2.5 first win, weekend".
export function boostLabel(x: Boost) {
  const why = [x.firstWin && 'first win', x.welcome && 'welcome back', x.weekend && 'weekend'].filter(Boolean)
  return why.length ? `×${Math.round(x.mult * 10) / 10} ${why.join(', ')}` : ''
}
