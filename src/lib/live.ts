import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useGame } from '../game/store'
import { CARS, MODS, carDef, performance, type Body, type ModSkins } from '../game/data'
import { displayName, isCleanName } from './names'
import { joinRefereed } from './referee'
import { SERVER_CAR_COLUMNS, serverCallCard, serverCar } from './serverCar'
import { cleanSkins } from './cleanSkins'
import { callCardDef } from '../game/callCards'
import { raceCarOf } from '../game/raceCar'
import { loadUsernames, playerName } from './profiles'
import { acceptWager, offerWager, startWagers, syncWagers, voidWager } from './wagers'
import { openParty } from './party'
import { STAKES, shortCoins } from '../game/wager'
import { signedInUser } from './cloud'
import { sfx } from './sound'

// Live drag racing over Supabase Realtime. A shared lobby channel carries
// presence and challenges; each race gets its own channel for positions.
// Both are private channels for signed-in players only (0020_private_realtime.sql):
// the lobby is open to any signed-in player, a race channel only to its two racers.

// uid: the signed-in account. Town, level and car shown to others come from its server save.
// car: the uid of the car they race with, so a lobby that saw an older pick knows to look again.
export type LivePlayer = { id: string; uid?: string | null; town: string; level: number; carName: string; color: string; body: Body; pi: number; mods?: string[]; skin?: string; modSkin?: ModSkins; car?: string | null; closed?: boolean; callCard?: string }
// drag: the classic head-to-head strip. kart: a kart circuit race, the two of you plus AI.
export type LiveMode = 'drag' | 'kart'
// stake: coins each racer puts up in a wager race; the winner takes both.
// party: a kart party (3-6 players), the host's invite to it or the race it became.
export type Invite = { raceId: string; from: LivePlayer; at: number; mode: LiveMode; stake?: number; party?: boolean }
export type LiveRace = { raceId: string; opponent: LivePlayer; host: boolean; mode: LiveMode; stake?: number; party?: boolean }
// A kart party we're hosting: who we invited and what each answered (lobby id -> yes/no).
export type Party = { raceId: string; invited: LivePlayer[]; answers: Record<string, boolean> }
export const PARTY_MAX = 6

type LiveState = {
  me: string
  players: LivePlayer[]
  // Challenges waiting in the inbox, at most one per sender.
  invites: Invite[]
  outgoing: { raceId: string; to: string; mode: LiveMode; stake?: number } | null
  race: LiveRace | null
  party: Party | null
  muted: Record<string, string>
  closed: boolean
  // Sender id -> time before which their challenges are ignored, and
  // target id -> time before which we can't challenge them again.
  cooldownFrom: Record<string, number>
  cooldownTo: Record<string, number>
  // Signed in and in the lobby. Guests can't race live.
  signedIn: boolean
}

// The server caps bets per day (0059_economy_followups.sql), so a bet can fail on a yes.
export const BET_LIMIT = 'Bet limit for today. Race without a bet!'

// How long a challenge stays open, and the breather after one ends.
export const INVITE_MS = 45000
const COOLDOWN_MS = 60000

const load = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    // Storage blocked: the setting lasts for this visit only.
  }
}

const LOBBY = 'lobby:v2'
const raceTopic = (raceId: string) => `race:${raceId}`

const myId = (() => {
  try {
    const k = 'cartopia-live-id'
    const v = localStorage.getItem(k) ?? crypto.randomUUID()
    localStorage.setItem(k, v)
    return v
  } catch {
    return crypto.randomUUID()
  }
})()

export const useLive = create<LiveState>(() => ({
  me: myId, players: [], invites: [], outgoing: null, race: null, party: null,
  muted: load('cartopia-muted', {}), closed: load('cartopia-closed', false), cooldownFrom: {}, cooldownTo: {}, signedIn: false,
}))

