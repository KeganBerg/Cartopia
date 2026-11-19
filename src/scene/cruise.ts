import { create } from 'zustand'
import { useGame } from '../game/store'
import type { CruisePose } from '../game/cruise'
import { setFreeCam, useFreeCam } from './freeCam'
import { toWorld, DIRS } from './grid'
import { liveTraffic } from './traffic/live'

// Driving one of your own cars round town by hand (the garage's Drive button). The
// car leaves the town's traffic while you drive it, the free camera follows behind,
// and the menus hide until you leave (src/ui/Cruise.tsx).
export const useCruise = create<{ uid: string | null }>(() => ({ uid: null }))

// Read and written every frame by CruiseCar, the follow camera (FreeCam.tsx) and the controls.
export const cruisePose: CruisePose = { x: 0, z: 0, h: 0, v: 0, steer: 0 }
export const cruiseInput = { steer: 0, gas: 0, brake: 0, drift: false, item: false }
// Dev builds only: lets headless checks read the drive.
if (import.meta.env.DEV) (window as unknown as { __cruise?: unknown }).__cruise = { pose: cruisePose, input: cruiseInput, store: useCruise }

// Where the car starts: wherever it is in traffic, else on a road tile facing along the road.
function startPose(uid: string): CruisePose | null {
  const a = liveTraffic.agents.get(uid)
  if (a) return { x: a.x, z: a.z, h: a.yaw, v: 0, steer: 0 }
  const roads = useGame.getState().roads
  const set = new Set(roads)
  for (const k of roads) {
    const [x, z] = k.split(',').map(Number)
    const d = DIRS.find(([dx, dz]) => set.has(`${x + dx},${z + dz}`))
    if (!d) continue
    const [wx, wz] = toWorld(x, z)
    return { x: wx, z: wz, h: Math.atan2(d[0], d[1]), v: 0, steer: 0 }
  }
  return null
}

export function startCruise(uid: string) {
  const s = useGame.getState()
  const p = startPose(uid)
  if (s.visiting || s.mode !== 'play' || !p) return false
  Object.assign(cruisePose, p)
  Object.assign(cruiseInput, { steer: 0, gas: 0, brake: 0 })
  useCruise.setState({ uid })
  setFreeCam(true)
  return true
}

export function endCruise() {
  if (!useCruise.getState().uid) return
  useCruise.setState({ uid: null })
  liveTraffic.setHand(null)
  setFreeCam(false)
}

// Leaving the free view (Esc, the camera button), heading to another town, the building
// tools or any menu opening (the daily spin, a level up) all end the drive.
useFreeCam.subscribe((f) => {
  if (!f.on) endCruise()
})
useGame.subscribe((g, was) => {
  if (g.visiting !== was.visiting || g.mode !== 'play' || (g.panel && !was.panel)) endCruise()
})
