import { supabase } from './supabase'
import { demoLeaders } from './friends'
import { useGame } from '../game/store'
import { displayName, isCleanName } from './names'
import { CLAN_EMBLEMS } from '../game/data'

export type Metric = 'power' | 'race_wins' | 'trophies' | 'level'
export type Period = 'all' | 'week'

export const METRICS: { id: Metric; label: string; icon: string; unit: string }[] = [
  { id: 'power', label: 'Power', icon: '⚡', unit: 'power' },
  { id: 'race_wins', label: 'Wins', icon: '🏁', unit: 'wins' },
  { id: 'trophies', label: 'Trophies', icon: '🏆', unit: 'trophies' },
  { id: 'level', label: 'Level', icon: '⭐', unit: 'levels' },
]

export type ClanBadge = { id: string; tag: string; emblem: string; color: string }

export type BoardRow = {
  ownerId: string
  townName: string
  level: number
  trophies: number
  raceWins: number
  power: number
  week: Record<Metric, number>
  clan: ClanBadge | null
  demo?: boolean
}

export type Clan = {
  id: string
  name: string
  tag: string
  emblem: string
  color: string
  description: string
  leaderId: string
  memberCap: number
  minLevel: number
  members: number
  total: Record<Metric, number>
  week: Record<Metric, number>
}

export type Member = BoardRow & { role: 'leader' | 'member'; joinedAt: string }

export type MyClan = { clan: Clan; members: Member[]; role: 'leader' | 'member' }

type PlayerRow = {
  owner_id: string
  town_name: string
  level: number
  trophies: number
  race_wins: number
  power: number
  week_trophies: number
  week_race_wins: number
  week_power: number
  week_levels: number
  clan_id: string | null
  clan_tag: string | null
  clan_emblem: string | null
  clan_color: string | null
}

type ClanRow = {
  id: string
  name: string
  tag: string
  emblem: string
  color: string
  description: string
  leader_id: string
  member_cap: number
  min_level: number
  members: number
  power: number
  race_wins: number
  trophies: number
  levels: number
  week_power: number
  week_race_wins: number
  week_trophies: number
  week_levels: number
}

const cleanTag = (t: string) => (isCleanName(t) ? t : '??')
// The game only offers these emblems; anything else was typed in through the API.
const cleanEmblem = (e: string) => (CLAN_EMBLEMS.includes(e) ? e : CLAN_EMBLEMS[0])

const toRow = (r: PlayerRow): BoardRow => ({
  ownerId: r.owner_id,
  townName: displayName(r.town_name, r.owner_id),
  level: r.level,
  trophies: r.trophies,
  raceWins: r.race_wins,
  power: r.power,
  week: { power: r.week_power, race_wins: r.week_race_wins, trophies: r.week_trophies, level: r.week_levels },
  clan: r.clan_id ? { id: r.clan_id, tag: cleanTag(r.clan_tag!), emblem: cleanEmblem(r.clan_emblem!), color: r.clan_color! } : null,
})

const toClan = (r: ClanRow): Clan => ({
  id: r.id,
  name: displayName(r.name, r.id, 'crew'),
  tag: cleanTag(r.tag),
  emblem: cleanEmblem(r.emblem),
  color: r.color,
  description: isCleanName(r.description) ? r.description : '',
  leaderId: r.leader_id,
  memberCap: r.member_cap,
  minLevel: r.min_level,
  members: r.members,
  total: { power: r.power, race_wins: r.race_wins, trophies: r.trophies, level: r.levels },
  week: { power: r.week_power, race_wins: r.week_race_wins, trophies: r.week_trophies, level: r.week_levels },
})

export const statOf = (r: BoardRow, m: Metric, p: Period) =>
  p === 'week' ? r.week[m] : m === 'power' ? r.power : m === 'race_wins' ? r.raceWins : m === 'trophies' ? r.trophies : r.level

const column = (m: Metric, p: Period) => (p === 'week' ? `week_${m === 'level' ? 'levels' : m}` : m)

// Neighbours keep the boards lively before many people sign up.
export const demoRows: BoardRow[] = demoLeaders.map((d, i) => ({
  ownerId: d.ownerId,
  townName: d.townName,
  level: d.level,
  trophies: d.trophies,
  raceWins: Math.round(d.trophies * 1.6),
  power: 150 + d.level * 22,
  week: { power: 6 + i * 5, race_wins: 3 + i * 2, trophies: 2 + i, level: i === 2 ? 1 : 0 },
  clan: null,
  demo: true,
}))

export async function fetchBoard(m: Metric, p: Period): Promise<BoardRow[]> {
  if (!supabase) return []
  const col = column(m, p)
  let q = supabase.from('player_leaderboard').select('*').order(col, { ascending: false }).limit(50)
  if (p === 'week') q = q.gt(col, 0)
  const { data, error } = await q
  if (error) throw error
  return (data as PlayerRow[]).map(toRow)
}