// Lobby messages come straight from other browsers, so anyone can send anything: keep only
// well-formed cards, with names through the word filter and the car drawn from known parts.
const BODIES = new Set<string>(CARS.map((c) => c.body))
const MOD_IDS = new Set(MODS.map((m) => m.id))
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : lo)
export function cleanCard(p: unknown): LivePlayer | null {
  if (!p || typeof p !== 'object') return null
  const c = p as Record<string, unknown>
  const id = text(c.id, 64)
  if (!id) return null
  const carName = text(c.carName, 40)
  return {
    id,
    uid: typeof c.uid === 'string' && /^[0-9a-f-]{36}$/i.test(c.uid) ? c.uid : null,
    town: displayName(text(c.town, 24) || 'Town', id),
    level: Math.floor(num(c.level, 1, 200)),
    carName: isCleanName(carName) && carName ? carName : 'Mystery Car',
    color: typeof c.color === 'string' && /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#888888',
    body: (BODIES.has(c.body as string) ? c.body : 'sedan') as Body,
    pi: Math.round(num(c.pi, 1, 250)),
    mods: Array.isArray(c.mods) ? c.mods.filter((m): m is string => typeof m === 'string' && MOD_IDS.has(m)).slice(0, 8) : undefined,
    car: typeof c.car === 'string' ? c.car.slice(0, 64) : undefined,
    closed: c.closed === true,
    ...(typeof c.callCard === 'string' && callCardDef(c.callCard) ? { callCard: c.callCard } : {}),
    ...cleanSkins(c),
  }
}

// What other players see of each account comes from its server save (town name, level and the
// guard-checked car they race with), never from what a browser says about itself.
type ServerCard = Pick<LivePlayer, 'town' | 'level' | 'carName' | 'color' | 'body' | 'pi' | 'mods' | 'skin' | 'modSkin' | 'car' | 'callCard'>
const known = new Map<string, { at: number; card: ServerCard | null }>()
// players: lobby cards, so a player whose card names a different race car than we last read is
// read again (after a few seconds, once their save has reached the server).
async function lookUp(players: Pick<LivePlayer, 'uid' | 'car'>[]) {
  const now = Date.now()
  const stale = [...new Set(players.filter((p) => {
    const k = p.uid ? known.get(p.uid) : undefined
    const age = now - (k?.at ?? 0)
    return age > 60000 || (!!p.car && !!k?.card && k.card.car !== p.car && age > 4000)
  }).map((p) => p.uid).filter((u): u is string => !!u))]
  if (!stale.length || !supabase) return
  loadUsernames(stale)
  const { data, error } = await supabase.from('game_saves').select(`owner_id, town_name, level, ${SERVER_CAR_COLUMNS}`).in('owner_id', stale)
  if (error) return
  const at = Date.now()
  for (const u of stale) known.set(u, { at, card: null })
  for (const r of data ?? []) {
    const c = serverCar(r)
    if (!c) continue
    known.set(r.owner_id, { at, card: { town: r.town_name, level: r.level, carName: c.name, color: c.color, body: c.body, pi: c.pi, mods: c.mods, skin: c.skin, modSkin: c.modSkin, car: c.uid, callCard: serverCallCard(r) } })
  }
}
// A lobby card with the server's details, or null for anyone who isn't a known signed-in player.
function verified(p: LivePlayer | null): LivePlayer | null {
  const c = p?.uid ? known.get(p.uid)?.card : null
  if (!p || !c) return null
  return cleanCard({ ...p, ...c, town: displayName(c.town, p.uid!) })
}

// Lobby messages carry no proof of who sent them, but a real challenger claims the race (or
// party) on the server before inviting anyone. A challenge only counts when that claim is theirs.
export async function sentBy(raceId: string, fromUid: string, party: boolean): Promise<boolean> {
  if (!supabase || raceId.length > 64) return false
  const { data, error } = party
    ? await supabase.from('kart_parties').select('host').eq('id', raceId).maybeSingle()
    : await supabase.from('live_races').select('a').eq('id', raceId).maybeSingle()
  if (error || !data) return false
  return (party ? (data as { host: string }).host : (data as { a: string }).a) === fromUid
}

// The same for an accept: the player who said yes has joined the race on the server.
export async function joinedBy(raceId: string, uid: string): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.from('live_races').select('b, b_pi').eq('id', raceId).maybeSingle()
  const r = data as { b: string; b_pi: number | null } | null
  return !error && !!r && r.b === uid && r.b_pi !== null
}

let lobby: RealtimeChannel | null = null
let authUid: string | null = null
let watching = false
// Challenges we sent, so a late accept of one we already dropped can be told it expired.
const sentIds = new Set<string>()

function myCard(): LivePlayer {
  const s = useGame.getState()
  const car = raceCarOf(s.cars, s.raceCar)!
  const d = carDef(car.model)
  return { id: myId, uid: authUid, town: displayName(s.townName, myId), level: s.level, carName: d.name, color: car.color, body: d.body, pi: performance(d, car.upgrades, car.mods), mods: car.mods, ...cleanSkins(car), car: car.uid, closed: useLive.getState().closed }
}

