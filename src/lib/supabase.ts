import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Null when env vars are missing so the town still renders offline in dev.
export const supabase = url && key ? createClient(url, key) : null
