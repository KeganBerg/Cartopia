import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../game/store'
import { sfx } from '../lib/sound'
import { useLive } from '../lib/live'
import { playerName } from '../lib/profiles'
import {
  JOIN_MODES, RANKS, canRemove, canSetRank, fetchCrewRequests, fetchPlayers, kickMember, respondRequest, setRank,
  type BoardRow, type Member, type MyClan, type Rank,
} from '../lib/clans'
import { PlayerName } from './Username'
import { openPlayerCard } from '../lib/playerCard'
import './crew.css'

// The bottom of the Crew window: join requests for the Leader and Co-Leaders, then every member
// with their rank. Leaders and Co-Leaders open a row's ⋯ for what they may do to that player.

const n = (v: number) => v.toLocaleString()

export type Ask = { id: string; row: BoardRow | null }

export function RankBadge({ rank }: { rank: Rank }) {
  const r = RANKS[rank]
  return <span className={`cm-rank r-${rank}`} title={`${r.label}${rank === 'leader' ? ': runs the crew' : rank === 'co_leader' ? ': requests, settings, removes Members' : ''}`}>{r.icon}</span>
}

const DEMO_ASKS: Ask[] = [
  { id: 'demo-ask-1', row: { ownerId: 'demo-ask-1', townName: 'Maple Bend', level: 14, trophies: 0, raceWins: 0, power: 540, week: { power: 0, race_wins: 0, trophies: 0, level: 0 }, clan: null, demo: true } },
  { id: 'demo-ask-2', row: { ownerId: 'demo-ask-2', townName: 'Rust Valley', level: 9, trophies: 0, raceWins: 0, power: 310, week: { power: 0, race_wins: 0, trophies: 0, level: 0 }, clan: null, demo: true } },
]

// Join requests waiting on this crew. Officers only; the demo crew shows two.
export function useRequests(on: boolean, demo: boolean, key: number) {
  const [asks, setAsks] = useState<Ask[]>([])
  useEffect(() => {
    if (!on) return setAsks([])
    if (demo) return setAsks(DEMO_ASKS)
    let live = true
    fetchCrewRequests()
      .then(async (rs) => {
        const rows = await fetchPlayers(rs.map((r) => r.id)).catch(() => new Map<string, BoardRow>())
        if (live) setAsks(rs.map((r) => ({ id: r.id, row: rows.get(r.id) ?? null })))
      })
      .catch(() => live && setAsks([]))
    return () => { live = false }
  }, [on, demo, key])
  return [asks, setAsks] as const
}

type Requests = { asks: Ask[]; setAsks: (f: (l: Ask[]) => Ask[]) => void; reload: () => void }

