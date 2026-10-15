import { useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { usePrefs } from '../lib/prefs'

// Settings > Graphics > FPS counter: how many frames a second the town really draws,
// so a player can tell us a number instead of "laggy".
let frames = 0

// Inside the town canvas: counts drawn frames.
export function CountFrames() {
  useFrame(() => {
    frames++
  })
  return null
}

export const fpsOf = (n: number, ms: number) => (ms > 0 ? Math.round((n * 1000) / ms) : 0)

export function FpsMeter() {
  const on = usePrefs((p) => p.fps)
  const [fps, setFps] = useState<number | null>(null)
  useEffect(() => {
    if (!on) return
    let n0 = frames
    let t0 = performance.now()
    const id = setInterval(() => {
      const t = performance.now()
      setFps(fpsOf(frames - n0, t - t0))
      n0 = frames
      t0 = t
    }, 500)
    return () => clearInterval(id)
  }, [on])
  if (!on || fps === null) return null
  return (
    <div className="fps-meter" aria-label="Frames per second" style={{ position: 'fixed', left: 8, bottom: 'calc(env(safe-area-inset-bottom) + 100px)', zIndex: 1000, pointerEvents: 'none', padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,0.6)', color: fps >= 50 ? '#9cff57' : fps >= 30 ? '#ffd54f' : '#ff5252', font: '700 12px/1.2 system-ui, sans-serif' }}>
      {fps} fps
    </div>
  )
}
