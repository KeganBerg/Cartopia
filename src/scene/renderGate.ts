import { useEffect, useSyncExternalStore, type RefObject } from 'react'

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

// A menu that covers most of the screen (most panels on a phone) pauses the town's drawing
// behind it: the town's last frame stays under the menu, and the phone's GPU goes to the menu's
// own 3D views and scrolling. Layout size, not the on-screen box, so the slide-in doesn't count.
export const COVERS = 0.85
export function coversScreen(w: number, h: number, vw: number, vh: number): boolean {
  return vw > 0 && vh > 0 && (w * h) / (vw * vh) >= COVERS
}
export function usePauseTownUnder(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let release: (() => void) | undefined
    const sync = () => {
      const on = coversScreen(el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight)
      if (on && !release) release = pauseTownDraw()
      else if (!on && release) {
        release()
        release = undefined
      }
    }
    sync()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    ro?.observe(el)
    window.addEventListener('resize', sync)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', sync)
      release?.()
    }
  }, [ref])
}