// Joins the lobby whenever someone is signed in, and leaves it on sign-out.
export function joinLobby() {
  if (!supabase || watching) return
  watching = true
  // A new race car shows in the lobby now, and again once the save carrying it reaches the
  // server (cloud.ts pushes 3s after a change), so other players read the new car.
  let again: ReturnType<typeof setTimeout> | null = null
  useGame.subscribe((s, prev) => {
    if (s.raceCar === prev.raceCar) return
    refreshPresence()
    if (again) clearTimeout(again)
    again = setTimeout(refreshPresence, 6000)
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    const uid = session?.user.id ?? null
    if (uid === authUid) return
    authUid = uid
    leaveLobby()
    // Outside the callback: supabase-js shouldn't be called back into from inside it.
    if (uid) setTimeout(() => void openLobby(uid), 0)
    if (uid) void wagersOnceSynced(uid)
  })
}

// Wager payouts owed from earlier races land once sign-in sync has settled on this account.
async function wagersOnceSynced(uid: string) {
  for (let i = 0; i < 30 && authUid === uid; i++) {
    if (signedInUser() === uid) return startWagers()
    await new Promise((r) => setTimeout(r, 1000))
  }
}

// A stake from another browser counts only if it's one of the game's stakes.
const cleanStake = (v: unknown) => (typeof v === 'number' && STAKES.some(([s]) => s === v) ? v : undefined)

async function openLobby(uid: string) {
  if (!supabase) return
  await supabase.realtime.setAuth()
  if (lobby || authUid !== uid) return
  const ch = supabase.channel(LOBBY, { config: { private: true, presence: { key: myId } } })
  lobby = ch
  useLive.setState({ signedIn: true })
  let syncs = 0
  ch
    .on('presence', { event: 'sync' }, async () => {
      const n = ++syncs
      const cards = Object.values(ch.presenceState<LivePlayer>()).map((v) => cleanCard(v[0])).filter((p): p is LivePlayer => !!p && p.id !== myId && p.uid !== authUid)
      await lookUp(cards)
      if (n !== syncs || lobby !== ch) return
      useLive.setState({ players: cards.map(verified).filter((p): p is LivePlayer => !!p) })
    })
    .on('broadcast', { event: 'challenge' }, async ({ payload }) => {
      const raw = cleanCard(payload.from)
      if (!raw?.uid || payload.to !== myId) return
      await lookUp([raw])
      const from = verified(raw)
      if (!from || typeof payload.raceId !== 'string' || useLive.getState().muted[from.id]) return
      const party = payload.mode === 'kart' && payload.party === true && !cleanStake(payload.stake) ? true : undefined
      if (!(await sentBy(payload.raceId, from.uid!, !!party))) return
      const l = useLive.getState()
      if (l.race || l.closed || l.muted[from.id]) return
      if ((l.cooldownFrom[from.id] ?? 0) > Date.now()) return
      // One pending challenge per sender: a repeat just replaces the old one.
      const fresh = !l.invites.some((i) => i.from.id === from.id)
      const stake = cleanStake(payload.stake)
      const mode: LiveMode = payload.mode === 'kart' && !stake ? 'kart' : 'drag'
      useLive.setState({ invites: [...l.invites.filter((i) => i.from.id !== from.id), { raceId: payload.raceId, from, at: Date.now(), mode, stake, party }] })
      if (fresh) {
        sfx.challenge()
        useGame.getState().toast(`${playerName(from.uid, from.town)} ${stake ? `bet 🪙${shortCoins(stake)} on a race` : party ? 'invited you to a kart party' : `challenged you to a ${mode === 'kart' ? 'kart race' : 'race'}`}! Tap 🏁`)
      }
    })
    .on('broadcast', { event: 'cancel' }, ({ payload }) => {
      const l = useLive.getState()
      const inv = l.invites.find((i) => i.raceId === payload.raceId)
      if (payload.to !== myId || !inv || payload.from !== inv.from.id) return
      useLive.setState({ invites: l.invites.filter((i) => i.raceId !== payload.raceId) })
      useGame.getState().toast(`${inv.from.town} called off their challenge`)
    })
    .on('broadcast', { event: 'expired' }, ({ payload }) => {
      const race = useLive.getState().race
      if (payload.to !== myId || !race || race.raceId !== payload.raceId || race.host) return
      useLive.setState({ race: null })
      if (race.stake) void voidWager(race.raceId)
      useGame.getState().toast(`${race.opponent.town}'s challenge had already expired`)
    })
    .on('broadcast', { event: 'answer' }, async ({ payload }) => {
      const raw = cleanCard(payload.from)
      if (raw?.uid) await lookUp([raw])
      // An answer to our kart party: noted against the player we invited.
      const party = useLive.getState().party
      if (party && payload.raceId === party.raceId) {
        const from = verified(raw)
        if (!from || !party.invited.some((p) => p.id === from.id) || from.id in party.answers) return
        useLive.setState({ party: { ...party, answers: { ...party.answers, [from.id]: !!payload.accept } } })
        return
      }
      const out = useLive.getState().outgoing
      if (!out || payload.raceId !== out.raceId) {
        // They accepted after we cancelled or gave up: let them know instead of leaving them waiting.
        if (payload.accept && sentIds.has(payload.raceId) && raw) {
          lobby?.send({ type: 'broadcast', event: 'expired', payload: { raceId: payload.raceId, to: raw.id } })
          // If it was a bet, they've already put both stakes down: call it off from this side too.
          void voidWager(payload.raceId)
        }
        return
      }
      // Only the player we challenged can answer it.
      const from = verified(raw)
      if (!from || from.id !== out.to) return
      // A real accept joined the race on the server before it was sent.
      if (payload.accept && !(await joinedBy(out.raceId, from.uid!))) return
      if (useLive.getState().outgoing?.raceId !== out.raceId) return
      useLive.setState({ outgoing: null })
      // Already racing someone else (we took another invite meanwhile): this yes came too late.
      if (payload.accept && useLive.getState().race) {
        lobby?.send({ type: 'broadcast', event: 'expired', payload: { raceId: out.raceId, to: from.id } })
        if (out.stake) void voidWager(out.raceId)
        return
      }
      if (!payload.accept) {
        sfx.error()
        // The bet couldn't be held (daily cap): they said yes, so a plain race can follow straight away.
        if (out.stake && payload.why === 'limit') return useGame.getState().toast(BET_LIMIT)
        startCooldown(out.to)
        return useGame.getState().toast('Challenge declined')
      }
      useLive.setState({ race: { raceId: out.raceId, opponent: from, host: true, mode: out.mode, stake: out.stake } })
      // Accepting held our stake on the server too.
      if (out.stake) void syncWagers()
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') ch.track(myCard())
    })
}

