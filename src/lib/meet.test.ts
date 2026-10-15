import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('./supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))
vi.mock('./cloud', () => ({ signedInUser: () => 'me' }))

const { likeDisplay, useMeet } = await import('./meet')

const sql = readFileSync(new URL('../../supabase/migrations/0092_one_like_per_town.sql', import.meta.url), 'utf8')

describe('town likes', () => {
  beforeEach(() => {
    rpc.mockReset()
    useMeet.setState({ likes: { them: { likes: 3, liked: false } }, live: true })
  })

  it('a fast double tap sends one like and counts it once', async () => {
    rpc.mockImplementation(async () => ({ data: 'liked', error: null }))
    await Promise.all([likeDisplay('them'), likeDisplay('them')])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(useMeet.getState().likes.them).toEqual({ likes: 4, liked: true })
    await likeDisplay('them')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('never likes your own town', async () => {
    await likeDisplay('me')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('an earlier like from another device marks it liked without adding one', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'like_display' ? { data: 'already', error: null } : { data: [{ owner: 'them', likes: 3, liked: true }], error: null })
    await likeDisplay('them')
    expect(useMeet.getState().likes.them).toEqual({ likes: 3, liked: true })
  })

  it('the server allows one like per player per town, ever', () => {
    expect(sql).toContain('create unique index if not exists car_meet_likes_once on public.car_meet_likes (liker, owner)')
    expect(sql).toContain("where liker = me and owner = p_owner) then return 'already'")
    expect(sql).toContain("p_owner = me then return 'no'")
    expect(sql).toContain("'is_anonymous')::boolean, false) then return 'no'")
    expect(sql).toContain('count(distinct l.liker)')
  })
})
