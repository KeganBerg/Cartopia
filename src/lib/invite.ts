import { useGame } from '../game/store'
import { useNames } from './profiles'
import { addFriend } from './friendsList'

// Links that bring players in: where a new player came from (?from=tiktok), whose invite they
// followed (?ref=username, a friend request once they sign in) and which crew asked them (?join=TAG;
// ?crew=demo is the signed-out demo crew).

// The Discord server's invite. Empty hides the button in Settings.
export const DISCORD_INVITE = ''

const ARRIVAL_KEY = 'cartopia.arrival'
const CREW_KEY = 'cartopia.crewInvite'

export type Arrival = { from: string | null; ref: string | null; at: number; refSent?: boolean }

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

// Once the invited player is signed in with a name of their own, they send the inviter a friend
// request (or accept the one waiting). Only once, and never to themselves.
export function startInviteFollowUp() {
  const check = () => {
    const a = arrival()
    const mine = useNames.getState().mine
    if (!a?.ref || a.refSent || !mine) return
    if (mine.username?.toLowerCase() === a.ref) return write(ARRIVAL_KEY, { ...a, refSent: true })
    write(ARRIVAL_KEY, { ...a, refSent: true })
    void addFriend({ username: a.ref })
  }
  check()
  return useNames.subscribe(check)
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
