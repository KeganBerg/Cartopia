import { supabase } from './supabase'
import { flushSave, signedInUser } from './cloud'
import { setRescueRoller, type ServerSearch } from '../game/store'

// A signed-in player's Rusty's searches are rolled by the server (rescue_roll() in
// supabase/migrations/0022_rescue_rolls.sql), so the save guard only takes cars Rusty really found.
// Guests, and a server that doesn't have it yet, roll in the browser as before.
setRescueRoller(async (spot) => {
  if (!supabase || !signedInUser()) return null
  // The server checks the spot against the saved level, so a level-up just now has to land first.
  await flushSave()
  const { data, error } = await supabase.rpc('rescue_roll', { spot })
  if (error) {
    if (error.code === 'PGRST202') return null // not on this server yet
    throw error
  }
  return data as ServerSearch
})
