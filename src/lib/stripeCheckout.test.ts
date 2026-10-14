import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { BUCKS_PACKS } from '../game/bucksPacks'
import { cents, packById, paidSession, reversedPayment, sessionForm, validSignature } from './stripeCheckout'
import { useGame } from '../game/store'

const sign = (body: string, secret: string, t: number) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`

describe('stripe checkout', () => {
  it('prices a pack from the table, not the page', () => {
    const bag = packById('bag')!
    const f = sessionForm(bag, 'u1', 'https://cartopia.lol')
    expect(f.get('line_items[0][price_data][unit_amount]')).toBe('999')
    expect(f.get('metadata[pack]')).toBe('bag')
    expect(f.get('client_reference_id')).toBe('u1')
    expect(f.get('success_url')).toBe('https://cartopia.lol/?bank=paid')
    expect(f.get('managed_payments[enabled]')).toBe('false')
    const taxed = sessionForm(bag, 'u1', 'https://cartopia.lol', 'txcd_10000000')
    expect(taxed.get('line_items[0][price_data][product_data][tax_code]')).toBe('txcd_10000000')
    expect(taxed.has('managed_payments[enabled]')).toBe(false)
    expect(packById('free-gems')).toBeNull()
    for (const p of BUCKS_PACKS) expect(Number.isInteger(cents(p))).toBe(true)
  })

  it('accepts a fresh, correctly signed body only', async () => {
    const body = '{"type":"x"}'
    const now = 1_760_000_000_000
    const t = now / 1000
    expect(await validSignature(body, sign(body, 'whsec_a', t), 'whsec_a', now)).toBe(true)
    expect(await validSignature(body, sign(body, 'whsec_b', t), 'whsec_a', now)).toBe(false)
    expect(await validSignature(body + ' ', sign(body, 'whsec_a', t), 'whsec_a', now)).toBe(false)
    expect(await validSignature(body, sign(body, 'whsec_a', t - 600), 'whsec_a', now)).toBe(false)
    expect(await validSignature(body, null, 'whsec_a', now)).toBe(false)
  })

  it('grants only paid sessions at the pack price', () => {
    const ev = (o: Record<string, unknown>) => ({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', currency: 'usd', amount_total: 999, metadata: { user: 'u1', pack: 'bag' }, ...o } } })
    expect(paidSession(ev({}))).toMatchObject({ session: 'cs_1', user: 'u1', amount: 999 })
    expect(paidSession(ev({ payment_status: 'unpaid' }))).toBeNull()
    expect(paidSession(ev({ amount_total: 199 }))).toBeNull()
    expect(paidSession(ev({ metadata: { user: 'u1', pack: 'nope' } }))).toBeNull()
    expect(paidSession({ ...ev({}), type: 'charge.refunded' })).toBeNull()
  })

  it('takes a pack back on a refund or an opened chargeback only', () => {
    const ev = (type: string, o: Record<string, unknown> = { payment_intent: 'pi_1' }) => ({ type, data: { object: o } })
    expect(reversedPayment(ev('charge.refunded'))).toEqual({ reason: 'refund', paymentIntent: 'pi_1' })
    expect(reversedPayment(ev('charge.dispute.created'))).toEqual({ reason: 'dispute', paymentIntent: 'pi_1' })
    expect(reversedPayment(ev('charge.dispute.closed'))).toBeNull()
    expect(reversedPayment(ev('checkout.session.completed'))).toBeNull()
    expect(reversedPayment(ev('charge.refunded', { payment_intent: null }))).toBeNull()
  })

  it('adds each purchase row to the save once', () => {
    useGame.setState({ bucks: 5, coins: 100, parts: 0, purchases: 0 })
    const rows = [{ seq: 1, bucks: 60, coins: 2500, parts: 0 }, { seq: 2, bucks: 10, coins: 0, parts: 0 }]
    expect(useGame.getState().applyPurchases(rows)).toBe(70)
    expect(useGame.getState().applyPurchases(rows)).toBe(0)
    const s = useGame.getState()
    expect([s.bucks, s.coins, s.purchases]).toEqual([75, 2600, 2])
  })
})
