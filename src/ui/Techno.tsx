import { useEffect, useState, useSyncExternalStore } from 'react'
import { onTechnoChange, technoBeat, technoLeft, technoOn, technoToDrop, throwRave } from '../game/techno'
import { reducedMotion } from '../game/fx'
import { useCalmFlashing } from '../game/flashing'

// Rave Mode in the HUD. While the event is on, the page gets the `techno`
// class and a handful of CSS variables that follow the kick every frame (the
// styles in theme.css do the rest): buttons bounce and rock, the counters
// strobe, the nav tiles change colour on every beat, the screen edges glow and
// lasers sweep over the town. Nothing here takes a tap: the light show sits
// under the HUD and every control works as normal. Reduced motion keeps the
// colours and drops the bouncing, shaking, lasers and flashes. Reduce flashing
// (flashing.ts) goes further: the glow swells slowly instead of hitting on the
// kick, and the colour moves on once a bar instead of every beat.
//
// Before the drop it builds up: everything starts soft and grows, the tag
// counts down to the drop, the last five seconds count down big over the
// town, and the RAVE MODE title lands on the drop.

export const useTechno = () => useSyncExternalStore(onTechnoChange, () => technoOn())

const VARS = ['--tk', '--tk-m', '--tk-h', '--tk-side', '--tk-build', '--tk-drop', '--tk-sx', '--tk-sy']

export function TechnoLayer() {
  const on = useTechno()
  const soft = useCalmFlashing()
  // Seconds to the drop while counting down the last five (0 = none), and whether it has dropped.
  const [count, setCount] = useState(0)
  const [dropped, setDropped] = useState(false)
  useEffect(() => {
    if (!on) return
    const root = document.documentElement
    const calm = soft || reducedMotion()
    root.classList.add('techno')
    root.classList.toggle('techno-calm', calm)
    let raf = 0
    const last: Record<string, string> = {}
    const set = (k: string, v: string) => {
      if (last[k] === v) return
      last[k] = v
      root.style.setProperty(k, v)
    }
    let shown = -1
    let down = false
    const frame = () => {
      const b = technoBeat()
      const toDrop = technoToDrop()
      const c = toDrop > 0 && toDrop <= 5000 ? Math.ceil(toDrop / 1000) : 0
      if (c !== shown) setCount((shown = c))
      if ((toDrop === 0) !== down) setDropped((down = toDrop === 0))
      root.classList.toggle('techno-build', toDrop > 0)
      // Reduce flashing: a slow swell over two bars (well under 3 flashes a second).
      const swell = 0.2 + 0.12 * Math.sin((b.n / 32) * Math.PI)
      set('--tk', (soft ? swell : calm ? b.kick * 0.4 : b.kick).toFixed(2))
      set('--tk-m', (calm ? 0 : b.kick).toFixed(2))
      // A new colour on every beat, going round the wheel (every bar with reduce flashing).
      set('--tk-h', String((((soft ? b.bar * 67 : b.beat * 67) % 360) + 360) % 360))
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
      root.classList.remove('techno', 'techno-calm', 'techno-build')
      for (const k of VARS) root.style.removeProperty(k)
    }
  }, [on, soft])
  if (!on) return null
  return (
    <div className="techno-fx" aria-hidden>
      <div className="tk-glow" />
      <div className="tk-lasers">
        <i /><i /><i /><i />
      </div>
      <div className="tk-strobe" />
      {count > 0 && <div key={count} className="tk-count">{count}</div>}
      {/* Lands on the drop, then stays faded out. */}
      {dropped && (
        <div className="tk-title">
          <b>RAVE MODE</b>
          <span>150 BPM · EVERY TOWN</span>
        </div>
      )}
    </div>
  )
}

// The event's tag in the HUD: a little equaliser and the time to the drop, then the time left.
export function TechnoTag({ short }: { short?: boolean }) {
  const on = useTechno()
  const [, tick] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [on])
  if (!on) return null
  const toDrop = technoToDrop()
  const left = toDrop > 0 ? toDrop : technoLeft()
  // Counting down rounds up, so it reads 0:03 alongside the big 3.
  const secs = left === null ? null : toDrop > 0 ? Math.ceil(left / 1000) : Math.floor(left / 1000)
  const clock = secs === null ? null : `${toDrop > 0 ? 'DROP IN ' : ''}${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  return (
    <span className="tk-tag" title="Rave Mode is on in every town">
      <span className="tk-eq" aria-hidden><i /><i /><i /><i /></span>
      {!short && <span className="tk-name">RAVE MODE</span>}
      {clock && <span className="tk-left">{clock}</span>}
    </span>
  )
}

// The Neon Owl's button: throws a Rave Mode party on this player's screen.
export function RaveButton({ onStart }: { onStart: () => void }) {
  const on = useTechno()
  return (
    <button className="buy rave-btn" disabled={on} onClick={() => { throwRave(); onStart() }}>
      {on ? '🎧 Rave on!' : '🎧 Throw a rave'}
    </button>
  )
}
