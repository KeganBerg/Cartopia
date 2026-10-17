// Race venues: each drag race runs somewhere different. Only the scenery
// changes; the strip, its length and the physics are identical everywhere,
// so the race referee and rewards don't care which venue was picked.

export type VenueId = 'main' | 'beach' | 'desert' | 'snow' | 'farm' | 'docks'
// The World Tour's own strips, one per country (game/worldTour.ts). They only host World Tour
// races; their scenery lives in scene/world/ and loads when a race there starts.
export type WorldVenueId = 'giza' | 'jaipur' | 'moscow' | 'shanghai' | 'sydney' | 'rome' | 'london' | 'rio' | 'vegas'
export type AnyVenueId = VenueId | WorldVenueId

export type Venue = {
  id: AnyVenueId
  // The original venue whose skies, road surface and ground a World Tour venue shares.
  base: VenueId
  world?: boolean
  name: string
  icon: string
  ground?: string // land colour; missing = the season's grass
  shoulder?: string // strip beside the road; missing = sidewalk pavers
  road?: string // tint on the asphalt (dusty, salty, slushy)
  pole?: string // street lamp colour
  sky: string // daytime sky
  fog: string // daytime haze
  fogNear: number
  fogFar: number
}

export const VENUES: Venue[] = ([
  { id: 'main', name: 'Main Street', icon: '🏙️', sky: '#3d9bff', fog: '#d9f2ff', fogNear: 28, fogFar: 105 },
  { id: 'beach', name: 'Sunset Boardwalk', icon: '🏖️', ground: '#ecd9a6', shoulder: '#a1795a', road: '#f4ece0', pole: '#eceff1', sky: '#2fa8ff', fog: '#e4f6ff', fogNear: 30, fogFar: 110 },
  { id: 'desert', name: 'Red Rock Canyon', icon: '🏜️', ground: '#d9a066', shoulder: '#c08350', road: '#f0d9bf', pole: '#6d4c41', sky: '#4aa3e8', fog: '#f2dcc2', fogNear: 26, fogFar: 110 },
  { id: 'snow', name: 'Frostbite Pass', icon: '🏔️', ground: '#eef3f7', shoulder: '#dde6ee', road: '#e4ecf4', pole: '#5d4037', sky: '#8fbde6', fog: '#e6edf4', fogNear: 18, fogFar: 85 },
  { id: 'farm', name: 'Harvest Backroad', icon: '🌾', shoulder: '#a08a70', pole: '#6d4c41', sky: '#55aaf5', fog: '#e2f4ff', fogNear: 30, fogFar: 110 },
  { id: 'docks', name: 'Harbor Docks', icon: '⚓', ground: '#9aa3a9', shoulder: '#b3babf', pole: '#fbc02d', sky: '#5b9bd5', fog: '#d0dce5', fogNear: 24, fogFar: 100 },
] as Omit<Venue, 'base'>[]).map((v) => ({ ...v, base: v.id as VenueId }))

export const WORLD_VENUES: Venue[] = [
  { id: 'giza', base: 'desert', world: true, name: 'Pyramid Road', icon: '🐪', ground: '#e2b878', shoulder: '#d2a468', road: '#f3e2c4', pole: '#8d6e4a', sky: '#3f9ef0', fog: '#f4e3c6', fogNear: 34, fogFar: 135 },
  { id: 'jaipur', base: 'main', world: true, name: 'Pink City Bazaar', icon: '🛺', ground: '#d9a87a', shoulder: '#c98f6a', road: '#f6e6d6', pole: '#3e4a52', sky: '#46a6f2', fog: '#f6e2cf', fogNear: 30, fogFar: 140 },
  { id: 'moscow', base: 'snow', world: true, name: 'Onion Dome Square', icon: '⛪', ground: '#eef3f7', shoulder: '#dde6ee', road: '#e4ecf4', pole: '#263238', sky: '#8fbde6', fog: '#e6edf4', fogNear: 24, fogFar: 110 },
  { id: 'shanghai', base: 'docks', world: true, name: 'Lantern Harbour', icon: '🏮', ground: '#9aa3a9', shoulder: '#b3babf', pole: '#b71c1c', sky: '#5b9bd5', fog: '#d0dce5', fogNear: 30, fogFar: 125 },
  { id: 'sydney', base: 'beach', world: true, name: 'Sails Harbour', icon: '🦘', ground: '#ecd9a6', shoulder: '#b8b0a4', road: '#f4ece0', pole: '#eceff1', sky: '#2fa8ff', fog: '#e4f6ff', fogNear: 34, fogFar: 130 },
  { id: 'rome', base: 'farm', world: true, name: 'Ancient Arena Way', icon: '🏛️', shoulder: '#cdbb9c', road: '#f5ede2', pole: '#263238', sky: '#4aa8f4', fog: '#f0ead8', fogNear: 32, fogFar: 125 },
  { id: 'london', base: 'main', world: true, name: 'Clocktower Embankment', icon: '🕰️', ground: '#8f9a8c', pole: '#1b2a24', sky: '#7fa9d6', fog: '#d6dde4', fogNear: 26, fogFar: 115 },
  { id: 'rio', base: 'beach', world: true, name: 'Carnival Coast', icon: '🎭', ground: '#ecd9a6', shoulder: '#e9e3d6', road: '#f4ece0', pole: '#eceff1', sky: '#2fa8ff', fog: '#e4f6ff', fogNear: 32, fogFar: 125 },
  { id: 'vegas', base: 'desert', world: true, name: 'Neon Mile', icon: '🎰', ground: '#d9a066', shoulder: '#b9b2a8', road: '#efe2d2', pole: '#37474f', sky: '#4aa3e8', fog: '#f2dcc2', fogNear: 30, fogFar: 125 },
]

const ALL = [...VENUES, ...WORLD_VENUES]
export const venue = (id: string) => ALL.find((v) => v.id === id) ?? VENUES[0]
// The original venue a venue races like (its skies, surface and ground).
export const baseOf = (id: AnyVenueId): VenueId => venue(id).base

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

let last: AnyVenueId | null = null

// Live races seed the pick with the race id so both players see the same place.
// Otherwise it's random, but never the same venue twice in a row.
// `?venue=desert` pins one, for testing.
const pinned = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('venue')

export function pickVenue(seed?: string, roll = Math.random): Venue {
  if (pinned && ALL.some((v) => v.id === pinned)) return venue(pinned)
  if (seed) return VENUES[hash(seed) % VENUES.length]
  const pool = VENUES.filter((v) => v.id !== last)
  const v = pool[Math.floor(roll() * pool.length) % pool.length]
  last = v.id
  return v
}
