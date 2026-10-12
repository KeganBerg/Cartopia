import { useEffect, useRef, useState } from 'react'
import { heroClip, type ArtMode } from './venueArt'
import type { WeatherKind } from '../game/weather'
import { reducedMotion } from '../game/fx'

// A race clip playing behind a Race menu tile, over the tile's still. It only loads once the
// tile is on screen, plays only while it's on screen and the tab is showing, and fades in once
// it's actually playing, so the still shows until then. Reduced motion and data saver keep the still.
const saveData = () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData

// sky and event: the race's own sky (Pro Tour legs roll theirs ahead) or weekly event, so the
// clip shows the race the tile leads to.
export function TileClip({ mode, venue, night, sky, event }: { mode: ArtMode; venue?: string; night?: boolean; sky?: WeatherKind; event?: string }) {
  const src = heroClip(mode, venue, night, sky, event)
  const ref = useRef<HTMLVideoElement>(null)
  const [on, setOn] = useState(false)
  const skip = !src || reducedMotion() || saveData()
  useEffect(() => {
    const v = ref.current
    if (!v || !src || skip) return
    setOn(false)
    v.muted = true
    v.removeAttribute('src')
    let seen = false
    const sync = () => {
      if (seen && !document.hidden) {
        if (!v.getAttribute('src')) v.src = src
        v.play().catch(() => {})
      } else v.pause()
    }
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting
      sync()
    })
    io.observe(v)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [skip, src])
  if (skip) return null
  return (
    <video ref={ref} className={`rm-clip${on ? ' on' : ''}`} muted loop playsInline preload="none"
      disablePictureInPicture aria-hidden tabIndex={-1} onPlaying={() => setOn(true)} />
  )
}
