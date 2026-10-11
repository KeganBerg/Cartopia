// Static game data: buildings, cars and the progression curve.

export const GRID = 24
export const TILE = 2

export type BuildingKind = 'business' | 'gas' | 'parts' | 'showroom' | 'garage' | 'decor' | 'house' | 'obstacle'

export type BuildingDef = {
  id: string
  name: string
  kind: BuildingKind
  w: number
  h: number
  price: number
  bucks?: number
  unlockLevel: number
  // Businesses: a job costs fuel, runs for `jobSeconds`, then pays out.
  jobSeconds?: number
  fuelCost?: number
  payout?: number
  xp?: number
  partsPayout?: number
  // Gas stations raise the fuel cap.
  fuelCap?: number
  color: string
  roof: string
  sign?: string
  // Novelty prop on the roof, like the original's giant donuts and burgers.
  // Only one per town.
  unique?: boolean
  prop?: 'donut' | 'burger' | 'cone' | 'tire' | 'pin' | 'popcorn'
  // Stand-in for a building this build doesn't know (see buildingDef).
  parked?: boolean
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'showroom', name: 'Showroom', kind: 'showroom', w: 2, h: 2, price: 0, unlockLevel: 99, color: '#cfd8dc', roof: '#eceff1', sign: 'SHOWROOM' },
  { id: 'garage', name: 'My Garage', kind: 'garage', w: 2, h: 2, price: 0, unlockLevel: 99, color: '#b0bec5', roof: '#78909c', sign: 'GARAGE' },
  // Rusty rescues and restores cars: the first thing a new town builds, and
  // the Showroom stays locked until it exists.
  { id: 'rescue', name: "Rusty's Rescue", kind: 'business', w: 2, h: 1, price: 1000, unlockLevel: 1, unique: true, color: '#a1887f', roof: '#c62828', sign: "RUSTY'S" },
  // Crew House: the town's clubhouse, opens the Crew window.
  { id: 'crew', name: 'Crew House', kind: 'business', w: 2, h: 1, price: 2500, unlockLevel: 2, unique: true, color: '#455a64', roof: '#ff7043', sign: 'CREW HOUSE' },
  { id: 'gas', name: 'Gas Station', kind: 'gas', w: 2, h: 1, price: 1500, unlockLevel: 1, fuelCap: 10, color: '#ffca28', roof: '#e53935', sign: 'GAS' },
  { id: 'pizza', name: 'Pizza Place', kind: 'business', w: 1, h: 1, price: 400, unlockLevel: 1, jobSeconds: 30, fuelCost: 1, payout: 60, xp: 5, color: '#c0504d', roof: '#f5f5f5', sign: 'PIZZA' },
  { id: 'donut', name: 'Donut Shop', kind: 'business', w: 1, h: 1, price: 900, unlockLevel: 2, jobSeconds: 90, fuelCost: 2, payout: 160, xp: 12, color: '#f48fb1', roof: '#fff8e1', sign: 'DONUTS', prop: 'donut' },
  { id: 'burger', name: 'Burger Joint', kind: 'business', w: 1, h: 1, price: 1200, unlockLevel: 2, jobSeconds: 120, fuelCost: 2, payout: 210, xp: 15, color: '#ffb300', roof: '#d84315', sign: 'BURGERS', prop: 'burger' },
  { id: 'icecream', name: 'Ice Cream Stand', kind: 'business', w: 1, h: 1, price: 1500, unlockLevel: 3, jobSeconds: 150, fuelCost: 2, payout: 260, xp: 18, color: '#b3e5fc', roof: '#f8bbd0', sign: 'ICE CREAM', prop: 'cone' },
  { id: 'carwash', name: 'Car Wash', kind: 'business', w: 2, h: 1, price: 1800, unlockLevel: 3, jobSeconds: 180, fuelCost: 3, payout: 380, xp: 25, color: '#4fc3f7', roof: '#e1f5fe', sign: 'CAR WASH' },
  { id: 'diner', name: 'Diner', kind: 'business', w: 2, h: 1, price: 3200, unlockLevel: 4, jobSeconds: 300, fuelCost: 4, payout: 700, xp: 40, color: '#90caf9', roof: '#ef5350', sign: 'DINER' },
  { id: 'tires', name: 'Tire Shop', kind: 'parts', w: 1, h: 1, price: 2000, unlockLevel: 2, jobSeconds: 240, fuelCost: 3, payout: 100, partsPayout: 6, xp: 20, color: '#455a64', roof: '#263238', sign: 'TIRES', prop: 'tire' },
  { id: 'bowling', name: 'Bowling Alley', kind: 'business', w: 2, h: 1, price: 4200, unlockLevel: 5, jobSeconds: 420, fuelCost: 4, payout: 950, xp: 55, color: '#7e57c2', roof: '#ede7f6', sign: 'BOWLING', prop: 'pin' },
  { id: 'motel', name: 'Motel', kind: 'business', w: 2, h: 1, price: 5500, unlockLevel: 6, jobSeconds: 720, fuelCost: 5, payout: 1400, xp: 70, color: '#ffe0b2', roof: '#00897b', sign: 'MOTEL' },
  { id: 'tuner', name: 'Tuner Shop', kind: 'parts', w: 2, h: 1, price: 8000, unlockLevel: 7, jobSeconds: 600, fuelCost: 5, payout: 400, partsPayout: 25, xp: 70, color: '#212121', roof: '#ff3d00', sign: 'TUNER' },
  { id: 'stadium', name: 'Speedway', kind: 'business', w: 2, h: 2, price: 20000, unlockLevel: 10, jobSeconds: 1800, fuelCost: 10, payout: 6000, xp: 300, color: '#eceff1', roof: '#c62828', sign: 'SPEEDWAY' },
  { id: 'cinema', name: 'Drive-In', kind: 'business', w: 2, h: 2, price: 6000, unlockLevel: 6, jobSeconds: 600, fuelCost: 6, payout: 1500, xp: 80, color: '#8d6e63', roof: '#3e2723', sign: 'DRIVE-IN', prop: 'popcorn' },
  { id: 'parts', name: 'Parts Depot', kind: 'parts', w: 2, h: 1, price: 5000, unlockLevel: 5, jobSeconds: 480, fuelCost: 4, payout: 200, partsPayout: 15, xp: 45, color: '#1565c0', roof: '#bbdefb', sign: 'PARTS' },

  // Obstacles on newly bought land: pay to clear, wait, then tap to remove.
  { id: 'bush', name: 'Bushes', kind: 'obstacle', w: 1, h: 1, price: 150, unlockLevel: 99, jobSeconds: 30, xp: 5, color: '#558b2f', roof: '#33691e' },
  { id: 'rock', name: 'Boulder', kind: 'obstacle', w: 1, h: 1, price: 400, unlockLevel: 99, jobSeconds: 120, xp: 12, color: '#9e9e9e', roof: '#757575' },
  { id: 'cactus', name: 'Cactus', kind: 'obstacle', w: 1, h: 1, price: 1500, unlockLevel: 99, jobSeconds: 600, xp: 40, color: '#43a047', roof: '#2e7d32' },
  { id: 'house', name: 'House', kind: 'house', w: 1, h: 1, price: 250, unlockLevel: 1, color: '#fff3e0', roof: '#6d4c41' },
  { id: 'tree', name: 'Oak Tree', kind: 'decor', w: 1, h: 1, price: 50, unlockLevel: 1, color: '#43a047', roof: '#2e7d32' },
  { id: 'palm', name: 'Palm Tree', kind: 'decor', w: 1, h: 1, price: 120, unlockLevel: 2, color: '#66bb6a', roof: '#8d6e63' },
  { id: 'fountain', name: 'Fountain', kind: 'decor', w: 1, h: 1, price: 800, bucks: 0, unlockLevel: 4, color: '#e0e0e0', roof: '#4fc3f7' },
  { id: 'flowers', name: 'Flower Bed', kind: 'decor', w: 1, h: 1, price: 80, unlockLevel: 1, color: '#e91e63', roof: '#795548' },
  { id: 'lamp', name: 'Street Lamp', kind: 'decor', w: 1, h: 1, price: 60, unlockLevel: 1, color: '#37474f', roof: '#fff59d' },
  { id: 'bench', name: 'Park Bench', kind: 'decor', w: 1, h: 1, price: 70, unlockLevel: 2, color: '#8d6e63', roof: '#424242' },
  { id: 'billboard', name: 'Billboard', kind: 'decor', w: 1, h: 1, price: 600, unlockLevel: 3, color: '#eceff1', roof: '#1e88e5' },
  { id: 'statue', name: 'Golden Car Statue', kind: 'decor', w: 1, h: 1, price: 0, bucks: 3, unlockLevel: 5, color: '#ffd700', roof: '#9e9e9e' },
  { id: 'pond', name: 'Duck Pond', kind: 'decor', w: 2, h: 2, price: 1500, unlockLevel: 4, color: '#4fc3f7', roof: '#81c784' },
]

