import type { Body } from '../game/data'
import { carSize } from './CarModel'

// Town cars are drawn smaller than in the garage so each fits its 0.6-wide lane
// (traffic/net.ts LANE): two pass side by side and none pokes onto the sidewalk.
const SCALE = 0.8
const MAX_WID = 0.54
// Wide bodies (buses, tanks, formula cars) shrink a little more to fit.
export const townScale = (wid: number) => Math.min(SCALE, MAX_WID / wid)
export const bodyScale = (body: Body) => townScale(carSize(body).wid)
export const townSize = (body: Body) => {
  const k = bodyScale(body), s = carSize(body)
  return { len: s.len * k, wid: s.wid * k }
}
