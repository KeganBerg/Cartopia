import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { CARS, carDef, performance, type Body } from '../game/data'
import { raceCarOf } from '../game/raceCar'
import { raceFloor } from '../game/race'
import { useGame, spendFuel } from '../game/store'
import { GHOST_FUEL, isBody, runWarGhost, type Ghost } from './ghosts'
import { WAR_RULES, demoBattle, refreshCrewBattle, useCrewBattle, type Battle, type BattleSide } from './battles'

// The crew war map (supabase/migrations/0114_crew_war_map.sql): every member of both crews is a spot on the
// map. A member races a rival's ghost (a war race); a win takes 1 to 3 stars from that rival and adds war
// points. Both crews see every race, so the map shows who has beaten whom and who is still standing.

export type MapSpot = {
  id: string
  name: string
  car: string
  // The car's model id when known, for its render.
  model?: string
  body: Body
  color: string
  pi: number
  // Their ghost's time; null for a street crew driver (the server sets it from the attacker's car).
  t: number | null
  // Strength of a street crew driver (0.4 to 1.6).
  w?: number
  // Most stars any rival has taken off this spot, and how many races were run at it.
  stars: number
  hits: number
  me?: boolean
  // This rival took stars off you: race them back first.
  revenge?: boolean
}

// Cars for street crew drivers: picked from the crew's tag so they stay put.
const PICKS = CARS.filter((c) => c.price > 0 && !c.rescueOnly && !c.season && !c.secret && !c.pack && ['sedan', 'sports', 'muscle', 'coupe', 'rally', 'wedge', 'super'].includes(c.body))
function streetCar(tag: string, i: number) {
  let h = i * 7919
  for (const ch of tag) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PICKS[h % PICKS.length] ?? CARS[0]
}

function spots(side: BattleSide, b: Battle, by: 'us' | 'them', me: string | null): MapSpot[] {
  const hit = (id: string) => (b.attacks ?? []).filter((a) => a.side === by && a.target === id)
  const tally = (id: string) => ({ stars: Math.max(0, ...hit(id).map((a) => a.stars)), hits: hit(id).length })
  if (side.bot) {
    return side.members.map((m, i) => {
      const c = streetCar(side.tag, i + 1)
      return { id: m.id, name: m.name, car: c.name, model: c.id, body: c.body, color: side.color, pi: 0, t: null, w: m.w ?? 1, ...tally(m.id) }
    })
  }
  const roster = side.roster?.length ? side.roster : side.members.map((m) => ({ id: m.id, name: m.name, car: null, body: null, color: null, pi: null, t: null }))
  // Rivals who took stars off you (only on their row).
  const hitMe = (id: string) => by === 'us' && !!me && (b.attacks ?? []).some((a) => a.side === 'them' && a.target === me && a.by === id && a.stars > 0)
  return roster.map((m) => ({
    id: m.id, name: m.name, car: m.car ?? '?', model: CARS.find((c) => c.name === m.car)?.id, body: isBody(m.body) ? m.body : 'sedan', color: m.color ?? side.color,
    pi: m.pi ?? 0, t: m.t, me: m.id === me, revenge: hitMe(m.id), ...tally(m.id),
  }))
}

// Both rows of the map: their crew (stars we took) and ours (stars they took).
export function warMap(b: Battle, me: string | null) {
  return { them: spots(b.them, b, 'us', me), us: spots(b.us, b, 'them', me) }
}

// The time a street crew driver runs against this car (0114: tighter for stronger drivers).
export const streetTime = (myPi: number, w: number) => Math.round(raceFloor(myPi) * (1.34 - 0.05 * Math.min(1.6, Math.max(0.4, w))) * 100) / 100

// The next rival worth racing: one who took stars off you first, then the fewest stars taken, then the
// slowest time; once all are beaten, a rematch. skip: a rival just raced, passed over while there's anyone else.
export function nextTarget(spots: MapSpot[], myPi: number, skip?: string) {
  // Everyone beaten: a rematch still scores war points (0114 scores every race the same way).
  const open = spots.some((s) => s.stars < 3) ? spots.filter((s) => s.stars < 3) : spots
  const pool = open.some((s) => s.id !== skip) ? open.filter((s) => s.id !== skip) : open
  const time = (s: MapSpot) => s.t ?? streetTime(myPi, s.w ?? 1)
  return [...pool].sort((x, y) => Number(!!y.revenge) - Number(!!x.revenge) || x.stars - y.stars || time(y) - time(x))[0] ?? null
}

