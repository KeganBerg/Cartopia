import {
  BUILDINGS, CAMPAIGN, CAR_SETS, RUSTY_SETS, CAMPAIGN_RACES, CARS, GOALS, GP_SERIES, campaignRaceId, MAX_BUILDING_LEVEL, MODS, RESCUE_SPOTS, modXp, buildingUpgradeCost, buildingUpgradeXp, upgradable,
  upgradeFuelCap, upgradeJobSeconds, FAVORITE_BONUS, DEAL_SLOTS, dealSave, QUEST_PAY, CREW_CHEST, TASKS_PER_PERIOD, upgradePartsPayout, upgradePayout, upgradeXp, type BuildingDef,
  SEASON_START, SEASON_DAYS, STARS_PER_TIER, SEASON_STARS, SEASON_TIERS, SEASON_CAR_BUCKS, seasonCars,
} from './data'
import { RIVALS } from './rivals'
import { MASTERY_TIERS } from './mastery'
import { ROAD_STEP, ROAD_STOPS, roadPay } from './trophyRoad'

const LEVELS = Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => i + 1)
const cents = (n: number) => Math.round(n * 100) / 100

// Per building level (index = level - 1): coins spent upgrading to it (parts at 50 coins each),
// the most a level can earn per minute in coins (parts at 50) and XP, and the fuel it holds.
function upgrades(d: BuildingDef) {
  let spent = 0
  const spend = LEVELS.map((l) => {
    const before = spent
    const cost = buildingUpgradeCost(d, l)
    spent += cost.coins + cost.parts * 50
    return before
  })
  const perMin = (n: number, l: number) => (d.jobSeconds ? cents((n * 60) / upgradeJobSeconds(d, l)) : 0)
  return {
    spend,
    coins: LEVELS.map((l) => perMin(upgradePayout(d, l) + upgradePartsPayout(d, l) * 50, l)),
    xp: LEVELS.map((l) => perMin(upgradeXp(d, l), l)),
    fuel: LEVELS.map((l) => upgradeFuelCap(d, l)),
  }
}

// The prices and rewards the server's save guard checks against
// (supabase/migrations/0005_economy_guard.sql, public.econ_catalog()).
// economy.test.ts fails when data.ts changes without the SQL copy.
export function econCatalog() {
  const cars = Object.fromEntries(
    CARS.map((c) => [c.id, { name: c.name, body: c.body, price: c.price, bucks: c.bucks ?? 0, power: c.power, grip: c.grip, weight: c.weight, unlock: c.season ? 0 : c.secret || c.pack ? 999 : c.unlockLevel }]),
  )
  const buildings = Object.fromEntries(
    // Wild obstacles are left out: the guard reads a def it doesn't know as an obstacle worth
    // nothing, the same as listing them, without a catalog migration for every new kind.
    BUILDINGS.filter((b) => !b.wild).map((b) => [b.id, { price: b.price, obstacle: b.kind === 'obstacle', fuelCap: b.fuelCap ?? 0, ...(upgradable(b) ? { up: upgrades(b) } : {}) }]),
  )
  const goals = Object.fromEntries(GOALS.map((g) => [g.id, { coins: g.coins, xp: g.xp, bucks: g.bucks ?? 0 }]))
  const gp = Object.fromEntries(
    GP_SERIES.map((s) => [s.id, { unlock: s.unlockLevel, box: s.box }]),
  )
  // The lowest level at which Rusty can find each car.
  const rescue: Record<string, number> = {}
  for (const spot of RESCUE_SPOTS) for (const c of spot.cars) rescue[c.model] = Math.min(rescue[c.model] ?? 99, spot.unlockLevel)
  // XP earned by upgrading a building from level 1 to each level.
  let xp = 0
  const upgradeXpTo = LEVELS.map((l) => {
    const before = xp
    xp += buildingUpgradeXp(l)
    return before
  })
  const mods = Object.fromEntries(
    MODS.map((m) => [m.id, { slot: m.slot, coins: m.coins, parts: m.parts, bucks: m.bucks, power: m.power, grip: m.grip, weight: m.weight, xp: modXp(m.id), ...(m.only ? { only: m.only } : {}), ...(m.notOn ? { notOn: m.notOn } : {}) }]),
  )
  // Campaign chapters: the one-time bonuses for clearing one and for three stars on all its races.
  const campaign = Object.fromEntries(CAMPAIGN.map((c) => [c.id, {
    unlock: c.unlockLevel, races: Array.from({ length: CAMPAIGN_RACES }, (_, i) => campaignRaceId(c, i)),
    coins: c.coins, bucks: c.bucks, trophies: c.trophies, starBucks: c.starBucks,
  }]))
  // Collection book sets: the cars each needs and its one-time reward.
  // Rusty's sets (every car a search spot turns up) are claimed the same way.
  const sets = Object.fromEntries([...CAR_SETS, ...RUSTY_SETS].map((c) => [c.id, { cars: c.cars, coins: c.coins, bucks: c.bucks, trophies: c.trophies, xp: c.xp }]))
  // Daily and weekly tasks: at most `count` task rewards and one chest per UTC day / ISO week.
  const quests = Object.fromEntries((['daily', 'weekly'] as const).map((p) => [p, { count: TASKS_PER_PERIOD, ...QUEST_PAY[p] }]))
  // Season track: stars per task and chest, stars per tier, each tier's prize, and each season's car.
  const season = {
    start: new Date(SEASON_START).toISOString().slice(0, 10), days: SEASON_DAYS, perTier: STARS_PER_TIER, stars: SEASON_STARS,
    tiers: SEASON_TIERS.map((t) => ({ coins: t.coins, parts: t.parts, bucks: t.bucks, car: !!t.car })), carBucks: SEASON_CAR_BUCKS, cars: seasonCars(),
  }
  // Daily deals: slot i on UTC day n (days since 1970-01-01) is slots[i][(n * step[i] + i) % length].
  // `save` is how much town worth each deal adds beyond what the player paid.
  const deals = {
    slots: DEAL_SLOTS.map((s) => s.deals.map((d) => d.id)),
    step: DEAL_SLOTS.map((s) => s.step),
    save: Object.fromEntries(DEAL_SLOTS.flatMap((s) => s.deals).map((d) => [d.id, dealSave(d)])),
  }
  // Crew chests: paid once per chest the server recorded in public.crew_chests.
  const crew = { chest: CREW_CHEST }
  // Town rivals: each pays its one-time bonus when first beaten three times, from its unlock level.
  const rivals = Object.fromEntries(RIVALS.map((r) => [r.id, { unlock: r.unlockLevel, coins: r.coins, bucks: r.bucks, trophies: r.trophies }]))
  // A driver adds at most this share to a business's coins (see driverPayout).
  // Car mastery: each tier's gems and trophies, paid once per car model, and what it needs
  // (counted per model; the needs of earlier tiers carry on).
  const mastery = { tiers: MASTERY_TIERS.map((t) => ({ bucks: t.bucks, trophies: t.trophies, races: t.need.races ?? 0, wins: t.need.wins ?? 0, modes: t.need.modes ?? 0, upsets: t.need.upsets ?? 0 })) }
  // Trophy Road: a stop every `step` trophies; each stop's coins and parts, then `after` for every stop past the list.
  const road = { step: ROAD_STEP, stops: Array.from({ length: ROAD_STOPS }, (_, i) => roadPay(i)), after: roadPay(ROAD_STOPS) }
  return { cars, buildings, goals, gp, rescue, upgradeXpTo, mods, driverBonus: FAVORITE_BONUS, campaign, sets, quests, season, deals, crew, rivals, mastery, road }
}
