import { create } from 'zustand'
import { supabase } from './supabase'
import { signedInUser, flushSave } from './cloud'
import { displayName } from './names'
import { useGame } from '../game/store'

// Amounts are fixed server-side in supabase/migrations/0025_friend_gifts.sql; these are for labels.
export const HELP_FUEL = 10
export const GIFTS = { fuel: { amount: 15, icon: '⛽', label: 'fuel' }, parts: { amount: 5, icon: '⚙', label: 'parts' } } as const
export type GiftItem = keyof typeof GIFTS

export type Note = { id: number; kind: 'help' | GiftItem; amount: number; from: string; fromName: string; at: string }

type GiftState = {
  inbox: Note[]
  // Friends already sent today's gift.
  sent: Record<string, true>
  // The inbox opens by itself once per page load.
  shown: boolean
}

export const useGifts = create<GiftState>(() => ({ inbox: [], sent: {}, shown: false }))

const signedIn = () => !!supabase && !!signedInUser()

export async function refreshGifts() {
  if (!supabase || !signedIn()) return
  const [inbox, sent] = await Promise.all([supabase.rpc('gift_inbox'), supabase.rpc('gifts_sent_today')])
  if (!inbox.error) {
    const rows = (inbox.data ?? []) as { id: number; kind: Note['kind']; amount: number; sender: string; town_name: string; created_at: string }[]
    useGifts.setState({ inbox: rows.map((r) => ({ id: r.id, kind: r.kind, amount: r.amount, from: r.sender, fromName: displayName(r.town_name, r.sender), at: r.created_at })) })
  }
  if (!sent.error) useGifts.setState({ sent: Object.fromEntries(((sent.data ?? []) as string[]).map((id) => [id, true as const])) })
}

// Tells a real player you helped their town. Demo neighbours and guests skip it.
export function recordHelp(ownerId: string) {
  if (!supabase || !signedIn() || ownerId.startsWith('demo-')) return
  supabase.rpc('friend_help', { p_owner: ownerId }).then(() => {}, () => {})
}

export async function sendGift(to: string, item: GiftItem) {
  const toast = useGame.getState().toast
  if (!supabase || !signedIn()) return toast('Sign in to send gifts')
  const { data, error } = await supabase.rpc('send_gift', { p_to: to, p_item: item })
  if (error || data === 'no') return toast("Couldn't send that gift")
  if (data === 'limit') return toast("That's all 10 gifts for today")
  useGifts.setState((g) => ({ sent: { ...g.sent, [to]: true } }))
  if (data === 'sent') toast(`Sent ${GIFTS[item].icon} ${GIFTS[item].amount} ${GIFTS[item].label}!`)
}

// Collects what the server allows today and adds it to the town.
export async function claimGifts() {
  const s = useGame.getState()
  if (!supabase || !signedIn()) return s.toast('Sign in to collect gifts')
  const { data, error } = await supabase.rpc('claim_gifts')
  if (error || !data) return s.toast("Couldn't collect right now. Try again soon.")
  const got = data as { fuel: number; parts: number; count: number; left: number }
  if (got.count > 0) {
    // Paid oldest first; the inbox lists newest first. Drop them now so the panel
    // reacts even if the refresh below is slow.
    useGifts.setState((g) => ({ inbox: g.inbox.slice(0, Math.max(0, g.inbox.length - got.count)) }))
    s.receiveGifts(got.fuel, got.parts)
    await flushSave()
  }
  if (got.left > 0) s.toast(got.count > 0 ? `${got.left} more waiting. You can collect 10 a day.` : "You've collected 10 today. The rest wait for tomorrow.")
  await refreshGifts().catch(() => {})
}

// Inbox totals, for the collect button.
export function noteTotals(notes: Note[]) {
  let fuel = 0
  let parts = 0
  for (const n of notes.slice(-10)) {
    if (n.kind === 'parts') parts += n.amount
    else fuel += n.amount
  }
  return { fuel, parts }
}
