import { useEffect, useMemo, useState } from 'react'
import { useGame, hasRusty, type OwnedCar } from '../game/store'
import { carDef, performance } from '../game/data'
import { supabase } from '../lib/supabase'
import { signedInUser } from '../lib/cloud'
import { townToVisit } from '../lib/friends'
import { useGhost, runGhost, raceTown, submitRun, sendTaunt, refreshTaunts, markSeen, tauntText, tauntsFor, receivedTaunt, GHOST_FUEL, type GhostResult, type Taunt } from '../lib/ghosts'
import { onDemand } from './lazy'
import { Panel } from './Menus'
import { PlayerName } from './Username'
import { isCrewMate } from '../lib/crewRaces'
import { usePrefs } from '../lib/prefs'
import { attackSpot, myWarPi, nextWarRival, submitWarRun, warStars, type WarResult } from '../lib/warMap'
import { useCrewBattle } from '../lib/battles'
import './war-result.css'

// The race itself loads with the Race menu's code, the first time a ghost race starts.
const DragRace = onDemand(() => import('./Race'), (m) => m.DragRace)

// Friend ghost races: the race itself, the result card with taunts, and the taunt inbox.

const REFRESH_MS = 120_000
const secs = (t: number) => `${t.toFixed(3)}s`
const pi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades, c.mods)

// The visit banner's button: race this town's ghost.
export function GhostButton({ town }: { town: { ownerId: string; townName: string; cars: OwnedCar[] } }) {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    await raceTown(town)
    setBusy(false)
  }
  return <button className="buy small ghost-btn" disabled={busy} onClick={go} title={`Race their best run · ⛽${GHOST_FUEL}`}>👻 Race</button>
}

// The last run's post to the server, started as it crossed the line (null: kept on this device).
let posting: { t: number; posted: Promise<GhostResult | null> | null; war?: Promise<WarResult | null> | null } | null = null

export function GhostRacePanel() {
  const ghost = useGhost((g) => g.ghost)
  const n = useGhost((g) => g.n)
  const cars = useGame((s) => s.cars)
  // Your fastest car: the one the server times you with.
  const car = useMemo(() => [...cars].sort((a, b) => pi(b) - pi(a))[0], [cars])
  if (!ghost || !car) return null
  const exit = () => useGame.getState().closePanel()
  return (
    <DragRace
      key={n}
      car={car}
      rival={{ id: 'ghost', town: `👻 ${ghost.town}`, level: 0, carName: ghost.car, color: ghost.color, pi: ghost.pi, online: false, body: ghost.body }}
      trial={{ target: ghost.target }}
      venueId="main"
      title={ghost.war ? `⚔️ War race · ${ghost.town}` : isCrewMate(ghost.owner) ? `🛡️ Crew race · ${ghost.town}` : `👻 ${ghost.town}'s ${ghost.par ? 'par time' : 'best run'}`}
      onFinish={(_won, myTime) => {
        if (ghost.war) {
          useGame.getState().crewRace()
          posting = { t: myTime, posted: null, war: ghost.real ? submitWarRun(myTime) : null }
          return
        }
        if (ghost.real && isCrewMate(ghost.owner)) useGame.getState().crewRace()
        // Posted at the line, so closing before the result card can't lose the run.
        posting = { t: myTime, posted: ghost.real && signedInUser() ? submitRun(myTime) : null }
      }}
      resultView={(r) => ghost.war
        ? <WarResultCard myTime={r.myTime} onMap={() => useGame.getState().openPanel('battle')} />
        : <GhostResultCard myTime={r.myTime} onAgain={() => runGhost(ghost)} onExit={exit} />}
      onExit={exit}
    />
  )
}

