import { create } from 'zustand'
import { useGame } from '../game/store'
import { useLive } from './live'
import { flushSave } from './cloud'

// New-version check. Every build writes its id to /version.json (vite.config.ts).
// Open games look every few minutes and whenever the tab comes back; when a
// newer build is live they reload at a safe moment (tab hidden, or nothing
// open in the town), saving first. Until then a small "Update ready" pill
// lets the player reload themselves.

const CHECK_MS = 3 * 60 * 1000
// How long the town must sit with nothing open before reloading under the player.
const QUIET_MS = 20 * 1000

export const useUpdate = create<{ ready: boolean }>(() => ({ ready: false }))

let lastBusy = Date.now()
let reloading = false
// The build we last reloaded for. If the page comes back still on an older
// build (a cached page mid-deploy), don't reload again for it: just show the pill.
const TRIED = 'cartopia-update-tried'
let target = ''
const tried = () => {
  try {
    return sessionStorage.getItem(TRIED)
  } catch {
    return null
  }
}

async function check() {
  if (useUpdate.getState().ready) return
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return
    const { v } = (await res.json()) as { v?: string }
    if (v && v !== __BUILD_ID__) {
      target = v
      useUpdate.setState({ ready: true })
      maybeReload()
    }
  } catch {
    // Offline or between deploys: look again next time.
  }
}

// Nothing the player is in the middle of: no menu, no edit mode, no race, not
// visiting a friend.
export function isQuiet() {
  const g = useGame.getState()
  return g.panel === null && g.mode === 'play' && !g.visiting && !g.placing && !useLive.getState().race
}

export async function reloadNow() {
  if (reloading) return
  reloading = true
  try {
    sessionStorage.setItem(TRIED, target)
  } catch {
    // Without storage a stuck deploy could reload twice; harmless.
  }
  try {
    await flushSave()
  } finally {
    window.location.reload()
  }
}

function maybeReload() {
  if (!useUpdate.getState().ready || tried() === target) return
  if (document.hidden || (isQuiet() && Date.now() - lastBusy > QUIET_MS)) void reloadNow()
}

export function startUpdateCheck() {
  if (import.meta.env.DEV) return
  useGame.subscribe(() => {
    if (!isQuiet()) lastBusy = Date.now()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) maybeReload()
    else void check()
  })
  // Any tap or key counts as busy too, so the page never reloads mid-drag.
  for (const e of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(e, () => (lastBusy = Date.now()), { passive: true })
  setInterval(() => void check(), CHECK_MS)
  setInterval(maybeReload, 5000)
  setTimeout(() => void check(), 30000)
}
