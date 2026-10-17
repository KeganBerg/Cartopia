import { supabase } from './supabase'
import { refreshClanBadge } from './clans'
import { useGame, saveOf, starterTown, type SaveState } from '../game/store'
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

function backupLocal(s: SaveState, owner: string | null) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), owner, save: s }))
  } catch {
    // Best effort only.
  }
}

// How far along a save is, so a starter town never counts as "newer" than real progress.
export function progressScore(s: Pick<SaveState, 'level' | 'xp' | 'cars' | 'buildings' | 'racesWon'>) {
  return s.level * 1_000_000 + s.xp + s.cars.length * 100 + s.buildings.length + s.racesWon * 10
}

function bestCar(s: SaveState) {
  let best: { name: string; color: string; pi: number; body: string; mods?: string[] } | null = null
  for (const c of s.cars) {
    const d = carDef(c.model)
    const p = performance(d, c.upgrades, c.mods)
    if (!best || p > best.pi) best = { name: d.name, color: c.color, pi: p, body: d.body, ...(c.mods?.length ? { mods: c.mods } : {}) }
  }
  return best
}

// updated_at of the cloud row this browser last read or wrote. A push only lands if the row still
// has it, so a tab left open on another device can never overwrite newer play from here.
let cloudAt: string | null = null
let pushing: Promise<void> | null = null
// The same, kept across reloads. When the row has moved on but its town's updatedAt hasn't, the server
// wrote to it (an admin gift, say) and the cloud copy must win, or this browser's next save erases it.
const CLOUD_AT_KEY = 'cartopia-cloud-at'

function readCloudAt(uid: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLOUD_AT_KEY) ?? 'null')
    return v?.uid === uid && typeof v.at === 'string' ? v.at : null
  } catch {
    return null
  }
}

function setCloudAt(at: string | null) {
  cloudAt = at
  try {
    if (at && userId) localStorage.setItem(CLOUD_AT_KEY, JSON.stringify({ uid: userId, at }))
  } catch {
    // Without it, sign-in sync just can't spot server writes made while the game was closed.
  }
}

// What the server may change in a town while it's open (admin gifts and takes). A cloud copy that
// differs from this browser's only in these is taken in place, without a reload.
const LIVE_KEYS = new Set(['cars', 'coins', 'bucks', 'parts', 'xp', 'level', 'raceCar', 'showcase'])
// Set while a server copy is being taken in, so taking it in doesn't count as play to upload.
let adopting = false

// Deep equal that ignores key order (Postgres jsonb sorts keys) and treats a missing key as undefined.
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined)
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

// Takes in a cloud copy the server changed while this town was open, when only LIVE_KEYS differ.
// False when anything else differs: the caller reloads into the cloud town instead.
export function adoptServer(cloud: SaveState, at: string): boolean {
  const s = useGame.getState()
  const local = saveOf(s) as unknown as Record<string, unknown>
  const next = cloud as unknown as Record<string, unknown>
  const changed = [...new Set([...Object.keys(local), ...Object.keys(next)])].filter((k) => k !== 'updatedAt' && !same(local[k], next[k]))
  if (changed.some((k) => !LIVE_KEYS.has(k))) return false
  setCloudAt(at)
  if (!changed.length) return true
  const gifts = (cloud.cars ?? []).filter((c) => !s.cars.some((o) => o.uid === c.uid))
  adopting = true
  try {
    useGame.setState({ ...Object.fromEntries(changed.map((k) => [k, next[k]])), updatedAt: cloud.updatedAt ?? s.updatedAt } as Partial<SaveState>)
  } finally {
    adopting = false
  }
  if (gifts.length) s.toast(`🎁 ${gifts.map((c) => carDef(c.model).name).join(', ')}`)
  return true
}

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
  // Write the cloud town straight to storage instead of loading it into the running game: drawing a whole
  // other town only to throw it away a moment later froze the page while signing in to another account.
  const { name, version, storage } = useGame.persist.getOptions()
  storage?.setItem(name!, { state: cloud, version: version ?? 0 })
  // Freeze this browser's copy at the cloud town so nothing that happens before the reload replaces it.
  useGame.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } })
  setCloudAt(at)
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
      setCloudAt(data[0].updated_at)
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

// How often an open game checks whether its cloud row changed (just its timestamp, so it's cheap).
const SERVER_CHECK_MS = 60_000

async function checkServer() {
  if (!supabase || !userId || reloading || syncingFor || saveTimer || pushing) return
  const uid = userId
  const { data, error } = await supabase.from('game_saves').select('updated_at').eq('owner_id', uid).maybeSingle()
  if (error || !data || userId !== uid || data.updated_at === cloudAt) return
  await pullNewer(uid)
}

