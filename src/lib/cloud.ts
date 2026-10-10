import { supabase } from './supabase'
import { useGame, saveOf, type SaveState } from '../game/store'
import { carDef, performance } from '../game/data'

let saveTimer: ReturnType<typeof setTimeout> | null = null
// Set only once the sign-in sync has finished, so nothing uploads before the cloud copy is read.
let userId: string | null = null
let syncingFor: string | null = null
let suppress = false

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

async function pushSave() {
  if (!supabase || !userId) return
  const s = saveOf(useGame.getState())
  const { error } = await supabase.from('game_saves').upsert({
    owner_id: userId,
    state: s,
    town_name: s.townName,
    level: s.level,
    best_car: bestCar(s),
    updated_at: new Date(s.updatedAt).toISOString(),
  })
  if (error) console.warn('Cloud save failed', error.message)
}

// On sign-in the cloud save wins. The only exception is unsynced play by this same account
// in this browser that is both newer and at least as far along as the cloud copy.
async function syncOnSignIn(uid: string) {
  if (!supabase || syncingFor === uid || userId === uid) return
  syncingFor = uid
  userId = null
  const { data, error } = await supabase.from('game_saves').select('state').eq('owner_id', uid).maybeSingle()
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
  if (keepLocal) {
    writeOwner(uid)
    await pushSave()
  } else {
    if (!localIsTheirs || progressScore(local) > progressScore(cloud!)) backupLocal(local)
    suppress = true
    useGame.getState().loadSave(cloud!)
    suppress = false
    writeOwner(uid)
    useGame.getState().toast('Loaded your town from the cloud')
  }
}

export function startCloudSync() {
  if (!supabase) return
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) syncOnSignIn(data.session.user.id)
  })
  supabase.auth.onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) syncOnSignIn(session.user.id)
    if (event === 'SIGNED_OUT') {
      userId = null
      syncingFor = null
      if (saveTimer) clearTimeout(saveTimer)
    }
  })
  useGame.subscribe((s, prev) => {
    if (suppress || !userId || s.updatedAt === prev.updatedAt) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(pushSave, 3000)
  })
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
