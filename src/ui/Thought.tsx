import { useGame } from '../game/store'
import { useThought } from '../game/thoughts'
import { anchorRef } from '../scene/anchors'

// Thought bubble over a townsperson the player tapped. Tap it to dismiss.
export function ThoughtBubble() {
  const text = useThought((s) => (s.id ? s.text : null))
  const mode = useGame((s) => s.mode)
  if (!text || mode !== 'play') return null
  return (
    <div className="badges">
      <div className="anchor" ref={anchorRef('person')}>
        <button className="badge badge-idle thought" onClick={() => useThought.setState({ id: null })}>
          {text}
        </button>
      </div>
    </div>
  )
}
