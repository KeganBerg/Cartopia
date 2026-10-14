// Static game data: buildings, cars and the progression curve.

import { growthName } from './growth'
import { isNight } from './clock'
import { NITRO_GEAR, OIL_SECONDS } from './race'

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
  // Listed under Services in the Shop (fire and police stations).
  service?: boolean
  // A small decoration townspeople can't stroll across (it fills its tile edge to edge).
  solid?: boolean
  // Only open at night (the nightclub): jobs can only start after dark.
  nightOnly?: boolean
  // Stand-in for a building this build doesn't know (see buildingDef).
  parked?: boolean
  // Sold only while this event runs (see EVENTS). Ones already placed stay.
  event?: EventId
}

// Buildings that open up a feature rather than just earning coins. The Shop lists them first
// and one-time tips nudge new players toward them.
export const FEATURES: Record<string, string> = {
  rescue: 'find old cars and restore them',
  tires: 'fixes flat tires around town',
  gas: 'refuels stranded cars and holds more fuel',
  crew: 'join a crew and race together',
  arcade: 'mini-games with prizes',
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
  { id: 'donut', name: 'Donut Shop', kind: 'business', w: 1, h: 1, price: 1000, unlockLevel: 2, jobSeconds: 90, fuelCost: 2, payout: 150, xp: 12, color: '#f48fb1', roof: '#fff8e1', sign: 'DONUTS', prop: 'donut' },
  { id: 'burger', name: 'Burger Joint', kind: 'business', w: 1, h: 1, price: 1400, unlockLevel: 2, jobSeconds: 120, fuelCost: 2, payout: 200, xp: 15, color: '#ffb300', roof: '#d84315', sign: 'BURGERS', prop: 'burger' },
  { id: 'icecream', name: 'Ice Cream Stand', kind: 'business', w: 1, h: 1, price: 2000, unlockLevel: 3, jobSeconds: 150, fuelCost: 2, payout: 230, xp: 18, color: '#b3e5fc', roof: '#f8bbd0', sign: 'ICE CREAM', prop: 'cone' },
  { id: 'carwash', name: 'Car Wash', kind: 'business', w: 2, h: 1, price: 2300, unlockLevel: 3, jobSeconds: 180, fuelCost: 3, payout: 340, xp: 25, color: '#4fc3f7', roof: '#e1f5fe', sign: 'CAR WASH' },
  { id: 'diner', name: 'Diner', kind: 'business', w: 2, h: 1, price: 4600, unlockLevel: 4, jobSeconds: 300, fuelCost: 4, payout: 600, xp: 40, color: '#90caf9', roof: '#ef5350', sign: 'DINER' },
  { id: 'tires', name: 'Tire Shop', kind: 'parts', w: 1, h: 1, price: 2300, unlockLevel: 2, jobSeconds: 240, fuelCost: 3, payout: 100, partsPayout: 6, xp: 20, color: '#455a64', roof: '#263238', sign: 'TIRES', prop: 'tire' },
  { id: 'bowling', name: 'Bowling Alley', kind: 'business', w: 2, h: 1, price: 6700, unlockLevel: 5, jobSeconds: 420, fuelCost: 4, payout: 760, xp: 55, color: '#7e57c2', roof: '#ede7f6', sign: 'BOWLING', prop: 'pin' },
  { id: 'motel', name: 'Motel', kind: 'business', w: 2, h: 1, price: 9600, unlockLevel: 6, jobSeconds: 720, fuelCost: 5, payout: 1050, xp: 70, color: '#ffe0b2', roof: '#00897b', sign: 'MOTEL' },
  { id: 'tuner', name: 'Tuner Shop', kind: 'parts', w: 2, h: 1, price: 15200, unlockLevel: 7, jobSeconds: 600, fuelCost: 5, payout: 280, partsPayout: 25, xp: 70, color: '#212121', roof: '#ff3d00', sign: 'TUNER' },
  { id: 'stadium', name: 'Speedway', kind: 'business', w: 2, h: 2, price: 40000, unlockLevel: 16, jobSeconds: 1800, fuelCost: 10, payout: 4200, xp: 300, color: '#eceff1', roof: '#c62828', sign: 'SPEEDWAY' },
  { id: 'cinema', name: 'Drive-In', kind: 'business', w: 2, h: 2, price: 10500, unlockLevel: 6, jobSeconds: 600, fuelCost: 6, payout: 1120, xp: 80, color: '#8d6e63', roof: '#3e2723', sign: 'DRIVE-IN', prop: 'popcorn' },
  // Second wave: more food, car care and town services, filling the gaps
  // between the early shops and the Speedway and reaching past level 10.
  { id: 'coffee', name: 'Coffee Corner', kind: 'business', w: 1, h: 1, price: 800, unlockLevel: 2, jobSeconds: 60, fuelCost: 1, payout: 100, xp: 8, color: '#8d6e63', roof: '#2e7d32', sign: 'COFFEE' },
  { id: 'tacos', name: 'Taco Truck', kind: 'business', w: 1, h: 1, price: 1700, unlockLevel: 3, jobSeconds: 120, fuelCost: 2, payout: 210, xp: 16, color: '#fafafa', roof: '#ff7043', sign: 'TACOS' },
  { id: 'lube', name: 'Lube & Go', kind: 'parts', w: 1, h: 1, price: 3800, unlockLevel: 4, jobSeconds: 300, fuelCost: 3, payout: 100, partsPayout: 8, xp: 25, color: '#eceff1', roof: '#ffb300', sign: 'LUBE & GO' },
  { id: 'arcade', name: 'Pixel Palace Arcade', kind: 'business', w: 1, h: 1, price: 5800, unlockLevel: 5, jobSeconds: 360, fuelCost: 3, payout: 640, xp: 45, color: '#4527a0', roof: '#ec407a', sign: 'ARCADE' },
  { id: 'bodyshop', name: 'Paint & Body Shop', kind: 'business', w: 2, h: 1, price: 11400, unlockLevel: 6, jobSeconds: 600, fuelCost: 5, payout: 1010, xp: 75, color: '#90a4ae', roof: '#263238', sign: 'PAINT & BODY' },
  { id: 'market', name: 'Fresh Mart', kind: 'business', w: 2, h: 1, price: 19000, unlockLevel: 12, jobSeconds: 900, fuelCost: 6, payout: 1680, xp: 110, color: '#fff8e1', roof: '#2e7d32', sign: 'FRESH MART' },
  { id: 'firehouse', name: 'Fire Station', kind: 'business', service: true, w: 2, h: 1, price: 24000, unlockLevel: 14, jobSeconds: 1200, fuelCost: 7, payout: 2380, xp: 150, color: '#c62828', roof: '#37474f', sign: 'FIRE STATION' },
  { id: 'police', name: 'Police Station', kind: 'business', service: true, w: 2, h: 1, price: 32000, unlockLevel: 19, jobSeconds: 1500, fuelCost: 8, payout: 3150, xp: 200, color: '#cfd8dc', roof: '#1a237e', sign: 'POLICE' },
  { id: 'parkade', name: 'Parking Garage', kind: 'business', w: 2, h: 2, price: 60000, unlockLevel: 22, jobSeconds: 2400, fuelCost: 12, payout: 6160, xp: 380, color: '#bdbdbd', roof: '#1565c0', sign: 'PARKING' },
  // Only open after dark: neon on at dusk, a line at the door and a rooftop dance floor.
  { id: 'club', name: 'Neon Owl Nightclub', kind: 'business', nightOnly: true, w: 2, h: 1, price: 8800, unlockLevel: 6, jobSeconds: 300, fuelCost: 4, payout: 750, xp: 60, color: '#1a1035', roof: '#d500f9', sign: 'NEON OWL' },
  { id: 'parts', name: 'Parts Depot', kind: 'parts', w: 2, h: 1, price: 8000, unlockLevel: 5, jobSeconds: 480, fuelCost: 4, payout: 160, partsPayout: 15, xp: 45, color: '#1565c0', roof: '#bbdefb', sign: 'PARTS' },
  // Offices, heli pad and hospital: the big-town end of the ladder, from a
  // low-rise business park at 10 up to a glass tower in the 30s.
  { id: 'offices', name: 'Business Park', kind: 'business', w: 2, h: 1, price: 16500, unlockLevel: 10, jobSeconds: 900, fuelCost: 6, payout: 1500, xp: 100, color: '#d7ccc8', roof: '#455a64', sign: 'BUSINESS PARK' },
  { id: 'hospital', name: 'Mercy General Hospital', kind: 'business', service: true, w: 2, h: 2, price: 48000, unlockLevel: 18, jobSeconds: 1800, fuelCost: 10, payout: 4000, xp: 280, color: '#eceff1', roof: '#c62828', sign: 'HOSPITAL' },
  { id: 'hq', name: 'Corporate HQ', kind: 'business', w: 2, h: 1, price: 82000, unlockLevel: 24, jobSeconds: 2700, fuelCost: 12, payout: 6250, xp: 440, color: '#90a4ae', roof: '#1e3a5f', sign: 'APEXCORP' },
  { id: 'helipad', name: 'Skyhook Heliport', kind: 'business', w: 2, h: 2, price: 115000, unlockLevel: 28, jobSeconds: 3000, fuelCost: 14, payout: 7850, xp: 520, color: '#cfd8dc', roof: '#ff6f00', sign: 'HELIPORT' },
  { id: 'glasstower', name: 'Glass Tower', kind: 'business', w: 2, h: 2, price: 185000, unlockLevel: 32, jobSeconds: 3600, fuelCost: 16, payout: 9600, xp: 700, color: '#80cbc4', roof: '#263238', sign: 'HORIZON' },
  // Schools, university and driving academy: big late-game jobs that keep the
  // long climb to level 40 stocked. The academy's students earn less but learn
  // fast (more XP per fuel); the university is one campus per town.
  { id: 'academy', name: 'Driving Academy', kind: 'business', w: 2, h: 2, price: 16000, unlockLevel: 9, jobSeconds: 900, fuelCost: 6, payout: 1380, xp: 140, color: '#eceff1', roof: '#ff6f00', sign: 'DRIVING ACADEMY' },
  { id: 'school', name: 'Elementary School', kind: 'business', w: 2, h: 2, price: 48000, unlockLevel: 17, jobSeconds: 2100, fuelCost: 10, payout: 4300, xp: 300, color: '#c1694f', roof: '#1565c0', sign: 'ELEMENTARY' },
  { id: 'highschool', name: 'High School', kind: 'business', w: 3, h: 2, price: 110000, unlockLevel: 25, jobSeconds: 2700, fuelCost: 13, payout: 7400, xp: 430, color: '#a1887f', roof: '#2e7d32', sign: 'HIGH SCHOOL' },
  { id: 'university', name: 'Ridgemont University', kind: 'business', w: 3, h: 3, price: 240000, unlockLevel: 32, unique: true, jobSeconds: 3600, fuelCost: 16, payout: 11000, xp: 560, color: '#d7ccc8', roof: '#6a1b9a', sign: 'RIDGEMONT UNIVERSITY' },

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
  { id: 'pine', name: 'Pine Tree', kind: 'decor', w: 1, h: 1, price: 60, unlockLevel: 1, color: '#2e7d32', roof: '#6d4c41' },
  { id: 'hedge', name: 'Hedge', kind: 'decor', solid: true, w: 1, h: 1, price: 40, unlockLevel: 1, color: '#33691e', roof: '#558b2f' },
  { id: 'fence', name: 'Picket Fence', kind: 'decor', solid: true, w: 1, h: 1, price: 30, unlockLevel: 1, color: '#fafafa', roof: '#eceff1' },
  { id: 'picnic', name: 'Picnic Table', kind: 'decor', w: 1, h: 1, price: 90, unlockLevel: 2, color: '#a1887f', roof: '#e53935' },
  { id: 'busstop', name: 'Bus Stop', kind: 'decor', w: 1, h: 1, price: 200, unlockLevel: 2, color: '#90caf9', roof: '#37474f' },
  { id: 'hotdog', name: 'Hot Dog Cart', kind: 'decor', w: 1, h: 1, price: 350, unlockLevel: 3, color: '#eceff1', roof: '#fdd835' },
  { id: 'flagpole', name: 'Flag Pole', kind: 'decor', w: 1, h: 1, price: 300, unlockLevel: 3, color: '#2e7d32', roof: '#eceff1' },
  { id: 'arch', name: 'Finish Line Arch', kind: 'decor', solid: true, w: 1, h: 1, price: 0, bucks: 2, unlockLevel: 4, color: '#212121', roof: '#e53935' },
  { id: 'playground', name: 'Playground', kind: 'decor', w: 2, h: 2, price: 1800, unlockLevel: 5, color: '#ef9a9a', roof: '#1e88e5' },
  { id: 'gazebo', name: 'Gazebo', kind: 'decor', w: 1, h: 1, price: 1200, unlockLevel: 6, color: '#fafafa', roof: '#2e7d32' },
  { id: 'clocktower', name: 'Clock Tower', kind: 'decor', w: 1, h: 1, price: 3500, unlockLevel: 8, color: '#b0796b', roof: '#37474f' },
  // Edge of town: trailer homes (a cheap home the town's beaters keep driving
  // back to), a scrapyard that strips wrecks for parts, and bigger park styles.
  { id: 'trailer', name: 'Trailer Home', kind: 'house', w: 1, h: 1, price: 200, unlockLevel: 2, color: '#e0f2f1', roof: '#b0bec5' },
  { id: 'junkyard', name: 'Junkyard', kind: 'parts', w: 2, h: 2, price: 21000, unlockLevel: 9, jobSeconds: 900, fuelCost: 6, payout: 300, partsPayout: 32, xp: 105, color: '#8d6e63', roof: '#ffb300', sign: 'JUNKYARD' },
  { id: 'dogpark', name: 'Dog Park', kind: 'decor', w: 2, h: 2, price: 1600, unlockLevel: 4, color: '#7cb342', roof: '#8d6e63' },
  { id: 'skatepark', name: 'Skate Park', kind: 'decor', w: 2, h: 2, price: 2400, unlockLevel: 6, color: '#b0bec5', roof: '#ff7043' },
  { id: 'koi', name: 'Koi Garden', kind: 'decor', w: 2, h: 2, price: 3000, unlockLevel: 7, color: '#4db6ac', roof: '#c62828' },
  { id: 'garden', name: 'Botanical Garden', kind: 'decor', w: 2, h: 2, price: 4800, unlockLevel: 10, color: '#e8f5e9', roof: '#2e7d32' },
  // Spooky Season decorations: in the Shop only during the event.
  { id: 'pumpkins', name: 'Pumpkin Patch', kind: 'decor', w: 1, h: 1, price: 250, unlockLevel: 1, color: '#ef6c00', roof: '#5d4037', event: 'spooky' },
  { id: 'scarecrow', name: 'Scarecrow', kind: 'decor', w: 1, h: 1, price: 450, unlockLevel: 1, color: '#c8a165', roof: '#6d4c41', event: 'spooky' },
  { id: 'graves', name: 'Spooky Graveyard', kind: 'decor', w: 1, h: 1, price: 700, unlockLevel: 2, color: '#9e9e9e', roof: '#424242', event: 'spooky' },
  { id: 'deadtree', name: 'Haunted Tree', kind: 'decor', w: 1, h: 1, price: 1200, unlockLevel: 3, color: '#4e342e', roof: '#ff9800', event: 'spooky' },
]

// Limited-time events, by East Coast calendar date (from inclusive, to exclusive, as MM-DD).
// ?event=<id> switches one on for testing.
export type EventId = 'spooky'
export type GameEvent = { id: EventId; name: string; icon: string; from: string; to: string }
export const EVENTS: GameEvent[] = [{ id: 'spooky', name: 'Spooky Season', icon: '🎃', from: '10-01', to: '11-01' }]
function eastCoastDay(now: number) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now))
    return `${p.find((x) => x.type === 'month')!.value}-${p.find((x) => x.type === 'day')!.value}`
  } catch {
    return new Date(now).toISOString().slice(5, 10)
  }
}
export function activeEvent(now = Date.now()): GameEvent | null {
  const pin = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('event') : null
  if (pin) return EVENTS.find((e) => e.id === pin) ?? null
  const day = eastCoastDay(now)
  return EVENTS.find((e) => day >= e.from && day < e.to) ?? null
}
// Midnight on the East Coast when the event ends, roughly (good enough for a countdown).
export function eventEndsAt(e: GameEvent, now = Date.now()) {
  const year = new Date(now).getUTCFullYear()
  const [m, d] = e.to.split('-').map(Number)
  return Date.UTC(year, m - 1, d, 4)
}

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

