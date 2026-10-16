import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JOIN_MODES, RANKS, byRank, canRemove, canSetRank, isOfficer, type Member, type Rank } from './clans'

const sql = readFileSync('supabase/migrations/0103_crew_ranks.sql', 'utf8')
const fn = (name: string) => sql.match(new RegExp(`function public\\.${name}\\([\\s\\S]*?end \\$\\$;`))![0]

describe('crew ranks', () => {
  it('never lets anyone act on the Leader, and Co-Leaders only on Members', () => {
    const all: Rank[] = ['leader', 'co_leader', 'member']
    for (const me of all) expect(canRemove(me, 'leader')).toBe(false)
    expect(canRemove('leader', 'co_leader')).toBe(true)
    expect(canRemove('leader', 'member')).toBe(true)
    expect(canRemove('co_leader', 'co_leader')).toBe(false)
    expect(canRemove('co_leader', 'member')).toBe(true)
    expect(canRemove('member', 'member')).toBe(false)
    expect(all.filter((me) => all.some((t) => canSetRank(me, t)))).toEqual(['leader'])
    expect(all.filter(isOfficer)).toEqual(['leader', 'co_leader'])
  })

  it('lists the Leader, then Co-Leaders, then Members', () => {
    const m = (role: Rank, power: number) => ({ role, power }) as Member
    const sorted = [m('member', 900), m('co_leader', 10), m('leader', 1), m('co_leader', 50)].sort(byRank)
    expect(sorted.map((x) => `${x.role}:${x.power}`)).toEqual(['leader:1', 'co_leader:50', 'co_leader:10', 'member:900'])
    expect(Object.keys(RANKS)).toEqual(['leader', 'co_leader', 'member'])
  })

  it('uses the same ranks and join rules as the server', () => {
    expect(sql).toContain(`check (role in ('leader', 'co_leader', 'member'))`)
    expect(sql).toContain(`check (join_mode in (${JOIN_MODES.map((m) => `'${m.id}'`).join(', ')}))`)
  })

  it('guards every crew action on the server', () => {
    // Removing: nobody removes the Leader; a Co-Leader removes Members only.
    expect(fn('kick_clan_member')).toMatch(/them\.role = 'leader' or \(me\.role = 'co_leader' and them\.role <> 'member'\)/)
    // Ranks and handing over the lead: Leader only.
    expect(fn('crew_set_rank')).toMatch(/me\.role <> 'leader'/)
    // Requests and settings: Leader or Co-Leader.
    for (const f of ['crew_respond', 'update_clan', 'crew_requests']) expect(fn(f), f).toMatch(/crew_is_officer\(m?e?\.?role\)|crew_is_officer\(m\.role\)/)
    // The live client's Join button can't skip a request or a closed crew.
    expect(fn('join_clan')).toMatch(/join_mode = 'closed'/)
    expect(fn('join_clan')).toMatch(/join_mode = 'request'/)
    // New settings argument is optional so the live client keeps saving.
    expect(sql).toMatch(/p_join_mode text default null/)
  })

  it('hands the lead to the oldest Co-Leader, else the oldest Member, even when an account is deleted', () => {
    const gone = fn('crew_member_gone')
    expect(gone).toMatch(/order by \(role = 'co_leader'\) desc, joined_at/)
    expect(sql).toMatch(/after delete on public\.clan_members/)
    // The old cascade deleted the whole crew with its leader's account.
    expect(sql).toMatch(/drop constraint if exists clans_leader_id_fkey/)
  })

  it('keeps requests behind the functions', () => {
    expect(sql).toMatch(/alter table public\.crew_join_requests enable row level security/)
    expect(sql).toMatch(/revoke all on public\.crew_join_requests from anon, authenticated/)
    expect(sql).not.toMatch(/create policy[^;]*crew_join_requests/)
  })
})
