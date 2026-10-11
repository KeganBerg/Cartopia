// Shots of each race venue (taken in the race scene), used as art on the Race
// menu's tiles and banners. Venues without a night shot get a night tint in CSS.
import main from '../assets/venues/main.jpg'
import docks from '../assets/venues/docks.jpg'
import desert from '../assets/venues/desert.jpg'
import snow from '../assets/venues/snow.jpg'
import beach from '../assets/venues/beach.jpg'
import farm from '../assets/venues/farm.jpg'
import snowNight from '../assets/venues/snow-night.jpg'
import beachNight from '../assets/venues/beach-night.jpg'

const DAY: Record<string, string> = { main, docks, desert, snow, beach, farm }
const NIGHT: Record<string, string> = { snow: snowNight, beach: beachNight }

// The picture, and whether CSS should darken it for a night race.
export function venueArt(id: string, night = false): { src: string; tint: boolean } {
  if (night && NIGHT[id]) return { src: NIGHT[id], tint: false }
  return { src: DAY[id] ?? main, tint: night }
}

export const artStyle = (id: string, night = false) => ({ backgroundImage: `url(${venueArt(id, night).src})` })
export const artClass = (id: string, night = false) => (venueArt(id, night).tint ? ' rm-night' : '')
