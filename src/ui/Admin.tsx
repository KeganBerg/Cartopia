import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGame } from '../game/store'
import { CARS, carDef } from '../game/data'
import { activeEvent, liveEvents } from '../game/liveEvents'
import { admin, type AdminLogRow, type AdminPlayer, type LiveKind } from '../lib/admin'
import { useNow } from '../scene/useNow'
import { CarThumb } from '../scene/BuildingPreview'
import { Panel, SheetTabs } from './Menus'
import { CoinIcon, BuckIcon } from './Icon'
import { compact } from './format'
import './confirm.css'
import './admin.css'

// Kegan's admin panel (Menu > 🛡 for admins only). Every button is an admin_* RPC
// that the server checks and logs (0095_admin_panel.sql); this screen only drives them.

type Tab = 'live' | 'players' | 'log'
const TABS = [
  { id: 'live', label: '⚡ Live' },
  { id: 'players', label: '👤 Players' },
  { id: 'log', label: '📜 Log' },
] as const

const toast = (t: string) => useGame.getState().toast(t)

// "Are you sure?" for anything that takes something away or hits every player.
type Ask = { icon: string; title: string; ok: string; run: () => void }
function AskModal({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  return createPortal(
    <div className="flash-warn cf-modal" role="dialog" aria-modal="true" aria-labelledby="adm-ask" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fw-card cf-card">
        <div className="fw-head"><span className="fw-bolt" aria-hidden>{ask.icon}</span><h2 id="adm-ask">{ask.title}</h2></div>
        <div className="cf-actions">
          <button className="cf-no" onClick={onClose} autoFocus>Cancel</button>
          <button className="cf-yes" onClick={() => { onClose(); ask.run() }}>{ask.ok}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('live')
  const [ask, setAsk] = useState<Ask | null>(null)
  return (
    <Panel title="🛡 Admin" wide className="adm">
      <SheetTabs items={TABS} value={tab} onChange={setTab} />
      {tab === 'live' && <LiveTab confirm={setAsk} />}
      {tab === 'players' && <PlayersTab confirm={setAsk} />}
      {tab === 'log' && <LogTab />}
      {ask && <AskModal ask={ask} onClose={() => setAsk(null)} />}
    </Panel>
  )
}

// ---------------------------------------------------------------- live events

const KINDS: { id: LiveKind; icon: string; label: string; tip: string }[] = [
  { id: 'night', icon: '🌙', label: 'Night', tip: 'Night: midnight for everyone' },
  { id: 'day', icon: '☀️', label: 'Day', tip: 'Day: noon for everyone, club shut' },
  { id: 'rave', icon: '🎧', label: 'Rave', tip: 'Rave: Rave Mode in every town' },
  { id: 'weather', icon: '🌦️', label: 'Weather', tip: 'Weather: one sky for everyone' },
  { id: 'banner', icon: '📢', label: 'Banner', tip: 'Banner: a message pinned on every screen' },
]
const KIND_ICON: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.id, k.icon]))
const WEATHER = [
  ['clear', '☀️'], ['rain', '🌧️'], ['storm', '⛈️'], ['drizzle', '🌦️'], ['fog', '🌫️'],
  ['wind', '💨'], ['snow', '🌨️'], ['blizzard', '❄️'], ['mist', '🌁'], ['heat', '🥵'],
] as const
const MINUTES = [5, 15, 30, 60, 120]

