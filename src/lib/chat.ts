import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useGame } from '../game/store'
import { CLAN_EMBLEMS } from '../game/data'
import { displayName, isCleanChat, isCleanName } from './names'
import type { ClanBadge } from './clans'

// Global chat and crew chat (supabase/migrations/0048_chat.sql). Messages are sent through
// chat_send(), which filters and rate-limits them and broadcasts each one on the private
// Realtime topic chat:<room>. Rooms: 'global', and 'crew:<clan id>' for the player's crew.

export type Room = 'global' | 'crew'
export type ChatMsg = { id: number; owner: string; name: string; level: number; crew: ClanBadge | null; body: string; at: number }

type ChatState = {
  uid: string | null
  // The player's crew room ('crew:<id>'), or null outside a crew.
  crewRoom: string | null
  msgs: Record<Room, ChatMsg[]>
  // Messages that came in while that room wasn't on screen.
  unread: Record<Room, number>
  // The room on screen, or null while the chat is closed.
  viewing: Room | null
  // Players this browser hides.
  muted: Record<string, string>
}

const MUTE_KEY = 'cartopia-chat-muted'
const loadMuted = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(MUTE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const useChat = create<ChatState>(() => ({
  uid: null, crewRoom: null, msgs: { global: [], crew: [] }, unread: { global: 0, crew: 0 }, viewing: null, muted: loadMuted(),
}))

export const MAX_CHAT = 200
const KEEP = 80

// The one place chat decides a sender's name. The server sends the town name (public.chat_name);
// the word filter still runs here in case the lists drift. Switch both to usernames when they land.
export const senderName = (m: Pick<ChatMsg, 'name' | 'owner'>) => displayName(m.name, m.owner)

// Rows come from the server, but keep only well-formed ones and run the filters again.
type Row = { id: number; owner: string; name: string; level: number; body: string; at: string; tag?: string | null; emblem?: string | null; color?: string | null }
export function toMsg(r: Row): ChatMsg | null {
  if (!r || typeof r.id !== 'number' || typeof r.body !== 'string' || typeof r.owner !== 'string') return null
  const crew = r.tag && isCleanName(r.tag) && /^#[0-9a-f]{6}$/i.test(r.color ?? '')
    ? { id: '', tag: r.tag, emblem: CLAN_EMBLEMS.includes(r.emblem ?? '') ? r.emblem! : CLAN_EMBLEMS[0], color: r.color! }
    : null
  return {
    id: r.id, owner: r.owner, name: String(r.name ?? ''), level: Number(r.level) || 1, crew,
    body: isCleanChat(r.body) ? r.body.slice(0, MAX_CHAT) : '•••',
    at: Date.parse(r.at) || Date.now(),
  }
}

const roomKey = (room: Room) => (room === 'global' ? 'global' : useChat.getState().crewRoom)

// count: whether new messages add to the unread count (not for a room's first history load).
function add(room: Room, list: ChatMsg[]) {
  useChat.setState((s) => {
    const byId = new Map(s.msgs[room].map((m) => [m.id, m]))
    const count = s.msgs[room].length > 0
    let fresh = 0
    for (const m of list) {
      if (!byId.has(m.id) && count) fresh += m.owner === s.uid || s.muted[m.owner] ? 0 : 1
      byId.set(m.id, m)
    }
    const merged = [...byId.values()].sort((a, b) => a.id - b.id).slice(-KEEP)
    const seen = s.viewing === room
    return {
      msgs: { ...s.msgs, [room]: merged },
      unread: { ...s.unread, [room]: seen ? 0 : s.unread[room] + fresh },
    }
  })
}

const channels: Partial<Record<Room, RealtimeChannel>> = {}
const live: Partial<Record<Room, boolean>> = {}

function leave(room: Room) {
  const ch = channels[room]
  if (ch && supabase) void supabase.removeChannel(ch)
  delete channels[room]
  live[room] = false
}

async function join(room: Room) {
  const key = roomKey(room)
  if (!supabase || !key || channels[room]) return
  await supabase.realtime.setAuth()
  if (channels[room] || roomKey(room) !== key) return
  const ch = supabase.channel(`chat:${key}`, { config: { private: true } })
  channels[room] = ch
  ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
    const m = toMsg(payload as Row)
    if (m) add(room, [m])
  }).subscribe((status) => {
    live[room] = status === 'SUBSCRIBED'
    // Catch up on anything sent while the channel was down.
    if (status === 'SUBSCRIBED') void loadRecent(room)
  })
}

export async function loadRecent(room: Room) {
  const key = roomKey(room)
  if (!supabase || !key || !useChat.getState().uid) return
  const { data, error } = await supabase.rpc('chat_recent', { p_room: key })
  if (error || !Array.isArray(data)) return
  add(room, (data as Row[]).map(toMsg).filter((m): m is ChatMsg => !!m))
}

