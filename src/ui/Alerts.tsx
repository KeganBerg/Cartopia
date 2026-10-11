import { useState } from 'react'
import { useGame } from '../game/store'
import { usePush, setAlerts, dismissCard, installApp, notifySupported, isIOS, isStandalone } from '../lib/push'

// The one-off "want alerts?" card, shown after the player starts a long job.
export function AlertsCard() {
  const card = usePush((p) => p.card)
  // Waits for menus and the tutorial to close so it never covers them.
  const busy = useGame((s) => !!s.panel || s.tutorial < 99)
  if (!card || busy) return null
  return (
    <div className="alerts-card">
      {card === 'alerts' ? (
        <>
          <span className="one-line">🔔 Ping me when jobs finish?</span>
          <button className="buy small" onClick={() => setAlerts(true)}>Yes</button>
        </>
      ) : (
        <span>📲 Job alerts: tap Share <b>⬆</b>, then <b>Add to Home Screen</b></span>
      )}
      <button className="alerts-x" aria-label="Not now" onClick={dismissCard}>✕</button>
    </div>
  )
}

// Menu rows: the alerts switch and, when the browser allows it, an install button.
export function AlertsMenu() {
  const on = usePush((p) => p.on)
  const installable = usePush((p) => p.installable)
  const [busy, setBusy] = useState(false)
  const iosTab = isIOS() && !isStandalone()
  const denied = notifySupported() && Notification.permission === 'denied'
  return (
    <>
      {notifySupported() && (
        <div className="menu-sound">
          <span>Job alerts{denied && <small> · blocked in browser</small>}</span>
          <button className="goals-btn" title={on ? 'Alerts on' : 'Alerts off'} disabled={denied || busy}
            onClick={async () => { setBusy(true); await setAlerts(!on); setBusy(false) }}>{on ? '🔔' : '🔕'}</button>
        </div>
      )}
      {installable && <button className="buy bank-menu-btn" onClick={installApp}>📲 Install Cartopia</button>}
      {iosTab && <p className="hint">📲 Tap Share ⬆ then Add to Home Screen to install Cartopia and get job alerts.</p>}
    </>
  )
}
