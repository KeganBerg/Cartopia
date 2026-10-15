import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// The admin panel's server calls (supabase/migrations/0095_admin_panel.sql). Every
// admin_* RPC checks public.is_admin() (0094) itself, so useIsAdmin
// only decides whether the 🛡 button shows; it keeps nobody out.

export type AdminCar = { uid: string; model: string; color: string }
export type AdminChat = { id: number; room: string; body: string; at: string }
export type AdminPlayer = {
  id: string; username: string | null; town: string | null; level: number; coins: number; gems: number
  cars: AdminCar[]; muted: string | true | null; admin: boolean; joined: string; seen: string | null; chat?: AdminChat[]
}
export type AdminLogRow = { id: number; at: string; action: string; target: string | null; name: string | null; detail: Record<string, unknown> }
export type LiveKind = 'night' | 'day' | 'rave' | 'weather' | 'banner'

// Asks the server once per sign-in. A refusal or no table yet reads as "not an admin".
export function useIsAdmin() {
  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    if (!supabase) return
    let live = true
    const check = (signedIn: boolean) => {
      if (!signedIn) return setAdmin(false)
      supabase!.rpc('is_admin').then(({ data, error }) => live && setAdmin(!error && data === true), () => live && setAdmin(false))
    }
    supabase.auth.getSession().then(({ data }) => check(!!data.session))
    const sub = supabase.auth.onAuthStateChange((_e, session) => check(!!session))
    return () => {
      live = false
      sub.data.subscription.unsubscribe()
    }
  }, [])
  return admin
}

// Turns a server refusal into a short line for a toast.
export function adminError(message: string | undefined) {
  const m = message ?? ''
  if (m.includes('not allowed words')) return 'Message has blocked words'
  if (m.includes('not allowed')) return 'Not allowed'
  if (m.includes('reason')) return 'Add a reason'
  if (m.includes('last car')) return "Can't take their last car"
  if (m.includes('not yourself')) return "Can't mute yourself"
  if (m.includes('no save')) return 'No town saved yet'
  if (m.includes('bad amount')) return 'Bad amount'
  if (m.includes('bad car')) return 'Unknown car'
  return 'Failed'
}

type Result<T> = { data: T | null; error: string | null }

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<Result<T>> {
  if (!supabase) return { data: null, error: 'Offline' }
  const { data, error } = await supabase.rpc(fn, args)
  return error ? { data: null, error: adminError(error.message) } : { data: data as T, error: null }
}

export const admin = {
  liveStart: (kind: LiveKind, minutes: number, payload: Record<string, unknown> = {}) =>
    call<number>('admin_live_start', { p_kind: kind, p_minutes: minutes, p_payload: payload }),
  liveEnd: (kind: string | null = null) => call<number>('admin_live_end', { p_kind: kind }),
  find: (q: string) => call<AdminPlayer[]>('admin_find', { p_q: q }),
  player: (id: string) => call<AdminPlayer>('admin_player', { p_uid: id }),
  grant: (id: string, coins: number, gems: number, reason: string) =>
    call<AdminPlayer>('admin_grant', { p_uid: id, p_coins: coins, p_gems: gems, p_reason: reason }),
  giveCar: (id: string, model: string, reason: string) => call<AdminPlayer>('admin_give_car', { p_uid: id, p_model: model, p_reason: reason }),
  takeCar: (id: string, car: string, reason: string) => call<AdminPlayer>('admin_take_car', { p_uid: id, p_car: car, p_reason: reason }),
  mute: (id: string, minutes: number | null, reason: string) => call<AdminPlayer>('admin_mute', { p_uid: id, p_minutes: minutes, p_reason: reason }),
  unmute: (id: string) => call<AdminPlayer>('admin_unmute', { p_uid: id }),
  chatDelete: (id: string, msg: number | null) => call<number>('admin_chat_delete', { p_uid: id, p_id: msg }),
  log: () => call<AdminLogRow[]>('admin_log_recent'),
}
