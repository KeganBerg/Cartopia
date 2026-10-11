import { supabase } from './supabase'
import { refreshClanBadge } from './clans'
import { useGame, saveOf, type SaveState } from '../game/store'
import { carDef, performance, garagePower } from '../game/data'

let saveTimer: ReturnType<typeof setTimeout> | null = null
// Set only once the sign-in sync has finished, so nothing uploads before the cloud copy is read.
let userId: string | null = null
let syncingFor: string | null = null

// Which account the save in this browser belongs to. A fresh or guest town has none.
const OWNER_KEY = 'cartopia-save-owner'
// The local town we replaced with a cloud save, kept in case it was the one that mattered.
const BACKUP_KEY = 'cartopia-save-backup'

function readOwner() {
  try {
    return localStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

function writeOwner(uid: string) {
  try {
    localStorage.setItem(OWNER_KEY, uid)
  } catch {
    // Storage blocked: sync still works, it just always trusts the cloud.
  }
}

function backupLocal(s: SaveState) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), owner: readOwner(), save: s }))
  } catch {
    // Best effort only.
  }
}

// How far along a save is, so a starter town never counts as "newer" than real progress.
export function progressScore(s: Pick<SaveState, 'level' | 'xp' | 'cars' | 'buildings' | 'racesWon'>) {
  return s.level * 1_000_000 + s.xp + s.cars.length * 100 + s.buildings.length + s.racesWon * 10
}

function bestCar(s: SaveState) {
  let best: { name: string; color: string; pi: number; body: string } | null = null
  for (const c of s.cars) {
    const d = carDef(c.model)
    const p = performance(d, c.upgrades)
    if (!best || p > best.pi) best = { name: d.name, color: c.color, pi: p, body: d.body }
  }
  return best
}

// updated_at of the cloud row this browser last read or wrote. A push only lands if the row still
// has it, so a tab left open on another device can never overwrite newer play from here.
let cloudAt: string | null = null
let pushing: Promise<void> | null = null

function rowOf(uid: string, s: SaveState) {
  return {
    owner_id: uid,
    state: s,
    town_name: s.townName,
    level: s.level,
    best_car: bestCar(s),
    power: garagePower(s.cars),
    updated_at: new Date(s.updatedAt).toISOString(),
  }
}

// Swapped out in tests, where jsdom can't navigate.
export const page = { reload: () => window.location.reload() }
const TOAST_KEY = 'cartopia-toast'
// Set while the page reloads into a cloud town, so the old town can't save in the meantime.
let reloading = false

// Saves the cloud town into this browser, then reloads so every part of the game starts from it.
function loadCloud(cloud: SaveState, at: string, message: string) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  reloading = true
  useGame.getState().loadSave(cloud)
  // Freeze this browser's copy at the cloud town so nothing that happens before the reload replaces it.
  useGame.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } })
  cloudAt = at
  try {
    sessionStorage.setItem(TOAST_KEY, message)
  } catch {
    // The toast is a nicety.
  }
  page.reload()
}

async function pushSave(): Promise<void> {
  if (pushing) {
    await pushing
    return pushSave()
  }
  pushing = (async () => {
    if (!supabase || !userId || reloading) return
    const uid = userId
    const row = rowOf(uid, saveOf(useGame.getState()))
    const { data, error } = cloudAt
      ? await supabase.from('game_saves').update(row).eq('owner_id', uid).eq('updated_at', cloudAt).select('updated_at, corrections')
      : await supabase.from('game_saves').insert(row).select('updated_at, corrections')
    if (userId !== uid) return
    // 23505: row created elsewhere first. 23514: the server refused to lower your level.
    if (error && error.code !== '23505' && error.code !== '23514') return console.warn('Cloud save failed', error.message)
    if (!error && data && data.length) {
      cloudAt = data[0].updated_at
      // The server trimmed something it couldn't verify (see 0005_economy_guard.sql): play on from its copy.
      if (data[0].corrections) await pullNewer(uid, true, 'Your town was synced with the server')
      return
    }
    // Another device saved since we last synced (or created the row first): its town wins.
    await pullNewer(uid, true)
  })()
  try {
    await pushing
  } finally {
    pushing = null
  }
}

