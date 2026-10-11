// Rough progression model: how fast an engaged player levels up and earns.
// Not a test. Run with: npx vite-node scripts/econSim.ts
//
// The player checks in every CHECK minutes for AWAKE hours a day, then sleeps.
// Each check-in: collect finished jobs, start jobs (best coins per fuel first)
// while fuel lasts, claim goals/tasks, then buy whatever adds the most income
// per coin. Fuel is the real limit, so it also buys gas stations and upgrades.
// Races, Rusty's, GP and the campaign are left out (they cost fuel too); story
// goals that need them are claimed on a timer as a stand-in.
import {
  BUILDINGS, GOALS, CARS, DAILY_BONUS, QUEST_PAY, payAt, xpToNext, baseFuelCap, buildingUpgradeCost, upgradePayout, upgradeXp,
  upgradeJobSeconds, upgradeFuelCap, upgradePartsPayout, buildingUpgradeXp, MAX_BUILDING_LEVEL, type BuildingDef,
} from '../src/game/data'

const CHECK = Number(process.env.CHECK ?? 60)
const AWAKE = Number(process.env.AWAKE ?? 12)
const DAYS = Number(process.env.DAYS ?? 60)

type B = { d: BuildingDef; level: number; endsAt: number | null; pay: number; xp: number }
// The starting town (public.econ_starter on the server).
let coins = 2500, xp = 0, level = 1, fuel = 25, parts = 10, bucks = 10
let earned = 0, jobs = 0, built = 0, upgrades = 0
const town: B[] = []
const claimed = new Set<string>()
const openedAt = new Map<string, number>()
const out: Record<string, string> = {}
let t = 0 // minutes since start
let playMin = 0 // minutes actually checked in (CHECK per check-in counts as one "session" slot)

const cap = () => baseFuelCap(level) + town.reduce((n, b) => n + upgradeFuelCap(b.d, b.level), 0)
const owns = (id: string) => town.some((b) => b.d.id === id)
function addXp(n: number) {
  xp += n
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level++
    bucks++
    coins += level * 100
    fuel = Math.max(fuel, cap())
    for (const m of [3, 5, 8, 10, 12, 15, 20]) if (level === m) out[`L${m}`] = `day ${(t / 1440 + 1).toFixed(1)}`
  }
}
function earn(n: number) { coins += n; earned += n }

const jobsFor = () => town.filter((b) => b.d.jobSeconds && b.d.kind !== 'obstacle' && b.d.id !== 'rescue' && b.d.id !== 'crew')
// Coins (parts at 50) a building makes per fuel at its level.
const perFuel = (d: BuildingDef, l: number) => (upgradePayout(d, l) + upgradePartsPayout(d, l) * 50) / d.fuelCost!

// Income one check-in can make with this town and this much fuel (greedy by coins per fuel).
function incomePerCheck(list: { d: BuildingDef; level: number }[], f: number) {
  const jobsList = list.filter((b) => b.d.jobSeconds && b.d.fuelCost)
    .map((b) => ({ ...b, runs: Math.max(1, Math.floor((CHECK * 60) / upgradeJobSeconds(b.d, b.level))) * (upgradeJobSeconds(b.d, b.level) <= CHECK * 60 ? 1 : (CHECK * 60) / upgradeJobSeconds(b.d, b.level)) }))
    .sort((a, b) => perFuel(b.d, b.level) - perFuel(a.d, a.level))
  let left = f, inc = 0
  for (const j of jobsList) {
    // A building runs one job per check-in (collected next time).
    const n = Math.min(1, left / j.d.fuelCost!)
    if (n <= 0) break
    inc += n * j.d.fuelCost! * perFuel(j.d, j.level)
    left -= n * j.d.fuelCost!
  }
  return inc
}

function checkIn() {
  // Collect.
  for (const b of town) if (b.endsAt !== null && t * 60 >= b.endsAt) { earn(b.pay); addXp(b.xp); b.endsAt = null; jobs++ }
  // Start jobs, best coins per fuel first.
  for (const b of jobsFor().sort((a, b) => perFuel(b.d, b.level) - perFuel(a.d, a.level))) {
    if (b.endsAt === null && fuel >= b.d.fuelCost!) {
      fuel -= b.d.fuelCost!
      b.endsAt = t * 60 + upgradeJobSeconds(b.d, b.level)
      b.pay = upgradePayout(b.d, b.level) * 1.1 // a driver on every job
      parts += upgradePartsPayout(b.d, b.level)
      b.xp = upgradeXp(b.d, b.level)
    }
  }
  // Goals: tracked ones when met, untracked ones (races, campaign, cars...) 45 play-minutes after they open.
  const active = GOALS.filter((g) => !g.event && !claimed.has(g.id) && level >= (g.level ?? 1)).slice(0, 3)
  for (const g of active) {
    const v = g.stat === 'level' ? level : g.stat === 'jobs' ? jobs : g.stat === 'built' ? built : g.stat === 'coinsEarned' ? earned
      : g.stat === 'upgrades' ? upgrades : g.stat === 'rusty' ? (owns('rescue') ? 1 : 0) : g.stat === 'owns' ? (owns(g.def!) ? 1 : 0)
      : g.stat === 'bldgLevel' ? Math.max(0, ...town.map((b) => b.level)) : null
    const ok = v === null ? playMin - (openedAt.get(g.id) ?? (openedAt.set(g.id, playMin), playMin)) >= 45 : v >= g.target
    if (ok) { claimed.add(g.id); earn(g.coins); bucks += g.bucks ?? 0; addXp(g.xp) }
  }
  buy()
}

