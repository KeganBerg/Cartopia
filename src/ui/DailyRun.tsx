import { useMemo } from 'react'
import { useGame } from '../game/store'
import { DAILY_MEDALS, dailyMedal, dailyNumber, dailyRun, dailyShare, type DailyRun } from '../game/daily'
import { shortLeft } from '../game/trial'
import { StageSlot } from '../scene/Stage'
import { DailyScene } from '../scene/DailyScene'

// Daily Run screen (game/daily.ts): today's start line in 3D with the loaner car, the medal
// times, your best today and a share button. The result card after a run shows the medal.

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

const DAILY_CAM = { position: [3, 1.4, 5] as [number, number, number], fov: 50, near: 0.2, far: 150 }

// The whole screen is the day's start line in 3D (scene/DailyScene.tsx): the loaner beside its
// par ghost, and a timing tower with today's best. Chips over it: the venue and time left, the
// medal times (green once beaten), and Share once there's a time. The bar along the bottom
// carries the loaner's name and the Run button (Race.tsx).
export function DailyRunTab() {
  const run = useMemo(() => dailyRun(), [])
  const saved = useGame((s) => s.daily)
  const best = dailyBest(saved, run.day)
  const medal = best !== null ? dailyMedal(run, best) : null
  const shown = medal !== null && medal < DAILY_MEDALS.length ? medal : null
  const car = useMemo(() => ({ body: run.car.body, model: run.car.id, color: run.color }), [run])
  const scene = useMemo(
    () => <DailyScene venue={run.venue} seed={`daily-${run.day}`} car={car} n={dailyNumber(run.day)} best={best} medal={shown} />,
    [run, car, best, shown],
  )
  return (
    <div className="dr" aria-label={best !== null ? `Today's best ${best.toFixed(3)}s` : undefined}>
      <StageSlot cam={DAILY_CAM} through>{scene}</StageSlot>
      <div className="dr-top">
        <span className="dr-chip">{run.venue.icon} {run.venue.name}</span>
        <span className="dr-chip dr-left" title="New run in">⏳ {shortLeft(msToTomorrow())}</span>
        {best !== null && <button className="dr-chip dr-share" onClick={() => share(dailyShare(run, best))} aria-label="Share">📤</button>}
      </div>
      <div className="dr-medals">
        {DAILY_MEDALS.map((m, i) => (
          <span key={m.icon} className={medal !== null && medal <= i ? 'got' : ''}>
            <i>{m.icon}</i><b>{run.medals[i].toFixed(2)}s</b>
          </span>
        ))}
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