// Building upgrades: businesses, parts makers, gas stations and houses go from
// level 1 to 10. Each level pays more per job and finishes jobs sooner (a gas
// station holds more fuel, a house grows into apartments and then a tower and
// fits more residents). Saves keep the level as `level` on the placed
// building; a missing level is level 1.
export const MAX_BUILDING_LEVEL = 10
// Decor that grows in place (level 1-5), purely for looks and tourists: gardens and parks
// fill out, statues and fountains get a grand plinth, the Clock Tower adds floors.
export type DecorGrowth = 'garden' | 'statue' | 'tower'
export const DECOR_GROWTH: Record<string, DecorGrowth> = {
  garden: 'garden', koi: 'garden', pond: 'garden', dogpark: 'garden', statue: 'statue', fountain: 'statue', clocktower: 'tower',
}
export const MAX_DECOR_LEVEL = 5
export const decorGrows = (d: BuildingDef) => !d.parked && d.kind === 'decor' && d.id in DECOR_GROWTH
export const maxLevel = (d: BuildingDef) => (decorGrows(d) ? MAX_DECOR_LEVEL : MAX_BUILDING_LEVEL)
// Anything placed can take a colour theme (game/cityLook.ts), except obstacles waiting to be cleared.
export const themable = (d: BuildingDef) => !d.parked && d.kind !== 'obstacle'
export const upgradable = (d: BuildingDef) =>
  !d.parked && ((!!d.jobSeconds && d.kind !== 'obstacle') || !!d.fuelCap || d.kind === 'house' || decorGrows(d))
export const buildingLevel = (b: { level?: number }) =>
  Math.min(MAX_BUILDING_LEVEL, Math.max(1, Math.floor(Number(b.level) || 1)))
// The level a running job pays at: locked when it started (older saves: the current level).
export const jobLevel = (b: { level?: number; jobLevel?: number }) =>
  b.jobLevel == null ? buildingLevel(b) : buildingLevel({ level: Math.min(b.jobLevel, buildingLevel(b)) })

// +10% coins and parts and +5% XP per level, 8% shorter jobs (rounded to 5s).
export const upgradePayout = (d: BuildingDef, level: number) => Math.round((d.payout ?? 0) * (1 + 0.1 * (level - 1)))
export const upgradePartsPayout = (d: BuildingDef, level: number) => Math.round((d.partsPayout ?? 0) * (1 + 0.1 * (level - 1)))
export const upgradeXp = (d: BuildingDef, level: number) => Math.round((d.xp ?? 0) * (1 + 0.05 * (level - 1)))
export const upgradeJobSeconds = (d: BuildingDef, level: number) =>
  d.jobSeconds ? Math.max(10, Math.round((d.jobSeconds * Math.pow(0.92, level - 1)) / 5) * 5) : 0
// A brand new town's first few jobs finish in 25 seconds, so the first coins come fast.
// Payouts don't change: the server guard banks coins over time, not per job.
export const QUICK_JOBS = 6
export const QUICK_JOB_SECONDS = 25
export const jobSeconds = (d: BuildingDef, level: number, jobsDone: number) =>
  jobsDone < QUICK_JOBS ? Math.min(QUICK_JOB_SECONDS, upgradeJobSeconds(d, level)) : upgradeJobSeconds(d, level)
// Max fuel a building adds: a gas station's tank grows 2 a level; every house
// level above 1 adds 1 (residents chip in with their own gas cans).
export const upgradeFuelCap = (d: BuildingDef, level: number) =>
  d.fuelCap ? d.fuelCap + 2 * (level - 1) : d.kind === 'house' ? level - 1 : 0

// Cost to go from `level` to `level + 1`: 75% of the build price, 50% more each
// level, plus parts from level 4 up. Houses are cheap to build but end up as
// skyscrapers, so theirs start at $300 and grow 55% a level. Decor bought with gems (the
// Golden Car Statue) counts each gem as $1,000 of build price.
const upgradeBase = (d: BuildingDef) => (d.price || (decorGrows(d) ? (d.bucks ?? 0) * 1000 : 0))
export const buildingUpgradeCost = (d: BuildingDef, level: number) => ({
  coins: d.kind === 'house'
    ? Math.round((300 * Math.pow(1.55, level - 1)) / 50) * 50
    : Math.max(100, Math.round((upgradeBase(d) * 0.75 * Math.pow(1.5, level - 1)) / 50) * 50),
  parts: level >= 4 ? (level - 2) * 2 : 0,
})

// Houses: a nicer house at levels 1-3, an apartment block at 4-6 and an
// apartment tower at 7-10, with more residents walking the streets each level.
export type HomeStage = 'house' | 'apartments' | 'tower'
export const homeStage = (level: number): HomeStage => (level >= 7 ? 'tower' : level >= 4 ? 'apartments' : 'house')
const HOME_NAMES: Record<HomeStage, string> = { house: 'House', apartments: 'Apartments', tower: 'Sky Tower' }
// Trailer homes stay low: a single-wide, then a double-wide with a deck, then a little trailer court.
const TRAILER_NAMES: Record<HomeStage, string> = { house: 'Trailer Home', apartments: 'Double-Wide', tower: 'Trailer Court' }
const RESIDENTS = [2, 3, 4, 6, 8, 10, 13, 16, 20, 24]
export const houseResidents = (level: number) => RESIDENTS[Math.min(MAX_BUILDING_LEVEL, Math.max(1, level)) - 1]
// What a building is called at a level: homes and growing businesses (game/growth.ts) change name.
export const levelName = (d: BuildingDef, level: number) =>
  d.kind !== 'house' ? growthName(d.id, d.name, level) : (d.id === 'trailer' ? TRAILER_NAMES : HOME_NAMES)[homeStage(level)]
export const buildingUpgradeXp = (level: number) => 10 + level * 5
// Extra model height an upgraded building gains, on the same lot.
export const levelLift = (level = 1) => 0.26 * (Math.min(MAX_BUILDING_LEVEL, Math.max(1, level)) - 1)

export type Body = 'compact' | 'sedan' | 'sports' | 'muscle' | 'truck' | 'super' | 'bubble' | 'wagon' | 'wedge' | 'roadster' | 'rally' | 'classic' | 'offroad' | 'coupe' | 'widebody' | 'tank' | 'scooter' | 'chopper' | 'sportbike'
  | 'hatch' | 'van' | 'suv' | 'ev' | 'luxury' | 'formula' | 'bus' | 'tusker' | 'dogvan' | 'rearengine' | 'longnose' | 'prototype'
  | 'scissor' | 'horseshoe' | 'teardrop' | 'icecream' | 'monster' | 'parcel'
  | 'pontoon' | 'stepnose' | 'restomuscle'
// Two-wheelers: drawn as motorcycles with a rider, and only take exhaust and rim mods.
export const BIKES: Body[] = ['scooter', 'chopper', 'sportbike']
export const isBike = (body: Body) => BIKES.includes(body)

export type SkillId = 'launch' | 'nitro' | 'slipstream' | 'smooth' | 'oil' | 'torque' | 'freeze'
export const SKILLS: Record<SkillId, { name: string; icon: string; text: string }> = {
  launch: { name: 'Hole Shot', icon: '🚀', text: '20% faster off the line in first gear' },
  nitro: { name: 'Nitro Burst', icon: '🔥', text: '15% more power in the top two gears' },
  slipstream: { name: 'Slipstream', icon: '💨', text: '8% more speed while chasing the leader' },
  smooth: { name: 'Smooth Shifter', icon: '🎯', text: 'Good shifts count as perfect' },
  oil: { name: 'Oil Slick', icon: '🛢', text: 'Rivals lose 10% grip for the first 4 seconds' },
  torque: { name: 'Low-End Torque', icon: '🐂', text: '10% more power in first and second gear' },
  freeze: { name: 'Brain Freeze', icon: '🍦', text: 'Rivals are 10% slower in second gear' },
}

// What a skill does in a drag race, as speed multipliers. Rivals use their car's
// skill too. `me` is the racer with the skill, `them` the other one.
export type SkillRacer = { gear: number; dist: number }
// Boost to the skill owner's own car right now.
export function skillBoost(sk: SkillId | undefined, me: SkillRacer, them: SkillRacer): number {
  if (sk === 'launch' && me.gear === 0) return 1.2
  if (sk === 'nitro' && me.gear >= NITRO_GEAR) return 1.15
  if (sk === 'slipstream' && me.dist > 0 && me.dist < them.dist) return 1.08
  if (sk === 'torque' && me.gear <= 1) return 1.1
  return 1
}
// Slow-down the skill puts on the other car (t: seconds since the start).
export function skillDrag(sk: SkillId | undefined, them: SkillRacer, t: number): number {
  if (sk === 'oil' && t < OIL_SECONDS) return 0.9
  if (sk === 'freeze' && them.gear === 1) return 0.9
  return 1
}
// In a live race the other car runs on its owner's device, so slow-downs boost
// our own car by the same amount in the same window instead.
export function liveSkillBoost(sk: SkillId | undefined, me: SkillRacer, them: SkillRacer, t: number): number {
  if (sk === 'oil') return t < OIL_SECONDS ? 1.1 : 1
  if (sk === 'freeze') return me.gear === 1 ? 1.1 : 1
  return skillBoost(sk, me, them)
}
// A shift the driver timed "Good" counts as perfect with Smooth Shifter.
export const smoothShift = (sk: SkillId | undefined) => sk === 'smooth'

export type CarDef = {
  id: string
  name: string
  body: Body
  price: number
  bucks?: number
  unlockLevel: number
  // Classics that only turn up in Rusty's searches, never in the Showroom.
  rescueOnly?: boolean
  // Season track prize: only ever given by that season's last tier (season number).
  season?: number
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
  // Top-tier showroom car, flagged Legendary in the shop.
  legendary?: boolean
  // Resto-mod: never sold, never a whole-car crate prize; only built from its four crate
  // pieces (game/resto.ts). Its unlock level is when its pieces start dropping.
  secret?: boolean
}

