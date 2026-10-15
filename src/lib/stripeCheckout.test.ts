import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { BUCKS_PACKS, packGrant } from '../game/bucksPacks'
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
    expect(f.get('metadata[level]')).toBe('1')
    expect(sessionForm(bag, 'u1', 'https://cartopia.lol', undefined, 23).get('metadata[level]')).toBe('23')
  })

  it("grows a pack's coins and parts with the buyer's level, never its gems", () => {
    const vault = packById('vault')!
    expect(packGrant(vault, 1)).toEqual({ bucks: 260, coins: 10000, parts: 40 })
    expect(packGrant(vault, 20)).toEqual({ bucks: 260, coins: 57500, parts: 115 })
    expect(packGrant(vault, 'junk')).toEqual(packGrant(vault, 1))
    expect(packGrant(packById('handful')!, 30)).toEqual({ bucks: 20, coins: 0, parts: 0 })
    // Shop numbers end in 5 or 0 at every level.
    for (const p of BUCKS_PACKS) for (const l of [1, 3, 7, 20, 33, 60]) for (const n of Object.values(packGrant(p, l))) expect(n % 5).toBe(0)
    // Every bigger pack gives more gems per dollar.
    const rate = BUCKS_PACKS.map((p) => packGrant(p, 1).bucks / p.price)
    for (let i = 1; i < rate.length; i++) expect(rate[i]).toBeGreaterThan(rate[i - 1])
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
    expect(paidSession(ev({}))).toMatchObject({ session: 'cs_1', user: 'u1', amount: 999, level: 1 })
    expect(paidSession(ev({ metadata: { user: 'u1', pack: 'bag', level: '31' } }))?.level).toBe(31)
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

describe('car packs', () => {
  it('each sells one pack-only car', async () => {
    const { CAR_PACKS } = await import('../game/bucksPacks')
    const { CARS, carDef } = await import('../game/data')
    expect(CAR_PACKS.map((p) => p.car).sort()).toEqual(CARS.filter((c) => c.pack).map((c) => c.id).sort())
    for (const p of CAR_PACKS) {
      expect(carDef(p.car!).pack, p.id).toBe(true)
      expect(packById(p.id)).toBe(p)
      expect(sessionForm(p, 'u1', 'https://cartopia.lol').get('line_items[0][price_data][product_data][name]')).toContain('car +')
    }
  })

  it('adds a car pack\'s car to the garage once, as pk-<seq>', () => {
    useGame.setState({ bucks: 0, coins: 0, parts: 0, purchases: 0, cars: [] })
    const rows = [{ seq: 4, pack: 'car-kaze', bucks: 50, coins: 0, parts: 0, car: 'kaze' }]
    expect(useGame.getState().applyPurchases(rows)).toBe(50)
    useGame.setState({ purchases: 0 })
    useGame.getState().applyPurchases(rows)
    expect(useGame.getState().cars.map((c) => [c.uid, c.model])).toEqual([['pk-4', 'kaze']])
  })
})
