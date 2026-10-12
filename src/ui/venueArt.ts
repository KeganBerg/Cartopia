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
