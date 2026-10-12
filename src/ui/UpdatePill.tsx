import { reloadNow, useUpdate } from '../lib/update'

// Shown once a newer build is live and the game is waiting for a quiet moment
// to reload (src/lib/update.ts). Tapping it reloads straight away.
export function UpdatePill() {
  const ready = useUpdate((s) => s.ready)
  if (!ready) return null
  return (
    <button type="button" className="update-pill" onClick={() => void reloadNow()}>
      ✨ Update ready
    </button>
  )
}