function LiveTab({ confirm }: { confirm: (a: Ask) => void }) {
  const now = useNow(1000)
  const [kind, setKind] = useState<LiveKind>('night')
  const [mins, setMins] = useState(15)
  const [sky, setSky] = useState<string>('rain')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const running = liveEvents().filter((e) => e.from <= now && now < e.to)
  const needsMsg = kind === 'banner'
  const start = async () => {
    setBusy(true)
    const payload: Record<string, unknown> = {}
    if (msg.trim()) payload.message = msg.trim()
    if (kind === 'weather') payload.kind = sky
    const r = await admin.liveStart(kind, mins, payload)
    setBusy(false)
    if (r.error) return toast(`⚠️ ${r.error}`)
    setMsg('')
    toast(`${KIND_ICON[kind]} Live for ${mins} min`)
  }
  const end = async (k: string | null) => {
    const r = await admin.liveEnd(k)
    toast(r.error ? `⚠️ ${r.error}` : `⏹ Ended ${r.data ?? 0}`)
  }
  return (
    <div className="adm-live">
      {running.length > 0 && (
        <div className="adm-running">
          {running.map((e) => (
            <div key={e.id} className="adm-run" title={typeof e.payload.message === 'string' ? e.payload.message : e.kind}>
              <span className="adm-run-ico" aria-hidden>{KIND_ICON[e.kind] ?? '✨'}</span>
              <b>{e.kind}{typeof e.payload.kind === 'string' ? ` · ${e.payload.kind}` : ''}</b>
              <span className="adm-run-left">⏱ {clock(e.to - now)}</span>
              <button className="adm-stop" aria-label={`End ${e.kind}`} title="End now" onClick={() => void end(e.kind)}>⏹</button>
            </div>
          ))}
          {running.length > 1 && <button className="sell small adm-stop-all" onClick={() => confirm({ icon: '⏹', title: 'End every live event?', ok: 'End all', run: () => void end(null) })}>⏹ End all</button>}
        </div>
      )}
      <div className="adm-kinds" role="radiogroup">
        {KINDS.map((k) => (
          <button key={k.id} role="radio" aria-checked={kind === k.id} className={kind === k.id ? 'sel' : ''} title={k.tip} onClick={() => setKind(k.id)}>
            <span aria-hidden>{k.icon}</span>{k.label}
            {activeEvent([k.id], now) && <i className="adm-on" title="Running now">●</i>}
          </button>
        ))}
      </div>
      {kind === 'weather' && (
        <div className="adm-chips adm-sky">
          {WEATHER.map(([w, ico]) => (
            <button key={w} className={sky === w ? 'sel' : ''} title={w} aria-label={w} onClick={() => setSky(w)}>{ico}</button>
          ))}
        </div>
      )}
      <div className="adm-chips" aria-label="Minutes">
        {MINUTES.map((m) => (
          <button key={m} className={mins === m ? 'sel' : ''} onClick={() => setMins(m)}>⏱ {m < 60 ? `${m}m` : `${m / 60}h`}</button>
        ))}
      </div>
      <input className="adm-input" value={msg} maxLength={120} placeholder={needsMsg ? '📢 Message' : '💬 Toast (optional)'} aria-label="Message" onChange={(e) => setMsg(e.target.value)} />
      <button className="buy adm-go" disabled={busy || (needsMsg && !msg.trim())}
        onClick={() => confirm({ icon: KIND_ICON[kind], title: `Start for everyone · ${mins} min?`, ok: 'Start', run: () => void start() })}>
        ▶ Start {KINDS.find((k) => k.id === kind)!.label}
      </button>
    </div>
  )
}

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

// ---------------------------------------------------------------- players