export function leaveLobby() {
  if (lobby && supabase) supabase.removeChannel(lobby)
  lobby = null
  useLive.setState({ players: [], invites: [], outgoing: null, signedIn: false })
}

export function refreshPresence() {
  lobby?.track(myCard())
}

// No re-challenging someone for a minute after they decline or ignore you. The entry is dropped when
// it ends so the store changes and every Live button (friends, crew ladder, race menu) turns back on;
// they read it with Date.now() while rendering, so nothing else would redraw them.
export function startCooldown(to: string) {
  const until = Date.now() + COOLDOWN_MS
  useLive.setState((l) => ({ cooldownTo: { ...l.cooldownTo, [to]: until } }))
  setTimeout(() => {
    if (useLive.getState().cooldownTo[to] !== until) return
    useLive.setState((l) => {
      const { [to]: _, ...rest } = l.cooldownTo
      return { cooldownTo: rest }
    })
  }, COOLDOWN_MS + 50)
}

// stake: coins to bet on a drag race (wager match), held by the server once they accept.
export async function challenge(to: string, mode: LiveMode = 'drag', stake?: number) {
  const l = useLive.getState()
  if (l.outgoing || (l.cooldownTo[to] ?? 0) > Date.now()) return
  const raceId = crypto.randomUUID()
  if (stake) mode = 'drag'
  useLive.setState({ outgoing: { raceId, to, mode, stake } })
  // Claim the race on the server before its id goes out to the lobby, so nobody
  // else in the lobby can take the id first and block the race.
  const ok = await joinRefereed(raceId, l.players.find((p) => p.id === to)?.uid)
  if (useLive.getState().outgoing?.raceId !== raceId) return
  if (!ok) {
    useLive.setState({ outgoing: null })
    useGame.getState().toast("Couldn't send the challenge. Try again in a moment.")
    return
  }
  if (stake && !(await offerWager(raceId, stake))) {
    if (useLive.getState().outgoing?.raceId === raceId) useLive.setState({ outgoing: null })
    useGame.getState().toast("Couldn't place that bet")
    return
  }
  if (useLive.getState().outgoing?.raceId !== raceId) return
  sentIds.add(raceId)
  lobby?.send({ type: 'broadcast', event: 'challenge', payload: { to, raceId, from: myCard(), mode, ...(stake ? { stake } : {}) } })
  // Give up if nobody answers.
  setTimeout(() => {
    if (useLive.getState().outgoing?.raceId === raceId) {
      useLive.setState({ outgoing: null })
      startCooldown(to)
      useGame.getState().toast('No answer to your challenge')
    }
  }, INVITE_MS)
}

