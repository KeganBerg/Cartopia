import { create } from 'zustand'
import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { displayName } from './names'
import { useGame, spendFuel, type OwnedCar } from '../game/store'
import { CARS, RACE_FUEL, carDef, performance, type Body } from '../game/data'
import { raceFloor } from '../game/race'

// Friend ghost races (supabase/migrations/0030_friend_ghosts.sql): from a friend's town, race the
// ghost of their best run, then leave them a preset taunt. Guests and demo towns race a ghost too,
// but nothing is posted.

export const GHOST_FUEL = RACE_FUEL

// Preset taunts only: no free text reaches another player. Brag ones need a win.
// public.ghost_taunt_ids() holds the same ids; ghosts.test.ts checks.
export const TAUNTS: { id: number; text: string; brag?: true }[] = [
  { id: 0, text: 'Eat my dust! 💨', brag: true },
  { id: 1, text: 'Too slow! 🐢', brag: true },
  { id: 2, text: 'Nice try, rookie 😎', brag: true },
  { id: 3, text: 'See you at the finish line 🏁', brag: true },
  { id: 4, text: 'Your ghost needs a tune-up 🔧', brag: true },
  { id: 5, text: 'Catch me if you can 🏎️', brag: true },
  { id: 10, text: 'GG! 🤝' },
  { id: 11, text: 'Rematch? 🔁' },
  { id: 12, text: "You're quick! ⚡" },
  { id: 13, text: "I'll be back 😤" },
]
export const tauntText = (id: number) => TAUNTS.find((t) => t.id === id)?.text ?? '👻'
export const tauntsFor = (won: boolean) => TAUNTS.filter((t) => won || !t.brag)

// The ghost being raced. par: the friend has no time yet, so it runs a par for their car.
export type Ghost = { owner: string; town: string; target: number; par: boolean; car: string; pi: number; body: Body; color: string; real: boolean }
export type Taunt = { id: number; from: string; town: string; taunt: number; won: boolean; t: number; their: number | null; at: string }
export type GhostResult = { kept: number; their: number | null; won: boolean; best: number | null }

type GhostState = {
  ghost: Ghost | null
  // Bumped each run so the race screen starts fresh.
  n: number
  // The server's answer to the run in progress: whether it can be posted at all.
  started: Promise<boolean>
  inbox: Taunt[]
  // The taunt inbox opens by itself once per page load.
  shown: boolean
}
export const useGhost = create<GhostState>(() => ({ ghost: null, n: 0, started: Promise.resolve(false), inbox: [], shown: false }))

const isBody = (b: unknown): b is Body => typeof b === 'string' && CARS.some((c) => c.body === b)
// A par time for a car: a clean run, not a perfect one (the time trial uses the same).
export const parTime = (piVal: number) => Math.round(raceFloor(piVal) * 1.3 * 100) / 100

// The fastest car in a town, for demo towns and when the server can't be reached.
function bestOf(cars: OwnedCar[]) {
  let best: { car: OwnedCar; pi: number } | null = null
  for (const c of cars) {
    const p = performance(carDef(c.model), c.upgrades, c.mods)
    if (!best || p > best.pi) best = { car: c, pi: p }
  }
  return best
}

// Works out the ghost for a town you're visiting.
export async function ghostFor(town: { ownerId: string; townName: string; cars: OwnedCar[] }): Promise<Ghost | null> {
  const real = !town.ownerId.startsWith('demo-')
  if (real && supabase) {
    const { data, error } = await supabase.rpc('ghost_of', { p_owner: town.ownerId })
    const g = data as { t: number | null; par: boolean; car: string | null; pi: number | null; body: string | null; color: string | null; town: string | null } | null
    if (!error && g && g.t !== null) {
      return {
        owner: town.ownerId, town: displayName(g.town ?? town.townName, town.ownerId), target: Number(g.t), par: g.par,
        car: g.car ?? 'Mystery car', pi: g.pi ?? 0, body: isBody(g.body) ? g.body : 'sedan', color: g.color ?? '#eceff1', real: true,
      }
    }
  }
  const b = bestOf(town.cars)
  if (!b) return null
  const d = carDef(b.car.model)
  return { owner: town.ownerId, town: town.townName, target: parTime(b.pi), par: true, car: d.name, pi: b.pi, body: d.body, color: b.car.color, real }
}

// Pays the fuel and starts a run against this ghost. False if the player can't race right now.
export function runGhost(g: Ghost) {
  const s = useGame.getState()
  if (!spendFuel(GHOST_FUEL)) {
    s.showNeed('fuel', GHOST_FUEL - s.fuel, 'a ghost race')
    return false
  }
  const started = g.real ? startRun(g.owner) : Promise.resolve(false)
  useGhost.setState((st) => ({ ghost: g, n: st.n + 1, started }))
  s.openPanel('ghost')
  return true
}

// Visits a town (if needed) and races its ghost.
export async function raceTown(town: { ownerId: string; townName: string; cars: OwnedCar[] }) {
  const g = await ghostFor(town)
  if (!g) return useGame.getState().toast("Their garage is empty. Nothing to race yet!")
  runGhost(g)
}

async function startRun(vs: string): Promise<boolean> {
  if (!supabase || !signedInUser()) return false
  try {
    // The server times runs with the car from your cloud save, so send the latest one first.
    await flushSave()
    const { error } = await supabase.rpc('ghost_start', { p_vs: vs })
    return !error
  } catch {
    return false
  }
}

// Posts a finished run. Null if it couldn't be posted.
export async function submitRun(t: number): Promise<GhostResult | null> {
  if (!supabase || !(await useGhost.getState().started)) return null
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.rpc('ghost_submit', { t: Math.round(t * 1000) / 1000 })
    if (!error) {
      const r = data as GhostResult
      return { kept: Number(r.kept), their: r.their === null ? null : Number(r.their), won: r.won, best: r.best === null ? null : Number(r.best) }
    }
    if (error.code === '23514' || error.code === '42501') return null
    await new Promise((res) => setTimeout(res, 1200))
  }
  return null
}

// Leaves a taunt for the friend from the last posted run.
export async function sendTaunt(id: number): Promise<'sent' | 'limit' | 'no'> {
  if (!supabase) return 'no'
  const { data, error } = await supabase.rpc('ghost_taunt', { p_taunt: id })
  return error ? 'no' : (data as 'sent' | 'limit' | 'no')
}

export async function refreshTaunts() {
  if (!supabase || !signedInUser()) return
  const { data, error } = await supabase.rpc('taunt_inbox')
  if (error) return
  const rows = (data ?? []) as { id: number; from: string; town: string | null; taunt: number; won: boolean; t: number; their: number | null; at: string }[]
  useGhost.setState({
    inbox: rows.map((r) => ({ id: r.id, from: r.from, town: displayName(r.town ?? '', r.from), taunt: r.taunt, won: r.won, t: Number(r.t), their: r.their === null ? null : Number(r.their), at: r.at })),
  })
}

// Clears taunts once they've been read.
export function markSeen(ids: number[]) {
  if (!supabase || !ids.length) return
  useGhost.setState((g) => ({ inbox: g.inbox.filter((t) => !ids.includes(t.id)) }))
  supabase.rpc('taunts_seen', { p_ids: ids }).then(() => {}, () => {})
}
