import { useEffect, useState } from 'react'
import { isMuted, setMuted, onMuteChange } from '../lib/sound'
import { ambienceSettings, onAmbienceChange, setAmbience } from '../lib/ambience'

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

// Town sounds (crickets, traffic, birds...): on/off plus a volume slider.
export function AmbienceControl() {
  const [s, set] = useState(ambienceSettings())
  useEffect(() => {
    const off = onAmbienceChange(() => set(ambienceSettings()))
    return () => {
      off()
    }
  }, [])
  return (
    <div className="menu-sound">
      <span>Town sounds</span>
      <input className="ambience-vol" type="range" min={0} max={100} step={5} aria-label="Town sounds volume" disabled={!s.on}
        value={Math.round(s.volume * 100)} onChange={(e) => setAmbience({ volume: Number(e.target.value) / 100 })} />
      <button className="goals-btn" title={s.on ? 'Town sounds on' : 'Town sounds off'} onClick={() => setAmbience({ on: !s.on })}>
        {s.on ? '🌳' : '🔕'}
      </button>
    </div>
  )
}
