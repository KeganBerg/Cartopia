import { useMemo } from 'react'
import { useGame } from '../game/store'
import { DAILY_MEDALS, DAILY_PAY, dailyMedal, dailyRun, dailyShare, type DailyRun } from '../game/daily'
import { TRIAL_FUEL, shortLeft } from '../game/trial'
import { CarThumb } from '../scene/BuildingPreview'

// Daily Run screen (game/daily.ts): today's venue and loaner car, the medal times, your best
// today, and buttons to run and to share. The result card after a run shows the medal.

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

export function DailyRunTab({ onRun }: { onRun: (run: DailyRun) => void }) {
  const run = useMemo(() => dailyRun(), [])
  const saved = useGame((s) => s.daily)
  const best = dailyBest(saved, run.day)
  const paid = saved?.day === run.day && saved.paid
  const medal = best !== null ? dailyMedal(run, best) : null
  return (
    <div className="trial daily">
      <div className={`camp-chapter venue-${run.venue.id}`}>
        <div className="camp-banner">
          <span className="camp-banner-ico">{run.venue.icon}</span>
          <div>
            <b>📅 Daily Run</b>
            <small>{run.venue.name} · ⏳ {shortLeft(msToTomorrow())} left</small>
          </div>
          <div className="camp-rewards" title="Everyone races the same car and weather today">
            {DAILY_MEDALS.map((m, i) => <span key={m.icon}>{m.icon} {run.medals[i].toFixed(2)}s</span>)}
          </div>
        </div>
        <div className="daily-car">
          <CarThumb size="sm" color={run.color} body={run.car.body} model={run.car.id} />
          <span><b>{run.car.name}</b><small>PI {run.pi} · stock</small></span>
        </div>
        <div className="trial-me">
          <span className="trial-best">
            <small>Today's best</small>
            <b>{best !== null ? `${best.toFixed(3)}s ${DAILY_MEDALS[medal!]?.icon ?? ''}` : '--'}</b>
          </span>
          {best !== null && <button className="buy alt" onClick={() => share(dailyShare(run, best))}>📤 Share</button>}
          <button className="buy" onClick={() => onRun(run)}>🏁 Run · ⛽{TRIAL_FUEL}{paid ? '' : ` · 💵 ${DAILY_PAY[0].toLocaleString()}`}</button>
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