// Land is bought in 8x8 plots. The starting lot is the 3x3 plots covering
// tiles 0-23; towns can grow two plots out on every side.
export const PLOT = 8
export const PLOT_MIN = -2
export const PLOT_MAX = 4
export const START_LAND = [0, 1, 2].flatMap((x) => [0, 1, 2].map((z) => `${x},${z}`))
export const plotPrice = (bought: number) => Math.round((5000 * Math.pow(1.45, bought)) / 500) * 500

// A save can hold a building this build doesn't know yet, e.g. one placed on a
// preview site of an unmerged feature (both share the same cloud saves). It gets
// a harmless stand-in: no jobs, no fuel, can't be sold, drawn as a covered lot.
// The save keeps the real id, so it comes back once that building ships.
const parkedDefs = new Map<string, BuildingDef>()
function parkedDef(id: string): BuildingDef {
  let d = parkedDefs.get(id)
  if (!d) {
    d = { id, name: 'Coming Soon', kind: 'decor', w: 1, h: 1, price: 0, unlockLevel: 99, color: '#ffb300', roof: '#455a64', parked: true }
    parkedDefs.set(id, d)
  }
  return d
}
export const knownBuilding = (id: string) => BUILDINGS.some((b) => b.id === id)
export const buildingDef = (id: string): BuildingDef => BUILDINGS.find((b) => b.id === id) ?? parkedDef(id)

