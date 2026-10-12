// Casual-first coin bonuses on top of race and arcade pay. They add up rather than multiply, and
// the total is capped at BOOST_CAP so no mix of them outruns the server guard's coin bank
// (econ_guard() only lets town worth grow by a few minutes of income at a time).
//   * First win of the day: the first win each UTC day in drag races, karts and the arcade pays double.
//   * Welcome back: after two days away, the next WELCOME_RACES races and arcade games pay double.
//   * Weekend: Friday to Sunday (UTC) pays half again.
//   * Win streak: each win in a row before this one adds STREAK_STEP, up to STREAK_MAX (races and karts).
//     A loss starts the count again.
// A loss still pays a little, by place (placeShare): in a 1-on-1, LOSS_SHARE of the prize against the
// AI and LIVE_LOSS_SHARE against a person, low enough that losing on purpose isn't worth it. In a big
// field the places near the top still pay well and the share falls away down the field.

export type BoostMode = 'race' | 'kart' | 'arcade'
// Saved with the town: the UTC day of the last first-win bonus in each mode, and how many
// welcome-back payouts are left.
export type Boosts = { firstWin: Partial<Record<BoostMode, string>>; welcome: number; streak?: number }

export const LOSS_SHARE = 0.2
export const LIVE_LOSS_SHARE = 0.1
export const STREAK_STEP = 0.1
export const STREAK_MAX = 0.5
export const FIRST_WIN_BONUS = 1
export const WELCOME_BONUS = 1
export const WEEKEND_BONUS = 0.5
export const BOOST_CAP = 2.5
export const WELCOME_AWAY_MS = 48 * 3600_000
export const WELCOME_RACES = 10

export const emptyBoosts = (): Boosts => ({ firstWin: {}, welcome: 0, streak: 0 })

// What a finish pays as a share of the winner's prize: 1 for first; in a 1-on-1 the loss share;
// in a field of three or more, 60% for second falling evenly to the loss share for last.
export function placeShare(place: number, of: number, live = false) {
  const floor = live ? LIVE_LOSS_SHARE : LOSS_SHARE
  if (place <= 1) return 1
  if (of <= 2) return floor
  return Math.max(floor, 0.6 - ((0.6 - floor) * (place - 2)) / (of - 2))
}
const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10)
// Friday, Saturday or Sunday in UTC.
export const isWeekend = (now: number) => [5, 6, 0].includes(new Date(now).getUTCDay())

// Every bonus already used up today, for plain pay (tests use it).
export function boostsSpent(now = Date.now()): Boosts {
  const day = dayOf(now)
  return { firstWin: { race: day, kart: day, arcade: day }, welcome: 0, streak: 0 }
}

export type Boost = { mult: number; firstWin: boolean; welcome: boolean; weekend: boolean; streak: number; next: Boosts }

// The multiplier for one payout, and the bonus state after it. `paid` is false for a payout of
// nothing (an arcade game that won no coins), which uses up no bonus.
export function boostFor(b: Boosts | null | undefined, mode: BoostMode, won: boolean, now = Date.now(), paid = true): Boost {
  const cur = b ?? emptyBoosts()
  const day = dayOf(now)
  const firstWin = paid && won && cur.firstWin[mode] !== day
  const welcome = paid && cur.welcome > 0
  const weekend = paid && isWeekend(now)
  // Arcade games don't count towards a streak, either way.
  const was = cur.streak ?? 0
  const streak = mode !== 'arcade' && won && paid ? Math.min(STREAK_MAX, was * STREAK_STEP) : 0
  const mult = Math.min(BOOST_CAP, 1 + (firstWin ? FIRST_WIN_BONUS : 0) + (welcome ? WELCOME_BONUS : 0) + (weekend ? WEEKEND_BONUS : 0) + streak)
  const next = {
    firstWin: firstWin ? { ...cur.firstWin, [mode]: day } : cur.firstWin,
    welcome: welcome ? cur.welcome - 1 : cur.welcome,
    streak: mode === 'arcade' ? was : won ? was + 1 : 0,
  }
  return { mult, firstWin, welcome, weekend, streak, next }
}

// Coming back after WELCOME_AWAY_MS or more tops the welcome-back payouts up to WELCOME_RACES.
export function welcomeBack(b: Boosts | null | undefined, awayMs: number): Boosts {
  const cur = b ?? emptyBoosts()
  return awayMs >= WELCOME_AWAY_MS ? { ...cur, welcome: Math.max(cur.welcome, WELCOME_RACES) } : cur
}

// The short label for a boosted payout, e.g. "×2.5 first win, weekend".
export function boostLabel(x: Boost) {
  const why = [x.firstWin && 'first win', x.welcome && 'welcome back', x.weekend && 'weekend', x.streak > 0 && `${x.next.streak} wins in a row`].filter(Boolean)
  return why.length ? `×${Math.round(x.mult * 10) / 10} ${why.join(', ')}` : ''
}
