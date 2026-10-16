import { supabase } from './supabase'
import { isCleanName } from './names'
import { useNames, USERNAME_MAX } from './profiles'
import { useFriends } from './friendsList'

// @mentions in player-written text (chat). Typing "@" offers friends first, then any player
// whose username starts with what's typed. Sent mentions show as tappable names.

// One character that can sit right before an "@": start of text, a space or punctuation.
const NAME = `[A-Za-z0-9_]{3,${USERNAME_MAX}}`
const MENTION = new RegExp(`(^|[^A-Za-z0-9_@])@(${NAME})(?![A-Za-z0-9_])`, 'g')

export type Part = string | { name: string }

// Splits text into plain runs and @mentions.
export function splitMentions(text: string): Part[] {
  const out: Part[] = []
  let last = 0
  for (const m of text.matchAll(MENTION)) {
    const at = m.index! + m[1].length
    if (at > last) out.push(text.slice(last, at))
    out.push({ name: m[2] })
    last = at + 1 + m[2].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export const mentionedNames = (text: string) => splitMentions(text).flatMap((p) => (typeof p === 'string' ? [] : [p.name]))

export const mentions = (text: string, username: string | null | undefined) =>
  !!username && mentionedNames(text).some((n) => n.toLowerCase() === username.toLowerCase())

// The "@partial" the caret sits at the end of, or null when not typing a mention.
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const m = new RegExp(`(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{0,${USERNAME_MAX}})$`).exec(before)
  if (!m) return null
  return { start: m.index + m[1].length, query: m[2] }
}

// Puts "@name " in place of the "@partial" being typed. Returns the new text and caret.
export function insertMention(text: string, start: number, caret: number, name: string) {
  const rest = text.slice(caret).replace(/^[A-Za-z0-9_]*/, '')
  const add = `@${name}${rest.startsWith(' ') ? '' : ' '}`
  const next = text.slice(0, start) + add + rest
  return { text: next, caret: start + add.length }
}

export type Suggest = { id: string; username: string; friend: boolean; level?: number }

// Friends whose username starts with the query (all friends for an empty one), best match first.
export function friendPicks(query: string, me?: string | null): Suggest[] {
  const q = query.toLowerCase()
  return useFriends.getState().list
    .filter((f) => f.status === 'friend' && f.username && f.id !== me && f.username.toLowerCase().startsWith(q))
    .sort((a, b) => a.username!.localeCompare(b.username!, undefined, { sensitivity: 'base' }))
    .map((f) => ({ id: f.id, username: f.username!, friend: true, level: f.level }))
}

// LIKE treats _ and % as wildcards; usernames can hold _.
const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

const cache = new Map<string, Suggest[]>()
// Players whose username starts with the query (2+ letters). Usernames are public; nothing else is read.
export async function searchPlayers(query: string, me?: string | null): Promise<Suggest[]> {
  const q = query.toLowerCase()
  if (q.length < 2 || !supabase || !/^[a-z0-9_]+$/.test(q)) return []
  let rows = cache.get(q)
  if (!rows) {
    const { data, error } = await supabase.from('profiles').select('id, username').ilike('username', `${likeSafe(q)}%`).order('username').limit(8)
    if (error) return []
    rows = (data ?? [])
      .filter((r): r is { id: string; username: string } => typeof r.username === 'string' && isCleanName(r.username))
      .map((r) => ({ id: r.id, username: r.username, friend: false }))
    cache.set(q, rows)
    useNames.setState((s) => ({ byId: { ...s.byId, ...Object.fromEntries(rows!.map((r) => [r.id, r.username])) } }))
  }
  return rows.filter((r) => r.id !== me)
}

// Friends first, then other players, no repeats, at most `max`.
export function mergePicks(friends: Suggest[], players: Suggest[], max = 5): Suggest[] {
  const seen = new Set(friends.map((f) => f.id))
  return [...friends, ...players.filter((p) => !seen.has(p.id))].slice(0, max)
}

// The account behind a username, from what's loaded or else the server.
const ids = new Map<string, string | null>()
export async function idForUsername(name: string): Promise<string | null> {
  const key = name.toLowerCase()
  const known = Object.entries(useNames.getState().byId).find(([, u]) => u?.toLowerCase() === key)
  if (known) return known[0]
  if (ids.has(key)) return ids.get(key)!
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('id, username').ilike('username', likeSafe(key)).limit(1).maybeSingle()
  if (error) return null
  const id = data?.id ?? null
  ids.set(key, id)
  if (id) useNames.setState((s) => ({ byId: { ...s.byId, [id]: data!.username } }))
  return id
}
