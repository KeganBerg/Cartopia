import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../game/store'
import { CLAN_EMBLEMS, carDef } from '../game/data'
import { CarThumb } from '../scene/BuildingPreview'
import { useLive, challenge } from '../lib/live'
import { GHOST_FUEL } from '../lib/ghosts'
import { CREW_DEMO, demoLadder, fetchLadder, nextUp, raceCrewMate, useCrewMates, type Racer } from '../lib/crewRaces'
import { DEMO } from '../lib/friends'
import type { Member, MyClan } from '../lib/clans'
import { useCrewGoal } from './CrewGoal'
import { PlayerName } from './Username'
import { useVisit } from './Social'
import { LoadingBand } from './Loading'
import { artStyle } from './venueArt'
import './crew.css'

// The crew ladder: every crewmate's race car, ranked by their best run. Top three stand on the
// podium; tap Race to run a crewmate's ghost (or race them live when they're online). Crew races
// count for the crew goal and the crew battle.

const secs = (t: number) => `${t.toFixed(3)}s`
const MEDAL = ['🥇', '🥈', '🥉']

type Mate = { ownerId: string; townName: string; level: number }

function Car({ r }: { r: Racer }) {
  if (!r.car) return <div className="thumb3d cl-nocar">🚫</div>
  const d = carDef(r.car.model)
  const c = r.car
  return <CarThumb color={c.color} finish={c.finish} skin={c.skin} modSkin={c.modSkin} hat={c.hat} body={d.body} model={d.id} stripe={c.stripe} mods={c.mods} />
}

// Race this crewmate: live when they're in the lobby, otherwise their ghost.
function RaceBtn({ r, me, online }: { r: Racer; me: string; online: Map<string, string> }) {
  const outgoing = useLive((l) => l.outgoing)
  const cooldownTo = useLive((l) => l.cooldownTo)
  if (r.id === me) return null
  const live = online.get(r.id)
  if (live) {
    return <button className="buy small cl-race live" disabled={!!outgoing || (cooldownTo[live] ?? 0) > Date.now()} onClick={() => void challenge(live)}>⚡ Live</button>
  }
  return <button className="buy small cl-race" disabled={r.time === null} onClick={() => raceCrewMate(r)}>🏁 Race<small>⛽{GHOST_FUEL}</small></button>
}

function Name({ r, me }: { r: Racer; me: string }) {
  const go = useVisit()
  if (r.id === me) return <b className="cl-name">You</b>
  return <button className="cl-name link" onClick={() => !r.demo && go(r.id)}><PlayerName id={r.demo ? null : r.id} town={r.name} /></button>
}

const timeOf = (r: Racer) => (r.time === null ? '—' : r.par ? 'No time' : secs(r.time))

