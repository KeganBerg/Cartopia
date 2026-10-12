import { Vector3, type Camera, type PerspectiveCamera } from 'three'
import { create } from 'zustand'

// The town's free camera: the HUD's camera button swaps the fixed bird's-eye
// view for one you can zoom, pan, turn and tilt, down to street level, so the
// fronts of buildings that face away from the usual view come round into sight.
export const useFreeCam = create<{ on: boolean }>(() => ({ on: false }))
export const setFreeCam = (on: boolean) => useFreeCam.setState({ on })

// The point the town's camera looks at. Both views share it, so switching
// keeps the same spot in the middle of the screen.
export const VIEW = new Vector3()

// Limits on the free view: how close and far it may get, and how low it may tilt
// (just above the horizon, so the sky and the hills come into view). `near`
// sets how fine depth is far off (see coplanar.test.tsx): at 1 two faces 0.002
// apart still sort right at the furthest zoom; halving it doubles that gap.
export const FREE = { fovWide: 42, fovTall: 52, near: 1, far: 2600, minDist: 5, maxDist: 170, minPolar: 0.12, maxPolar: 1.45 }

export const isFree = (c: Camera): c is PerspectiveCamera => (c as PerspectiveCamera).isPerspectiveCamera === true
