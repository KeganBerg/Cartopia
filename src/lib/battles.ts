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

export type BattleRules = { race: number; win: number; live: number; h2h: number; livePerRival: number; memberCap: number; minPoints: number; par?: number; tiers?: number[]; attacksPerDay?: number; starPoints?: number; star2?: number; star3?: number }
export type BattleMember = { id: string; name: string; points: number; races?: number; wins?: number; live?: number; h2h?: number; w?: number }
// Every member of a real crew with their ghost's car and time, for the war map (0114).
export type RosterMember = { id: string; name: string; car: string | null; body: string | null; color: string | null; pi: number | null; t: number | null }
export type BattleSide = { bot: boolean; id?: string; name: string; tag: string; emblem: string; color: string; score: number; members: BattleMember[]; roster?: RosterMember[] }
// One war race on the map (0114): side 'us' = one of ours raced one of theirs.
export type WarAttack = { side: 'us' | 'them'; by: string; byName: string; target: string; won: boolean; stars: number; points: number; at: string }
export type BattleResult = 'win' | 'loss' | 'draw' | null
export type Battle = {
  week: string
  venue: string
  result: BattleResult
  mine: number
  mvp: boolean
  us: BattleSide
  them: BattleSide
  // The crew's war score target (0113): war chests at 40% and 100% of it. Missing before 0113 runs.
  par?: number
  claimed: ChestKind[]
  attacks?: WarAttack[]
}
export type ChestKind = 'battle' | 'mvp' | 'tier1' | 'tier2'
// One finished war in the crew's log (0113).
export type WarLog = { week: string; venue: string; result: BattleResult; us: number; them: number; rival: Omit<BattleSide, 'score' | 'members'> }
export type BattleRecord = { wins: number; losses: number; draws: number; streak: number }
export type CrewBattle = { rules: BattleRules; now: string; payable: boolean; chests: number; record: BattleRecord; log?: WarLog[]; attacksLeft?: number; current: Battle | null; last: Battle | null }

export const BATTLE_RULES: BattleRules = { race: 1, win: 3, live: 10, h2h: 25, livePerRival: 3, memberCap: 500, minPoints: 20, par: 45, tiers: [0.4, 1] }
// The war map (0114, public.crew_war_rules()).
export const WAR_RULES = { attacksPerDay: 3, starPoints: 5, star2: 0.01, star3: 0.03 }

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
    roster: s.roster?.map((m) => ({ ...m, name: displayName(m.name, m.id), t: m.t === null ? null : Number(m.t) })),
  }
}
const cleanBattle = (b: Battle | null): Battle | null => (b ? {
  ...b, us: cleanSide(b.us), them: cleanSide(b.them), claimed: b.claimed ?? [],
  attacks: b.attacks?.map((a) => ({ ...a, byName: displayName(a.byName, a.by) })),
} : null)
const cleanLog = (l: WarLog[] | undefined): WarLog[] => (l ?? []).map((w) => ({ ...w, rival: cleanSide({ ...w.rival, score: 0, members: [] }) }))

// Chests this battle owes the player: a victory chest for scoring enough for a crew that won or
// drew, and the MVP chest for the winner's top scorer.
export function battleChests(b: Battle | null, rules: BattleRules = BATTLE_RULES) {
  if (!b || !b.result || b.result === 'loss' || b.mine < rules.minPoints) return []
  const due: ('battle' | 'mvp')[] = ['battle']
  if (b.result === 'win' && b.mvp) due.push('mvp')
  return due.filter((k) => !b.claimed.includes(k))
}

// The war chest track: a chest at each tier of par, for members who scored minPoints for the crew.
export type WarTier = { tier: 1 | 2; need: number; reached: boolean; claimed: boolean; claimable: boolean }
export function warTiers(b: Battle | null, rules: BattleRules = BATTLE_RULES): WarTier[] {
  if (!b || !b.par) return []
  return (rules.tiers ?? BATTLE_RULES.tiers!).slice(0, 2).map((f, i) => {
    const tier = (i + 1) as 1 | 2
    const need = Math.ceil(b.par! * f)
    const reached = b.us.score >= need
    const claimed = b.claimed.includes(`tier${tier}`)
    return { tier, need, reached, claimed, claimable: reached && !claimed && b.mine >= rules.minPoints }
  })
}

// War points a batch of races earns: every race, more for a win.
export const warPoints = (races: number, wins: number, rules: BattleRules = BATTLE_RULES) => Math.max(races, wins) * rules.race + wins * rules.win

