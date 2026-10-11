import { Component, type ReactNode } from 'react'
import { hideSplash } from './lib/splash'

// Catches render crashes so players get a way back instead of a blank screen.
// Their save lives in this browser (and the cloud), so a reload restores it.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Cartopia crashed:', error)
    hideSplash()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="overlay crash-screen">
        <div className="prize">
          <h2>Oops, a wheel came off!</h2>
          <p>Something went wrong. Your town is saved, so reloading will put you right back.</p>
          <button className="buy" onClick={() => location.reload()}>Reload Cartopia</button>
          <p className="hint crash-detail">{this.state.error.message}</p>
        </div>
      </div>
    )
  }
}
