import { create } from 'zustand'
import { registerLiveKind, type LiveEvent } from '../game/liveEvents'
import './live-banner.css'

// A 'banner' live event (started from the admin panel) pins its message to the
// top of every player's screen until it ends (syncHandlers stops it on time).
const useBanner = create<{ e: LiveEvent | null }>(() => ({ e: null }))
registerLiveKind('banner', { start: (e) => useBanner.setState({ e }), stop: () => useBanner.setState({ e: null }) })

export function LiveBanner() {
  const e = useBanner((s) => s.e)
  const text = typeof e?.payload.message === 'string' ? e.payload.message.slice(0, 120) : ''
  if (!e || !text) return null
  return (
    <div className="live-banner" role="status" title="Server announcement">
      <span aria-hidden>📢</span>
      <b>{text}</b>
    </div>
  )
}
