import { Icon } from './Icon'
import { useEffect, useState } from 'react'
import { getVolume, isMuted, setMuted, setVolume, onMuteChange } from '../lib/sound'
import { musicSettings, onMusicChange, setMusic } from '../lib/townMusic'
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
      <Icon name={muted ? 'soundOff' : 'soundOn'} />
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

// Background music: on/off plus a volume slider.
export function MusicControl() {
  const [s, set] = useState(musicSettings())
  useEffect(() => {
    const off = onMusicChange(() => set(musicSettings()))
    return () => {
      off()
    }
  }, [])
  return (
    <div className="menu-sound">
      <span>Music</span>
      <input className="ambience-vol" type="range" min={0} max={100} step={5} aria-label="Music volume" disabled={!s.on}
        value={Math.round(s.volume * 100)} onChange={(e) => setMusic({ volume: Number(e.target.value) / 100 })} />
      <button className="goals-btn" title={s.on ? 'Music on' : 'Music off'} onClick={() => setMusic({ on: !s.on })}>
        {s.on ? '🎵' : '🔕'}
      </button>
    </div>
  )
}

// Everything at once: a master volume plus the sound on/off button.
export function SoundControl() {
  const [v, set] = useState(getVolume())
  const [muted, setM] = useState(isMuted())
  useEffect(() => {
    const off = onMuteChange(() => {
      set(getVolume())
      setM(isMuted())
    })
    return () => {
      off()
    }
  }, [])
  return (
    <div className="menu-sound">
      <span>Sound</span>
      <input className="ambience-vol" type="range" min={0} max={100} step={5} aria-label="Volume" disabled={muted}
        value={Math.round(v * 100)} onChange={(e) => setVolume(Number(e.target.value) / 100)} />
      <MuteButton />
    </div>
  )
}
