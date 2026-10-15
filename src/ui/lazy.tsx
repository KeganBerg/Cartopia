import { useEffect, useState, type ComponentType } from 'react'
import { reloadNow } from '../lib/update'
import { useGame, type Panel } from '../game/store'

// A component whose code loads the first time it shows. Shows nothing for the
// moment the file is loading, then the component with the same props. (A plain
// state flip rather than React.lazy, which never showed the panel in the dev server.)
export function onDemand<M, P extends object = object>(load: () => Promise<M>, pick: (m: M) => ComponentType<P>) {
  let Loaded: ComponentType<P> | null = null
  return function OnDemand(props: P) {
    const [, setReady] = useState(false)
    useEffect(() => {
      if (!Loaded) void load().then((m) => { Loaded = pick(m); setReady(true) }, loadFailed)
    }, [])
    return Loaded ? <Loaded {...props} /> : null
  }
}

// A tab left open across an update still asks for the old build's files, which
// are gone, so a menu would open to nothing. Reload onto the new build (saving
// first) and open the same menu again; if that already happened a moment ago,
// the network is the problem, so close the menu and say so.
const RETRY = 'cartopia-chunk-reload'
const REOPEN = 'cartopia-reopen-panel'

function loadFailed() {
  const g = useGame.getState()
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RETRY)) || 0
  } catch {
    // No storage: treat it as the first try.
  }
  if (Date.now() - last > 60000) {
    try {
      sessionStorage.setItem(RETRY, String(Date.now()))
      if (g.panel) sessionStorage.setItem(REOPEN, g.panel)
    } catch {
      // Without storage the menu just doesn't reopen.
    }
    void reloadNow()
    return
  }
  g.closePanel()
  g.toast("Couldn't load that. Check your connection.")
}

// After that reload: open the menu the player had tapped. Called once at start.
export function reopenAfterReload() {
  try {
    const panel = sessionStorage.getItem(REOPEN)
    if (!panel) return
    sessionStorage.removeItem(REOPEN)
    useGame.getState().openPanel(panel as Panel)
  } catch {
    // No storage: nothing to reopen.
  }
}
