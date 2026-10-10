import { useEffect, useState } from 'react'
import { isMuted, setMuted, onMuteChange } from '../lib/sound'

export function MuteButton() {
  const [muted, set] = useState(isMuted())
  useEffect(() => {
    const off = onMuteChange(() => set(isMuted()))
    return () => {
      off()
    }
  }, [])
  return (
    <button className="goals-btn" title={muted ? 'Sound off' : 'Sound on'} onClick={() => setMuted(!muted)}>
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
