import { supabase } from './supabase'
import { signedInUser } from './cloud'
import type { ArcadeGame } from '../game/arcade'

// Weekly arcade boards (supabase/migrations/0086_arcade_boards.sql).
// Signed-in players post results; everyone can look. Until the SQL is run every call here
// quietly comes back empty and the boards stay hidden.

export type BoardGame = Exclude<ArcadeGame, 'park'>
export const BOARD_GAMES: BoardGame[] = ['chase', 'stunt', 'delivery', 'wash', 'pit']
export type ArcadeRow = { owner: string; town: string | null; best: number; place: number }
export type ArcadeBoard = { week: string; game: BoardGame; total: number; top: ArcadeRow[]; me: { best: number; place: number } | null }

export async function fetchArcadeBoard(game: BoardGame): Promise<ArcadeBoard | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('arcade_board', { g: game })
  return error ? null : (data as ArcadeBoard)
}

// Tells the server a run is starting, so it can time it. Resolves false if this run can't be posted.
let started: Promise<boolean> = Promise.resolve(false)
export function startArcadeRun(game: BoardGame) {
  started = (async () => {
    if (!supabase || !signedInUser()) return false
    const { error } = await supabase.rpc('arcade_start', { g: game })
    return !error
  })().catch(() => false)
}

// Posts a finished run's result (Pit Stop: seconds; the rest: the score or count). Returns the
// board with my place, or null if it wasn't posted.
export async function submitArcadeRun(game: BoardGame, result: number): Promise<ArcadeBoard | null> {
  if (!supabase || !(await started)) return null
  started = Promise.resolve(false)
  const { data, error } = await supabase.rpc('arcade_submit', { g: game, v: result })
  return error ? null : (data as ArcadeBoard)
}
