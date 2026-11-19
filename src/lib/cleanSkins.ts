import { SKINNED_SLOTS, modSkinDef, skinDef, type ModSkins } from '../game/data'

// A car's skins as another browser or the server sent them, kept to ones this game knows,
// so everyone sees a player's car in the animated skin it wears.
export function cleanSkins(c: { skin?: unknown; modSkin?: unknown }): { skin?: string; modSkin?: ModSkins } {
  const skin = typeof c.skin === 'string' && skinDef(c.skin) ? c.skin : undefined
  const m = c.modSkin && typeof c.modSkin === 'object' ? (c.modSkin as Record<string, unknown>) : {}
  const modSkin = Object.fromEntries(SKINNED_SLOTS.flatMap((sl) => (typeof m[sl] === 'string' && modSkinDef(m[sl] as string) ? [[sl, m[sl]]] : [])))
  return { ...(skin ? { skin } : {}), ...(Object.keys(modSkin).length ? { modSkin: modSkin as ModSkins } : {}) }
}
