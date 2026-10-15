import type { Kit } from '../CarModel'
import { EXOTIC, type ExoticFit, type ExoticHelpers } from '../exoticCars'

// Placeholder until this car's own body is drawn.
export function groupBGeo(k: Kit, fit: ExoticFit, h: ExoticHelpers) {
  EXOTIC.teardrop!(k, fit, h)
}
