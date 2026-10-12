// Reduce flashing: one switch every flashing effect reads (Rave Mode, the
// club's LED windows, lightning, crate reveals). With it on nothing flashes
// more than about 3 times a second (WCAG 2.3.1): no strobes, no full-screen
// flashes, colours change on the bar instead of the beat, and pulses become
// gentle swells. Players turn it on in the menu or on the first-launch warning;
// until they choose, it follows the device's reduce-motion setting.
//
// In code: `calmFlashing()` per frame (it's cheap), `onCalmFlashingChange` /
// `useCalmFlashing()` to react, and the page gets `calm-flash` on <html> for CSS.
import { useSyncExternalStore } from 'react'

const KEY = 'cartopia-calm-flash' // 'on' | 'off'; missing = follow the device
const SEEN_KEY = 'cartopia-flash-warning' // set once the first-launch warning is dismissed

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    // Private mode: the choice lasts until a reload.
  }
}

const deviceCalm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

let choice: string | null = read(KEY)
let calm = choice === 'on' || (choice !== 'off' && deviceCalm())
const listeners = new Set<() => void>()

function apply() {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('calm-flash', calm)
}
apply()

export const calmFlashing = () => calm

export function setCalmFlashing(on: boolean) {
  choice = on ? 'on' : 'off'
  write(KEY, choice)
  if (on === calm) return
  calm = on
  apply()
  listeners.forEach((l) => l())
}

export function onCalmFlashingChange(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const useCalmFlashing = () => useSyncExternalStore(onCalmFlashingChange, calmFlashing)

// The first-launch warning: shown until the player taps through it once.
export const flashWarningSeen = () => read(SEEN_KEY) === '1'
export const markFlashWarningSeen = () => write(SEEN_KEY, '1')
