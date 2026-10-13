// Starts a Stripe Checkout for a gem pack (src/ui/Bank.tsx -> src/lib/payments.ts).
// Needs the Netlify env vars STRIPE_SECRET_KEY, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
// Without STRIPE_SECRET_KEY it answers 503 and the Bank says purchases are coming soon.
// The gems are granted by stripe-webhook.mts once Stripe says the payment cleared.
import { packById, sessionForm } from '../../src/lib/stripeCheckout'

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export default async (req: Request) => {
  const stripe = process.env.STRIPE_SECRET_KEY
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!stripe || !url || !anon) return json({ error: 'off' }, 503)
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

  const origin = new URL(req.url).origin
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${stripe}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: sessionForm(pack, user, origin),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    console.error('stripe', res.status, (await res.text()).slice(0, 300))
    return json({ error: 'stripe' }, 502)
  }
  const session = (await res.json()) as { url?: string }
  return session.url ? json({ url: session.url }) : json({ error: 'stripe' }, 502)
}
