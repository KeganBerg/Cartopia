import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useGame } from '../game/store'
import { CARS, MODS, carDef, performance, type Body } from '../game/data'
import { displayName, isCleanName } from './names'
import { signedInUser } from './cloud'

// Live drag racing over Supabase Realtime. A shared lobby channel carries
// presence and challenges; each race gets its own channel for positions.

// uid: the signed-in account, which lets the server referee the race (guests have none).
export type LivePlayer = { id: string; uid?: string | null; town: string; level: number; carName: string; color: string; body: Body; pi: number; mods?: string[]; closed?: boolean }
export type Invite = { raceId: string; from: LivePlayer; at: number }
export type LiveRace = { raceId: string; opponent: LivePlayer; host: boolean }

type LiveState = {
  me: string
  players: LivePlayer[]
  // Challenges waiting in the inbox, at most one per sender.
  invites: Invite[]
  outgoing: { raceId: string; to: string } | null
  race: LiveRace | null
  muted: Record<string, string>
  closed: boolean
  // Sender id -> time before which their challenges are ignored, and
  // target id -> time before which we can't challenge them again.
  cooldownFrom: Record<string, number>
  cooldownTo: Record<string, number>
}

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
  me: myId, players: [], invites: [], outgoing: null, race: null,
  muted: load('cartopia-muted', {}), closed: load('cartopia-closed', false), cooldownFrom: {}, cooldownTo: {},
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
    closed: c.closed === true,
  }
}

let lobby: RealtimeChannel | null = null
// Challenges we sent, so a late accept of one we already dropped can be told it expired.
const sentIds = new Set<string>()

function myCard(): LivePlayer {
  const s = useGame.getState()
  const best = [...s.cars].sort((a, b) => performance(carDef(b.model), b.upgrades, b.mods) - performance(carDef(a.model), a.upgrades, a.mods))[0]
  const d = carDef(best.model)
  return { id: myId, uid: signedInUser(), town: displayName(s.townName, myId), level: s.level, carName: d.name, color: best.color, body: d.body, pi: performance(d, best.upgrades, best.mods), mods: best.mods, closed: useLive.getState().closed }
}

export function joinLobby() {
  if (!supabase || lobby) return
  lobby = supabase.channel('race-lobby', { config: { presence: { key: myId } } })
  lobby
    .on('presence', { event: 'sync' }, () => {
      const state = lobby!.presenceState<LivePlayer>()
      const players = Object.values(state).map((v) => cleanCard(v[0])).filter((p): p is LivePlayer => !!p && p.id !== myId)
      useLive.setState({ players })
    })
    .on('broadcast', { event: 'challenge' }, ({ payload }) => {
      const l = useLive.getState()
      const from = cleanCard(payload.from)
      if (!from || typeof payload.raceId !== 'string' || payload.to !== myId || l.race || l.closed || l.muted[from.id]) return
      if ((l.cooldownFrom[from.id] ?? 0) > Date.now()) return
      // One pending challenge per sender: a repeat just replaces the old one.
      const fresh = !l.invites.some((i) => i.from.id === from.id)
      useLive.setState({ invites: [...l.invites.filter((i) => i.from.id !== from.id), { raceId: payload.raceId, from, at: Date.now() }] })
      if (fresh) useGame.getState().toast(`${from.town} challenged you to a race! Tap 🏁 to answer.`)
    })
    .on('broadcast', { event: 'cancel' }, ({ payload }) => {
      const l = useLive.getState()
      const inv = l.invites.find((i) => i.raceId === payload.raceId)
      if (payload.to !== myId || !inv) return
      useLive.setState({ invites: l.invites.filter((i) => i.raceId !== payload.raceId) })
      useGame.getState().toast(`${inv.from.town} called off their challenge`)
    })
    .on('broadcast', { event: 'expired' }, ({ payload }) => {
      const race = useLive.getState().race
      if (payload.to !== myId || !race || race.raceId !== payload.raceId || race.host) return
      useLive.setState({ race: null })
      useGame.getState().toast(`${race.opponent.town}'s challenge had already expired`)
    })
    .on('broadcast', { event: 'answer' }, ({ payload }) => {
      const out = useLive.getState().outgoing
      if (!out || payload.raceId !== out.raceId) {
        // They accepted after we cancelled or gave up: let them know instead of leaving them waiting.
        if (payload.accept && sentIds.has(payload.raceId)) {
          lobby?.send({ type: 'broadcast', event: 'expired', payload: { raceId: payload.raceId, to: cleanCard(payload.from)?.id } })
        }
        return
      }
      useLive.setState({ outgoing: null })
      if (!payload.accept) {
        useLive.setState((l) => ({ cooldownTo: { ...l.cooldownTo, [out.to]: Date.now() + COOLDOWN_MS } }))
        return useGame.getState().toast('Challenge declined')
      }
      const from = cleanCard(payload.from)
      if (!from) return
      useLive.setState({ race: { raceId: out.raceId, opponent: from, host: true } })
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') lobby!.track(myCard())
    })
}

export function leaveLobby() {
  if (lobby && supabase) supabase.removeChannel(lobby)
  lobby = null
  useLive.setState({ players: [] })
}

export function refreshPresence() {
  lobby?.track(myCard())
}

export function challenge(to: string) {
  const l = useLive.getState()
  if (l.outgoing || (l.cooldownTo[to] ?? 0) > Date.now()) return
  const raceId = crypto.randomUUID()
  sentIds.add(raceId)
  useLive.setState({ outgoing: { raceId, to } })
  lobby?.send({ type: 'broadcast', event: 'challenge', payload: { to, raceId, from: myCard() } })
  // Give up if nobody answers.
  setTimeout(() => {
    if (useLive.getState().outgoing?.raceId === raceId) {
      useLive.setState((s) => ({ outgoing: null, cooldownTo: { ...s.cooldownTo, [to]: Date.now() + COOLDOWN_MS } }))
      useGame.getState().toast('No answer to your challenge')
    }
  }, INVITE_MS)
}

// Call off our challenge before it's answered. The other player's invite disappears.
export function cancelChallenge() {
  const out = useLive.getState().outgoing
  if (!out) return
  lobby?.send({ type: 'broadcast', event: 'cancel', payload: { raceId: out.raceId, to: out.to } })
  useLive.setState({ outgoing: null })
  useGame.getState().toast('Challenge cancelled')
}

export function answer(raceId: string, accept: boolean) {
  const l = useLive.getState()
  const inv = l.invites.find((i) => i.raceId === raceId)
  if (!inv) return
  lobby?.send({ type: 'broadcast', event: 'answer', payload: { raceId, accept, from: myCard() } })
  useLive.setState({
    invites: l.invites.filter((i) => i.raceId !== raceId),
    cooldownFrom: accept ? l.cooldownFrom : { ...l.cooldownFrom, [inv.from.id]: Date.now() + COOLDOWN_MS },
    race: accept ? { raceId, opponent: inv.from, host: false } : l.race,
  })
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

export function endLiveRace() {
  useLive.setState({ race: null })
}

// Per-race channel: opponent's distance and finish time, the start signal, and leaving before the start.
export function raceChannel(raceId: string, handlers: { onPos: (p: { dist: number; t: number; speed: number }) => void; onFinish: (t: number) => void; onGo: () => void; onReady: () => void; onLeave: () => void }) {
  if (!supabase) return null
  const ch = supabase.channel(`race-${raceId}`, { config: { broadcast: { self: false } } })
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
