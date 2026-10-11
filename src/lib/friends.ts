import { supabase } from './supabase'
import type { SaveState, VisitedTown, PlacedBuilding, OwnedCar } from '../game/store'
import { CARS } from '../game/data'
import { displayName } from './names'

export type Leader = { ownerId: string; townName: string; level: number; trophies: number; carName: string | null; demo?: boolean }

// Pre-built neighbours so the Friends list is never empty.
const DEMO: { id: string; name: string; level: number; trophies: number; seed: number }[] = [
  { id: 'demo-rusty', name: 'Rustbelt Row', level: 8, trophies: 42, seed: 3 },
  { id: 'demo-gear', name: 'Gearville', level: 5, trophies: 17, seed: 7 },
  { id: 'demo-nitro', name: 'Nitro Bay', level: 12, trophies: 88, seed: 11 },
]

function rng(seed: number) {
  let x = seed * 9301 + 49297
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280)
}

function demoTown(d: (typeof DEMO)[number]): VisitedTown {
  const r = rng(d.seed)
  const roads = new Set<string>()
  for (let i = 2; i <= 21; i++) {
    roads.add(`${i},3`).add(`${i},20`).add(`3,${i}`).add(`20,${i}`).add(`${i},11`).add(`11,${i}`)
  }
  const kinds = ['pizza', 'donut', 'burger', 'icecream', 'carwash', 'diner', 'tires', 'bowling', 'motel', 'house', 'house', 'tree', 'palm', 'flowers', 'lamp']
  const buildings: PlacedBuilding[] = []
  const taken = new Set<string>()
  // Fill the lots next to roads, Car Town style.
  for (let z = 4; z <= 19; z++) {
    for (let x = 4; x <= 19; x++) {
      if (roads.has(`${x},${z}`) || taken.has(`${x},${z}`)) continue
      const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => roads.has(`${x + dx},${z + dz}`))
      if (!nearRoad || r() < 0.35) continue
      const def = kinds[Math.floor(r() * kinds.length)]
      const wide = ['carwash', 'diner', 'bowling', 'motel'].includes(def)
      if (wide && (roads.has(`${x + 1},${z}`) || taken.has(`${x + 1},${z}`) || x + 1 > 19)) continue
      buildings.push({ uid: `${d.id}-${x}-${z}`, def, x, z, jobEndsAt: null })
      taken.add(`${x},${z}`)
      if (wide) taken.add(`${x + 1},${z}`)
    }
  }
  const cars: OwnedCar[] = Array.from({ length: 6 + Math.floor(r() * 6) }, (_, i) => {
    const c = CARS[Math.floor(r() * Math.min(CARS.length, 3 + d.level / 2))]
    return { uid: `${d.id}-car-${i}`, model: c.id, color: c.colors[Math.floor(r() * c.colors.length)], upgrades: { engine: 0, turbo: 0, tires: 0, weight: 0 } }
  })
  return { ownerId: d.id, townName: d.name, level: d.level, trophies: d.trophies, roads: [...roads], buildings, cars }
}

export const demoLeaders: Leader[] = DEMO.map((d) => ({ ownerId: d.id, townName: d.name, level: d.level, trophies: d.trophies, carName: null, demo: true }))

export async function fetchLeaderboard(): Promise<Leader[]> {
  let real: Leader[] = []
  if (supabase) {
    const { data } = await supabase
      .from('game_saves')
      .select('owner_id, town_name, level, best_car, trophies:state->trophies')
      .order('level', { ascending: false })
      .limit(50)
    real = (data ?? []).map((r) => ({
      ownerId: r.owner_id,
      townName: displayName(r.town_name, r.owner_id),
      level: r.level,
      trophies: Number(r.trophies ?? 0),
      carName: (r.best_car as { name?: string } | null)?.name ?? null,
    }))
  }
  return [...real, ...demoLeaders].sort((a, b) => b.trophies - a.trophies || b.level - a.level)
}

export async function fetchTown(ownerId: string): Promise<VisitedTown | null> {
  const demo = DEMO.find((d) => d.id === ownerId)
  if (demo) return demoTown(demo)
  if (!supabase) return null
  const { data } = await supabase.from('game_saves').select('state').eq('owner_id', ownerId).maybeSingle()
  const s = data?.state as SaveState | undefined
  if (!s) return null
  return { ownerId, townName: displayName(s.townName, ownerId), level: s.level, trophies: s.trophies, roads: s.roads, buildings: s.buildings, cars: s.cars, land: s.land }
}
