import { useEffect, useState, useSyncExternalStore } from 'react'
import { onTechnoChange, technoBeat, technoLeft, technoOn } from '../game/techno'
import { reducedMotion } from '../game/fx'

// Techno Night in the HUD. While the event is on, the page gets the `techno`
// class and a handful of CSS variables that follow the kick every frame (the
// styles in theme.css do the rest): buttons bounce and rock, the counters
// strobe, the nav tiles change colour on every beat, the screen edges glow and
// lasers sweep over the town. Nothing here takes a tap: the light show sits
// under the HUD and every control works as normal. Reduced motion keeps the
// colours and drops the bouncing, shaking, lasers and flashes.

export const useTechno = () => useSyncExternalStore(onTechnoChange, () => technoOn())

const VARS = ['--tk', '--tk-m', '--tk-h', '--tk-side', '--tk-build', '--tk-drop', '--tk-sx', '--tk-sy']

export function TechnoLayer() {
  const on = useTechno()
  useEffect(() => {
    if (!on) return
    const root = document.documentElement
    const calm = reducedMotion()
    root.classList.add('techno')
    root.classList.toggle('techno-calm', calm)
    let raf = 0
    const last: Record<string, string> = {}
    const set = (k: string, v: string) => {
      if (last[k] === v) return
      last[k] = v
      root.style.setProperty(k, v)
    }
    const frame = () => {
      const b = technoBeat()
      set('--tk', (calm ? b.kick * 0.4 : b.kick).toFixed(2))
      set('--tk-m', (calm ? 0 : b.kick).toFixed(2))
      // A new colour on every beat, going round the wheel.
      set('--tk-h', String((b.beat * 67) % 360))
      set('--tk-side', String(b.side))
      set('--tk-build', b.build.toFixed(2))
      set('--tk-drop', (calm ? 0 : b.drop).toFixed(2))
      // The breakdown shakes the HUD harder and harder until the drop.
      const shake = calm ? 0 : b.build * b.build * 3
      set('--tk-sx', `${((Math.random() * 2 - 1) * shake).toFixed(1)}px`)
      set('--tk-sy', `${((Math.random() * 2 - 1) * shake).toFixed(1)}px`)
      raf = requestAnimationFrame(frame)
    }
    frame()
    return () => {
      cancelAnimationFrame(raf)
      root.classList.remove('techno', 'techno-calm')
      for (const k of VARS) root.style.removeProperty(k)
    }
  }, [on])
  if (!on) return null
  return (
    <div className="techno-fx" aria-hidden>
      <div className="tk-glow" />
      <div className="tk-lasers">
        <i /><i /><i /><i />
      </div>
      <div className="tk-strobe" />
      {/* Plays once as the event starts, then stays faded out. */}
      <div className="tk-title">
        <b>RAVE MODE</b>
        <span>150 BPM · EVERY TOWN</span>
      </div>
    </div>
  )
}

// The event's tag in the HUD: a little equaliser and the time left.
export function TechnoTag({ short }: { short?: boolean }) {
  const on = useTechno()
  const [, tick] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [on])
  if (!on) return null
  const left = technoLeft()
  const clock = left === null ? null : `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`
  return (
    <span className="tk-tag" title="Rave Mode is on in every town">
      <span className="tk-eq" aria-hidden><i /><i /><i /><i /></span>
      {!short && <span className="tk-name">RAVE MODE</span>}
      {clock && <span className="tk-left">{clock}</span>}
    </span>
  )
}