// Parodies of real cars: the shapes and stats nod to the real thing, but the
// makers and model names are invented. Never use a real brand or model name, or
// a misspelling of one. Ids stay fixed so existing saves keep working.
// Stats follow each real car's relative performance.
export const CARS: CarDef[] = [
  { id: 'pip', name: 'Kipper Pocket', body: 'compact', price: 800, unlockLevel: 1, power: 18, grip: 36, weight: 24, skill: 'launch', likes: ['pizza', 'academy', 'market'], colors: ['#c62828', '#1b5e20', '#fafafa'] },
  { id: 'civic', name: 'Kazumi Commuter', body: 'sedan', price: 1500, unlockLevel: 1, power: 24, grip: 34, weight: 36, skill: 'slipstream', likes: ['pizza', 'diner', 'offices'], colors: ['#1e88e5', '#eeeeee', '#424242'] },
  { id: 'trail', name: 'Ironside Workhorse', body: 'truck', price: 3500, unlockLevel: 3, power: 41, grip: 29, weight: 74, skill: 'torque', likes: ['tires', 'parts', 'lube'], colors: ['#0d47a1', '#c62828', '#eceff1'] },
  { id: 'miata', name: 'Kazumi Zephyr', body: 'roadster', price: 7000, unlockLevel: 5, power: 32, grip: 54, weight: 22, skill: 'smooth', likes: ['icecream', 'cinema', 'arcade'], colors: ['#d32f2f', '#1e88e5', '#fafafa'] },
  { id: 'stallion', name: "Liberty Bore Horse '68", body: 'muscle', price: 14000, unlockLevel: 7, power: 52, grip: 34, weight: 54, skill: 'nitro', likes: ['burger', 'stadium', 'firehouse'], colors: ['#1b5e20', '#ff6f00', '#212121'] },
  { id: 'rally', name: 'Kodiak Gravel Rex', body: 'rally', price: 26000, unlockLevel: 10, power: 52, grip: 64, weight: 40, skill: 'smooth', likes: ['tires', 'tuner', 'bodyshop'], colors: ['#0d47a1', '#fafafa', '#ffd600'] },
  { id: 'vette', name: 'Liberty Sidewinder', body: 'sports', price: 55000, unlockLevel: 15, power: 66, grip: 54, weight: 38, skill: 'slipstream', likes: ['motel', 'stadium', 'police'], colors: ['#b71c1c', '#bdbdbd', '#ffd600'] },
  { id: 'charger', name: 'Liberty Brawler', body: 'muscle', price: 42000, unlockLevel: 13, power: 71, grip: 41, weight: 60, skill: 'nitro', likes: ['burger', 'highschool', 'lube'], colors: ['#212121', '#ff5722', '#6a1b9a'] },
  { id: 'hellcat', name: 'Liberty Hellhound 707', body: 'widebody', price: 80000, unlockLevel: 18, power: 80, grip: 46, weight: 62, skill: 'launch', likes: ['tuner', 'stadium', 'bodyshop'], colors: ['#c62828', '#7b1fa2', '#9ccc65'] },
  { id: 'gtr', name: 'Kazumi Ronin GT', body: 'coupe', price: 115000, unlockLevel: 22, power: 78, grip: 70, weight: 46, skill: 'smooth', likes: ['tuner', 'hq', 'arcade'], colors: ['#eceff1', '#263238', '#ff6d00'] },
  { id: 'tomahawk', name: 'Ironside Tomahawk', body: 'tank', price: 340000, unlockLevel: 36, legendary: true, power: 100, grip: 95, weight: 60, skill: 'launch', likes: ['stadium', 'police', 'firehouse'], colors: ['#556b2f', '#37474f', '#c9a227'] },
  { id: 'zippy', name: 'Kipper Zip 50', body: 'scooter', price: 2100, unlockLevel: 2, power: 21, grip: 37, weight: 8, skill: 'slipstream', likes: ['pizza', 'coffee', 'icecream'], colors: ['#4dd0e1', '#fdd835', '#f48fb1'] },
  { id: 'baron', name: 'Liberty Road Baron', body: 'chopper', price: 16000, unlockLevel: 7, power: 47, grip: 37, weight: 30, skill: 'nitro', likes: ['diner', 'burger', 'bowling'], colors: ['#212121', '#b71c1c', '#1565c0'] },
  { id: 'shinden', name: 'Kazumi Shinden RR', body: 'sportbike', price: 135000, unlockLevel: 24, power: 80, grip: 60, weight: 14, skill: 'launch', likes: ['tuner', 'stadium', 'arcade'], colors: ['#1565c0', '#eceff1', '#76ff03'] },
  { id: 'camper', name: 'Lakeside Sunrise Camper', body: 'van', price: 2800, unlockLevel: 2, power: 30, grip: 38, weight: 64, skill: 'slipstream', likes: ['icecream', 'tacos', 'motel'], colors: ['#ff8a65', '#4db6ac', '#fff59d'] },
  { id: 'hotshot', name: 'Kazumi Hot Shot RS', body: 'hatch', price: 7000, unlockLevel: 5, power: 36, grip: 50, weight: 26, skill: 'launch', likes: ['arcade', 'tuner', 'coffee'], colors: ['#eceff1', '#d32f2f', '#1e88e5'] },
  { id: 'ridgeback', name: 'Kodiak Ridgeback 4x4', body: 'suv', price: 10000, unlockLevel: 6, power: 45, grip: 47, weight: 62, skill: 'torque', likes: ['tires', 'parts', 'firehouse'], colors: ['#ff6f00', '#33691e', '#eceff1'] },
  { id: 'kitsune', name: 'Kazumi Kitsune Drift', body: 'coupe', price: 20000, unlockLevel: 9, power: 48, grip: 58, weight: 30, skill: 'smooth', likes: ['tuner', 'arcade', 'bodyshop'], colors: ['#fafafa', '#212121', '#ff4081'] },
  { id: 'current', name: 'Sparkline Current', body: 'ev', price: 62000, unlockLevel: 16, power: 72, grip: 52, weight: 50, skill: 'launch', likes: ['university', 'market', 'parkade'], colors: ['#eceff1', '#b71c1c', '#263238'] },
  { id: 'salon', name: 'Regent Grand Salon', body: 'luxury', price: 0, bucks: 40, unlockLevel: 11, power: 65, grip: 51, weight: 70, skill: 'slipstream', likes: ['motel', 'hq', 'market'], colors: ['#1a1a2e', '#eceff1', '#6d1b1b'] },
  { id: 'stomper', name: 'Ironside Dune Stomper', body: 'truck', price: 36000, unlockLevel: 12, power: 69, grip: 46, weight: 72, skill: 'torque', likes: ['tires', 'stadium', 'lube'], colors: ['#424242', '#1565c0', '#ff6d00'] },
  { id: 'monoposto', name: 'Veloce Monoposto 1', body: 'formula', price: 220000, unlockLevel: 30, power: 90, grip: 90, weight: 20, skill: 'smooth', likes: ['stadium', 'tuner', 'parkade'], colors: ['#d50000', '#eceff1', '#00897b'] },
  { id: 'zenith', name: 'Aether Zenith R', body: 'super', price: 440000, unlockLevel: 40, legendary: true, power: 100, grip: 96, weight: 26, skill: 'nitro', likes: ['stadium', 'glasstower', 'police'], colors: ['#212121', '#1e88e5', '#ff6d00'] },
  { id: 'schoolbus', name: 'Ironside Scholar 72', body: 'bus', price: 6500, unlockLevel: 4, power: 43, grip: 39, weight: 90, skill: 'slipstream', likes: ['diner', 'arcade', 'school'], colors: ['#fbc02d', '#ff8f00', '#eceff1'] },
  { id: 'shaggy', name: 'Lakeside Shaggy Hound', body: 'dogvan', price: 8000, unlockLevel: 5, power: 40, grip: 44, weight: 66, skill: 'oil', likes: ['burger', 'donut', 'icecream'], colors: ['#d7ccc8', '#a1887f', '#9e9e9e'] },
  { id: 'tusker', name: 'Kodiak Tusker Scout', body: 'tusker', price: 95000, unlockLevel: 20, power: 70, grip: 72, weight: 58, skill: 'torque', likes: ['police', 'helipad', 'tires'], colors: ['#6b7a3a', '#c2a36b', '#eceff1'] },
  { id: 'lambo', name: 'Veloce Corrida V12', body: 'wedge', price: 0, bucks: 70, unlockLevel: 26, power: 86, grip: 70, weight: 34, skill: 'oil', likes: ['cinema', 'club', 'parkade'], colors: ['#fdd835', '#d50000', '#fafafa'] },
  { id: 'hyper', name: 'Veloce Hyperion', body: 'super', price: 240000, unlockLevel: 33, power: 98, grip: 86, weight: 32, skill: 'nitro', likes: ['stadium', 'tuner', 'parkade'], colors: ['#1a237e', '#212121', '#d50000'] },
  // Gap fillers (2026-10-12): one car for each stretch of levels the Showroom had nothing new at.
  { id: 'kreis', name: 'Brandt Kreis S', body: 'sedan', price: 48000, unlockLevel: 14, power: 62, grip: 58, weight: 44, skill: 'smooth', likes: ['tuner', 'offices', 'parts'], colors: ['#eceff1', '#0d47a1', '#212121'] },
  { id: 'bergmeister', name: 'Falke Bergmeister RS', body: 'rearengine', price: 70000, unlockLevel: 17, power: 66, grip: 64, weight: 34, skill: 'launch', likes: ['coffee', 'motel', 'parkade'], colors: ['#fafafa', '#2e7d32', '#ff6f00'] },
  { id: 'rattler', name: 'Liberty Rattler GT', body: 'muscle', price: 105000, unlockLevel: 21, power: 84, grip: 54, weight: 56, skill: 'nitro', likes: ['burger', 'bowling', 'stadium'], colors: ['#1565c0', '#fafafa', '#b71c1c'] },
  { id: 'cottonmouth', name: 'Liberty Cottonmouth ACR', body: 'longnose', price: 150000, unlockLevel: 25, power: 88, grip: 62, weight: 46, skill: 'torque', likes: ['club', 'lube', 'stadium'], colors: ['#0d47a1', '#b71c1c', '#fdd835'] },
  { id: 'ringmeister', name: 'Nordwerk Ring V10', body: 'super', price: 190000, unlockLevel: 28, power: 88, grip: 82, weight: 40, skill: 'slipstream', likes: ['glasstower', 'parkade', 'hq'], colors: ['#9e9e9e', '#d32f2f', '#212121'] },
  { id: 'raiden', name: 'Kazumi Raiden R26', body: 'prototype', price: 210000, unlockLevel: 32, power: 92, grip: 92, weight: 24, skill: 'smooth', likes: ['stadium', 'tuner', 'parts'], colors: ['#00897b', '#ff6d00', '#eceff1'] },
  { id: 'sovereign', name: 'Moreau Sovereign 16', body: 'super', price: 0, bucks: 100, unlockLevel: 34, power: 100, grip: 88, weight: 44, skill: 'slipstream', likes: ['hq', 'glasstower', 'cinema'], colors: ['#1a237e', '#90a4ae', '#b71c1c'] },
  { id: 'wraith', name: 'Nordvik Wraith', body: 'wedge', price: 380000, unlockLevel: 38, legendary: true, power: 100, grip: 90, weight: 30, skill: 'oil', likes: ['club', 'glasstower', 'helipad'], colors: ['#eceff1', '#ff6f00', '#212121'] },
  // Exotics (2026-10-12): hard-to-get top-tier cars on their own lofted bodies (see exoticCars.ts).
  { id: 'fulmine', name: 'Veloce Fulmine V12', body: 'scissor', price: 0, bucks: 220, unlockLevel: 40, legendary: true, power: 100, grip: 95, weight: 30, skill: 'launch', likes: ['club', 'stadium', 'glasstower'], colors: ['#c6ff00', '#ff6d00', '#eceff1'] },
  { id: 'eclat', name: 'Moreau Eclat W16', body: 'horseshoe', price: 650000, unlockLevel: 42, legendary: true, power: 100, grip: 99, weight: 40, skill: 'slipstream', likes: ['hq', 'glasstower', 'helipad'], colors: ['#0d47a1', '#212121', '#b0bec5'] },
  { id: 'orafo', name: 'Aurelio Orafo V12', body: 'teardrop', price: 0, bucks: 180, unlockLevel: 39, legendary: true, power: 99, grip: 95, weight: 28, skill: 'smooth', likes: ['cinema', 'club', 'glasstower'], colors: ['#eceff1', '#bf360c', '#37474f'] },
  // Oddballs (2026-10-12): goofy vehicles that wouldn't normally race, on their own bodies (see oddballCars.ts).
  { id: 'scoops', name: 'Lakeside Sundae Wagon', body: 'icecream', price: 6000, unlockLevel: 4, power: 38, grip: 44, weight: 70, skill: 'freeze', likes: ['icecream', 'school', 'arcade'], colors: ['#fafafa', '#f8bbd0', '#b2ebf2'] },
  { id: 'courier', name: 'Ironside Doorstep Express', body: 'parcel', price: 4500, unlockLevel: 3, power: 36, grip: 38, weight: 74, skill: 'slipstream', likes: ['market', 'offices', 'parts'], colors: ['#5d4037', '#eceff1', '#1b5e20'] },
  { id: 'crusher', name: 'Kodiak Mud Crusher', body: 'monster', price: 16000, unlockLevel: 8, power: 54, grip: 46, weight: 88, skill: 'torque', likes: ['stadium', 'tires', 'junkyard'], colors: ['#d50000', '#1565c0', '#ffd600'] },
  // Resto-mods (2026-10-12): secret cars only built from four crate pieces (see game/resto.ts).
  { id: 'sprint', name: 'Valtorre Sprint 65', body: 'stepnose', price: 70000, unlockLevel: 10, secret: true, power: 110, grip: 104, weight: 30, skill: 'smooth', likes: ['coffee', 'cinema', 'tuner'], colors: ['#1b4d3e', '#efe7d2', '#6d1b2b'] },
  { id: 'revenant', name: "Liberty Revenant '69", body: 'restomuscle', price: 110000, unlockLevel: 14, secret: true, power: 130, grip: 92, weight: 56, skill: 'torque', likes: ['burger', 'lube', 'bodyshop'], colors: ['#8d9094', '#1c1c1c', '#0d2a5c'] },
  { id: 'pontone', name: 'Corvara Pontone 58', body: 'pontoon', price: 170000, unlockLevel: 18, secret: true, power: 122, grip: 118, weight: 26, skill: 'slipstream', likes: ['stadium', 'diner', 'motel'], colors: ['#b71c1c', '#cfd8dc', '#1b5e20'] },
  { id: 'bug', name: 'Bumble Bubble', body: 'bubble', price: 1200, unlockLevel: 1, rescueOnly: true, power: 20, grip: 34, weight: 28, skill: 'freeze', likes: ['icecream', 'donut', 'coffee'], colors: ['#80cbc4', '#ffcc80', '#ef9a9a'] },
  { id: 'woodie', name: 'Lakeside Woodie Wagon', body: 'wagon', price: 2200, unlockLevel: 1, rescueOnly: true, power: 25, grip: 31, weight: 56, skill: 'slipstream', likes: ['diner', 'hospital', 'market'], colors: ['#fafafa', '#fff59d', '#4db6ac'] },
  { id: 'hauler', name: 'Old Faithful Hauler', body: 'truck', price: 3000, unlockLevel: 1, rescueOnly: true, power: 40, grip: 40, weight: 70, skill: 'torque', likes: ['carwash', 'junkyard', 'tacos'], colors: ['#558b2f', '#e65100', '#1565c0'] },
  { id: 'cruiser', name: "Sunset Cruiser '57", body: 'classic', price: 5000, unlockLevel: 1, rescueOnly: true, power: 51, grip: 47, weight: 58, skill: 'freeze', likes: ['cinema', 'diner', 'firehouse'], colors: ['#4dd0e1', '#f06292', '#fafafa'] },
  { id: 'buggy', name: 'Dune Skipper Buggy', body: 'offroad', price: 6000, unlockLevel: 1, rescueOnly: true, power: 34, grip: 56, weight: 18, skill: 'launch', likes: ['icecream', 'tires', 'tacos'], colors: ['#ff9800', '#cddc39', '#29b6f6'] },
  { id: 'bandit', name: 'Night Bandit', body: 'muscle', price: 8000, unlockLevel: 1, rescueOnly: true, power: 56, grip: 38, weight: 54, skill: 'nitro', likes: ['club', 'burger', 'bodyshop'], colors: ['#212121', '#ffd54f', '#b71c1c'] },
  { id: 'lemans', name: 'Liberty Endurance GT', body: 'super', price: 16000, unlockLevel: 1, rescueOnly: true, power: 72, grip: 62, weight: 32, skill: 'smooth', likes: ['stadium', 'parts', 'police'], colors: ['#1565c0', '#fafafa', '#c62828'] },
  { id: 'gullwing', name: 'Silver Wing 300', body: 'coupe', price: 30000, unlockLevel: 1, rescueOnly: true, power: 77, grip: 71, weight: 36, skill: 'oil', likes: ['motel', 'bowling', 'parkade'], colors: ['#cfd8dc', '#b71c1c', '#263238'] },
  { id: 'speedster', name: 'Fairhaven Speedster', body: 'roadster', price: 12000, unlockLevel: 1, rescueOnly: true, power: 64, grip: 52, weight: 26, skill: 'nitro', likes: ['cinema', 'diner', 'stadium'], colors: ['#1565c0', '#eceff1', '#b71c1c'] },
  { id: 'nightfall', name: 'Aether Nightfall', body: 'wedge', price: 24000, unlockLevel: 1, season: 1, power: 78, grip: 72, weight: 30, skill: 'slipstream', likes: ['club', 'cinema', 'arcade'], colors: ['#311b92', '#00e5ff', '#212121'] },
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
  { id: 'farm', name: 'Countryside', icon: '🌾', unlockLevel: 4, cost: 1500, cars: [
    { model: 'bug', rarity: 'common' }, { model: 'trail', rarity: 'common' }, { model: 'hauler', rarity: 'common' },
    { model: 'woodie', rarity: 'scarce' }, { model: 'buggy', rarity: 'scarce' }, { model: 'stallion', rarity: 'rare' },
  ] },
  { id: 'downtown', name: 'Downtown', icon: '🏙', unlockLevel: 9, cost: 3500, cars: [
    { model: 'civic', rarity: 'common' }, { model: 'cruiser', rarity: 'common' }, { model: 'rally', rarity: 'scarce' },
    { model: 'bandit', rarity: 'scarce' }, { model: 'stallion', rarity: 'scarce' }, { model: 'vette', rarity: 'rare' },
  ] },
  { id: 'desert', name: 'Desert', icon: '🌵', unlockLevel: 15, cost: 7000, cars: [
    { model: 'buggy', rarity: 'common' }, { model: 'bandit', rarity: 'common' }, { model: 'stallion', rarity: 'scarce' },
    { model: 'charger', rarity: 'scarce' }, { model: 'lemans', rarity: 'rare' }, { model: 'gtr', rarity: 'rare' }, { model: 'speedster', rarity: 'rare' },
  ] },
  { id: 'track', name: 'Old Race Track', icon: '🏁', unlockLevel: 24, cost: 15000, cars: [
    { model: 'vette', rarity: 'common' }, { model: 'lemans', rarity: 'common' }, { model: 'charger', rarity: 'scarce' },
    { model: 'gullwing', rarity: 'scarce' }, { model: 'gtr', rarity: 'rare' }, { model: 'hyper', rarity: 'rare' },
  ] },
]
export const RESCUE_PINS = 8

// Rusty's sets: every car a spot can turn up, restored and in the garage, pays a one-time reward
// (claimed like a collection book set, through claimedSets; the save guard pays it from econ_catalog()).
export const RUSTY_SET_PAY: Record<string, { coins: number; bucks: number; trophies: number; xp: number }> = {
  suburbs: { coins: 2500, bucks: 2, trophies: 5, xp: 80 },
  farm: { coins: 5000, bucks: 3, trophies: 8, xp: 120 },
  downtown: { coins: 10000, bucks: 4, trophies: 12, xp: 180 },
  desert: { coins: 20000, bucks: 6, trophies: 20, xp: 260 },
  track: { coins: 40000, bucks: 10, trophies: 30, xp: 400 },
}
export const rustySetId = (spot: string) => `rusty-${spot}`
export const RUSTY_SETS: CarSet[] = RESCUE_SPOTS.map((sp) => ({
  id: rustySetId(sp.id), name: sp.name, icon: sp.icon, cars: [...new Set(sp.cars.map((c) => c.model))], ...RUSTY_SET_PAY[sp.id],
}))

// Rusty's hot tip: one spot a day (UTC), out of those the player's level has opened, where rare
// cars turn up HOT_RARE times as often. rescue_roll() picks the same spot from the saved level.
export const HOT_RARE = 3
export const utcDay = (t = Date.now()) => Math.floor(t / 86400000)
export function hotSpot(level: number, t = Date.now()): string {
  const open = RESCUE_SPOTS.filter((sp) => level >= sp.unlockLevel)
  return (open.length ? open : RESCUE_SPOTS.slice(0, 1))[utcDay(t) % Math.max(1, open.length)].id
}
export const rarityWeight = (r: Rarity, hot: boolean) => RARITY[r].weight * (hot && r === 'rare' ? HOT_RARE : 1)

// Rusty's tow truck: upgraded with parts. Each level adds a spot to every search and makes flats
// rarer; the top level's magnet shows which tarps hide a car. The save guard checks the parts
// were spent and the level reached (econ_progress()), and rescue_roll() rolls its extra spots.
export type TruckLevel = { pins: number; flat: number; parts: number; level: number; magnet?: boolean }
export const TRUCK: TruckLevel[] = [
  { pins: 8, flat: 0.25, parts: 0, level: 1 },
  { pins: 9, flat: 0.18, parts: 25, level: 4 },
  { pins: 10, flat: 0.12, parts: 60, level: 9 },
  { pins: 11, flat: 0.06, parts: 120, level: 15, magnet: true },
]
export const truckOf = (n: number | undefined) => TRUCK[Math.max(0, Math.min(TRUCK.length - 1, Math.floor(n ?? 0)))]

// A second restore bay opens at this player level (econ_progress() checks the saved level).
export const BAY2_LEVEL = 12
// The chance each pin hides a car (every search has at least one).
export const RESCUE_CAR_CHANCE = 0.1
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
// or 25% at a business it loves (each car loves three). A car with a flat or out of gas earns nothing
// extra until it's fixed. Saves keep the car's uid as `car` on the placed building.
export const DRIVER_BONUS = 0.1
export const FAVORITE_BONUS = 0.25
// Whether a business takes jobs right now: night spots only open after dark.
export const isOpen = (d: BuildingDef, now = Date.now()) => !d.nightOnly || isNight(now)
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

// Car mods: bolt-on parts you can see on the car (in town, in races and in
// every preview), one per slot. Unlike Garage upgrades, which tune what's under
// the skin in five steps, a mod is a single visible part with a fixed price and
// a small stat bump, and the same mod costs the same on any car. Saves list the
// fitted mod ids as `mods` on each car (missing means none) and every part
// bought for that car as `ownedMods`, so a swapped-out part can go back on for
// free. Ids stay fixed so saves keep working.
export type ModSlot = 'spoiler' | 'exhaust' | 'kit' | 'hood' | 'rims' | 'tires'
export const MOD_SLOTS: { id: ModSlot; name: string; icon: string; stat: string }[] = [
  { id: 'spoiler', name: 'Spoilers', icon: '🪽', stat: 'Downforce for more grip' },
  { id: 'exhaust', name: 'Exhausts', icon: '💨', stat: 'Freer flow for more power' },
  { id: 'kit', name: 'Body Kits', icon: '🏎', stat: 'Lighter panels and better grip' },
  { id: 'hood', name: 'Hoods', icon: '🔥', stat: 'More air for more power' },
  { id: 'rims', name: 'Rims', icon: '🛞', stat: 'Lighter wheels' },
  { id: 'tires', name: 'Tires', icon: '🌧️', stat: 'Hold the strip in rain, snow and sand' },
]

// Whether a part can go on this body: special parts on their own bodies only, regular parts
// everywhere except bodies they make no sense on.
export const modFits = (m: ModDef, body: Body) => (m.only ? m.only.includes(body) : !m.notOn?.includes(body))

export type ModDef = {
  id: string
  slot: ModSlot
  name: string
  unlockLevel: number
  coins: number
  parts: number
  bucks: number
  // Stat changes, on the same scale as CarDef stats (weight goes down).
  power: number
  grip: number
  weight: number
  // A special part made for these bodies only, or a regular part that makes no sense on these bodies.
  only?: Body[]
  notOn?: Body[]
  // Tires: how much of each slick surface (rain, snow, desert sand) they cancel in races, 0..1.
  // They add no PI, so they never move the referee's time floors (see grip.ts).
  tread?: { wet?: number; snow?: number; dust?: number }
}

