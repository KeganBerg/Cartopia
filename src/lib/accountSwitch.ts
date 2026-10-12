import { supabase } from './supabase'
import { useGifts, refreshGifts } from './gifts'
import { useGhost, refreshTaunts } from './ghosts'
import { useFriends } from './friendsList'
import { useCrewMates } from './crewRaces'
import { fetchMyClan } from './clans'

// Signing out (or in as someone else) doesn't reload the page, so the last
// account's gifts, taunts, friend requests and crewmates are cleared here, and
// the new account's crewmates are loaded so a ghost race against one counts for
// the crew without opening the Crew window first.
let last: string | null | undefined

export async function loadCrewMates(uid: string) {
  const mine = await fetchMyClan(uid).catch(() => undefined)
  if (mine === undefined) return
  useCrewMates.setState({ ids: (mine?.members ?? []).map((m) => m.ownerId).filter((id) => id !== uid) })
}

export function onAccount(uid: string | null) {
  if (uid === last) return
  const switched = last !== undefined
  last = uid
  if (switched) {
    useGifts.setState({ inbox: [], sent: {} })
    useGhost.setState({ inbox: [] })
    useFriends.setState({ list: [], loaded: false })
    useCrewMates.setState({ ids: [] })
  }
  if (!uid) return
  void loadCrewMates(uid)
  // The gift and taunt watchers only poll slowly once they've loaded the first account.
  if (switched) setTimeout(() => {
    refreshGifts().catch(() => {})
    refreshTaunts().catch(() => {})
  }, 3000)
}

supabase?.auth.onAuthStateChange((_e, session) => setTimeout(() => onAccount(session?.user.id ?? null), 0))
