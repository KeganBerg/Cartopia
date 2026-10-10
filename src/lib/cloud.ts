import { supabase } from './supabase'
import { useGame, saveOf, type SaveState } from '../game/store'
import { carDef, performance } from '../game/data'

let saveTimer: ReturnType<typeof setTimeout> | null = null
let userId: string | null = null
let suppress = false

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
  await supabase.from('game_saves').upsert({
    owner_id: userId,
    state: s,
    town_name: s.townName,
    level: s.level,
    best_car: bestCar(s),
    updated_at: new Date(s.updatedAt).toISOString(),
  })
}

// Newest save wins: pull the cloud copy if it is newer, otherwise push ours.
async function syncOnSignIn(uid: string) {
  if (!supabase) return
  userId = uid
  const { data } = await supabase.from('game_saves').select('state').eq('owner_id', uid).maybeSingle()
  const cloud = data?.state as SaveState | undefined
  if (cloud && cloud.updatedAt > useGame.getState().updatedAt) {
    suppress = true
    useGame.getState().loadSave(cloud)
    suppress = false
    useGame.getState().toast('Loaded your town from the cloud')
  } else {
    await pushSave()
  }
}

export function startCloudSync() {
  if (!supabase) return
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) syncOnSignIn(data.session.user.id)
  })
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session && session.user.id !== userId) syncOnSignIn(session.user.id)
    if (event === 'SIGNED_OUT') userId = null
  })
  useGame.subscribe((s, prev) => {
    if (suppress || !userId || s.updatedAt === prev.updatedAt) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(pushSave, 3000)
  })
}