// Building upgrades: businesses, parts makers and gas stations go from level 1
// to 10. Each level pays more per job and finishes jobs sooner (a gas station
// holds more fuel instead). Saves keep the level as `level` on the placed
// building; a missing level is level 1.
export const MAX_BUILDING_LEVEL = 10
export const upgradable = (d: BuildingDef) =>
  !d.parked && ((!!d.jobSeconds && d.kind !== 'obstacle') || !!d.fuelCap)
export const buildingLevel = (b: { level?: number }) =>
  Math.min(MAX_BUILDING_LEVEL, Math.max(1, Math.floor(Number(b.level) || 1)))

// +15% coins and parts and +10% XP per level, 8% shorter jobs (rounded to 5s).
export const upgradePayout = (d: BuildingDef, level: number) => Math.round((d.payout ?? 0) * (1 + 0.15 * (level - 1)))
export const upgradePartsPayout = (d: BuildingDef, level: number) => Math.round((d.partsPayout ?? 0) * (1 + 0.15 * (level - 1)))
export const upgradeXp = (d: BuildingDef, level: number) => Math.round((d.xp ?? 0) * (1 + 0.1 * (level - 1)))
export const upgradeJobSeconds = (d: BuildingDef, level: number) =>
  d.jobSeconds ? Math.max(10, Math.round((d.jobSeconds * Math.pow(0.92, level - 1)) / 5) * 5) : 0
export const upgradeFuelCap = (d: BuildingDef, level: number) => (d.fuelCap ? d.fuelCap + 2 * (level - 1) : 0)

// Cost to go from `level` to `level + 1`: 60% of the build price, 40% more each
// level, plus parts from level 4 up.
export const buildingUpgradeCost = (d: BuildingDef, level: number) => ({
  coins: Math.max(100, Math.round((d.price * 0.6 * Math.pow(1.4, level - 1)) / 50) * 50),
  parts: level >= 4 ? (level - 2) * 2 : 0,
})
export const buildingUpgradeXp = (level: number) => 10 + level * 5
// Extra model height an upgraded building gains, on the same lot.
export const levelLift = (level = 1) => 0.26 * (Math.min(MAX_BUILDING_LEVEL, Math.max(1, level)) - 1)

export type Body = 'compact' | 'sedan' | 'sports' | 'muscle' | 'truck' | 'super' | 'bubble' | 'wagon' | 'wedge' | 'roadster' | 'rally' | 'classic' | 'offroad' | 'coupe'

export type SkillId = 'launch' | 'nitro' | 'slipstream' | 'smooth' | 'oil'
export const SKILLS: Record<SkillId, { name: string; icon: string; text: string }> = {
  launch: { name: 'Hole Shot', icon: '🚀', text: '20% faster off the line in first gear' },
  nitro: { name: 'Nitro Burst', icon: '🔥', text: '15% more power in top gear' },
  slipstream: { name: 'Slipstream', icon: '💨', text: '8% more speed while chasing the leader' },
  smooth: { name: 'Smooth Shifter', icon: '🎯', text: 'Good shifts count as perfect' },
  oil: { name: 'Oil Slick', icon: '🛢', text: 'Rivals lose 10% grip for the first 2.5 seconds' },
}