// Bodies that swap regular spoilers, kits or hoods for parts of their own.
const ODD: Body[] = ['bus', 'tank', 'dogvan', 'tusker', 'scooter', 'chopper', 'sportbike']
const BIKE_BODIES: Body[] = ['scooter', 'chopper', 'sportbike']
export const MODS: ModDef[] = [
  { id: 'ducktail', slot: 'spoiler', notOn: ODD, name: 'Ducktail Lip', unlockLevel: 2, coins: 1200, parts: 0, bucks: 0, power: 0, grip: 2, weight: 0 },
  { id: 'gtwing', slot: 'spoiler', notOn: ODD, name: 'GT Wing', unlockLevel: 5, coins: 4000, parts: 10, bucks: 0, power: 0, grip: 4, weight: 0 },
  { id: 'attackwing', slot: 'spoiler', notOn: ODD, name: 'Time Attack Wing', unlockLevel: 12, coins: 0, parts: 0, bucks: 12, power: 0, grip: 6, weight: 0 },
  { id: 'twintips', slot: 'exhaust', name: 'Twin Tips', unlockLevel: 2, coins: 1000, parts: 0, bucks: 0, power: 2, grip: 0, weight: 0 },
  { id: 'sidepipes', slot: 'exhaust', name: 'Side Pipes', unlockLevel: 4, coins: 3500, parts: 8, bucks: 0, power: 4, grip: 0, weight: 0 },
  { id: 'flamepipes', slot: 'exhaust', name: 'Flame Throwers', unlockLevel: 12, coins: 0, parts: 0, bucks: 10, power: 6, grip: 0, weight: 0 },
  { id: 'streetkit', slot: 'kit', notOn: BIKE_BODIES, name: 'Street Kit', unlockLevel: 3, coins: 1500, parts: 0, bucks: 0, power: 0, grip: 1, weight: -2 },
  { id: 'widebody', slot: 'kit', notOn: BIKE_BODIES, name: 'Widebody', unlockLevel: 6, coins: 6000, parts: 15, bucks: 0, power: 0, grip: 3, weight: -3 },
  { id: 'carbonkit', slot: 'kit', notOn: BIKE_BODIES, name: 'Carbon Race Kit', unlockLevel: 16, coins: 0, parts: 0, bucks: 15, power: 0, grip: 3, weight: -6 },
  { id: 'vented', slot: 'hood', notOn: [...BIKE_BODIES, 'formula'], name: 'Vented Hood', unlockLevel: 2, coins: 800, parts: 0, bucks: 0, power: 1, grip: 0, weight: -1 },
  { id: 'ramscoop', slot: 'hood', notOn: [...BIKE_BODIES, 'formula'], name: 'Ram Scoop', unlockLevel: 4, coins: 3000, parts: 6, bucks: 0, power: 3, grip: 0, weight: 0 },
  { id: 'blower', slot: 'hood', notOn: [...BIKE_BODIES, 'formula'], name: 'Supercharger', unlockLevel: 7, coins: 8000, parts: 20, bucks: 0, power: 5, grip: 0, weight: 0 },
  { id: 'chrome', slot: 'rims', name: 'Chrome Spokes', unlockLevel: 1, coins: 600, parts: 0, bucks: 0, power: 0, grip: 0, weight: -1 },
  { id: 'goldmesh', slot: 'rims', name: 'Gold Mesh', unlockLevel: 4, coins: 2500, parts: 5, bucks: 0, power: 0, grip: 1, weight: -2 },
  // Special parts.
  { id: 'luggage', slot: 'spoiler', only: ['bus'], name: 'Roof Luggage Rack', unlockLevel: 3, coins: 2500, parts: 0, bucks: 0, power: 0, grip: 2, weight: 1 },
  { id: 'stacks', slot: 'exhaust', only: ['bus'], name: 'Big Rig Stacks', unlockLevel: 3, coins: 3000, parts: 5, bucks: 0, power: 3, grip: 0, weight: 0 },
  { id: 'cowcatcher', slot: 'kit', only: ['bus'], name: 'Cow Catcher', unlockLevel: 4, coins: 3500, parts: 8, bucks: 0, power: 0, grip: 2, weight: 0 },
  { id: 'disco', slot: 'hood', only: ['bus'], name: 'Disco Ball', unlockLevel: 5, coins: 0, parts: 0, bucks: 6, power: 2, grip: 0, weight: 0 },
  { id: 'flag', slot: 'spoiler', only: ['tank'], name: 'Battle Standard', unlockLevel: 10, coins: 6000, parts: 10, bucks: 0, power: 0, grip: 3, weight: 0 },
  { id: 'smoke', slot: 'exhaust', only: ['tank'], name: 'Smoke Screen Stacks', unlockLevel: 10, coins: 0, parts: 0, bucks: 8, power: 5, grip: 0, weight: 0 },
  { id: 'reactive', slot: 'kit', only: ['tank'], name: 'Reactive Armour', unlockLevel: 10, coins: 9000, parts: 20, bucks: 0, power: 0, grip: 4, weight: 1 },
  { id: 'watercannon', slot: 'hood', only: ['tank'], name: 'Water Cannon Turret', unlockLevel: 10, coins: 0, parts: 0, bucks: 12, power: 4, grip: 0, weight: 0 },
  { id: 'bigtail', slot: 'spoiler', only: ['dogvan'], name: 'Wagging Tail XL', unlockLevel: 4, coins: 1500, parts: 0, bucks: 0, power: 0, grip: 2, weight: 0 },
  { id: 'bubbles', slot: 'exhaust', only: ['dogvan'], name: 'Bubble Blower', unlockLevel: 4, coins: 0, parts: 0, bucks: 5, power: 2, grip: 0, weight: 0 },
  { id: 'collar', slot: 'kit', only: ['dogvan'], name: 'Spiked Collar', unlockLevel: 4, coins: 2000, parts: 4, bucks: 0, power: 0, grip: 1, weight: -1 },
  { id: 'bone', slot: 'hood', only: ['dogvan'], name: 'Bone Hood Ornament', unlockLevel: 4, coins: 1200, parts: 0, bucks: 0, power: 1, grip: 0, weight: 0 },
  { id: 'radar', slot: 'spoiler', only: ['tusker'], name: 'Radar Dish', unlockLevel: 9, coins: 4500, parts: 10, bucks: 0, power: 0, grip: 3, weight: 0 },
  { id: 'snorkel', slot: 'exhaust', only: ['tusker'], name: 'Snorkel', unlockLevel: 9, coins: 3000, parts: 6, bucks: 0, power: 3, grip: 0, weight: 0 },
  { id: 'plating', slot: 'kit', only: ['tusker'], name: 'Armour Plating', unlockLevel: 9, coins: 7000, parts: 15, bucks: 0, power: 0, grip: 4, weight: 1 },
  { id: 'lightbar', slot: 'hood', only: ['tusker'], name: 'Spotlight Rack', unlockLevel: 9, coins: 3500, parts: 6, bucks: 0, power: 2, grip: 0, weight: 0 },
  { id: 'tailfairing', slot: 'spoiler', only: BIKE_BODIES, name: 'Tail Fairing', unlockLevel: 2, coins: 1500, parts: 0, bucks: 0, power: 0, grip: 2, weight: 0 },
  { id: 'saddlebags', slot: 'kit', only: BIKE_BODIES, name: 'Saddlebags', unlockLevel: 2, coins: 1800, parts: 0, bucks: 0, power: 0, grip: 1, weight: -1 },
  { id: 'windscreen', slot: 'hood', only: BIKE_BODIES, name: 'Touring Windscreen', unlockLevel: 2, coins: 1200, parts: 0, bucks: 0, power: 1, grip: 0, weight: 0 },
  { id: 'campod', slot: 'hood', only: ['formula'], name: 'Onboard Camera', unlockLevel: 11, coins: 2000, parts: 4, bucks: 0, power: 1, grip: 0, weight: 0 },
  { id: 'bargeboards', slot: 'kit', only: ['formula'], name: 'Bargeboards', unlockLevel: 11, coins: 0, parts: 0, bucks: 10, power: 0, grip: 3, weight: -3 },
  { id: 'raintires', slot: 'tires', name: 'Rain Tires', unlockLevel: 3, coins: 2500, parts: 4, bucks: 0, power: 0, grip: 0, weight: 0, tread: { wet: 1 } },
  { id: 'sandtires', slot: 'tires', name: 'Sand Paddles', unlockLevel: 4, coins: 3000, parts: 5, bucks: 0, power: 0, grip: 0, weight: 0, tread: { dust: 1 } },
  { id: 'snowstuds', slot: 'tires', name: 'Studded Snow Tires', unlockLevel: 4, coins: 3500, parts: 6, bucks: 0, power: 0, grip: 0, weight: 0, tread: { snow: 1 } },
  { id: 'allweather', slot: 'tires', name: 'All-Weather Compound', unlockLevel: 7, coins: 0, parts: 0, bucks: 12, power: 0, grip: 0, weight: 0, tread: { wet: 0.7, snow: 0.7, dust: 0.7 } },
  { id: 'forged', slot: 'rims', name: 'Forged Black', unlockLevel: 7, coins: 7000, parts: 12, bucks: 0, power: 0, grip: 2, weight: -3 },
]

// Unknown ids (a mod from a newer build) give nothing and draw nothing.
export const modDef = (id: string): ModDef | undefined => MODS.find((m) => m.id === id)
export const modStats = (id: string) => {
  const m = modDef(id)
  return { power: m?.power ?? 0, grip: m?.grip ?? 0, weight: m?.weight ?? 0 }
}
export const modCost = (id: string) => {
  const m = modDef(id)
  return { coins: m?.coins ?? 0, parts: m?.parts ?? 0, bucks: m?.bucks ?? 0 }
}
// The fitted mod in each slot (the first known one wins if a save lists two). Given a body,
// parts that don't fit it are skipped, as the server's econ_fitted_mods does.
export const fittedMods = (mods?: string[] | null, body?: Body): Partial<Record<ModSlot, string>> => {
  const out: Partial<Record<ModSlot, string>> = {}
  for (const id of Array.isArray(mods) ? mods : []) {
    const m = modDef(id)
    if (m && !out[m.slot] && (!body || modFits(m, body))) out[m.slot] = id
  }
  return out
}
// Every mod bought for a car: `ownedMods` plus whatever is fitted (older saves
// only have `mods`). Known ids only, no repeats.
export const ownedMods = (car: { mods?: string[] | null; ownedMods?: string[] | null }) =>
  [...new Set([...(Array.isArray(car.ownedMods) ? car.ownedMods : []), ...(Array.isArray(car.mods) ? car.mods : [])])].filter((id) => !!modDef(id))
export const modXp = (id: string) => 10 + (modDef(id)?.unlockLevel ?? 0) * 3

// Performance index: what races are decided on (plus the driver's shifting).
export const performance = (car: CarDef, up: Record<UpgradeSlot, number>, mods?: string[] | null) => {
  const { power, grip, weight } = carStats(car, up, mods)
  return Math.round(power * 0.6 + grip * 0.3 + (100 - weight) * 0.1)
}
// Power, grip and weight with upgrades and fitted mods.
export function carStats(car: CarDef, up: Record<UpgradeSlot, number>, mods?: string[] | null) {
  const m = Object.values(fittedMods(mods, car.body)).map(modStats)
  const sum = (k: 'power' | 'grip' | 'weight') => m.reduce((a, x) => a + x[k], 0)
  return {
    power: car.power + up.engine * 4 + up.turbo * 3 + sum('power'),
    grip: car.grip + up.tires * 4 + sum('grip'),
    weight: Math.max(5, car.weight - up.weight * 4 + sum('weight')),
  }
}

// XP needed to go from `level` to `level + 1`: rising gently, so each level is a bit more than the
// last, then the same for every level past XP_FLAT_LEVEL so high levels never feel endless.
export const XP_FLAT_LEVEL = 100
export const xpToNext = (level: number) => Math.round(100 * Math.pow(Math.min(level, XP_FLAT_LEVEL), 2.15))

export const baseFuelCap = (level: number) => 15 + level * 2
export const FUEL_REGEN_SECONDS = 60
export const RACE_FUEL = 3
// Bucks to fill the tank to the cap in one go: at least 3, and 1 per 5 fuel it adds.
export const REFILL_BUCKS = 3
export const refillBucks = (fuelToAdd: number) => Math.max(REFILL_BUCKS, Math.ceil(fuelToAdd / 5))

// Grand Prix: six races in a row against tougher and tougher rivals. Win
// all six for a mystery box car. Each repeat of a series gets harder.
export type GpSeries = { id: string; name: string; unlockLevel: number; minCars: number; basePi: number; step: number; prize: number; box: string[]; rivals: string[] }
export const GP_SERIES: GpSeries[] = [
  { id: 'rookie', name: 'Rookie Cup', unlockLevel: 2, minCars: 3, basePi: 22, step: 3, prize: 200, box: ['trail', 'miata', 'woodie', 'cruiser'], rivals: ['Dusty Dan', 'Penny Pistons', 'Lugnut Lou', 'Speedy Sue', 'Gearhead Gus', 'Champ Chuck'] },
  { id: 'street', name: 'Street Kings', unlockLevel: 8, minCars: 4, basePi: 40, step: 3, prize: 450, box: ['stallion', 'rally', 'buggy', 'bandit'], rivals: ['Nitro Nina', 'Torque Tony', 'Drift Dee', 'Boost Bo', 'Redline Rae', 'King Kurt'] },
  { id: 'pro', name: 'Pro Circuit', unlockLevel: 15, minCars: 5, basePi: 56, step: 3, prize: 900, box: ['vette', 'charger', 'lemans'], rivals: ['Apex Ava', 'Slick Sam', 'Turbo Tess', 'Clutch Cole', 'Vroom Val', 'Ace Axel'] },
  { id: 'legends', name: 'Legends Series', unlockLevel: 26, minCars: 6, basePi: 72, step: 3, prize: 1800, box: ['gtr', 'gullwing', 'shinden', 'lambo'], rivals: ['Ghost Rider', 'Lady Luck', 'The Baron', 'Silver Fox', 'Mad Max', 'The Legend'] },
]
export const GP_ROUNDS = 6
// Rival PI for a round; each completed run of the series adds 8%.
export const gpRivalPi = (s: GpSeries, round: number, clears: number) => Math.round((s.basePi + round * s.step) * (1 + clears * 0.08))
export const gpReward = (s: GpSeries, round: number) => s.prize + round * Math.round(s.prize / 4)