export function CrewMembers({ data, uid, onChange, demo = false, requests }: { data: MyClan; uid: string; onChange: () => void; demo?: boolean; requests: Requests }) {
  const { clan, members, role } = data
  const toast = useGame((s) => s.toast)
  const go = (id: string, town: string) => openPlayerCard(id, town)
  const players = useLive((l) => l.players)
  const online = useMemo(() => new Set(players.map((p) => p.uid).filter(Boolean)), [players])
  const { asks, setAsks, reload } = requests
  const [open, setOpen] = useState<string | null>(null)
  // A second tap on the same action confirms it (Remove, hand over the lead).
  const [sure, setSure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mode = JOIN_MODES.find((m) => m.id === clan.joinMode)!
  const full = members.length >= clan.memberCap

  const run = async (fn: () => Promise<unknown>, done: string, good = true) => {
    if (demo) { sfx.click(); return toast(done) }
    setBusy(true)
    try {
      await fn()
      if (good) sfx.unlock(); else sfx.click()
      toast(done)
      setOpen(null)
      setSure(null)
      onChange()
      reload()
    } catch (e) {
      sfx.error()
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const answer = async (a: Ask, accept: boolean) => {
    const name = playerName(a.id, a.row?.townName ?? 'Driver')
    if (demo) { setAsks((l) => l.filter((x) => x.id !== a.id)); return accept ? (sfx.unlock(), toast(`${name} joined`)) : sfx.click() }
    setBusy(true)
    try {
      const r = await respondRequest(a.id, accept)
      setAsks((l) => l.filter((x) => x.id !== a.id))
      if (r === 'joined') { sfx.unlock(); toast(`${name} joined`); onChange() }
      else if (r === 'gone') toast(`${name} is no longer asking`)
      else sfx.click()
    } catch (e) {
      sfx.error()
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const confirm = (key: string, fn: () => void) => {
    if (sure === key) return fn()
    sfx.click()
    setSure(key)
  }

  const actions = (m: Member) => {
    const name = playerName(m.ownerId, m.townName)
    const out: React.ReactNode[] = []
    if (canSetRank(role, m.role)) {
      out.push(m.role === 'member'
        ? <button key="up" className="buy small" disabled={busy} title="Make Co-Leader" onClick={() => run(() => setRank(m.ownerId, 'co_leader'), `${name} is a Co-Leader`)}>⬆ 🎖️</button>
        : <button key="down" className="buy small alt" disabled={busy} title="Make Member" onClick={() => run(() => setRank(m.ownerId, 'member'), `${name} is a Member`, false)}>⬇ 🛡️</button>)
      out.push(<button key="lead" className="buy small gold" disabled={busy} title="Hand over the lead" onClick={() => confirm(`lead:${m.ownerId}`, () => run(() => setRank(m.ownerId, 'leader'), `${name} leads the crew`))}>{sure === `lead:${m.ownerId}` ? '✔ Sure?' : '👑'}</button>)
    }
    if (canRemove(role, m.role)) {
      out.push(<button key="kick" className="sell small" disabled={busy} title="Remove from crew" onClick={() => confirm(`kick:${m.ownerId}`, () => run(() => kickMember(m.ownerId), `${name} was removed`, false))}>{sure === `kick:${m.ownerId}` ? '✔ Sure?' : '✖'}</button>)
    }
    return out
  }

  return (
    <div className="rm-tile cm">
      {asks.length > 0 && (
        <div className="cm-asks">
          <span className="rm-tag cm-ask-tag">✋ REQUESTS · {asks.length}</span>
          {asks.map((a) => (
            <div key={a.id} className="cm-row ask">
              <span className="cm-rank ask" aria-hidden>✋</span>
              <div className="cm-main">
                <button className="cm-name link" onClick={() => !demo && go(a.id, a.row?.townName ?? 'Driver')}><PlayerName id={demo ? null : a.id} town={a.row?.townName ?? 'Driver'} /></button>
                <small>⭐ {a.row?.level ?? '?'} · ⚡ {n(a.row?.power ?? 0)}</small>
              </div>
              <div className="cm-acts">
                <button className="buy small" disabled={busy || full} title={full ? 'Crew is full' : 'Accept'} onClick={() => answer(a, true)}>✔</button>
                <button className="sell small" disabled={busy} title="Turn down" onClick={() => answer(a, false)}>✖</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="cm-head">
        <span className="rm-tag">MEMBERS</span>
        <span className="cr-chip" title={mode.tip}>{mode.icon} {mode.label}</span>
      </div>
      <div className="cm-list">
        {members.map((m) => {
          const acts = m.ownerId === uid ? [] : actions(m)
          const me = m.ownerId === uid
          return (
            <div key={m.ownerId} className={`cm-row${me ? ' me' : ''}${open === m.ownerId ? ' open' : ''}`}>
              <RankBadge rank={m.role} />
              <div className="cm-main">
                {me ? <b className="cm-name">You</b> : (
                  <button className="cm-name link" onClick={() => !demo && go(m.ownerId, m.townName)}>
                    <PlayerName id={demo ? null : m.ownerId} town={m.townName} />
                  </button>
                )}
                <small>{online.has(m.ownerId) && !me && <i className="cm-on" title="Online" />}{m.role !== 'member' && <em className={`cm-rk r-${m.role}`}>{RANKS[m.role].label}</em>}⭐ {m.level} · ⚡ {n(m.power)}</small>
              </div>
              {acts.length > 0 && (
                open === m.ownerId
                  ? <div className="cm-acts">{acts}<button className="buy small alt" title="Close" onClick={() => { setOpen(null); setSure(null) }}>↩</button></div>
                  : <button className="buy small alt cm-more" title="Manage" onClick={() => { sfx.click(); setOpen(m.ownerId); setSure(null) }}>⋯</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
