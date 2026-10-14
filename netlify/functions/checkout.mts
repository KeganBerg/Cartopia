// Starts a Stripe Checkout for a gem pack (src/ui/Bank.tsx -> src/lib/payments.ts).
// Needs the Netlify env vars STRIPE_SECRET_KEY, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, plus
// what the webhook needs (STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY) and the purchases table
// (0079): without any of them it answers 503 and the Bank says purchases are coming soon, so
// nobody can pay before the gems can be granted.
// The gems are granted by stripe-webhook.mts once Stripe says the payment cleared.
import { packById, sessionForm } from '../../src/lib/stripeCheckout'

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export default async (req: Request) => {
  const stripe = process.env.STRIPE_SECRET_KEY
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const ready = !!(process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!stripe || !url || !anon || !ready) return json({ error: 'off' }, 503)
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const { pack: id } = (await req.json().catch(() => ({}))) as { pack?: string }
  const pack = packById(id)
  if (!pack) return json({ error: 'pack' }, 400)

  // Only a signed-in player can buy: the gems are tied to their account.
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return json({ error: 'sign-in' }, 401)
  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) })
  const user = who.ok ? ((await who.json()) as { id?: string }).id : null
  if (!user) return json({ error: 'sign-in' }, 401)
  // The purchases table (0079) has to exist, or a paid pack would have nowhere to land.
  const table = await fetch(`${url}/rest/v1/purchases?select=seq&limit=0`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) })
  if (!table.ok) return json({ error: 'off' }, 503)
  // An account that spent gems from a refunded or charged-back pack (purchases.short, 0080) can't buy
  // more. Before 0080 the column isn't there, the lookup fails and nobody is blocked.
  const owed = await fetch(`${url}/rest/v1/purchases?select=seq&short=gt.0&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) })
  if (owed.ok && ((await owed.json()) as unknown[]).length) return json({ error: 'blocked' }, 403)

  const origin = new URL(req.url).origin
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${stripe}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: sessionForm(pack, user, origin, process.env.STRIPE_TAX_CODE || undefined),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    console.error('stripe', res.status, (await res.text()).slice(0, 300))
    return json({ error: 'stripe' }, 502)
  }
  const session = (await res.json()) as { url?: string }
  return session.url ? json({ url: session.url }) : json({ error: 'stripe' }, 502)
}
