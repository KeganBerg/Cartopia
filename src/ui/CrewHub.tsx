import { useGame } from '../game/store'
import { msToNextWeek, CREW_POINTS } from '../game/data'
import { battleShare, useCrewBattle, type BattleSide } from '../lib/battles'
import { openChat, useChat } from '../lib/chat'
import { METRICS, type Clan } from '../lib/clans'
import { shortLeft } from '../game/trial'
import { useNow } from '../scene/useNow'
import { venue as venueOf } from '../scene/venues'
import { artStyle } from './venueArt'
import { Pay, useCrewGoal, useOpen } from './CrewGoal'
import { compact } from './format'
import './race-menu.css'
import './crew.css'

// The Crew window's tiles, drawn like the Race menu: thick outlines, stroked titles, tags and
// game renders behind them. The crest, the hero banner, the battle tile and the goal tile.

// A crew's crest: a shield in the crew's colour with its emblem, outlined like the race tiles.
export function Crest({ emblem, color, size = 64 }: { emblem: string; color: string; size?: number }) {
  return (
    <span className="cr-crest" style={{ '--crew': color, '--cs': `${size}px` } as React.CSSProperties} aria-hidden>
      <span className="cr-crest-in"><i>{emblem}</i></span>
    </span>
  )
}

export function CrewHero({ clan, rank }: { clan: Clan; rank: number | null }) {
  const unread = useChat((c) => c.unread.crew)
  return (
    <div className="cr-hero" style={{ '--crew': clan.color } as React.CSSProperties}>
      <Crest emblem={clan.emblem} color={clan.color} size={78} />
      <div className="cr-hero-mid">
        <span className="rm-tag">CREW · {clan.tag}</span>
        <b className="rm-ttl">{clan.name}</b>
        {clan.description && <span className="rm-bub">{clan.description}</span>}
        <span className="cr-chips">
          <span className="cr-chip">👥 {clan.members}/{clan.memberCap}</span>
          {rank && <span className="cr-chip gold">#{rank}</span>}
          {METRICS.map((m) => (
            <span key={m.id} className="cr-chip" data-m={m.id} title={m.label}>{m.icon} {compact(clan.total[m.id])}{clan.week[m.id] > 0 && <em>+{compact(clan.week[m.id])}</em>}</span>
          ))}
        </span>
      </div>
      <button className="buy alt cr-chat" onClick={() => openChat('crew')}>💬<span>Chat</span>{unread > 0 && <span className="tab-dot">{unread > 9 ? '9+' : unread}</span>}</button>
    </div>
  )
}

function Side({ s, score, lead }: { s: BattleSide; score: number; lead: boolean }) {
  return (
    <span className="cr-bside">
      <Crest emblem={s.emblem} color={s.color} size={40} />
      <span><b className={lead ? 'lead' : ''}>{score.toLocaleString()}</b><small>{s.tag}</small></span>
    </span>
  )
}

// This week's battle on a night shot of its venue: both crests, the score and the tug bar.
export function CrewBattleTile() {
  const battle = useCrewBattle((s) => s.battle)
  const failed = useCrewBattle((s) => s.failed)
  const ready = useCrewBattle((s) => s.ready)
  const openPanel = useGame((s) => s.openPanel)
  const now = useNow()
  const b = battle?.current
  if (failed || !b) return null
  const v = venueOf(b.venue)
  const share = battleShare(b.us.score, b.them.score)
  return (
    <div className="rm-tile rm-photo cr-battle" style={artStyle('tour', b.venue, true)} role="button" tabIndex={0} onClick={() => openPanel('battle')}>
      <span className="rm-tag">CREW BATTLE · ⏳ {shortLeft(msToNextWeek(now))}{ready > 0 && ' · 🧰!'}</span>
      <div className="cr-bscore">
        <Side s={b.us} score={b.us.score} lead={b.us.score >= b.them.score} />
        <span className="cr-vs">VS</span>
        <Side s={b.them} score={b.them.score} lead={b.them.score > b.us.score} />
      </div>
      <span className="cr-tug" style={{ '--us': b.us.color, '--them': b.them.color, '--split': `${(share * 100).toFixed(1)}%` } as React.CSSProperties}><i /><i /></span>
      <span className="rm-cta"><span>vs {b.them.name} · {v.icon} {v.name}</span><button className="buy small" onClick={(e) => { e.stopPropagation(); openPanel('battle') }}>Open</button></span>
    </div>
  )
}

// The weekly goal: progress to the crew chest, and the chest itself to open.
export function CrewGoalTile() {
  const goal = useCrewGoal((g) => g.goal)
  const failed = useCrewGoal((g) => g.failed)
  const now = useNow()
  const { busy, open } = useOpen()
  const w = goal?.current
  if (failed || !goal || !w) return null
  const min = goal.rules.minPoints
  const pct = Math.min(100, (w.points / Math.max(1, w.target)) * 100)
  const ready = goal.payable && w.reached && !w.opened && w.mine >= min
  const last = goal.last && goal.payable && goal.last.reached && !goal.last.opened && goal.last.mine >= min ? goal.last : null
  return (
    <div className={`rm-tile cr-goal${ready || last ? ' ready' : ''}`}>
      <span className="rm-tag">WEEKLY GOAL · ⏳ {shortLeft(msToNextWeek(now))}</span>
      <div className="cr-goal-mid">
        <span className={`cr-chest${ready || last ? ' ready' : ''}`}>{w.opened ? '📭' : '🧰'}</span>
        <span className="cr-goal-nums">
          <b className="rm-ttl">{w.points.toLocaleString()}<small> / {w.target.toLocaleString()}</small></b>
          <span className="rm-progress"><i style={{ width: `${pct}%` }} /></span>
          <small>🍕 job +{CREW_POINTS.job} · 🏁 race +{CREW_POINTS.race} · you {w.mine}</small>
        </span>
      </div>
      {last ? (
        <span className="rm-cta"><span>Last week's chest <Pay /></span><button className="buy small" disabled={busy} onClick={() => open(last.week)}>Open</button></span>
      ) : (
        <span className="rm-cta">
          <span>{w.opened ? 'Chest opened ✔' : w.mine < min ? `Add ${min - w.mine} to earn yours` : <Pay />}</span>
          {!w.opened && <button className="buy small" disabled={!ready || busy} onClick={() => open(w.week)}>{ready ? 'Open' : '🔒'}</button>}
        </span>
      )}
    </div>
  )
}