// War league from the crew's record: a rating that climbs with wins and slips with losses.
export const LEAGUES = [
  { id: 'bronze', icon: '🥉', name: 'Bronze', min: 0 },
  { id: 'silver', icon: '🥈', name: 'Silver', min: 1050 },
  { id: 'gold', icon: '🥇', name: 'Gold', min: 1150 },
  { id: 'platinum', icon: '💠', name: 'Platinum', min: 1300 },
  { id: 'diamond', icon: '💎', name: 'Diamond', min: 1500 },
] as const
export function warLeague(r: BattleRecord) {
  const rating = Math.max(0, 1000 + r.wins * 30 - r.losses * 15)
  const i = LEAGUES.filter((l) => rating >= l.min).length - 1
  return { ...LEAGUES[i], rating, next: LEAGUES[i + 1] ?? null }
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
  const battle = raw ? { ...raw, log: cleanLog(raw.log), current: cleanBattle(raw.current), last: cleanBattle(raw.last) } : null
  const ready = battle && battle.payable && (battleChests(battle.last, battle.rules).length || [battle.current, battle.last].some((b) => warTiers(b, battle.rules).some((t) => t.claimable))) ? 1 : 0
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

// Claims a war chest on the track and pays it into the town.
export async function claimWarTier(week: string, tier: 1 | 2) {
  if (!supabase) throw new Error('Crews need an internet connection')
  const { data, error } = await supabase.rpc('crew_war_tier_claim', { p_week: week, p_tier: tier })
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
    roster: [
      { id: 'me', name: useGame.getState().townName || 'You', car: 'Kazumi Ronin GT', body: 'coupe', color: '#1e88e5', pi: 120, t: 7.42 },
      { id: 'm2', name: 'Maple Ridge', car: 'Liberty Brawler', body: 'muscle', color: '#43a047', pi: 104, t: 7.95 },
      { id: 'm3', name: 'Sunny Flats', car: 'Aether Zenith R', body: 'super', color: '#fdd835', pi: 131, t: 7.21 },
      { id: 'm4', name: 'Pinecone Bay', car: 'Brandt Kreis S', body: 'sedan', color: '#8d6e63', pi: 66, t: 8.8 },
      { id: 'm5', name: 'Oak Hollow', car: 'Kipper Pocket', body: 'compact', color: '#ff7043', pi: 52, t: 9.3 },
    ],
  }
  const them: BattleSide = {
    bot: true, name: 'Rust Belt Rollers', tag: 'RBR', emblem: '🔥', color: '#e53935', score: 377,
    members: [{ id: 'bot1', name: 'Dusty Vance', points: 141, w: 1.5 }, { id: 'bot2', name: 'Lola Lugnut', points: 120, w: 1.2 }, { id: 'bot3', name: 'Bo Burnout', points: 79, w: 0.8 }, { id: 'bot4', name: 'Nova Knox', points: 37, w: 0.5 }],
  }
  // A real rival crew, so the map shows races both ways.
  const coyotes: BattleSide = {
    bot: false, id: 'demo-r2', name: 'Chrome Coyotes', tag: 'CHC', emblem: '🐺', color: '#00897b', score: 377,
    members: [{ id: 'r1', name: 'Rio Vista', points: 150 }, { id: 'r2', name: 'Cedar Falls', points: 122 }, { id: 'r3', name: 'Bay Harbor', points: 70 }, { id: 'r4', name: 'Elm Creek', points: 35 }],
    roster: [
      { id: 'r1', name: 'Rio Vista', car: 'Aether Zenith R', body: 'super', color: '#00897b', pi: 128, t: 7.3 },
      { id: 'r2', name: 'Cedar Falls', car: 'Liberty Brawler', body: 'muscle', color: '#26a69a', pi: 110, t: 7.7 },
      { id: 'r3', name: 'Bay Harbor', car: 'Kazumi Ronin GT', body: 'coupe', color: '#80cbc4', pi: 95, t: 8.1 },
      { id: 'r4', name: 'Elm Creek', car: 'Brandt Kreis S', body: 'sedan', color: '#004d40', pi: 70, t: 8.7 },
      { id: 'r5', name: 'Fox Run', car: 'Kipper Pocket', body: 'compact', color: '#4db6ac', pi: 55, t: 9.2 },
    ],
  }
  const at = (h: number) => new Date(Date.now() - h * 3600000).toISOString()
  const attacks: WarAttack[] = [
    { side: 'us', by: 'me', byName: 'You', target: 'r3', won: true, stars: 3, points: 15, at: at(1) },
    { side: 'them', by: 'r1', byName: 'Rio Vista', target: 'm2', won: true, stars: 2, points: 10, at: at(2) },
    { side: 'us', by: 'm3', byName: 'Sunny Flats', target: 'r1', won: false, stars: 0, points: 0, at: at(3) },
    { side: 'us', by: 'm2', byName: 'Maple Ridge', target: 'r4', won: true, stars: 1, points: 5, at: at(5) },
    { side: 'them', by: 'r2', byName: 'Cedar Falls', target: 'm4', won: true, stars: 3, points: 15, at: at(7) },
  ]
  const won = DEMO_MODE === 'won'
  const week = new Date(Date.UTC(2026, 9, 5)).toISOString().slice(0, 10)
  const cur: Battle = { week, venue: 'docks', result: null, mine: 168, mvp: true, par: 180, us, them, claimed: [] }
  demo = {
    rules: BATTLE_RULES, now: new Date().toISOString(), payable: true, chests: 0, attacksLeft: 2,
    record: { wins: 3, losses: 1, draws: 0, streak: 2 },
    log: [
      { week: '2026-10-05', venue: 'docks', result: 'win', us: 412, them: 377, rival: { bot: true, name: 'Rust Belt Rollers', tag: 'RBR', emblem: '🔥', color: '#e53935' } },
      { week: '2026-09-28', venue: 'beach', result: 'win', us: 288, them: 240, rival: { bot: false, id: 'demo-r2', name: 'Chrome Coyotes', tag: 'CHC', emblem: '🐺', color: '#00897b' } },
      { week: '2026-09-21', venue: 'desert', result: 'loss', us: 150, them: 233, rival: { bot: true, name: 'Dune Drifters', tag: 'DDR', emblem: '🏎️', color: '#fdd835' } },
      { week: '2026-09-14', venue: 'main', result: 'win', us: 201, them: 99, rival: { bot: true, name: 'Asphalt Owls', tag: 'OWL', emblem: '🦅', color: '#546e7a' } },
    ],
    current: { ...cur, week: '2026-10-12', venue: 'snow', mine: 42, us: { ...us, score: 96, members: us.members.map((m) => ({ ...m, points: Math.round(m.points / 4) })) }, them: { ...them, name: 'Frost Fangs', tag: 'FFG', emblem: '🐉', color: '#8e24aa', score: 121 } },
    last: won ? { ...cur, result: 'win' } : null,
  }
  if (!won) demo.current = { ...cur, week: '2026-10-12', them: coyotes, attacks }
  return demo
}
