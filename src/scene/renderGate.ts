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

export function useTownPaused(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => holds > 0,
  )
}
