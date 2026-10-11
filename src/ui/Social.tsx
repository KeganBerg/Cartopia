import { useCallback, useEffect, useState } from 'react'
import { useGame, type Panel as PanelId } from '../game/store'
import { BUILDINGS, CLAN_CAP, CLAN_COLORS, CLAN_COST, CLAN_EMBLEMS, garagePower } from '../game/data'
import { supabase } from '../lib/supabase'
import { fetchTown } from '../lib/friends'
import {
  METRICS, demoRows, fetchBoard, fetchClans, fetchMyClan, rankOf, statOf,
  createClan, joinClan, leaveClan, kickMember, updateClan,
  type BoardRow, type Clan, type ClanBadge, type Metric, type MyClan, type Period,
} from '../lib/clans'
import { Panel, SheetTabs } from './Menus'
import { isCleanName, NAME_REJECTED } from '../lib/names'
import { CrewGoalCard, useCrewGoal } from './CrewGoal'
import { openChat, refreshChatRooms, useChat } from '../lib/chat'
import { CrewBattleCard } from './CrewBattle'
import { demoBattle, useCrewBattle } from '../lib/battles'

const n = (v: number) => v.toLocaleString()

export function useUserId() {
  const [uid, setUid] = useState<string | null | undefined>(supabase ? undefined : null)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null))
    const sub = supabase.auth.onAuthStateChange((_e, session) => setUid(session?.user.id ?? null))
    return () => sub.data.subscription.unsubscribe()
  }, [])
  return uid
}

// Friends, Leaderboards and Crew share one window with tabs across the top.
export function SocialTabs({ current }: { current: PanelId }) {
  const openPanel = useGame((s) => s.openPanel)
  const chests = useCrewGoal((g) => g.ready) + useCrewBattle((b) => b.ready)
  const crewChat = useChat((c) => c.unread.crew)
  const globalChat = useChat((c) => c.unread.global > 0)
  const tabs: { id: PanelId; label: React.ReactNode }[] = [
    { id: 'friends', label: '👫 Friends' },
    { id: 'leaders', label: '🏅 Leaderboards' },
    { id: 'clan', label: <>🛡️ Crew{chests > 0 && <span className="tab-dot">{chests}</span>}</> },
    { id: 'chat', label: <>💬 Chat{crewChat > 0 ? <span className="tab-dot">{crewChat > 9 ? '9+' : crewChat}</span> : globalChat && <i className="chat-new" />}</> },
    { id: 'meet', label: '🚗 Meet' },
  ]
  return <SheetTabs items={tabs as { id: Exclude<PanelId, null>; label: React.ReactNode }[]} value={current ?? 'friends'} onChange={(id) => openPanel(id)} />
}

export function ClanTag({ clan, small }: { clan: ClanBadge | null; small?: boolean }) {
  if (!clan) return null
  return <span className={small ? 'clan-tag small' : 'clan-tag'} style={{ background: clan.color }}>{clan.emblem} {clan.tag}</span>
}

export function useVisit() {
  const visit = useGame((s) => s.visit)
  const toast = useGame((s) => s.toast)
  return async (id: string) => {
    const town = await fetchTown(id)
    if (!town) return toast("Couldn't load that town")
    visit(town)
  }
}

