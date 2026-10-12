import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { useGame } from '../game/store'
import { CREW_CHEST, CREW_POINTS, msToNextWeek, payAt } from '../game/data'
import { chestsReady, fetchCrewGoal, openCrewChestOn, type CrewGoal, type CrewWeek, type Member } from '../lib/clans'
import { signedInUser } from '../lib/cloud'
import { supabase } from '../lib/supabase'
import { useNow } from '../scene/useNow'
import { PlayerName } from './Username'
import { playerName } from '../lib/profiles'
import { LoadingBand } from './Loading'

const n = (v: number) => v.toLocaleString()

// The signed-in player's crew goal, shared by the Crew window, the Friends button dot and the Goals sheet.
// failed: the server has no crew goal yet (migration not run) or can't be reached, so nothing shows.
export const useCrewGoal = create<{ goal: CrewGoal | null; ready: number; failed: boolean }>(() => ({ goal: null, ready: 0, failed: false }))

let lastReady = 0
export async function refreshCrewGoal() {
  if (!supabase || !signedInUser()) return useCrewGoal.setState({ goal: null, ready: 0 })
  const goal = await fetchCrewGoal().catch(() => undefined)
  if (goal === undefined) return useCrewGoal.setState({ failed: true })
  const ready = chestsReady(goal)
  useCrewGoal.setState({ goal, ready, failed: false })
  const s = useGame.getState()
  // A chest the server recorded but this town never got paid for (e.g. the tab closed mid-open).
  if (goal && signedInUser() && goal.chests > (s.crewChests ?? 0) && !s.visiting) {
    for (let i = s.crewChests ?? 0; i < goal.chests; i++) useGame.getState().openCrewChest()
  }
  if (ready > lastReady) s.toast('🧰 Your crew hit its weekly goal! Open your crew chest.')
  lastReady = ready
}

// Keeps the crew goal fresh while the game is open.
export function useCrewGoalWatcher() {
  const panel = useGame((s) => s.panel)
  useEffect(() => {
    if (!supabase) return
    const id = setInterval(refreshCrewGoal, 5 * 60 * 1000)
    // Fires on load too. Waits for the sign-in sync, which has to finish before a chest can be paid.
    const sub = supabase.auth.onAuthStateChange(() => setTimeout(refreshCrewGoal, 4000))
    return () => { clearInterval(id); sub.data.subscription.unsubscribe() }
  }, [])
  useEffect(() => { if (panel === 'clan' || panel === 'goals') refreshCrewGoal() }, [panel])
}

