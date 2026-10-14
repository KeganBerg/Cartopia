import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { canDelete } from './chat'

const me = 'me'
const off = { mod: false }

describe('chat delete', () => {
  it('lets players delete their own messages in both rooms', () => {
    expect(canDelete('global', { owner: me }, { uid: me, powers: off })).toBe(true)
    expect(canDelete('crew', { owner: me }, { uid: me, powers: off })).toBe(true)
    expect(canDelete('global', { owner: 'x' }, { uid: me, powers: off })).toBe(false)
    expect(canDelete('global', { owner: me }, { uid: null, powers: off })).toBe(false)
  })

  it("never lets a player delete someone else's message, crew chat included", () => {
    expect(canDelete('crew', { owner: 'x' }, { uid: me, powers: off })).toBe(false)
    expect(canDelete('global', { owner: 'x' }, { uid: me, powers: off })).toBe(false)
  })

  it('lets chat mods delete anything', () => {
    const mod = { mod: true }
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

  it('takes crew leaders out of chat_delete on the server too', () => {
    const sql = readFileSync('supabase/migrations/0088_chat_delete_own_only.sql', 'utf8')
    const start = sql.indexOf('function public.chat_delete')
    const body = sql.slice(start, sql.indexOf('end $$', start))
    expect(body).toMatch(/m\.owner_id <> uid\s+and not public\.chat_is_mod\(uid\)/)
    expect(body).not.toMatch(/chat_is_room_leader/)
  })
})
