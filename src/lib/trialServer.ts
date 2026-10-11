import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { trialWeek } from '../game/trial'

// The weekly time trial board (supabase/migrations/0022_time_trials.sql). Signed-in players
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
