import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary'
import { initPush } from './lib/push'
import { startLiveEvents } from './lib/liveEventsSync'
import { startUpdateCheck } from './lib/update'
import { splashProgress } from './lib/splash'

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

// Dev builds only: lets screenshot scripts open menus and seed a save.
if (import.meta.env.DEV) import('./game/store').then(({ useGame }) => Object.assign(window, { __game: useGame }))
if (import.meta.env.DEV) import('./game/thoughts').then(({ useThought }) => Object.assign(window, { __thought: useThought }))
