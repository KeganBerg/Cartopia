import { useEffect, useState } from 'react'
import { setPrefs, usePrefs } from '../lib/prefs'
import { DRAG_VIEWS, KART_VIEWS, VIEW_NAME, nextView } from '../scene/raceCam'

// The race camera button: a tap (or C on a keyboard) steps to the next view, the pick is
// remembered for the next race of the same kind, and the view's name flashes up for a moment.
export function CamButton({ kind }: { kind: 'drag' | 'kart' }) {
  const view = usePrefs((p) => (kind === 'drag' ? p.dragView : p.kartView))
  const [flash, setFlash] = useState(0)
  useEffect(() => {
    const step = () => {
      const p = usePrefs.getState()
      setPrefs(kind === 'drag' ? { dragView: nextView(DRAG_VIEWS, p.dragView) } : { kartView: nextView(KART_VIEWS, p.kartView) })
      setFlash((n) => n + 1)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyC' || e.repeat || (e.target as HTMLElement)?.tagName === 'INPUT') return
      step()
    }
    const onTap = () => step()
    window.addEventListener('keydown', onKey)
    window.addEventListener('cartopia-cam', onTap)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('cartopia-cam', onTap)
    }
  }, [kind])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(0), 1200)
    return () => clearTimeout(id)
  }, [flash])
  return (
    <>
      <button className="cam-btn" onClick={() => window.dispatchEvent(new Event('cartopia-cam'))} aria-label={`Camera: ${VIEW_NAME[view]}`} title="Camera: tap for the next view (C)">🎥</button>
      {flash > 0 && <div key={flash} className="cam-flash" aria-live="polite">🎥 {VIEW_NAME[view]}</div>}
    </>
  )
}
