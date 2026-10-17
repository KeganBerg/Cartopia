import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { useGame, type OwnedCar } from '../game/store'
import { raceFloor } from '../game/race'
import { TRIAL_FUEL, TRIAL_PRIZES, trialPrize, trialVenue, trialWeek, shortLeft } from '../game/trial'
import { carDef, msToNextWeek } from '../game/data'
import { supabase } from '../lib/supabase'
import { signedInUser } from '../lib/cloud'
import { sfx } from '../lib/sound'
import { loadUsernames, playerName, useNames } from '../lib/profiles'
import { openPlayerCard } from '../lib/playerCard'
import { demoBoard, fetchBoard, fetchBoardCars, fetchPrizes, localBest, saveLocalBest, startRun, submitRun, type Board, type BoardCar, type BoardRow, type TrialPrizes } from '../lib/trialServer'
import { CarThumb } from '../scene/BuildingPreview'
import { StageSlot } from '../scene/Stage'
import { TrialScene, type PodiumCar } from '../scene/TrialScene'
import { LoadingBand } from './Loading'
import './time-trial.css'

// The Race menu's weekly time trial tab: this week's venue in 3D with the top three on a podium,
// the prizes, the board (every name opens that player's profile, with Visit), and runs. The Run
// button is the race bar's (Race.tsx), which asks trialRunFor() what to chase.

export type TrialRun = { target: number; ghost: string; venue: string }