// War races left today while this week's war is on (0 with no war, or none left).
export function warRacesLeft() {
  const b = useCrewBattle.getState().battle
  return b?.current && !b.current.result ? Math.max(0, b.attacksLeft ?? WAR_RULES.attacksPerDay) : 0
}

// When the day's war races come back (UTC midnight).
export function msToWarRaces(now: number) {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now
}

// The player's race car's performance, as the war map uses it.
export function myWarPi() {
  const s = useGame.getState()
  const car = raceCarOf(s.cars, s.raceCar)
  return car ? performance(carDef(car.model), car.upgrades, car.mods) : 0
}

// Races the next rival straight from a war race's result card.
export function nextWarRival(skip?: string) {
  const b = useCrewBattle.getState().battle?.current
  if (!b || warRacesLeft() <= 0) return null
  return nextTarget(warMap(b, demoBattle() ? 'me' : signedInUser()).them, myWarPi(), skip)
}

// Stars a time earns against a ghost: 1 for a win, 2 by 1%, 3 by 3% (0114's war_attack_submit).
export function warStars(t: number, their: number) {
  if (!(t < their)) return 0
  return 1 + (t <= their * (1 - WAR_RULES.star2) ? 1 : 0) + (t <= their * (1 - WAR_RULES.star3) ? 1 : 0)
}


// Races a rival on the map. The server picks the time to beat and counts the day's war races.
export async function attackSpot(spot: MapSpot, myPi: number, tag: string) {
  const s = useGame.getState()
  const left = useCrewBattle.getState().battle?.attacksLeft ?? WAR_RULES.attacksPerDay
  if (left <= 0) return s.toast('No war races left today')
  if (s.fuel < GHOST_FUEL) return s.showNeed('fuel', GHOST_FUEL - s.fuel, 'a war race')
  const ghost = (target: number, real: boolean): Ghost => ({
    owner: spot.id, town: spot.name, target, par: spot.t === null, car: spot.car, pi: spot.pi || myPi, body: spot.body,
    color: spot.color, real, war: { target: spot.id, tag },
  })
  if (demoBattle() || !supabase || !signedInUser()) {
    if (!spendFuel(GHOST_FUEL)) return
    useCrewBattle.setState((c) => (c.battle ? { battle: { ...c.battle, attacksLeft: Math.max(0, (c.battle.attacksLeft ?? WAR_RULES.attacksPerDay) - 1) } } : c))
    return runWarGhost(ghost(spot.t ?? streetTime(myPi, spot.w ?? 1), false), Promise.resolve(false))
  }
  try {
    // The server times the run with the car from the cloud save, so send the latest one first.
    await flushSave()
    const { data, error } = await supabase.rpc('war_attack_start', { p_target: spot.id })
    if (error) throw new Error(error.message)
    if (!spendFuel(GHOST_FUEL)) return
    const r = data as { their: number; left: number }
    useCrewBattle.setState((c) => (c.battle ? { battle: { ...c.battle, attacksLeft: r.left } } : c))
    runWarGhost(ghost(Number(r.their), true), Promise.resolve(true))
  } catch (e) {
    s.toast((e as Error).message)
  }
}

export type WarResult = { kept: number; their: number; won: boolean; stars: number; points: number; left: number }

// Posts a finished war race. Null if it couldn't be posted.
export async function submitWarRun(t: number): Promise<WarResult | null> {
  if (!supabase) return null
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.rpc('war_attack_submit', { t: Math.round(t * 1000) / 1000 })
    if (!error) {
      const r = data as WarResult
      void refreshCrewBattle()
      return { kept: Number(r.kept), their: Number(r.their), won: r.won, stars: r.stars, points: r.points, left: r.left }
    }
    if (error.code === '23514' || error.code === '42501') return null
    await new Promise((res) => setTimeout(res, 1200))
  }
  return null
}
