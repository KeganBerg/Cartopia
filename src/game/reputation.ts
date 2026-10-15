// Reputation: one score for how far you've come as a racer, with a title for each band. It is
// worked out from progress that never goes down (races, wins, trophies, mastery steps, Class
// Cup races, campaign and Grand Prix wins), so reputation only ever goes up, and nothing new is
// paid or saved except the last title announced (`repSeen`). startRepWatch() toasts each new title.
import type { CounterKey } from './data'
import type { Mastery } from './mastery'
import { useGame } from './store'
import { sfx } from '../lib/sound'

export type RepSave = {
  trophies: number
  stats: Partial<Record<CounterKey, number>>
  cups?: Record<string, number>
  mastery?: Record<string, Mastery>
}

// Points for each thing done.
export const REP_POINTS = { race: 2, win: 10, trophy: 5, masteryStep: 25, cupRace: 30, campaignWin: 5, gpWin: 50 }

export function repScore(s: RepSave) {
  const st = s.stats
  const steps = Object.values(s.mastery ?? {}).reduce((a, m) => a + (m.tier ?? 0), 0)
  const cups = Object.values(s.cups ?? {}).filter((n) => n > 0).length
  return (st.races ?? 0) * REP_POINTS.race + (st.racesWon ?? 0) * REP_POINTS.win + s.trophies * REP_POINTS.trophy
    + steps * REP_POINTS.masteryStep + cups * REP_POINTS.cupRace + (st.campaignWins ?? 0) * REP_POINTS.campaignWin + (st.gpWins ?? 0) * REP_POINTS.gpWin
}

export type RepTitle = { name: string; icon: string; at: number }
export const REP_TITLES: RepTitle[] = [
  { name: 'Rookie', icon: '🔰', at: 0 },
  { name: 'Street Racer', icon: '🛣️', at: 250 },
  { name: 'Local Hero', icon: '⭐', at: 750 },
  { name: 'Town Champ', icon: '🏅', at: 2000 },
  { name: 'Pro', icon: '🏎️', at: 5000 },
  { name: 'Star', icon: '🌟', at: 10000 },
  { name: 'Legend', icon: '👑', at: 20000 },
  { name: 'Icon', icon: '💫', at: 40000 },
]

// Which title a score has (an index into REP_TITLES).
export const repTier = (score: number) => REP_TITLES.reduce((n, t, i) => (score >= t.at ? i : n), 0)
// The score, its title, and how far it is to the next one (null at the top).
export function reputation(s: RepSave) {
  const score = repScore(s)
  const i = repTier(score)
  const next = REP_TITLES[i + 1] ?? null
  return { score, tier: i, title: REP_TITLES[i], next, toNext: next ? next.at - score : 0, frac: next ? (score - REP_TITLES[i].at) / (next.at - REP_TITLES[i].at) : 1 }
}

// Announces each new title once. A save that has never had one announced (an old save, or a new
// player) takes its current title silently, so loading a town never fires a pile of toasts.
export function startRepWatch() {
  const check = () => {
    const s = useGame.getState()
    const tier = repTier(repScore(s))
    if (s.repSeen !== undefined && tier <= s.repSeen) return
    const first = s.repSeen === undefined
    useGame.setState({ repSeen: tier })
    if (!first) sfx.unlock()
    if (!first) s.toast(`${REP_TITLES[tier].icon} New title: ${REP_TITLES[tier].name}!`)
  }
  check()
  return useGame.subscribe(check)
}
