// Stripe calls this when a gem checkout is paid. It records the purchase through
// public.purchase_record() (service role only), and the game adds it to the save from the
// purchases table, which the save guard counts. Stripe retries until it gets a 2xx, and the
// record is keyed on the session id, so a retry never grants twice.
// Needs STRIPE_WEBHOOK_SECRET, VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// In the Stripe dashboard, point a webhook at /.netlify/functions/stripe-webhook for
// checkout.session.completed and checkout.session.async_payment_succeeded.
import { paidSession, validSignature } from '../../src/lib/stripeCheckout'

export default async (req: Request) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !url || !service) return new Response('off', { status: 503 })

  const body = await req.text()
  if (!(await validSignature(body, req.headers.get('stripe-signature'), secret))) return new Response('bad signature', { status: 400 })

  const paid = paidSession(JSON.parse(body))
  // Other events, unpaid sessions and price mismatches are acknowledged and ignored.
  if (!paid) return new Response('ignored')

  const p = paid.pack
  const res = await fetch(`${url}/rest/v1/rpc/purchase_record`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_session: paid.session, p_user: paid.user, p_pack: p.id, p_cents: paid.amount,
      p_bucks: p.bucks + p.bonus, p_coins: p.coins ?? 0, p_parts: p.parts ?? 0,
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    // A 5xx makes Stripe retry later.
    console.error('purchase_record', res.status, (await res.text()).slice(0, 300))
    return new Response('retry', { status: 500 })
  }
  return new Response('ok')
}
