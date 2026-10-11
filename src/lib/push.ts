// Installable app + job alerts that reach the player after they close the game.
// sw.js (public/) makes the game installable and shows push alerts. When the tab is hidden,
// the game sends the server its next alert times; netlify/functions/push-send.mts pushes
// them when due. Coming back cancels them. Players who aren't signed in (or browsers
// without push) fall back to timers, which only fire while the tab stays open.
import { create } from 'zustand'
import { supabase } from './supabase'
import { useGame, fuelCap, type GameState } from '../game/store'
import { buildingDef, FUEL_REGEN_SECONDS } from '../game/data'

const KEY = 'cartopia-alerts'
const ASKED = 'cartopia-alerts-asked'
// Short jobs finish while the player is just glancing at another tab; don't ping for those.
const MIN_DELAY = 2 * 60 * 1000
// "Not now" on the alerts card waits this long before asking again.
const ASK_AGAIN = 3 * 24 * 3600 * 1000

type Kind = 'jobs' | 'restore' | 'fuel'
export type Alert = { kind: Kind; at: number; title: string; body: string }

/** The alerts worth sending for this town, soonest first. */
export function alertsFor(s: Pick<GameState, 'buildings' | 'restoring' | 'fuel' | 'fuelUpdatedAt' | 'level' | 'townName'>, now = Date.now()): Alert[] {
  const out: Alert[] = []
  const add = (kind: Kind, at: number, title: string, body: string) => {
    if (at - now >= MIN_DELAY) out.push({ kind, at, title, body })
  }
  const town = s.townName || 'your town'
  // One ping when the last running job is done, rather than one per business.
  const ends = s.buildings.filter((b) => b.jobEndsAt !== null && b.jobEndsAt > now && buildingDef(b.def).kind !== 'obstacle').map((b) => b.jobEndsAt!)
  if (ends.length) add('jobs', Math.max(...ends), 'Jobs done! 💰', `Your businesses in ${town} are ready to collect.`)
  if (s.restoring && s.restoring.endsAt > now) add('restore', s.restoring.endsAt, 'Restoration finished 🔧', 'Rusty has your car ready.')
  const cap = fuelCap(s)
  if (s.fuel < cap) add('fuel', s.fuelUpdatedAt + (cap - s.fuel) * FUEL_REGEN_SECONDS * 1000, 'Fuel is full ⛽', `Time to run some jobs in ${town}.`)
  return out.sort((a, b) => a.at - b.at)
}

// ---- What the browser can do ----

const hasWindow = typeof window !== 'undefined'
export const notifySupported = () => hasWindow && 'Notification' in window
// Public half of the push key pair, from the Netlify env var of the same name.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const pushSupported = () => !!VAPID_PUBLIC_KEY && hasWindow && 'serviceWorker' in navigator && 'PushManager' in window && notifySupported()
export const isStandalone = () =>
  hasWindow && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
// iPhones and iPads only allow alerts from a game added to the Home Screen.
export const isIOS = () =>
  hasWindow && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let installEvent: InstallEvent | null = null

type PushUi = {
  on: boolean // the player wants alerts and the browser allows them
  installable: boolean // the browser offered its own install prompt
  card: 'alerts' | 'ios' | null // the one-off "want alerts?" card
}
export const usePush = create<PushUi>(() => ({ on: false, installable: false, card: null }))

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch { /* private mode: the setting just won't stick */ }
}
// cartopia-notify: the in-tab-only switch this replaced; players who turned it on stay on.
const wantsOn = () => notifySupported() && Notification.permission === 'granted' && (read(KEY) ?? read('cartopia-notify')) === '1'

// ---- Server side: this device's subscription and the pending alerts ----

let token: string | null = null
let userId: string | null = null
let synced: string | null = null // the user whose subscription is saved this session

async function registration() {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

function keyBytes(b64: string) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

/** Makes sure this device's push subscription is saved for the signed-in player. */
async function saveSubscription() {
  if (!supabase || !userId || synced === userId || !pushSupported() || !wantsOn()) return
  const reg = await registration()
  if (!reg) return
  let sub = await reg.pushManager.getSubscription()
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!) })
  const j = sub.toJSON()
  const { error } = await supabase.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth })
  if (!error) synced = userId
}