export type CarDef = {
  id: string
  name: string
  body: Body
  price: number
  bucks?: number
  unlockLevel: number
  // Classics that only turn up in Rusty's searches, never in the Showroom.
  rescueOnly?: boolean
  // Race perk, like the original's car special skills.
  skill?: SkillId
  // Businesses this car loves working at (building ids): it earns them a bigger bonus.
  likes: string[]
  // Base performance stats out of 100.
  power: number
  grip: number
  weight: number
  colors: string[]
  // Stand-in for a car this build doesn't know (see carDef).
  parked?: boolean
}

// Parodies of real cars: the shapes and stats nod to the real thing, but the
// makers and model names are invented. Never use a real brand or model name, or
// a misspelling of one. Ids stay fixed so existing saves keep working.
// Stats follow each real car's relative performance.
export const CARS: CarDef[] = [
  { id: 'pip', name: 'Kipper Pocket', body: 'compact', price: 800, unlockLevel: 1, power: 18, grip: 36, weight: 24, skill: 'launch', likes: ['pizza', 'donut'], colors: ['#c62828', '#1b5e20', '#fafafa'] },
  { id: 'civic', name: 'Kazumi Commuter', body: 'sedan', price: 1500, unlockLevel: 1, power: 24, grip: 34, weight: 36, skill: 'slipstream', likes: ['pizza', 'diner'], colors: ['#1e88e5', '#eeeeee', '#424242'] },
  { id: 'trail', name: 'Ironside Workhorse', body: 'truck', price: 2600, unlockLevel: 2, power: 38, grip: 26, weight: 74, skill: 'launch', likes: ['tires', 'parts'], colors: ['#0d47a1', '#c62828', '#eceff1'] },
  { id: 'miata', name: 'Kazumi Zephyr', body: 'roadster', price: 4200, unlockLevel: 3, power: 32, grip: 54, weight: 22, skill: 'smooth', likes: ['icecream', 'cinema'], colors: ['#d32f2f', '#1e88e5', '#fafafa'] },
  { id: 'stallion', name: "Liberty Bore Horse '68", body: 'muscle', price: 7000, unlockLevel: 4, power: 52, grip: 34, weight: 54, skill: 'nitro', likes: ['burger', 'stadium'], colors: ['#1b5e20', '#ff6f00', '#212121'] },
  { id: 'rally', name: 'Kodiak Gravel Rex', body: 'rally', price: 9500, unlockLevel: 5, power: 52, grip: 64, weight: 40, skill: 'smooth', likes: ['tires', 'tuner'], colors: ['#0d47a1', '#fafafa', '#ffd600'] },
  { id: 'vette', name: 'Liberty Sidewinder', body: 'sports', price: 14000, unlockLevel: 6, power: 66, grip: 54, weight: 38, skill: 'slipstream', likes: ['motel', 'stadium'], colors: ['#b71c1c', '#bdbdbd', '#ffd600'] },
  { id: 'charger', name: 'Liberty Brawler', body: 'muscle', price: 18000, unlockLevel: 7, power: 70, grip: 40, weight: 60, skill: 'nitro', likes: ['burger', 'tuner'], colors: ['#212121', '#ff5722', '#6a1b9a'] },
  { id: 'gtr', name: 'Kazumi Ronin GT', body: 'coupe', price: 26000, unlockLevel: 9, power: 78, grip: 70, weight: 46, skill: 'smooth', likes: ['tuner', 'bowling'], colors: ['#eceff1', '#263238', '#ff6d00'] },
  { id: 'lambo', name: 'Veloce Corrida V12', body: 'wedge', price: 0, bucks: 40, unlockLevel: 5, power: 86, grip: 70, weight: 34, skill: 'oil', likes: ['cinema', 'carwash'], colors: ['#fdd835', '#d50000', '#fafafa'] },
  { id: 'hyper', name: 'Veloce Hyperion', body: 'super', price: 60000, unlockLevel: 12, power: 98, grip: 86, weight: 32, skill: 'nitro', likes: ['stadium', 'tuner'], colors: ['#1a237e', '#212121', '#d50000'] },
  { id: 'bug', name: 'Bumble Bubble', body: 'bubble', price: 1200, unlockLevel: 1, rescueOnly: true, power: 14, grip: 28, weight: 28, skill: 'launch', likes: ['icecream', 'donut'], colors: ['#80cbc4', '#ffcc80', '#ef9a9a'] },
  { id: 'woodie', name: 'Lakeside Woodie Wagon', body: 'wagon', price: 2200, unlockLevel: 1, rescueOnly: true, power: 22, grip: 28, weight: 56, skill: 'slipstream', likes: ['diner', 'carwash'], colors: ['#fafafa', '#fff59d', '#4db6ac'] },
  { id: 'hauler', name: 'Old Faithful Hauler', body: 'truck', price: 3000, unlockLevel: 1, rescueOnly: true, power: 26, grip: 26, weight: 70, skill: 'launch', likes: ['parts', 'carwash'], colors: ['#558b2f', '#e65100', '#1565c0'] },
  { id: 'cruiser', name: "Sunset Cruiser '57", body: 'classic', price: 5000, unlockLevel: 1, rescueOnly: true, power: 38, grip: 34, weight: 58, skill: 'slipstream', likes: ['cinema', 'diner'], colors: ['#4dd0e1', '#f06292', '#fafafa'] },
  { id: 'buggy', name: 'Dune Skipper Buggy', body: 'offroad', price: 6000, unlockLevel: 1, rescueOnly: true, power: 34, grip: 56, weight: 18, skill: 'launch', likes: ['icecream', 'tires'], colors: ['#ff9800', '#cddc39', '#29b6f6'] },
  { id: 'bandit', name: 'Night Bandit', body: 'muscle', price: 8000, unlockLevel: 1, rescueOnly: true, power: 56, grip: 38, weight: 54, skill: 'nitro', likes: ['bowling', 'burger'], colors: ['#212121', '#ffd54f', '#b71c1c'] },
  { id: 'lemans', name: 'Liberty Endurance GT', body: 'super', price: 16000, unlockLevel: 1, rescueOnly: true, power: 72, grip: 62, weight: 32, skill: 'smooth', likes: ['stadium', 'parts'], colors: ['#1565c0', '#fafafa', '#c62828'] },
  { id: 'gullwing', name: 'Silver Wing 300', body: 'coupe', price: 30000, unlockLevel: 1, rescueOnly: true, power: 64, grip: 58, weight: 36, skill: 'oil', likes: ['motel', 'bowling'], colors: ['#cfd8dc', '#b71c1c', '#263238'] },
]

