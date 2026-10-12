import type { Hull } from './hull'
import { hull as current } from './current'

// Our own window, light and trim layout drawn over a scanned hull (target units, +z forward).
// belt: the side glass's bottom; shield/back: the windshield's and back light's span along
// the car (the roof between them is painted), shieldW/backW their half widths at each end;
// aPillar: how far the side glass stops short of the windshield; cPillar: where its rear edge
// meets the beltline, and cRake leans that edge forward as it rises;
// door: the door's front and rear seams; head: headlight [inner x, outer x, height];
// tail: tail light bar [half width, height].
export type ScanLook = {
  belt: number; shield: [number, number]; back: [number, number]; shieldW: [number, number]; backW: [number, number]; aPillar: number; cPillar: number; cRake: number
  door: [number, number]; head: [number, number, number]; tail: [number, number]
}
export type Scan = { hull: Hull; look: ScanLook }

// Car models (CarDef ids) whose body is a restyled scan instead of their body's
// procedural shape. Wheels, mods and the rest of the car still follow the body.
export const SCANS: Record<string, Scan> = {
  current: {
    hull: current,
    look: { belt: 0.312, shield: [0.12, 0.37], back: [-0.4, -0.12], shieldW: [0.19, 0.27], backW: [0.2, 0.17], aPillar: 0.04, cPillar: -0.25, cRake: 0.6, door: [0.31, -0.16], head: [0.12, 0.27, 0.185], tail: [0.28, 0.25] },
  },
}
