import type { WeatherKind } from '../game/weather'

// Hero pictures for the Race menu's tiles and banners: one shot per mode, rendered
// from the race scene at each venue (scripts/hero renders them again).
// Campaign: the face-off under the start lights. Pro Tour: both noses on the finish
// line, day or midnight. Grand Prix: a kart circuit (scripts/kartshot, ?clean). Time Trial: a lone run past the split board.
const ART = import.meta.glob<string>('../assets/race-menu/*.webp', { eager: true, import: 'default' })

export type ArtMode = 'camp' | 'tour' | 'gp' | 'trial'

export function heroArt(mode: ArtMode, venue = 'main', night = false): string {
  const at = (name: string) => ART[`../assets/race-menu/${name}.webp`]
  if (mode === 'gp') return at('gp-main')
  return at(`${mode}-${venue}${mode === 'tour' && night ? '-night' : ''}`) ?? at(`${mode}-main`)
}

export const artStyle = (mode: ArtMode, venue?: string, night = false) => ({ backgroundImage: `url(${heroArt(mode, venue, night)})` })

// Short looping clips of real races for the same tiles (scripts/clips records them): the start,
// the run to the line and a lone time-trial run. The still above is the poster. The Grand Prix
// keeps its still until it has a clip of its own (gp-main).
// MP4 (H.264) where the browser plays it, else the WebM (VP9).
const CLIPS = import.meta.glob<string>('../assets/race-clips/*.{mp4,webm}', { eager: true, query: '?url', import: 'default' })
let ext: 'mp4' | 'webm' | null = null
const clipExt = () => (ext ??= typeof document !== 'undefined' && document.createElement('video').canPlayType('video/mp4; codecs="avc1.64001f"') ? 'mp4' : 'webm')

// Drizzle races show the rain clip and wind the clear one; a weekly event has its own clip.
const SKY_CLIP: Partial<Record<WeatherKind, string>> = { rain: 'rain', drizzle: 'rain', storm: 'storm', fog: 'fog', dust: 'dust', snow: 'snow', blizzard: 'blizzard' }

export function heroClip(mode: ArtMode, venue = 'main', night = false, sky?: WeatherKind, event?: string): string | undefined {
  const at = (name: string) => CLIPS[`../assets/race-clips/${name}.${clipExt()}`]
  if (mode === 'gp') return at('gp-main')
  const base = `${mode}-${venue}${mode === 'tour' && night ? '-night' : ''}`
  const wet = sky && SKY_CLIP[sky]
  return (event && at(`ev-${event}`)) || (wet && at(`${base}-${wet}`)) || at(base) || at(`${mode}-main`)
}
