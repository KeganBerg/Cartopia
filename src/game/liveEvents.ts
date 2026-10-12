// Live events: switches the whole game for every player at once, set from the
// Supabase SQL editor (live_events table, supabase/migrations/0055_live_events.sql).
// src/lib/liveEventsSync.ts loads the table and listens for changes; this file
// only holds what is live and answers "is it forced right now?", so the clock
// can ask it without pulling Supabase in.
//
// 'night' and 'day' pin the town clock (forcedPhase below). Any other kind
// (techno, weather, bonus hours...) is handed to the feature that registered
// it with registerLiveKind().

export type Kind = 'night' | 'day'
export type LiveEvent = { id: number; kind: string; payload: Record<string, unknown>; from: number; to: number }

// The town clock phase each kind pins (0 = noon, 0.5 = midnight).
const PHASE: Record<Kind, number> = { night: 0.5, day: 0 }
// The sky eases into and out of a forced time instead of snapping.
export const EASE_MS = 8000

const CACHE = 'cartopia-live-events'
let events: LiveEvent[] = load()

function load(): LiveEvent[] {
  try {
    const list = JSON.parse(localStorage.getItem(CACHE) ?? '[]')
    return Array.isArray(list) ? list.filter((e) => e.to > Date.now()) : []
  } catch {
    return []
  }
}

// Replaces the live list. Kept in localStorage so a reload (and the splash
// screen in index.html, which reads the same key) starts in the right light.
export function setLiveEvents(list: LiveEvent[]) {
  events = list
  try {
    localStorage.setItem(CACHE, JSON.stringify(list.filter((e) => e.to > Date.now() - EASE_MS)))
  } catch {
    // Private mode: the events still apply for this visit.
  }
}

export const liveEvents = () => events

// The event of one of these kinds running at `now`; the newest wins if they overlap.
export function activeEvent(kinds: readonly string[], now = Date.now()) {
  let best: LiveEvent | null = null
  for (const e of events) if (kinds.includes(e.kind) && e.from <= now && now < e.to && (!best || e.from > best.from)) best = e
  return best
}

const CLOCK_KINDS = Object.keys(PHASE)
const smooth = (t: number) => t * t * (3 - 2 * t)

// Moves `a` toward `b` by `t` the short way round the day (forward, through
// dusk, when it's half a day either way).
function towards(a: number, b: number, t: number) {
  let d = (((b - a) % 1) + 1) % 1
  if (d > 0.5) d -= 1
  return (a + d * t + 1) % 1
}

// The phase the clock should show at `now`, given its own phase, or null when
// nothing overrides it. Eases over EASE_MS at the start and the end.
export function forcedPhase(natural: number, now = Date.now()): number | null {
  const e = activeEvent(CLOCK_KINDS, now)
  if (e) {
    const target = PHASE[e.kind as Kind]
    const t = Math.min(1, (now - e.from) / EASE_MS)
    return t >= 1 ? target : towards(natural, target, smooth(t))
  }
  // Just ended: ease back to the real clock.
  let last: LiveEvent | null = null
  for (const x of events) if (CLOCK_KINDS.includes(x.kind) && x.to <= now && now - x.to < EASE_MS && (!last || x.to > last.to)) last = x
  if (!last) return null
  return towards(PHASE[last.kind as Kind], natural, smooth((now - last.to) / EASE_MS))
}

// When a forced day ends, so the "night in ..." countdown can count past it.
export const forcedDayUntil = (now = Date.now()) => activeEvent(['day'], now)?.to ?? null


// Other kinds hand off to whatever feature owns them. A feature registers its
// kind once; start runs when an event of that kind begins (or is already
// running when the game loads), stop when it ends or is cut short.
export type KindHandler = { start: (e: LiveEvent) => void; stop: () => void }
const handlers = new Map<string, KindHandler>()
const running = new Map<string, number>() // kind -> id of the event started

export function registerLiveKind(kind: string, h: KindHandler) {
  handlers.set(kind, h)
  syncHandlers()
}

// Starts and stops registered kinds to match the live list. Called after every
// refresh and once a second, so scheduled events begin and end on time.
export function syncHandlers(now = Date.now()) {
  for (const [kind, h] of handlers) {
    const e = activeEvent([kind], now)
    const was = running.get(kind)
    if (e?.id === was) continue
    if (was !== undefined) {
      running.delete(kind)
      h.stop()
    }
    if (e) {
      running.set(kind, e.id)
      h.start(e)
    }
  }
}