// Campaign: a single-player ladder of chapters, five races each, the last
// one a boss. Rivals get faster and shift cleaner the further you go, and
// rewards climb with them. Clearing a chapter pays a one-time bonus, and
// three stars on every race in it pays extra bucks.
export type CampaignChapter = {
  id: string; name: string; blurb: string; unlockLevel: number
  venue: string // where its races run (scene/venues.ts)
  pi: [number, number] // rival PI from the first race to the boss
  rivals: string[] // the last one is the boss
  cars?: string[] // each rival's car (car ids), where their name calls for one; otherwise the car nearest their PI
  coins: number; bucks: number; trophies: number; starBucks: number
}
export const CAMPAIGN_RACES = 5
export const CAMPAIGN: CampaignChapter[] = [
  { id: 'c1', name: 'Back Streets', blurb: 'Local kids with something to prove.', unlockLevel: 1, venue: 'main', pi: [22, 32], rivals: ['Scooter Steve', 'Bubblegum Bea', 'Hubcap Hal', 'Lil Lugnut', 'Big Mike'], cars: ['pip', 'bug', 'civic', 'buggy', 'hauler'], coins: 1000, bucks: 1, trophies: 3, starBucks: 1 },
  { id: 'c2', name: 'Harbor Run', blurb: 'Dockworkers race the night shift home.', unlockLevel: 4, venue: 'docks', pi: [32, 44], rivals: ['Salty Pete', 'Crane Carla', 'Rusty Anchor', 'Tugboat Ted', 'Captain Kidd'], coins: 2000, bucks: 1, trophies: 3, starBucks: 1 },
  { id: 'c3', name: 'Desert Strip', blurb: 'Long straights, hot tarmac, no mercy.', unlockLevel: 8, venue: 'desert', pi: [44, 58], rivals: ['Dusty Dakota', 'Mirage Mo', 'Sidewinder Sal', 'Coyote Cass', 'The Scorpion'], coins: 3500, bucks: 2, trophies: 4, starBucks: 1 },
  { id: 'c4', name: 'Mountain Pass', blurb: 'Thin air and thinner margins.', unlockLevel: 13, venue: 'snow', pi: [58, 72], rivals: ['Summit Sue', 'Avalanche Al', 'Ridge Runner', 'Peak Paulie', 'The Yeti'], coins: 5500, bucks: 2, trophies: 5, starBucks: 2 },
  { id: 'c5', name: 'Sunset Boardwalk', blurb: 'Beach crowds, big money, bigger engines.', unlockLevel: 19, venue: 'beach', pi: [72, 88], rivals: ['Surfer Sid', 'Sandy Shores', 'Tidal Tom', 'Riptide Rita', 'Big Kahuna'], coins: 8000, bucks: 3, trophies: 6, starBucks: 2 },
  { id: 'c6', name: 'Harvest Backroads', blurb: 'Farm-tough racers who never lift.', unlockLevel: 26, venue: 'farm', pi: [88, 104], rivals: ['Hayride Hank', 'Tractor Tina', 'Combine Carl', 'Silo Sam', 'The Scarecrow'], coins: 12000, bucks: 3, trophies: 8, starBucks: 2 },
  { id: 'c7', name: 'Champions Speedway', blurb: 'The best drivers in the land. Only one leaves a legend.', unlockLevel: 33, venue: 'main', pi: [104, 124], rivals: ['Golden Gabe', 'Iron Ivy', 'Thunder Thea', 'Velvet Vince', 'The Champion'], coins: 20000, bucks: 5, trophies: 10, starBucks: 3 },
]
export const campaignRaceId = (ch: CampaignChapter, i: number) => `${ch.id}-${i}`
export const campaignRivalPi = (ch: CampaignChapter, i: number) => Math.round(ch.pi[0] + ((ch.pi[1] - ch.pi[0]) * i) / (CAMPAIGN_RACES - 1))
// How cleanly a rival shifts, 0 (early, sloppy) to 1 (every shift perfect), across the whole campaign.
// Even the first rival shifts decently, so race 1 can't be won with eyes closed.
export const campaignShift = (chIndex: number, i: number) => Math.min(1, 0.35 + 0.65 * (chIndex + i / (CAMPAIGN_RACES - 1)) / (CAMPAIGN.length - 1))
// A brand-new racer's first campaign race (Back Streets 1, before any race won): its rival shifts
// sloppily and is slow off the line, so the first race after the tutorial is one they can win.
// Only the rival's driving changes; the PI shown and the prize stay the same.
export const ROOKIE_SHIFT = 0
export const rookieRace = (chIndex: number, i: number, racesWon: number) => chIndex === 0 && i === 0 && racesWon === 0
// Rivals use their car's skill from the third chapter on; bosses always do.
export const campaignRivalSkills = (chIndex: number, i: number) => chIndex >= 2 || i === CAMPAIGN_RACES - 1
// The first win of each race pays the most; replays pay about a quick race.
export const campaignReward = (ch: CampaignChapter, i: number, first: boolean) => {
  const full = 100 + campaignRivalPi(ch, i) * 10
  return first ? full : Math.round((full * 0.6) / 10) * 10
}
// Stars for a win: one for winning, two for beating them by 3% of their time, three for 6%.
export const campaignStars = (myTime: number, theirTime: number) => {
  if (!(myTime < theirTime)) return 0
  const lead = Number.isFinite(theirTime) ? (theirTime - myTime) / theirTime : 1
  return lead >= 0.06 ? 3 : lead >= 0.03 ? 2 : 1
}
export const campaignCleared = (done: Record<string, number>, ch: CampaignChapter) =>
  Array.from({ length: CAMPAIGN_RACES }, (_, i) => done[campaignRaceId(ch, i)] ?? 0).every((n) => n >= 1)
export const campaignPerfect = (done: Record<string, number>, ch: CampaignChapter) =>
  Array.from({ length: CAMPAIGN_RACES }, (_, i) => done[campaignRaceId(ch, i)] ?? 0).every((n) => n >= 3)

// Collection book: every car belongs to one set. Owning every car in a set
// at once lets the player claim its one-time reward (coins, bucks, trophies, XP).
// Saves keep the claimed set ids in `claimedSets`; claimed sets stay claimed
// even if a car from them is sold later.
export type CarSet = { id: string; name: string; icon: string; cars: string[]; coins: number; bucks: number; trophies: number; xp: number }
export const CAR_SETS: CarSet[] = [
  { id: 'daily', name: 'Daily Drivers', icon: '🏘', cars: ['pip', 'civic', 'trail', 'miata'], coins: 1500, bucks: 2, trophies: 5, xp: 60 },
  { id: 'bikes', name: 'Two Wheels', icon: '🏍', cars: ['zippy', 'baron', 'shinden'], coins: 4000, bucks: 3, trophies: 10, xp: 120 },
  { id: 'classics', name: "Rusty's Classics", icon: '🔧', cars: ['bug', 'woodie', 'hauler', 'cruiser', 'buggy'], coins: 5000, bucks: 5, trophies: 15, xp: 150 },
  { id: 'muscle', name: 'Muscle Row', icon: '💪', cars: ['stallion', 'charger', 'hellcat', 'bandit'], coins: 8000, bucks: 5, trophies: 15, xp: 200 },
  { id: 'track', name: 'Track Legends', icon: '🏁', cars: ['rally', 'vette', 'gtr', 'lemans', 'gullwing'], coins: 15000, bucks: 8, trophies: 25, xp: 300 },
  { id: 'roadtrip', name: 'Road Trip', icon: '🏕', cars: ['camper', 'ridgeback', 'stomper', 'shaggy'], coins: 6000, bucks: 4, trophies: 12, xp: 160 },
  { id: 'tuners', name: 'Tuner Alley', icon: '🌀', cars: ['hotshot', 'kitsune', 'current'], coins: 7000, bucks: 4, trophies: 12, xp: 180 },
  { id: 'grandtour', name: 'Grand Tour', icon: '🎩', cars: ['salon', 'speedster', 'monoposto'], coins: 20000, bucks: 10, trophies: 30, xp: 350 },
  { id: 'heavy', name: 'Heavy Duty', icon: '🚌', cars: ['schoolbus', 'tusker'], coins: 6000, bucks: 3, trophies: 10, xp: 150 },
  { id: 'dream', name: 'Dream Garage', icon: '💎', cars: ['lambo', 'hyper', 'tomahawk', 'zenith'], coins: 30000, bucks: 15, trophies: 40, xp: 500 },
  { id: 'autobahn', name: 'Autobahn Club', icon: '🛣', cars: ['kreis', 'bergmeister', 'ringmeister', 'sovereign'], coins: 20000, bucks: 10, trophies: 30, xp: 350 },
  { id: 'apex', name: 'Apex Predators', icon: '🐍', cars: ['rattler', 'cottonmouth', 'raiden', 'wraith'], coins: 30000, bucks: 15, trophies: 40, xp: 500 },
  { id: 'oddballs', name: 'Oddballs', icon: '🍦', cars: ['scoops', 'courier', 'crusher'], coins: 4000, bucks: 3, trophies: 8, xp: 120 },
  { id: 'restomods', name: 'Resto Garage', icon: '🧩', cars: ['sprint', 'revenant', 'pontone'], coins: 30000, bucks: 15, trophies: 40, xp: 500 },
  { id: 'exotica', name: 'Exotica', icon: '👑', cars: ['fulmine', 'eclat', 'orafo'], coins: 40000, bucks: 20, trophies: 50, xp: 600 },
  // Season track prizes; each season adds its car here.
  { id: 'seasons', name: 'Season Rides', icon: '🏁', cars: ['nightfall'], coins: 5000, bucks: 3, trophies: 10, xp: 150 },
]
export const setOwned = (set: CarSet, cars: { model: string }[]) => set.cars.filter((m) => cars.some((c) => c.model === m)).length
export const setComplete = (set: CarSet, cars: { model: string }[]) => setOwned(set, cars) === set.cars.length
// Sets the player owns every car of but hasn't claimed yet.
export const readySets = (s: { cars: { model: string }[]; claimedSets?: string[] }) =>
  CAR_SETS.filter((set) => !(s.claimedSets ?? []).includes(set.id) && setComplete(set, s.cars))
// Where to get a car: the Showroom (with its level or bucks price) or Rusty's searches.
export function carSource(car: CarDef): { icon: string; text: string } {
  if (car.season) return { icon: '🏁', text: `Season ${car.season} prize` }
  if (car.secret) return { icon: '🧩', text: 'Crate pieces' }
  if (car.rescueOnly) {
    const spot = RESCUE_SPOTS.filter((sp) => sp.cars.some((c) => c.model === car.id)).sort((a, b) => a.unlockLevel - b.unlockLevel)[0]
    return { icon: '🔧', text: spot ? `Rusty's · ${spot.name}` : "Rusty's" }
  }
  if (car.bucks) return { icon: '🚘', text: `Showroom · 💎${car.bucks}` }
  return { icon: '🚘', text: `Showroom · Lv ${car.unlockLevel}` }
}

// Bank packs. Bigger packs carry a bigger bonus on top of the base rate of
// 5 bucks per dollar, plus extra coins and parts.
export { BUCKS_PACKS, type BucksPack } from './bucksPacks'

// Counted on the save as the player does things.
export type CounterKey =
  | 'jobs' | 'carsBought' | 'upgrades' | 'racesWon' | 'built' | 'roads' | 'coinsEarned' | 'flatsFixed' | 'rescued' | 'searches' | 'gpWins'
  | 'races' | 'campaignWins' | 'painted' | 'modsBought' | 'serviced'
// Read off the town itself, so towns that did these before the goal existed still get credit.
// owns: has a `def` building; bldgLevel: highest building level; stars/chapters: campaign; power: garage power.
export type DerivedKey = 'spooky' | 'rusty' | 'level' | 'carsOwned' | 'drivers' | 'plots' | 'bldgLevel' | 'stars' | 'chapters' | 'power' | 'owns'
export type StatKey = CounterKey | DerivedKey
export const COUNTERS: CounterKey[] = [
  'jobs', 'carsBought', 'upgrades', 'racesWon', 'built', 'roads', 'coinsEarned', 'flatsFixed', 'rescued', 'searches', 'gpWins',
  'races', 'campaignWins', 'painted', 'modsBought', 'serviced',
]

// level: the goal stays hidden until then. def: the building an `owns` goal asks for.
// event: an event goal, shown in its own section while the event runs instead of in the story chain.
export type GoalDef = { id: string; icon: string; text: string; stat: StatKey; target: number; coins: number; xp: number; bucks?: number; level?: number; def?: string; event?: EventId }

// The story goals, played in order; the first three unclaimed goals the player's level allows are active at once.
// Each new feature gets a goal near where it unlocks, so the list doubles as the game's guided tour.
export const GOALS: GoalDef[] = [
  { id: 'g0', icon: '🔧', text: "Build Rusty's Rescue", stat: 'rusty', target: 1, coins: 200, xp: 20 },
  { id: 'r1', icon: '🔍', text: "Search for cars at Rusty's", stat: 'searches', target: 1, coins: 150, xp: 15 },
  { id: 'r2', icon: '🛠', text: 'Restore a rescued car', stat: 'rescued', target: 1, coins: 300, xp: 25, bucks: 1 },
  { id: 'g1', icon: '🍕', text: 'Collect from 3 businesses', stat: 'jobs', target: 3, coins: 150, xp: 15 },
  { id: 'g2', icon: '🛣', text: 'Lay 5 road tiles', stat: 'roads', target: 5, coins: 100, xp: 10 },
  { id: 'g3', icon: '🚗', text: 'Get a new car', stat: 'carsBought', target: 1, coins: 300, xp: 25 },
  { id: 'g4', icon: '🏁', text: 'Win a drag race', stat: 'racesWon', target: 1, coins: 250, xp: 20 },
  { id: 'q1', icon: '🗺', text: 'Win a campaign race', stat: 'campaignWins', target: 1, coins: 250, xp: 20 },
  { id: 'g5', icon: '⬆', text: 'Upgrade a car part or a building', stat: 'upgrades', target: 1, coins: 200, xp: 20 },
  { id: 'q2', icon: '🎨', text: 'Paint a car', stat: 'painted', target: 1, coins: 200, xp: 15 },
  { id: 'g6', icon: '🏗', text: 'Place 2 new buildings', stat: 'built', target: 2, coins: 300, xp: 25 },
  { id: 'g7', icon: '🛞', text: 'Fix a flat tire', stat: 'flatsFixed', target: 1, coins: 150, xp: 15 },
  { id: 'q3', icon: '🧑‍✈️', text: 'Give a business a driver', stat: 'drivers', target: 1, coins: 300, xp: 25 },
  { id: 'g8', icon: '🍕', text: 'Collect from 15 businesses', stat: 'jobs', target: 15, coins: 500, xp: 40, bucks: 1 },
  { id: 'q4', icon: '⭐', text: 'Reach level 3', stat: 'level', target: 3, coins: 400, xp: 0 },
  { id: 'q5', icon: '🗺', text: 'Clear campaign chapter 1', stat: 'chapters', target: 1, coins: 600, xp: 50 },
  { id: 'g9', icon: '💰', text: 'Earn 5,000 coins', stat: 'coinsEarned', target: 5000, coins: 600, xp: 50 },
  { id: 'q6', icon: '🪽', text: 'Fit a car mod', stat: 'modsBought', target: 1, coins: 500, xp: 40, level: 2 },
  { id: 'q7', icon: '🛞', text: 'Build a Tire Shop', stat: 'owns', def: 'tires', target: 1, coins: 500, xp: 40, level: 2 },
  { id: 'q8', icon: '⛽', text: 'Service 3 stranded cars at your shops', stat: 'serviced', target: 3, coins: 500, xp: 40 },
  { id: 'g10', icon: '🏁', text: 'Win 5 drag races', stat: 'racesWon', target: 5, coins: 800, xp: 60, bucks: 1 },
  { id: 'q9', icon: '🌳', text: 'Buy more land', stat: 'plots', target: START_LAND.length + 1, coins: 800, xp: 60 },
  { id: 'q10', icon: '🏢', text: 'Upgrade a building to level 3', stat: 'bldgLevel', target: 3, coins: 800, xp: 60 },
  { id: 'g11', icon: '🚗', text: 'Get 3 new cars', stat: 'carsBought', target: 3, coins: 1000, xp: 70 },
  { id: 'q11', icon: '🅿', text: 'Own 6 cars', stat: 'carsOwned', target: 6, coins: 1000, xp: 70 },
  { id: 'q12', icon: '⭐', text: 'Reach level 5', stat: 'level', target: 5, coins: 1000, xp: 0, bucks: 1 },
  { id: 'gp1', icon: '🏆', text: 'Win a Grand Prix series', stat: 'gpWins', target: 1, coins: 2000, xp: 150, bucks: 2, level: 2 },
  { id: 'q13', icon: '✨', text: 'Earn 9 campaign stars', stat: 'stars', target: 9, coins: 1200, xp: 80 },
  { id: 'r3', icon: '🛠', text: 'Restore 5 rescued cars', stat: 'rescued', target: 5, coins: 3000, xp: 200, bucks: 2 },
  { id: 'q14', icon: '🧑‍✈️', text: 'Put 3 drivers to work', stat: 'drivers', target: 3, coins: 1500, xp: 100 },
  { id: 'g12', icon: '⬆', text: 'Do 10 upgrades', stat: 'upgrades', target: 10, coins: 1200, xp: 80, bucks: 2 },
  { id: 'q15', icon: '🦉', text: 'Build the Neon Owl Nightclub', stat: 'owns', def: 'club', target: 1, coins: 2000, xp: 120, level: 6 },
  { id: 'q16', icon: '🎬', text: 'Build a Drive-In', stat: 'owns', def: 'cinema', target: 1, coins: 2000, xp: 120, level: 6 },
  { id: 'q17', icon: '🗺', text: 'Clear campaign chapter 3', stat: 'chapters', target: 3, coins: 2500, xp: 150, bucks: 1 },
  { id: 'g13', icon: '🏗', text: 'Place 10 new buildings', stat: 'built', target: 10, coins: 1500, xp: 100 },
  { id: 'q18', icon: '🪽', text: 'Fit 5 car mods', stat: 'modsBought', target: 5, coins: 2500, xp: 150 },
  { id: 'q19', icon: '💪', text: 'Reach 250 garage power', stat: 'power', target: 250, coins: 2500, xp: 150 },
  { id: 'g14', icon: '🍕', text: 'Collect from 60 businesses', stat: 'jobs', target: 60, coins: 2500, xp: 150, bucks: 2 },
  { id: 'q20', icon: '⭐', text: 'Reach level 8', stat: 'level', target: 8, coins: 3000, xp: 0, bucks: 1 },
  { id: 'q21', icon: '🏢', text: 'Upgrade a building to level 5', stat: 'bldgLevel', target: 5, coins: 3000, xp: 200 },
  { id: 'q22', icon: '🅿', text: 'Own 10 cars', stat: 'carsOwned', target: 10, coins: 3000, xp: 200 },
  { id: 'g15', icon: '💰', text: 'Earn 50,000 coins', stat: 'coinsEarned', target: 50000, coins: 5000, xp: 250, bucks: 3 },
  { id: 'g16', icon: '🏁', text: 'Win 25 drag races', stat: 'racesWon', target: 25, coins: 5000, xp: 250, bucks: 3 },
  { id: 'q23', icon: '🗺', text: 'Clear campaign chapter 5', stat: 'chapters', target: 5, coins: 6000, xp: 300, bucks: 2 },
  { id: 'q24', icon: '🏆', text: 'Win 3 Grand Prix series', stat: 'gpWins', target: 3, coins: 6000, xp: 300, bucks: 2, level: 5 },
  { id: 'q25', icon: '⭐', text: 'Reach level 10', stat: 'level', target: 10, coins: 6000, xp: 0, bucks: 2 },
  { id: 'q26', icon: '🏟', text: 'Build the Speedway', stat: 'owns', def: 'stadium', target: 1, coins: 8000, xp: 400, level: 16 },
  { id: 'q27', icon: '✨', text: 'Earn 45 campaign stars', stat: 'stars', target: 45, coins: 8000, xp: 400, bucks: 2 },
  { id: 'q28', icon: '🅿', text: 'Own 15 cars', stat: 'carsOwned', target: 15, coins: 8000, xp: 400 },
  { id: 'q29', icon: '🍕', text: 'Collect from 250 businesses', stat: 'jobs', target: 250, coins: 10000, xp: 500, bucks: 2 },
  { id: 'q30', icon: '🏢', text: 'Upgrade a building to level 10', stat: 'bldgLevel', target: 10, coins: 12000, xp: 600, bucks: 3 },
  { id: 'q31', icon: '💪', text: 'Reach 450 garage power', stat: 'power', target: 450, coins: 12000, xp: 600, bucks: 2 },
  { id: 'q32', icon: '🗺', text: 'Clear every campaign chapter', stat: 'chapters', target: 7, coins: 20000, xp: 800, bucks: 5 },
  { id: 'q33', icon: '🏁', text: 'Win 100 drag races', stat: 'racesWon', target: 100, coins: 20000, xp: 800, bucks: 3 },
  { id: 'q34', icon: '⭐', text: 'Reach level 15', stat: 'level', target: 15, coins: 20000, xp: 0, bucks: 3 },
  { id: 'q35', icon: '✨', text: 'Earn all 105 campaign stars', stat: 'stars', target: 105, coins: 30000, xp: 1000, bucks: 5 },
  { id: 'q36', icon: '💰', text: 'Earn 250,000 coins', stat: 'coinsEarned', target: 250000, coins: 30000, xp: 1000, bucks: 3 },
  { id: 'q37', icon: '🅿', text: 'Own 20 cars', stat: 'carsOwned', target: 20, coins: 30000, xp: 1000, bucks: 3 },
  { id: 'q38', icon: '⭐', text: 'Reach level 20', stat: 'level', target: 20, coins: 50000, xp: 0, bucks: 5 },
  // Spooky Season.
  { id: 'sp1', icon: '🎃', text: 'Place a Pumpkin Patch', stat: 'owns', def: 'pumpkins', target: 1, coins: 300, xp: 25, event: 'spooky' },
  { id: 'sp2', icon: '👻', text: 'Place 4 spooky decorations', stat: 'spooky', target: 4, coins: 1000, xp: 60, bucks: 1, event: 'spooky' },
  { id: 'sp3', icon: '🌳', text: 'Grow a Haunted Tree', stat: 'owns', def: 'deadtree', target: 1, coins: 1500, xp: 80, event: 'spooky', level: 3 },
  { id: 'sp4', icon: '🦇', text: 'Place 10 spooky decorations', stat: 'spooky', target: 10, coins: 3000, xp: 150, bucks: 3, event: 'spooky' },
]

