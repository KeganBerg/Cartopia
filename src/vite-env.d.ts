/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

// Build id from vite.config.ts; matches /version.json for the same deploy.
declare const __BUILD_ID__: string
