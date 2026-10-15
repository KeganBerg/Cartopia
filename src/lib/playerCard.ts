import { create } from 'zustand'
import { supabase } from './supabase'
import { displayName, isCleanName } from './names'
import { DEMO, demoTown } from './friends'
import { demoRows } from './clans'
import { CLAN_EMBLEMS, carDef, performance } from '../game/data'
import { showcaseOf } from '../game/meet'
import type { OwnedCar } from '../game/store'

// Another player's profile card: public numbers and their cars, nothing private.
export type PlayerCard = {
  ownerId: string
  townName: string
  level: number
  trophies: number
  raceWins: number
  bestPi: number
  crew: { tag: string; emblem: string; color: string; name: string } | null
  // Best first, the cars on show leading.
  cars: OwnedCar[]
  showcase: string[]
  demo?: boolean
}

export const carPi = (c: OwnedCar) => performance(carDef(c.model), c.upgrades, c.mods)

// The cars in profile order: the ones on show first, then the rest by PI.
export function profileCars(cars: OwnedCar[], picks: string[] | null | undefined): OwnedCar[] {
  const shown = showcaseOf(cars, picks)
  const rest = cars.filter((c) => !shown.includes(c)).sort((a, b) => carPi(b) - carPi(a))
  return [...shown, ...rest]
}

const bestOf = (cars: OwnedCar[]) => cars.reduce((m, c) => Math.max(m, carPi(c)), 0)

// Saves are other players' JSON: keep only cars the game can draw.
const sane = (cars: unknown): OwnedCar[] =>
  Array.isArray(cars) ? (cars as OwnedCar[]).filter((c) => c && typeof c.uid === 'string' && typeof c.model === 'string' && c.upgrades) : []

function demoCard(id: string): PlayerCard | null {
  const d = DEMO.find((x) => x.id === id)
  if (!d) return null
  const t = demoTown(d)
  const row = demoRows.find((r) => r.ownerId === id)
  const cars = profileCars(t.cars, null)
  return { ownerId: id, townName: d.name, level: d.level, trophies: d.trophies, raceWins: row?.raceWins ?? 0, bestPi: bestOf(cars), crew: null, cars, showcase: showcaseOf(t.cars, null).map((c) => c.uid), demo: true }
}

export async function fetchPlayerCard(ownerId: string): Promise<PlayerCard | null> {
  if (ownerId.startsWith('demo-')) return demoCard(ownerId)
  if (!supabase) return null
  // Only the public columns: level, trophies, wins, cars and the crew badge.
  const [save, board] = await Promise.all([
    supabase.from('game_saves').select('town_name, level, cars:state->cars, showcase:state->showcase, trophies:state->trophies, wins:state->racesWon').eq('owner_id', ownerId).maybeSingle(),
    supabase.from('player_leaderboard').select('race_wins, trophies, clan_id, clan_tag, clan_emblem, clan_color').eq('owner_id', ownerId).maybeSingle(),
  ])
  const s = save.data
  if (!s) return null
  const b = board.error ? null : board.data
  let crew: PlayerCard['crew'] = null
  if (b?.clan_id) {
    const { data: c } = await supabase.from('clans').select('name').eq('id', b.clan_id).maybeSingle()
    crew = {
      tag: isCleanName(b.clan_tag ?? '') ? b.clan_tag! : '??',
      emblem: CLAN_EMBLEMS.includes(b.clan_emblem ?? '') ? b.clan_emblem! : CLAN_EMBLEMS[0],
      color: b.clan_color ?? '#607d8b',
      name: c?.name ? displayName(c.name, b.clan_id, 'crew') : '',
    }
  }
  const all = sane(s.cars)
  const picks = Array.isArray(s.showcase) ? (s.showcase as string[]) : null
  const cars = profileCars(all, picks)
  return {
    ownerId,
    townName: displayName(s.town_name, ownerId),
    level: s.level,
    trophies: Number(b?.trophies ?? s.trophies ?? 0),
    raceWins: Number(b?.race_wins ?? s.wins ?? 0),
    bestPi: bestOf(all),
    crew,
    cars,
    showcase: showcaseOf(all, picks).map((c) => c.uid),
  }
}

// Which player's card is open, and which of their cars it opens on.
type CardState = { open: { id: string; town: string; car?: string } | null }
export const usePlayerCard = create<CardState>(() => ({ open: null }))
export const openPlayerCard = (id: string, town: string, car?: string) => usePlayerCard.setState({ open: { id, town, car } })
export const closePlayerCard = () => usePlayerCard.setState({ open: null })
