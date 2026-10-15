import type { Kit } from './CarModel'
import type { Body } from '../game/data'
import type { ExoticFit, ExoticHelpers } from './exoticCars'
import { highboyGeo } from './packCars/highboy'
import { timeAttackGeo } from './packCars/timeattack'
import { groupBGeo } from './packCars/groupb'
import { longtailGeo } from './packCars/longtail'

// Car pack cars (sold only in the Bank's car packs): one lofted body each, drawn the same way as
// the exotics and resto-mods so they bake, batch and take mods like every other car.
export const PACK_CARS: Partial<Record<Body, (k: Kit, fit: ExoticFit, h: ExoticHelpers) => void>> = {
  highboy: highboyGeo,
  timeattack: timeAttackGeo,
  groupb: groupBGeo,
  longtail: longtailGeo,
}