// Sent with keepalive straight to the API, so it still goes out while the phone is
// switching away from the game.
function sendAlerts(alerts: Alert[]) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key || !token) return
  fetch(`${url}/rest/v1/rpc/push_set_alerts`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_alerts: alerts }),
  }).catch(() => {})
}

// ---- Fallback: timers while the tab stays open ----

let timers: number[] = []
function clearTimers() {
  timers.forEach((t) => clearTimeout(t))
  timers = []
}
async function showLocal(a: Alert) {
  const opts = { body: a.body, icon: '/icons/icon-192.png', tag: a.kind }
  try {
    const reg = await registration()
    if (reg) return await reg.showNotification(a.title, opts)
    const n = new Notification(a.title, opts)
    n.onclick = () => { window.focus(); n.close() }
  } catch { /* some phones only allow alerts from an installed app */ }
}

function onHide() {
  if (!usePush.getState().on) return
  const s = useGame.getState()
  if (s.visiting) return
  const alerts = alertsFor(s)
  if (synced && synced === userId) return sendAlerts(alerts)
  clearTimers()
  const now = Date.now()
  for (const a of alerts) timers.push(window.setTimeout(() => showLocal(a), a.at - now))
}
function onShow() {
  clearTimers()
  if (synced && synced === userId) sendAlerts([])
}

// ---- Turning alerts on and off ----

/** Turns alerts on (asking the browser first) or off. Resolves to the new state. */
export async function setAlerts(on: boolean): Promise<boolean> {
  usePush.setState({ card: null })
  write(ASKED, String(Date.now()))
  if (on && notifySupported() && Notification.permission === 'default') await Notification.requestPermission()
  const ok = on && notifySupported() && Notification.permission === 'granted'
  write(KEY, ok ? '1' : '0')
  usePush.setState({ on: ok })
  if (ok) {
    await saveSubscription().catch(() => {})
  } else {
    clearTimers()
    const reg = await registration().catch(() => null)
    const sub = await reg?.pushManager.getSubscription().catch(() => null)
    if (sub) {
      if (supabase && userId) await supabase.rpc('push_unsubscribe', { p_endpoint: sub.endpoint })
      await sub.unsubscribe().catch(() => false)
    }
    synced = null
  }
  return ok
}

export function dismissCard() {
  write(ASKED, String(Date.now()))
  usePush.setState({ card: null })
}

/** Shows the browser's own install prompt (Chrome, Edge, Android). */
export async function installApp() {
  if (!installEvent) return
  await installEvent.prompt()
  await installEvent.userChoice.catch(() => null)
  installEvent = null
  usePush.setState({ installable: false })
}

// A sensible moment to offer alerts: the player just sent a car on a job long enough to leave for.
function maybeOffer(s: GameState, prev: GameState) {
  if (usePush.getState().card || usePush.getState().on || s.visiting || s.level < 2 || s.tutorial < 99) return
  const now = Date.now()
  const started = s.buildings.some((b) => b.jobEndsAt !== null && b.jobEndsAt - now >= MIN_DELAY && !prev.buildings.some((o) => o.uid === b.uid && o.jobEndsAt === b.jobEndsAt))
  if (!started) return
  if (now - Number(read(ASKED) ?? 0) < ASK_AGAIN) return
  if (notifySupported() && Notification.permission === 'default') usePush.setState({ card: 'alerts' })
  else if (isIOS() && !isStandalone()) usePush.setState({ card: 'ios' })
}

/** Registers the service worker and starts watching for when to send alerts. Call once at startup. */
export function initPush() {
  if (!hasWindow) return
  usePush.setState({ on: wantsOn() })
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(() => saveSubscription()).catch(() => {})
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent = e as InstallEvent
    usePush.setState({ installable: true })
  })
  window.addEventListener('appinstalled', () => usePush.setState({ installable: false }))
  supabase?.auth.onAuthStateChange((_e, session) => {
    token = session?.access_token ?? null
    const id = session?.user.id ?? null
    if (id !== userId) synced = null
    userId = id
    // Deferred: Supabase asks that auth callbacks don't await its own calls.
    if (id) setTimeout(() => saveSubscription().catch(() => {}), 0)
  })
  document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()))
  useGame.subscribe(maybeOffer)
}