function buy() {
  for (let guard = 0; guard < 50; guard++) {
    if (!owns('rescue')) { if (coins >= 1000) { coins -= 1000; town.push({ d: BUILDINGS.find((b) => b.id === 'rescue')!, level: 1, endsAt: null, pay: 0, xp: 0 }); built++; continue } return }
    const fuelPer = Math.min(cap(), CHECK)
    const base = incomePerCheck(town, fuelPer)
    const opts: { cost: number; parts: number; gain: number; go: () => void }[] = []
    for (const d of BUILDINGS) {
      if (d.unlockLevel > level || d.bucks || d.event || !(d.kind === 'business' || d.kind === 'parts' || d.kind === 'gas') || d.id === 'crew' || d.id === 'rescue') continue
      if (d.unique && owns(d.id)) continue
      if (d.nightOnly) continue
      const gain = d.kind === 'gas'
        ? incomePerCheck(town, Math.min(cap() + upgradeFuelCap(d, 1), CHECK)) - base + (cap() < CHECK ? 1 : 0)
        : incomePerCheck([...town, { d, level: 1 }], fuelPer) - base
      opts.push({ cost: d.price, parts: 0, gain, go: () => { town.push({ d, level: 1, endsAt: null, pay: 0, xp: 0 }); built++ } })
    }
    for (const b of town) {
      if (b.level >= MAX_BUILDING_LEVEL || !(b.d.jobSeconds || b.d.fuelCap) || b.d.id === 'rescue' || b.d.id === 'crew') continue
      const c = buildingUpgradeCost(b.d, b.level)
      const gain = b.d.fuelCap
        ? incomePerCheck(town, Math.min(cap() + 2, CHECK)) - base
        : incomePerCheck(town.map((o) => (o === b ? { d: o.d, level: o.level + 1 } : o)), fuelPer) - base
      opts.push({ cost: c.coins, parts: c.parts, gain, go: () => { b.level++; upgrades++; addXp(buildingUpgradeXp(b.level - 1)) } })
    }
    const best = opts.filter((o) => o.gain > 0).sort((a, b) => b.gain / b.cost - a.gain / a.cost)[0]
    if (!best || coins < best.cost || parts < best.parts) return
    coins -= best.cost; parts -= best.parts; best.go()
  }
}

let lastDay = -1, streak = 0
const hourly: Record<number, number> = {}
for (t = 0; t < DAYS * 1440; t += CHECK) {
  const day = Math.floor(t / 1440)
  const minOfDay = t % 1440
  fuel = Math.min(cap(), fuel + CHECK) // regen 1 a minute
  if (minOfDay >= AWAKE * 60) continue
  if (day !== lastDay) {
    lastDay = day
    streak = Math.min(streak + 1, DAILY_BONUS.length)
    const db = DAILY_BONUS[streak - 1] as { coins: number; bucks?: number; parts?: number }
    earn(db.coins); bucks += db.bucks ?? 0; parts += db.parts ?? 0
    // Daily tasks + chest (assume all three done); weekly on day 7, 14, ...
    const dt = payAt(QUEST_PAY.daily.task, level), dc = payAt(QUEST_PAY.daily.chest, level)
    earn(dt.coins * 3 + dc.coins); addXp(dt.xp * 3 + dc.xp); parts += QUEST_PAY.daily.chest.parts
    if (day % 7 === 6) {
      const wt = payAt(QUEST_PAY.weekly.task, level), wc = payAt(QUEST_PAY.weekly.chest, level)
      earn(wt.coins * 3 + wc.coins); addXp(wt.xp * 3); parts += QUEST_PAY.weekly.chest.parts; bucks += QUEST_PAY.weekly.chest.bucks
    }
    if ([1, 3, 7, 14, 30].includes(day)) {
      const inc = incomePerCheck(town, Math.min(cap(), CHECK)) * (60 / CHECK)
      hourly[day] = Math.round(inc)
    }
  }
  playMin += CHECK
  checkIn()
}
const newestCar = (l: number) => CARS.filter((c) => !c.bucks && !c.rescueOnly && !c.season && c.unlockLevel <= l).sort((a, b) => b.price - a.price)[0]
console.log(JSON.stringify({
  reached: out,
  finalLevel: level, coins: Math.round(coins), earned: Math.round(earned), bucks, buildings: town.length,
  coinsPerPlayHour: hourly,
  newestCarAtL5: newestCar(5).name + ' ' + newestCar(5).price,
}, null, 1))