// Call off our challenge before it's answered. The other player's invite disappears.
export function cancelChallenge() {
  const out = useLive.getState().outgoing
  if (!out) return
  lobby?.send({ type: 'broadcast', event: 'cancel', payload: { raceId: out.raceId, to: out.to, from: myId } })
  useLive.setState({ outgoing: null })
  useGame.getState().toast('Challenge cancelled')
}

// A wager challenge holds both stakes on the server first; if that fails it's declined.
export async function answer(raceId: string, accept: boolean) {
  const inv0 = useLive.getState().invites.find((i) => i.raceId === raceId)
  if (!inv0) return
  // One race at a time: saying yes calls off the challenge we were waiting on.
  if (accept && useLive.getState().outgoing) cancelChallenge()
  // Join the race on the server before saying yes, so the challenger can check the yes is ours.
  if (accept && !inv0.party && !(await joinRefereed(raceId, inv0.from.uid))) {
    useGame.getState().toast('That race is off')
    accept = false
  }
  let why: 'limit' | undefined
  if (accept && inv0.stake) {
    const held = await acceptWager(raceId, inv0.stake)
    if (held !== true) {
      why = held === 'limit' ? 'limit' : undefined
      useGame.getState().toast(why ? BET_LIMIT : 'That bet is off')
      accept = false
    }
  }
  const l = useLive.getState()
  // Stakes already held still race, even if the invite timed out meanwhile.
  const inv = l.invites.find((i) => i.raceId === raceId) ?? (accept && inv0.stake ? inv0 : undefined)
  if (!inv) return
  lobby?.send({ type: 'broadcast', event: 'answer', payload: { raceId, accept, from: myCard(), ...(why ? { why } : {}) } })
  useLive.setState({
    invites: l.invites.filter((i) => i.raceId !== raceId),
    cooldownFrom: accept ? l.cooldownFrom : { ...l.cooldownFrom, [inv.from.id]: Date.now() + COOLDOWN_MS },
    race: accept ? { raceId, opponent: inv.from, host: false, mode: inv.mode, stake: inv.stake, party: inv.party } : l.race,
  })
}

// Host a kart party: claim it on the server for everyone invited, invite them, and wait in
// the party's lobby (LiveKartParty) for answers. Up to five guests.
export async function hostParty(ids: string[]) {
  const l = useLive.getState()
  if (l.outgoing || l.party || l.race) return
  const invited = ids.map((id) => l.players.find((p) => p.id === id)).filter((p): p is LivePlayer => !!p?.uid && !p.closed).slice(0, PARTY_MAX - 1)
  if (invited.length < 1) return
  const raceId = crypto.randomUUID()
  const party: Party = { raceId, invited, answers: {} }
  useLive.setState({ party })
  if (!(await openParty(raceId, invited.map((p) => p.uid!)))) {
    if (useLive.getState().party?.raceId === raceId) useLive.setState({ party: null })
    useGame.getState().toast("Couldn't start the party. Try again in a moment.")
    return
  }
  if (useLive.getState().party?.raceId !== raceId) return
  sentIds.add(raceId)
  for (const p of invited) lobby?.send({ type: 'broadcast', event: 'challenge', payload: { to: p.id, raceId, from: myCard(), mode: 'kart', party: true } })
  useLive.setState({ race: { raceId, opponent: invited[0], host: true, mode: 'kart', party: true } })
}