// Rusty's Rescue: pay to search a location, tap the pins to send the tow
// truck out, haul the finds home, then restore them in the bay.
export type Rarity = 'common' | 'scarce' | 'rare'
export const RARITY: Record<Rarity, { name: string; weight: number; minutes: number; scrapParts: number }> = {
  common: { name: 'Common', weight: 60, minutes: 5, scrapParts: 3 },
  scarce: { name: 'Scarce', weight: 30, minutes: 30, scrapParts: 6 },
  rare: { name: 'Rare', weight: 10, minutes: 120, scrapParts: 12 },
}

export type RescueSpot = { id: string; name: string; icon: string; unlockLevel: number; cost: number; cars: { model: string; rarity: Rarity }[] }
export const RESCUE_SPOTS: RescueSpot[] = [
  { id: 'suburbs', name: 'Suburbs', icon: '🏘', unlockLevel: 1, cost: 500, cars: [
    { model: 'pip', rarity: 'common' }, { model: 'civic', rarity: 'common' }, { model: 'bug', rarity: 'common' },
    { model: 'woodie', rarity: 'scarce' }, { model: 'trail', rarity: 'scarce' }, { model: 'miata', rarity: 'rare' },
  ] },
  { id: 'farm', name: 'Countryside', icon: '🌾', unlockLevel: 3, cost: 1500, cars: [
    { model: 'bug', rarity: 'common' }, { model: 'trail', rarity: 'common' }, { model: 'hauler', rarity: 'common' },
    { model: 'woodie', rarity: 'scarce' }, { model: 'buggy', rarity: 'scarce' }, { model: 'stallion', rarity: 'rare' },
  ] },
  { id: 'downtown', name: 'Downtown', icon: '🏙', unlockLevel: 5, cost: 3500, cars: [
    { model: 'civic', rarity: 'common' }, { model: 'cruiser', rarity: 'common' }, { model: 'rally', rarity: 'scarce' },
    { model: 'bandit', rarity: 'scarce' }, { model: 'stallion', rarity: 'scarce' }, { model: 'vette', rarity: 'rare' },
  ] },
  { id: 'desert', name: 'Desert', icon: '🌵', unlockLevel: 7, cost: 7000, cars: [
    { model: 'buggy', rarity: 'common' }, { model: 'hauler', rarity: 'common' }, { model: 'bandit', rarity: 'scarce' },
    { model: 'charger', rarity: 'scarce' }, { model: 'lemans', rarity: 'rare' }, { model: 'gtr', rarity: 'rare' },
  ] },
  { id: 'track', name: 'Old Race Track', icon: '🏁', unlockLevel: 10, cost: 15000, cars: [
    { model: 'rally', rarity: 'common' }, { model: 'vette', rarity: 'common' }, { model: 'charger', rarity: 'scarce' },
    { model: 'lemans', rarity: 'scarce' }, { model: 'gullwing', rarity: 'rare' }, { model: 'hyper', rarity: 'rare' },
  ] },
]
export const RESCUE_PINS = 8
export const STORAGE_MAX = 6
export const restoreCost = (car: CarDef) => Math.max(200, Math.round((car.price + (car.bucks ?? 0) * 1000) * 0.25 / 10) * 10)
export const rushBucks = (msLeft: number) => Math.max(1, Math.ceil(msLeft / 1800000))

