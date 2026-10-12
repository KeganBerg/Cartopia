import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { setCrateOpener } from '../game/store'
import type { CrateOpen } from '../game/crates'

// A signed-in player's crates are opened by the server (crate_open() in
// supabase/migrations/0040_crates.sql, newest copy 0072_crate_hats.sql; hat prizes come back as
// { kind: 'hat', hat } like the game's own), so the save guard only pays prizes it really rolled.
// Guests roll in the browser.
setCrateOpener(async (crate) => {
  if (!supabase || !signedInUser()) return null
  // The server checks the price against the saved coins and gems, so what was just spent or earned has to land first.
  await flushSave()
  const { data, error } = await supabase.rpc('crate_open', { p_crate: crate })
  if (error) {
    if (error.code === 'PGRST202') throw new Error('soon') // not on this server yet
    throw new Error(error.message)
  }
  const d = data as CrateOpen | { pending: CrateOpen[] }
  return 'pending' in d ? d.pending : [d]
})
