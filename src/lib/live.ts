import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useGame } from '../game/store'
import { carDef, performance, type Body } from '../game/data'

// Live drag racing over Supabase Realtime. A shared lobby channel carries
// presence and challenges; each race gets its own channel for positions.

export type LivePlayer = { id: string; town: string; level: number; carName: string; color: string; body: Body; pi: number }
export type LiveRace = { raceId: string; opponent: LivePlayer; host: boolean }

type LiveState = {
  me: string
  players: LivePlayer[]
  incoming: { raceId: string; from: LivePlayer } | null
  outgoing: { raceId: string; to: string } | null
  race: LiveRace | null
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

export const useLive = create<LiveState>(() => ({ me: myId, players: [], incoming: null, outgoing: null, race: null }))

let lobby: RealtimeChannel | null = null

function myCard(): LivePlayer {
  const s = useGame.getState()
  const best = [...s.cars].sort((a, b) => performance(carDef(b.model), b.upgrades) - performance(carDef(a.model), a.upgrades))[0]
  const d = carDef(best.model)
  return { id: myId, town: s.townName, level: s.level, carName: d.name, color: best.color, body: d.body, pi: performance(d, best.upgrades) }
}

export function joinLobby() {
  if (!supabase || lobby) return
  lobby = supabase.channel('race-lobby', { config: { presence: { key: myId } } })
  lobby
    .on('presence', { event: 'sync' }, () => {
      const state = lobby!.presenceState<LivePlayer>()
      const players = Object.values(state).map((v) => v[0]).filter((p) => p && p.id !== myId)
      useLive.setState({ players })
    })
    .on('broadcast', { event: 'challenge' }, ({ payload }) => {
      if (payload.to !== myId || useLive.getState().race) return
      useLive.setState({ incoming: { raceId: payload.raceId, from: payload.from } })
    })
    .on('broadcast', { event: 'answer' }, ({ payload }) => {
      const out = useLive.getState().outgoing
      if (!out || payload.raceId !== out.raceId) return
      useLive.setState({ outgoing: null })
      if (!payload.accept) return useGame.getState().toast('Challenge declined')
      useLive.setState({ race: { raceId: out.raceId, opponent: payload.from, host: true } })
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
  const raceId = crypto.randomUUID()
  useLive.setState({ outgoing: { raceId, to } })
  lobby?.send({ type: 'broadcast', event: 'challenge', payload: { to, raceId, from: myCard() } })
  // Give up if nobody answers.
  setTimeout(() => {
    if (useLive.getState().outgoing?.raceId === raceId) {
      useLive.setState({ outgoing: null })
      useGame.getState().toast('No answer to your challenge')
    }
  }, 20000)
}

export function answer(accept: boolean) {
  const inc = useLive.getState().incoming
  if (!inc) return
  lobby?.send({ type: 'broadcast', event: 'answer', payload: { raceId: inc.raceId, accept, from: myCard() } })
  useLive.setState({ incoming: null, race: accept ? { raceId: inc.raceId, opponent: inc.from, host: false } : null })
}

export function endLiveRace() {
  useLive.setState({ race: null })
}

// Per-race channel: opponent's distance and finish time, plus the start signal.
export function raceChannel(raceId: string, handlers: { onPos: (dist: number) => void; onFinish: (t: number) => void; onGo: () => void; onReady: () => void }) {
  if (!supabase) return null
  const ch = supabase.channel(`race-${raceId}`, { config: { broadcast: { self: false } } })
  ch.on('broadcast', { event: 'pos' }, ({ payload }) => handlers.onPos(payload.dist))
    .on('broadcast', { event: 'finish' }, ({ payload }) => handlers.onFinish(payload.t))
    .on('broadcast', { event: 'go' }, () => handlers.onGo())
    .on('broadcast', { event: 'ready' }, () => handlers.onReady())
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') ch.send({ type: 'broadcast', event: 'ready', payload: {} })
    })
  return ch
}