// The host leaves their party: anyone who hasn't answered loses the invite.
export function endParty() {
  const party = useLive.getState().party
  if (!party) return
  for (const p of party.invited) if (!(p.id in party.answers)) lobby?.send({ type: 'broadcast', event: 'cancel', payload: { raceId: party.raceId, to: p.id, from: myId } })
  useLive.setState({ party: null })
}

// Drop challenges the sender has given up on.
export function pruneInvites() {
  const l = useLive.getState()
  const live = l.invites.filter((i) => Date.now() - i.at < INVITE_MS)
  if (live.length !== l.invites.length) useLive.setState({ invites: live })
}

export function mute(p: LivePlayer) {
  const l = useLive.getState()
  const muted = { ...l.muted, [p.id]: p.town }
  save('cartopia-muted', muted)
  const inv = l.invites.find((i) => i.from.id === p.id)
  if (inv) lobby?.send({ type: 'broadcast', event: 'answer', payload: { raceId: inv.raceId, accept: false, from: myCard() } })
  useLive.setState({ muted, invites: l.invites.filter((i) => i.from.id !== p.id) })
}

export function unmute(id: string) {
  const muted = { ...useLive.getState().muted }
  delete muted[id]
  save('cartopia-muted', muted)
  useLive.setState({ muted })
}

// Stop taking challenges at all. Other players see you as not available.
export function setClosed(closed: boolean) {
  save('cartopia-closed', closed)
  const l = useLive.getState()
  if (closed) for (const i of l.invites) lobby?.send({ type: 'broadcast', event: 'answer', payload: { raceId: i.raceId, accept: false, from: myCard() } })
  useLive.setState({ closed, invites: closed ? [] : l.invites })
  refreshPresence()
}

// A live race screen going away before GO calls its bet off, but only once the race itself has
// ended: React mounts a screen twice in development (and a remount is not the player leaving), and
// calling it off there refunded every bet while both players raced on with the pot showing.
export function voidUnlessRacing(raceId: string) {
  setTimeout(() => {
    if (useLive.getState().race?.raceId !== raceId) void voidWager(raceId)
  }, 0)
}

export function endLiveRace() {
  endParty()
  useLive.setState({ race: null })
}

// Per-race channel: opponent's distance and finish time, the start signal, and leaving before the start.
export function raceChannel(raceId: string, handlers: { onPos: (p: { dist: number; t: number; speed: number }) => void; onFinish: (t: number) => void; onGo: () => void; onReady: () => void; onLeave: () => void }) {
  if (!supabase) return null
  const ch = supabase.channel(raceTopic(raceId), { config: { private: true, broadcast: { self: false } } })
  ch.on('broadcast', { event: 'pos' }, ({ payload }) => handlers.onPos({ dist: payload.dist, t: payload.t ?? 0, speed: payload.speed ?? 0 }))
    .on('broadcast', { event: 'finish' }, ({ payload }) => handlers.onFinish(payload.t))
    .on('broadcast', { event: 'go' }, () => handlers.onGo())
    .on('broadcast', { event: 'ready' }, () => handlers.onReady())
    .on('broadcast', { event: 'leave' }, () => handlers.onLeave())
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') ch.send({ type: 'broadcast', event: 'ready', payload: {} })
    })
  return ch
}

// A live kart race's channel (the same private race topic): any event name, any payload,
// for lib/kartNet's KartLink. Call close() when the race screen goes.
// A kart party (3-6 players) runs the same way on its own topic, party:<id> (0058).
export function kartChannel(raceId: string, onJoined: () => void, topic = raceTopic(raceId)) {
  if (!supabase) return null
  const sb = supabase
  const ch = sb.channel(topic, { config: { private: true, broadcast: { self: false } } })
  const subs = new Map<string, ((p: unknown) => void)[]>()
  const on = (event: string, cb: (p: unknown) => void) => {
    if (!subs.has(event)) {
      subs.set(event, [])
      ch.on('broadcast', { event }, ({ payload }) => { for (const f of subs.get(event) ?? []) f(payload) })
    }
    subs.get(event)!.push(cb)
  }
  let joined = false
  // Every event this race uses has to be listened for before subscribing.
  for (const e of ['snap', 'notes', 'setup', 'ready', 'go', 'leave', 'here']) on(e, () => {})
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED' && !joined) { joined = true; onJoined() }
  })
  return {
    send: (event: string, payload: unknown) => void ch.send({ type: 'broadcast', event, payload }),
    on,
    close: () => void sb.removeChannel(ch),
  }
}
