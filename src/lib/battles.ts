import { create } from 'zustand'
import { supabase } from './supabase'
import { signedInUser } from './cloud'
import { displayName, isCleanName } from './names'
import { useGame } from '../game/store'
import { CLAN_EMBLEMS } from '../game/data'

// Crew battles (supabase/migrations/0050_crew_battles.sql): every week each crew is matched with a
// rival crew, or a street crew run by the server, and members score battle points by racing.
// The server keeps the score and decides the winner; a victory (and MVP) chest is a crew chest row
// the save guard already pays.

export type BattleRules = { race: number; win: number; live: number; h2h: number; livePerRival: number; memberCap: number; minPoints: number }
export type BattleMember = { id: string; name: string; points: number; races?: number; wins?: number; live?: number; h2h?: number }
export type BattleSide = { bot: boolean; id?: string; name: string; tag: string; emblem: string; color: string; score: number; members: BattleMember[] }
export type BattleResult = 'win' | 'loss' | 'draw' | null
export type Battle = {
  week: string
  venue: string
  result: BattleResult
  mine: number
  mvp: boolean
  us: BattleSide
  them: BattleSide
  claimed: ('battle' | 'mvp')[]
}
export type BattleRecord = { wins: number; losses: number; draws: number; streak: number }
export type CrewBattle = { rules: BattleRules; now: string; payable: boolean; chests: number; record: BattleRecord; current: Battle | null; last: Battle | null }

export const BATTLE_RULES: BattleRules = { race: 1, win: 3, live: 10, h2h: 25, livePerRival: 3, memberCap: 500, minPoints: 20 }

// Names and looks come from players (or the server's street crews); keep them clean and in the set.
const COLOR = /^#[0-9a-f]{6}$/i
function cleanSide(s: BattleSide): BattleSide {
  return {
    ...s,
    name: s.bot ? s.name : displayName(s.name, s.id ?? '', 'crew'),
    tag: isCleanName(s.tag) ? s.tag : '??',
    emblem: CLAN_EMBLEMS.includes(s.emblem) ? s.emblem : CLAN_EMBLEMS[0],
    color: COLOR.test(s.color) ? s.color : '#546e7a',
    members: (s.members ?? []).map((m) => ({ ...m, name: s.bot ? m.name : displayName(m.name, m.id) })),
  }
}
const cleanBattle = (b: Battle | null): Battle | null => (b ? { ...b, us: cleanSide(b.us), them: cleanSide(b.them), claimed: b.claimed ?? [] } : null)

// Chests this battle owes the player: a victory chest for scoring enough for a crew that won or
// drew, and the MVP chest for the winner's top scorer.
export function battleChests(b: Battle | null, rules: BattleRules = BATTLE_RULES) {
  if (!b || !b.result || b.result === 'loss' || b.mine < rules.minPoints) return []
  const due: ('battle' | 'mvp')[] = ['battle']
  if (b.result === 'win' && b.mvp) due.push('mvp')
  return due.filter((k) => !b.claimed.includes(k))
}

// How the tug-of-war bar splits: our share of the points so far (half and half at 0-0).
export const battleShare = (us: number, them: number) => (us + them <= 0 ? 0.5 : us / (us + them))

// failed: the server has no battles yet (migration not run) or can't be reached, so nothing shows.
export const useCrewBattle = create<{ battle: CrewBattle | null; failed: boolean; ready: number }>(() => ({ battle: null, failed: false, ready: 0 }))

export async function refreshCrewBattle() {
  if (demoBattle()) return useCrewBattle.setState({ battle: demoBattle(), failed: false, ready: battleChests(demoBattle()!.last).length ? 1 : 0 })
  if (!supabase || !signedInUser()) return useCrewBattle.setState({ battle: null, ready: 0 })
  const { data, error } = await supabase.rpc('crew_battle')
  if (error) return useCrewBattle.setState({ failed: true })
  const raw = data as CrewBattle | null
  const battle = raw ? { ...raw, current: cleanBattle(raw.current), last: cleanBattle(raw.last) } : null
  const ready = battle && battle.payable && battleChests(battle.last, battle.rules).length ? 1 : 0
  useCrewBattle.setState({ battle, failed: false, ready })
}

// Claims last week's chests and pays them into the town, up to what the server has recorded.
export async function claimBattle(week: string) {
  if (!supabase) throw new Error('Crews need an internet connection')
  const { data, error } = await supabase.rpc('crew_battle_claim', { p_week: week })
  if (error) throw new Error(error.message.replace(/clan/g, 'crew'))
  const total = data as number
  const s = useGame.getState()
  for (let i = s.crewChests ?? 0; i < total; i++) useGame.getState().openCrewChest()
  await refreshCrewBattle()
  return total
}

// ?battle=demo shows a made-up battle (?battle=won for a finished one), for trying the screens signed out.
const DEMO_MODE = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('battle')
let demo: CrewBattle | null = null
export function demoBattle(): CrewBattle | null {
  if (!DEMO_MODE) return null
  if (demo) return demo
  const us: BattleSide = {
    bot: false, id: 'demo-us', name: 'Night Shift', tag: 'NSH', emblem: '🐺', color: '#1e88e5', score: 412,
    members: [
      { id: 'me', name: useGame.getState().townName || 'You', points: 168, races: 40, wins: 25, live: 2, h2h: 1 },
      { id: 'm2', name: 'Maple Ridge', points: 131, races: 33, wins: 20, live: 1, h2h: 0 },
      { id: 'm3', name: 'Sunny Flats', points: 88, races: 28, wins: 15, live: 0, h2h: 0 },
      { id: 'm4', name: 'Pinecone Bay', points: 25, races: 10, wins: 4, live: 0, h2h: 0 },
    ],
  }
  const them: BattleSide = {
    bot: true, name: 'Rust Belt Rollers', tag: 'RBR', emblem: '🔥', color: '#e53935', score: 377,
    members: [{ id: 'b1', name: 'Dusty Vance', points: 141 }, { id: 'b2', name: 'Lola Lugnut', points: 120 }, { id: 'b3', name: 'Bo Burnout', points: 79 }, { id: 'b4', name: 'Nova Knox', points: 37 }],
  }
  const won = DEMO_MODE === 'won'
  const week = new Date(Date.UTC(2026, 9, 5)).toISOString().slice(0, 10)
  const cur: Battle = { week, venue: 'docks', result: null, mine: 168, mvp: true, us, them, claimed: [] }
  demo = {
    rules: BATTLE_RULES, now: new Date().toISOString(), payable: true, chests: 0,
    record: { wins: 3, losses: 1, draws: 0, streak: 2 },
    current: { ...cur, week: '2026-10-12', venue: 'snow', us: { ...us, score: 96, members: us.members.map((m) => ({ ...m, points: Math.round(m.points / 4) })) }, them: { ...them, name: 'Frost Fangs', tag: 'FFG', emblem: '🐉', color: '#8e24aa', score: 121 } },
    last: won ? { ...cur, result: 'win' } : null,
  }
  if (!won) demo.current = { ...cur, week: '2026-10-12' }
  return demo
}
