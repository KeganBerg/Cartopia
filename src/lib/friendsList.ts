import { create } from 'zustand'
import { supabase } from './supabase'
import { displayName, isCleanName } from './names'
import { useNames } from './profiles'
import { useGame } from '../game/store'

// Friends and friend requests (supabase/migrations/0049_friends_usernames.sql).

export type FriendStatus = 'friend' | 'incoming' | 'outgoing'
export type Friend = {
  id: string
  username: string | null
  townName: string
  level: number
  carName: string | null
  status: FriendStatus
  lastSeen: string | null
}

type FriendsState = {
  list: Friend[]
  loaded: boolean
  // The server doesn't have the friends tables yet.
  missing: boolean
}

export const useFriends = create<FriendsState>(() => ({ list: [], loaded: false, missing: false }))

export const MAX_FRIENDS = 100

export async function refreshFriends() {
  if (!supabase) return
  const { data, error } = await supabase.rpc('friend_list')
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') useFriends.setState({ missing: true, loaded: true })
    return
  }
  type Row = { other: string; username: string | null; town_name: string; level: number; best_car: { name?: string } | null; status: FriendStatus; last_seen: string | null }
  const list = ((data ?? []) as Row[]).map((r) => ({
    id: r.other,
    username: r.username && isCleanName(r.username) ? r.username : null,
    townName: displayName(r.town_name, r.other),
    level: r.level,
    carName: r.best_car?.name ?? null,
    status: r.status,
    lastSeen: r.last_seen,
  }))
  useFriends.setState({ list, loaded: true, missing: false })
  useNames.setState((s) => ({ byId: { ...s.byId, ...Object.fromEntries(list.map((f) => [f.id, f.username])) } }))
}

const ANSWERS: Record<string, string> = {
  sent: 'Friend request sent!',
  accepted: "You're friends now!",
  already: "You're already friends",
  pending: 'Request already sent',
  limit: "You've hit the friend limit for now",
  no_name: 'Pick a username first',
  not_found: 'No driver has that username',
  no: "Couldn't send that request",
}

// Sends a request by username (or account id). Returns true when it went through.
export async function addFriend(to: { username?: string; id?: string }): Promise<boolean> {
  const toast = useGame.getState().toast
  if (!supabase) return false
  const { data, error } = to.id
    ? await supabase.rpc('friend_request', { p_to: to.id })
    : await supabase.rpc('friend_request_name', { p_username: (to.username ?? '').trim().replace(/^@/, '') })
  if (error) {
    toast(error.code === 'PGRST202' ? 'Friend requests are coming soon' : "Couldn't send that request")
    return false
  }
  toast(ANSWERS[String(data)] ?? ANSWERS.no)
  await refreshFriends()
  return data === 'sent' || data === 'accepted' || data === 'pending'
}

export async function respondFriend(id: string, accept: boolean) {
  if (!supabase) return
  const { data, error } = await supabase.rpc('friend_respond', { p_from: id, p_accept: accept })
  const toast = useGame.getState().toast
  if (error || data === 'no') toast("Couldn't answer that request")
  else if (data === 'limit') toast(ANSWERS.limit)
  else if (data === 'accepted') toast(ANSWERS.accepted)
  await refreshFriends()
}

export async function removeFriend(id: string) {
  if (!supabase) return
  // Hide it right away; the refresh puts it back if the server said no.
  useFriends.setState((s) => ({ list: s.list.filter((f) => f.id !== id) }))
  await supabase.rpc('friend_remove', { p_other: id })
  await refreshFriends()
}

// "5m ago", "3h ago", "2d ago".
export function seenAgo(at: string | null, now = Date.now()): string | null {
  if (!at) return null
  const m = Math.max(0, Math.floor((now - new Date(at).getTime()) / 60000))
  if (m < 60) return `${Math.max(1, m)}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}
