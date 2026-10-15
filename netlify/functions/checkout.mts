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

  // The pack's coins and parts grow with the buyer's level (game_saves.level, kept by the save guard).
  const save = await fetch(`${url}/rest/v1/game_saves?select=level&owner_id=eq.${user}&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) })
  const level = save.ok ? ((await save.json()) as { level?: number }[])[0]?.level ?? 1 : 1
  // A car pack goes on sale at its car's level, and each account gets its car once.
  if (pack.car) {
    if (!save.ok || level < (pack.unlock ?? 1)) return json({ error: 'level' }, 403)
    const had = await fetch(`${url}/rest/v1/purchases?select=seq&pack=eq.${pack.id}&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) })
    if (!had.ok) return json({ error: 'off' }, 503)
    if (((await had.json()) as unknown[]).length) return json({ error: 'owned' }, 409)
  }

  const origin = new URL(req.url).origin
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${stripe}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: sessionForm(pack, user, origin, process.env.STRIPE_TAX_CODE || undefined, level),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    console.error('stripe', res.status, (await res.text()).slice(0, 300))
    return json({ error: 'stripe' }, 502)
  }
  const session = (await res.json()) as { url?: string }
  return session.url ? json({ url: session.url }) : json({ error: 'stripe' }, 502)
}
