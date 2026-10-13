// Season recap: when a new season starts, a card sums up the one that just ended: races and
// wins, trophies and coins earned, cars added, season stars and tiers, and how far the
// reputation title moved. The save keeps a snapshot from the start of each season
// (`seasonBase`) and the recap waiting to be shown (`recap`), so a reload doesn't lose it.
// Nothing is paid: it's a look back, with a share button.
import { seasonNumber, seasonOf, type CounterKey } from './data'
import { repScore, repTier, type RepSave } from './reputation'
import { useGame, type SeasonProgress } from './store'

export type SeasonBase = { n: number; races: number; wins: number; trophies: number; coins: number; cars: number; rep: number }
export type Recap = {
  n: number; name: string; icon: string
  races: number; wins: number; trophies: number; coins: number; cars: number
  stars: number; tiers: number; repFrom: number; repTo: number
}

type RecapSave = RepSave & { stats: Partial<Record<CounterKey, number>>; season: SeasonProgress | null }

export function seasonSnapshot(s: RecapSave, n: number): SeasonBase {
  const st = s.stats
  return { n, races: st.races ?? 0, wins: st.racesWon ?? 0, trophies: s.trophies, coins: st.coinsEarned ?? 0, cars: st.carsBought ?? 0, rep: repScore(s) }
}

// The recap of the season `base` began, from what has changed since. Null when nothing was played.
export function buildRecap(base: SeasonBase, s: RecapSave): Recap | null {
  const now = seasonSnapshot(s, base.n)
  const d = (k: keyof SeasonBase) => Math.max(0, now[k] - base[k])
  const p = s.season?.n === base.n ? s.season : null
  if (!d('races') && !p?.stars) return null
  const def = seasonOf(base.n)
  return {
    n: base.n, name: def.name, icon: def.icon,
    races: d('races'), wins: d('wins'), trophies: d('trophies'), coins: d('coins'), cars: d('cars'),
    stars: p?.stars ?? 0, tiers: p?.claimed.length ?? 0, repFrom: repTier(base.rep), repTo: repTier(now.rep),
  }
}

export function recapShare(r: Recap) {
  return `🏁 My Cartopia ${r.name}\n🏎️ ${r.races} races · 🥇 ${r.wins} wins\n🏆 +${r.trophies} trophies · ⭐ ${r.stars} stars`
}

// Keeps the snapshot current and queues a recap when a season rolls over. A save that never had
// a snapshot just takes one: there's nothing to look back on yet.
export function startRecapWatch() {
  const check = () => {
    const s = useGame.getState()
    const n = seasonNumber()
    const base = s.seasonBase
    if (base && base.n >= n) return
    const recap = base ? buildRecap(base, s) : null
    useGame.setState({ seasonBase: seasonSnapshot(s, n), ...(recap ? { recap } : {}) })
  }
  check()
  // Seasons roll over at a set time, so a long session checks now and then too.
  const id = setInterval(check, 60_000)
  const off = useGame.subscribe((s, was) => { if (s.seasonBase !== was.seasonBase && !s.seasonBase) check() })
  return () => { clearInterval(id); off() }
}