function weekResetsIn() {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7 || 7))
  const h = Math.ceil((next.getTime() - now.getTime()) / 3600000)
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`
}

function MetricPicker({ metric, setMetric, period, setPeriod, children }: { metric: Metric; setMetric: (m: Metric) => void; period: Period; setPeriod: (p: Period) => void; children?: React.ReactNode }) {
  return (
    <div className="board-controls">
      {children}
      <div className="seg metrics">
        {METRICS.map((m) => (
          <button key={m.id} className={m.id === metric ? 'sel' : ''} onClick={() => setMetric(m.id)}>
            <span className="seg-ico">{m.icon}</span>{m.label}
          </button>
        ))}
      </div>
      <div className="seg periods">
        <button className={period === 'all' ? 'sel' : ''} onClick={() => setPeriod('all')}>All time</button>
        <button className={period === 'week' ? 'sel' : ''} onClick={() => setPeriod('week')}>This week</button>
      </div>
    </div>
  )
}

export function LeadersPanel() {
  const uid = useUserId()
  const [scope, setScope] = useState<'players' | 'clans'>('players')
  const [metric, setMetric] = useState<Metric>('power')
  const [period, setPeriod] = useState<Period>('all')
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const [clans, setClans] = useState<Clan[] | null>(null)
  const [myRank, setMyRank] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const townName = useGame((s) => s.townName)
  const level = useGame((s) => s.level)
  const trophies = useGame((s) => s.trophies)
  const racesWon = useGame((s) => s.racesWon)
  const cars = useGame((s) => s.cars)
  const go = useVisit()
  const openPanel = useGame((s) => s.openPanel)
  const myPower = garagePower(cars)

  useEffect(() => {
    let live = true
    setFailed(false)
    if (scope === 'players') {
      setRows(null)
      fetchBoard(metric, period)
        .then((r) => live && setRows(r))
        .catch(() => { if (live) { setFailed(true); setRows([]) } })
    } else {
      setClans(null)
      fetchClans(metric, period)
        .then((c) => live && setClans(c))
        .catch(() => { if (live) { setFailed(true); setClans([]) } })
    }
    return () => { live = false }
  }, [scope, metric, period])

  // Neighbours fill in on all-time boards; the local player always appears.
  let list: (BoardRow & { mine?: boolean })[] | null = null
  if (rows) {
    const real = rows.map((r) => ({ ...r, mine: r.ownerId === uid }))
    const extras: (BoardRow & { mine?: boolean })[] = rows.length < 50 ? demoRows.filter((d) => period === 'all' || d.week[metric] > 0) : []
    if (!real.some((r) => r.mine) && (period === 'all' || !uid)) {
      extras.push({
        ownerId: 'me', townName, level, trophies, raceWins: racesWon, power: myPower,
        week: { power: 0, race_wins: 0, trophies: 0, level: 0 }, clan: null, mine: true,
      })
    }
    list = [...real, ...extras].sort((a, b) => statOf(b, metric, period) - statOf(a, metric, period))
    if (period === 'week') list = list.filter((r) => statOf(r, metric, period) > 0 || r.mine)
  }
  const mineShown = !!list?.some((r) => r.mine)

  // Signed-in players below the top 50 still see where they stand.
  useEffect(() => {
    setMyRank(null)
    if (!uid || !rows || rows.length < 50 || rows.some((r) => r.ownerId === uid)) return
    const mine = period === 'all' ? { power: myPower, race_wins: racesWon, trophies, level }[metric] : 0
    rankOf(metric, period, mine).then(setMyRank).catch(() => {})
  }, [uid, rows, metric, period, myPower, racesWon, trophies, level])

  const unit = METRICS.find((m) => m.id === metric)!
  return (
    <Panel title="Leaderboards" wide>
      <SocialTabs current="leaders" />
      <MetricPicker metric={metric} setMetric={setMetric} period={period} setPeriod={setPeriod}>
        <div className="seg scope">
          <button className={scope === 'players' ? 'sel' : ''} onClick={() => setScope('players')}>Players</button>
          <button className={scope === 'clans' ? 'sel' : ''} onClick={() => setScope('clans')}>Crews</button>
        </div>
      </MetricPicker>
      <p className="hint board-hint">
        {metric === 'power' && 'Power is the combined PI of your 5 best cars. Upgrade in the Garage to climb. '}
        {metric === 'race_wins' && 'Every drag race and Grand Prix win counts. '}
        {metric === 'trophies' && 'Trophies come from race wins, Grand Prix prizes and Rusty finds. '}
        {metric === 'level' && 'Earn XP from jobs, races and goals to level up. '}
        {period === 'week' && <>Weekly boards count gains since Monday and reset in <b>{weekResetsIn()}</b>.</>}
        {scope === 'clans' && ' Crews are ranked by their members combined.'}
      </p>
      {failed && <p className="hint">Couldn't reach the leaderboard right now. Showing what we have.</p>}

      {scope === 'players' ? (
        <>
          {!list && <p className="hint">Loading...</p>}
          {list && list.length === 0 && <p className="empty-board">Nobody has scored this week yet. Be the first!</p>}
          <div className="leaders">
            {list?.map((l, i) => (
              <div key={l.ownerId} className={l.mine ? 'leader board-row mine' : 'leader board-row'}>
                <span className={`rank r${i + 1}`}>{i + 1}</span>
                <div className="leader-main">
                  <b>{l.townName}{l.mine ? ' (you)' : ''}</b>
                  <div className="card-stat">
                    <ClanTag clan={l.clan} small /> Lvl {l.level}{l.demo ? ' · neighbour' : ''}
                  </div>
                </div>
                <span className="board-value">{unit.icon} {period === 'week' ? '+' : ''}{n(statOf(l, metric, period))}</span>
                {!l.mine ? (
                  <button className="buy small" onClick={() => go(l.ownerId)}>Visit</button>
                ) : <span />}
              </div>
            ))}
          </div>
          {uid && !mineShown && myRank && <p className="my-rank">You are <b>#{n(myRank)}</b> on this board.</p>}
          {supabase && uid === null && (
            <p className="hint">Sign in from the <button className="link" onClick={() => openPanel('account')}>Menu</button> to appear on the boards for everyone.</p>
          )}
        </>
      ) : (
        <>
          {!clans && <p className="hint">Loading...</p>}
          {clans && clans.length === 0 && (
            <div className="empty-board">
              No crews yet. <button className="buy small" onClick={() => openPanel('clan')}>Start the first one</button>
            </div>
          )}
          <div className="leaders">
            {clans?.map((c, i) => (
              <div key={c.id} className="leader board-row">
                <span className={`rank r${i + 1}`}>{i + 1}</span>
                <div className="leader-main">
                  <b><span className="clan-emblem" style={{ background: c.color }}>{c.emblem}</span> {c.name}</b>
                  <div className="card-stat">[{c.tag}] · {c.members}/{c.memberCap} members</div>
                </div>
                <span className="board-value">{unit.icon} {period === 'week' ? '+' : ''}{n((period === 'week' ? c.week : c.total)[metric])}</span>
                <span />
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}

export function ClanPanel() {
  const uid = useUserId()
  const openPanel = useGame((s) => s.openPanel)
  const [mine, setMine] = useState<MyClan | null | undefined>(undefined)

  const reload = useCallback(() => {
    if (!uid) return setMine(null)
    fetchMyClan(uid).then((m) => {
      setMine(m)
      useGame.setState({ clanBadge: m ? { tag: m.clan.tag, emblem: m.clan.emblem, color: m.clan.color } : null })
      void refreshChatRooms()
    }).catch(() => setMine(null))
  }, [uid])
  useEffect(() => { if (uid !== undefined) reload() }, [uid, reload])

  return (
    <Panel title="Crew" wide>
      <SocialTabs current="clan" />
      {/* ?battle=demo: the battle strip for trying it signed out. */}
      {uid === null && demoBattle() && <CrewBattleCard />}
      {!supabase ? (
        <p className="hint">Crews need an internet connection.</p>
      ) : uid === null ? (
        <div className="clan-signin">
          <span className="big-emblem">🛡️</span>
          <div>
            <b>Team up in a crew</b>
            <p>Join up to {CLAN_CAP} drivers, hit a weekly goal together for a crew chest, battle a rival crew every week, and climb the crew leaderboards.</p>
            <button className="buy" onClick={() => openPanel('account')}>Sign in to join</button>
          </div>
        </div>
      ) : mine === undefined ? (
        <p className="hint">Loading...</p>
      ) : mine ? (
        <><CrewHouseNudge /><ClanHome data={mine} uid={uid!} onChange={reload} /></>
      ) : (
        <><CrewHouseNudge /><ClanBrowser onJoined={reload} /></>
      )}
    </Panel>
  )
}

// Points players without a Crew House at the Shop.
function CrewHouseNudge() {
  const hasCrew = useGame((s) => s.buildings.some((b) => b.def === 'crew'))
  const setMode = useGame((s) => s.setMode)
  const coins = useGame((s) => s.coins)
  const level = useGame((s) => s.level)
  const showNeed = useGame((s) => s.showNeed)
  const def = BUILDINGS.find((b) => b.id === 'crew')!
  if (hasCrew) return null
  const go = () =>
    level < def.unlockLevel ? showNeed('level', def.unlockLevel, def.name)
    : coins < def.price ? showNeed('coins', def.price - coins, def.name)
    : setMode('place', 'crew')
  return (
    <div className="crew-nudge">
      <span>🏠</span>
      <div><b>Build a Crew House</b><small>Fly your crew's flag in town and tap it to open this window.</small></div>
      <button className="buy small" onClick={go}>Build · ${n(def.price)}</button>
    </div>
  )
}

function ClanHome({ data, uid, onChange }: { data: MyClan; uid: string; onChange: () => void }) {
  const { clan, members, role } = data
  const crewChat = useChat((c) => c.unread.crew)
  const toast = useGame((s) => s.toast)
  const go = useVisit()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [editing, setEditing] = useState(false)
  const [rank, setRank] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchClans('power', 'all').then((cs) => {
      const i = cs.findIndex((c) => c.id === clan.id)
      setRank(i >= 0 ? i + 1 : null)
    }).catch(() => {})
  }, [clan.id])

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await fn()
      toast(done)
      onChange()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const leaderLeaving = role === 'leader' && members.length > 1
  return (
    <div className="clan-home">
      <div className="clan-banner" style={{ ['--clan' as string]: clan.color }}>
        <span className="big-emblem">{clan.emblem}</span>
        <div className="clan-banner-main">
          <h3>{clan.name} <span className="clan-tag">{clan.tag}</span></h3>
          {clan.description && <p>{clan.description}</p>}
          <small>{clan.members}/{clan.memberCap} members{clan.minLevel > 1 ? ` · level ${clan.minLevel}+ to join` : ''}{rank ? ` · #${rank} by power` : ''}</small>
        </div>
        <button className="buy small alt clan-chat" onClick={() => openChat('crew')}>💬 Chat{crewChat > 0 && <span className="tab-dot">{crewChat > 9 ? '9+' : crewChat}</span>}</button>
      </div>
      <CrewBattleCard />
      <CrewGoalCard members={members} uid={uid} />
      <div className="clan-stats">
        {METRICS.map((m) => (
          <div key={m.id} className="clan-stat">
            <span>{m.icon}</span>
            <b>{n(clan.total[m.id])}</b>
            <small>{m.id === 'level' ? 'total levels' : m.label.toLowerCase()}</small>
            {clan.week[m.id] > 0 && <em>+{n(clan.week[m.id])} this week</em>}
          </div>
        ))}
      </div>

      {editing && role === 'leader' && <ClanEditor clan={clan} onDone={() => { setEditing(false); onChange() }} />}

      <h3>Members</h3>
      <div className="leaders">
        {members.map((m) => {
          const me = m.ownerId === uid
          return (
            <div key={m.ownerId} className={me ? 'leader member-row mine' : 'leader member-row'}>
              <span className="rank">{m.role === 'leader' ? '👑' : m.level}</span>
              <div className="leader-main">
                <b>{m.townName}{me ? ' (you)' : ''}</b>
                <div className="card-stat">Lvl {m.level} · ⚡ {n(m.power)} · 🏁 {n(m.raceWins)} · 🏆 {n(m.trophies)}</div>
              </div>
              {!me ? <button className="buy small" onClick={() => go(m.ownerId)}>Visit</button> : <span />}
              {role === 'leader' && !me ? (
                <button className="sell small" disabled={busy} onClick={() => act(() => kickMember(m.ownerId), `${m.townName} was removed`)}>Remove</button>
              ) : <span />}
            </div>
          )
        })}
      </div>

      <div className="clan-actions">
        {role === 'leader' && !editing && <button className="buy small alt" onClick={() => setEditing(true)}>✏️ Edit crew</button>}
        {!confirmLeave ? (
          <button className="sell" onClick={() => setConfirmLeave(true)}>Leave crew</button>
        ) : (
          <div className="confirm">
            <span>{leaderLeaving ? 'Leadership passes to your longest-serving member.' : members.length === 1 ? 'You are the last member, so the crew will close.' : 'Leave this crew?'}</span>
            <button className="sell" disabled={busy} onClick={() => act(leaveClan, `You left ${clan.name}`)}>Yes, leave</button>
            <button className="buy small alt" onClick={() => setConfirmLeave(false)}>Stay</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ClanEditor({ clan, onDone }: { clan: Clan; onDone: () => void }) {
  const toast = useGame((s) => s.toast)
  const [description, setDescription] = useState(clan.description)
  const [emblem, setEmblem] = useState(clan.emblem)
  const [color, setColor] = useState(clan.color)
  const [minLevel, setMinLevel] = useState(clan.minLevel)
  const save = async () => {
    if (!isCleanName(description)) return toast(NAME_REJECTED)
    try {
      await updateClan({ description, emblem, color, minLevel })
      toast('Crew updated')
      onDone()
    } catch (e) {
      toast((e as Error).message)
    }
  }
  return (
    <div className="clan-form">
      <EmblemPicker emblem={emblem} setEmblem={setEmblem} color={color} setColor={setColor} />
      <label>Motto<input value={description} maxLength={140} onChange={(e) => setDescription(e.target.value)} /></label>
      <label>Level needed to join<input type="number" min={1} max={99} value={minLevel} onChange={(e) => setMinLevel(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} /></label>
      <div className="row">
        <button className="buy" onClick={save}>Save</button>
        <button className="buy alt" onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}

function EmblemPicker({ emblem, setEmblem, color, setColor }: { emblem: string; setEmblem: (e: string) => void; color: string; setColor: (c: string) => void }) {
  return (
    <div className="emblem-picker">
      <div className="emblems">
        {CLAN_EMBLEMS.map((e) => (
          <button key={e} className={e === emblem ? 'emblem sel' : 'emblem'} style={{ background: color }} onClick={() => setEmblem(e)}>{e}</button>
        ))}
      </div>
      <div className="paints">
        {CLAN_COLORS.map((c) => (
          <button key={c} className={c === color ? 'dot big sel' : 'dot big'} style={{ background: c }} onClick={() => setColor(c)} />
        ))}
      </div>
    </div>
  )
}

function ClanBrowser({ onJoined }: { onJoined: () => void }) {
  const level = useGame((s) => s.level)
  const coins = useGame((s) => s.coins)
  const toast = useGame((s) => s.toast)
  const showNeed = useGame((s) => s.showNeed)
  const [clans, setClans] = useState<Clan[] | null>(null)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', tag: '', emblem: CLAN_EMBLEMS[0], color: CLAN_COLORS[0], description: '', minLevel: 1 })

  useEffect(() => {
    fetchClans('power', 'all').then(setClans).catch(() => setClans([]))
  }, [])

  const join = async (c: Clan) => {
    setBusy(true)
    try {
      await joinClan(c.id)
      toast(`Welcome to ${c.name}!`)
      onJoined()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const tag = form.tag.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  const valid = form.name.trim().length >= 3 && tag.length >= 2
  const create = async () => {
    if (![form.name, tag, form.description].every(isCleanName)) return toast(NAME_REJECTED)
    if (coins < CLAN_COST) return showNeed('coins', CLAN_COST - coins, 'a crew')
    setBusy(true)
    try {
      await createClan({ ...form, tag, name: form.name.trim() })
      // A cloud sync can swap the town in while the crew is being made, so charge
      // the balance as it is now and never take it below zero.
      useGame.setState((s) => ({ coins: Math.max(0, s.coins - CLAN_COST), updatedAt: Date.now() }))
      toast(`${form.name.trim()} is open for members!`)
      onJoined()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const q = search.trim().toLowerCase()
  const shown = clans?.filter((c) => !q || c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q))

  if (creating) {
    return (
      <div className="clan-form">
        <h3>Start a crew <small>${n(CLAN_COST)}</small></h3>
        <div className="clan-preview">
          <span className="big-emblem" style={{ background: form.color }}>{form.emblem}</span>
          <div><b>{form.name.trim() || 'Your crew'}</b> <span className="clan-tag" style={{ background: form.color }}>{tag || 'TAG'}</span></div>
        </div>
        <label>Name<input value={form.name} maxLength={24} placeholder="Midnight Racers" onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Tag (2 to 4 letters)<input value={tag} maxLength={4} placeholder="MR" onChange={(e) => setForm({ ...form, tag: e.target.value })} /></label>
        <EmblemPicker emblem={form.emblem} setEmblem={(emblem) => setForm({ ...form, emblem })} color={form.color} setColor={(color) => setForm({ ...form, color })} />
        <label>Motto<input value={form.description} maxLength={140} placeholder="Fast cars, faster friends" onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label>Level needed to join<input type="number" min={1} max={99} value={form.minLevel} onChange={(e) => setForm({ ...form, minLevel: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })} /></label>
        <div className="row">
          <button className="buy" disabled={!valid || busy} onClick={create}>Start crew · ${n(CLAN_COST)}</button>
          <button className="buy alt" onClick={() => setCreating(false)}>Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="clan-browser">
      <div className="clan-browser-head">
        <input className="clan-search" value={search} placeholder="Search crews" onChange={(e) => setSearch(e.target.value)} />
        <button className="buy" onClick={() => setCreating(true)}>+ Start a crew</button>
      </div>
      {!shown && <p className="hint">Loading...</p>}
      {shown && shown.length === 0 && (
        <p className="empty-board">{q ? 'No crews match that search.' : 'No crews yet. Start the first one and invite your friends!'}</p>
      )}
      <div className="leaders">
        {shown?.map((c) => {
          const full = c.members >= c.memberCap
          const low = level < c.minLevel
          return (
            <div key={c.id} className="leader clan-row">
              <span className="clan-emblem big" style={{ background: c.color }}>{c.emblem}</span>
              <div className="leader-main">
                <b>{c.name} <span className="clan-tag small" style={{ background: c.color }}>{c.tag}</span></b>
                <div className="card-stat">{c.members}/{c.memberCap} members · ⚡ {n(c.total.power)}{c.minLevel > 1 ? ` · Lvl ${c.minLevel}+` : ''}</div>
                {c.description && <div className="clan-motto">{c.description}</div>}
              </div>
              <button
                className="buy small"
                disabled={busy || full}
                onClick={() => (low ? showNeed('level', c.minLevel, c.name) : join(c))}
              >{full ? 'Full' : low ? `🔒 Lvl ${c.minLevel}` : 'Join'}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
