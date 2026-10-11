// One-shot visual effects. The store announces what happened here and the
// scene and HUD play it: coins flying to the counter, a building dropping in.
// Listeners run synchronously, so they can still measure a building's badge
// before the state change re-renders it away.

export type FxEvent =
  | { kind: 'collect'; uids: string[]; coins: number; parts: number; xp: number }
  | { kind: 'built'; uid: string }
  | { kind: 'upgraded'; uids: string[] }
  | { kind: 'cleared'; uid: string }

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

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
