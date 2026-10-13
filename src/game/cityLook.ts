// City look: purely cosmetic choices kept in the save.
//   lights: one city-wide street light colour and lamp post design (SaveState.lights)
//   cityTheme: a colour theme for every building that has no theme of its own (SaveState.cityTheme)
//   tint: a building's own theme (PlacedBuilding.tint)
// Unknown ids (from a newer build) fall back to the defaults.

export type LightTone = { id: string; name: string; c: string }
export const LIGHT_TONES: LightTone[] = [
  { id: 'warm', name: 'Warm', c: '#ffbb55' },
  { id: 'white', name: 'White', c: '#e6eeff' },
  { id: 'amber', name: 'Sunset', c: '#ff7a3d' },
  { id: 'ice', name: 'Ice blue', c: '#5cc8ff' },
  { id: 'mint', name: 'Mint', c: '#5cffb0' },
  { id: 'violet', name: 'Violet', c: '#b77bff' },
  { id: 'rose', name: 'Rose', c: '#ff6fae' },
]
// 'auto': each lamp keeps its own design (cobra heads on the streets, lanterns on placed lamps).
export type LampPost = 'auto' | 'cobra' | 'lantern' | 'globe'
export const LAMP_POSTS: { id: LampPost; name: string; icon: string }[] = [
  { id: 'auto', name: 'Mixed', icon: '🔀' },
  { id: 'cobra', name: 'Modern', icon: '🛣️' },
  { id: 'lantern', name: 'Lantern', icon: '🏮' },
  { id: 'globe', name: 'Globe', icon: '🔮' },
]
export type Lights = { tone: string; post: LampPost }
export const DEFAULT_LIGHTS: Lights = { tone: 'warm', post: 'auto' }

export const lightTone = (l?: Partial<Lights> | null) => LIGHT_TONES.find((t) => t.id === l?.tone) ?? LIGHT_TONES[0]
export const lampPost = (l?: Partial<Lights> | null): LampPost => LAMP_POSTS.find((p) => p.id === l?.post)?.id ?? 'auto'
// What a save keeps: only known ids; the defaults are left out.
export function cleanLights(l: unknown): Lights | undefined {
  const o = (l && typeof l === 'object' ? l : {}) as Partial<Lights>
  const tone = lightTone(o).id
  const post = lampPost(o)
  return tone === DEFAULT_LIGHTS.tone && post === DEFAULT_LIGHTS.post ? undefined : { tone, post }
}

// Building colour themes: every material's colour is mixed `amount` of the way to `c`.
// Greenery keeps its colour so trees and lawns stay green.
export type ColorTheme = { id: string; name: string; c: string; amount: number }
export const COLOR_THEMES: ColorTheme[] = [
  { id: 'white', name: 'All white', c: '#f4f3ee', amount: 0.85 },
  { id: 'pastel', name: 'Pastel', c: '#fff4fa', amount: 0.45 },
  { id: 'sand', name: 'Sandstone', c: '#e3c99a', amount: 0.6 },
  { id: 'mint', name: 'Mint', c: '#9fe3c7', amount: 0.55 },
  { id: 'rose', name: 'Rose', c: '#f2a3b8', amount: 0.55 },
  { id: 'noir', name: 'Noir', c: '#2c2f36', amount: 0.7 },
]
export const colorTheme = (id?: string | null) => COLOR_THEMES.find((t) => t.id === id) ?? null
// The theme a building is drawn with: its own pick, else the city's (decor only takes its own).
export const themeFor = (own: string | undefined | null, city: string | undefined | null, decor: boolean) =>
  colorTheme(own) ?? (decor ? null : colorTheme(city))