function left(ms: number) {
  const h = Math.max(1, Math.ceil(ms / 3600000))
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`
}

function Pay() {
  const level = useGame((s) => s.level)
  const pay = payAt(CREW_CHEST, level)
  return (
    <span className="goal-pay">
      <i className="coin-ico ico">$</i>{n(pay.coins)}
      <i className="buck-ico ico">💎</i>{CREW_CHEST.bucks}
      <i className="parts-ico ico">⚙</i>{CREW_CHEST.parts}
    </span>
  )
}

function useOpen() {
  const toast = useGame((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const open = async (week: string) => {
    setBusy(true)
    try {
      const total = await openCrewChestOn(week)
      // Pay up to what the server has recorded, so a double tap can never pay twice.
      const s = useGame.getState()
      for (let i = s.crewChests ?? 0; i < total; i++) useGame.getState().openCrewChest()
      lastReady = Math.max(0, lastReady - 1)
      await refreshCrewGoal()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return { busy, open }
}

// The crew's shared weekly target, who has chipped in, and the chest at the end.
export function CrewGoalCard({ members, uid }: { members: Member[]; uid: string }) {
  const goal = useCrewGoal((g) => g.goal)
  const failed = useCrewGoal((g) => g.failed)
  const now = useNow()
  const { busy, open } = useOpen()
  const w = goal?.current
  if (failed && !w) return null
  if (!goal || !w) return <LoadingBand label="Loading crew goal" />
  const min = goal.rules.minPoints
  const pct = Math.min(100, (w.points / Math.max(1, w.target)) * 100)
  const ready = goal.payable && w.reached && !w.opened && w.mine >= min
  const pts = new Map(w.members.map((m) => [m.id, m.points]))
  const roster = [...members].sort((a, b) => (pts.get(b.ownerId) ?? 0) - (pts.get(a.ownerId) ?? 0))
  const share = Math.max(1, Math.round(w.target / Math.max(1, members.length)))
  return (
    <div className={`crew-goal${w.reached ? ' reached' : ''}`}>
      {goal.last && goal.payable && <LastWeek week={goal.last} busy={busy} onOpen={() => open(goal.last!.week)} />}
      <div className="crew-goal-head">
        <b>Crew goal</b>
        <span className="crew-goal-reset">⏱ {left(msToNextWeek(now))}</span>
      </div>
      <div className="crew-track">
        <div className="crew-bar"><span style={{ width: `${pct}%` }} /></div>
        <span className={`crew-chest-ico${ready ? ' ready' : ''}`}>{w.opened ? '📭' : '🧰'}</span>
      </div>
      <div className="crew-goal-nums">
        <span><b>{n(w.points)}</b> / {n(w.target)}</span>
        <span className="crew-legend">🍕 +{CREW_POINTS.job} · 🏁 +{CREW_POINTS.race}</span>
      </div>
      <div className="crew-chips">
        {roster.map((m) => {
          const p = pts.get(m.ownerId) ?? 0
          return (
            <span key={m.ownerId} className={`crew-chip${p === 0 ? ' idle' : ''}${m.ownerId === uid ? ' me' : ''}`} title={`${playerName(m.ownerId, m.townName)}: ${p} points`}>
              <i style={{ width: `${Math.min(100, (p / share) * 100)}%` }} />
              <em>{m.ownerId === uid ? 'You' : <PlayerName id={m.ownerId} town={m.townName} />}</em>
              <b>{p === 0 ? '💤' : n(p)}</b>
            </span>
          )
        })}
      </div>
      <div className={`chest crew-chest${ready ? ' ready' : ''}${w.opened ? ' opened' : ''}`}>
        <span className="chest-icon">{w.opened ? '📭' : '🧰'}</span>
        <div className="chest-main">
          <b>Crew chest</b>
          {w.mine < min && !w.opened
            ? <small className="crew-need">Add {min - w.mine} more to earn yours</small>
            : <Pay />}
        </div>
        {w.opened ? <span className="goal-check">✔</span>
          : <button className="buy small" disabled={!ready || busy} onClick={() => open(w.week)}>{ready ? 'Open' : w.reached && w.mine >= min ? 'Soon' : '🔒'}</button>}
      </div>
    </div>
  )
}

function LastWeek({ week, busy, onOpen }: { week: CrewWeek; busy: boolean; onOpen: () => void }) {
  return (
    <div className="chest crew-chest ready last-week">
      <span className="chest-icon">🧰</span>
      <div className="chest-main">
        <b>Last week's chest</b>
        <Pay />
      </div>
      <button className="buy small" disabled={busy || week.opened} onClick={onOpen}>Open</button>
    </div>
  )
}

// One line in the Goals sheet's weekly tab: the crew's progress, tapping through to the Crew window.
export function CrewGoalMini() {
  const goal = useCrewGoal((g) => g.goal)
  const ready = useCrewGoal((g) => g.ready)
  const openPanel = useGame((s) => s.openPanel)
  const w = goal?.current
  if (!w) return null
  const pct = Math.min(100, (w.points / Math.max(1, w.target)) * 100)
  return (
    <button className={`crew-mini${ready ? ' ready' : ''}`} onClick={() => openPanel('clan')}>
      <span className="chest-icon">{w.opened ? '📭' : '🧰'}</span>
      <span className="crew-mini-main">
        <b>Crew goal {ready > 0 && <span className="tab-dot">{ready}</span>}</b>
        <span className="crew-bar"><span style={{ width: `${pct}%` }} /></span>
      </span>
      <small>{n(w.points)} / {n(w.target)}</small>
    </button>
  )
}
