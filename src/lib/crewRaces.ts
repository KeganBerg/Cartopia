import { create } from 'zustand'
import { supabase } from './supabase'
import { displayName } from './names'
import { DEMO, demoTown } from './friends'
import { useGame, type OwnedCar } from '../game/store'
import { carDef, performance } from '../game/data'
import { bestCar } from '../game/raceCar'
import { parTime, runGhost, type Ghost } from './ghosts'
import type { Body } from '../game/data'

// Crew races: crewmates race each other's ghosts (the friend ghost plumbing in ghosts.ts and
// supabase/migrations/0030_friend_ghosts.sql), and the crew ladder ranks everyone by their best
// run. A race against a crewmate counts as a race for the crew goal and the crew battle.

export type Racer = {
  id: string
  name: string
  level: number
  // Their fastest car, the one their ghost runs in (the server times ghosts with it).
  car: OwnedCar | null
  carName: string
  pi: number
  body: Body
  color: string
  // Best run (seconds). par: no run yet, so this is the par for their car.
  time: number | null
  par: boolean
  demo?: boolean
}

// Crewmates' account ids, so a ghost race against one of them counts for the crew.
export const useCrewMates = create<{ ids: string[] }>(() => ({ ids: [] }))
export const isCrewMate = (id: string) => useCrewMates.getState().ids.includes(id)

// Fastest real run first, then players with only a par (their car's par), then no car at all.
export function rankLadder<T extends Pick<Racer, 'time' | 'par'>>(rows: T[]): T[] {
  const key = (r: T) => (r.time === null ? 2 : r.par ? 1 : 0)
  return [...rows].sort((a, b) => key(a) - key(b) || (a.time ?? 0) - (b.time ?? 0))
}

// How far the player is off the next racer up the ladder: who to beat and by how much.
export function nextUp<T extends Pick<Racer, 'id' | 'time' | 'par'>>(ladder: T[], me: string) {
  const i = ladder.findIndex((r) => r.id === me)
  if (i <= 0) return null
  const above = ladder[i - 1]
  const mine = ladder[i]
  if (above.time === null) return null
  return { racer: above, gap: mine.time === null || mine.par ? null : Math.max(0, mine.time - above.time) }
}

type GhostRow = { t: number | null; par: boolean; car: string | null; pi: number | null; body: string | null; color: string | null; town: string | null }
type SaveRow = { owner_id: string; town_name: string; level: number; cars: OwnedCar[] | null }

const carOf = (cars: OwnedCar[] | null) => (Array.isArray(cars) && cars.length ? bestCar(cars) ?? null : null)

export async function fetchLadder(members: { ownerId: string; townName: string; level: number }[]): Promise<Racer[]> {
  if (!supabase) return []
  const ids = members.map((m) => m.ownerId)
  const sb = supabase
  const [saves, ghosts] = await Promise.all([
    sb.from('game_saves').select('owner_id, town_name, level, cars:state->cars').in('owner_id', ids),
    Promise.all(ids.map((id) => sb.rpc('ghost_of', { p_owner: id }).then(({ data }) => [id, data as GhostRow | null] as const, () => [id, null] as const))),
  ])
  const byId = new Map(((saves.data ?? []) as SaveRow[]).map((r) => [r.owner_id, r]))
  const ghostOf = new Map(ghosts)
  return rankLadder(members.map((m) => {
    const save = byId.get(m.ownerId)
    const g = ghostOf.get(m.ownerId)
    const car = carOf(save?.cars ?? null)
    const d = car ? carDef(car.model) : null
    return {
      id: m.ownerId,
      name: displayName(save?.town_name ?? m.townName, m.ownerId),
      level: save?.level ?? m.level,
      car,
      carName: g?.car ?? d?.name ?? 'No car yet',
      pi: g?.pi ?? (car && d ? performance(d, car.upgrades, car.mods) : 0),
      body: (g?.body as Body | null) ?? d?.body ?? 'sedan',
      color: g?.color ?? car?.color ?? '#eceff1',
      time: g && g.t !== null ? Number(g.t) : null,
      par: g ? g.par : true,
    }
  }))
}

// Races a crewmate's ghost: their best run, or their car's par if they haven't set one.
export function raceCrewMate(r: Racer) {
  const s = useGame.getState()
  if (r.time === null) return s.toast(`${r.name} has no car to race yet`)
  const ghost: Ghost = { owner: r.id, town: r.name, target: r.time, par: r.par, car: r.carName, pi: r.pi, body: r.body, color: r.color, real: !r.demo }
  runGhost(ghost)
}

// ?crew=demo: a made-up crew for trying the Crew window signed out.
export const CREW_DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('crew') === 'demo'

export function demoLadder(me: { id: string; name: string; level: number; cars: OwnedCar[] }): Racer[] {
  const mine = bestCar(me.cars) ?? null
  const myPi = mine ? performance(carDef(mine.model), mine.upgrades, mine.mods) : 60
  const rows: Racer[] = DEMO.map((d, i) => {
    const t = demoTown(d)
    const car = [...t.cars].sort((a, b) => performance(carDef(b.model), b.upgrades, b.mods) - performance(carDef(a.model), a.upgrades, a.mods))[0]
    const def = carDef(car.model)
    const pi = performance(def, car.upgrades, car.mods)
    return {
      id: d.id, name: d.name, level: d.level, car, carName: def.name, pi, body: def.body, color: car.color,
      time: i === 1 ? parTime(pi) : Math.round(parTime(pi) * (0.83 + i * 0.03) * 1000) / 1000, par: i === 1, demo: true,
    }
  })
  const md = mine ? carDef(mine.model) : null
  rows.push({
    id: me.id, name: me.name, level: me.level, car: mine, carName: md?.name ?? 'No car yet', pi: myPi, body: md?.body ?? 'sedan',
    color: mine?.color ?? '#eceff1', time: Math.round(parTime(myPi) * 0.9 * 1000) / 1000, par: false, demo: true,
  })
  return rankLadder(rows)
}

