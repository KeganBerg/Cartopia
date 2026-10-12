import { supabase } from './supabase'
import { useGame } from '../game/store'
import { liveEvents, setLiveEvents, syncHandlers, type LiveEvent } from '../game/liveEvents'

// Keeps src/game/liveEvents.ts in step with the live_events table
// (0055_live_events.sql). Loads it on start, then Realtime pushes every insert
// or change so online players switch within seconds. A slow poll backs that up
// in case the socket drops, and a missing table (SQL not run yet) just means
// no events.

const POLL_MS = 60000
const SEEN = 'cartopia-live-seen'

type Row = { id: number; kind: string; payload: Record<string, unknown> | null; starts_at: string; ends_at: string }

async function refresh() {
  if (!supabase) return
  const { data, error } = await supabase.from('live_events').select('id, kind, payload, starts_at, ends_at').gt('ends_at', new Date().toISOString()).order('starts_at')
  if (error) {
    // Keep what was cached: on a blip the event carries on, and once the
    // table is gone the cached entries simply run out.
    return
  }
  apply((data as Row[]).map((r) => ({ id: r.id, kind: r.kind, payload: r.payload ?? {}, from: Date.parse(r.starts_at), to: Date.parse(r.ends_at) })))
}

// Pending start toasts, by event id, with the start time each was armed for.
const timers = new Map<number, { timer: ReturnType<typeof setTimeout>; from: number }>()
// setTimeout overflows past ~24.8 days and would fire at once; a later sync arms those.
const MAX_DELAY = 2 ** 31 - 1

function apply(list: LiveEvent[]) {
  // An event cut short drops out of the list; keep it a moment so the sky
  // eases back instead of snapping.
  const now = Date.now()
  const ended = liveEvents().filter((e) => !list.some((x) => x.id === e.id) && e.from <= now && now < e.to).map((e) => ({ ...e, to: now }))
  setLiveEvents([...list, ...ended])
  syncHandlers()
  // A deleted or moved event drops its pending toast; a moved one is re-armed below.
  for (const [id, t] of timers) {
    const e = list.find((x) => x.id === id)
    if (!e || e.from !== t.from) {
      clearTimeout(t.timer)
      timers.delete(id)
    }
  }
  for (const e of list) announce(e)
}

// An event's optional `message` shows once as a toast when it starts.
function announce(e: LiveEvent) {
  const text = typeof e.payload.message === 'string' ? e.payload.message.slice(0, 120) : ''
  if (!text || timers.has(e.id) || seen().includes(e.id)) return
  const show = () => {
    if (Date.now() >= e.to) return
    useGame.getState().toast(text)
    try {
      localStorage.setItem(SEEN, JSON.stringify([...seen(), e.id].slice(-20)))
    } catch {
      // Without storage it may show again on the next visit; harmless.
    }
  }
  const delay = Math.max(0, e.from - Date.now())
  if (delay > MAX_DELAY) return
  timers.set(e.id, { timer: setTimeout(show, delay), from: e.from })
}

function seen(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function startLiveEvents() {
  if (!supabase) return
  void refresh()
  supabase
    .channel('live-events')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_events' }, () => void refresh())
    .subscribe()
  setInterval(() => {
    if (!document.hidden) void refresh()
  }, POLL_MS)
  setInterval(() => syncHandlers(), 1000)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refresh()
  })
}
