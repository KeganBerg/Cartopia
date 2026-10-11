import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { raceFloor } from '../game/race'
import { TRIAL_FUEL, TRIAL_PRIZES, trialPrize, trialVenue, trialWeek, shortLeft } from '../game/trial'
import { msToNextWeek } from '../game/data'
import { supabase } from '../lib/supabase'
import { signedInUser } from '../lib/cloud'
import { displayName } from '../lib/names'
import { fetchBoard, fetchPrizes, localBest, saveLocalBest, startRun, submitRun, type Board, type TrialPrizes } from '../lib/trialServer'

// The Race menu's weekly time trial tab: this week's venue, prizes, the board, and runs.

export type TrialRun = { target: number; ghost: string; venue: string }

const MEDAL = ['🥇', '🥈', '🥉']
const place = (n: number) => MEDAL[n - 1] ?? `#${n}`
const Bucks = ({ n }: { n: number }) => <><span className="ico buck-ico">B</span>{n}</>
const money = (n: number) => (n >= 1000 ? `$${n / 1000}k` : `$${n}`)
const weekOf = (week: string) => new Date(`${week}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

// The server's answer to the run in progress: whether it can be posted at all.
let started: Promise<boolean> = Promise.resolve(false)

export function TrialTab({ myPi, onRun }: { myPi: number; onRun: (run: TrialRun) => void }) {
  const week = trialWeek()
  const v = trialVenue(week)
  // undefined while loading, null if the board couldn't be read
  const [board, setBoard] = useState<Board | null | undefined>(undefined)
  const [prizes, setPrizes] = useState<TrialPrizes | null>(null)
  const claimed = useGame((s) => s.trials.claimed)
  const claim = useGame((s) => s.claimTrialPrize)
  const openPanel = useGame((s) => s.openPanel)
  const uid = signedInUser()

  useEffect(() => {
    fetchBoard().then(setBoard)
    fetchPrizes().then(setPrizes)
  }, [])

  const mine = board?.me?.t ?? localBest(week)
  // You race your own best; until you have one, a par time for your car.
  const run = () => onRun(mine !== null ? { target: mine, ghost: 'Your best', venue: v.id } : { target: Math.round(raceFloor(myPi) * 1.3 * 100) / 100, ghost: 'Par', venue: v.id })
  const unclaimed = prizes?.prizes.filter((p) => claimed[p.week] === undefined) ?? []
  const rows = board?.top.slice(0, 10) ?? []
  const meShown = rows.some((r) => r.owner === uid)

  return (
    <div className="trial">
      <div className={`camp-chapter venue-${v.id}`}>
        <div className="camp-banner">
          <span className="camp-banner-ico">{v.icon}</span>
          <div>
            <b>⏱️ Weekly Time Trial</b>
            <small>{v.name} · ⏳ {shortLeft(msToNextWeek())} left</small>
          </div>
          <div className="camp-rewards" title="Prizes when the week ends">
            {TRIAL_PRIZES.slice(0, 3).map((p, i) => <span key={i}>{MEDAL[i]} <Bucks n={p.bucks} /></span>)}
            <span>Top 10 <Bucks n={TRIAL_PRIZES[3].bucks} /></span>
          </div>
        </div>
        <div className="trial-me">
          <span className="trial-best">
            <small>Your best</small>
            <b>{mine !== null ? `${mine.toFixed(3)}s` : '--'}</b>
          </span>
          {board?.me && <span className="trial-place">{place(board.me.place)} <small>of {board.total}</small></span>}
          <button className="buy" onClick={run}>🏁 Run · ⛽{TRIAL_FUEL}</button>
        </div>
      </div>

      {unclaimed.map((p) => {
        const prize = trialPrize(p.place)
        return (
          <div key={p.week} className="trial-prize">
            <span className="trial-prize-medal">{place(p.place)}</span>
            <div><b>Week of {weekOf(p.week)}</b><small>{p.t.toFixed(3)}s</small></div>
            {prizes?.ready ? (
              <button className="buy small" onClick={() => claim(p.week, p.place)}>
                Claim {prize.bucks > 0 && <><Bucks n={prize.bucks} /> </>}{money(prize.coins)} 🏆{prize.trophies}
              </button>
            ) : <span className="trial-soon" title="Prizes are being switched on. Yours is saved.">🎁 Soon</span>}
          </div>
        )
      })}

      {supabase && (
        <div className="leaders">
          {board === undefined && <p className="hint">Loading...</p>}
          {board && rows.length === 0 && <p className="empty-board">No times yet this week. Be the first!</p>}
          {rows.map((r) => <Row key={r.owner} r={r} mine={r.owner === uid} />)}
          {board?.me && !meShown && uid && <Row r={{ owner: uid, town: useGame.getState().townName, t: board.me.t, pi: myPi, car: null, place: board.me.place }} mine />}
        </div>
      )}
      {supabase && !uid && (
        <p className="hint">Sign in from the <button className="link" onClick={() => openPanel('account')}>Menu</button> to post your times and win prizes.</p>
      )}
    </div>
  )
}

function Row({ r, mine }: { r: Board['top'][number]; mine?: boolean }) {
  return (
    <div className={mine ? 'leader board-row mine' : 'leader board-row'}>
      <span className={`rank r${r.place}`}>{r.place}</span>
      <div className="leader-main">
        <b>{displayName(r.town ?? '', r.owner)}{mine ? ' (you)' : ''}</b>
        <div className="card-stat">{r.car ? `${r.car} · ` : ''}PI {r.pi}</div>
      </div>
      <span className="board-value">{r.t.toFixed(3)}s</span>
    </div>
  )
}

// Called as a run's countdown starts, so the server can time it.
export function beginTrialRun() {
  started = startRun()
}

// The end-of-run card: the time, whether it's a new best, and where it put you.
export function TrialResult({ myTime, target, ghost, onAgain, onExit }: { myTime: number; target: number; ghost: string; onAgain: () => void; onExit: () => void }) {
  // This device's best before this run, read once (the run is saved as the new best below).
  const [before] = useState(() => localBest())
  const [posted, setPosted] = useState<Board | null | 'local' | 'pending'>('pending')
  useEffect(() => {
    saveLocalBest(myTime)
    let live = true
    started.then(async (ok) => {
      if (!ok) return live && setPosted('local')
      const b = await submitRun(myTime)
      if (live) setPosted(b ?? 'local')
    })
    return () => { live = false }
  }, [myTime])
  const best = before === null || myTime < before
  const beat = myTime < target
  const board = typeof posted === 'object' ? posted : null
  return (
    <div className={best ? 'rr win' : 'rr lose'}>
      <div className="rr-card">
        <div className="rr-icon">⏱️</div>
        <h3 className="rr-title trial-time">{(board?.kept ?? myTime).toFixed(3)}s</h3>
        <p className="rr-sub">{best ? 'NEW BEST!' : beat ? `You beat ${ghost.toLowerCase()}!` : `${ghost}: ${target.toFixed(3)}s`}</p>
        <div className="rr-loot">
          {posted === 'pending' && <span>Posting...</span>}
          {board?.me && <span>{place(board.me.place)} of {board.total} this week</span>}
          {posted === 'local' && <span>{signedInUser() ? "Couldn't post this run" : 'Sign in to post times'}</span>}
        </div>
        <div className="row trial-row">
          <button className="buy alt rr-go" onClick={onExit}>Board</button>
          <button className="buy rr-go" onClick={onAgain}>↻ Again · ⛽{TRIAL_FUEL}</button>
        </div>
      </div>
    </div>
  )
}
