import { useGame } from '../game/store'
import { useNames } from './profiles'
import { addFriend } from './friendsList'
import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { sfx } from './sound'

// Links that bring players in: where a new player came from (?from=tiktok), whose invite they
// followed (?ref=username, a friend request once they sign in) and which crew asked them (?join=TAG;
// ?crew=demo is the signed-out demo crew).

// The Discord server's invite (a never-expiring one). Empty hides the Help row.
export const DISCORD_INVITE = 'https://discord.gg/eMjZhe7z'

const ARRIVAL_KEY = 'cartopia.arrival'
const CREW_KEY = 'cartopia.crewInvite'

export type Arrival = { from: string | null; ref: string | null; at: number; refSent?: boolean; recorded?: boolean }

const clean = (v: string | null, max: number) => {
  const s = (v ?? '').trim().replace(/^@/, '').toLowerCase()
  return /^[a-z0-9_.-]+$/.test(s) ? s.slice(0, max) : null
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    // Private mode: the link still opened the game.
  }
}

export const arrival = () => read<Arrival>(ARRIVAL_KEY)
export const crewInvite = () => read<string>(CREW_KEY)
export const clearCrewInvite = () => {
  try { localStorage.removeItem(CREW_KEY) } catch { /* nothing kept */ }
}

// Reads the link this visit opened with. The first source and inviter stick (first touch); a crew
// link always replaces the last one. The tags come off the address bar so a shared URL stays clean.
export function captureArrival(url: URL = new URL(location.href)) {
  const q = url.searchParams
  const from = clean(q.get('from') ?? q.get('utm_source'), 24)
  const ref = clean(q.get('ref'), 17)
  const crew = (q.get('join') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  if ((from || ref) && !arrival()) write(ARRIVAL_KEY, { from: from ?? (ref ? 'invite' : null), ref, at: Date.now() } satisfies Arrival)
  if (crew.length >= 2) {
    write(CREW_KEY, crew)
    setTimeout(() => useGame.getState().toast(`🛡️ Crew invite: ${crew}`), 3000)
  }
  const tags = ['from', 'ref', 'join', 'utm_source', 'utm_medium', 'utm_campaign']
  if (tags.some((t) => q.has(t))) {
    tags.forEach((t) => q.delete(t))
    history.replaceState(history.state, '', url.pathname + (q.toString() ? `?${q}` : '') + url.hash)
  }
}

// The invite reward each side gets once the new player reaches INVITE_LEVEL (claim_invite_rewards()
// in supabase/migrations/0112_invite_rewards.sql pays it; the numbers here are only for the screen).
export const INVITE_GEMS = 100
export const INVITE_LEVEL = 5

// Tells the server where this account came from, once (record_arrival()). Kept until the server
// has it, so an old server just means trying again next time.
async function recordArrival(a: Arrival) {
  if (!supabase || a.recorded) return
  const { data, error } = await supabase.rpc('record_arrival', { p_source: a.from, p_ref: a.ref })
  if (!error && (data === 'ok' || data === 'exists')) write(ARRIVAL_KEY, { ...(arrival() ?? a), recorded: true })
}

// Collects any invite gems waiting for this player. The server writes them into the save, so the
// game takes its gem count and updatedAt at once, before its next save could overwrite them.
let claiming = false
export async function claimInviteRewards() {
  if (!supabase || !signedInUser() || claiming) return
  claiming = true
  try {
    await flushSave()
    const { data, error } = await supabase.rpc('claim_invite_rewards')
    if (error) return
    const d = data as { gems?: number; bucks?: number; updatedAt?: number } | null
    if (!d || !(Number(d.gems) > 0) || typeof d.bucks !== 'number' || typeof d.updatedAt !== 'number') return
    useGame.setState({ bucks: d.bucks, updatedAt: d.updatedAt })
    sfx.reward()
    useGame.getState().toast(`🎁 +${d.gems} Gems · invite reward`)
  } finally {
    claiming = false
  }
}

export type InviteStats = { joined: number; paid: number; gems: number; waiting: number }
export async function myInvites(): Promise<InviteStats | null> {
  if (!supabase || !signedInUser()) return null
  const { data, error } = await supabase.rpc('my_invites')
  return error ? null : (data as InviteStats)
}

// Once the invited player is signed in, the server hears where they came from, and they send the
// inviter a friend request (or accept the one waiting): only once, and never to themselves.
// Signing in and reaching the reward level collect any invite gems waiting.
export function startInviteFollowUp() {
  let signedIn: string | null = null
  const check = () => {
    const a = arrival()
    const mine = useNames.getState().mine
    if (!mine) return
    if (signedIn !== mine.uid) {
      signedIn = mine.uid
      if (a) void recordArrival(a)
      void claimInviteRewards()
    }
    if (!a?.ref || a.refSent) return
    write(ARRIVAL_KEY, { ...a, refSent: true })
    if (mine.username?.toLowerCase() !== a.ref) void addFriend({ username: a.ref })
  }
  check()
  const stopNames = useNames.subscribe(check)
  const stopLevel = useGame.subscribe((s, prev) => {
    if (s.level >= INVITE_LEVEL && prev.level < INVITE_LEVEL) setTimeout(() => void claimInviteRewards(), 2000)
  })
  return () => { stopNames(); stopLevel() }
}

const site = () => (/^https?:\/\/(localhost|127\.|192\.168\.)/.test(location.origin) ? 'https://cartopia.lol' : location.origin)

// A link to the game tagged with where it was shared from, and whose invite it is.
export function gameLink(from: string, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ from, ...extra })
  return `${site()}/?${q}`
}
export const inviteLink = (username: string | null | undefined) => gameLink('invite', username ? { ref: username } : {})
export const crewLink = (tag: string) => gameLink('crew', { join: tag })

// The phone's share sheet when there is one, else the link is copied.
export async function shareLink(text: string, url: string) {
  try {
    if (navigator.share) {
      await navigator.share({ text, url })
      return
    }
    await navigator.clipboard.writeText(`${text} ${url}`)
    useGame.getState().toast('🔗 Link copied')
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    useGame.getState().toast("Couldn't share that")
  }
}