// Load the cloud town when another device has saved since this one last synced.
async function pullNewer(uid: string, force = false, message = 'Loaded your latest town from another device') {
  if (!supabase) return
  const { data, error } = await supabase.from('game_saves').select('state, updated_at').eq('owner_id', uid).maybeSingle()
  if (error || !data || userId !== uid) return
  if (!force && data.updated_at === cloudAt) return
  // Nothing waiting to save here: a server-side change (an admin gift) can be taken in place.
  if (!force && !saveTimer && !pushing && adoptServer(data.state as SaveState, data.updated_at)) return
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
  const owner = readOwner()
  const localIsTheirs = owner === uid
  // A guest town (no owner) can move into a brand-new account; another account's town never can.
  const localMayMove = owner === null || localIsTheirs
  // The row changed since this browser last saw it: another device or the server (an admin gift) wrote it.
  const lastAt = readCloudAt(uid)
  const cloudMoved = !!data && lastAt !== null && lastAt !== data.updated_at
  const keepLocal =
    (!cloud && localMayMove) ||
    (!!cloud && localIsTheirs && !cloudMoved && local.updatedAt > cloud.updatedAt && progressScore(local) >= progressScore(cloud))
  userId = uid
  cloudAt = data?.updated_at ?? null
  writeOwner(uid)
  // This browser already shows the cloud town, e.g. right after the reload below.
  if (cloud && localIsTheirs && local.updatedAt === cloud.updatedAt && !cloudMoved) return setCloudAt(cloudAt)
  if (!cloud && !localMayMove) {
    // New account in a browser holding someone else's town: give it its own starter town.
    const fresh = starterTown()
    const { data: made, error: insertError } = await supabase.from('game_saves').insert(rowOf(uid, fresh)).select('updated_at')
    if (userId !== uid) return
    if (insertError || !made?.length) return pullNewer(uid, true)
    return loadCloud(fresh, made[0].updated_at, 'Started a new town for this account')
  }
  if (keepLocal) {
    await pushSave()
  } else {
    if (!localIsTheirs || progressScore(local) > progressScore(cloud!)) backupLocal(local, owner)
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
    if (adopting || reloading || !userId || s.updatedAt === prev.updatedAt) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void pushSave()
    }, 3000)
  })
  // Coming back to a tab that sat open while you played elsewhere picks up that newer town.
  if (typeof document !== 'undefined') {
    // While the game shows, a gift from the admin panel turns up within a minute, without a reload.
    setInterval(() => {
      if (document.visibilityState === 'visible') void checkServer()
    }, SERVER_CHECK_MS)
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
    const backup = raw ? (JSON.parse(raw) as { owner: string | null; save: SaveState }) : null
    // Only offer back a guest town or one this account already owned, never another player's.
    if (!backup || (backup.owner !== null && backup.owner !== readOwner())) return null
    return progressScore(backup.save) > progressScore(saveOf(useGame.getState())) ? backup.save : null
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

// Everything this game knows about the player, as a JSON file they can keep:
// the town save (the same one the cloud holds) plus the account it belongs to.
export function exportData(account: { id: string; email?: string; username?: string | null } | null) {
  const data = { game: 'Cartopia', exportedAt: new Date().toISOString(), account, save: saveOf(useGame.getState()) }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `cartopia-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Game progress this browser keeps outside the save, cleared by a reset so nothing old comes back.
const PROGRESS_KEYS = ['cartopia-arcade', 'cartopia-arcade-stars', 'cartopia-crate', 'cartopia-trial-best', 'cartopia-collect-all', 'cartopia-last-seen']

// Wipes the signed-in player's progress (public.reset_my_account) and starts them on a fresh
// starter town, keeping the login and player name. The server deletes the old save row, so the
// level-drop guard never sees it; the fresh town goes in as a new row, like a new player's.
export async function resetAccount(): Promise<string | null> {
  if (!supabase || !userId) return 'Offline'
  const uid = userId
  // No saves while the reset runs, or the old town could land after it.
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  reloading = true
  if (pushing) await pushing.catch(() => {})
  const { error } = await supabase.rpc('reset_my_account')
  if (error) {
    reloading = false
    return error.message
  }
  try {
    for (const k of [BACKUP_KEY, ...PROGRESS_KEYS]) localStorage.removeItem(k)
  } catch {
    // Storage blocked: nothing was kept there either.
  }
  const fresh = starterTown()
  const { data: made, error: insertError } = await supabase.from('game_saves').insert(rowOf(uid, fresh)).select('updated_at')
  // Another tab made the new row first: play on from that copy, which is also a fresh town.
  if (insertError?.code === '23505') {
    reloading = false
    await pullNewer(uid, true, 'Your town was reset')
    return null
  }
  // Either way the fresh town replaces this browser's copy, so the old one can never upload again.
  // If the insert failed, sign-in sync finds no cloud row after the reload and uploads this one.
  loadCloud(fresh, made?.[0]?.updated_at ?? '', 'Your town was reset')
  return null
}

// A signed-out player's reset: only this browser holds the town, so wiping it is the whole reset.
export function resetLocal() {
  if (saveTimer) clearTimeout(saveTimer)
  reloading = true
  useGame.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } })
  try {
    for (const k of ['cartopia-save', OWNER_KEY, BACKUP_KEY, ...PROGRESS_KEYS]) localStorage.removeItem(k)
    sessionStorage.setItem(TOAST_KEY, 'Your town was reset')
  } catch {
    // Storage blocked: nothing was kept there either.
  }
  page.reload()
}

// Deletes the account and everything stored with it (public.delete_my_account),
// then wipes this browser's copy and starts over with a new town.
export async function deleteAccount(): Promise<string | null> {
  if (!supabase) return 'Offline'
  // No saves while the account goes, or one could land after it.
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  reloading = true
  const { error } = await supabase.rpc('delete_my_account')
  if (error) {
    reloading = false
    return error.message
  }
  userId = null
  // Nothing may write the old town back before the reload.
  useGame.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } })
  try {
    for (const k of ['cartopia-save', OWNER_KEY, BACKUP_KEY]) localStorage.removeItem(k)
    sessionStorage.setItem(TOAST_KEY, 'Your account and its data were deleted.')
  } catch {
    // Storage blocked: nothing was kept there either.
  }
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  page.reload()
  return null
}
