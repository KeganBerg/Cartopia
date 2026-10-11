import { create } from 'zustand'
import { buildingDef, type BuildingKind } from './data'

// The townsperson the player tapped, what they're up to and where they're headed,
// for the thought bubble. The town scene keeps it up to date and clears it after
// `until` (performance.now()).
// `where` is the destination chip ("☕ Coffee"); `there` means they've arrived.
export const useThought = create<{ id: string | null; text: string; where: string; there: boolean; until: number }>(() => ({
  id: null, text: '', where: '', there: false, until: 0,
}))

// Fallback icons for places without their own, so buildings other threads add
// still get a sensible chip.
const KIND_ICON: Record<BuildingKind, string> = {
  business: '🏪', gas: '⛽', parts: '🔩', showroom: '🚗', garage: '🔧', decor: '🌳', house: '🏡', obstacle: '🌿',
}
const ICON: Record<string, string> = { gas: '⛽', club: '🪩', garage: '🔧', showroom: '🚗' }

// A short name for a building: its sign in title case ("LUBE & GO" -> "Lube & Go"),
// else its full name.
export function shortName(def: string): string {
  const d = buildingDef(def)
  if (!d.sign) return d.name
  return d.sign.toLowerCase().replace(/(^|[\s&-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase())
}

// The chip for a destination building or decoration, using `icon` when the
// caller knows a better one.
export function placeChip(def: string, icon?: string): string {
  return `${ICON[def] ?? icon ?? KIND_ICON[buildingDef(def).kind] ?? '📍'} ${shortName(def)}`
}
