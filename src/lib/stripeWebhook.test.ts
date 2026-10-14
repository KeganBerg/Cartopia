import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import webhook from '../../netlify/functions/stripe-webhook.mts'

const SECRET = 'whsec_test'
const post = (event: unknown) => {
  const body = JSON.stringify(event)
  const t = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')
  return webhook(new Request('https://x/.netlify/functions/stripe-webhook', { method: 'POST', body, headers: { 'stripe-signature': `t=${t},v1=${sig}` } }))
}

describe('stripe webhook: refunds and chargebacks', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  const setup = (sessions: { id: string }[]) => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET)
    vi.stubEnv('STRIPE_SECRET_KEY', 'rk_test')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
    const calls: { url: string; body?: unknown }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (url.startsWith('https://api.stripe.com/')) return Response.json({ data: sessions })
      return Response.json({ ok: true })
    }))
    return calls
  }

  it('takes back the pack bought in the refunded payment', async () => {
    const calls = setup([{ id: 'cs_1' }])
    const res = await post({ type: 'charge.refunded', data: { object: { payment_intent: 'pi_9' } } })
    expect(res.status).toBe(200)
    expect(calls[0].url).toContain('payment_intent=pi_9')
    expect(calls[1]).toEqual({ url: 'https://db/rest/v1/rpc/purchase_reverse', body: { p_session: 'cs_1', p_reason: 'refund' } })
  })

  it('ignores a dispute on a payment that was not a gem checkout', async () => {
    const calls = setup([])
    const res = await post({ type: 'charge.dispute.created', data: { object: { payment_intent: 'pi_8' } } })
    expect(await res.text()).toBe('ignored')
    expect(calls).toHaveLength(1)
  })
})
