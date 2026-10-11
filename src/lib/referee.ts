import { supabase } from './supabase'
import { SERVER_CAR_COLUMNS, serverCar } from './serverCar'
import { flushSave, signedInUser } from './cloud'

// Live races between two signed-in players are decided by the server
// (supabase/migrations/0009_live_race_referee.sql): it knows each player's real car
// and how fast that car can possibly finish. Races with a guest stay unrefereed.

export type Verdict = { won: boolean; myTime: number; theirTime: number; forfeit: boolean; void: boolean }
type View = { done: boolean; won: boolean | null; void: boolean; forfeit: boolean; my_t: number | null; their_t: number | null }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Joins the server's copy of the race. False means it can't be refereed (guest, offline, no save).
export async function joinRefereed(raceId: string, opponentUid: string | null | undefined): Promise<boolean> {
  if (!supabase || !opponentUid || !signedInUser()) return false
  try {
    await flushSave()
    for (let i = 0; i < 3; i++) {
      const { error } = await supabase.rpc('race_join', { race_id: raceId, opponent: opponentUid })
      if (!error) return true
      if (error.code === 'P0002' || error.code === '42501') return false
      await wait(800)
    }
  } catch {
    // Offline: play it unrefereed.
  }
  return false
}

// The opponent's race car as the server sees it (its PI is checked by the economy guard).
export async function serverPi(uid: string): Promise<number | null> {
  if (!supabase) return null
  const { data } = await supabase.from('game_saves').select(SERVER_CAR_COLUMNS).eq('owner_id', uid).maybeSingle()
  return data ? serverCar(data)?.pi ?? null : null
}

const toVerdict = (v: View): Verdict => ({
  won: !!v.won,
  myTime: Number(v.my_t ?? Infinity),
  theirTime: v.their_t === null ? Infinity : Number(v.their_t),
  forfeit: v.forfeit,
  void: v.void,
})

// Reports our finish time, retrying through short connection drops, then waits for the
// result. Null means the server couldn't be reached at all.
export async function reportFinish(raceId: string, t: number, signal: { cancelled: boolean }): Promise<Verdict | null> {
  if (!supabase) return null
  let view: View | null = null
  const giveUp = Date.now() + 40000
  while (!view && Date.now() < giveUp && !signal.cancelled) {
    const { data, error } = await supabase.rpc('race_finish', { race_id: raceId, t })
    if (!error) view = data as View
    else await wait(1500)
  }
  // The other player has 45 seconds after we finish; then the server calls it.
  const until = Date.now() + 60000
  while (view && !view.done && Date.now() < until && !signal.cancelled) {
    await wait(1000)
    const { data, error } = await supabase.rpc('race_status', { race_id: raceId })
    if (!error) view = data as View
  }
  return view?.done ? toVerdict(view) : null
}
