import { useEffect, useMemo, useState } from 'react'
import { raceCarOf } from '../game/raceCar'
import { useGame, type OwnedCar } from '../game/store'
import { CARS, CLAN_COLORS, CLAN_EMBLEMS, CREW_CHEST, carDef, msToNextWeek, payAt } from '../game/data'
import { signedInUser } from '../lib/cloud'
import { useLive, challenge } from '../lib/live'
import { BATTLE_RULES, battleChests, battleShare, claimBattle, claimWarTier, demoBattle, refreshCrewBattle, useCrewBattle, warLeague, warTiers, type Battle, type BattleRecord, type BattleRules, type BattleSide, type WarLog } from '../lib/battles'
import { BattleScene } from '../scene/BattleScene'
import { venue as venueOf } from '../scene/venues'
import { useNow } from '../scene/useNow'
import { Icon } from './Icon'
import { compact } from './format'
import './crew-battle.css'
import { PlayerName } from './Username'
import { LoadingScene } from './Loading'
import { Crest } from './CrewHub'
import { artStyle } from './venueArt'
import { StageSlot, useStageReady } from '../scene/Stage'

// Drawn in the shared full-screen canvas (scene/Stage.tsx), not a new one each visit.
const BATTLE_CAM = { position: [0, 1.1, -5] as [number, number, number], fov: 55, near: 0.3, far: 150 }

// Crew battles: a strip in the Crew window and the full-screen showdown, where the two crews' cars
// face off at the start line of the week's venue with the live score and both rosters docked below.

const n = (v: number) => v.toLocaleString()

function left(ms: number) {
  const h = Math.max(1, Math.ceil(ms / 3600000))
  return h > 24 ? `${Math.floor(h / 24)}d${h % 24 ? ` ${h % 24}h` : ''}` : `${h}h`
}

// The crew's badge: emblem on its colour, and the tag.
function Badge({ s, big }: { s: BattleSide; big?: boolean }) {
  return (
    <span className={`cb-badge${big ? ' big' : ''}`} style={{ '--crew': s.color } as React.CSSProperties}>
      <i>{s.emblem}</i>
      <b>{s.tag}</b>
    </span>
  )
}

// Tug of war: our colour pushes from the left, theirs from the right, the knot at the split.
function Tug({ b }: { b: Battle }) {
  const share = battleShare(b.us.score, b.them.score)
  return (
    <div className="cb-tug" style={{ '--us': b.us.color, '--them': b.them.color, '--split': `${(share * 100).toFixed(1)}%` } as React.CSSProperties}>
      <span className="cb-tug-us" />
      <span className="cb-tug-them" />
      <span className="cb-knot">⚔️</span>
    </div>
  )
}

// One line in the Crew window: the matchup, the score and a way into the showdown.
export function CrewBattleCard() {
  const battle = useCrewBattle((s) => s.battle)
  const failed = useCrewBattle((s) => s.failed)
  const ready = useCrewBattle((s) => s.ready)
  const openPanel = useGame((s) => s.openPanel)
  const now = useNow()
  const b = battle?.current
  if (failed || !b) return null
  const ahead = b.us.score - b.them.score
  return (
    <button className={`cb-card${ready ? ' ready' : ''}`} onClick={() => openPanel('battle')}>
      <div className="cb-card-head">
        <b>⚔️ Crew war {ready > 0 && <span className="tab-dot">!</span>}</b>
        <span className="crew-goal-reset">⏱ {left(msToNextWeek(now))}</span>
      </div>
      <div className="cb-card-row">
        <Badge s={b.us} />
        <span className="cb-card-score"><b className={ahead >= 0 ? 'lead' : ''}>{n(b.us.score)}</b><Tug b={b} /><b className={ahead < 0 ? 'lead' : ''}>{n(b.them.score)}</b></span>
        <Badge s={b.them} />
      </div>
      <div className="cb-card-foot">
        <span>vs {b.them.name}{b.them.bot ? ' · street crew' : ''}</span>
        <span className="cb-go">Open ›</span>
      </div>
    </button>
  )
}

