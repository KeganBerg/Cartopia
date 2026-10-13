import { useEffect } from 'react'
import { useGame } from '../game/store'
import { useLive, pruneInvites } from '../lib/live'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'

// Challenges land in an inbox instead of popping up over the game.
export function ChallengeBell() {
  const count = useLive((l) => l.invites.length)
  const openPanel = useGame((s) => s.openPanel)
  const visiting = useGame((s) => !!s.visiting)
  useEffect(() => {
    const id = setInterval(pruneInvites, 1000)
    return () => clearInterval(id)
  }, [])
  // Only shows while a challenge is waiting; the on/off switch lives in Menu > Account.
  if (!supabase || visiting || !count) return null
  return (
    <button className="challenge-bell has" onClick={() => openPanel('invites')} title="Race challenges">
      <Icon name="flag" />
      <span className="bell-count">{count}</span>
    </button>
  )
}
