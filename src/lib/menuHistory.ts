import { useGame } from '../game/store'

// The phone's back gesture and the browser's back button step back through the menus, like
// the back arrow: while a menu is open there is one history entry of ours on top, and going
// back off it closes a menu instead of leaving the game.
// A race or Rusty's search under way stays put: back does nothing there (its X leaves).
const busy = () => !!document.querySelector('.race-full:not(.crate-full)')

export function startMenuHistory() {
  let pushed = false
  // Our own history.back() after a menu closed from the screen: its popstate is not a back press.
  let skip = 0
  const push = () => {
    history.pushState({ cartopiaMenu: true }, '')
    pushed = true
  }
  const onPop = () => {
    if (skip) return void skip--
    if (!pushed) return
    pushed = false
    if (!useGame.getState().panel) return
    // Still in a menu (the one before, or the race that ignored it): a fresh entry for the next back.
    if (!busy()) useGame.getState().closePanel()
    if (useGame.getState().panel && !pushed) push()
  }
  const unsub = useGame.subscribe((s, prev) => {
    if (s.panel === prev.panel) return
    if (s.panel && !pushed) push()
    // Closed from the screen: take our entry off, unless another menu opened straight after.
    else if (!s.panel && pushed)
      queueMicrotask(() => {
        if (useGame.getState().panel || !pushed) return
        pushed = false
        skip++
        history.back()
      })
  })
  window.addEventListener('popstate', onPop)
  if (useGame.getState().panel) push()
  return () => {
    unsub()
    window.removeEventListener('popstate', onPop)
  }
}
