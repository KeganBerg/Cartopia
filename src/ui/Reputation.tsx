import { useGame } from '../game/store'
import { reputation } from '../game/reputation'

// Your reputation title for the Race menu's header, with the score and the next title on hover.
export function RepChip() {
  const trophies = useGame((s) => s.trophies)
  const stats = useGame((s) => s.stats)
  const cups = useGame((s) => s.cups)
  const mastery = useGame((s) => s.mastery)
  const r = reputation({ trophies, stats, cups, mastery })
  const tip = `Reputation ${r.score.toLocaleString()}${r.next ? ` · ${r.next.icon} ${r.next.name} in ${r.toNext.toLocaleString()}` : ''}`
  return (
    <span className="rep-chip" title={tip}>
      {r.title.icon} {r.title.name}
      <i className="rep-bar" aria-hidden><i style={{ width: `${Math.round(r.frac * 100)}%` }} /></i>
    </span>
  )
}
