import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { setCrateOpener, setWheelSpinner, today, useGame } from '../game/store'
import type { CrateOpen } from '../game/crates'

// A signed-in player's crates are opened by the server (crate_open() in
// supabase/migrations/0040_crates.sql, newest copy 0072_crate_hats.sql; hat prizes come back as
// { kind: 'hat', hat } like the game's own), so the save guard only pays prizes it really rolled.
// Guests roll in the browser. The ×10 open is one call to crate_open_many(), which rolls the ten
// on the server as one batch (supabase/pending/crate_open_many.sql) and hands them all back.
setCrateOpener(async (crate, free, count = 1) => {
  if (!supabase || !signedInUser()) return null
  // The server checks the price against the saved coins and gems, so what was just spent or earned has to land first.
  await flushSave()
  const { data, error } = count > 1
    ? await supabase.rpc('crate_open_many', { p_crate: crate, p_count: count })
    : await supabase.rpc('crate_open', free ? { p_crate: crate, p_free: free } : { p_crate: crate })
  if (error) {
    if (error.code === 'PGRST202') throw new Error('soon') // not on this server yet
    throw new Error(error.message)
  }
  const d = data as CrateOpen | { pending: CrateOpen[] } | { opens: CrateOpen[] }
  return 'pending' in d ? d.pending : 'opens' in d ? d.opens : [d]
})

// The daily wheel spin, rolled by wheel_spin() (supabase/migrations/0064_wheel_spin.sql). Opens the save
// never counted come back first: they're added and saved, then the spin is asked for again.
setWheelSpinner(async () => {
  if (!supabase || !signedInUser()) return null
  await flushSave()
  const pending: CrateOpen[] = []
  for (let i = 0; i < 2; i++) {
    const { data, error } = await supabase.rpc('wheel_spin')
    if (error) {
      if (error.code === 'PGRST202') throw new Error('soon')
      // A spin that never reached the save came back with the pending opens: it's been added.
      if (pending.some((o) => o.crate === 'wheel') && error.message.includes('spun today')) return { spin: null, day: today(), pending }
      throw new Error(error.message)
    }
    const d = data as { slice: string; day: string; open: CrateOpen } | { pending: CrateOpen[] }
    if (!('pending' in d)) return { spin: { slice: d.slice, open: d.open }, day: d.day, pending }
    for (const o of d.pending) useGame.getState().applyCrate(o)
    pending.push(...d.pending)
    await flushSave()
  }
  throw new Error('busy')
})