// Daily and weekly tasks: three each, drawn per UTC day or ISO week from the pools below,
// with targets fixed when they're drawn. Every task in a period pays the same, scaled by level,
// and finishing all three opens a chest. needs: a building the player must own; level: unlock level.
export type TaskDef = { id: string; icon: string; stat: CounterKey; text: string; n: (level: number) => number; level?: number; needs?: string }
const round = (n: number, to: number) => Math.max(to, Math.round(n / to) * to)
export const DAILY_TASKS: TaskDef[] = [
  { id: 'jobs', icon: '🍕', stat: 'jobs', text: 'Collect from # businesses', n: (l) => Math.min(8 + l * 2, 40) },
  { id: 'coins', icon: '💰', stat: 'coinsEarned', text: 'Earn # coins', n: (l) => round(1500 + l * 700, 500) },
  { id: 'races', icon: '🏁', stat: 'races', text: 'Race # times', n: () => 3 },
  { id: 'wins', icon: '🏆', stat: 'racesWon', text: 'Win # races', n: () => 2 },
  { id: 'campaign', icon: '🗺', stat: 'campaignWins', text: 'Win # campaign race', n: () => 1 },
  { id: 'search', icon: '🔍', stat: 'searches', text: "Search # time at Rusty's", n: () => 1, needs: 'rescue' },
  { id: 'upgrade', icon: '⬆', stat: 'upgrades', text: 'Do # upgrade', n: () => 1 },
  { id: 'build', icon: '🏗', stat: 'built', text: 'Place # new building', n: () => 1 },
  { id: 'service', icon: '⛽', stat: 'serviced', text: 'Service # stranded cars', n: () => 2, needs: 'gas' },
  { id: 'paint', icon: '🎨', stat: 'painted', text: 'Paint # car', n: () => 1, level: 2 },
]
export const WEEKLY_TASKS: TaskDef[] = [
  { id: 'jobs', icon: '🍕', stat: 'jobs', text: 'Collect from # businesses', n: (l) => Math.min(60 + l * 10, 250) },
  { id: 'coins', icon: '💰', stat: 'coinsEarned', text: 'Earn # coins', n: (l) => round(12000 + l * 5000, 1000) },
  { id: 'wins', icon: '🏆', stat: 'racesWon', text: 'Win # races', n: () => 15 },
  { id: 'campaign', icon: '🗺', stat: 'campaignWins', text: 'Win # campaign races', n: () => 5 },
  { id: 'search', icon: '🔍', stat: 'searches', text: "Search # times at Rusty's", n: () => 5, needs: 'rescue' },
  { id: 'upgrade', icon: '⬆', stat: 'upgrades', text: 'Do # upgrades', n: () => 8 },
  { id: 'build', icon: '🏗', stat: 'built', text: 'Place # new buildings', n: () => 5 },
  { id: 'gp', icon: '🏆', stat: 'gpWins', text: 'Win # Grand Prix series', n: () => 1, level: 2 },
  { id: 'mods', icon: '🪽', stat: 'modsBought', text: 'Fit # car mods', n: () => 2, level: 3 },
]
export const TASKS_PER_PERIOD = 3
// What each task and each chest pays. The server guard reads these from econ_catalog().quests.
export type TaskPay = { coins: number; coinsPerLevel: number; xp: number; xpPerLevel: number }
export type ChestPay = TaskPay & { parts: number; bucks: number; fuel: number }
export const QUEST_PAY: Record<'daily' | 'weekly', { task: TaskPay; chest: ChestPay }> = {
  daily: {
    task: { coins: 150, coinsPerLevel: 50, xp: 20, xpPerLevel: 5 },
    chest: { coins: 300, coinsPerLevel: 100, xp: 0, xpPerLevel: 0, parts: 5, bucks: 0, fuel: 10 },
  },
  weekly: {
    task: { coins: 500, coinsPerLevel: 150, xp: 100, xpPerLevel: 20 },
    chest: { coins: 1000, coinsPerLevel: 250, xp: 0, xpPerLevel: 0, parts: 20, bucks: 3, fuel: 0 },
  },
}
export const payAt = (p: TaskPay, level: number) => ({ coins: p.coins + p.coinsPerLevel * level, xp: p.xp + p.xpPerLevel * level })

