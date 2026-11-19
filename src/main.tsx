import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import './scene/safeColor'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary'
import { initPush } from './lib/push'
import { startLiveEvents } from './lib/liveEventsSync'
import { startUpdateCheck } from './lib/update'
import { splashProgress } from './lib/splash'
import { startRepWatch } from './game/reputation'
import { startRecapWatch } from './game/recap'
import { startErrorReports } from './lib/errorReport'
import { watchPasswordRecovery } from './ui/Account'
import { startLang } from './i18n/lang'

startErrorReports()

splashProgress(0.7)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
initPush()
startLiveEvents()
startUpdateCheck()
startRepWatch()
startRecapWatch()
watchPasswordRecovery()
// Spanish or Portuguese for players whose device is set to them (or who picked one in Settings).
startLang()
// The game never scrolls the page itself; if something does (a focus, a menu sliding in),
// put it back so the HUD and menu headers stay on screen.
addEventListener('scroll', () => { if (scrollX || scrollY) scrollTo(0, 0) }, { passive: true })

// Dev builds only: lets screenshot scripts open menus and seed a save.
if (import.meta.env.DEV) import('./game/store').then(({ useGame }) => Object.assign(window, { __game: useGame }))
if (import.meta.env.DEV) import('./i18n/lang').then(({ setLang }) => Object.assign(window, { __setLang: setLang }))
if (import.meta.env.DEV) import('./game/thoughts').then(({ useThought }) => Object.assign(window, { __thought: useThought }))
