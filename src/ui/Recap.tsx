import { useGame } from '../game/store'
import { REP_TITLES } from '../game/reputation'
import { recapShare } from '../game/recap'

// The season recap card (game/recap.ts), shown once when a new season starts.
export function RecapPopup() {
  const r = useGame((s) => s.recap)
  const close = useGame((s) => s.closeRecap)
  if (!r) return null
  const from = REP_TITLES[r.repFrom], to = REP_TITLES[r.repTo]
  const share = async () => {
    const text = recapShare(r)
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        useGame.getState().toast('Copied! Paste it anywhere.')
      }
    } catch {
      // Cancelled, or no clipboard.
    }
  }
  const stats: [string, string, number][] = [
    ['🏎️', 'Races', r.races], ['🥇', 'Wins', r.wins], ['🏆', 'Trophies', r.trophies],
    ['💵', 'Coins earned', r.coins], ['🚗', 'New cars', r.cars], ['⭐', 'Season stars', r.stars],
  ]
  return (
    <div className="overlay prize-overlay">
      <div className="prize recap">
        <small className="recap-eyebrow">Season recap</small>
        <h2>{r.icon} {r.name}</h2>
        <div className="recap-grid">
          {stats.map(([icon, label, n]) => (
            <span key={label}><i aria-hidden>{icon}</i><b>{n.toLocaleString()}</b><small>{label}</small></span>
          ))}
        </div>
        <p className="recap-rep">
          {r.repTo > r.repFrom ? <>Title: {from.icon} {from.name} → <b>{to.icon} {to.name}</b></> : <>Title: <b>{to.icon} {to.name}</b></>}
          {r.tiers > 0 && <> · {r.tiers} season tier{r.tiers > 1 ? 's' : ''} won</>}
        </p>
        <div className="row">
          <button className="buy alt" onClick={() => void share()}>📤 Share</button>
          <button className="buy" onClick={close}>On to the new season!</button>
        </div>
      </div>
    </div>
  )
}