// A roster column: each member's share of their crew's points as a bar.
function Roster({ s, side, me, online }: { s: BattleSide; side: 'us' | 'them'; me: string | null; online: Map<string, string> }) {
  const top = Math.max(1, ...s.members.map((m) => m.points))
  const outgoing = useLive((l) => l.outgoing)
  const cooldownTo = useLive((l) => l.cooldownTo)
  return (
    <div className={`cb-roster ${side}`} style={{ '--crew': s.color } as React.CSSProperties}>
      {s.members.length === 0 && <span className="cb-empty">{side === 'us' ? 'Race to put your crew on the board' : 'No points yet'}</span>}
      {s.members.slice(0, 6).map((m, i) => {
        const live = side === 'them' ? online.get(m.id) : undefined
        return (
          <div key={m.id} className={`cb-row${m.id === me ? ' me' : ''}`}>
            <i style={{ width: `${(m.points / top) * 100}%` }} />
            <em>{i === 0 && m.points > 0 ? '👑 ' : ''}{m.id === me ? 'You' : <PlayerName id={m.id} town={m.name} />}</em>
            {live && (
              <button className="cb-duel" disabled={!!outgoing || (cooldownTo[live] ?? 0) > Date.now()} onClick={() => void challenge(live)} title={`Race ${m.name} live for +${BATTLE_RULES.h2h}`}>⚔️</button>
            )}
            <b>{n(m.points)}</b>
          </div>
        )
      })}
    </div>
  )
}

// What a victory or MVP chest pays at the player's level.
function ChestPay() {
  const level = useGame((s) => s.level)
  const pay = payAt(CREW_CHEST, level)
  return <span className="cb-pay">🪙{compact(pay.coins)} · 💎{CREW_CHEST.bucks} · ⚙{CREW_CHEST.parts}</span>
}