// The signed-in account whose town this browser is playing, once sign-in sync is done.
export const signedInUser = () => userId

// Saves now instead of in a few seconds, e.g. so a live race uses the car you just upgraded.
export async function flushSave() {
  if (!userId) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    await pushSave()
  } else if (pushing) {
    await pushing
  }
}

// Load the cloud town when another device has saved since this one last synced.
async function pullNewer(uid: string, force = false, message = 'Loaded your latest town from another device') {
  if (!supabase) return
  const { data, error } = await supabase.from('game_saves').select('state, updated_at').eq('owner_id', uid).maybeSingle()
  if (error || !data || userId !== uid) return
  if (!force && data.updated_at === cloudAt) return
  if (saveTimer) clearTimeout(saveTimer)
  loadCloud(data.state as SaveState, data.updated_at, message)
}

// On sign-in the cloud save wins. The only exception is unsynced play by this same account
// in this browser that is both newer and at least as far along as the cloud copy.
async function syncOnSignIn(uid: string) {
  if (!supabase || syncingFor === uid || userId === uid) return
  syncingFor = uid
  userId = null
  cloudAt = null
  const { data, error } = await supabase.from('game_saves').select('state, updated_at').eq('owner_id', uid).maybeSingle()
  if (syncingFor !== uid) return
  syncingFor = null
  if (error) {
    // Never guess when we can't read the cloud copy: stay local-only rather than risk overwriting it.
    console.warn('Could not load cloud save', error.message)
    useGame.getState().toast('Could not reach your cloud save. Reload to try again.')
    return
  }
  const cloud = data?.state as SaveState | undefined
  const local = saveOf(useGame.getState())
  const localIsTheirs = readOwner() === uid
  const keepLocal =
    !cloud ||
    (localIsTheirs && local.updatedAt > cloud.updatedAt && progressScore(local) >= progressScore(cloud))
  userId = uid
  cloudAt = data?.updated_at ?? null
  writeOwner(uid)
  // This browser already shows the cloud town, e.g. right after the reload below.
  if (cloud && localIsTheirs && local.updatedAt === cloud.updatedAt) return
  if (keepLocal) {
    await pushSave()
  } else {
    if (!localIsTheirs || progressScore(local) > progressScore(cloud!)) backupLocal(local)
    loadCloud(cloud!, data!.updated_at, 'Loaded your town from the cloud')
  }
}

export function startCloudSync() {
  if (!supabase) return
  try {
    const message = sessionStorage.getItem(TOAST_KEY)
    sessionStorage.removeItem(TOAST_KEY)
    if (message) useGame.getState().toast(message)
  } catch {
    // The toast is a nicety.
  }
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) syncOnSignIn(data.session.user.id)
  })
  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
      syncOnSignIn(session.user.id)
      refreshClanBadge(session.user.id).catch(() => {})
    }
    if (event === 'SIGNED_OUT') {
      useGame.setState({ clanBadge: null })
      userId = null
      syncingFor = null
      cloudAt = null
      if (saveTimer) clearTimeout(saveTimer)
    }
  })
  useGame.subscribe((s, prev) => {
    if (reloading || !userId || s.updatedAt === prev.updatedAt) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(pushSave, 3000)
  })
  // Coming back to a tab that sat open while you played elsewhere picks up that newer town.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && userId && !syncingFor) pullNewer(userId)
      // Leaving the tab (e.g. to pick up another device) saves right away instead of in 3s.
      if (document.visibilityState === 'hidden' && saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
        pushSave()
      }
    })
  }
}

// A local town that sign-in replaced, offered back only when it is further along than the current one.
export function localBackup(): SaveState | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    const save = raw ? (JSON.parse(raw).save as SaveState) : null
    return save && progressScore(save) > progressScore(saveOf(useGame.getState())) ? save : null
  } catch {
    return null
  }
}

export function restoreLocalBackup() {
  const save = localBackup()
  if (!save) return
  // Stamped now so the restored town is the newest copy and autosaves to the cloud.
  useGame.getState().loadSave({ ...save, updatedAt: Date.now() })
  try {
    localStorage.removeItem(BACKUP_KEY)
  } catch {
    // Best effort only.
  }
  useGame.getState().toast('Restored your town from this device')
}