// The end-of-run card: who won, by how much, and a taunt to leave them.
function GhostResultCard({ myTime, onAgain, onExit }: { myTime: number; onAgain: () => void; onExit: () => void }) {
  const ghost = useGhost((g) => g.ghost)!
  const [run] = useState(() => (posting?.t === myTime ? posting.posted : null))
  // undefined while posting, null when this run stays on this device
  const [posted, setPosted] = useState<GhostResult | null | undefined>(run ? undefined : null)
  const [sent, setSent] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    run?.then((r) => live && setPosted(r))
    return () => { live = false }
  }, [run])
  const time = posted?.kept ?? myTime
  const their = posted ? posted.their ?? ghost.target : ghost.target
  const won = posted ? posted.won : time < their
  const gap = Math.abs(time - their)
  const taunt = async (id: number) => {
    setSent(id)
    const res = await sendTaunt(id)
    if (res !== 'sent') {
      setSent(null)
      useGame.getState().toast(res === 'limit' ? "That's enough taunts for today" : "Couldn't send that")
    }
  }
  return (
    <div className={won ? 'rr win' : 'rr lose'}>
      <div className="rr-card ghost-card">
        <div className="rr-icon">{won ? '🏆' : '👻'}</div>
        <h3 className="rr-title">{won ? 'GHOST BEATEN!' : Math.abs(gap) < 0.3 ? 'SO CLOSE!' : 'OUTRUN!'}</h3>
        <p className="rr-sub">{won ? `${secs(gap)} faster than ${ghost.town}` : `${ghost.town}'s ghost won by ${secs(gap)}`}</p>
        <div className="ghost-times">
          <span className={won ? 'win' : ''}><small>You</small><b>{secs(time)}</b></span>
          <span className={won ? '' : 'win'}><small>👻 {ghost.par ? 'Par' : 'Their best'}</small><b>{secs(their)}</b></span>
        </div>
        {isCrewMate(ghost.owner) && <p className="rr-sub crew-counts">🛡️ Counts for your crew goal and battle</p>}
        {posted === undefined && <p className="rr-sub">Posting...</p>}
        {posted && (sent === null ? (
          <div className="taunt-pick">
            <small>Leave them a taunt</small>
            <div>{tauntsFor(posted.won).map((t) => <button key={t.id} className="chip" onClick={() => taunt(t.id)}>{t.text}</button>)}</div>
          </div>
        ) : <p className="rr-sub taunt-sent">Sent “{tauntText(sent)}” 📨</p>)}
        {posted === null && ghost.real && <p className="rr-sub">{signedInUser() ? "Couldn't post this run" : 'Sign in to send taunts'}</p>}
        <div className="row trial-row">
          <button className="buy alt rr-go" onClick={onExit}>Done</button>
          <button className="buy rr-go" onClick={onAgain}>↻ Again · ⛽{GHOST_FUEL}</button>
        </div>
      </div>
    </div>
  )
}

// The end of a war race: the stars taken off the rival and the war points they add.
function WarResultCard({ myTime, onMap }: { myTime: number; onMap: () => void }) {
  const ghost = useGhost((g) => g.ghost)!
  const [run] = useState(() => (posting?.t === myTime ? posting.war ?? null : null))
  const [posted, setPosted] = useState<WarResult | null | undefined>(run ? undefined : null)
  useEffect(() => {
    let live = true
    run?.then((r) => live && setPosted(r))
    return () => { live = false }
  }, [run])
  const time = posted?.kept ?? myTime
  const their = posted?.their ?? ghost.target
  const won = posted ? posted.won : time < their
  const stars = posted ? posted.stars : warStars(time, their)
  // The next rival to race, once this run is posted (the map refreshes with its stars).
  const left = useCrewBattle((c) => (c.battle?.current && !c.battle.current.result ? c.battle.attacksLeft ?? 0 : 0))
  const next = posted === undefined ? null : nextWarRival(ghost.war?.target)
  return (
    <div className={won ? 'rr win' : 'rr lose'}>
      <div className="rr-card ghost-card war-card">
        <div className="war-stars" aria-label={`${stars} stars`}>{[1, 2, 3].map((i) => <span key={i} className={i <= stars ? 'on' : ''}>★</span>)}</div>
        <h3 className="rr-title">{won ? `${ghost.town.toUpperCase()} BEATEN!` : 'HELD THEIR GROUND'}</h3>
        <div className="ghost-times">
          <span className={won ? 'win' : ''}><small>You</small><b>{secs(time)}</b></span>
          <span className={won ? '' : 'win'}><small>⚔️ {ghost.town}</small><b>{secs(their)}</b></span>
        </div>
        <p className="rr-sub war-pts" title="Each star is 5 war points. Win by 1% for 2 stars, 3% for 3">{posted === undefined ? 'Posting...' : `⚔️ +${posted?.points ?? stars * 5} for ${ghost.war?.tag ?? 'your crew'}`}</p>
        <div className="row trial-row">
          <button className={next ? 'buy alt rr-go' : 'buy rr-go'} onClick={onMap}>🗺️ Map</button>
          {next && <button className="buy rr-go war-next" onClick={() => void attackSpot(next, myWarPi(), ghost.war?.tag ?? '')} title={`War races left today: ${left}`}>
            {next.revenge ? '🔥' : '⚔️'} {next.name}<small>🎟 {left}</small>
          </button>}
        </div>
      </div>
    </div>
  )
}

