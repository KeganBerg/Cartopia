import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { useGame } from '../game/store'
import type { WagerEntry } from '../game/wager'

// Wager races (supabase/migrations/0057_wager_matches.sql). The server holds both stakes when a
// challenge is accepted and pays the winner; the game adds the ledger rows to its coins.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Off until the server has the wager functions; set once a call shows they're missing.
let missing = false
export const wagersOn = () => !!supabase && !missing

const fail = (code?: string) => {
  if (code === 'PGRST202') missing = true
  return false
}

// The challenger's stake on a race it just claimed with race_join.
export async function offerWager(raceId: string, stake: number): Promise<boolean> {
  if (!supabase || !signedInUser()) return false
  await flushSave()
  const { error } = await supabase.rpc('wager_offer', { race_id: raceId, stake })
  return error ? fail(error.code) : true
}

// Holds both stakes. stake: what the challenge showed; the server checks it's what was offered.
// False: the wager expired, doesn't match, or someone can't cover it any more.
export async function acceptWager(raceId: string, stake: number): Promise<boolean> {
  if (!supabase || !signedInUser()) return false
  await flushSave()
  const { error } = await supabase.rpc('wager_accept', { race_id: raceId, stake })
  if (error) return fail(error.code)
  await syncWagers()
  return true
}

// Adds ledger rows the save hasn't counted yet. Returns the coin change.
export async function syncWagers(): Promise<number> {
  if (!supabase || !signedInUser() || missing) return 0
  const from = useGame.getState().wagers ?? 0
  const { data, error } = await supabase.from('wager_ledger').select('seq, delta, race_id, kind').gt('seq', from).order('seq')
  if (error) return 0
  return useGame.getState().applyWagers((data ?? []).map((e) => ({ ...e, delta: Number(e.delta) }) as WagerEntry))
}

// After the referee calls a wager race: waits for its payout (a win or a refund) to land.
export async function settleWager(raceId: string): Promise<number> {
  if (!supabase || !signedInUser() || missing) return 0
  for (let i = 0; i < 8; i++) {
    const { data } = await supabase.from('wagers').select('status').eq('race_id', raceId).maybeSingle()
    if (!data || data.status === 'settled') break
    await wait(1000)
  }
  return syncWagers()
}

// On load: calls held races that never finished, then picks up anything owed.
export async function startWagers() {
  if (!supabase || !signedInUser()) return
  const { error } = await supabase.rpc('wager_sync')
  if (error) {
    fail(error.code)
    return
  }
  await syncWagers()
}