const MEDAL = ['🥇', '🥈', '🥉']
const place = (n: number) => MEDAL[n - 1] ?? `#${n}`
const Bucks = ({ n }: { n: number }) => <><span className="ico buck-ico">💎</span>{n}</>
const money = (n: number) => (n >= 1000 ? `$${n / 1000}k` : `$${n}`)
const weekOf = (week: string) => new Date(`${week}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
// The server's answer to the run in progress: whether it can be posted at all.
let started: Promise<boolean> = Promise.resolve(false)

const TRIAL_CAM = { position: [0.5, 2, -4] as [number, number, number], fov: 50, near: 0.2, far: 150 }

// The week's board, shared with the race bar's Run button. undefined while loading, null if it couldn't be read.
const useBoard = create<{ board: Board | null | undefined; cars: Record<string, BoardCar> }>(() => ({ board: undefined, cars: {} }))
function loadBoard() {
  const got = supabase ? fetchBoard() : Promise.resolve(demoBoard())
  got.then(async (board) => {
    useBoard.setState({ board })
    if (!board) return
    loadUsernames(board.top.map((r) => r.owner).filter((o) => !o.startsWith('demo-')))
    const cars = await fetchBoardCars(board.top.slice(0, 10))
    if (useBoard.getState().board === board) useBoard.setState({ cars })
  })
}

// What a run chases: your own best; until you have one, a par time for your car.
export function trialRunFor(myPi: number): TrialRun {
  const v = trialVenue(trialWeek())
  const mine = useBoard.getState().board?.me?.t ?? localBest()
  return mine !== null ? { target: mine, ghost: 'Your best', venue: v.id } : { target: Math.round(raceFloor(myPi) * 1.3 * 100) / 100, ghost: 'Par', venue: v.id }
}

const lookOf = (c: OwnedCar) => {
  const d = carDef(c.model)
  return { body: d.body, model: d.id, color: c.color, finish: c.finish ?? undefined, skin: c.skin ?? undefined, modSkin: c.modSkin ?? undefined, panels: c.panels ?? undefined, mods: c.mods ?? undefined, trim: c.trim ?? undefined, hat: c.hat }
}

const pick = (r: BoardRow) => {
  sfx.tab()
  openPlayerCard(r.owner, r.town ?? '')
}

export function TrialTab({ car, myPi }: { car: OwnedCar; myPi: number }) {
  const week = trialWeek()
  const v = trialVenue(week)
  const { board, cars } = useBoard()
  const [prizes, setPrizes] = useState<TrialPrizes | null>(null)
  const claimed = useGame((s) => s.trials.claimed)
  const claim = useGame((s) => s.claimTrialPrize)
  const openPanel = useGame((s) => s.openPanel)
  const townName = useGame((s) => s.townName)
  useNames((s) => s.byId)
  const uid = signedInUser()

  useEffect(() => {
    loadBoard()
    fetchPrizes().then(setPrizes)
  }, [])

  const mine = board?.me?.t ?? localBest(week)
  const unclaimed = prizes?.prizes.filter((p) => claimed[p.week] === undefined) ?? []
  const rows = board?.top.slice(0, 10) ?? []
  const meShown = rows.some((r) => r.owner === uid)
  const leader = rows[0]?.t ?? null
  const nameOf = (r: BoardRow) => playerName(r.owner.startsWith('demo-') ? null : r.owner, r.town ?? '')

  const podium: PodiumCar[] = rows.slice(0, 3).flatMap((r) => {
    const look = cars[r.owner] ?? (r.owner === uid ? lookOf(car) : undefined)
    return look ? [{ look, name: nameOf(r), t: r.t, owner: r.owner, mine: r.owner === uid }] : []
  })
  // The podium only fills once every car on it is known, so no step pops in on its own.
  const shownPodium = podium.length === Math.min(3, rows.length) ? podium : []
  const podKey = shownPodium.map((p) => `${p.owner}${p.name}${p.t}${JSON.stringify(p.look)}`).join()
  const myLook = useMemo(() => lookOf(car), [car])
  const scene = useMemo(
    () => (
      <TrialScene
        venue={v}
        seed={`trial-${week}`}
        car={myLook}
        podium={shownPodium}
        best={mine}
        place={board?.me?.place ?? null}
        onPick={(owner) => { const r = rows.find((x) => x.owner === owner); if (r) pick(r) }}
      />
    ),
    [v, week, myLook, podKey, mine, board?.me?.place],
  )

  useEffect(() => { sfx.start() }, [])

  return (
    <div className="ttr">
      <div className="ttr-stage">
        <StageSlot cam={TRIAL_CAM}>{scene}</StageSlot>
        <div className="ttr-top">
          <span className="ttr-chip">{v.icon} {v.name}</span>
          <span className="ttr-chip ttr-left" title="Board resets in">⏳ {shortLeft(msToNextWeek())}</span>
        </div>
        <div className="ttr-prizes" title="Prizes when the week ends">
          {TRIAL_PRIZES.slice(0, 3).map((p, i) => <span key={i} className={`ttr-prize p${i + 1}`}><i>{MEDAL[i]}</i><Bucks n={p.bucks} /></span>)}
          <span className="ttr-prize p10"><i>🔟</i><Bucks n={TRIAL_PRIZES[3].bucks} /></span>
        </div>
      </div>
      <div className="ttr-side">
        {unclaimed.map((p) => {
          const prize = trialPrize(p.place)
          return (
            <div key={p.week} className="ttr-claim">
              <span className="ttr-claim-medal">{place(p.place)}</span>
              <div><b>{weekOf(p.week)}</b><small>{p.t.toFixed(3)}s</small></div>
              {prizes?.ready ? (
                <button className="buy small" onClick={() => { sfx.reward(); claim(p.week, p.place) }}>
                  🎁 {prize.bucks > 0 && <><Bucks n={prize.bucks} /> </>}{money(prize.coins)} 🏆{prize.trophies}
                </button>
              ) : <span className="trial-soon" title="Prizes are being switched on. Yours is saved.">🎁 Soon</span>}
            </div>
          )
        })}
        <div className="ttr-board" role="list" aria-label="This week's times">
          {board === undefined && <LoadingBand label="Loading lap times" />}
          {board === null && <div className="ttr-empty" title="Couldn't load the board">📡 ✖</div>}
          {board && rows.length === 0 && <div className="ttr-empty" title="No times yet this week">🏁 1st?</div>}
          {rows.map((r) => <Row key={r.owner} r={r} name={nameOf(r)} car={cars[r.owner] ?? (r.owner === uid ? lookOf(car) : undefined)} leader={leader} mine={r.owner === uid} />)}
          {board?.me && !meShown && uid && (
            <Row r={{ owner: uid, town: townName, t: board.me.t, pi: myPi, car: carDef(car.model).name, place: board.me.place }} name={playerName(uid, townName)} car={lookOf(car)} leader={leader} mine />
          )}
        </div>
        {supabase && !uid && (
          <button className="buy alt ttr-signin" onClick={() => openPanel('account')} title="Sign in to post times and win prizes">👤 Sign in</button>
        )}
      </div>
    </div>
  )
}

function Row({ r, name, car, leader, mine }: { r: BoardRow; name: string; car?: BoardCar; leader: number | null; mine?: boolean }) {
  const gap = leader !== null && r.place > 1 ? r.t - leader : null
  return (
    <button role="listitem" className={`ttr-row r${Math.min(r.place, 4)}${mine ? ' mine' : ''}`} onClick={() => pick(r)} aria-label={`${name}, ${r.t.toFixed(3)} seconds, place ${r.place}`}>
      <span className="ttr-rank">{r.place <= 3 ? MEDAL[r.place - 1] : r.place}</span>
      <span className="ttr-car">{car && <CarThumb size="xs" {...car} />}</span>
      <span className="ttr-who">
        <b>{name}</b>
        <small>{r.car && <span className="ttr-model">{r.car}</span>}<span className="rm-pi">PI {r.pi}</span></small>
      </span>
      <span className="ttr-time">
        <b>{r.t.toFixed(3)}</b>
        {gap !== null && <small>+{gap.toFixed(3)}</small>}
      </span>
      <span className="ttr-go" aria-hidden>›</span>
    </button>
  )
}

// Called as a run's countdown starts, so the server can time it.
export function beginTrialRun() {
  started = startRun()
}

// Saves and posts a run the moment it crosses the line, so closing before the
// result card shows can't lose it. The card reads the outcome from here.
let committed: { t: number; before: number | null; posted: Promise<Board | 'local'> } | null = null
export function commitTrialRun(myTime: number) {
  const before = localBest()
  saveLocalBest(myTime)
  const posted = started.then(async (ok) => (ok ? (await submitRun(myTime)) ?? 'local' : 'local'))
  committed = { t: myTime, before, posted }
}

// The end-of-run card: the time, whether it's a new best, and where it put you.
export function TrialResult({ myTime, target, ghost, onAgain, onExit }: { myTime: number; target: number; ghost: string; onAgain: () => void; onExit: () => void }) {
  const [run] = useState(() => (committed?.t === myTime ? committed : null))
  // This device's best before this run (the run itself was saved at the line).
  const before = run ? run.before : localBest()
  const [posted, setPosted] = useState<Board | null | 'local' | 'pending'>('pending')
  useEffect(() => {
    let live = true
    if (!run) setPosted('local')
    else run.posted.then((b) => live && setPosted(b))
    return () => { live = false }
  }, [run])
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
