// Sends crashes and uncaught errors from players' devices to netlify/functions/client-error.mts,
// so a bug that only happens on someone's phone shows up without them having to tell us.
// At most MAX reports per page load, and each distinct message once.

const MAX = 5
const sent = new Set<string>()

export type ErrorReport = { kind: 'crash' | 'error' | 'promise'; message: string; stack?: string }

export function errorKey(r: ErrorReport): string {
  return `${r.kind}:${r.message}`.slice(0, 300)
}

export function reportError(r: ErrorReport) {
  if (import.meta.env.DEV || !r.message) return
  const key = errorKey(r)
  if (sent.has(key) || sent.size >= MAX) return
  sent.add(key)
  const body = JSON.stringify({
    kind: r.kind,
    message: r.message.slice(0, 500),
    stack: r.stack?.slice(0, 2000),
    build: __BUILD_ID__,
    url: location.pathname,
    ua: navigator.userAgent.slice(0, 300),
  })
  try {
    fetch('/.netlify/functions/client-error', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
  } catch {
    // Reporting must never break the game.
  }
}

export function startErrorReports() {
  addEventListener('error', (e) => {
    // Failed <img>/<script> loads fire here too, with no error object; those aren't crashes.
    if (!(e.error instanceof Error)) return
    reportError({ kind: 'error', message: e.error.message, stack: e.error.stack })
  })
  addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    if (r instanceof Error) reportError({ kind: 'promise', message: r.message, stack: r.stack })
    else if (typeof r === 'string') reportError({ kind: 'promise', message: r })
  })
}
