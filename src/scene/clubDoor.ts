// What each club's bouncer sees at his rope. The townspeople (Townspeople.tsx)
// write it as they queue and get let in; the bouncer's figure (ClubLife.tsx)
// reads it to watch the front of the line and wave each one through.
export type Door = { x: number; z: number; waiting: boolean; admitted: number }

// By club key, at the club's centre in the town.
export const clubDoors = new Map<string, Door>()

export function door(key: string, x: number, z: number) {
  let d = clubDoors.get(key)
  if (!d) clubDoors.set(key, (d = { x, z, waiting: false, admitted: 0 }))
  d.x = x
  d.z = z
  return d
}

// The club standing at (x, z), if anyone has queued there.
export function doorNear(x: number, z: number): Door | undefined {
  for (const d of clubDoors.values()) if (Math.hypot(d.x - x, d.z - z) < 0.75) return d
  return undefined
}
