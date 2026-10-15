import { ShellBuilding, Box, type NewModelProps } from './NewBuildings'

// Car shops from the third wave of buildings (exhaust, brakes, wraps, dyno, engines, race fab).
// Lots face +z (the front door side), like the rest of the town.

export const CAR_SHOP_MODELS = new Set(['muffler', 'brakes', 'wraps', 'dynolab', 'engines', 'racefab'])

export function CarShopModel({ def, ghost, m, win, bulb, level = 1 }: NewModelProps) {
  const lvl = Math.min(10, Math.max(1, Math.floor(level) || 1))
  if (def.kind === 'decor') return <Box m={m} at={[0, 0.1, 0]} s={[def.w * 1.6, 0.2, def.h * 1.6]} c={def.color} />
  return <ShellBuilding m={m} win={win} bulb={bulb} ghost={ghost} lvl={lvl} w={def.w * 1.7} d={def.h * 1.3} h0={1.3} wall={def.color} roof={def.roof} sign={def.sign} shopfront={def.roof} />
}