// Last week's result, with its chests to claim.
function LastBattle({ b, payable }: { b: Battle; payable: boolean }) {
  const toast = useGame((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const due = payable ? battleChests(b) : []
  // War chests the crew reached last week and this player hasn't opened yet.
  const tiers = payable ? warTiers(b).filter((t) => t.claimable) : []
  const claim = async () => {
    if (demoBattle()) return toast('This is a demo war')
    setBusy(true)
    try {
      if (due.length) await claimBattle(b.week)
      for (const t of tiers) await claimWarTier(b.week, t.tier)
      toast(`${'🧰'.repeat(due.length + tiers.length)} Chests opened!`)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const head = b.result === 'win' ? '🏆 Victory!' : b.result === 'draw' ? '🤝 Draw' : '💥 Defeat'
  return (
    <div className={`cb-last ${b.result ?? ''}`}>
      <div className="cb-last-main">
        <b>{head}</b>
        <small>Last week · {n(b.us.score)}–{n(b.them.score)} vs {b.them.tag}</small>
      </div>
      {due.length + tiers.length > 0
        ? <button className="cb-claim" disabled={busy} onClick={claim}>{[...due.map((k) => (k === 'mvp' ? '👑' : '🏆')), ...tiers.map(() => '🧰')].join('')} Claim<ChestPay /></button>
        : b.result !== 'loss' && b.mine < BATTLE_RULES.minPoints
          ? <small className="cb-last-note">Score {BATTLE_RULES.minPoints}+ to earn chests</small>
          : b.claimed.length > 0 ? <span className="goal-check">✔</span> : null}
    </div>
  )
}

// A car for the rival crew: one near the player's own in class, picked by the crew so it stays put,
// painted in the crew's colour. Bikes, buses and the like sit this one out.
const SHOWDOWN = new Set(['scooter', 'chopper', 'sportbike', 'bus', 'dogvan', 'tank', 'van', 'icecream', 'parcel', 'monster'])
function rivalCar(mine: OwnedCar, tag: string) {
  const price = carDef(mine.model).price || 20000
  const near = CARS.filter((c) => c.price > 0 && !c.rescueOnly && !c.season && !c.secret && !c.pack && !SHOWDOWN.has(c.body)).sort((a, b) => Math.abs(Math.log(a.price / price)) - Math.abs(Math.log(b.price / price))).slice(0, 5)
  let h = 0
  for (const ch of tag) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return near[h % near.length] ?? CARS[0]
}

// No crew yet: two crests squaring off under the lights, and the way into the crew list.
function NoCrew({ onFind, children }: { onFind: () => void; children?: React.ReactNode }) {
  return (
    <div className="cb-none rm-photo" style={artStyle('tour', 'main', true)}>
      <div className="cb-none-card">
        <div className="cb-none-vs">
          <Crest emblem={CLAN_EMBLEMS[0]} color={CLAN_COLORS[0]} size={76} />
          <span className="cr-vs">VS</span>
          <Crest emblem="❔" color="#546e7a" size={76} />
        </div>
        <b className="rm-ttl">Crew Wars</b>
        <span className="cb-none-sub">⚔️ Weekly crew war · 🧰 war chests</span>
        <button className="buy cb-none-go" onClick={onFind}>🛡️ Find a crew</button>
        {children}
      </div>
    </div>
  )
}

// The war chest track: the crew's score climbing to par, a chest at each tier. Every member who has scored
// enough opens each chest the crew reaches, win or lose.
function WarTrack({ b, rules }: { b: Battle; rules: BattleRules }) {
  const toast = useGame((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const tiers = warTiers(b, rules)
  if (!tiers.length) return null
  const par = b.par!
  const pct = (v: number) => `${Math.min(100, (v / par) * 100).toFixed(1)}%`
  const claim = async (tier: 1 | 2) => {
    if (demoBattle()) return toast('This is a demo war')
    setBusy(true)
    try {
      await claimWarTier(b.week, tier)
      toast('🧰 War chest opened!')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="cb-track" style={{ '--us': b.us.color } as React.CSSProperties}>
      <div className="cb-track-bar" title={`Crew war points ${n(b.us.score)} of ${n(par)}`}>
        <i style={{ width: pct(b.us.score) }} />
        {tiers.map((t) => (
          <button key={t.tier} className={`cb-node${t.reached ? ' on' : ''}${t.claimable ? ' ready' : ''}${t.claimed ? ' done' : ''}`}
            style={{ left: pct(t.need) }} disabled={busy || !t.claimable}
            title={t.claimed ? 'Opened' : t.reached ? (b.mine < rules.minPoints ? `Score ${rules.minPoints} to open` : 'Open') : `Crew reaches ${n(t.need)}`}
            onClick={() => claim(t.tier)}>
            {t.claimed ? '✔' : '🧰'}
            <small>{compact(t.need)}</small>
          </button>
        ))}
      </div>
      <span className="cb-track-end" title="Win the war: victory chest. Top scorer: MVP chest">🏆</span>
    </div>
  )
}

// The player's part in the war: their points toward the member cap, what each race adds, and the race button.
function YourPart({ b, rules }: { b: Battle; rules: BattleRules }) {
  const openPanel = useGame((s) => s.openPanel)
  const meRow = b.us.members.find((m) => m.id === (demoBattle() ? 'me' : signedInUser()))
  return (
    <div className="cb-you">
      <div className="cb-you-main">
        <div className="cb-you-head"><b>You</b><span>{n(b.mine)}<small>/{n(rules.memberCap)}</small></span></div>
        <div className="cb-you-bar"><i style={{ width: `${Math.min(100, (b.mine / rules.memberCap) * 100)}%` }} /></div>
        <div className="cb-you-gain">
          <span title={`Any race · ${meRow?.races ?? 0} this war`}>🏁 +{rules.race}</span>
          <span title={`Race won · ${meRow?.wins ?? 0} this war`}>🏆 +{rules.race + rules.win}</span>
          <span title="Live race won">⚡ +{rules.live}</span>
          <span className="h2h" title="Live race won against the rival crew">⚔️ +{rules.h2h}</span>
        </div>
      </div>
      <button className="cb-race" onClick={() => openPanel('race')}>🏁 Race</button>
    </div>
  )
}

// The crew's past wars, newest first.
function WarLogList({ log, record }: { log: WarLog[]; record: BattleRecord }) {
  if (!log.length) return <span className="cb-empty">📜 Finished wars show here</span>
  return (
    <div className="cb-log">
      <div className="cb-log-sum">{record.wins}W {record.losses}L{record.draws ? ` ${record.draws}D` : ''}{record.streak > 1 ? ` · 🔥${record.streak}` : ''}</div>
      {log.map((w) => (
        <div key={w.week} className={`cb-log-row ${w.result ?? ''}`}>
          <i>{w.result === 'win' ? '🏆' : w.result === 'draw' ? '🤝' : '💥'}</i>
          <Badge s={{ ...w.rival, score: 0, members: [] }} />
          <em>{w.rival.name}</em>
          <b>{n(w.us)}–{n(w.them)}</b>
        </div>
      ))}
    </div>
  )
}

export function BattlePanel() {
  const battle = useCrewBattle((s) => s.battle)
  const cars = useGame((s) => s.cars)
  const openPanel = useGame((s) => s.openPanel)
  const players = useLive((l) => l.players)
  const now = useNow()
  const close = () => openPanel('clan')
  const raceCar = useGame((s) => s.raceCar)
  const car = useMemo(() => raceCarOf(cars, raceCar), [cars, raceCar])
  const b = battle?.current ?? null
  const rival = useMemo(() => (car && b ? rivalCar(car, b.them.tag) : null), [car, b])
  // Rival crew members in the live lobby right now, by account: they can be challenged here.
  const online = useMemo(() => new Map(players.filter((p) => p.uid).map((p) => [p.uid as string, p.id])), [players])
  // Memoised so the clock's tick each second doesn't redraw the scene.
  const scene = useMemo(() => !b || !car || !rival ? null : (
    <BattleScene venue={venueOf(b.venue)} lead={b.us.score - b.them.score}
      mine={{ body: carDef(car.model).body, model: car.model, color: car.color, finish: car.finish, skin: car.skin, modSkin: car.modSkin, panels: car.panels, mods: car.mods, hat: car.hat }}
      theirs={{ body: rival.body, model: rival.id, color: b.them.color }}
      us={{ tag: b.us.tag, color: b.us.color }} them={{ tag: b.them.tag, color: b.them.color }} />
  ), [b, car, rival])
  const stageReady = useStageReady()
  const [tab, setTab] = useState<'crews' | 'log'>('crews')
  useEffect(() => {
    if (!battle) refreshCrewBattle()
  }, [battle])
  if (!b || !car || !rival) {
    const noCrew = battle === null || !battle.current
    return (
      <div className="race-full cb-full">
        {/* No crew now (never had one, or left): last week's chests, if any, still claim here. */}
        {noCrew && <NoCrew onFind={() => openPanel('clan')}>{battle?.last && <LastBattle b={battle.last} payable={battle.payable} />}</NoCrew>}
        <div className="rf-top"><h2>⚔️ Crew War</h2><button className="close" onClick={close} aria-label="Close"><Icon name="close" size={16} /></button></div>
        {!noCrew && <LoadingScene key="cb" ready={false} max={Infinity} label="Finding your rival crew" onClose={close} />}
      </div>
    )
  }
  const me = demoBattle() ? 'me' : signedInUser()
  const v = venueOf(b.venue)
  const rec = battle!.record
  const rules = { ...BATTLE_RULES, ...battle!.rules }
  const league = warLeague(rec)
  return (
    <div className="race-full cb-full">
      <StageSlot cam={BATTLE_CAM}>{scene}</StageSlot>
      <LoadingScene key="cb" ready={stageReady} label="Finding your rival crew" onClose={close} />
      <div className="rf-top">
        <h2>⚔️ Crew War <span className="cb-league" title={`War league · rating ${league.rating}${league.next ? ` · ${league.next.name} at ${league.next.min}` : ''}`}>{league.icon} {league.name}</span></h2>
        <button className="close" onClick={close} aria-label="Close"><Icon name="close" size={16} /></button>
      </div>
      <div className="cb-board">
        <div className="cb-side us">
          <Badge s={b.us} big />
          <b className="cb-score">{n(b.us.score)}</b>
        </div>
        <div className="cb-mid">
          <span className="cb-vs">VS</span>
          <span className="cb-time">⏱ {left(msToNextWeek(now))}</span>
        </div>
        <div className="cb-side them">
          <b className="cb-score">{n(b.them.score)}</b>
          <Badge s={b.them} big />
        </div>
        <Tug b={b} />
        <div className="cb-names"><span>{b.us.name}</span><span className="cb-venue">{v.icon} {v.name}</span><span>{b.them.name}</span></div>
      </div>
      <div className="cb-dock">
        {battle!.last && <LastBattle b={battle!.last} payable={battle!.payable} />}
        <WarTrack b={b} rules={rules} />
        <div className="seg cb-tabs">
          <button className={tab === 'crews' ? 'sel' : ''} onClick={() => setTab('crews')}>⚔️ Crews</button>
          <button className={tab === 'log' ? 'sel' : ''} onClick={() => setTab('log')}>📜 Log</button>
        </div>
        {tab === 'crews' ? (
          <div className="cb-rosters">
            <Roster s={b.us} side="us" me={me} online={online} />
            <Roster s={b.them} side="them" me={me} online={online} />
          </div>
        ) : <WarLogList log={battle!.log ?? []} record={rec} />}
        <YourPart b={b} rules={rules} />
      </div>
    </div>
  )
}
