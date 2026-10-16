import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { sfx } from './sound'
import { useGame } from '../game/store'
import { CLAN_EMBLEMS } from '../game/data'
import { isCleanChat, isCleanName } from './names'
import { loadUsernames, playerName, useNames } from './profiles'
import { mentions } from './mentions'
import { useFriends } from './friendsList'
import type { ClanBadge } from './clans'

// Global chat and crew chat (supabase/migrations/0048_chat.sql). Messages are sent through
// chat_send(), which filters and rate-limits them and broadcasts each one on the private
// Realtime topic chat:<room>. Rooms: 'global', and 'crew:<clan id>' for the player's crew.

export type Room = 'global' | 'crew'
// mod: the server says this is a chat mod (the Cartopia team), shown with a check mark.
export type ChatMsg = { id: number; owner: string; name: string; level: number; crew: ClanBadge | null; body: string; at: number; mod?: boolean }

type ChatState = {
  uid: string | null
  // The player's crew room ('crew:<id>'), or null outside a crew.
  crewRoom: string | null
  msgs: Record<Room, ChatMsg[]>
  // Messages that came in while that room wasn't on screen.
  unread: Record<Room, number>
  // Messages naming the player (@username) that came in while that room wasn't on screen.
  pinged: Record<Room, number>
  // The room on screen, or null while the chat is closed.
  viewing: Room | null
  // Players this browser hides.
  muted: Record<string, string>
  // What the player may delete besides their own messages (public.chat_powers).
  powers: { mod: boolean; leader: boolean }
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
  uid: null, crewRoom: null, msgs: { global: [], crew: [] }, unread: { global: 0, crew: 0 }, pinged: { global: 0, crew: 0 }, viewing: null, muted: loadMuted(),
  powers: { mod: false, leader: false },
}))

export const MAX_CHAT = 200
const KEEP = 80

// The one place chat decides a sender's name: "@username" once they've picked one, else the
// (filtered) town name the server sent (public.chat_name).
export const senderName = (m: Pick<ChatMsg, 'name' | 'owner'>) => playerName(m.owner, m.name)

// Rows come from the server, but keep only well-formed ones and run the filters again.
type Row = { id: number; owner: string; name: string; level: number; body: string; at: string; tag?: string | null; emblem?: string | null; color?: string | null; mod?: boolean }
export function toMsg(r: Row): ChatMsg | null {
  if (!r || typeof r.id !== 'number' || typeof r.body !== 'string' || typeof r.owner !== 'string') return null
  const crew = r.tag && isCleanName(r.tag) && /^#[0-9a-f]{6}$/i.test(r.color ?? '')
    ? { id: '', tag: r.tag, emblem: CLAN_EMBLEMS.includes(r.emblem ?? '') ? r.emblem! : CLAN_EMBLEMS[0], color: r.color! }
    : null
  return {
    id: r.id, owner: r.owner, name: String(r.name ?? ''), level: Number(r.level) || 1, crew,
    body: isCleanChat(r.body) ? r.body.slice(0, MAX_CHAT) : '•••',
    at: Date.parse(r.at) || Date.now(),
    ...(r.mod === true ? { mod: true } : {}),
  }
}

const roomKey = (room: Room) => (room === 'global' ? 'global' : useChat.getState().crewRoom)

// Rooms whose history has loaded. Before that, arriving messages are old news and
// don't add to the unread count; after it, every new message does, even in a room
// that was empty (a new crew's first "hi").
const loaded: Partial<Record<Room, boolean>> = {}

// History replaces everything from its oldest message on, so a message deleted while the
// channel was down doesn't linger.
function add(room: Room, list: ChatMsg[], history = false) {
  loadUsernames(list.map((m) => m.owner))
  let ping = false
  let tagged = null as ChatMsg | null
  let away = false
  const myName = useNames.getState().mine?.username
  useChat.setState((s) => {
    const from = history ? (list.length ? Math.min(...list.map((m) => m.id)) : -Infinity) : Infinity
    const byId = new Map(s.msgs[room].filter((m) => m.id < from).map((m) => [m.id, m]))
    const had = new Set(s.msgs[room].map((m) => m.id))
    const count = !!loaded[room]
    let fresh = 0
    let named = 0
    for (const m of list) {
      if (!had.has(m.id) && count && m.owner !== s.uid && !s.muted[m.owner]) {
        fresh++
        if (mentions(m.body, myName)) {
          named++
          tagged = m
        }
      }
      byId.set(m.id, m)
    }
    const merged = [...byId.values()].sort((a, b) => a.id - b.id).slice(-KEEP)
    // Your crew talking: a soft pluck (the busy global room stays quiet).
    ping = room === 'crew' && fresh > 0
    const seen = s.viewing === room
    away = !seen
    return {
      msgs: { ...s.msgs, [room]: merged },
      unread: { ...s.unread, [room]: seen ? 0 : s.unread[room] + fresh },
      pinged: { ...s.pinged, [room]: seen ? 0 : s.pinged[room] + named },
    }
  })
  // Someone @mentioned you: a ping and a note saying who, wherever you are.
  if (tagged) {
    sfx.notify()
    if (away) useGame.getState().toast(`💬 ${senderName(tagged)} mentioned you`)
  } else if (ping) sfx.message()
}

