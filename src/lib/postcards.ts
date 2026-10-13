import { create } from 'zustand'
import { supabase } from './supabase'
import { signedInUser } from './cloud'
import { displayName } from './names'
import { useGame } from '../game/store'

// Postcards (supabase/migrations/0067_postcards_crew_parts.sql): a picture card and a set
// message for another player, one per friend a day. Set messages only, so there's no free
// text to moderate. Sending one counts towards friendship (game/friendship.ts).

export const CARDS = [
  { id: 'sunset', name: 'Sunset Drive', icon: '🌅', bg: 'linear-gradient(160deg, #ffb36b, #f0625d 60%, #6a3d7a)' },
  { id: 'neon', name: 'Neon Night', icon: '🌃', bg: 'linear-gradient(160deg, #1a0630, #4b1d7a 55%, #ff4fd8)' },
  { id: 'beach', name: 'Beach Day', icon: '🏖️', bg: 'linear-gradient(160deg, #7fd8ff, #4fc3f7 50%, #ffe0a3)' },
  { id: 'snow', name: 'Snow Peak', icon: '🏔️', bg: 'linear-gradient(160deg, #e6f0f7, #a9c7e3 60%, #5d7fa8)' },
  { id: 'flag', name: 'Race Day', icon: '🏁', bg: 'repeating-conic-gradient(#222 0 25%, #fafafa 0 50%) 0 0 / 24px 24px' },
  { id: 'garage', name: 'Garage', icon: '🔧', bg: 'linear-gradient(160deg, #90a4ae, #546e7a 60%, #ffca28)' },
] as const
export const MESSAGES = [
  'Wish you were here!', 'Race you later?', 'Love your town!', 'Thanks for the help!',
  'GG, well raced!', 'Happy racing!', 'Come visit soon!', 'Check out my new car!',
]
export const cardOf = (id: string) => CARDS.find((c) => c.id === id) ?? CARDS[0]

export type Postcard = { id: number; card: string; msg: number; from: string; fromName: string; at: string }
type State = { inbox: Postcard[]; sent: Record<string, true>; seen: number }
const SEEN = 'cartopia-postcards-seen'
const readSeen = () => {
  try { return Number(localStorage.getItem(SEEN)) || 0 } catch { return 0 }
}
export const usePostcards = create<State>(() => ({ inbox: [], sent: {}, seen: readSeen() }))

const ready = () => !!supabase && !!signedInUser()

export async function refreshPostcards() {
  if (!ready()) return
  const { data, error } = await supabase!.rpc('postcard_inbox')
  if (error) return
  const rows = (data ?? []) as { id: number; card: string; msg: number; sender: string; town_name: string; created_at: string }[]
  usePostcards.setState({ inbox: rows.map((r) => ({ id: r.id, card: r.card, msg: r.msg, from: r.sender, fromName: displayName(r.town_name, r.sender), at: r.created_at })) })
}

// Marks every card in the inbox as looked at (this device only), so the dot goes away.
export function seePostcards() {
  const top = usePostcards.getState().inbox[0]?.id ?? 0
  usePostcards.setState({ seen: top })
  try { localStorage.setItem(SEEN, String(top)) } catch { /* private window: the dot comes back next time */ }
}

export async function sendPostcard(to: string, card: string, msg: number, name?: string) {
  const toast = useGame.getState().toast
  if (!ready()) return toast('Sign in to send postcards')
  const { data, error } = await supabase!.rpc('send_postcard', { p_to: to, p_card: card, p_msg: msg })
  if (error || data === 'no') return toast("Couldn't send that postcard")
  if (data === 'limit') return toast("That's all 20 postcards for today")
  usePostcards.setState((s) => ({ sent: { ...s.sent, [to]: true } }))
  if (data === 'already') return toast('One postcard a day to each friend')
  toast(`💌 Postcard sent!`)
  useGame.getState().befriend(to, 'postcard', name)
}
