// Stripe Checkout for gem packs, shared by the Netlify functions (checkout.mts, stripe-webhook.mts)
// and their tests. No Stripe SDK: two REST calls and a signature check are all the game needs.
import { BUCKS_PACKS, type BucksPack } from '../game/bucksPacks'

export const packById = (id: unknown): BucksPack | null => BUCKS_PACKS.find((p) => p.id === id) ?? null
export const cents = (p: BucksPack) => Math.round(p.price * 100)

// The form body for POST /v1/checkout/sessions. The price comes from the pack table here, never the page.
// Stripe turns Managed Payments on by default for new accounts, and it refuses a line item without a
// product tax code. With a code (Netlify env STRIPE_TAX_CODE) the session keeps Managed Payments;
// without one it's switched off for the session, as Stripe's error suggests.
export function sessionForm(p: BucksPack, user: string, origin: string, taxCode?: string): URLSearchParams {
  const gems = p.bucks + p.bonus
  const tax: Record<string, string> = taxCode ? { 'line_items[0][price_data][product_data][tax_code]': taxCode } : { 'managed_payments[enabled]': 'false' }
  return new URLSearchParams({
    ...tax,
    mode: 'payment',
    client_reference_id: user,
    'metadata[user]': user,
    'metadata[pack]': p.id,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(cents(p)),
    'line_items[0][price_data][product_data][name]': `${p.name} (${gems} gems)`,
    success_url: `${origin}/?bank=paid`,
    cancel_url: `${origin}/?bank=cancel`,
  })
}

// What a paid checkout.session.completed event grants, or null when it shouldn't grant anything.
export type Paid = { session: string; user: string; pack: BucksPack; amount: number }
export function paidSession(event: unknown): Paid | null {
  const e = event as { type?: string; data?: { object?: Record<string, unknown> } }
  if (e?.type !== 'checkout.session.completed' && e?.type !== 'checkout.session.async_payment_succeeded') return null
  const o = e.data?.object
  if (!o || o.payment_status !== 'paid') return null
  const meta = (o.metadata ?? {}) as Record<string, string>
  const pack = packById(meta.pack)
  const user = meta.user ?? o.client_reference_id
  if (!pack || typeof user !== 'string' || typeof o.id !== 'string') return null
  // A session paid at another price (an old price table, or a tampered session) grants nothing.
  if (o.amount_total !== cents(pack) || o.currency !== 'usd') return null
  return { session: o.id, user, pack, amount: o.amount_total as number }
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

// Checks a Stripe-Signature header ("t=...,v1=...") against the raw body.
// https://docs.stripe.com/webhooks#verify-manually
export async function validSignature(body: string, header: string | null, secret: string, now = Date.now(), tolerance = 300): Promise<boolean> {
  if (!header || !secret) return false
  const parts = header.split(',').map((x) => x.split('='))
  const t = parts.find(([k]) => k === 't')?.[1]
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!t || !sigs.length || Math.abs(now / 1000 - Number(t)) > tolerance) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const want = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${body}`)))
  return sigs.some((s) => s.length === want.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ want.charCodeAt(i)), 0) === 0)
}