const channels: Partial<Record<Room, RealtimeChannel>> = {}
const live: Partial<Record<Room, boolean>> = {}

function leave(room: Room) {
  const ch = channels[room]
  if (ch && supabase) void supabase.removeChannel(ch)
  delete channels[room]
  live[room] = false
  loaded[room] = false
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
  }).on('broadcast', { event: 'del' }, ({ payload }) => {
    const id = Number((payload as { id?: unknown })?.id)
    if (Number.isFinite(id)) drop(room, id)
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
  if (roomKey(room) !== key) return
  add(room, (data as Row[]).map(toMsg).filter((m): m is ChatMsg => !!m), true)
  loaded[room] = true
}

// Look up the player's crew and (re)join the crew room. Call after joining or leaving a crew.
export async function refreshChatRooms() {
  const { uid } = useChat.getState()
  if (!supabase || !uid) return
  const { data } = await supabase.from('clan_members').select('clan_id').eq('owner_id', uid).maybeSingle()
  const crewRoom = data?.clan_id ? `crew:${data.clan_id}` : null
  if (crewRoom !== useChat.getState().crewRoom) {
    leave('crew')
    useChat.setState((s) => ({ crewRoom, msgs: { ...s.msgs, crew: [] }, unread: { ...s.unread, crew: 0 }, pinged: { ...s.pinged, crew: 0 } }))
  }
  void join('global')
  if (crewRoom) void join('crew')
  void loadPowers()
}

async function loadPowers() {
  if (!supabase) return
  const { data, error } = await supabase.rpc('chat_powers')
  const p = (error ? null : data) as { mod?: unknown; leader?: unknown } | null
  useChat.setState({ powers: { mod: p?.mod === true, leader: p?.leader === true } })
}

let started = false
export function startChat() {
  if (!supabase || started) return
  started = true
  const onUser = (uid: string | null) => {
    if (uid === useChat.getState().uid) return
    leave('global')
    leave('crew')
    useChat.setState({ uid, crewRoom: null, msgs: { global: [], crew: [] }, unread: { global: 0, crew: 0 }, pinged: { global: 0, crew: 0 }, powers: { mod: false, leader: false } })
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
  const { unread, pinged } = useChat.getState()
  const r = pickedRoom ?? (pinged.global > 0 && !pinged.crew ? 'global' : unread.crew > 0 ? 'crew' : 'global')
  pickedRoom = null
  return r
}

export function viewRoom(room: Room | null) {
  useChat.setState((s) => ({ viewing: room, unread: room ? { ...s.unread, [room]: 0 } : s.unread, pinged: room ? { ...s.pinged, [room]: 0 } : s.pinged }))
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

function drop(room: Room, id: number) {
  useChat.setState((s) => ({ msgs: { ...s.msgs, [room]: s.msgs[room].filter((m) => m.id !== id) } }))
}

// Whether the player may delete a message: their own, any in their crew room as its leader,
// anything as a chat mod. The server (chat_delete) checks again.
export function canDelete(room: Room, m: Pick<ChatMsg, 'owner'>, s: Pick<ChatState, 'uid' | 'powers'> = useChat.getState()) {
  return !!s.uid && (m.owner === s.uid || s.powers.mod || (room === 'crew' && s.powers.leader))
}

// Returns an error to show, or null once deleted.
export async function deleteChat(room: Room, id: number): Promise<string | null> {
  if (!supabase) return 'Chat needs an internet connection'
  const { error } = await supabase.rpc('chat_delete', { p_id: id })
  if (error && error.message !== 'gone') return error.message === 'not yours' ? "You can't delete that" : "Couldn't delete. Try again."
  drop(room, id)
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
    ['k', 'KBerg Town', 200, 'Tomahawk tank, enjoy @Gabe', null],
    ['b', 'Rustville', 12, 'race me later @Racer_K?', null],
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
  // You and a few friends, so "@" has names to offer.
  useNames.setState((s) => ({ mine: { uid: 'me', username: 'Racer_K', changedAt: null }, byId: { ...s.byId, k: 'KBerg', b: 'Rusty_B', 'demo-nitro': 'Gabe' } }))
  useFriends.setState({
    loaded: true,
    list: [['demo-nitro', 'Gabe', 'Nitro Bay', 12], ['g2', 'Gabriel_GT', 'Grand Bay', 22], ['u', 'Bubba', 'Bubba Bay', 51]].map(([id, username, townName, level]) => ({
      id: id as string, username: username as string, townName: townName as string, level: level as number, carName: null, status: 'friend' as const, lastSeen: null,
    })),
  })
}
