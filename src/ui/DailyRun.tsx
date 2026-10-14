import { useMemo } from 'react'
import { useGame } from '../game/store'
import { DAILY_MEDALS, dailyMedal, dailyRun, dailyShare, type DailyRun } from '../game/daily'
import { shortLeft } from '../game/trial'
import { CarThumb } from '../scene/BuildingPreview'
import { artStyle } from './venueArt'
import { TileClip } from './TileClip'

// Daily Run screen (game/daily.ts): today's venue and loaner car, the medal times, your best
// today and a share button. The result card after a run shows the medal.

const msToTomorrow = (t = Date.now()) => 86400000 - (t % 86400000)

// Today's best as saved, or null before the first run.
export const dailyBest = (d: { day: string; best: number | null } | undefined, day: string) => (d?.day === day ? d.best : null)

// Shares the text with the phone's share sheet, or copies it.
async function share(text: string) {
  try {
    if (navigator.share) return await navigator.share({ text })
    await navigator.clipboard.writeText(text)
    useGame.getState().toast('Copied! Paste it anywhere.')
  } catch {
    // Cancelled, or no clipboard: nothing to do.
  }
}

// The bar along the bottom carries the Run button and the loaner car (Race.tsx).
export function DailyRunTab() {
  const run = useMemo(() => dailyRun(), [])
  const saved = useGame((s) => s.daily)
  const best = dailyBest(saved, run.day)
  const medal = best !== null ? dailyMedal(run, best) : null
  return (
    <div className="rm-split rm-prow dr">
      <div className="rm-left">
        <div className="rm-banner rm-photo" style={artStyle('trial', run.venue.id)}>
          <TileClip mode="trial" venue={run.venue.id} />
          <span className="rm-eyebrow">{run.venue.icon} {run.venue.name} · ⏳ {shortLeft(msToTomorrow())}</span>
          <b className="rm-ttl">📅 Daily Run</b>
        </div>
      </div>
      <div className="rm-right">
        <div className="dr-car" title="Everyone races the same car and weather today">
          <CarThumb size="lg" color={run.color} body={run.car.body} model={run.car.id} />
          <b>{run.car.name}</b>
          <span className="dr-tags"><span className="rm-pi">PI {run.pi}</span><span>🔑 Loaner</span></span>
        </div>
        <div className="dr-medals">
          {DAILY_MEDALS.map((m, i) => (
            <span key={m.icon} className={medal !== null && medal <= i ? 'got' : ''}>
              <i>{m.icon}</i><b>{run.medals[i].toFixed(2)}s</b>
            </span>
          ))}
        </div>
        <div className="dr-best">
          <span><small>Today's best</small><b>{best !== null ? `${best.toFixed(3)}s` : '--'}</b></span>
          {best !== null && <button className="buy alt" onClick={() => share(dailyShare(run, best))}>📤 Share</button>}
        </div>
      </div>
    </div>
  )
}

export function DailyResult({ run, myTime, onAgain, onExit }: { run: DailyRun; myTime: number; onAgain: () => void; onExit: () => void }) {
  const best = dailyBest(useGame((s) => s.daily), run.day) ?? myTime
  const m = dailyMedal(run, myTime)
  const icon = DAILY_MEDALS[m]?.icon
  return (
    <div className={icon ? 'rr win' : 'rr lose'}>
      <div className="rr-card">
        <div className="rr-icon">{icon ?? '📅'}</div>
        <h3 className="rr-title trial-time">{myTime.toFixed(3)}s</h3>
        <p className="rr-sub">{myTime <= best ? "Today's best!" : `Best today: ${best.toFixed(3)}s`}</p>
        <div className="row trial-row">
          <button className="buy alt rr-go" onClick={onExit}>Back</button>
          <button className="buy alt rr-go" onClick={() => share(dailyShare(run, best))}>📤 Share</button>
          <button className="buy rr-go" onClick={onAgain}>↻ Again</button>
        </div>
      </div>
    </div>
  )
}