// Same idea as buildingDef: a car from a newer build drives as the starter car
// under a placeholder name, can't be sold or scrapped, and keeps its real id.
const parkedCars = new Map<string, CarDef>()
function parkedCar(id: string): CarDef {
  let c = parkedCars.get(id)
  if (!c) {
    c = { ...CARS[0], id, name: 'Coming Soon', price: 0, bucks: undefined, skill: undefined, likes: [], parked: true }
    parkedCars.set(id, c)
  }
  return c
}
export const carDef = (id: string): CarDef => CARS.find((c) => c.id === id) ?? parkedCar(id)

// Drivers: each business can have one of your cars assigned to it, and a car
// works at one business at a time. A driver adds 10% to the coins every job pays,
// or 25% at a business it loves. A car with a flat or out of gas earns nothing
// extra until it's fixed. Saves keep the car's uid as `car` on the placed building.
export const DRIVER_BONUS = 0.1
export const FAVORITE_BONUS = 0.25
export const takesDriver = (d: BuildingDef) => !d.parked && !!d.jobSeconds && d.kind !== 'obstacle'
export const loves = (car: CarDef, buildingId: string) => car.likes.includes(buildingId)
export const driverBonus = (car: CarDef, buildingId: string) => (loves(car, buildingId) ? FAVORITE_BONUS : DRIVER_BONUS)
// Coins a job pays with this driver (null: no working driver).
export const driverPayout = (d: BuildingDef, level: number, car: CarDef | null) =>
  Math.round(upgradePayout(d, level) * (1 + (car ? driverBonus(car, d.id) : 0)))

export type UpgradeSlot = 'engine' | 'turbo' | 'tires' | 'weight'
export const UPGRADE_SLOTS: { id: UpgradeSlot; name: string }[] = [
  { id: 'engine', name: 'Engine' },
  { id: 'turbo', name: 'Turbo' },
  { id: 'tires', name: 'Tires' },
  { id: 'weight', name: 'Weight Reduction' },
]
export const MAX_UPGRADE = 5

export const upgradeCost = (car: CarDef, level: number) => ({
  coins: Math.round((car.price + (car.bucks ?? 0) * 1000) * 0.15 * (level + 1) + 200),
  parts: 2 + level * 3,
})

// Performance index: what races are decided on (plus the driver's shifting).
export const performance = (car: CarDef, up: Record<UpgradeSlot, number>) => {
  const power = car.power + up.engine * 4 + up.turbo * 3
  const grip = car.grip + up.tires * 4
  const weight = Math.max(5, car.weight - up.weight * 4)
  return Math.round(power * 0.6 + grip * 0.3 + (100 - weight) * 0.1)
}

// XP needed to go from `level` to `level + 1`.
export const xpToNext = (level: number) => Math.round(80 * Math.pow(level, 1.6))

export const baseFuelCap = (level: number) => 15 + level * 2
export const FUEL_REGEN_SECONDS = 60
export const RACE_FUEL = 3
// Bucks to fill the tank to the cap in one go.
export const REFILL_BUCKS = 3

