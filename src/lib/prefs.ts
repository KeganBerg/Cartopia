import { create } from 'zustand'

// Player settings that live on this device only (they never go into the save):
// graphics quality, reduced motion and phone vibration. Sound volumes keep
// their own keys in sound.ts, townMusic.ts and ambience.ts.

// auto: the game picks by device and steps down if it struggles.
// high: full effects, sharpest picture. saver: no shadows or glow, lower resolution.
export type Graphics = 'auto' | 'high' | 'saver'

export type Prefs = {
  graphics: Graphics
  // null follows the device's own "reduce motion" setting.
  reduceMotion: boolean | null
  vibration: boolean
}

const KEY = 'cartopia-prefs'
const DEFAULTS: Prefs = { graphics: 'auto', reduceMotion: null, vibration: true }

export function parsePrefs(raw: string | null): Prefs {
  try {
    const p = raw ? (JSON.parse(raw) as Partial<Prefs>) : {}
    return {
      graphics: p.graphics === 'high' || p.graphics === 'saver' ? p.graphics : 'auto',
      reduceMotion: typeof p.reduceMotion === 'boolean' ? p.reduceMotion : null,
      vibration: p.vibration !== false,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function load(): Prefs {
  try {
    return parsePrefs(localStorage.getItem(KEY))
  } catch {
    return { ...DEFAULTS }
  }
}

export const usePrefs = create<Prefs>(load)

export function setPrefs(p: Partial<Prefs>) {
  usePrefs.setState(p)
  try {
    localStorage.setItem(KEY, JSON.stringify(usePrefs.getState()))
  } catch {
    // Storage blocked: the setting lasts for this visit.
  }
  applyMotionClass()
}

export const systemReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const reduceMotionOn = () => usePrefs.getState().reduceMotion ?? systemReducedMotion()

// The CSS side: html.calm stops animations and transitions everywhere (index.css).
function applyMotionClass() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('calm', usePrefs.getState().reduceMotion === true)
}
applyMotionClass()
