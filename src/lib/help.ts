import { create } from 'zustand'
import { supabase } from './supabase'
import { signedInUser } from './cloud'
import { useGame, today } from '../game/store'
import { buildingDef, buildingLevel } from '../game/data'
import { HELPS_PER_TOWN, helpPrize, helpAct } from '../game/help'
import { fx } from '../game/fx'
import { sfx } from './sound'
import { recordHelp } from './gifts'

// Helping the businesses of the town you're visiting. Signed in, the server pays each help
// (town_help() in supabase/migrations/0047_town_helps.sql); guests are paid on the device.
type HelpState = {
  owner: string | null
  // Businesses helped in that town today.
  done: string[]
  busy: string | null
  // The server says this town's helps are used up (from another device, say).
  full: boolean
}
export const useHelp = create<HelpState>(() => ({ owner: null, done: [], busy: null, full: false }))

// Helps still open in the town being visited.
export const helpsLeft = (h: HelpState) => (h.full ? 0 : Math.max(0, HELPS_PER_TOWN - h.done.length))

const signedIn = () => !!supabase && !!signedInUser()
const localKey = (owner: string) => `cartopia:helps:${today()}:${owner}`

function readLocal(owner: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(owner)) ?? '[]') as string[]
  } catch {
    return []
  }
}
function writeLocal(owner: string, done: string[]) {
  try {
    localStorage.setItem(localKey(owner), JSON.stringify(done))
  } catch {
    // Private windows: helps just reset on reload.
  }
}

// Called when a visit starts: which businesses have we already helped there today?
export async function loadHelps(owner: string) {
  useHelp.setState({ owner, done: readLocal(owner), busy: null, full: false })
  if (!signedIn()) return
  const { data, error } = await supabase!.rpc('town_helps_today', { p_owner: owner })
  if (error || useHelp.getState().owner !== owner) return
  useHelp.setState({ done: (data ?? []) as string[] })
}

const why: Record<string, string> = {
  'already helped': 'You already helped there today',
  'town done': `That's all ${HELPS_PER_TOWN} helps here today`,
  'day done': "You've helped plenty of towns today. Come back tomorrow!",
}

export async function helpBuilding(uid: string, el?: Element | null) {
  const g = useGame.getState()
  const town = g.visiting
  const h = useHelp.getState()
  if (!town || h.busy || h.owner !== town.ownerId || h.done.includes(uid) || !helpsLeft(h)) return
  const b = town.buildings.find((o) => o.uid === uid)
  if (!b) return
  useHelp.setState({ busy: uid })
  try {
    let paid: { coins: number; xp: number; parts: number; bucks: number; seq?: number } | null = null
    if (signedIn()) {
      const { data, error } = await supabase!.rpc('town_help', { p_owner: town.ownerId, p_building: uid })
      // PGRST202: the server doesn't have town_help() yet, so it's paid like a guest's (the save
      // guard still caps coins by town worth).
      if (error && error.code !== 'PGRST202') {
        const msg = Object.keys(why).find((k) => error.message.includes(k))
        g.toast(msg ? why[msg] : "Couldn't help right now. Try again soon.")
        if (msg === 'already helped') useHelp.setState((s) => ({ done: [...s.done, uid] }))
        if (msg === 'town done') useHelp.setState({ full: true })
        return
      }
      if (!error) paid = data as typeof paid
    }
    if (!paid) {
      paid = { ...helpPrize(g.level, town.ownerId.startsWith('demo-') ? 1 : buildingLevel(b), h.done.length + 1), bucks: 0 }
      if (!h.done.length) recordHelp(town.ownerId)
    }
    // The first help on a visit counts towards friendship (game/friendship.ts).
    if (!h.done.length && !town.ownerId.startsWith('demo-')) useGame.getState().befriend(town.ownerId, 'help', town.townName)
    // Paid even if they've already headed home; the town's list only updates while it's on screen.
    const still = useHelp.getState().owner === town.ownerId
    const done = [...(still ? useHelp.getState().done : h.done), uid]
    if (still) useHelp.setState({ done })
    writeLocal(town.ownerId, done)
    if (still) fx({ kind: 'helped', uid, coins: paid.coins, parts: paid.parts, xp: paid.xp, el: el ?? null })
    useGame.getState().visitorPrize(paid)
    sfx.coin()
    const act = helpAct(b.def)
    const finished = done.length >= HELPS_PER_TOWN
    useGame.getState().toast(
      finished
        ? `🤝 ${town.townName} is all helped out! +$${paid.coins}${paid.parts ? `, +${paid.parts} parts` : ''}`
        : `${act.icon} You ${act.did} at ${buildingDef(b.def).name}! +$${paid.coins}`,
    )
    if (finished) useGame.getState().markHelped(town.ownerId)
  } finally {
    useHelp.setState({ busy: null })
  }
}
