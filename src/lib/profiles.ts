import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase } from './supabase'
import { displayName, isCleanName } from './names'

// Usernames: one per account, separate from the town name (supabase/migrations/0049_friends_usernames.sql).
// Other players' names are fetched in batches and cached here.

export const USERNAME_MIN = 3
export const USERNAME_MAX = 16
export const USERNAME_CHANGE_DAYS = 30
// Matches public.username_ok() (profiles.test.ts checks the list agrees).
export const RESERVED = ['admin', 'administrator', 'cartopia', 'mod', 'moderator', 'support', 'staff', 'official', 'system', 'rusty', 'help', 'null', 'undefined']

// Why a username can't be used, or null when it's fine to try.
export function usernameProblem(name: string): string | null {
  const n = name.trim()
  if (n.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters`
  if (n.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters`
  if (!/^[A-Za-z0-9_]+$/.test(n)) return 'Letters, numbers and _ only'
  if (RESERVED.includes(n.toLowerCase()) || !isCleanName(n.replace(/_/g, ' '))) return "That name isn't allowed"
  return null
}

type Mine = { uid: string; username: string | null; changedAt: string | null }
type NameState = {
  // Other players' usernames by account id; null = they haven't picked one.
  byId: Record<string, string | null>
  // The signed-in player's own profile. undefined while loading or signed out.
  mine: Mine | undefined
}

export const useNames = create<NameState>(() => ({ byId: {}, mine: undefined }))

const fetchedAt = new Map<string, number>()
let queue = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null
const UUID = /^[0-9a-f-]{36}$/i

// Looks up usernames for these accounts (batched, cached for 5 minutes). Neighbour ids are skipped.
export function loadUsernames(ids: (string | null | undefined)[]) {
  if (!supabase) return
  for (const id of ids) {
    if (id && UUID.test(id) && Date.now() - (fetchedAt.get(id) ?? 0) > 300000) queue.add(id)
  }
  if (!queue.size || timer) return
  timer = setTimeout(async () => {
    const batch = [...queue].slice(0, 100)
    queue = new Set([...queue].slice(100))
    timer = null
    const at = Date.now()
    for (const id of batch) fetchedAt.set(id, at)
    const { data, error } = await supabase!.from('profiles').select('id, username').in('id', batch)
    if (error) {
      for (const id of batch) fetchedAt.delete(id)
      return
    }
    const found: Record<string, string | null> = Object.fromEntries(batch.map((id) => [id, null]))
    for (const r of data ?? []) found[r.id] = r.username && isCleanName(r.username) ? r.username : null
    useNames.setState((s) => ({ byId: { ...s.byId, ...found } }))
    if (queue.size) loadUsernames([])
  }, 30)
}

export const usernameOf = (id: string | null | undefined) => (id ? useNames.getState().byId[id] ?? null : null)

// THE display-name helper for other players: "@username" once they've picked one, else their
// (filtered) town name. Call loadUsernames() or usePlayerName() so the name gets fetched.
// "@" marks a real username, so a town name can't start with one (no "@KBerg" towns).
export const townLabel = (townName: string, id: string | null | undefined) => displayName(townName.replace(/^[\s@＠﹫]+/u, ''), id ?? 'x')

export function playerName(id: string | null | undefined, townName: string): string {
  const u = usernameOf(id)
  return u ? `@${u}` : townLabel(townName, id)
}

// React version of playerName(): fetches the username and re-renders when it arrives.
export function usePlayerName(id: string | null | undefined, townName: string): string {
  const u = useNames((s) => (id ? s.byId[id] : undefined))
  useEffect(() => loadUsernames([id]), [id])
  return u ? `@${u}` : townLabel(townName, id)
}

// Loads (or clears, on sign-out) the signed-in player's own username.
export async function loadMyProfile(uid: string | null) {
  if (!uid || !supabase) return useNames.setState({ mine: undefined })
  const { data, error } = await supabase.from('profiles').select('username, username_changed_at').eq('id', uid).maybeSingle()
  if (error) return
  useNames.setState((s) => ({
    mine: { uid, username: data?.username ?? null, changedAt: data?.username_changed_at ?? null },
    byId: data?.username ? { ...s.byId, [uid]: data.username } : s.byId,
  }))
}

// Days until the username can change again (0 = now).
export function daysUntilChange(changedAt: string | null): number {
  if (!changedAt) return 0
  const ms = new Date(changedAt).getTime() + USERNAME_CHANGE_DAYS * 86400000 - Date.now()
  return ms > 0 ? Math.ceil(ms / 86400000) : 0
}

export async function isUsernameFree(name: string): Promise<boolean | null> {
  if (!supabase || usernameProblem(name)) return null
  const { data, error } = await supabase.rpc('username_free', { p_name: name.trim() })
  return error ? null : !!data
}

// Saves the username. Returns null when it worked, else what to tell the player.
export async function saveUsername(name: string): Promise<string | null> {
  const problem = usernameProblem(name)
  if (problem) return problem
  if (!supabase) return 'Usernames need an internet connection'
  const { data, error } = await supabase.rpc('set_username', { p_name: name.trim() })
  if (error) return error.code === 'PGRST202' ? 'Usernames are coming soon' : "Couldn't save that. Try again."
  const r = String(data)
  if (r === 'taken') return 'Someone already has that name'
  if (r === 'bad') return "That name isn't allowed"
  if (r.startsWith('wait:')) return `You can change it again in ${r.slice(5)} days`
  if (r !== 'ok' && r !== 'same') return "Couldn't save that. Try again."
  const uid = useNames.getState().mine?.uid ?? (await supabase.auth.getUser()).data.user?.id ?? null
  await loadMyProfile(uid)
  return null
}
