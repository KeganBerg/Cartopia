// Injected into every page of the desktop app (src/main.rs).
window.__CARTOPIA_DESKTOP__ = true
// F11 toggles fullscreen. capabilities/game.json lets cartopia.lol make exactly these two calls.
window.addEventListener('keydown', async (e) => {
  const ipc = window.__TAURI_INTERNALS__
  if (e.key !== 'F11' || !ipc) return
  e.preventDefault()
  try {
    const full = await ipc.invoke('plugin:window|is_fullscreen', { label: 'main' })
    await ipc.invoke('plugin:window|set_fullscreen', { label: 'main', value: !full })
  } catch {
    // Not allowed on this page (a local test build): F11 just does nothing.
  }
})
