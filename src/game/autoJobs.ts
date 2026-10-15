// Auto jobs: one tap puts the best car on every business. The biggest jobs get
// a car that loves them first (+25%), then every other business gets a car
// (+10%), strongest cars on the biggest jobs. Cars with a flat or out of gas
// earn nothing extra, so they sit out. Pure, so the Garage can preview it.
import { buildingDef, buildingLevel, carDef, driverBonus, performance, takesDriver, upgradePayout } from './data'
import { mergeBoosts } from './merge'
import type { OwnedCar, PlacedBuilding } from './store'

export type AutoJob = { building: string; car: string; loves: boolean; pay: number; was?: string }

// Coins one job pays at a building before any driver, merge bonus included.
const jobPay = (b: PlacedBuilding, boost: number) => upgradePayout(buildingDef(b.def), buildingLevel(b)) * (1 + boost)

// The best car for every business (biggest job first). Leaves out businesses no
// working car is left for.
export function autoJobs(buildings: PlacedBuilding[], cars: OwnedCar[]): AutoJob[] {
  const boost = mergeBoosts(buildings)
  const jobs = buildings
    .filter((b) => takesDriver(buildingDef(b.def)))
    .map((b) => ({ b, pay: jobPay(b, boost.get(b.uid) ?? 0) }))
    .sort((x, y) => y.pay - x.pay || x.b.uid.localeCompare(y.b.uid))
  const crew = cars
    .filter((c) => !c.flat && !c.lowFuel)
    .map((c) => ({ c, pi: performance(carDef(c.model), c.upgrades, c.mods) }))
    .sort((x, y) => y.pi - x.pi || x.c.uid.localeCompare(y.c.uid))
  if (!jobs.length || !crew.length) return []
  // Extra coins per job for each car at each business, plus a hair for PI so the
  // strongest cars take the biggest jobs when the coins tie.
  const top = crew[0].pi || 1
  const value = jobs.map(({ b, pay }) => crew.map(({ c, pi }) => pay * driverBonus(carDef(c.model), buildingDef(b.def).id) + (pay * pi) / top * 1e-4))
  const pick = bestMatch(value)
  const out: AutoJob[] = []
  pick.forEach((ci, ji) => {
    if (ci < 0) return
    const { b, pay } = jobs[ji]
    const c = crew[ci].c
    const bonus = driverBonus(carDef(c.model), buildingDef(b.def).id)
    out.push({ building: b.uid, car: c.uid, loves: bonus > 0.1 + 1e-9, pay: Math.round(pay * (1 + bonus)), was: b.car })
  })
  return out
}

// The new drivers for every business: the plan's car, or for a business the plan
// leaves empty, its current driver if no other business took that car.
export function applyAutoJobs(buildings: PlacedBuilding[], plan: AutoJob[]): PlacedBuilding[] {
  const to = new Map(plan.map((p) => [p.building, p.car]))
  const used = new Set(plan.map((p) => p.car))
  return buildings.map((b) => {
    if (!takesDriver(buildingDef(b.def))) return b
    const car = to.get(b.uid) ?? (b.car && !used.has(b.car) ? b.car : undefined)
    return car === b.car ? b : { ...b, car }
  })
}

// Coins one job at every business pays together, with today's working drivers.
export function roundPay(buildings: PlacedBuilding[], cars: OwnedCar[]) {
  const boost = mergeBoosts(buildings)
  let n = 0
  for (const b of buildings) {
    const d = buildingDef(b.def)
    if (!takesDriver(d)) continue
    const c = b.car ? cars.find((o) => o.uid === b.car) : undefined
    n += jobPay(b, boost.get(b.uid) ?? 0) * (1 + (c && !c.flat && !c.lowFuel ? driverBonus(carDef(c.model), d.id) : 0))
  }
  return Math.round(n)
}

// Whether the plan changes anyone's job.
export const autoJobsChange = (plan: AutoJob[]) => plan.some((p) => p.car !== p.was)

// Highest-total assignment of rows (jobs) to columns (cars), each used at most
// once (Hungarian method). Returns the column for each row, -1 for none.
export function bestMatch(value: number[][]): number[] {
  const rows = value.length
  const cols = rows ? value[0].length : 0
  if (!rows || !cols) return Array(rows).fill(-1)
  // The method wants rows <= columns: flip when there are more jobs than cars.
  if (rows > cols) {
    const back = bestMatch(Array.from({ length: cols }, (_, c) => value.map((r) => r[c])))
    const out = Array(rows).fill(-1)
    back.forEach((r, c) => { if (r >= 0) out[r] = c })
    return out
  }
  const max = Math.max(...value.flat())
  const cost = (r: number, c: number) => max - value[r - 1][c - 1]
  const u = Array(rows + 1).fill(0)
  const v = Array(cols + 1).fill(0)
  const p = Array(cols + 1).fill(0)
  const way = Array(cols + 1).fill(0)
  for (let i = 1; i <= rows; i++) {
    p[0] = i
    let j0 = 0
    const minv = Array(cols + 1).fill(Infinity)
    const used = Array(cols + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= cols; j++) {
        if (used[j]) continue
        const cur = cost(i0, j) - u[i0] - v[j]
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0 }
        if (minv[j] < delta) { delta = minv[j]; j1 = j }
      }
      for (let j = 0; j <= cols; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta } else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }
  const out = Array(rows).fill(-1)
  for (let j = 1; j <= cols; j++) if (p[j]) out[p[j] - 1] = j - 1
  return out
}
