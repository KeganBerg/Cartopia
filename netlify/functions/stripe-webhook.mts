// Stripe calls this when a gem checkout is paid, refunded or charged back.
// Paid: it records the purchase through public.purchase_record() (service role only), and the game
// adds it to the save from the purchases table, which the save guard counts. The record is keyed on
// the session id, so a retry never grants twice.
// Refunded or disputed: it finds the checkout session for the payment and calls
// public.purchase_reverse() (0080), which takes the pack back out of the save (down to 0; what was
// already spent is kept as `short` on the purchase, and that account can't buy more packs).
// Stripe retries until it gets a 2xx.
// Needs STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// In the Stripe dashboard, point a webhook at /.netlify/functions/stripe-webhook for
// checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded and
// charge.dispute.created.
import { paidSession, reversedPayment, validSignature } from '../../src/lib/stripeCheckout'
import { packGrant } from '../../src/game/bucksPacks'

export default async (req: Request) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !url || !service) return new Response('off', { status: 503 })

  const body = await req.text()
  if (!(await validSignature(body, req.headers.get('stripe-signature'), secret))) return new Response('bad signature', { status: 400 })
  const event = JSON.parse(body)

  const rpc = (fn: string, args: Record<string, unknown>) => fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(10000),
  })
  // A 5xx makes Stripe retry later.
  const retry = async (fn: string, res: Response) => {
    console.error(fn, res.status, (await res.text()).slice(0, 300))
    return new Response('retry', { status: 500 })
  }

  const back = reversedPayment(event)
  if (back) {
    const stripe = process.env.STRIPE_SECRET_KEY
    if (!stripe) return new Response('off', { status: 503 })
    const found = await fetch(`https://api.stripe.com/v1/checkout/sessions?limit=1&payment_intent=${encodeURIComponent(back.paymentIntent)}`, {
      headers: { Authorization: `Bearer ${stripe}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!found.ok) return retry('stripe sessions', found)
    const session = ((await found.json()) as { data?: { id?: string }[] }).data?.[0]?.id
    // Not a gem checkout: nothing to take back.
    if (!session) return new Response('ignored')
    const res = await rpc('purchase_reverse', { p_session: session, p_reason: back.reason })
    return res.ok ? new Response('ok') : retry('purchase_reverse', res)
  }

  const paid = paidSession(event)
  // Other events, unpaid sessions and price mismatches are acknowledged and ignored.
  if (!paid) return new Response('ignored')

  // Paid at the level checkout stamped on the session, so it matches what the shop showed.
  const g = packGrant(paid.pack, paid.level)
  const res = await rpc('purchase_record', {
    p_session: paid.session, p_user: paid.user, p_pack: paid.pack.id, p_cents: paid.amount,
    p_bucks: g.bucks, p_coins: g.coins, p_parts: g.parts,
    // A car pack's car joins the garage as uid pk-<seq>; the save guard lets it in from this row (0090).
    ...(paid.pack.car ? { p_car: paid.pack.car } : {}),
  })
  return res.ok ? new Response('ok') : retry('purchase_record', res)
}
