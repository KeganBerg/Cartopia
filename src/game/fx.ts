// One-shot visual effects. The store announces what happened here and the
// scene and HUD play it: coins flying to the counter, a building dropping in.
// Listeners run synchronously, so they can still measure a building's badge
// before the state change re-renders it away.
import { reduceMotionOn } from '../lib/prefs'

export type FxEvent =
  | { kind: 'collect'; uids: string[]; coins: number; parts: number; xp: number }
  | { kind: 'built'; uid: string }
  | { kind: 'upgraded'; uids: string[] }
  | { kind: 'cleared'; uid: string }
  // XP just gained, after the level boost: the HUD floats it by the speedometer.
  | { kind: 'xp'; amount: number }
  // You helped a business in a friend's town; `el` is the badge you tapped.
  | { kind: 'helped'; uid: string; coins: number; parts: number; xp: number; el: Element | null }

type Listener = (e: FxEvent) => void
const listeners = new Set<Listener>()

export function onFx(cb: Listener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function fx(e: FxEvent): void {
  for (const cb of listeners) {
    try {
      cb(e)
    } catch (err) {
      console.error(err)
    }
  }
}

// The device's "reduce motion" setting, or the player's own choice in Settings.
export const reducedMotion = reduceMotionOn
