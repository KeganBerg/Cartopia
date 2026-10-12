import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { supabase } from '../lib/supabase'
import { MAX_CHAT, firstRoom, sendChat, senderName, setMuted, useChat, viewRoom, type ChatMsg, type Room } from '../lib/chat'
import { useNames } from '../lib/profiles'
import { Panel } from './Menus'
import { ClanTag, useVisit } from './Social'
import './chat.css'

const ago = (at: number) => {
  const m = Math.floor((Date.now() - at) / 60000)
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`
}

// Messages from the same player close together share one name line.
const grouped = (prev: ChatMsg | undefined, m: ChatMsg) => !!prev && prev.owner === m.owner && m.at - prev.at < 180000

export function ChatPanel() {
  const uid = useChat((c) => c.uid)
  const crewRoom = useChat((c) => c.crewRoom)
  const unread = useChat((c) => c.unread)
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
              🌍 Global{unread.global > 0 && <i className="chat-new" aria-label="new messages" />}
            </button>
            <button role="tab" aria-selected={room === 'crew'} className={room === 'crew' ? 'sel' : ''} onClick={() => setRoom('crew')}>
              {badge ? <ClanTag clan={{ id: '', ...badge }} small /> : '🛡️'} Crew{unread.crew > 0 && <span className="tab-dot">{unread.crew > 9 ? '9+' : unread.crew}</span>}
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
    </Panel>
  )
}

function ChatRoom({ room }: { room: Room }) {
  const uid = useChat((c) => c.uid)
  const msgs = useChat((c) => c.msgs[room])
  const muted = useChat((c) => c.muted)
  // Re-render when senders' usernames arrive.
  useNames((n) => n.byId)
  const toast = useGame((s) => s.toast)
  const go = useVisit()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState<number | null>(null)
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
    setText('')
    pinned.current = true
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
          return (
            <div key={m.id} className={`chat-msg${mine ? ' mine' : ''}${first ? ' first' : ''}`}>
              {first && !mine && (
                <button className="chat-who" onClick={() => setMenu(menu === m.id ? null : m.id)}>
                  <ClanTag clan={m.crew} small />
                  <b>{senderName(m)}</b>
                  <small>Lv {m.level} · {ago(m.at)}</small>
                </button>
              )}
              {menu === m.id && (
                <div className="chat-menu">
                  <button onClick={() => { setMenu(null); void go(m.owner) }}>🏘️ Visit town</button>
                  <button onClick={() => { setMenu(null); setMuted(m.owner, senderName(m)); toast(`Muted ${senderName(m)}`) }}>🔇 Mute</button>
                </div>
              )}
              <p className="chat-bubble">{m.body}{mine && first && <small>{ago(m.at)}</small>}</p>
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
        <input
          value={text}
          maxLength={MAX_CHAT}
          enterKeyHint="send"
          placeholder={room === 'crew' ? 'Message your crew' : 'Message everyone'}
          aria-label="Message"
          onChange={(e) => setText(e.target.value)}
        />
        <button className="buy" disabled={busy || !text.trim()} aria-label="Send">➤</button>
      </form>
    </>
  )
}