// UTC calendar keys: the day like 2026-10-11 and the ISO week like 2026-W41.
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10)
export function weekKey(t = Date.now()) {
  const d = new Date(t)
  const day = (d.getUTCDay() + 6) % 7 // Monday 0
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3))
  const week = Math.ceil(((thu.getTime() - Date.UTC(thu.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
// Milliseconds until the next UTC midnight, and until the next Monday 00:00 UTC.
export const msToNextDay = (t = Date.now()) => 86400000 - (t % 86400000)
export const msToNextWeek = (t = Date.now()) => msToNextDay(t) + ((7 - ((new Date(t).getUTCDay() + 6) % 7) - 1) * 86400000)

// ---- Season track ----
// Six-week seasons, numbered from the first one. Stars come from daily and weekly task rewards, and
// every STARS_PER_TIER stars unlock the next tier's prize. The last tier gives the season's own car.
export const SEASON_START = Date.UTC(2026, 9, 5) // Monday 5 Oct 2026, 00:00 UTC
export const SEASON_DAYS = 42
export const STARS_PER_TIER = 8
export const SEASON_STARS = { dailyTask: 1, dailyChest: 3, weeklyTask: 3, weeklyChest: 6 }
export type SeasonDef = { n: number; name: string; icon: string; car?: string }
const SEASON_NAMES: Omit<SeasonDef, 'n'>[] = [
  { name: 'Midnight Run', icon: '🌙', car: 'nightfall' },
]
export const seasonNumber = (t = Date.now()) => Math.max(1, Math.floor((t - SEASON_START) / (SEASON_DAYS * 86400000)) + 1)
export function seasonOf(n: number): SeasonDef {
  const d = SEASON_NAMES[n - 1]
  return d ? { n, ...d } : { n, name: `Season ${n}`, icon: '🏁' }
}
export const seasonEndsAt = (n: number) => SEASON_START + n * SEASON_DAYS * 86400000
// The last tier of a season without its own car pays bucks instead.
export const SEASON_CAR_BUCKS = 15
export const seasonCars = () => Object.fromEntries(SEASON_NAMES.flatMap((d, i) => (d.car ? [[String(i + 1), d.car]] : [])))

export type SeasonPrize = { coins: number; parts: number; bucks: number; car?: boolean }
// 30 tiers: coins and parts most of the way, bucks every fifth tier, the car (or bucks) at the end.
export const SEASON_TIERS: SeasonPrize[] = Array.from({ length: 30 }, (_, i): SeasonPrize => {
  const t = i + 1
  if (t === 30) return { coins: 0, parts: 0, bucks: 0, car: true }
  if (t % 5 === 0) return { coins: 0, parts: 0, bucks: t / 5 + 1 }
  if (t % 2 === 0) return { coins: 0, parts: 5 + Math.floor(t / 3) * 2, bucks: 0 }
  return { coins: 500 + t * 150, parts: 0, bucks: 0 }
})

// Picks a period's tasks: a fixed shuffle per key, so every device draws the same three.
export function drawTasks(pool: TaskDef[], key: string, level: number, owned: (def: string) => boolean) {
  let h = 2166136261
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  const ok = pool.filter((t) => level >= (t.level ?? 1) && (!t.needs || owned(t.needs)))
  for (let i = ok.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[ok[i], ok[j]] = [ok[j], ok[i]]
  }
  return ok.slice(0, TASKS_PER_PERIOD).map((t) => ({ id: t.id, n: t.n(level) }))
}

// Daily login bonus by streak day (repeats the last entry).
export const FLAT_CHANCE = 0.2
export const LOW_FUEL_CHANCE = 0.15
// What your own Tire Shop or Gas Station earns for servicing a stranded car.
export const servicePay = (level: number, kind: 'tires' | 'gas') => (kind === 'tires' ? 60 + level * 15 : 40 + level * 10)
export const gasCanCost = (level: number) => 30 + level * 15
export const flatFixCost = (level: number) => 50 + level * 25

export const PAINTS: { color: string; name: string; bucks?: number; earn?: 'road' | 'first' | 'tour' }[] = [
  { color: '#e53935', name: 'Fire Red' }, { color: '#fb8c00', name: 'Sunset' }, { color: '#fdd835', name: 'Taxi' },
  { color: '#43a047', name: 'Racing Green' }, { color: '#00acc1', name: 'Lagoon' }, { color: '#1e88e5', name: 'Royal Blue' },
  { color: '#3949ab', name: 'Midnight' }, { color: '#8e24aa', name: 'Grape' }, { color: '#ec407a', name: 'Bubblegum' },
  { color: '#fafafa', name: 'Pearl' }, { color: '#9e9e9e', name: 'Silver' }, { color: '#212121', name: 'Jet Black' },
  { color: '#6d4c41', name: 'Mocha' },
  { color: '#ff7a5c', name: 'Coral' }, { color: '#81d4fa', name: 'Sky' }, { color: '#c0703a', name: 'Copper' },
  { color: '#b39ddb', name: 'Lavender' }, { color: '#7d8a2c', name: 'Olive' }, { color: '#8c1d40', name: 'Burgundy' },
  { color: '#00796b', name: 'Deep Teal' },
  { color: '#ffd700', name: 'Gold Flake', bucks: 1 }, { color: '#76ff03', name: 'Neon Lime', bucks: 1 },
  { color: '#ff00e5', name: 'Hot Magenta', bucks: 1 }, { color: '#00e5ff', name: 'Ice Neon', bucks: 1 },
  // Earned only: on the Trophy Road (game/trophyRoad.ts) or by the first win in a car of a class (game/mastery.ts).
  { color: '#6fdcab', name: 'Mint', earn: 'road' }, { color: '#ffb38a', name: 'Peach', earn: 'road' },
  { color: '#2446c8', name: 'Cobalt', earn: 'road' }, { color: '#e0a899', name: 'Rose Gold', earn: 'road' },
  { color: '#f4e04d', name: 'Lemon', earn: 'road' }, { color: '#5b2a6e', name: 'Plum', earn: 'road' },
  { color: '#ff6f00', name: 'Tangerine', earn: 'road' }, { color: '#4a535c', name: 'Gunmetal', earn: 'road' },
  { color: '#9fd8cb', name: 'Sea Glass', earn: 'road' }, { color: '#d2042d', name: 'Cherry', earn: 'road' },
  { color: '#a4e22b', name: 'Zest', earn: 'first' }, { color: '#c1440e', name: 'Rust Orange', earn: 'first' },
  { color: '#0f7b5f', name: 'Paddock Green', earn: 'first' }, { color: '#1a1446', name: 'Afterburner', earn: 'first' },
  { color: '#c8a165', name: 'Sandstorm', earn: 'first' }, { color: '#ff4fa3', name: 'Bubblegum Pop', earn: 'first' },
  // Won only by beating the whole World Tour (game/worldTour.ts).
  { color: '#8fd8ff', name: 'Tour Blue', earn: 'tour' },
]
// The colours every new town can paint with. The rest are won from paint rivals (game/paintRivals.ts).
export const STARTER_PAINTS = ['#e53935', '#1e88e5', '#fafafa', '#212121']
// The coin colours from before paint rivals: towns that had them keep them.
export const LEGACY_PAINTS = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#3949ab', '#8e24aa', '#ec407a', '#fafafa', '#9e9e9e', '#212121', '#6d4c41']
export const STRIPES = [null, '#fafafa', '#212121', '#e53935', '#fdd835', '#1e88e5']
export const PAINT_COST = 150
export const STRIPE_COST = 100

// How the paint catches the light. Glossy is the factory finish every car comes with.
// Gold, Diamond and Galaxy are class mastery finishes (game/mastery.ts): free, but only on a car
// whose class has reached that tier (`mastery`: 1 Gold, 2 Diamond, 3 Galaxy), never sold.
export type Finish = 'gloss' | 'matte' | 'chrome' | 'gold' | 'diamond' | 'galaxy'
export const FINISHES: { id: Finish; name: string; coins: number; unlockLevel: number; blurb: string; mastery?: number }[] = [
  { id: 'gloss', name: 'Glossy', coins: 150, unlockLevel: 1, blurb: 'Factory shine' },
  { id: 'matte', name: 'Matte', coins: 400, unlockLevel: 1, blurb: 'Flat, no shine' },
  { id: 'chrome', name: 'Chrome', coins: 2500, unlockLevel: 8, blurb: 'Mirror metal in your colour' },
  { id: 'gold', name: 'Gold', coins: 0, unlockLevel: 1, blurb: 'Gold: master 3 cars in this class', mastery: 1 },
  { id: 'diamond', name: 'Diamond', coins: 0, unlockLevel: 1, blurb: 'Diamond: master 6 cars in this class', mastery: 2 },
  { id: 'galaxy', name: 'Galaxy', coins: 0, unlockLevel: 1, blurb: 'Galaxy: Diamond in every class', mastery: 3 },
]
export const finishDef = (id?: Finish | null) => FINISHES.find((f) => f.id === id) ?? FINISHES[0]
// Material numbers for each finish: [metalness, roughness, how far the colour is lifted, and
// towards what (white when left out)]. The mastery metals pull your colour towards their own.
export const FINISH_LOOK: Record<Finish, [number, number, number, string?]> = {
  gloss: [0.4, 0.3, 0], matte: [0.05, 0.92, 0], chrome: [1, 0.12, 0.15],
  gold: [0.95, 0.2, 0.62, '#ffc83d'], diamond: [0.7, 0.08, 0.6, '#e6f7ff'], galaxy: [0.85, 0.15, 0.6, '#3b1f8f'],
}

export type PaintJob = { color: string; finish: Finish; stripe: string | null }
// What a paint job costs on a car: each part that changes is charged once. A neon or
// gold colour costs a buck instead of coins; taking stripes off is free.
export function paintJobCost(car: { color: string; finish?: Finish; stripe?: string | null }, job: PaintJob) {
  let coins = 0
  let bucks = 0
  if (job.color !== car.color) {
    const p = PAINTS.find((x) => x.color === job.color)
    if (p?.bucks) bucks += p.bucks
    else coins += PAINT_COST
  }
  if (job.finish !== (car.finish ?? 'gloss')) coins += finishDef(job.finish).coins
  if (job.stripe !== (car.stripe ?? null) && job.stripe) coins += STRIPE_COST
  return { coins, bucks }
}

// ---- Custom parts ----
// One panel painted on its own: the hood, the doors, the roof or the rims, each in any
// paint-chart colour and (but the rims) a pattern, plus a pattern over the whole body.
// A panel left alone matches the body. Drawn by src/scene/panelPaint.ts.
export type PanelId = 'body' | 'hood' | 'doors' | 'roof' | 'rims'
export type PanelPaint = { color?: string; pattern?: string }
export type Panels = Partial<Record<PanelId, PanelPaint>>
// color / pattern: what the panel can take. car: cars only (bikes have no hood, doors or roof).
export const PANELS: { id: PanelId; name: string; color: boolean; pattern: boolean; car: boolean }[] = [
  { id: 'body', name: 'Body', color: false, pattern: true, car: false },
  { id: 'hood', name: 'Hood', color: true, pattern: true, car: true },
  { id: 'doors', name: 'Doors', color: true, pattern: true, car: true },
  { id: 'roof', name: 'Roof', color: true, pattern: true, car: true },
  { id: 'rims', name: 'Wheels', color: true, pattern: false, car: false },
]
// Patterns are painted in shades of the panel's own colour, so pink camo is pink.
// n: the shader's number for it (panelPaint.ts). trial: only won, by a first win in
// that Tuner Trial (game/tuner.ts).
// mastery: only on a car model with that mastery tier (Signature). road: only once won on the
// Trophy Road (game/trophyRoad.ts). Both are free once open.
export type PatternDef = { id: string; n: number; name: string; coins: number; unlockLevel: number; trial?: string; mastery?: number; road?: true }
export const PATTERNS: PatternDef[] = [
  { id: 'camo', n: 1, name: 'Camo', coins: 600, unlockLevel: 1 },
  { id: 'checker', n: 4, name: 'Checker', coins: 800, unlockLevel: 2 },
  { id: 'digicamo', n: 2, name: 'Digi Camo', coins: 900, unlockLevel: 3 },
  { id: 'tiger', n: 3, name: 'Tiger', coins: 1200, unlockLevel: 5 },
  { id: 'carbon', n: 5, name: 'Carbon', coins: 1500, unlockLevel: 8 },
  { id: 'hex', n: 6, name: 'Hex', coins: 1000, unlockLevel: 1, trial: 'downforce' },
  { id: 'splatter', n: 7, name: 'Splatter', coins: 1200, unlockLevel: 1, trial: 'featherweight' },
  { id: 'flames', n: 8, name: 'Flames', coins: 2000, unlockLevel: 1, trial: 'tunerking' },
  { id: 'signature', n: 9, name: 'Signature', coins: 0, unlockLevel: 1, mastery: 3 },
  { id: 'pinstripe', n: 10, name: 'Pinstripe', coins: 0, unlockLevel: 1, road: true },
  { id: 'polka', n: 11, name: 'Polka', coins: 0, unlockLevel: 1, road: true },
]
export const patternDef = (id?: string | null) => PATTERNS.find((p) => p.id === id)
export const PANEL_COLOR_COST = 200
export const RIM_COLOR_COST = 150

// Panels with nothing on them dropped, so a car with none has no `panels` at all.
export function tidyPanels(p?: Panels | null): Panels | undefined {
  const out: Panels = {}
  for (const { id } of PANELS) {
    const v = p?.[id]
    if (!v) continue
    const one: PanelPaint = {}
    if (v.color) one.color = v.color
    if (v.pattern) one.pattern = v.pattern
    if (one.color || one.pattern) out[id] = one
  }
  return Object.keys(out).length ? out : undefined
}

// What changing a car's panels costs: each new colour or pattern once; a gem colour
// costs a gem instead of coins. Taking one off is free.
export function panelJobCost(was: Panels | null | undefined, next: Panels | null | undefined) {
  let coins = 0
  let bucks = 0
  for (const { id } of PANELS) {
    const a = was?.[id]
    const b = next?.[id]
    if (b?.color && b.color !== a?.color) {
      const p = PAINTS.find((x) => x.color === b.color)
      if (p?.bucks) bucks += p.bucks
      else coins += id === 'rims' ? RIM_COLOR_COST : PANEL_COLOR_COST
    }
    if (b?.pattern && b.pattern !== a?.pattern) coins += patternDef(b.pattern)?.coins ?? 0
  }
  return { coins, bucks }
}

// ---- Skins ----
// Animated patterns that sit at depth inside a car's paint and shift as it turns
// (drawn by src/scene/skins.ts, picked by `n`). A skin is unlocked once for the whole
// garage and can go on any car, over any colour and finish, for free.
// How each is unlocked: reaching a level, claiming a collection set, a season track
// tier, gems, only from crates, or only by clearing a weekly event (game/events.ts). Saves keep bought and won skins in `skins`;
// level and set unlocks are worked out from the save, so they can't be lost.
export type SkinTier = 'rare' | 'epic' | 'legendary'
export type SkinUnlock = { level: number } | { set: string } | { season: number } | { bucks: number } | { crate: true } | { event: string }
export type SkinDef = { id: string; n: number; name: string; tier: SkinTier; blurb: string; unlock: SkinUnlock; swatch: string }
export const SKIN_TIERS: Record<SkinTier, { name: string; color: string }> = {
  rare: { name: 'Rare', color: '#4fc3f7' },
  epic: { name: 'Epic', color: '#c77dff' },
  legendary: { name: 'Legendary', color: '#ffc94d' },
}
export const SKINS: SkinDef[] = [
  { id: 'hexcore', n: 1, name: 'Hexcore', tier: 'rare', blurb: 'Glowing honeycomb with a pulse', unlock: { level: 3 },
    swatch: 'radial-gradient(circle at 50% 50%, #19e3ff 0 8%, transparent 9%), conic-gradient(from 30deg, #0b2a36, #19e3ff 10%, #0b2a36 20%, #0b2a36 50%, #19e3ff 60%, #0b2a36 70%)' },
  { id: 'riptide', n: 7, name: 'Riptide', tier: 'rare', blurb: 'Waves rolling at three depths', unlock: { set: 'daily' },
    swatch: 'repeating-linear-gradient(170deg, #062a4a 0 5px, #6fe7ff 6px 7px, #0a3d6b 8px 12px)' },
  { id: 'overclock', n: 2, name: 'Overclock', tier: 'rare', blurb: 'Circuit traces with racing data', unlock: { level: 10 },
    swatch: 'linear-gradient(90deg, transparent 45%, #39ff88 45% 55%, transparent 55%), linear-gradient(0deg, transparent 70%, #39ff88 70% 78%, transparent 78%), #0c2416' },
  { id: 'static', n: 8, name: 'Static', tier: 'rare', blurb: 'Pixels blinking under the coat', unlock: { bucks: 10 },
    swatch: 'conic-gradient(#ff29b3 0 25%, #101018 0 50%, #19f2ff 0 75%, #ffe633 0) 0 0 / 10px 10px' },
  { id: 'contour', n: 16, name: 'Contour', tier: 'rare', blurb: 'Glowing map lines over hidden hills', unlock: { set: 'roadtrip' },
    swatch: 'repeating-radial-gradient(circle at 35% 60%, #062022 0 5px, #ffb347 6px 7px, #062022 8px 12px, #1abc9c 13px 14px)' },
  { id: 'cascade', n: 17, name: 'Cascade', tier: 'rare', blurb: 'Amber code raining down the panels', unlock: { level: 15 },
    swatch: 'repeating-linear-gradient(90deg, transparent 0 3px, #120800 3px 6px), linear-gradient(180deg, #120800, #ff8c1a 70%, #ffe7b3)' },
  { id: 'ghostcamo', n: 19, name: 'Ghost Camo', tier: 'rare', blurb: 'Pixel camo that shifts colour as it turns', unlock: { set: 'heavy' },
    swatch: 'conic-gradient(#1b4d3e 0 25%, #2fd3a0 0 50%, #0b1f2a 0 75%, #7a5cff 0) 0 0 / 9px 9px' },
  { id: 'deepspace', n: 3, name: 'Deep Space', tier: 'epic', blurb: 'Stars and nebula at every depth', unlock: { season: 10 },
    swatch: 'radial-gradient(circle at 30% 30%, #fff 0 4%, transparent 5%), radial-gradient(circle at 70% 60%, #cde 0 3%, transparent 4%), radial-gradient(circle at 60% 30%, #7a2aa8, transparent 60%), #05061a' },
  { id: 'faultline', n: 5, name: 'Fault Line', tier: 'epic', blurb: 'Lava glowing through cracked plates', unlock: { set: 'muscle' },
    swatch: 'linear-gradient(120deg, #241612 40%, #ff6a00 42%, #ffd54f 44%, #241612 46%), linear-gradient(30deg, #2e1d17 60%, #ff3d00 61%, #2e1d17 63%)' },
  { id: 'aurora', n: 6, name: 'Aurora', tier: 'epic', blurb: 'Northern lights swaying deep inside', unlock: { bucks: 20 },
    swatch: 'linear-gradient(170deg, transparent 20%, #3dff9e 40%, transparent 55%, #b24dff 75%, transparent 90%), #051226' },
  { id: 'thunderhead', n: 15, name: 'Thunderhead', tier: 'epic', blurb: 'Storm clouds with lightning inside', unlock: { crate: true },
    swatch: 'linear-gradient(100deg, transparent 46%, #e8f1ff 47% 49%, transparent 50%), radial-gradient(circle at 50% 40%, #5a6380, #121626 70%)' },
  { id: 'biolume', n: 18, name: 'Biolume', tier: 'epic', blurb: 'Glowing jellies drifting in the deep', unlock: { crate: true },
    swatch: 'radial-gradient(circle at 35% 40%, #ff4fc4 0 12%, transparent 22%), radial-gradient(circle at 70% 70%, #8c4dff 0 8%, transparent 16%), radial-gradient(circle at 65% 25%, #33ffd6 0 3%, transparent 4%), #00101c' },
  { id: 'nightdrive', n: 22, name: 'Night Drive', tier: 'epic', blurb: 'Striped sunset under a neon grid', unlock: { bucks: 20 },
    swatch: 'repeating-linear-gradient(0deg, transparent 0 7px, #ff36d8 7px 8px), radial-gradient(circle at 50% 60%, #ffd84d 0 22%, #ff3d8b 30%, #2a0040 60%)' },
  { id: 'petalstorm', n: 23, name: 'Petal Storm', tier: 'epic', blurb: 'Blossom petals tumbling at dusk', unlock: { crate: true },
    swatch: 'radial-gradient(ellipse 18% 10% at 30% 35%, #ffc1d6 90%, transparent), radial-gradient(ellipse 14% 8% at 70% 65%, #fff0f5 90%, transparent), linear-gradient(180deg, #2a1240, #b0607a)' },
  { id: 'prismatic', n: 4, name: 'Prismatic', tier: 'legendary', blurb: 'Holo foil that shifts as you turn', unlock: { season: 20 },
    swatch: 'linear-gradient(135deg, #ff5f6d, #ffc371, #f9f871, #67f3a4, #4facfe, #b06ab3, #ff5f6d)' },
  { id: 'horizon', n: 9, name: 'Event Horizon', tier: 'legendary', blurb: 'A turning spiral of fire and violet', unlock: { bucks: 35 },
    swatch: 'radial-gradient(circle, #000 0 18%, #ff7a1a 24%, #9c3dff 38%, #12051f 60%)' },
  { id: 'coldsnap', n: 10, name: 'Cold Snap', tier: 'legendary', blurb: 'Shattered ice in white and teal', unlock: { bucks: 35 },
    swatch: 'linear-gradient(115deg, #d9eef0 0 28%, #0d2a33 29% 30%, #7fc3cb 31% 52%, #0d2a33 53% 54%, #3f8e99 55% 74%, #0d2a33 75% 76%, #eef8f9 77%)' },
  { id: 'quicksilver', n: 20, name: 'Quicksilver', tier: 'legendary', blurb: 'Liquid chrome with rippling drops', unlock: { bucks: 35 },
    swatch: 'radial-gradient(circle at 50% 50%, #fff 0 6%, #8a93a0 10%, #f2f4f7 16%, #6b7380 24%, #e6e9ee 34%, #4a515c 60%)' },
  { id: 'wyrmscale', n: 21, name: 'Wyrmscale', tier: 'legendary', blurb: 'Dragon scales with embers in the seams', unlock: { crate: true },
    swatch: 'radial-gradient(circle at 50% 0, #e6b830 0 30%, #0f5a33 55%, #ff5a00 58% 62%, transparent 63%) 0 0 / 12px 10px, #071a10' },
  { id: 'kaleido', n: 24, name: 'Kaleido', tier: 'legendary', blurb: 'Stained glass turning in a kaleidoscope', unlock: { crate: true },
    swatch: 'conic-gradient(#ff4d6d, #ffb703, #3ddc97, #4cc9f0, #7b2cbf, #ff4d6d)' },
  // Weekly event exclusives (game/events.ts): never sold, never in crates.
  { id: 'hoarfrost', n: 28, name: 'Hoarfrost', tier: 'legendary', blurb: 'Frost ferns creeping over glass, snow drifting under it', unlock: { event: 'whiteout' },
    swatch: 'repeating-conic-gradient(from 10deg at 30% 70%, #eaf6ff 0 4deg, transparent 4deg 22deg), radial-gradient(circle at 60% 30%, #9fd4ff, #1d3b5c 75%)' },
  { id: 'harvestmoon', n: 29, name: 'Harvest Moon', tier: 'legendary', blurb: 'A giant moon rising behind swaying wheat and fireflies', unlock: { event: 'harvestmoon' },
    swatch: 'linear-gradient(0deg, #1a0d05 0 22%, transparent 22%), radial-gradient(circle at 55% 45%, #ffd27a 0 20%, #ff8a2a 26%, transparent 28%), linear-gradient(180deg, #0b0a2a, #3a1d3f)' },
  { id: 'beacon', n: 30, name: 'Beacon', tier: 'legendary', blurb: 'A lighthouse beam sweeping through night fog', unlock: { event: 'foghorn' },
    swatch: 'conic-gradient(from 200deg at 20% 80%, transparent 0 20deg, #fff6c8 24deg 34deg, transparent 40deg), linear-gradient(180deg, #2b3a4d, #0a1420)' },
  { id: 'rainglass', n: 31, name: 'Rain Glass', tier: 'legendary', blurb: 'Raindrops running over a blur of neon city lights', unlock: { event: 'neondownpour' },
    swatch: 'radial-gradient(circle at 25% 35%, #ff4fd8 0 10%, transparent 18%), radial-gradient(circle at 70% 60%, #33e1ff 0 12%, transparent 20%), radial-gradient(circle at 55% 25%, #ffd84a 0 6%, transparent 12%), #0b0b1e' },
  { id: 'shallows', n: 32, name: 'Shallows', tier: 'legendary', blurb: 'Sunlight dancing over sand ripples under clear water', unlock: { event: 'shallows' },
    swatch: 'repeating-radial-gradient(ellipse at 40% 60%, #e8fff9 0 1px, transparent 2px 7px), linear-gradient(160deg, #3fe0d0, #1a8fa8 60%, #d8c08a)' },
  { id: 'mirage', n: 33, name: 'Mirage', tier: 'legendary', blurb: 'Heat haze rippling over dunes under a white-hot sun', unlock: { event: 'mirage' },
    swatch: 'radial-gradient(circle at 50% 30%, #fffbe6 0 10%, transparent 14%), repeating-linear-gradient(170deg, #e0843a 0 6px, #f6b25e 7px 10px), linear-gradient(180deg, #ffd9a0, #c4572a)' },
]
export const skinDef = (id?: string | null) => (id ? SKINS.find((s) => s.id === id) : undefined)

// Custom Colour: a legendary crate unlock (Diamond Crate paints only) that opens every colour,
// picked from a colour wheel in the Paint and Custom tabs. It isn't a skin to wear, but it drops
// in a crate's paint slice like one and is kept in the save's `skins`, so the server rolls and
// pays it with no new prize kind.
export const CUSTOM_PAINT: SkinDef = {
  id: 'custompaint', n: 0, name: 'Custom Colour', tier: 'legendary', blurb: 'Paint any colour you like', unlock: { crate: true },
  swatch: 'radial-gradient(circle, #fff 0 12%, transparent 60%), conic-gradient(#ff2d2d, #ffd400, #3cff3c, #00e5ff, #2d5bff, #ff2dd2, #ff2d2d)',
}
export const CUSTOM_PAINT_CRATE = 'diamond'
// The off-chart colour a won Custom Colour shows on your car, and tries on first.
export const CUSTOM_PAINT_SHOW = '#19ffb0'
export const hasCustomPaint = (s: { skins?: string[] }) => !!s.skins?.includes(CUSTOM_PAINT.id)
const HEX = /^#[0-9a-f]{6}$/
export const isHexColor = (c: unknown): c is string => typeof c === 'string' && HEX.test(c)
// The shader number for a car's skin, 0 for none (or one this version doesn't know).
export const skinNumber = (id?: string | null) => skinDef(id)?.n ?? 0
// Every skin the player can put on a car right now.
export function ownedSkins(s: { level: number; claimedSets?: string[]; skins?: string[] }, pool = SKINS) {
  return pool.filter((d) => {
    const u = d.unlock
    if (s.skins?.includes(d.id)) return true
    if ('level' in u) return s.level >= u.level
    if ('set' in u) return (s.claimedSets ?? []).includes(u.set)
    return false
  }).map((d) => d.id)
}
// Season track tiers (1-based) that give a skin on top of their usual prize.
export const seasonSkin = (tier: number) => SKINS.find((d) => 'season' in d.unlock && d.unlock.season === tier)

// ---- Mod skins ----
// A second pool, for bolt-on parts: each fitted spoiler, exhaust, body kit and hood
// can wear its own skin, separate from the body's, so effects mix and match. Unlocked
// once for the garage like body skins; saves keep bought and won ones in `modSkins`
// and each car's choices in `modSkin` (by slot).
export type SkinnedSlot = 'spoiler' | 'exhaust' | 'kit' | 'hood'
export const SKINNED_SLOTS: SkinnedSlot[] = ['spoiler', 'exhaust', 'kit', 'hood']
export const MOD_SKINS: SkinDef[] = [
  { id: 'ember', n: 11, name: 'Ember', tier: 'rare', blurb: 'Flames rolling back off the part', unlock: { level: 5 },
    swatch: 'linear-gradient(0deg, #2a0700, #ff3d00 40%, #ffb300 70%, #fff3b0)' },
  { id: 'hexplate', n: 1, name: 'Hex Plate', tier: 'rare', blurb: 'Glowing honeycomb armour', unlock: { level: 7 },
    swatch: 'conic-gradient(from 30deg, #0b2a36, #19e3ff 10%, #0b2a36 20%, #0b2a36 50%, #19e3ff 60%, #0b2a36 70%)' },
  { id: 'neonpulse', n: 12, name: 'Neon Pulse', tier: 'rare', blurb: 'Neon bands sweeping front to back', unlock: { set: 'tuners' },
    swatch: 'repeating-linear-gradient(90deg, #12001f 0 6px, #ff2bd6 7px 9px, #12001f 10px 14px, #2be8ff 15px 16px)' },
  { id: 'tracer', n: 25, name: 'Tracer', tier: 'rare', blurb: 'Light streaks racing back off the part', unlock: { level: 12 },
    swatch: 'linear-gradient(90deg, transparent 20%, #ff2a10 60%, #fff3d6 70%, transparent 71%) 0 3px / 100% 8px, #08080c' },
  { id: 'checkered', n: 27, name: 'Checkered', tier: 'rare', blurb: 'A chequered flag rippling in the wind', unlock: { set: 'track' },
    swatch: 'conic-gradient(#f2f2f2 0 25%, #111 0 50%, #f2f2f2 0 75%, #111 0) 0 0 / 10px 10px' },
  { id: 'goldleaf', n: 14, name: 'Gold Leaf', tier: 'epic', blurb: 'Gold flakes glinting at every depth', unlock: { bucks: 20 },
    swatch: 'radial-gradient(circle at 30% 30%, #fff8d0 0 6%, transparent 7%), radial-gradient(circle at 65% 60%, #fff 0 4%, transparent 5%), linear-gradient(135deg, #8a5a00, #ffd34d 50%, #a06a00)' },
  { id: 'carbonprism', n: 13, name: 'Carbon Prism', tier: 'epic', blurb: 'Carbon weave over a rainbow sheen', unlock: { season: 15 },
    swatch: 'repeating-linear-gradient(45deg, rgba(0,0,0,.75) 0 3px, transparent 3px 6px), linear-gradient(135deg, #ff5f6d, #f9f871, #67f3a4, #4facfe, #b06ab3)' },
  { id: 'starlight', n: 3, name: 'Starlight', tier: 'epic', blurb: 'A pocket of deep space', unlock: { crate: true },
    swatch: 'radial-gradient(circle at 30% 30%, #fff 0 4%, transparent 5%), radial-gradient(circle at 70% 60%, #cde 0 3%, transparent 4%), #05061a' },
  { id: 'toxic', n: 26, name: 'Toxic', tier: 'epic', blurb: 'Bubbling green sludge', unlock: { crate: true },
    swatch: 'radial-gradient(circle at 30% 40%, transparent 0 12%, #c6ff4d 14% 17%, transparent 18%), radial-gradient(circle at 70% 65%, #b2ff3d, #2f7a00 60%, #0d2600)' },
  { id: 'stormcell', n: 15, name: 'Storm Cell', tier: 'epic', blurb: 'A pocket of lightning', unlock: { crate: true },
    swatch: 'linear-gradient(100deg, transparent 46%, #e8f1ff 47% 49%, transparent 50%), radial-gradient(circle at 50% 40%, #5a6380, #121626 70%)' },
  { id: 'biobloom', n: 18, name: 'Biobloom', tier: 'epic', blurb: 'Deep-sea glow to match Biolume', unlock: { crate: true },
    swatch: 'radial-gradient(circle at 35% 40%, #ff4fc4 0 12%, transparent 22%), radial-gradient(circle at 65% 25%, #33ffd6 0 3%, transparent 4%), #00101c' },
  { id: 'holofoil', n: 4, name: 'Holo Foil', tier: 'legendary', blurb: 'Rainbow foil that rolls as you turn', unlock: { bucks: 35 },
    swatch: 'linear-gradient(135deg, #ff5f6d, #ffc371, #f9f871, #67f3a4, #4facfe, #b06ab3)' },
  { id: 'rime', n: 10, name: 'Rime', tier: 'legendary', blurb: 'Shattered ice to match Cold Snap', unlock: { bucks: 35 },
    swatch: 'linear-gradient(115deg, #d9eef0 0 28%, #0d2a33 29% 30%, #7fc3cb 31% 52%, #0d2a33 53% 54%, #3f8e99 55% 74%, #0d2a33 75% 76%, #eef8f9 77%)' },
  { id: 'mercury', n: 20, name: 'Mercury', tier: 'legendary', blurb: 'Liquid chrome to match Quicksilver', unlock: { bucks: 35 },
    swatch: 'radial-gradient(circle at 50% 50%, #fff 0 6%, #8a93a0 10%, #f2f4f7 16%, #6b7380 24%, #e6e9ee 34%, #4a515c 60%)' },
  { id: 'dragonhide', n: 21, name: 'Dragonhide', tier: 'legendary', blurb: 'Ember-seamed scales to match Wyrmscale', unlock: { crate: true },
    swatch: 'radial-gradient(circle at 50% 0, #e6b830 0 30%, #0f5a33 55%, #ff5a00 58% 62%, transparent 63%) 0 0 / 12px 10px, #071a10' },
]
export const modSkinDef = (id?: string | null) => (id ? MOD_SKINS.find((s) => s.id === id) : undefined)
export const modSkinNumber = (id?: string | null) => modSkinDef(id)?.n ?? 0
// Every mod skin the player can put on a part right now.
export const ownedModSkins = (s: { level: number; claimedSets?: string[]; modSkins?: string[] }) =>
  ownedSkins({ level: s.level, claimedSets: s.claimedSets, skins: s.modSkins }, MOD_SKINS)
export const seasonModSkin = (tier: number) => MOD_SKINS.find((d) => 'season' in d.unlock && d.unlock.season === tier)

// Garage power: the combined PI of a player's five best cars.
export const POWER_CARS = 5
export const garagePower = (cars: { model: string; upgrades: Record<UpgradeSlot, number>; mods?: string[] }[]) =>
  cars
    .map((c) => performance(carDef(c.model), c.upgrades, c.mods))
    .sort((a, b) => b - a)
    .slice(0, POWER_CARS)
    .reduce((a, b) => a + b, 0)

export const CLAN_COST = 2000
export const CLAN_CAP = 20
export const CLAN_EMBLEMS = ['🏁', '🔥', '⚡', '🦅', '🐺', '💀', '👑', '🚀', '🐉', '⭐', '🏎️', '🛞']
export const CLAN_COLORS = ['#ff7043', '#e53935', '#8e24aa', '#1e88e5', '#00897b', '#43a047', '#fdd835', '#546e7a']

// Daily deals: three discounted items a day, the same for everyone, each usable once.
// Each slot rotates through its own list by UTC day number: list[(day * step + slot) % length].
// The server guard rebuilds the same three from econ_catalog().deals, so keep the formula simple.
export type DealKind = 'parts' | 'fuel' | 'decor' | 'mod' | 'paint'
export type DealDef = { id: string; kind: DealKind; item?: string; n?: number; off: number }
export const DEAL_SLOTS: { name: string; step: number; deals: DealDef[] }[] = [
  {
    name: 'Supplies', step: 3, deals: [
      { id: 'parts10', kind: 'parts', n: 10, off: 0.4 },
      { id: 'fuel', kind: 'fuel', off: 0.67 },
      { id: 'parts25', kind: 'parts', n: 25, off: 0.4 },
      { id: 'parts50', kind: 'parts', n: 50, off: 0.4 },
    ],
  },
  {
    name: 'Car shop', step: 5, deals: [
      ...(['chrome', 'twintips', 'vented', 'ducktail', 'streetkit'] as const).map((m) => ({ id: `mod-${m}`, kind: 'mod' as const, item: m, off: 0.4 })),
      { id: 'paint-matte', kind: 'paint', item: 'matte', off: 0.5 },
      ...(['goldmesh', 'ramscoop', 'sidepipes', 'gtwing', 'widebody', 'blower', 'forged'] as const).map((m) => ({ id: `mod-${m}`, kind: 'mod' as const, item: m, off: 0.3 })),
      { id: 'paint-chrome', kind: 'paint', item: 'chrome', off: 0.4 },
    ],
  },
  {
    name: 'Town', step: 3, deals: (['fountain', 'pond', 'playground', 'gazebo', 'clocktower', 'billboard', 'hotdog', 'statue'] as const)
      .map((b) => ({ id: `decor-${b}`, kind: 'decor' as const, item: b, off: 0.4 })),
  },
]
export const DEALS: DealDef[] = DEAL_SLOTS.flatMap((s) => s.deals)
export const dealDef = (id: string) => DEALS.find((d) => d.id === id)
export const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000)
export const dealsFor = (day: string): DealDef[] => {
  const n = dayNumber(day)
  return DEAL_SLOTS.map((s, i) => s.deals[(((n * s.step + i) % s.deals.length) + s.deals.length) % s.deals.length])
}

const off10 = (n: number, off: number) => Math.round((n * (1 - off)) / 10) * 10
export type DealOffer = { name: string; icon: string; unlockLevel: number; was: { coins: number; bucks: number }; now: { coins: number; bucks: number }; parts: number }
// What a deal sells and for how much. `parts` is the parts price of a mod (never discounted).
export function dealOffer(d: DealDef): DealOffer {
  switch (d.kind) {
    case 'parts': {
      const n = d.n ?? 0
      return { name: `${n} Parts`, icon: '⚙', unlockLevel: 1, was: { coins: n * 50, bucks: 0 }, now: { coins: off10(n * 50, d.off), bucks: 0 }, parts: 0 }
    }
    case 'fuel':
      return { name: 'Full tank', icon: '⛽', unlockLevel: 1, was: { coins: 0, bucks: REFILL_BUCKS }, now: { coins: 0, bucks: Math.max(1, Math.round(REFILL_BUCKS * (1 - d.off))) }, parts: 0 }
    case 'decor': {
      const b = buildingDef(d.item ?? '')
      return {
        name: b.name, icon: '🌳', unlockLevel: b.unlockLevel,
        was: { coins: b.price, bucks: b.bucks ?? 0 },
        now: { coins: off10(b.price, d.off), bucks: b.bucks ? Math.max(1, Math.round(b.bucks * (1 - d.off))) : 0 },
        parts: 0,
      }
    }
    case 'mod': {
      const m = modDef(d.item ?? '')
      return { name: m?.name ?? 'Mod', icon: '🪽', unlockLevel: m?.unlockLevel ?? 1, was: { coins: m?.coins ?? 0, bucks: 0 }, now: { coins: off10(m?.coins ?? 0, d.off), bucks: 0 }, parts: m?.parts ?? 0 }
    }
    case 'paint': {
      const f = finishDef(d.item as Finish)
      return { name: `${f.name} paint`, icon: '🎨', unlockLevel: f.unlockLevel, was: { coins: f.coins, bucks: 0 }, now: { coins: off10(f.coins, d.off), bucks: 0 }, parts: 0 }
    }
  }
}
// How much town worth a deal adds beyond what was paid, for the server guard. Fuel and
// paint aren't part of town worth, so they need no allowance.
export const dealSave = (d: DealDef) => {
  if (d.kind === 'fuel' || d.kind === 'paint') return 0
  const o = dealOffer(d)
  return o.was.coins - o.now.coins
}

// Crew weekly goal. The server counts the points from each save and checks the target
// (supabase/migrations/0027_crew_weekly_goal.sql, crew_goal_rules()); these copies are for display.
export const CREW_POINTS = { job: 1, race: 3 }
// What a crew chest pays. The server guard reads this from econ_catalog().crew.
export const CREW_CHEST: ChestPay = { coins: 1500, coinsPerLevel: 300, xp: 0, xpPerLevel: 0, parts: 25, bucks: 5, fuel: 0 }

// Surprise visitors in town (src/lib/visitors.ts). For signed-in players the server picks who comes
// and fixes the prize (supabase/migrations/0032_town_visitors.sql, visitor_next()); guests roll here.
//   racer: a street racer to beat (the bonus on top of the race's own prize, paid only on a win)
//   tourist: tips you for the photo op
//   mystery: a mystery car drives by; tap it before it leaves
//   barn: Rusty hears of a barn find and tows the car home to storage (needs Rusty's Rescue)
export type VisitorKind = 'racer' | 'tourist' | 'mystery' | 'barn'
export type VisitorPay = { coins: number; coinsPerLevel: number; xp: number; xpPerLevel: number; parts: number; bucksChance: number }
export const VISITORS: Record<VisitorKind, { weight: number; minutes: number; pay: VisitorPay }> = {
  racer: { weight: 30, minutes: 5, pay: { coins: 60, coinsPerLevel: 15, xp: 0, xpPerLevel: 0, parts: 3, bucksChance: 0.05 } },
  tourist: { weight: 40, minutes: 5, pay: { coins: 30, coinsPerLevel: 6, xp: 3, xpPerLevel: 1, parts: 0, bucksChance: 0 } },
  mystery: { weight: 25, minutes: 0.5, pay: { coins: 60, coinsPerLevel: 12, xp: 10, xpPerLevel: 2, parts: 2, bucksChance: 0.1 } },
  barn: { weight: 5, minutes: 10, pay: { coins: 0, coinsPerLevel: 0, xp: 0, xpPerLevel: 0, parts: 0, bucksChance: 0 } },
}
// Minutes between visitors, and the most a player gets in a UTC day.
export const VISIT_GAP_MIN = 4
export const VISITS_PER_DAY = 30
// Grown gardens, statues and the Clock Tower draw tourists: each level above 1 adds to the
// tourist odds (capped), and a well-grown town gets a small group of campers at once.
// Tourist groups never come sooner than TOURIST_GAP_MIN apart. Guests roll this here; a
// signed-in player's visitor kind comes from the server, so only the group size applies.
export const TOURIST_PER_LEVEL = 8
export const TOURIST_BONUS_MAX = 120
export const TOURIST_GAP_MIN = 5
export const TOURIST_GROUP_MAX = 3
export const touristScore = (buildings: { def: string; level?: number }[]) =>
  buildings.reduce((n, b) => (decorGrows(buildingDef(b.def)) ? n + Math.min(MAX_DECOR_LEVEL, Math.max(1, Math.floor(Number(b.level) || 1))) - 1 : n), 0)
export const touristWeight = (score: number) => VISITORS.tourist.weight + Math.min(TOURIST_BONUS_MAX, Math.max(0, score) * TOURIST_PER_LEVEL)
// How many campers turn up together: one, or two from score 4, three from score 12.
export const touristGroup = (score: number, roll = Math.random()) => {
  const extra = score >= 12 ? 2 : score >= 4 ? 1 : 0
  return 1 + (roll < Math.min(0.75, score * 0.05) ? extra : 0)
}
// At most this many barn finds a UTC day, and their rarity odds (mostly commons), from the cars at
// the spots the player has opened.
export const BARN_PER_DAY = 1
export const BARN_RARITY: Record<Rarity, number> = { common: 70, scarce: 25, rare: 5 }
export const visitorPrize = (kind: VisitorKind, level: number, roll = Math.random()) => {
  const p = VISITORS[kind].pay
  return {
    coins: Math.round(p.coins + p.coinsPerLevel * level),
    xp: Math.round(p.xp + p.xpPerLevel * level),
    parts: p.parts,
    bucks: roll < p.bucksChance ? 1 : 0,
  }
}
