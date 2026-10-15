import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { canDelete, toMsg } from './chat'

const me = 'me'
const off = { mod: false, leader: false }

describe('chat delete', () => {
  it('lets players delete their own messages in both rooms', () => {
    expect(canDelete('global', { owner: me }, { uid: me, powers: off })).toBe(true)
    expect(canDelete('crew', { owner: me }, { uid: me, powers: off })).toBe(true)
    expect(canDelete('global', { owner: 'x' }, { uid: me, powers: off })).toBe(false)
    expect(canDelete('global', { owner: me }, { uid: null, powers: off })).toBe(false)
  })

  it('lets crew leaders delete anything in crew chat only', () => {
    const leader = { mod: false, leader: true }
    expect(canDelete('crew', { owner: 'x' }, { uid: me, powers: leader })).toBe(true)
    expect(canDelete('global', { owner: 'x' }, { uid: me, powers: leader })).toBe(false)
  })

  it('lets chat mods delete anything', () => {
    const mod = { mod: true, leader: false }
    expect(canDelete('global', { owner: 'x' }, { uid: me, powers: mod })).toBe(true)
    expect(canDelete('crew', { owner: 'x' }, { uid: me, powers: mod })).toBe(true)
  })

  it('deletes through the server and broadcasts the removal', () => {
    const sql = readFileSync('supabase/migrations/0068_chat_delete.sql', 'utf8')
    expect(sql).toMatch(/grant execute on function public\.chat_delete\(bigint\) to authenticated/)
    expect(sql).toMatch(/realtime\.send\(jsonb_build_object\('id', m\.id\), 'del'/)
    // The table stays closed to players.
    expect(sql).not.toMatch(/grant (delete|all)[^;]*chat_messages/i)
  })
})

describe('toMsg mod mark', () => {
  const row = { id: 1, owner: 'u1', name: 'Town', level: 3, body: 'hi', at: '2026-10-15T00:00:00Z' }
  it('marks only messages the server flags as a chat mod', () => {
    expect(toMsg({ ...row, mod: true })?.mod).toBe(true)
    expect(toMsg(row)?.mod).toBeUndefined()
    expect(toMsg({ ...row, mod: 'true' as unknown as boolean })?.mod).toBeUndefined()
  })
})
