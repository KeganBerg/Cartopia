import { create } from 'zustand'
import { supabase } from './supabase'
import { signedInUser } from './cloud'
import { displayName } from './names'
import { DEMO, demoTown } from './friends'
import { useGame, type OwnedCar } from '../game/store'
import { showcaseOf } from '../game/meet'

// Likes are counted server-side in supabase/migrations/0030_car_meet_likes.sql.
export type Display = { ownerId: string; townName: string; level: number; cars: OwnedCar[]; demo?: boolean }
type Likes = { likes: number; liked: boolean }

type MeetState = {
  likes: Record<string, Likes>
  // False until the likes table answers, so the hearts hide before the SQL is live.
  live: boolean
}
export const useMeet = create<MeetState>(() => ({ likes: {}, live: false }))

// Neighbours keep a steady, made-up like count so the meet never looks empty.
const DEMO_LIKES = [23, 9, 41]

function demoDisplays(): Display[] {
  return DEMO.map((d) => {
    const t = demoTown(d)
    return { ownerId: d.id, townName: d.name, level: d.level, cars: showcaseOf(t.cars, null), demo: true }
  })
}

// The most recently active players' displays, plus the neighbours.
export async function fetchMeet(): Promise<Display[]> {
  const me = signedInUser()
  let real: Display[] = []
  if (supabase) {
    const { data } = await supabase
      .from('game_saves')
      .select('owner_id, town_name, level, cars:state->cars, showcase:state->showcase')
      .order('updated_at', { ascending: false })
      .limit(30)
    real = (data ?? [])
      .filter((r) => r.owner_id !== me && Array.isArray(r.cars) && r.cars.length)
      .map((r) => ({
        ownerId: r.owner_id,
        townName: displayName(r.town_name, r.owner_id),
        level: r.level,
        cars: showcaseOf(r.cars as OwnedCar[], r.showcase as string[] | null),
      }))
  }
  const all = [...real, ...demoDisplays()]
  await refreshLikes([...all.map((d) => d.ownerId), ...(me ? [me] : [])])
  return all
}

export async function refreshLikes(owners: string[]) {
  const demo = Object.fromEntries(DEMO.map((d, i) => [d.id, { likes: DEMO_LIKES[i] ?? 5, liked: false }]))
  useMeet.setState((m) => ({ likes: { ...demo, ...m.likes } }))
  const ids = owners.filter((o) => !o.startsWith('demo-'))
  if (!supabase || !signedInUser() || !ids.length) return
  const { data, error } = await supabase.rpc('meet_likes', { p_owners: ids })
  if (error) return
  const rows = (data ?? []) as { owner: string; likes: number; liked: boolean }[]
  useMeet.setState((m) => ({ live: true, likes: { ...m.likes, ...Object.fromEntries(rows.map((r) => [r.owner, { likes: r.likes, liked: r.liked }])) } }))
}

export async function likeDisplay(owner: string) {
  const toast = useGame.getState().toast
  const cur = useMeet.getState().likes[owner] ?? { likes: 0, liked: false }
  if (cur.liked) return
  const bump = () => useMeet.setState((m) => ({ likes: { ...m.likes, [owner]: { likes: cur.likes + 1, liked: true } } }))
  // Neighbours take a like on this device only.
  if (owner.startsWith('demo-')) return bump()
  if (!supabase || !signedInUser()) return toast('Sign in to like displays')
  const { data, error } = await supabase.rpc('like_display', { p_owner: owner })
  if (error || data === 'no') return toast("Couldn't like that right now")
  if (data === 'limit') return toast("That's all 40 likes for today")
  if (data === 'liked') bump()
  else useMeet.setState((m) => ({ likes: { ...m.likes, [owner]: { ...cur, liked: true } } }))
}
