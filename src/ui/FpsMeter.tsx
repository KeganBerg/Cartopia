import { useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { usePrefs } from '../lib/prefs'

// Settings > Graphics > FPS counter: how many frames a second the game really draws, so a
// player can tell us a number instead of "laggy". Every view counts its own drawn frames (the
// town, the race canvas, the car turntables), and the meter shows whichever is drawing most:
// the one on screen. With no 3D view drawing (a menu over a paused town), it shows the page's own
// frame rate, which is how smooth the menu scrolls. Next to it, the slowest frame of the last half second, which is what a
// stutter feels like.
type Count = { n: number; last: number; worst: number }
const views = new Map<string, Count>()

// A canvas that waited (paused under a menu) isn't one slow frame.
const IDLE = 500

export function countFrame(view: string, now: number) {
  let c = views.get(view)
  if (!c) views.set(view, (c = { n: 0, last: now, worst: 0 }))
  const gap = now - c.last
  if (gap < IDLE) c.worst = Math.max(c.worst, gap)
  c.n++
  c.last = now
}

// Inside a canvas: counts its drawn frames.
export function CountFrames({ view }: { view: string }) {
  useFrame(() => countFrame(view, performance.now()))
  return null
}

export const fpsOf = (n: number, ms: number) => (ms > 0 ? Math.round((n * 1000) / ms) : 0)

// The busiest view since the last reading, as fps and its slowest frame (ms); counts restart.
// `page`: the page's own frames over the same time, for when no view drew.
export function readFrames(ms: number, page?: Count) {
  let best: Count | null = null
  for (const c of views.values()) if (!best || c.n > best.n) best = c
  if ((!best || !best.n) && page) best = page
  const out = { fps: best ? fpsOf(best.n, ms) : 0, worst: best ? Math.round(best.worst) : 0 }
  for (const c of [...views.values(), ...(page ? [page] : [])]) {
    c.n = 0
    c.worst = 0
  }
  return out
}

export function FpsMeter() {
  const on = usePrefs((p) => p.fps)
  const [read, setRead] = useState<{ fps: number; worst: number } | null>(null)
  useEffect(() => {
    if (!on) return
    let t0 = performance.now()
    const page: Count = { n: 0, last: t0, worst: 0 }
    readFrames(1)
    let raf = requestAnimationFrame(function tick(t) {
      raf = requestAnimationFrame(tick)
      const gap = t - page.last
      if (gap < IDLE) page.worst = Math.max(page.worst, gap)
      page.n++
      page.last = t
    })
    const id = setInterval(() => {
      const t = performance.now()
      setRead(readFrames(t - t0, page))
      t0 = t
    }, 500)
    return () => {
      clearInterval(id)
      cancelAnimationFrame(raf)
    }
  }, [on])
  if (!on || read === null) return null
  const { fps, worst } = read
  return (
    <div className="fps-meter" aria-label="Frames per second and slowest frame" style={{ position: 'fixed', left: 8, bottom: 'calc(env(safe-area-inset-bottom) + 100px)', zIndex: 1000, pointerEvents: 'none', padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,0.6)', color: fps >= 50 ? '#9cff57' : fps >= 30 ? '#ffd54f' : '#ff5252', font: '700 12px/1.2 system-ui, sans-serif' }}>
      {fps} fps{worst > 0 && <span style={{ opacity: 0.75, fontWeight: 500 }}> · {worst} ms</span>}
    </div>
  )
}
