import { useGame } from '../game/store'
import { Icon } from './Icon'

// Back arrow for the full-screen menus (crates, daily spin, Rusty's): shown when the menu was
// opened from another menu, and goes back to it. Their X closes straight to the town.
export function MenuBack() {
  const trail = useGame((s) => s.panelBack.length > 0)
  const closePanel = useGame((s) => s.closePanel)
  if (!trail) return null
  return <button className="panel-back" aria-label="Back" onClick={(e) => { e.stopPropagation(); closePanel() }}><Icon name="back" size={18} /></button>
}
