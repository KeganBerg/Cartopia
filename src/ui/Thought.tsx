import { useEffect, useRef } from 'react'
import { useGame } from '../game/store'
import { useThought } from '../game/thoughts'
import { anchorRef } from '../scene/anchors'

// Thought bubble over a townsperson the player tapped: a chip for where they're
// headed, then what they're up to. Tap it, or tap anywhere else, to dismiss.
export function ThoughtBubble() {
  const th = useThought((s) => (s.id ? s : null))
  const mode = useGame((s) => s.mode)
  const bubble = useRef<HTMLButtonElement>(null)
  const open = !!th && mode === 'play'

  // A tap elsewhere (not a drag to pan) closes it. Tapping another person
  // re-opens it for them, since their click lands after this pointerup.
  useEffect(() => {
    if (!open) return
    let down: [number, number] | null = null
    const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY] }
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return
      if (bubble.current?.contains(e.target as Node)) return
      useThought.setState({ id: null })
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
    }
  }, [open])

  if (!open) return null
  return (
    <div className="badges">
      <div className="anchor" ref={anchorRef('person')}>
        <button ref={bubble} className="badge badge-idle thought" onClick={() => useThought.setState({ id: null })}>
          {th.where && (
            <span className={`thought-where${th.there ? ' there' : ''}`}>
              <span className="thought-arrow">{th.there ? '📍' : '➜'}</span>
              {th.where}
            </span>
          )}
          <span className="thought-text">{th.text}</span>
        </button>
      </div>
    </div>
  )
}
