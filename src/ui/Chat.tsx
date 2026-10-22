import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { supabase } from '../lib/supabase'
import { MAX_CHAT, REPORT_REASONS, canDelete, deleteChat, firstRoom, reportChat, sendChat, senderName, setMuted, useChat, viewRoom, type ChatMsg, type ReportReason, type Room } from '../lib/chat'
import { useNames } from '../lib/profiles'
import { mentions } from '../lib/mentions'
import { MentionInput, MentionText } from './MentionInput'
import { PlayerCardPopup } from './PlayerCard'
import { Panel } from './Menus'
import { ClanTag, useVisit } from './Social'
import './chat.css'
import { sfx } from '../lib/sound'

const ago = (at: number) => {
  const m = Math.floor((Date.now() - at) / 60000)
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`
}

// Messages from the same player close together share one name line.
const grouped = (prev: ChatMsg | undefined, m: ChatMsg) => !!prev && prev.owner === m.owner && m.at - prev.at < 180000

const At = () => <i className="chat-at" title="You were mentioned" aria-label="mentioned you">@</i>

export function ChatPanel() {
  const uid = useChat((c) => c.uid)
  const crewRoom = useChat((c) => c.crewRoom)
  const unread = useChat((c) => c.unread)
  const pinged = useChat((c) => c.pinged)
  const badge = useGame((s) => s.clanBadge)
  const openPanel = useGame((s) => s.openPanel)
  const [room, setRoom] = useState<Room>(firstRoom)

  useEffect(() => {
    viewRoom(room)
    return () => viewRoom(null)
  }, [room, crewRoom])

  return (
    <Panel title="Chat" wide className="chat-panel">
      {!supabase && !uid ? (
        <div className="chat-empty chat-fill">
          <span>📡</span>
          <p>No connection</p>
        </div>
      ) : !uid ? (
        <div className="chat-empty chat-fill" title="Talk to everyone in the global room, or plan races with your crew">
          <span>💬</span>
          <p>🌍 Global · 🛡️ Crew</p>
          <button className="buy" onClick={() => openPanel('account')}>Sign in to chat</button>
        </div>
      ) : (
        <div className="chat">
          <div className="seg chat-rooms" role="tablist">
            <button role="tab" aria-selected={room === 'global'} className={room === 'global' ? 'sel' : ''} onClick={() => setRoom('global')}>
              🌍 Global{pinged.global > 0 ? <At /> : unread.global > 0 && <i className="chat-new" aria-label="new messages" />}
            </button>
            <button role="tab" aria-selected={room === 'crew'} className={room === 'crew' ? 'sel' : ''} onClick={() => setRoom('crew')}>
              {badge ? <ClanTag clan={{ id: '', ...badge }} small /> : '🛡️'} Crew{pinged.crew > 0 ? <At /> : unread.crew > 0 && <span className="tab-dot">{unread.crew > 9 ? '9+' : unread.crew}</span>}
            </button>
          </div>
          {room === 'crew' && !crewRoom ? (
            <div className="chat-empty">
              <span>🛡️</span>
              <p>Join a crew to chat with your crewmates.</p>
              <button className="buy small" onClick={() => openPanel('clan')}>Find a crew</button>
            </div>
          ) : (
            <ChatRoom room={room} />
          )}
        </div>
      )}
      <PlayerCardPopup />
    </Panel>
  )
}


function ChatRoom({ room }: { room: Room }) {
  const uid = useChat((c) => c.uid)
  const msgs = useChat((c) => c.msgs[room])
  const muted = useChat((c) => c.muted)
  const powers = useChat((c) => c.powers)
  // Re-render when senders' usernames arrive.
  useNames((n) => n.byId)
  const myName = useNames((n) => n.mine?.username)
  const toast = useGame((s) => s.toast)
  const go = useVisit()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [menu, setMenuId] = useState<number | null>(null)
  // The message whose Delete was tapped once: the next tap deletes it.
  const [sure, setSure] = useState<number | null>(null)
  // The message whose Report was tapped: the menu shows the reasons to pick from.
  const [reporting, setReporting] = useState<number | null>(null)
  const setMenu = (id: number | null) => { setMenuId(id); setSure(null); setReporting(null) }
  const press = useRef<number>(0)
  const log = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  const shown = msgs.filter((m) => !muted[m.owner])
  const hidden = Object.keys(muted).length

  // Stay at the newest message unless the player scrolled up to read. Keyed on
  // the newest message, not the count: a full room keeps the same count.
  const newest = shown[shown.length - 1]?.id
  useLayoutEffect(() => {
    const el = log.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [newest, room])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !text.trim()) return
    setBusy(true)
    const err = await sendChat(room, text)
    setBusy(false)
    if (err) return toast(err)
    sfx.send()
    setText('')
    pinned.current = true
  }

  // Long-press a bubble on a phone (or right-click it) for its menu.
  const holdProps = (m: ChatMsg, has: boolean) => has ? {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') return
      clearTimeout(press.current)
      press.current = window.setTimeout(() => setMenu(m.id), 450)
    },
    onPointerUp: () => clearTimeout(press.current),
    onPointerCancel: () => clearTimeout(press.current),
    onPointerLeave: () => clearTimeout(press.current),
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clearTimeout(press.current); setMenu(m.id) },
  } : {}

  const remove = async (m: ChatMsg) => {
    if (sure !== m.id) return setSure(m.id)
    setMenu(null)
    const err = await deleteChat(room, m.id)
    if (err) toast(err)
  }

  const report = async (m: ChatMsg, reason: ReportReason) => {
    setMenu(null)
    const err = await reportChat(m.id, reason)
    toast(err ?? '🚩 Reported. Thanks!')
  }

  return (
    <>
      <div
        className="chat-log"
        ref={log}
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
      >
        {shown.length === 0 && <p className="chat-quiet">{room === 'crew' ? 'No crew messages yet. Say hi!' : "It's quiet in here. Say hi!"}</p>}
        {shown.map((m, i) => {
          const mine = m.owner === uid
          const first = !grouped(shown[i - 1], m)
          const del = canDelete(room, m, { uid, powers })
          const has = del || !mine
          return (
            <div key={m.id} className={`chat-msg${mine ? ' mine' : ''}${first ? ' first' : ''}${menu === m.id ? ' open' : ''}${!mine && mentions(m.body, myName) ? ' ping' : ''}`}>
              {first && !mine && (
                <button className="chat-who" onClick={() => setMenu(menu === m.id ? null : m.id)}>
                  <ClanTag clan={m.crew} small />
                  <b data-no-i18n>{senderName(m)}</b>
                  {m.mod && <span className="chat-mod" title="Cartopia team" aria-label="Cartopia team">✔</span>}
                  <small>Lv {m.level} · {ago(m.at)}</small>
                </button>
              )}
              {menu === m.id && (
                <div className="chat-menu">
                  {!mine && <button onClick={() => { setMenu(null); void go(m.owner) }}>🏘️ Visit town</button>}
                  {!mine && <button onClick={() => { setMenu(null); setMuted(m.owner, senderName(m)); toast(`Muted ${senderName(m)}`) }}>🔇 Mute</button>}
                  {!mine && reporting !== m.id && <button onClick={() => setReporting(m.id)}>🚩 Report</button>}
                  {!mine && reporting === m.id && REPORT_REASONS.map((r) => (
                    <button key={r.id} className="chat-why" onClick={() => void report(m, r.id)}>{r.label}</button>
                  ))}
                  {del && (
                    <button className={`chat-del${sure === m.id ? ' sure' : ''}`} onClick={() => void remove(m)}>
                      🗑️ {sure === m.id ? 'Delete?' : 'Delete'}
                    </button>
                  )}
                  <button className="chat-x" aria-label="Close" onClick={() => setMenu(null)}>✕</button>
                </div>
              )}
              <div className="chat-line">
                <p className="chat-bubble" {...holdProps(m, has)}><span data-no-i18n><MentionText text={m.body} me={myName} /></span>{mine && first && <small>{ago(m.at)}</small>}</p>
                {has && menu !== m.id && (
                  <button className="chat-more" aria-label="Message options" onClick={() => setMenu(m.id)}>⋯</button>
                )}
              </div>
            </div>
          )
        })}
        {hidden > 0 && (
          <button className="chat-unmute" onClick={() => Object.keys(muted).forEach((id) => setMuted(id, null))}>
            🔇 {hidden} muted {hidden === 1 ? 'player' : 'players'} · Unmute
          </button>
        )}
      </div>
      <form className="chat-send" onSubmit={send}>
        <MentionInput
          value={text}
          maxLength={MAX_CHAT}
          enterKeyHint="send"
          placeholder={room === 'crew' ? 'Message your crew · @ a friend' : 'Message everyone · @ a friend'}
          aria-label="Message"
          onChange={setText}
        />
        <button className="buy" disabled={busy || !text.trim()} aria-label="Send">➤</button>
      </form>
    </>
  )
}
