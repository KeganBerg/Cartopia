import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { RESERVED, townLabel, USERNAME_MAX, USERNAME_MIN, daysUntilChange, usernameProblem } from './profiles'
import { seenAgo } from './friendsList'

describe('usernameProblem', () => {
  it('accepts plain names', () => {
    for (const n of ['Kegan', 'speedy_1', 'ABC', 'a_b_c_d_e_f_g_h1']) expect(usernameProblem(n), n).toBeNull()
  })
  it('rejects bad lengths, characters, reserved and rude names', () => {
    for (const n of ['ab', 'x'.repeat(17), 'has space', 'dash-name', 'émile', 'Admin', 'cartopia', 'fuck_u', 'big_ass']) {
      expect(usernameProblem(n), n).not.toBeNull()
    }
  })
})

describe('database username rules', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/0049_friends_usernames.sql', import.meta.url), 'utf8')
  it('uses the same reserved list and length limits', () => {
    const block = sql.split('-- reserved:begin')[1].split('-- reserved:end')[0]
    expect([...block.matchAll(/'([^']*)'/g)].map((m) => m[1])).toEqual(RESERVED)
    expect(sql).toContain(`'^[A-Za-z0-9_]{${USERNAME_MIN},${USERNAME_MAX}}$'`)
  })
})

describe('time helpers', () => {
  it('counts days until a username can change', () => {
    expect(daysUntilChange(null)).toBe(0)
    expect(daysUntilChange(new Date(Date.now() - 40 * 86400000).toISOString())).toBe(0)
    expect(daysUntilChange(new Date(Date.now() - 10 * 86400000 - 1000).toISOString())).toBe(20)
  })
  it('says when a friend was last seen', () => {
    const now = Date.parse('2026-10-11T12:00:00Z')
    expect(seenAgo(null, now)).toBeNull()
    expect(seenAgo('2026-10-11T11:59:50Z', now)).toBe('1m ago')
    expect(seenAgo('2026-10-11T09:00:00Z', now)).toBe('3h ago')
    expect(seenAgo('2026-10-08T12:00:00Z', now)).toBe('3d ago')
  })
})

describe('townLabel', () => {
  it('drops a leading @ so a town name never looks like a username', () => {
    expect(townLabel('@KBerg', 'abcd')).toBe('KBerg')
    expect(townLabel('  ＠KBerg', 'abcd')).toBe('KBerg')
    expect(townLabel('Maple @ Main', 'abcd')).toBe('Maple @ Main')
  })
})
