import type { BucksPack } from '../game/data'

// Placeholder checkout. No payment provider is connected yet, so nothing is
// charged and nothing is granted. When one is added (Stripe Checkout through
// a Supabase Edge Function is the likely route), start the checkout here and
// grant the pack server-side once the payment is confirmed.
export type PurchaseResult = { ok: true } | { ok: false; reason: 'not-connected' | 'cancelled' | 'failed' }

export async function purchase(pack: BucksPack): Promise<PurchaseResult> {
  void pack
  return { ok: false, reason: 'not-connected' }
}
