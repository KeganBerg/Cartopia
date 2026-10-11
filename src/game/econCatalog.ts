import { BUILDINGS, CARS, GOALS, GP_SERIES, RESCUE_SPOTS } from './data'

// The prices and rewards the server's save guard checks against
// (supabase/migrations/0005_economy_guard.sql, public.econ_catalog()).
// economy.test.ts fails when data.ts changes without the SQL copy.
export function econCatalog() {
  const cars = Object.fromEntries(
    CARS.map((c) => [c.id, { name: c.name, body: c.body, price: c.price, bucks: c.bucks ?? 0, power: c.power, grip: c.grip, weight: c.weight }]),
  )
  const buildings = Object.fromEntries(
    BUILDINGS.map((b) => [b.id, { price: b.price, obstacle: b.kind === 'obstacle', fuelCap: b.fuelCap ?? 0 }]),
  )
  const goals = Object.fromEntries(GOALS.map((g) => [g.id, { coins: g.coins, xp: g.xp, bucks: g.bucks ?? 0 }]))
  const gp = Object.fromEntries(
    GP_SERIES.map((s) => [s.id, { unlock: s.unlockLevel, box: s.box }]),
  )
  // The lowest level at which Rusty can find each car.
  const rescue: Record<string, number> = {}
  for (const spot of RESCUE_SPOTS) for (const c of spot.cars) rescue[c.model] = Math.min(rescue[c.model] ?? 99, spot.unlockLevel)
  return { cars, buildings, goals, gp, rescue }
}
