import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary'
import { initNotify } from './lib/notify'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
initNotify()

// Dev builds only: lets screenshot scripts open menus and seed a save.
if (import.meta.env.DEV) import('./game/store').then(({ useGame }) => Object.assign(window, { __game: useGame }))