// Loads taunts once signed in, then now and then, and pops them up once when nothing else is on screen.
export function TauntWatcher() {
  const count = useGhost((g) => g.inbox.length)
  useEffect(() => {
    if (!supabase) return
    let ready = false
    const tick = () => {
      if (!signedInUser()) return
      ready = true
      refreshTaunts().catch(() => {})
    }
    const wait = setInterval(() => !ready && tick(), 2000)
    const slow = setInterval(tick, REFRESH_MS)
    return () => {
      clearInterval(wait)
      clearInterval(slow)
    }
  }, [])
  useEffect(() => {
    if (!count) return
    const id = setInterval(() => {
      const s = useGame.getState()
      // Muted taunts wait in the inbox instead of popping up.
      if (useGhost.getState().shown || usePrefs.getState().muteTaunts) return clearInterval(id)
      if (s.panel || s.levelUp || s.visiting || s.mode !== 'play' || !hasRusty(s)) return
      useGhost.setState({ shown: true })
      s.openPanel('taunts')
    }, 1000)
    return () => clearInterval(id)
  }, [count])
  return null
}

function tauntLine(t: Taunt) {
  if (t.their === null) return `raced your ghost in ${secs(t.t)}`
  return t.won ? `beat your ghost by ${secs(t.their - t.t)}` : `lost to your ghost by ${secs(t.t - t.their)}`
}

export function TauntsPanel() {
  const inbox = useGhost((g) => g.inbox)
  const muted = usePrefs((p) => p.muteTaunts)
  // Keep showing what was on screen when the panel opened; the server marks them read.
  const [shown] = useState(inbox)
  useEffect(() => markSeen(shown.map((t) => t.id)), [shown])
  const rematch = async (t: Taunt) => {
    const town = await townToVisit(t.from)
    if (town === 'stale') return
    if (!town) return useGame.getState().toast("Couldn't load that town")
    useGame.getState().visit(town)
    await raceTown(town)
  }
  return (
    <Panel title="👻 Ghost races">
      {shown.length === 0 ? (
        <div className="inv-empty" title="Visit a friend's town and tap 👻 Race to send one"><span className="empty-ico">👻</span><div>No ghost races yet</div></div>
      ) : (
        <div className="cards rows taunt-list">
          {shown.map((t) => (
            <div key={t.id} className="card taunt-note">
              <div className="welcome-ico" aria-hidden>{t.won ? '😤' : '😎'}</div>
              <div className="card-text">
                <div className="card-name"><PlayerName id={t.from} town={t.town} /></div>
                <div className="card-stat">{tauntLine(t)}</div>
                <div className="taunt-quote">{muted ? receivedTaunt(t.taunt, true) : `“${receivedTaunt(t.taunt, false)}”`}</div>
              </div>
              <button className="buy small" onClick={() => rematch(t)}>Rematch</button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
