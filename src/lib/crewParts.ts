import { create } from 'zustand'
import { supabase } from './supabase'
import { signedInUser, flushSave } from './cloud'
import { displayName } from './names'
import { useGame } from '../game/store'

// Crew part requests (supabase/migrations/0067_postcards_crew_parts.sql): once a day you can ask
// your crew for 10 parts. Crewmates give one at a time from their own parts (up to 5 each), and
// what's been given is collected into your town.

export const CREW_ASK = 10
export const CREW_GIVE_MAX = 5

export type PartRequest = { id: number; asker: string; name: string; want: number; given: number; mine: number }
export const useCrewParts = create<{ list: PartRequest[]; loaded: boolean }>(() => ({ list: [], loaded: false }))

const ready = () => !!supabase && !!signedInUser()
const say = (t: string) => useGame.getState().toast(t)

export async function refreshCrewParts() {
  if (!ready()) return
  const { data, error } = await supabase!.rpc('crew_part_requests')
  if (error) return
  const rows = (data ?? []) as { id: number; asker: string; town_name: string; want: number; given: number; mine: number }[]
  useCrewParts.setState({ loaded: true, list: rows.map((r) => ({ id: r.id, asker: r.asker, name: displayName(r.town_name, r.asker), want: r.want, given: r.given, mine: r.mine })) })
}

export async function askCrewParts() {
  if (!ready()) return say('Sign in to ask your crew')
  const { data, error } = await supabase!.rpc('ask_crew_parts')
  if (error || data === 'no') return say('Join a crew to ask for parts')
  say(data === 'already' ? 'You already asked today' : `⚙ Asked your crew for ${CREW_ASK} parts`)
  await refreshCrewParts()
}

// Gives one of your own parts to a crewmate's request.
export async function giveCrewPart(id: number) {
  const g = useGame.getState()
  if (!ready()) return say('Sign in to help your crew')
  if (g.parts < 1) return say('You have no parts to give')
  const { data, error } = await supabase!.rpc('give_crew_part', { p_request: id })
  if (error || data === 'no') return say("Couldn't give that part")
  if (data === 'full') return say('That request is already filled')
  if (data === 'limit') return say(`You can give ${CREW_GIVE_MAX} to each request and 20 a day`)
  if (data === 'own') return
  useGame.setState((s) => ({ parts: Math.max(0, s.parts - 1), updatedAt: Date.now() }))
  say('⚙ Part given. Thanks for helping!')
  await refreshCrewParts()
}

// Adds what crewmates have given to your town.
export async function claimCrewParts() {
  if (!ready()) return 0
  const { data, error } = await supabase!.rpc('claim_crew_parts')
  const n = error ? 0 : Number(data) || 0
  if (n > 0) {
    useGame.setState((s) => ({ parts: s.parts + n, updatedAt: Date.now() }))
    say(`⚙ Collected ${n} part${n > 1 ? 's' : ''} from your crew`)
    await flushSave()
  }
  return n
}
