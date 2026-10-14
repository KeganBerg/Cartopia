// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { PurchaseSplash } = await import('./PurchaseSplash')
const { useBought } = await import('../lib/payments')

describe('the purchase splash', () => {
  it('shows the pack bought and what it paid, then closes', async () => {
    const el = document.createElement('div')
    const root = createRoot(el)
    await act(async () => root.render(<PurchaseSplash />))
    expect(el.querySelector('.buy-done')).toBeNull()
    await act(async () => useBought.setState({ rows: [{ seq: 3, pack: 'bag', bucks: 60, coins: 2500, parts: 0 }] }))
    expect(el.querySelector('.lvl-title')?.textContent).toBe('Purchase successful!')
    expect(el.querySelector('.lvl-sub')?.textContent).toBe('Bag of Gems')
    expect([...el.querySelectorAll('.buy-item b')].map((b) => b.textContent)).toEqual(['60', '2,500'])
    await act(async () => (el.querySelector('.lvl-continue') as HTMLButtonElement).click())
    expect(el.querySelector('.buy-done')).toBeNull()
    await act(async () => root.unmount())
  })
})