// Rank for a player who is outside the top 50.
export async function rankOf(m: Metric, p: Period, value: number): Promise<number | null> {
  if (!supabase) return null
  const { count } = await supabase.from('player_leaderboard').select('owner_id', { count: 'exact', head: true }).gt(column(m, p), value)
  return count === null ? null : count + 1
}

export async function fetchClans(m: Metric = 'power', p: Period = 'all'): Promise<Clan[]> {
  if (!supabase) return []
  const col = m === 'level' ? (p === 'week' ? 'week_levels' : 'levels') : column(m, p)
  const { data, error } = await supabase.from('clan_leaderboard').select('*').order(col, { ascending: false }).limit(50)
  if (error) throw error
  return (data as ClanRow[]).map(toClan)
}

export async function fetchMyClan(uid: string): Promise<MyClan | null> {
  if (!supabase) return null
  const { data: mine } = await supabase.from('clan_members').select('clan_id, role').eq('owner_id', uid).maybeSingle()
  if (!mine) return null
  const [{ data: c }, { data: roster }, { data: players }] = await Promise.all([
    supabase.from('clan_leaderboard').select('*').eq('id', mine.clan_id).maybeSingle(),
    supabase.from('clan_members').select('owner_id, role, joined_at').eq('clan_id', mine.clan_id),
    supabase.from('player_leaderboard').select('*').eq('clan_id', mine.clan_id),
  ])
  if (!c) return null
  const stats = new Map((players as PlayerRow[] | null ?? []).map((r) => [r.owner_id, toRow(r)]))
  const members: Member[] = (roster ?? []).map((r) => ({
    ...(stats.get(r.owner_id) ?? {
      ownerId: r.owner_id, townName: 'New member', level: 1, trophies: 0, raceWins: 0, power: 0,
      week: { power: 0, race_wins: 0, trophies: 0, level: 0 }, clan: null,
    }),
    role: r.role as Member['role'],
    joinedAt: r.joined_at,
  }))
  members.sort((a, b) => Number(b.role === 'leader') - Number(a.role === 'leader') || b.power - a.power)
  return { clan: toClan(c as ClanRow), members, role: mine.role as Member['role'] }
}

// Keep the Crew House sign in step with the player's clan.
export async function refreshClanBadge(uid: string | null) {
  if (!supabase || !uid) return useGame.setState({ clanBadge: null })
  const { data } = await supabase.from('player_leaderboard').select('clan_tag, clan_emblem, clan_color').eq('owner_id', uid).maybeSingle()
  useGame.setState({ clanBadge: data?.clan_tag ? { tag: cleanTag(data.clan_tag), emblem: data.clan_emblem, color: data.clan_color } : null })
}

async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Crews need an internet connection')
  const { data, error } = await supabase.rpc(fn, args)
  // The database says "clan"; players see "crew".
  if (error) throw new Error(error.message.replace(/clan/g, 'crew').replace(/Clan/g, 'Crew'))
  return data as T
}

export const createClan = (a: { name: string; tag: string; emblem: string; color: string; description: string; minLevel: number }) =>
  rpc<string>('create_clan', { p_name: a.name, p_tag: a.tag, p_emblem: a.emblem, p_color: a.color, p_description: a.description, p_min_level: a.minLevel })
export const joinClan = (id: string) => rpc('join_clan', { p_clan: id })
export const leaveClan = () => rpc('leave_clan')
export const kickMember = (id: string) => rpc('kick_clan_member', { p_member: id })
export const updateClan = (a: { description: string; emblem: string; color: string; minLevel: number }) =>
  rpc('update_clan', { p_description: a.description, p_emblem: a.emblem, p_color: a.color, p_min_level: a.minLevel })

// Crew weekly goal (supabase/migrations/0022_crew_weekly_goal.sql). Weeks are named by their Monday (UTC).
export type CrewWeek = {
  week: string
  target: number
  points: number
  reached: boolean
  mine: number
  opened: boolean
  members: { id: string; points: number; jobs: number; races: number }[]
}
export type CrewGoal = { rules: { minPoints: number; memberCap: number }; chests: number; payable: boolean; current: CrewWeek | null; last: CrewWeek | null }

export async function fetchCrewGoal(): Promise<CrewGoal | null> {
  if (!supabase) return null
  return rpc<CrewGoal | null>('crew_goal')
}

// Chests the player can open right now: this week's once the crew hits its goal, and last week's if missed.
export const chestsReady = (g: CrewGoal | null) =>
  !g || !g.payable ? 0 : [g.current, g.last].filter((w) => w && w.reached && !w.opened && w.mine >= g.rules.minPoints).length

export const openCrewChestOn = (week: string) => rpc<number>('open_crew_chest', { p_week: week })
