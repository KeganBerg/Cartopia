import { PLOT } from '../game/data'

// Only roads on a plot's edge tiles can leave town, so the fence hears about those alone:
// painting a road inside town changes nothing here and shouldn't redraw the countryside.
const onPlotEdge = (n: number) => {
  const i = ((n % PLOT) + PLOT) % PLOT
  return i === 0 || i === PLOT - 1
}
export function townExits(roads: string[]) {
  return roads.filter((k) => {
    const [x, z] = k.split(',').map(Number)
    return onPlotEdge(x) || onPlotEdge(z)
  }).sort().join('|')
}
