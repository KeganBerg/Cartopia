import { CARS, carDef, performance, type Body } from '../game/data'
import { callCardDef } from '../game/callCards'

// The car another player races with, as their server save has it. game_saves.best_car is the
// guard's own pick (their highest PI); their picked race car comes from the guard-checked cars
// in the save, and its PI is never shown above best_car's.
export type ServerCar = { uid: string | null; name: string; color: string; body: Body; pi: number; mods?: string[] }

// The game_saves columns serverCar() reads.
export const SERVER_CAR_COLUMNS = 'best_car, race_car:state->raceCar, cars:state->cars, call_card:state->callCard, call_cards:state->callCards'

type Row = { best_car?: unknown; race_car?: unknown; cars?: unknown; call_card?: unknown; call_cards?: unknown }
const KNOWN = new Set(CARS.map((c) => c.id))

export function serverCar(row: Row): ServerCar | null {
  const b = (row.best_car ?? {}) as Record<string, unknown>
  if (typeof b.name !== 'string' || typeof b.pi !== 'number') return null
  const best: ServerCar = { uid: null, name: b.name, color: b.color as string, body: b.body as Body, pi: b.pi, mods: b.mods as string[] | undefined }
  if (typeof row.race_car !== 'string' || !Array.isArray(row.cars)) return best
  const c = row.cars.find((x) => x && typeof x === 'object' && (x as { uid?: unknown }).uid === row.race_car) as Record<string, unknown> | undefined
  if (!c || typeof c.model !== 'string' || !KNOWN.has(c.model) || !c.upgrades || typeof c.upgrades !== 'object') return best
  const d = carDef(c.model)
  const mods = Array.isArray(c.mods) ? c.mods.filter((m): m is string => typeof m === 'string') : undefined
  const up = c.upgrades as Record<string, unknown>
  const lvl = (k: string) => (typeof up[k] === 'number' ? (up[k] as number) : 0)
  const pi = performance(d, { engine: lvl('engine'), turbo: lvl('turbo'), tires: lvl('tires'), weight: lvl('weight') }, mods)
  if (!Number.isFinite(pi)) return best
  return { uid: row.race_car, name: d.name, color: typeof c.color === 'string' ? c.color : best.color, body: d.body, pi: Math.min(pi, best.pi), ...(mods?.length ? { mods } : {}) }
}

// The Call Card another player shows (game/callCards.ts): the one their save wears, when the save
// also holds it. The server keeps a save's cards to what its crates gave (migration call_cards).
export function serverCallCard(row: Row): string | undefined {
  const id = row.call_card
  if (typeof id !== 'string' || !callCardDef(id)) return undefined
  return Array.isArray(row.call_cards) && row.call_cards.includes(id) ? id : undefined
}