// Grand Prix: six races in a row against tougher and tougher rivals. Win
// all six for a mystery box car. Each repeat of a series gets harder.
export type GpSeries = { id: string; name: string; unlockLevel: number; minCars: number; basePi: number; step: number; prize: number; box: string[]; rivals: string[] }
export const GP_SERIES: GpSeries[] = [
  { id: 'rookie', name: 'Rookie Cup', unlockLevel: 2, minCars: 3, basePi: 22, step: 3, prize: 200, box: ['trail', 'miata', 'woodie', 'cruiser'], rivals: ['Dusty Dan', 'Penny Pistons', 'Lugnut Lou', 'Speedy Sue', 'Gearhead Gus', 'Champ Chuck'] },
  { id: 'street', name: 'Street Kings', unlockLevel: 5, minCars: 4, basePi: 40, step: 3, prize: 450, box: ['stallion', 'rally', 'buggy', 'bandit'], rivals: ['Nitro Nina', 'Torque Tony', 'Drift Dee', 'Boost Bo', 'Redline Rae', 'King Kurt'] },
  { id: 'pro', name: 'Pro Circuit', unlockLevel: 8, minCars: 5, basePi: 56, step: 3, prize: 900, box: ['vette', 'charger', 'lemans'], rivals: ['Apex Ava', 'Slick Sam', 'Turbo Tess', 'Clutch Cole', 'Vroom Val', 'Ace Axel'] },
  { id: 'legends', name: 'Legends Series', unlockLevel: 12, minCars: 6, basePi: 72, step: 3, prize: 1800, box: ['gtr', 'gullwing', 'hyper', 'lambo'], rivals: ['Ghost Rider', 'Lady Luck', 'The Baron', 'Silver Fox', 'Mad Max', 'The Legend'] },
]
export const GP_ROUNDS = 6
// Rival PI for a round; each completed run of the series adds 8%.
export const gpRivalPi = (s: GpSeries, round: number, clears: number) => Math.round((s.basePi + round * s.step) * (1 + clears * 0.08))
export const gpReward = (s: GpSeries, round: number) => s.prize + round * Math.round(s.prize / 4)

// Bank packs. Bigger packs carry a bigger bonus on top of the base rate of
// 5 bucks per dollar, plus extra coins and parts.
export type BucksPack = { id: string; name: string; price: number; bucks: number; bonus: number; coins?: number; parts?: number; tag?: string; art: string }
export const BUCKS_PACKS: BucksPack[] = [
  { id: 'handful', name: 'Handful of Bucks', price: 1.99, bucks: 10, bonus: 0, art: '💵' },
  { id: 'stack', name: 'Stack of Bucks', price: 4.99, bucks: 25, bonus: 3, art: '💵💵' },
  { id: 'bag', name: 'Bag of Bucks', price: 9.99, bucks: 50, bonus: 10, coins: 2500, tag: 'Most popular', art: '💰' },
  { id: 'vault', name: 'Vault of Bucks', price: 19.99, bucks: 100, bonus: 30, coins: 7500, parts: 25, art: '🏦' },
  { id: 'truck', name: 'Truckload of Bucks', price: 49.99, bucks: 250, bonus: 100, coins: 25000, parts: 75, art: '🚚' },
  { id: 'tanker', name: 'Golden Tanker', price: 99.99, bucks: 500, bonus: 250, coins: 60000, parts: 200, tag: 'Best value', art: '🏆' },
]

export type StatKey = 'rusty' | 'jobs' | 'carsBought' | 'upgrades' | 'racesWon' | 'built' | 'roads' | 'coinsEarned' | 'flatsFixed' | 'rescued' | 'searches' | 'gpWins'

export type GoalDef = { id: string; text: string; stat: StatKey; target: number; coins: number; xp: number; bucks?: number }

