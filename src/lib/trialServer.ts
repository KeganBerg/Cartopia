import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { trialWeek } from '../game/trial'
import { CARS, carDef, performance, type Body } from '../game/data'
import { DEMO, demoTown } from './friends'
import type { OwnedCar } from '../game/store'

// The weekly time trial board (supabase/migrations/0026_time_trials.sql). Signed-in players
// post times; everyone can look. Guests and offline players keep a best on this device only.

export type BoardRow = { owner: string; town: string | null; t: number; pi: number; car: string | null; place: number }
export type Board = { week: string; total: number; top: BoardRow[]; me: { t: number; place: number } | null; kept?: number }
export type TrialPrizes = { ready: boolean; prizes: { week: string; place: number; t: number }[] }

export async function fetchBoard(): Promise<Board | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('trial_board')
  return error ? null : (data as Board)
}

// Tells the server a run is starting. False: this run can't be posted (guest, offline, no save).
export async function startRun(): Promise<boolean> {
  if (!supabase || !signedInUser()) return false
  try {
    // The server times runs with the car from your cloud save, so send the latest one first.
    await flushSave()
    const { error } = await supabase.rpc('trial_start')
    return !error
  } catch {
    return false
  }
}

// Posts a finished run. Returns the board with the time the server kept, or null if it couldn't.
export async function submitRun(t: number): Promise<Board | null> {
  if (!supabase) return null
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.rpc('trial_submit', { t: Math.round(t * 1000) / 1000 })
    if (!error) return data as Board
    if (error.code === '23514' || error.code === '42501') return null
    await new Promise((r) => setTimeout(r, 1200))
  }
  return null
}

export async function fetchPrizes(): Promise<TrialPrizes | null> {
  if (!supabase || !signedInUser()) return null
  const { data, error } = await supabase.rpc('trial_prizes')
  return error ? null : (data as TrialPrizes)
}

// This device's best for the week, for guests and for the ghost.
const KEY = 'cartopia-trial-best'
export function localBest(week = trialWeek()): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { week: string; t: number } | null
    return v && v.week === week ? v.t : null
  } catch {
    return null
  }
}
export function saveLocalBest(t: number, week = trialWeek()) {
  const best = localBest(week)
  if (best !== null && best <= t) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ week, t }))
  } catch {
    // Storage blocked: the board still has it if signed in.
  }
}

const piOf = (c: OwnedCar) => performance(carDef(c.model), c.upgrades, c.mods)
const demoBest = (d: (typeof DEMO)[number]) => demoTown(d).cars.reduce((a, b) => (piOf(b) > piOf(a) ? b : a))
// Paint for a car whose save can't be read.
const PAINT = ['#d32f2f', '#1565c0', '#2e7d32', '#ff8f00', '#6a1b9a', '#00838f']

// The car each board row set its time in, for the podium and the rows' thumbs: the model by the
// name the board kept, drawn as that player saved it (paint, finish, skins, panels, trim, mods, hat)
// so it looks the same as in their town and on their profile.
export type BoardCar = Pick<OwnedCar, 'color' | 'finish' | 'skin' | 'modSkin' | 'panels' | 'trim' | 'mods' | 'hat' | 'stripe'> & { body: Body; model?: string }
export const boardLook = (c: OwnedCar): BoardCar => {
  const out: BoardCar = { body: carDef(c.model).body, model: c.model, color: c.color }
  for (const k of ['finish', 'skin', 'modSkin', 'panels', 'trim', 'mods', 'hat', 'stripe'] as const) if (c[k] != null) Object.assign(out, { [k]: c[k] })
  return out
}
// Of a player's saved cars, the one their best_car names: same model, the same paint if several.
export function savedCar(cars: unknown, model: string, color?: unknown): OwnedCar | undefined {
  if (!Array.isArray(cars)) return undefined
  const mine = (cars as OwnedCar[]).filter((c) => c && c.model === model && typeof c.color === 'string')
  const pi = (c: OwnedCar) => (c.upgrades ? piOf(c) : 0)
  return (mine.filter((c) => c.color === color).length ? mine.filter((c) => c.color === color) : mine).reduce<OwnedCar | undefined>((a, b) => (!a || pi(b) > pi(a) ? b : a), undefined)
}
export async function fetchBoardCars(rows: BoardRow[]): Promise<Record<string, BoardCar>> {
  const out: Record<string, BoardCar> = {}
  const real = rows.filter((r) => !r.owner.startsWith('demo-'))
  for (const r of rows) {
    const d = CARS.find((c) => c.name === r.car)
    if (d) out[r.owner] = { body: d.body, model: d.id, color: PAINT[r.place % PAINT.length] }
    const demo = DEMO.find((x) => x.id === r.owner)
    const c = demo && demoBest(demo)
    if (c) out[r.owner] = boardLook(c)
  }
  if (!supabase || real.length === 0) return out
  const { data, error } = await supabase.from('game_saves').select('owner_id, best_car, cars:state->cars').in('owner_id', real.map((r) => r.owner))
  if (error || !data) return out
  for (const s of data as { owner_id: string; best_car: Record<string, unknown> | null; cars: unknown }[]) {
    const b = s.best_car
    if (!b) continue
    const row = real.find((r) => r.owner === s.owner_id)
    const def = CARS.find((c) => c.name === (row?.car ?? b.name)) ?? CARS.find((c) => c.name === b.name)
    if (!def) continue
    const same = b.name === def.name
    const saved = savedCar(s.cars, def.id, same ? b.color : undefined)
    out[s.owner_id] = saved ? boardLook(saved) : {
      body: def.body,
      model: def.id,
      color: typeof b.color === 'string' ? b.color : out[s.owner_id]?.color ?? PAINT[0],
      ...(same && Array.isArray(b.mods) ? { mods: (b.mods as unknown[]).filter((m): m is string => typeof m === 'string') } : {}),
    }
  }
  return out
}

// Offline (no server): the demo neighbours' times, so the board, podium and their profiles
// still show. Never used when the game has a server.
export function demoBoard(week = trialWeek()): Board {
  const base = 7.1
  const top = DEMO.map((d, i) => {
    const c = demoBest(d)
    return { owner: d.id, town: d.name, t: Math.round((base + i * 0.137 + (d.seed % 5) * 0.011) * 1000) / 1000, pi: piOf(c), car: carDef(c.model).name, place: 0 }
  }).sort((a, b) => a.t - b.t).map((r, i) => ({ ...r, place: i + 1 }))
  return { week, total: top.length, top, me: null }
}
