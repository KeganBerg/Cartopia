import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { kartChannel } from './live'

// Kart parties: live kart races for 3 to 6 signed-in players, refereed by the server
// (supabase/migrations/0058_kart_parties.sql). The host opens the party with everyone they
// invite; each player joins as the race starts and reports their finish time; the server
// places the players by time once they're all in, or a minute after the first finish.

export type PartyVerdict = { place: number; of: number; myTime: number; void: boolean }
type View = { done: boolean; place: number; of: number; my_t: number | null; times: (number | null)[] }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const partyChannel = (id: string, onJoined: () => void) => kartChannel(id, onJoined, `party:${id}`)

async function call(fn: string, args: Record<string, unknown>) {
  if (!supabase || !signedInUser()) return false
  try {
    for (let i = 0; i < 3; i++) {
      const { error } = await supabase.rpc(fn, args)
      if (!error) return true
      if (error.code === 'P0002' || error.code === '42501') return false
      await wait(800)
    }
  } catch {
    // Offline.
  }
  return false
}

// The host claims the party for everyone they invite, before any invite goes out.
export const openParty = (id: string, guestUids: string[]) => call('kart_party_open', { party_id: id, guests: guestUids })

// Every player (the host too) as the race starts. False: this race can't be refereed for us.
export async function joinParty(id: string) {
  await flushSave().catch(() => {})
  return call('kart_party_join', { party_id: id })
}

// Our finish time, then the wait for the others. Null: the server couldn't be reached.
export async function reportPartyFinish(id: string, t: number): Promise<PartyVerdict | null> {
  if (!supabase) return null
  let view: View | null = null
  const giveUp = Date.now() + 40000
  while (!view && Date.now() < giveUp) {
    const { data, error } = await supabase.rpc('kart_party_finish', { party_id: id, t })
    if (!error) view = data as View
    else if (error.code === '42501') return null
    else await wait(1500)
  }
  const until = Date.now() + 75000
  while (view && !view.done && Date.now() < until) {
    await wait(1500)
    const { data, error } = await supabase.rpc('kart_party_status', { party_id: id })
    if (!error) view = data as View
  }
  return view?.done ? { place: view.place, of: view.of, myTime: Number(view.my_t ?? Infinity), void: false } : null
}

// Coins for a placing: the whole prize for the winner, less down the order.
export const PARTY_SHARE = [1, 0.4, 0.25, 0.15, 0.1, 0.1]