export function CrewLadder({ members, uid }: { members: Mate[]; uid: string }) {
  const players = useLive((l) => l.players)
  const cars = useGame((s) => s.cars)
  const townName = useGame((s) => s.townName)
  const level = useGame((s) => s.level)
  const [ladder, setLadder] = useState<Racer[] | null>(null)
  const key = members.map((m) => m.ownerId).join(',')

  useEffect(() => {
    useCrewMates.setState({ ids: members.map((m) => m.ownerId).filter((id) => id !== uid) })
    if (CREW_DEMO) return setLadder(demoLadder({ id: uid, name: townName, level, cars }))
    let live = true
    fetchLadder(members).then((l) => live && setLadder(l)).catch(() => live && setLadder([]))
    return () => { live = false }
    // Reload when the roster changes, or when the panel comes back after a race.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, uid])

  // Crewmates in the live lobby right now, by account.
  const online = useMemo(() => new Map(players.filter((p) => p.uid).map((p) => [p.uid as string, p.id])), [players])
  if (!ladder) return <div className="rm-tile cl cl-wait"><LoadingBand label="Lining up the crew" /></div>
  if (!ladder.length) return null
  const podium = ladder.slice(0, 3)
  // #2 on the left, #1 in the middle, #3 on the right.
  const order = [podium[1], podium[0], podium[2]].filter(Boolean) as Racer[]
  const rest = ladder.slice(3)
  const up = nextUp(ladder, uid)
  const myRank = ladder.findIndex((r) => r.id === uid) + 1

  return (
    <div className="rm-tile rm-photo cl" style={artStyle('camp', 'main')}>
      <span className="rm-tag">CREW LADDER</span>
      <div className={`cl-podium n${order.length}`}>
        {order.map((r) => {
          const rank = ladder.indexOf(r)
          return (
            <div key={r.id} className={`cl-spot p${rank + 1}${r.id === uid ? ' me' : ''}${online.has(r.id) ? ' on' : ''}`}>
              <div className="cl-car"><Car r={r} /></div>
              <div className="cl-step">
                <em>{MEDAL[rank]}</em>
                <Name r={r} me={uid} />
                <span className="cl-time">{timeOf(r)}</span>
                <RaceBtn r={r} me={uid} online={online} />
              </div>
            </div>
          )
        })}
      </div>
      {rest.length > 0 && (
        <div className="cl-rows">
          {rest.map((r, i) => (
            <div key={r.id} className={`cl-row${r.id === uid ? ' me' : ''}${online.has(r.id) ? ' on' : ''}`}>
              <span className="cl-rank">{i + 4}</span>
              <div className="cl-car sm"><Car r={r} /></div>
              <div className="cl-main">
                <Name r={r} me={uid} />
                <small><span className="rm-pi">PI {r.pi}</span> {r.carName}</small>
              </div>
              <span className="cl-time">{timeOf(r)}</span>
              <RaceBtn r={r} me={uid} online={online} />
            </div>
          ))}
        </div>
      )}
      {myRank > 0 && (
        <span className="rm-cta cl-me">
          {myRank === 1 || !up
            ? <span>👑 You're the crew's fastest. Defend it!</span>
            : <span>You're <b>#{myRank}</b> · {up.gap !== null ? <><b>{up.gap.toFixed(3)}s</b> off </> : 'set a time to pass '}<PlayerName id={up.racer.demo ? null : up.racer.id} town={up.racer.name} /></span>}
          {up && myRank > 1 && <RaceBtn r={up.racer} me={uid} online={online} />}
        </span>
      )}
      <span className="cl-foot">🛡️ Crew races count for the weekly goal and the battle</span>
    </div>
  )
}

// The made-up crew behind ?crew=demo: you and the three neighbours, with a goal in progress.
let demoCache: MyClan | null = null
export function demoCrew(): MyClan {
  if (demoCache) return demoCache
  const s = useGame.getState()
  const row = (id: string, townName: string, level: number, power: number, week: number): Member => ({
    ownerId: id, townName, level, trophies: level * 6, raceWins: level * 9, power,
    week: { power: 0, race_wins: week, trophies: 0, level: 0 }, clan: null, role: id === 'me' ? 'leader' : 'member', joinedAt: '2026-10-01',
  })
  const members = [row('me', s.townName || 'Your town', s.level, 320, 12), ...DEMO.map((d, i) => row(d.id, d.name, d.level, 150 + d.level * 22, 4 + i * 3))]
  // Outside render: the Crew window calls this while drawing.
  setTimeout(() => useCrewGoal.setState({
    failed: false, ready: 0,
    goal: {
      rules: { minPoints: 30, memberCap: 360 }, chests: 0, payable: true, last: null,
      current: { week: '2026-10-12', target: 480, points: 371, reached: false, mine: 141, opened: false, members: members.map((m, i) => ({ id: m.ownerId, points: [141, 112, 0, 118][i] ?? 0, jobs: 0, races: 0 })) },
    },
  }), 0)
  const total = { power: 1231, race_wins: 384, trophies: 564, level: members.reduce((a, m) => a + m.level, 0) }
  return demoCache = {
    role: 'leader', members,
    clan: { id: 'demo-crew', name: 'Night Shift', tag: 'NSH', emblem: CLAN_EMBLEMS[0], color: '#1e88e5', description: 'Fast cars, faster friends', leaderId: 'me', memberCap: 20, minLevel: 1, members: members.length, total, week: { power: 40, race_wins: 19, trophies: 22, level: 1 } },
  }
}
