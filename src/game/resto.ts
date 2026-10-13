// Resto-mods: secret cars that are never sold. Each one comes in four pieces won from
// Garage, Gold and Diamond crates; the fourth piece builds the car. A piece you already
// have pays coins instead, and a car you've built drops no more pieces. A car's pieces
// start dropping at its unlock level. Signed-in players' pieces are rolled and counted by
// the server (crate_open() and the crate_opens ledger), so the save's list is a mirror.
import { CARS, type CarDef } from './data'

export const RESTO_PIECES = [
  { name: 'Body', icon: '🚗' },
  { name: 'Engine', icon: '⚙️' },
  { name: 'Wheels', icon: '🛞' },
  { name: 'Interior', icon: '💺' },
] as const
export const PIECE_COUNT = RESTO_PIECES.length

export const restoCars = (): CarDef[] => CARS.filter((c) => c.secret)
export const pieceId = (model: string, piece: number) => `${model}:${piece}`

type Saved = { restoParts?: string[] | null; cars: { model: string }[] }

// The pieces of a car you hold (0-3), from the save's list.
export const piecesOf = (parts: readonly string[] | null | undefined, model: string) =>
  RESTO_PIECES.map((_, i) => i).filter((i) => (parts ?? []).includes(pieceId(model, i)))
export const built = (s: Saved, model: string) => s.cars.some((c) => c.model === model)

// Cars whose pieces can drop for you now: unlocked by level and not built yet.
export const piecePool = (level: number, s: Saved) => restoCars().filter((c) => c.unlockLevel <= level && !built(s, c.id))

// Rewards outside crates that can drop a piece: the chance per go and the coins a piece you
// already hold pays. Rusty's Rescue rolls 'rusty_track' once per Old Race Track search.
export const PIECE_SOURCES: Record<string, { odds: number; dupe: number }> = {
  rusty_track: { odds: 0.02, dupe: 2000 },
}

// The table the server's piece_grant() rolls from (econ_private.resto_tables() in the newest
// migration that sets it; crates.test.ts checks they match).
export const restoTables = () => ({
  pieces: PIECE_COUNT,
  sources: PIECE_SOURCES,
  cars: Object.fromEntries(restoCars().map((c) => [c.id, { unlock: c.unlockLevel, colors: c.colors }])),
})
