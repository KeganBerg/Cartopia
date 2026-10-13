import { PLOT } from './data'

// The traffic meter: the share of your land that's road. Under TRAFFIC_MIN the town jams up
// (town cars crawl, fewer tourists); a bit more is busy; lots of road flows freely.

export const TRAFFIC_MIN = 0.15
export const TRAFFIC_CLEAR = 0.22

export type TrafficLevel = 'jam' | 'busy' | 'clear'
export const TRAFFIC: Record<TrafficLevel, { icon: string; name: string; c: string; pace: number; tourists: number }> = {
  jam: { icon: '🚦', name: 'Jammed', c: '#ef5350', pace: 0.6, tourists: 0.5 },
  busy: { icon: '🚗', name: 'Busy', c: '#ffb300', pace: 0.85, tourists: 1 },
  clear: { icon: '🛣️', name: 'Clear', c: '#66bb6a', pace: 1, tourists: 1 },
}

// Roads on owned land, over all owned tiles.
export function roadShare(roads: string[], land: string[]) {
  const tiles = land.length * PLOT * PLOT
  if (!tiles) return 0
  const plots = new Set(land)
  const on = roads.filter((r) => {
    const [x, z] = r.split(',').map(Number)
    return plots.has(`${Math.floor(x / PLOT)},${Math.floor(z / PLOT)}`)
  }).length
  return on / tiles
}

export const trafficLevel = (share: number): TrafficLevel => (share < TRAFFIC_MIN ? 'jam' : share < TRAFFIC_CLEAR ? 'busy' : 'clear')

// Road tiles still needed to reach the minimum.
export const roadsShort = (roads: string[], land: string[]) =>
  Math.max(0, Math.ceil(TRAFFIC_MIN * land.length * PLOT * PLOT - roadShare(roads, land) * land.length * PLOT * PLOT - 1e-9))

// A visited town that didn't send its land flows freely.
export const townTraffic = (s: { roads: string[]; land?: string[] }) => (s.land ? TRAFFIC[trafficLevel(roadShare(s.roads, s.land))] : TRAFFIC.clear)
