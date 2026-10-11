// Opt-in "your town needs you" reminders while the game sits in a background tab.
// There's no push server: timers are set when the tab is hidden and cleared when
// the player comes back, so this only works while the tab stays open.
import { useGame, fuelCap } from '../game/store'
import { buildingDef, FUEL_REGEN_SECONDS } from '../game/data'

const KEY = 'cartopia-notify'
// Short jobs finish while the player is just glancing at another tab; don't ping for those.
const MIN_DELAY = 2 * 60 * 1000

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window
export const notifyOn = () => {
  try {
    return notifySupported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Turns reminders on (asking the browser first) or off. Resolves to the new state. */
export async function setNotify(on: boolean): Promise<boolean> {
  if (on && notifySupported() && Notification.permission !== 'granted') await Notification.requestPermission()
  const ok = on && notifySupported() && Notification.permission === 'granted'
  try {
    localStorage.setItem(KEY, ok ? '1' : '0')
  } catch { /* private mode: the toggle just won't stick */ }
  return ok
}

function show(title: string, body: string) {
  try {
    const n = new Notification(title, { body, icon: '/favicon.svg', tag: title })
    n.onclick = () => { window.focus(); n.close() }
  } catch { /* some phones only allow notifications from an installed app */ }
}

let timers: number[] = []
function clear() {
  timers.forEach((t) => clearTimeout(t))
  timers = []
}

function schedule() {
  clear()
  if (!notifyOn()) return
  const s = useGame.getState()
  if (s.visiting) return
  const now = Date.now()
  const at = (when: number, title: string, body: string) => {
    if (when - now >= MIN_DELAY) timers.push(window.setTimeout(() => show(title, body), when - now))
  }
  const town = s.townName || 'your town'
  // One ping when the last running job is done, rather than one per business.
  const ends = s.buildings.filter((b) => b.jobEndsAt !== null && b.jobEndsAt > now && buildingDef(b.def).kind !== 'obstacle').map((b) => b.jobEndsAt!)
  if (ends.length) at(Math.max(...ends), 'Jobs done! 💰', `Your businesses in ${town} are ready to collect.`)
  if (s.restoring && s.restoring.endsAt > now) at(s.restoring.endsAt, 'Restoration finished 🔧', 'Rusty has your car ready.')
  const cap = fuelCap(s)
  if (s.fuel < cap) at(s.fuelUpdatedAt + (cap - s.fuel) * FUEL_REGEN_SECONDS * 1000, 'Fuel is full ⛽', `Time to run some jobs in ${town}.`)
}

/** Starts watching tab visibility. Call once at startup. */
export function initNotify() {
  if (!notifySupported()) return
  document.addEventListener('visibilitychange', () => (document.hidden ? schedule() : clear()))
}
