import { useSyncExternalStore } from 'react'

// Lets a full-screen 3D view (the race) pause the town canvas underneath it,
// so phones only draw one scene at a time.
let holds = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function holdTown(): () => void {
  holds++
  emit()
  return () => {
    holds--
    emit()
  }
}

// Pauses only the town's drawing, not its sounds: a full-screen menu (the Race menu on a
// phone) covers the town, and its race clips play smoother without the town drawing behind.
let drawHolds = 0
export function pauseTownDraw(): () => void {
  drawHolds++
  emit()
  return () => {
    drawHolds--
    emit()
  }
}

// For non-React listeners (the town's ambient sounds go quiet during a race).
export const townHeld = () => holds > 0
export function onTownHold(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTownPaused(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => holds > 0 || drawHolds > 0,
  )
}
