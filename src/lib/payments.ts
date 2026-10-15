import { create } from 'zustand'
import type { BucksPack } from '../game/bucksPacks'
import { useGame, type Purchase } from '../game/store'
import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'

// Gem packs are paid on Stripe Checkout. netlify/functions/checkout.mts starts the checkout and
// sends the player to Stripe; stripe-webhook.mts records the paid pack in the purchases table
// (purchase_record()), and syncPurchases() adds rows the save hasn't counted yet. The save guard
// only lets the gems in when the row is there, so a page can't grant itself a pack.
export type PurchaseResult = { ok: true } | { ok: false; reason: 'not-connected' | 'sign-in' | 'blocked' | 'level' | 'owned' | 'failed' }

export async function purchase(pack: BucksPack): Promise<PurchaseResult> {
  if (!supabase) return { ok: false, reason: 'not-connected' }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token || !signedInUser()) return { ok: false, reason: 'sign-in' }
  try {
    const res = await fetch('/.netlify/functions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pack: pack.id }),
    })
    if (res.status === 503 || res.status === 404) return { ok: false, reason: 'not-connected' }
    if (res.status === 401) return { ok: false, reason: 'sign-in' }
    const { url, error } = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    // A car pack below its level, or one this account already has.
    if (error === 'level') return { ok: false, reason: 'level' }
    if (res.status === 409) return { ok: false, reason: 'owned' }
    // A refunded or charged-back pack's gems were already spent on this account.
    if (res.status === 403) return { ok: false, reason: 'blocked' }
    if (!res.ok || !url) return { ok: false, reason: 'failed' }
    // Whatever was just earned lands before the player leaves for Stripe.
    await flushSave()
    window.location.assign(url)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

// Packs just added to the save, for the purchase splash (src/ui/PurchaseSplash.tsx).
export const useBought = create<{ rows: Purchase[] | null; close: () => void }>((set) => ({ rows: null, close: () => set({ rows: null }) }))

let missing = false
// Adds paid packs the save hasn't counted yet and shows them on the purchase splash. Returns the gems added.
export async function syncPurchases(): Promise<number> {
  if (!supabase || !signedInUser() || missing) return 0
  const from = useGame.getState().purchases ?? 0
  // Every column, so a server without the car column (0090) still pays gem packs.
  const { data, error } = await supabase.from('purchases').select('*').gt('seq', from).order('seq')
  if (error) {
    // Not on this server yet.
    if (error.code === '42P01' || error.code === 'PGRST205') missing = true
    return 0
  }
  const rows = ((data ?? []) as Purchase[]).filter((r) => r.seq > from).map(({ seq, pack, bucks, coins, parts, car }) => ({ seq, pack, bucks, coins, parts, ...(car ? { car } : {}) }))
  const gems = useGame.getState().applyPurchases(rows)
  if (gems) {
    useBought.setState({ rows })
    await flushSave()
  }
  return gems
}

// Back from Stripe: ?bank=paid. The webhook can land a moment after the redirect, so look a few times.
export async function returnFromCheckout(): Promise<'paid' | 'cancel' | null> {
  const q = new URLSearchParams(window.location.search)
  const back = q.get('bank')
  if (back !== 'paid' && back !== 'cancel') return null
  q.delete('bank')
  window.history.replaceState(null, '', window.location.pathname + (q.size ? `?${q}` : '') + window.location.hash)
  if (back === 'cancel') return 'cancel'
  for (let i = 0; i < 24; i++) {
    if (await syncPurchases()) return 'paid'
    await new Promise((r) => setTimeout(r, 2500))
  }
  useGame.getState().toast('💎 Paid. Your gems show next time you open Cartopia.')
  return 'paid'
}

// On start: once the signed-in save has loaded, add any packs it hasn't counted (a payment that
// cleared after the player closed the tab, or on another device), and greet a return from Stripe.
export function startPurchaseSync() {
  if (!supabase) return
  const back = new URLSearchParams(window.location.search).get('bank')
  let tries = 0
  const wait = setInterval(() => {
    if (++tries > 30) return clearInterval(wait)
    if (!signedInUser()) return
    clearInterval(wait)
    // A moment for the cloud save to replace the local town first.
    setTimeout(() => void (back ? returnFromCheckout() : syncPurchases()), 2000)
  }, 1000)
}