// Played in order; the first three unclaimed goals are active at once.
export const GOALS: GoalDef[] = [
  { id: 'g0', text: "Build Rusty's Rescue", stat: 'rusty', target: 1, coins: 200, xp: 20 },
  { id: 'r1', text: "Search for cars at Rusty's", stat: 'searches', target: 1, coins: 150, xp: 15 },
  { id: 'r2', text: 'Restore a rescued car', stat: 'rescued', target: 1, coins: 300, xp: 25, bucks: 1 },
  { id: 'g1', text: 'Collect from 3 businesses', stat: 'jobs', target: 3, coins: 150, xp: 15 },
  { id: 'g2', text: 'Lay 5 road tiles', stat: 'roads', target: 5, coins: 100, xp: 10 },
  { id: 'g3', text: 'Get a new car', stat: 'carsBought', target: 1, coins: 300, xp: 25 },
  { id: 'g4', text: 'Win a drag race', stat: 'racesWon', target: 1, coins: 250, xp: 20 },
  { id: 'g5', text: 'Upgrade a car part', stat: 'upgrades', target: 1, coins: 200, xp: 20 },
  { id: 'g6', text: 'Place 2 new buildings', stat: 'built', target: 2, coins: 300, xp: 25 },
  { id: 'g7', text: 'Fix a flat tire', stat: 'flatsFixed', target: 1, coins: 150, xp: 15 },
  { id: 'g8', text: 'Collect from 15 businesses', stat: 'jobs', target: 15, coins: 500, xp: 40, bucks: 1 },
  { id: 'g9', text: 'Earn 5,000 coins', stat: 'coinsEarned', target: 5000, coins: 600, xp: 50 },
  { id: 'g10', text: 'Win 5 drag races', stat: 'racesWon', target: 5, coins: 800, xp: 60, bucks: 1 },
  { id: 'g11', text: 'Get 3 new cars', stat: 'carsBought', target: 3, coins: 1000, xp: 70 },
  { id: 'r3', text: 'Restore 5 rescued cars', stat: 'rescued', target: 5, coins: 3000, xp: 200, bucks: 2 },
  { id: 'gp1', text: 'Win a Grand Prix series', stat: 'gpWins', target: 1, coins: 2000, xp: 150, bucks: 2 },
  { id: 'g12', text: 'Do 10 upgrades', stat: 'upgrades', target: 10, coins: 1200, xp: 80, bucks: 2 },
  { id: 'g13', text: 'Place 10 new buildings', stat: 'built', target: 10, coins: 1500, xp: 100 },
  { id: 'g14', text: 'Collect from 60 businesses', stat: 'jobs', target: 60, coins: 2500, xp: 150, bucks: 2 },
  { id: 'g15', text: 'Earn 50,000 coins', stat: 'coinsEarned', target: 50000, coins: 5000, xp: 250, bucks: 3 },
  { id: 'g16', text: 'Win 25 drag races', stat: 'racesWon', target: 25, coins: 5000, xp: 250, bucks: 3 },
]

// Daily login bonus by streak day (repeats the last entry).
export const DAILY_BONUS = [
  { coins: 200 },
  { coins: 400 },
  { coins: 600, fuel: 5 },
  { coins: 800, parts: 5 },
  { coins: 1200, bucks: 1 },
]

export const FLAT_CHANCE = 0.2
export const LOW_FUEL_CHANCE = 0.15
// What your own Tire Shop or Gas Station earns for servicing a stranded car.
export const servicePay = (level: number, kind: 'tires' | 'gas') => (kind === 'tires' ? 60 + level * 15 : 40 + level * 10)
export const gasCanCost = (level: number) => 30 + level * 15
export const flatFixCost = (level: number) => 50 + level * 25

export const PAINTS: { color: string; name: string; bucks?: number }[] = [
  { color: '#e53935', name: 'Fire Red' }, { color: '#fb8c00', name: 'Sunset' }, { color: '#fdd835', name: 'Taxi' },
  { color: '#43a047', name: 'Racing Green' }, { color: '#00acc1', name: 'Lagoon' }, { color: '#1e88e5', name: 'Royal Blue' },
  { color: '#3949ab', name: 'Midnight' }, { color: '#8e24aa', name: 'Grape' }, { color: '#ec407a', name: 'Bubblegum' },
  { color: '#fafafa', name: 'Pearl' }, { color: '#9e9e9e', name: 'Silver' }, { color: '#212121', name: 'Jet Black' },
  { color: '#6d4c41', name: 'Mocha' },
  { color: '#ffd700', name: 'Gold Flake', bucks: 1 }, { color: '#76ff03', name: 'Neon Lime', bucks: 1 },
  { color: '#ff00e5', name: 'Hot Magenta', bucks: 1 }, { color: '#00e5ff', name: 'Ice Neon', bucks: 1 },
]
export const STRIPES = [null, '#fafafa', '#212121', '#e53935', '#fdd835', '#1e88e5']
export const PAINT_COST = 150
export const STRIPE_COST = 100

// Garage power: the combined PI of a player's five best cars.
export const POWER_CARS = 5
export const garagePower = (cars: { model: string; upgrades: Record<UpgradeSlot, number> }[]) =>
  cars
    .map((c) => performance(carDef(c.model), c.upgrades))
    .sort((a, b) => b - a)
    .slice(0, POWER_CARS)
    .reduce((a, b) => a + b, 0)

export const CLAN_COST = 2000
export const CLAN_CAP = 20
export const CLAN_EMBLEMS = ['🏁', '🔥', '⚡', '🦅', '🐺', '💀', '👑', '🚀', '🐉', '⭐', '🏎️', '🛞']
export const CLAN_COLORS = ['#ff7043', '#e53935', '#8e24aa', '#1e88e5', '#00897b', '#43a047', '#fdd835', '#546e7a']