function PlayersTab({ confirm }: { confirm: (a: Ask) => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AdminPlayer[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return setRows(null)
    let live = true
    const t = setTimeout(async () => {
      const r = await admin.find(term)
      if (!live) return
      if (r.error) toast(`⚠️ ${r.error}`)
      setRows(r.data ?? [])
    }, 300)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [q])
  if (open) return <PlayerView id={open} onBack={() => setOpen(null)} confirm={confirm} />
  return (
    <div className="adm-players">
      <input className="adm-input" value={q} placeholder="🔎 Username or town" aria-label="Find a player" autoFocus onChange={(e) => setQ(e.target.value)} />
      {rows && rows.length === 0 && <p className="hint adm-empty">🤷 No one</p>}
      <div className="adm-rows">
        {rows?.map((p) => (
          <button key={p.id} className="adm-row" onClick={() => setOpen(p.id)}>
            <span className="adm-lvl" title="Level">{p.level}</span>
            <span className="adm-who"><b>{p.username ?? '—'}</b><small>{p.town ?? ''}</small></span>
            <span className="adm-stat"><CoinIcon />{compact(p.coins)}</span>
            <span className="adm-stat"><BuckIcon />{compact(p.gems)}</span>
            {p.muted && <span title="Muted in chat">🔇</span>}
            {p.admin && <span title="Admin">🛡</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

const COIN_STEPS = [1000, 10000, 100000]
const GEM_STEPS = [10, 50, 100]
const MUTES: [number | null, string][] = [[15, '15m'], [60, '1h'], [1440, '1d'], [null, '∞']]

function PlayerView({ id, onBack, confirm }: { id: string; onBack: () => void; confirm: (a: Ask) => void }) {
  const [p, setP] = useState<AdminPlayer | null>(null)
  const [reason, setReason] = useState('')
  const [coins, setCoins] = useState(0)
  const [gems, setGems] = useState(0)
  const [carQ, setCarQ] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const r = await admin.player(id)
    if (r.error) toast(`⚠️ ${r.error}`)
    setP(r.data)
  }, [id])
  useEffect(() => {
    void load()
  }, [load])
  const carHits = useMemo(() => {
    const t = carQ.trim().toLowerCase()
    return t.length < 2 ? [] : CARS.filter((c) => !c.parked && (c.name.toLowerCase().includes(t) || c.id.includes(t))).slice(0, 6)
  }, [carQ])
  if (!p) return <div className="adm-player"><button className="buy small alt" onClick={onBack}>◀</button></div>

  const why = reason.trim()
  const run = async (step: () => Promise<{ data: unknown; error: string | null }>, done: string) => {
    if (busy) return
    setBusy(true)
    const r = await step()
    setBusy(false)
    if (r.error) return toast(`⚠️ ${r.error}`)
    toast(done)
    await load()
  }
  const money = (sign: 1 | -1) => {
    const c = sign * coins
    const g = sign * gems
    const label = `${c ? `${c > 0 ? '+' : ''}${compact(c)} 🪙 ` : ''}${g ? `${g > 0 ? '+' : ''}${g} 💎` : ''}`.trim()
    const go = () => void run(() => admin.grant(p.id, c, g, why), `✔ ${label}`).then(() => { setCoins(0); setGems(0) })
    if (sign < 0) confirm({ icon: '➖', title: `Take ${label.replace(/-/g, '')}?`, ok: 'Take', run: go })
    else go()
  }
  const noWhy = why.length < 3
  const muted = p.muted === true ? '∞' : p.muted ? new Date(p.muted).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null

  return (
    <div className="adm-player">
      <div className="adm-head">
        <button className="buy small alt" aria-label="Back" onClick={onBack}>◀</button>
        <span className="adm-lvl" title="Level">{p.level}</span>
        <span className="adm-who"><b>{p.username ?? '—'}</b><small>{p.town ?? ''}</small></span>
        <span className="adm-stat"><CoinIcon />{compact(p.coins)}</span>
        <span className="adm-stat"><BuckIcon />{compact(p.gems)}</span>
        {muted && <span className="adm-muted" title="Muted until">🔇 {muted}</span>}
      </div>

      <input className={`adm-input${noWhy ? ' need' : ''}`} value={reason} maxLength={120} placeholder="📝 Reason (logged)" aria-label="Reason" onChange={(e) => setReason(e.target.value)} />

      <h3 className="cl-head">💰 Coins and gems</h3>
      <div className="adm-money">
        <label className="adm-amt"><CoinIcon /><input type="number" min={0} value={coins || ''} placeholder="0" aria-label="Coins" onChange={(e) => setCoins(Math.max(0, Math.floor(+e.target.value || 0)))} /></label>
        {COIN_STEPS.map((n) => <button key={n} className="adm-step" onClick={() => setCoins((c) => c + n)}>+{compact(n)}</button>)}
      </div>
      <div className="adm-money">
        <label className="adm-amt"><BuckIcon /><input type="number" min={0} value={gems || ''} placeholder="0" aria-label="Gems" onChange={(e) => setGems(Math.max(0, Math.floor(+e.target.value || 0)))} /></label>
        {GEM_STEPS.map((n) => <button key={n} className="adm-step" onClick={() => setGems((g) => g + n)}>+{n}</button>)}
      </div>
      <div className="adm-pair">
        <button className="sell adm-take" disabled={busy || noWhy || (!coins && !gems)} onClick={() => money(-1)}>➖ Take</button>
        <button className="buy adm-give" disabled={busy || noWhy || (!coins && !gems)} onClick={() => money(1)}>➕ Give</button>
      </div>

      <h3 className="cl-head">🚗 Cars · {p.cars.length}</h3>
      <div className="adm-cars">
        {p.cars.map((c) => {
          const d = carDef(c.model)
          return (
            <div key={c.uid} className="adm-car" title={d.name}>
              <CarThumb size="sm" color={c.color} body={d.body} model={d.id} />
              <small>{d.name}</small>
              <button className="adm-x" aria-label={`Take ${d.name}`} disabled={busy || noWhy || p.cars.length <= 1}
                onClick={() => confirm({ icon: '🚗', title: `Take ${d.name}?`, ok: 'Take', run: () => void run(() => admin.takeCar(p.id, c.uid, why), `✔ −${d.name}`) })}>✖</button>
            </div>
          )
        })}
      </div>
      <input className="adm-input" value={carQ} placeholder="➕ Give a car: name" aria-label="Find a car" onChange={(e) => setCarQ(e.target.value)} />
      {carHits.length > 0 && (
        <div className="adm-cars">
          {carHits.map((d) => (
            <button key={d.id} className="adm-car pick" disabled={busy || noWhy} title={d.name}
              onClick={() => confirm({ icon: '🎁', title: `Give ${d.name}?`, ok: 'Give', run: () => void run(() => admin.giveCar(p.id, d.id, why), `✔ +${d.name}`).then(() => setCarQ('')) })}>
              <CarThumb size="sm" color="#e53935" body={d.body} model={d.id} />
              <small>{d.name}</small>
            </button>
          ))}
        </div>
      )}

      <h3 className="cl-head">💬 Chat</h3>
      <div className="adm-chips">
        {MUTES.map(([m, label]) => (
          <button key={label} disabled={busy || noWhy || p.admin} title={m ? `Mute ${label}` : 'Mute for good'}
            onClick={() => confirm({ icon: '🔇', title: `Mute ${p.username ?? 'player'} · ${label}?`, ok: 'Mute', run: () => void run(() => admin.mute(p.id, m, why), `🔇 ${label}`) })}>🔇 {label}</button>
        ))}
        {muted && <button className="sel" disabled={busy} onClick={() => void run(() => admin.unmute(p.id), '🔊 Unmuted')}>🔊</button>}
      </div>
      {(p.chat ?? []).length > 0 && (
        <div className="adm-msgs">
          {p.chat!.map((m) => (
            <div key={m.id} className="adm-msg">
              <span className="adm-room" title={m.room}>{m.room === 'global' ? '🌍' : '👥'}</span>
              <span className="adm-body">{m.body}</span>
              <button className="adm-x" aria-label="Delete message" disabled={busy}
                onClick={() => confirm({ icon: '🗑', title: 'Delete this message?', ok: 'Delete', run: () => void run(() => admin.chatDelete(p.id, m.id), '🗑 Deleted') })}>🗑</button>
            </div>
          ))}
          <button className="sell small" disabled={busy}
            onClick={() => confirm({ icon: '🗑', title: `Delete all their messages?`, ok: 'Delete all', run: () => void run(() => admin.chatDelete(p.id, null), '🗑 Cleared') })}>🗑 All</button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- log

const ACTION_ICON: Record<string, string> = {
  live_start: '▶', live_end: '⏹', grant: '💰', give_car: '🎁', take_car: '🚗', mute: '🔇', unmute: '🔊', chat_delete: '🗑', chat_purge: '🗑',
}

function logLine(r: AdminLogRow) {
  const d = r.detail
  const sign = (n: unknown) => (typeof n === 'number' && n > 0 ? `+${compact(n)}` : typeof n === 'number' ? `−${compact(-n)}` : '')
  switch (r.action) {
    case 'live_start': return `${KIND_ICON[String(d.kind)] ?? ''} ${d.kind} · ${d.minutes}m`
    case 'live_end': return `${d.kind ?? 'all'} · ${d.ended}`
    case 'grant': return [d.coins ? `${sign(d.coins)} 🪙` : '', d.gems ? `${sign(d.gems)} 💎` : ''].filter(Boolean).join(' ')
    case 'give_car': case 'take_car': return carDef(String(d.model)).name
    case 'mute': return d.minutes ? `${d.minutes}m` : '∞'
    case 'chat_purge': return `${d.deleted}`
    default: return ''
  }
}

function LogTab() {
  const [rows, setRows] = useState<AdminLogRow[] | null>(null)
  useEffect(() => {
    admin.log().then((r) => {
      if (r.error) toast(`⚠️ ${r.error}`)
      setRows(r.data ?? [])
    })
  }, [])
  if (!rows) return <p className="hint adm-empty">⏳</p>
  if (!rows.length) return <p className="hint adm-empty">📜 Empty</p>
  return (
    <div className="adm-rows adm-log">
      {rows.map((r) => (
        <div key={r.id} className="adm-row" title={typeof r.detail.reason === 'string' ? r.detail.reason : r.action}>
          <span className="adm-run-ico" aria-hidden>{ACTION_ICON[r.action] ?? '•'}</span>
          <span className="adm-who"><b>{logLine(r)}</b><small>{r.name ?? ''}</small></span>
          <small className="adm-when">{new Date(r.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>
        </div>
      ))}
    </div>
  )
}
