import { create } from 'zustand'

// Screenshot mode (ShotMode.tsx): in the free camera, one tap hides every menu,
// bubble, popup and toast so only the town is left on screen. A tap (or Esc)
// brings them back. The free camera keeps flying and turning underneath.
export const useShot = create<{ on: boolean }>(() => ({ on: false }))
export const setShot = (on: boolean) => useShot.setState({ on })

// A press that barely moves and lets go quickly. Anything else is the camera being steered.
export const isTap = (dx: number, dy: number, ms: number) => dx * dx + dy * dy < 100 && ms < 350