// Look up the player's crew and (re)join the crew room. Call after joining or leaving a crew.
export async function refreshChatRooms() {
  const { uid } = useChat.getState()
  if (!supabase || !uid) return
  const { data } = await supabase.from('clan_members').select('clan_id').eq('owner_id', uid).maybeSingle()
  const crewRoom = data?.clan_id ? `crew:${data.clan_id}` : null
  if (crewRoom !== useChat.getState().crewRoom) {
    leave('crew')
    useChat.setState((s) => ({ crewRoom, msgs: { ...s.msgs, crew: [] }, unread: { ...s.unread, crew: 0 } }))
  }
  void join('global')
  if (crewRoom) void join('crew')
}

let started = false
export function startChat() {
  if (!supabase || started) return
  started = true
  const onUser = (uid: string | null) => {
    if (uid === useChat.getState().uid) return
    leave('global')
    leave('crew')
    useChat.setState({ uid, crewRoom: null, msgs: { global: [], crew: [] }, unread: { global: 0, crew: 0 } })
    if (uid) void refreshChatRooms()
  }
  supabase.auth.getUser().then(({ data }) => onUser(data.user?.id ?? null))
  // Outside the callback: supabase-js shouldn't be called back into from inside it.
  supabase.auth.onAuthStateChange((_e, session) => setTimeout(() => onUser(session?.user.id ?? null), 0))
  // If Realtime can't connect, the open room still refreshes now and then.
  setInterval(() => {
    const { viewing } = useChat.getState()
    if (viewing && !live[viewing] && !document.hidden) void loadRecent(viewing)
  }, 15000)
  // Realtime only checks crew membership on join, so notice a kick or a crew change and rejoin.
  setInterval(() => { if (!document.hidden) void refreshChatRooms() }, 120000)
}

let pickedRoom: Room | null = null
// Open the chat window on a room.
export function openChat(room: Room) {
  pickedRoom = room
  useGame.getState().openPanel('chat')
}
// The room the chat window opens on: the one asked for, else crew when it has news.
export function firstRoom(): Room {
  const r = pickedRoom ?? (useChat.getState().unread.crew > 0 ? 'crew' : 'global')
  pickedRoom = null
  return r
}

export function viewRoom(room: Room | null) {
  useChat.setState((s) => ({ viewing: room, unread: room ? { ...s.unread, [room]: 0 } : s.unread }))
  if (room) void loadRecent(room)
}

const ERRORS: Record<string, string> = {
  'sign in': 'Sign in to chat',
  'no save': 'Play a little first, then chat',
  'not in that room': "You're not in that crew any more",
  'not allowed': 'Keep it friendly. That message has a blocked word.',
  'too long': `Keep messages under ${MAX_CHAT} letters`,
  muted: "You can't chat right now",
  'slow down': 'Slow down a little',
  repeat: 'You just said that',
}

// Returns an error to show, or null once sent.
export async function sendChat(room: Room, text: string): Promise<string | null> {
  const body = text.replace(/\s+/g, ' ').trim()
  if (!body) return null
  if (body.length > MAX_CHAT) return ERRORS['too long']
  if (!isCleanChat(body)) return ERRORS['not allowed']
  const key = roomKey(room)
  if (!supabase || !key) return 'Chat needs an internet connection'
  const { data, error } = await supabase.rpc('chat_send', { p_room: key, p_body: body })
  if (error) return ERRORS[error.message] ?? "Couldn't send. Try again."
  const m = toMsg(data as Row)
  if (m) add(room, [m])
  return null
}

export function setMuted(owner: string, name: string | null) {
  useChat.setState((s) => {
    const muted = { ...s.muted }
    if (name === null) delete muted[owner]
    else muted[owner] = name
    try {
      localStorage.setItem(MUTE_KEY, JSON.stringify(muted))
    } catch {
      // Storage blocked: the mute lasts for this visit only.
    }
    return { muted }
  })
}

// ?chatdemo fills both rooms with sample messages so the window can be looked at signed out.
export function chatDemo() {
  const now = Date.now()
  const rows: [string, string, number, string, string | null][] = [
    ['a', 'Polio Folio', 31, 'anyone up for a drag race at the docks?', 'ACE'],
    ['b', 'Rustville', 12, 'gg last night, that Tusker is quick', null],
    ['me', 'My Town', 18, 'just unlocked the Cold Snap skin 🔥', 'ACE'],
    ['c', 'Neon Heights', 44, 'trailer park looks so good at night', 'VRM'],
    ['a', 'Polio Folio', 31, 'invite me, I am online now', 'ACE'],
  ]
  const make = (i: number, [o, name, level, body, tag]: (typeof rows)[number]): ChatMsg => ({
    id: i + 1, owner: o, name, level, body, at: now - (rows.length - i) * 95000,
    crew: tag ? { id: '', tag, emblem: tag === 'ACE' ? '🔥' : '⚡', color: tag === 'ACE' ? '#e53935' : '#7e57c2' } : null,
  })
  useChat.setState({
    uid: 'me', crewRoom: 'crew:demo',
    msgs: {
      global: rows.map((r, i) => make(i, r)),
      crew: [make(10, ['a', 'Polio Folio', 31, 'crew goal is almost there, 20 more points', 'ACE']), make(11, ['me', 'My Town', 18, 'on it, racing now', 'ACE'])],
    },
    unread: { global: 0, crew: 2 },
  })
}
