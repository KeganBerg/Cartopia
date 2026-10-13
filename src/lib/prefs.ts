import { create } from 'zustand'

// Player settings that live on this device only (they never go into the save):
// graphics quality, reduced motion, phone vibration, muted ghost race taunts, kart steering, the kart racing line and
// which "Are you sure?" steps the player turned off. Sound volumes keep
// their own keys in sound.ts, townMusic.ts and ambience.ts.

// auto: the game picks by device and steps down if it struggles.
// high: full effects, sharpest picture. saver: no shadows or glow, lower resolution.
export type Graphics = 'auto' | 'high' | 'saver'

export type Prefs = {
  graphics: Graphics
  // null follows the device's own "reduce motion" setting.
  reduceMotion: boolean | null
  vibration: boolean
  // Received ghost race taunts show as a plain 👍.
  muteTaunts: boolean
  // false: casual races run on a clear day. Live races, the weekly trial and
  // races with set weather keep theirs, so everyone in them races the same sky.
  raceWeather: boolean
  // "Are you sure?" before leaving Rusty's with a haul, and before selling a car.
  askLeave: boolean
  askSell: boolean
  // Kart steering on a touch screen: smooth (long slide, steadied near the middle) or sharp.
  steer: Steer
  // The ghost racing line on kart tracks: green where it's flat out, red before a hard bend.
  kartLine: boolean
}
export type Steer = 'smooth' | 'sharp'

const KEY = 'cartopia-prefs'
const DEFAULTS: Prefs = { graphics: 'auto', reduceMotion: null, vibration: true, raceWeather: false, muteTaunts: false, askLeave: true, askSell: true, steer: 'smooth', kartLine: true }

export function parsePrefs(raw: string | null): Prefs {
  try {
    const p = raw ? (JSON.parse(raw) as Partial<Prefs>) : {}
    return {
      graphics: p.graphics === 'high' || p.graphics === 'saver' ? p.graphics : 'auto',
      reduceMotion: typeof p.reduceMotion === 'boolean' ? p.reduceMotion : null,
      vibration: p.vibration !== false,
      muteTaunts: p.muteTaunts === true,
      raceWeather: p.raceWeather === true,
      askLeave: p.askLeave !== false,
      askSell: p.askSell !== false,
      steer: p.steer === 'sharp' ? 'sharp' : 'smooth',
      kartLine: p.kartLine !== false,
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

// The resolution a 3D view draws at: Saver draws one pixel per screen pixel, the
// others go up to `max` times sharper on high-density screens.
export const dprFor = (g: Graphics, max = 1.5): number | [number, number] => (g === 'saver' ? 1 : [1, max])
export const useCanvasDpr = (max = 1.5) => dprFor(usePrefs((p) => p.graphics), max)
// Saver also trims the extras: fewer weather drops, sparks and leaves.
export const useLite = () => usePrefs((p) => p.graphics === 'saver')

export const systemReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const reduceMotionOn = () => usePrefs.getState().reduceMotion ?? systemReducedMotion()

// The CSS side: html.calm stops animations and transitions everywhere (index.css).
function applyMotionClass() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('calm', usePrefs.getState().reduceMotion === true)
}
applyMotionClass()
